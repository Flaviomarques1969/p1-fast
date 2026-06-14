// node-smoke-trail-religacao.mjs — a religação do cockpit-treino trail no
// painel ao vivo, verificável sem navegador (mesmo estilo do cockpit-web:
// checagens de texto sobre o fonte real + importes em Node puro).

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
let ok = 0, fail = 0;
function t(nome, fn) {
  try { fn(); ok++; console.log('✓ ' + nome); }
  catch (e) { fail++; console.error('✗ ' + nome + ' — ' + e.message); }
}

const main = readFileSync(join(RAIZ, 'web/cockpit/main-t3000.js'), 'utf8');
const html = readFileSync(join(RAIZ, 'web/cockpit/index-t3000.html'), 'utf8');

// importes fora do harness: falha aqui derruba o processo (exit ≠ 0) — é o teste
const motorMod = await import('../web/cockpit/trail-cockpit-motor.js');
const telaMod = await import('../web/cockpit/trail-cockpit-tela.js');

t('RL-01 módulos do trail importam em Node puro (sem tocar DOM no import)', () => {
  assert.equal(typeof motorMod.TrailCockpitMotor, 'function');
  assert.equal(typeof telaMod.criarTrailCockpitTela, 'function');
});
t('RL-02 motor recebe a blindagem __P1_ORIGEM_SIM__ na construção', () => {
  assert.match(main, /new TrailCockpitMotor\(\{[\s\S]{0,600}origemSimulador: \(\) => !!window\.__P1_ORIGEM_SIM__/);
});
t('RL-03 camada só arma com foco trail-braking (sem treino = painel intocado)', () => {
  assert.ok(main.includes("treinoStint.treino?.id !== 'trail-braking'"));
});
t('RL-04 tela de orientação cede: no modo trail ela não entra na metade da reta', () => {
  assert.ok(main.includes('if (trailCockpit) { telaOrientacao.esconder(); return; }'));
});
t('RL-05 resumo da volta sai de cena quando a aproximação entra', () => {
  assert.match(main, /tipo === 'aproximacao'\) telaOrientacao\.esconder\(\)/);
});
t('RL-06 eventos e GPS alimentam o motor do trail', () => {
  assert.ok(main.includes('trailCockpit.motor.evento(ev)'));
  assert.ok(main.includes('trailCockpit.motor.gps({'));
});
t('RL-07 nova melhor passagem atualiza o alvo do trecho (régua nasce na pista)', () => {
  assert.ok(main.includes('trailCockpit.motor.atualizarReferencia(ev.segmentId, ev.ref.pontos)'));
});
t('RL-08 página do painel é TELA 10,5 (sem recorte de celular, palco ~3:2)', () => {
  assert.ok(html.includes('height: 590px'), 'palco na proporção da tela real');
  assert.ok(html.includes('.device .notch { display: none; }'), 'sem recorte de celular');
  assert.ok(html.includes('border-radius: 0'), 'sem moldura arredondada');
});
t('RL-09 rótulo de fonte fora do palco: freio vem da física do GPS até o sensor', () => {
  assert.ok(main.includes('FREIO: FÍSICA GPS'));
});
t('RL-10 A2: amostra de freio do T4000 é levada ao motor do trail', () => {
  assert.ok(main.includes('trailCockpit.motor.amostraFreio({'), 'ingestT4000 alimenta o motor do trail');
  assert.equal(typeof motorMod.TrailCockpitMotor.prototype.amostraFreio, 'function');
  assert.equal(typeof motorMod.TrailCockpitMotor.prototype.amostrasFreioNaJanela, 'function');
});

console.log(`\ntrail-religacao: ${ok} ok / ${fail} fail`);
if (fail > 0) process.exit(1);
