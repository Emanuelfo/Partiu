/* PARTIU? — navegação entre telas (página única) por rota no hash, para o botão "voltar" do
   navegador funcionar e para qualquer tela poder ser aberta por link.

   Rotas: #/capa #/acesso #/criar #/inicio #/explorar[?sel=&bairro=&zona=] #/missoes #/perfil
          #/regiao/<id> #/bairro/<id> #/patrimonio/<id> #/quiz/<id>
   (o formato antigo #bairro=<id> continua funcionando). Telas internas exigem sessão ativa.
   app.js escuta 'partiu:screen' ({ id, param, query }) e desenha a tela. */
(() => {
  'use strict';
  const ROTAS = {
    capa: 'scr-capa', acesso: 'scr-acesso', criar: 'scr-criar', inicio: 'scr-inicio', explorar: 'scr-explorar',
    missoes: 'scr-missoes', perfil: 'scr-perfil', regiao: 'scr-regiao', bairro: 'scr-bairro', patrimonio: 'scr-patrimonio', quiz: 'scr-quiz'
  };
  const PUBLICAS = ['scr-capa', 'scr-acesso', 'scr-criar'];
  const ABA = { 'scr-regiao': 'scr-inicio', 'scr-bairro': 'scr-missoes', 'scr-patrimonio': 'scr-explorar', 'scr-quiz': 'scr-missoes' };
  const logada = () => !!(window.PARTIU_PROGRESS && window.PARTIU_PROGRESS.sessaoAtiva() && window.PARTIU_PROGRESS.perfil());

  function parse(hash) {
    let h = String(hash || '').replace(/^#/, '');
    const legado = /^bairro=([\w-]+)/.exec(h);
    if (legado) h = '/bairro/' + legado[1];
    const [path, qs] = h.replace(/^\//, '').split('?');
    const [nome, param] = path.split('/');
    return { nome: nome || '', param: param ? decodeURIComponent(param) : null, query: Object.fromEntries(new URLSearchParams(qs || '')) };
  }

  let atual = null;
  function render({ focus = true } = {}) {
    const r = parse(location.hash);
    let id = ROTAS[r.nome];
    if (!id) id = logada() ? 'scr-inicio' : 'scr-capa';
    if (!PUBLICAS.includes(id) && !logada()) { location.replace('#/' + (window.PARTIU_PROGRESS.perfil() ? 'acesso' : 'capa')); return; }
    if (logada() && id === 'scr-capa' && r.nome === '') id = 'scr-inicio';
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id));
    document.body.dataset.screen = id;
    const alvo = document.getElementById(id);
    document.querySelectorAll('[data-nav]').forEach(a => {
      if (a.dataset.nav === (ABA[id] || id)) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    atual = { id, param: r.param, query: r.query };
    document.dispatchEvent(new CustomEvent('partiu:screen', { detail: atual }));
    document.title = id === 'scr-capa' ? 'Partiu?' : 'Partiu? — ' + (alvo.dataset.title || '');
    if (focus) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      const h = alvo.querySelector('h1');
      if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
    }
  }

  // go('/bairro/copacabana') ou go('scr-inicio') (nomes de tela antigos também funcionam)
  function go(destino) {
    let alvo = String(destino || '');
    if (alvo.startsWith('scr-')) { const nome = Object.keys(ROTAS).find(k => ROTAS[k] === alvo); alvo = '/' + (nome || 'inicio'); }
    if (!alvo.startsWith('/')) alvo = '/' + alvo;
    if (location.hash === '#' + alvo) render(); else location.hash = alvo;
  }

  window.addEventListener('hashchange', () => render());
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-go]');
    if (b) { e.preventDefault(); go(b.dataset.go); }
  });

  window.PARTIU_NAV = { go, render, atual: () => atual, logada, parse };
})();
