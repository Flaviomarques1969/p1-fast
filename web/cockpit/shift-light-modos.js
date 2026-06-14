// shift-light-modos.js — definição canônica dos 3 modos do shift light.
//
// Decisão Flávio 2026-05-29 após auditoria de engenheiro de competição sênior:
// Janelas RECALIBRADAS pra curva real do Bubi (não chutadas).
//
// Bubi: pico HP 6.050 / pico torque 5.200 / redline 6.300 / limite 6.350.
// Auditor: "Conservador 5.700-6.000 trocava ANTES do pico de potência — não
// era conservador, era desperdiçar HP". Bandas reescritas conforme recomendação.
//
// Esses 3 modos formam o ENVELOPE que a IA respeita ao escolher o ponto
// exato de troca em cada trecho da pista. IA opera SOMENTE dentro da janela.

export const ModoStint = Object.freeze({
  DURABILIDADE: 'durabilidade',
  NORMAL:       'normal',
  AGRESSIVO:    'agressivo',
});

/**
 * Perfil de motor — 4 pontos chave que definem a "personalidade" do motor.
 * Cada carro tem o seu, derivado da curva do dinamômetro.
 *
 * Decisão Flávio 2026-05-29: "dentro dos padrões de cada motor".
 * As 3 janelas (Durabilidade/Normal/Agressivo) são DERIVADAS desses 4 pontos —
 * não há janela hardcoded universal. Cada motor tem janelas próprias.
 */
export const PERFIL_BUBI = Object.freeze({
  apelido:             'Bubi (Celta 1.4 motor Onix)',
  picoTorqueRpm:       5200,  // Lenza 2026-05-18
  picoPotenciaRpm:     6050,
  redlineRpm:          6300,  // operacional
  limiteHardRpm:       6350,  // mecânico (acima disso, risco real de quebra)
});

/**
 * Deriva as 3 janelas dos modos a partir do perfil do motor.
 * Heurística (calibrada pra carro turismo amador, validada pelo auditor):
 *   - Durabilidade: começa pouco antes do pico de potência, termina no pico.
 *     Troca cedo, motor dura mais. Margem confortável.
 *   - Normal: começa logo após o pico de potência, vai até pouco antes do redline.
 *     Padrão recomendado.
 *   - Agressivo: começa antes do redline, vai até o limite mecânico.
 *     Aceita risco mecânico, máximo ganho de volta.
 *
 * Pra Bubi: pico HP 6050, redline 6300, limite 6350 →
 *   Durabilidade 5800-6000, Normal 6100-6250, Agressivo 6250-6350.
 *
 * Pra outro motor (ex: Civic 1.6 com pico HP em 7000, redline 7500),
 * a função gera janelas diferentes, calibradas pra esse motor.
 */
export function derivarJanelas(perfil) {
  const { picoPotenciaRpm, redlineRpm, limiteHardRpm } = perfil;
  return {
    [ModoStint.DURABILIDADE]: {
      nome:       'Durabilidade',
      nomeBreve:  'DUR',
      rpmMin:     picoPotenciaRpm - 250,
      rpmMax:     picoPotenciaRpm,
      descCurta:  'Stints longos, motor frio, chuva, treino sem pressa',
      descLonga:  'Troca pouco antes do pico de potência. Perde um pouco de volta mas preserva o motor. Use em treino livre tranquilo, condições molhadas ou quando o motor precisa durar a temporada inteira.',
      cor:        'azul',
      ganhoVoltaEstimadoS: -0.4,
      desgasteRelativo:    'baixo',
    },
    [ModoStint.NORMAL]: {
      nome:       'Normal',
      nomeBreve:  'NRM',
      rpmMin:     picoPotenciaRpm + 50,
      rpmMax:     redlineRpm - 50,
      descCurta:  'Padrão recomendado — equilíbrio entre volta e durabilidade',
      descLonga:  'Troca após o pico de potência com margem do redline. Aproveita a banda útil do motor sem forçar o limite mecânico. Modo recomendado pra maioria das sessões.',
      cor:        'verde',
      ganhoVoltaEstimadoS: 0.0,
      desgasteRelativo:    'normal',
    },
    [ModoStint.AGRESSIVO]: {
      nome:       'Agressivo',
      nomeBreve:  'AGR',
      rpmMin:     redlineRpm - 50,
      rpmMax:     limiteHardRpm,
      descCurta:  'Volta de qualificação — aceita risco mecânico',
      descLonga:  'Troca próximo do limite mecânico. Máximo ganho de volta possível. Use em volta de qualificação ou momentos decisivos. NÃO use em motor frio (água < 80°C) — desgaste real.',
      cor:        'vermelho',
      ganhoVoltaEstimadoS: 0.4,
      desgasteRelativo:    'alto',
    },
  };
}

// Janelas pra Bubi (default exportado pra retrocompatibilidade).
// Derivadas do PERFIL_BUBI pra o sistema não ter números mágicos.
export const JANELAS_BUBI = Object.freeze(derivarJanelas(PERFIL_BUBI));

// Envelope de segurança DURO (auditor recomendação 3).
// IA opera autônoma DENTRO desses limites, NUNCA os viola.
export const ENVELOPE_DEFAULT_BUBI = Object.freeze({
  rpm_max_absoluto:        6300,  // teto duro independente do modo
  rpm_min_motor_celsius:   80,    // motor frio = rebaixa pra Normal automaticamente
  forca_lateral_max_g:     0.50,  // nunca troca acima disso (proteção do eixo)
  oleo_max_celsius:        115,   // acima disso, alarma + reduz pra Durabilidade
  agua_max_celsius:        95,    // acima disso, alarma + reduz pra Durabilidade
});

/**
 * Retorna a janela do modo escolhido pra o motor especificado.
 * @param {string} modo - ModoStint.*
 * @param {Object} [perfilMotor=PERFIL_BUBI] — perfil do motor; default = Bubi
 * @returns {{rpmMin: number, rpmMax: number, nome: string, ...}}
 */
export function janelaParaModo(modo, perfilMotor = PERFIL_BUBI) {
  const janelas = perfilMotor === PERFIL_BUBI ? JANELAS_BUBI : derivarJanelas(perfilMotor);
  const j = janelas[modo];
  if (!j) throw new Error(`shift-light-modos: modo "${modo}" desconhecido`);
  return j;
}

/**
 * Lista os 3 modos em ordem canônica (Durabilidade, Normal, Agressivo).
 */
export function listarModos() {
  return [
    JANELAS_BUBI[ModoStint.DURABILIDADE],
    JANELAS_BUBI[ModoStint.NORMAL],
    JANELAS_BUBI[ModoStint.AGRESSIVO],
  ];
}

/**
 * Valida se um RPM proposto está dentro da janela do modo.
 * @param {number} rpm
 * @param {string} modo
 */
export function rpmDentroDaJanela(rpm, modo) {
  const j = janelaParaModo(modo);
  return rpm >= j.rpmMin && rpm <= j.rpmMax;
}
