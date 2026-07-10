// Prova da correção da meia-convergência (decisão Flávio 2026-07-10), usando o MÓDULO REAL.
// Piloto com reação constante de 300 ms; luz acende onde o computeCompensation mandar;
// compara a fiação ANTIGA (target = alvo fixo) com a NOVA (target = onde a luz acendeu).
// Rodar no iMac (o notebook não tem Node): `node web/cockpit/_prova-meia-convergencia-2026-07-10.mjs`
// O gêmeo C# desta prova é o teste LMA_10 (verde; e FALHA contra o código antigo — contraprova feita).
import { learnFromEvent, computeCompensation } from './pilot-reaction.js';

function simula(usaPontoDaLuz) {
  let profiles = {};
  const alvo = 6050, rate = 1000, rtReal = 300;
  for (let i = 0; i < 40; i++) {
    const comp = computeCompensation({
      piloto_id: 'p', carro_id: 'bubi', gear: 4, trecho_id: 'c1',
      rpmRiseRate: rate, profiles, mode: 'assisted',
    });
    const luzEm = alvo - comp.compensation_rpm;      // onde a luz ACENDE nesta volta
    const shiftRpm = luzEm + rtReal * rate / 1000;   // o piloto troca 300 ms depois de ver a luz
    const target = usaPontoDaLuz ? luzEm : alvo;     // NOVA fiação vs ANTIGA
    profiles = learnFromEvent({
      piloto_id: 'p', carro_id: 'bubi', gear_after: 4, trecho_id: 'c1',
      gear_confidence: 1, rpm_at_shift: shiftRpm, rpm_before: shiftRpm - 200,
      rpm_rise_rate: rate, target_visual_rpm: target, delta_rpm: shiftRpm - target,
    }, profiles);
  }
  const p = profiles['p:bubi:4:c1'];
  return p ? p.reaction_time_ms : NaN;
}

const antigo = simula(false), novo = simula(true);
console.log(`ANTIGO (target = alvo fixo):     converge pra ${antigo.toFixed(1)} ms (reação real: 300 ms)`);
console.log(`NOVO   (target = onde acendeu):  converge pra ${novo.toFixed(1)} ms (reação real: 300 ms)`);
if (!(novo > 280 && novo < 320)) { console.error('FALHOU: a fiação nova não convergiu na reação real'); process.exit(1); }
if (!(antigo < 200)) { console.error('AVISO: a fiação antiga não exibiu a meia-convergência esperada'); process.exit(1); }
console.log('PROVA OK: a fiação nova converge na reação real; a antiga ficava em ~metade.');
