const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const state = { boot: null, mes: null, page: 'painel' };

const MONEDA = 'R$';

const nf = (n, opts = {}) => Number(n).toLocaleString('es-ES', { useGrouping: 'always', ...opts });

const fmt = (v) => {
  const n = Number(v) || 0;
  const s = nf(Math.abs(n), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${n < 0 ? '-' : ''}${MONEDA} ${s}`;
};
const fmt0 = (v) => {
  const n = Number(v) || 0;
  const s = nf(Math.abs(n), { maximumFractionDigits: 0 });
  return `${n < 0 ? '-' : ''}${MONEDA} ${s}`;
};
const fmtCompact = (v) => {
  const n = Number(v) || 0;
  const abs = Math.abs(n);
  const signo = n < 0 ? '-' : '';
  if (abs >= 1000000) return `${signo}${nf(abs / 1000000, { maximumFractionDigits: 1 })} M`;
  if (abs >= 1000) return `${signo}${nf(abs / 1000, { maximumFractionDigits: 1 })} mil`;
  return `${signo}${nf(abs, { maximumFractionDigits: 0 })}`;
};
const pct = (v) => `${nf(Number(v) || 0, { maximumFractionDigits: 1 })}%`;

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const fmtDate = (iso) => {
  if (!iso) return '—';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};
const fmtDateShort = (iso) => {
  if (!iso) return '—';
  const [, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}`;
};
const fmtHora = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};
const nomeMes = (mes) => {
  const [y, m] = String(mes).split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  const s = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const nomeMesCurto = (mes) => {
  const [y, m] = String(mes).split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('es-ES', { month: 'short' }).replace('.', '');
};

async function api(path, opts = {}) {
  const enviar = () =>
    fetch(`/api${path}`, {
      headers: opts.body && !(opts.body instanceof FormData) ? { 'Content-Type': 'application/json' } : undefined,
      ...opts,
      body: opts.body && !(opts.body instanceof FormData) ? JSON.stringify(opts.body) : opts.body,
    });

  let res;
  let ultimoErro;
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    try {
      res = await enviar();
      if (![502, 503, 504].includes(res.status)) break;
      ultimoErro = new Error('El servidor está despertando. Intenta de nuevo en unos segundos.');
    } catch (e) {
      ultimoErro = e;
    }
    if (tentativa < 2) await new Promise((r) => setTimeout(r, 1500 * (tentativa + 1)));
  }
  if (!res) throw ultimoErro || new Error('Sin conexión con el servidor');

  const txt = await res.text();
  let data = null;
  try {
    data = txt ? JSON.parse(txt) : null;
  } catch {
    data = txt;
  }
  if (!res.ok) throw new Error((data && data.erro) || `Error ${res.status}`);
  return data;
}

function toast(msg, tipo = 'ok') {
  const el = document.createElement('div');
  el.className = `toast ${tipo === 'err' ? 'err' : ''}`;
  el.textContent = msg;
  $('#toast-root').appendChild(el);
  setTimeout(() => el.remove(), 3800);
}

const ICONS = {
  painel: '<path d="M3 3h7v7H3zM14 3h7v4h-7zM14 10h7v11h-7zM3 13h7v8H3z"/>',
  lancamentos: '<path d="M4 6h16M4 12h16M4 18h10"/><circle cx="19" cy="18" r="2"/>',
  vendas: '<path d="M20.6 13.4 12 22l-9-9V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1.2"/>',
  balanco: '<path d="M12 3v18M5 7h14M7 7l-4 8h8L7 7Zm10 0-4 8h8l-4-8Z"/>',
  contas: '<rect x="2" y="6" width="20" height="13" rx="2.5"/><path d="M2 10h20M16 14.5h2"/>',
  whatsapp: '<path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 21l2.2-5.2A8.5 8.5 0 1 1 21 11.5Z"/><path d="M8.5 9.5c0 3 2 5 5 5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M4 20h4l10-10-4-4L4 16v4Z"/><path d="M14 6l4 4"/>',
  trash: '<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/>',
  clip: '<path d="M20 11.5 12 19.5a5 5 0 0 1-7-7l8-8a3.5 3.5 0 0 1 5 5l-8 8a2 2 0 0 1-3-3l7-7"/>',
  check: '<path d="M4 12.5 9 17.5 20 6.5"/>',
  download: '<path d="M12 3v12m0 0 4-4m-4 4-4-4M4 19h16"/>',
  print: '<path d="M7 8V3h10v5M7 18H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><rect x="7" y="14" width="10" height="7" rx="1"/>',
  send: '<path d="M21 3 10.5 13.5M21 3l-7 18-3.5-7.5L3 10l18-7Z"/>',
  link: '<path d="M9.5 14.5 14.5 9.5M7 12l-1.5 1.5a3.5 3.5 0 0 0 5 5L12 17M17 12l1.5-1.5a3.5 3.5 0 0 0-5-5L12 7"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5"/>',
};

const icon = (name, cls = '') =>
  `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

/* ---------------- charts ---------------- */

function barChart(serie, { height = 230 } = {}) {
  const W = 640;
  const H = height;
  const padL = 46;
  const padR = 8;
  const padT = 14;
  const padB = 30;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const max = Math.max(1, ...serie.flatMap((s) => [s.receitas, s.despesas]));
  const step = innerW / serie.length;
  const bw = Math.min(22, step / 3.1);
  const y = (v) => padT + innerH - (v / max) * innerH;

  const grid = [0, 0.25, 0.5, 0.75, 1]
    .map((f) => {
      const yy = padT + innerH * (1 - f);
      return `<line x1="${padL}" y1="${yy}" x2="${W - padR}" y2="${yy}" stroke="#eef1ed" stroke-width="1"/>
        <text x="${padL - 8}" y="${yy + 3.5}" text-anchor="end" font-size="9.5" fill="#8a9995">${fmtCompact(max * f)}</text>`;
    })
    .join('');

  const bars = serie
    .map((s, i) => {
      const cx = padL + step * i + step / 2;
      const h1 = Math.max(0, innerH - (y(s.receitas) - padT));
      const h2 = Math.max(0, innerH - (y(s.despesas) - padT));
      return `
        <rect x="${cx - bw - 2}" y="${y(s.receitas)}" width="${bw}" height="${h1}" rx="3" fill="#0f766e"/>
        <rect x="${cx + 2}" y="${y(s.despesas)}" width="${bw}" height="${h2}" rx="3" fill="#e0b48a"/>
        <text x="${cx}" y="${H - 10}" text-anchor="middle" font-size="10" fill="#6b7a76">${nomeMesCurto(s.mes)}</text>`;
    })
    .join('');

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Ingresos y gastos por mes">
    ${grid}${bars}
  </svg>
  <div class="legend"><span><i style="background:#0f766e"></i>Ingresos</span><span><i style="background:#e0b48a"></i>Gastos</span></div>`;
}

function donut(items, total, { size = 168 } = {}) {
  const r = 62;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const segs = items
    .map((it) => {
      const frac = total > 0 ? it.total / total : 0;
      const len = frac * c;
      const seg = `<circle cx="84" cy="84" r="${r}" fill="none" stroke="${it.cor || '#94a3b8'}" stroke-width="17"
        stroke-dasharray="${len} ${c - len}" stroke-dashoffset="${-offset}" transform="rotate(-90 84 84)" stroke-linecap="butt"/>`;
      offset += len;
      return seg;
    })
    .join('');
  return `<svg class="chart" viewBox="0 0 168 168" style="max-width:${size}px;margin:0 auto" role="img" aria-label="Gastos por categoría">
    <circle cx="84" cy="84" r="${r}" fill="none" stroke="#eef1ed" stroke-width="17"/>
    ${segs}
    <text x="84" y="80" text-anchor="middle" font-size="11" fill="#6b7a76">Total</text>
    <text x="84" y="97" text-anchor="middle" font-size="14" font-weight="700" fill="#0f1f1b">${fmtCompact(total)}</text>
  </svg>`;
}

/* ---------------- router ---------------- */

const ROUTES = {
  painel: { titulo: 'Panel', sub: 'Visión general del mes', render: renderPainel, mes: true },
  lancamentos: { titulo: 'Movimientos', sub: 'Ingresos, gastos y transferencias', render: renderLancamentos, mes: true },
  vendas: { titulo: 'Ventas', sub: 'Servicios de carpintería y muebles listos', render: renderVendas, mes: true },
  balanco: { titulo: 'Balance', sub: 'Cierre consolidado del mes', render: renderBalanco, mes: true },
  contas: { titulo: 'Cuentas y categorías', sub: 'Estructura financiera', render: renderContas, mes: false },
  whatsapp: { titulo: 'WhatsApp', sub: 'Mensajes, audios y fotos de comprobantes', render: renderWhatsapp, mes: false },
};

const NAV = [
  ['painel', 'Panel'],
  ['lancamentos', 'Movimientos'],
  ['vendas', 'Ventas'],
  ['balanco', 'Balance'],
  ['contas', 'Cuentas y categorías'],
  ['whatsapp', 'WhatsApp'],
];

function parseHash() {
  const h = (location.hash || '#/painel').replace(/^#\/?/, '').split('?')[0];
  return ROUTES[h] ? h : 'painel';
}

function renderNav() {
  $('#nav').innerHTML = NAV.map(
    ([key, label], i) =>
      `${i === 4 ? '<div class="nav-label">Configuración</div>' : ''}
       <a href="#/${key}" data-nav="${key}" class="${state.page === key ? 'active' : ''}">${icon(key)}<span>${label}</span></a>`
  ).join('');
}

async function render() {
  const page = parseHash();
  state.page = page;
  const route = ROUTES[page];
  renderNav();
  $('#page-title').textContent = route.titulo;
  $('#page-sub').textContent = route.sub;
  $('#month-picker').style.display = route.mes ? '' : 'none';
  $('#mes-input').value = state.mes;
  const view = $('#view');
  view.innerHTML = '<div class="empty">Cargando…</div>';
  try {
    view.innerHTML = await route.render();
    AFTER[page]?.();
  } catch (e) {
    view.innerHTML = `<div class="card"><div class="empty"><strong>No se pudo cargar</strong>${esc(e.message)}<div style="margin-top:12px"><button class="btn btn-sm" onclick="location.reload()">Reintentar</button></div></div></div>`;
  }
}

/* ---------------- panel ---------------- */

function deltaTag(atual, anterior, invertido = false) {
  if (!anterior) return '<span class="delta flat">sin base</span>';
  const v = ((atual - anterior) / Math.abs(anterior)) * 100;
  const bom = invertido ? v < 0 : v > 0;
  const cls = Math.abs(v) < 0.5 ? 'flat' : bom ? 'up' : 'down';
  const seta = v > 0 ? '▲' : v < 0 ? '▼' : '•';
  return `<span class="delta ${cls}">${seta} ${pct(Math.abs(v))}</span>`;
}

async function renderPainel() {
  const d = await api(`/dashboard?mes=${state.mes}`);
  const t = d.total;
  const ant = d.total_anterior;
  const cats = d.por_categoria;
  const totalCat = cats.reduce((s, c) => s + c.total, 0);

  const kpis = `
    <div class="grid g-4">
      <div class="card kpi">
        <span class="label">Saldo en cuentas</span>
        <span class="value">${fmt(d.saldo_total)}</span>
        <span class="foot">Empresa ${fmt0(d.saldo_empresa)} · Personal ${fmt0(d.saldo_pessoal)}</span>
      </div>
      <div class="card kpi ${t.resultado >= 0 ? 'pos' : 'neg'}">
        <span class="label">Resultado del mes</span>
        <span class="value">${fmt(t.resultado)}</span>
        <span class="foot">${deltaTag(t.resultado, ant.resultado)} vs. mes anterior</span>
      </div>
      <div class="card kpi">
        <span class="label">Ingresos</span>
        <span class="value">${fmt(t.receitas)}</span>
        <span class="foot">${deltaTag(t.receitas, ant.receitas)} ${d.empresa.receitas > 0 ? `· empresa ${Math.round((d.empresa.receitas / t.receitas) * 100)}%` : ''}</span>
      </div>
      <div class="card kpi">
        <span class="label">Gastos</span>
        <span class="value">${fmt(t.despesas)}</span>
        <span class="foot">${deltaTag(t.despesas, ant.despesas, true)} vs. mes anterior</span>
      </div>
    </div>`;

  const secundarios = `
    <div class="grid g-4" style="margin-top:14px">
      <div class="card kpi">
        <span class="label">Por cobrar</span>
        <span class="value sm pos-text">${fmt(d.pendentes.a_receber)}</span>
        <span class="foot">${d.pendentes.qtd_receber} movimiento(s) por cobrar</span>
      </div>
      <div class="card kpi">
        <span class="label">Por pagar</span>
        <span class="value sm neg-text">${fmt(d.pendentes.a_pagar)}</span>
        <span class="foot">${d.pendentes.qtd_pagar} en abierto</span>
      </div>
      <div class="card kpi">
        <span class="label">Retiros de los socios</span>
        <span class="value sm">${fmt(d.retiradas)}</span>
        <span class="foot">Transferencias empresa → personal</span>
      </div>
      <div class="card kpi">
        <span class="label">Resultado de la empresa</span>
        <span class="value sm ${d.empresa.resultado >= 0 ? 'pos-text' : 'neg-text'}">${fmt(d.empresa.resultado)}</span>
        <span class="foot">${d.empresa.lancamentos} movimientos en el mes</span>
      </div>
    </div>`;

  const contas = d.contas
    .map(
      (c) => `<tr>
        <td><span class="desc">${esc(c.nome)}</span><div class="meta">${c.tipo === 'caixa' ? 'Caja' : c.tipo === 'banco' ? 'Banco' : c.tipo === 'cartao' ? 'Tarjeta' : 'Inversión'}</div></td>
        <td><span class="tag ${c.entidade}">${c.entidade === 'pessoal' ? 'personal' : 'empresa'}</span></td>
        <td class="num ${c.saldo < 0 ? 'neg-text' : ''}">${fmt(c.saldo)}</td>
      </tr>`
    )
    .join('');

  const ultimos = d.ultimos
    .map(
      (t2) => `<tr>
        <td class="nowrap">${fmtDateShort(t2.data)}</td>
        <td><span class="desc">${esc(t2.descricao || t2.categoria || '—')}</span>
          <div class="meta">${esc(t2.categoria || 'Sin categoría')} · ${esc(t2.conta || '')}</div></td>
        <td><span class="tag ${t2.tipo}">${t2.tipo === 'transferencia' ? 'transf.' : t2.tipo === 'receita' ? 'ingreso' : 'gasto'}</span></td>
        <td class="num ${t2.tipo === 'receita' ? 'pos-text' : t2.tipo === 'despesa' ? 'neg-text' : ''}">
          ${t2.tipo === 'receita' ? '+' : t2.tipo === 'despesa' ? '−' : ''}${fmt(t2.valor)}
        </td>
      </tr>`
    )
    .join('');

  return `
    ${kpis}
    ${secundarios}
    <div class="grid g-23" style="margin-top:14px">
      <div class="card">
        <div class="card-head"><h3>Ingresos y gastos — últimos 6 meses</h3><span class="hint">${nomeMes(state.mes)}</span></div>
        ${barChart(d.serie)}
      </div>
      <div class="card">
        <div class="card-head"><h3>Gastos por categoría</h3><span class="hint">${nomeMes(state.mes)}</span></div>
        ${cats.length ? donut(cats, totalCat) : '<div class="empty">Sin gastos en el mes</div>'}
        <div class="cat-list" style="margin-top:14px">
          ${cats
            .slice(0, 6)
            .map(
              (c) => `<div class="cat-row">
                <div class="name"><i class="dotcat" style="background:${c.cor || '#94a3b8'}"></i><span>${esc(c.nome)}</span></div>
                <div class="val">${fmt(c.total)}</div>
                <div class="bar-track"><div class="bar-fill" style="width:${totalCat ? (c.total / totalCat) * 100 : 0}%;background:${c.cor || '#94a3b8'}"></div></div>
              </div>`
            )
            .join('')}
        </div>
      </div>
    </div>
    <div class="grid g-32" style="margin-top:14px">
      <div class="card">
        <div class="card-head"><h3>Cuentas</h3><a href="#/contas" class="hint">Gestionar</a></div>
        <div class="table-wrap"><table><tbody>${contas}</tbody></table></div>
      </div>
      <div class="card">
        <div class="card-head"><h3>Últimos movimientos</h3><a href="#/lancamentos" class="hint">Ver todos</a></div>
        <div class="table-wrap"><table><tbody>${ultimos || '<tr><td class="empty">Ningún movimiento</td></tr>'}</tbody></table></div>
      </div>
    </div>`;
}

/* ---------------- modal ---------------- */

function closeModal() {
  const root = $('#modal-root');
  root.innerHTML = '';
  document.body.style.overflow = '';
}

function openModal({ titulo, body, footer = '', wide = false, onMount }) {
  const root = $('#modal-root');
  root.innerHTML = `
    <div class="modal-backdrop" data-backdrop>
      <div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(titulo)}">
        <div class="modal-head">
          <h3>${esc(titulo)}</h3>
          <button class="icon-btn" type="button" data-close aria-label="Cerrar">&times;</button>
        </div>
        <div class="modal-body">${body}</div>
        ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
      </div>
    </div>`;
  document.body.style.overflow = 'hidden';
  root.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeModal));
  root.querySelector('[data-backdrop]').addEventListener('mousedown', (e) => {
    if (e.target.hasAttribute('data-backdrop')) closeModal();
  });
  if (onMount) onMount(root);
  return root;
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

/* ---------------- movimientos ---------------- */

const filtros = { entidade: '', tipo: '', status: '', q: '' };

function optionsCategorias(tipo, entidade, selecionado) {
  const cats = (state.boot.categorias || []).filter(
    (c) => c.tipo === tipo && (c.entidade === entidade || c.entidade === 'ambas')
  );
  const grupos = {};
  for (const c of cats) (grupos[c.grupo || 'Otros'] ||= []).push(c);
  return `<option value="">Sin categoría</option>${Object.entries(grupos)
    .map(
      ([g, lista]) =>
        `<optgroup label="${esc(g)}">${lista
          .map((c) => `<option value="${c.id}" ${String(c.id) === String(selecionado) ? 'selected' : ''}>${esc(c.nome)}</option>`)
          .join('')}</optgroup>`
    )
    .join('')}`;
}

function optionsContas(entidade, selecionado, todas = false) {
  return (state.boot.contas || [])
    .filter((c) => todas || c.entidade === entidade)
    .map((c) => `<option value="${c.id}" ${String(c.id) === String(selecionado) ? 'selected' : ''}>${esc(c.nome)}</option>`)
    .join('');
}

async function renderLancamentos() {
  const qs = new URLSearchParams({ mes: state.mes });
  for (const [k, v] of Object.entries(filtros)) if (v) qs.set(k, v);
  const d = await api(`/transactions?${qs}`);
  const r = d.resumo;

  const linhas = d.itens
    .map(
      (t) => `<tr>
      <td class="nowrap">${fmtDate(t.data)}</td>
      <td>
        <span class="desc">${esc(t.descricao || t.categoria || '—')}</span>
        <div class="meta">
          ${t.categoria ? `<i class="dotcat" style="background:${t.categoria_cor || '#94a3b8'};margin-right:4px"></i>${esc(t.categoria)}` : 'Sin categoría'}
          ${t.anexos ? ` · ${icon('clip', 'inline-icon')} ${t.anexos} adjunto(s)` : ''}
        </div>
      </td>
      <td><span class="tag ${t.entidade}">${t.entidade === 'pessoal' ? 'personal' : 'empresa'}</span></td>
      <td class="nowrap muted">${esc(t.tipo === 'transferencia' ? `${t.conta} → ${t.conta_destino || '?'}` : t.conta || '—')}</td>
      <td class="nowrap muted">${esc(t.pessoa || '—')}</td>
      <td><span class="tag ${t.status}">${t.status === 'pago' ? 'pagado' : 'pendiente'}</span></td>
      <td class="num ${t.tipo === 'receita' ? 'pos-text' : t.tipo === 'despesa' ? 'neg-text' : ''}">
        ${t.tipo === 'receita' ? '+' : t.tipo === 'despesa' ? '−' : ''}${fmt(t.valor)}
      </td>
      <td class="actions">
        <button class="btn btn-sm btn-ghost" data-edit="${t.id}" title="Editar">${icon('edit')}</button>
        <button class="btn btn-sm btn-ghost" data-del="${t.id}" title="Eliminar">${icon('trash')}</button>
      </td>
    </tr>`
    )
    .join('');

  return `
    <div class="filters">
      <select id="f-entidade">
        <option value="">Todas las entidades</option>
        <option value="empresa" ${filtros.entidade === 'empresa' ? 'selected' : ''}>Empresa</option>
        <option value="pessoal" ${filtros.entidade === 'pessoal' ? 'selected' : ''}>Personal</option>
      </select>
      <select id="f-tipo">
        <option value="">Todos los tipos</option>
        <option value="receita" ${filtros.tipo === 'receita' ? 'selected' : ''}>Ingresos</option>
        <option value="despesa" ${filtros.tipo === 'despesa' ? 'selected' : ''}>Gastos</option>
        <option value="transferencia" ${filtros.tipo === 'transferencia' ? 'selected' : ''}>Transferencias</option>
      </select>
      <select id="f-status">
        <option value="">Todos los estados</option>
        <option value="pago" ${filtros.status === 'pago' ? 'selected' : ''}>Pagado / cobrado</option>
        <option value="pendente" ${filtros.status === 'pendente' ? 'selected' : ''}>Pendiente</option>
      </select>
      <input id="f-q" class="grow" type="search" placeholder="Buscar por descripción o categoría" value="${esc(filtros.q)}">
      <button class="btn btn-sm" id="f-limpar" type="button">Limpiar</button>
      <a class="btn btn-sm" href="/api/export/lancamentos.csv?mes=${state.mes}">${icon('download')} CSV</a>
    </div>

    <div class="grid g-4" style="margin-bottom:14px">
      <div class="card kpi"><span class="label">Ingresos</span><span class="value sm pos-text">${fmt(r.receitas)}</span></div>
      <div class="card kpi"><span class="label">Gastos</span><span class="value sm neg-text">${fmt(r.despesas)}</span></div>
      <div class="card kpi"><span class="label">Resultado</span><span class="value sm ${r.resultado >= 0 ? 'pos-text' : 'neg-text'}">${fmt(r.resultado)}</span></div>
      <div class="card kpi"><span class="label">Movimientos</span><span class="value sm">${r.qtd}</span><span class="foot">${fmt(r.transferencias)} en transferencias</span></div>
    </div>

    <div class="card">
      <div class="card-head"><h3>${nomeMes(state.mes)}</h3><span class="hint">${r.qtd} registro(s)</span></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Fecha</th><th>Descripción</th><th>Entidad</th><th>Cuenta</th><th>Persona</th><th>Estado</th><th class="num">Valor</th><th></th></tr></thead>
          <tbody>${linhas || '<tr><td colspan="8"><div class="empty"><strong>Ningún movimiento</strong>Ajusta los filtros o crea un movimiento nuevo.</div></td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
}

function afterLancamentos() {
  const recarregar = () => render();
  $('#f-entidade')?.addEventListener('change', (e) => { filtros.entidade = e.target.value; recarregar(); });
  $('#f-tipo')?.addEventListener('change', (e) => { filtros.tipo = e.target.value; recarregar(); });
  $('#f-status')?.addEventListener('change', (e) => { filtros.status = e.target.value; recarregar(); });
  let timer;
  $('#f-q')?.addEventListener('input', (e) => {
    clearTimeout(timer);
    timer = setTimeout(() => { filtros.q = e.target.value; recarregar(); }, 320);
  });
  $('#f-limpar')?.addEventListener('click', () => {
    Object.assign(filtros, { entidade: '', tipo: '', status: '', q: '' });
    recarregar();
  });
  $$('[data-edit]').forEach((b) => b.addEventListener('click', () => abrirFormLancamento(Number(b.dataset.edit))));
  $$('[data-del]').forEach((b) =>
    b.addEventListener('click', async () => {
      if (!confirm('¿Eliminar este movimiento?')) return;
      try {
        await api(`/transactions/${b.dataset.del}`, { method: 'DELETE' });
        toast('Movimiento eliminado');
        render();
      } catch (e) {
        toast(e.message, 'err');
      }
    })
  );
}

async function abrirFormLancamento(id) {
  const atual = id ? await api(`/transactions/${id}`) : null;
  const t = atual || {
    tipo: 'despesa', data: new Date().toISOString().slice(0, 10), valor: '', entidade: 'empresa',
    conta_id: '', conta_destino_id: '', categoria_id: '', pessoa_id: '', descricao: '',
    forma_pagamento: 'pix', status: 'pago', vencimento: '',
  };

  const body = `
    <form id="form-tx" class="stack">
      <div class="seg" id="seg-tipo">
        <button type="button" data-tipo="receita" class="${t.tipo === 'receita' ? 'active receita' : ''}">Ingreso</button>
        <button type="button" data-tipo="despesa" class="${t.tipo === 'despesa' ? 'active despesa' : ''}">Gasto</button>
        <button type="button" data-tipo="transferencia" class="${t.tipo === 'transferencia' ? 'active transferencia' : ''}">Transferencia</button>
      </div>
      <div class="form-grid">
        <div class="field"><label>Fecha</label><input type="date" name="data" value="${t.data}" required></div>
        <div class="field"><label>Valor (R$)</label><input type="number" name="valor" step="0.01" min="0.01" value="${t.valor}" placeholder="0,00" required></div>
        <div class="field"><label>Entidad</label>
          <select name="entidade">
            <option value="empresa" ${t.entidade === 'empresa' ? 'selected' : ''}>Empresa (carpintería)</option>
            <option value="pessoal" ${t.entidade === 'pessoal' ? 'selected' : ''}>Personal (familia)</option>
          </select>
        </div>
        <div class="field"><label id="lbl-cat">Categoría</label><select name="categoria_id" id="sel-cat">${optionsCategorias(t.tipo === 'transferencia' ? 'despesa' : t.tipo, t.entidade, t.categoria_id)}</select></div>
        <div class="field"><label id="lbl-conta">Cuenta</label><select name="conta_id" id="sel-conta">${optionsContas(t.entidade, t.conta_id)}</select></div>
        <div class="field" id="wrap-destino" style="display:${t.tipo === 'transferencia' ? '' : 'none'}">
          <label>Cuenta de destino</label><select name="conta_destino_id" id="sel-destino">${optionsContas('pessoal', t.conta_destino_id)}</select>
        </div>
        <div class="field"><label>Persona</label>
          <select name="pessoa_id"><option value="">—</option>${(state.boot.pessoas || [])
            .map((p) => `<option value="${p.id}" ${String(p.id) === String(t.pessoa_id) ? 'selected' : ''}>${esc(p.nome)}</option>`)
            .join('')}</select>
        </div>
        <div class="field"><label>Forma de pago</label>
          <select name="forma_pagamento">
            ${[['pix', 'Pix'], ['dinheiro', 'Efectivo'], ['debito', 'Débito'], ['credito', 'Crédito'], ['boleto', 'Boleto'], ['transferencia', 'Transferencia']]
              .map(([f, label]) => `<option value="${f}" ${t.forma_pagamento === f ? 'selected' : ''}>${label}</option>`)
              .join('')}
          </select>
        </div>
        <div class="field span-2"><label>Descripción</label><input type="text" name="descricao" maxlength="300" value="${esc(t.descricao || '')}" placeholder="Ej.: Tableros de MDF — proveedor"></div>
        <div class="field"><label>Estado</label>
          <select name="status">
            <option value="pago" ${t.status === 'pago' ? 'selected' : ''}>Pagado / cobrado</option>
            <option value="pendente" ${t.status === 'pendente' ? 'selected' : ''}>Pendiente</option>
          </select>
        </div>
        <div class="field"><label>Vencimiento</label><input type="date" name="vencimento" value="${t.vencimento || ''}"></div>
        <div class="field span-2"><label>Comprobante / factura (foto o PDF)</label><input type="file" name="arquivo" accept="image/*,application/pdf"><span class="help">Opcional. La imagen se guarda junto al movimiento.</span></div>
      </div>
    </form>`;

  openModal({
    titulo: id ? 'Editar movimiento' : 'Nuevo movimiento',
    body,
    footer: `<button class="btn" type="button" data-close>Cancelar</button><button class="btn btn-primary" type="submit" form="form-tx">Guardar</button>`,
    onMount(root) {
      let tipo = t.tipo;
      const form = root.querySelector('#form-tx');
      const syncTipo = () => {
        root.querySelectorAll('#seg-tipo button').forEach((b) => {
          b.className = b.dataset.tipo === tipo ? `active ${tipo}` : '';
        });
        root.querySelector('#wrap-destino').style.display = tipo === 'transferencia' ? '' : 'none';
        root.querySelector('#lbl-cat').textContent = tipo === 'transferencia' ? 'Categoría (opcional)' : 'Categoría';
        const entidade = form.entidade.value;
        root.querySelector('#sel-cat').innerHTML = optionsCategorias(tipo === 'transferencia' ? 'despesa' : tipo, entidade, '');
        root.querySelector('#sel-conta').innerHTML = optionsContas(entidade, '');
        if (tipo === 'transferencia') {
          root.querySelector('#sel-destino').innerHTML = optionsContas(entidade === 'empresa' ? 'pessoal' : 'empresa', '');
        }
      };
      root.querySelectorAll('#seg-tipo button').forEach((b) =>
        b.addEventListener('click', () => {
          tipo = b.dataset.tipo;
          syncTipo();
        })
      );
      form.entidade.addEventListener('change', syncTipo);

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const payload = {
          tipo,
          data: fd.get('data'),
          valor: Number(fd.get('valor')),
          entidade: fd.get('entidade'),
          conta_id: Number(fd.get('conta_id')),
          conta_destino_id: tipo === 'transferencia' ? Number(fd.get('conta_destino_id')) : null,
          categoria_id: fd.get('categoria_id') ? Number(fd.get('categoria_id')) : null,
          pessoa_id: fd.get('pessoa_id') ? Number(fd.get('pessoa_id')) : null,
          descricao: fd.get('descricao'),
          forma_pagamento: fd.get('forma_pagamento'),
          status: fd.get('status'),
          vencimento: fd.get('vencimento') || null,
        };
        try {
          const salvo = id
            ? await api(`/transactions/${id}`, { method: 'PUT', body: payload })
            : await api('/transactions', { method: 'POST', body: payload });
          const arquivo = fd.get('arquivo');
          if (arquivo && arquivo.size) {
            const up = new FormData();
            up.append('arquivo', arquivo);
            up.append('transaction_id', salvo.id);
            await fetch('/api/upload', { method: 'POST', body: up });
          }
          closeModal();
          toast(id ? 'Movimiento actualizado' : 'Movimiento creado');
          render();
        } catch (err) {
          toast(err.message, 'err');
        }
      });
    },
  });
}

/* ---------------- ventas ---------------- */

const filtrosVenda = { tipo: '', status: '' };

const STATUS_VENDA = {
  orcamento: 'Presupuesto',
  aprovado: 'Aprobado',
  producao: 'En producción',
  entregue: 'Entregado',
  pago: 'Pagado',
};

async function renderVendas() {
  const qs = new URLSearchParams({ mes: state.mes });
  if (filtrosVenda.tipo) qs.set('tipo', filtrosVenda.tipo);
  if (filtrosVenda.status) qs.set('status', filtrosVenda.status);
  const d = await api(`/sales?${qs}`);
  const r = d.resumo;
  const ticket = r.qtd ? r.valor / r.qtd : 0;
  const margemPct = r.valor ? (r.margem / r.valor) * 100 : 0;

  const linhas = d.itens
    .map((s) => {
      const margem = s.valor - s.custo;
      return `<tr>
        <td class="nowrap">${fmtDate(s.data)}</td>
        <td><span class="desc">${esc(s.descricao)}</span><div class="meta">${esc(s.cliente || 'Sin cliente')}</div></td>
        <td><span class="tag ${s.tipo}">${s.tipo === 'servico' ? 'servicio' : 'mueble listo'}</span></td>
        <td class="num">${fmt(s.valor)}</td>
        <td class="num muted">${fmt(s.custo)}</td>
        <td class="num ${margem >= 0 ? 'pos-text' : 'neg-text'}">${fmt(margem)}</td>
        <td><span class="tag ${s.status === 'pago' ? 'pago' : 'pendente'}">${STATUS_VENDA[s.status] || s.status}</span></td>
        <td class="actions">
          ${s.status !== 'pago' ? `<button class="btn btn-sm" data-receber="${s.id}" title="Registrar cobro">${icon('check')}</button>` : ''}
          <button class="btn btn-sm btn-ghost" data-editv="${s.id}" title="Editar">${icon('edit')}</button>
          <button class="btn btn-sm btn-ghost" data-delv="${s.id}" title="Eliminar">${icon('trash')}</button>
        </td>
      </tr>`;
    })
    .join('');

  return `
    <div class="grid g-4" style="margin-bottom:14px">
      <div class="card kpi"><span class="label">Facturación</span><span class="value">${fmt(r.valor)}</span><span class="foot">${r.qtd} venta(s) · ${r.servicos} servicio(s) · ${r.produtos} mueble(s)</span></div>
      <div class="card kpi"><span class="label">Costo de materiales</span><span class="value sm">${fmt(r.custo)}</span><span class="foot">${pct(r.valor ? (r.custo / r.valor) * 100 : 0)} de lo facturado</span></div>
      <div class="card kpi pos"><span class="label">Margen bruto</span><span class="value sm">${fmt(r.margem)}</span><span class="foot">${pct(margemPct)} de margen</span></div>
      <div class="card kpi"><span class="label">Ticket promedio</span><span class="value sm">${fmt(ticket)}</span><span class="foot">${fmt(r.recebido)} ya cobrado</span></div>
    </div>

    <div class="filters">
      <select id="v-tipo">
        <option value="">Todos los tipos</option>
        <option value="servico" ${filtrosVenda.tipo === 'servico' ? 'selected' : ''}>Servicios de carpintería</option>
        <option value="produto" ${filtrosVenda.tipo === 'produto' ? 'selected' : ''}>Muebles listos</option>
      </select>
      <select id="v-status">
        <option value="">Todos los estados</option>
        ${Object.entries(STATUS_VENDA).map(([k, v]) => `<option value="${k}" ${filtrosVenda.status === k ? 'selected' : ''}>${v}</option>`).join('')}
      </select>
      <div class="spacer"></div>
      <button class="btn btn-primary btn-sm" id="v-nova" type="button">${icon('plus')} Nueva venta</button>
    </div>

    <div class="card">
      <div class="card-head"><h3>Ventas de ${nomeMes(state.mes)}</h3><span class="hint">${r.qtd} registro(s)</span></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Fecha</th><th>Descripción</th><th>Tipo</th><th class="num">Valor</th><th class="num">Costo</th><th class="num">Margen</th><th>Estado</th><th></th></tr></thead>
          <tbody>${linhas || '<tr><td colspan="8"><div class="empty"><strong>Ninguna venta en el mes</strong>Registra un servicio o la venta de un mueble listo.</div></td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
}

function afterVendas() {
  $('#v-tipo')?.addEventListener('change', (e) => { filtrosVenda.tipo = e.target.value; render(); });
  $('#v-status')?.addEventListener('change', (e) => { filtrosVenda.status = e.target.value; render(); });
  $('#v-nova')?.addEventListener('click', () => abrirFormVenda());
  $$('[data-editv]').forEach((b) => b.addEventListener('click', () => abrirFormVenda(Number(b.dataset.editv))));
  $$('[data-delv]').forEach((b) =>
    b.addEventListener('click', async () => {
      if (!confirm('¿Eliminar esta venta?')) return;
      try {
        await api(`/sales/${b.dataset.delv}`, { method: 'DELETE' });
        toast('Venta eliminada');
        render();
      } catch (e) {
        toast(e.message, 'err');
      }
    })
  );
  $$('[data-receber]').forEach((b) =>
    b.addEventListener('click', async () => {
      try {
        await api(`/sales/${b.dataset.receber}/receber`, { method: 'POST', body: {} });
        toast('Cobro registrado en la cuenta de la empresa');
        render();
      } catch (e) {
        toast(e.message, 'err');
      }
    })
  );
}

async function abrirFormVenda(id) {
  const atual = id ? (await api(`/sales?mes=${state.mes}`)).itens.find((s) => s.id === id) : null;
  const s = atual || {
    data: new Date().toISOString().slice(0, 10), tipo: 'servico', cliente: '', descricao: '',
    valor: '', custo: '', status: 'orcamento', forma_pagamento: 'pix', observacoes: '',
  };
  openModal({
    titulo: id ? 'Editar venta' : 'Nueva venta',
    body: `
      <form id="form-venda" class="form-grid">
        <div class="field"><label>Fecha</label><input type="date" name="data" value="${s.data}" required></div>
        <div class="field"><label>Tipo</label>
          <select name="tipo">
            <option value="servico" ${s.tipo === 'servico' ? 'selected' : ''}>Servicio de carpintería (a medida)</option>
            <option value="produto" ${s.tipo === 'produto' ? 'selected' : ''}>Mueble listo (reventa)</option>
          </select>
        </div>
        <div class="field span-2"><label>Descripción</label><input type="text" name="descricao" value="${esc(s.descricao)}" placeholder="Ej.: Cocina a medida" required></div>
        <div class="field"><label>Cliente</label><input type="text" name="cliente" value="${esc(s.cliente || '')}" placeholder="Nombre u origen"></div>
        <div class="field"><label>Estado</label>
          <select name="status">${Object.entries(STATUS_VENDA).map(([k, v]) => `<option value="${k}" ${s.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
        </div>
        <div class="field"><label>Valor cobrado (R$)</label><input type="number" name="valor" step="0.01" min="0" value="${s.valor}" required></div>
        <div class="field"><label>Costo de material (R$)</label><input type="number" name="custo" step="0.01" min="0" value="${s.custo}"></div>
        <div class="field"><label>Forma de pago</label>
          <select name="forma_pagamento">${[['pix', 'Pix'], ['dinheiro', 'Efectivo'], ['debito', 'Débito'], ['credito', 'Crédito'], ['boleto', 'Boleto'], ['transferencia', 'Transferencia']]
            .map(([f, label]) => `<option value="${f}" ${s.forma_pagamento === f ? 'selected' : ''}>${label}</option>`).join('')}</select>
        </div>
        <div class="field span-2"><label>Observaciones</label><textarea name="observacoes" placeholder="Plazo de entrega, medidas, acuerdos...">${esc(s.observacoes || '')}</textarea></div>
      </form>`,
    footer: `<button class="btn" type="button" data-close>Cancelar</button><button class="btn btn-primary" type="submit" form="form-venda">Guardar</button>`,
    onMount(root) {
      root.querySelector('#form-venda').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const payload = Object.fromEntries(fd.entries());
        payload.valor = Number(payload.valor);
        payload.custo = Number(payload.custo) || 0;
        try {
          if (id) await api(`/sales/${id}`, { method: 'PUT', body: payload });
          else await api('/sales', { method: 'POST', body: payload });
          closeModal();
          toast(id ? 'Venta actualizada' : 'Venta registrada');
          render();
        } catch (err) {
          toast(err.message, 'err');
        }
      });
    },
  });
}

/* ---------------- balance ---------------- */

async function renderBalanco() {
  const b = await api(`/balanco?mes=${state.mes}`);
  const e = b.empresa;
  const p = b.pessoal;
  const c = b.consolidado;

  const cardEntidade = (titulo, dados, anterior, classe, nota) => `
    <div class="card entity-card ${classe}">
      <div class="card-head"><h3>${titulo}</h3>${deltaTag(dados.resultado, anterior.resultado)}</div>
      <div class="stack" style="gap:8px">
        <div class="row between"><span class="muted">Ingresos</span><strong class="pos-text">${fmt(dados.receitas)}</strong></div>
        <div class="row between"><span class="muted">Gastos</span><strong class="neg-text">${fmt(dados.despesas)}</strong></div>
        <div class="divider" style="margin:4px 0"></div>
        <div class="row between"><span><strong>Resultado</strong></span><strong class="${dados.resultado >= 0 ? 'pos-text' : 'neg-text'}" style="font-size:17px">${fmt(dados.resultado)}</strong></div>
        <div class="row between"><span class="muted" style="font-size:11.5px">${nota}</span><span class="muted" style="font-size:11.5px">${dados.lancamentos} movimientos</span></div>
      </div>
    </div>`;

  const grupos = {};
  for (const cat of b.categorias) {
    const key = `${cat.tipo}|${cat.grupo || 'Otros'}`;
    grupos[key] ||= { tipo: cat.tipo, grupo: cat.grupo || 'Otros', empresa: 0, pessoal: 0 };
    grupos[key][cat.entidade] += cat.total;
  }
  const lista = Object.values(grupos);
  const receitasG = lista.filter((g) => g.tipo === 'receita');
  const despesasG = lista.filter((g) => g.tipo === 'despesa');
  const linhaGrupo = (g) => `<tr class="grupo"><td>${esc(g.grupo)}</td><td class="num">${g.empresa ? fmt(g.empresa) : '—'}</td><td class="num">${g.pessoal ? fmt(g.pessoal) : '—'}</td><td class="num">${fmt(g.empresa + g.pessoal)}</td></tr>`;

  const dre = `
    <table class="dre">
      <thead><tr><th>Grupo</th><th class="num">Empresa</th><th class="num">Personal</th><th class="num">Total</th></tr></thead>
      <tbody>
        <tr class="grupo"><td colspan="4">Ingresos</td></tr>
        ${receitasG.map(linhaGrupo).join('') || '<tr><td colspan="4" class="muted">Sin ingresos</td></tr>'}
        <tr class="total"><td>Total de ingresos</td><td class="num">${fmt(e.receitas)}</td><td class="num">${fmt(p.receitas)}</td><td class="num">${fmt(c.receitas)}</td></tr>
        <tr class="grupo"><td colspan="4">Gastos</td></tr>
        ${despesasG.map(linhaGrupo).join('') || '<tr><td colspan="4" class="muted">Sin gastos</td></tr>'}
        <tr class="total"><td>Total de gastos</td><td class="num">${fmt(e.despesas)}</td><td class="num">${fmt(p.despesas)}</td><td class="num">${fmt(c.despesas)}</td></tr>
        <tr class="total"><td>Resultado del mes</td><td class="num ${e.resultado >= 0 ? 'pos-text' : 'neg-text'}">${fmt(e.resultado)}</td><td class="num ${p.resultado >= 0 ? 'pos-text' : 'neg-text'}">${fmt(p.resultado)}</td><td class="num ${c.resultado >= 0 ? 'pos-text' : 'neg-text'}">${fmt(c.resultado)}</td></tr>
      </tbody>
    </table>`;

  const retiradas = b.retiradas
    .map(
      (r) => `<tr><td class="nowrap">${fmtDate(r.data)}</td><td>${esc(r.descricao || 'Retiro')}</td>
        <td class="muted nowrap">${esc(r.origem || '')} → ${esc(r.destino || '')}</td><td class="num">${fmt(r.valor)}</td></tr>`
    )
    .join('');

  const pessoas = b.por_pessoa
    .map(
      (p2) => `<tr>
        <td><span class="dotcat" style="background:${p2.cor || '#0f766e'};margin-right:6px"></span>${esc(p2.nome)}</td>
        <td class="num pos-text">${fmt(p2.receitas)}</td>
        <td class="num neg-text">${fmt(p2.despesas)}</td>
        <td class="num">${p2.lancamentos}</td>
      </tr>`
    )
    .join('');

  return `
    <div class="filters no-print">
      <span class="hint">Cierre de ${nomeMes(state.mes)} · comparado con ${nomeMes(b.mes_anterior)}</span>
      <div class="spacer"></div>
      <a class="btn btn-sm" href="/api/export/balanco.csv?mes=${state.mes}">${icon('download')} CSV</a>
      <button class="btn btn-sm" id="btn-print" type="button">${icon('print')} Imprimir</button>
    </div>

    <div class="grid g-3">
      ${cardEntidade('Empresa — carpintería', e, b.empresa_anterior, '', `Retiros: ${fmt(b.retiradas_total)}`)}
      ${cardEntidade('Personal — familia', p, b.pessoal_anterior, 'pessoal', 'Cubierto por los retiros')}
      <div class="card entity-card" style="border-left-color:#1d4ed8">
        <div class="card-head"><h3>Consolidado</h3><span class="hint">sin transferencias</span></div>
        <div class="stack" style="gap:8px">
          <div class="row between"><span class="muted">Ingresos</span><strong class="pos-text">${fmt(c.receitas)}</strong></div>
          <div class="row between"><span class="muted">Gastos</span><strong class="neg-text">${fmt(c.despesas)}</strong></div>
          <div class="divider" style="margin:4px 0"></div>
          <div class="row between"><span><strong>Sobrante del mes</strong></span><strong class="${c.resultado >= 0 ? 'pos-text' : 'neg-text'}" style="font-size:17px">${fmt(c.resultado)}</strong></div>
          <div class="row between"><span class="muted" style="font-size:11.5px">Saldo en cuentas al cierre del mes</span><strong style="font-size:12.5px">${fmt(b.saldo_fim_mes)}</strong></div>
        </div>
      </div>
    </div>

    <div class="grid g-23" style="margin-top:14px">
      <div class="card">
        <div class="card-head"><h3>Estado de resultados simplificado</h3><span class="hint">por grupo de categoría</span></div>
        <div class="table-wrap">${dre}</div>
      </div>
      <div class="stack">
        <div class="card">
          <div class="card-head"><h3>Retiros de los socios</h3><span class="hint">${fmt(b.retiradas_total)}</span></div>
          <div class="table-wrap"><table><tbody>${retiradas || '<tr><td class="empty">Ningún retiro en el mes</td></tr>'}</tbody></table></div>
        </div>
        <div class="card">
          <div class="card-head"><h3>Por persona</h3><span class="hint">quién registró</span></div>
          <div class="table-wrap"><table>
            <thead><tr><th>Persona</th><th class="num">Ingresos</th><th class="num">Gastos</th><th class="num">Mov.</th></tr></thead>
            <tbody>${pessoas}</tbody>
          </table></div>
        </div>
      </div>
    </div>`;
}

function afterBalanco() {
  $('#btn-print')?.addEventListener('click', () => window.print());
}

/* ---------------- cuentas y categorías ---------------- */

async function renderContas() {
  const [contas, cats, pessoas, cfg] = await Promise.all([
    api('/accounts'),
    api('/categories'),
    api('/people'),
    api('/settings'),
  ]);

  const linhasContas = contas
    .map(
      (c) => `<tr>
      <td><span class="desc">${esc(c.nome)}</span></td>
      <td><span class="tag ${c.entidade}">${c.entidade === 'pessoal' ? 'personal' : 'empresa'}</span></td>
      <td class="muted">${c.tipo === 'caixa' ? 'Caja' : c.tipo === 'banco' ? 'Banco' : c.tipo === 'cartao' ? 'Tarjeta' : 'Inversión'}</td>
      <td class="num">${fmt(c.saldo_inicial)}</td>
      <td class="num ${c.saldo < 0 ? 'neg-text' : 'pos-text'}">${fmt(c.saldo)}</td>
      <td class="actions">
        <button class="btn btn-sm btn-ghost" data-editc="${c.id}">${icon('edit')}</button>
        <button class="btn btn-sm btn-ghost" data-delc="${c.id}">${icon('trash')}</button>
      </td>
    </tr>`
    )
    .join('');

  const blocoCats = (entidade, tipo, titulo) => {
    const lista = cats.filter((c) => c.tipo === tipo && (c.entidade === entidade || c.entidade === 'ambas'));
    const grupos = {};
    for (const c of lista) (grupos[c.grupo || 'Otros'] ||= []).push(c);
    return `<div class="card">
      <div class="card-head"><h3>${titulo}</h3><button class="btn btn-sm" data-newcat="${tipo}|${entidade}">${icon('plus')} Nueva</button></div>
      <div class="stack" style="gap:12px">
        ${Object.entries(grupos)
          .map(
            ([g, items]) => `<div>
              <div class="section-title" style="margin-bottom:6px">${esc(g)}</div>
              <div class="stack" style="gap:4px">
                ${items
                  .map(
                    (c) => `<div class="row between" style="padding:3px 0">
                      <span class="row" style="gap:7px"><i class="dotcat" style="background:${c.cor || '#94a3b8'}"></i>${esc(c.nome)}
                        ${c.entidade === 'ambas' ? '<span class="tag" style="font-size:10px">ambas</span>' : ''}</span>
                      <span class="row" style="gap:2px">
                        <button class="btn btn-sm btn-ghost" data-editcat="${c.id}">${icon('edit')}</button>
                        <button class="btn btn-sm btn-ghost" data-delcat="${c.id}">${icon('trash')}</button>
                      </span>
                    </div>`
                  )
                  .join('')}
              </div>
            </div>`
          )
          .join('') || '<div class="empty">Ninguna categoría</div>'}
      </div>
    </div>`;
  };

  return `
    <div class="grid g-23">
      <div class="card">
        <div class="card-head"><h3>Cuentas</h3><button class="btn btn-sm" id="nova-conta">${icon('plus')} Nueva cuenta</button></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Cuenta</th><th>Entidad</th><th>Tipo</th><th class="num">Saldo inicial</th><th class="num">Saldo actual</th><th></th></tr></thead>
            <tbody>${linhasContas}</tbody>
          </table>
        </div>
        <p class="card-sub" style="margin:12px 0 0">El saldo actual considera saldo inicial + ingresos − gastos − transferencias enviadas + transferencias recibidas.</p>
      </div>

      <div class="stack">
        <div class="card">
          <div class="card-head"><h3>Identidad</h3></div>
          <div class="stack">
            <div class="field"><label>Nombre del negocio</label><input id="cfg-empresa" value="${esc(cfg.empresa_nome || 'Carpintería')}"></div>
            ${pessoas
              .map(
                (p) => `<div class="form-grid">
                  <div class="field"><label>Socio/a</label><input data-pessoa="${p.id}" data-campo="nome" value="${esc(p.nome)}"></div>
                  <div class="field"><label>Rol</label><input data-pessoa="${p.id}" data-campo="papel" value="${esc(p.papel || '')}"></div>
                </div>`
              )
              .join('')}
            <button class="btn btn-primary btn-sm" id="salvar-identidade" type="button">Guardar</button>
          </div>
        </div>
        <div class="card">
          <div class="card-head"><h3>Resumen</h3></div>
          <div class="stack" style="gap:6px">
            <div class="row between"><span class="muted">Cuentas activas</span><strong>${contas.length}</strong></div>
            <div class="row between"><span class="muted">Categorías</span><strong>${cats.length}</strong></div>
            <div class="row between"><span class="muted">Saldo total</span><strong>${fmt(contas.reduce((s, c) => s + c.saldo, 0))}</strong></div>
          </div>
        </div>
        <div class="card">
          <div class="card-head"><h3>Respaldo</h3><span class="hint">copia de seguridad</span></div>
          <div class="stack">
            <p class="card-sub" style="margin:0">Descarga todos los movimientos, ventas, cuentas y mensajes en un archivo JSON. Guárdalo fuera del servidor.</p>
            <a class="btn btn-sm" href="/api/export/backup.json">${icon('download')} Descargar respaldo</a>
          </div>
        </div>
        <div class="card">
          <div class="card-head"><h3>Seguridad</h3><span class="hint">acceso al sistema</span></div>
          <div class="stack">
            <div class="field"><label>Contraseña actual</label><input type="password" id="senha-atual" autocomplete="current-password"></div>
            <div class="field"><label>Contraseña nueva</label><input type="password" id="senha-nova" autocomplete="new-password"><span class="help">Mínimo 6 caracteres. Compártela solo con quien deba ver las cuentas.</span></div>
            <button class="btn btn-primary btn-sm" id="salvar-senha" type="button">Cambiar contraseña</button>
          </div>
        </div>
      </div>
    </div>

    <div class="grid g-2" style="margin-top:14px">
      ${blocoCats('empresa', 'receita', 'Ingresos de la empresa')}
      ${blocoCats('empresa', 'despesa', 'Gastos de la empresa')}
      ${blocoCats('pessoal', 'receita', 'Ingresos personales')}
      ${blocoCats('pessoal', 'despesa', 'Gastos personales')}
    </div>`;
}

function afterContas() {
  $('#nova-conta')?.addEventListener('click', () => abrirFormConta());
  $$('[data-editc]').forEach((b) => b.addEventListener('click', () => abrirFormConta(Number(b.dataset.editc))));
  $$('[data-delc]').forEach((b) =>
    b.addEventListener('click', async () => {
      if (!confirm('¿Eliminar esta cuenta?')) return;
      try {
        await api(`/accounts/${b.dataset.delc}`, { method: 'DELETE' });
        toast('Cuenta eliminada');
        await carregarBoot();
        render();
      } catch (e) {
        toast(e.message, 'err');
      }
    })
  );
  $$('[data-newcat]').forEach((b) =>
    b.addEventListener('click', () => {
      const [tipo, entidade] = b.dataset.newcat.split('|');
      abrirFormCategoria(null, tipo, entidade);
    })
  );
  $$('[data-editcat]').forEach((b) => b.addEventListener('click', () => abrirFormCategoria(Number(b.dataset.editcat))));
  $$('[data-delcat]').forEach((b) =>
    b.addEventListener('click', async () => {
      if (!confirm('¿Eliminar esta categoría?')) return;
      try {
        await api(`/categories/${b.dataset.delcat}`, { method: 'DELETE' });
        toast('Categoría eliminada');
        await carregarBoot();
        render();
      } catch (e) {
        toast(e.message, 'err');
      }
    })
  );
  $('#salvar-senha')?.addEventListener('click', async () => {
    try {
      await api('/password', {
        method: 'PUT',
        body: { atual: $('#senha-atual').value, nova: $('#senha-nova').value },
      });
      $('#senha-atual').value = '';
      $('#senha-nova').value = '';
      toast('Contraseña actualizada');
    } catch (e) {
      toast(e.message, 'err');
    }
  });
  $('#salvar-identidade')?.addEventListener('click', async () => {
    try {
      await api('/settings', { method: 'PUT', body: { empresa_nome: $('#cfg-empresa').value } });
      for (const inp of $$('[data-pessoa]')) {
        const id = inp.dataset.pessoa;
        const nome = $(`[data-pessoa="${id}"][data-campo="nome"]`).value;
        const papel = $(`[data-pessoa="${id}"][data-campo="papel"]`).value;
        await api(`/people/${id}`, { method: 'PUT', body: { nome, papel } });
      }
      await carregarBoot();
      toast('Configuración guardada');
      render();
    } catch (e) {
      toast(e.message, 'err');
    }
  });
}

async function abrirFormConta(id) {
  const contas = await api('/accounts');
  const c = id ? contas.find((x) => x.id === id) : { nome: '', tipo: 'caixa', entidade: 'empresa', saldo_inicial: 0 };
  openModal({
    titulo: id ? 'Editar cuenta' : 'Nueva cuenta',
    body: `<form id="form-conta" class="form-grid">
      <div class="field span-2"><label>Nombre</label><input name="nome" value="${esc(c.nome)}" placeholder="Ej.: Cuenta de la empresa" required></div>
      <div class="field"><label>Tipo</label><select name="tipo">
        ${[['caixa', 'Caja'], ['banco', 'Banco'], ['cartao', 'Tarjeta'], ['investimento', 'Inversión']].map(([t, label]) => `<option value="${t}" ${c.tipo === t ? 'selected' : ''}>${label}</option>`).join('')}
      </select></div>
      <div class="field"><label>Entidad</label><select name="entidade">
        <option value="empresa" ${c.entidade === 'empresa' ? 'selected' : ''}>Empresa</option>
        <option value="pessoal" ${c.entidade === 'pessoal' ? 'selected' : ''}>Personal</option>
      </select></div>
      <div class="field"><label>Saldo inicial (R$)</label><input type="number" name="saldo_inicial" step="0.01" value="${c.saldo_inicial}"></div>
    </form>`,
    footer: `<button class="btn" type="button" data-close>Cancelar</button><button class="btn btn-primary" type="submit" form="form-conta">Guardar</button>`,
    onMount(root) {
      root.querySelector('#form-conta').addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = Object.fromEntries(new FormData(e.target).entries());
        payload.saldo_inicial = Number(payload.saldo_inicial) || 0;
        try {
          if (id) await api(`/accounts/${id}`, { method: 'PUT', body: payload });
          else await api('/accounts', { method: 'POST', body: payload });
          closeModal();
          await carregarBoot();
          toast('Cuenta guardada');
          render();
        } catch (err) {
          toast(err.message, 'err');
        }
      });
    },
  });
}

async function abrirFormCategoria(id, tipoInicial, entidadeInicial) {
  const cats = await api('/categories');
  const c = id ? cats.find((x) => x.id === id) : { nome: '', tipo: tipoInicial || 'despesa', entidade: entidadeInicial || 'empresa', grupo: '', cor: '#0f766e' };
  openModal({
    titulo: id ? 'Editar categoría' : 'Nueva categoría',
    body: `<form id="form-cat" class="form-grid">
      <div class="field span-2"><label>Nombre</label><input name="nome" value="${esc(c.nome)}" required></div>
      <div class="field"><label>Tipo</label><select name="tipo">
        <option value="receita" ${c.tipo === 'receita' ? 'selected' : ''}>Ingreso</option>
        <option value="despesa" ${c.tipo === 'despesa' ? 'selected' : ''}>Gasto</option>
      </select></div>
      <div class="field"><label>Entidad</label><select name="entidade">
        <option value="empresa" ${c.entidade === 'empresa' ? 'selected' : ''}>Empresa</option>
        <option value="pessoal" ${c.entidade === 'pessoal' ? 'selected' : ''}>Personal</option>
        <option value="ambas" ${c.entidade === 'ambas' ? 'selected' : ''}>Ambas</option>
      </select></div>
      <div class="field"><label>Grupo</label><input name="grupo" value="${esc(c.grupo || '')}" placeholder="Ej.: Costos de producción"></div>
      <div class="field"><label>Color</label><input type="color" name="cor" value="${c.cor || '#0f766e'}" style="height:38px;padding:3px"></div>
    </form>`,
    footer: `<button class="btn" type="button" data-close>Cancelar</button><button class="btn btn-primary" type="submit" form="form-cat">Guardar</button>`,
    onMount(root) {
      root.querySelector('#form-cat').addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = Object.fromEntries(new FormData(e.target).entries());
        try {
          if (id) await api(`/categories/${id}`, { method: 'PUT', body: payload });
          else await api('/categories', { method: 'POST', body: payload });
          closeModal();
          await carregarBoot();
          toast('Categoría guardada');
          render();
        } catch (err) {
          toast(err.message, 'err');
        }
      });
    },
  });
}

/* ---------------- whatsapp ---------------- */

function valorDoTexto(txt) {
  const m = String(txt || '').match(/R\$\s*([\d.]+)(?:,(\d{2}))?/i);
  if (!m) return '';
  const inteiro = m[1].replace(/\./g, '');
  return `${inteiro}${m[2] ? '.' + m[2] : ''}`;
}

async function renderWhatsapp() {
  const d = await api('/whatsapp');
  const conectado = d.status === 'conectado';
  const webhook = `${location.origin}/api/whatsapp/webhook${d.webhook_token ? `?token=${d.webhook_token}` : ''}`;

  const mensagens = d.mensagens
    .map((m) => {
      const iniciais = (m.remetente || '?').slice(0, 2).toUpperCase();
      const midia =
        m.tipo === 'imagem' && m.media_path
          ? `<img src="/uploads/${esc(m.media_path)}" alt="${esc(m.conteudo || 'comprobante')}" loading="lazy">`
          : m.tipo === 'audio' && m.media_path
          ? `<audio controls preload="none" src="/uploads/${esc(m.media_path)}"></audio>`
          : m.tipo === 'documento' && m.media_path
          ? `<a href="/uploads/${esc(m.media_path)}" target="_blank" rel="noopener">Abrir documento</a>`
          : '';
      const vinculo = m.transaction_id
        ? `<span class="wa-linked">${icon('link')} ${esc(m.tx_descricao || 'movimiento')} · ${fmt(m.tx_valor)}</span>`
        : m.direcao === 'entrada'
        ? `<button class="btn btn-sm" data-vincular="${m.id}">${icon('plus')} Crear movimiento</button>`
        : '';
      return `<div class="wa-msg ${m.direcao}">
        <div class="wa-avatar">${esc(iniciais)}</div>
        <div class="wa-bubble">
          <div class="who">${esc(m.remetente || 'WhatsApp')}
            <span class="tag" style="font-size:10px">${m.tipo === 'texto' ? 'texto' : m.tipo === 'audio' ? 'audio' : m.tipo === 'imagem' ? 'imagen' : 'documento'}</span>
            ${m.entidade ? `<span class="tag ${m.entidade}" style="font-size:10px">${m.entidade === 'pessoal' ? 'personal' : 'empresa'}</span>` : ''}
          </div>
          ${m.conteudo ? `<div class="txt">${esc(m.conteudo)}</div>` : ''}
          ${midia}
          <div class="time">${fmtHora(m.enviado_em)}</div>
          <div class="wa-link">${vinculo}</div>
        </div>
      </div>`;
    })
    .join('');

  return `
    <div class="grid g-23">
      <div class="card">
        <div class="card-head">
          <h3>Bandeja de entrada</h3>
          <div class="row" style="gap:6px">
            <span class="hint">${d.mensagens.length} mensaje(s)</span>
            <button class="btn btn-sm" id="wa-simular" type="button">${icon('plus')} Simular</button>
            <button class="btn btn-sm btn-ghost" id="wa-refresh" type="button">${icon('refresh')}</button>
          </div>
        </div>
        <div class="wa-list">${mensagens || '<div class="empty"><strong>Ningún mensaje</strong>Cuando WhatsApp esté conectado, los mensajes aparecen aquí.</div>'}</div>
      </div>

      <div class="stack">
        <div class="card conn-card">
          <div class="card-head">
            <h3>Conexión de WhatsApp</h3>
            <span class="tag ${conectado ? 'pago' : 'pendente'}">${conectado ? 'conectado' : 'no conectado'}</span>
          </div>
          <p class="hint" style="margin:0 0 12px;font-size:12px">
            ${conectado
              ? `Número ${esc(d.numero || '—')} vía ${esc(d.provider || 'proveedor')}.`
              : 'La estructura de recepción ya está lista. Falta indicar el número y el proveedor cuando tengas el teléfono a mano.'}
          </p>
          <div class="stack" style="gap:10px">
            <div class="field"><label>Número de WhatsApp</label><input id="wa-numero" value="${esc(d.numero || '')}" placeholder="+55 11 90000-0000"></div>
            <div class="field"><label>Proveedor</label>
              <select id="wa-provider">
                <option value="">Seleccione…</option>
                ${['Meta Cloud API', 'Evolution API', 'Z-API', 'Twilio'].map((p) => `<option value="${p}" ${d.provider === p ? 'selected' : ''}>${p}</option>`).join('')}
              </select>
            </div>
            <div class="field"><label>Token del webhook</label><input id="wa-token" value="${esc(d.webhook_token || '')}" placeholder="define un token secreto"></div>
            <div class="field"><label>URL para recibir mensajes</label>
              <code>${esc(webhook)}</code>
              <span class="help" style="color:#8fb0a7">Dirección local. Para recibir desde WhatsApp de verdad hay que exponer esta URL en internet.</span>
            </div>
            <button class="btn btn-primary btn-sm" id="wa-salvar" type="button">Guardar conexión</button>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h3>Cómo conectar después</h3></div>
          <ol class="steps-list">
            <li><strong>Elige el proveedor</strong> — Meta Cloud API (oficial) o Evolution API / Z-API (más simple para un número común).</li>
            <li><strong>Indica el número</strong> y el token del proveedor en la pantalla de arriba.</li>
            <li><strong>Apunta el webhook</strong> del proveedor a la URL generada aquí.</li>
            <li><strong>Listo:</strong> cada mensaje, audio o foto de factura cae en esta bandeja y puede convertirse en movimiento con un clic.</li>
          </ol>
          <p class="card-sub" style="margin:12px 0 0">Mientras tanto, usa «Simular» para probar el flujo de recepción y vinculación.</p>
        </div>
      </div>
    </div>`;
}

function afterWhatsapp() {
  $('#wa-refresh')?.addEventListener('click', () => render());
  $('#wa-salvar')?.addEventListener('click', async () => {
    try {
      await api('/settings', {
        method: 'PUT',
        body: {
          whatsapp_numero: $('#wa-numero').value,
          whatsapp_provider: $('#wa-provider').value,
          whatsapp_webhook_token: $('#wa-token').value,
          whatsapp_status: $('#wa-numero').value ? 'configurado' : 'desconectado',
        },
      });
      await carregarBoot();
      toast('Conexión guardada');
      render();
    } catch (e) {
      toast(e.message, 'err');
    }
  });
  $('#wa-simular')?.addEventListener('click', abrirSimularWhatsapp);
  $$('[data-vincular]').forEach((b) => b.addEventListener('click', () => abrirVincular(Number(b.dataset.vincular))));
}

async function abrirSimularWhatsapp() {
  openModal({
    titulo: 'Simular mensaje recibido',
    body: `<form id="form-sim" class="form-grid">
      <div class="field"><label>Remitente</label><input name="remetente" value="Socio" required></div>
      <div class="field"><label>Tipo</label><select name="tipo">
        <option value="texto">Texto</option><option value="audio">Audio</option><option value="imagem">Imagen</option>
      </select></div>
      <div class="field span-2"><label>Contenido</label><textarea name="conteudo" placeholder="Ej.: Pagué R$ 180 de flete en efectivo"></textarea></div>
      <div class="field span-2"><label>Archivo (opcional)</label><input type="file" name="arquivo" accept="image/*,audio/*"></div>
    </form>`,
    footer: `<button class="btn" type="button" data-close>Cancelar</button><button class="btn btn-primary" type="submit" form="form-sim">Enviar</button>`,
    onMount(root) {
      root.querySelector('#form-sim').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        try {
          const msg = await api('/whatsapp/simular', {
            method: 'POST',
            body: { remetente: fd.get('remetente'), tipo: fd.get('tipo'), conteudo: fd.get('conteudo') },
          });
          const arquivo = fd.get('arquivo');
          if (arquivo && arquivo.size) {
            const up = new FormData();
            up.append('arquivo', arquivo);
            const att = await fetch('/api/upload', { method: 'POST', body: up }).then((r) => r.json());
            await api(`/whatsapp/${msg.id}/midia`, { method: 'POST', body: { media_path: att.caminho, mimetype: att.mimetype } }).catch(() => {});
          }
          closeModal();
          toast('Mensaje simulado');
          render();
        } catch (err) {
          toast(err.message, 'err');
        }
      });
    },
  });
}

async function abrirVincular(id) {
  const d = await api('/whatsapp');
  const msg = d.mensagens.find((m) => m.id === id);
  const valor = valorDoTexto(msg?.conteudo);
  const hoje = new Date().toISOString().slice(0, 10);
  openModal({
    titulo: 'Crear movimiento a partir del mensaje',
    body: `
      <div class="card" style="background:var(--surface-2);box-shadow:none;margin-bottom:14px">
        <div class="meta" style="font-size:11.5px;color:var(--muted)">${esc(msg?.remetente || '')} · ${fmtHora(msg?.enviado_em)}</div>
        <div style="font-size:13px;margin-top:4px">${esc(msg?.conteudo || '(sin texto)')}</div>
        ${msg?.media_path ? `<img src="/uploads/${esc(msg.media_path)}" style="max-width:100%;border-radius:8px;margin-top:8px;border:1px solid var(--line)">` : ''}
      </div>
      <form id="form-vinc" class="form-grid">
        <div class="field"><label>Tipo</label><select name="tipo" id="v-tipo">
          <option value="despesa">Gasto</option><option value="receita">Ingreso</option>
        </select></div>
        <div class="field"><label>Valor (R$)</label><input type="number" name="valor" step="0.01" min="0.01" value="${valor}" required></div>
        <div class="field"><label>Fecha</label><input type="date" name="data" value="${hoje}" required></div>
        <div class="field"><label>Entidad</label><select name="entidade" id="v-ent">
          <option value="empresa">Empresa</option><option value="pessoal">Personal</option>
        </select></div>
        <div class="field"><label>Cuenta</label><select name="conta_id" id="v-conta">${optionsContas('empresa', '')}</select></div>
        <div class="field"><label>Categoría</label><select name="categoria_id" id="v-cat">${optionsCategorias('despesa', 'empresa', '')}</select></div>
        <div class="field span-2"><label>Descripción</label><input name="descricao" value="${esc(msg?.conteudo || '')}"></div>
      </form>`,
    footer: `<button class="btn" type="button" data-close>Cancelar</button><button class="btn btn-primary" type="submit" form="form-vinc">Registrar</button>`,
    onMount(root) {
      const sync = () => {
        const tipo = root.querySelector('#v-tipo').value;
        const ent = root.querySelector('#v-ent').value;
        root.querySelector('#v-conta').innerHTML = optionsContas(ent, '');
        root.querySelector('#v-cat').innerHTML = optionsCategorias(tipo, ent, '');
      };
      root.querySelector('#v-tipo').addEventListener('change', sync);
      root.querySelector('#v-ent').addEventListener('change', sync);
      root.querySelector('#form-vinc').addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = Object.fromEntries(new FormData(e.target).entries());
        payload.valor = Number(payload.valor);
        payload.conta_id = Number(payload.conta_id);
        payload.categoria_id = payload.categoria_id ? Number(payload.categoria_id) : null;
        try {
          await api(`/whatsapp/${id}/vincular`, { method: 'POST', body: payload });
          closeModal();
          toast('Movimiento creado a partir del mensaje');
          render();
        } catch (err) {
          toast(err.message, 'err');
        }
      });
    },
  });
}

/* ---------------- arranque ---------------- */

async function carregarBoot() {
  state.boot = await api('/bootstrap');
  if (!state.mes) state.mes = state.boot.mes_atual;
  $('#brand-nome').textContent = state.boot.empresa_nome || 'Carpintería';
  const wa = state.boot.whatsapp || {};
  const conectado = wa.status === 'conectado';
  $('#wa-status').textContent = conectado ? 'Conectado' : wa.status === 'configurado' ? 'Configurado' : 'Desconectado';
  $('#wa-dot').className = `dot ${conectado ? 'on' : ''}`;
}

function mudarMes(delta) {
  const [ano, mm] = state.mes.split('-').map(Number);
  const d = new Date(ano, mm - 1 + delta, 1);
  state.mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  render();
}

async function iniciar() {
  await carregarBoot();
  $('#mes-input').value = state.mes;
  $('#mes-input').addEventListener('change', (e) => {
    if (e.target.value) {
      state.mes = e.target.value;
      render();
    }
  });
  $('#mes-prev').addEventListener('click', () => mudarMes(-1));
  $('#mes-next').addEventListener('click', () => mudarMes(1));
  $('#btn-novo').addEventListener('click', () => abrirFormLancamento());
  $('#btn-sair').addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' }).catch(() => {});
    location.replace('/login');
  });
  window.addEventListener('hashchange', render);
  await render();
}

const AFTER = {
  lancamentos: afterLancamentos,
  vendas: afterVendas,
  balanco: afterBalanco,
  contas: afterContas,
  whatsapp: afterWhatsapp,
};

iniciar();
