"""Teste de fumaça do PARTIU? — não depende de quais patrimônios estão cadastrados.
Uso:  pip install playwright && playwright install chromium && python3 tests/smoke.py
Verifica: integridade dos dados, ausência de erros de JavaScript, rolagem horizontal, alvos de toque,
fluxo de visita/XP/persistência, falha de carregamento dos dados e armazenamento indisponível.
Os mosaicos do mapa vêm da internet e são bloqueados aqui de propósito (o jogo deve funcionar sem eles)."""
import pathlib, re, sys
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = 'file://' + str(ROOT / 'index.html')
TILES = re.compile(r'.*(openmaps\.fr|openstreetmap\.org|cartocdn\.com).*')
falhas = []


def check(nome, ok, extra=''):
    print(('PASS ' if ok else 'FAIL ') + nome + ('' if ok else ' -> ' + str(extra)))
    if not ok:
        falhas.append(nome)


def nova_pagina(browser, w=1280, h=900, init=None):
    pg = browser.new_context(viewport={'width': w, 'height': h}).new_page()
    erros = []
    pg.on('pageerror', lambda e: erros.append(str(e)))
    pg.route(TILES, lambda r: r.abort())
    if init:
        pg.add_init_script(init)
    return pg, erros


def ir(pg, rota, espera=350):
    pg.evaluate("location.hash='#/%s'" % rota)
    pg.wait_for_timeout(espera)


with sync_playwright() as p:
    b = p.chromium.launch()

    # 1. dados ---------------------------------------------------------------------------------
    pg, erros = nova_pagina(b)
    pg.goto(URL)
    D = pg.evaluate('PARTIU_DATA')
    ps, bs, zs = D['patrimonios'], D['bairros'], D['zonas']
    ids = [x['id'] for x in ps]
    check('ids de patrimônios únicos', len(ids) == len(set(ids)))
    check('todo patrimônio aponta para um bairro existente', all(x['bairro'] in {y['id'] for y in bs} for x in ps))
    check('fotos externas trazem autor, licença e fonte',
          all(x['imagem'].get('credito') and x['imagem'].get('licenca') and x['imagem'].get('fonte') for x in ps if isinstance(x.get('imagem'), dict) and x['imagem']['src'].startswith('https://')))
    check('todo bairro aponta para uma região existente', all(x['zona'] in {y['id'] for y in zs} for x in bs))
    check('lat/lng sempre em par', all((x['lat'] is None) == (x['lng'] is None) for x in ps))
    check('fotos locais cadastradas existem em disco', all((ROOT / x['imagem']['src']).exists() for x in ps if isinstance(x.get('imagem'), dict) and not x['imagem']['src'].startswith('https://')))
    check('cada região com quiz aponta para um quiz existente', all(z['quiz'] in D['quizzes'] for z in zs if z.get('quiz')))
    check('quizzes: resposta correta dentro das opções',
          all(0 <= q['correta'] < len(q['opcoes']) for v in D['quizzes'].values() for q in v['perguntas']))

    # 2. telas, larguras, erros de JS ----------------------------------------------------------
    z = next(z for z in zs if any(x['bairro'] == b_['id'] for b_ in bs if b_['zona'] == z['id'] for x in ps))
    bairro = next(x for x in bs if x['zona'] == z['id'] and any(p_['bairro'] == x['id'] for p_ in ps))
    pat = next(x for x in ps if x['bairro'] == bairro['id'])
    quiz = z.get('quiz')
    rotas = ['inicio', 'explorar', 'missoes', 'perfil', 'regiao/' + z['id'], 'bairro/' + bairro['id'], 'patrimonio/' + pat['id']]
    if quiz:
        rotas.append('quiz/' + quiz)
    rotas += ['regiao/nao-existe', 'patrimonio/nao-existe']
    for w, h in [(320, 640), (390, 800), (768, 900), (1280, 900)]:
        pg, erros = nova_pagina(b, w, h)
        pg.goto(URL)
        pg.evaluate("PARTIU_PROGRESS.criarPerfil('Teste')")
        ruins = []
        for r in rotas:
            ir(pg, r, 1200 if r == 'explorar' else 350)
            sw = pg.evaluate('document.documentElement.scrollWidth')
            vw = pg.evaluate('document.documentElement.clientWidth')
            fora = pg.evaluate("""()=>{const vw=document.documentElement.clientWidth;return [...document.querySelectorAll('.screen.on *')]
              .filter(e=>{const s=getComputedStyle(e);if(s.display==='none'||s.visibility==='hidden')return false;const r=e.getBoundingClientRect();
                return r.width&&r.right>vw+1&&!e.closest('.leaflet-container')}).length}""")
            if sw > vw + 1 or fora:
                ruins.append((r, sw, vw, fora))
        check('%dpx: sem rolagem horizontal nem conteúdo fora da tela' % w, not ruins, ruins)
        check('%dpx: sem erros de JavaScript' % w, not erros, erros[:3])
        if w <= 768:
            ir(pg, 'bairro/' + bairro['id'])
            baixo = pg.evaluate("[...document.querySelectorAll('.etapa__nome')].filter(e=>e.getBoundingClientRect().height<43.5).length")
            check('%dpx: links das etapas com alvo de toque ≥ 44px' % w, baixo == 0, baixo)

    # 3. visita, XP e persistência -------------------------------------------------------------
    pg, erros = nova_pagina(b)
    pg.goto(URL)
    pg.evaluate("PARTIU_PROGRESS.criarPerfil('Teste')")
    alvo = pg.evaluate("(()=>{const p=PARTIU_PROGRESS.proximoPasso();return p&&p.patrimonio?p.patrimonio.id:null})()")
    check('há uma próxima etapa para um perfil novo', bool(alvo))
    if alvo:
        ir(pg, 'patrimonio/' + alvo)
        pg.click('#scr-patrimonio button:has-text("Confirmar visita")')
        pg.wait_for_timeout(300)
        xp = pg.evaluate('PARTIU_PROGRESS.stats().xp')
        check('primeira visita rende +10 XP', xp == 10, xp)
        check('visita repetida não rende XP', pg.evaluate("PARTIU_PROGRESS.visitar('%s').xp" % alvo) == 0)
        pg.reload()
        check('progresso persiste após recarregar', pg.evaluate('PARTIU_PROGRESS.stats().xp') == 10)
    check('sem aviso de armazenamento quando salva normalmente', not pg.locator('#aviso-armazenamento').is_visible())

    # 4. quiz (se houver) ----------------------------------------------------------------------
    if quiz:
        pg.evaluate("""()=>{const k='partiu.progresso.v1',s=JSON.parse(localStorage.getItem(k));
          PARTIU_DATA.patrimonios.forEach(p=>{if(PARTIU_DATA.bairros.find(b=>b.id===p.bairro&&b.zona==='%s'))s.visitados[p.id]=Date.now()});
          localStorage.setItem(k,JSON.stringify(s))}""" % z['id'])
        pg.reload()
        ir(pg, 'quiz/' + quiz, 500)
        t = pg.inner_text('#quiz-card')
        check('ficha da missão mostra objetivo, critério e recompensa', all(k in t for k in ['Objetivo', 'Para concluir', 'Recompensa']), t[:120])
        pg.click('#quiz-card button:has-text("Começar")')
        n = len(D['quizzes'][quiz]['perguntas'])
        for _ in range(n):
            pg.click('.quiz-opt >> nth=0')
            pg.click('text=Confirmar resposta')
            pg.click('#quiz-card .btn-primary')
            pg.wait_for_timeout(60)
        txt = pg.inner_text('#quiz-card')
        check('quiz percorre todas as perguntas e mostra o resultado', 'Você acertou' in txt, txt[:80])
        antes = pg.evaluate('PARTIU_PROGRESS.stats().xp')
        r = pg.evaluate("PARTIU_PROGRESS.concluirQuiz('%s', 1)" % quiz)
        check('refazer o quiz não rende XP de novo', r.get('repetido') is True and pg.evaluate('PARTIU_PROGRESS.stats().xp') == antes, r)

    # 4b. regiões livres e desafios extras -----------------------------------------------------------
    com_conteudo = [x['id'] for x in zs if any(b_['zona'] == x['id'] and any(p_['bairro'] == b_['id'] for p_ in ps) for b_ in bs)]
    check('todas as regiões com conteúdo estão liberadas desde o início',
          all(pg.evaluate("PARTIU_PROGRESS.zonaDesbloqueada('%s')" % x) for x in com_conteudo))
    ds = pg.evaluate("PARTIU_DATA.zonas.flatMap(z=>PARTIU_DESAFIOS.lista(z.id).map(d=>d.id))")
    if ds:
        d0 = ds[0]
        ruim = pg.evaluate("""(id)=>{const bad=[];for(let k=0;k<30;k++){const g=PARTIU_DESAFIOS.gerar(id);
            if(g.perguntas.length!==5)bad.push('n');g.perguntas.forEach(q=>{if(new Set(q.opcoes).size!==4||q.correta<0||q.correta>3)bad.push(q.texto)})}return bad}""", d0)
        check('desafio gera 5 perguntas com 4 opções distintas', not ruim, ruim[:2])
        x0 = pg.evaluate('PARTIU_PROGRESS.stats().xp')
        r1 = pg.evaluate("PARTIU_PROGRESS.concluirQuiz('%s', 2)" % d0)
        check('desafio: abaixo do limiar não conclui nem rende XP', r1.get('falhou') and pg.evaluate('PARTIU_PROGRESS.stats().xp') == x0, r1)
        r2 = pg.evaluate("PARTIU_PROGRESS.concluirQuiz('%s', 4)" % d0)
        check('desafio: no limiar ou acima conclui e rende 10 XP por acerto', r2.get('xp') == 40, r2)
        r3 = pg.evaluate("PARTIU_PROGRESS.concluirQuiz('%s', 5)" % d0)
        check('desafio: repetir não rende XP', r3.get('repetido') and r3['xp'] == 0, r3)
        pg.reload()
        check('desafio concluído persiste após recarregar', pg.evaluate("PARTIU_PROGRESS.estadoDesafio('%s')" % d0) == 'concluido')

    # 5. falhas: dados não carregam / armazenamento recusa gravar --------------------------------
    pg, erros = nova_pagina(b, 390, 800)
    pg.route(re.compile(r'.*patrimonios-data\.js'), lambda r: r.abort())
    pg.goto(URL)
    pg.wait_for_timeout(300)
    check('falha ao carregar os dados mostra mensagem e botão de recarregar',
          'Não foi possível carregar' in pg.inner_text('body') and pg.locator('button:has-text("Recarregar")').count() == 1)

    pg, erros = nova_pagina(b, 390, 800, "Storage.prototype.setItem=function(){throw new DOMException('cheio','QuotaExceededError')}")
    pg.goto(URL)
    pg.click('text=Começar a explorar')
    pg.fill('#partiu-signup-name', 'Teste')
    pg.click('text=Começar a jornada')
    pg.wait_for_selector('#scr-inicio.on')
    check('armazenamento bloqueado: o usuário ainda entra e vê o aviso', pg.locator('#aviso-armazenamento').is_visible())
    check('armazenamento bloqueado: sem erros de JavaScript', not erros, erros[:3])

    b.close()

print('\n%d verificação(ões) falharam.' % len(falhas) if falhas else '\nTudo certo.')
sys.exit(1 if falhas else 0)