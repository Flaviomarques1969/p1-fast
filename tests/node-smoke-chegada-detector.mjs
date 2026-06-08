import { ChegadaDetector } from '../web/cockpit/chegada-detector.js';

let ok = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log(`✓ ${name}`); ok++; }
  catch (e) { console.log(`✗ ${name} — ${e.message}`); fail++; }
}

const marco = {
  a_gps: { lat: -15.7728816, lng: -47.9000707 },
  b_gps: { lat: -15.7725493, lng: -47.9001926 },
};

t('CD-01 detecta 1 cruzamento ao mudar de lado', () => {
  let voltas = 0;
  const det = new ChegadaDetector({ marco, onChegada: () => voltas++ });
  // Ponto antes da linha (lado A)
  det.ingestGps({ lat: -15.7740, lng: -47.9020, t: 1000 });
  // Ponto depois da linha (lado B)
  det.ingestGps({ lat: -15.7720, lng: -47.8980, t: 2000 });
  if (voltas !== 1) throw new Error(`esperava 1, recebi ${voltas}`);
});

t('CD-02 debounce: 2 cruzamentos em <5s = 1 volta', () => {
  let voltas = 0;
  const det = new ChegadaDetector({ marco, onChegada: () => voltas++ });
  det.ingestGps({ lat: -15.7740, lng: -47.9020, t: 1000 });
  det.ingestGps({ lat: -15.7720, lng: -47.8980, t: 2000 });
  det.ingestGps({ lat: -15.7740, lng: -47.9020, t: 4000 });
  det.ingestGps({ lat: -15.7720, lng: -47.8980, t: 5000 });
  if (voltas !== 1) throw new Error(`debounce falhou: ${voltas}`);
});

t('CD-03 2 cruzamentos em >5s = 2 voltas', () => {
  let voltas = 0;
  const det = new ChegadaDetector({ marco, onChegada: () => voltas++ });
  det.ingestGps({ lat: -15.7740, lng: -47.9020, t: 1000 });
  det.ingestGps({ lat: -15.7720, lng: -47.8980, t: 2000 });
  det.ingestGps({ lat: -15.7740, lng: -47.9020, t: 10000 });
  det.ingestGps({ lat: -15.7720, lng: -47.8980, t: 11000 });
  if (voltas !== 2) throw new Error(`esperava 2, recebi ${voltas}`);
});

t('CD-04 amostras paralelas à linha não disparam', () => {
  let voltas = 0;
  const det = new ChegadaDetector({ marco, onChegada: () => voltas++ });
  // 5 amostras todas do mesmo lado (longe da linha)
  for (let i = 0; i < 5; i++) {
    det.ingestGps({ lat: -15.7740, lng: -47.9020 + i * 0.0001, t: i * 1000 });
  }
  if (voltas !== 0) throw new Error(`falso positivo: ${voltas}`);
});

t('CD-05 construtor sem marco lança erro', () => {
  let lancou = false;
  try { new ChegadaDetector({}); } catch { lancou = true; }
  if (!lancou) throw new Error('aceitou construtor vazio');
});

console.log(`\nChegada Detector: ${ok} ok / ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
