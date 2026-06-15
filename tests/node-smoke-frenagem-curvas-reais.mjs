// node-smoke-frenagem-curvas-reais.mjs — prova que o Command Box produz a
// frenagem REAL por curva a partir das voltas reais do Bubi (fixture local),
// pelo motor de produção. Roda: node tests/node-smoke-frenagem-curvas-reais.mjs

import fs from 'node:fs';
import { construirFrenagemRealPorCurva } from '../web/command-box/frenagem-curvas-reais.js';
import { TIPO_POR_CURVA } from '../web/command-box/tipos-curva-brasilia.js';

const fixture = JSON.parse(
  fs.readFileSync(new URL('../web/command-box/fixtures/passagens-bubi-brasilia.v1.json', import.meta.url), 'utf8')
);

let ok = 0, fail = 0;
function check(name, cond) {
  if (cond) { ok++; console.log('✓ ' + name); }
  else { fail++; console.log('✗ ' + name); }
}

const curvas = construirFrenagemRealPorCurva(fixture);

check('CR-01 devolve 8 curvas (ordem da pista)', curvas.length === 8);
check('CR-02 toda curva tem índice + nome', curvas.every(c => Number.isInteger(c.curveIdx) && typeof c.curva === 'string'));

const comFreada = curvas.filter(c => Array.isArray(c.live));
check('CR-03 a maioria das curvas tem freada real medida (>=4 de 8)', comFreada.length >= 4);
console.log(`   (curvas com freada real: ${comFreada.length}/8 — ${comFreada.map(c => 'C' + (c.curveIdx + 1)).join(' ')})`);

check('CR-04 toda curva com freada tem live de 18 pontos, 0..100',
  comFreada.every(c => c.live.length === 18 && c.live.every(v => v >= 0 && v <= 100)));
check('CR-05 toda curva com freada tem pico de freio (>=30%)',
  comFreada.every(c => Math.max(...c.live) >= 30));
check('CR-06 soltou e freioMin válidos',
  comFreada.every(c => (c.soltou === 'progressivo' || c.soltou === 'de uma vez') && /^\d+%$/.test(c.freioMin)));
check('CR-07 fonte = física do GPS (sem sensor ainda)',
  comFreada.every(c => c.fonteFreio === 'simulado-fisica'));
check('CR-08 mostra a melhor volta por padrão (deltaM = 0 vs a própria referência)',
  comFreada.every(c => c.deltaM === 0));

// CR-09: pedir uma volta específica troca a passagem mostrada (e pode dar delta ≠ 0)
const curvasV1 = construirFrenagemRealPorCurva(fixture, { volta: 1 });
const algumaComV1 = curvasV1.find(c => Array.isArray(c.live) && c.voltasDisponiveis.includes(1));
check('CR-09 pedir uma volta específica mostra aquela volta', !!algumaComV1 && algumaComV1.voltaMostrada === 1);

// CR-10: curva sem freada medível é declarada honestamente (não inventa)
const semDado = curvas.filter(c => c.semDado);
check('CR-10 curva sem freada é declarada (semDado + motivo), nunca inventada',
  semDado.every(c => c.semDado === true && typeof c.motivo === 'string'));
if (semDado.length) console.log(`   (sem freada medível: ${semDado.map(c => 'C' + (c.curveIdx + 1) + ' ' + c.curva).join(' · ')})`);

// CR-11: toda curva carrega o TIPO definitivo + o trail próprio do tipo
check('CR-11 toda curva tem tipo + rótulo + formato + texto fácil do tipo',
  curvas.every(c => c.tipo && c.rotuloTipo && c.formatoTipo && c.textoFacilTipo));

// CR-12: os tipos batem com a decisão definitiva do Flávio (cada curva, seu tipo)
check('CR-12 tipo de cada curva = padrão definitivo (decisão Flávio 13/06)',
  curvas.every(c => c.tipo === TIPO_POR_CURVA[c.curva]));
console.log(`   (${curvas.map(c => 'C' + (c.curveIdx + 1) + '=' + c.tipo).join(' ')})`);

// CR-13: SF (Vitória) = sem freada POR TIPO (pé embaixo), não por falta de dado
const vit = curvas.find(c => c.curva === 'CURVA DA VITÓRIA');
check('CR-13 curva SF é "sem freada por tipo" (não confunde com dado ralo)',
  vit && vit.tipo === 'SF' && vit.semFreadaPorTipo === true && !vit.semDado && !vit.live);

// CR-14: curva com freada traz a referência (melhor) e a curva SOBE e DESCE (zona real)
check('CR-14 curva com freada tem ref[18] e a curva desce após o pico (zona real, não cortada)',
  comFreada.every(c => Array.isArray(c.ref) && c.ref.length === 18
    && c.live.indexOf(Math.max(...c.live)) < 16 && c.live[17] < Math.max(...c.live) * 0.85));

console.log(`\nfrenagem-curvas-reais: ${ok} ok / ${fail} fail`);
process.exit(fail ? 1 : 0);
