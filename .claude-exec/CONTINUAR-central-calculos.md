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

## DECISÃO ABERTA (era a pergunta antes do clear)
(a) escrever o MAPA completo "uma conta → uma casa" no registro (raio-x navegável), ou
(b) começar a transformar o cérebro em maestro (furo B, maior alavanca).

## COMO ENTREGAR NA VOLTA (IMPORTANTE — ele NÃO visualizou da última vez)
Flávio disse: "não consegui visualizar isso com o que estou pedindo". Texto longo NÃO funcionou.
Na volta: entregar VISUAL, formato MAPA (navegador, largura total, linguagem de gestor, sem jargão) —
um desenho de "a central, as contas, quem usa cada uma, onde está duplicado". Perguntar o que ele quer
VER antes de despejar análise. Confirmar o entendimento dele do conceito ANTES de propor execução.
