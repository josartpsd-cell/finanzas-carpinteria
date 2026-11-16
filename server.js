import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, UPLOAD_DIR, getFile, isSeeded } from './src/db.js';
import { seed } from './src/seed.js';
import { api } from './src/api.js';
import { authApi, requireAuth, garantirSenhaInicial } from './src/auth.js';

if (!isSeeded()) {
  seed();
  console.log('Base creada y poblada con datos de ejemplo.');
}

const senhaInicial = garantirSenhaInicial();
if (senhaInicial) {
  console.log(`Contraseña inicial: ${senhaInicial} (cámbiala en Cuentas y categorías → Seguridad)`);
}

const app = express();
const PORT = Number(process.env.PORT) || 4173;

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(requireAuth);
app.use('/api', authApi);
app.use('/api', api);
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '1h' }));
app.get('/uploads/:nome', (req, res) => {
  const nome = req.params.nome;
  if (nome.includes('/') || nome.includes('..')) return res.status(404).end();
  const row = getFile(nome);
  if (!row) return res.status(404).end();
  const conteudo = Buffer.from(row.conteudo);
  try {
    fs.writeFileSync(path.join(UPLOAD_DIR, nome), conteudo);
  } catch {}
  res.set('Content-Type', row.mimetype || 'application/octet-stream');
  res.set('Cache-Control', 'max-age=3600');
  res.send(conteudo);
});
app.use(express.static(path.join(ROOT, 'public'), { extensions: ['html'] }));

app.get('/login', (req, res) => {
  res.sendFile(path.join(ROOT, 'public', 'login.html'));
});

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
  res.sendFile(path.join(ROOT, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Finanzas de la carpintería en http://localhost:${PORT}`);
});
