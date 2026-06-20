// node-smoke-t3000-religacao.mjs — smoke da ROBUSTEZ do leitor T3000:
// filtro de sanidade + religação automática por trava silenciosa.
//
// O loop real vive em web/cockpit/main-t3000.js, que importa Supabase via
// esm.sh e WebUSB — não roda em Node puro. Este smoke reproduz FIELMENTE a
// máquina de estados dos contadores (t3.blocosCurtos / t3.leiturasRuins) e o
// filtro, usando a MESMA função pura leituraPlausivel do parser, pra provar:
//   1) dado bom segue o caminho feliz e zera contadores;
//   2) amostra fora de faixa NÃO publica e SEGURA o último valor bom;
//   3) N blocos curtos seguidos forçam religação;
//   4) N leituras inválidas seguidas (tranco da partida) forçam religação;
//   5) um dado bom no meio zera o contador e adia a religação.

import { leituraPlausivel } from '../web/cockpit/t3000-usb-parser.js';

let ok = 0, fail = 0;
const test = (name, fn) => {
  try { fn(); console.log(`  ✓ ${name}`); ok++; }
  catch (e) { console.log(`  ✗ ${name}\n    ${e.message}`); fail++; }
};
const assert = (cond, msg) => { if (!cond) throw new Error(msg || 'assert falhou'); };
const assertEq = (a, b, msg) => assert(a === b, `${msg||''}: esperado ${JSON.stringify(b)}, recebeu ${JSON.stringify(a)}`);

console.log('\n=== T3000 robustez (sanidade + religação) ===');

// Constantes ESPELHADAS de main-t3000.js (mantenha em sincronia).
const T3_MAX_BLOCOS_CURTOS = 30;
const T3_MAX_LEITURAS_RUINS = 8;

// Réplica fiel da máquina de estados do runReadLoop quanto a contadores/filtro.
// Não testa USB/Supabase — testa a LÓGICA de decisão.
function criarLeitorSimulado() {
  const t3 = { blocosCurtos: 0, leiturasRuins: 0, lastSampleTs: 0 };
  let religacoes = 0;
  let publicados = 0;
  let ultimoValorBomRpm = null; // "tela" — só atualiza com dado bom
  let now = 1000;

  function religar() { religacoes++; t3.blocosCurtos = 0; t3.leiturasRuins = 0; }

  // processa um "ciclo" do loop: total = bytes do bloco; sample = amostra parseada (ou null)
  function ciclo({ total, sample }) {
    now += 50;
    if (total < 92) {
      t3.blocosCurtos++;
      if (t3.blocosCurtos >= T3_MAX_BLOCOS_CURTOS) {
        t3.blocosCurtos = 0;
        religar();
      }
      return;
    }
    if (sample && leituraPlausivel(sample).ok) {
      publicados++;
      ultimoValorBomRpm = sample.rpm;
      t3.lastSampleTs = now;
      t3.blocosCurtos = 0;
      t3.leiturasRuins = 0;
    } else if (sample) {
      t3.leiturasRuins++;
      // NÃO publica, NÃO atualiza lastSampleTs, NÃO toca em ultimoValorBomRpm.
      if (t3.leiturasRuins >= T3_MAX_LEITURAS_RUINS) {
        t3.leiturasRuins = 0;
        religar();
      }
    }
  }

  return {
    ciclo,
    get religacoes() { return religacoes; },
    get publicados() { return publicados; },
    get ultimoValorBomRpm() { return ultimoValorBomRpm; },
    get lastSampleTs() { return t3.lastSampleTs; },
    state: t3,
  };
}

const bom = (rpm) => ({ rpm, batteryV: 13, waterTempC: 60, lambda: 0.85, speedKmh: 80,
                        tpsPct: 20, pedalAceleradorPct: 20, pedalFreioPct: 0, mapBar: 0.5, airTempC: 30 });
const ruim = () => ({ rpm: 65535, batteryV: 0, waterTempC: 470, lambda: 0.01, speedKmh: 9999 });

// 1) Dado bom: publica e atualiza a tela
test('dado bom publica, atualiza a tela e o lastSampleTs', () => {
  const L = criarLeitorSimulado();
  L.ciclo({ total: 460, sample: bom(4000) });
  assertEq(L.publicados, 1);
  assertEq(L.ultimoValorBomRpm, 4000);
  assert(L.lastSampleTs > 0, 'lastSampleTs deve avançar');
  assertEq(L.religacoes, 0);
});

// 2) Inválido NÃO publica e SEGURA o último valor bom
test('amostra inválida não publica e segura o último valor bom', () => {
  const L = criarLeitorSimulado();
  L.ciclo({ total: 460, sample: bom(3500) }); // tela = 3500
  const tsBom = L.lastSampleTs;
  L.ciclo({ total: 460, sample: ruim() });     // lixo
  assertEq(L.publicados, 1, 'lixo não pode publicar');
  assertEq(L.ultimoValorBomRpm, 3500, 'tela segura o último bom');
  assertEq(L.lastSampleTs, tsBom, 'lastSampleTs NÃO avança com lixo (watchdog acende)');
});

// 3) N blocos curtos seguidos religam
test(`${T3_MAX_BLOCOS_CURTOS} blocos curtos seguidos forçam 1 religação`, () => {
  const L = criarLeitorSimulado();
  for (let i = 0; i < T3_MAX_BLOCOS_CURTOS; i++) L.ciclo({ total: 0, sample: null });
  assertEq(L.religacoes, 1);
  assertEq(L.state.blocosCurtos, 0, 'contador zera após religar');
});

// 4) N leituras inválidas seguidas (tranco da partida) religam
test(`${T3_MAX_LEITURAS_RUINS} leituras inválidas seguidas forçam 1 religação`, () => {
  const L = criarLeitorSimulado();
  for (let i = 0; i < T3_MAX_LEITURAS_RUINS; i++) L.ciclo({ total: 460, sample: ruim() });
  assertEq(L.religacoes, 1);
  assertEq(L.publicados, 0);
  assertEq(L.state.leiturasRuins, 0, 'contador zera após religar');
});

// 5) Dado bom no meio zera o contador e adia a religação
test('um dado bom no meio zera o contador de inválidas', () => {
  const L = criarLeitorSimulado();
  for (let i = 0; i < T3_MAX_LEITURAS_RUINS - 1; i++) L.ciclo({ total: 460, sample: ruim() });
  assertEq(L.state.leiturasRuins, T3_MAX_LEITURAS_RUINS - 1);
  L.ciclo({ total: 460, sample: bom(2000) }); // bom no meio
  assertEq(L.state.leiturasRuins, 0, 'bom zera o contador');
  assertEq(L.religacoes, 0, 'não pode ter religado');
  // agora precisa de N inteiros de novo
  for (let i = 0; i < T3_MAX_LEITURAS_RUINS - 1; i++) L.ciclo({ total: 460, sample: ruim() });
  assertEq(L.religacoes, 0, 'ainda não atingiu o limite após o reset');
});

// 6) Bloco curto que NÃO chega ao limite não religa
test('poucos blocos curtos não religam', () => {
  const L = criarLeitorSimulado();
  for (let i = 0; i < T3_MAX_BLOCOS_CURTOS - 1; i++) L.ciclo({ total: 10, sample: null });
  assertEq(L.religacoes, 0);
  assertEq(L.state.blocosCurtos, T3_MAX_BLOCOS_CURTOS - 1);
});

console.log(`\n=== ${ok} ok / ${fail} fail ===\n`);
if (fail > 0) process.exit(1);
