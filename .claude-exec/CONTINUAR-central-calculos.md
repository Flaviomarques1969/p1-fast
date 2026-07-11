# RETOMAR — Central de Cálculos (domínio sobre as contas) — marcado 23/06/2026

## GATILHO
Flávio digita **"RETOMAR CENTRAL DE CÁLCULOS"** depois de um clear. Ao ver isso: LER este arquivo
inteiro ANTES de responder. Não despejar análise — ver primeiro "como entregar" no fim.

## O QUE O FLÁVIO QUER (na língua dele)
Ter **DOMÍNIO sobre os cálculos**. Uma **central da verdade / central de dados de pista**: cada
conta mora num lugar só, e TODO MUNDO (telas e cérebro) usa a MESMA conta — sem repetir, sem refazer,
sem cada tela/cada coisa fazendo função nova ou buscando em lugar diferente.
ISTO É DE FUNÇÕES (cálculos), não de tubulação de dados.

## O QUE JÁ FOI FEITO NESTA LINHA (antes do clear)
1. **Arquitetura do dado (uma entrada/um cérebro/todos consomem)** — INCORPORADA na versão oficial:
   - Trava automática `tests/node-smoke-arquitetura-dado.mjs` (roda em `npm run smoke` e `npm run smoke:arquitetura`).
   - Registro `docs/CONTRATO_DADOS.md`. Regra fixada em `CLAUDE.md`.
   - Hoje a trava pega: conexão própria em tela + dado falso. FALTA ela pegar **conta duplicada** (próximo nível).
2. **Vista Piloto — conexão unificada:** as 2 conexões próprias viraram 1, pela ponte única
   `web/cockpit/cloud-bridge.js` (ampliada com vários ouvintes + eventos posicao/evento). Backup em
   `_design-reference/_backups/...BACKUP-migracao-fonte-unica-20260623-164139.html`. Pendente: ok visual do Flávio.
3. Ambiente isolado: linha `guard-arquitetura` (worktree). Memória: `feedback-arquitetura-uma-fonte-um-processamento-todos-consomem.md`.

## O QUE A ANÁLISE DAS FUNÇÕES ACHOU (resumo — evidência no histórico anterior)
JÁ ESTÁ BOM (são cadeias, não cópias): **freio** (1 motor: `web/cockpit/freio-trecho.js`),
**vmin/ápice** (4 papéis distintos), **dinamômetro** (esteira). A Vista Piloto consome esses, não recalcula.

OS 3 FUROS DO DOMÍNIO:
- **A) As telas refazem conta por dentro.** Vista Engenheiro = 0 módulos, ~140 funções dentro, 100%
  fictício. Vista Piloto = pegou módulos "por cima" mas NÃO apagou o inline fictício → conta real e
  falsa convivem; ~30-40% das funções dela duplicam módulo existente (freio, vmin, passagem, marcha, delta).
- **B) O "cérebro" (web/command-box/cerebro/*) refaz conta em vez de reger — e não está ligado em
  nenhuma tela** (só os testes o usam). Tem o próprio delta/velocidade/coach; ignora as casas reais
  (`web/cockpit/delta-calculator.js`, `src/domain/p1-coach.js`, `src/domain/score.js`). ESTE é o coração:
  a "central da verdade" hoje NÃO é central — é caminho paralelo desligado que repete conta.
- **C) Duplicatas reais a aposentar:** marcha atual em 2 (`src/domain/gear-estimation.js` velho vs
  `web/cockpit/gear-detector-online.js` produção); ponto de troca da luz em 2 (`src/domain/shift-target.js`
  vs `web/cockpit/shift-light-orquestrador.js`); a continha "distância entre 2 pontos do GPS" copiada em
  3-4 arquivos; constante de freio "15" copiada à mão em 2; `rebuildPassagem` definida 2x na própria Vista Piloto.

## PLANO PRA TER DOMÍNIO (ordem)
1. Cérebro vira MAESTRO: chama as casas únicas (delta, nota, lições, distância) em vez de ter as próprias.
2. UMA continha de distância só, importada por todos.
3. Aposentar duplicatas (marcha velha; unificar ponto de troca).
4. Telas param de calcular, só exibem o pacote do cérebro (começar pela Vista Engenheiro = 0 reuso hoje).
5. Trava cresce: passa a reprovar conta definida dentro de tela / conta duplicada (registro = mapa "uma conta → uma casa").

## ENTREGUE 23/06 (depois do clear) — DOIS DESENHOS, navegador, sem jargão
1. **Antes/depois** (escolha do Flávio no card): `_design-reference/mapa-central-calculos-antes-depois.html`. Conceito confirmado por ele ("é isso").
2. **Raio-x completo navegável** (ele pediu o quadro inteiro antes de mexer): `_design-reference/mapa-central-calculos-raiox.html`.
   26 contas, filtro por situação + busca. Cada afirmação verificada no código (3 agentes Explore + grep meu).

## NÚMEROS CRAVADOS (verificados nesta sessão — NÃO inventar de novo)
- Distância GPS: **16 arquivos** com fórmula própria (até 20 contando variações), 2 fórmulas (haversine × equiretangular), 3 constantes de raio (6.378.137 / 6.371.000 / 111.320). Lista no .tec do card.
- ÓRFÃS confirmadas por grep (0 consumidores fora de teste): **score.js**, **reference-line.js**. **p1-coach.js** só usado por examples/p1-coach-wireup.js.
- Cópias reais: marcha (2: gear-estimation × gear-detector-online), ponto de troca da luz (2: shift-target × shift-light-orquestrador), reação do piloto (2), chegada (3), fase-curva (2 espelhos), velocidade GPS (4).
- CADEIAS OK (não cópia): freio (1 motor freio-trecho + reusos), ápice/vmin (papéis), dyno, passagem.
- CÉREBRO: importado só por mockups + *.smoke.mjs → não está em tela de app real.

## EXECUTADO 23/06 — VITÓRIA SEGURA: distância GPS → 1 casa (escolha do Flávio, autorizado)
Ambiente isolado: worktree `.claude/worktrees/central-distancia`, branch `central-distancia`. **main (oficial) INTOCADA** (não tem geo.js).
- **Casa única criada**: `web/cockpit/geo.js` (distanciaPontos · distanciaCoords · M_POR_GRAU_LAT · mPorGrauLng).
- **12 arquivos migrados** (perderam a fórmula própria, passaram a importar): freio-trecho, classificador-trecho, trail-cockpit-motor, delta-calculator, trecho-detector (distância + 2ª projeção), live-data-bridge, oportunidade-trecho, coreografia-volta, box-detector, chegada-detector, passagem-real. Nomes exportados (distM/distMeters) viraram atalho pra casa (não quebrou importadores).
- **Família de produção = número IDÊNTICO** (mesma fórmula equiret. R 6.378.137). oportunidade/coreografia/passagem mudaram <0,7%/<0,11% — TODOS os testes passaram dentro da tolerância.
- **NÃO migrados (baseline de dívida, a trava agora protege)**: apice-calculator (curvatura sensível), cérebro (cerebro-velocidade, chegada-gps — fronteira "não importa do cockpit", entra no furo do cérebro), árvore src/ (trajectory-monitor, projector, cross-validation, mock-provider — runtime separado), espelho iOS ×3 (sincronia do bundle). pista-oficial-brasilia EXCLUÍDA (calibração do desenho, não é distância).
- **Trava reforçada** (`node-smoke-arquitetura-dado.mjs` regra 6 + GEO_BASELINE): reprova fórmula de distância/projeção NOVA fora de geo.js. PROVADO: verde hoje (28/0), reprova cópia nova plantada (28/1).
- **Validação**: 80/80 testes passaram; o único fail (schema-parity) JÁ falha na main (dívida de tabelas do banco, sem relação).

## INCORPORADO NA OFICIAL 23/06 (autorizado pelo Flávio: "Incorporar na oficial")
Trazido cirúrgico (só os 14 arquivos via `git checkout central-distancia -- ...`) pra main; auto-save registrou.
Confirmado na oficial: `HEAD:web/cockpit/geo.js` existe; trava com GEO_BASELINE; freio-trecho importa de geo.js; trava 28/0 + 11 módulos OK na main.
Remoto (origin) NÃO recebeu push (não pedido). Worktree `central-distancia` PRESERVADO como rollback (não apagar sem motivo).

## FRENTE 2 — CÉREBRO VIRA MAESTRO (plano sério aprovado, em execução por etapas)
Plano visual: `_design-reference/plano-cerebro-maestro.html`. REGRA: nenhuma função nova; só fazer o cérebro usar as casas que já existem.
ATENÇÃO (cobrança 23/06): NÃO inventar. Flávio NUNCA pediu "nota de volta" — eu inventei e ele cobrou. Maestro = parar de refazer, usar o que existe.
Achado-chave: o cérebro (command-box/cerebro) é usado SÓ pelo protótipo Vista Piloto (mockup); main.js/main-t3000 (cockpit de produção) NÃO importam → refatorar o cérebro é BAIXO risco. Ligar numa tela de verdade = etapa final, separada, só com ok visual.

### ETAPA 1 — FEITA no isolado, NÃO incorporada (escolha do Flávio "Deixa no ambiente isolado")
Ambiente isolado: worktree `.claude/worktrees/cerebro-maestro`, branch `cerebro-maestro` (commitado lá). main INTOCADA (não tem src/domain/geo.js).
- Criada casa NEUTRA `src/domain/geo.js` (distância + cruzamento de linha). `web/cockpit/geo.js` agora REEXPORTA dela (cockpit e cérebro usam a mesma).
- Cérebro migrado: `cerebro-velocidade.js` (distância) e `chegada-gps.js` (cruzamento) usam a casa. ACABOU a cópia espelho com `chegada-detector.js` (cockpit também usa a casa).
- Trava: GEO_HOME = src/domain/geo.js; cerebro-velocidade e chegada-gps saíram do GEO_BASELINE (quitados).
- Validação: 80/81 testes verdes (o fail é schema-parity, pré-existente). Saldo +82/-97 linhas (consolidou).
- PENDENTE: incorporar na oficial quando o Flávio quiser (hoje ele preferiu deixar isolado).

### ETAPAS SEGUINTES (frente 2, quando ele quiser)
Etapa 2: velocidade numa casa só. Etapa 3 (decisão dele): lições (coach) e atraso por trecho. Etapa 4: eleger a casa do alerta de temperatura. Etapa FINAL (separada, ok visual): ligar o cérebro numa tela de verdade.

### "TERMINAR A DISTÂNCIA" — FEITO no isolado (mesma linha cerebro-maestro), NÃO incorporado (Flávio "Deixa no ambiente isolado" 23/06)
Migrados pra src/domain/geo.js (verde): `src/domain/trajectory-monitor.js` (distância) e `src/telemetry/projector.js` (projeção; constante se cancela = resultado idêntico).
Tirado da conta (GEO_EXCLUI): `src/telemetry/mock-provider.js` (gerador de dado de teste = inverso da distância).
BASELINE restante (dívida marcada, com motivo — NÃO mexer sem necessidade):
  - `web/cockpit/apice-calculator.js` — curvatura APROVADA/sensível, calibração própria.
  - `src/telemetry/cross-validation.js` — ferramenta de conferência, campo {lon} (não {lng}).
  - iOS ×3 (apice-calculator, live-data-bridge, trecho-detector) — espelho do bundle do app; entram quando recompilar o iPhone (passo separado, sem teste aqui).
Validação: 80/81 verde (schema-parity pré-existente). Linha cerebro-maestro vs main = 8 arquivos, +94/-111.
PENDENTE p/ incorporar a linha cerebro-maestro inteira (Etapa1 cérebro + distância): só com ok do Flávio (hoje preferiu deixar isolado).

### ✅ INCORPORADO NA OFICIAL — 23/06 noite (autorizado pelo Flávio: card "Incorporar o cérebro-maestro na oficial")
Trazido CIRÚRGICO só os 8 arquivos do cérebro/geo via `git checkout cerebro-maestro -- <8>` (casa neutra `src/domain/geo.js` novo + trajectory-monitor, projector, trava, chegada-detector, web/cockpit/geo.js reexporta, cerebro-velocidade, chegada-gps).
NÃO trazidos os 8 arquivos do iPhone (AppDelegate/OrientationGate/ContentView/CockpitPilotoView/etc.) — eles AVANÇARAM na oficial DEPOIS do isolado nascer; trazer regrediria o app. Confirmado por merge-base. iPhone INTOCADO.
Validação na oficial: trava de arquitetura 28/0 (já reconhece src/domain/geo.js como casa única da distância); bateria 74 verde / 1 vermelho rodando cada teste isolado. O 1 vermelho = `schema-parity` (dívida antiga de tabelas do banco): PROVADO sem relação (não cita nenhum dos 8) e a versão da própria oficial original também falha igual (11 ok / 4 fail).
Auto-save registra na linha wip/ oficial (sem push pro remoto — não pedido). Worktrees `cerebro-maestro` e `central-distancia` PRESERVADOS como rollback. Canal cockpit-bubi-live e produção NÃO tocados.
PRÓXIMO (frente 2, quando ele quiser): Etapa 2 velocidade numa casa só; Etapa 3 (decisão dele) lições + atraso por trecho; Etapa 4 alerta de temperatura; iPhone (espelhar geo no bundle); etapa FINAL ligar o cérebro numa tela de verdade (só com ok visual).

## OUTRAS FRENTES DA CENTRAL (quando ele quiser)
(c) resgatar casa órfã da Linha de Referência (NÃO confundir com "nota de volta" — Flávio NUNCA pediu nota; não oferecer); cérebro etapas que são DECISÃO dele (alerta de temperatura: 2 métodos; lições: 2 caminhos; atraso por trecho: precisa montar pedaços da curva); iPhone (espelhar geo no bundle).

## COMO ENTREGAR NA VOLTA (IMPORTANTE — ele NÃO visualizou da última vez)
Flávio disse: "não consegui visualizar isso com o que estou pedindo". Texto longo NÃO funcionou.
Na volta: entregar VISUAL, formato MAPA (navegador, largura total, linguagem de gestor, sem jargão) —
um desenho de "a central, as contas, quem usa cada uma, onde está duplicado". Perguntar o que ele quer
VER antes de despejar análise. Confirmar o entendimento dele do conceito ANTES de propor execução.
