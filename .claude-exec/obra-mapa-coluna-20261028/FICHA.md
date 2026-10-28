# Obra: coluna à direita do mapa da TV do box — aberta 28/10/2026

Janela: «P1FAST - coluna à direita do mapa da TV» (território `p1fast-mapa-coluna`).
Arquivo: `_design-reference/mockup-command-box-vista-piloto.html`, branch `claude/tv-box-aovivo-e2-20261027` (HEAD 39b46f63b).
Combinado com a imac-7c (dona da branch e da publicação): commitar direto nesta branch; ela não escreve aqui enquanto a reserva valer.
A imac-9c lê os data-block-id header/video/mapa para a página de prova: NÃO mudar esses ids (se mudar, avisar).
Backup antes de mexer: `mockup-command-box-vista-piloto.html.bak-antes-coluna` (nesta pasta).

## Decisões do Flávio (painel p1fast-mapa-tv-2045, /Users/imac/Downloads/resposta-perguntar-p1fast-mapa-tv-2045.txt)
1. Nada escrito em cima da pista: os dados que estão sobre ela (.tv-consist, círculo G, legenda) vão para uma COLUNA À DIREITA do mapa; reorganizar os blocos vizinhos (passagem, frenagem, carro, vmin) para abrir o espaço.
2. Consistência e "mais longe da média" → bloco do stint.
3. Linha do trecho e "a última perdeu" → descartar a 1ª volta (aquecimento) e a última (resfriamento).
4. "Ideal pelos trechos" → rodapé do quadro de curvas, ao lado da soma.
5. "Melhor" (sempre "—") → quadrado PREMIUM com o melhor tempo de volta e, ao lado, o tempo da última volta.
6. Aplicar na TV de verdade em desenvolvimento, pronta para publicar (publicar só com a frase dele do dia).
Contagens, força G e legenda (itens sem resposta): entram na coluna da direita.

## Medido (só leitura, 28/10, medir-vizinhos.mjs no quadro 1280×720 sem a ampliação 1,5×)
mapa 379–698 × 532–790 · passagem 781–896 × 546–668 · frenagem 781–896 × 675–790 · carro 909–1024 × 546–761 · vmin 1037–1139 × 546–668 · stint 1139–1407 × 546–689 · pneus 1139–1407 × 697–790 · hud 781–1126 × 212–535 · delta-acum 781–1126 × 797–869.

## Antes de dar como pronto
- régua provar-mapa.mjs: 0 pontos da pista cobertos; nada vazando do bloco;
- `npm run smoke:montar-p1box-tv` e `npm run smoke:arquitetura` (pedido da imac-7c);
- regra da arquitetura: conta só no cérebro (web/command-box/cerebro/*), a tela só exibe;
- abrir no navegador e mostrar a ele; montar PACOTE-*.md e entregar a frase.

## RETOMADA 1028-1023
Retomado do passe /Users/imac/.claude/retomadas/20261028-1023-p1fast.md; combinação com imac-9c e imac-7c feita; território reservado.

## Estado 28/10 ~11h (NÃO commitado; nada publicado)
Feito no arquivo da TV (backup antes: mockup-command-box-vista-piloto.html.bak-antes-coluna):
- Passagem/Frenagem left 36% → 46%; Carro → left 56% top 73% 8%×16% (vão embaixo da Vmin; no RaceBox ele só diz "não vem do RaceBox").
- Mapa continua 4,5–29,5% (alargar não cresce a pista: ela é limitada pela altura — medido, pista 396×331 igual).
- Coluna `.b-mapa-dados` (atributo data-tv-mapa-dados, SEM data-block-id: no modo RaceBox todo bloco desconhecido vira "não vem do RaceBox") em left 30,25% top 54% 15,25%×35%, criada no montar() da camada TV-GPS; recebe a faixa de tempos (.map-overlay: TEMPO, DELTA, quadrado MELHOR VOLTA | ÚLTIMA VOLTA; "melhor" histórico escondido), setores, trecho (trecho atual + "perdeu" top 1; "ideal pelos trechos" saiu da TV), contagens (pancadas, repetidas, trocas prov., traseira prov.), círculo G e legenda.
- Consistência e "mais longe" no bloco do stint (PINTA.stint) — o pacote do stint repassa s.consistencia (web/command-box/cerebro/cerebro-tv-blocos-gps.js, backup nesta pasta).
1ª prova (provar-coluna.mjs, antes da correção da coluna): 0 pontos da pista cobertos, 0 erros, consistência no stint OK; coluna NÃO aparecia (data-block-id) e encostava 5 px no velocímetro → corrigido (sem data-block-id, top 54%); falta rodar de novo.
## Falta
1. Rodar provar-coluna.mjs (nesta pasta; servidor 5201) e olhar a foto; ajustar tamanhos (letras ≥ 6,5 no quadro = 9,75 px na tela).
2. Regra das voltas de aquecimento/resfriamento (linha do trecho e "a última perdeu"): o cérebro JÁ não conta a volta de saída do box (voltaN 0 não fecha). Conferir na gravação se a 1ª volta fechada e a última são lentas e como saber que a última foi de resfriamento; se a regra não for objetiva, painel curto para ele.
3. "Ideal pelos trechos" → rodapé do quadro de curvas (o quadro ainda não está na TV; só no protótipo do estudo).
4. npm run smoke:montar-p1box-tv e npm run smoke:arquitetura; smoke do cérebro tests/node-smoke-tv-blocos-gps.mjs.
5. Avisar imac-9c: a página de prova dela esconde [data-block-id] fora de header/video/mapa — a coluna não tem data-block-id, então aparece.
6. Mostrar a ele no navegador, commit na branch, PACOTE-*.md e frase.

## RETOMADA 1028-1038
Retomado do passe /Users/imac/.claude/retomadas/20261028-1038-p1fast.md (mesma janela ttys003, território p1fast-mapa-coluna ainda desta janela). Seguindo "Falta" item 1.

### 28/10 ~11h10 — item 1 (coluna) FEITO
Coluna virou grade: em cima tempos/quadrado premium/setores/trecho de lado a lado; embaixo círculo G | contagens + legenda. Régua provar-coluna.mjs endurecida (corte vertical, coluna estourada, modo --pior com todas as contagens + picos do G, redesenho congelado só no teste). Fim da gravação 21/06 e --pior: 0 pontos cobertos, 0 cortes, 0 fora, 0 erros. Controle: a mesma régua acusou VERTICAL tv-cont 60>53 / COLUNA 270>252 na versão anterior. header×shift-light encavalado já existia no HEAD (medir-encavalados.mjs). Backups: .bak-antes-grade, provar-coluna.mjs.bak-antes-*.

### 28/10 11h08 — item 2 (aquecimento/resfriamento) FEITO e provado
- Cérebro web/command-box/cerebro/cerebro-gps-tv.js (backup cerebro-gps-tv.js.bak-antes-descarte): PARADO_KMH 5, PARADA_S 20, RESFRIA_FRAC 0.25; cada volta ganha `descarte` ('aquecimento' = 1ª fechada depois de parada; 'parada' = volta com a parada dentro; 'resfriamento' = fechou e o carro parou antes de 1/4 da seguinte). Pacote novo `s.trechos.validas` {melhoresS, ultimaN, ultimaTrechos, perdasUltima, descartadas}; campos antigos INTACTOS (blocos/coach seguem com todas as voltas). Sem regra de tempo (cabeçalho do cérebro: sem 107%).
- TV (linhasTrechos) lê s.trechos.validas (backup .bak-antes-descarte). 21/06 real: volta 1 = aquecimento; o "perdeu CURVA 01 +1,38" que a TV mostrava vinha da volta de aquecimento — some.
- tests/node-smoke-gps-tv.mjs: +13 provas (box antes/depois da linha, controle 10 s devagar, controle parada a 95%, 21/06 real); 103 ok / 0 fail; controle: com o cérebro antigo a prova reprova.
- Regressão achada e consertada: rodada anterior encurtou "traseira (provável · giro a conferir)" para "traseira prov." (prova item 9 reprovava) → linha "giro a conferir" de volta, só com giro; prova ajustada ao formato novo.
- provar-coluna.mjs (fim + --pior com giro): 0 cobertos, 0 cortes, 0 fora, 0 erros (gap 4px).
## Falta (atualizado)
1. Item 4 "ideal pelos trechos" → rodapé do quadro de curvas. O quadro SÓ existe no protótipo do estudo (/Users/imac/Projetos/P1 Fast/.claude-exec/estudo-mapa-tv-20261027/prototipo/quadro-curvas.js + comparativo.html, já RESERVADOS por p1fast-mapa-coluna). Plano: (a) cérebro: `validas.voltaIdealS` = soma de melhoresValidos (null se faltar algum) + prova; (b) quadro-curvas.js: campo `idealTrechos` no rodapé ao lado da soma (relogio()); (c) comparativo.html pintaTabela: idealTrechos = tv.contentWindow.__tvGps.snapshot().trechos.validas.voltaIdealS (TV embutida = conta do cérebro; protótipo não conta); medir que o rodapé não encavala a legenda.
2. npm run smoke:montar-p1box-tv e npm run smoke:arquitetura (rodar da raiz do worktree).
3. Avisar imac-9c (SendMessage): coluna nova sem data-block-id aparece na página de prova dela; ids header/video/mapa não mudaram.
4. Abrir a TV no navegador para ele (abrir-sem-foco.sh, ?tv=1&replay-gps=21-06&speed=10) e o link no chat; commit na branch claude/tv-box-aovivo-e2-20261027 (só: tela, cerebro-gps-tv.js, cerebro-tv-blocos-gps.js, tests/node-smoke-gps-tv.mjs); PACOTE-*.md + frase.

## PONTO DE PARADA 1028-1108 (11h09)
Passe /Users/imac/.claude/retomadas/20261028-1108-p1fast.md; seguir "Falta (atualizado)" item 1.

## RETOMADA 1028-1108 (11h19)
Retomado do passe /Users/imac/.claude/retomadas/20261028-1108-p1fast.md (mesma janela ttys003, território p1fast-mapa-coluna desta janela). Seguindo "Falta (atualizado)" item 1.

### 28/10 11h45 — FALTA zerada
- Item 1 ideal: cérebro validas.voltaIdealS (21/06 = 159,597 = volta 2; todas = 158,172) + 3 provas (106/0); protótipo: rodapé "Ideal pelos trechos 2:39,6" ao lado da soma, lido do cérebro da TV (provar-rodape.mjs no scratchpad do servidor 5201: APROVADO, pior caso gap 101 px; controle sem volta válida = não aparece).
- Achado: ACEL/FREIO do G com 3,9 px na coluna (régua cega media SVG pela escala da coluna) → rótulos ao lado (9,76 px), régua mede SVG real + ::before/::after, controle --controle-antigo acusa 3,9.
- Smokes: montar 17/0, arquitetura 39/0, tv-blocos 25/0; ensaio do pacote 17/0; conferir × dpl_F3jLY (o que está no ar): 79 iguais, 3 diferentes = ENTRA.
- imac-9c avisada (SendMessage). Commit 4b866482f. PACOTE-tv-box-coluna-mapa.md pronto.

## PONTO DE PARADA 1028-1152 (11h52)
Painel aberto p1fast-tv-blocos-sem-racebox-1151 (blocos "não vem do RaceBox"). Passe /Users/imac/.claude/retomadas/20261028-1152-p1fast.md, PRÓXIMO PASSO item 1.

## PONTO DE PARADA 1028-1152 (11h53)
Painel aberto p1fast-tv-blocos-sem-racebox-1151 (blocos "não vem do RaceBox"). Passe /Users/imac/.claude/retomadas/20261028-1152-p1fast.md, PRÓXIMO PASSO item 1.

## PEDIDO NOVO 28/10 ~12h30 (Flávio) — TV "ainda bem fraca"; migração SEGURADA por ordem dele (PACOTE carimbado)
1. Plano do stint feito no celular aparecer na TV. Fonte: app iOS grava em `envelopes_seguranca_stint` (nuvem);
   leitor web já existe: `web/cockpit/treino-stint.js:110` (último envelope por carro_id) e `configuracao-stint.js`.
   Hoje o bloco stint diz "sem plano nem recorde". Achar a casa no cérebro (CONTRATO_DADOS) — tela não abre conexão.
2. Velocímetro: tirar "AGUARDANDO SENSOR" (lista AGUARDA_SENSOR ~linha 7844); velocidade E km vêm do GPS.
   Na gravação 21/06 a agulha/odômetro ficam em 0/000.0 — o feed do MODO RACEBOX só soma `source==='racebox'`.
3. Diminuir o velocímetro para caber faixa HORIZONTAL com o gráfico em linha da volta inteira (acelera/freia),
   volta atual × melhor volta, cursor andando no trecho — cores pedidas: AZUL acelera, VERMELHO freia.
4. "Painel que estava ótimo" (voltas, melhor, última, indicadores, linha que passa no trecho): busca feita —
   NÃO é bloco da TV (16 blocos iguais desde antes de 21/06), nem rastro do mapa (sempre por velocidade), nem
   replay-hoje, nem Vista demo. Mais próximo = tela "Comparar Voltas" (`_design-reference/mockup-command-box-comparar-voltas.html`,
   existe no projeto principal e no ar; NÃO está nesta branch — pegar de `.claude-exec/p1box-ar-20261027/arquivos/`).
   Ela usa `freio-trecho.js` (simulado pela física); na TV preferir G MEDIDO do RaceBox via cérebro. Confirmar com
   ele mostrando a TV pronta (não perguntar antes).
Ferramentas: `blocos-b/foto-url.mjs <url> <png>`, `blocos-b/medir-b.mjs` (prova opção B, reposicionar se layout mudar).

## RETOMADA 1028-1222 (28/10 tarde) — cérebro do pedido novo PRONTO (commit ff797dfef)
- cerebro-gps-tv.js: `kmSessao` (odômetro saiu da tela; mesmas regras) + `perfilAtual` (guardarVoltas). Cópia iOS igualada.
- cerebro-tv-blocos-gps.js: `pacote(s, { plano })` → `faixa` (200 casas por posição: G atual × melhor, Δ por posição,
  cursor, curvas; fonte 'medido' só com as 2 voltas com zero do box, senão 'velocidade' das duas), `plano` (planoDoStint),
  stint.voltas[].ultima/descarte, stint.idealS.
- treino-stint.js: porta `lerUltimoPlanoStint` (plano + dia + deHoje); buscarPlanoStintDaNuvem reusa (59/59).
- Prova nova tests/node-smoke-tv-faixa-volta.mjs 28/28; mutações Δ e G invertidos REPROVAM. gps-tv 106, blocos 25,
  arquitetura 39, honesta 37, pagina-volta 46, trechos 24, montar 17 — todos 0 falha. Falta pôr no package.json (smoke).
- Leitura do ar (GET anon): último plano do Bubi = 10/07 (10 voltas, box na 4); hoje não há plano.
PRÓXIMO (TV, só pinta): (a) __hudReal no modo TV lê window.__tvGps (agora.kmh + kmSessao) e o MODO RACEBOX deixa
de somar km (pinta do pacote); hud sai de cb-aguardando como o mapa; (b) hud TV menor (top 8.5% h 24%) + faixa nova
(left 35.5% top 33% w 28% h 20.5%, sem data-block-id): linha atual AZUL acelera/VERMELHO freia, melhor = ghost
dourado, cursor, faixa Δ embaixo, fonte escrita; (c) stint vira painel de voltas (plano no topo, MELHOR/ÚLTIMA/MÉDIA/IDEAL,
lista com barra Δ, melhor verde, última dourada); loader do plano: import lerUltimoPlanoStint, carro Bubi
641a81e7-3192-4e68-8183-b8401f105574 (?carro=), a cada 60 s, passa em blocos.pacote(s,{plano}); (d) CONTRATO_DADOS
§2 citar faixa/plano/km; package.json smoke; reposicionar medir-b.mjs; rodar provas + ensaio; abrir a TV e perguntar.

## RETOMADA 1028-1231 (28/10 tarde) — conversa nova
Escopo: só a TV pintar o que o cérebro (ff797dfef) já calcula — mockup command-box vista piloto (modo TV), package.json
(smoke), CONTRATO_DADOS §2, medir-b.mjs. Não mexe em cérebro nem iOS; migração SEGURADA (não oferecer frase).
- 28/10 tarde — TV PINTA (mockup): velocímetro menor (top 8,5% h 24%) sem "aguardando sensor", km/h = cérebro
  (`__tvGps.kmh`) e odômetro = `kmSessao` a 4 Hz (camada RaceBox não soma mais); faixa `[data-tv-faixa]` (left 35,5%
  top 33% w 28% h 20,5%) com G atual azul/vermelho, melhor dourada, cursor, Δ ganha/perde, fonte escrita; stint =
  painel de voltas (plano no topo, MELHOR/ÚLTIMA/MÉDIA/IDEAL, lista com barra Δ, aquecimento apagado); plano lido a
  cada 60 s (`lerUltimoPlanoStint`, ?carro=, padrão Bubi). Prova de tela `blocos-b/medir-b.mjs` APROVADO; controle
  (TV antiga do bak-tv-pinta) REPROVA 6 checagens. Provas: gps-tv 106, blocos 25, faixa 28, arquitetura 39, honesta 37,
  pagina-volta 46, trechos 24, montar 17, treino-stint 59, fonte-unica 28, tv-video 46 — 0 falha. Backup: bak-tv-pinta/.
  Migração SEGURADA (ordem dele). Falta: ele olhar a TV e dizer se o painel de voltas é o que lembrava.

## RETOMADA 1028-1304 (28/10 tarde) — conversa nova
Ele disse que a TV de hoje NÃO era o que lembrava: era a página «comparativo por trecho» de 27/10 (cópia em
comparativo-27-10/). Escopo: levar ESSE desenho para a TV real (mockup modo TV) com dado do cérebro — quadro por curva
(MELHOR × ÚLTIMA × Δ, uma linha por curva, linhazinha azul acelera / vermelha freia andando com o carro) na metade direita
e a faixa da volta inteira na BASE. Cérebro: voltaAtual.trechos (curvas já fechadas da volta em curso, cópia iOS igual)
+ casa `quadro` no pacote. Velocímetro/coach/painel de voltas saem da TV (ficam no commit c54f8a585). Backup: bak-quadro/.
Migração SEGURADA (ordem dele) — não oferecer a frase.
- 28/10 ~14h (conversa 1028-1304): cérebro PRONTO E PROVADO — voltaAtual.trechos (cópia iOS igual, cmp) + pacote().quadro
  (montarQuadro). Prova nova tests/node-smoke-tv-quadro-curvas.mjs 17/17 (ida e volta: passagem mostrada na volta = guardada
  no fecho); mutações delta/tom/volta REPROVAM (1, 1, 3 falhas; QUADRO_BLOCOS=<cópia>). Triagem: 1 reprovação era régua (30 s
  ainda na 1ª reta → 120 s). faixa 28, blocos 25, gps-tv 106 = 0 falha.
  TELA ESCRITA, AINDA NÃO CONFERIDA: CSS esconde hud/coach/stint/delta-acum/passagem/frenagem/vmin/coluna do mapa no modo TV;
  .tv-quadro [data-tv-quadro] left 35,6% top 8,5% w 63,9% h 64,8%; faixa na base (top 74,4% h 24,6%) com nomes das curvas;
  desenharQuadro() na camada TV-GPS. Foto tirada: scratchpad f70fb499…/tv-quadro1.png (não vista).
  FALTA: ver a foto e ajustar; estender medir-b.mjs (quadro visível com N curvas = cérebro, linha agora azul/vermelha, faixa na
  base, nada sobreposto, texto sem corte; controle = TV do commit c54f8a585 REPROVA); package.json smoke; CONTRATO_DADOS §2
  (quadro); provas antigas + montar/arquitetura; abrir no navegador dele e mostrar.

## RETOMADA 1028-1318 (28/10 tarde) — conversa nova
Escopo igual ao da 1028-1304: conferir a tela do quadro por curva (foto), ajustar, estender medir-b.mjs, package.json
smoke, CONTRATO_DADOS §2 (quadro), provas antigas, abrir a TV no navegador dele. Migração SEGURADA — não oferecer a frase.
- 28/10 tarde (conversa 1028-1318): TELA CONFERIDA pela foto. Ajustes: rodapé do quadro cortava o fim («G pela velocidade
  do» — a fonte do G já está escrita na faixa logo abaixo, saiu do quadro; separador " · " solto corrigido; pedaços do
  rodapé sem encolher); unidade e «REF» de 7 → 7,5 px (10,5 → 11,25 px na tela). Backup: bak-quadro/mockup-antes-ajuste-foto.html.
  PROVA DE TELA NOVA blocos-b/medir-quadro.mjs (substitui medir-b, que provava o desenho c54f8a585): APROVADO — 70 números
  + 4 diferenças da tela = cérebro (colunas tiradas do cérebro), linha da curva agora = progresso (75,9 × 75,9%) com as cores
  na ordem da trilha, faixa na base com os 7 nomes, blocos que saem escondidos, sem sobreposição/corte/letra < 11 px.
  Régua casada: observador copia o cérebro no instante do redesenho (ler o cérebro "agora" ficava 250 ms à frente).
  Controles REPROVAM: TV c54f8a585 (bak-quadro/), sabotagem "última = melhor" (8 números), sabotagem cores trocadas.
  Triagem de 3 reprovações, todas régua: estabilidade impossível durante a curva; todas as curvas eram REF (troca invisível
  → exige curva com última ≠ melhor); coluna 'freio' ≠ 'freadaM' (traço × traço cego → colunas nascem do cérebro).
  Freada "—" na 21/06 é honesto (gravação só GPS: 26.815 gps, 0 G do RaceBox; prova tv-quadro-curvas exige o "—").
  package.json: node-smoke-tv-quadro-curvas no smoke + smoke:tv-quadro-curvas; CONTRATO_DADOS §2 cita a casa `quadro`.
  Smoke 88 provas uma a uma: 87 passam; schema-parity 11 ok/4 fail IGUAL no commit limpo (git archive HEAD) — já existia,
  fora desta obra. TV: quadro 17, faixa 28, blocos 25, gps-tv 106, montar 17, arquitetura 39, honesta 37, tv-video 46 — 0 falha.
  Migração SEGURADA (ordem dele). Falta: ele olhar a TV.
