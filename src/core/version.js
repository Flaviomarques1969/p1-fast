// ═══════════════════════════════════════════════════════════
// version — fonte única de versionamento do app
// ═══════════════════════════════════════════════════════════
// Manter em sincronia com `package.json` e com a constante `VERSION`
// do `sw.js` (service worker não pode importar módulos ES — tem sua
// cópia, com marcador "// SYNC com src/core/version.js").
//
// Bumpar VERSION:
//   1. Atualizar abaixo
//   2. Atualizar `package.json` version
//   3. Atualizar `VERSION` em `sw.js`
//
// O BUILD descreve o enfoque corrente do trabalho — é livre.

export const VERSION = '1.0.8';
export const BUILD   = 'override-stint-expandido-14-tipos-effective-setup-pos-stint';
