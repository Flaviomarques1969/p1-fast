// Smoke do cockpit web (MS-13.2) — paridade byte-for-byte com mockup canônico.
//
// Regra dura (Flávio 2026-05-09 + §9.1 do PLANO_FASE_1):
// O mockup canônico `_design-reference/mockup-cockpit-piloto.html` é o contrato
// imutável. Os arquivos em `web/cockpit/` são DERIVADOS por extração linear.
// Qualquer mudança visual entra no canônico primeiro; depois re-extrai com
// os comandos sed deste smoke.
//
// Este smoke garante que `web/cockpit/index.html`, `cockpit.css` e `cockpit.js`
// contêm exatamente o que está dentro das fronteiras `<style>...</style>`,
// `<script>...</script>` e do DOM do canônico — sem 1 byte de divergência.

import { readFileSync } from 'node:fs';

const CANONICAL = '_design-reference/mockup-cockpit-piloto.html';
const PROD_DIR = 'web/cockpit';

let ok = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log('✓', name); ok++; }
  catch (e) { console.log('✗', name, '—', e.message); fail++; }
}

const canonical = readFileSync(CANONICAL, 'utf8').split('\n');

// ── Localizar as fronteiras esperadas ────────────────────────

function findLine(text, startIdx = 0) {
  for (let i = startIdx; i < canonical.length; i++) {
    if (canonical[i] === text) return i + 1; // 1-indexed
  }
  throw new Error(`não encontrei linha "${text}"`);
}

const styleOpen  = findLine('<style>');
const styleClose = findLine('</style>', styleOpen);
const scriptOpen = findLine('<script>', styleClose);
const scriptClose = findLine('</script>', scriptOpen);

t('CKW-01 mockup canônico tem <style> e </style> nas linhas esperadas', () => {
  // Atualizado 2026-05-29 após Onda 8 (tipos de trecho, alerta-escandaloso,
  // barra de aprendizado). Se mudar de novo, reextraia css/js com sed e
  // atualize estes números (são apenas o limite de erro útil pra detectar
  // drift acidental).
  if (styleOpen !== 10 || styleClose !== 862) {
    throw new Error(`<style> em ${styleOpen}, </style> em ${styleClose} — mockup mudou de tamanho. Atualizar este smoke + tools de extração.`);
  }
});

t('CKW-02 mockup canônico tem <script> e </script> nas linhas esperadas', () => {
  if (scriptOpen !== 1079 || scriptClose !== 1330) {
    throw new Error(`<script> em ${scriptOpen}, </script> em ${scriptClose} — mockup mudou. Atualizar smoke.`);
  }
});

// ── Extração in-memory ───────────────────────────────────────

const cssExpected = canonical.slice(styleOpen, styleClose - 1).join('\n') + '\n';
const jsExpected = canonical.slice(scriptOpen, scriptClose - 1).join('\n') + '\n';
const domExpected = canonical.slice(styleClose, scriptOpen - 1).join('\n') + '\n';

const cssActual = readFileSync(`${PROD_DIR}/cockpit.css`, 'utf8');
const jsActual = readFileSync(`${PROD_DIR}/cockpit.js`, 'utf8');
const indexActual = readFileSync(`${PROD_DIR}/index.html`, 'utf8');

// ── Paridade CSS ─────────────────────────────────────────────

t('CKW-03 cockpit.css é byte-for-byte do <style> canônico', () => {
  if (cssActual !== cssExpected) {
    const lenA = cssActual.length, lenE = cssExpected.length;
    throw new Error(`divergência: arquivo ${lenA} bytes, esperado ${lenE}. Re-extrair com: sed -n '${styleOpen + 1},${styleClose - 1}p' ${CANONICAL} > ${PROD_DIR}/cockpit.css`);
  }
});

// ── Paridade JS ──────────────────────────────────────────────

t('CKW-04 cockpit.js é byte-for-byte do <script> canônico', () => {
  if (jsActual !== jsExpected) {
    const lenA = jsActual.length, lenE = jsExpected.length;
    throw new Error(`divergência: arquivo ${lenA} bytes, esperado ${lenE}. Re-extrair com: sed -n '${scriptOpen + 1},${scriptClose - 1}p' ${CANONICAL} > ${PROD_DIR}/cockpit.js`);
  }
});

// ── Paridade do DOM dentro de index.html ─────────────────────

t('CKW-05 index.html contém o DOM exato do canônico (entre </style> e <script>)', () => {
  if (!indexActual.includes(domExpected.trimEnd())) {
    throw new Error(`DOM do index.html divergiu do canônico. Re-extrair com: sed -n '${styleClose + 1},${scriptOpen - 1}p' ${CANONICAL}`);
  }
});

// ── Estrutura do index.html — head + refs externos + DOM + close ──

t('CKW-06 index.html abre com <!doctype html> + <html lang="pt-BR" data-mobile="true">', () => {
  if (!indexActual.startsWith('<!doctype html>\n<html lang="pt-BR" data-mobile="true">')) {
    throw new Error('cabeçalho HTML divergiu do canônico');
  }
});

t('CKW-07 index.html linka cockpit.css em vez de embutir <style>', () => {
  if (!indexActual.includes('<link rel="stylesheet" href="cockpit.css">')) {
    throw new Error('falta <link rel="stylesheet" href="cockpit.css">');
  }
  if (indexActual.includes('<style>')) {
    throw new Error('index.html ainda tem <style> embutido — precisa só linkar cockpit.css');
  }
});

t('CKW-08 index.html linka cockpit.js em vez de embutir <script>', () => {
  if (!indexActual.includes('<script src="cockpit.js"></script>')) {
    throw new Error('falta <script src="cockpit.js"></script>');
  }
  if (indexActual.includes('<script>')) {
    throw new Error('index.html ainda tem <script> inline — precisa só linkar cockpit.js');
  }
});

t('CKW-09 index.html fecha com </body></html> exatamente como o canônico', () => {
  if (!indexActual.trimEnd().endsWith('</body>\n</html>')) {
    throw new Error('fecho de body/html divergiu');
  }
});

// ── Data-attrs e elementos chave (sanity check; o teste de paridade já cobre) ──

t('CKW-10 index.html preserva os 4 data-attrs do device', () => {
  for (const attr of [
    'data-trecho-status="neutro"',
    'data-msg-state="oculta"',
    'data-shift-fire="idle"',
    'data-state="off"',
  ]) {
    if (!indexActual.includes(attr)) throw new Error(`falta ${attr}`);
  }
});

t('CKW-11 index.html preserva 12 LEDs do shift-light', () => {
  const dotMatches = indexActual.match(/<span class="shift-light__dot"/g) ?? [];
  if (dotMatches.length !== 12) throw new Error(`esperado 12 dots, achei ${dotMatches.length}`);
});

t('CKW-12 index.html preserva 4 pontos do apex (entrada, freio, ápice, saída)', () => {
  for (const ponto of ['Entrada', 'Freio', 'Ápice', 'Saída']) {
    if (!indexActual.includes(`>${ponto}<`)) throw new Error(`falta apex "${ponto}"`);
  }
});

t('CKW-13 index.html preserva 12 blocos da stint-bar', () => {
  const blockMatches = indexActual.match(/<div class="stint-bar__block/g) ?? [];
  if (blockMatches.length !== 12) throw new Error(`esperado 12 blocks, achei ${blockMatches.length}`);
});

// ── CSS preserva os tokens de cor críticos ───────────────────

t('CKW-14 cockpit.css preserva tokens críticos do :root (oklch)', () => {
  for (const token of [
    '--bom: oklch(80% 0.22 145)',
    '--erro: oklch(68% 0.26 27)',
    '--sistema: oklch(78% 0.16 225)',
    '--foco: oklch(82% 0.19 70)',
    '--ouro: oklch(74% 0.16 73)',
    '--halo-recorde: oklch(78% 0.18 65 / .42)',
    '--halo-pior:    oklch(56% 0.22 305 / .42)',
  ]) {
    if (!cssActual.includes(token)) throw new Error(`falta token "${token}"`);
  }
});

t('CKW-15 cockpit.css preserva @keyframes do shift-light', () => {
  for (const kf of ['ledIgnite', 'shiftFire', 'shiftHousingFire', 'deviceFireFlash', 'shiftOverrev', 'shiftHousingOverrev', 'alltimeBloom', 'lightWaveBidir']) {
    if (!cssActual.includes(`@keyframes ${kf}`)) throw new Error(`falta @keyframes ${kf}`);
  }
});

// ── JS preserva as funções públicas usadas pelo cockpit ──────

t('CKW-16 cockpit.js preserva funções públicas (setShiftLevel, setMessage, hideMessage, startShiftAutoCycle)', () => {
  for (const fn of ['function setShiftLevel(', 'function setMessage(', 'function hideMessage(', 'function startShiftAutoCycle(']) {
    if (!jsActual.includes(fn)) throw new Error(`falta ${fn}`);
  }
});

console.log(`\nCockpit web: ${ok} ok / ${fail} fail`);
if (fail > 0) process.exit(1);
