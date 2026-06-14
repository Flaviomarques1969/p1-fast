// node-smoke-trail-cockpit.mjs — motor do cockpit em modo treino TRAIL BRAKING.
// Cobre: alvo real da melhor passagem, contagem com zero adiantado pela reação,
// aprendizagem da reação (EMA + clamps + amostra inválida), pintura na banda,
// veredito 2-de-2 (D1) com erro nomeado + aviso do ponto de freada,
// trilho última+anterior, calibração.

import assert from 'node:assert/strict';
import {
  TRAIL_DEFAULTS, construirAlvoTrecho, alvoPctEm, nivelLuzFreio, rotuloTrilho,
  computarVeredito, TrailCockpitMotor,
} from '../web/cockpit/trail-cockpit-motor.js';

let ok = 0, fail = 0;
function t(nome, fn) {
  try { fn(); ok++; console.log('✓ ' + nome); }
  catch (e) { fail++; console.error('✗ ' + nome + ' — ' + e.message); }
}

// ── Fixtures: passagem sintética em linha reta (lat cresce, lng=0) ──
// 1 m ≈ 1/111319 grau de latitude (mesma régua equiretangular do motor).
const M2DEG = 1 / 111319;
/** Gera pontos a cada `passoM` com velocidade kmhDe(distM). 10 Hz sintético. */
function passagem(kmhDe, totalM = 220, passoM = 4, t0 = 1000000) {
  const pts = [];
  let tAcc = t0;
  for (let d = 0; d <= totalM; d += passoM) {
    const kmh = kmhDe(d);
    const vMs = Math.max(1, kmh / 3.6);
    tAcc += (passoM / vMs) * 1000;
    pts.push({ lat: d * M2DEG, lng: 0, kmh, t: Math.round(tAcc), fracao: d / totalM, sub: 'entrada' });
  }
  return pts;
}
// melhor passagem: cruza a 100, freia FORTE aos 87 m, trail suave até a Vmin
// (~160 m, ainda freando), depois acelera — forma progressiva.
function perfilMelhor(d) {
  if (d < 87) return 100;
  if (d < 120) return 100 - (45 * (d - 87)) / 33;   // 100→55 (pancada)
  if (d < 160) return 55 - (10 * (d - 120)) / 40;   // 55→45 (trail)
  return 45 + (35 * (d - 160)) / 60;                // saída
}
const MELHOR = passagem(perfilMelhor);
const ALVO = construirAlvoTrecho(MELHOR);

// ── Alvo do trecho ──
t('AL-01 alvo construído da melhor passagem real', () => {
  assert.ok(ALVO, 'alvo deveria existir');
  assert.ok(Math.abs(ALVO.metricas.freadaM - 87) <= 8, `freadaM ${ALVO.metricas.freadaM} ≈ 87`);
  assert.ok(Math.abs(ALVO.vminM - 160) <= 8, `vminM ${ALVO.vminM} ≈ 160`);
  assert.equal(ALVO.metricas.forma, 'progressiva');
});
t('AL-02 trecho sem freada (reta) → alvo null', () => {
  assert.equal(construirAlvoTrecho(passagem(() => 100)), null);
});
t('AL-03 série curta/ausente → alvo null', () => {
  assert.equal(construirAlvoTrecho(null), null);
  assert.equal(construirAlvoTrecho(MELHOR.slice(0, 2)), null);
});
t('AL-05 referência RALA não vira alvo (régua de freada exige série densa)', () => {
  assert.equal(construirAlvoTrecho(passagem(perfilMelhor, 220, 36)), null, '7 pontos (1 Hz real do banco)');
  assert.equal(construirAlvoTrecho(passagem(perfilMelhor, 220, 12)), null, '19 pontos mas 12 m entre eles');
});
t('AL-07 desaceleração no nível de tirada de pé (<2,5 m/s²) não vira alvo', () => {
  assert.equal(construirAlvoTrecho(passagem(d => d < 87 ? 100 : Math.max(88, 100 - (d - 87) * 0.18))), null);
});
t('AL-08 mínima ANTES da freada (geometria degenerada) não vira alvo', () => {
  // mais lento no começo, acelera, depois freia mas sem descer da vel. inicial
  assert.equal(construirAlvoTrecho(passagem(d => {
    if (d < 40) return 60 + d;          // 60→100
    if (d < 100) return 100;
    if (d < 140) return 100 - (d - 100); // freia 100→65 (mínima global segue 60, no início)
    return 65 + (d - 140) / 2;
  })), null);
});
t('AL-04 alvoPctEm interpola e zera antes da curva', () => {
  assert.equal(alvoPctEm(ALVO, 0), ALVO.curva[0].freioPct);
  const meio = alvoPctEm(ALVO, 100);
  assert.ok(meio > 20, `pct em 100 m deveria ser alto (${meio})`);
  const aposVmin = alvoPctEm(ALVO, ALVO.curva[ALVO.curva.length - 1].distM + 50);
  assert.equal(aposVmin, ALVO.curva[ALVO.curva.length - 1].freioPct);
});

// ── Colunas de luz / rótulos ──
t('LZ-01 nível 0..6 pela régua de metros do mockup', () => {
  assert.equal(nivelLuzFreio(200), 0);
  assert.equal(nivelLuzFreio(130), 1);
  assert.equal(nivelLuzFreio(100), 2);
  assert.equal(nivelLuzFreio(70), 3);
  assert.equal(nivelLuzFreio(50), 4);
  assert.equal(nivelLuzFreio(30), 5);
  assert.equal(nivelLuzFreio(10), 6);
  assert.equal(nivelLuzFreio(NaN), 0);
});
t('RT-01 rótulo do trilho: siglas do mockup a partir dos nomes REAIS do banco', () => {
  assert.equal(rotuloTrilho('CURVA 01'), 'C1');
  assert.equal(rotuloTrilho('CURVA DA RETA OPOSTA'), 'RO');
  assert.equal(rotuloTrilho('CURVA 2'), 'C2');
  assert.equal(rotuloTrilho('CURVA DA JUNÇÃO'), 'JU');
  assert.equal(rotuloTrilho('CURVA DA BRUXA'), 'BR');
  assert.equal(rotuloTrilho('CURVA DO PLACAR'), 'PL');
  assert.equal(rotuloTrilho('CURVA "S"'), 'S');
  assert.equal(rotuloTrilho('CURVA DA VITÓRIA'), 'VI');
  assert.equal(rotuloTrilho(''), '·');
});

// ── Veredito 2-de-2 (D1, Flávio 14/06): formato + mínima; ponto de freada = aviso ──
t('VD-01 mesma freada da melhor → TRAIL CERTO (sem aviso)', () => {
  const v = computarVeredito(passagem(perfilMelhor), ALVO);
  assert.equal(v.certo, true, JSON.stringify(v.condicoes));
  assert.equal(v.erro, null);
  assert.equal(v.aviso, null);
});
t('VD-02 freou 20 m antes → ERRADO por FORA DO FORMATO, aviso FREOU CEDO', () => {
  // 2 de 2 (D1): o ponto de freada não reprova; a 20 m de desvio o FORMATO
  // também quebra (comparação alinhada por posição) — esse vira o motivo. O
  // ponto de freada sai no .aviso, fora do veredito.
  const v = computarVeredito(passagem(d => perfilMelhor(d + 20)), ALVO);
  assert.equal(v.certo, false);
  assert.equal(v.erro, 'FORA DO FORMATO');
  assert.equal(v.aviso, 'FREOU CEDO');
});
t('VD-03 freou 15 m depois → ERRADO por FORA DO FORMATO, aviso FREOU TARDE', () => {
  const v = computarVeredito(passagem(d => perfilMelhor(d - 15)), ALVO);
  assert.equal(v.certo, false);
  assert.equal(v.erro, 'FORA DO FORMATO');
  assert.equal(v.aviso, 'FREOU TARDE');
});
t('VD-04 pancada e largou de uma vez → SOLTOU DE UMA VEZ', () => {
  // degrau seco: desaceleração CONSTANTE (v = √(v₀²−2aΔd)) e largada
  // instantânea — amostragem densa (1,5 m) pra física ver degrau, não rampa
  const v0 = 100 / 3.6, aFre = 8; // m/s, m/s²
  const vEm = d => Math.sqrt(Math.max(1, v0 * v0 - 2 * aFre * (d - 87))) * 3.6;
  const vSolta = vEm(110);
  const v = computarVeredito(passagem(d => {
    if (d < 87) return 100;
    if (d < 110) return vEm(d);     // pancada de desaceleração constante
    if (d < 160) return vSolta;     // LARGOU: velocidade constante
    return vSolta + (25 * (d - 160)) / 60;
  }, 220, 1.5), ALVO);
  assert.equal(v.certo, false);
  assert.equal(v.erro, 'SOLTOU DE UMA VEZ');
});
t('VD-05 passagem sem freada → NAO FREOU', () => {
  const v = computarVeredito(passagem(() => 100), ALVO);
  assert.equal(v.certo, false);
  assert.equal(v.erro, 'NAO FREOU');
});
t('VD-06 sem alvo → sem veredito (null)', () => {
  assert.equal(computarVeredito(passagem(perfilMelhor), null), null);
});
t('VD-07 condições reportadas uma a uma', () => {
  const v = computarVeredito(passagem(perfilMelhor), ALVO);
  assert.equal(v.condicoes.freouNaBanda, true);
  assert.equal(v.condicoes.seguiuFormato, true);
  assert.equal(v.condicoes.minimaFreando, true);
  assert.ok(v.condicoes.fracDentro >= TRAIL_DEFAULTS.formatoMinFrac);
});
t('VD-08 D1: ponto de freada é AVISO no 2 de 2 e volta a reprovar no 3 de 3', () => {
  // isola o ponto de freada: neutraliza formato/mínima (sempre ok) pra que só
  // o ponto de freada decida. Passagem com a forma da melhor mas freando 20 m
  // antes (banda falsa). 2 de 2 = CERTO com aviso; 3 de 3 (pressão real) = ERRADO.
  const so_ponto = { formatoMinFrac: 0, freioVminMinPct: 0 };
  const cedo = passagem(d => perfilMelhor(d + 20));
  const v2 = computarVeredito(cedo, ALVO, so_ponto);
  assert.equal(v2.condicoes.freouNaBanda, false, 'ponto de freada fora da banda');
  assert.equal(v2.certo, true, '2 de 2: ponto de freada não reprova');
  assert.equal(v2.erro, null);
  assert.equal(v2.aviso, 'FREOU CEDO');
  const v3 = computarVeredito(cedo, ALVO, { ...so_ponto, pontoFreadaReprova: true });
  assert.equal(v3.certo, false, '3 de 3: ponto de freada volta a reprovar');
  assert.equal(v3.erro, 'FREOU CEDO');
});

// ── Motor: geometria de 2 trechos em linha (A → reta 300 m → B) ──
function segLinha(id, nome, centroM, comprimentoM = 60) {
  const l = (m) => ({ a: { lat: m * M2DEG, lng: -0.0001 }, b: { lat: m * M2DEG, lng: 0.0001 } });
  return { id, nome, ordem: id === 'A' ? 1 : 2, entradaLine: l(centroM), saidaLine: l(centroM + comprimentoM) };
}
const SEG_A = segLinha('A', 'Curva 1', -360);   // saída de A em −300 m
const SEG_B = segLinha('B', 'Junção', 0);       // entrada de B em 0 m
function refsMap() {
  return new Map([['B', { pontos: MELHOR }]]);
}
function storageFake() {
  const m = new Map();
  return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), _m: m };
}
/** Roda o carro em linha reta de −300 m até `ateM`, kmh fixo, 10 Hz. */
function roda(motor, deM, ateM, kmh, t0 = 0, passoM = 3) {
  let t = t0;
  for (let m = deM; m <= ateM; m += passoM) {
    t += (passoM / (kmh / 3.6)) * 1000;
    motor.gps({ lat: m * M2DEG, lng: 0, kmh, t });
  }
  return t;
}

// ── Amostras do sensor de freio (A2): transporte/buffer, sem mudar o veredito ──
t('AF-01 amostraFreio bufferiza e conta; amostra sem freio é ignorada', () => {
  const motor = new TrailCockpitMotor({ segments: [SEG_B], refs: refsMap(), storage: storageFake() });
  assert.equal(motor.contagemAmostrasFreio(), 0);
  assert.equal(motor.amostraFreio({ t: 1000, pressaoFreioBar: 12 }), 1);
  assert.equal(motor.amostraFreio({ t: 1100, pedalFreioPct: 40 }), 2);
  assert.equal(motor.amostraFreio({ t: 1200 }), null, 'sem canal de freio não conta');
  assert.equal(motor.amostraFreio({ t: 1300, pressaoFreioBar: NaN }), null, 'NaN não conta');
  assert.equal(motor.amostraFreio({ pressaoFreioBar: 12 }), null, 'sem tempo não conta');
  assert.equal(motor.contagemAmostrasFreio(), 2);
});
t('AF-02 amostrasFreioNaJanela devolve só o que cai na janela (com margem)', () => {
  const motor = new TrailCockpitMotor({ segments: [SEG_B], refs: refsMap(), storage: storageFake() });
  for (let t = 1000; t <= 2000; t += 100) motor.amostraFreio({ t, pressaoFreioBar: 10 });
  const j = motor.amostrasFreioNaJanela(1300, 1500);
  assert.ok(j.length >= 3);
  assert.ok(j.every(s => s.t >= 1000 && s.t <= 1800), 'janela com margem 300 ms');
});
t('AF-03 transporte de freio NÃO muda o veredito (proxy GPS segue até A3)', () => {
  const motor = new TrailCockpitMotor({ segments: [SEG_B], refs: refsMap(), storage: storageFake() });
  const efeitos = []; motor.onEfeito(e => efeitos.push(e));
  for (let t = 1000; t <= 1300; t += 50) motor.amostraFreio({ t, pressaoFreioBar: 50 });
  motor.evento({ type: 'passagem-fechada', segmentId: 'B', pontos: passagem(perfilMelhor) });
  motor.evento({ type: 'passagem-fechada', segmentId: 'B', pontos: passagem(perfilMelhor) });
  const ver = efeitos.filter(e => e.tipo === 'veredito');
  assert.ok(ver.length >= 1 && ver[ver.length - 1].veredito.certo, 'veredito vem da física GPS');
});

// ── Fusão real proxy→pressão (A3): fonte e uso da pressão ──
t('FU-01 sensor presente: veredito USA a pressão e a fonte vira sensor-pressao', () => {
  const reta = passagem(() => 100); // GPS sem desaceleração → física daria NAO FREOU
  const amostras = reta.map(p => ({          // pressão variável, casada no tempo
    t: p.t,
    pressaoFreioBar: (p.fracao > 0.35 && p.fracao < 0.75) ? 40 : 2, // pancada no meio
  }));
  const semSensor = computarVeredito(reta, ALVO); // sem amostras → física
  assert.equal(semSensor.erro, 'NAO FREOU', 'GPS plano não vê freada');
  assert.equal(semSensor.fonteFreio, 'simulado-fisica');
  const comSensor = computarVeredito(reta, ALVO, {}, amostras);
  assert.equal(comSensor.fonteFreio, 'sensor-pressao', 'pressão variável → sensor');
  assert.ok(comSensor.metricas, 'a pressão revela a freada que o GPS plano não via');
});
t('FU-02 pressão zerada/chapada: fica simulado-fisica (sensor de mentira não engana)', () => {
  const pass = passagem(perfilMelhor);
  const amostras = pass.map(p => ({ t: p.t, pressaoFreioBar: 0 })); // chapado em 0
  const v = computarVeredito(pass, ALVO, {}, amostras);
  assert.equal(v.fonteFreio, 'simulado-fisica', 'zero chapado não é sensor');
  assert.equal(v.certo, true, 'cai pra física do GPS, que segue a melhor');
});
t('FU-03 motor: sensor presente troca a fonte e avisa a tela (efeito fonte-freio)', () => {
  const motor = new TrailCockpitMotor({ segments: [SEG_B], refs: refsMap(), storage: storageFake() });
  const efeitos = []; motor.onEfeito(e => efeitos.push(e));
  assert.equal(motor.fonteFreio(), 'simulado-fisica', 'começa na física');
  assert.equal(motor.snapshot().fonteFreio, 'simulado-fisica');
  // pressão variável suficiente pra detectar sensor (≥20 amostras, variação ≥3)
  for (let i = 0; i < 40; i++) motor.amostraFreio({ t: 1000 + i * 50, pressaoFreioBar: i % 2 ? 30 : 2 });
  assert.equal(motor.fonteFreio(), 'sensor-pressao', 'sensor detectado no buffer');
  assert.equal(motor.snapshot().fonteFreio, 'sensor-pressao');
  assert.ok(efeitos.some(e => e.tipo === 'fonte-freio' && e.fonteFreio === 'sensor-pressao'),
    'emitiu a troca de fonte pra tela');
});

t('AL-06 nova melhor DENSA atualiza o alvo (a régua nasce na pista)', () => {
  const refsRalas = new Map([['B', { pontos: passagem(perfilMelhor, 220, 36) }]]);
  const motor = new TrailCockpitMotor({ segments: [SEG_B], refs: refsRalas, storage: storageFake() });
  assert.equal(motor.alvoDoTrecho('B'), null, 'ref rala do banco → sem alvo');
  assert.ok(motor.atualizarReferencia('B', MELHOR), 'passagem densa vira alvo');
  assert.ok(motor.alvoDoTrecho('B'));
  motor.atualizarReferencia('B', passagem(() => 100)); // sem freada: inválida
  assert.ok(motor.alvoDoTrecho('B'), 'referência inválida NÃO derruba alvo bom');
});
t('MT-01 aproximação só arma na METADE da reta', () => {
  const motor = new TrailCockpitMotor({ segments: [SEG_A, SEG_B], refs: refsMap(), storage: storageFake() });
  // B precisa estar calibrado (2 passagens) pra contagem aparecer
  motor.evento({ type: 'passagem-fechada', segmentId: 'B', pontos: MELHOR });
  motor.evento({ type: 'passagem-fechada', segmentId: 'B', pontos: MELHOR });
  motor.evento({ type: 'saida-cruzou', segmentId: 'A', kmh: 100 });
  roda(motor, -300, -180, 100);
  assert.notEqual(motor.snapshot().fase, 'aproxima', 'antes da metade: ainda não');
  roda(motor, -177, -120, 100);
  assert.equal(motor.snapshot().fase, 'aproxima');
  assert.equal(motor.snapshot().segAlvoId, 'B');
});
t('MT-02 trecho SEM base digna não arma; COM base arma direto, sem esperar volta (rodada 20)', () => {
  // sem referência digna: nada arma
  const semBase = new TrailCockpitMotor({
    segments: [SEG_A, SEG_B],
    refs: new Map([['B', { pontos: passagem(perfilMelhor, 220, 36) }]]), // rala (banco de maio)
    storage: storageFake(),
  });
  semBase.evento({ type: 'saida-cruzou', segmentId: 'A', kmh: 100 });
  roda(semBase, -300, -60, 100);
  assert.notEqual(semBase.snapshot().fase, 'aproxima');
  // com base guardada: arma na PRIMEIRA aproximação da sessão, sem calibrar de novo
  const comBase = new TrailCockpitMotor({ segments: [SEG_A, SEG_B], refs: refsMap(), storage: storageFake() });
  comBase.evento({ type: 'saida-cruzou', segmentId: 'A', kmh: 100 });
  roda(comBase, -300, -60, 100);
  assert.equal(comBase.snapshot().fase, 'aproxima', 'base existente = cockpit desde a 1ª curva');
});
t('MT-03 contagem cai, zero dispara ADIANTADO pela reação, depois conta pra cima', () => {
  const motor = new TrailCockpitMotor({ segments: [SEG_A, SEG_B], refs: refsMap(), storage: storageFake() });
  motor.evento({ type: 'passagem-fechada', segmentId: 'B', pontos: MELHOR });
  motor.evento({ type: 'passagem-fechada', segmentId: 'B', pontos: MELHOR });
  const efeitos = [];
  motor.onEfeito(e => efeitos.push(e));
  motor.evento({ type: 'saida-cruzou', segmentId: 'A', kmh: 100 });
  roda(motor, -300, -90, 100);
  const s1 = motor.snapshot();
  assert.equal(s1.contagem.modo, 'antes');
  assert.ok(s1.contagem.n > 100, `bem antes do ponto: ${s1.contagem.n} m`);
  assert.equal(s1.nivelLuz, 0, 'a 170 m do zero ainda não acende (régua começa em 130)');
  let t = roda(motor, -87, -45, 100); // ~132 m do ponto → 1ª luz acesa
  const sLuz = motor.snapshot();
  assert.ok(sLuz.nivelLuz >= 1 && sLuz.nivelLuz <= 3, `nível ${sLuz.nivelLuz}`);
  // o ponto da melhor fica 87 m DEPOIS da linha de entrada — o zero dispara
  // DENTRO do trecho. Zero adiantado ≈ 6,9 m antes (0,25 s × 27,8 m/s).
  t = roda(motor, -42, 0, 100, t);
  motor.evento({ type: 'entrada-cruzou', segmentId: 'B', kmh: 100, t });
  t = roda(motor, 3, 84, 100, t);
  const zero = efeitos.find(e => e.tipo === 'zero');
  assert.ok(zero, 'zero disparou');
  assert.ok(zero.adiantoM > 5 && zero.adiantoM < 9, `adianto ${zero.adiantoM} m`);
  const s2 = motor.snapshot();
  assert.ok(s2.contagem.modo === 'depois' || (s2.contagem.modo === 'antes' && s2.contagem.n <= 3),
    `depois do zero: ${JSON.stringify(s2.contagem)}`);
  // segue sem pisar: passa do ponto REAL → vermelho ('passou')
  roda(motor, 87, 102, 100, t);
  assert.equal(motor.snapshot().contagem.modo, 'passou');
});
t('MT-04 pisou de verdade: contagem some, traço pinta, reação vira amostra', () => {
  const st = storageFake();
  const motor = new TrailCockpitMotor({ segments: [SEG_A, SEG_B], refs: refsMap(), storage: st });
  motor.evento({ type: 'passagem-fechada', segmentId: 'B', pontos: MELHOR });
  motor.evento({ type: 'passagem-fechada', segmentId: 'B', pontos: MELHOR });
  const efeitos = [];
  motor.onEfeito(e => efeitos.push(e));
  motor.evento({ type: 'saida-cruzou', segmentId: 'A', kmh: 100 });
  let t = roda(motor, -300, -3, 100);
  motor.evento({ type: 'entrada-cruzou', segmentId: 'B', kmh: 100, t });
  // freia DE VERDADE seguindo o perfil da melhor (desaceleração real no GPS)
  for (let m = 0; m <= 160; m += 3) {
    const kmh = perfilMelhor(m);
    t += (3 / (kmh / 3.6)) * 1000;
    motor.gps({ lat: m * M2DEG, lng: 0, kmh, t });
  }
  const pisou = efeitos.find(e => e.tipo === 'pisou');
  assert.ok(pisou, 'pisou detectado pela física ao vivo');
  assert.equal(motor.snapshot().contagem, null, 'contagem some quando pisa');
  assert.ok(motor.snapshot().traco.length > 5, 'traço pintado');
  const naBanda = motor.snapshot().traco.filter(p => p.ok).length / motor.snapshot().traco.length;
  assert.ok(naBanda >= 0.7, `seguindo a melhor, maioria na banda (${(naBanda * 100).toFixed(0)}%)`);
  // seguindo a PRÓPRIA melhor, a tela NÃO pode piscar vermelho (anti falso-positivo)
  assert.ok(!efeitos.some(e => e.tipo === 'fora-da-banda'),
    'passagem perfeita não dispara pisca de erro');
  if (pisou.amostraReacaoS != null) {
    assert.ok(st._m.get('p1fast-trail-reacao-v1'), 'reação persistida');
  }
});
t('MT-04b BLINDAGEM: em modo simulador a reação NÃO aprende nem grava', () => {
  const st = storageFake();
  const motor = new TrailCockpitMotor({
    segments: [SEG_B], refs: refsMap(), storage: st,
    origemSimulador: () => true,
  });
  assert.equal(motor.registrarAmostraReacao('B', 0.30), null, 'amostra de simulador recusada');
  assert.equal(motor.reacaoS('B'), TRAIL_DEFAULTS.reacaoDefaultS, 'reação segue no padrão');
  assert.equal(st._m.get('p1fast-trail-reacao-v1'), undefined, 'nada gravado');
});
t('MT-05 freada-iniciou (reserva −0,5 g) preenche o FREIO da régua', () => {
  const motor = new TrailCockpitMotor({ segments: [SEG_A, SEG_B], refs: refsMap(), storage: storageFake() });
  motor.evento({ type: 'passagem-fechada', segmentId: 'B', pontos: MELHOR });
  motor.evento({ type: 'passagem-fechada', segmentId: 'B', pontos: MELHOR });
  motor.evento({ type: 'saida-cruzou', segmentId: 'A', kmh: 100 });
  roda(motor, -300, -3, 100);
  motor.evento({ type: 'entrada-cruzou', segmentId: 'B', kmh: 100, t: 999000 });
  motor.evento({ type: 'freada-iniciou', segmentId: 'B', kmh: 98, t: 999500, distFromEntradaM: 86 });
  const ap = motor.snapshot().apex;
  assert.equal(ap.freio.valor, '86 m');
  assert.equal(ap.freio.estado, 'ok-melhor'); // |86−~87| ≤ 3 m
  assert.equal(motor.snapshot().fase, 'freia');
});
t('MT-06 saída fecha o ciclo: veredito vira célula DA VOLTA no trilho', () => {
  const motor = new TrailCockpitMotor({ segments: [SEG_A, SEG_B], refs: refsMap(), storage: storageFake() });
  const efeitos = [];
  motor.onEfeito(e => efeitos.push(e));
  motor.evento({ type: 'saida-cruzou', segmentId: 'B', kmh: 80 });
  motor.evento({ type: 'passagem-fechada', segmentId: 'B', pontos: passagem(perfilMelhor) });
  motor.evento({ type: 'passagem-fechada', segmentId: 'B', pontos: passagem(d => perfilMelhor(d + 20)) });
  motor.evento({ type: 'passagem-fechada', segmentId: 'B', pontos: passagem(perfilMelhor) });
  const linhaB = motor.trilho().find(l => l.segId === 'B');
  assert.deepEqual(linhaB.celulas, ['certo'], 'célula mostra o resultado mais recente da volta');
  assert.equal(linhaB.calibrando, false);
  const vereditos = efeitos.filter(e => e.tipo === 'veredito');
  assert.equal(vereditos.length, 3);
  // 2 de 2 (D1): freando 20 m antes o formato quebra (vira o motivo) e o ponto
  // de freada sai no aviso
  assert.equal(vereditos[1].veredito.erro, 'FORA DO FORMATO');
  assert.equal(vereditos[1].veredito.aviso, 'FREOU CEDO');
});
t('MT-13 TRILHO POR VOLTA (rodada 19): à frente livre, virada de volta limpa tudo', () => {
  const refs = new Map([['A', { pontos: MELHOR }], ['B', { pontos: MELHOR }]]);
  const motor = new TrailCockpitMotor({ segments: [SEG_A, SEG_B], refs, storage: storageFake() });
  for (const seg of ['A', 'B']) {
    motor.evento({ type: 'passagem-fechada', segmentId: seg, pontos: MELHOR });
    motor.evento({ type: 'passagem-fechada', segmentId: seg, pontos: MELHOR });
  }
  motor.setVoltaAtual(3); // volta nova: nasce limpa
  assert.deepEqual(motor.trilho().map(l => l.celulas), [[], []], 'volta nova: tudo livre');
  // passou A nesta volta: A preenche, B (à frente) segue LIVRE
  motor.evento({ type: 'passagem-fechada', segmentId: 'A', pontos: passagem(perfilMelhor) });
  assert.deepEqual(motor.trilho().find(l => l.segId === 'A').celulas, ['certo']);
  assert.deepEqual(motor.trilho().find(l => l.segId === 'B').celulas, [], 'trecho à frente fica livre');
  // virada de volta: limpa de novo
  motor.setVoltaAtual(4);
  assert.deepEqual(motor.trilho().map(l => l.celulas), [[], []]);
});
t('MT-14 freando: tela responde (verde na margem) e manda a correção (rodada 19)', () => {
  const motor = new TrailCockpitMotor({ segments: [SEG_A, SEG_B], refs: refsMap(), storage: storageFake() });
  motor.evento({ type: 'passagem-fechada', segmentId: 'B', pontos: MELHOR });
  motor.evento({ type: 'passagem-fechada', segmentId: 'B', pontos: MELHOR });
  motor.evento({ type: 'saida-cruzou', segmentId: 'A', kmh: 100 });
  let t = roda(motor, -300, 0, 100);
  motor.evento({ type: 'entrada-cruzou', segmentId: 'B', kmh: 100, t });
  // freia seguindo a melhor → dentro da margem: tela verde, sem correção
  for (let m = 3; m <= 120; m += 3) {
    const kmh = perfilMelhor(m);
    t += (3 / (kmh / 3.6)) * 1000;
    motor.gps({ lat: m * M2DEG, lng: 0, kmh, t });
  }
  const dentro = motor.snapshot();
  assert.equal(dentro.bandaEstado, 'dentro', 'na margem: tela verde piscando');
  assert.equal(dentro.freioCorrecao, null, 'na margem não há correção');
  // solta tudo de uma vez (velocidade constante) → fora, freio DE MENOS → APERTA
  for (let m = 123; m <= 150; m += 3) {
    t += (3 / (perfilMelhor(120) / 3.6)) * 1000;
    motor.gps({ lat: m * M2DEG, lng: 0, kmh: perfilMelhor(120), t });
  }
  const fora = motor.snapshot();
  assert.equal(fora.bandaEstado, 'fora', 'fora da margem: tela vermelha piscando');
  assert.equal(fora.freioCorrecao, 'aperta', 'freio de menos → APERTA');
});
t('MT-07 trilho marca trecho atual; calibrando = só quem não tem base (rodada 20)', () => {
  const motor = new TrailCockpitMotor({ segments: [SEG_A, SEG_B], refs: refsMap(), storage: storageFake() });
  motor.evento({ type: 'entrada-cruzou', segmentId: 'B', kmh: 100, t: 1 });
  const linhas = motor.trilho();
  assert.equal(linhas.find(l => l.segId === 'B').atual, true);
  assert.equal(linhas.find(l => l.segId === 'A').calibrando, true, 'A sem base = calibrando');
  assert.equal(linhas.find(l => l.segId === 'B').calibrando, false, 'B com base guardada = pronto, sem esperar volta');
});
t('MT-08 apex ao vivo: entrada e saída comparadas com a melhor', () => {
  const motor = new TrailCockpitMotor({ segments: [SEG_A, SEG_B], refs: refsMap(), storage: storageFake() });
  motor.evento({ type: 'passagem-fechada', segmentId: 'B', pontos: MELHOR });
  motor.evento({ type: 'passagem-fechada', segmentId: 'B', pontos: MELHOR });
  motor.evento({ type: 'saida-cruzou', segmentId: 'A', kmh: 100 });
  roda(motor, -300, -3, 100);
  motor.evento({ type: 'entrada-cruzou', segmentId: 'B', kmh: 99, t: 5 });
  assert.equal(motor.snapshot().apex.entrada.valor, '99');
  assert.equal(motor.snapshot().apex.entrada.estado, 'ok-melhor'); // ≥ 100−2
  motor.evento({ type: 'saida-cruzou', segmentId: 'B', kmh: 60, t: 9 });
  assert.equal(motor.snapshot().apex.saida.estado, 'ok-pior'); // bem abaixo da melhor
  assert.equal(motor.snapshot().fase, 'veredito');
});

t('MT-09 volta com DOIS trechos armados: ciclo fecha e a aproximação do próximo arma', () => {
  const refs = new Map([['A', { pontos: MELHOR }], ['B', { pontos: MELHOR }]]);
  const motor = new TrailCockpitMotor({ segments: [SEG_A, SEG_B], refs, storage: storageFake() });
  for (const seg of ['A', 'B']) {
    motor.evento({ type: 'passagem-fechada', segmentId: seg, pontos: MELHOR });
    motor.evento({ type: 'passagem-fechada', segmentId: seg, pontos: MELHOR });
  }
  motor.evento({ type: 'saida-cruzou', segmentId: 'A', kmh: 100 });
  let t = roda(motor, -300, 0, 100);
  assert.equal(motor.snapshot().fase, 'aproxima');
  motor.evento({ type: 'entrada-cruzou', segmentId: 'B', kmh: 100, t });
  for (let m = 3; m <= 160; m += 3) { // freia em B seguindo a melhor
    const kmh = perfilMelhor(m);
    t += (3 / (kmh / 3.6)) * 1000;
    motor.gps({ lat: m * M2DEG, lng: 0, kmh, t });
  }
  motor.evento({ type: 'saida-cruzou', segmentId: 'B', kmh: 80, t });
  motor.evento({ type: 'passagem-fechada', segmentId: 'B', pontos: passagem(perfilMelhor) });
  assert.equal(motor.snapshot().fase, 'veredito');
  // reta B→A (a volta dá a volta): veredito termina a 40%, aproximação de A arma na metade
  t = roda(motor, 163, 250, 100, t);
  assert.equal(motor.snapshot().fase, 'fora', 'veredito tem fim — painel padrão volta');
  t = roda(motor, 253, 320, 100, t);
  assert.equal(motor.snapshot().fase, 'aproxima');
  assert.equal(motor.snapshot().segAlvoId, 'A', 'próximo alvo é o trecho A (volta fechou)');
});
t('MT-10 aproximação sem pisada: saída limpa contagem e luzes, veredito entra', () => {
  const motor = new TrailCockpitMotor({ segments: [SEG_A, SEG_B], refs: refsMap(), storage: storageFake() });
  motor.evento({ type: 'passagem-fechada', segmentId: 'B', pontos: MELHOR });
  motor.evento({ type: 'passagem-fechada', segmentId: 'B', pontos: MELHOR });
  motor.evento({ type: 'saida-cruzou', segmentId: 'A', kmh: 100 });
  let t = roda(motor, -300, 0, 100);
  motor.evento({ type: 'entrada-cruzou', segmentId: 'B', kmh: 100, t });
  t = roda(motor, 3, 99, 100, t); // atravessa SEM frear: contagem vermelha 'passou'
  assert.equal(motor.snapshot().contagem.modo, 'passou');
  motor.evento({ type: 'saida-cruzou', segmentId: 'B', kmh: 100, t });
  assert.equal(motor.snapshot().fase, 'veredito');
  assert.equal(motor.snapshot().contagem, null, 'contagem não fica por cima do veredito');
  assert.equal(motor.snapshot().nivelLuz, 0);
});
t('MT-11 entrada em OUTRO trecho com janela aberta abandona a janela', () => {
  const motor = new TrailCockpitMotor({ segments: [SEG_A, SEG_B], refs: refsMap(), storage: storageFake() });
  motor.evento({ type: 'passagem-fechada', segmentId: 'B', pontos: MELHOR });
  motor.evento({ type: 'passagem-fechada', segmentId: 'B', pontos: MELHOR });
  motor.evento({ type: 'saida-cruzou', segmentId: 'A', kmh: 100 });
  roda(motor, -300, -120, 100);
  assert.equal(motor.snapshot().fase, 'aproxima');
  motor.evento({ type: 'entrada-cruzou', segmentId: 'A', kmh: 100, t: 1 }); // desvio/box/resync
  assert.equal(motor.snapshot().fase, 'fora', 'janela órfã não fica viva');
  assert.equal(motor.snapshot().contagem, null);
});
t('MT-12 passagem RALA não vira célula no trilho nem conta calibração', () => {
  const motor = new TrailCockpitMotor({ segments: [SEG_B], refs: refsMap(), storage: storageFake() });
  const efeitos = [];
  motor.onEfeito(e => efeitos.push(e));
  motor.evento({ type: 'passagem-fechada', segmentId: 'B', pontos: MELHOR.slice(0, 3) });
  assert.equal(motor.passagensDoTrecho('B'), 0, 'passagem de 3 pontos não calibra');
  assert.equal(efeitos.filter(e => e.tipo === 'veredito').length, 0, 'sem juízo sem dado');
  assert.deepEqual(motor.trilho().find(l => l.segId === 'B').celulas, []);
});

// ── Reação aprendida ──
t('RE-01 default 0,25 s sem histórico', () => {
  const motor = new TrailCockpitMotor({ segments: [SEG_B], refs: refsMap(), storage: storageFake() });
  assert.equal(motor.reacaoS('B'), TRAIL_DEFAULTS.reacaoDefaultS);
});
t('RE-02 EMA aproxima da amostra; clamps respeitados', () => {
  const motor = new TrailCockpitMotor({ segments: [SEG_B], refs: refsMap(), storage: storageFake() });
  motor.registrarAmostraReacao('B', 0.40);
  assert.equal(motor.reacaoS('B'), 0.40);
  motor.registrarAmostraReacao('B', 0.20);
  assert.ok(Math.abs(motor.reacaoS('B') - 0.35) < 0.001, `EMA 0,25: ${motor.reacaoS('B')}`);
  motor.registrarAmostraReacao('B', 5.0); // > teto de amostra → descartada
  assert.ok(Math.abs(motor.reacaoS('B') - 0.35) < 0.001, 'amostra absurda não entra');
  motor.registrarAmostraReacao('B', 0.01); // abaixo do piso → clampa em 0,10
  assert.ok(motor.reacaoS('B') >= TRAIL_DEFAULTS.reacaoMinS);
});
t('RE-03 reação persiste e recarrega do armazenamento', () => {
  const st = storageFake();
  const m1 = new TrailCockpitMotor({ segments: [SEG_B], refs: refsMap(), storage: st });
  m1.registrarAmostraReacao('B', 0.33);
  const m2 = new TrailCockpitMotor({ segments: [SEG_B], refs: refsMap(), storage: st });
  assert.equal(m2.reacaoS('B'), 0.33);
});
t('RE-05 ciclo fechado: zero dispara, piloto reage, amostra plausível aprendida e persistida', () => {
  const st = storageFake();
  const motor = new TrailCockpitMotor({ segments: [SEG_A, SEG_B], refs: refsMap(), storage: st });
  motor.evento({ type: 'passagem-fechada', segmentId: 'B', pontos: MELHOR });
  motor.evento({ type: 'passagem-fechada', segmentId: 'B', pontos: MELHOR });
  const efeitos = [];
  motor.onEfeito(e => efeitos.push(e));
  motor.evento({ type: 'saida-cruzou', segmentId: 'A', kmh: 100 });
  let t = roda(motor, -300, 0, 100);
  motor.evento({ type: 'entrada-cruzou', segmentId: 'B', kmh: 100, t });
  // segue plano até 89 m (zero dispara ~80 m) e SÓ ENTÃO freia forte:
  // reação planejada ≈ 9 m a 27,8 m/s ≈ 0,32 s
  for (let m = 3; m <= 160; m += 3) {
    const kmh = m < 89 ? 100 : Math.max(45, 100 - (m - 89) * 2.2);
    t += (3 / (kmh / 3.6)) * 1000;
    motor.gps({ lat: m * M2DEG, lng: 0, kmh, t });
  }
  const zero = efeitos.find(e => e.tipo === 'zero');
  const pisou = efeitos.find(e => e.tipo === 'pisou');
  assert.ok(zero && pisou, 'zero e pisou aconteceram');
  assert.ok(pisou.amostraReacaoS != null, 'reação virou amostra');
  assert.ok(pisou.amostraReacaoS > 0.15 && pisou.amostraReacaoS < 0.65,
    `amostra plausível, sem viés grosso de detecção (${pisou.amostraReacaoS?.toFixed(2)} s)`);
  assert.ok(st._m.get('p1fast-trail-reacao-v1'), 'aprendizagem persistida');
});
t('RE-04 amostra negativa/zero (pisou antes do zero) não aprende', () => {
  const motor = new TrailCockpitMotor({ segments: [SEG_B], refs: refsMap(), storage: storageFake() });
  assert.equal(motor.registrarAmostraReacao('B', 0), null);
  assert.equal(motor.registrarAmostraReacao('B', -0.2), null);
  assert.equal(motor.reacaoS('B'), TRAIL_DEFAULTS.reacaoDefaultS);
});

// ── Pintura fora da banda ──
t('FB-01 soltar de uma vez ao vivo → fora-da-banda dispara e encerra', () => {
  const motor = new TrailCockpitMotor({ segments: [SEG_A, SEG_B], refs: refsMap(), storage: storageFake() });
  motor.evento({ type: 'passagem-fechada', segmentId: 'B', pontos: MELHOR });
  motor.evento({ type: 'passagem-fechada', segmentId: 'B', pontos: MELHOR });
  const efeitos = [];
  motor.onEfeito(e => efeitos.push(e));
  motor.evento({ type: 'saida-cruzou', segmentId: 'A', kmh: 100 });
  let t = roda(motor, -300, -3, 100);
  motor.evento({ type: 'entrada-cruzou', segmentId: 'B', kmh: 100, t });
  // pancada igual à melhor até 110 m, depois SOLTA (velocidade constante)
  for (let m = 0; m <= 160; m += 3) {
    const kmh = m < 110 ? perfilMelhor(m) : perfilMelhor(110);
    t += (3 / (kmh / 3.6)) * 1000;
    motor.gps({ lat: m * M2DEG, lng: 0, kmh, t });
  }
  assert.ok(efeitos.some(e => e.tipo === 'fora-da-banda'), 'tela tem que piscar vermelho');
});

console.log(`\ntrail-cockpit: ${ok} ok / ${fail} fail`);
if (fail > 0) process.exit(1);
