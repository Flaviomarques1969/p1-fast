// node-smoke-vmin-curvas-reais.mjs — prova o construtor do GRÁFICO do bloco VMIN
// (web/command-box/vmin-curvas-reais.js): série velocidade × distância-ao-Vmin por
// curva, SEPARADA por configuração de pneu; número da mínima só confiável quando é
// vale; e CONSISTENTE com o módulo da Passagem (mesma regra de confiabilidade).
// Roda: node tests/node-smoke-vmin-curvas-reais.mjs

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { construirVminRealPorCurva } from '../web/command-box/vmin-curvas-reais.js';
import { construirPassagemRealPorCurva } from '../web/command-box/passagem-curvas-reais.js';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dir, '..', 'web', 'command-box', 'fixtures', 'passagens-bubi-brasilia.v1.json');

let ok = 0, fail = 0;
function check(nome, cond) {
  if (cond) { ok++; console.log('  ok  ' + nome); }
  else { fail++; console.log('  XX  ' + nome); }
}

const fix = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
const V = construirVminRealPorCurva(fix, {});
const P = construirPassagemRealPorCurva(fix, {});

check('8 curvas (ordem canônica)', V.length === 8);
check('config default = radial-185-14', V.every((c) => c.tipoPneu === 'radial-185-14'));

const c1 = V[0]; // CURVA 01
check('curva tem série live e ghost (arrays de [x,kmh])', Array.isArray(c1.live) && Array.isArray(c1.ghost) && c1.live.length >= 2);
check('série tem o Vmin em x≈0 (ponto mais lento)', (() => {
  const min = c1.live.reduce((m, p) => (p[1] < m[1] ? p : m), c1.live[0]);
  return Math.abs(min[0]) < 1e-6; // x do ponto mais lento = 0 por construção
})());
check('vminKmh é número', typeof c1.vminKmh === 'number');

// reliability data-driven + CONSISTENTE com o módulo da Passagem
let consistente = true, conf = 0;
V.forEach((v, i) => {
  if (!!v.vminConfiavel !== !!P[i].vminConfiavel) consistente = false;
  if (v.vminConfiavel) conf++;
});
check('confiabilidade do Vmin é CONSISTENTE com o módulo da Passagem', consistente);
check('hoje (radial, 1 Hz) só 2 curvas confiáveis', conf === 2);
check('as 2 confiáveis são CURVA 01 e CURVA 2', V[0].vminConfiavel && V[2].vminConfiavel && !V[1].vminConfiavel);

// separação por configuração — semi-slick ainda sem dado
const SS = construirVminRealPorCurva(fix, { tipoPneu: 'semi-slick' });
check('semi-slick: todas as curvas semDadoReal (sem dado ainda)', SS.every((c) => c.semDadoReal === true));

console.log('\n' + (fail === 0 ? 'OK' : 'FALHOU') + ' — ' + ok + ' passaram, ' + fail + ' falharam');
process.exit(fail === 0 ? 0 : 1);
