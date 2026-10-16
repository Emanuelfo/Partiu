/* PARTIU? — tela Explorar: busca, filtros, lista e mapa sincronizados.
   - A lista e o mapa mostram sempre o mesmo conjunto filtrado.
   - Lista → mapa: selecionar um item destaca e centraliza o marcador.
   - Mapa → lista: tocar num marcador destaca o item da lista e abre o cartão com o link para o patrimônio.
   - Itens sem coordenadas validadas ficam só na lista, com aviso (nenhum marcador inventado).
   - Filtros de região, bairro e categoria só aparecem quando os dados têm opções para escolher. */
(() => {
  'use strict';
  const D = window.PARTIU_DATA, P = window.PARTIU_PROGRESS, UI = window.PARTIU_UI, M = window.PARTIU_MAPA, nav = window.PARTIU_NAV;
  if (!D || !P || !UI || !M || !nav) return;
  const { el, icon, button, link, plural } = UI;

  const est = { busca: '', status: 'todos', zona: '', bairro: '', categoria: '', sel: null, vista: 'mapa' };
  let montado = false, mapa = null, refs = {};
  const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const bairro = id => D.bairros.find(b => b.id === id);
  const desktop = () => window.matchMedia('(min-width: 64rem)').matches;
  const STATUS = [['todos', 'Todos'], ['pendentes', 'Ainda não explorados'], ['explorados', 'Explorados']];

  // ---------- dados filtrados ----------
  function filtrar() {
    const q = norm(est.busca);
    return D.patrimonios.filter(p => {
      const b = bairro(p.bairro), v = P.isVisited(p.id);
      if (est.status === 'explorados' && !v) return false;
      if (est.status === 'pendentes' && v) return false;
      if (est.zona && (!b || b.zona !== est.zona)) return false;
      if (est.bairro && p.bairro !== est.bairro) return false;
      if (est.categoria && p.categoria !== est.categoria) return false;
      if (q && ![p.nome, b && b.nome, p.categoria].some(t => norm(t).includes(q))) return false;
      return true;
    });
  }
  const filtrosAtivos = () => !!(est.busca || est.status !== 'todos' || est.zona || est.bairro || est.categoria);

  // ---------- montagem (uma vez; o contêiner do mapa persiste entre visitas) ----------
  function montar(box) {
    box.replaceChildren();
    const page = el('div', 'wrap-wide page');
    const head = el('div', 'page-head');
    head.append(el('p', 'eyebrow', 'Mapa e lista'), el('h1', 't-display', 'Explorar o Rio'),
      el('p', 'lead', 'Procure um patrimônio pelo nome, filtre por bairro ou situação e veja onde ele fica.'));

    // barra de busca e filtros
    const bar = el('div', 'ex-bar'); bar.setAttribute('role', 'search');
    const busca = el('div', 'ex-busca'); busca.append(icon('i-search'));
    const inp = el('input'); inp.type = 'search'; inp.id = 'ex-busca'; inp.placeholder = 'Buscar por nome ou bairro'; inp.autocomplete = 'off'; inp.setAttribute('aria-label', 'Buscar patrimônio');
    let tBusca; inp.addEventListener('input', () => { est.busca = inp.value; clearTimeout(tBusca); tBusca = setTimeout(aplicar, 120); });
    busca.append(inp);

    const chips = el('div', 'chips'); chips.setAttribute('role', 'group'); chips.setAttribute('aria-label', 'Situação do patrimônio');
    STATUS.forEach(([id, rot]) => { const b = button(rot, 'chip', () => { est.status = id; aplicar(); }); b.dataset.status = id; chips.append(b); });

    const selects = el('div', 'ex-selects');
    const mk = (id, rotulo, onchg) => {
      const w = el('label', 'sel'); w.append(el('span', 'sel__rot', rotulo)); const s = el('select'); s.id = id; s.addEventListener('change', () => onchg(s.value)); w.append(s); return { w, s };
    };
    const zSel = mk('ex-zona', 'Região', v => { est.zona = v; if (est.bairro && (bairro(est.bairro) || {}).zona !== v && v) est.bairro = ''; aplicar(); });
    const bSel = mk('ex-bairro', 'Bairro', v => { est.bairro = v; if (v) est.zona = (bairro(v) || {}).zona || est.zona; aplicar(); });
    const cSel = mk('ex-categoria', 'Categoria', v => { est.categoria = v; aplicar(); });
    selects.append(zSel.w, bSel.w, cSel.w);

    const resumo = el('div', 'ex-resumo');
    const cont = el('p', 'ex-cont'); cont.setAttribute('role', 'status'); cont.setAttribute('aria-live', 'polite');
    const limpar = button('Limpar filtros', 'link-btn', () => { Object.assign(est, { busca: '', status: 'todos', zona: '', bairro: '', categoria: '' }); inp.value = ''; aplicar(); });
    const cheia = link('Mapa em tela cheia', 'mapa.html', 'link-btn', 'i-expand');
    resumo.append(cont, limpar, cheia);
    bar.append(busca, chips, selects, resumo);

    // alternância lista/mapa (telas estreitas)
    const tabs = el('div', 'vista-tabs'); tabs.setAttribute('role', 'group'); tabs.setAttribute('aria-label', 'Modo de visualização');
    [['mapa', 'Mapa', 'i-map'], ['lista', 'Lista', 'i-list']].forEach(([id, rot, ic]) => { const b = button(rot, 'vista-tab', () => setVista(id), ic); b.dataset.vista = id; tabs.append(b); });

    const grid = el('div', 'ex-grid');
    const lateral = el('div', 'ex-lista');
    const ul = el('ul', 'itens'); ul.setAttribute('aria-label', 'Patrimônios');
    const vazio = el('div', 'ex-vazio'); vazio.hidden = true;
    vazio.append(el('p', '', 'Nenhum patrimônio encontrado com esses filtros.'), button('Limpar filtros', 'btn btn-outline btn-sm', () => limpar.click()));
    lateral.append(ul, vazio);

    const mapaBox = el('div', 'ex-mapa');
    const mapEl = el('div'); mapEl.id = 'map'; mapEl.setAttribute('role', 'region'); mapEl.setAttribute('aria-label', 'Mapa dos patrimônios do Rio de Janeiro');
    const sel = el('div', 'sel-card'); sel.hidden = true; sel.setAttribute('aria-live', 'polite');
    mapaBox.append(mapEl, sel);
    grid.append(lateral, mapaBox);

    const status = el('div', 'map-status'); status.id = 'map-status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    const msgDados = el('p'), msgTiles = el('p', 'is-error', 'Algumas partes do mapa não carregaram. Verifique sua conexão com a internet.'); msgTiles.hidden = true;
    status.append(msgDados, msgTiles);

    page.append(head, bar, tabs, grid, status);
    box.append(page);
    refs = { inp, chips, zSel: zSel.s, bSel: bSel.s, cSel: cSel.s, zW: zSel.w, bW: bSel.w, cW: cSel.w, cont, limpar, ul, vazio, grid, sel, mapEl, msgDados, msgTiles, tabs };

    if (!window.L) {
      mapEl.hidden = true; msgDados.textContent = 'Não foi possível carregar o mapa (biblioteca indisponível). A lista de patrimônios continua funcionando.'; msgDados.classList.add('is-error');
      est.vista = 'lista';
    } else {
      mapa = M.criar(mapEl, {
        onSelect: id => selecionar(id, 'marcador'),
        margemInferior: () => (refs.sel.hidden ? 0 : refs.sel.offsetHeight + 24),
        onTiles: (ok, msg) => { if (msg) msgTiles.textContent = msg; msgTiles.hidden = ok; },
        onErro: () => { msgDados.textContent = 'Não foi possível iniciar o mapa neste navegador. Recarregue a página; a lista continua funcionando.'; msgDados.classList.add('is-error'); }
      });
    }
    montado = true;
  }

  // ---------- opções dos filtros (só com o que existe nos dados) ----------
  function opcoes() {
    const bs = D.bairros.filter(b => P.bairroTemConteudo(b.id));
    const zs = D.zonas.filter(z => bs.some(b => b.zona === z.id));
    const cats = [...new Set(D.patrimonios.map(p => p.categoria).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const fill = (sel, todos, lista, atual) => {
      sel.replaceChildren(Object.assign(el('option', '', todos), { value: '' }));
      lista.forEach(([v, r]) => sel.append(Object.assign(el('option', '', r), { value: v })));
      sel.value = lista.some(([v]) => v === atual) ? atual : '';
    };
    fill(refs.zSel, 'Todas as regiões', zs.map(z => [z.id, z.nome]), est.zona);
    fill(refs.bSel, 'Todos os bairros', bs.filter(b => !est.zona || b.zona === est.zona).map(b => [b.id, b.nome]), est.bairro);
    fill(refs.cSel, 'Todas as categorias', cats.map(c => [c, c]), est.categoria);
    refs.zW.hidden = zs.length < 2; refs.bW.hidden = bs.length < 2; refs.cW.hidden = cats.length < 1;
    est.zona = refs.zSel.value; est.bairro = refs.bSel.value; est.categoria = refs.cSel.value;
  }

  // ---------- desenho ----------
  function aplicar({ ajustar = true } = {}) {
    opcoes();
    const lista = filtrar();
    refs.inp.value = est.busca;
    refs.chips.querySelectorAll('.chip').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.status === est.status)));
    const noMapa = lista.filter(M.temLocal).length;
    refs.cont.textContent = plural(lista.length, 'patrimônio', 'patrimônios') + (lista.length ? ' · ' + noMapa + ' no mapa' : '');
    refs.limpar.hidden = !filtrosAtivos();
    if (est.sel && !lista.some(p => p.id === est.sel)) est.sel = null;

    refs.ul.replaceChildren();
    lista.forEach(p => refs.ul.append(item(p)));
    refs.vazio.hidden = lista.length > 0;
    if (mapa) mapa.definirItens(lista, { ajustarVista: ajustar });
    if (mapa && est.sel) mapa.selecionar(est.sel);
    atualizarCartao();
    const todos = D.patrimonios.length, sem = lista.length - noMapa;
    refs.msgDados.classList.remove('is-error');
    if (window.L) refs.msgDados.textContent = sem ? sem + (sem === 1 ? ' patrimônio ainda sem localização cadastrada: aparece só na lista.' : ' patrimônios ainda sem localização cadastrada: aparecem só na lista.') : (lista.length ? 'Toque em um marcador ou em um item da lista para ver os detalhes.' : (todos ? '' : 'Ainda não há patrimônios cadastrados.'));
  }

  function item(p) {
    const b = bairro(p.bairro), v = P.isVisited(p.id), local = M.temLocal(p), sel = est.sel === p.id;
    const li = el('li', 'item' + (sel ? ' item--sel' : '') + (v ? ' item--ok' : '')); li.dataset.id = p.id;
    const main = el('button', 'item__main'); main.type = 'button'; main.setAttribute('aria-pressed', String(sel)); main.dataset.key = 'ex-' + p.id;
    main.append(UI.foto(p, { ratio: '1/1', rotulo: '' }));
    const tx = el('span', 'item__txt');
    tx.append(el('strong', '', p.nome), el('span', 'item__meta', [b && b.nome, p.categoria].filter(Boolean).join(' · ')));
    const flags = el('span', 'item__flags');
    if (v) { const f = el('span', 'flag flag--ok'); f.append(icon('i-check'), document.createTextNode('Explorado')); flags.append(f); }
    if (!local) { const f = el('span', 'flag'); f.append(icon('i-pin-off'), document.createTextNode('Sem localização')); flags.append(f); }
    else if (p.demo) { const f = el('span', 'flag'); f.append(icon('i-pin'), document.createTextNode('Local aproximado')); flags.append(f); }
    tx.append(flags); main.append(tx);
    main.addEventListener('click', () => selecionar(p.id, 'lista'));
    const abrir = link('', '#/patrimonio/' + encodeURIComponent(p.id), 'item__open'); abrir.append(icon('i-arrow-right'), el('span', 'sr-only', 'Abrir ' + p.nome));
    li.append(main, abrir);
    if (sel && !local) {
      const n = el('div', 'item__nota'); n.append(el('p', '', 'A localização deste patrimônio ainda não foi cadastrada, por isso ele não aparece no mapa. O conteúdo continua disponível na página do patrimônio.'));
      li.append(n);
    }
    return li;
  }

  function atualizarCartao() {
    const c = refs.sel, p = D.patrimonios.find(x => x.id === est.sel);
    c.replaceChildren();
    if (!p || !M.temLocal(p)) { c.hidden = true; return; }
    const b = bairro(p.bairro), v = P.isVisited(p.id);
    c.hidden = false;
    const fechar = button('', 'sel-card__x', () => { est.sel = null; if (mapa) mapa.selecionar(null); aplicar({ ajustar: false }); }); fechar.append(icon('i-x'), el('span', 'sr-only', 'Fechar detalhes'));
    const tx = el('div', 'sel-card__txt');
    tx.append(el('p', 'eyebrow', [b && b.nome, p.categoria].filter(Boolean).join(' · ')), el('h2', 'sel-card__nome', p.nome));
    const tags = el('div', 'sel-card__tags');
    tags.append(UI.etiqueta(v ? 'concluido' : 'disponivel', v ? 'Explorado' : 'Ainda não explorado'));
    if (p.demo) tags.append(el('span', 'flag', 'Localização aproximada'));
    tx.append(tags);
    if (p.descricao) tx.append(el('p', 'sel-card__desc', UI.paragrafos(p.descricao)[0].textContent));
    c.append(UI.foto(p, { ratio: '4/3', rotulo: '' }), tx, link('Ver patrimônio', '#/patrimonio/' + encodeURIComponent(p.id), 'btn btn-primary btn-sm', 'i-arrow-right'), fechar);
  }

  function selecionar(id, origem) {
    est.sel = id;
    const p = D.patrimonios.find(x => x.id === id), local = M.temLocal(p);
    // lista → mapa: em telas estreitas, vai para a vista do mapa quando há localização
    if (origem === 'lista' && !desktop() && local && mapa) setVista('mapa', { semAjuste: true });
    refs.ul.querySelectorAll('.item').forEach(li => {
      const on = li.dataset.id === id; li.classList.toggle('item--sel', on);
      li.querySelector('.item__main').setAttribute('aria-pressed', String(on));
      const nota = li.querySelector('.item__nota'); if (nota) nota.remove();
      if (on && !local) { const n = el('div', 'item__nota'); n.append(el('p', '', 'A localização deste patrimônio ainda não foi cadastrada, por isso ele não aparece no mapa. O conteúdo continua disponível na página do patrimônio.')); li.append(n); }
    });
    atualizarCartao();                                   // primeiro o cartão, para o mapa centralizar na área livre
    if (mapa) mapa.selecionar(id, { voar: origem === 'lista' && local });
    if (origem === 'marcador') { const li = refs.ul.querySelector('.item--sel'); if (li) li.scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }
  }

  function setVista(v, { semAjuste } = {}) {
    est.vista = v; refs.grid.dataset.vista = v;
    refs.tabs.querySelectorAll('.vista-tab').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.vista === v)));
    if (v === 'mapa' && mapa) requestAnimationFrame(() => mapa.invalidar());
  }

  // ---------- API ----------
  function render(d) {
    const box = document.getElementById('scr-explorar');
    if (!montado) { montar(box); }
    const q = (d && d.query) || {};
    if (q.zona || q.bairro || q.sel) {      // vindo de "Ver no mapa" / "Ver no bairro"
      Object.assign(est, { busca: '', status: 'todos', zona: q.zona || '', bairro: q.bairro || '', categoria: '' });
      est.sel = q.sel || null;
    }
    refs.grid.dataset.vista = est.vista; setVista(est.vista);
    aplicar({ ajustar: true });
    if (est.sel) { const p = D.patrimonios.find(x => x.id === est.sel); if (p && mapa) mapa.selecionar(est.sel, { voar: M.temLocal(p) }); }
    requestAnimationFrame(() => mapa && mapa.invalidar());
  }
  function atualizar() { if (montado && document.getElementById('scr-explorar').classList.contains('on')) aplicar({ ajustar: false }); }

  window.PARTIU_EXPLORAR = { render, atualizar, _estado: est, _mapa: () => mapa };
})();