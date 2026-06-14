# Auditoria severa — Shift Light P1 Fast
Data: 2026-05-29

## Resumo
- Linha oficial (main): existe shift light v1 (ponto perto do pico de torque), testado, 90/90 testes verdes em `npm run test:shift-light`.
- Linha isolada (worktree v04-promote-2026-05-26): existe shift light v2 com 3 modos (Durabilidade/Normal/Agressivo), cálculo por cruzamento de força, aprendizado online, smoke 24/24 verde. **NÃO plugado no entry point ao vivo (`main-t3000.js`).** Migration de banco 0034 não aplicada em produção.
- Curva do dinamômetro Bubi: 79 pontos cadastrados em arquivo SQL (migration 0033). Autorização do Flávio em 28/05/2026 registrada no cabeçalho; aplicação em produção não confirmada via banco.

## Veredito por componente

| # | Componente | Veredito | Evidência | Risco prático |
|---|-----------|----------|-----------|---------------|
| 1 | Cálculo do ponto ótimo por marcha (cruzamento de potência) | Pronta com ressalva | `src/domain/dyno-target-calculator.js:36-101` (v1) e `web/cockpit/forca-integrada-calculator.js:134-192` (v2) | Sem gear_ratios cadastrados, v1 cai em 90% do redline silenciosamente |
| 2 | 3 modos (Durabilidade/Normal/Agressivo) | Pronta com ressalva | `web/cockpit/shift-light-modos.js` + migration 0034 | Só existe no worktree v04, não em main; UI de seleção pré-stint não está acoplada |
| 3 | Aprendizagem online entre voltas | Pronta com ressalva | `web/cockpit/aprendizado-confianca.js:64-72` (6 testes verdes) | Orquestrador novo só está plugado em main.js (mock) e simulação HTML, não em main-t3000.js (real) |
| 4 | Persistência entre sessões | Não pronta | `pontos-troca-persister.js` + tabela 0034 | Tabela `pontos_troca_aprendidos` não existe em produção; aprendizado zera a cada sessão |
| 5 | Dados Bubi (79 pontos da curva) | Pronta com ressalva | `0033_bootstrap_bubi_e_dyno_curve.sql` | Não confirmei via banco que rodou em produção |
| 6 | UI visual do shift light no cockpit ao vivo | Pronta | `index-live.html:65-73` + `cockpit-renderer.js:84-96` (14 testes verdes) | Barra de aprendizado renderiza, mas se nada plugar o orquestrador novo fica em 0% para sempre |
| 7 | Plug com a fonte de dados ao vivo (cockpit-bubi-live) | Pronta para publicação, não pronta para consumo da regra nova | `cloud-bridge.js:17,48` + `main-t3000.js:14` | Cockpit do piloto usa T3000 USB local direto; canal é só para terceiros (box, monitor) — não é problema, mas precisa documentar |
| 8 | Testes automatizados | Pronta com ressalva | `npm run test:shift-light` 90/90; smoke v04 24/24 | Zero teste do orquestrador (peça que costura tudo); zero teste fim-a-fim plugando dado ao vivo no painel |
| 9 | Calibração por carro (caso outro carro entre) | Não pronta | BUBI_CARRO_ID hardcoded em `dyno-loader.js:15` e `main-t3000.js:55` | Plugar outro carro = aplicar limites do Bubi (errado) |
| 10 | Modo seguro (fallback quando faltar curva) | Pronta com ressalva | `src/domain/safe-mode.js` + `dyno-target-calculator.js:45-58` | Piloto NÃO tem indicador visual de que está em modo fallback |

## Veredito final
Shift light v1 (versão atual, baseada em torque + offset) está PRONTO para pista no Bubi com ressalvas pequenas de fallback silencioso.

Shift light v2 (3 modos + cruzamento de força + aprendizado online, aprovado em 29/05) está IMPLEMENTADO E TESTADO EM ISOLAMENTO, mas NÃO está plugado no loop ao vivo (`main-t3000.js`) e NÃO está em produção (worktree v04 ainda não foi incorporado à linha oficial).

Plugar e levar para produção é trabalho focado de 1-2 dias, não mais.

## O que falta, em ordem de criticidade
1. Confirmar que a migration 0033 (carro Bubi + 79 pontos) está aplicada em produção. SELECT direto no banco resolve.
2. Cadastrar gear_ratios do Bubi (5 marchas + diferencial 3.94) — só existe em comentário no orquestrador (linha 26), não no banco.
3. Incorporar o worktree v04-promote em main: migration 0034 + arquivos JS novos + dyno-loader.
4. Aplicar migration 0034 em produção (`pontos_troca_aprendidos`, `envelopes_seguranca_stint`, `qualidade_troca_marcha`).
5. Plugar `criarShiftLightOrquestrador` em `main-t3000.js`.
6. Spec automatizada do orquestrador + e2e plugando dado simulado → orquestrador → painel.
7. UI de seleção de modo pré-stint plugada no fluxo do cockpit ao vivo.
8. Indicador visual "FALLBACK" no painel quando dyno/gear_ratios ausentes.
9. Mecanismo de seleção de carro ativo (remover BUBI_CARRO_ID hardcoded).
10. Documentar e validar o que acontece se o T3000 USB local cai: shift light usa último RPM? Apaga? Mostra alerta?
