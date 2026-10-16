/* PARTIU? — progresso e gamificação (localStorage; demonstrativo, sem servidor).
   Só o essencial é gravado (perfil, visitas, quizzes, marcos). XP, nível, totais e estados das
   missões são sempre CALCULADOS a partir disso, então nenhuma tela mostra valores contraditórios.

   Regras
   - Visita a um patrimônio: +10 XP, só na primeira vez. Bairro concluído: +50 XP.
   - Quiz: +10 XP por acerto, só na primeira conclusão. Nível = 1 + XP ÷ 100.
   - Regiões são livres: a pessoa escolhe por onde começar. Dentro da região, um bairro libera o
     próximo; a região fica concluída quando todos os seus bairros e o quiz estão concluídos.
   - Desafios extras (fotos / "onde fica?"): concluir = acertar o limiar; XP só na 1ª conclusão.
   - Bairros/zonas SEM patrimônios cadastrados ficam "em breve": não bloqueiam a sequência e não
     contam para a conclusão (antes, um bairro vazio liberado travava todo o resto do jogo). */
(() => {
  'use strict';
  const KEY = 'partiu.progresso.v1';
  const KEY_SESSAO = 'partiu.sessao.v1';
  const XP = { visita: 10, bairro: 50, quizAcerto: 10 };
  const XP_POR_NIVEL = 100;
  const CONQUISTAS = [
    { id: 'primeiro-passo', nome: 'Primeiro passo',   desc: 'Visite o seu primeiro patrimônio.',          ok: c => c.visitas >= 1 },
    { id: 'explorador',     nome: 'Explorador',       desc: 'Visite 5 patrimônios.',                      ok: c => c.visitas >= 5 },
    { id: 'bairro',         nome: 'Bairro concluído', desc: 'Conclua todos os patrimônios de um bairro.', ok: c => c.bairros >= 1 },
    { id: 'mente-curiosa',  nome: 'Mente curiosa',    desc: 'Conclua um quiz.',                           ok: c => c.quizzes >= 1 },
    { id: 'zona',           nome: 'Zona concluída',   desc: 'Conclua uma zona inteira.',                  ok: c => c.zonas >= 1 },
    { id: 'olho-clinico',   nome: 'Olho clínico',     desc: 'Conclua um desafio extra (fotos ou localização).', ok: c => c.desafios >= 1 }
  ];

  const D = () => window.PARTIU_DATA || { zonas: [], bairros: [], patrimonios: [], quizzes: {} };
  let memoria = null;       // reserva se o localStorage estiver indisponível
  let sessaoMem = false;
  let armazenamentoOk = true;   // falso quando o navegador recusa gravar (modo privado, cota cheia)

  const DES = () => window.PARTIU_DESAFIOS || { info: () => null, disponivel: () => false, lista: () => [] };
  const vazio = () => ({ versao: 1, perfil: null, visitados: {}, bairros: {}, zonas: {}, quizzes: {}, tentativas: {}, conquistas: {}, historico: [] });
  const num = v => (Number.isFinite(v) && v > 0 ? v : Date.now());

  // Valida tudo o que vem do armazenamento; descarta o que for inválido ou não existir nos dados.
  function sanear(raw) {
    const s = vazio();
    if (!raw || typeof raw !== 'object') return s;
    const d = D();
    const nome = raw.perfil && typeof raw.perfil.nome === 'string' ? raw.perfil.nome.trim().slice(0, 30) : '';
    if (nome.length >= 2) s.perfil = { nome, criadoEm: num(raw.perfil.criadoEm) };
    const copia = (de, para, ids) => { if (de && typeof de === 'object') Object.keys(de).forEach(k => { if (ids.indexOf(k) >= 0) para[k] = num(de[k]); }); };
    copia(raw.visitados, s.visitados, d.patrimonios.map(p => p.id));
    copia(raw.bairros, s.bairros, d.bairros.map(b => b.id));
    copia(raw.zonas, s.zonas, d.zonas.map(z => z.id));
    copia(raw.conquistas, s.conquistas, CONQUISTAS.map(c => c.id));
    if (raw.quizzes && typeof raw.quizzes === 'object') {
      Object.keys(raw.quizzes).forEach(k => {
        const q = raw.quizzes[k], def = d.quizzes[k], di = def ? null : DES().info(k);
        if ((!def && !di) || !q) return;
        const total = def ? def.perguntas.length : di.total;
        const acertos = Math.min(Math.max(parseInt(q.acertos, 10) || 0, 0), total);
        s.quizzes[k] = { acertos, total, t: num(q.t) };
      });
    }
    if (raw.tentativas && typeof raw.tentativas === 'object') {
      Object.keys(raw.tentativas).forEach(k => { const n = parseInt(raw.tentativas[k], 10); if (DES().info(k) && n > 0) s.tentativas[k] = Math.min(n, 999); });
    }
    if (Array.isArray(raw.historico)) s.historico = raw.historico.filter(h => h && typeof h.texto === 'string').slice(-50).map(h => ({ t: num(h.t), texto: h.texto.slice(0, 120) }));
    return s;
  }

  function ler() {
    try { const t = localStorage.getItem(KEY); return sanear(t ? JSON.parse(t) : memoria); }
    catch (e) { return sanear(memoria); }
  }
  function gravar(s) {
    memoria = s;
    try { localStorage.setItem(KEY, JSON.stringify(s)); armazenamentoOk = true; } catch (e) { armazenamentoOk = false; /* segue só em memória */ }
    avisar();
  }
  const avisar = () => document.dispatchEvent(new CustomEvent('partiu:progress'));
  const log = (s, texto) => { s.historico.push({ t: Date.now(), texto }); s.historico = s.historico.slice(-50); };

  // ---------- sessão (o "Sair" só encerra a sessão; o progresso continua salvo no navegador) ----------
  function sessaoAtiva() {
    try { return localStorage.getItem(KEY_SESSAO) === '1' || sessaoMem; } catch (e) { return sessaoMem; }
  }
  function setSessao(v) {
    sessaoMem = v;
    try { v ? localStorage.setItem(KEY_SESSAO, '1') : localStorage.removeItem(KEY_SESSAO); } catch (e) { /* ignora */ }
  }

  // ---------- consultas ----------
  const bairrosDaZona = z => D().bairros.filter(b => b.zona === z);
  const patrimoniosDoBairro = b => D().patrimonios.filter(p => p.bairro === b);
  const bairroTemConteudo = id => patrimoniosDoBairro(id).length > 0;
  const bairrosComConteudo = z => bairrosDaZona(z).filter(b => bairroTemConteudo(b.id));
  const zonaTemConteudo = id => bairrosComConteudo(id).length > 0;

  function bairroInfo(id, s = ler()) {
    const lista = patrimoniosDoBairro(id);
    const visitados = lista.filter(p => s.visitados[p.id]).length;
    return { id, total: lista.length, visitados, temConteudo: lista.length > 0, completo: lista.length > 0 && visitados === lista.length };
  }
  function zonaInfo(id, s = ler()) {
    const bs = bairrosComConteudo(id);
    let total = 0, visitados = 0;
    bs.forEach(b => { const i = bairroInfo(b.id, s); total += i.total; visitados += i.visitados; });
    return { id, totalBairros: bairrosDaZona(id).length, bairrosComConteudo: bs.length, bairrosConcluidos: bs.filter(b => bairroInfo(b.id, s).completo).length, total, visitados };
  }
  function zonaCompleta(id, s = ler()) {
    const z = D().zonas.find(x => x.id === id);
    const bs = bairrosComConteudo(id);
    if (!z || !bs.length || !bs.every(b => bairroInfo(b.id, s).completo)) return false;
    return !z.quiz || !!s.quizzes[z.quiz];
  }
  // Regiões são livres: a pessoa escolhe por onde começar. Só as sem conteúdo ficam "em breve".
  function zonaDesbloqueada(id, s = ler()) { return zonaTemConteudo(id); }
  function bairroDesbloqueado(id, s = ler()) {
    const b = D().bairros.find(x => x.id === id);
    if (!b || !bairroTemConteudo(id) || !zonaDesbloqueada(b.zona, s)) return false;
    const irmaos = bairrosComConteudo(b.zona), i = irmaos.findIndex(x => x.id === id);
    return i === 0 || bairroInfo(irmaos[i - 1].id, s).completo;
  }
  function anteriorBloqueante(id) {          // quem precisa ser concluído antes (para a mensagem)
    const b = D().bairros.find(x => x.id === id);
    if (!b) return null;
    if (!zonaDesbloqueada(b.zona)) {
      const zs = D().zonas.filter(z => zonaTemConteudo(z.id)), i = zs.findIndex(z => z.id === b.zona);
      return i > 0 ? { tipo: 'zona', nome: zs[i - 1].nome } : null;
    }
    const irmaos = bairrosComConteudo(b.zona), i = irmaos.findIndex(x => x.id === id);
    return i > 0 ? { tipo: 'bairro', nome: irmaos[i - 1].nome } : null;
  }

  // Estados que a interface exibe: 'em-breve' | 'bloqueado' | 'disponivel' | 'andamento' | 'concluido'
  function estadoBairro(id, s = ler()) {
    const i = bairroInfo(id, s);
    if (!i.temConteudo) return 'em-breve';
    if (i.completo) return 'concluido';
    if (!bairroDesbloqueado(id, s)) return 'bloqueado';
    return i.visitados > 0 ? 'andamento' : 'disponivel';
  }
  function estadoZona(id, s = ler()) {
    if (!zonaTemConteudo(id)) return 'em-breve';
    if (zonaCompleta(id, s)) return 'concluido';
    if (!zonaDesbloqueada(id, s)) return 'bloqueado';
    const z = zonaInfo(id, s), z0 = D().zonas.find(x => x.id === id);
    return (z.visitados > 0 || (z0.quiz && s.quizzes[z0.quiz])) ? 'andamento' : 'disponivel';
  }
  function estadoQuiz(zonaId, s = ler()) {
    const z = D().zonas.find(x => x.id === zonaId);
    if (!z || !z.quiz || !D().quizzes[z.quiz]) return 'em-breve';
    if (s.quizzes[z.quiz]) return 'concluido';
    return zonaDesbloqueada(zonaId, s) ? 'disponivel' : 'bloqueado';
  }
  // Próxima ação sugerida: dá sentido à "jornada" e alimenta o "Continuar" da página inicial.
  function ultimaAtividade(z, s) {              // para continuar na região em que a pessoa estava
    let t = 0;
    bairrosComConteudo(z.id).forEach(b => patrimoniosDoBairro(b.id).forEach(p => { if (s.visitados[p.id] > t) t = s.visitados[p.id]; }));
    if (z.quiz && s.quizzes[z.quiz] && s.quizzes[z.quiz].t > t) t = s.quizzes[z.quiz].t;
    return t;
  }
  function proximoPasso(s = ler()) {
    const regioes = D().zonas.filter(x => zonaTemConteudo(x.id)).map((z, i) => ({ z, i, t: ultimaAtividade(z, s) }))
      .sort((a, b) => (b.t - a.t) || (a.i - b.i)).map(x => x.z);
    for (const z of regioes) {
      if (!zonaDesbloqueada(z.id, s) || zonaCompleta(z.id, s)) continue;
      const bs = bairrosComConteudo(z.id).filter(b => bairroDesbloqueado(b.id, s) && !bairroInfo(b.id, s).completo);
      const b = bs.find(x => bairroInfo(x.id, s).visitados > 0) || bs[0];
      if (b) {
        const p = patrimoniosDoBairro(b.id).find(x => !s.visitados[x.id]);
        if (p) return { tipo: 'patrimonio', patrimonio: p, bairro: b, zona: z };
      }
      if (z.quiz && !s.quizzes[z.quiz] && D().quizzes[z.quiz]) return { tipo: 'quiz', zona: z, quiz: z.quiz };
    }
    return null;
  }
  function calcular(s) {
    const visitas = Object.keys(s.visitados).length;
    const bairros = Object.keys(s.bairros).length;
    const quizzes = Object.keys(s.quizzes).filter(k => !DES().info(k)).length;
    const desafios = Object.keys(s.quizzes).filter(k => DES().info(k)).length;
    const acertos = Object.values(s.quizzes).reduce((a, q) => a + q.acertos, 0);
    const zonas = D().zonas.filter(z => zonaCompleta(z.id, s)).length;
    const xp = visitas * XP.visita + bairros * XP.bairro + acertos * XP.quizAcerto;
    return { visitas, bairros, quizzes, desafios, zonas, xp };
  }
  function stats() {
    const s = ler(), c = calcular(s);
    const nivel = Math.floor(c.xp / XP_POR_NIVEL) + 1;
    return {
      xp: c.xp, nivel, xpNoNivel: c.xp % XP_POR_NIVEL, xpPorNivel: XP_POR_NIVEL,
      visitas: c.visitas, totalPatrimonios: D().patrimonios.length,
      bairrosConcluidos: c.bairros, totalBairros: D().bairros.filter(b => bairroTemConteudo(b.id)).length,
      quizzes: c.quizzes, desafios: c.desafios, zonas: c.zonas,
      conquistas: CONQUISTAS.map(q => ({ id: q.id, nome: q.nome, desc: q.desc, obtida: !!s.conquistas[q.id] }))
    };
  }

  // Marcos novos (bairro concluído, zona, conquistas) depois de uma mudança.
  function avaliar(s) {
    const novo = { bairros: [], conquistas: [] };
    D().bairros.forEach(b => {
      if (!s.bairros[b.id] && bairroInfo(b.id, s).completo) { s.bairros[b.id] = Date.now(); novo.bairros.push(b.id); log(s, 'Bairro concluído: ' + b.nome + ' (+' + XP.bairro + ' XP)'); }
    });
    D().zonas.forEach(z => { if (!s.zonas[z.id] && zonaCompleta(z.id, s)) { s.zonas[z.id] = Date.now(); novo.zona = z.id; log(s, 'Zona concluída: ' + z.nome); } });
    const c = calcular(s);
    CONQUISTAS.forEach(q => { if (!s.conquistas[q.id] && q.ok(c)) { s.conquistas[q.id] = Date.now(); novo.conquistas.push(q.nome); log(s, 'Conquista: ' + q.nome); } });
    return novo;
  }

  // ---------- ações ----------
  function criarPerfil(nome, { substituir = false } = {}) {
    const n = String(nome || '').trim().slice(0, 30);
    if (n.length < 2) return { ok: false, erro: 'Use um apelido com pelo menos 2 caracteres.' };
    const s = substituir ? vazio() : ler();      // "novo perfil" zera o progresso; senão só renomeia
    s.perfil = { nome: n, criadoEm: Date.now() };
    setSessao(true);
    gravar(s);
    return { ok: true };
  }
  function entrar() { if (!ler().perfil) return false; setSessao(true); avisar(); return true; }
  function sair() { setSessao(false); avisar(); }

  function visitar(id) {
    const s = ler(), p = D().patrimonios.find(x => x.id === id);
    if (!p) return { ok: false };
    if (s.visitados[id]) return { ok: true, repetido: true, xp: 0 };     // recompensa só na primeira vez
    if (!bairroDesbloqueado(p.bairro, s)) return { ok: false, bloqueado: true };
    const antes = calcular(s).xp;
    s.visitados[id] = Date.now();
    log(s, 'Visita: ' + p.nome + ' (+' + XP.visita + ' XP)');
    const novo = avaliar(s);
    const xp = calcular(s).xp - antes;
    gravar(s);
    return { ok: true, repetido: false, xp, bairroConcluido: novo.bairros[0] || null, zonaConcluida: novo.zona || null, conquistas: novo.conquistas };
  }
  // Desafio extra: só conclui (e só então rende XP) quem acerta o limiar; antes disso conta como tentativa.
  function concluirDesafio(id, acertos) {
    const di = DES().info(id), s = ler();
    if (!di || !DES().disponivel(id)) return { ok: false };
    const total = di.total, a = Math.min(Math.max(acertos | 0, 0), total);
    if (s.quizzes[id]) return { ok: true, repetido: true, xp: 0, acertos: a, total, limiar: di.limiar };
    if (a < di.limiar) {
      s.tentativas[id] = Math.min((s.tentativas[id] || 0) + 1, 999);
      gravar(s);
      return { ok: true, falhou: true, xp: 0, acertos: a, total, limiar: di.limiar };
    }
    s.quizzes[id] = { acertos: a, total, t: Date.now() };
    delete s.tentativas[id];
    log(s, di.titulo + ': ' + a + '/' + total + ' (+' + a * XP.quizAcerto + ' XP)');
    const novo = avaliar(s);
    gravar(s);
    return { ok: true, repetido: false, xp: a * XP.quizAcerto, acertos: a, total, limiar: di.limiar, conquistas: novo.conquistas };
  }
  function estadoDesafio(id, s = ler()) {
    if (!DES().disponivel(id)) return 'em-breve';
    if (s.quizzes[id]) return 'concluido';
    return s.tentativas[id] ? 'andamento' : 'disponivel';
  }
  function concluirQuiz(zonaId, acertos) {
    if (DES().info(zonaId)) return concluirDesafio(zonaId, acertos);
    const z = D().zonas.find(x => x.quiz === zonaId), def = D().quizzes[zonaId], s = ler();
    if (!def || !z) return { ok: false };
    if (!zonaDesbloqueada(z.id, s)) return { ok: false, bloqueado: true };
    const total = def.perguntas.length, a = Math.min(Math.max(acertos | 0, 0), total);
    if (s.quizzes[zonaId]) return { ok: true, repetido: true, xp: 0, acertos: a, total };   // refazer não dá XP
    s.quizzes[zonaId] = { acertos: a, total, t: Date.now() };
    log(s, def.titulo + ': ' + a + '/' + total + ' (+' + a * XP.quizAcerto + ' XP)');
    const novo = avaliar(s);
    gravar(s);
    return { ok: true, repetido: false, xp: a * XP.quizAcerto, acertos: a, total, zonaConcluida: novo.zona || null, conquistas: novo.conquistas };
  }
  function reiniciar() {
    const perfil = ler().perfil;
    const s = vazio(); s.perfil = perfil;            // mantém o apelido, zera o progresso
    gravar(s);
  }
  function apagarTudo() { try { localStorage.removeItem(KEY); } catch (e) { /* ignora */ } memoria = null; setSessao(false); avisar(); }

  window.PARTIU_PROGRESS = {
    XP, XP_POR_NIVEL, armazenamentoOk: () => armazenamentoOk, perfil: () => ler().perfil, criarPerfil, entrar, sair, sessaoAtiva, visitar, concluirQuiz, reiniciar, apagarTudo, stats,
    isVisited: id => !!ler().visitados[id],
    bairroInfo: id => bairroInfo(id), zonaInfo: id => zonaInfo(id),
    bairroDesbloqueado: id => bairroDesbloqueado(id), zonaDesbloqueada: id => zonaDesbloqueada(id), zonaCompleta: id => zonaCompleta(id),
    bairroTemConteudo, zonaTemConteudo, anteriorBloqueante,
    estadoBairro: id => estadoBairro(id), estadoZona: id => estadoZona(id), estadoQuiz: id => estadoQuiz(id),
    estadoDesafio: id => estadoDesafio(id), tentativas: id => ler().tentativas[id] || 0,
    proximoPasso: () => proximoPasso(), quizFeito: z => !!ler().quizzes[z], resultadoQuiz: z => ler().quizzes[z] || null,
    historico: () => ler().historico.slice().reverse()
  };
})();