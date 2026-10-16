"""PARTIU? — testes de ponta a ponta (Playwright + Chromium) sobre os arquivos locais (file://).
Uso:  pip install playwright && playwright install chromium && python3 tests/e2e.py
Os tiles do mapa-base precisam de internet e são bloqueados nos testes; marcadores e lógica são testados."""
import pathlib, re, sys, hashlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = 'file://' + str(ROOT / 'index.html')
res = []
def check(nome, cond, extra=''):
    res.append((bool(cond), nome)); print(('PASS ' if cond else 'FAIL ') + nome + (('  -> ' + str(extra)) if (extra and not cond) else ''))

# Dados extras para testar filtros e bloqueios (somente nos testes)
FIXTURE = """
window.PARTIU_DATA.bairros.push({id:'ipanema-teste',nome:'Ipanema Teste',zona:'zona-sul',resumo:null,imagem:null});
window.PARTIU_DATA.patrimonios.push({id:'teste-1',nome:'Lugar de Teste Um',bairro:'ipanema-teste',lat:-22.9840,lng:-43.2040,demo:false,categoria:'Praça',descricao:'Primeiro parágrafo de teste.\\n\\nSegundo parágrafo.',importancia:null,curiosidades:['Curiosidade A','Curiosidade B'],endereco:'Rua de Teste, 1',imagem:null,fontes:[{titulo:'Fonte de teste',url:'https://example.org'}]});
"""

def novo(p, w=1280, h=900, fixture=False, ctxkw=None):
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width': w, 'height': h}, **(ctxkw or {})); pg = ctx.new_page()
    pg.errs = []
    pg.on('pageerror', lambda e: pg.errs.append(str(e)))
    pg.route(re.compile(r'.*(openmaps\.fr|openstreetmap\.org|cartocdn\.com).*'), lambda r: r.abort())
    if fixture:
        def inj(r):
            body = (ROOT / 'js/patrimonios-data.js').read_text() + FIXTURE
            r.fulfill(body=body, content_type='application/javascript')
        pg.route('**/js/patrimonios-data.js', inj)
    return b, pg

def criar_perfil(pg, nome='Ana'):
    pg.goto(URL); pg.click('text=Começar a explorar'); pg.fill('#partiu-signup-name', nome); pg.click('text=Começar a jornada'); pg.wait_for_selector('#scr-inicio.on')

def buscar(pg, texto):
    pg.fill('#ex-busca', texto); pg.wait_for_timeout(300)     # a busca tem debounce de 120 ms

def xp(pg): return pg.evaluate('window.PARTIU_PROGRESS.stats().xp')
def tela(pg):
    pg.wait_for_timeout(150)      # a rota muda de forma assíncrona (hashchange)
    return pg.evaluate('document.body.dataset.screen')

with sync_playwright() as p:
    # ---- 1. acesso e perfil
    b, pg = novo(p); pg.goto(URL)
    check('capa abre sem sessão', tela(pg) == 'scr-capa')
    pg.click('text=Começar a explorar'); check('rota #/criar', tela(pg) == 'scr-criar')
    pg.fill('#partiu-signup-name', 'A'); pg.click('text=Começar a jornada')
    check('apelido curto mostra erro e não entra', 'pelo menos 2' in pg.inner_text('#signup-error') and tela(pg) == 'scr-criar')
    pg.fill('#partiu-signup-name', 'Ana'); pg.click('text=Começar a jornada'); pg.wait_for_selector('#scr-inicio.on')
    check('perfil criado leva ao início', tela(pg) == 'scr-inicio')
    check('novo usuário vê "primeira missão" e não vê XP vazio', 'primeira missão' in pg.inner_text('#scr-inicio').lower() and pg.is_hidden('#xp-chip'))
    pg.reload(); check('sessão persiste após recarregar', tela(pg) == 'scr-inicio')
    # ---- 2. navegação principal e botão voltar
    for nome, alvo in [('Explorar', 'scr-explorar'), ('Missões', 'scr-missoes'), ('Início', 'scr-inicio')]:
        pg.click(f'.app-nav >> text={nome}'); check(f'aba {nome} responde', tela(pg) == alvo)
    pg.click('.regiao-card >> nth=0'); check('região com conteúdo abre', tela(pg) == 'scr-regiao')
    pg.click('.bairro-card >> text=Copacabana'); check('bairro abre', tela(pg) == 'scr-bairro')
    pg.click('.etapa__nome >> nth=0'); check('patrimônio abre', tela(pg) == 'scr-patrimonio')
    pg.go_back(); check('botão voltar do navegador volta ao bairro', tela(pg) == 'scr-bairro')
    pg.go_back(); check('voltar de novo volta à região', tela(pg) == 'scr-regiao')
    pg.go_to = None
    pg.evaluate("location.hash='#/inicio'")
    check('regiões sem conteúdo não são links', pg.locator('a.regiao-card').count() == 1 and pg.locator('div.regiao-card--em-breve').count() == 4)
    pg.evaluate("location.hash='#/bairro/ipanema'"); pg.wait_for_timeout(100)
    check('bairro sem patrimônios aparece vazio e não quebra', 'ainda não foram cadastrados' in pg.inner_text('#scr-bairro'))
    pg.evaluate("location.hash='#/patrimonio/nao-existe'"); pg.wait_for_timeout(100)
    check('patrimônio inexistente mostra mensagem', 'não encontrado' in pg.inner_text('#scr-patrimonio'))
    pg.evaluate("location.hash='#bairro=copacabana'"); pg.wait_for_timeout(100)
    check('formato antigo #bairro= continua funcionando', tela(pg) == 'scr-bairro')
    # ---- 3. visita, XP, sem repetição
    pg.click('#scr-bairro .etapa >> nth=0 >> text=Confirmar visita'); pg.wait_for_timeout(200)
    check('visita rende +10 XP e atualiza o chip', xp(pg) == 10 and 'Nível 1 · 10 XP' in pg.inner_text('#xp-chip'))
    check('primeira etapa fica concluída e a próxima vira atual', pg.locator('.etapa--ok').count() == 1 and pg.locator('.etapa--atual').count() == 1)
    check('toast de XP', '+10 XP' in pg.inner_text('#toast'))
    check('visita repetida não dá XP', pg.evaluate("PARTIU_PROGRESS.visitar('forte-copacabana').xp") == 0 and xp(pg) == 10)
    check('conquista "Primeiro passo" concedida', pg.evaluate("PARTIU_PROGRESS.stats().conquistas.find(c=>c.id==='primeiro-passo').obtida"))
    pg.reload(); check('progresso persiste após recarregar', xp(pg) == 10)
    pg.evaluate("location.hash='#/patrimonio/praia-copacabana'"); pg.click('.card--missao >> text=Confirmar visita'); pg.wait_for_timeout(150)
    check('visita pela página do patrimônio', xp(pg) == 20 and pg.locator('.card--missao >> text=Você já visitou').count() == 1)
    # ---- 4. concluir bairro, quiz, região
    for pid in ['copacabana-palace', 'rua-santa-clara', 'posto-6', 'igreja-copacabana', 'calcadao', 'cinelandia-copa', 'parque-garota']:
        pg.evaluate(f"PARTIU_PROGRESS.visitar('{pid}')")
    pg.evaluate("location.hash='#/bairro/copacabana'"); pg.wait_for_timeout(150)
    pg.click('#scr-bairro .btn-primary >> text=Confirmar visita'); pg.wait_for_selector('dialog[open]')
    check('diálogo de bairro concluído', 'bairro concluído' in pg.inner_text('dialog').lower())
    check('XP total correto (10 visitas + bônus 50)', xp(pg) == 150, xp(pg))
    check('diálogo oferece o quiz (próximo passo da região)', pg.locator('dialog >> text=Fazer o quiz').count() == 1)
    pg.click('dialog >> text=Fazer o quiz'); check('vai ao quiz', tela(pg) == 'scr-quiz')
    pg.click('.quiz-opt:has-text("Forte de Copacabana")'); pg.click('text=Confirmar resposta')
    pg.wait_for_selector('.quiz-feedback.ok, .quiz-feedback.no')
    correta = pg.locator('.quiz-opt.ok .quiz-opt__txt').inner_text()
    check('quiz avalia e mostra a correta', correta == 'Forte de Copacabana', correta)
    pg.click('text=Ver resultado'); pg.wait_for_selector('dialog[open]')
    check('resultado e região concluída', 'concluída' in pg.inner_text('dialog').lower())
    pg.click('dialog >> text=Fechar')
    s = pg.evaluate('PARTIU_PROGRESS.stats()')
    check('XP final = 150 + 10 do quiz', s['xp'] == 160 and s['zonas'] == 1, s)
    check('todas as 5 conquistas obtidas', all(c['obtida'] for c in s['conquistas']))
    pg.click('text=Refazer (sem XP)'); pg.click('.quiz-opt:has-text("Paço Imperial")'); pg.click('text=Confirmar resposta'); pg.click('text=Ver resultado'); pg.wait_for_timeout(200)
    check('refazer quiz não dá XP novamente', xp(pg) == 160 and 'não gera XP' in pg.inner_text('#quiz-card'))
    pg.evaluate("location.hash='#/missoes'"); pg.wait_for_timeout(100)
    check('missões mostram tudo concluído', pg.locator('.missao--concluido').count() == 2 and pg.locator('.missao--disponivel,.missao--andamento').count() == 0)
    pg.click('.chip >> text=Concluídas'); check('filtro de missões "Concluídas"', pg.locator('.missao').count() == 2)
    pg.click('.chip >> text=Bloqueadas'); check('filtro "Bloqueadas" vazio', pg.locator('.missao').count() == 0 and 'Nenhuma missão' in pg.inner_text('#scr-missoes'))
    pg.evaluate("location.hash='#/inicio'"); pg.wait_for_timeout(100)
    check('início sem próximo passo mostra mensagem de conclusão', 'concluiu tudo' in pg.inner_text('#scr-inicio').lower())
    check('erros JS no fluxo 1-4', not pg.errs, pg.errs)
    # ---- 5. perfil, sair, reiniciar
    pg.click('.app-nav >> [data-nav="scr-perfil"]'); pg.wait_for_timeout(200); check('perfil exibe nível/XP', 'Nível 2' in pg.inner_text('#scr-perfil'))
    pg.click('#scr-perfil >> text=Sair'); check('sair vai à capa', tela(pg) == 'scr-capa')
    pg.reload(); check('após sair e recarregar continua na capa', tela(pg) == 'scr-capa' and pg.locator('text=Continuar como Ana').count() == 1)
    pg.evaluate("location.hash='#/explorar'"); pg.wait_for_timeout(100)
    check('rota interna sem sessão é redirecionada', tela(pg) in ('scr-acesso', 'scr-capa'))
    pg.evaluate("location.hash='#/capa'"); pg.wait_for_timeout(100)
    pg.click('text=Continuar como Ana'); check('continuar restaura a sessão com o progresso', tela(pg) == 'scr-inicio' and xp(pg) == 160)
    pg.evaluate("location.hash='#/perfil'"); pg.click('text=Reiniciar progresso'); pg.click('dialog >> text=Apagar progresso'); pg.wait_for_timeout(200)
    check('reiniciar zera XP e mantém o apelido', xp(pg) == 0 and pg.evaluate('PARTIU_PROGRESS.perfil().nome') == 'Ana')
    b.close()

    # ---- 6. Explorar: busca, filtros, sincronização lista/mapa
    b, pg = novo(p); criar_perfil(pg); pg.evaluate("location.hash='#/explorar'"); pg.wait_for_selector('.partiu-pin')
    check('mapa mostra só os 3 itens com coordenadas', pg.locator('.partiu-pin').count() == 3 and '10 patrimônios · 3 no mapa' in pg.inner_text('.ex-cont'))
    check('marcadores aproximados são tracejados', pg.locator('.partiu-pin--aprox').count() == 3)
    buscar(pg, 'forte'); check('busca por nome filtra lista e mapa', pg.locator('.item').count() == 1 and pg.locator('.partiu-pin').count() == 1)
    buscar(pg, 'zzzz'); check('busca sem resultado mostra estado vazio', pg.is_visible('.ex-vazio'))
    pg.click('.ex-vazio >> text=Limpar filtros'); check('limpar filtros restaura', pg.locator('.item').count() == 10)
    buscar(pg, 'praça'); buscar(pg, 'copa'); check('busca acentos/maiúsculas (bairro)', pg.locator('.item').count() == 10)
    buscar(pg, '')
    pg.fill('#ex-busca', 'zzzz'); pg.fill('#ex-busca', 'copa'); pg.fill('#ex-busca', ''); pg.wait_for_timeout(600)
    check('regressão: digitação rápida não deixa o mapa no zoom errado (≥ 13)', pg.evaluate('PARTIU_EXPLORAR._mapa().map.getZoom()') >= 13)
    pg.wait_for_timeout(900)      # deixa a animação de enquadramento do mapa terminar
    pg.locator('.partiu-pin[title^="Copacabana Palace"]').click(); pg.wait_for_timeout(250)
    check('mapa → lista: item correspondente destacado e cartão aberto', 'Copacabana Palace' in pg.inner_text('.item--sel') and 'Copacabana Palace' in pg.inner_text('.sel-card'))
    pg.click('.sel-card__x'); check('fechar o cartão limpa a seleção', pg.locator('.item--sel').count() == 0 and pg.is_hidden('.sel-card'))
    pg.click('.item >> nth=1 >> .item__main'); pg.wait_for_timeout(300)
    check('lista → mapa: marcador selecionado e cartão aberto', pg.locator('.partiu-pin--sel').count() == 1 and pg.is_visible('.sel-card') and 'Praia de Copacabana' in pg.inner_text('.sel-card'))
    pg.click('.sel-card >> text=Ver patrimônio'); check('cartão abre o patrimônio', tela(pg) == 'scr-patrimonio' and 'Praia de Copacabana' in pg.inner_text('#scr-patrimonio h1'))
    pg.click('#scr-patrimonio >> text=Ver no mapa'); pg.wait_for_selector('.partiu-pin--sel')
    check('"Ver no mapa" chega com o item selecionado', 'Praia de Copacabana' in pg.inner_text('.item--sel'))
    pg.click('.item >> nth=4 >> .item__main'); pg.wait_for_timeout(150)
    check('item sem coordenadas: aviso e sem cartão/marcador', pg.is_hidden('.sel-card') and 'não foi cadastrada' in pg.inner_text('.item--sel') and pg.locator('.partiu-pin--sel').count() == 0)
    pg.evaluate("PARTIU_PROGRESS.visitar('forte-copacabana')"); pg.wait_for_timeout(100)
    check('marcador do explorado muda de cor', pg.locator('.partiu-pin--done').count() == 1)
    pg.click('.chip:text-is("Explorados")'); check('filtro "Explorados"', pg.locator('.item').count() == 1 and pg.locator('.partiu-pin').count() == 1)
    pg.click('.chip >> text=Ainda não explorados'); check('filtro "Ainda não explorados"', pg.locator('.item').count() == 9)
    check('filtros de região/bairro/categoria ocultos quando não há opções', all(pg.is_hidden(s) for s in ['#ex-zona', '#ex-bairro', '#ex-categoria']))
    check('erros JS no Explorar', not pg.errs, pg.errs)
    b.close()

    # ---- 7. filtros por região/bairro/categoria e bloqueio (dados de teste com 2 bairros)
    b, pg = novo(p, fixture=True); criar_perfil(pg)
    pg.evaluate("location.hash='#/explorar'"); pg.wait_for_selector('.partiu-pin')
    check('com 2 bairros com conteúdo, filtro de bairro e categoria aparecem', pg.is_visible('#ex-bairro') and pg.is_visible('#ex-categoria'))
    pg.select_option('#ex-bairro', 'ipanema-teste'); check('filtro por bairro', pg.locator('.item').count() == 1 and pg.locator('.partiu-pin').count() == 1)
    pg.select_option('#ex-bairro', ''); pg.select_option('#ex-categoria', 'Praça'); check('filtro por categoria', pg.locator('.item').count() == 1)
    pg.select_option('#ex-categoria', ''); check('filtros combinam com busca', (buscar(pg, 'teste') or True) and pg.locator('.item').count() == 1)
    buscar(pg, '')
    pg.evaluate("location.hash='#/bairro/ipanema-teste'"); pg.wait_for_timeout(150)
    check('bairro seguinte começa bloqueado', pg.locator('.etapa--bloq').count() == 1 and pg.locator('#scr-bairro >> text=Confirmar visita').count() == 0)
    check('visita em bairro bloqueado é recusada', pg.evaluate("PARTIU_PROGRESS.visitar('teste-1').bloqueado") is True and xp(pg) == 0)
    pg.evaluate("location.hash='#/regiao/zona-sul'"); pg.wait_for_timeout(100); pg.click('a.bairro-card--bloqueado'); 
    check('card bloqueado explica o motivo', 'conclua Copacabana' in pg.inner_text('#toast') and tela(pg) == 'scr-regiao')
    ids = pg.evaluate("PARTIU_DATA.patrimonios.filter(p=>p.bairro==='copacabana').map(p=>p.id)")
    for i in ids: pg.evaluate(f"PARTIU_PROGRESS.visitar('{i}')")
    check('concluir Copacabana libera o próximo bairro', pg.evaluate("PARTIU_PROGRESS.estadoBairro('ipanema-teste')") == 'disponivel')
    pg.evaluate("location.hash='#/patrimonio/teste-1'"); pg.wait_for_timeout(150)
    t = pg.inner_text('#scr-patrimonio')
    check('página do patrimônio mostra texto, curiosidades, fonte e lacunas', 'Primeiro parágrafo' in t and 'Curiosidade B' in t and 'Fonte de teste' in t and 'importância cultural deste patrimônio ainda não foi cadastrada' in t)
    check('rótulo "foto a cadastrar" (sem foto enganosa)', pg.locator('.pat-hero .foto--vazia').count() == 1 and pg.locator('.pat-hero img.pat-hero__foto, .pat-hero .foto img').count() == 0)
    check('erros JS com dados de teste', not pg.errs, pg.errs)
    b.close()

    # ---- 8. mapa em tela cheia
    b, pg = novo(p); pg.goto('file://' + str(ROOT / 'mapa.html')); pg.wait_for_selector('.partiu-pin')
    check('mapa.html mostra 3 marcadores', pg.locator('.partiu-pin').count() == 3)
    pg.locator('.partiu-pin').first.click(); pg.wait_for_selector('.leaflet-popup')
    check('popup com link para o patrimônio', pg.locator('.leaflet-popup a.link').count() == 1 and 'index.html#/patrimonio/' in pg.get_attribute('.leaflet-popup a.link', 'href'))
    check('erros JS em mapa.html', not pg.errs, pg.errs); b.close()

    # ---- 9. dados corrompidos e integridade da logo
    b, pg = novo(p); pg.goto(URL)
    pg.evaluate("localStorage.setItem('partiu.progresso.v1','{{{nao-json'); localStorage.setItem('partiu.sessao.v1','1')"); pg.reload()
    check('localStorage corrompido não quebra o app', tela(pg) == 'scr-capa' and not pg.errs, pg.errs)
    pg.evaluate("localStorage.setItem('partiu.progresso.v1', JSON.stringify({perfil:{nome:'Zé'},visitados:{'x-falso':1,'posto-6':1},quizzes:{'zona-sul':{acertos:99}},conquistas:{'inexistente':1}}))"); pg.reload()
    s = pg.evaluate('PARTIU_PROGRESS.stats()')
    check('dados inválidos são descartados (ids falsos, acertos acima do total)', s['visitas'] == 1 and s['quizzes'] == 1 and s['xp'] == 20, s)
    orig = hashlib.sha256((ROOT / 'assets/capa-badge.jpg').read_bytes()).hexdigest()
    check('logo oficial: arquivo idêntico ao original enviado', orig == hashlib.sha256(open('/home/claude/PARTIU_original_backup/assets/capa-badge.jpg','rb').read()).hexdigest())
    b.close()

    # ---- 10. responsividade e acessibilidade em 3 larguras
    rotas = ['#/inicio', '#/explorar', '#/missoes', '#/bairro/copacabana', '#/patrimonio/forte-copacabana', '#/regiao/zona-sul', '#/quiz/zona-sul', '#/perfil']
    for w, h in [(375, 800), (768, 1024), (1280, 800)]:
        b, pg = novo(p, w, h); criar_perfil(pg)
        ruins = []; semnome = []; logo_dist = []
        for r in rotas + ['#/capa']:
            pg.evaluate(f"location.hash='{r}'"); pg.wait_for_timeout(250)
            if pg.evaluate('document.documentElement.scrollWidth > innerWidth + 1'): ruins.append(r)
            semnome += pg.evaluate("""[...document.querySelectorAll('.screen.on button, .screen.on a, .app-head a')].filter(e=>e.offsetParent!==null && !(e.innerText||'').trim() && !e.getAttribute('aria-label') && !e.querySelector('.sr-only, img[alt]')).map(e=>e.outerHTML.slice(0,80))""")
            semnome += pg.evaluate("[...document.querySelectorAll('img:not([alt])')].map(e=>e.src)")
            logo_dist += pg.evaluate("[...document.querySelectorAll('img[src$=\"capa-badge.jpg\"]')].filter(i=>i.offsetParent!==null).map(i=>Math.abs(i.getBoundingClientRect().width-i.getBoundingClientRect().height)).filter(d=>d>0.6)")
        check(f'{w}px: sem rolagem horizontal em nenhuma tela', not ruins, ruins)
        check(f'{w}px: botões/links com nome acessível e imagens com alt', not semnome, semnome[:3])
        check(f'{w}px: logo mantém proporção 1:1', not logo_dist, logo_dist)
        if w == 375:
            pequenos = pg.evaluate("""(()=>{location.hash='#/bairro/copacabana';return new Promise(r=>setTimeout(()=>r([...document.querySelectorAll('.screen.on .btn, .app-nav a')].filter(e=>e.offsetParent!==null).map(e=>e.getBoundingClientRect()).filter(b=>b.height<39.5).length),250))})()""")
            check('375px: alvos de toque principais com ≥ 40px de altura', pequenos == 0, pequenos)
            vis = pg.evaluate("(()=>{const n=document.querySelector('.app-nav').getBoundingClientRect();return n.bottom>=innerHeight-1&&n.height>40})()")
            check('375px: navegação principal vira barra inferior', vis)
        check(f'{w}px: sem erros JS', not pg.errs, pg.errs)
        b.close()

    # ---- 11. movimento reduzido e teclado
    b, pg = novo(p, ctxkw={'reduced_motion': 'reduce'}); criar_perfil(pg)
    check('reduced-motion: transições desativadas', pg.evaluate("getComputedStyle(document.querySelector('.bar i')||document.body).transitionDuration") in ('0s', ''))
    pg.evaluate("location.hash='#/bairro/copacabana'"); pg.wait_for_timeout(150)
    pg.focus('[data-key="visit-forte-copacabana"]'); pg.keyboard.press('Enter'); pg.wait_for_timeout(250)
    check('teclado: Enter confirma visita e o foco não se perde', xp(pg) == 10 and pg.evaluate("document.activeElement && document.activeElement.tagName") in ('A', 'BUTTON'))
    pg.evaluate("location.hash='#/quiz/zona-sul'"); pg.wait_for_timeout(150)
    pg.keyboard.press('Tab'); pg.focus('.quiz-opt input'); pg.keyboard.press('Space'); pg.wait_for_timeout(50)
    check('teclado: quiz responde com Espaço', pg.locator('.quiz-opt input:checked').count() == 1 and pg.is_enabled('text=Confirmar resposta'))
    b.close()

ok = sum(1 for r in res if r[0]); print(f'\n{ok}/{len(res)} verificações passaram'); sys.exit(0 if ok == len(res) else 1)