// Smoke do conversor OKLCH → sRGB (tools/oklch-to-srgb.mjs).
// Pin tests com referência (Björn Ottosson 2020) — qualquer drift na
// matriz quebra. Roda via `node tests/node-smoke-oklch.mjs` (incluído
// no `npm run smoke` se for adicionado ao pipeline).

import { oklchToHex, parseOklch, extractTokens } from '../tools/oklch-to-srgb.mjs';

let ok = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log('✓', name); ok++; }
  catch (e) { console.log('✗', name, '—', e.message); fail++; }
}

// Referências calculadas com a fórmula canônica + verificadas contra
// oklch.com (referência pública). Tolerância: ±1 em cada canal RGB
// (arredondamento varia com runtime).
function near(actual, expected, tol = 1) {
  const a = parseInt(actual.slice(1, 3), 16);
  const b = parseInt(actual.slice(3, 5), 16);
  const c = parseInt(actual.slice(5, 7), 16);
  const ea = parseInt(expected.slice(1, 3), 16);
  const eb = parseInt(expected.slice(3, 5), 16);
  const ec = parseInt(expected.slice(5, 7), 16);
  if (Math.abs(a - ea) > tol) throw new Error(`R: ${a} vs ${ea}`);
  if (Math.abs(b - eb) > tol) throw new Error(`G: ${b} vs ${eb}`);
  if (Math.abs(c - ec) > tol) throw new Error(`B: ${c} vs ${ec}`);
}

t('OKLCH branco puro → #ffffff', () => {
  const r = oklchToHex(1.0, 0, 0);
  near(r.hex, '#ffffff');
});

t('OKLCH preto puro → #000000', () => {
  const r = oklchToHex(0, 0, 0);
  near(r.hex, '#000000');
});

t('Padrão B --bg oklch(20% 0.005 240) → #141618', () => {
  const r = oklchToHex(0.20, 0.005, 240);
  near(r.hex, '#141618');
});

t('Padrão B --accent oklch(78% 0.13 235) → #55c4fe', () => {
  const r = oklchToHex(0.78, 0.13, 235);
  near(r.hex, '#55c4fe');
});

t('Padrão B --green oklch(78% 0.16 150) → #5fd37f', () => {
  const r = oklchToHex(0.78, 0.16, 150);
  near(r.hex, '#5fd37f');
});

t('parseOklch lê alpha quando presente', () => {
  const p = parseOklch('oklch(82% 0.10 235 / .15)');
  if (!p) throw new Error('parse falhou');
  if (Math.abs(p.L - 0.82) > 1e-6) throw new Error('L=' + p.L);
  if (p.alpha !== 0.15) throw new Error('alpha=' + p.alpha);
});

t('parseOklch sem alpha retorna alpha=1', () => {
  const p = parseOklch('oklch(78% 0.13 235)');
  if (!p) throw new Error('parse falhou');
  if (p.alpha !== 1) throw new Error('alpha=' + p.alpha);
});

t('extractTokens extrai 10 tokens nomeados do mockup Padrão B', async () => {
  const { readFile } = await import('node:fs/promises');
  const html = await readFile('_design-reference/historico-evento/mockup-evento-B.html', 'utf8');
  const tokens = extractTokens(html);
  if (tokens.length !== 10) throw new Error('len=' + tokens.length);
  const names = tokens.map(x => x.token);
  for (const expected of ['--bg','--surface','--text','--accent','--green']) {
    if (!names.includes(expected)) throw new Error(`token ${expected} ausente`);
  }
});

t('Output hex é sempre 7 chars (#rrggbb)', () => {
  const variantes = [
    [0.20, 0.005, 240], [0.78, 0.13, 235], [0.78, 0.16, 150],
    [0.50, 0.20, 30],   [0.95, 0.003, 240], [0.10, 0.05, 60],
  ];
  for (const [L, C, h] of variantes) {
    const { hex } = oklchToHex(L, C, h);
    if (!/^#[0-9a-f]{6}$/.test(hex)) throw new Error('hex inválido: ' + hex);
  }
});

t('Alpha < 1 retorna rgba string', () => {
  const r = oklchToHex(0.78, 0.13, 235, 0.5);
  if (!r.rgba.startsWith('rgba(')) throw new Error('alpha não virou rgba: ' + r.rgba);
});

console.log(`\n${ok} ok / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
