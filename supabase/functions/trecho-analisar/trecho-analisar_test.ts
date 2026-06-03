// ═══════════════════════════════════════════════════════════
// trecho-analisar_test.ts — testes Deno do Bloco 3
// 2026-05-18.
// ═══════════════════════════════════════════════════════════
// Rodar com:
//   cd supabase/functions/trecho-analisar
//   deno test --allow-net trecho-analisar_test.ts
//
// Cobre 12 cenários:
//   • DynoCurve TS: interpolação + clamp + picos
//   • aceleracaoTeorica TS: bate com a versão Swift (mesmos defaults)
//   • Classificação: motor_abaixo, marcha_baixa, pedal_parcial,
//     cambio_escorregando, indeterminado
//   • Priorização ponderada: marcha_baixa antes de motor_abaixo com mesmo delta
//   • Motor caindo: detecta crescimento ≥ 30% em 3 stints
//   • Validação do body do POST

import {
  assertEquals,
  assert,
  assertAlmostEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import {
  torqueAt,
  powerHpAt,
  peakTorque,
  peakPower,
  CELTA_BUBI_2026_05_18,
} from "./dyno-curve.ts";

import {
  aceleracaoTeorica,
} from "./aceleracao-teorica.ts";

import {
  classificarCausa,
  AmostraTrecho,
  CarroConfig,
} from "./classificar-causa.ts";

import { priorizarTrechos } from "./priorizar-trecho.ts";
import { detectarMotorDecaindo, LeituraHistorica } from "./motor-decair.ts";
import { montarResposta, validar, celtaBubiCarroPadrao } from "./index.ts";

// ────────────────────────────────────────────────────────────
// Curva
// ────────────────────────────────────────────────────────────

Deno.test("DynoCurve: torqueAt em ponto exato (5200/162.1) e clamp", () => {
  assertAlmostEquals(torqueAt(CELTA_BUBI_2026_05_18, 5200), 162.1, 0.05);
  assertAlmostEquals(torqueAt(CELTA_BUBI_2026_05_18, 1000), -2.2, 0.05); // clamp inferior
  assertAlmostEquals(torqueAt(CELTA_BUBI_2026_05_18, 9000), 78.7, 0.05); // clamp superior

  assertAlmostEquals(powerHpAt(CELTA_BUBI_2026_05_18, 6050), 122.8, 0.05);

  const pt = peakTorque(CELTA_BUBI_2026_05_18);
  assert(pt !== null);
  assertAlmostEquals(pt!.rpm, 5200, 0.01);

  const pp = peakPower(CELTA_BUBI_2026_05_18);
  assert(pp !== null);
  assertAlmostEquals(pp!.rpm, 6050, 0.01);
});

Deno.test("DynoCurve: interpolação linear entre 5200 e 5250", () => {
  // Meio do caminho ≈ (162.1 + 160.5) / 2 = 161.3
  assertAlmostEquals(torqueAt(CELTA_BUBI_2026_05_18, 5225), 161.3, 0.05);
});

// ────────────────────────────────────────────────────────────
// Aceleração teórica (bate com Swift)
// ────────────────────────────────────────────────────────────

Deno.test("aceleracaoTeorica: 1ª/5200 RPM @ 50 km/h, 908 kg → ~10 m/s²", () => {
  const r = aceleracaoTeorica({
    rpm: 5200,
    relacaoMarcha: 3.92,
    relacaoFinal: 4.27,
    raioPneuM: 0.289,
    massaKg: 908,
    velocidadeKmh: 50,
    curva: CELTA_BUBI_2026_05_18,
  });
  assert(r !== null);
  assert(r!.aceleracaoMs2 > 9 && r!.aceleracaoMs2 < 12,
    `esperado 9-12, veio ${r!.aceleracaoMs2}`);
  assertAlmostEquals(r!.torqueMotorNm, 162.1, 0.1);
});

Deno.test("aceleracaoTeorica: nil pra params inválidos", () => {
  assertEquals(
    aceleracaoTeorica({
      rpm: 5000, relacaoMarcha: 0, relacaoFinal: 4.27,
      raioPneuM: 0.289, massaKg: 908, velocidadeKmh: 50,
      curva: CELTA_BUBI_2026_05_18,
    }),
    null
  );
  assertEquals(
    aceleracaoTeorica({
      rpm: 5000, relacaoMarcha: 3.92, relacaoFinal: 4.27,
      raioPneuM: 0, massaKg: 908, velocidadeKmh: 50,
      curva: CELTA_BUBI_2026_05_18,
    }),
    null
  );
});

// ────────────────────────────────────────────────────────────
// Classificação — 5 regras
// ────────────────────────────────────────────────────────────

function celtaParaTeste(): CarroConfig {
  return {
    relacoesMarcha: [3.92, 2.05, 1.36, 0.95, 0.76],
    relacaoFinal: 4.27,
    raioPneuM: 0.289,
    massaKg: 908,
    curva: CELTA_BUBI_2026_05_18,
  };
}

function amostra(t: number, vel: number, pedal: number, rpm: number, marcha: number, accReal: number): AmostraTrecho {
  return {
    t,
    velocidadeKmh: vel,
    pedalPct: pedal,
    rpm,
    marcha,
    aceleracaoRealMs2: accReal,
  };
}

Deno.test("classificarCausa: motor_abaixo — pedal 98% por 0.8s em 3ª/5500 RPM com real bem abaixo do teórico", () => {
  // 3ª/5500 RPM @ 100 km/h, real = 1 m/s² (cai do teórico ~3 m/s²)
  // RPM 5500 está acima de 80% × 5200 = 4160 → regra motor_abaixo válida
  const amostras: AmostraTrecho[] = [];
  for (let i = 0; i < 9; i++) {
    amostras.push(amostra(i * 0.1, 100, 98, 5500, 3, 1.0));
  }
  const r = classificarCausa(amostras, celtaParaTeste());
  assertEquals(r.causa, "motor_abaixo");
  assert(r.deltaAcumuladoMs2 > 0);
});

Deno.test("classificarCausa: pedal_parcial — pedal 70% por 0.5s em alta velocidade", () => {
  // Reta a 100 km/h, pedal 70%
  const amostras: AmostraTrecho[] = [];
  for (let i = 0; i < 6; i++) {
    amostras.push(amostra(i * 0.1, 100, 70, 5500, 4, 5.0));
  }
  const r = classificarCausa(amostras, celtaParaTeste());
  assertEquals(r.causa, "pedal_parcial");
});

Deno.test("classificarCausa: marcha_baixa — após Vmin com pedal 95% e RPM baixo (3000)", () => {
  // RPM 3000 = 57.7% do RPM do pico de torque (5200) → < 80%, regra ativa
  const amostras: AmostraTrecho[] = [];
  // velocidade subindo, pedal alto, RPM baixo em 1ª marcha
  amostras.push(amostra(0.0, 30, 100, 3000, 1, 5));
  for (let i = 1; i < 12; i++) {
    amostras.push(amostra(i * 0.15, 30 + i * 3, 100, 3000, 1, 5));
  }
  const r = classificarCausa(amostras, celtaParaTeste());
  assertEquals(r.causa, "marcha_baixa");
});

Deno.test("classificarCausa: cambio_escorregando — salto de 2000 RPM em 50 ms sem ΔV", () => {
  const amostras: AmostraTrecho[] = [
    amostra(0.0, 100, 80, 4500, 3, 4),
    amostra(0.05, 100.5, 80, 6500, 3, 4), // ΔRPM=2000 em 50ms, ΔV=0.5km/h
    amostra(0.10, 100.8, 80, 6500, 3, 4),
    amostra(0.20, 101, 80, 6400, 3, 4),
  ];
  const r = classificarCausa(amostras, celtaParaTeste());
  assertEquals(r.causa, "cambio_escorregando");
});

Deno.test("classificarCausa: indeterminado — tudo dentro do esperado", () => {
  // Carro entregando o que devia, pedal alto, marcha boa
  const amostras: AmostraTrecho[] = [];
  for (let i = 0; i < 5; i++) {
    // RPM 5200 (pico torque), pedal 100, real perto do teórico
    amostras.push(amostra(i * 0.1, 80, 100, 5200, 2, 8.5));
  }
  const r = classificarCausa(amostras, celtaParaTeste());
  assertEquals(r.causa, "indeterminado");
});

// ────────────────────────────────────────────────────────────
// Priorização ponderada
// ────────────────────────────────────────────────────────────

Deno.test("priorizarTrechos: marcha_baixa (peso 1.2) > motor_abaixo (peso 1.0) com mesmo delta", () => {
  const entradas = [
    {
      trechoId: "T1",
      classificacao: {
        causa: "motor_abaixo" as const,
        deltaAcumuladoMs2: 2.0,
        pedalMedioPct: 95,
        rpmMedio: 5000,
        evidencia: "motor",
      },
      tempoTrechoS: 5,
    },
    {
      trechoId: "T2",
      classificacao: {
        causa: "marcha_baixa" as const,
        deltaAcumuladoMs2: 2.0,
        pedalMedioPct: 95,
        rpmMedio: 3000,
        evidencia: "marcha",
      },
      tempoTrechoS: 5,
    },
  ];
  const r = priorizarTrechos(entradas);
  assertEquals(r[0].trechoId, "T2"); // marcha_baixa primeiro
  assertEquals(r[1].trechoId, "T1");
});

// ────────────────────────────────────────────────────────────
// Motor caindo
// ────────────────────────────────────────────────────────────

Deno.test("detectarMotorDecaindo: 3 leituras motor_abaixo com crescimento de 60% dispara pendência", () => {
  const historico: LeituraHistorica[] = [
    { evento: "e1", data: "2026-05-10T10:00:00Z", trechoId: "T1", causa: "motor_abaixo", deltaAcumuladoMs2: 1.0 },
    { evento: "e2", data: "2026-05-12T10:00:00Z", trechoId: "T1", causa: "motor_abaixo", deltaAcumuladoMs2: 1.3 },
    { evento: "e3", data: "2026-05-15T10:00:00Z", trechoId: "T1", causa: "motor_abaixo", deltaAcumuladoMs2: 1.6 },
  ];
  const r = detectarMotorDecaindo(historico);
  assertEquals(r.decaindo, true);
  assert(r.sugestaoPendencia !== null);
  assert(r.fatorCrescimento >= 1.30);
});

Deno.test("detectarMotorDecaindo: 3 leituras estáveis não disparam", () => {
  const historico: LeituraHistorica[] = [
    { evento: "e1", data: "2026-05-10T10:00:00Z", trechoId: "T1", causa: "motor_abaixo", deltaAcumuladoMs2: 1.0 },
    { evento: "e2", data: "2026-05-12T10:00:00Z", trechoId: "T1", causa: "motor_abaixo", deltaAcumuladoMs2: 1.05 },
    { evento: "e3", data: "2026-05-15T10:00:00Z", trechoId: "T1", causa: "motor_abaixo", deltaAcumuladoMs2: 1.10 },
  ];
  const r = detectarMotorDecaindo(historico);
  assertEquals(r.decaindo, false);
});

// ────────────────────────────────────────────────────────────
// Resposta integrada
// ────────────────────────────────────────────────────────────

Deno.test("montarResposta: trecho com pedal_parcial devolve cor amarela/vermelha e ganho > 0", () => {
  // 100 km/h em 4ª/5500 com pedal 70% e real 0.5 m/s² (carro entregou
  // bem menos do que poderia) — delta positivo gera ganho > 0.
  const amostras: AmostraTrecho[] = [];
  for (let i = 0; i < 6; i++) {
    amostras.push(amostra(i * 0.1, 100, 70, 5500, 4, 0.5));
  }
  const resposta = montarResposta({
    trechoId: "T1",
    amostras,
    identificacao: { carroId: "c1", configId: "cfg1", pilotoId: "p1", eventoId: "ev1" },
    carro: celtaBubiCarroPadrao(),
  });
  assertEquals(resposta.causaProvavel, "pedal_parcial");
  assert(resposta.cor === "amarelo" || resposta.cor === "vermelho");
  assert(resposta.topOportunidade.ganhoEstimadoSeg > 0);
});

// ────────────────────────────────────────────────────────────
// Blocos especializados — Lambda · PAce · Motor Health · Cadeia
// ────────────────────────────────────────────────────────────

Deno.test("montarResposta · BLOCO LAMBDA — sem T4000 devolve sem_dado com lambda alvo coerente com tipo de trecho", () => {
  const amostras: AmostraTrecho[] = [];
  for (let i = 0; i < 5; i++) amostras.push(amostra(i * 0.1, 80, 100, 0, 0, 5)); // rpm=0/marcha=0 = sem T4000

  const respReta = montarResposta({
    trechoId: "T1", amostras,
    identificacao: { carroId: "c1", configId: "cfg1", pilotoId: "p1", eventoId: "ev1" },
    carro: celtaBubiCarroPadrao(),
    tipoTrecho: "Reta",
  });
  assertEquals(respReta.lambda.estadoMistura, "sem_dado");
  assertEquals(respReta.lambda.lambdaMedida, null);
  assertEquals(respReta.lambda.lambdaAlvo, 0.88); // reta → alvo 0.88

  const respCurva = montarResposta({
    trechoId: "T1", amostras,
    identificacao: { carroId: "c1", configId: "cfg1", pilotoId: "p1", eventoId: "ev1" },
    carro: celtaBubiCarroPadrao(),
    tipoTrecho: "Curva",
  });
  assertEquals(respCurva.lambda.lambdaAlvo, 0.92); // curva → alvo 0.92
});

Deno.test("montarResposta · BLOCO PAce — sem T4000 devolve nulos mas mantém TDI esperado", () => {
  const amostras: AmostraTrecho[] = [];
  for (let i = 0; i < 5; i++) amostras.push(amostra(i * 0.1, 80, 100, 0, 0, 5));

  const resp = montarResposta({
    trechoId: "T1", amostras,
    identificacao: { carroId: "c1", configId: "cfg1", pilotoId: "p1", eventoId: "ev1" },
    carro: celtaBubiCarroPadrao(),
    tipoTrecho: "Reta",
  });
  assertEquals(resp.pace.torqueEntregueNm, null);
  assertEquals(resp.pace.torqueEsperadoNm, null);
  assertEquals(resp.pace.tdiAtual, null);
  assertEquals(resp.pace.tdiEsperado, 0.95);
});

Deno.test("montarResposta · BLOCO PAce — com T4000 calcula TDI a partir da aceleração real vs curva do dyno", () => {
  // Cenário: 1ª/5200 RPM, 50 km/h, aceleração real 9 m/s² (próximo do teórico ~10)
  // Esperado: TDI próximo de 0.9, torqueEntregue/torqueEsperado calculados.
  const amostras: AmostraTrecho[] = [];
  for (let i = 0; i < 5; i++) amostras.push(amostra(i * 0.1, 50, 100, 5200, 1, 9));

  const resp = montarResposta({
    trechoId: "T1", amostras,
    identificacao: { carroId: "c1", configId: "cfg1", pilotoId: "p1", eventoId: "ev1" },
    carro: celtaBubiCarroPadrao(),
    tipoTrecho: "Aceleração",
  });
  assert(resp.pace.torqueEntregueNm !== null, "torqueEntregueNm não pode ser nulo");
  assert(resp.pace.torqueEsperadoNm !== null, "torqueEsperadoNm não pode ser nulo");
  assert(resp.pace.tdiAtual !== null);
  assert(resp.pace.tdiAtual! > 0.5 && resp.pace.tdiAtual! < 1.2,
    `TDI esperado entre 0.5 e 1.2, veio ${resp.pace.tdiAtual}`);
});

Deno.test("montarResposta · BLOCO MOTOR HEALTH — distribuição de RPM por faixa de 500", () => {
  // 10 amostras em 5200 RPM (banda 5000-5500), 5 em 6500 (banda 6500-7000)
  const amostras: AmostraTrecho[] = [];
  for (let i = 0; i < 10; i++) amostras.push(amostra(i * 0.05, 100, 90, 5200, 3, 4));
  for (let i = 0; i < 5; i++) amostras.push(amostra(0.5 + i * 0.05, 130, 90, 6500, 3, 4));

  const resp = montarResposta({
    trechoId: "T1", amostras,
    identificacao: { carroId: "c1", configId: "cfg1", pilotoId: "p1", eventoId: "ev1" },
    carro: celtaBubiCarroPadrao(),
  });
  assert(resp.motorHealth.distribuicaoFaixasRpm !== null);
  const dist = resp.motorHealth.distribuicaoFaixasRpm!;
  assertEquals(dist.length, 11, "11 faixas de 500 RPM");
  assertEquals(dist[7], 10, "faixa 5000-5500 deve ter as 10 amostras de 5200");
  assertEquals(dist[10], 5, "faixa 6500-7000 deve ter as 5 amostras de 6500");
  assertEquals(resp.motorHealth.picosAcimaTeto, 5, "5 amostras acima de 6350");
  assert(resp.motorHealth.fracaoNaBandaIdeal !== null);
  assert(resp.motorHealth.fracaoNaBandaIdeal! > 0.6, "10/15 dentro da banda = ~0.67");
});

Deno.test("montarResposta · BLOCO MOTOR HEALTH — sem T4000 (RPM=0) devolve nulos", () => {
  const amostras: AmostraTrecho[] = [];
  for (let i = 0; i < 5; i++) amostras.push(amostra(i * 0.1, 80, 100, 0, 0, 5));

  const resp = montarResposta({
    trechoId: "T1", amostras,
    identificacao: { carroId: "c1", configId: "cfg1", pilotoId: "p1", eventoId: "ev1" },
    carro: celtaBubiCarroPadrao(),
  });
  assertEquals(resp.motorHealth.rpmMedio, null);
  assertEquals(resp.motorHealth.distribuicaoFaixasRpm, null);
});

Deno.test("montarResposta · BLOCO CADEIA — propaga contadores recebidos do banco", () => {
  const amostras: AmostraTrecho[] = [amostra(0, 80, 100, 5200, 3, 5)];
  const resp = montarResposta({
    trechoId: "T1", amostras,
    identificacao: { carroId: "c1", configId: "cfg1", pilotoId: "p1", eventoId: "ev1" },
    carro: celtaBubiCarroPadrao(),
    cadeia: { engenheiro: 2, equipe: 1, injecao: 0 },
  });
  assertEquals(resp.cadeia.engenheiro, 2);
  assertEquals(resp.cadeia.equipe, 1);
  assertEquals(resp.cadeia.injecao, 0);

  const sem = montarResposta({
    trechoId: "T1", amostras,
    identificacao: { carroId: "c1", configId: "cfg1", pilotoId: "p1", eventoId: "ev1" },
    carro: celtaBubiCarroPadrao(),
  });
  assertEquals(sem.cadeia.engenheiro, 0);
});

Deno.test("validar: rejeita body sem trechoId / sem amostras / sem identificacao", () => {
  assertEquals(validar(null).ok, false);
  assertEquals(validar({ trechoId: "", amostras: [], identificacao: {}, carro: {} }).ok, false);
  assertEquals(validar({ trechoId: "T1", amostras: [], identificacao: {}, carro: {} }).ok, false);
  assertEquals(
    validar({ trechoId: "T1", amostras: [{}], identificacao: { carroId: "c" }, carro: {} }).ok,
    true
  );
});
