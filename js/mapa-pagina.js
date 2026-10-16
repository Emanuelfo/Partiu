/* PARTIU? — mapa.html: mapa em tela cheia (mesmos dados, progresso e marcadores do mapa do app). */
(() => {
  'use strict';
  const D = window.PARTIU_DATA, UI = window.PARTIU_UI, M = window.PARTIU_MAPA, P = window.PARTIU_PROGRESS;
  const box = document.getElementById('map'), status = document.getElementById('map-status');
  if (!box || !D || !M) return;
  const bairro = id => (D.bairros.find(b => b.id === id) || {}).nome || '';

  if (!window.L) {
    box.hidden = true; status.append(UI.el('p', 'is-error', 'Não foi possível carregar o mapa (biblioteca indisponível). Recarregue a página.'));
    return;
  }
  const tilesMsg = UI.el('p', 'is-error', 'Algumas partes do mapa não carregaram. Verifique sua conexão com a internet.'); tilesMsg.hidden = true;
  const dataMsg = UI.el('p'); status.append(dataMsg, tilesMsg);

  const mapa = M.criar(box, {
    onTiles: (ok, msg) => { if (msg) tilesMsg.textContent = msg; tilesMsg.hidden = ok; },
    popup: it => {
      const r = UI.el('div', 'partiu-popup');
      r.append(UI.el('h4', '', it.nome), UI.el('p', 'meta', [bairro(it.bairro), it.categoria, P.isVisited(it.id) ? 'explorado' : 'ainda não explorado'].filter(Boolean).join(' · ')));
      if (it.demo) r.append(UI.el('p', 'empty', 'Localização aproximada (dado demonstrativo).'));
      r.append(UI.link('Ver patrimônio', 'index.html#/patrimonio/' + encodeURIComponent(it.id), 'link', 'i-arrow-right'));
      return r;
    }
  });
  const itens = D.patrimonios, com = itens.filter(M.temLocal).length;
  mapa.definirItens(itens);
  dataMsg.textContent = com ? UI.plural(com, 'patrimônio', 'patrimônios') + ' no mapa' + (itens.length - com ? '; ' + (itens.length - com) + ' ainda sem localização cadastrada (veja a lista no app).' : '.') + ' Toque em um marcador para ver os detalhes.' : 'Ainda não há patrimônios com localização cadastrada.';
  document.addEventListener('partiu:progress', () => mapa.atualizarEstados());
})();