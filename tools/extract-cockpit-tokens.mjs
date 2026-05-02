// ═══════════════════════════════════════════════════════════
// Extrai tokens OKLCH dos 3 mockups do cockpit (Sprint 1B)
// ═══════════════════════════════════════════════════════════
// Output: docs/THEME_TOKENS_COCKPIT.md.
//
// 3 mockups varridos:
//   • mockup-cockpit-piloto.html (base)
//   • mockup-cockpit-ghost.html (halos + chuva térmica)
//   • mockup-cockpit-comparacao.html (split-screen)
//
// Cockpit usa paleta DIFERENTE do hub (--bg=oklch(0% 0 0) preto puro
// vs hub oklch(20%) cinza escuro) — instrumento operacional, não site.

import { readFile } from 'node:fs/promises';
import { extractTokens, parseOklch, oklchToHex } from './oklch-to-srgb.mjs';

const HUB_TOKENS_PATH = 'docs/THEME_TOKENS.md';
const COCKPIT_MOCKUPS = {
  'Cockpit base':       '_design-reference/mockup-cockpit-piloto.html',
  'Cockpit ghost':      '_design-reference/mockup-cockpit-ghost.html',
  'Cockpit comparação': '_design-reference/mockup-cockpit-comparacao.html',
};

// Lê tokens do hub pra comparação (já validados via THEME_TOKENS.md).
const PADRAO_B_PATH = '_design-reference/historico-evento/mockup-evento-B.html';
const padraoBHtml = await readFile(PADRAO_B_PATH, 'utf8');
const padraoBTokens = extractTokens(padraoBHtml);
const padraoBNames = new Set(padraoBTokens.map((t) => t.token));
const padraoBValues = new Map(padraoBTokens.map((t) => [t.token, t.oklch]));

// Coleta tokens de cada mockup do cockpit.
const allCockpitTokens = new Map();
for (const [label, path] of Object.entries(COCKPIT_MOCKUPS)) {
  const html = await readFile(path, 'utf8');
  const tokens = extractTokens(html);
  for (const t of tokens) {
    if (!allCockpitTokens.has(t.token)) {
      allCockpitTokens.set(t.token, { ...t, mockups: [] });
    }
    const entry = allCockpitTokens.get(t.token);
    if (!entry.mockups.includes(label)) entry.mockups.push(label);
  }
}

// Categoriza
const novos = [];        // não existem no Padrão B
const redefinidos = [];  // mesmo nome, valor diferente
const iguais = [];       // mesmo nome e valor

for (const [name, entry] of allCockpitTokens) {
  if (!padraoBNames.has(name)) {
    novos.push(entry);
  } else if (padraoBValues.get(name) !== entry.oklch) {
    redefinidos.push({ ...entry, padraoB: padraoBValues.get(name) });
  } else {
    iguais.push(entry);
  }
}

// Output
let out = '# THEME TOKENS — Cockpit ao vivo (Sprint 1B)\n\n';
out += 'Pré-extração para o **Sprint 1B** (cockpit ao vivo).\n\n';
out += `Os 3 mockups do cockpit usam paleta INTENCIONALMENTE diferente do hub (Padrão B). Cockpit é instrumento operacional pra leitura periférica em luz solar — \`--bg=oklch(0%)\` preto puro pra contraste máximo, vs hub \`oklch(20%)\` cinza escuro pra UI normal. Theme.swift do app deve expor 2 tracks de tokens com namespace separado (\`Color.cockpit.bg\` vs \`Color.hub.bg\`) ou contexto via Environment.\n\n`;
out += `Conversão OKLCH→sRGB via \`tools/oklch-to-srgb.mjs\` (mesmo conversor do hub).\n\n`;
out += `## Resumo\n\n`;
out += `| Categoria | Qtd |\n|---|---|\n`;
out += `| REDEFINIDOS (mesmo nome, OKLCH diferente do hub) | ${redefinidos.length} |\n`;
out += `| NOVOS (só cockpit) | ${novos.length} |\n`;
out += `| IGUAIS ao Padrão B | ${iguais.length} |\n\n`;

if (redefinidos.length) {
  out += `## ⚠ Tokens redefinidos vs hub\n\n`;
  out += `**Decisão crítica**: Theme.swift precisa de namespace separado pra evitar choque (mesmo \`--bg\` significa coisa diferente). Sugestão: \`Color.Cockpit\` enum vs \`Color.Hub\` enum.\n\n`;
  out += `| Token | Hub (Padrão B) | Cockpit | Hex cockpit | Mockups |\n|---|---|---|---|---|\n`;
  for (const t of redefinidos) {
    out += `| \`${t.token}\` | \`${t.padraoB}\` | \`${t.oklch}\` | \`${t.hex}\` | ${t.mockups.length} |\n`;
  }
  out += `\n`;
}

if (novos.length) {
  out += `## Tokens novos (só cockpit)\n\n`;
  out += `Adicionar ao namespace \`Color.Cockpit\` em Theme.swift.\n\n`;
  out += `| Token | OKLCH | Hex | RGB(A) | Categoria |\n|---|---|---|---|---|\n`;
  for (const t of novos) {
    let cat = '';
    if (t.token.startsWith('--halo')) cat = 'halo';
    else if (t.token.startsWith('--warmup') || t.token.startsWith('--cooldown')) cat = 'fase térmica';
    else if (t.token.startsWith('--rain')) cat = 'chuva térmica';
    else if (t.token.startsWith('--ghost')) cat = 'ghost overlay';
    else cat = 'core';
    out += `| \`${t.token}\` | \`${t.oklch}\` | \`${t.hex}\` | \`${t.rgba}\` | ${cat} |\n`;
  }
  out += `\n`;
}

if (iguais.length) {
  out += `## Tokens iguais ao Padrão B\n\n`;
  out += `Reutilizam o que já está em Theme.swift do hub.\n\n`;
  out += `| Token | OKLCH | Hex |\n|---|---|---|\n`;
  for (const t of iguais) {
    out += `| \`${t.token}\` | \`${t.oklch}\` | \`${t.hex}\` |\n`;
  }
  out += `\n`;
}

out += `## Por mockup (auditoria)\n\n`;
for (const [label, path] of Object.entries(COCKPIT_MOCKUPS)) {
  const html = await readFile(path, 'utf8');
  const tokens = extractTokens(html);
  out += `### ${label} — \`${path}\`\n\n`;
  out += `${tokens.length} tokens.\n\n`;
  out += `| Token | OKLCH | Hex |\n|---|---|---|\n`;
  for (const t of tokens) {
    out += `| \`${t.token}\` | \`${t.oklch}\` | \`${t.hex}\` |\n`;
  }
  out += `\n`;
}

console.log(out);
