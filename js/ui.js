/* PARTIU? — componentes de interface reutilizáveis (DOM sem innerHTML: nada vindo dos dados vira HTML).
   Foto, etiqueta de estado, barra de progresso, toast e diálogo vivem aqui para que a mesma função
   desempenhe sempre o mesmo visual. */
(() => {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';

  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function icon(id, cls) {
    const s = document.createElementNS(NS, 'svg'); s.setAttribute('class', 'icon' + (cls ? ' ' + cls : '')); s.setAttribute('aria-hidden', 'true');
    const u = document.createElementNS(NS, 'use'); u.setAttribute('href', '#' + id); s.append(u); return s;
  }
  function button(text, cls, fn, iconId) {
    const b = el('button', cls); b.type = 'button';
    if (iconId) b.append(icon(iconId));
    b.append(document.createTextNode(text));
    if (fn) b.addEventListener('click', fn);
    return b;
  }
  function link(text, href, cls, iconId) {
    const a = el('a', cls); a.href = href;
    a.append(document.createTextNode(text));
    if (iconId) a.append(icon(iconId));
    return a;
  }
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  function barra(valor, rotulo, cls) {
    const b = el('div', 'bar' + (cls ? ' ' + cls : '')); b.setAttribute('role', 'progressbar');
    b.setAttribute('aria-label', rotulo); b.setAttribute('aria-valuemin', '0'); b.setAttribute('aria-valuemax', '100');
    b.setAttribute('aria-valuenow', String(Math.round(valor))); b.style.setProperty('--value', valor + '%'); b.append(el('i')); return b;
  }
  function limpar(node) { node.replaceChildren(); return node; }
  const plural = (n, s, p) => n + ' ' + (n === 1 ? s : p);

  // ---------- imagem ----------
  // Aceita 'assets/img/x.jpg' ou { src, alt, credito, licenca, fonte }. Só caminhos locais ou https.
  function imagemInfo(item) {
    const im = item && item.imagem; if (!im) return null;
    const o = typeof im === 'string' ? { src: im } : im;
    if (typeof o.src !== 'string' || !/^(https:\/\/|assets\/)/i.test(o.src)) return null;
    return { src: o.src, alt: o.alt || item.nome || '', credito: o.credito || null, licenca: o.licenca || null, fonte: o.fonte || null };
  }
  const hash = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
  /* Foto real quando existe; senão um tratamento de "foto a cadastrar" na paleta da marca
     (nunca uma imagem genérica que pareça ser do lugar). ratio: '16/9', '4/3', '1/1'. */
  function foto(item, { ratio = '4/3', legenda = false, rotulo = 'Foto a cadastrar', eager = false } = {}) {
    const fig = el('figure', 'foto'); fig.style.setProperty('--ratio', ratio);
    const info = imagemInfo(item);
    const vazio = () => {
      fig.classList.add('foto--vazia'); fig.dataset.tom = String(hash(item && (item.id || item.nome) || 'x') % 4);
      fig.replaceChildren(icon('i-image')); if (rotulo) fig.append(el('span', 'foto__rotulo', rotulo));
    };
    if (info) {
      const img = el('img'); img.src = info.src; img.alt = info.alt; img.loading = eager ? 'eager' : 'lazy'; img.decoding = 'async';
      img.addEventListener('error', vazio); fig.append(img);
      if (legenda && (info.credito || info.licenca)) fig.append(el('figcaption', 'foto__cred', [info.credito, info.licenca].filter(Boolean).join(' · ')));
    } else vazio();
    return fig;
  }

  // ---------- estados (disponível / em andamento / concluída / bloqueada / em breve) ----------
  const ESTADOS = {
    'disponivel': { rot: 'Disponível', ic: 'i-circle' },
    'andamento':  { rot: 'Em andamento', ic: 'i-play' },
    'concluido':  { rot: 'Concluída', ic: 'i-check' },
    'bloqueado':  { rot: 'Bloqueada', ic: 'i-lock' },
    'em-breve':   { rot: 'Em breve', ic: 'i-clock' }
  };
  function etiqueta(estado, rotulo) {
    const e = ESTADOS[estado] || ESTADOS['em-breve'], t = el('span', 'tag tag--' + estado);
    t.append(icon(e.ic), document.createTextNode(rotulo || e.rot)); return t;
  }
  const estadoRotulo = estado => (ESTADOS[estado] || ESTADOS['em-breve']).rot;

  // Texto em parágrafos (separados por linha em branco) / lista de curiosidades
  function paragrafos(texto) { return String(texto || '').split(/\n\s*\n/).map(t => t.trim()).filter(Boolean).map(t => el('p', '', t)); }
  function listaTexto(v) { return (Array.isArray(v) ? v : (v ? [v] : [])).map(String).filter(Boolean); }

  // ---------- toast ----------
  let timer;
  function toast(msg) {
    const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(timer); timer = setTimeout(() => t.classList.remove('show'), 4500);
  }

  // ---------- diálogo modal (celebrações e confirmações) ----------
  // acoes: [{ rotulo, cls, fn, valor }]; retorna Promise com o "valor" da ação (ou null ao fechar).
  function dialogo({ icone, selo, titulo, texto, extra, acoes = [], tom = 'claro' }) {
    const d = document.getElementById('dlg');
    return new Promise(resolve => {
      d.className = 'dlg dlg--' + tom; limpar(d);
      const box = el('div', 'dlg__box');
      if (icone) { const r = el('div', 'dlg__ring'); r.append(icon(icone)); box.append(r); }
      if (selo) box.append(el('span', 'tag tag--ouro', selo));
      const h = el('h2', 'dlg__titulo', titulo); h.id = 'dlg-titulo'; box.append(h);
      if (texto) box.append(el('p', 'dlg__texto', texto));
      if (extra) box.append(extra);
      const ac = el('div', 'dlg__acoes');
      let valor = null;
      acoes.forEach(a => ac.append(button(a.rotulo, a.cls || 'btn btn-primary', () => { valor = a.valor !== undefined ? a.valor : a.rotulo; d.close(); if (a.fn) a.fn(); })));
      box.append(ac); d.append(box);
      d.addEventListener('close', () => resolve(valor), { once: true });
      if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
      const primeiro = d.querySelector('button'); if (primeiro) primeiro.focus();
    });
  }
  function confirmar(titulo, texto, rotuloOk) {
    return dialogo({ titulo, texto, acoes: [
      { rotulo: rotuloOk || 'Confirmar', cls: 'btn btn-danger', valor: true },
      { rotulo: 'Cancelar', cls: 'btn btn-outline', valor: false }
    ] }).then(v => v === true);
  }

  window.PARTIU_UI = { el, icon, button, link, pct, barra, limpar, plural, foto, imagemInfo, etiqueta, estadoRotulo, paragrafos, listaTexto, toast, dialogo, confirmar };
})();
