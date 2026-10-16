/* PARTIU? — desafios extras por região, GERADOS a partir dos dados já cadastrados (nada é inventado aqui).
   - "fotos": mostra a foto de um patrimônio e pede o nome entre 4 opções.
   - "onde":  pede o bairro de um patrimônio. Só entram patrimônios cujo ENDEREÇO cadastrado termina no nome
              do bairro, para a resposta nunca contradizer o endereço.
   O id do desafio é "<tipo>-<id da região>" (ex.: fotos-zona-sul) e é o mesmo usado na rota #/quiz/<id>.
   Conclusão: acertar LIMIAR de N perguntas. O XP é concedido só na primeira conclusão (regra em progresso.js). */
(() => {
  'use strict';
  const N = 5, LIMIAR = 3;
  const D = () => window.PARTIU_DATA || { zonas: [], bairros: [], patrimonios: [] };
  const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const temFoto = p => !!p.imagem && typeof (typeof p.imagem === 'string' ? p.imagem : p.imagem.src) === 'string';
  const embaralhar = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const bairro = id => D().bairros.find(b => b.id === id);

  function enderecoConfere(p) {            // o endereço termina no nome do bairro cadastrado
    const b = bairro(p.bairro); if (!b || !p.endereco) return false;
    const fim = norm(String(p.endereco).split(' — ').pop()), nome = norm(b.nome);
    return fim === nome || fim.startsWith(nome + ' ');
  }
  function candidatos(tipo, zonaId) {
    const ids = new Set(D().bairros.filter(b => b.zona === zonaId).map(b => b.id));
    return D().patrimonios.filter(p => ids.has(p.bairro) && (tipo === 'fotos' ? temFoto(p) : enderecoConfere(p)));
  }
  function info(id) {
    const m = /^(fotos|onde)-([\w-]+)$/.exec(String(id || '')); if (!m) return null;
    const z = D().zonas.find(x => x.id === m[2]); if (!z) return null;
    return { id, tipo: m[1], zonaId: z.id, total: N, limiar: LIMIAR, titulo: (m[1] === 'fotos' ? 'Desafio das fotos' : 'Onde fica?') + ' — ' + z.nome };
  }
  const disponivel = id => { const i = info(id); return !!i && candidatos(i.tipo, i.zonaId).length >= N; };
  const lista = zonaId => ['fotos', 'onde'].map(t => t + '-' + zonaId).filter(disponivel).map(info);

  // primeira frase do texto cadastrado, para a explicação (sem cortar no meio)
  function primeiraFrase(txt) {
    const t = String(txt || '').replace(/\s+/g, ' ').trim(); if (!t) return '';
    const m = /^(.{40,260}?[.!?])(\s|$)/.exec(t);
    return m ? m[1] : (t.length <= 260 ? t : '');
  }
  function explicacao(p) {
    const b = bairro(p.bairro);
    const onde = p.endereco ? p.endereco : (b ? b.nome : '');
    return [p.nome + (onde ? ' — ' + onde + '.' : '.'), primeiraFrase(String(p.descricao || '').split(/\n\s*\n/)[0])].filter(Boolean).join(' ');
  }

  function gerar(id) {
    const i = info(id); if (!i) return null;
    const alvos = embaralhar(candidatos(i.tipo, i.zonaId)).slice(0, N);
    const todos = D().patrimonios;
    const perguntas = alvos.map((p, k) => {
      if (i.tipo === 'fotos') {
        const nomes = new Set([p.nome]);
        const mesmos = embaralhar(todos.filter(x => x.id !== p.id && x.bairro && (bairro(x.bairro) || {}).zona === i.zonaId));
        const resto = embaralhar(todos.filter(x => x.id !== p.id));
        [...mesmos, ...resto].forEach(x => { if (nomes.size < 4) nomes.add(x.nome); });
        const opcoes = embaralhar([...nomes]);
        const src = typeof p.imagem === 'string' ? p.imagem : p.imagem.src;
        return { id: id + '-' + k, texto: 'Que lugar aparece na foto?', opcoes, correta: opcoes.indexOf(p.nome), explicacao: explicacao(p), imagem: { src } };
      }
      const b = bairro(p.bairro);
      const outros = embaralhar(D().bairros.filter(x => x.id !== b.id && D().patrimonios.some(q => q.bairro === x.id)));
      const noMesmo = outros.filter(x => x.zona === b.zona), fora = outros.filter(x => x.zona !== b.zona);
      const nomes = [b.nome];
      [...noMesmo, ...fora].forEach(x => { if (nomes.length < 4 && nomes.indexOf(x.nome) < 0) nomes.push(x.nome); });
      const opcoes = embaralhar(nomes);
      return { id: id + '-' + k, texto: 'Em qual bairro fica “' + p.nome + '”?', opcoes, correta: opcoes.indexOf(b.nome), explicacao: explicacao(p) };
    });
    return { titulo: i.titulo, perguntas, desafio: i };
  }

  window.PARTIU_DESAFIOS = { N, LIMIAR, info, disponivel, lista, gerar };
})();
