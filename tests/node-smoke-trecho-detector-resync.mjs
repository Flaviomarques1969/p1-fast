// Smoke dos consertos do vigia (10/06): ressincronização + saída de emergência.
// Defeito original: vigia sequencial travava a fila inteira ao perder 1 curva
// (replay de voltas reais media só 2-3 de 8).
import { TrechoDetector } from '../web/cockpit/trecho-detector.js';

let ok = 0, fail = 0;
function t(nome, cond, extra) {
  if (cond) { ok++; console.log('✓ ' + nome); }
  else { fail++; console.log('✗ ' + nome + (extra ? ' — ' + extra : '')); }
}

// 2 curvas em linha: s1 (entrada lng −0.001 → saída +0.001), s2 (entrada 0.003 → saída 0.005)
function segs() {
  const linha = lng => ({ a: { lat: 0.0005, lng }, b: { lat: -0.0005, lng } });
  return [
    { id: 's1', nome: 'S1', entradaLine: linha(-0.001), apicePoint: { lat: 0, lng: 0 }, saidaLine: linha(0.001) },
    { id: 's2', nome: 'S2', entradaLine: linha(0.003), apicePoint: { lat: 0, lng: 0.004 }, saidaLine: linha(0.005) },
  ];
}
const amostra = (lng, t, kmh = 100) => ({ lat: 0, lng, kmh, t });

// RS-01: perdeu s1 inteira (carro "aparece" depois dela) → cruza entrada de s2 → ressincroniza
{
  const evs = [];
  const det = new TrechoDetector({ segments: segs(), onEvent: e => evs.push(e) });
  det.ingestGps(amostra(0.0015, 1000)); // já DEPOIS de s1 (nunca cruzou a entrada dela)
  det.ingestGps(amostra(0.0025, 2000));
  det.ingestGps(amostra(0.0035, 3000)); // cruzou a entrada de s2
  const re = evs.find(e => e.type === 'resync');
  const en = evs.find(e => e.type === 'entrada-cruzou');
  t('RS-01 ressincroniza pra s2', re && re.paraSegmentId === 's2' && en && en.segmentId === 's2',
    JSON.stringify(evs.map(e => e.type)));
}

// RS-02: completou a passagem em s2 após a ressincronização (saída fecha)
{
  const evs = [];
  const det = new TrechoDetector({ segments: segs(), onEvent: e => evs.push(e) });
  det.ingestGps(amostra(0.0015, 1000));
  det.ingestGps(amostra(0.0035, 2000, 120)); // entrada s2 (resync)
  det.ingestGps(amostra(0.0040, 3000, 80));  // perto do ápice de s2
  det.ingestGps(amostra(0.0045, 4000, 90));  // afastou do ápice → ápice cruzado
  det.ingestGps(amostra(0.0055, 5000, 110)); // saída de s2
  const sa = evs.find(e => e.type === 'saida-cruzou');
  t('RS-02 fecha s2 depois do resync', sa && sa.segmentId === 's2' && sa.completed === true,
    JSON.stringify(evs.map(e => e.type)));
}

// RS-03: saída de EMERGÊNCIA — ápice nunca reconhecido (ponto longe), saída fecha
// com apice-cruzou(distFromIdealM=mínimo observado, fechamentoDeEmergencia=true)
{
  const evs = [];
  const ss = segs();
  ss[0].apicePoint = { lat: 0, lng: 0.02 }; // ápice ADIANTE da saída — distância só cai, nunca "vira"
  const det = new TrechoDetector({ segments: ss, onEvent: e => evs.push(e) });
  det.ingestGps(amostra(-0.0015, 1000, 120));
  det.ingestGps(amostra(-0.0005, 2000, 100)); // entrada s1
  det.ingestGps(amostra(0.0005, 3000, 80));
  det.ingestGps(amostra(0.0015, 4000, 90));   // saída s1 SEM ápice cruzado
  const ap = evs.find(e => e.type === 'apice-cruzou');
  const sa = evs.find(e => e.type === 'saida-cruzou');
  t('RS-03 saída de emergência fecha a curva', !!sa && sa.segmentId === 's1',
    JSON.stringify(evs.map(e => e.type)));
  t('RS-04 ápice de emergência marcado', ap && ap.fechamentoDeEmergencia === true, JSON.stringify(ap));
  // depois da emergência, avançou pra s2
  det.ingestGps(amostra(0.0035, 5000)); // entrada s2 normal
  const en2 = evs.filter(e => e.type === 'entrada-cruzou').map(e => e.segmentId);
  t('RS-05 fila destravada (s2 é o próximo)', en2.includes('s2'), JSON.stringify(en2));
}

// RS-06: fluxo 100% normal NÃO dispara resync nem emergência (regressão)
{
  const evs = [];
  const det = new TrechoDetector({ segments: segs(), onEvent: e => evs.push(e) });
  det.ingestGps(amostra(-0.0015, 1000, 120));
  det.ingestGps(amostra(-0.0005, 2000, 100));
  det.ingestGps(amostra(0.00005, 3000, 70));
  det.ingestGps(amostra(0.0006, 4000, 80));
  det.ingestGps(amostra(0.0015, 5000, 100));
  t('RS-06 fluxo normal sem resync/emergência',
    !evs.some(e => e.type === 'resync') && !evs.some(e => e.fechamentoDeEmergencia),
    JSON.stringify(evs.map(e => e.type)));
}

console.log(`\nTrechoDetector resync: ${ok} ok / ${fail} fail`);
process.exit(fail ? 1 : 0);
