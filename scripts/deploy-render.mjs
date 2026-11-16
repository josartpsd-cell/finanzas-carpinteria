import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://api.render.com/v1';
const chave = process.env.RENDER_API_KEY;
const repo = process.env.GITHUB_REPO;
const senha = process.env.APP_PASSWORD;

if (!chave) {
  console.error('Falta RENDER_API_KEY. Crie em Render → Account Settings → API Keys.');
  process.exit(1);
}
if (!repo) {
  console.error('Falta GITHUB_REPO (ex.: usuario/finanzas-carpinteria).');
  process.exit(1);
}

async function chamar(caminho, opcoes = {}) {
  const res = await fetch(`${API}${caminho}`, {
    ...opcoes,
    headers: {
      Authorization: `Bearer ${chave}`,
      'Content-Type': 'application/json',
      ...(opcoes.headers || {}),
    },
  });
  const txt = await res.text();
  let dados = null;
  try {
    dados = txt ? JSON.parse(txt) : null;
  } catch {
    dados = txt;
  }
  if (!res.ok) throw new Error(`Render ${res.status}: ${typeof dados === 'string' ? dados : JSON.stringify(dados)}`);
  return dados;
}

const donos = await chamar('/owners?limit=1');
const ownerId = donos?.[0]?.owner?.id || donos?.[0]?.id;
if (!ownerId) throw new Error('Não foi possível descobrir o ownerId da conta Render.');

const corpo = {
  type: 'web_service',
  name: 'finanzas-carpinteria',
  ownerId,
  repo: `https://github.com/${repo}`,
  branch: 'master',
  autoDeploy: 'yes',
  envVars: [
    { key: 'NODE_VERSION', value: '22.16.0' },
    { key: 'DATA_DIR', value: '/var/data' },
    { key: 'UPLOAD_DIR', value: '/var/data/uploads' },
    ...(senha ? [{ key: 'APP_PASSWORD', value: senha }] : []),
  ],
  serviceDetails: {
    env: 'node',
    plan: 'starter',
    region: 'ohio',
    healthCheckPath: '/login',
    envSpecificDetails: {
      buildCommand: 'npm install --omit=dev',
      startCommand: 'node server.js',
    },
  },
  disk: {
    name: 'datos',
    mountPath: '/var/data',
    sizeGB: 1,
  },
};

const servico = await chamar('/services', { method: 'POST', body: JSON.stringify(corpo) });
const id = servico?.service?.id || servico?.id;
const url = servico?.service?.serviceDetails?.url || servico?.serviceDetails?.url || '';

fs.writeFileSync(path.join(ROOT, 'render-service.json'), JSON.stringify({ id, url, repo }, null, 2));
console.log(`Serviço criado: ${id}`);
console.log(`URL: ${url || '(aguardando primeiro deploy)'}`);
