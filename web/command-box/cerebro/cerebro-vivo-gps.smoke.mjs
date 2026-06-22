// Prova o caminho NOVO: marco de chegada + GPS → o cérebro vivo conta volta pelo
// cruzamento da linha (sem depender do cronômetro da injeção) e calcula o tempo
// pelo intervalo entre cruzamentos. Também prova a anti-duplicidade (injeção +
// GPS na mesma passagem contam UMA vez). Sintético, sem arquivo pesado, sem rede.
//   Rodar: node web/command-box/cerebro/cerebro-vivo-gps.smoke.mjs
import { criarOrquestradorVivo } from './cerebro-vivo.js';

// linha de chegada sintética: leste-oeste, no lat=0, de lng 0 a 0.0003 (~33 m)
const marco = { a_gps: { lat: 0, lng: 0 }, b_gps: { lat: 0, lng: 0.0003 } };
const LNG = 0.00015; // o carro cruza pelo meio da linha

let ok = true;
const checa = (nome, passou) => { console.log(`${passou ? 'OK  ' : 'FALHOU'}  ${nome}`); if (!passou) ok = false; };

// ---- 1) 3 cruzamentos pelo GPS → 2 voltas, painel calcula -------------------
const orq = criarOrquestradorVivo({
  marcoChegada: marco, plano: { voltas: 5, duracaoS: 1680 },
  pbEverSec: 90.0, stintNumero: 1, stintTotal: 1,
});
let t = 0;
const feed = (lat, lng, dtMs) => { t += dtMs; orq.feedSample({ lat, lng, tWall: t, rpm: 6000, waterTempC: 80 }); };

feed(-0.0003, LNG, 1000); // começa ao sul da linha
for (let lap = 0; lap < 3; lap++) {
  feed(-0.00005, LNG, 1000);
  feed(+0.00005, LNG, 1000);   // CRUZA indo pro norte (cruzamento)
  feed(+0.0003, LNG, 1000);
  // retorna ao sul SEM cortar o segmento (vai pro leste, desce, volta pro oeste)
  feed(+0.0003, 0.0020, 1000);
  feed(-0.0003, 0.0020, 1000); // desce no leste: lado vira, mas fora da linha → não conta
  feed(-0.0003, LNG, 88000);   // volta pro oeste/sul (fecha ~93 s de volta)
}
const snap = orq.snapshot();
console.log('voltas:', snap._geradoComVoltas, '| STINT:', JSON.stringify(snap.stint));
console.log('RITMO:', JSON.stringify(snap.ritmo));
const voltasReg = orq._cerebro._estado().voltas;
console.log('tempos de volta (s):', voltasReg.map(v => v.tempoSec.toFixed(1)).join(', '));

checa('GPS detectou 3 cruzamentos', orq._detectorChegada.getVoltas() === 3);
checa('3 cruzamentos → 2 voltas fechadas', snap._geradoComVoltas === 2);
checa('painel calcula stint (não fica aguardando)', !!snap.stint && snap.stint.voltaAtual === 2);
checa('tempo de volta plausível (~93 s, do intervalo GPS)', voltasReg.every(v => v.tempoSec > 80 && v.tempoSec < 110));

// ---- 2) Anti-duplicidade: injeção fechando a MESMA passagem do GPS ----------
const orq2 = criarOrquestradorVivo({
  marcoChegada: marco, plano: { voltas: 5 }, pbEverSec: 90.0, stintNumero: 1, stintTotal: 1,
});
let t2 = 0;
const feed2 = (lat, lng, dt) => { t2 += dt; orq2.feedSample({ lat, lng, tWall: t2, cronometroParcialS: 92 }); };
feed2(-0.0003, LNG, 1000);
feed2(-0.00005, LNG, 1000);
feed2(+0.00005, LNG, 1000); // cruzamento #1 (sem volta ainda)
feed2(+0.0003, LNG, 1000);
feed2(+0.0003, 0.0020, 1000);
feed2(-0.0003, 0.0020, 1000);
feed2(-0.0003, LNG, 88000);
feed2(-0.00005, LNG, 1000);
feed2(+0.00005, LNG, 1000); // cruzamento #2 → fecha 1 volta pelo GPS
// a injeção tenta fechar a MESMA volta logo em seguida (dentro de 8 s) → não pode dobrar
orq2.feedVolta({ tipo: 'volta', n: 2 });
const snap2 = orq2.snapshot();
console.log('\n[dedup] voltas após GPS+injeção na mesma passagem:', snap2._geradoComVoltas);
checa('injeção não duplica a volta que o GPS já fechou', snap2._geradoComVoltas === 1);

console.log(ok ? '\nTUDO VERDE — detecção de volta por GPS no cérebro vivo\n' : '\nFALHOU\n');
process.exit(ok ? 0 : 1);
