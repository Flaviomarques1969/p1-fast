// Smoke do conserto 11/06: Vmin calculada + re-etiquetagem dos sub-trechos
// pelos marcos REAIS da passagem (o sub 'saida' passa a existir de verdade).
import { acharVminBuffer, retagSubsPorEventos } from '../web/cockpit/live-data-bridge.js';

let ok = 0, fail = 0;
function t(nome, cond, extra) {
  if (cond) { ok++; console.log('✓ ' + nome); }
  else { fail++; console.log('✗ ' + nome + (extra ? ' — ' + extra : '')); }
}

// passagem sintética: 11 amostras, t = 0..1000, velocidade caindo até a 6ª e subindo
function buffer() {
  const kmhs = [120, 118, 110, 95, 85, 78, 74, 80, 92, 105, 118]; // Vmin = 74 no idx 6
  return kmhs.map((kmh, i) => ({ lat: 0, lng: i * 0.0001, kmh, t: i * 100, sub: 'entrada' }));
}

// VB: acharVminBuffer
{
  const v = acharVminBuffer(buffer());
  t('VB-01 acha a menor velocidade', v && v.kmh === 74 && v.idx === 6, JSON.stringify(v));
  t('VB-02 buffer vazio → null', acharVminBuffer([]) === null);
  t('VB-03 sem velocidade finita → null', acharVminBuffer([{ kmh: null }, { kmh: NaN }]) === null);
}

// RT-01: caso completo — freada t=300, ápice t=600, Vmin idx 6 (t=600→ logo após)
{
  const b = retagSubsPorEventos(buffer(), { freadaT: 300, apiceT: 550, vminIdx: 6 });
  const subs = b.map(p => p.sub);
  t('RT-01 entrada até a freada', subs[0] === 'entrada' && subs[3] === 'entrada', subs.join(','));
  t('RT-02 freio da freada ao ápice', subs[4] === 'freio' && subs[5] === 'freio', subs.join(','));
  t('RT-03 apice do ápice à Vmin', subs[6] === 'apice', subs[6]);
  t('RT-04 saida existe de verdade (era o defeito)', subs[7] === 'saida' && subs[10] === 'saida', subs.join(','));
  t('RT-05 não muta o original', buffer()[7].sub === 'entrada');
}

// RT-06: sem freada detectada → entrada vai até o ápice (nunca inventa marco)
{
  const b = retagSubsPorEventos(buffer(), { freadaT: null, apiceT: 550, vminIdx: 6 });
  const subs = b.map(p => p.sub);
  t('RT-06 sem freada: entrada até o ápice', subs[4] === 'entrada' && subs[5] === 'entrada', subs.join(','));
  t('RT-07 sem freada: depois do ápice segue normal', subs[6] === 'apice' && subs[8] === 'saida');
}

// RT-08: Vmin ANTES do ápice → pedaço 'apice' vazio, saída começa no ápice
{
  const kmhs = [120, 110, 90, 74, 80, 90, 100, 108, 112, 116, 120]; // Vmin idx 3
  const b0 = kmhs.map((kmh, i) => ({ lat: 0, lng: i * 0.0001, kmh, t: i * 100, sub: 'entrada' }));
  const b = retagSubsPorEventos(b0, { freadaT: 150, apiceT: 500, vminIdx: 3 });
  const subs = b.map(p => p.sub);
  t('RT-08 Vmin antes do ápice → sem pedaço apice falso',
    !subs.includes('apice') && subs[6] === 'saida', subs.join(','));
}

// RT-09: sem ápice → a Vmin divide freio de saída; nada de apice inventado
{
  const b = retagSubsPorEventos(buffer(), { freadaT: 300, apiceT: null, vminIdx: 6 });
  const subs = b.map(p => p.sub);
  t('RT-09 sem ápice: freio até a Vmin, saida depois, sem apice inventado',
    !subs.includes('apice') && subs[5] === 'freio' && subs[7] === 'saida', subs.join(','));
}

// RT-10: sem marco nenhum → tudo entrada/freio honesto (nada de saida falsa)
{
  const b = retagSubsPorEventos(buffer().map(p => ({ ...p, kmh: null })), { freadaT: null, apiceT: null, vminIdx: null });
  t('RT-10 sem marcos: tudo entrada (nunca inventa)', b.every(p => p.sub === 'entrada'));
}

console.log(`\nretag-vmin: ${ok} ok / ${fail} fail`);
process.exit(fail ? 1 : 0);
