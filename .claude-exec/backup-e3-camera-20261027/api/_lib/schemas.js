// ═══════════════════════════════════════════════════════════
// Schemas — validador lightweight pra payloads de API
// ═══════════════════════════════════════════════════════════
// Sem dependência externa (sem zod) pra não inflar Vercel build.
// API tipo zod-light: cada validador retorna { ok, value, errors }.
//
// Uso:
//   const r = ingestPayload.parse(body);
//   if (!r.ok) return res.status(400).json({ error: 'validation', issues: r.errors });
//   const { sessionId, chunkId, samples } = r.value;

function _err(path, msg) { return { path, msg }; }

const _types = {
  string: (val, opts = {}) => {
    if (typeof val !== 'string') return { ok: false, err: 'esperado string' };
    if (opts.min != null && val.length < opts.min) return { ok: false, err: `min ${opts.min}` };
    if (opts.max != null && val.length > opts.max) return { ok: false, err: `max ${opts.max}` };
    if (opts.regex && !opts.regex.test(val)) return { ok: false, err: `regex ${opts.regex}` };
    return { ok: true, val };
  },
  number: (val, opts = {}) => {
    if (typeof val !== 'number' || !isFinite(val)) return { ok: false, err: 'esperado number' };
    if (opts.min != null && val < opts.min) return { ok: false, err: `min ${opts.min}` };
    if (opts.max != null && val > opts.max) return { ok: false, err: `max ${opts.max}` };
    if (opts.int && !Number.isInteger(val)) return { ok: false, err: 'esperado inteiro' };
    return { ok: true, val };
  },
  boolean: (val) => {
    if (typeof val !== 'boolean') return { ok: false, err: 'esperado boolean' };
    return { ok: true, val };
  },
  array: (val, opts = {}) => {
    if (!Array.isArray(val)) return { ok: false, err: 'esperado array' };
    if (opts.min != null && val.length < opts.min) return { ok: false, err: `min ${opts.min} itens` };
    if (opts.max != null && val.length > opts.max) return { ok: false, err: `max ${opts.max} itens` };
    return { ok: true, val };
  },
  object: (val) => {
    if (val == null || typeof val !== 'object' || Array.isArray(val)) return { ok: false, err: 'esperado object' };
    return { ok: true, val };
  },
};

export function field(type, opts = {}) {
  return { _type: type, _opts: opts, optional: false };
}
export function optional(spec) {
  // Sub-schema (objeto) opcional ganha wrapper especial reconhecido por _validateObject.
  if (spec && !('_type' in spec)) return { __optionalObj: true, __schema: spec };
  return { ...spec, optional: true };
}

// item = field(...) ou objeto-schema (recursivo)
export function arrayOf(item, opts = {}) {
  return { _type: 'arrayOf', _item: item, _opts: opts, optional: false };
}

function _isSpec(x) {
  return x && typeof x === 'object' && '_type' in x;
}

function _validateValue(spec, val, path) {
  // null/undefined em campo optional → ok, value undefined
  if (val == null) {
    if (spec.optional) return { ok: true, value: undefined, errors: [] };
    return { ok: false, value: undefined, errors: [_err(path, 'obrigatório')] };
  }
  if (spec._type === 'arrayOf') {
    const ar = _types.array(val, spec._opts);
    if (!ar.ok) return { ok: false, value: undefined, errors: [_err(path, ar.err)] };
    const out = [];
    const errors = [];
    val.forEach((item, i) => {
      const itemPath = `${path}[${i}]`;
      const inner = _isSpec(spec._item) ? _validateValue(spec._item, item, itemPath) : _validateObject(spec._item, item, itemPath);
      if (!inner.ok) errors.push(...inner.errors);
      else out.push(inner.value);
    });
    if (errors.length) return { ok: false, value: undefined, errors };
    return { ok: true, value: out, errors: [] };
  }
  const validator = _types[spec._type];
  if (!validator) return { ok: false, value: undefined, errors: [_err(path, `tipo desconhecido ${spec._type}`)] };
  const r = validator(val, spec._opts);
  if (!r.ok) return { ok: false, value: undefined, errors: [_err(path, r.err)] };
  return { ok: true, value: r.val, errors: [] };
}

function _validateObject(schemaObj, val, basePath = '', { allowAbsent = false } = {}) {
  if (val == null) {
    if (allowAbsent) return { ok: true, value: undefined, errors: [] };
    return { ok: false, value: undefined, errors: [_err(basePath || '$', 'obrigatório')] };
  }
  const objCheck = _types.object(val);
  if (!objCheck.ok) return { ok: false, value: undefined, errors: [_err(basePath || '$', objCheck.err)] };
  const out = {};
  const errors = [];
  for (const [key, rawSpec] of Object.entries(schemaObj)) {
    const path = basePath ? `${basePath}.${key}` : key;
    const isOptionalSubObj = rawSpec && typeof rawSpec === 'object' && rawSpec.__optionalObj === true;
    const spec = isOptionalSubObj ? rawSpec.__schema : rawSpec;
    const inner = _isSpec(spec)
      ? _validateValue(spec, val[key], path)
      : _validateObject(spec, val[key], path, { allowAbsent: isOptionalSubObj });
    if (!inner.ok) errors.push(...inner.errors);
    else if (inner.value !== undefined) out[key] = inner.value;
  }
  if (errors.length) return { ok: false, value: undefined, errors };
  return { ok: true, value: out, errors: [] };
}

export function schema(definition) {
  return {
    parse(value) {
      const r = _validateObject(definition, value);
      return r;
    }
  };
}

// ─── Schemas concretos por endpoint ────────────────────────────────────────

// POST /api/ingest/iphone — captura GPS+sensors do cockpit
export const ingestPayload = schema({
  sessionId: field('string', { min: 1, max: 128 }),
  chunkId:   field('string', { min: 1, max: 128 }),
  samples:   arrayOf({
    t:             field('number', { min: 0 }),
    tMono:         field('number', { min: 0 }),
    source:        field('string', { min: 1, max: 64 }),
    signalQuality: field('string', { regex: /^(good|degraded|bad|lost|GOOD|DEGRADED|BAD|LOST)$/ }),
    lat:           optional(field('number', { min: -90, max: 90 })),
    lng:           optional(field('number', { min: -180, max: 180 })),
    speed:         optional(field('number', { min: 0, max: 200 })),
    heading:       optional(field('number', { min: 0, max: 360 })),
  }, { min: 0, max: 5000 }),
  deviceId: optional(field('string', { min: 1, max: 128 })),
});

// POST /api/advisor — análise inteligente de stint
export const advisorPayload = schema({
  stint: {
    laps: arrayOf({
      tempoMs: optional(field('number', { min: 0, max: 1800000 })),
      valida:  optional(field('boolean')),
    }, { min: 1, max: 200 }),
    voltasPlanejadas: optional(field('number', { min: 1, max: 200, int: true })),
    objetivo:         optional(field('string', { max: 64 })),
  },
  env: optional({
    pista:        optional(field('string', { max: 64 })),
    tempPista:    optional(field('number', { min: -10, max: 80 })),
    tempAr:       optional(field('number', { min: -10, max: 60 })),
  }),
  contexto: optional({
    pistaApelido: optional(field('string', { max: 64 })),
    carro:        optional(field('string', { max: 64 })),
  }),
  // MS-16.4 — findings codificados emitidos pela Camada 2 (CalibrationEngine).
  // Quando presentes, IA prioriza/explica/valida em vez de tentar inferir
  // hipóteses do zero. Cada finding já tem evidência objetiva + confiança.
  findings: optional(arrayOf({
    id:         field('string', { max: 64 }),
    ruleId:     field('string', { max: 64 }),
    titulo:     field('string', { max: 200 }),
    descricao:  optional(field('string', { max: 1000 })),
    severidade: field('string', { regex: /^(info|atencao|alta)$/ }),
    confianca:  field('string', { regex: /^(Alta|Média|Baixa)$/ }),
    escopo:     optional(field('string', { regex: /^(stint|lap|segment|cell)$/ })),
    segmentId:  optional(field('string', { max: 128 })),
    lapNumero:  optional(field('number', { min: 0, max: 999, int: true })),
  }, { min: 0, max: 50 })),
});

// POST /api/post-stint — análise pós-stint completa
export const postStintPayload = schema({
  stint: {
    laps: arrayOf({
      tempoMs: optional(field('number', { min: 0, max: 1800000 })),
      valida:  optional(field('boolean')),
      numero:  optional(field('number', { min: 1, max: 999, int: true })),
    }, { min: 0, max: 200 }),
  },
  env:      optional({}),
  plano:    optional({}),
  contexto: optional({}),
});

// POST /api/post-event — análise consolidada do evento
export const postEventPayload = schema({
  evento: {
    nome: field('string', { min: 1, max: 128 }),
    data: optional(field('string', { regex: /^\d{4}-\d{2}-\d{2}$/ })),
    objetivo: optional(field('string', { max: 256 })),
  },
  stints: arrayOf({
    laps: arrayOf({
      tempoMs: optional(field('number', { min: 0, max: 1800000 })),
      valida:  optional(field('boolean')),
    }, { min: 0, max: 200 }),
  }, { min: 0, max: 100 }),
  contexto: optional({
    pistaApelido: optional(field('string', { max: 64 })),
  }),
});

// POST /api/video/room — sala Daily.co determinística
export const videoRoomPayload = schema({
  eventId: field('string', { min: 1, max: 128, regex: /^[a-zA-Z0-9_-]+$/ }),
  dateISO: field('string', { regex: /^\d{4}-\d{2}-\d{2}$/ }),
  sessionId: optional(field('string', { min: 1, max: 128 })),
});

// Helper de resposta padronizada
export function respondInvalid(res, parseResult) {
  return res.status(400).json({
    ok: false,
    error: 'validation',
    issues: parseResult.errors,
  });
}
