// gerar-trechos-brasilia.mjs — copia os TRECHOS aprovados de Brasília (o MESMO arquivo que o cockpit do carro lê:
// _design-reference/BARRAS-BRASILIA-FLAVIO-APROVADO-2026-05-27.json, chave "trechos") para um módulo JS que a TV,
// a página da volta e a nuvem importam sem ler arquivo. Fonte única = o JSON aprovado; este módulo é cópia gerada,
// conferida pela catraca tests/node-smoke-trechos-volta.mjs (cópia diferente da fonte = reprova).
// Uso: node tools/gerar-trechos-brasilia.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const FONTE = '_design-reference/BARRAS-BRASILIA-FLAVIO-APROVADO-2026-05-27.json';
const SAIDA = 'web/command-box/trechos-brasilia.js';

const j = JSON.parse(readFileSync(FONTE, 'utf8'));
if (!Array.isArray(j.trechos) || !j.trechos.length) { console.error('NAO achei a chave "trechos" em ' + FONTE); process.exit(1); }
const trechos = j.trechos.map(t => ({ id: t.id, ordem: t.ordem, nome: t.nome,
  entrada_line_gps: t.entrada_line_gps, saida_line_gps: t.saida_line_gps, apice_gps: t.apice_gps }));

const js = `// trechos-brasilia.js — GERADO por tools/gerar-trechos-brasilia.mjs. NÃO editar à mão.
// Fonte: ${FONTE} (o mesmo arquivo que o cockpit do carro lê). Catraca: tests/node-smoke-trechos-volta.mjs.
// "ordem" é a do cadastro, NÃO a da volta: a ordem da volta sai da posição no traçado (trechos-volta.js).
export const FONTE_TRECHOS_BRASILIA = ${JSON.stringify(FONTE)};
export const TRECHOS_BRASILIA = ${JSON.stringify(trechos, null, 1)};
`;
writeFileSync(SAIDA, js);
console.log(`${SAIDA}: ${trechos.length} trechos de ${FONTE}`);
