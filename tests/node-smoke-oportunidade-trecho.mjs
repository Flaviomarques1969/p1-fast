// Smoke do motor OportunidadeTrecho — prescrição por trecho (contrato v3 de 09/06).
import { OportunidadeTrecho } from '../web/cockpit/oportunidade-trecho.js';

let ok = 0, fail = 0;
function t(nome, cond, extra) {
  if (cond) { ok++; console.log('✓ ' + nome); }
  else { fail++; console.log('✗ ' + nome + (extra ? ' — ' + extra : '')); }
}

// referência: 11 pontos em linha (~100 m), freio começa na fração 0.25
function refPontos(fracFreio = 0.25) {
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const frac = i / 10;
    pts.push({ lat: 0, lng: frac * 0.0009, fracao: frac, sub: frac < fracFreio ? 'entrada' : (frac < 0.5 ? 'freio' : (frac < 0.7 ? 'apice' : 'saida')) });
  }
  return pts;
}
function passagem(fracFreio) {
  return refPontos(fracFreio);
}
function delta(seg, piorSub, deltaS = 0.5) {
  const por = { entrada: { deltaS: 0.01 }, freio: { deltaS: 0.01 }, apice: { deltaS: 0.01 }, saida: { deltaS: 0.01 } };
  por[piorSub] = { deltaS };
  return { segmentId: seg, deltaTotalS: deltaS, porSubTrecho: por, piorSubTrecho: piorSub, piorDeltaS: deltaS };
}

// OT-01: sem dados → null (1ª volta não orienta)
{
  const m = new OportunidadeTrecho();
  t('OT-01 sem passagem → null', m.getOrientacao('s1') === null);
}

// OT-02: freio pior, ele freia ANTES da referência → FREIA DEPOIS com metros
{
  const m = new OportunidadeTrecho();
  m.setReferencia('s1', { pontos: refPontos(0.25) });
  m.registrarPassagem({ segmentId: 's1', pontos: passagem(0.10) });
  m.registrarDelta(delta('s1', 'freio'));
  const o = m.getOrientacao('s1');
  t('OT-02 FREIA DEPOIS', o && o.verbo === 'FREIA' && o.destaque === 'DEPOIS', JSON.stringify(o));
  t('OT-03 metros positivos', o && /^\+\d+$/.test(o.quanto) && o.un === 'm', o && o.quanto);
  t('OT-04 marcas: vermelho antes do verde', o && o.voceFrac < o.ouroFrac);
}

// OT-05: ele freia DEPOIS da referência → FREIA ANTES
{
  const m = new OportunidadeTrecho();
  m.setReferencia('s1', { pontos: refPontos(0.25) });
  m.registrarPassagem({ segmentId: 's1', pontos: passagem(0.40) });
  m.registrarDelta(delta('s1', 'freio'));
  const o = m.getOrientacao('s1');
  t('OT-05 FREIA ANTES', o && o.destaque === 'ANTES', JSON.stringify(o));
}

// OT-06: mesmo ponto (<5 m) → FREIA MENOS com gráfico de pedal, marcas iguais
{
  const m = new OportunidadeTrecho();
  m.setReferencia('s1', { pontos: refPontos(0.25) });
  m.registrarPassagem({ segmentId: 's1', pontos: passagem(0.27) }); // ~2 m de diferença
  m.registrarDelta(delta('s1', 'freio'));
  const o = m.getOrientacao('s1');
  t('OT-06 FREIA MENOS no mesmo ponto', o && o.destaque === 'MENOS' && o.grafico === 'freio', JSON.stringify(o));
  t('OT-07 sem deslocamento falso', o && o.voceFrac === o.ouroFrac);
}

// OT-08: ápice pior → FECHA A CURVA com a distância real do ápice
{
  const m = new OportunidadeTrecho();
  m.setReferencia('s1', { pontos: refPontos() });
  m.registrarPassagem({ segmentId: 's1', pontos: passagem(0.25) });
  m.registrarApice({ segmentId: 's1', distFromIdealM: 2.4 });
  m.registrarDelta(delta('s1', 'apice'));
  const o = m.getOrientacao('s1');
  t('OT-08 FECHA A CURVA', o && o.verbo === 'FECHA' && o.apice === true, JSON.stringify(o));
  t('OT-09 distância do ápice', o && o.quanto === '2.4');
}

// OT-10: saída pior → ACELERA ANTES, SEM marcas inventadas (regra de coerência física)
{
  const m = new OportunidadeTrecho();
  m.setReferencia('s1', { pontos: refPontos() });
  m.registrarPassagem({ segmentId: 's1', pontos: passagem(0.25) });
  m.registrarDelta(delta('s1', 'saida'));
  const o = m.getOrientacao('s1');
  t('OT-10 ACELERA ANTES', o && o.verbo === 'ACELERA' && o.destaque === 'ANTES', JSON.stringify(o));
  t('OT-11 sem marca inventada', o && o.voceFrac === null && o.ouroFrac === null);
}

// OT-12: nenhum componente perdendo → null (nada a orientar)
{
  const m = new OportunidadeTrecho();
  m.setReferencia('s1', { pontos: refPontos() });
  m.registrarPassagem({ segmentId: 's1', pontos: passagem(0.25) });
  m.registrarDelta({ segmentId: 's1', deltaTotalS: -0.2, porSubTrecho: { freio: { deltaS: -0.1 }, apice: { deltaS: -0.05 } } });
  t('OT-12 melhor que a referência → null', m.getOrientacao('s1') === null);
}

// OT-13: média de 2 passagens decide (janela)
{
  const m = new OportunidadeTrecho();
  m.setReferencia('s1', { pontos: refPontos(0.25) });
  m.registrarPassagem({ segmentId: 's1', pontos: passagem(0.10) });
  m.registrarDelta(delta('s1', 'freio', 0.8));
  m.registrarDelta(delta('s1', 'apice', 0.2)); // freio médio (0.8+0.01)/2 ainda pior
  const o = m.getOrientacao('s1');
  t('OT-13 janela de 2 passagens', o && o.disciplina === 'FREIO', o && o.disciplina);
}

console.log(`\nOportunidadeTrecho: ${ok} ok / ${fail} fail`);
process.exit(fail ? 1 : 0);
