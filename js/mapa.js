/* PARTIU? — controlador do mapa (Leaflet, embarcado em assets/vendor/leaflet).
   Uso:  const m = PARTIU_MAPA.criar(elemento, { onSelect(id), popup(item) });
         m.definirItens(lista); m.selecionar(id, { voar: true }); m.invalidar();
   - Só entram no mapa itens com coordenadas válidas dentro do município; os demais continuam
     nas listas (nada é posicionado num lugar inventado).
   - Itens com demo:true aparecem com marcador tracejado ("localização aproximada").
   - O mapa só é criado quando o contêiner tem tamanho real (as telas começam ocultas).
   - Camada de base: Stadia Maps ("Alidade Smooth"), tiles raster PNG no Leaflet — não usa WebGL. Ver camadaBase(); precisa de internet
     e, no site publicado, do domínio registrado no painel do Stadia Maps (sem chave de API no código). */
(() => {
  'use strict';

  // Limites do município (O, L, N, S) = -43.804722, -43.099167, -22.738333, -23.096389
  // (BBOX do mapa "Prefeitura da cidade do Rio de Janeiro", IPLANRIO, 1990, catálogo Princeton/MIT GeoData).
  const RIO_CENTER = [-22.9068, -43.1729];
  const RIO_BOUNDS = [[-23.096389, -43.804722], [-22.738333, -43.099167]];   // [[sul, oeste], [norte, leste]]
  const VALID_MARGIN = 0.05, PAN_MARGIN = 0.2;

  const num = v => (v === null || v === undefined || v === '' ? NaN : Number(v));
  function coordValida(lat, lng) {
    return Number.isFinite(lat) && Number.isFinite(lng) &&
      lat >= RIO_BOUNDS[0][0] - VALID_MARGIN && lat <= RIO_BOUNDS[1][0] + VALID_MARGIN &&
      lng >= RIO_BOUNDS[0][1] - VALID_MARGIN && lng <= RIO_BOUNDS[1][1] + VALID_MARGIN;
  }
  const temLocal = p => !!p && coordValida(num(p.lat), num(p.lng));

  // ===== Mapa-base: Stadia Maps, estilo "Alidade Smooth" (tiles raster PNG; funciona em qualquer navegador, sem WebGL) =====
  // Documentação oficial: https://docs.stadiamaps.com/raster/ · https://docs.stadiamaps.com/authentication/ · https://docs.stadiamaps.com/attribution/
  // - URL:  https://tiles.stadiamaps.com/tiles/<estilo>/{z}/{x}/{y}{r}.png  ({r} vira @2x em telas retina; zoom máximo dos tiles: 20).
  // - Autenticação no site publicado: por DOMÍNIO ("domain-based authentication"). O Stadia valida os cabeçalhos Origin/Referer que o
  //   próprio navegador envia; por isso NÃO há chave de API neste código. Cadastre o domínio em
  //   https://client.stadiamaps.com/dashboard/ -> Manage Properties -> Authentication Configuration -> adicionar domínio
  //   (ex.: o endereço *.netlify.app do site e, se houver, o domínio próprio). Em http://localhost e http://127.0.0.1 funciona sem cadastro
  //   (com limite de uso restrito). Páginas abertas por file:// não enviam Origin/Referer e não podem ser autenticadas.
  // - Plano gratuito: desenvolvimento, avaliação e uso não comercial (inclui acadêmico); o limite é mensal e, ao esgotar, o provedor
  //   responde HTTP 429 até o mês seguinte. Ver https://docs.stadiamaps.com/limits/
  // - Se o site usa Referrer-Policy "no-referrer", a autenticação por domínio falha: por isso a camada fixa a política abaixo.
  const STADIA_ESTILO = 'alidade_smooth';
  const STADIA_URL = 'https://tiles.stadiamaps.com/tiles/' + STADIA_ESTILO + '/{z}/{x}/{y}{r}.png';
  const REFERRER = 'strict-origin-when-cross-origin';
  // Atribuição obrigatória (https://docs.stadiamaps.com/attribution/): não remover nem esconder.
  const ATTR_STADIA = '&copy; <a href="https://stadiamaps.com/attribution/" target="_blank" rel="noopener">Stadia Maps</a> ' +
    '&copy; <a href="https://openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> ' +
    '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

  const MSG_TILES_PARCIAL = 'Algumas partes do mapa não carregaram. Verifique sua conexão com a internet.';
  const MSG_TILES_OFFLINE = 'Sem conexão com a internet: o mapa-base não pôde ser carregado. Os marcadores e a lista continuam disponíveis.';
  const MSG_TILES_AUTH = 'O provedor do mapa-base (Stadia Maps) não autorizou este endereço de site. Os marcadores continuam disponíveis; o administrador precisa registrar o domínio no painel do Stadia Maps.';
  const MSG_TILES_LIMITE = 'O limite de uso do mapa-base foi atingido por enquanto. Os marcadores continuam disponíveis; tente novamente mais tarde.';
  const MSG_TILES_FILE = 'O mapa-base não carrega com a página aberta como arquivo (file://). Abra o site publicado ou um servidor local (http://localhost); marcadores e lista funcionam normalmente.';

  function camadaBase() {
    if (location.protocol === 'file:') return null;      // sem Origin/Referer o Stadia Maps não autentica
    return L.tileLayer(STADIA_URL, { maxZoom: 20, attribution: ATTR_STADIA, referrerPolicy: REFERRER });
  }

  // O evento "tileerror" do Leaflet não informa o código HTTP. Na primeira falha, uma única requisição de diagnóstico
  // ao mesmo tile revela a resposta do provedor (401/403 = domínio não autorizado, 429 = limite de uso) para o console.
  // Obs.: se o provedor responder 401 com uma imagem de aviso, o navegador a desenha como um tile comum (sem "tileerror").
  function diagnosticar(url) {
    if (!url || typeof fetch !== 'function') return Promise.resolve({ status: null });
    return fetch(url, { cache: 'no-store', referrerPolicy: REFERRER })
      .then(r => ({ status: r.status, tipo: r.headers.get('content-type') }),
            e => ({ status: null, erro: String(e) }));
  }
  function mensagemPara(status) {
    if (navigator.onLine === false) return MSG_TILES_OFFLINE;
    if (status === 401 || status === 403) return MSG_TILES_AUTH;
    if (status === 429) return MSG_TILES_LIMITE;
    return MSG_TILES_PARCIAL;
  }
  // notificar(ok, mensagem): ok=true esconde o aviso; ok=false mostra a mensagem (nunca esconde o erro real).
  function monitorar(tiles, notificar) {
    let ok = 0, erros = 0, sondado = false;
    tiles.on('loading', () => { ok = 0; erros = 0; });
    tiles.on('tileload', () => { ok++; });
    tiles.on('tileerror', ev => {
      erros++;
      if (sondado) return;                              // diagnóstico e log detalhado só uma vez
      sondado = true;
      const url = ev && ev.tile ? ev.tile.src : '';
      notificar(false, mensagemPara(null));
      diagnosticar(url).then(d => {
        console.error('PARTIU mapa: falha ao carregar tile do Stadia Maps.', {
          url, status: d.status, contentType: d.tipo || null, erroDeRede: d.erro || null,
          online: navigator.onLine, origem: location.origin, referrerPolicy: REFERRER,
          dica: d.status === 401 || d.status === 403 ? 'Domínio não cadastrado no painel do Stadia Maps (Manage Properties > Authentication Configuration).'
              : d.status === 429 ? 'Limite de uso do plano gratuito ou da chamada sem domínio registrado (localhost).'
              : d.status === null ? 'Sem resposta legível (rede, bloqueador de anúncios/privacidade ou CORS); veja a aba Network.' : ''
        });
        notificar(false, mensagemPara(d.status));
      });
    });
    tiles.on('load', () => {                            // fim de um ciclo de carregamento da vista atual
      if (erros === 0) notificar(true);
      else console.warn('PARTIU mapa: ' + erros + ' tile(s) com erro e ' + ok + ' carregado(s) nesta vista.');
    });
  }

  function criar(container, opts = {}) {
    const L = window.L;
    const api = { disponivel: !!L, definirItens() {}, selecionar() {}, invalidar() {}, ids: () => [] };
    if (!L || !container) return api;
    const visitado = opts.visitado || (id => !!(window.PARTIU_PROGRESS && window.PARTIU_PROGRESS.isVisited(id)));
    let map = null, camada = null, itens = [], selId = null, ajustado = false, filaResize = false;
    const marcadores = new Map();

    function icone(it) {
      const v = visitado(it.id), s = it.id === selId;
      const cls = 'partiu-pin' + (v ? ' partiu-pin--done' : '') + (it.demo ? ' partiu-pin--aprox' : '') + (s ? ' partiu-pin--sel' : '');
      return L.divIcon({ className: cls, html: '<span></span>', iconSize: [30, 30], iconAnchor: [15, 30], popupAnchor: [0, -28] });
    }
    function desenhar() {
      if (!map) return;
      camada.clearLayers(); marcadores.clear();
      itens.filter(temLocal).forEach(it => {
        const mk = L.marker([num(it.lat), num(it.lng)], {
          icon: icone(it), keyboard: true, alt: it.nome,
          title: it.nome + (visitado(it.id) ? ' (explorado)' : '') + (it.demo ? ' — localização aproximada' : ''),
          riseOnHover: true, zIndexOffset: it.id === selId ? 1000 : 0
        });
        if (opts.popup) mk.bindPopup(() => opts.popup(it), { maxWidth: 280, minWidth: 180, autoPanPadding: [24, 24] });
        mk.on('click', () => { selId = it.id; atualizarIcones(); if (opts.onSelect) opts.onSelect(it.id, 'marcador'); });
        mk.addTo(camada); marcadores.set(it.id, mk);
      });
    }
    function atualizarIcones() {
      itens.forEach(it => { const mk = marcadores.get(it.id); if (mk) { mk.setIcon(icone(it)); mk.setZIndexOffset(it.id === selId ? 1000 : 0); } });
    }
    function ajustar() {
      const pts = itens.filter(temLocal).map(p => [num(p.lat), num(p.lng)]);
      if (!map) return;
      // sem animação: o Leaflet ignora pedidos feitos durante uma animação de zoom (filtros rápidos deixavam o mapa no zoom errado)
      if (pts.length) map.fitBounds(L.latLngBounds(pts), { padding: [48, 48], maxZoom: 15, animate: false });
      else map.fitBounds(RIO_BOUNDS, { animate: false });
    }
    function criarMapa() {
      if (map) return;
      map = L.map(container, { center: RIO_CENTER, zoom: 11, minZoom: 9, maxZoom: 19, maxBounds: L.latLngBounds(RIO_BOUNDS).pad(PAN_MARGIN), maxBoundsViscosity: 0.7, worldCopyJump: false });
      map.fitBounds(RIO_BOUNDS, { animate: false });
      const tiles = camadaBase();
      if (tiles) {
        monitorar(tiles, (ok, msg) => { if (opts.onTiles) opts.onTiles(ok, msg); });
        tiles.addTo(map);
      } else {
        map.attributionControl.addAttribution('Mapa-base indisponível em file:// — use http(s)');
        if (opts.onTiles) opts.onTiles(false, MSG_TILES_FILE);
      }
      camada = L.layerGroup().addTo(map);
      api.map = map;
      desenhar();
      if (!ajustado) { ajustado = true; ajustar(); }
    }
    function aoRedimensionar() {
      if (filaResize) return; filaResize = true;
      requestAnimationFrame(() => {
        filaResize = false;
        if (container.clientWidth === 0 || container.clientHeight === 0) return;     // oculto: espera ficar visível
        if (!map) { try { criarMapa(); } catch (e) { console.error('PARTIU mapa:', e); if (opts.onErro) opts.onErro(e); } return; }
        map.invalidateSize({ pan: false });
      });
    }
    if ('ResizeObserver' in window) new ResizeObserver(aoRedimensionar).observe(container);
    else window.addEventListener('resize', aoRedimensionar);
    aoRedimensionar();

    api.definirItens = (lista, { ajustarVista = true } = {}) => {
      itens = lista.slice();
      if (selId && !itens.some(i => i.id === selId)) selId = null;
      if (map) { desenhar(); if (ajustarVista) ajustar(); } else ajustado = !ajustarVista ? ajustado : false;
    };
    api.selecionar = (id, { voar = false, popup = false } = {}) => {
      selId = id || null; atualizarIcones();
      const it = itens.find(i => i.id === id), mk = marcadores.get(id);
      if (map && it && mk && voar) {
        // centraliza na área livre: sobe o ponto quando há um cartão cobrindo a parte de baixo do mapa
        const z = Math.max(map.getZoom(), 16), pad = opts.margemInferior ? opts.margemInferior() : 0;
        const alvo = map.unproject(map.project(mk.getLatLng(), z).add([0, pad / 2]), z);
        map.flyTo(alvo, z, { duration: .6 });
      }
      if (mk && popup && opts.popup) mk.openPopup();
    };
    api.atualizarEstados = atualizarIcones;
    api.invalidar = () => { if (map) map.invalidateSize({ pan: false }); else aoRedimensionar(); };
    api.ids = () => [...marcadores.keys()];
    api.pronto = () => !!map;
    return api;
  }

  window.PARTIU_MAPA = { criar, temLocal, coordValida, RIO_BOUNDS };
})();