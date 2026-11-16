import express from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { all, get, run, nowIso, getSetting, setSetting, UPLOAD_DIR } from './db.js';

export const api = express.Router();
api.use(express.json({ limit: '2mb' }));

const num = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const ENTIDADES = ['pessoal', 'empresa'];
const TIPOS = ['receita', 'despesa', 'transferencia'];

function mesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function faixaMes(mes) {
  const m = /^\d{4}-\d{2}$/.test(mes || '') ? mes : mesAtual();
  const [ano, mm] = m.split('-').map(Number);
  const ultimo = new Date(ano, mm, 0).getDate();
  return { mes: m, inicio: `${m}-01`, fim: `${m}-${String(ultimo).padStart(2, '0')}` };
}

function mesAnterior(mes) {
  const [ano, mm] = mes.split('-').map(Number);
  const d = new Date(ano, mm - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const SQL_SALDO_CONTA = `
  SELECT a.id, a.nome, a.tipo, a.entidade, a.saldo_inicial, a.ativo,
    ROUND(a.saldo_inicial
      + COALESCE((SELECT SUM(CASE WHEN t.tipo = 'receita' THEN t.valor WHEN t.tipo IN ('despesa','transferencia') THEN -t.valor ELSE 0 END)
                  FROM transactions t WHERE t.conta_id = a.id AND t.status = 'pago'), 0)
      + COALESCE((SELECT SUM(t.valor) FROM transactions t
                  WHERE t.conta_destino_id = a.id AND t.tipo = 'transferencia' AND t.status = 'pago'), 0), 2) AS saldo
  FROM accounts a`;

function saldoContas() {
  return all(`${SQL_SALDO_CONTA} WHERE a.ativo = 1 ORDER BY a.entidade, a.tipo, a.nome`);
}

function totaisPeriodo(inicio, fim, entidade) {
  const filtroEnt = entidade ? ' AND entidade = ?' : '';
  const p = entidade ? [inicio, fim, entidade] : [inicio, fim];
  const r = get(
    `SELECT
       ROUND(COALESCE(SUM(CASE WHEN tipo = 'receita' THEN valor END), 0), 2) AS receitas,
       ROUND(COALESCE(SUM(CASE WHEN tipo = 'despesa' THEN valor END), 0), 2) AS despesas,
       ROUND(COALESCE(SUM(CASE WHEN tipo = 'transferencia' THEN valor END), 0), 2) AS transferencias,
       COUNT(*) AS lancamentos
     FROM transactions WHERE data BETWEEN ? AND ? AND status = 'pago'${filtroEnt}`,
    ...p
  );
  return { ...r, resultado: round2(r.receitas - r.despesas) };
}

function pendentes() {
  const r = get(
    `SELECT
       ROUND(COALESCE(SUM(CASE WHEN tipo = 'receita' THEN valor END), 0), 2) AS a_receber,
       ROUND(COALESCE(SUM(CASE WHEN tipo = 'despesa' THEN valor END), 0), 2) AS a_pagar,
       SUM(CASE WHEN tipo = 'receita' THEN 1 ELSE 0 END) AS qtd_receber,
       SUM(CASE WHEN tipo = 'despesa' THEN 1 ELSE 0 END) AS qtd_pagar,
       COUNT(*) AS qtd
     FROM transactions WHERE status = 'pendente'`
  );
  return r;
}

api.get('/bootstrap', (req, res) => {
  res.json({
    hoje: new Date().toISOString().slice(0, 10),
    mes_atual: mesAtual(),
    empresa_nome: getSetting('empresa_nome', 'Carpintería'),
    moeda: getSetting('moeda', 'BRL'),
    whatsapp: {
      status: getSetting('whatsapp_status', 'desconectado'),
      numero: getSetting('whatsapp_numero', ''),
      provider: getSetting('whatsapp_provider', ''),
      webhook_token: getSetting('whatsapp_webhook_token', ''),
    },
    contas: saldoContas(),
    categorias: all('SELECT * FROM categories WHERE ativo = 1 ORDER BY entidade, tipo, grupo, nome'),
    pessoas: all('SELECT * FROM people ORDER BY id'),
  });
});

api.get('/dashboard', (req, res) => {
  const { mes, inicio, fim } = faixaMes(req.query.mes);
  const anterior = mesAnterior(mes);
  const fa = faixaMes(anterior);

  const empresa = totaisPeriodo(inicio, fim, 'empresa');
  const pessoal = totaisPeriodo(inicio, fim, 'pessoal');
  const total = totaisPeriodo(inicio, fim);
  const totalAnterior = totaisPeriodo(fa.inicio, fa.fim);
  const contas = saldoContas();

  const retiradas = get(
    `SELECT ROUND(COALESCE(SUM(valor), 0), 2) AS total FROM transactions
     WHERE tipo = 'transferencia' AND status = 'pago' AND data BETWEEN ? AND ?`,
    inicio, fim
  ).total;

  const serie = [];
  for (let i = 5; i >= 0; i--) {
    const [ano, mm] = mes.split('-').map(Number);
    const d = new Date(ano, mm - 1 - i, 1);
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const f = faixaMes(m);
    const t = totaisPeriodo(f.inicio, f.fim);
    serie.push({ mes: m, receitas: t.receitas, despesas: t.despesas, resultado: t.resultado });
  }

  const porCategoria = all(
    `SELECT c.nome, c.cor, c.grupo, ROUND(SUM(t.valor), 2) AS total
     FROM transactions t JOIN categories c ON c.id = t.categoria_id
     WHERE t.tipo = 'despesa' AND t.status = 'pago' AND t.data BETWEEN ? AND ?
     GROUP BY c.id ORDER BY total DESC LIMIT 8`,
    inicio, fim
  );

  const ultimos = all(
    `SELECT t.*, c.nome AS categoria, c.cor AS categoria_cor, a.nome AS conta
     FROM transactions t
     LEFT JOIN categories c ON c.id = t.categoria_id
     LEFT JOIN accounts a ON a.id = t.conta_id
     ORDER BY t.data DESC, t.id DESC LIMIT 8`
  );

  res.json({
    mes,
    empresa,
    pessoal,
    total,
    total_anterior: totalAnterior,
    retiradas,
    saldo_total: round2(contas.reduce((s, c) => s + c.saldo, 0)),
    saldo_empresa: round2(contas.filter((c) => c.entidade === 'empresa').reduce((s, c) => s + c.saldo, 0)),
    saldo_pessoal: round2(contas.filter((c) => c.entidade === 'pessoal').reduce((s, c) => s + c.saldo, 0)),
    pendentes: pendentes(),
    contas,
    serie,
    por_categoria: porCategoria,
    ultimos,
  });
});

api.get('/balanco', (req, res) => {
  const { mes, inicio, fim } = faixaMes(req.query.mes);
  const anterior = mesAnterior(mes);
  const fa = faixaMes(anterior);

  const empresa = totaisPeriodo(inicio, fim, 'empresa');
  const pessoal = totaisPeriodo(inicio, fim, 'pessoal');
  const consolidado = totaisPeriodo(inicio, fim);
  const empresaAnt = totaisPeriodo(fa.inicio, fa.fim, 'empresa');
  const pessoalAnt = totaisPeriodo(fa.inicio, fa.fim, 'pessoal');

  const retiradas = all(
    `SELECT t.id, t.data, t.valor, t.descricao, a.nome AS origem, d.nome AS destino
     FROM transactions t
     LEFT JOIN accounts a ON a.id = t.conta_id
     LEFT JOIN accounts d ON d.id = t.conta_destino_id
     WHERE t.tipo = 'transferencia' AND t.status = 'pago' AND t.data BETWEEN ? AND ?
     ORDER BY t.data`,
    inicio, fim
  );

  const categorias = all(
    `SELECT c.nome, c.cor, c.grupo, c.tipo, t.entidade, ROUND(SUM(t.valor), 2) AS total, COUNT(*) AS qtd
     FROM transactions t JOIN categories c ON c.id = t.categoria_id
     WHERE t.status = 'pago' AND t.data BETWEEN ? AND ? AND t.tipo IN ('receita','despesa')
     GROUP BY c.id, t.entidade ORDER BY t.entidade, c.tipo DESC, total DESC`,
    inicio, fim
  );

  const porPessoa = all(
    `SELECT p.id, p.nome, p.cor,
       ROUND(COALESCE(SUM(CASE WHEN t.tipo = 'receita' THEN t.valor END), 0), 2) AS receitas,
       ROUND(COALESCE(SUM(CASE WHEN t.tipo = 'despesa' THEN t.valor END), 0), 2) AS despesas,
       COUNT(t.id) AS lancamentos
     FROM people p LEFT JOIN transactions t
       ON t.pessoa_id = p.id AND t.status = 'pago' AND t.data BETWEEN ? AND ?
     GROUP BY p.id ORDER BY p.id`,
    inicio, fim
  );

  const saldoFim = get(
    `SELECT ROUND(
       (SELECT COALESCE(SUM(saldo_inicial),0) FROM accounts WHERE ativo = 1)
       + COALESCE((SELECT SUM(CASE WHEN tipo='receita' THEN valor WHEN tipo='despesa' THEN -valor ELSE 0 END)
                   FROM transactions WHERE status='pago' AND data <= ?), 0), 2) AS saldo`,
    fim
  ).saldo;

  res.json({
    mes,
    mes_anterior: anterior,
    empresa,
    pessoal,
    consolidado,
    empresa_anterior: empresaAnt,
    pessoal_anterior: pessoalAnt,
    retiradas_total: round2(retiradas.reduce((s, r) => s + r.valor, 0)),
    retiradas,
    categorias,
    por_pessoa: porPessoa,
    saldo_fim_mes: saldoFim,
    pendentes: pendentes(),
  });
});

api.get('/transactions', (req, res) => {
  const where = [];
  const params = [];
  const { mes, entidade, tipo, conta_id, categoria_id, status, q, de, ate } = req.query;

  if (de && ate) {
    where.push('t.data BETWEEN ? AND ?');
    params.push(de, ate);
  } else if (mes) {
    const f = faixaMes(mes);
    where.push('t.data BETWEEN ? AND ?');
    params.push(f.inicio, f.fim);
  }
  if (entidade && ENTIDADES.includes(entidade)) {
    where.push('t.entidade = ?');
    params.push(entidade);
  }
  if (tipo && TIPOS.includes(tipo)) {
    where.push('t.tipo = ?');
    params.push(tipo);
  }
  if (conta_id) {
    where.push('(t.conta_id = ? OR t.conta_destino_id = ?)');
    params.push(num(conta_id), num(conta_id));
  }
  if (categoria_id) {
    where.push('t.categoria_id = ?');
    params.push(num(categoria_id));
  }
  if (status && ['pago', 'pendente'].includes(status)) {
    where.push('t.status = ?');
    params.push(status);
  }
  if (q) {
    where.push('(t.descricao LIKE ? OR c.nome LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }

  const sql = `SELECT t.*, c.nome AS categoria, c.cor AS categoria_cor, c.grupo AS categoria_grupo,
      a.nome AS conta, d.nome AS conta_destino, p.nome AS pessoa,
      (SELECT COUNT(*) FROM attachments at WHERE at.transaction_id = t.id) AS anexos
    FROM transactions t
    LEFT JOIN categories c ON c.id = t.categoria_id
    LEFT JOIN accounts a ON a.id = t.conta_id
    LEFT JOIN accounts d ON d.id = t.conta_destino_id
    LEFT JOIN people p ON p.id = t.pessoa_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY t.data DESC, t.id DESC LIMIT 500`;

  const rows = all(sql, ...params);
  const resumo = rows.reduce(
    (acc, r) => {
      if (r.tipo === 'receita') acc.receitas += r.valor;
      if (r.tipo === 'despesa') acc.despesas += r.valor;
      if (r.tipo === 'transferencia') acc.transferencias += r.valor;
      return acc;
    },
    { receitas: 0, despesas: 0, transferencias: 0 }
  );
  res.json({
    itens: rows,
    resumo: {
      receitas: round2(resumo.receitas),
      despesas: round2(resumo.despesas),
      transferencias: round2(resumo.transferencias),
      resultado: round2(resumo.receitas - resumo.despesas),
      qtd: rows.length,
    },
  });
});

function validarLancamento(b, existente = {}) {
  const tipo = b.tipo ?? existente.tipo;
  if (!TIPOS.includes(tipo)) throw new Error('Tipo no válido');
  const valor = num(b.valor ?? existente.valor);
  if (!(valor > 0)) throw new Error('El valor debe ser mayor que cero');
  const data = String(b.data ?? existente.data ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new Error('Fecha no válida');
  const entidade = b.entidade ?? existente.entidade;
  if (!ENTIDADES.includes(entidade)) throw new Error('Entidad no válida');
  const conta_id = num(b.conta_id ?? existente.conta_id);
  if (!conta_id) throw new Error('La cuenta es obligatoria');
  if (tipo === 'transferencia' && !num(b.conta_destino_id ?? existente.conta_destino_id)) {
    throw new Error('La transferencia necesita una cuenta de destino');
  }
  return { tipo, valor: round2(valor), data, entidade, conta_id };
}

api.post('/transactions', (req, res) => {
  try {
    const b = req.body || {};
    const v = validarLancamento(b);
    const r = run(
      `INSERT INTO transactions (data, tipo, valor, entidade, conta_id, conta_destino_id, categoria_id, pessoa_id, descricao, forma_pagamento, status, vencimento, origem, venda_id, criado_em)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      v.data, v.tipo, v.valor, v.entidade, v.conta_id,
      b.conta_destino_id ? num(b.conta_destino_id) : null,
      b.categoria_id ? num(b.categoria_id) : null,
      b.pessoa_id ? num(b.pessoa_id) : null,
      b.descricao ? String(b.descricao).slice(0, 300) : null,
      b.forma_pagamento || 'pix',
      b.status === 'pendente' ? 'pendente' : 'pago',
      b.vencimento || null,
      b.origem || 'manual',
      b.venda_id ? num(b.venda_id) : null,
      nowIso()
    );
    res.status(201).json(get('SELECT * FROM transactions WHERE id = ?', Number(r.lastInsertRowid)));
  } catch (e) {
    res.status(400).json({ erro: e.message });
  }
});

api.get('/transactions/:id', (req, res) => {
  const row = get(
    `SELECT t.*, c.nome AS categoria, c.cor AS categoria_cor, a.nome AS conta, d.nome AS conta_destino, p.nome AS pessoa
     FROM transactions t
     LEFT JOIN categories c ON c.id = t.categoria_id
     LEFT JOIN accounts a ON a.id = t.conta_id
     LEFT JOIN accounts d ON d.id = t.conta_destino_id
     LEFT JOIN people p ON p.id = t.pessoa_id
     WHERE t.id = ?`,
    num(req.params.id)
  );
  if (!row) return res.status(404).json({ erro: 'Movimiento no encontrado' });
  res.json(row);
});

api.post('/whatsapp/:id/midia', (req, res) => {
  const b = req.body || {};
  const id = num(req.params.id);
  run('UPDATE whatsapp_messages SET media_path = ?, mimetype = ? WHERE id = ?', b.media_path || null, b.mimetype || null, id);
  res.json(get('SELECT * FROM whatsapp_messages WHERE id = ?', id));
});

api.put('/transactions/:id', (req, res) => {
  try {
    const id = num(req.params.id);
    const atual = get('SELECT * FROM transactions WHERE id = ?', id);
    if (!atual) return res.status(404).json({ erro: 'Movimiento no encontrado' });
    const b = req.body || {};
    const v = validarLancamento(b, atual);
    run(
      `UPDATE transactions SET data=?, tipo=?, valor=?, entidade=?, conta_id=?, conta_destino_id=?, categoria_id=?, pessoa_id=?,
        descricao=?, forma_pagamento=?, status=?, vencimento=? WHERE id=?`,
      v.data, v.tipo, v.valor, v.entidade, v.conta_id,
      b.conta_destino_id ? num(b.conta_destino_id) : null,
      b.categoria_id ? num(b.categoria_id) : null,
      b.pessoa_id ? num(b.pessoa_id) : null,
      b.descricao ? String(b.descricao).slice(0, 300) : null,
      b.forma_pagamento || 'pix',
      b.status === 'pendente' ? 'pendente' : 'pago',
      b.vencimento || null,
      id
    );
    res.json(get('SELECT * FROM transactions WHERE id = ?', id));
  } catch (e) {
    res.status(400).json({ erro: e.message });
  }
});

api.delete('/transactions/:id', (req, res) => {
  const id = num(req.params.id);
  run('DELETE FROM attachments WHERE transaction_id = ?', id);
  run('DELETE FROM transactions WHERE id = ?', id);
  res.json({ ok: true });
});

api.get('/accounts', (req, res) => res.json(saldoContas()));

api.post('/accounts', (req, res) => {
  const b = req.body || {};
  if (!b.nome) return res.status(400).json({ erro: 'El nombre es obligatorio' });
  const r = run(
    'INSERT INTO accounts (nome, tipo, entidade, saldo_inicial, ativo, criado_em) VALUES (?,?,?,?,1,?)',
    String(b.nome).slice(0, 80), b.tipo || 'caixa', ENTIDADES.includes(b.entidade) ? b.entidade : 'empresa', num(b.saldo_inicial), nowIso()
  );
  res.status(201).json(get('SELECT * FROM accounts WHERE id = ?', Number(r.lastInsertRowid)));
});

api.put('/accounts/:id', (req, res) => {
  const b = req.body || {};
  const id = num(req.params.id);
  run(
    'UPDATE accounts SET nome=?, tipo=?, entidade=?, saldo_inicial=?, ativo=? WHERE id=?',
    String(b.nome || '').slice(0, 80), b.tipo || 'caixa', ENTIDADES.includes(b.entidade) ? b.entidade : 'empresa',
    num(b.saldo_inicial), b.ativo === 0 || b.ativo === false ? 0 : 1, id
  );
  res.json(get('SELECT * FROM accounts WHERE id = ?', id));
});

api.delete('/accounts/:id', (req, res) => {
  const id = num(req.params.id);
  const usada = get('SELECT COUNT(*) AS n FROM transactions WHERE conta_id = ? OR conta_destino_id = ?', id, id).n;
  if (usada) return res.status(400).json({ erro: 'La cuenta tiene movimientos. Desactívala en vez de eliminarla.' });
  run('DELETE FROM accounts WHERE id = ?', id);
  res.json({ ok: true });
});

api.get('/categories', (req, res) => res.json(all('SELECT * FROM categories ORDER BY entidade, tipo, grupo, nome')));

api.post('/categories', (req, res) => {
  const b = req.body || {};
  if (!b.nome) return res.status(400).json({ erro: 'El nombre es obligatorio' });
  const r = run(
    'INSERT INTO categories (nome, tipo, entidade, grupo, cor, ativo) VALUES (?,?,?,?,?,1)',
    String(b.nome).slice(0, 80), b.tipo === 'receita' ? 'receita' : 'despesa',
    ['pessoal', 'empresa', 'ambas'].includes(b.entidade) ? b.entidade : 'ambas',
    b.grupo || null, b.cor || '#64748b'
  );
  res.status(201).json(get('SELECT * FROM categories WHERE id = ?', Number(r.lastInsertRowid)));
});

api.put('/categories/:id', (req, res) => {
  const b = req.body || {};
  const id = num(req.params.id);
  run(
    'UPDATE categories SET nome=?, tipo=?, entidade=?, grupo=?, cor=?, ativo=? WHERE id=?',
    String(b.nome || '').slice(0, 80), b.tipo === 'receita' ? 'receita' : 'despesa',
    ['pessoal', 'empresa', 'ambas'].includes(b.entidade) ? b.entidade : 'ambas',
    b.grupo || null, b.cor || '#64748b', b.ativo === 0 || b.ativo === false ? 0 : 1, id
  );
  res.json(get('SELECT * FROM categories WHERE id = ?', id));
});

api.delete('/categories/:id', (req, res) => {
  const id = num(req.params.id);
  const usada = get('SELECT COUNT(*) AS n FROM transactions WHERE categoria_id = ?', id).n;
  if (usada) return res.status(400).json({ erro: 'La categoría está en uso. Desactívala en vez de eliminarla.' });
  run('DELETE FROM categories WHERE id = ?', id);
  res.json({ ok: true });
});

api.get('/people', (req, res) => res.json(all('SELECT * FROM people ORDER BY id')));
api.put('/people/:id', (req, res) => {
  const b = req.body || {};
  const id = num(req.params.id);
  run('UPDATE people SET nome=?, papel=?, cor=? WHERE id=?', String(b.nome || '').slice(0, 60), b.papel || null, b.cor || '#0f766e', id);
  res.json(get('SELECT * FROM people WHERE id = ?', id));
});

api.get('/sales', (req, res) => {
  const where = [];
  const params = [];
  if (req.query.mes) {
    const f = faixaMes(req.query.mes);
    where.push('s.data BETWEEN ? AND ?');
    params.push(f.inicio, f.fim);
  }
  if (req.query.tipo && ['servico', 'produto'].includes(req.query.tipo)) {
    where.push('s.tipo = ?');
    params.push(req.query.tipo);
  }
  if (req.query.status) {
    where.push('s.status = ?');
    params.push(req.query.status);
  }
  const itens = all(
    `SELECT s.*, (SELECT COUNT(*) FROM transactions t WHERE t.venda_id = s.id) AS lancamentos
     FROM sales s ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY s.data DESC, s.id DESC LIMIT 300`,
    ...params
  );
  const resumo = itens.reduce(
    (acc, s) => {
      acc.valor += s.valor;
      acc.custo += s.custo;
      acc.qtd += 1;
      if (s.tipo === 'servico') acc.servicos += 1;
      if (s.tipo === 'produto') acc.produtos += 1;
      if (s.status === 'pago') acc.recebido += s.valor;
      return acc;
    },
    { valor: 0, custo: 0, qtd: 0, servicos: 0, produtos: 0, recebido: 0 }
  );
  res.json({
    itens,
    resumo: {
      valor: round2(resumo.valor),
      custo: round2(resumo.custo),
      margem: round2(resumo.valor - resumo.custo),
      qtd: resumo.qtd,
      servicos: resumo.servicos,
      produtos: resumo.produtos,
      recebido: round2(resumo.recebido),
    },
  });
});

api.post('/sales', (req, res) => {
  const b = req.body || {};
  if (!b.descricao) return res.status(400).json({ erro: 'La descripción es obligatoria' });
  const r = run(
    `INSERT INTO sales (data, tipo, cliente, descricao, valor, custo, status, forma_pagamento, observacoes, criado_em)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    String(b.data || new Date().toISOString().slice(0, 10)).slice(0, 10),
    b.tipo === 'produto' ? 'produto' : 'servico',
    b.cliente || null, String(b.descricao).slice(0, 200),
    round2(num(b.valor)), round2(num(b.custo)),
    b.status || 'orcamento', b.forma_pagamento || 'pix', b.observacoes || null, nowIso()
  );
  res.status(201).json(get('SELECT * FROM sales WHERE id = ?', Number(r.lastInsertRowid)));
});

api.put('/sales/:id', (req, res) => {
  const b = req.body || {};
  const id = num(req.params.id);
  run(
    `UPDATE sales SET data=?, tipo=?, cliente=?, descricao=?, valor=?, custo=?, status=?, forma_pagamento=?, observacoes=? WHERE id=?`,
    String(b.data || new Date().toISOString().slice(0, 10)).slice(0, 10),
    b.tipo === 'produto' ? 'produto' : 'servico',
    b.cliente || null, String(b.descricao || '').slice(0, 200),
    round2(num(b.valor)), round2(num(b.custo)),
    b.status || 'orcamento', b.forma_pagamento || 'pix', b.observacoes || null, id
  );
  res.json(get('SELECT * FROM sales WHERE id = ?', id));
});

api.delete('/sales/:id', (req, res) => {
  run('DELETE FROM sales WHERE id = ?', num(req.params.id));
  res.json({ ok: true });
});

api.post('/sales/:id/receber', (req, res) => {
  const id = num(req.params.id);
  const venda = get('SELECT * FROM sales WHERE id = ?', id);
  if (!venda) return res.status(404).json({ erro: 'Venta no encontrada' });
  const b = req.body || {};
  const contaId = num(b.conta_id) || get("SELECT id FROM accounts WHERE entidade = 'empresa' AND ativo = 1 ORDER BY id LIMIT 1")?.id;
  if (!contaId) return res.status(400).json({ erro: 'Registra una cuenta de la empresa' });
  const cat = get(
    "SELECT id FROM categories WHERE tipo = 'receita' AND entidade = 'empresa' AND nome = ?",
    venda.tipo === 'produto' ? 'Muebles listos (reventa)' : 'Muebles a medida'
  );
  const r = run(
    `INSERT INTO transactions (data, tipo, valor, entidade, conta_id, categoria_id, pessoa_id, descricao, forma_pagamento, status, origem, venda_id, criado_em)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    String(b.data || new Date().toISOString().slice(0, 10)).slice(0, 10),
    'receita', round2(num(b.valor) || venda.valor), 'empresa', contaId, cat?.id ?? null,
    b.pessoa_id ? num(b.pessoa_id) : null,
    `${venda.descricao}${venda.cliente ? ' — ' + venda.cliente : ''}`,
    b.forma_pagamento || venda.forma_pagamento || 'pix', 'pago', 'venda', id, nowIso()
  );
  run("UPDATE sales SET status = 'pago' WHERE id = ?", id);
  res.status(201).json({ ok: true, transaction_id: Number(r.lastInsertRowid) });
});

api.get('/whatsapp', (req, res) => {
  const mensagens = all(
    `SELECT w.*, t.descricao AS tx_descricao, t.valor AS tx_valor, t.tipo AS tx_tipo
     FROM whatsapp_messages w LEFT JOIN transactions t ON t.id = w.transaction_id
     ORDER BY w.enviado_em DESC LIMIT 200`
  );
  res.json({
    status: getSetting('whatsapp_status', 'desconectado'),
    numero: getSetting('whatsapp_numero', ''),
    provider: getSetting('whatsapp_provider', ''),
    webhook_token: getSetting('whatsapp_webhook_token', ''),
    mensagens,
    nao_vinculadas: mensagens.filter((m) => !m.transaction_id && m.direcao === 'entrada').length,
  });
});

api.post('/whatsapp/simular', (req, res) => {
  const b = req.body || {};
  const tipo = ['texto', 'audio', 'imagem', 'documento'].includes(b.tipo) ? b.tipo : 'texto';
  const r = run(
    `INSERT INTO whatsapp_messages (wa_message_id, direcao, remetente, tipo, conteudo, media_path, mimetype, enviado_em, status, entidade, criado_em)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    `sim-${crypto.randomUUID()}`, 'entrada', b.remetente || 'Socio', tipo,
    b.conteudo || null, b.media_path || null, b.mimetype || null, nowIso(), 'recebida', b.entidade || 'empresa', nowIso()
  );
  res.status(201).json(get('SELECT * FROM whatsapp_messages WHERE id = ?', Number(r.lastInsertRowid)));
});

api.post('/whatsapp/:id/vincular', (req, res) => {
  const id = num(req.params.id);
  const b = req.body || {};
  const msg = get('SELECT * FROM whatsapp_messages WHERE id = ?', id);
  if (!msg) return res.status(404).json({ erro: 'Mensaje no encontrado' });
  if (b.transaction_id) {
    run('UPDATE whatsapp_messages SET transaction_id = ? WHERE id = ?', num(b.transaction_id), id);
    return res.json({ ok: true });
  }
  try {
    const v = validarLancamento(b);
    const r = run(
      `INSERT INTO transactions (data, tipo, valor, entidade, conta_id, categoria_id, pessoa_id, descricao, forma_pagamento, status, origem, criado_em)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      v.data, v.tipo, v.valor, v.entidade, v.conta_id,
      b.categoria_id ? num(b.categoria_id) : null, b.pessoa_id ? num(b.pessoa_id) : null,
      b.descricao || msg.conteudo || 'Movimiento vía WhatsApp',
      b.forma_pagamento || 'pix', b.status === 'pendente' ? 'pendente' : 'pago', 'whatsapp', nowIso()
    );
    const txId = Number(r.lastInsertRowid);
    run('UPDATE whatsapp_messages SET transaction_id = ? WHERE id = ?', txId, id);
    if (msg.media_path) {
      run(
        'INSERT INTO attachments (nome_arquivo, mimetype, tamanho, caminho, transaction_id, whatsapp_message_id, criado_em) VALUES (?,?,?,?,?,?,?)',
        msg.media_path, msg.mimetype || 'application/octet-stream', 0, msg.media_path, txId, id, nowIso()
      );
    }
    res.status(201).json({ ok: true, transaction_id: txId });
  } catch (e) {
    res.status(400).json({ erro: e.message });
  }
});

api.post('/whatsapp/:id/responder', (req, res) => {
  const id = num(req.params.id);
  const b = req.body || {};
  const msg = get('SELECT * FROM whatsapp_messages WHERE id = ?', id);
  if (!msg) return res.status(404).json({ erro: 'Mensaje no encontrado' });
  const r = run(
    `INSERT INTO whatsapp_messages (wa_message_id, direcao, remetente, tipo, conteudo, enviado_em, status, entidade, criado_em)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    `sim-${crypto.randomUUID()}`, 'saida', 'Sistema', 'texto', String(b.conteudo || '').slice(0, 1000),
    nowIso(), 'enviada', msg.entidade, nowIso()
  );
  res.status(201).json(get('SELECT * FROM whatsapp_messages WHERE id = ?', Number(r.lastInsertRowid)));
});

api.post('/whatsapp/webhook', (req, res) => {
  const token = getSetting('whatsapp_webhook_token', '');
  const recebido = req.query.token || req.get('x-webhook-token') || '';
  if (token && recebido !== token) return res.status(401).json({ erro: 'Token no válido' });
  const b = req.body || {};
  const texto = b.texto || b.conteudo || b.body || b.message || '';
  const r = run(
    `INSERT INTO whatsapp_messages (wa_message_id, direcao, remetente, tipo, conteudo, media_path, mimetype, enviado_em, status, entidade, criado_em)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    b.id || `wh-${crypto.randomUUID()}`, 'entrada', b.remetente || b.from || 'WhatsApp',
    ['texto', 'audio', 'imagem', 'documento'].includes(b.tipo) ? b.tipo : 'texto',
    texto || null, b.media_path || null, b.mimetype || null, b.enviado_em || nowIso(), 'recebida', b.entidade || 'empresa', nowIso()
  );
  res.status(201).json({ ok: true, id: Number(r.lastInsertRowid) });
});

api.get('/settings', (req, res) => {
  const rows = all('SELECT chave, valor FROM settings');
  res.json(Object.fromEntries(rows.map((r) => [r.chave, r.valor])));
});

api.put('/settings', (req, res) => {
  const b = req.body || {};
  const permitidas = [
    'empresa_nome', 'moeda', 'whatsapp_status', 'whatsapp_numero', 'whatsapp_provider', 'whatsapp_webhook_token',
  ];
  for (const [k, v] of Object.entries(b)) {
    if (permitidas.includes(k)) setSetting(k, v);
  }
  const rows = all('SELECT chave, valor FROM settings');
  res.json(Object.fromEntries(rows.map((r) => [r.chave, r.valor])));
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').slice(0, 10) || '.bin';
    cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 15 * 1024 * 1024 } });

api.post('/upload', upload.single('arquivo'), (req, res) => {
  if (!req.file) return res.status(400).json({ erro: 'Archivo no enviado' });
  const txId = req.body.transaction_id ? num(req.body.transaction_id) : null;
  const r = run(
    'INSERT INTO attachments (nome_arquivo, mimetype, tamanho, caminho, transaction_id, whatsapp_message_id, criado_em) VALUES (?,?,?,?,?,?,?)',
    req.file.originalname, req.file.mimetype, req.file.size, req.file.filename, txId, null, nowIso()
  );
  res.status(201).json(get('SELECT * FROM attachments WHERE id = ?', Number(r.lastInsertRowid)));
});

api.get('/transactions/:id/attachments', (req, res) => {
  res.json(all('SELECT * FROM attachments WHERE transaction_id = ? ORDER BY id DESC', num(req.params.id)));
});

api.delete('/attachments/:id', (req, res) => {
  const a = get('SELECT * FROM attachments WHERE id = ?', num(req.params.id));
  if (a) {
    const p = path.join(UPLOAD_DIR, a.caminho);
    if (fs.existsSync(p) && !a.caminho.includes('recibo-') && !a.caminho.includes('comprovante-') && !a.caminho.includes('audio-recado')) {
      fs.unlinkSync(p);
    }
    run('DELETE FROM attachments WHERE id = ?', a.id);
  }
  res.json({ ok: true });
});

function csvEscape(v) {
  const s = v == null ? '' : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

api.get('/export/lancamentos.csv', (req, res) => {
  const f = faixaMes(req.query.mes);
  const rows = all(
    `SELECT t.data, t.tipo, t.entidade, t.valor, t.status, c.nome AS categoria, a.nome AS conta, p.nome AS pessoa, t.descricao, t.forma_pagamento
     FROM transactions t LEFT JOIN categories c ON c.id = t.categoria_id
     LEFT JOIN accounts a ON a.id = t.conta_id LEFT JOIN people p ON p.id = t.pessoa_id
     WHERE t.data BETWEEN ? AND ? ORDER BY t.data`,
    f.inicio, f.fim
  );
  const linhas = [
    ['Fecha', 'Tipo', 'Entidad', 'Valor', 'Estado', 'Categoría', 'Cuenta', 'Persona', 'Descripción', 'Forma de pago'],
    ...rows.map((r) => [r.data, r.tipo, r.entidade, String(r.valor).replace('.', ','), r.status, r.categoria, r.conta, r.pessoa, r.descricao, r.forma_pagamento]),
  ];
  const csv = '\uFEFF' + linhas.map((l) => l.map(csvEscape).join(';')).join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="movimientos-${f.mes}.csv"`);
  res.send(csv);
});

api.get('/export/balanco.csv', (req, res) => {
  const f = faixaMes(req.query.mes);
  const empresa = totaisPeriodo(f.inicio, f.fim, 'empresa');
  const pessoal = totaisPeriodo(f.inicio, f.fim, 'pessoal');
  const total = totaisPeriodo(f.inicio, f.fim);
  const linhas = [
    ['Balance', f.mes],
    [],
    ['Indicador', 'Empresa', 'Personal', 'Consolidado'],
    ['Ingresos', empresa.receitas, pessoal.receitas, total.receitas],
    ['Gastos', empresa.despesas, pessoal.despesas, total.despesas],
    ['Resultado', empresa.resultado, pessoal.resultado, total.resultado],
    ['Movimientos', empresa.lancamentos, pessoal.lancamentos, total.lancamentos],
  ];
  const csv = '\uFEFF' + linhas.map((l) => l.map(csvEscape).join(';')).join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="balance-${f.mes}.csv"`);
  res.send(csv);
});

api.get('/export/backup.json', (req, res) => {
  const dados = {
    gerado_em: nowIso(),
    versao: 1,
    accounts: all('SELECT * FROM accounts'),
    categories: all('SELECT * FROM categories'),
    people: all('SELECT * FROM people'),
    sales: all('SELECT * FROM sales'),
    transactions: all('SELECT * FROM transactions'),
    attachments: all('SELECT * FROM attachments'),
    whatsapp_messages: all('SELECT * FROM whatsapp_messages'),
    settings: all("SELECT chave, valor FROM settings WHERE chave NOT IN ('senha_hash','sessao_segredo')"),
  };
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="respaldo-${new Date().toISOString().slice(0, 10)}.json"`);
  res.send(JSON.stringify(dados, null, 2));
});

api.use((err, req, res, next) => {
  res.status(500).json({ erro: err.message || 'Error interno' });
});
