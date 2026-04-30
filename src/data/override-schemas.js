/**
 * OVERRIDE_SCHEMAS — 14 entradas declarativas pra overrides de stint.
 * Cada override tipo: pneus, alinhamento, suspensão, freios, motor.
 * Render genérico (UI consumer decide layout).
 */

const OVERRIDE_SCHEMAS = Object.freeze({
  // ─── PNEUS ──────────────────────────────────────────────────────────
  pressaoPneus: {
    grupo: 'PNEUS', label: 'Pressão pneus (saída box, PSI)', badge: 'PRESSÃO',
    layout: 'grid-2x2',
    keys: ['DE', 'DD', 'TE', 'TD'],
    keyLabels: ['DIANT. ESQ.', 'DIANT. DIR.', 'TRAS. ESQ.', 'TRAS. DIR.'],
    type: 'number', step: '0.5', min: '0', max: '120', placeholder: '35',
  },
  compostoPneu: {
    grupo: 'PNEUS', label: 'Composto / marca do pneu', badge: 'COMPOSTO',
    layout: 'single',
    type: 'text', maxlength: 50, placeholder: 'Ex: Pirelli P Zero — médio',
  },
  // ─── ALINHAMENTO ────────────────────────────────────────────────────
  cambagem: {
    grupo: 'ALINHAMENTO', label: 'Cambagem por roda (°)', badge: 'CAMBER',
    layout: 'grid-2x2',
    keys: ['DE', 'DD', 'TE', 'TD'],
    keyLabels: ['DIANT. ESQ.', 'DIANT. DIR.', 'TRAS. ESQ.', 'TRAS. DIR.'],
    type: 'number', step: '0.1', min: '-15', max: '15', placeholder: '-2',
  },
  caster: {
    grupo: 'ALINHAMENTO', label: 'Caster dianteiro (°)', badge: 'CASTER',
    layout: 'grid-2col',
    keys: ['DE', 'DD'],
    keyLabels: ['DIANT. ESQ.', 'DIANT. DIR.'],
    type: 'number', step: '0.1', min: '-10', max: '15', placeholder: '3.0',
  },
  convergencia: {
    grupo: 'ALINHAMENTO', label: 'Convergência por roda (mm — positivo = aberto)', badge: 'TOE',
    layout: 'grid-2x2',
    keys: ['DE', 'DD', 'TE', 'TD'],
    keyLabels: ['DIANT. ESQ.', 'DIANT. DIR.', 'TRAS. ESQ.', 'TRAS. DIR.'],
    type: 'number', step: '0.1', min: '-20', max: '20', placeholder: '0',
  },
  // ─── SUSPENSÃO ──────────────────────────────────────────────────────
  molas: {
    grupo: 'SUSPENSÃO', label: 'Mola D/T (kg/mm)', badge: 'MOLAS',
    layout: 'grid-2col',
    keys: ['D', 'T'],
    keyLabels: ['DIANTEIRA', 'TRASEIRA'],
    type: 'number', step: '0.1', min: '0', max: '50', placeholder: '7.5',
  },
  amortCompressao: {
    grupo: 'SUSPENSÃO', label: 'Amortecedor — clique compressão', badge: 'AMORT.C',
    layout: 'grid-2col',
    keys: ['D', 'T'],
    keyLabels: ['DIANTEIRA', 'TRASEIRA'],
    type: 'number', step: '1', min: '0', max: '50', placeholder: '12',
  },
  amortExtensao: {
    grupo: 'SUSPENSÃO', label: 'Amortecedor — clique extensão', badge: 'AMORT.E',
    layout: 'grid-2col',
    keys: ['D', 'T'],
    keyLabels: ['DIANTEIRA', 'TRASEIRA'],
    type: 'number', step: '1', min: '0', max: '50', placeholder: '10',
  },
  altura: {
    grupo: 'SUSPENSÃO', label: 'Altura D/T (mm — ride height)', badge: 'ALTURA',
    layout: 'grid-2col',
    keys: ['D', 'T'],
    keyLabels: ['DIANTEIRA', 'TRASEIRA'],
    type: 'number', step: '1', min: '40', max: '300', placeholder: '110',
  },
  barra: {
    grupo: 'SUSPENSÃO', label: 'Barra estabilizadora D/T (mm Ø ou clique)', badge: 'BARRA',
    layout: 'grid-2col',
    keys: ['D', 'T'],
    keyLabels: ['DIANTEIRA', 'TRASEIRA'],
    type: 'text', maxlength: 20, placeholder: 'Ex: 22 mm',
  },
  // ─── FREIOS ─────────────────────────────────────────────────────────
  bias: {
    grupo: 'FREIOS', label: 'Bias de freio (% F)', badge: 'BIAS',
    layout: 'single',
    type: 'number', step: '1', min: '0', max: '100', placeholder: '55',
  },
  // ─── MOTOR · TRANSMISSÃO ────────────────────────────────────────────
  combustivel: {
    grupo: 'MOTOR · TRANSMISSÃO', label: 'Combustível abastecido', badge: 'COMBUST.',
    layout: 'select',
    options: [
      ['', '— escolher —'],
      ['gasolina-comum', 'Gasolina comum'],
      ['gasolina-aditivada', 'Gasolina aditivada'],
      ['gasolina-podium', 'Gasolina premium / Podium'],
      ['etanol', 'Etanol'],
      ['e85', 'E85 (mistura)'],
      ['metanol', 'Metanol'],
    ],
  },
  mapaMotor: {
    grupo: 'MOTOR · TRANSMISSÃO', label: 'Mapa / injeção', badge: 'MAPA',
    layout: 'single',
    type: 'text', maxlength: 50, placeholder: 'Ex: T4000 — mapa seco-1',
  },
  diferencial: {
    grupo: 'MOTOR · TRANSMISSÃO', label: 'Diferencial', badge: 'DIF.',
    layout: 'select',
    options: [
      ['', '— escolher —'],
      ['aberto', 'Aberto (original)'],
      ['autoblocante', 'Autoblocante (LSD mecânico)'],
      ['viscoso', 'Viscoso'],
      ['blocado', 'Blocado (spool)'],
    ],
  },
});