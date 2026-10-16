/* PARTIU? — telas dinâmicas: capa, acesso, início, região, bairro, patrimônio, missões, quiz e perfil.
   Todo o conteúdo vem de js/patrimonios-data.js, o estado de js/progresso.js e as rotas de js/navegacao.js.
   A tela Explorar (mapa + lista) está em js/explorar.js. */
(() => {
  'use strict';
  const P = window.PARTIU_PROGRESS, D = window.PARTIU_DATA, UI = window.PARTIU_UI, nav = window.PARTIU_NAV, M = window.PARTIU_MAPA, DES = window.PARTIU_DESAFIOS;
  // Falha de carregamento: em vez de uma página em branco, mostra o que aconteceu e o que fazer.
  if (!P || !D || !UI || !nav || !Array.isArray(D.patrimonios) || !Array.isArray(D.bairros) || !Array.isArray(D.zonas)) {
    const capa = document.getElementById('scr-capa');
    if (capa) {
      const c = document.createElement('div'); c.className = 'card falha'; c.setAttribute('role', 'alert');
      const h = document.createElement('h1'); h.className = 't-title'; h.textContent = 'Não foi possível carregar o Partiu?';
      const t = document.createElement('p'); t.className = 'muted';
      t.textContent = 'Algum arquivo do site não foi carregado (conexão instável ou arquivo ausente). Recarregue a página; se continuar, tente novamente mais tarde.';
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-primary'; b.textContent = 'Recarregar a página';
      b.addEventListener('click', () => location.reload());
      c.append(h, t, b); capa.replaceChildren(c);
    }
    return;
  }
  const { el, icon, button, link, barra, pct, plural, foto, etiqueta, toast } = UI;
  const $ = (s, r = document) => r.querySelector(s);
  const bairro = id => D.bairros.find(b => b.id === id);
  const zona = id => D.zonas.find(z => z.id === id);
  const pat = id => D.patrimonios.find(p => p.id === id);
  const href = (tipo, id) => '#/' + tipo + (id ? '/' + encodeURIComponent(id) : '');
  const LOGO_ALT = 'Partiu? — Educação patrimonial e divulgação histórico-cultural do Rio de Janeiro';

  function logoOficial(cls) {
    const i = el('img', cls); i.src = 'assets/capa-badge.jpg'; i.width = 640; i.height = 640; i.alt = LOGO_ALT; return i;
  }
  function tela(id) { const s = document.getElementById(id); s.replaceChildren(); return s; }
  function trilha(itens) {          // migalhas: [[rótulo, href], ..., rótuloAtual]
    const nv = el('nav', 'crumbs'); nv.setAttribute('aria-label', 'Você está em'); const ol = el('ol');
    itens.forEach((it, i) => {
      const li = el('li');
      if (i === itens.length - 1) { li.textContent = it; li.setAttribute('aria-current', 'page'); }
      else li.append(link(it[0], it[1]));
      ol.append(li);
    });
    nv.append(ol); return nv;
  }
  function secao(titulo, sub, cls) {
    const s = el('section', 'bloco' + (cls ? ' ' + cls : ''));
    const h = el('div', 'bloco__head'); h.append(el('h2', 't-title', titulo)); if (sub) h.append(el('p', 'muted', sub));
    s.append(h); return s;
  }
  const nomeUsuario = () => (P.perfil() || {}).nome || '';
  // Regiões e bairros sem foto própria usam a foto de um patrimônio deles, legendada com o nome do lugar
  // (nunca uma imagem de outro lugar). `imagemDe` na região escolhe o patrimônio mais representativo.
  (function fotosRepresentativas() {
    const comFoto = p => p.imagem && (typeof p.imagem === 'string' || typeof p.imagem.src === 'string');
    const emprestar = (alvo, p, onde) => {
      const o = typeof p.imagem === 'string' ? { src: p.imagem } : p.imagem;
      alvo.imagem = { src: o.src, alt: 'Foto de ' + p.nome + ', em ' + onde, credito: ['Foto: ' + p.nome, o.credito].filter(Boolean).join(' · '), licenca: o.licenca || null, fonte: o.fonte || null };
    };
    D.bairros.forEach(b => { if (b.imagem) return; const p = D.patrimonios.find(x => x.bairro === b.id && comFoto(x)); if (p) emprestar(b, p, b.nome); });
    D.zonas.forEach(z => {
      if (z.imagem) return;
      const ids = new Set(D.bairros.filter(b => b.zona === z.id).map(b => b.id));
      const p = (z.imagemDe && D.patrimonios.find(x => x.id === z.imagemDe && comFoto(x))) || D.patrimonios.find(x => ids.has(x.bairro) && comFoto(x));
      if (p) emprestar(z, p, z.nome);
    });
  })();
  // Resumo de texto: corta na última palavra inteira e marca com reticências (nunca no meio da palavra).
  function resumoTexto(txt, max) {
    const t = String(txt || '').replace(/\s+/g, ' ').trim();
    if (t.length <= max) return t;
    const corte = t.slice(0, max), i = corte.lastIndexOf(' ');
    return corte.slice(0, i > max * 0.6 ? i : max).replace(/[\s,;:.\-–—]+$/, '') + '…';
  }

  // ---------- cabeçalho ----------
  function cabecalho() {
    const nome = nomeUsuario();
    document.querySelectorAll('[data-partiu-name]').forEach(n => { n.textContent = nome ? (nome.length > 12 ? nome.slice(0, 11) + '…' : nome) : 'Perfil'; });
    const chip = $('#xp-chip'), s = P.stats();
    if (s.xp > 0) { chip.hidden = false; chip.textContent = 'Nível ' + s.nivel + ' · ' + s.xp + ' XP'; chip.setAttribute('aria-label', 'Nível ' + s.nivel + ', ' + s.xp + ' XP. Abrir perfil'); }
    else chip.hidden = true;
    $('#foot-demo').hidden = !D.demo;
    $('#aviso-armazenamento').hidden = P.armazenamentoOk();
  }

  // ---------- capa ----------
  function hero({ eyebrow, titulo, texto, acoes, tom }) {
    const h = el('section', 'hero' + (tom ? ' hero--' + tom : ''));
    const wrap = el('div', 'hero__in');
    const tx = el('div', 'hero__txt');
    tx.append(el('p', 'eyebrow eyebrow--claro', eyebrow), el('h1', 't-hero', titulo), el('p', 'hero__lead', texto));
    const ac = el('div', 'hero__acoes'); acoes.forEach(a => ac.append(a)); tx.append(ac);
    const fig = el('div', 'hero__logo');
    const hi = D.hero && UI.imagemInfo(D.hero);
    if (hi) h.classList.add('hero--foto'), h.style.setProperty('--hero-img', 'url("' + hi.src + '")');
    fig.append(logoOficial());
    wrap.append(tx, fig); h.append(wrap);
    if (hi && (hi.credito || hi.licenca)) h.append(el('p', 'hero__cred', 'Foto: ' + [hi.credito, hi.licenca].filter(Boolean).join(' · ')));
    return h;
  }
  function renderCapa() {
    const box = tela('scr-capa'), p = P.perfil();
    const acoes = [];
    if (p) {
      acoes.push(button('Continuar como ' + p.nome, 'btn btn-primary btn-lg', () => { P.entrar(); nav.go('/inicio'); }, 'i-arrow-right'));
      acoes.push(link('Usar outro perfil', '#/acesso', 'btn btn-ghost btn-lg'));
    } else {
      acoes.push(link('Começar a explorar', '#/criar', 'btn btn-primary btn-lg', 'i-arrow-right'));
      acoes.push(link('Já tenho um perfil', '#/acesso', 'btn btn-ghost btn-lg'));
    }
    box.append(hero({ eyebrow: 'Educação patrimonial · Rio de Janeiro', titulo: 'Conheça o Rio além dos lugares de sempre.',
      texto: 'Escolha um bairro, descubra seus patrimônios, cumpra missões e acompanhe a sua jornada pela cidade.', acoes }));
    const s = el('section', 'wrap-wide bloco passos');
    s.append(el('h2', 't-title', 'Como funciona'));
    const ul = el('ol', 'passos__lista');
    [['Escolha um bairro', 'Cada região do Rio é uma jornada. Escolha por onde começar.', 'i-compass'],
     ['Descubra e visite', 'Leia a história de cada patrimônio, veja onde fica no mapa e marque a visita.', 'i-pin'],
     ['Evolua', 'Ganhe XP, conclua bairros, responda aos quizzes e libere novas missões.', 'i-trophy']].forEach(([t, d, ic], i) => {
      const li = el('li', 'passo'); const n = el('span', 'passo__n', String(i + 1)); const c = el('div');
      c.append(el('h3', 't-subtitle', t), el('p', 'muted', d)); li.append(n, c, icon(ic, 'passo__ic')); ul.append(li);
    });
    s.append(ul); box.append(s);
  }

  // ---------- acesso ----------
  function renderAcesso() {
    const box = $('#acesso-conteudo'), p = P.perfil(); box.replaceChildren();
    if (p) {
      box.append(el('p', 'eyebrow', 'Perfil salvo neste navegador'), el('h1', 't-title', 'Bem-vindo de volta, ' + p.nome + '!'),
        button('Continuar jornada', 'btn btn-primary btn-block', () => { P.entrar(); nav.go('/inicio'); }, 'i-arrow-right'),
        el('p', 'muted small sep', 'Quer recomeçar com outro apelido? Um novo perfil apaga o progresso atual.'),
        link('Criar novo perfil', '#/criar', 'btn btn-outline btn-block'));
    } else {
      box.append(el('h1', 't-title', 'Como você quer entrar?'), el('p', 'muted', 'Não há perfil salvo neste navegador.'),
        link('Criar perfil', '#/criar', 'btn btn-primary btn-block'));
    }
  }
  $('#partiu-signup-form').addEventListener('submit', async e => {
    e.preventDefault();
    const nome = $('#partiu-signup-name').value, err = $('#signup-error');
    if (String(nome).trim().length < 2) { err.textContent = 'Use um apelido com pelo menos 2 caracteres.'; $('#partiu-signup-name').focus(); return; }
    const existe = !!P.perfil();
    if (existe && !(await UI.confirmar('Criar um novo perfil?', 'O progresso do perfil atual (XP, visitas, quizzes e conquistas) será apagado neste navegador.', 'Apagar e criar'))) return;
    const r = P.criarPerfil(nome, { substituir: existe });
    err.textContent = r.ok ? '' : r.erro;
    if (r.ok) { $('#partiu-signup-name').value = ''; nav.go('/inicio'); }
  });

  // ---------- início ----------
  function destaques(n, preferirBairro) {
    const pool = D.patrimonios.filter(p => P.bairroTemConteudo(p.bairro));
    const score = p => (UI.imagemInfo(p) ? 2 : 0) + (p.descricao ? 1 : 0) + (M.temLocal(p) ? .5 : 0) + (p.bairro === preferirBairro ? .25 : 0);
    return pool.map((p, i) => ({ p, i, s: score(p) })).sort((a, b) => b.s - a.s || a.i - b.i).slice(0, n).map(x => x.p);
  }
  function cartaoMissao(passo, st) {
    const c = el('article', 'missao-atual card');
    if (!passo) return null;
    if (passo.tipo === 'patrimonio') {
      const b = passo.bairro, info = P.bairroInfo(b.id), p = passo.patrimonio;
      const novo = info.visitados === 0;
      const esq = el('div', 'missao-atual__txt');
      esq.append(el('p', 'eyebrow', novo ? 'Sua primeira missão' : 'Missão atual'), el('h2', 't-title', b.nome),
        el('p', 'missao-atual__prox', 'Próxima etapa: ' + p.nome));
      const nos = el('ol', 'nos'); nos.setAttribute('aria-label', 'Etapas do bairro: ' + info.visitados + ' de ' + info.total + ' concluídas');
      D.patrimonios.filter(x => x.bairro === b.id).forEach(x => { const li = el('li', 'no' + (P.isVisited(x.id) ? ' no--ok' : '') + (x.id === p.id ? ' no--atual' : '')); li.title = x.nome; nos.append(li); });
      esq.append(nos, barra(pct(info.visitados, info.total), 'Progresso em ' + b.nome), el('p', 'muted small', info.visitados + ' de ' + info.total + ' patrimônios · +' + P.XP.visita + ' XP por visita e +' + P.XP.bairro + ' XP ao concluir o bairro'));
      const ac = el('div', 'missao-atual__acoes');
      ac.append(link(novo ? 'Começar missão' : 'Ir para a etapa', href('patrimonio', p.id), 'btn btn-primary', 'i-arrow-right'), link('Ver a missão do bairro', href('bairro', b.id), 'btn btn-outline'));
      c.append(esq, ac);
    } else {
      const q = D.quizzes[passo.quiz];
      const esq = el('div', 'missao-atual__txt');
      esq.append(el('p', 'eyebrow', 'Missão atual'), el('h2', 't-title', q.titulo), el('p', 'missao-atual__prox', 'Última etapa de ' + passo.zona.nome + ': responda ao quiz para concluir a região.'));
      const ac = el('div', 'missao-atual__acoes'); ac.append(link('Fazer o quiz', href('quiz', passo.quiz), 'btn btn-primary', 'i-arrow-right'));
      c.append(esq, ac);
    }
    return c;
  }
  function cartaoRegiao(z) {
    const estado = P.estadoZona(z.id), zi = P.zonaInfo(z.id), aberta = estado !== 'em-breve' && estado !== 'bloqueado';
    const card = el(estado === 'em-breve' ? 'div' : 'a', 'regiao-card regiao-card--' + estado);
    if (estado !== 'em-breve') card.href = href('regiao', z.id);
    card.append(foto(z, { ratio: '4/5', rotulo: '' }));
    const tx = el('div', 'regiao-card__txt');
    tx.append(etiqueta(estado), el('h3', 't-subtitle', z.nome));
    if (estado === 'em-breve') tx.append(el('p', 'regiao-card__info', 'Conteúdo ainda não cadastrado'));
    else {
      tx.append(el('p', 'regiao-card__info', zi.visitados + ' de ' + zi.total + ' patrimônios · ' + plural(zi.bairrosComConteudo, 'bairro com conteúdo', 'bairros com conteúdo')));
      tx.append(barra(pct(zi.visitados, zi.total), 'Progresso em ' + z.nome, 'bar--claro'));
    }
    card.append(tx);
    if (estado === 'bloqueado') card.setAttribute('aria-label', z.nome + ' — bloqueada');
    return card;
  }
  function cartaoPatrimonio(p) {
    const b = bairro(p.bairro), v = P.isVisited(p.id);
    const a = el('a', 'pat-card'); a.href = href('patrimonio', p.id);
    a.append(foto(p, { ratio: '4/3', legenda: true }));
    const tx = el('div', 'pat-card__txt');
    tx.append(el('p', 'eyebrow', [b && b.nome, p.categoria].filter(Boolean).join(' · ')), el('h3', 't-subtitle', p.nome));
    if (p.descricao) tx.append(el('p', 'muted', resumoTexto(UI.paragrafos(p.descricao)[0].textContent, 140)));
    else tx.append(el('p', 'muted small', 'Contexto histórico em breve.'));
    tx.append(etiqueta(v ? 'concluido' : 'disponivel', v ? 'Visitado' : 'Disponível'));
    a.append(tx); return a;
  }
  function renderInicio() {
    const box = tela('scr-inicio'), s = P.stats(), passo = P.proximoPasso(), nome = nomeUsuario();
    const novo = s.visitas === 0 && s.quizzes === 0;
    // 1. apresentação
    let acoes, titulo, texto;
    if (passo) {
      const alvo = passo.tipo === 'quiz' ? href('quiz', passo.quiz) : href('patrimonio', passo.patrimonio.id);
      acoes = [link(novo ? 'Começar a primeira missão' : 'Continuar de onde parou', alvo, 'btn btn-primary btn-lg', 'i-arrow-right'), link('Ver o mapa', '#/explorar', 'btn btn-ghost btn-lg')];
      titulo = novo ? 'Olá, ' + nome + '. Pronto para o Rio?' : 'Bem-vindo de volta, ' + nome + '.';
      texto = novo ? 'Sua primeira missão já está liberada. Visite um patrimônio e ganhe os primeiros pontos.' : 'Sua próxima etapa está pronta. Continue a missão ou explore o mapa.';
    } else {
      acoes = [link('Explorar o mapa', '#/explorar', 'btn btn-primary btn-lg', 'i-arrow-right'), link('Ver missões', '#/missoes', 'btn btn-ghost btn-lg')];
      titulo = s.visitas ? 'Você concluiu tudo o que está cadastrado.' : 'Ainda não há missões disponíveis.';
      texto = s.visitas ? 'Novos bairros e patrimônios entram aqui conforme o conteúdo for validado.' : 'O conteúdo está sendo cadastrado. Enquanto isso, veja o que já existe no mapa.';
    }
    box.append(hero({ eyebrow: 'Educação patrimonial · Rio de Janeiro', titulo, texto, acoes }));
    const page = el('div', 'wrap-wide');
    // 2. missão atual
    const cm = cartaoMissao(passo, s);
    if (cm) { const sc = el('section', 'bloco bloco--sobe'); sc.append(cm); page.append(sc); }
    // 3. regiões
    const sr = secao('Descubra as regiões', 'Escolha por onde começar: cada região é uma jornada. As que ainda não têm conteúdo aparecem como “em breve”.');
    const g = el('div', 'regiao-grid'); D.zonas.forEach(z => g.append(cartaoRegiao(z))); sr.append(g); page.append(sr);
    // 4. destaques
    const dst = destaques(3, passo && passo.bairro && passo.bairro.id);
    if (dst.length) {
      const sd = secao('Patrimônios em destaque', 'Selecionados entre os lugares já cadastrados.');
      const gd = el('div', 'pat-grid'); dst.forEach(p => gd.append(cartaoPatrimonio(p))); sd.append(gd);
      sd.append(el('p', 'bloco__mais', '')); sd.lastChild.append(link('Ver todos no mapa', '#/explorar', 'link-btn', 'i-arrow-right'));
      page.append(sd);
    }
    // 5. progresso
    page.append(faixaProgresso(s));
    box.append(page);
  }
  function faixaProgresso(s) {
    const f = el('section', 'faixa'); f.setAttribute('aria-label', 'Seu progresso');
    const esq = el('div', 'faixa__nivel');
    if (s.xp === 0) {
      const vz = el('div', 'faixa__vazio');
      vz.append(el('p', 'eyebrow eyebrow--claro', 'Seu progresso'), el('h2', 't-subtitle', 'A sua jornada começa na primeira visita.'),
        el('p', 'faixa__txt', 'Cada patrimônio visitado vale ' + P.XP.visita + ' XP. Conquistas e níveis aparecem aqui.'));
      esq.append(vz);
    } else {
      const medalha = el('div', 'faixa__medalha'); medalha.append(el('span', '', String(s.nivel)));
      const tx = el('div');
      tx.append(el('p', 'eyebrow eyebrow--claro', 'Nível ' + s.nivel), el('h2', 't-subtitle', s.xp + ' XP'),
        barra(pct(s.xpNoNivel, s.xpPorNivel), 'Progresso no nível', 'bar--claro'), el('p', 'faixa__txt', (s.xpPorNivel - s.xpNoNivel) + ' XP para o próximo nível'));
      esq.append(medalha, tx);
    }
    const dir = el('div', 'faixa__conq');
    const obt = s.conquistas.filter(c => c.obtida);
    dir.append(el('p', 'faixa__txt', obt.length ? plural(obt.length, 'conquista', 'conquistas') + ' de ' + s.conquistas.length : 'Próxima conquista: ' + (s.conquistas.find(c => !c.obtida) || { nome: '—' }).nome));
    if (obt.length) { const u = el('ul', 'conq-chips'); obt.forEach(c => { const li = el('li', 'conq-chip'); li.append(icon('i-trophy'), document.createTextNode(c.nome)); u.append(li); }); dir.append(u); }
    dir.append(link('Ver perfil e conquistas', '#/perfil', 'btn btn-ghost btn-sm'));
    f.append(esq, dir); return f;
  }

  // ---------- região ----------
  function cartaoBairro(b) {
    const estado = P.estadoBairro(b.id), info = P.bairroInfo(b.id);
    const clic = estado !== 'em-breve';
    const card = el(clic ? 'a' : 'div', 'bairro-card bairro-card--' + estado);
    if (clic) card.href = href('bairro', b.id);
    card.append(foto(b, { ratio: '3/2', rotulo: info.temConteudo ? 'Foto a cadastrar' : '' }));
    const tx = el('div', 'bairro-card__txt');
    tx.append(etiqueta(estado), el('h3', 't-subtitle', b.nome),
      el('p', 'muted small', info.temConteudo ? info.visitados + ' de ' + info.total + ' patrimônios' : 'Patrimônios a cadastrar'));
    if (info.temConteudo) tx.append(barra(pct(info.visitados, info.total), 'Progresso em ' + b.nome));
    card.append(tx);
    if (estado === 'bloqueado') {
      card.addEventListener('click', e => { e.preventDefault(); const a = P.anteriorBloqueante(b.id); toast('Bairro bloqueado' + (a ? ': conclua ' + a.nome + ' primeiro.' : '.')); });
    }
    return card;
  }
  function cartaoQuiz(z) {
    const def = D.quizzes[z.quiz], estado = P.estadoQuiz(z.id), r = P.resultadoQuiz(z.quiz);
    const c = el('article', 'quiz-card card');
    const tx = el('div');
    tx.append(el('p', 'eyebrow', 'Desafio'), el('h3', 't-subtitle', def.titulo), etiqueta(estado));
    tx.append(el('p', 'muted', plural(def.perguntas.length, 'pergunta', 'perguntas') + (def.demo ? ' (conteúdo demonstrativo)' : '') + (estado === 'concluido' ? ' · você acertou ' + r.acertos + ' de ' + r.total + '. Refazer não gera XP.' : ' · vale ' + P.XP.quizAcerto + ' XP por acerto, só na primeira vez.')));
    c.append(tx);
    if (estado === 'concluido' || estado === 'disponivel') c.append(link(estado === 'concluido' ? 'Refazer quiz' : 'Fazer quiz', href('quiz', z.quiz), estado === 'concluido' ? 'btn btn-outline' : 'btn btn-primary', 'i-arrow-right'));
    else c.append(el('p', 'muted small', 'Conclua a região anterior para liberar.'));
    return c;
  }
  function cartaoDesafio(di) {
    const estado = P.estadoDesafio(di.id), r = P.resultadoQuiz(di.id);
    const c = el('article', 'quiz-card card'), tx = el('div');
    tx.append(el('p', 'eyebrow', 'Desafio extra'), el('h3', 't-subtitle', di.titulo), etiqueta(estado));
    tx.append(el('p', 'muted', di.total + ' perguntas · acerte ' + di.limiar + ' para concluir' + (estado === 'concluido' ? ' · você acertou ' + r.acertos + ' de ' + r.total + '. Refazer não gera XP.' : ' · vale ' + P.XP.quizAcerto + ' XP por acerto, só na primeira conclusão.')));
    c.append(tx, link(estado === 'concluido' ? 'Refazer desafio' : estado === 'andamento' ? 'Tentar de novo' : 'Começar desafio', href('quiz', di.id), estado === 'concluido' ? 'btn btn-outline' : 'btn btn-primary', 'i-arrow-right'));
    return c;
  }
  function renderRegiao(d) {
    const box = tela('scr-regiao'), z = zona(d.param);
    if (!z) return naoEncontrado(box, 'Região não encontrada.');
    document.getElementById('scr-regiao').dataset.title = z.nome;
    const estado = P.estadoZona(z.id), zi = P.zonaInfo(z.id), page = el('div', 'wrap-wide page');
    page.append(trilha([['Início', '#/inicio'], z.nome]));
    const head = el('header', 'regiao-head');
    const tx = el('div'); tx.append(etiqueta(estado), el('h1', 't-display', z.nome));
    if (z.resumo) tx.append(el('p', 'lead', z.resumo));
    head.append(tx);
    if (estado !== 'em-breve') {
      const pr = el('div', 'regiao-head__prog');
      pr.append(el('p', 'muted', zi.visitados + ' de ' + zi.total + ' patrimônios · ' + 'bairros concluídos: ' + zi.bairrosConcluidos + ' de ' + zi.bairrosComConteudo), barra(pct(zi.visitados, zi.total), 'Progresso em ' + z.nome),
        link('Ver no mapa', '#/explorar?zona=' + encodeURIComponent(z.id), 'btn btn-outline btn-sm', 'i-map'));
      head.append(pr);
    }
    page.append(head);
    if (estado === 'em-breve') {
      const n = el('div', 'vazio card'); n.append(el('h2', 't-subtitle', 'Conteúdo em breve'), el('p', 'muted', 'Esta região ainda não tem bairros e patrimônios cadastrados.'), link('Voltar ao início', '#/inicio', 'btn btn-outline'));
      page.append(n); box.append(page); return;
    }
    const sb = secao('Bairros', 'Conclua os bairros em ordem para liberar o próximo.');
    const g = el('div', 'bairro-grid'); D.bairros.filter(b => b.zona === z.id).forEach(b => g.append(cartaoBairro(b))); sb.append(g); page.append(sb);
    if (z.quiz && D.quizzes[z.quiz]) { const sq = secao('Desafio da região'); sq.append(cartaoQuiz(z)); page.append(sq); }
    const extras = DES ? DES.lista(z.id) : [];
    if (extras.length) { const sd = secao('Desafios extras', 'Opcionais. Ganhe XP acertando e treine o que aprendeu.'); extras.forEach(di => sd.append(cartaoDesafio(di))); page.append(sd); }
    box.append(page);
  }

  // ---------- bairro ----------
  function renderBairro(d) {
    const box = tela('scr-bairro'), b = bairro(d.param);
    if (!b) return naoEncontrado(box, 'Bairro não encontrado.');
    document.getElementById('scr-bairro').dataset.title = b.nome;
    const z = zona(b.zona), info = P.bairroInfo(b.id), estado = P.estadoBairro(b.id), lista = D.patrimonios.filter(p => p.bairro === b.id);
    const bloqueado = estado === 'bloqueado';
    const topo = el('header', 'bairro-hero');
    const f = foto(b, { ratio: '21/9', legenda: true, rotulo: info.temConteudo ? 'Foto do bairro a cadastrar' : '', eager: true }); f.classList.add('bairro-hero__foto');
    const ov = el('div', 'bairro-hero__txt wrap-wide');
    ov.append(trilha([['Início', '#/inicio'], [z.nome, href('regiao', z.id)], b.nome]));
    ov.append(etiqueta(estado), el('h1', 't-display', b.nome));
    topo.append(f, ov); box.append(topo);

    const page = el('div', 'wrap-wide page page--bairro');
    const cols = el('div', 'duas');
    const main = el('div', 'duas__main');
    const sec = secao('Missão: descubra ' + b.nome, 'Ordem livre. Confirme cada visita pelo botão: ela vale XP só na primeira vez.');
    if (bloqueado) { const a = P.anteriorBloqueante(b.id); const av = el('p', 'aviso'); av.append(icon('i-lock'), document.createTextNode('Bairro bloqueado' + (a ? ': conclua ' + a.nome + ' primeiro.' : '.'))); sec.append(av); }
    if (!lista.length) sec.append(el('p', 'muted', 'Os patrimônios deste bairro ainda não foram cadastrados.'));
    const ol = el('ol', 'etapas');
    const atual = lista.find(p => !P.isVisited(p.id));
    lista.forEach((p, i) => {
      const v = P.isVisited(p.id), cur = !bloqueado && atual && atual.id === p.id;
      const li = el('li', 'etapa' + (v ? ' etapa--ok' : '') + (cur ? ' etapa--atual' : '') + (bloqueado ? ' etapa--bloq' : ''));
      const no = el('span', 'etapa__no'); no.append(v ? icon('i-check') : (bloqueado ? icon('i-lock') : document.createTextNode(String(i + 1))));
      const c = el('div', 'etapa__corpo');
      const nome = link(p.nome, href('patrimonio', p.id), 'etapa__nome'); nome.dataset.key = 'name-' + p.id;
      c.append(nome, el('p', 'muted small', [p.categoria, M.temLocal(p) ? (p.demo ? 'Localização aproximada' : 'No mapa') : 'Sem localização cadastrada'].filter(Boolean).join(' · ')));
      const ac = el('div', 'etapa__acao');
      if (v) ac.append(etiqueta('concluido', 'Visitado'));
      else if (bloqueado) ac.append(etiqueta('bloqueado'));
      else { const bt = button('Confirmar visita', 'btn btn-outline btn-sm', () => visitar(p.id)); bt.dataset.key = 'visit-' + p.id; if (cur) bt.className = 'btn btn-primary btn-sm'; ac.append(bt); }
      li.append(no, c, ac); ol.append(li);
    });
    sec.append(ol); main.append(sec);

    const lado = el('aside', 'duas__lado');
    const c1 = el('div', 'card card--lado');
    c1.append(el('h2', 't-subtitle', 'Seu progresso'), el('p', 'muted', info.total ? info.visitados + ' de ' + info.total + ' patrimônios visitados' : 'Sem patrimônios cadastrados.'), barra(pct(info.visitados, info.total), 'Progresso em ' + b.nome),
      el('p', 'muted small', 'Cada visita vale +' + P.XP.visita + ' XP. Ao concluir o bairro: +' + P.XP.bairro + ' XP.'));
    const c2 = el('div', 'card card--lado');
    c2.append(el('h2', 't-subtitle', 'Sobre o bairro'));
    if (b.resumo) c2.append(...UI.paragrafos(b.resumo)); else c2.append(el('p', 'muted', 'O texto sobre o bairro ainda não foi cadastrado.'));
    c2.append(link('Ver no mapa', '#/explorar?bairro=' + encodeURIComponent(b.id), 'btn btn-outline btn-sm', 'i-map'));
    const c3 = el('div', 'card card--lado'); c3.append(el('h2', 't-subtitle', 'Sobre esta missão'));
    const fl = el('dl', 'info');
    [['Objetivo', info.total ? 'Conhecer ' + plural(info.total, 'patrimônio cadastrado', 'patrimônios cadastrados') + ' em ' + b.nome + '.' : 'Ainda não há patrimônios cadastrados.'],
     ['Como fazer', 'Leia a história de cada lugar e confirme a visita pelo botão. O Partiu? não usa GPS: a confirmação é sua.'],
     ['Para concluir', 'Confirmar a visita a todos os patrimônios do bairro.'],
     ['Recompensa', '+' + P.XP.visita + ' XP por visita e +' + P.XP.bairro + ' XP ao concluir o bairro. Cada visita rende XP só uma vez.']].forEach(([k, v]) => { fl.append(el('dt', '', k), el('dd', '', v)); });
    c3.append(fl);
    lado.append(c1, c3, c2);
    cols.append(main, lado); page.append(cols); box.append(page);
  }

  // ---------- patrimônio ----------
  function renderPatrimonio(d) {
    const box = tela('scr-patrimonio'), p = pat(d.param);
    if (!p) return naoEncontrado(box, 'Patrimônio não encontrado.');
    document.getElementById('scr-patrimonio').dataset.title = p.nome;
    const b = bairro(p.bairro), z = b && zona(b.zona), v = P.isVisited(p.id), bloqueado = !v && !P.bairroDesbloqueado(p.bairro);
    const irmaos = D.patrimonios.filter(x => x.bairro === p.bairro), i = irmaos.findIndex(x => x.id === p.id);
    const topo = el('header', 'pat-hero');
    const f = foto(p, { ratio: '21/9', legenda: true, rotulo: 'Foto do patrimônio a cadastrar', eager: true }); f.classList.add('pat-hero__foto');
    const ov = el('div', 'pat-hero__txt wrap-wide');
    ov.append(trilha([['Início', '#/inicio'], z ? [z.nome, href('regiao', z.id)] : ['Regiões', '#/inicio'], b ? [b.nome, href('bairro', b.id)] : ['Bairro', '#/inicio'], p.nome]));
    const tags = el('div', 'pat-hero__tags'); tags.append(etiqueta(v ? 'concluido' : (bloqueado ? 'bloqueado' : 'disponivel'), v ? 'Visitado' : (bloqueado ? 'Bairro bloqueado' : 'Ainda não visitado')));
    if (p.categoria) tags.append(el('span', 'tag tag--neutro', p.categoria));
    ov.append(tags, el('p', 'eyebrow eyebrow--claro', [z && z.nome, b && b.nome].filter(Boolean).join(' · ')), el('h1', 't-display', p.nome));
    topo.append(f, ov); box.append(topo);

    const page = el('div', 'wrap-wide page'), cols = el('div', 'duas'), main = el('div', 'duas__main prosa');
    // contexto histórico
    const s1 = el('section', 'leitura'); s1.append(el('h2', 't-title', 'Contexto histórico'));
    if (p.descricao) s1.append(...UI.paragrafos(p.descricao)); else s1.append(faltando('O texto histórico deste patrimônio ainda não foi cadastrado.'));
    main.append(s1);
    const s2 = el('section', 'leitura'); s2.append(el('h2', 't-title', 'Por que importa'));
    if (p.importancia) s2.append(...UI.paragrafos(p.importancia)); else s2.append(faltando('A importância cultural deste patrimônio ainda não foi cadastrada.'));
    main.append(s2);
    const cur = UI.listaTexto(p.curiosidades);
    const s3 = el('section', 'leitura'); s3.append(el('h2', 't-title', 'Curiosidades'));
    if (cur.length) { const u = el('ul', 'curios'); cur.forEach(t => u.append(el('li', '', t))); s3.append(u); } else s3.append(faltando('Ainda não há curiosidades cadastradas.'));
    main.append(s3);
    if (Array.isArray(p.fontes) && p.fontes.length) {
      const s4 = el('section', 'leitura'); s4.append(el('h2', 't-subtitle', 'Fontes')); const u = el('ul', 'fontes');
      p.fontes.forEach(fn => { const li = el('li'); if (fn.url && /^https?:\/\//.test(fn.url)) { const a = link(fn.titulo || fn.url, fn.url); a.target = '_blank'; a.rel = 'noopener'; li.append(a); } else li.textContent = fn.titulo || ''; u.append(li); });
      s4.append(u); main.append(s4);
    }
    // outros do bairro
    if (irmaos.length > 1) {
      const s5 = el('section', 'leitura'); s5.append(el('h2', 't-title', 'No mesmo bairro'));
      const u = el('ul', 'relac');
      irmaos.filter(x => x.id !== p.id).slice(0, 4).forEach(x => { const li = el('li'); const a = link('', href('patrimonio', x.id), 'relac__item'); a.append(foto(x, { ratio: '1/1', rotulo: '' }), el('span', '', x.nome)); if (P.isVisited(x.id)) a.append(icon('i-check', 'ok')); li.append(a); u.append(li); });
      s5.append(u); main.append(s5);
    }

    const lado = el('aside', 'duas__lado');
    const c1 = el('div', 'card card--lado card--missao');
    c1.append(el('p', 'eyebrow', 'Etapa da missão'), el('h2', 't-subtitle', v ? 'Você já visitou este lugar' : 'Visitou este lugar?'));
    if (v) c1.append(el('p', 'muted', 'Visita registrada. O XP desta etapa já foi concedido.'));
    else if (bloqueado) { const a = P.anteriorBloqueante(p.bairro); c1.append(el('p', 'muted', 'Este bairro está bloqueado' + (a ? ': conclua ' + a.nome + ' primeiro.' : '.'))); }
    else { c1.append(el('p', 'muted', 'Confirme a visita para ganhar +' + P.XP.visita + ' XP. A confirmação é manual: o app não usa GPS.')); const bt = button('Confirmar visita', 'btn btn-primary btn-block', () => visitar(p.id)); bt.dataset.key = 'visit-' + p.id; c1.append(bt); }
    c1.append(barraBairro(p.bairro));
    const c2 = el('div', 'card card--lado');
    c2.append(el('h2', 't-subtitle', 'Informações'));
    const dl = el('dl', 'info');
    const add = (k, val, vazio) => { dl.append(el('dt', '', k)); const dd = el('dd'); if (val) dd.textContent = val; else { dd.className = 'muted'; dd.textContent = vazio; } dl.append(dd); };
    add('Região', z && z.nome, '—'); add('Bairro', b && b.nome, '—'); add('Categoria', p.categoria, 'Não cadastrada'); add('Endereço', p.endereco, 'Não cadastrado');
    add('Localização', M.temLocal(p) ? (p.demo ? 'Aproximada (dado demonstrativo)' : 'Cadastrada') : null, 'Ainda não cadastrada');
    c2.append(dl);
    if (M.temLocal(p)) c2.append(link('Ver no mapa', '#/explorar?sel=' + encodeURIComponent(p.id), 'btn btn-outline btn-sm', 'i-map'));
    lado.append(c1, c2);
    cols.append(main, lado); page.append(cols);
    const nv = el('nav', 'pager'); nv.setAttribute('aria-label', 'Outros patrimônios do bairro');
    if (i > 0) nv.append(link(irmaos[i - 1].nome, href('patrimonio', irmaos[i - 1].id), 'btn btn-outline btn-sm', 'i-arrow-left')); else nv.append(el('span'));
    if (i < irmaos.length - 1) { const a = link('', href('patrimonio', irmaos[i + 1].id), 'btn btn-outline btn-sm'); a.append(document.createTextNode(irmaos[i + 1].nome), icon('i-arrow-right')); nv.append(a); }
    if (irmaos.length > 1) page.append(nv);
    box.append(page);
  }
  const faltando = t => { const d = el('div', 'faltando'); d.append(icon('i-info'), el('p', '', t)); return d; };
  function barraBairro(id) {
    const info = P.bairroInfo(id), w = el('div', 'mini-prog');
    w.append(el('p', 'muted small', info.visitados + ' de ' + info.total + ' patrimônios do bairro'), barra(pct(info.visitados, info.total), 'Progresso no bairro'));
    return w;
  }

  // ---------- fluxo de visita (XP, conquistas e celebrações) ----------
  async function visitar(id) {
    const p = pat(id), r = P.visitar(id);
    if (!r.ok) { if (r.bloqueado) toast('Este bairro ainda está bloqueado.'); return; }
    if (r.repetido) return;
    toast('+' + P.XP.visita + ' XP · ' + p.nome + (r.conquistas.length ? ' · Conquista: ' + r.conquistas.join(', ') : ''));
    if (r.zonaConcluida) {
      const z = zona(r.zonaConcluida), outras = D.zonas.filter(x => x.id !== z.id && P.zonaTemConteudo(x.id) && !P.zonaCompleta(x.id));
      const v = await UI.dialogo({ icone: 'i-trophy', selo: 'REGIÃO CONCLUÍDA', titulo: z.nome + ' concluída!', texto: outras.length ? 'Escolha a próxima região em Início ou em Missões.' : 'Você concluiu tudo o que está cadastrado até agora.', tom: 'escuro',
        acoes: [{ rotulo: 'Ver missões', valor: 'missoes' }, { rotulo: 'Continuar explorando', cls: 'btn btn-ghost', valor: 'fechar' }] });
      if (v === 'missoes') nav.go('/missoes');
    } else if (r.bairroConcluido) {
      const b = bairro(r.bairroConcluido), z = zona(b.zona), irm = D.bairros.filter(x => x.zona === b.zona && P.bairroTemConteudo(x.id));
      const prox = irm[irm.findIndex(x => x.id === b.id) + 1], quiz = !prox && z.quiz && !P.quizFeito(z.quiz) ? z.quiz : null;
      const acoes = [];
      if (prox) acoes.push({ rotulo: 'Ir para ' + prox.nome, valor: 'prox' }); else if (quiz) acoes.push({ rotulo: 'Fazer o quiz', valor: 'quiz' });
      acoes.push({ rotulo: 'Voltar às missões', cls: prox || quiz ? 'btn btn-ghost' : 'btn btn-primary', valor: 'fechar' });
      const info = P.bairroInfo(b.id);
      const v = await UI.dialogo({ icone: 'i-landmark', selo: 'BAIRRO CONCLUÍDO', titulo: b.nome + ' — bairro concluído!', texto: 'Você descobriu os ' + info.total + ' patrimônios cadastrados de ' + b.nome + ' (+' + P.XP.bairro + ' XP de bônus).' + (prox ? ' ' + prox.nome + ' foi desbloqueado.' : ''), tom: 'escuro', acoes });
      if (v === 'prox') nav.go('/bairro/' + prox.id); else if (v === 'quiz') nav.go('/quiz/' + quiz); else if (v === 'fechar') nav.go('/missoes');
    }
  }

  // ---------- missões ----------
  const FILTROS_M = [['todas', 'Todas'], ['andamento', 'Em andamento'], ['disponivel', 'Disponíveis'], ['concluido', 'Concluídas'], ['bloqueado', 'Bloqueadas']];
  let filtroM = 'todas';
  function linhaMissao(n, { titulo, estado, detalhe, hrefAcao, rotuloAcao, bloqueioTxt, progresso }) {
    const li = el('li', 'missao missao--' + estado); li.dataset.estado = estado;
    const no = el('span', 'missao__no'); no.append(estado === 'concluido' ? icon('i-check') : estado === 'bloqueado' ? icon('i-lock') : document.createTextNode(String(n)));
    const c = el('div', 'missao__corpo');
    const t = el('div', 'missao__topo'); t.append(el('h4', 'missao__titulo', titulo), etiqueta(estado)); c.append(t);
    if (detalhe) c.append(el('p', 'muted small', detalhe));
    if (progresso != null) c.append(barra(progresso, 'Progresso: ' + titulo));
    if (bloqueioTxt) c.append(el('p', 'muted small', bloqueioTxt));
    li.append(no, c);
    if (hrefAcao) li.append(link(rotuloAcao, hrefAcao, estado === 'concluido' ? 'btn btn-outline btn-sm' : 'btn btn-primary btn-sm'));
    return li;
  }
  function renderMissoes() {
    const box = tela('scr-missoes'), page = el('div', 'wrap-wide page');
    const head = el('div', 'page-head'); head.append(el('p', 'eyebrow', 'Sua jornada'), el('h1', 't-display', 'Missões'),
      el('p', 'lead', 'Escolha uma região para começar. Em cada uma, conclua os bairros em ordem e feche com o quiz; os desafios extras são opcionais.'));
    page.append(head);
    const passo = P.proximoPasso(), s = P.stats(); const cm = cartaoMissao(passo, s);
    if (cm) page.append(cm);
    const barraF = el('div', 'chips chips--m'); barraF.setAttribute('role', 'group'); barraF.setAttribute('aria-label', 'Filtrar missões por situação');
    FILTROS_M.forEach(([id, rot]) => { const b = button(rot, 'chip', () => { filtroM = id; renderMissoes(); const nb = document.querySelector('#scr-missoes [data-f="' + id + '"]'); if (nb) nb.focus(); }); b.dataset.f = id; b.setAttribute('aria-pressed', String(filtroM === id)); barraF.append(b); });
    page.append(barraF);
    let total = 0;
    D.zonas.filter(z => P.zonaTemConteudo(z.id)).forEach(z => {
      const linhas = [], zi = P.zonaInfo(z.id); let n = 0;
      D.bairros.filter(b => b.zona === z.id && P.bairroTemConteudo(b.id)).forEach(b => {
        const e = P.estadoBairro(b.id), info = P.bairroInfo(b.id), a = e === 'bloqueado' ? P.anteriorBloqueante(b.id) : null; n++;
        if (filtroM !== 'todas' && filtroM !== e) return;
        linhas.push(linhaMissao(n, { titulo: b.nome, estado: e, detalhe: info.visitados + ' de ' + info.total + ' patrimônios', progresso: pct(info.visitados, info.total),
          hrefAcao: e === 'bloqueado' ? null : href('bairro', b.id), rotuloAcao: e === 'concluido' ? 'Revisar' : e === 'andamento' ? 'Continuar' : 'Começar', bloqueioTxt: a ? 'Conclua ' + a.nome + ' para liberar.' : null }));
      });
      if (z.quiz && D.quizzes[z.quiz]) {
        const e = P.estadoQuiz(z.id), q = D.quizzes[z.quiz], r = P.resultadoQuiz(z.quiz); n++;
        if (filtroM === 'todas' || filtroM === e) linhas.push(linhaMissao(n, { titulo: q.titulo, estado: e, detalhe: plural(q.perguntas.length, 'pergunta', 'perguntas') + (r ? ' · você acertou ' + r.acertos + ' de ' + r.total : ' · ' + P.XP.quizAcerto + ' XP por acerto'),
          hrefAcao: e === 'bloqueado' ? null : href('quiz', z.quiz), rotuloAcao: e === 'concluido' ? 'Refazer' : 'Fazer quiz', bloqueioTxt: e === 'bloqueado' ? 'Conclua a região anterior para liberar.' : null }));
      }
      (DES ? DES.lista(z.id) : []).forEach(di => {
        const e = P.estadoDesafio(di.id), r = P.resultadoQuiz(di.id); n++;
        if (filtroM === 'todas' || filtroM === e) linhas.push(linhaMissao(n, { titulo: di.titulo, estado: e,
          detalhe: 'Desafio extra · acerte ' + di.limiar + ' de ' + di.total + (r ? ' · você acertou ' + r.acertos + ' de ' + r.total : ' · ' + P.XP.quizAcerto + ' XP por acerto'),
          hrefAcao: href('quiz', di.id), rotuloAcao: e === 'concluido' ? 'Refazer' : e === 'andamento' ? 'Tentar de novo' : 'Começar' }));
      });
      if (!linhas.length) return;
      total += linhas.length;
      const sec = el('section', 'missao-zona');
      const h = el('div', 'missao-zona__head'); const t = el('div'); t.append(el('h3', 't-subtitle', z.nome), el('p', 'muted small', zi.visitados + ' de ' + zi.total + ' patrimônios · ' + 'bairros concluídos: ' + zi.bairrosConcluidos + ' de ' + zi.bairrosComConteudo));
      h.append(t, etiqueta(P.estadoZona(z.id)), link('Ver região', href('regiao', z.id), 'link-btn', 'i-arrow-right')); sec.append(h);
      const ol = el('ol', 'missoes'); linhas.forEach(l => ol.append(l)); sec.append(ol);
      const breves = D.bairros.filter(b => b.zona === z.id && !P.bairroTemConteudo(b.id));
      if (breves.length && (filtroM === 'todas')) sec.append(el('p', 'muted small em-breve', 'Em breve nesta região: ' + breves.map(b => b.nome).join(', ') + '.'));
      page.append(sec);
    });
    if (!total) { const v = el('div', 'vazio card'); v.append(el('p', 'muted', filtroM === 'todas' ? 'Ainda não há missões cadastradas.' : 'Nenhuma missão nesta situação.')); if (filtroM !== 'todas') v.append(button('Ver todas', 'btn btn-outline btn-sm', () => { filtroM = 'todas'; renderMissoes(); })); page.append(v); }
    const breves = D.zonas.filter(z => !P.zonaTemConteudo(z.id));
    if (breves.length && filtroM === 'todas') page.append(el('p', 'muted em-breve', 'Regiões em breve: ' + breves.map(z => z.nome).join(', ') + '.'));
    box.append(page);
  }

  // ---------- quiz e desafios ----------
  let qz = null;
  const embaralhar = n => { const a = [...Array(n).keys()]; for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  // O que a rota #/quiz/<id> abre: o quiz cadastrado da região ou um desafio extra gerado dos dados.
  function resolverQuiz(id) {
    const z = D.zonas.find(x => x.quiz === id);
    if (z && D.quizzes[id]) return { id, zona: z, def: D.quizzes[id], desafio: null };
    const di = DES && DES.info(id);
    if (di && DES.disponivel(id)) return { id, zona: zona(di.zonaId), def: { titulo: di.titulo, perguntas: [] }, desafio: di };
    return null;
  }
  function textosFicha(r) {
    const xp = P.XP.quizAcerto;
    if (!r.desafio) {
      const n = r.def.perguntas.length;
      return [['Objetivo', 'Mostrar o que você aprendeu sobre os patrimônios de ' + r.zona.nome + '.'],
        ['Como funciona', plural(n, 'pergunta', 'perguntas') + ' de múltipla escolha. Depois de cada resposta você vê a correta e, quando houver, uma explicação.'],
        ['Para concluir', 'Responder a todas as perguntas.'],
        ['Recompensa', '+' + xp + ' XP por acerto, só na primeira vez. Refazer não gera XP.']];
    }
    const f = r.desafio.tipo === 'fotos', n = r.desafio.total;
    return [['Objetivo', f ? 'Reconhecer pelas fotos os patrimônios de ' + r.zona.nome + '.' : 'Saber em que bairro ficam os patrimônios de ' + r.zona.nome + '.'],
      ['Como funciona', n + (f ? ' fotos sorteadas; escolha o nome do lugar entre 4 opções.' : ' lugares sorteados; escolha o bairro entre 4 opções.') + ' A cada tentativa as perguntas mudam.'],
      ['Para concluir', 'Acertar pelo menos ' + r.desafio.limiar + ' de ' + n + '. Se não alcançar, pode tentar de novo.'],
      ['Recompensa', '+' + xp + ' XP por acerto, na primeira vez que concluir. Depois, refazer não gera XP.']];
  }
  function renderQuiz(d) {
    const box = tela('scr-quiz'), r = resolverQuiz(d.param);
    if (!r) return naoEncontrado(box, 'Quiz não encontrado.');
    const wrap = el('div', 'wrap quiz-wrap page');
    wrap.append(trilha([['Missões', '#/missoes'], r.def.titulo]));
    const card = el('div', 'card card-quiz'); card.id = 'quiz-card'; wrap.append(card); box.append(wrap);
    if (!P.zonaDesbloqueada(r.zona.id)) { card.append(el('h1', 't-title', r.def.titulo), el('p', 'muted', 'Esta região ainda não tem conteúdo.'), link('Voltar às missões', '#/missoes', 'btn btn-outline')); return; }
    if (!r.desafio && !r.def.perguntas.length) { card.append(el('h1', 't-title', r.def.titulo), el('p', 'muted', 'Ainda não há perguntas cadastradas neste quiz.'), link('Voltar às missões', '#/missoes', 'btn btn-outline')); return; }
    qz = { id: r.id, zona: r.zona, def: r.def, desafio: r.desafio, i: 0, acertos: 0, ordem: [] };
    fichaQuiz(r);
  }
  function fichaQuiz(r) {
    const card = $('#quiz-card'); card.replaceChildren();
    const h = el('h1', 't-title', r.def.titulo); h.tabIndex = -1;
    card.append(el('p', 'eyebrow', r.desafio ? 'Desafio extra' : 'Quiz da região'), h);
    const dl = el('dl', 'info'); textosFicha(r).forEach(([k, v]) => dl.append(el('dt', '', k), el('dd', '', v))); card.append(dl);
    if (r.desafio && r.desafio.tipo === 'fotos') card.append(el('p', 'muted small', 'Este desafio usa fotos. Se você não consegue ver imagens, faça o desafio “Onde fica?” ou o quiz da região.'));
    const ac = el('div', 'quiz-actions'); ac.append(button('Começar', 'btn btn-primary', iniciarQuiz)); card.append(ac);
    h.focus({ preventScroll: true });
  }
  function iniciarQuiz() {
    if (qz.desafio) {
      const g = DES.gerar(qz.id);
      if (!g || !g.perguntas.length) { const c = $('#quiz-card'); c.replaceChildren(el('h1', 't-title', qz.def.titulo), el('p', 'muted', 'Não foi possível montar o desafio agora.'), link('Voltar às missões', '#/missoes', 'btn btn-outline')); return; }
      qz.def = g;
    }
    qz.i = 0; qz.acertos = 0; qz.ordem = embaralhar(qz.def.perguntas.length);
    perguntaQuiz();
  }
  function perguntaQuiz() {
    const card = $('#quiz-card'), n = qz.def.perguntas.length, q = qz.def.perguntas[qz.ordem[qz.i]];
    card.replaceChildren();
    const h = el('h1', 't-title', qz.def.titulo); h.tabIndex = -1;
    card.append(el('p', 'eyebrow', qz.zona.nome), h, el('p', 'quiz-meta', 'Pergunta ' + (qz.i + 1) + ' de ' + n), barra(pct(qz.i, n), 'Progresso do quiz', 'bar--moldura'));
    let imgEl = null;
    if (q.imagem) {
      const fw = el('div', 'quiz-foto');
      fw.append(UI.foto({ id: q.id, nome: '', imagem: { src: q.imagem.src, alt: 'Foto de um patrimônio do Rio de Janeiro a ser identificado' } }, { ratio: '16/9', rotulo: '', eager: true }));
      imgEl = fw.querySelector('img'); card.append(fw);
    }
    const fs = el('fieldset', 'quiz-opts'); fs.append(el('legend', 'quiz-q', q.texto));
    const confirmar = button('Confirmar resposta', 'btn btn-primary', null); confirmar.disabled = true;
    const fb = el('div', 'quiz-feedback'); fb.setAttribute('role', 'status');
    let respondida = false;
    embaralhar(q.opcoes.length).forEach((k, idx) => {
      const lb = el('label', 'quiz-opt'), inp = el('input'); inp.type = 'radio'; inp.name = 'q-opcao'; inp.value = String(k); inp.id = 'q-' + qz.i + '-' + idx;
      inp.addEventListener('change', () => { confirmar.disabled = false; });
      lb.append(inp, el('span', 'quiz-opt__txt', q.opcoes[k])); fs.append(lb);
    });
    confirmar.addEventListener('click', () => {
      if (respondida) { qz.i++; return qz.i < n ? perguntaQuiz() : fimQuiz(); }
      const marcada = fs.querySelector('input:checked'); if (!marcada) return;
      respondida = true; const esc = +marcada.value, ok = esc === q.correta; if (ok) qz.acertos++;
      fs.querySelectorAll('.quiz-opt').forEach(lb => {
        const inp = lb.querySelector('input'), k = +inp.value; inp.disabled = true;
        if (k === q.correta) { lb.classList.add('ok'); lb.append(el('span', 'quiz-opt__sel', 'Correta')); }
        else if (k === esc) { lb.classList.add('no'); lb.append(el('span', 'quiz-opt__sel', 'Sua resposta')); }
      });
      if (imgEl) imgEl.alt = 'Foto de ' + q.opcoes[q.correta];
      fb.className = 'quiz-feedback ' + (ok ? 'ok' : 'no');
      fb.replaceChildren(el('p', 'quiz-feedback__t', ok ? 'Resposta correta.' : 'Resposta incorreta. A correta é: ' + q.opcoes[q.correta] + '.'));
      if (q.explicacao) fb.append(el('p', '', q.explicacao));
      confirmar.textContent = qz.i + 1 < n ? 'Próxima pergunta' : 'Ver resultado'; confirmar.focus();
    });
    const ac = el('div', 'quiz-actions'); ac.append(confirmar);
    card.append(fs, fb, ac);
    if (qz.def.demo && qz.i === 0) card.append(el('p', 'footer-note', 'Quiz demonstrativo: perguntas adicionais serão cadastradas em js/patrimonios-data.js.'));
    h.focus({ preventScroll: true });
  }
  function fimQuiz() {
    const r = P.concluirQuiz(qz.id, qz.acertos), card = $('#quiz-card'); card.replaceChildren();
    if (!r.ok) { card.append(el('h1', 't-title', 'Não foi possível registrar o resultado.'), link('Voltar às missões', '#/missoes', 'btn btn-outline')); return; }
    const h = el('h1', 't-title', 'Você acertou ' + r.acertos + ' de ' + r.total); h.tabIndex = -1;
    const msg = r.falhou ? 'Para concluir este desafio é preciso acertar pelo menos ' + r.limiar + '. Nenhum XP foi registrado; você pode tentar de novo, e as perguntas mudam.'
      : r.repetido ? 'Você já tinha concluído isto: refazer não gera XP.' : '+' + r.xp + ' XP registrados no seu perfil.';
    card.append(el('p', 'eyebrow', r.falhou ? 'Quase lá' : 'Resultado'), h, el('p', 'muted', msg));
    const ac = el('div', 'quiz-actions quiz-actions--duplo');
    ac.append(link('Voltar às missões', '#/missoes', r.falhou ? 'btn btn-outline' : 'btn btn-primary'),
      button(r.falhou ? 'Tentar de novo' : 'Refazer (sem XP)', r.falhou ? 'btn btn-primary' : 'btn btn-outline', iniciarQuiz));
    card.append(ac); h.focus({ preventScroll: true });
    if (r.conquistas && r.conquistas.length) toast('Conquista desbloqueada: ' + r.conquistas.join(', '));
    if (r.zonaConcluida) UI.dialogo({ icone: 'i-trophy', selo: 'REGIÃO CONCLUÍDA', titulo: zona(r.zonaConcluida).nome + ' concluída!', texto: 'Você concluiu todos os bairros cadastrados e o quiz.', tom: 'escuro', acoes: [{ rotulo: 'Ver missões', valor: 'm', fn: () => nav.go('/missoes') }, { rotulo: 'Fechar', cls: 'btn btn-ghost', valor: 'f' }] });
  }

  // ---------- perfil ----------
  function renderPerfil() {
    const box = tela('scr-perfil'), s = P.stats(), p = P.perfil(), page = el('div', 'wrap page');
    const head = el('header', 'perfil-head');
    head.append(el('span', 'avatar', (p ? p.nome : '?').trim().charAt(0).toUpperCase()));
    const tx = el('div'); tx.append(el('p', 'eyebrow', 'Perfil'), el('h1', 't-display', p ? p.nome : 'Visitante'), el('p', 'muted', 'Nível ' + s.nivel + ' · ' + s.xp + ' XP'));
    head.append(tx); page.append(head);
    const nivel = el('section', 'card card--nivel'); nivel.append(el('h2', 't-subtitle', 'Nível ' + s.nivel), barra(pct(s.xpNoNivel, s.xpPorNivel), 'Progresso no nível'),
      el('p', 'muted small', s.xpNoNivel + ' de ' + s.xpPorNivel + ' XP · faltam ' + (s.xpPorNivel - s.xpNoNivel) + ' XP para o nível ' + (s.nivel + 1)));
    const nums = el('dl', 'numeros');
    [[s.visitas + '/' + s.totalPatrimonios, 'patrimônios visitados'], [s.bairrosConcluidos + '/' + s.totalBairros, 'bairros concluídos'], [String(s.quizzes), plural(s.quizzes, 'quiz concluído', 'quizzes concluídos')], [String(s.desafios), plural(s.desafios, 'desafio extra concluído', 'desafios extras concluídos')]].forEach(([v, l]) => { const d = el('div'); d.append(el('dd', '', v), el('dt', '', l)); nums.append(d); });
    nivel.append(nums); page.append(nivel);

    const sc = secao('Conquistas'); const ul = el('ul', 'conq-grid');
    s.conquistas.forEach(c => { const li = el('li', 'conq' + (c.obtida ? ' conq--ok' : '')); const ic = el('span', 'conq__ic'); ic.append(icon(c.obtida ? 'i-trophy' : 'i-lock')); const t = el('div'); t.append(el('strong', '', c.nome), el('span', 'muted small', c.desc + (c.obtida ? '' : ' (bloqueada)'))); li.append(ic, t); ul.append(li); });
    sc.append(ul); page.append(sc);

    const sh = secao('Atividade recente'); const h = P.historico().slice(0, 8), hl = el('ul', 'historico');
    if (!h.length) hl.append(el('li', 'muted', 'Nenhuma atividade ainda.'));
    h.forEach(x => { const li = el('li'); li.append(el('time', 'muted small', new Date(x.t).toLocaleDateString('pt-BR')), el('span', '', x.texto)); hl.append(li); });
    sh.append(hl); page.append(sh);

    const cfg = el('section', 'bloco conta');
    cfg.append(el('h2', 't-subtitle', 'Sua conta'), el('p', 'muted small', 'Seu progresso fica salvo só neste navegador e pode ser apagado por você ou pelo navegador. Não há senha nem sincronização entre aparelhos.'));
    const ac = el('div', 'conta__acoes');
    ac.append(button('Sair', 'btn btn-outline btn-sm', () => { P.sair(); nav.go('/capa'); }),
      button('Reiniciar progresso', 'btn btn-danger-outline btn-sm', async () => {
        if (await UI.confirmar('Reiniciar o progresso?', 'XP, visitas, quizzes e conquistas serão apagados. O apelido será mantido. Esta ação não pode ser desfeita.', 'Apagar progresso')) { P.reiniciar(); toast('Progresso reiniciado.'); }
      }));
    cfg.append(ac); page.append(cfg); box.append(page);
  }

  function naoEncontrado(box, msg) {
    const w = el('div', 'wrap page'), c = el('div', 'card vazio');
    const h = el('h1', 't-title', msg); c.append(h, el('p', 'muted', 'O endereço pode estar incorreto ou o conteúdo ainda não foi cadastrado.'), link('Voltar ao início', '#/inicio', 'btn btn-primary'));
    w.append(c); box.append(w);
  }

  // ---------- despacho ----------
  const telas = { 'scr-capa': renderCapa, 'scr-acesso': renderAcesso, 'scr-inicio': renderInicio, 'scr-regiao': renderRegiao, 'scr-bairro': renderBairro, 'scr-patrimonio': renderPatrimonio, 'scr-missoes': renderMissoes, 'scr-quiz': renderQuiz, 'scr-perfil': renderPerfil };
  function desenhar(d, { manterFoco } = {}) {
    const chave = manterFoco && document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.key : null;
    if (d.id === 'scr-explorar') window.PARTIU_EXPLORAR && window.PARTIU_EXPLORAR.render(d);
    else if (telas[d.id]) telas[d.id](d);
    cabecalho();
    if (chave) {
      const alvo = document.querySelector('[data-key="' + chave + '"]') || document.querySelector('[data-key="' + chave.replace(/^visit-/, 'name-') + '"]');
      if (alvo) alvo.focus({ preventScroll: true });
    }
  }
  document.addEventListener('partiu:screen', e => desenhar(e.detail));
  document.addEventListener('partiu:progress', () => {
    const a = nav.atual(); if (!a) return;
    if (a.id === 'scr-quiz') { cabecalho(); return; }                 // o quiz controla a própria tela
    if (a.id === 'scr-explorar') { cabecalho(); window.PARTIU_EXPLORAR && window.PARTIU_EXPLORAR.atualizar(); return; }
    if (a.id === 'scr-capa' || a.id === 'scr-criar') { cabecalho(); return; }
    desenhar(a, { manterFoco: true });
  });
  window.PARTIU_APP = { visitar };

  // início: sessão ativa → app; senão capa (que oferece "Continuar como ...")
  nav.render({ focus: false });
})();