// Smoke test da PERSISTÊNCIA do que o cérebro aprende (Flávio 14/06: "guardar o
// que ele aprende entre sessões — hoje some ao fechar"). Cobre os 3 componentes:
//   1. gear-detector-online      (assinaturas do câmbio: razão por marcha)
//   2. aprendizado-confianca     (marchas vistas + pontos por trecho×marcha + voltas)
//   3. aprendizado-tempo-passagem(ponto de troca por menor tempo)

import { criarGearDetectorOnline } from '../web/cockpit/gear-detector-online.js';
import { criarAcumuladorConfianca } from '../web/cockpit/aprendizado-confianca.js';
import { criarAprendizadoTempoPassagem } from '../web/cockpit/aprendizado-tempo-passagem.js';

let ok = 0, fail = 0;
function check(label, cond, extra = '') {
  if (cond) { console.log(`✓ ${label}`); ok++; }
  else { console.error(`✗ ${label} ${extra}`); fail++; }
}

// ── 1. Câmbio: aprende razões, persiste, restaura ──────────────
const det = criarGearDetectorOnline({ numMarchas: 5 });
// alimenta pares estáveis em 3ª (razão ~57) e 4ª (razão ~43) por tempo > janela
let t = 0;
function alimenta(detector, rpm, kmh, n) {
  for (let i = 0; i < n; i++) { detector.ingest({ rpm, kmh, ts: t }); t += 100; }
}
alimenta(det, 4000, 70, 8);   // 3ª
alimenta(det, 4300, 100, 8);  // 4ª
const marchasAntes = det.getMarchasIdentificadas();
check('PER-01 detector aprendeu ao menos 1 marcha', marchasAntes.length >= 1, JSON.stringify(marchasAntes));

const dumpDet = det.exportarEstado();
const det2 = criarGearDetectorOnline({ numMarchas: 5 });
check('PER-02 detector novo começa vazio', det2.getMarchasIdentificadas().length === 0);
det2.importarEstado(dumpDet);
const marchasDepois = det2.getMarchasIdentificadas();
check('PER-03 import restaura as mesmas razões do câmbio',
  marchasDepois.length === marchasAntes.length &&
  marchasDepois.every((m, i) => Math.abs(m.ratioMedia - marchasAntes[i].ratioMedia) < 1e-9),
  JSON.stringify(marchasDepois));

// ── 2. Acumulador de confiança: pontos + %, persiste, restaura ─
const acc = criarAcumuladorConfianca();
[1, 2, 3, 4, 5].forEach(m => acc.registrarMarchaDetectada(m));
for (let i = 0; i < 3; i++) acc.registrarPontoAprendido({ trechoId: 'r1', marchaOrigem: 4, rpmAprendido: 6050 });
acc.registrarVoltaLimpa(); acc.registrarVoltaLimpa();
const pctAntes = acc.getPct();
const pontoAntes = acc.getPontoAprendido({ trechoId: 'r1', marchaOrigem: 4 });
check('PER-04 acumulador tem ponto aprendido (3 amostras)', pontoAntes && pontoAntes.amostras === 3, JSON.stringify(pontoAntes));

const dumpAcc = acc.exportarEstado();
const acc2 = criarAcumuladorConfianca();
acc2.importarEstado(dumpAcc);
check('PER-05 import restaura o % de aprendizado', acc2.getPct() === pctAntes, `${acc2.getPct()} vs ${pctAntes}`);
const pontoDepois = acc2.getPontoAprendido({ trechoId: 'r1', marchaOrigem: 4 });
check('PER-06 import restaura o ponto por trecho×marcha',
  pontoDepois && pontoDepois.rpm === pontoAntes.rpm && pontoDepois.amostras === pontoAntes.amostras,
  JSON.stringify(pontoDepois));

// ── 3. Tempo de passagem: já coberto no seu smoke; reconfirma roundtrip ─
const atp = criarAprendizadoTempoPassagem();
for (let i = 0; i < 3; i++) {
  atp.registrarPassagem({ trechoId: 'r2', marcha: 4, shiftRpm: 6250, tempoMs: 30000 + i });
  atp.registrarPassagem({ trechoId: 'r2', marcha: 4, shiftRpm: 6050, tempoMs: 30500 + i });
}
const recAntes = atp.getMelhorPontoPorTempo({ trechoId: 'r2', marcha: 4 });
const atp2 = criarAprendizadoTempoPassagem();
atp2.importarEstado(atp.exportarEstado());
const recDepois = atp2.getMelhorPontoPorTempo({ trechoId: 'r2', marcha: 4 });
check('PER-07 tempo de passagem: import preserva a recomendação',
  recAntes && recDepois && recDepois.rpm === recAntes.rpm && recDepois.amostras === recAntes.amostras,
  JSON.stringify(recDepois));

// ── Import defensivo: lixo não quebra ──────────────────────────
const det3 = criarGearDetectorOnline();
det3.importarEstado(null); det3.importarEstado({}); det3.importarEstado({ marchas: 'x' });
check('PER-08 import de estado inválido não quebra o detector', det3.getMarchasIdentificadas().length === 0);
const acc3 = criarAcumuladorConfianca();
acc3.importarEstado(null); acc3.importarEstado({ pontos: 'x', marchasDetectadas: 7 });
check('PER-09 import de estado inválido não quebra o acumulador', acc3.getPct() === 0);

console.log(`\n[aprendizado-persistencia.spec] ok=${ok} fail=${fail}`);
if (fail > 0) process.exit(1);
