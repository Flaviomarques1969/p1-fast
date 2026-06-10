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

// Defeito do replay 10/06: o prolongamento INFINITO da pit-in corta a pista
// inteira → carro "entrava no box" andando na pista e ficava preso (NO BOX
// atropelava a orientação). Cruzar a linha vale só DENTRO do segmento real.
t('BX-05 cruzar o PROLONGAMENTO da pit-in (longe do segmento) NÃO entra no box', () => {
  let entrou = 0;
  const det = new BoxDetector({ pitIn, pitOut, onEntradaBox: () => entrou++ });
  // mesma latitude da pit-in, mas ~750 m além da ponta do segmento (lng -47.8950)
  det.ingestGps({ lat: -15.7755, lng: -47.8950, t: 1000 }); // antes
  det.ingestGps({ lat: -15.7745, lng: -47.8950, t: 2000 }); // sinal vira, segmento longe
  if (entrou !== 0) throw new Error(`falso positivo: entrou=${entrou}`);
  if (det.isNoBox()) throw new Error('ficou preso NO BOX sem cruzar o box');
});

t('BX-06 NO BOX, cruzar o PROLONGAMENTO da pit-out NÃO sai do box', () => {
  let saiu = 0;
  const det = new BoxDetector({ pitIn, pitOut, onSaidaBox: () => saiu++ });
  det.setNoBox(true);
  det.ingestGps({ lat: -15.7725, lng: -47.9050, t: 1000 });
  det.ingestGps({ lat: -15.7720, lng: -47.9050, t: 2000 });
  if (saiu !== 0) throw new Error(`falso positivo: saiu=${saiu}`);
  if (!det.isNoBox()) throw new Error('saiu do box sem cruzar a pit-out');
});

t('BX-07 várias passagens pelo prolongamento seguem NA PISTA (cenário do replay)', () => {
  let entrou = 0;
  const det = new BoxDetector({ pitIn, pitOut, onEntradaBox: () => entrou++ });
  let t0 = 1000;
  for (let volta = 0; volta < 3; volta++) {
    det.ingestGps({ lat: -15.7760, lng: -47.8950, t: (t0 += 7000) });
    det.ingestGps({ lat: -15.7740, lng: -47.8950, t: (t0 += 7000) }); // cruza o prolongamento
    det.ingestGps({ lat: -15.7760, lng: -47.8960, t: (t0 += 7000) }); // volta
  }
  if (entrou !== 0 || det.isNoBox()) throw new Error(`entrou=${entrou} noBox=${det.isNoBox()}`);
});

console.log(`\nBox Detector: ${ok} ok / ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
