// ═══════════════════════════════════════════════════════════
// Smoke: nenhum artefato de build tracked
// ═══════════════════════════════════════════════════════════
// Detectaria os 2357 .build/ files que escaparam pra main na auditoria
// 2026-05-02. Defesa permanente — se alguém der `git add -A` num diretório
// com build cache, este smoke quebra antes do PR ser aberto.
//
// Padrões proibidos (cobertos pelo .gitignore mas precisam ser reforçados
// pra detecção precoce):
//   - **/.build/**       (SwiftPM)
//   - **/DerivedData/**  (Xcode)
//   - **/.swiftpm/**     (SwiftPM workspace state)
//   - **/xcuserdata/**   (Xcode per-user)
//   - **/node_modules/** (npm)
//   - .DS_Store          (macOS)
//   - .claude/worktrees/ (Claude Code estado efêmero)

import { execSync } from 'node:child_process';

const PROIBIDOS = [
  /(^|\/)\.build(\/|$)/,
  /(^|\/)DerivedData(\/|$)/,
  /(^|\/)\.swiftpm(\/|$)/,
  /(^|\/)xcuserdata(\/|$)/,
  /(^|\/)node_modules(\/|$)/,
  /\.DS_Store$/,
  /(^|\/)\.claude\/worktrees(\/|$)/,
  /(^|\/)\.claude\/cache(\/|$)/,
  /(^|\/)\.claude\/sessions(\/|$)/,
  /\.env\.xcconfig$/,
  /(^|\/)\.env(\.local)?$/,
];

let ok = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log('✓', name); ok++; }
  catch (e) { console.log('✗', name, '—', e.message); fail++; }
}

const tracked = execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(Boolean);

t(`git ls-files lê >0 arquivos (sanity)`, () => {
  if (tracked.length === 0) throw new Error('zero arquivos — git command falhou?');
});

for (const pattern of PROIBIDOS) {
  const violators = tracked.filter(f => pattern.test(f));
  t(`Nenhum arquivo tracked match ${pattern}`, () => {
    if (violators.length > 0) {
      const sample = violators.slice(0, 5).join(', ');
      throw new Error(
        `${violators.length} arquivo(s) violando: ${sample}` +
        (violators.length > 5 ? ` ... (+${violators.length - 5})` : '')
      );
    }
  });
}

// Verifica que .gitignore tem os padrões críticos
import { readFile } from 'node:fs/promises';
const gi = await readFile('.gitignore', 'utf8');
const REQUIRED_GITIGNORE = [
  '**/.build/',
  '**/DerivedData/',
  '**/.swiftpm/',
  '.claude/worktrees/',
];
for (const pattern of REQUIRED_GITIGNORE) {
  t(`.gitignore inclui ${pattern}`, () => {
    if (!gi.includes(pattern)) throw new Error('ausente');
  });
}

console.log(`\n${ok} ok / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
