// Smoke ProximityWatcher — SKIPPED no P1 Fast
//
// O módulo `src/cockpit/proximity-watcher.js` (e seu único cliente
// `focus-mode.js`) NÃO foi extraído na criação do P1 Fast em 2026-04-30
// porque dependem do pipeline de cockpit (FocusMode, FrasesPermitidas
// do broker, integração com SPEC_FOCO_TRECHO da UI).
//
// O smoke original tinha 16 casos (PW-helper-01..04 + PW-01..15).
// Todos referenciam `proximity-watcher.js` — quando o módulo for
// promovido a domínio (sem deps de cockpit), restaurar os testes a
// partir do FAM Racing original em
//   `/Users/imac/Projetos/FAM Racing/tests/node-smoke-proximity-watcher.mjs`.
//
// Mantemos o arquivo (em vez de deletar) pra que `npm run smoke` siga
// chamando-o sem quebrar — e o histórico fique visível.

console.log('⊘ smoke skipped — ProximityWatcher fora do P1 Fast (ver topo do arquivo)');
console.log('\n0 ok / 0 fail (skipped)');
process.exit(0);
