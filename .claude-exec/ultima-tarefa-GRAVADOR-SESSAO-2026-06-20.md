# Gravador de sessão (liga→desliga, T4000+GPS) — 20/06/2026

## Pedido (Flávio)
"Execute até o fim." Objetivo: gravar dado COMPLETO e DETALHADO de T4000 (motor) + GPS, do liga ao
desliga do carro, TODA vez, garantido, no app do notebook. (Veio da auditoria adversarial que achou
a causa-raiz: não existia gravador no caminho do notebook.)

## Ambiente / regra
Desenvolvimento. Nada publicado (sem deploy). Canal cockpit-bubi-live = produção → gravação é LOCAL
(IndexedDB), nunca publica dado de teste. Sem "MIGRAR PARA PRODUÇÃO".

## O que foi construído (aditivo, nada removido)
1. **web/teste-aparelhos/session-recorder.js** (NOVO) — módulo do gravador: criarGravador (ciclo
   liga/desliga, contagem, taxa, lacunas, recuperação de órfã, getter `ativo`), criarStoreMemoria
   (testes/degradação) e criarStoreIndexedDB (navegador, append-only, índice porSessao, resumirSessao).
2. **web/teste-aparelhos/index.html** (Central de Pista) — ganhou: import do módulo; gravação do GPS
   na TAXA CHEIA do RaceBox + bytes crus (gancho em decode()); gravação do motor recebido (onCarSample);
   selo "GRAVAÇÃO" no board; card "Gravação da sessão" com contadores ao vivo + resumo + botão Baixar;
   recuperação de sessão órfã no boot; estado por flag (não lê texto do selo). BUILD = 2026-06-20-GRAVADOR.
3. **web/cockpit/main-t3000.js** (painel do piloto) + **web/cockpit/session-recorder.js** (cópia idêntica)
   — grava o MOTOR na ORIGEM (10 Hz, amostra inteira do parser + bytes crus `merged`), antes do
   afunilamento de 5 Hz; grava o GPS espelho; tick + recuperação de órfã no boot; export por console
   (window.__P1_BAIXAR_SESSAO__). SEM tocar no layout do painel do piloto. Banco próprio
   (p1fast-sessoes-cockpit), separado da Central (p1fast-sessoes).
4. **web/teste-aparelhos/_validar-gravador.html** (NOVO) — página de validação isolada (sem nuvem, sem
   publicar) que roda o gravador real com os dados reais (motor 26/05 + GPS Brasília) no IndexedDB real.
5. **tests/node-smoke-session-recorder.mjs** (32 ok) + **tests/node-smoke-session-recorder-idb.mjs**
   (11 ok, IndexedDB real via fake-indexeddb + dados reais; grava 500 amostras e exporta completo).

## Revisão adversarial
- 1ª (Central, 5 auditores): aprovado-com-ressalvas, sem bloqueante, pronto pra validar.
- 2ª (painel do piloto, 1 auditor): aprovado-com-ressalvas. 3 melhorias aplicadas: desliga sozinho se
  o armazenamento falhar (getter `ativo` + guard nos ganchos); respeita window.__P1_ORIGEM_SIM__
  (motor com override de simulação); recupera órfã sem carregar tudo na memória (resumirSessao por cursor).

## Validação executada
- node --check: módulo, painel (main-t3000), trecho da Central — OK.
- node tests/node-smoke-session-recorder.mjs → 32 ok / 0 fail.
- node tests/node-smoke-session-recorder-idb.mjs → 11 ok / 0 fail (IndexedDB real + dados reais).
- npm run smoke (bateria completa) → só as 3 falhas PRÉ-EXISTENTES de paridade de banco
  (checklist_item/checklist_tique, trabalho de 19/06), nenhuma falha nova.
- Página de validação aberta no Chrome (127.0.0.1:8091), gravando no IndexedDB real.

## Estado vs objetivo
- GPS: COMPLETO (taxa cheia ~25 Hz + bytes crus, liga→desliga) — na Central.
- Motor: COMPLETO (10 Hz na origem + amostra inteira + bytes crus) — no painel do piloto.
- Liga/desliga automático + recuperação de órfã + marcação de lacuna: feito e testado.

## Pendências = DECISÃO do Flávio (não bug; não fiz por serem decisão dele)
1. UNIFICAR: hoje GPS (full) fica na Central e Motor (full) fica no painel — bancos separados (são abas/
   apps diferentes). Juntar numa sessão só é decisão de arquitetura.
2. RETENÇÃO: o dado fica no notebook; subir pra um destino que NÃO seja o canal ao vivo (export/upload
   diferido) exige decisão (e provavelmente "MIGRAR PARA PRODUÇÃO").
3. Limpeza/cota do armazenamento local em sessões muito longas (rotação/aviso).

## TASK_DONE
- Pedido conferido: sim. Ambiente: desenvolvimento. Produção alterada: não.
- Arquivos inspecionados/alterados: sim (citados acima). Removido indevidamente: nada (tudo aditivo).
- Testes executados e reportados: sim (32 + 11 verdes; bateria só com 3 falhas pré-existentes).
- Resultado: concluído (objetivo central entregue e testado). Pendências = 3 decisões do Flávio acima.
