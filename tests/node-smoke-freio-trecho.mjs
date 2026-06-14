// Smoke do módulo de frenagem/aceleração do trecho (lógica de produção,
// decisão Flávio 11/06: dado simulado ROTULADO até o sensor de pressão entrar).
import {
  comDistanciaAcumulada, simularFreioPelaFisica, detectarPresencaSensorFreio,
  fundirFreioNosPontos, metricasTrail, leituraIA,
} from '../web/cockpit/freio-trecho.js';

let ok = 0, fail = 0;
function t(nome, cond, extra) {
  if (cond) { ok++; console.log('✓ ' + nome); }
  else { fail++; console.log('✗ ' + nome + (extra ? ' — ' + extra : '')); }
}

// pontos sintéticos numa reta: espaçamento ~5 m, velocidades dadas
const GRAU_POR_M = 1 / 111320;
const linha = (velocidades, passoM = 5) => velocidades.map((kmh, i) => ({
  lat: -15.77 + i * passoM * GRAU_POR_M, lng: -47.9, kmh, t: i * 200,
}));

// ── distância acumulada ───────────────────────────────────────
{
  const pts = comDistanciaAcumulada(linha([100, 100, 100]));
  t('DA-01 começa em zero', pts[0].distM === 0);
  t('DA-02 acumula ~5 m por ponto', Math.abs(pts[2].distM - 10) < 0.5, String(pts[2].distM));
}

// ── física real → freio/acelerador % ─────────────────────────
{
  // 8 pts constantes 120 → freada 120→50 → 4 pts a 50 → retomada 50→90
  const vel = [120, 120, 120, 120, 120, 120, 120, 120, 105, 88, 70, 58, 50, 50, 50, 50, 58, 68, 78, 90];
  const { pontos, fonteFreio, picoDesacelMs2 } = simularFreioPelaFisica(linha(vel));
  t('FX-01 rótulo de simulação presente', fonteFreio === 'simulado-fisica');
  const freioMax = Math.max(...pontos.map(p => p.freioPct));
  t('FX-02 freada mais forte vira 100%', Math.abs(freioMax - 100) < 0.01, String(freioMax));
  t('FX-03 trecho constante não freia', pontos.slice(1, 6).every(p => p.freioPct === 0),
    JSON.stringify(pontos.slice(1, 6).map(p => p.freioPct)));
  const acelSaida = Math.max(...pontos.slice(15).map(p => p.aceleradorPct));
  t('FX-04 retomada aparece como acelerador', acelSaida > 50, String(acelSaida));
  t('FX-05 pico de desaceleração medido em m/s²', picoDesacelMs2 > 2, String(picoDesacelMs2));
  const naFreada = pontos.slice(8, 12);
  t('FX-06 freio e acelerador não coexistem no mesmo ponto',
    pontos.every(p => !(p.freioPct > 0 && p.aceleradorPct > 0)));
  t('FX-07 freando de verdade tem freio > 0', naFreada.some(p => p.freioPct > 30),
    JSON.stringify(naFreada.map(p => p.freioPct.toFixed(0))));
}

// ── presença do sensor (regra: zero chapado ≠ sensor) ─────────
{
  const chapado = Array.from({ length: 40 }, (_, i) => ({ t: i * 50, pedalFreioPct: 0, pressaoFreioBar: 0 }));
  t('SP-01 zero chapado → sensor AUSENTE', detectarPresencaSensorFreio(chapado) === null);
  const nulos = Array.from({ length: 40 }, (_, i) => ({ t: i * 50 }));
  t('SP-02 canal nulo → sensor AUSENTE', detectarPresencaSensorFreio(nulos) === null);
  const pedal = Array.from({ length: 40 }, (_, i) => ({ t: i * 50, pedalFreioPct: i % 10 === 0 ? 60 : 5 }));
  t('SP-03 pedal variando → sensor-pedal', detectarPresencaSensorFreio(pedal) === 'sensor-pedal');
  const pressao = Array.from({ length: 40 }, (_, i) => ({ t: i * 50, pedalFreioPct: i % 10 ? 4 : 55, pressaoFreioBar: i % 10 ? 1 : 38 }));
  t('SP-04 pressão variando vence pedal (canal mais nobre)', detectarPresencaSensorFreio(pressao) === 'sensor-pressao');
  t('SP-05 poucas amostras → AUSENTE', detectarPresencaSensorFreio(pedal.slice(0, 10)) === null);
}

// ── fusão sensor real → pontos GPS ────────────────────────────
{
  const pts = linha([120, 110, 90, 70, 60, 60, 70, 85, 100, 110]); // t = 0..1800 (200 em 200)
  const amostras = [];
  for (let ms = 0; ms <= 1800; ms += 50) {
    // pressão: 0 antes, sobe a 40 bar no meio da freada, cai, zero na saída
    const bar = ms < 300 ? 0 : ms < 900 ? 40 * Math.sin(((ms - 300) / 600) * Math.PI) : 0;
    amostras.push({ t: ms, pressaoFreioBar: bar, pedalAceleradorPct: ms > 1100 ? 80 : 0 });
  }
  const r = fundirFreioNosPontos(pts, amostras);
  t('FU-01 fusão confirma fonte sensor-pressao', r && r.fonteFreio === 'sensor-pressao');
  const pico = Math.max(...r.pontos.map(p => p.freioPct ?? 0));
  t('FU-02 pico da pressão vira 100%', Math.abs(pico - 100) < 0.01, String(pico));
  t('FU-03 pico em bar reportado', Math.abs(r.picoPressaoBar - 40) < 1, String(r.picoPressaoBar));
  t('FU-04 acelerador real fundido na saída', r.pontos[9].aceleradorPct === 80, String(r.pontos[9].aceleradorPct));
  const semCasar = fundirFreioNosPontos(linha([100, 100, 100]).map(p => ({ ...p, t: p.t + 99000 })), amostras);
  t('FU-05 ponto sem amostra próxima fica null (não inventa)',
    semCasar.pontos.every(p => p.freioPct === null), JSON.stringify(semCasar.pontos.map(p => p.freioPct)));
  const chapado = amostras.map(a => ({ ...a, pressaoFreioBar: 0, pedalFreioPct: 0 }));
  t('FU-06 sensor chapado → fusão recusa (null)', fundirFreioNosPontos(pts, chapado) === null);
}

// ── métricas do trail ─────────────────────────────────────────
{
  const base = comDistanciaAcumulada(linha(Array(20).fill(80)));
  const degrau = base.map((p, i) => ({ ...p, freioPct: i >= 4 && i <= 6 ? 100 : 0, kmh: i < 7 ? 90 - i * 5 : 60 + (i - 7) * 3 }));
  const md = metricasTrail(degrau);
  t('MT-01 soltura curta → forma degrau', md && md.forma === 'degrau', JSON.stringify(md));
  const progressiva = base.map((p, i) => ({
    ...p,
    freioPct: i < 4 ? 0 : i === 4 ? 100 : i <= 12 ? 100 - (i - 4) * 12 : 0,
    kmh: i < 4 ? 110 : i <= 12 ? 110 - (i - 4) * 6 : 64 + (i - 12) * 4,
  }));
  const mp = metricasTrail(progressiva);
  t('MT-02 soltura longa → forma progressiva', mp && mp.forma === 'progressiva', JSON.stringify(mp));
  t('MT-03 soltura medida em metros', mp && mp.solturaM >= 30, String(mp && mp.solturaM));
  t('MT-04 passagem sem freada → null', metricasTrail(base.map(p => ({ ...p, freioPct: 0 }))) === null);
  t('MT-05 vmin com freio restante (assinatura do trail)', mp && mp.freioNaVminPct > 0, String(mp && mp.freioNaVminPct));
}

// ── leitura da IA ─────────────────────────────────────────────
{
  const minha = { freadaM: 52, picoPct: 100, picoM: 55, solturaM: 4, forma: 'degrau', vminKmh: 61, vminM: 70, freioNaVminPct: 0 };
  const melhor = { freadaM: 60, picoPct: 100, picoM: 62, solturaM: 18, forma: 'progressiva', vminKmh: 66, vminM: 75, freioNaVminPct: 22 };
  const frase = leituraIA(minha, melhor);
  t('IA-01 aponta freada antes da melhor', frase.includes('FREOU 8 m ANTES'), frase);
  t('IA-02 aponta soltura de uma vez', frase.includes('SOLTOU DE UMA VEZ'), frase);
  t('IA-03 ensina o trail da melhor', frase.includes('22% de freio'), frase);
  t('IA-04 sem freada → frase honesta', leituraIA(null, melhor).includes('Sem freada'));
}

console.log(`\nfreio-trecho: ${ok} ok / ${fail} fail`);
process.exit(fail ? 1 : 0);
