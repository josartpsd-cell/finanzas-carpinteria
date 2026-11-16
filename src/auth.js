import express from 'express';
import crypto from 'node:crypto';
import { getSetting, setSetting } from './db.js';

const COOKIE = 'sessao';
const DIAS = 30;

function hashSenha(senha, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(senha), salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

function conferirSenha(senha, guardado) {
  if (!guardado) return false;
  const [algo, salt, hash] = String(guardado).split('$');
  if (algo !== 'scrypt' || !salt || !hash) return false;
  const teste = crypto.scryptSync(String(senha), salt, 64);
  const alvo = Buffer.from(hash, 'hex');
  if (teste.length !== alvo.length) return false;
  return crypto.timingSafeEqual(teste, alvo);
}

export function segredo() {
  let s = getSetting('sessao_segredo');
  if (!s) {
    s = crypto.randomBytes(32).toString('hex');
    setSetting('sessao_segredo', s);
  }
  return s;
}

export function senhaDefinida() {
  return Boolean(getSetting('senha_hash'));
}

export function definirSenha(senha) {
  if (String(senha || '').length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres');
  setSetting('senha_hash', hashSenha(senha));
}

export function garantirSenhaInicial() {
  if (senhaDefinida()) return null;
  const inicial = process.env.APP_PASSWORD || 'carpinteria2026';
  definirSenha(inicial);
  return inicial;
}

function assinar(payload) {
  return crypto.createHmac('sha256', segredo()).update(payload).digest('base64url');
}

function criarToken() {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + DIAS * 864e5 })).toString('base64url');
  return `${payload}.${assinar(payload)}`;
}

function tokenValido(token) {
  if (!token || !token.includes('.')) return false;
  const [payload, assinatura] = token.split('.');
  const esperado = assinar(payload);
  if (assinatura.length !== esperado.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(assinatura), Buffer.from(esperado))) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return typeof exp === 'number' && exp > Date.now();
  } catch {
    return false;
  }
}

function lerCookies(req) {
  const bruto = req.headers.cookie || '';
  const out = {};
  for (const parte of bruto.split(';')) {
    const i = parte.indexOf('=');
    if (i < 0) continue;
    out[parte.slice(0, i).trim()] = decodeURIComponent(parte.slice(i + 1).trim());
  }
  return out;
}

function seguro(req) {
  return req.secure || req.get('x-forwarded-proto') === 'https';
}

function definirCookie(req, res, token, maxAge) {
  const partes = [
    `${COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ];
  if (seguro(req)) partes.push('Secure');
  res.setHeader('Set-Cookie', partes.join('; '));
}

export function autenticado(req) {
  return tokenValido(lerCookies(req)[COOKIE]);
}

const LIVRES = ['/login', '/api/login', '/api/whatsapp/webhook', '/favicon.ico'];

export function requireAuth(req, res, next) {
  if (LIVRES.some((p) => req.path === p || req.path.startsWith(p + '/'))) return next();
  if (autenticado(req)) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ erro: 'Sesión expirada. Inicia sesión de nuevo.' });
  return res.redirect('/login');
}

export const authApi = express.Router();
authApi.use(express.json({ limit: '16kb' }));

authApi.post('/login', (req, res) => {
  const senha = (req.body || {}).senha;
  if (!conferirSenha(senha, getSetting('senha_hash'))) {
    return res.status(401).json({ erro: 'Contraseña incorrecta' });
  }
  definirCookie(req, res, criarToken(), DIAS * 86400);
  res.json({ ok: true });
});

authApi.post('/logout', (req, res) => {
  definirCookie(req, res, '', 0);
  res.json({ ok: true });
});

authApi.put('/password', (req, res) => {
  if (!autenticado(req)) return res.status(401).json({ erro: 'Sesión expirada' });
  const { atual, nova } = req.body || {};
  if (!conferirSenha(atual, getSetting('senha_hash'))) {
    return res.status(401).json({ erro: 'La contraseña actual no coincide' });
  }
  try {
    definirSenha(nova);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ erro: e.message });
  }
});

authApi.get('/session', (req, res) => {
  res.json({ autenticado: autenticado(req) });
});
