import { BoxDetector } from '../web/cockpit/box-detector.js';

let ok = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log(`✓ ${name}`); ok++; }
  catch (e) { console.log(`✗ ${name} — ${e.message}`); fail++; }
}

// pit-in à esquerda do trajeto, pit-out à direita (linhas horizontais simples)
const pitIn  = { a_gps: { lat: -15.7750, lng: -47.9025 }, b_gps: { lat: -15.7750, lng: -47.9020 } };
const pitOut = { a_gps: { lat: -15.7722, lng: -47.8983 }, b_gps: { lat: -15.7722, lng: -47.8985 } };

t('BX-01 cruza pit-in NA PISTA → entra no box', () => {
  let entrou = 0;
  const det = new BoxDetector({ pitIn, pitOut, onEntradaBox: () => entrou++ });
  det.ingestGps({ lat: -15.7755, lng: -47.9022, t: 1000 }); // antes
  det.ingestGps({ lat: -15.7745, lng: -47.9022, t: 2000 }); // depois (cruzou)
  if (entrou !== 1) throw new Error(`entrou=${entrou}`);
  if (!det.isNoBox()) throw new Error('estado não atualizou');
});

t('BX-02 cruza pit-out NO BOX → sai do box', () => {
  let saiu = 0;
  const det = new BoxDetector({ pitIn, pitOut, onSaidaBox: () => saiu++ });
  det.setNoBox(true);
  det.ingestGps({ lat: -15.7725, lng: -47.8984, t: 1000 });
  det.ingestGps({ lat: -15.7720, lng: -47.8984, t: 2000 });
  if (saiu !== 1) throw new Error(`saiu=${saiu}`);
  if (det.isNoBox()) throw new Error('estado não atualizou');
});

t('BX-03 cruzar pit-out NA PISTA não dispara', () => {
  let saiu = 0;
  const det = new BoxDetector({ pitIn, pitOut, onSaidaBox: () => saiu++ });
  // já NA PISTA, cruzar pit-out não deve disparar
  det.ingestGps({ lat: -15.7725, lng: -47.8984, t: 1000 });
  det.ingestGps({ lat: -15.7720, lng: -47.8984, t: 2000 });
  if (saiu !== 0) throw new Error(`falso positivo: ${saiu}`);
});

t('BX-04 construtor sem pit-in ou pit-out lança erro', () => {
  let n = 0;
  try { new BoxDetector({}); } catch { n++; }
  try { new BoxDetector({ pitIn }); } catch { n++; }
  if (n !== 2) throw new Error(`esperava 2 erros, recebi ${n}`);
});

console.log(`\nBox Detector: ${ok} ok / ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
