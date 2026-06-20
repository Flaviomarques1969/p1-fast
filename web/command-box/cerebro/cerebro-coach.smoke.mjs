// Teste FORA DO AR do Coach (Onda 3). Alimenta com as passagens REAIS do Bubi
// (23-24/05) e confere que o comando/análise saem do motor real, não de texto fixo.
// Rodar: node web/command-box/cerebro/cerebro-coach.smoke.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { avaliarCoach, execucoesPorCurva } from './cerebro-coach.js';

const here = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(here, '../../..');
const fx = JSON.parse(readFileSync(resolve(raiz, 'web/command-box/fixtures/passagens-bubi-brasilia.v1.json'), 'utf8'));
const ordem = fx._meta?.ordemCurvas || [];

const exs = execucoesPorCurva(fx.passagens);
const c = avaliarCoach(fx.passagens, ordem);

console.log('\n=== COACH (conteúdo pronto pro bloco P1 COACH) ===');
console.log(JSON.stringify(c, null, 2));

const checks = [
  ['extraiu execuções de 8 curvas', Object.keys(exs).length === 8],
  ['cada curva com várias voltas', Object.values(exs).every(a => a.length >= 2)],
  ['gerou um comando', typeof c.frase === 'string' && c.frase.length > 3],
  ['apontou uma curva real', c.curva != null && c.curvaNome],
  ['análise veio do motor real (cita a curva)', typeof c.analise === 'string' && c.analise.includes(c.curvaNome)],
  ['tem tema de lição', !!c.licaoTitulo],
  ['perda em km/h calculada (>0)', c.perdaKmh > 0],
  ['NOTA e %LIÇÃO honestamente pendentes', c.pontuacao === null && c.progressoPct === null],
];

let ok = true;
console.log('\n=== CONFERÊNCIAS ===');
for (const [nome, passou] of checks) { console.log(`${passou ? 'OK  ' : 'FALHOU'}  ${nome}`); if (!passou) ok = false; }
console.log(`\ncomando="${c.frase}"  |  análise="${c.analise}"`);
console.log(ok ? '\nTUDO VERDE\n' : '\nFALHOU\n');
process.exit(ok ? 0 : 1);
