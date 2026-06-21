# Continuar — gravar 100% dos dados (T4000 motor + GPS, liga→desliga)

## Pedido (Flávio) — 2026-06-21
"p1 fast continue o trabalho de gravar 100% dos dados"

## Objetivo (1 frase)
Garantir que UMA sessão grave 100% do motor (T4000) E 100% do GPS juntos, do liga ao desliga, no notebook.

## Critério objetivo de conclusão
Existir um caminho que produz um arquivo de sessão único com motor cru completo + GPS cru completo,
validado com dado real e testes verdes — OU decisão de arquitetura registrada do Flávio sobre ONDE os
dois fluxos se juntam (cockpit / Central / iPhone), porque hoje estão em apps e bancos separados.

## Leitura confirmada
- ~/.claude/CLAUDE.md: sim
- ~/.claude-decisoes/padroes.md: sim
- ~/.claude/FLAVIO_EXECUTION_PROTOCOL.md: sim
- ~/.claude/FLAVIO_DONE_CHECKLIST.md: sim
- ~/.claude/FLAVIO_ENVIRONMENT_RULES.md: sim
- ~/.claude/FLAVIO_COMMUNICATION_RULES.md: sim
- Memória global + memória P1 Fast: sim
- CLAUDE.md do projeto + ADR-023/ARQUITETURA_DEFINITIVA: sim

## Estado REAL verificado hoje (não inferido)
- Gravador construído ontem (20/06) está intacto. Testes: 32 ok + 11 ok (IndexedDB real). 
- web/cockpit/main-t3000.js (painel do piloto), banco `p1fast-sessoes-cockpit`:
  - linha 973: grava MOTOR na origem, 10 Hz, completo + cru. (MOTOR 100%)
  - linha 504: grava GPS só do espelho/broadcast (sem cru). (GPS PARCIAL)
- web/teste-aparelhos/index.html (Central de Pista), banco `p1fast-sessoes`:
  - linha 529: grava GPS na taxa cheia do RaceBox + cru. (GPS 100%)
  - linha 254: grava MOTOR só do broadcast (5 Hz, sem cru). (MOTOR PARCIAL)
- CONCLUSÃO: nenhum banco tem os DOIS em cheio. Falta convergir motor+GPS numa sessão só.

## Ponto de decisão (arquitetura — do Flávio)
Onde motor e GPS se juntam para a sessão 100% completa: A) Central vira gravador completo (conecta
T4000 + RaceBox na mesma tela); B) roda os dois apps e funde por horário; C) deixa separado e só blinda
contra perda. Recomendação: A. Aguardando escolha antes de alterar.

## Ambiente alvo: desenvolvimento. Produção protegida: sim.
## Autorização para produção: não. Evidência: não recebida.
## Risco: tocar no painel do piloto (layout sagrado) e contradizer ADR-023 (iPhone agregador). Mitigar
   fazendo a captura completa na Central (engenharia), sem mexer no cockpit, e como protótipo web.
## Status inicial: iniciado (aguardando decisão de convergência).

## DECISÃO DO FLÁVIO (21/06) — opção C: manter os dois bancos separados e SÓ blindar
Não unificar agora. Cada app continua gravando 100% do seu lado (painel=motor, Central=GPS).
Reforço pedido: (1) alarme VISÍVEL se a gravação parar; (2) aviso quando o espaço estiver acabando.

## O que foi feito (aditivo, nada removido)
1. web/cockpit/session-recorder.js (+ cópia idêntica em teste-aparelhos): estado() agora expõe
   `ativo` e `alarme` ('parada-armazenamento' | 'perdendo-amostras' | null). Novos `classificarEspaco`
   (puro, testável) e `estimarArmazenamento` (lê navigator.storage.estimate → usado/cota/pct/nível).
2. web/teste-aparelhos/index.html (Central): faixa de alarme vermelha no card de gravação + linha
   "Espaço no notebook" (verde/amarelo/vermelho). BUILD = 2026-06-21-BLINDAGEM.
3. web/cockpit/main-t3000.js (painel do piloto): vigia que só aparece SE falhar (faixa vermelha no
   topo, some sozinha ao normalizar) — NÃO toca no layout normal. Saúde em window.__P1_SESSAO_SAUDE__.
4. web/teste-aparelhos/_validar-blindagem.html (NOVO): página de prova isolada (sem nuvem) com botões
   pra forçar perda/parada e ver o alarme + espaço de verdade.
5. tests/node-smoke-session-recorder.mjs: +11 casos (alarme e classificação de espaço).

## Validação executada (resultado real)
- node --check: main-t3000, os dois session-recorder → OK. Módulos idênticos (diff -q).
- node tests/node-smoke-session-recorder.mjs → 43 ok / 0 fail.
- node tests/node-smoke-session-recorder-idb.mjs → 11 ok / 0 fail.
- npm run smoke (bateria) → só as 3 falhas PRÉ-EXISTENTES de paridade de banco (checklist_item/
  checklist_tique, do trabalho de 19/06). Nenhuma falha nova.
- Página de prova aberta no Chrome (127.0.0.1:8094/_validar-blindagem.html).

## Ambiente: desenvolvimento. Produção alterada: não. Nada publicado, gravação 100% local.
## Status final: concluído (blindagem entregue e testada). Unificação e upload seguem como decisão futura.
