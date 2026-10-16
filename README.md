# PARTIU?

Plataforma gamificada de exploração do patrimônio histórico e cultural do Rio de Janeiro.
Site estático: HTML, CSS, JavaScript puro, dados locais e `localStorage`. Sem backend, banco de dados ou autenticação real.

## Como abrir
Abra `index.html` no navegador (duplo clique funciona). Leaflet e as fontes agora são **locais** (`assets/vendor`, `assets/fonts`);
só o mapa-base (tiles CARTO/OpenStreetMap) precisa de internet. Sem internet, marcadores, lista e o jogo continuam funcionando.

## Estrutura
- `index.html` — página única; telas são desenhadas por JS e escolhidas por rota (`#/inicio`, `#/explorar`, `#/missoes`, `#/perfil`,
  `#/regiao/<id>`, `#/bairro/<id>`, `#/patrimonio/<id>`, `#/quiz/<id>`). O botão "voltar" do navegador funciona.
- `mapa.html` — mapa em tela cheia (mesmos dados e progresso).
- `css/style.css` — paleta, tipografia e componentes · `css/telas.css` — layouts das telas · `css/mapa.css` — Explorar e Leaflet.
- `js/patrimonios-data.js` — **todo o conteúdo** (zonas, bairros, patrimônios, quizzes). O esquema de campos está comentado no topo do arquivo.
- `js/progresso.js` — regras de XP, níveis, desbloqueios, estados das missões, conquistas e persistência.
- `js/navegacao.js` — roteador · `js/ui.js` — componentes (foto, etiquetas, diálogo, toast) · `js/app.js` — telas · `js/explorar.js` — busca/filtros/lista/mapa · `js/mapa.js` — controlador Leaflet · `js/mapa-pagina.js` — mapa.html.
- `tests/e2e.py` — testes de ponta a ponta (Playwright). `CONTEUDO-PENDENTE.md` — o que falta cadastrar.

## Identidade visual
Paleta original em `:root` de `css/style.css` (`--creme #F4EBDD`, `--terracota #B65F45`, `--dourado #D5A84B`, `--oliva #65735A`, `--marrom #3D3028`);
todo o resto é derivado dela. A logo é sempre o arquivo original `assets/capa-badge.jpg` (sem filtros, proporção 1:1, recorte circular que
acompanha o contorno do próprio selo, como já era na versão anterior).

## Regras de jogo
- Visita a um patrimônio: +10 XP, só na primeira vez (confirmação manual; o app não usa GPS). Bairro concluído: +50 XP. Quiz: +10 XP por acerto, só na primeira conclusão.
- Nível = 1 + XP ÷ 100. XP, nível e estados são calculados a partir do que está salvo.
- Um bairro libera o próximo da região; uma região libera a seguinte quando todos os seus bairros e o quiz estão concluídos.
- **Bairros e regiões sem patrimônios cadastrados ficam "em breve"**: não bloqueiam a sequência e não contam para a conclusão.
- Estados exibidos: disponível, em andamento, concluída, bloqueada, em breve.

## Como acrescentar conteúdo e fotos
Edite só `js/patrimonios-data.js`. Para uma foto: copie o arquivo para `assets/img/`, preencha `imagem: { src, alt, credito, licenca, fonte }`.
Sem foto, a interface mostra "foto a cadastrar" (nunca uma imagem genérica). Texto histórico, importância, curiosidades, categoria, endereço e fontes
só aparecem quando preenchidos; filtros de região/bairro/categoria surgem sozinhos quando houver opções. Para uma foto de capa, defina `PARTIU_DATA.hero`.

## Testes
`pip install playwright && playwright install chromium && python3 tests/e2e.py`

## Limitações
O progresso fica só neste navegador (pode ser apagado) e não há sincronização entre aparelhos nem senha. "Sair" encerra a sessão, mas o progresso continua salvo.
