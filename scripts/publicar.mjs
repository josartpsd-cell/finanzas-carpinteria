import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 4173;
const ARQUIVO_URL = path.join(ROOT, 'public-url.txt');
const LOG = path.join(ROOT, 'publicacao.log');

let servidor = null;
let tunel = null;
let encerrando = false;
let urlAtual = null;

function log(msg) {
  const linha = `[${new Date().toISOString()}] ${msg}`;
  console.log(linha);
  try {
    fs.appendFileSync(LOG, linha + '\n');
  } catch {}
}

function subirServidor() {
  servidor = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  servidor.stdout.on('data', (d) => log(`servidor: ${String(d).trim()}`));
  servidor.stderr.on('data', (d) => log(`servidor erro: ${String(d).trim()}`));
  servidor.on('exit', (code) => {
    if (encerrando) return;
    log(`servidor caiu (código ${code}); reiniciando em 3s`);
    setTimeout(subirServidor, 3000);
  });
}

function subirTunel() {
  tunel = spawn('cloudflared', ['tunnel', '--url', `http://localhost:${PORT}`, '--no-autoupdate'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const analisar = (buf) => {
    const texto = String(buf);
    const m = texto.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (m && m[0] !== urlAtual) {
      urlAtual = m[0];
      fs.writeFileSync(ARQUIVO_URL, urlAtual + '\n');
      log(`URL pública: ${urlAtual}`);
    }
  };

  tunel.stdout.on('data', analisar);
  tunel.stderr.on('data', analisar);
  tunel.on('exit', (code) => {
    if (encerrando) return;
    log(`túnel caiu (código ${code}); reiniciando em 5s`);
    setTimeout(subirTunel, 5000);
  });
}

function encerrar() {
  encerrando = true;
  log('encerrando servidor e túnel');
  try {
    servidor?.kill();
  } catch {}
  try {
    tunel?.kill();
  } catch {}
  setTimeout(() => process.exit(0), 500);
}

process.on('SIGINT', encerrar);
process.on('SIGTERM', encerrar);

log(`iniciando publicação na porta ${PORT}`);
subirServidor();
setTimeout(subirTunel, 1500);
