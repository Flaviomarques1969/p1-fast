// CockpitState — modelo JS puro do estado vivo do cockpit do piloto.
//
// Spec: PLANO_FASE_1.md §6 MS-13.3 (reescrito 2026-05-09 — ADR-023)
// Mockup canônico de origem: _design-reference/mockup-cockpit-piloto.html
//
// Espelha os 4 data-attrs externos do cockpit + os campos derivados que
// alimentam delta, ação e apex pontos. Modelo puro: zero DOM, zero browser
// API. Roda igual em Node (smoke) e no browser (cockpit web no Windows).
//
// Usado por:
// - LiveDataBridge (MS-13.4) — funde dado vivo do iPhone (Realtime IMU/GPS)
//   + T4000 local em mutações no CockpitState.
// - CockpitRenderer (a fazer) — observa onChange e aplica os 4 data-attrs +
//   sub-elementos no DOM real.
// - DemoLoop / fixtures — populam state pra teste sem hardware.
//
// REGRA DURA (Flávio 2026-05-09): este modelo só descreve o que o mockup
// canônico já permite expressar. Não inventa estado novo, não muda semântica
// de elemento existente, não acrescenta data-attr não-presente no canônico.

// ── Enums (espelham os valores que o cockpit canônico aceita) ──

export const TrechoStatus = Object.freeze({
  NEUTRO:         'neutro',
  RECORDE_STINT:  'recorde-stint',
  MELHOR_HISTORICO: 'melhor-historico',
  PIOR_STINT:     'pior-stint',
});

export const ShiftMode = Object.freeze({
  OFF:     'off',
  LIT:     'lit',     // 0..6 — value de level decide quantos LEDs acendem
  FIRE:    'fire',    // strobe de troca
  OVERREV: 'overrev', // erro: além do limite
});

export const ShiftFire = Object.freeze({
  IDLE:   'idle',
  ACTIVE: 'active',
});

export const MsgState = Object.freeze({
  OCULTA: 'oculta',
  ATIVA:  'ativa',
});

export const MsgTipo = Object.freeze({
  COMUNICACAO: 'comunicacao',
  GRAVE:       'grave',
});

export const Tone = Object.freeze({
  NEUTRO: 'neutro',
  BOM:    'bom',
  ERRO:   'erro',
});

export const ApexEstado = Object.freeze({
  PENDENTE:  'pendente',  // ainda sem dado real — desenha neutro/cinza
  OK_MELHOR: 'ok-melhor',
  OK_PIOR:   'ok-pior',
});

export const SHIFT_LEVEL_MIN = 0;
export const SHIFT_LEVEL_MAX = 6; // sequência canônica vai 0..6 → fire → overrev
export const SHIFT_DOTS_TOTAL = 12; // mockup tem 12 LEDs, level 6 = todos acesos

// ── Default state (espelha o que o mockup carrega ao boot) ────

export function defaultCockpitState() {
  return {
    trechoStatus: TrechoStatus.NEUTRO,
    shift: {
      mode:  ShiftMode.OFF,
      level: 0,
      fire:  ShiftFire.IDLE,
    },
    message: null, // null = oculta; { tipo, texto } quando ativa
    delta: { value: '0.00', tone: Tone.NEUTRO },
    acao:  { texto: '',     tone: Tone.NEUTRO },
    apex: {
      entrada: { estado: ApexEstado.PENDENTE, valorKmh: null, nomeCurva: null },
      freio:   { estado: ApexEstado.PENDENTE, atualM: null, refM: null },
      apice:   { estado: ApexEstado.PENDENTE, valorKmh: null, nomeCurva: null },
      saida:   { estado: ApexEstado.PENDENTE, valorKmh: null, nomeCurva: null },
    },
  };
}

// ── Validações ───────────────────────────────────────────────

function isOneOf(value, dict) {
  return Object.values(dict).includes(value);
}

function assertEnum(name, value, dict) {
  if (!isOneOf(value, dict)) {
    throw new Error(`CockpitState: ${name}="${value}" não é válido (esperado um de ${Object.values(dict).join('|')})`);
  }
}

function assertShiftLevel(level) {
  if (typeof level !== 'number' || !Number.isFinite(level)) {
    throw new Error(`CockpitState: shift.level precisa ser número finito (recebeu ${level})`);
  }
  if (level < SHIFT_LEVEL_MIN || level > SHIFT_LEVEL_MAX) {
    throw new Error(`CockpitState: shift.level=${level} fora de [${SHIFT_LEVEL_MIN}..${SHIFT_LEVEL_MAX}]`);
  }
}

// Quantos LEDs acendem quando mode=LIT e level=N. Map linear N=0→0 LEDs,
// N=SHIFT_LEVEL_MAX → SHIFT_DOTS_TOTAL LEDs.
export function shiftDotsForLevel(level) {
  if (level <= SHIFT_LEVEL_MIN) return 0;
  if (level >= SHIFT_LEVEL_MAX) return SHIFT_DOTS_TOTAL;
  return Math.round((level / SHIFT_LEVEL_MAX) * SHIFT_DOTS_TOTAL);
}

// ── Store (model + observer) ─────────────────────────────────

export class CockpitState {
  constructor(initial = null) {
    this._state = initial ?? defaultCockpitState();
    this._listeners = new Set();
  }

  get() {
    return this._state;
  }

  /**
   * Subscribe to state changes. Returns unsubscribe.
   * Listener recebe (newState, prevState, changedKeys).
   */
  onChange(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  _emit(prev, changedKeys) {
    for (const cb of this._listeners) {
      try { cb(this._state, prev, changedKeys); } catch (e) {
        // não deixa exceção de listener parar o cockpit
        // eslint-disable-next-line no-console
        console.error('CockpitState listener falhou:', e);
      }
    }
  }

  // ── setters individuais (cada um valida + emite onChange) ──

  setTrechoStatus(value) {
    assertEnum('trechoStatus', value, TrechoStatus);
    if (this._state.trechoStatus === value) return;
    const prev = this._state;
    this._state = { ...prev, trechoStatus: value };
    this._emit(prev, ['trechoStatus']);
  }

  setShift({ mode, level, fire } = {}) {
    const next = { ...this._state.shift };
    if (mode !== undefined) {
      assertEnum('shift.mode', mode, ShiftMode);
      next.mode = mode;
    }
    if (level !== undefined) {
      assertShiftLevel(level);
      next.level = level;
    }
    if (fire !== undefined) {
      assertEnum('shift.fire', fire, ShiftFire);
      next.fire = fire;
    }
    const cur = this._state.shift;
    if (cur.mode === next.mode && cur.level === next.level && cur.fire === next.fire) return;
    const prev = this._state;
    this._state = { ...prev, shift: next };
    this._emit(prev, ['shift']);
  }

  /** Conveniência: aplica regra do cockpit canônico — fire dispara device flash, overrev limpa LEDs. */
  applyShift(mode, level = 0) {
    if (mode === ShiftMode.OFF) return this.setShift({ mode, level: 0, fire: ShiftFire.IDLE });
    if (mode === ShiftMode.OVERREV) return this.setShift({ mode, level: 0, fire: ShiftFire.IDLE });
    if (mode === ShiftMode.FIRE)    return this.setShift({ mode, level: 0, fire: ShiftFire.ACTIVE });
    return this.setShift({ mode: ShiftMode.LIT, level, fire: ShiftFire.IDLE });
  }

  showMessage({ tipo, texto }) {
    assertEnum('message.tipo', tipo, MsgTipo);
    if (typeof texto !== 'string' || texto.length === 0) {
      throw new Error('CockpitState: message.texto precisa ser string não-vazia');
    }
    const next = { tipo, texto };
    const cur = this._state.message;
    if (cur && cur.tipo === tipo && cur.texto === texto) return;
    const prev = this._state;
    this._state = { ...prev, message: next };
    this._emit(prev, ['message']);
  }

  hideMessage() {
    if (this._state.message === null) return;
    const prev = this._state;
    this._state = { ...prev, message: null };
    this._emit(prev, ['message']);
  }

  setDelta({ value, tone }) {
    if (typeof value !== 'string') throw new Error('delta.value precisa ser string (formatada pelo caller)');
    assertEnum('delta.tone', tone, Tone);
    const cur = this._state.delta;
    if (cur.value === value && cur.tone === tone) return;
    const prev = this._state;
    this._state = { ...prev, delta: { value, tone } };
    this._emit(prev, ['delta']);
  }

  setAcao({ texto, tone }) {
    if (typeof texto !== 'string') throw new Error('acao.texto precisa ser string');
    assertEnum('acao.tone', tone, Tone);
    const cur = this._state.acao;
    if (cur.texto === texto && cur.tone === tone) return;
    const prev = this._state;
    this._state = { ...prev, acao: { texto, tone } };
    this._emit(prev, ['acao']);
  }

  setApexPonto(papel, fields) {
    if (!['entrada', 'freio', 'apice', 'saida'].includes(papel)) {
      throw new Error(`CockpitState: apex papel="${papel}" inválido`);
    }
    const cur = this._state.apex[papel];
    const next = { ...cur, ...fields };
    if (next.estado !== undefined) assertEnum(`apex.${papel}.estado`, next.estado, ApexEstado);
    let changed = false;
    for (const k of Object.keys(next)) if (next[k] !== cur[k]) { changed = true; break; }
    if (!changed) return;
    const prev = this._state;
    this._state = {
      ...prev,
      apex: { ...prev.apex, [papel]: next },
    };
    this._emit(prev, ['apex']);
  }

  // ── Atalho usado pelo demo loop / debug — aplica preset do mockup ──

  applyHaloPreset(preset) {
    // Os presets canônicos vivem no mockup-cockpit-piloto.html (haloStates).
    // Este método aceita o objeto cru e mapeia pros campos do CockpitState.
    if (!preset || typeof preset !== 'object') throw new Error('applyHaloPreset: preset inválido');
    const trecho = preset.trechoStatus ?? preset.halo;
    if (trecho) this.setTrechoStatus(trecho);
    if (preset.deltaVal !== undefined) {
      const tone = preset.deltaClass === 'bom' ? Tone.BOM : preset.deltaClass === 'erro' ? Tone.ERRO : Tone.NEUTRO;
      this.setDelta({ value: String(preset.deltaVal), tone });
    }
    if (preset.acaoText !== undefined) {
      const tone = preset.acaoClass === 'bom' ? Tone.BOM : preset.acaoClass === 'erro' ? Tone.ERRO : Tone.NEUTRO;
      this.setAcao({ texto: preset.acaoText, tone });
    }
    if (preset.entradaEstado !== undefined || preset.entradaVal !== undefined) {
      this.setApexPonto('entrada', {
        ...(preset.entradaEstado ? { estado: preset.entradaEstado } : {}),
        ...(preset.entradaVal !== undefined ? { valorKmh: Number(preset.entradaVal) } : {}),
      });
    }
    if (preset.freioAtual !== undefined || preset.freioRef !== undefined) {
      this.setApexPonto('freio', {
        ...(preset.freioAtual !== undefined ? { atualM: Number(preset.freioAtual) } : {}),
        ...(preset.freioRef !== undefined ? { refM: Number(preset.freioRef) } : {}),
      });
    }
  }
}

// ── Helper puro: classifica freio atual vs referência (regra do mockup) ──
//
// Cor verde se atual ∈ ref ± 10%, vermelho fora. Mantém paridade com
// freioEstadoFromAtual() do cockpit.js (extraído do canônico).

export function classifyFreio(atualM, refM, tolerancePct = 0.10) {
  if (typeof atualM !== 'number' || typeof refM !== 'number' || refM <= 0) {
    return ApexEstado.OK_PIOR;
  }
  const tol = refM * tolerancePct;
  return Math.abs(atualM - refM) <= tol ? ApexEstado.OK_MELHOR : ApexEstado.OK_PIOR;
}
