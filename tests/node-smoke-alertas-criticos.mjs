// Smoke do AlertasCriticos — regras determinísticas + histerese + manuais.
//
// Cobre os 19 IDs do catálogo aprovado em 27/05/2026 (alertas-criticos.js).

import {
  AlertasCriticos,
  avaliarT4000,
  avaliarPreditivoPorPadrao,
  avaliarGps,
  ALERTAS,
  ALERTA_LIMITES_DEFAULT,
} from '../web/cockpit/alertas-criticos.js';
import { MsgTipo } from '../web/cockpit/cockpit-state.js';

let ok = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log(`✓ ${name}`); ok++; }
  catch (e) { console.log(`✗ ${name} — ${e.message}`); fail++; }
}

// ── Catálogo: o produto fechou em 19 IDs (27/05/2026) ─────────────────────
t('AC-01 catálogo ALERTAS tem 19 IDs aprovados', () => {
  const total = Object.keys(ALERTAS).length;
  if (total !== 19) throw new Error(`esperava 19, achei ${total}`);
});

t('AC-02 MOTOR_AQUECENDO dispara a 70°C exato (preditivo Bubi)', () => {
  const ativos = avaliarT4000({ waterTempC: 70, rpm: 5000 });
  if (!ativos.includes('MOTOR_AQUECENDO')) throw new Error('não disparou aos 70');
  if (ativos.includes('MOTOR_QUENTE')) throw new Error('disparou crítico cedo');
});

t('AC-03 MOTOR_QUENTE dispara a 80°C exato (crítico Bubi)', () => {
  const ativos = avaliarT4000({ waterTempC: 80, rpm: 5000 });
  if (!ativos.includes('MOTOR_QUENTE')) throw new Error('não disparou crítico aos 80');
});

t('AC-04 abaixo de 70°C nenhum alerta de motor', () => {
  const ativos = avaliarT4000({ waterTempC: 65, rpm: 5000 });
  if (ativos.includes('MOTOR_AQUECENDO') || ativos.includes('MOTOR_QUENTE')) {
    throw new Error('falso positivo abaixo do preditivo');
  }
});

t('AC-05 OLEO_BAIXO só dispara com rpm > 2000', () => {
  // bit ativo mas rpm baixo: deve ignorar (rateio em pit)
  const baixo = avaliarT4000({ alarmes: { baixaPressaoOleo: true }, rpm: 1800 });
  if (baixo.includes('OLEO_BAIXO')) throw new Error('disparou no idle');
  // rpm alto: deve disparar
  const alto = avaliarT4000({ alarmes: { baixaPressaoOleo: true }, rpm: 4000 });
  if (!alto.includes('OLEO_BAIXO')) throw new Error('não disparou sob carga');
});

t('AC-06 MISTURA_POBRE acima de 1.15 e RICA abaixo de 0.80', () => {
  const pobre = avaliarT4000({ lambda: 1.20 });
  if (!pobre.includes('MISTURA_POBRE')) throw new Error('lambda 1.20 não disparou pobre');
  const rica = avaliarT4000({ lambda: 0.70 });
  if (!rica.includes('MISTURA_RICA')) throw new Error('lambda 0.70 não disparou rica');
  const ideal = avaliarT4000({ lambda: 0.95 });
  if (ideal.includes('MISTURA_POBRE') || ideal.includes('MISTURA_RICA')) {
    throw new Error('falso positivo no ideal');
  }
});

t('AC-07 COMBUSTIVEL_BAIXO_CRITICO requer os dois bits ativos', () => {
  const so15 = avaliarT4000({
    alarmes: { alertaNivelCombustivel: true, baixaPressaoCombustivel: false },
  });
  if (!so15.includes('COMBUSTIVEL_BAIXO')) throw new Error('15% não virou atenção');
  if (so15.includes('COMBUSTIVEL_BAIXO_CRITICO')) throw new Error('15% virou crítico');
  const ambos = avaliarT4000({
    alarmes: { alertaNivelCombustivel: true, baixaPressaoCombustivel: true },
  });
  if (!ambos.includes('COMBUSTIVEL_BAIXO_CRITICO')) throw new Error('os dois bits não viraram crítico');
});

t('AC-08 PNEU_QUENTE = super crítico no catálogo (pneu não esfria sozinho)', () => {
  const meta = ALERTAS.PNEU_QUENTE;
  if (!meta || meta.gravidade !== 'super') {
    throw new Error(`PNEU_QUENTE gravidade=${meta?.gravidade} (esperado super)`);
  }
});

t('AC-09 BATERIA dispara abaixo de 11.8V', () => {
  const ativos = avaliarT4000({ batteryV: 11.5 });
  if (!ativos.includes('BATERIA')) throw new Error('11.5V não disparou');
});

t('AC-10 FALHANDO via fuelInjectionBalanced=false', () => {
  const ativos = avaliarT4000({ fuelInjectionBalanced: false });
  if (!ativos.includes('FALHANDO')) throw new Error('cilindros desbalanceados não dispararam');
});

t('AC-11 SEM_GPS via accuracy > 30m', () => {
  const ruim = avaliarGps({ accM: 50 });
  if (!ruim.includes('SEM_GPS')) throw new Error('50m não disparou');
  const bom = avaliarGps({ accM: 5 });
  if (bom.includes('SEM_GPS')) throw new Error('5m disparou indevidamente');
});

t('AC-12 preditivo: desvio 20% acima da média dispara MOTOR_AQUECENDO', () => {
  const padrao = { motor: { media: 60 }, pneu: { tempMedia: 90, pressMedia: 1.8 }, cambio: { media: 110 } };
  const acima = avaliarPreditivoPorPadrao({ motorMaxC: 73 }, padrao); // 73 > 60*1.20=72
  if (!acima.includes('MOTOR_AQUECENDO')) throw new Error('preditivo 20% não disparou');
});

t('AC-13 preditivo: desvio 20% abaixo dispara MOTOR_ESFRIANDO', () => {
  const padrao = { motor: { media: 60 }, pneu: { tempMedia: 90, pressMedia: 1.8 }, cambio: { media: 110 } };
  const abaixo = avaliarPreditivoPorPadrao({ motorMaxC: 47 }, padrao); // 47 < 60*0.80=48
  if (!abaixo.includes('MOTOR_ESFRIANDO')) throw new Error('preditivo abaixo não disparou');
});

t('AC-14 orquestrador: onChange dispara só quando o conjunto muda (histerese)', () => {
  let chamados = 0;
  const ac = new AlertasCriticos({ onChange: () => chamados++ });
  ac.ingestT4000({ waterTempC: 75 }); // dispara MOTOR_AQUECENDO
  ac.ingestT4000({ waterTempC: 76 }); // mesmo conjunto, NÃO dispara de novo
  ac.ingestT4000({ waterTempC: 77 });
  if (chamados !== 1) throw new Error(`onChange chamado ${chamados} vezes (esperava 1)`);
  ac.ingestT4000({ waterTempC: 60 }); // sai do alerta
  if (chamados !== 2) throw new Error(`onChange ao limpar não chamou (chamadas=${chamados})`);
});

t('AC-15 raiseManual/clearManual: BOX entra e sai por comando externo', () => {
  const ac = new AlertasCriticos();
  ac.raiseManual('BOX');
  if (!ac.getAtivos().includes('BOX')) throw new Error('BOX não entrou');
  // Sem clearManual, BOX persiste mesmo após nova amostra OK
  ac.ingestT4000({ waterTempC: 60 });
  if (!ac.getAtivos().includes('BOX')) throw new Error('BOX sumiu sem clearManual');
  ac.clearManual('BOX');
  if (ac.getAtivos().includes('BOX')) throw new Error('BOX não saiu com clearManual');
});

t('AC-16 tick() dispara SEM_DADOS após noT4000TimeoutMs', () => {
  const ac = new AlertasCriticos({ limits: { ...ALERTA_LIMITES_DEFAULT, noT4000TimeoutMs: 100 } });
  ac.ingestT4000({ waterTempC: 60, t: 1000 });
  ac.tick(1050); // 50ms após — sem timeout
  if (ac.getAtivos().includes('SEM_DADOS')) throw new Error('disparou cedo');
  ac.tick(1200); // 200ms após — passou de 100ms
  if (!ac.getAtivos().includes('SEM_DADOS')) throw new Error('não disparou após timeout');
});

t('AC-17 prioridade: super > critico > atencao > info', () => {
  const ac = new AlertasCriticos();
  ac.raiseManual('BOX');                  // info
  ac.ingestT4000({ batteryV: 11.0 });     // atenção (BATERIA)
  ac.ingestT4000({ batteryV: 11.0, waterTempC: 81 }); // super (MOTOR_QUENTE)
  const principal = ac.getMensagemPrincipal();
  if (!principal || principal.id !== 'MOTOR_QUENTE') {
    throw new Error(`principal=${principal?.id} (esperado MOTOR_QUENTE)`);
  }
  if (principal.tipo !== MsgTipo.GRAVE) throw new Error('super deveria ser GRAVE');
});

t('AC-18 registrarDerrapagem 3x dispara PISTA_SUJA', () => {
  const ac = new AlertasCriticos();
  ac.registrarDerrapagem('curva-1');
  ac.registrarDerrapagem('curva-1');
  if (ac.getAtivos().includes('PISTA_SUJA')) throw new Error('disparou com 2');
  ac.registrarDerrapagem('curva-1');
  if (!ac.getAtivos().includes('PISTA_SUJA')) throw new Error('não disparou com 3');
});

t('AC-19 catálogo: 9 super, 3 crítico, 4 atenção, 3 info', () => {
  const por = { super: 0, critico: 0, atencao: 0, info: 0 };
  for (const a of Object.values(ALERTAS)) por[a.gravidade]++;
  if (por.super !== 9)   throw new Error(`super=${por.super} (esperado 9)`);
  if (por.critico !== 3) throw new Error(`critico=${por.critico} (esperado 3)`);
  if (por.atencao !== 4) throw new Error(`atencao=${por.atencao} (esperado 4)`);
  if (por.info !== 3)    throw new Error(`info=${por.info} (esperado 3)`);
});

console.log(`\nAlertas críticos: ${ok} ok / ${fail} fail`);
if (fail) process.exit(1);
