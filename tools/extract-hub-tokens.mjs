// ═══════════════════════════════════════════════════════════
// Extrai tokens OKLCH dos mockups do hub (Sprint 1A.2 — #8/#9/#10)
// ═══════════════════════════════════════════════════════════
// Usa o conversor de tools/oklch-to-srgb.mjs (mesma fórmula, mesmo smoke).
// Output: docs/THEME_TOKENS_HUB.md (markdown).
//
// Mockups varridos:
//   • mockup-home-cheio.html, mockup-home-vazio.html (Prompt #8)
//   • mockup-garagem.html, mockup-carro.html, mockup-carro-novo.html (#9)
//   • mockup-eventos-lista.html, mockup-evento-detalhe.html (#10)
//
// Saída agrega: tokens nomeados de cada mockup + comparação com Padrão B.

import { readFile } from 'node:fs/promises';
import { extractTokens, parseOklch, oklchToHex } from './oklch-to-srgb.mjs';

const PADRAO_B_PATH = '_design-reference/historico-evento/mockup-evento-B.html';

const HUB_MOCKUPS = {
  '#8 Home (cheio)':         '_design-reference/mockup-home-cheio.html',
  '#8 Home (vazio)':         '_design-reference/mockup-home-vazio.html',
  '#9 Garagem':              '_design-reference/mockup-garagem.html',
  '#9 Carro modal':          '_design-reference/mockup-carro.html',
  '#9 Carro novo (form)':    '_design-reference/mockup-carro-novo.html',
  '#10 Eventos lista':       '_design-reference/mockup-eventos-lista.html',
  '#10 Evento detalhe':      '_design-reference/mockup-evento-detalhe.html',
};

// ─── Coleta ──────────────────────────────────────────────
const padraoBHtml = await readFile(PADRAO_B_PATH, 'utf8');
const padraoBTokens = extractTokens(padraoBHtml);
const padraoBNames = new Set(padraoBTokens.map((t) => t.token));
const padraoBValues = new Map(padraoBTokens.map((t) => [t.token, t.oklch]));

const allHubTokens = new Map(); // token → { mockups: [...], oklch, hex, ... }
for (const [label, path] of Object.entries(HUB_MOCKUPS)) {
  const html = await readFile(path, 'utf8');
  const tokens = extractTokens(html);
  for (const t of tokens) {
    if (!allHubTokens.has(t.token)) {
      allHubTokens.set(t.token, { ...t, mockups: [] });
    }
    const entry = allHubTokens.get(t.token);
    if (!entry.mockups.includes(label)) entry.mockups.push(label);
  }
}

// ─── Análise: novos / redefinidos / mesmos ──────────────
const novos = [];          // não existem em Padrão B
const redefinidos = [];    // mesmo nome, OKLCH diferente
const iguais = [];         // mesmo nome e mesmo OKLCH
for (const [name, entry] of allHubTokens) {
  if (!padraoBNames.has(name)) {
    novos.push(entry);
  } else if (padraoBValues.get(name) !== entry.oklch) {
    redefinidos.push({ ...entry, padraoB: padraoBValues.get(name) });
  } else {
    iguais.push(entry);
  }
}

// ─── Output ──────────────────────────────────────────────
let out = '# THEME TOKENS — Hub mockups (Sprint 1A.2)\n\n';
out += 'Pré-extração para os **Prompts #8 / #9 / #10**.\n\n';
out += `Os 7 mockups do hub usam paleta com sobreposição parcial à do Padrão B (\`docs/THEME_TOKENS.md\`). Esta tabela lista o que é novo, o que foi redefinido com valor diferente, e o que se mantém igual — pra Theme.swift expor variantes corretas sem conflitar.\n\n`;
out += `Fórmula OKLCH→sRGB e smoke pin: ver \`docs/THEME_TOKENS.md\`.\n\n`;
out += `## Resumo\n\n`;
out += `| Categoria | Qtd |\n|---|---|\n`;
out += `| Tokens REDEFINIDOS (nome existe em Padrão B com OKLCH diferente) | ${redefinidos.length} |\n`;
out += `| Tokens NOVOS (não existem em Padrão B) | ${novos.length} |\n`;
out += `| Tokens IGUAIS (mesmo nome + mesmo OKLCH) | ${iguais.length} |\n\n`;

if (redefinidos.length) {
  out += `## ⚠ Tokens redefinidos pelo hub\n\n`;
  out += `**Decisão pendente**: hub mantém valor próprio ou se realinha à Padrão B? Se hub é canônico pra app, Theme.swift deve usar o valor do hub. Se Padrão B é pra TODA UI, hub mockups têm que ser corrigidos.\n\n`;
  out += `| Token | Padrão B | Hub | Hex hub | Mockups |\n|---|---|---|---|---|\n`;
  for (const t of redefinidos) {
    out += `| \`${t.token}\` | \`${t.padraoB}\` | \`${t.oklch}\` | \`${t.hex}\` | ${t.mockups.length} |\n`;
  }
  out += `\n`;
}

if (novos.length) {
  out += `## Tokens novos (só hub)\n\n`;
  out += `Adicionar ao Theme.swift como variantes do hub.\n\n`;
  out += `| Token | OKLCH | Hex | RGB(A) | Aparece em |\n|---|---|---|---|---|\n`;
  for (const t of novos) {
    out += `| \`${t.token}\` | \`${t.oklch}\` | \`${t.hex}\` | \`${t.rgba}\` | ${t.mockups.join('; ')} |\n`;
  }
  out += `\n`;
}

if (iguais.length) {
  out += `## Tokens iguais à Padrão B\n\n`;
  out += `Reutilizam o que já está em Theme.swift.\n\n`;
  out += `| Token | OKLCH | Hex |\n|---|---|---|\n`;
  for (const t of iguais) {
    out += `| \`${t.token}\` | \`${t.oklch}\` | \`${t.hex}\` |\n`;
  }
  out += `\n`;
}

out += `## Por mockup (auditoria)\n\n`;
for (const [label, path] of Object.entries(HUB_MOCKUPS)) {
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
