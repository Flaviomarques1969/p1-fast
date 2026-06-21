# TASK_INIT — Auditoria de verdade + plano dos 3 dias (captura T4000+GPS+vídeo no notebook)

## Pedido original (Flávio) — 2026-06-21
"Desenvolvemos a semana toda; você disse que tinha feito a captura dos dados da T4000 e do GPS. Ontem
testamos, você disse que não salvou na nuvem; pedi pra consertar, você disse que tinha consertado; hoje
testamos de novo e não estava feito. Perdemos os testes de pista. Agora temos 3 dias pra finalizar o
aplicativo que roda no notebook Windows e captura T4000 + GPS + vídeo do Osmo 6 (videoconferência).
Faça análise profunda do que existe e do que foi feito. Use um AUDITOR pra checar as verdades do que
você me fala. Crie uma COMISSÃO pra checar evidências e montar um plano de trabalho."

## Objetivo (1 frase)
Estabelecer, só com evidência verificável, o que de fato existe/foi feito na captura (T4000+GPS+vídeo),
auditar minhas afirmações, e entregar um plano de trabalho para o app do notebook em 3 dias.

## Critério objetivo de conclusão
(1) Tabela de verdade das minhas alegações (verdadeiro/falso/parcial) com evidência arquivo:linha;
(2) inventário real do que captura, onde salva (local x nuvem), o que está testado;
(3) plano dos 3 dias priorizado, com critério de pronto e riscos. Tudo sem inferência.

## Leitura confirmada
- ~/.claude/CLAUDE.md: sim · memória global + memória P1 Fast: sim · CLAUDE.md do projeto +
  ARQUITETURA_DEFINITIVA + ADR-023: sim.

## Estado REAL já verificado (não inferido) antes de abrir a comissão
- Gravador local existe: `web/cockpit/session-recorder.js` + cópia em `web/teste-aparelhos/`. Captura
  MOTOR (10 Hz, cru) no painel do piloto (banco `p1fast-sessoes-cockpit`) e GPS (taxa cheia, cru) na
  Central (banco `p1fast-sessoes`). DOIS bancos LOCAIS (IndexedDB no navegador), separados.
- NÃO há upload da sessão CRUA completa pra nuvem. O que vai pra nuvem hoje:
  (a) canal ao vivo `cockpit-bubi-live` (transmissão efêmera, não é arquivo);
  (b) `web/cockpit/voltas-persister.js:44` grava em tabela `sessoes` (resumo de volta — a confirmar
      o que exatamente);
  (c) `src/pipeline/iphone-uploader.js` = caminho do iPhone, marcado "Etapa 3" (não ligado).
- Decisão registrada do PRÓPRIO Flávio em 21/06 (opção C): manter os 2 bancos separados, gravação 100%
  LOCAL, e NÃO fazer upload agora (`p1-fast-gravador-blindagem-2026-06-21`).
- App do notebook Windows EXISTE: `windows/cockpit/P1Fast.Cockpit.sln` com projetos Domain, UI,
  **T4000Capture**, **T4000LiveDemo** (o "LiveDemo" levanta suspeita de demonstração), Domain.Tests.
  Estado real (compila? captura de verdade ou demo?) = a comissão verifica.
- Vídeo Osmo 6 / Daily.co: aparece em `web/teste-aparelhos/index.html` e no iOS (VoltaVideoIndexer,
  AssistirView). Se existe gravação/transmissão do vídeo no NOTEBOOK = a comissão verifica.

## Ambiente alvo: desenvolvimento. Produção protegida: sim.
## Autorização para produção: não. Evidência: não recebida.
## Risco: alta carga emocional + prazo (3 dias) + tests de pista perdidos. Não inventar, não prometer.
## Status inicial: iniciado (comissão + auditor disparados).
