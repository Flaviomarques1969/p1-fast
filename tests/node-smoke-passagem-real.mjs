// node-smoke-passagem-real.mjs — prova que o adaptador da PASSAGEM do Command Box
// (web/command-box/passagem-real.js) e o montador por curva
// (web/command-box/passagem-curvas-reais.js) entregam os campos do bloco no formato
// do desenho aprovado, a partir das passagens reais de GPS do Bubi em Brasília.
// Roda: node tests/node-smoke-passagem-real.mjs

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { passagemRealParaCorner } from '../web/command-box/passagem-real.js';
import { construirPassagemRealPorCurva } from '../web/command-box/passagem-curvas-reais.js';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dir, '..', 'web', 'command-box', 'fixtures', 'passagens-bubi-brasilia.v1.json');

let ok = 0, fail = 0;
function check(nome, cond) {
  if (cond) { ok++; console.log('  ok  ' + nome); }
  else { fail++; console.log('  XX  ' + nome); }
}

const M2DEG = 1 / 111320; // metros → graus de latitude
// passagem sintética: pontos numa reta, com kmh(d). Vmin é o ponto mais lento.
function passagem(kmhDe, tempo, totalM = 120, passoM = 15, t0 = 1_000_000) {
  const pts = [];
  let t = t0;
  for (let d = 0; d <= totalM; d += passoM) {
    const kmh = kmhDe(d);
    t += (passoM / Math.max(1, kmh / 3.6)) * 1000;
    pts.push({ lat: d * M2DEG, lng: 0, kmh, t: Math.round(t) });
  }
  return { pontos: pts, tempo_trecho_s: tempo };
}
// V de velocidade: cai até o meio (ápice), sobe depois.
const vCorner = (entrada, vmin, saida) => (d) => {
  const meio = 60;
  return d <= meio ? entrada + (vmin - entrada) * (d / meio)
                   : vmin + (saida - vmin) * ((d - meio) / meio);
};

console.log('[1] adaptador: volta mais lenta vs melhor (referência)');
{
  const melhor   = passagem(vCorner(180, 90, 160), 8.00);
  const mostrada = passagem(vCorner(174, 84, 152), 8.30); // mais devagar e mais lenta no relógio
  const c = passagemRealParaCorner(mostrada, melhor);

  check('devolve objeto', c && typeof c === 'object');
  check('entradaKmh real (~174)', Math.abs(c.entradaKmh - 174) <= 1);
  check('apexKmh = Vmin real (~84)', Math.abs(c.apexKmh - 84) <= 1);
  check('saidaKmh real (~152)', Math.abs(c.saidaKmh - 152) <= 1);
  check('entradaDelta negativo (entrou mais devagar que a melhor)', c.entradaDelta.startsWith('−'));
  check('apexDelta negativo', c.apexDelta.startsWith('−'));
  check('apexOffsetM PENDENTE (null) — 1 Hz não resolve ±1 m', c.apexOffsetM === null && c.apexDistConfiavel === false);
  check('passagemDelta em segundos com s', /^[+−]\d+\.\d{2}s$/.test(c.passagemDelta));
  check('passagemDelta positivo (+0.30s, perdeu pra melhor)', c.passagemDelta.startsWith('+'));
  check('veredito "perdeu ..." quando perdeu tempo', /^perdeu /.test(c.passagemVerdict));
  check('passagemTone ruim/atencao quando perdeu >0,05s', c.passagemTone === 'warn' || c.passagemTone === 'bad');
  check('fonte = real', c.fonte === 'real');
}

console.log('[2] adaptador: a própria melhor volta vs ela mesma = no ritmo');
{
  const melhor = passagem(vCorner(180, 90, 160), 8.00);
  const c = passagemRealParaCorner(melhor, melhor);
  check('entradaDelta +0', c.entradaDelta === '+0');
  check('passagemDelta +0.00s', c.passagemDelta === '+0.00s');
  check('veredito "no ritmo"', c.passagemVerdict === 'no ritmo');
  check('tone good', c.passagemTone === 'good');
}

console.log('[3] adaptador: passagem sem pontos suficientes → null (não inventa)');
{
  check('1 ponto → null', passagemRealParaCorner({ pontos: [{ lat: 0, lng: 0, kmh: 80, t: 1 }] }, null) === null);
  check('sem pontos → null', passagemRealParaCorner({}, null) === null);
}

console.log('[4] por curva: massa REAL do Bubi (Brasília)');
{
  const fixture = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  const curvas = construirPassagemRealPorCurva(fixture, {});
  const ordem = fixture._meta.ordemCurvas;

  check('uma entrada por curva da pista', curvas.length === ordem.length && ordem.length === 8);
  check('todas com curveIdx em ordem', curvas.every((c, i) => c.curveIdx === i));

  const comDado = curvas.filter((c) => !c.semDadoReal);
  check('há curvas com dado real', comDado.length >= 1);
  check('velocidades reais plausíveis (10..220 km/h)', comDado.every((c) =>
    c.entradaKmh > 10 && c.entradaKmh < 220 &&
    c.apexKmh   > 10 && c.apexKmh   < 220 &&
    c.saidaKmh  > 10 && c.saidaKmh  < 220));
  check('ápice (Vmin) ≤ entrada e ≤ saída em toda curva', comDado.every((c) =>
    c.apexKmh <= c.entradaKmh + 1 && c.apexKmh <= c.saidaKmh + 1));
  check('apexOffsetM pendente (null) em toda curva real', comDado.every((c) => c.apexOffsetM === null));
  check('passagemDelta sempre formato segundos', comDado.every((c) => /^[+−]\d+\.\d{2}s$/.test(c.passagemDelta)));
  check('voltaMostrada e voltaRef presentes', comDado.every((c) => c.voltaMostrada != null && c.voltaRef != null));
  check('voltasDisponiveis é lista', comDado.every((c) => Array.isArray(c.voltasDisponiveis)));

  // amostra legível no log (prova visual no terminal)
  console.log('   amostra real por curva:');
  curvas.forEach((c) => {
    if (c.semDadoReal) { console.log('   - ' + c.curva + ': (sem dado real) ' + c.motivo); return; }
    console.log('   - ' + c.curva + ': entrada ' + c.entradaKmh + ' / ápice ' + c.apexKmh +
      ' / saída ' + c.saidaKmh + ' km/h · ' + c.passagemVerdict + ' ' + c.passagemDelta +
      ' (mostrada v' + c.voltaMostrada + ' vs melhor v' + c.voltaRef + ')');
  });
}

console.log('\n' + ok + ' ok / ' + fail + ' fail');
process.exit(fail ? 1 : 0);
