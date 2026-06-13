# CONTINUAR — TRAIL-BRAKING + PASSAGEM COMPLETA (padrão da curva → frenagem/Vmin/PACE)
Checkpoint 13/06/2026 noite. Plano montado por conselho de agentes (verificado com evidência).

## COMANDO PRA COLAR DEPOIS DO /clear
```
Leia /Users/imac/Projetos/P1 Fast/.claude-exec/CONTINUAR-trailbraking-passagem-2026-06-13.md e
execute o planejamento a partir da FASE 0. Rode TASK_INIT, leia os 6 protocolos do Padrão Flávio,
e siga as fases na ordem. Ambiente: desenvolvimento. Produção protegida. Tela só visualiza; decisão
no celular. Não inventar. Use os defaults declarados sem re-perguntar direção.
```

## PEDIDO DO FLÁVIO (literal, 13/06)
"Em função do padrão da curva, qual tipo de trailbraking que vai ser aplicado para aquela curva.
Então qual é o ponto de frenagem, quanto de carga tem e como é que distribui ele até o Vmin. Além
disso, nessa passagem da curva, nós precisamos também incluir ali o ponto de frenagem e o Vmin e o
PACE. Montem o planejamento para todos esses itens e vamos avançar de um jeito profissional."

## ESTADO ATUAL (o que já foi feito / o que já existe)
- Painel oficial: `_design-reference/mockup-command-box-vista-piloto.html` (com botão "salvar última versão"
  via ajudante porta 8078; versão do arranjo do Flávio salva). Ligação ao vivo já injetada (bloco
  setupLigacaoAoVivo): HUD real (rotação/velocidade-GPS/lambda/água), detecção automática de sensor,
  marcação honesta (só HUD "ao vivo"; carro/pneus/combustível "aguardando sensor"; mapa/Vmin/frenagem/
  shift-light/coach/delta/passagem/stint "aguardando ligação"). NÃO tocar nas POSIÇÕES dos blocos.
- JÁ EXISTE e provado (reaproveitar): dicionário de TIPOS com o FORMATO de trail-braking por tipo
  (classificador-trecho.js:33-42); classificador 1-passagem→tipo (classificador-trecho.js:156-250);
  classificação viva (trecho-estado.js); bridge vivo (classificador-vivo-bridge.js); PADRÃO DEFINITIVO
  das 8 curvas de Brasília fechado pelo Flávio (relatorios/_decisao-flavio-padrao-curvas-2026-06-13.json:
  CURVA01=T5, CURVA2=T0, JUNÇÃO=T2, BRUXA=T0, PLACAR=T2, S=T4, VITÓRIA=SF...); detector de freada da
  LINHA DE ENTRADA (trecho-detector.js:280-289); motor de prescrição FREIA DEPOIS/ANTES/MENOS + ACELERA
  ANTES (oportunidade-trecho.js:166-205); Vmin (acharVminBuffer/vminDosPontos); catálogo de treinos
  com trail-braking/frenagem/vmin/pace (catalogo-treinos.js); mockup trail-braking VIVO com a curva-alvo
  de carga (mockup-cockpit-treino-trail-braking-VIVO-2026-06-11.html:405-425); buildPassagemPanel
  (mockup:5669) com entrada/ápice/saída e ganchos frenagemVerdictId/vminVerdictId já no objeto corner.
- CLASSIFICADOR vive no AMBIENTE ISOLADO: `/Users/imac/Projetos/p1fast-worktrees/classificador-trail/`
  (4 módulos puros) — ainda NÃO está no cockpit principal.

## O PLANO — 7 FASES (na ordem)

### FASE 0 — Trazer o classificador pro app principal  [esforço: baixo]
- Objetivo: ter os 4 módulos do classificador disponíveis no cockpit de produção (sem ligar nada ainda).
- Reaproveita: classificador-trecho.js, trecho-estado.js, classificador-vivo-bridge.js, tipos-curva-texto.js
  (módulos puros, testados no worktree).
- Constrói: copiar os 4 arquivos do worktree para `web/cockpit/`. Nenhum import novo ainda.
- Verifica: grep acha os 4 em web/cockpit/; rodar os testes do worktree contra eles; `npm run smoke` verde.

### FASE 1 — Função TIPO → FORMATO de trail-braking (carga + distribuição até o Vmin)  [médio]
- Objetivo: criar a peça que NÃO existe: dado o tipo (T0-T5/SF), devolver o perfil-alvo de trail-braking —
  carga inicial (% na pancada), tipo de soltura (gradativa / com residual), até onde vai o residual (rel. Vmin).
- Reaproveita: o texto prescritivo por tipo (TIPOS[tipo].formato, classificador-trecho.js:33-42) + as 2
  curvas y(x) de exemplo do mockup VIVO (clássica 100%+soltura; residual parcial+constante).
- Constrói: novo `web/cockpit/perfil-trail-por-tipo.js` (PERFIL_POR_TIPO + perfilDeTrail(tipo)) + teste
  `tests/domain/perfil-trail-por-tipo.spec.js`.
- Verifica: perfilDeTrail('T1') = 100% + soltura gradativa; perfilDeTrail('T2') = parcial + residual; etc.
- NÃO INVENTAR: % exato de carga e soltura fina NÃO são medíveis (sem sensor de pedal, telemetria ~1 Hz).
  Mostrar o formato como ALVO prescrito do tipo, não como medição.

### FASE 2 — Gravar o tipo das 8 curvas no banco (DEV primeiro)  [baixo-médio]
- Objetivo: coluna nova `tipo_curva` (T0-T5/SF/ND) em track_segments (sem tocar a coluna 'tipo'=curva/reta),
  populada com o padrão definitivo de 13/06. A tela passa a ler o tipo do banco, não de um JSON solto.
- Reaproveita: _decisao-flavio-padrao-curvas-2026-06-13.json; estilo da migration 0036.
- Constrói: migration nova `supabase/migrations/00XX_track_segments_tipo_curva.sql` (ADD coluna + CHECK +
  UPDATE das 8 curvas). Rodar SÓ em DEV. Atualizar segments-loader pra trazer tipo_curva.
- Verifica: SELECT em DEV mostra as 8 curvas com tipo_curva certo.
- PRODUÇÃO: só com "MIGRAR PARA PRODUÇÃO" explícito do Flávio.

### FASE 3 — Marcos reais de FRENAGEM e VMIN na passagem (re-etiquetar referências)  [médio-alto]
- Objetivo: dado real em 2 dos 3 marcos: ponto de frenagem (da linha de entrada) e Vmin, nas referências.
- Reaproveita: retagSubsPorEventos (live-data-bridge.js:187,436); trecho-detector.js (freada-iniciou).
- Constrói: `tools/re-etiquetar-passagens-offline.js` que roda o detector sobre as 56 passagens reais
  (CÓPIA de passagens-bubi-aplicadas.json), recalcula freadaT/apiceT/vminIdx e grava sub por ponto.
- Verifica: 0 pontos com sub:null (hoje 565/565 null); conferir 3-4 passagens contra as barras de Brasília.
- CUIDADO: é dado de REFERÊNCIA (não de paciente, mas canônico) — trabalhar em CÓPIA, com backup.

### FASE 4 — Criar o 5º marco PACE (ponto de aceleração pós-Vmin)  [alto]
- Objetivo: o marco que não existe — ponto onde a velocidade volta a subir de forma sustentada após o Vmin.
- Reaproveita: Vmin já é a fronteira ápice→saída; ACELERA ANTES já existe em oportunidade-trecho.js (falta o número).
- Constrói: 'pace' no enum de sub (delta-calculator SUB_TRECHOS + schema); detector de PACE (proxy por
  velocidade enquanto não há sensor de acelerador casado por tempo).
- Verifica: schema aceita 'pace'; numa passagem com retomada clara, marca pace entre Vmin e linha de saída.
- NÃO INVENTAR: sem sensor de acelerador casado por timestamp, PACE é PROXY por velocidade — declarar como tal.

### FASE 5 — Ligar o agente vivo: o tipo classificado chega ao app (DEV/replay)  [médio]
- Objetivo: a cada passagem fechada → classifica → alimenta o estado vivo → propõe mudança de tipo quando vira tendência.
- Reaproveita: criarClassificadorVivo (classificador-vivo-bridge.js) — ponto de conexão pronto; LiveDataBridge
  já emite 'passagem-fechada' (live-data-bridge.js:474).
- Constrói: em main-t3000.js, instanciar criarClassificadorVivo({segmentos com tipoAprovado do banco da Fase 2,
  onProposta, store}) e ligar no onTrechoEvent. Persister no padrão de padrao-persister.js.
- Verifica: replay das 56 passagens → estado vivo acumula; onde a evolução é consistente, nasce proposta.
- Decisão no CELULAR (aprovar/ajustar/recusar). Tela só pisca avisando.

### FASE 6 — Bloco PASSAGEM completo na tela (entrada/freio/Vmin/ápice/PACE/saída)  [alto]
- Objetivo: a tela mostra a passagem completa + o tipo da curva + o formato de trail prescrito.
- Reaproveita: buildPassagemPanel (mockup:5669) — estrutura de reveal + o corner já carrega
  frenagemVerdictId/vminVerdictId/speedSeries/apexOffsetM (hoje ignorados).
- Constrói: estender getPassagemDataForCurve (extrair freio+vmin+pace) e buildPassagemPanel (acrescentar
  marcos FREIO/VMIN/PACE conforme o formato decidido). Depois portar pro cockpit real.
- Verifica: abrir no navegador (não PNG) — passagem mostra 5-6 marcos + tipo + formato de trail.
- NÃO TOCAR nas POSIÇÕES dos blocos do painel do Flávio.

## DECISÕES DO FLÁVIO (defaults recomendados — executar com estes, ajustável)
1. RÓTULO DO TIPO NA TELA: usar o rótulo curto (ex.: "LENTA PÓS-RETA", "RÁPIDA"), NÃO o código T0-T5 (jargão).
2. FORMATO DO BLOCO PASSAGEM: NÃO empilhar 6 colunas. Default: linha do tempo entrada→freio→Vmin→ápice→PACE→saída.
3. PALAVRA DO 5º MARCO: "PACE" + frase "ponto de aceleração".
4. CARGA DE FREIO: mostrar o formato ALVO prescrito pelo tipo (não % medido — não há sensor de pedal).
5. TIPO NO BANCO: coluna própria tipo_curva (não mexer na coluna 'tipo' reta/curva). DEV primeiro.
6. AGENTE VIVO: ligar primeiro em DEV/replay com as voltas reais; produção só com autorização.
7. RE-ETIQUETAR as 56 passagens: em cópia, com backup; é dado de referência canônico.

## NÃO INVENTAR (verificado)
- tipo fino T0-T5 NÃO está no banco (a coluna 'tipo' é curva/reta). Padrão definitivo vive em JSON.
- classificador NÃO está no cockpit prod (só no worktree). bridge vivo não é importado por ninguém.
- oportunidade-trecho NUNCA lê o tipo (prescreve contra a melhor passagem + banda fixa).
- PACE não tem registro real por passagem (ACELERA ANTES sai sem número).
- 56 passagens reais: 565/565 pontos com sub:null (nenhuma re-etiquetada).
- carga de freio (%) e soltura fina não são medíveis (sem sensor de pedal, telemetria ~1 Hz).
- a TELA só visualiza; decisão (aprovar/ajustar/recusar tipo) é do Flávio no celular.

## AMBIENTE / PROTOCOLO
- Trabalho em DESENVOLVIMENTO. Produção protegida (só "MIGRAR PARA PRODUÇÃO: ..." libera).
- Fonte do classificador: worktree p1fast-worktrees/classificador-trail (copiar pra web/cockpit).
- Banco DEV do P1 Fast pra migration; nada em prod sem autorização literal.
- Ler memória P1 Fast (dois caminhos) + os 6 protocolos antes de mexer.
- Validar no navegador (não PNG); tratamento "você"; sem emojis; largura total.
