# Tarefa — Deixar o LEITOR DA T3000 ROBUSTO — 19/06/2026

## TASK_INIT
- Protocolo carregado: sim
- Padrões carregados: sim
- Ambiente alvo: desenvolvimento
- Produção protegida: sim
- Autorização para produção: não
- Pedido entendido: tornar o leitor USB da T3000 robusto (filtro de leitura inválida + religação automática) editando os arquivos reais em web/cockpit, sem deploy.
- Critério de conclusão: filtro de sanidade ativo (não publica/não mostra lixo, segura último valor bom), religação automática por trava/erro/N inválidas seguidas, caminho feliz intacto, testes passando.

## Plano (executado)
1. Parser: função pura `leituraPlausivel` + faixas físicas; anexar `sanidade`/`leituraPlausivel` ao sample sem quebrar contrato.
2. main: `sampleValido`, filtro no loop (segura último valor bom, conta inválidas), contadores no estado.
3. main: religação automática por bloco curto (N=30) e por leituras inválidas (N=8) reusando `reconectarT3000()`.
4. cloud-bridge: defesa em profundidade no `publishSample`.
5. Testes: parser (novos casos) + smoke novo de religação; rodar tudo + node --check.

## Arquivos alterados
- web/cockpit/t3000-usb-parser.js (aditivo: FAIXAS_FISICAS, leituraPlausivel, sanidade no retorno)
- web/cockpit/main-t3000.js (filtro no loop, contadores, religação por trava silenciosa, filtro no modo sem fio)
- web/cockpit/cloud-bridge.js (guarda de conteúdo no publishSample)
- tests/node-smoke-t3000-usb-parser.mjs (10 testes novos do filtro; nenhum removido)
- tests/node-smoke-t3000-religacao.mjs (NOVO: máquina de estados de contadores/religação)

## Testes/validação executados
- node --check nos 3 arquivos: OK
- node tests/node-smoke-t3000-usb-parser.mjs: 29 ok / 0 fail
- node tests/node-smoke-t3000-watchdog.mjs: 12/12 ok
- node tests/node-smoke-t3000-religacao.mjs: 6 ok / 0 fail

## TASK_DONE
- Pedido original conferido: sim
- Ambiente trabalhado: desenvolvimento
- Produção foi alterada: não
- Arquivos reais inspecionados: sim
- Alterações feitas: sim
- Testes/validação executados: sim
- Resultado: concluído
- Pendências reais: ajuste fino das faixas (lambda mínimo no boot frio) só com dado real de pista; o loop USB real não roda em Node (testado por réplica fiel da máquina de estados).
