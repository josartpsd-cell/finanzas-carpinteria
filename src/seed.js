import fs from 'node:fs';
import path from 'node:path';
import { db, run, get, all, nowIso, setSetting, saveFile, UPLOAD_DIR, isSeeded } from './db.js';

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rnd = mulberry32(20261116);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const between = (min, max) => Math.round((min + rnd() * (max - min)) * 100) / 100;
const intBetween = (min, max) => Math.floor(min + rnd() * (max - min + 1));
const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

const MESES = [
  [2026, 6],
  [2026, 7],
  [2026, 8],
  [2026, 9],
  [2026, 10],
  [2026, 11],
];

const CONTAS = [
  ['Caja de la carpintería', 'caixa', 'empresa', 1200],
  ['Cuenta de la empresa', 'banco', 'empresa', 8400],
  ['Tarjeta de la empresa', 'cartao', 'empresa', 0],
  ['Billetera', 'caixa', 'pessoal', 350],
  ['Cuenta personal', 'banco', 'pessoal', 4200],
  ['Tarjeta personal', 'cartao', 'pessoal', 0],
];

const CATEGORIAS = [
  ['Muebles a medida', 'receita', 'empresa', 'Ingresos operativos', '#0f766e'],
  ['Muebles listos (reventa)', 'receita', 'empresa', 'Ingresos operativos', '#0d9488'],
  ['Instalación y montaje', 'receita', 'empresa', 'Ingresos operativos', '#14b8a6'],
  ['Reforma de muebles', 'receita', 'empresa', 'Ingresos operativos', '#2dd4bf'],
  ['Otros ingresos', 'receita', 'empresa', 'Otros ingresos', '#5eead4'],
  ['Madera / MDF / aglomerado', 'despesa', 'empresa', 'Costos de producción', '#b45309'],
  ['Herrajes y accesorios', 'despesa', 'empresa', 'Costos de producción', '#c2410c'],
  ['Vidriería y espejos', 'despesa', 'empresa', 'Costos de producción', '#d97706'],
  ['Pinturas y acabado', 'despesa', 'empresa', 'Costos de producción', '#ea580c'],
  ['Flete y entregas', 'despesa', 'empresa', 'Costos de producción', '#f59e0b'],
  ['Tercerización (pintura/vidrio)', 'despesa', 'empresa', 'Costos de producción', '#f97316'],
  ['Alquiler del galpón', 'despesa', 'empresa', 'Gastos fijos', '#7c3aed'],
  ['Electricidad', 'despesa', 'empresa', 'Gastos fijos', '#8b5cf6'],
  ['Agua e internet', 'despesa', 'empresa', 'Gastos fijos', '#a78bfa'],
  ['Mantenimiento de máquinas', 'despesa', 'empresa', 'Gastos fijos', '#6d28d9'],
  ['Combustible', 'despesa', 'empresa', 'Gastos variables', '#dc2626'],
  ['Impuestos y tasas', 'despesa', 'empresa', 'Impuestos', '#991b1b'],
  ['Contador', 'despesa', 'empresa', 'Administrativas', '#475569'],
  ['Marketing y anuncios', 'despesa', 'empresa', 'Administrativas', '#64748b'],
  ['Herramientas y EPP', 'despesa', 'empresa', 'Administrativas', '#94a3b8'],
  ['Supermercado', 'despesa', 'pessoal', 'Alimentación', '#0891b2'],
  ['Casa / alquiler', 'despesa', 'pessoal', 'Vivienda', '#0e7490'],
  ['Electricidad y agua (casa)', 'despesa', 'pessoal', 'Vivienda', '#155e75'],
  ['Escuela / educación', 'despesa', 'pessoal', 'Educación', '#1d4ed8'],
  ['Salud y farmacia', 'despesa', 'pessoal', 'Salud', '#2563eb'],
  ['Combustible / transporte', 'despesa', 'pessoal', 'Transporte', '#3b82f6'],
  ['Ocio y restaurantes', 'despesa', 'pessoal', 'Ocio', '#db2777'],
  ['Ropa y calzado', 'despesa', 'pessoal', 'Personal', '#be185d'],
  ['Suscripciones y streaming', 'despesa', 'pessoal', 'Personal', '#9d174d'],
  ['Tarjeta e intereses', 'despesa', 'pessoal', 'Financiero', '#7f1d1d'],
  ['Sueldo / retiro', 'receita', 'pessoal', 'Ingresos', '#059669'],
  ['Otros ingresos', 'receita', 'pessoal', 'Ingresos', '#10b981'],
];

function svgRecibo(titulo, linhas, cor = '#0f766e') {
  const rows = linhas
    .map(
      (l, i) =>
        `<text x="48" y="${210 + i * 34}" font-family="Helvetica, Arial" font-size="17" fill="#334155">${l[0]}</text>` +
        `<text x="452" y="${210 + i * 34}" text-anchor="end" font-family="Helvetica, Arial" font-size="17" fill="#0f172a">${l[1]}</text>`
    )
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="${230 + linhas.length * 34}" viewBox="0 0 500 ${230 + linhas.length * 34}">
  <rect width="100%" height="100%" fill="#f8fafc"/>
  <rect x="16" y="16" width="468" height="${198 + linhas.length * 34}" rx="10" fill="#ffffff" stroke="#e2e8f0"/>
  <rect x="16" y="16" width="468" height="8" rx="4" fill="${cor}"/>
  <text x="48" y="78" font-family="Helvetica, Arial" font-size="22" font-weight="bold" fill="#0f172a">${titulo}</text>
  <text x="48" y="108" font-family="Helvetica, Arial" font-size="14" fill="#64748b">Documento escaneado • demostración</text>
  <line x1="48" y1="132" x2="452" y2="132" stroke="#e2e8f0"/>
  ${rows}
  <line x1="48" y1="${190 + linhas.length * 34}" x2="452" y2="${190 + linhas.length * 34}" stroke="#e2e8f0"/>
  <text x="48" y="${216 + linhas.length * 34}" font-family="Helvetica, Arial" font-size="13" fill="#94a3b8">Imagen de ejemplo generada por el sistema</text>
</svg>`;
}

function wavSilencioso(segundos = 3) {
  const taxa = 8000;
  const amostras = taxa * segundos;
  const buf = Buffer.alloc(44 + amostras * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + amostras * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(taxa, 24);
  buf.writeUInt32LE(taxa * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(amostras * 2, 40);
  for (let i = 0; i < amostras; i++) {
    const t = i / taxa;
    const env = Math.min(1, t * 4) * Math.max(0, 1 - t / segundos);
    const v = Math.sin(2 * Math.PI * 220 * t) * 0.06 * env;
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  return buf;
}

export function seed({ force = false } = {}) {
  if (isSeeded() && !force) return false;
  if (force) {
    for (const t of ['attachments', 'whatsapp_messages', 'transactions', 'sales', 'categories', 'accounts', 'people', 'settings', 'files']) {
      db.exec(`DELETE FROM ${t}`);
    }
    db.exec("DELETE FROM sqlite_sequence WHERE name IN ('attachments','whatsapp_messages','transactions','sales','categories','accounts','people')");
  }

  const ts = nowIso();

  for (const [nome, tipo, entidade, saldo] of CONTAS) {
    run('INSERT INTO accounts (nome, tipo, entidade, saldo_inicial, ativo, criado_em) VALUES (?,?,?,?,1,?)', nome, tipo, entidade, saldo, ts);
  }
  for (const [nome, tipo, entidade, grupo, cor] of CATEGORIAS) {
    run('INSERT INTO categories (nome, tipo, entidade, grupo, cor, ativo) VALUES (?,?,?,?,?,1)', nome, tipo, entidade, grupo, cor);
  }
  run('INSERT INTO people (nome, papel, cor) VALUES (?,?,?)', 'Socio', 'Carpintería y producción', '#0f766e');
  run('INSERT INTO people (nome, papel, cor) VALUES (?,?,?)', 'Socia', 'Finanzas y ventas', '#b45309');

  const cat = (nome) => get('SELECT id FROM categories WHERE nome = ?', nome).id;
  const conta = (nome) => get('SELECT id FROM accounts WHERE nome = ?', nome).id;
  const pessoa = (nome) => get('SELECT id FROM people WHERE nome = ?', nome).id;

  const inserir = (t) =>
    run(
      `INSERT INTO transactions (data, tipo, valor, entidade, conta_id, conta_destino_id, categoria_id, pessoa_id, descricao, forma_pagamento, status, vencimento, origem, venda_id, criado_em)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      t.data,
      t.tipo,
      t.valor,
      t.entidade,
      t.conta_id,
      t.conta_destino_id ?? null,
      t.categoria_id ?? null,
      t.pessoa_id ?? null,
      t.descricao ?? null,
      t.forma_pagamento ?? 'pix',
      t.status ?? 'pago',
      t.vencimento ?? null,
      t.origem ?? 'manual',
      t.venda_id ?? null,
      ts
    );

  const clientes = [
    'Familia Andrade', 'Clínica Vida', 'Sr. Nilton', 'Café del Barrio', 'Dra. Helena',
    'Apartamento 302 - Ed. Aurora', 'Tienda Bella Casa', 'Sr. Osvaldo', 'Consultorio Sonrisa',
    'Casa de Playa - Sr. Iván', 'Panadería Pan Caliente', 'Sra. Marli',
  ];
  const projetos = [
    'Cocina a medida', 'Dormitorio completo con armario', 'Home office a medida',
    'Baño con mueble suspendido', 'Sala con panel y mueble de TV', 'Vestidor', 'Bodega climatizada',
    'Mostrador de atención', 'Armario de lavandería', 'Mesa de comedor a medida',
  ];
  const moveisProntos = ['Mesa ratona', 'Estantería 5 nichos', 'Aparador', 'Mesa de noche', 'Mueble de TV', 'Consola', 'Banco de madera'];

  const vendas = [];
  const registrarVenda = (v) => {
    const r = run(
      `INSERT INTO sales (data, tipo, cliente, descricao, valor, custo, status, forma_pagamento, observacoes, criado_em)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      v.data, v.tipo, v.cliente, v.descricao, v.valor, v.custo, v.status, v.forma_pagamento ?? 'pix', v.observacoes ?? null, ts
    );
    const id = Number(r.lastInsertRowid);
    vendas.push({ ...v, id });
    return id;
  };

  for (const [ano, mes] of MESES) {
    const ultimoDia = mes === 11 ? 16 : new Date(ano, mes, 0).getDate();
    const dia = (d) => Math.min(d, ultimoDia);

    const qtdServicos = intBetween(2, 4);
    for (let i = 0; i < qtdServicos; i++) {
      const valor = between(3200, 16500);
      const custo = Math.round(valor * between(0.32, 0.46) * 100) / 100;
      const cliente = pick(clientes);
      const descricao = pick(projetos);
      const diaServico = dia(intBetween(3, ultimoDia));
      const status = diaServico > 12 && mes === 11 ? pick(['aprovado', 'producao', 'entregue']) : 'pago';
      const vendaId = registrarVenda({
        data: iso(ano, mes, diaServico),
        tipo: 'servico',
        cliente,
        descricao,
        valor,
        custo,
        status,
        forma_pagamento: pick(['pix', 'transferencia', 'credito']),
      });
      if (status === 'pago') {
        inserir({
          data: iso(ano, mes, diaServico),
          tipo: 'receita',
          valor,
          entidade: 'empresa',
          conta_id: conta(pick(['Cuenta de la empresa', 'Cuenta de la empresa', 'Caja de la carpintería'])),
          categoria_id: cat('Muebles a medida'),
          pessoa_id: pessoa('Socio'),
          descricao: `${descricao} — ${cliente}`,
          forma_pagamento: pick(['pix', 'transferencia']),
          origem: 'venda',
          venda_id: vendaId,
        });
      } else if (status === 'entregue') {
        inserir({
          data: iso(ano, mes, diaServico),
          tipo: 'receita',
          valor,
          entidade: 'empresa',
          conta_id: conta('Cuenta de la empresa'),
          categoria_id: cat('Muebles a medida'),
          pessoa_id: pessoa('Socio'),
          descricao: `${descricao} — ${cliente} (por cobrar)`,
          status: 'pendente',
          vencimento: iso(ano, mes, dia(diaServico + 5)),
          origem: 'venda',
          venda_id: vendaId,
        });
      }
    }

    const qtdProntos = intBetween(1, 3);
    for (let i = 0; i < qtdProntos; i++) {
      const valor = between(380, 2600);
      const custo = Math.round(valor * between(0.45, 0.6) * 100) / 100;
      const descricao = pick(moveisProntos);
      const d = dia(intBetween(2, ultimoDia));
      const vendaId = registrarVenda({
        data: iso(ano, mes, d),
        tipo: 'produto',
        cliente: pick(['Venta en mostrador', 'Instagram', 'Recomendación', 'Feria del barrio', 'Cliente antiguo']),
        descricao,
        valor,
        custo,
        status: 'pago',
        forma_pagamento: pick(['pix', 'dinheiro', 'debito']),
      });
      inserir({
        data: iso(ano, mes, d),
        tipo: 'receita',
        valor,
        entidade: 'empresa',
        conta_id: conta(pick(['Caja de la carpintería', 'Cuenta de la empresa'])),
        categoria_id: cat('Muebles listos (reventa)'),
        pessoa_id: pessoa('Socia'),
        descricao: `${descricao} (listo para entrega)`,
        forma_pagamento: pick(['pix', 'dinheiro']),
        origem: 'venda',
        venda_id: vendaId,
      });
    }

    if (rnd() > 0.35) {
      const valor = between(280, 1400);
      inserir({
        data: iso(ano, mes, dia(intBetween(5, ultimoDia))),
        tipo: 'receita',
        valor,
        entidade: 'empresa',
        conta_id: conta('Caja de la carpintería'),
        categoria_id: cat('Instalación y montaje'),
        pessoa_id: pessoa('Socio'),
        descricao: 'Instalación y ajustes en muebles del cliente',
        forma_pagamento: 'pix',
      });
    }

    inserir({ data: iso(ano, mes, dia(5)), tipo: 'despesa', valor: 1800, entidade: 'empresa', conta_id: conta('Cuenta de la empresa'), categoria_id: cat('Alquiler del galpón'), descricao: 'Alquiler del galpón', forma_pagamento: 'transferencia' });
    inserir({ data: iso(ano, mes, dia(10)), tipo: 'despesa', valor: between(280, 540), entidade: 'empresa', conta_id: conta('Cuenta de la empresa'), categoria_id: cat('Electricidad'), descricao: 'Factura de electricidad del galpón', forma_pagamento: 'boleto' });
    inserir({ data: iso(ano, mes, dia(12)), tipo: 'despesa', valor: between(160, 220), entidade: 'empresa', conta_id: conta('Cuenta de la empresa'), categoria_id: cat('Agua e internet'), descricao: 'Agua + internet del galpón', forma_pagamento: 'boleto' });
    inserir({ data: iso(ano, mes, dia(15)), tipo: 'despesa', valor: 380, entidade: 'empresa', conta_id: conta('Cuenta de la empresa'), categoria_id: cat('Contador'), descricao: 'Honorarios del contador', forma_pagamento: 'pix' });
    inserir({ data: iso(ano, mes, dia(20)), tipo: 'despesa', valor: between(120, 260), entidade: 'empresa', conta_id: conta('Cuenta de la empresa'), categoria_id: cat('Impuestos y tasas'), descricao: 'Impuesto mensual', forma_pagamento: 'boleto' });

    for (let i = 0; i < intBetween(2, 3); i++) {
      inserir({
        data: iso(ano, mes, dia(intBetween(2, ultimoDia))),
        tipo: 'despesa',
        valor: between(700, 3600),
        entidade: 'empresa',
        conta_id: conta(pick(['Cuenta de la empresa', 'Tarjeta de la empresa'])),
        categoria_id: cat('Madera / MDF / aglomerado'),
        descricao: pick(['Tableros de MDF', 'Aglomerado y madera maciza', 'MDF blanco + tapacanto', 'Compra de tableros al proveedor']),
        forma_pagamento: pick(['pix', 'boleto', 'credito']),
      });
    }
    for (let i = 0; i < intBetween(1, 2); i++) {
      inserir({
        data: iso(ano, mes, dia(intBetween(3, ultimoDia))),
        tipo: 'despesa',
        valor: between(180, 950),
        entidade: 'empresa',
        conta_id: conta(pick(['Cuenta de la empresa', 'Tarjeta de la empresa'])),
        categoria_id: cat('Herrajes y accesorios'),
        descricao: pick(['Bisagras, correderas y tiradores', 'Kit de herrajes', 'Correderas telescópicas']),
        forma_pagamento: pick(['pix', 'credito']),
      });
    }
    for (let i = 0; i < intBetween(2, 4); i++) {
      inserir({
        data: iso(ano, mes, dia(intBetween(2, ultimoDia))),
        tipo: 'despesa',
        valor: between(80, 360),
        entidade: 'empresa',
        conta_id: conta(pick(['Caja de la carpintería', 'Cuenta de la empresa'])),
        categoria_id: cat('Flete y entregas'),
        descricao: pick(['Flete de tableros', 'Entrega de mueble armado', 'Flete de herrajes']),
        forma_pagamento: pick(['dinheiro', 'pix']),
      });
    }
    for (let i = 0; i < intBetween(2, 4); i++) {
      inserir({
        data: iso(ano, mes, dia(intBetween(2, ultimoDia))),
        tipo: 'despesa',
        valor: between(120, 320),
        entidade: 'empresa',
        conta_id: conta(pick(['Caja de la carpintería', 'Tarjeta de la empresa'])),
        categoria_id: cat('Combustible'),
        descricao: 'Combustible de la camioneta',
        forma_pagamento: pick(['dinheiro', 'debito']),
      });
    }
    if (rnd() > 0.5) {
      inserir({
        data: iso(ano, mes, dia(intBetween(4, ultimoDia))),
        tipo: 'despesa',
        valor: between(250, 1200),
        entidade: 'empresa',
        conta_id: conta('Tarjeta de la empresa'),
        categoria_id: cat('Mantenimiento de máquinas'),
        descricao: pick(['Afilado de sierra y cepillo', 'Mantenimiento de la encoladora', 'Repuestos para la tupí']),
        forma_pagamento: 'credito',
      });
    }
    if (rnd() > 0.45) {
      inserir({
        data: iso(ano, mes, dia(intBetween(4, ultimoDia))),
        tipo: 'despesa',
        valor: between(150, 600),
        entidade: 'empresa',
        conta_id: conta('Tarjeta de la empresa'),
        categoria_id: cat('Herramientas y EPP'),
        descricao: pick(['Brocas y discos de corte', 'Gafas y protectores auditivos', 'Atornillador nuevo']),
        forma_pagamento: 'credito',
      });
    }
    if (rnd() > 0.4) {
      inserir({
        data: iso(ano, mes, dia(intBetween(4, ultimoDia))),
        tipo: 'despesa',
        valor: between(120, 500),
        entidade: 'empresa',
        conta_id: conta('Tarjeta de la empresa'),
        categoria_id: cat('Marketing y anuncios'),
        descricao: 'Anuncios en Instagram / Google',
        forma_pagamento: 'credito',
      });
    }
    if (rnd() > 0.6) {
      inserir({
        data: iso(ano, mes, dia(intBetween(4, ultimoDia))),
        tipo: 'despesa',
        valor: between(300, 1500),
        entidade: 'empresa',
        conta_id: conta('Cuenta de la empresa'),
        categoria_id: cat('Tercerización (pintura/vidrio)'),
        descricao: 'Servicio de pintura / vidriería',
        forma_pagamento: 'pix',
      });
    }

    for (const d of [5, 20]) {
      inserir({
        data: iso(ano, mes, dia(d)),
        tipo: 'transferencia',
        valor: between(2400, 4200),
        entidade: 'empresa',
        conta_id: conta('Cuenta de la empresa'),
        conta_destino_id: conta('Cuenta personal'),
        descricao: 'Retiro de los socios',
        forma_pagamento: 'transferencia',
      });
    }

    inserir({ data: iso(ano, mes, dia(10)), tipo: 'despesa', valor: 1500, entidade: 'pessoal', conta_id: conta('Cuenta personal'), categoria_id: cat('Casa / alquiler'), descricao: 'Alquiler de la casa', forma_pagamento: 'transferencia' });
    inserir({ data: iso(ano, mes, dia(12)), tipo: 'despesa', valor: between(180, 320), entidade: 'pessoal', conta_id: conta('Cuenta personal'), categoria_id: cat('Electricidad y agua (casa)'), descricao: 'Electricidad y agua de la casa', forma_pagamento: 'boleto' });
    inserir({ data: iso(ano, mes, dia(8)), tipo: 'despesa', valor: 55.9, entidade: 'pessoal', conta_id: conta('Tarjeta personal'), categoria_id: cat('Suscripciones y streaming'), descricao: 'Streaming e internet', forma_pagamento: 'credito' });
    if (mes >= 8) {
      inserir({ data: iso(ano, mes, dia(7)), tipo: 'despesa', valor: 480, entidade: 'pessoal', conta_id: conta('Cuenta personal'), categoria_id: cat('Escuela / educación'), descricao: 'Cuota escolar', forma_pagamento: 'pix' });
    }
    for (let i = 0; i < intBetween(4, 6); i++) {
      inserir({
        data: iso(ano, mes, dia(intBetween(2, ultimoDia))),
        tipo: 'despesa',
        valor: between(180, 720),
        entidade: 'pessoal',
        conta_id: conta(pick(['Cuenta personal', 'Tarjeta personal', 'Billetera'])),
        categoria_id: cat('Supermercado'),
        descricao: pick(['Compra del mes en el supermercado', 'Supermercado de la semana', 'Feria y carnicería']),
        forma_pagamento: pick(['debito', 'credito', 'dinheiro', 'pix']),
      });
    }
    for (let i = 0; i < intBetween(1, 2); i++) {
      inserir({
        data: iso(ano, mes, dia(intBetween(2, ultimoDia))),
        tipo: 'despesa',
        valor: between(90, 420),
        entidade: 'pessoal',
        conta_id: conta(pick(['Cuenta personal', 'Tarjeta personal'])),
        categoria_id: cat('Salud y farmacia'),
        descricao: pick(['Farmacia', 'Consulta médica', 'Seguro médico']),
        forma_pagamento: pick(['pix', 'credito']),
      });
    }
    for (let i = 0; i < intBetween(2, 3); i++) {
      inserir({
        data: iso(ano, mes, dia(intBetween(2, ultimoDia))),
        tipo: 'despesa',
        valor: between(140, 320),
        entidade: 'pessoal',
        conta_id: conta(pick(['Tarjeta personal', 'Billetera'])),
        categoria_id: cat('Combustible / transporte'),
        descricao: pick(['Combustible del auto', 'Uber y estacionamiento']),
        forma_pagamento: pick(['debito', 'dinheiro']),
      });
    }
    for (let i = 0; i < intBetween(1, 3); i++) {
      inserir({
        data: iso(ano, mes, dia(intBetween(2, ultimoDia))),
        tipo: 'despesa',
        valor: between(80, 380),
        entidade: 'pessoal',
        conta_id: conta(pick(['Tarjeta personal', 'Cuenta personal'])),
        categoria_id: cat('Ocio y restaurantes'),
        descricao: pick(['Cena en familia', 'Cine', 'Paseo de fin de semana']),
        forma_pagamento: pick(['credito', 'pix']),
      });
    }
    if (rnd() > 0.55) {
      inserir({
        data: iso(ano, mes, dia(intBetween(2, ultimoDia))),
        tipo: 'despesa',
        valor: between(120, 600),
        entidade: 'pessoal',
        conta_id: conta('Tarjeta personal'),
        categoria_id: cat('Ropa y calzado'),
        descricao: 'Ropa y calzado',
        forma_pagamento: 'credito',
      });
    }
  }

  run(
    `INSERT INTO transactions (data, tipo, valor, entidade, conta_id, categoria_id, descricao, forma_pagamento, status, vencimento, origem, criado_em)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    iso(2026, 11, 18), 'despesa', 2350, 'empresa', conta('Cuenta de la empresa'), cat('Madera / MDF / aglomerado'),
    'Tableros de MDF — proveedor (por pagar)', 'boleto', 'pendente', iso(2026, 11, 25), 'manual', ts
  );
  run(
    `INSERT INTO transactions (data, tipo, valor, entidade, conta_id, categoria_id, descricao, forma_pagamento, status, vencimento, origem, criado_em)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    iso(2026, 11, 10), 'receita', 4200, 'empresa', conta('Cuenta de la empresa'), cat('Muebles a medida'),
    'Armario a medida — Sr. Osvaldo (por cobrar)', 'pix', 'pendente', iso(2026, 11, 30), 'manual', ts
  );
  run(
    `INSERT INTO transactions (data, tipo, valor, entidade, conta_id, categoria_id, descricao, forma_pagamento, status, vencimento, origem, criado_em)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    iso(2026, 11, 14), 'despesa', 890, 'empresa', conta('Tarjeta de la empresa'), cat('Herrajes y accesorios'),
    'Herrajes — cuota de la tarjeta (por pagar)', 'credito', 'pendente', iso(2026, 11, 28), 'manual', ts
  );

  const recibo1 = svgRecibo('Recibo — Maderera Central', [
    ['Tableros MDF 18mm (12 un.)', 'R$ 2.640,00'],
    ['Tapacanto', 'R$ 180,00'],
    ['Entrega', 'R$ 120,00'],
    ['Total', 'R$ 2.940,00'],
  ]);
  const recibo2 = svgRecibo('Factura — Herrajes Silva', [
    ['Correderas 45cm (20 pares)', 'R$ 620,00'],
    ['Bisagras (40 un.)', 'R$ 340,00'],
    ['Tiradores', 'R$ 210,00'],
    ['Total', 'R$ 1.170,00'],
  ], '#b45309');
  const recibo3 = svgRecibo('Comprobante PIX — Cliente', [
    ['Cliente', 'Familia Andrade'],
    ['Cocina a medida', 'R$ 12.400,00'],
    ['Fecha', '05/11/2026'],
    ['Estado', 'Completado'],
  ], '#0d9488');

  fs.writeFileSync(path.join(UPLOAD_DIR, 'recibo-madeireira.svg'), recibo1);
  fs.writeFileSync(path.join(UPLOAD_DIR, 'recibo-ferragens.svg'), recibo2);
  fs.writeFileSync(path.join(UPLOAD_DIR, 'comprovante-pix.svg'), recibo3);
  fs.writeFileSync(path.join(UPLOAD_DIR, 'audio-recado.wav'), wavSilencioso(4));

  saveFile('recibo-madeireira.svg', 'image/svg+xml', Buffer.from(recibo1));
  saveFile('recibo-ferragens.svg', 'image/svg+xml', Buffer.from(recibo2));
  saveFile('comprovante-pix.svg', 'image/svg+xml', Buffer.from(recibo3));
  saveFile('audio-recado.wav', 'audio/wav', wavSilencioso(4));

  const txMdf = get("SELECT id FROM transactions WHERE descricao LIKE 'Tableros de MDF%' AND status = 'pago' ORDER BY data DESC LIMIT 1");
  const txFerragem = get("SELECT id FROM transactions WHERE categoria_id = ? ORDER BY data DESC LIMIT 1", cat('Herrajes y accesorios'));
  const txCliente = get("SELECT id FROM transactions WHERE descricao LIKE 'Cocina a medida%' ORDER BY data DESC LIMIT 1");

  const anexo = (nome, mime, tamanho, caminho, txId, waId) =>
    run(
      'INSERT INTO attachments (nome_arquivo, mimetype, tamanho, caminho, transaction_id, whatsapp_message_id, criado_em) VALUES (?,?,?,?,?,?,?)',
      nome, mime, tamanho, caminho, txId ?? null, waId ?? null, ts
    );

  anexo('recibo-madeireira.svg', 'image/svg+xml', recibo1.length, 'recibo-madeireira.svg', txMdf?.id, null);
  anexo('recibo-ferragens.svg', 'image/svg+xml', recibo2.length, 'recibo-ferragens.svg', txFerragem?.id, null);
  anexo('comprovante-pix.svg', 'image/svg+xml', recibo3.length, 'comprovante-pix.svg', txCliente?.id, null);

  const wa = (m) =>
    run(
      `INSERT INTO whatsapp_messages (wa_message_id, direcao, remetente, tipo, conteudo, media_path, mimetype, enviado_em, status, transaction_id, entidade, criado_em)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      m.wa_message_id ?? null, m.direcao, m.remetente, m.tipo, m.conteudo ?? null, m.media_path ?? null,
      m.mimetype ?? null, m.enviado_em, m.status ?? 'recebida', m.transaction_id ?? null, m.entidade ?? 'empresa', ts
    );

  wa({ direcao: 'entrada', remetente: 'Socio', tipo: 'texto', conteudo: 'Compré los tableros de MDF hoy, salió R$ 2.940 en Maderera Central. ¿Ya lo registraste?', enviado_em: '2026-11-16T11:42:00.000Z', transaction_id: txMdf?.id ?? null });
  wa({ direcao: 'entrada', remetente: 'Socio', tipo: 'imagem', conteudo: 'Recibo de la maderera', media_path: 'recibo-madeireira.svg', mimetype: 'image/svg+xml', enviado_em: '2026-11-16T11:43:00.000Z', transaction_id: txMdf?.id ?? null });
  wa({ direcao: 'saida', remetente: 'Sistema', tipo: 'texto', conteudo: 'Recibí el recibo. Registré R$ 2.940,00 en Madera / MDF / aglomerado (empresa). ¿Confirma?', enviado_em: '2026-11-16T11:44:00.000Z', status: 'enviada' });
  wa({ direcao: 'entrada', remetente: 'Socia', tipo: 'audio', conteudo: 'Audio de 0:04', media_path: 'audio-recado.wav', mimetype: 'audio/wav', enviado_em: '2026-11-16T12:05:00.000Z' });
  wa({ direcao: 'entrada', remetente: 'Socia', tipo: 'texto', conteudo: 'El cliente de la cocina pagó el saldo, entró en la cuenta de la empresa.', enviado_em: '2026-11-16T12:06:00.000Z', transaction_id: txCliente?.id ?? null });
  wa({ direcao: 'entrada', remetente: 'Socio', tipo: 'imagem', conteudo: 'Comprobante del PIX del cliente', media_path: 'comprovante-pix.svg', mimetype: 'image/svg+xml', enviado_em: '2026-11-16T12:07:00.000Z', transaction_id: txCliente?.id ?? null });
  wa({ direcao: 'entrada', remetente: 'Socio', tipo: 'texto', conteudo: 'Pagué el flete de la entrega, R$ 180 en efectivo.', enviado_em: '2026-11-15T17:20:00.000Z' });
  wa({ direcao: 'entrada', remetente: 'Socia', tipo: 'imagem', conteudo: 'Factura de los herrajes', media_path: 'recibo-ferragens.svg', mimetype: 'image/svg+xml', enviado_em: '2026-11-14T09:15:00.000Z', transaction_id: txFerragem?.id ?? null });
  wa({ direcao: 'saida', remetente: 'Sistema', tipo: 'texto', conteudo: 'Balance de octubre cerrado: resultado de R$ 14.382,00 en la carpintería. ¿Quieres el resumen en PDF?', enviado_em: '2026-11-01T08:00:00.000Z', status: 'enviada' });
  wa({ direcao: 'entrada', remetente: 'Socia', tipo: 'texto', conteudo: 'Sí, mándalo, y separa cuánto fue de retiro nuestro.', enviado_em: '2026-11-01T08:12:00.000Z' });

  setSetting('empresa_nome', 'Carpintería');
  setSetting('moeda', 'BRL');
  setSetting('whatsapp_status', 'desconectado');
  setSetting('whatsapp_numero', '');
  setSetting('whatsapp_provider', '');
  setSetting('whatsapp_webhook_token', '');
  setSetting('seed_em', ts);

  return true;
}
