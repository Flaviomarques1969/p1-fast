// Testes FORA DO AR: velocidade pelo GPS (volta gravada real) + conta do alerta preditivo.
// Rodar: node web/command-box/cerebro/cerebro-extras.smoke.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { velocidadesDaVolta } from './cerebro-velocidade.js';
import { avaliarPreditivo } from './cerebro-preditivo.js';

const here = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(here, '../../..');

// ---- 1) VELOCIDADE pelo GPS da volta real gravada -------------------------
const gps = JSON.parse(readFileSync(resolve(raiz, 'web/command-box/fixtures/volta-real-gps-23-05-rodando.json'), 'utf8'));
const serie = velocidadesDaVolta(gps.amostras);
const vmax = Math.max(...serie.map(p => p.kmh));
const vmed = Math.round(serie.reduce((a, p) => a + p.kmh, 0) / serie.length);
console.log(`VELOCIDADE: ${serie.length} pontos · máx ${vmax} km/h · média ${vmed} km/h`);

// ---- 2) PREDITIVO: temperatura subindo volta a volta ----------------------
// série sintética só pra provar a CONTA (na tela vem da temp real ao vivo):
// base ~88, sobe 1,3°C/volta, última 96 -> +8°C, estoura 120 em ~(120-96)/1.3≈18.
const voltasTemp = [88, 89.3, 90.6, 91.9, 93.2, 94.5, 95.8].map((t, i) => ({ volta: i + 1, maxTempC: t, curva: 5 }));
const pred = avaliarPreditivo(voltasTemp, { limiteC: 120 });
console.log('PREDITIVO:', JSON.stringify(pred));

const checks = [
  ['velocidade: máx coerente com volta real (100..170)', vmax >= 100 && vmax <= 170],
  ['velocidade: média coerente (>40)', vmed > 40],
  ['preditivo: gerou alerta', !!pred],
  ['preditivo: desvio ~+8°C', pred && Math.abs(pred._desvioC - (95.8 - 88)) < 0.6],
  ['preditivo: taxa ~1,3°C/volta', pred && Math.abs(pred._taxaPorVolta - 1.3) < 0.2],
  ['preditivo: aponta a curva', pred && pred.frase.includes('curva 5')],
  ['preditivo: ETA projetada', pred && pred._voltasAteLimite > 0],
];
let ok = true;
console.log('\n=== CONFERÊNCIAS ===');
for (const [nome, passou] of checks) { console.log(`${passou ? 'OK  ' : 'FALHOU'}  ${nome}`); if (!passou) ok = false; }
console.log(ok ? '\nTUDO VERDE\n' : '\nFALHOU\n');
process.exit(ok ? 0 : 1);
