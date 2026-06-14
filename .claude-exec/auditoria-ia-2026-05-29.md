# Auditoria severa — IA P1 Fast
Data: 2026-05-29

## Resumo
A "IA" no produto cobre 3 frentes:
- (a) Alertas críticos determinísticos (19 mensagens no código batem com as 19 aprovadas em 27/05).
- (b) Detecção preditiva por padrão histórico (3 voltas estabelecem padrão, desvio 20% dispara).
- (c) Mensagens pedagógicas curtas (17 textos aprovados em 27/05).

A linha oficial (main local) NÃO TEM NENHUM desses 3 arquivos. Tudo só existe no worktree v04-promote-2026-05-26.

Resultados dos testes no worktree v04:
- `node-smoke-padrao-acumulador.mjs`: 10/10 verde
- `node-smoke-p1-coach.mjs`: 28/28 verde
- `node-smoke-shift-light-inteligente.mjs`: 24/24 verde
- `node-smoke-apice-calculator.mjs`: 4/4 verde
- `node-smoke-cockpit-bootstrap.mjs`: 7/7 verde
- `node-smoke-cockpit-state.mjs`: 24/24 verde
- `node-smoke-cockpit-renderer.mjs`: 17/17 verde
- `node-smoke-chegada-detector.mjs`: 5/5 verde
- `node-smoke-box-detector.mjs`: 4/4 verde
- `node-smoke-shift-light-e2e.mjs`: 12/12 verde
- `node-smoke-replay.mjs`: 21/21 verde
- `node-smoke-detector.mjs`: 3/3 verde
- `node-smoke-contracts.mjs`: 11/11 verde
- `node-smoke-cockpit-web.mjs`: 11 verde / 5 falhas (drift de bytes do mockup HTML/CSS, não afeta IA)

Testes que NÃO EXISTEM:
- `node-smoke-alertas-criticos.mjs` — sem teste isolado para alertas críticos
- `node-smoke-trecho-detector.mjs` — sem teste isolado para o detector
- `node-smoke-delta-calculator.mjs` — sem teste isolado para delta

## Veredito por componente

| # | Componente | Veredito | Evidência | Risco prático |
|---|-----------|----------|-----------|---------------|
| 1 | AlertasCriticos (regras determinísticas) | Pronta com ressalva | `web/cockpit/alertas-criticos.js:1-337` (19 IDs, 70/80°C corretos, lambda 0,80/1,15, PNEU QUENTE super crítico em linha 82) | Sem teste isolado; mudança de threshold passa sem regressão |
| 2 | PadraoAcumulador (preditivo) | Pronta | `web/cockpit/padrao-acumulador.js:1-193`; 10 testes verde; integrado em `main-t3000.js:177-191` | Voltas 1-3 não têm preditivo (sem histórico); da 4ª em diante dispara |
| 3 | TrechoDetector | Pronta com ressalva | `web/cockpit/trecho-detector.js:1-309`; instanciado após carregar `track_segments` | Se a produção não tiver as 8 curvas aprovadas aplicadas no banco, detector fica silencioso — não dá erro, só não dispara nada |
| 4 | DeltaCalculator | Pronta com ressalva | `web/cockpit/delta-calculator.js:1-190`; retorna `piorSubTrecho` + `piorDeltaS` | Sem `melhores_passagens_trecho` populada, 1ª volta não tem delta; da 2ª em diante começa |
| 5 | ApiceCalculator + bolinha de correção | Pronta | `web/cockpit/apice-calculator.js:1-122`; 4 testes verde; integrado | Bolinha só aparece com referência carregada — sem ela mostra PENDENTE |
| 6 | Catálogo de 17 mensagens pedagógicas plugado no painel | NÃO IMPLEMENTADA | Texto vive só em `_design-reference/versions/mensagens-painel-piloto-v1-aprovado-2026-05-27.json`; nenhum módulo JS converte resultado do delta em texto | Piloto não recebe FREOU CEDO / VIROU MUITO / ACELEROU TARDE durante a volta |
| 7 | Catálogo de 19 mensagens críticas plugado no painel | Pronta | `alertas-criticos.js:74-101` (dict ALERTAS); textos/gravidades batem | PNEU QUENTE, PRESSÃO PNEU, CÂMBIO QUENTE dependem de sensores que NÃO existem no Bubi hoje — código pula esses ramos sem quebrar |
| 8 | Integração canal cockpit-bubi-live | Pronta | `cloud-bridge.js:17` canal nominal; throttle 5Hz; tolerante a queda | IA local não depende da nuvem — se cair, painel continua funcionando |
| 9 | Persistência entre sessões | Pronta com ressalva | `padrao-persister.js` + `melhores-loader.js` + migrações 0025/0026 | Se as migrações não estiverem aplicadas em produção, save falha silencioso |
| 10 | Cobertura de testes | Pronta com ressalva | 200+ asserts em 13 smokes core | Falta smoke isolado para 3 módulos centrais (alertas, trecho, delta) |

## Veredito final
A IA está PARCIALMENTE pronta para pista no Bubi.

Funciona:
- Os 19 alertas críticos disparam corretos para os sensores que o Bubi tem (água, óleo, lambda, bateria, combustível, falhando).
- O preditivo entra da 4ª volta em diante e persiste entre sessões se as tabelas estiverem em produção.
- TrechoDetector + DeltaCalculator + ÁpiceCalculator estão plugados no entry point real (`main-t3000.js`).
- Canal cockpit-bubi-live espelha as amostras para a nuvem sem amarrar a IA local.

Não funciona:
- As 17 mensagens pedagógicas APROVADAS em 27/05 NÃO chegam ao piloto. O texto existe só no JSON de design; falta o módulo que traduz "delta no freio + sinal positivo" para "FREOU TARDE".
- Tabelas de aprendizado provavelmente vazias em produção (sem seed da sessão Bubi 26/05). Próximo stint começa do zero.
- 3 alertas super críticos (PNEU QUENTE, PRESSÃO PNEU, CÂMBIO QUENTE) dependem de sensores físicos que o Bubi não tem.
- Tudo está só no worktree v04, branch `claude/v04-promote-pitstop-2026-05-26`. Linha oficial (main) NÃO TEM nada da IA nova.

## O que falta, em ordem de criticidade
1. **CRÍTICO** — Escrever o módulo que traduz delta + contexto em uma das 17 mensagens pedagógicas e plugar em `cockpitState.showMessage()`. ~120 linhas de código.
2. **ALTO** — Confirmar via SELECT que as migrações 0025, 0026, 0027, 0029, 0030, 0031, 0032, 0033 estão aplicadas no Supabase produção.
3. **ALTO** — Incorporar o worktree v04-promote em main (merge). Sem isso, nada da IA nova vai pra produção.
4. **MÉDIO** — Escrever os 3 smokes isolados que faltam (alertas-criticos, trecho-detector, delta-calculator).
5. **MÉDIO** — Popular `melhores_passagens_trecho` e `padroes_telemetria_por_volta` com 3-5 voltas da sessão Bubi 26/05/2026. Sem isso, preditivo só dispara da 4ª volta do próximo stint.
6. **MÉDIO** — Botões UI para mecânico acionar BOX e ÚLTIMA VOLTA via `raiseManual`. Sem isso, esses 2 alertas existem no código mas não há como disparar.
7. **MÉDIO** — Corrigir as 5 falhas do `node-smoke-cockpit-web.mjs` (drift CSS/HTML vs mockup aprovado em 27/05).
8. **BAIXO** — Instalar TPMS + sensor de temperatura de câmbio no Bubi quando o Flávio decidir. Software já está pronto.
