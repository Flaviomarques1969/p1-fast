// ═══════════════════════════════════════════════════════════
// OKLCH → sRGB hex — conversor pra portar tokens do mockup HTML
// (CSS oklch()) pro Theme.swift do app iOS (sRGB hex/RGB).
// ═══════════════════════════════════════════════════════════
// Fórmula canônica (Björn Ottosson, 2020): OKLCH → OKLab → linear sRGB
// → sRGB (gamma). Sem deps, roda em Node 20+.
//
// Uso:
//   node tools/oklch-to-srgb.mjs                # extrai tokens do
//                                                  mockup canônico
//   node tools/oklch-to-srgb.mjs 78 0.13 235    # 1 cor pontual
//
// Saída: tabela markdown / hex per-token. Importável também:
//   import { oklchToHex } from './tools/oklch-to-srgb.mjs'

const MOCKUP_PATH = '_design-reference/historico-evento/mockup-evento-B.html';

// ─── OKLab → linear sRGB ─────────────────────────────────
function oklabToLinearSrgb(L, a, b) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  return [
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
}

// ─── linear sRGB → sRGB (gamma) ───────────────────────────
function linearToSrgb(x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
}

// ─── OKLCH → OKLab → sRGB → hex ───────────────────────────
export function oklchToHex(L, C, h /*deg*/, alpha = 1) {
  // L vem como 0-1 (não 0-100)
  const hr = (h * Math.PI) / 180;
  const a = C * Math.cos(hr);
  const b = C * Math.sin(hr);
  const [rL, gL, bL] = oklabToLinearSrgb(L, a, b);
  const r = Math.round(linearToSrgb(rL) * 255);
  const g = Math.round(linearToSrgb(gL) * 255);
  const bb = Math.round(linearToSrgb(bL) * 255);
  const clamp = (v) => Math.max(0, Math.min(255, v));
  const hex =
    '#' +
    clamp(r).toString(16).padStart(2, '0') +
    clamp(g).toString(16).padStart(2, '0') +
    clamp(bb).toString(16).padStart(2, '0');
  if (alpha < 1) return { hex, rgba: `rgba(${clamp(r)}, ${clamp(g)}, ${clamp(bb)}, ${alpha})` };
  return { hex, rgba: `rgb(${clamp(r)}, ${clamp(g)}, ${clamp(bb)})` };
}

// ─── Parser do CSS oklch() ────────────────────────────────
// Formato suportado: oklch(L% C h) ou oklch(L% C h / alpha)
const OKLCH_RE = /oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)/g;

export function parseOklch(str) {
  OKLCH_RE.lastIndex = 0;
  const m = OKLCH_RE.exec(str);
  if (!m) return null;
  return {
    L: parseFloat(m[1]) / 100,
    C: parseFloat(m[2]),
    h: parseFloat(m[3]),
    alpha: m[4] != null ? parseFloat(m[4]) : 1,
  };
}

// ─── Extrai --token: oklch(...) do mockup ─────────────────
const TOKEN_RE = /^\s*(--[a-z0-9-]+):\s*(oklch\([^)]+\))\s*;/gim;

export function extractTokens(html) {
  const out = [];
  let m;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(html)) !== null) {
    const parsed = parseOklch(m[2]);
    if (!parsed) continue;
    const { hex, rgba } = oklchToHex(parsed.L, parsed.C, parsed.h, parsed.alpha);
    out.push({
      token: m[1],
      oklch: m[2],
      L: parsed.L,
      C: parsed.C,
      h: parsed.h,
      alpha: parsed.alpha,
      hex,
      rgba,
    });
  }
  return out;
}

// ─── CLI ──────────────────────────────────────────────────
// Só executa quando chamado direto (não via import).
// Usa fileURLToPath pra comparar caminhos com espaços (URL-encoded).
const { fileURLToPath } = await import('node:url');
const isMain = fileURLToPath(import.meta.url) === process.argv[1];
if (!isMain) {
  // Importado como módulo — funções já estão exportadas, sai daqui.
  // (Hack pra `await import`s abaixo só rodarem no CLI.)
} else {
  await runCli();
}

async function runCli() {
const args = process.argv.slice(2);

if (args.length === 3) {
  const [L, C, h] = args.map(parseFloat);
  const r = oklchToHex(L > 1 ? L / 100 : L, C, h);
  console.log(JSON.stringify(r, null, 2));
  process.exit(0);
}

// Default: extrai do mockup canônico e imprime markdown
const { readFile } = await import('node:fs/promises');
const html = await readFile(MOCKUP_PATH, 'utf8');
const tokens = extractTokens(html);

// Também lista inline (não-tokenizados): oklch() usados direto em CSS rules.
const INLINE_RE = /oklch\([^)]+\)/g;
const tokenStrs = new Set(tokens.map((t) => t.oklch));
const inlineSeen = new Set();
const inline = [];
for (const m of html.matchAll(INLINE_RE)) {
  const s = m[0];
  if (tokenStrs.has(s) || inlineSeen.has(s)) continue;
  inlineSeen.add(s);
  const p = parseOklch(s);
  if (!p) continue;
  const { hex, rgba } = oklchToHex(p.L, p.C, p.h, p.alpha);
  inline.push({ oklch: s, hex, rgba, alpha: p.alpha });
}

console.log('# Tokens do Padrão B — OKLCH → sRGB\n');
console.log(`Fonte: \`${MOCKUP_PATH}\`\n`);
console.log(`Conversão via \`tools/oklch-to-srgb.mjs\` (Björn Ottosson 2020).\n`);
console.log(`## Tokens nomeados (${tokens.length})\n`);
console.log('| Token | OKLCH | Hex | RGB(A) |');
console.log('|---|---|---|---|');
for (const t of tokens) {
  console.log(`| \`${t.token}\` | \`${t.oklch}\` | \`${t.hex}\` | \`${t.rgba}\` |`);
}
console.log(`\n## Cores inline (${inline.length}) — sem token nomeado\n`);
console.log('Usadas direto em rules CSS (gradientes, hovers, shadows). Devem virar variantes derivadas no Theme.swift, não tokens públicos.\n');
console.log('| OKLCH | Hex | RGB(A) |');
console.log('|---|---|---|');
for (const t of inline) {
  console.log(`| \`${t.oklch}\` | \`${t.hex}\` | \`${t.rgba}\` |`);
}
}  // fim de runCli
