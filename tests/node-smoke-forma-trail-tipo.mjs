// node-smoke-forma-trail-tipo.mjs — prova que forma-trail-tipo.js devolve a FORMA-IDEAL
// (trail clássico PRESCRITO) de cada tipo na grade FRX, em % de freio: porrada+escadinha
// p/ os clássicos (T0/T1/T5), pancada parcial + residual p/ T2/T4, toque curto p/ T3, e
// null honesto p/ SF (pé embaixo) e ND (indeterminado). É a régua teórica — NÃO é medição.
// Roda: node tests/node-smoke-forma-trail-tipo.mjs

import { formaTrailTipo, formaDoTipo } from '../web/command-box/forma-trail-tipo.js';
import { FRX_XS_PADRAO } from '../web/command-box/frenagem-real.js';

let ok = 0, fail = 0;
function t(nome, cond, extra) {
  if (cond) { ok++; console.log('✓ ' + nome); }
  else { fail++; console.log('✗ ' + nome + (extra ? ' — ' + extra : '')); }
}
const max = (a) => Math.max(...a);
const platos = (a) => { // tamanho do maior patamar (sequência de valores iguais)
  let melhor = 1, atual = 1;
  for (let i = 1; i < a.length; i++) { if (a[i] === a[i - 1] && a[i] > 0) { atual++; melhor = Math.max(melhor, atual); } else atual = 1; }
  return melhor;
};

// ── mapa tipo→forma vem de perfilDeTrail (fonte única) ──
t('FT-01 T0/T1/T5 usam a forma clássica', ['T0', 'T1', 'T5'].every(x => formaDoTipo(x) === 'classico'));
t('FT-02 T2/T4 usam a forma residual', ['T2', 'T4'].every(x => formaDoTipo(x) === 'residual'));
t('FT-03 T3 usa o toque', formaDoTipo('T3') === 'toque');
t('FT-04 SF e ND não têm forma de freio', formaDoTipo('SF') === null && formaDoTipo('ND') === null);

// ── clássico: porrada (~100%) + escadinha que DESCE até o ápice, começando do chão ──
for (const tipo of ['T0', 'T1', 'T5']) {
  const f = formaTrailTipo(tipo);
  t(`FT-05 ${tipo} tem 18 pontos em 0..100`, f.length === 18 && f.every(v => v >= 0 && v <= 100), JSON.stringify(f));
  t(`FT-06 ${tipo} começa no chão (antes do ponto de freada = 0)`, f[0] === 0 && f[4] === 0);
  t(`FT-07 ${tipo} dá a porrada (pico >= 95)`, max(f) >= 95, 'max=' + max(f));
  t(`FT-08 ${tipo} desce em escadinha (fim < pico e fim > 0 = trail até o ápice)`, f[17] < max(f) && f[17] > 0, 'fim=' + f[17]);
}

// ── residual: pancada parcial (pico ~65) + patamar constante (~45) + soltura no fim ──
for (const tipo of ['T2', 'T4']) {
  const f = formaTrailTipo(tipo);
  t(`FT-09 ${tipo} tem 18 pontos em 0..100`, f.length === 18 && f.every(v => v >= 0 && v <= 100), JSON.stringify(f));
  t(`FT-10 ${tipo} é pancada PARCIAL (pico 60–70, não 100)`, max(f) >= 60 && max(f) <= 70, 'max=' + max(f));
  t(`FT-11 ${tipo} mantém um patamar (>= 3 pontos iguais)`, platos(f) >= 3, 'maior patamar=' + platos(f));
  t(`FT-12 ${tipo} solta no fim (fim < pico)`, f[17] < max(f), 'fim=' + f[17]);
}

// ── toque (T3): bump curto e baixo, NÃO chega perto de freada plena ──
const ft3 = formaTrailTipo('T3');
t('FT-13 T3 é toque curto (pico <= 40, > 0)', max(ft3) > 0 && max(ft3) <= 40, 'max=' + max(ft3));

// ── SF / ND: sem prescrição de freio → null (honesto, não inventa curva) ──
t('FT-14 SF devolve null (pé embaixo, sem trail)', formaTrailTipo('SF') === null);
t('FT-15 ND devolve null (indeterminado)', formaTrailTipo('ND') === null);
t('FT-16 tipo desconhecido devolve null (não estoura)', formaTrailTipo('ZZZ') === null);

// ── grade: respeita o tamanho de xs (default = FRX_XS_PADRAO) ──
t('FT-17 default usa a grade FRX padrão (18 pontos)', formaTrailTipo('T0').length === FRX_XS_PADRAO.length);
const xs9 = [0, 8, 16, 24, 32, 40, 48, 56, 60];
t('FT-18 aceita grade custom (devolve no tamanho pedido)', formaTrailTipo('T0', xs9).length === 9);

console.log(`\nforma-trail-tipo: ${ok} ok / ${fail} fail`);
process.exit(fail ? 1 : 0);
