// LiveDataBridge — cola entre os dados que chegam (transports + T4000) e o
// CockpitState (modelo do painel). Roda no notebook Windows.
//
// Spec: PLANO_FASE_1.md §6 MS-13.4 (reescrito 2026-05-09 amendment 2 — ADR-023)
// Mockup canônico: zero impacto (este módulo só atualiza o CockpitState).
//
// Fontes:
// 1. TransportSelector (cabo USB primário + Realtime fallback) → IMU/GPS
//    do iPhone (envelope { tMono, source: 'iphone-imu', payload }).
// 2. T4000Provider local no notebook → samples T4000 (RPM, marcha, MAP, λ,
//    temps, pressões, erro ECU, etc.).
//
// O bridge faz duas tarefas:
// - Mapear T4000 → estado direto do cockpit (shift light + alertas críticos).
// - Armazenar último IMU/GPS pra ser consumido pelo detector (MS-13.5,
//   ainda não implementado — quando chegar ele lê via getLastImuGps()).

import {
  ShiftMode,
  MsgTipo,
  SHIFT_LEVEL_MAX,
  ApexEstado,
} from './cockpit-state.js';
import { acharApice } from './apice-calculator.js';
import { bearingDeg, distMeters, apexErrorAngleDeg } from './trecho-detector.js';

// ── Limites default (calibrar por carro com Flávio) ──────────
//
// Origem: docs/hardware/T4000_CAN_SPEC.md §"Alertas determinísticos".
// Valores iniciais conservadores; ALERT_HIERARCHY.md confirma por carro.

export const DEFAULT_LIMITS = Object.freeze({
  redlineRpm:           7500,
  fireThresholdRatio:   0.95, // ≥95% redline → FIRE strobe (modo legado, baseado em redline)
  litStartRatio:        0.50, // <50% redline → LEDs apagados
  // Modo NOVO baseado em torque (preferido quando informado):
  //   peakTorqueRpm — rpm do pico de torque (vem do dinamômetro).
  //   torqueLitOffsetRpm — quantos rpm antes do pico começa o LIT progressivo.
  // Quando peakTorqueRpm está definido, rpmToShift IGNORA fireThresholdRatio +
  // litStartRatio e usa janela (peak-offset, peak, redline).
  peakTorqueRpm:        null,
  torqueLitOffsetRpm:   300,
  oilPressMinBar:       0.5,
  oilPressMinAtRpm:     2000, // só dispara alerta abaixo do mínimo se RPM > este
  oilTempMaxC:          130,
  waterTempMaxC:        110,
  // egtOutOfRange já vem flagged pelo parser (T4000_EGT_MAX_C = 1500)
});

// ── Helpers puros (testáveis isoladamente) ──────────────────

/**
 * Mapeia RPM para shift mode + level conforme limites.
 * - >redline       → OVERREV
 * - ≥fireThreshold → FIRE
 * - ≥litStart      → LIT linear 1..SHIFT_LEVEL_MAX
 * - <litStart      → OFF
 */
export function rpmToShift(rpm, limits = DEFAULT_LIMITS) {
  if (typeof rpm !== 'number' || !Number.isFinite(rpm) || rpm < 0) {
    return { mode: ShiftMode.OFF, level: 0 };
  }
  const { redlineRpm, peakTorqueRpm, torqueLitOffsetRpm } = limits;

  // ── Modo TORQUE (preferido) ────────────────────────────────
  // Acende progressivamente nos N rpm antes do pico de torque, dispara
  // FIRE no pico, e OVERREV acima do redline. Pedido Flávio 2026-05-26:
  // "quando o carro chegar no máximo do torque, ele aciona o shift light".
  if (typeof peakTorqueRpm === 'number' && peakTorqueRpm > 0) {
    if (rpm > redlineRpm) return { mode: ShiftMode.OVERREV, level: 0 };
    if (rpm >= peakTorqueRpm) return { mode: ShiftMode.FIRE, level: 0 };
    const start = peakTorqueRpm - (torqueLitOffsetRpm ?? 300);
    if (rpm < start) return { mode: ShiftMode.OFF, level: 0 };
    const norm = (rpm - start) / (peakTorqueRpm - start); // 0..<1
    const level = Math.max(1, Math.min(SHIFT_LEVEL_MAX, Math.round(norm * SHIFT_LEVEL_MAX) || 1));
    return { mode: ShiftMode.LIT, level };
  }

  // ── Modo legado (fallback baseado em redline %) ────────────
  const { fireThresholdRatio, litStartRatio } = limits;
  if (rpm > redlineRpm) return { mode: ShiftMode.OVERREV, level: 0 };
  const ratio = rpm / redlineRpm;
  if (ratio >= fireThresholdRatio) return { mode: ShiftMode.FIRE, level: 0 };
  if (ratio < litStartRatio) return { mode: ShiftMode.OFF, level: 0 };
  const span = fireThresholdRatio - litStartRatio;
  const norm = (ratio - litStartRatio) / span;
  const level = Math.max(1, Math.min(SHIFT_LEVEL_MAX, Math.round(norm * SHIFT_LEVEL_MAX) || 1));
  return { mode: ShiftMode.LIT, level };
}

/**
 * Alarmes do bitfield da T3000 que o piloto consegue agir enquanto pilota,
 * em ordem de gravidade — o mais grave vence quando há múltiplos ativos.
 * Mensagens curtas e práticas em PT-BR.
 *
 * REMOVIDOS deliberadamente (piloto não pode fazer nada pilotando):
 *   - excessoAberturaInjetor — questão de mapeamento, decisão de engenheiro
 *   - nbMinimo / nbMaximo — sonda auxiliar (Bubi nem tem); duplica WB
 */
export const ALARM_PRIORITY = Object.freeze([
  ['baixaPressaoOleo',         MsgTipo.GRAVE,       'ÓLEO BAIXO'],
  ['excessoTempMotor',         MsgTipo.GRAVE,       'MOTOR QUENTE'],
  ['baixaPressaoCombustivel',  MsgTipo.GRAVE,       'COMBUSTÍVEL BAIXO'],
  ['excessoRotacao',           MsgTipo.GRAVE,       'ROTAÇÃO ALTA'],
  ['excessoPressao',           MsgTipo.GRAVE,       'PRESSÃO ALTA'],
  ['wbMinimo',                 MsgTipo.COMUNICACAO, 'Alivie'],
  ['wbMaximo',                 MsgTipo.COMUNICACAO, 'Pra box'],
  ['alertaNivelCombustivel',   MsgTipo.COMUNICACAO, 'Abasteça'],
]);

/**
 * Inspeciona o objeto sample.alarmes (vindo do parser T3000) e retorna o
 * alarme MAIS GRAVE ativo, no formato { tipo, texto }. Null quando nenhum.
 */
export function checkAlarmesBitfield(sample) {
  if (!sample || !sample.alarmes) return null;
  for (const [chave, tipo, texto] of ALARM_PRIORITY) {
    if (sample.alarmes[chave] === true) return { tipo, texto };
  }
  return null;
}

/**
 * Avalia condições críticas do T4000. Retorna { tipo, texto } se há alerta;
 * null se está tudo OK ou se o sample tem checksum quebrado.
 *
 * Ordem de prioridade (mais grave primeiro):
 * 1. alarme do bitfield da central (vence quando ativo)
 * 2. água > limite
 * 3. óleo > limite
 * 4. pressão óleo < limite com RPM > limite (motor sob carga)
 * 5. EGT fora de range
 */
export function checkCriticalAlerts(sample, limits = DEFAULT_LIMITS) {
  if (!sample || sample.checksumOk === false) return null;

  const alarmeBitfield = checkAlarmesBitfield(sample);
  if (alarmeBitfield) return alarmeBitfield;

  if (typeof sample.waterTempC === 'number' && sample.waterTempC > limits.waterTempMaxC) {
    return { tipo: MsgTipo.GRAVE, texto: 'Temperatura água crítica' };
  }
  if (typeof sample.oilTempC === 'number' && sample.oilTempC > limits.oilTempMaxC) {
    return { tipo: MsgTipo.GRAVE, texto: 'Temperatura óleo crítica' };
  }
  if (typeof sample.oilPressBar === 'number'
      && typeof sample.rpm === 'number'
      && sample.oilPressBar < limits.oilPressMinBar
      && sample.rpm > limits.oilPressMinAtRpm) {
    return { tipo: MsgTipo.GRAVE, texto: 'Pressão óleo crítica' };
  }
  if (sample.egtOutOfRange === true) {
    return { tipo: MsgTipo.GRAVE, texto: 'EGT crítica' };
  }
  return null;
}

// ── Vmin + sub-trechos por eventos reais (conserto 11/06) ─────
//
// Defeito de origem: o buffer etiquetava o sub pela FASE do detector, e a
// fase pós-ápice ('apice-saida') ia inteira pro sub 'apice' — o sub 'saida'
// NUNCA acumulava amostra e a perda na aceleração sumia do delta (achado da
// pesquisa de 11/06; pré-requisito dos treinos de saída/início de aceleração).
//
// Conserto: ao fechar a passagem, re-etiquetar pelos MARCOS REAIS medidos:
//   entrada = linha de entrada → freada-iniciou (t real)
//   freio   = freada → ápice (t real do apice-cruzou)
//   apice   = ápice → Vmin (menor velocidade da passagem — calculada aqui)
//   saida   = Vmin → linha de saída (a fase de aceleração de verdade)
// Sem freada detectada: entrada vai até o ápice. Vmin antes do ápice: o
// pedaço 'apice' fica vazio e a saída começa no ápice — nunca se inventa marco.

/** Menor velocidade finita do buffer da passagem. → { kmh, idx } | null */
export function acharVminBuffer(buffer) {
  if (!Array.isArray(buffer) || !buffer.length) return null;
  let kmh = null, idx = -1;
  for (let i = 0; i < buffer.length; i++) {
    const v = buffer[i]?.kmh;
    if (Number.isFinite(v) && v > 0 && (kmh === null || v < kmh)) { kmh = v; idx = i; }
  }
  return kmh === null ? null : { kmh, idx };
}

/** Re-etiqueta os subs do buffer pelos marcos reais da passagem (não muta). */
export function retagSubsPorEventos(buffer, { freadaT = null, apiceT = null, vminIdx = null } = {}) {
  if (!Array.isArray(buffer)) return buffer;
  const vminT = (vminIdx != null && buffer[vminIdx]) ? buffer[vminIdx].t : null;
  return buffer.map((p, i) => {
    if (!p) return p;
    let sub;
    const t = p.t;
    if (freadaT != null && t <= freadaT) {
      sub = 'entrada';
    } else if (apiceT != null) {
      if (t <= apiceT) sub = (freadaT == null) ? 'entrada' : 'freio';
      else if (vminT != null && t <= vminT && i <= vminIdx) sub = 'apice';
      else sub = 'saida';
    } else if (vminT != null) {
      // sem ápice reconhecido: a Vmin (marco real) divide desaceleração de
      // aceleração — nunca se inventa pedaço de ápice
      if (t <= vminT || i <= vminIdx) sub = (freadaT == null) ? 'entrada' : 'freio';
      else sub = 'saida';
    } else {
      sub = (freadaT == null) ? 'entrada' : 'freio';
    }
    return { ...p, sub };
  });
}

// ── Bridge ──────────────────────────────────────────────────

export class LiveDataBridge {
  /**
   * @param {Object} opts
   * @param {Object} opts.cockpitState   instância de CockpitState
   * @param {Object} [opts.limits]       limites de calibração (DEFAULT_LIMITS)
   * @param {(stage:string,info:any)=>void} [opts.onEvent]  observabilidade
   */
  constructor({
    cockpitState,
    limits = DEFAULT_LIMITS,
    onEvent = () => {},
    // ── Módulos plugáveis (decisão Flávio 27/05/2026 — passo A) ──
    trechoDetector  = null,   // instância de TrechoDetector (consumirá GPS)
    deltaCalculator = null,   // função calcularDelta (chamada ao fim de cada trecho)
    alertasCriticos = null,   // instância de AlertasCriticos (consumirá T4000+GPS)
    onTrechoEvent   = null,   // callback opcional pra eventos de trecho
    onSalvarPassagem = null,  // async ({segmentId, tempoS, pontos}) — persiste no banco
    origemSimulador = () => false, // passagem de simulador NUNCA vira referência nem salva
  } = {}) {
    if (!cockpitState) throw new Error('LiveDataBridge: cockpitState é obrigatório');
    this._cockpitState = cockpitState;
    this._limits = limits;
    this._onEvent = onEvent;
    this._trechoDetector  = trechoDetector;
    this._deltaCalculator = deltaCalculator;
    this._alertasCriticos = alertasCriticos;
    this._onTrechoEvent   = onTrechoEvent;
    this._onSalvarPassagem = onSalvarPassagem;
    this._origemSimulador  = origemSimulador;
    this._passagemBuffer  = []; // amostras GPS acumuladas da passagem atual no trecho
    this._referenciasPorSegmento = new Map(); // segmentId → melhor passagem histórica
    this._freadaT = null;       // t real do freada-iniciou da passagem atual
    this._apiceT  = null;       // t real do apice-cruzou da passagem atual

    this._lastImuGps = null;
    this._lastT4000 = null;
    this._activeAlertTexto = null; // pra evitar showMessage repetida
    this._stats = { imuGpsCount: 0, t4000Count: 0, alertsRaised: 0, alertsCleared: 0,
                    trechosCompletos: 0, deltaCalculados: 0 };

    // Se o detector foi passado, conecta o handler de eventos de trecho.
    if (this._trechoDetector && typeof this._trechoDetector === 'object') {
      // Substitui o onEvent original do detector por um wrapper que distribui
      // evento → buffer / calculador / callback do consumidor.
      this._trechoDetector._onEvent = (ev) => this._handleTrechoEvent(ev);
    }
  }

  /** Registra a referência (melhor passagem histórica) de um segmento.
   *  Carregado uma vez pelo melhores-loader.js no boot da sessão. */
  setReferenciaSegmento(segmentId, passagemRef) {
    if (!segmentId) return;
    this._referenciasPorSegmento.set(segmentId, passagemRef);
  }

  /** Plugado no TransportSelector — recebe envelope do cabo OU do realtime, indistinto. */
  ingestImuGps(envelope) {
    if (!envelope || envelope.source !== 'iphone-imu' || !envelope.payload) return;
    const payload = envelope.payload;
    this._lastImuGps = payload;
    this._stats.imuGpsCount++;

    // Alimenta o detector de trechos (decisão Flávio 27/05/2026 passo A).
    if (this._trechoDetector && typeof payload.lat === 'number') {
      this._trechoDetector.ingestGps({
        lat: payload.lat,
        lng: payload.lng,
        kmh: payload.kmh ?? (payload.speed * 3.6),
        t:   payload.tMono ?? payload.t ?? Date.now(),
        headingDeg: payload.course,
      });
    }

    // Alimenta o avaliador de alertas (SEM_GPS via accuracy).
    if (this._alertasCriticos && typeof this._alertasCriticos.ingestGps === 'function') {
      this._alertasCriticos.ingestGps({ accM: payload.acc ?? payload.accM });
    }

    // Buffer da passagem atual no trecho (se detector já está dentro de uma curva).
    if (this._trechoDetector && this._estaDentroDoTrecho()) {
      this._passagemBuffer.push({
        lat: payload.lat,
        lng: payload.lng,
        kmh: payload.kmh ?? (payload.speed * 3.6),
        t:   payload.tMono ?? payload.t ?? Date.now(),
        sub: this._subTrechoAtual(),
      });
      // Atualiza a bolinha do Ápice em TEMPO REAL: distância e direção até
      // o ápice de referência (decisão Flávio 27/05: bolinha aponta pra onde
      // estava o ápice ideal — "siga a bolinha").
      this._atualizarBolinhaApiceAoVivo(payload);
    }
  }

  /** Atualiza apex.apice no CockpitState com base na posição atual e no
   *  ápice de referência do segmento corrente (vem da melhor passagem). */
  _atualizarBolinhaApiceAoVivo(payload) {
    if (!this._cockpitState || !this._trechoDetector) return;
    const seg = this._trechoDetector.getState();
    if (!seg.currentSegmentId) return;
    const apiceRef = this.getApiceReferencia(seg.currentSegmentId);
    if (!apiceRef) {
      // Sem melhor passagem cadastrada ainda → estado pendente.
      this._cockpitState.setApexPonto('apice', {
        estado:   ApexEstado.PENDENTE,
        distM:    null,
        angleDeg: null,
      });
      return;
    }
    const posAtual = { lat: payload.lat, lng: payload.lng };
    // Heading do carro: usa o course do GPS se disponível, senão calcula
    // entre a amostra anterior e a atual.
    let heading = payload.course;
    if ((heading == null || !Number.isFinite(heading)) && this._passagemBuffer.length >= 2) {
      const prev = this._passagemBuffer[this._passagemBuffer.length - 2];
      if (distMeters(prev, posAtual) >= 1) {
        heading = bearingDeg(prev, posAtual);
      }
    }
    const distM = distMeters(posAtual, apiceRef);
    const angleDeg = (typeof heading === 'number' && Number.isFinite(heading))
      ? apexErrorAngleDeg(posAtual, heading, apiceRef)
      : null;
    // Estado pela proximidade: dentro de 2m = ok-melhor (mira certa), fora = ok-pior.
    const estado = distM <= 2 ? ApexEstado.OK_MELHOR : ApexEstado.OK_PIOR;
    this._cockpitState.setApexPonto('apice', { estado, distM, angleDeg });
  }

  /** Plugado no T4000Provider — recebe sample já parseado e validado. */
  ingestT4000(sample) {
    if (!sample) return;
    this._lastT4000 = sample;
    this._stats.t4000Count++;
    this._applyT4000ToCockpit(sample);

    // Encaminha pro avaliador de alertas (catálogo v2).
    if (this._alertasCriticos && typeof this._alertasCriticos.ingestT4000 === 'function') {
      this._alertasCriticos.ingestT4000(sample);
    }
  }

  getLastImuGps()  { return this._lastImuGps; }
  getLastT4000()   { return this._lastT4000; }
  getStats()       { return { ...this._stats }; }
  getLimits()      { return this._limits; }

  /** Atualiza limites em runtime (ex.: quando a curva do dinamômetro carrega da nuvem). */
  setLimits(nextLimits) {
    this._limits = { ...DEFAULT_LIMITS, ...this._limits, ...nextLimits };
  }

  // ── interno ─────────────────────────────────────────

  _applyT4000ToCockpit(sample) {
    if (sample.checksumOk === false) {
      this._onEvent('t4000-bad-checksum', { tMono: sample.tMono });
      return; // não interpreta dado corrompido
    }

    // 1. RPM → shift mode/level
    if (typeof sample.rpm === 'number') {
      const { mode, level } = rpmToShift(sample.rpm, this._limits);
      this._cockpitState.applyShift(mode, level);
    }

    // 2. Alertas críticos
    const alert = checkCriticalAlerts(sample, this._limits);
    if (alert) {
      if (this._activeAlertTexto !== alert.texto) {
        this._cockpitState.showMessage(alert);
        this._activeAlertTexto = alert.texto;
        this._stats.alertsRaised++;
        this._onEvent('alert-raised', alert);
      }
    } else if (this._activeAlertTexto !== null) {
      // condição limpou. Limpa só se a mensagem ativa era um alerta deste bridge.
      // (Mensagens de coach/comunicação ficam preservadas — futuro: priority manager.)
      this._cockpitState.hideMessage();
      this._activeAlertTexto = null;
      this._stats.alertsCleared++;
      this._onEvent('alert-cleared', null);
    }
  }

  // ── Integração TrechoDetector → DeltaCalculator ──

  _estaDentroDoTrecho() {
    if (!this._trechoDetector || typeof this._trechoDetector.getState !== 'function') return false;
    const st = this._trechoDetector.getState();
    return st.phase !== 'antes-entrada' && st.phase !== 'pos-saida';
  }

  _subTrechoAtual() {
    if (!this._trechoDetector || typeof this._trechoDetector.getState !== 'function') return null;
    const phase = this._trechoDetector.getState().phase;
    if (phase === 'entrada-freio') return 'entrada';
    if (phase === 'freio-apice')   return 'freio';
    if (phase === 'apice-saida')   return 'apice';
    return 'saida';
  }

  /** Recebe eventos do TrechoDetector: alimenta buffer, calcula delta ao
   *  cruzar a linha de saída, repassa pro callback externo. */
  _handleTrechoEvent(ev) {
    if (!ev) return;
    if (typeof this._onTrechoEvent === 'function') this._onTrechoEvent(ev);

    // Marcos reais da passagem atual (re-etiquetagem honesta no fechamento).
    if (ev.type === 'entrada-cruzou') { this._freadaT = null; this._apiceT = null; }
    if (ev.type === 'freada-iniciou' && this._freadaT == null) this._freadaT = ev.t ?? null;
    if (ev.type === 'apice-cruzou'   && this._apiceT  == null) this._apiceT  = ev.t ?? null;

    // Quando cruza a saída → fecha a passagem atual e calcula o delta.
    if (ev.type === 'saida-cruzou') {
      this._stats.trechosCompletos++;

      // Re-etiqueta os subs pelos marcos REAIS antes de qualquer consumo —
      // o sub 'saida' passa a existir de verdade (conserto 11/06).
      const vmin = acharVminBuffer(this._passagemBuffer);
      if (this._passagemBuffer.length >= 2) {
        this._passagemBuffer = retagSubsPorEventos(this._passagemBuffer, {
          freadaT: this._freadaT,
          apiceT:  this._apiceT,
          vminIdx: vmin ? vmin.idx : null,
        });
      }

      // Referência vigente ANTES desta passagem — o delta é calculado contra
      // ela. (Conserto 10/06/2026: a passagem "nova melhor" substituía a
      // referência local ANTES do cálculo e o delta saía dela contra ela
      // mesma — zero em tudo, e a tela de orientação nunca acendia. Prova:
      // tests/node-smoke-bridge-delta-referencia.mjs.)
      const refAnterior = this._referenciasPorSegmento.get(ev.segmentId);

      // Calcula ápice da passagem que acabou (lugar mais dentro da curva).
      // Decisão Flávio 2026-05-27: o ápice depende da configuração (carro+pneu),
      // por isso é derivado da passagem real, não cadastrado fixo.
      const apicePassagem = (this._passagemBuffer.length >= 9)
        ? acharApice(this._passagemBuffer)
        : null;
      if (apicePassagem && typeof this._onTrechoEvent === 'function') {
        this._onTrechoEvent({
          type:       'apice-passagem',
          segmentId:  ev.segmentId,
          ponto:      apicePassagem.ponto,
          raioM:      apicePassagem.raioM,
        });
      }

      const pontosCanonicos = this._passagemBuffer.length >= 2
        ? this._calcularFracoesPra(this._passagemBuffer)
        : null;

      // Toda passagem fechada é o "hábito" mais recente do piloto — melhor ou
      // não, simulador ou não. Alimenta as marcas VOCÊ da tela de orientação.
      // Vmin vai junto (treino de velocidade mínima / trail braking, 11/06).
      if (pontosCanonicos && typeof this._onTrechoEvent === 'function') {
        this._onTrechoEvent({
          type: 'passagem-fechada',
          segmentId: ev.segmentId,
          pontos: pontosCanonicos,
          vminKmh:    vmin ? vmin.kmh : null,
          vminFracao: (vmin && pontosCanonicos[vmin.idx]) ? pontosCanonicos[vmin.idx].fracao : null,
        });
      }

      // Persistência automática: se a passagem é melhor que a referência atual
      // (ou se não há referência ainda), grava no banco e vira a referência
      // local pra PRÓXIMA passagem. Passagem de SIMULADOR nunca entra aqui —
      // referência é do carro real (par local da blindagem __P1_ORIGEM_SIM__
      // da nuvem; sem isso o replay trocava a referência pela volta 1 do
      // simulador e as voltas seguintes comparavam sim×sim = delta zero).
      if (this._onSalvarPassagem && this._passagemBuffer.length >= 9 && !this._origemSimulador()) {
        const primeiro = this._passagemBuffer[0];
        const ultimo = this._passagemBuffer[this._passagemBuffer.length - 1];
        const tempoS = (ultimo.t - primeiro.t) / 1000;
        if (tempoS > 0 && Number.isFinite(tempoS)) {
          const ehNovaMelhor = !refAnterior || tempoS < refAnterior.tempoS;
          if (ehNovaMelhor) {
            const novaRef = {
              segmentId: ev.segmentId,
              tempoS,
              pontos: pontosCanonicos,
              apicePoint: apicePassagem?.ponto ?? null,
              apiceRaioM: apicePassagem?.raioM ?? null,
            };
            this._referenciasPorSegmento.set(ev.segmentId, novaRef);
            Promise.resolve()
              .then(() => this._onSalvarPassagem({
                segmentId: ev.segmentId, tempoS, pontos: pontosCanonicos,
              }))
              .catch(e => this._onEvent('persist-erro', { segmentId: ev.segmentId, msg: e.message }));
            this._stats.passagensSalvas = (this._stats.passagensSalvas || 0) + 1;
            this._onEvent('passagem-salva', { segmentId: ev.segmentId, tempoS });
            if (typeof this._onTrechoEvent === 'function') {
              // ref vai junto: a marca OURO da tela acompanha a promoção na
              // própria sessão (antes setReferencia só rodava no boot — risco (d)).
              this._onTrechoEvent({ type: 'passagem-salva', segmentId: ev.segmentId, tempoS, ref: novaRef });
            }
          }
        }
      }

      if (this._deltaCalculator && pontosCanonicos && refAnterior) {
        try {
          const passagemAtual = {
            segmentId: ev.segmentId,
            pontos: pontosCanonicos,
          };
          const resultado = this._deltaCalculator({ atual: passagemAtual, referencia: refAnterior });
          this._stats.deltaCalculados++;
          this._onEvent('delta-calculado', resultado);
          // Propaga o resultado pro callback externo também.
          if (typeof this._onTrechoEvent === 'function') {
            this._onTrechoEvent({ type: 'delta-calculado', ...resultado });
          }
        } catch (e) {
          this._onEvent('delta-erro', { segmentId: ev.segmentId, msg: e.message });
        }
      }
      this._passagemBuffer = []; // limpa pra próximo trecho
      this._freadaT = null;
      this._apiceT = null;
    }
  }

  /** Retorna o ápice de REFERÊNCIA registrado pra um segmento (vem da melhor
   *  passagem persistida no banco, com ápice já calculado por melhores-loader). */
  getApiceReferencia(segmentId) {
    const ref = this._referenciasPorSegmento.get(segmentId);
    return ref?.apicePoint ?? null;
  }

  /** Calcula a fração 0..1 ao longo do trecho pra cada ponto do buffer
   *  (proporcional à distância acumulada). */
  _calcularFracoesPra(buffer) {
    if (buffer.length === 0) return [];
    let ds = 0;
    const dists = [0];
    for (let i = 1; i < buffer.length; i++) {
      const a = buffer[i - 1], b = buffer[i];
      const DEG2RAD = Math.PI / 180;
      const EARTH_R_M = 6_378_137;
      const lat1 = a.lat * DEG2RAD, lat2 = b.lat * DEG2RAD;
      const dLat = lat2 - lat1;
      const dLng = (b.lng - a.lng) * DEG2RAD;
      const x = dLng * Math.cos((lat1 + lat2) / 2);
      const y = dLat;
      const d = Math.sqrt(x * x + y * y) * EARTH_R_M;
      ds += d;
      dists.push(ds);
    }
    const total = ds || 1;
    return buffer.map((p, i) => ({ ...p, fracao: dists[i] / total }));
  }
}
