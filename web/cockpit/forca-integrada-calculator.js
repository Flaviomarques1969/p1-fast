// forca-integrada-calculator.js — calcula ponto ótimo de troca usando
// "força trativa integrada com tempo de troca modelado".
//
// Recomendação 1 do auditor (engenheiro de competição sênior, 2026-05-29):
// O critério antigo (`dyno-target-calculator.js`) usa só "cruzamento de
// potência" — sem modelar o tempo de troca em si. Câmbio H amador (Celta)
// custa 0,4-0,8s sem tração por troca. Em volta de 2:40 com 6-8 trocas, são
// 3-5s perdidos só em câmbio.
//
// Este módulo modela:
//   1. Força trativa por marcha em cada RPM.
//   2. Tempo de troca (0,5s default Celta H, configurável).
//   3. Integral da força ao longo de uma janela de tempo após a troca.
//   4. Comparação: trocar AGORA vs ESTICAR MAIS X rpm (qual integra mais).
//
// Resultado: RPM ótimo de troca por marcha, considerando que durante a
// troca em si a força é zero (tração interrompida).

const DEFAULTS = Object.freeze({
  tempoTrocaS:           0.500,  // 0,5s — câmbio H mão humana sem cut
  eficienciaTransmissao: 0.92,   // 92% — perda típica câmbio + diferencial
  massaCarroKg:          1050,   // Celta 1.4 + piloto + combustível
  janelaAvaliacaoS:      2.0,    // 2s após troca pra integrar força
  passoSimulacaoS:       0.05,   // 50ms granularidade da integração
});

/**
 * Interpola potência (CV) em um RPM específico dentro da curva.
 * Curva vem de dyno_curve no banco: [{rpm, potencia_cv, torque_nm}, ...]
 */
function interpolarPotencia(curva, rpm) {
  if (!Array.isArray(curva) || curva.length === 0) return 0;
  const ordenada = curva.slice().sort((a, b) => a.rpm - b.rpm);
  if (rpm <= ordenada[0].rpm) return Number(ordenada[0].potencia_cv) || 0;
  const last = ordenada[ordenada.length - 1];
  if (rpm >= last.rpm) return Number(last.potencia_cv) || 0;
  for (let i = 1; i < ordenada.length; i++) {
    if (ordenada[i].rpm >= rpm) {
      const a = ordenada[i - 1];
      const b = ordenada[i];
      const t = (rpm - a.rpm) / (b.rpm - a.rpm);
      return Number(a.potencia_cv) + t * (Number(b.potencia_cv) - Number(a.potencia_cv));
    }
  }
  return 0;
}

/**
 * Calcula força trativa na roda (Newtons) a partir de potência e velocidade.
 * F = (P × 735,5 × eficiência) / V
 * (735,5 = W por CV; 1 CV = 735,5 W)
 *
 * @param {number} potenciaCv
 * @param {number} velocidadeMs (m/s — não km/h)
 * @param {number} eficiencia
 * @returns {number} força em Newtons
 */
function forcaTrativaN(potenciaCv, velocidadeMs, eficiencia) {
  if (velocidadeMs < 0.1) return 0; // evita divisão por zero
  return (potenciaCv * 735.5 * eficiencia) / velocidadeMs;
}

/**
 * Simula a aceleração do carro durante uma janela de tempo,
 * a partir de um RPM inicial em uma marcha específica.
 * Devolve a integral da força aplicada (distância acelerada).
 *
 * @param {Object} opts
 * @param {Array} opts.curva — curva do motor (rpm, potencia_cv)
 * @param {number} opts.rpmInicial
 * @param {number} opts.velocidadeInicialMs
 * @param {number} opts.razaoTransmissao — razão total (marcha × diferencial)
 * @param {number} opts.raioRodaM — raio da roda em metros (Bubi: 0,289)
 * @param {number} opts.janelaS
 * @param {number} opts.tempoTrocaS — tempo "morto" no início (se houver troca)
 * @param {number} opts.eficiencia
 * @param {number} opts.massaKg
 */
function integrarForcaNaJanela({
  curva, rpmInicial, velocidadeInicialMs, razaoTransmissao, raioRodaM,
  janelaS, tempoTrocaS, eficiencia, massaKg,
}) {
  let v = velocidadeInicialMs;
  let t = 0;
  let integralForca = 0;
  const passo = DEFAULTS.passoSimulacaoS;

  // Durante o tempo de troca, força é ZERO (tração interrompida)
  while (t < tempoTrocaS && t < janelaS) {
    // Carro só desacelera por arrasto leve (~10 N) — ignorado pra simplicidade
    t += passo;
  }

  // Após a troca, calcula RPM a partir da velocidade e razão
  while (t < janelaS) {
    // rpm = velocidade × razão_transmissao / (2π × raio) × 60
    const rpm = (v * razaoTransmissao / (2 * Math.PI * raioRodaM)) * 60;
    if (rpm < 1500) break; // motor abaixo do operacional
    if (rpm > 7000)  break; // motor explodiria

    const potencia = interpolarPotencia(curva, rpm);
    const forca = forcaTrativaN(potencia, v, eficiencia);

    integralForca += forca * passo;
    // a = F / m → Δv = a × dt
    v += (forca / massaKg) * passo;
    t += passo;
  }
  return integralForca; // Newton-segundos (impulso)
}

/**
 * Calcula o RPM ótimo de troca de uma marcha pra próxima, considerando
 * tempo de troca, eficiência e integral de força.
 *
 * Algoritmo:
 *   Pra cada RPM candidato (varrendo de baixo pra cima dentro da janela do modo):
 *     - Simula cenário A: trocar agora (entra na próxima marcha após tempo morto)
 *     - Simula cenário B: continuar na marcha atual mais 200 rpm e depois trocar
 *     - Compara integral de força nos dois cenários
 *     - Retorna o RPM onde cenário A começa a ganhar de cenário B
 *
 * @param {Object} opts
 * @param {Array}  opts.curva                — curva do motor
 * @param {number} opts.razaoMarchaAtual     — razão da marcha atual
 * @param {number} opts.razaoMarchaProxima   — razão da próxima marcha
 * @param {number} opts.diferencial          — relação final
 * @param {number} opts.raioRodaM            — raio da roda
 * @param {number} opts.janelaRpmMin         — RPM mínimo permitido pelo modo
 * @param {number} opts.janelaRpmMax         — RPM máximo permitido pelo modo
 * @param {Object} [opts.params]             — overrides de DEFAULTS
 * @returns {{rpmOtimo: number, ganhoEstimadoNs: number, confianca: number}}
 */
export function calcularPontoOtimoTroca({
  curva, razaoMarchaAtual, razaoMarchaProxima, diferencial, raioRodaM,
  janelaRpmMin, janelaRpmMax, params = {},
}) {
  const p = { ...DEFAULTS, ...params };

  if (!Array.isArray(curva) || curva.length < 5) {
    return { rpmOtimo: Math.round((janelaRpmMin + janelaRpmMax) / 2), ganhoEstimadoNs: 0, confianca: 0 };
  }

  const razaoTotalAtual   = razaoMarchaAtual   * diferencial;
  const razaoTotalProxima = razaoMarchaProxima * diferencial;

  let melhorRpm = janelaRpmMin;
  let melhorGanho = -Infinity;

  for (let rpm = janelaRpmMin; rpm <= janelaRpmMax; rpm += 25) {
    // Velocidade atual nessa marcha nesse rpm
    const vMs = (rpm / 60) * (2 * Math.PI * raioRodaM) / razaoTotalAtual;

    // Cenário A: trocar agora → entra na próxima marcha após 0,5s
    const integralA = integrarForcaNaJanela({
      curva, rpmInicial: rpm, velocidadeInicialMs: vMs,
      razaoTransmissao: razaoTotalProxima, raioRodaM,
      janelaS:     p.janelaAvaliacaoS,
      tempoTrocaS: p.tempoTrocaS,
      eficiencia:  p.eficienciaTransmissao,
      massaKg:     p.massaCarroKg,
    });

    // Cenário B: ficar nessa marcha (sem trocar) por mais tempo
    const integralB = integrarForcaNaJanela({
      curva, rpmInicial: rpm, velocidadeInicialMs: vMs,
      razaoTransmissao: razaoTotalAtual, raioRodaM,
      janelaS:     p.janelaAvaliacaoS,
      tempoTrocaS: 0, // sem troca
      eficiencia:  p.eficienciaTransmissao,
      massaKg:     p.massaCarroKg,
    });

    const ganho = integralA - integralB;
    if (ganho > melhorGanho) {
      melhorGanho = ganho;
      melhorRpm = rpm;
    }
  }

  // Se nenhum RPM da janela favorece trocar, força no teto
  // (auditor: "com Wide Ratio em câmbio amador, todas as trocas vão pra perto do redline")
  if (melhorGanho < 0) {
    melhorRpm = janelaRpmMax;
  }

  return {
    rpmOtimo: Math.round(melhorRpm),
    ganhoEstimadoNs: Math.round(melhorGanho),
    confianca: melhorGanho > 0 ? Math.min(1, Math.abs(melhorGanho) / 1000) : 0.3,
  };
}

/**
 * Estima o tempo de volta GANHO (segundos) trocando no RPM ótimo vs trocar
 * no fundo da janela. Ajuda a IA a explicar a recomendação ao chefe.
 */
export function estimarGanhoVoltaS({ ganhoEstimadoNs, massaKg = DEFAULTS.massaCarroKg }) {
  // Ganho de velocidade aproximado por troca: Δv = impulso / massa
  const deltaV = ganhoEstimadoNs / massaKg; // m/s
  // 6 trocas por volta tipicas
  return Number(((deltaV * 6) / 10).toFixed(2)); // aproximação grossa
}
