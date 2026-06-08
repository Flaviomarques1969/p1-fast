// Smoke test do PadraoAcumulador.
// Cobre o ciclo: 3 voltas aprendendo (sem alertas) + 4ª com desvio acima
// dispara alerta correspondente.

import { PadraoAcumulador, calcularMediaVoltas } from '../web/cockpit/padrao-acumulador.js';

let ok = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log(`✓ ${name}`); ok++; }
  catch (e) { console.log(`✗ ${name} — ${e.message}`); fail++; }
}
async function asyncT(name, fn) {
  try { await fn(); console.log(`✓ ${name}`); ok++; }
  catch (e) { console.log(`✗ ${name} — ${e.message}`); fail++; }
}

t('PA-01 calcularMediaVoltas média correta', () => {
  const voltas = [
    { motorMaxC: 70, pneuMaxC: 90, pneuMinPressBar: 1.8, cambioMaxC: 110 },
    { motorMaxC: 72, pneuMaxC: 92, pneuMinPressBar: 1.7, cambioMaxC: 112 },
    { motorMaxC: 71, pneuMaxC: 91, pneuMinPressBar: 1.75, cambioMaxC: 111 },
  ];
  const m = calcularMediaVoltas(voltas);
  if (Math.abs(m.motor.media - 71) > 0.01) throw new Error(`motor=${m.motor.media}`);
  if (Math.abs(m.pneu.tempMedia - 91) > 0.01) throw new Error(`pneuT=${m.pneu.tempMedia}`);
  if (Math.abs(m.cambio.media - 111) > 0.01) throw new Error(`cambio=${m.cambio.media}`);
});

t('PA-02 construtor exige carroId/trackId/tipoPneu', () => {
  let lancou = false;
  try { new PadraoAcumulador({}); } catch { lancou = true; }
  if (!lancou) throw new Error('construtor aceitou objeto vazio');
});

t('PA-03 3 primeiras voltas NÃO disparam alertas preditivos', () => {
  let alertasRecebidos = [];
  const acu = new PadraoAcumulador({
    carroId: 'c1', trackId: 't1', tipoPneu: 'semi-slick',
    onAlertasPreditivos: (ids) => alertasRecebidos.push(...ids),
  });
  // Volta 1, 2, 3 com valores estáveis
  for (let i = 0; i < 3; i++) {
    acu.ingestT4000({ waterTempC: 70 + i*0.1, tireTempMaxC: 90, tirePressMinBar: 1.8, cambioTempC: 110, checksumOk: true });
    acu.fecharVolta();
  }
  if (alertasRecebidos.length !== 0) throw new Error(`esperava 0 alertas, recebi ${alertasRecebidos.length}: ${alertasRecebidos.join(',')}`);
  const status = acu.getStatus();
  if (status.aprendendo) throw new Error('depois da 3ª volta não deveria estar aprendendo');
  if (!status.padrao) throw new Error('padrão deveria estar calculado');
});

t('PA-04 4ª volta com desvio >20% dispara MOTOR_AQUECENDO', () => {
  let alertasRecebidos = [];
  const acu = new PadraoAcumulador({
    carroId: 'c1', trackId: 't1', tipoPneu: 'semi-slick',
    onAlertasPreditivos: (ids) => alertasRecebidos.push(...ids),
  });
  // 3 voltas com motor ~70°C
  for (let i = 0; i < 3; i++) {
    acu.ingestT4000({ waterTempC: 70, checksumOk: true });
    acu.fecharVolta();
  }
  alertasRecebidos.length = 0;
  // 4ª com motor 90 → desvio = 90/70 = 28% acima
  acu.ingestT4000({ waterTempC: 90, checksumOk: true });
  acu.fecharVolta();
  if (!alertasRecebidos.includes('MOTOR_AQUECENDO')) {
    throw new Error(`esperava MOTOR_AQUECENDO, recebi: ${alertasRecebidos.join(',')}`);
  }
});

t('PA-05 4ª volta com motor abaixo do padrão dispara MOTOR_ESFRIANDO', () => {
  let alertasRecebidos = [];
  const acu = new PadraoAcumulador({
    carroId: 'c1', trackId: 't1', tipoPneu: 'semi-slick',
    onAlertasPreditivos: (ids) => alertasRecebidos.push(...ids),
  });
  for (let i = 0; i < 3; i++) {
    acu.ingestT4000({ waterTempC: 70, checksumOk: true });
    acu.fecharVolta();
  }
  alertasRecebidos.length = 0;
  // 4ª com motor 50 → desvio = 50/70 = 28% abaixo
  acu.ingestT4000({ waterTempC: 50, checksumOk: true });
  acu.fecharVolta();
  if (!alertasRecebidos.includes('MOTOR_ESFRIANDO')) {
    throw new Error(`esperava MOTOR_ESFRIANDO, recebi: ${alertasRecebidos.join(',')}`);
  }
});

t('PA-06 amostras com checksumOk=false são ignoradas', () => {
  const acu = new PadraoAcumulador({ carroId:'c', trackId:'t', tipoPneu:'p' });
  acu.ingestT4000({ waterTempC: 999, checksumOk: false });
  acu.fecharVolta();
  if (acu.getStatus().voltasAcumuladas !== 0) throw new Error('amostra inválida vazou pro padrão');
});

t('PA-07 fecharVolta sem amostras válidas retorna null e não corrompe buffer', () => {
  const acu = new PadraoAcumulador({ carroId:'c', trackId:'t', tipoPneu:'p' });
  const v = acu.fecharVolta();
  if (v !== null) throw new Error('volta vazia não retornou null');
  if (acu.getStatus().voltasAcumuladas !== 0) throw new Error('volta vazia foi acumulada');
});

t('PA-09 aceita padrão e voltas iniciais (continuidade entre sessões)', () => {
  const voltasGravadas = [
    { motorMaxC: 70, pneuMaxC: 90, pneuMinPressBar: 1.8, cambioMaxC: 110 },
    { motorMaxC: 70, pneuMaxC: 90, pneuMinPressBar: 1.8, cambioMaxC: 110 },
    { motorMaxC: 70, pneuMaxC: 90, pneuMinPressBar: 1.8, cambioMaxC: 110 },
  ];
  let alertasRecebidos = [];
  const acu = new PadraoAcumulador({
    carroId: 'c1', trackId: 't1', tipoPneu: 'semi-slick',
    voltasIniciais: voltasGravadas,
    padraoInicial: calcularMediaVoltas(voltasGravadas),
    onAlertasPreditivos: (ids) => alertasRecebidos.push(...ids),
  });
  // Primeira volta da nova sessão com desvio alto → DEVE disparar
  // (padrão já vem persistido das voltas anteriores).
  acu.ingestT4000({ waterTempC: 90, checksumOk: true });
  acu.fecharVolta();
  if (!alertasRecebidos.includes('MOTOR_AQUECENDO')) {
    throw new Error(`continuidade falhou. alertas: ${alertasRecebidos.join(',')}`);
  }
});

await asyncT('PA-10 onPersist é chamado a cada fecharVolta válida', async () => {
  let persists = 0;
  const acu = new PadraoAcumulador({
    carroId: 'c1', trackId: 't1', tipoPneu: 'semi-slick',
    onPersist: async () => { persists++; },
  });
  acu.ingestT4000({ waterTempC: 70, checksumOk: true });
  acu.fecharVolta();
  acu.ingestT4000({ waterTempC: 72, checksumOk: true });
  acu.fecharVolta();
  // O persist é encadeado em Promise.resolve().then(...) — espera microtasks.
  await new Promise(resolve => setImmediate(resolve));
  if (persists !== 2) throw new Error(`persists esperado 2, recebido ${persists}`);
});

t('PA-08 buffer limitado a 10 voltas', () => {
  const acu = new PadraoAcumulador({ carroId:'c', trackId:'t', tipoPneu:'p' });
  for (let i = 0; i < 15; i++) {
    acu.ingestT4000({ waterTempC: 70 + i, checksumOk: true });
    acu.fecharVolta();
  }
  if (acu.getStatus().voltasAcumuladas !== 10) {
    throw new Error(`buffer não respeitou limite: ${acu.getStatus().voltasAcumuladas}`);
  }
});

console.log(`\nPadrão Acumulador: ${ok} ok / ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
