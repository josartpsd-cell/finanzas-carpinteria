import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');
export const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, 'data');
export const UPLOAD_DIR = process.env.UPLOAD_DIR ? path.resolve(process.env.UPLOAD_DIR) : path.join(ROOT, 'uploads');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

export const db = new DatabaseSync(path.join(DATA_DIR, 'financas.db'));

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS accounts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  nome          TEXT NOT NULL,
  tipo          TEXT NOT NULL DEFAULT 'caixa',
  entidade      TEXT NOT NULL DEFAULT 'empresa',
  saldo_inicial REAL NOT NULL DEFAULT 0,
  ativo         INTEGER NOT NULL DEFAULT 1,
  criado_em     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  nome     TEXT NOT NULL,
  tipo     TEXT NOT NULL,
  entidade TEXT NOT NULL DEFAULT 'ambas',
  grupo    TEXT,
  cor      TEXT,
  ativo    INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS people (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  nome  TEXT NOT NULL,
  papel TEXT,
  cor   TEXT
);

CREATE TABLE IF NOT EXISTS sales (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  data            TEXT NOT NULL,
  tipo            TEXT NOT NULL DEFAULT 'servico',
  cliente         TEXT,
  descricao       TEXT,
  valor           REAL NOT NULL DEFAULT 0,
  custo           REAL NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'orcamento',
  forma_pagamento TEXT,
  observacoes     TEXT,
  criado_em       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  data            TEXT NOT NULL,
  tipo            TEXT NOT NULL,
  valor           REAL NOT NULL,
  entidade        TEXT NOT NULL DEFAULT 'empresa',
  conta_id        INTEGER NOT NULL,
  conta_destino_id INTEGER,
  categoria_id    INTEGER,
  pessoa_id       INTEGER,
  descricao       TEXT,
  forma_pagamento TEXT,
  status          TEXT NOT NULL DEFAULT 'pago',
  vencimento      TEXT,
  origem          TEXT NOT NULL DEFAULT 'manual',
  venda_id        INTEGER,
  criado_em       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS attachments (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  nome_arquivo        TEXT,
  mimetype            TEXT,
  tamanho             INTEGER,
  caminho             TEXT,
  transaction_id      INTEGER,
  whatsapp_message_id INTEGER,
  criado_em           TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  wa_message_id TEXT,
  direcao       TEXT NOT NULL DEFAULT 'entrada',
  remetente     TEXT,
  tipo          TEXT NOT NULL DEFAULT 'texto',
  conteudo      TEXT,
  media_path    TEXT,
  mimetype      TEXT,
  enviado_em    TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'recebida',
  transaction_id INTEGER,
  entidade      TEXT NOT NULL DEFAULT 'empresa',
  criado_em     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  chave TEXT PRIMARY KEY,
  valor TEXT
);

CREATE INDEX IF NOT EXISTS idx_tx_data ON transactions(data);
CREATE INDEX IF NOT EXISTS idx_tx_entidade ON transactions(entidade);
CREATE INDEX IF NOT EXISTS idx_tx_conta ON transactions(conta_id);
CREATE INDEX IF NOT EXISTS idx_wa_enviado ON whatsapp_messages(enviado_em);
`);

export const all = (sql, ...params) => db.prepare(sql).all(...params);
export const get = (sql, ...params) => db.prepare(sql).get(...params);
export const run = (sql, ...params) => db.prepare(sql).run(...params);

export const nowIso = () => new Date().toISOString();

export function getSetting(chave, fallback = null) {
  const row = get('SELECT valor FROM settings WHERE chave = ?', chave);
  return row ? row.valor : fallback;
}

export function setSetting(chave, valor) {
  run(
    'INSERT INTO settings (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor',
    chave,
    valor == null ? null : String(valor)
  );
}

export function isSeeded() {
  const row = get('SELECT COUNT(*) AS n FROM transactions');
  return row.n > 0;
}
