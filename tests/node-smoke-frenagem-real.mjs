// node-smoke-frenagem-real.mjs — prova que o adaptador do Command Box
// (web/command-box/frenagem-real.js) entrega a frenagem no formato FRX usando o
// MOTOR DE PRODUÇÃO (freio-trecho.js), a partir de passagens reais de GPS.
// Roda: node tests/node-smoke-frenagem-real.mjs

import {
  frenagemFrxParaPassagem,
  FRX_XS_PADRAO,
  FRX_ALVO_PADRAO,
} from '../web/command-box/frenagem-real.js';

const M2DEG = 1 / 111320; // ~metros → graus de latitude
const LIMIAR = 15;

// Monta uma passagem de GPS: pontos espaçados por passoM, com kmh(d).
function passagem(kmhDe, totalM = 240, passoM = 4, t0 = 1_000_000) {
  const pts = [];
  let t = t0;
  for (let d = 0; d <= totalM; d += passoM) {
    const kmh = kmhDe(d);
    const vMs = Math.max(1, kmh / 3.6);
    t += (passoM / vMs) * 1000;
    pts.push({ lat: d * M2DEG, lng: 0, kmh, t: Math.round(t) });
  }
  return pts;
}

// freia continuamente até o último ponto (a mínima é o ponto mais lento e ainda freando).
const freiaAteOFim = (freadaEm) => (d) =>
  d < freadaEm ? 170 : Math.max(70, 170 - 100 * ((d - freadaEm) / 100));

const trail = passagem(freiaAteOFim(100), 200);   // freada em ~100 m
const trailRef = passagem(freiaAteOFim(100), 200); // referência igual
const trailTarde = passagem(freiaAteOFim(130), 230); // freou 30 m depois
const semFreada = passagem(() => 150, 240);          // velocidade constante, sem freio

// crossing 15% da grade (pra checar ancoragem)
function crossing(arr, xs) {
  for (let i = 1; i < xs.length; i++) {
    if (arr[i - 1] < LIMIAR && arr[i] >= LIMIAR) {
      const f = (LIMIAR - arr[i - 1]) / (arr[i] - arr[i - 1]);
      return xs[i - 1] + (xs[i] - xs[i - 1]) * f;
    }
  }
  return null;
}

let ok = 0, fail = 0;
function check(name, cond) {
  if (cond) { ok++; console.log('✓ ' + name); }
  else { fail++; console.log('✗ ' + name); }
}

// FR-01: passagem com freada vira objeto FRX válido
const r1 = frenagemFrxParaPassagem({ pontos: trail });
check('FR-01 passagem real vira objeto FRX (não-nulo)', !!r1);
check('FR-02 live tem o tamanho da grade FRX_XS', r1 && r1.live.length === FRX_XS_PADRAO.length);
check('FR-03 todos os pontos de live entre 0 e 100', r1 && r1.live.every(v => v >= 0 && v <= 100));
check('FR-04 a curva real tem um pico de freio (>=40%)', r1 && Math.max(...r1.live) >= 40);
check('FR-05 fonte = física do GPS quando não há sensor', r1 && r1.fonteFreio === 'simulado-fisica');
check('FR-06 soltou é um valor válido', r1 && (r1.soltou === 'progressivo' || r1.soltou === 'de uma vez'));
check('FR-07 freioMin no formato "N%"', r1 && /^\d+%$/.test(r1.freioMin));

// FR-08: freando até a mínima → minimaFreando true
check('FR-08 freou até a mínima → minimaFreando = true', r1 && r1.minimaFreando === true);

// FR-09/10: ancoragem pela referência — onset da live cai perto do onset do ideal
const onsetIdeal = crossing(FRX_ALVO_PADRAO, FRX_XS_PADRAO);
const r2 = frenagemFrxParaPassagem({ pontos: trail, refPontos: trailRef });
const onsetLive = r2 && crossing(r2.live, FRX_XS_PADRAO);
check('FR-09 ref = a própria passagem → deltaM = 0', r2 && r2.deltaM === 0);
check('FR-10 onset da live ancora perto do onset do ideal (±6 m)',
  onsetLive != null && Math.abs(onsetLive - onsetIdeal) <= 6);

// FR-11: freou mais tarde que a referência → deltaM positivo
const r3 = frenagemFrxParaPassagem({ pontos: trailTarde, refPontos: trailRef });
check('FR-11 freou depois da melhor → deltaM positivo (>=8 m)', r3 && r3.deltaM >= 8);

// FR-12: sem freada de verdade → null (não inventa)
const r4 = frenagemFrxParaPassagem({ pontos: semFreada });
check('FR-12 passagem sem freada → null (não inventa)', r4 === null);

// FR-13: amostras do sensor de pressão variando → fonte vira sensor-pressao
const amostras = trail.map(p => ({ t: p.t, pressaoFreioBar: Math.max(0, (170 - p.kmh) / 3) }));
const r5 = frenagemFrxParaPassagem({ pontos: trail, amostrasFreio: amostras });
check('FR-13 sensor de pressão presente → fonteFreio = sensor-pressao', r5 && r5.fonteFreio === 'sensor-pressao');

// FR-14: sensor chapado (zero) NÃO engana → cai pra física
const amostrasChapadas = trail.map(p => ({ t: p.t, pressaoFreioBar: 0 }));
const r6 = frenagemFrxParaPassagem({ pontos: trail, amostrasFreio: amostrasChapadas });
check('FR-14 sensor chapado (zero) não engana → volta pra física', r6 && r6.fonteFreio === 'simulado-fisica');

console.log(`\nfrenagem-real: ${ok} ok / ${fail} fail`);
process.exit(fail ? 1 : 0);
