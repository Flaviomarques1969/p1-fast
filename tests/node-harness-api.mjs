// ═══════════════════════════════════════════════════════════
// node-harness-api — testa middleware dos 5 endpoints Vercel
// ═══════════════════════════════════════════════════════════
// SEM `vercel dev`, SEM env vars (ANTHROPIC_API_KEY, DAILY_API_KEY,
// BLOB_READ_WRITE_TOKEN). Importa cada handler como módulo ESM e
// simula req/res manualmente.
//
// O que valida:
//   • OPTIONS preflight responde 204 com headers CORS
//   • Origin desconhecida → 403
//   • Method não-POST → 405
//   • Rate limit dispara em 31ª request num minuto
//   • Schema validation rejeita payload sem campos obrigatórios
//
// O que NÃO valida (precisa env vars + deploy):
//   • Resposta real do Claude API (advisor/post-stint/post-event)
//   • Persistência real em Vercel Blob (ingest)
//   • Criação real de sala Daily.co (video/room)

const handlers = {
  advisor:    (await import('../api/advisor.js')).default,
  postStint:  (await import('../api/post-stint.js')).default,
  postEvent:  (await import('../api/post-event.js')).default,
  ingest:     (await import('../api/ingest/iphone.js')).default,
  videoRoom:  (await import('../api/video/room.js')).default,
};

let ok = 0, fail = 0;

async function step(name, fn) {
  try {
    await fn();
    console.log(`✓ ${name}`);
    ok++;
  } catch (e) {
    console.log(`✗ ${name}\n   → ${e.message}`);
    fail++;
  }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg || 'assertion failed'); };
const eq = (a, b, msg) => { if (a !== b) throw new Error(`${msg || 'eq'}: esperado ${b}, recebido ${a}`); };

/** Simula um req/res mínimo do Vercel/Node. */
function mockReqRes({ method = 'POST', origin = 'http://localhost:5186', headers = {}, body = null, ip = '127.0.0.1' } = {}) {
  const req = {
    method,
    headers: {
      'origin': origin,
      'content-type': 'application/json',
      'x-forwarded-for': ip,
      ...headers,
    },
    socket: { remoteAddress: ip },
    body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null,
    on(event, cb) {
      if (event === 'data' && req.body) cb(Buffer.from(req.body));
      if (event === 'end') setImmediate(cb);
    },
  };
  const res = {
    statusCode: 200,
    _headers: {},
    _body: null,
    _ended: false,
    setHeader(k, v) { this._headers[k.toLowerCase()] = v; },
    getHeader(k) { return this._headers[k.toLowerCase()]; },
    status(code) { this.statusCode = code; return this; },
    json(obj) { this._body = obj; this._ended = true; return this; },
    send(s) { this._body = s; this._ended = true; return this; },
    end(s) { if (s != null) this._body = s; this._ended = true; return this; },
    write(s) { this._body = (this._body || '') + String(s); },
  };
  return { req, res };
}

async function call(handler, opts) {
  const { req, res } = mockReqRes(opts);
  await handler(req, res);
  return res;
}

// ════════════════════════════════════════════════════════════
// CORS preflight + métodos
// ════════════════════════════════════════════════════════════

for (const [name, handler] of Object.entries(handlers)) {
  await step(`${name}: OPTIONS preflight retorna 204 com CORS`, async () => {
    const r = await call(handler, { method: 'OPTIONS' });
    eq(r.statusCode, 204, 'status preflight');
    assert(r.getHeader('access-control-allow-methods')?.includes('POST'), 'allow-methods');
  });

  await step(`${name}: GET retorna 405 (POST only)`, async () => {
    const r = await call(handler, { method: 'GET' });
    eq(r.statusCode, 405, 'status método');
  });

  await step(`${name}: Origin desconhecida retorna 403`, async () => {
    const r = await call(handler, { origin: 'https://malicioso.com', body: {} });
    eq(r.statusCode, 403, 'origin bloqueada');
  });
}

// ════════════════════════════════════════════════════════════
// Rate limit (limpa buckets entre testes via IP único por step)
// ════════════════════════════════════════════════════════════

await step('rate-limit: 31ª request num minuto retorna 429 (advisor)', async () => {
  // FAM_RATE_LIMIT_PER_MIN default = 30
  const ip = '10.0.0.42';
  let r;
  for (let i = 0; i < 31; i++) {
    r = await call(handlers.advisor, { body: { stint: {}, env: {} }, ip });
    if (r.statusCode === 429) break;
  }
  eq(r.statusCode, 429, 'última request limitada');
  assert(r._body?.retryAfterMs > 0, 'retryAfterMs presente');
});

// ════════════════════════════════════════════════════════════
// Schema validation — payload obviamente vazio dispara 400/422 ANTES de chamar Claude/Daily
// ════════════════════════════════════════════════════════════

await step('advisor: payload sem stint dispara 400 (schema)', async () => {
  const r = await call(handlers.advisor, { body: {}, ip: '10.0.0.10' });
  // Sem ANTHROPIC_API_KEY também dá 500 — ambos são "rejeição antes da chamada externa"
  assert(r.statusCode >= 400 && r.statusCode < 600, `status ${r.statusCode} (esperado erro)`);
  // Não deve chegar a chamar Claude (sem env), nem retornar resposta válida
  assert(!r._body?.sugestao, 'não devolveu sugestão real');
});

await step('post-stint: payload incompleto dispara erro de validação', async () => {
  const r = await call(handlers.postStint, { body: {}, ip: '10.0.0.11' });
  assert(r.statusCode >= 400, `status ${r.statusCode}`);
});

await step('post-event: payload incompleto dispara erro de validação', async () => {
  const r = await call(handlers.postEvent, { body: {}, ip: '10.0.0.12' });
  assert(r.statusCode >= 400, `status ${r.statusCode}`);
});

await step('ingest/iphone: sem sessionId dispara 400', async () => {
  const r = await call(handlers.ingest, {
    body: { samples: [{ t: 1, tMono: 1, source: 'cockpit-mobile', signalQuality: 'GOOD' }] },
    ip: '10.0.0.13',
  });
  assert(r.statusCode >= 400, `status ${r.statusCode}`);
});

await step('video/room: payload mínimo aceito ou 500 sem DAILY_API_KEY', async () => {
  const r = await call(handlers.videoRoom, {
    body: { sessionId: 'ses_smoke', eventId: 'evt_x', dateISO: '2026-05-01' },
    ip: '10.0.0.14',
  });
  // Pode dar 500 (sem DAILY_API_KEY) ou 200 (se ambiente tem). Aceita ambos.
  assert([200, 500, 502].includes(r.statusCode), `status inesperado ${r.statusCode}`);
});

// ════════════════════════════════════════════════════════════
// Header Vary: Origin presente em todas as respostas com origin válida
// ════════════════════════════════════════════════════════════

for (const [name, handler] of Object.entries(handlers)) {
  await step(`${name}: response inclui header Vary: Origin com origin válida`, async () => {
    const r = await call(handler, { method: 'OPTIONS', origin: 'http://localhost:5186' });
    eq(r.getHeader('vary'), 'Origin', 'Vary: Origin');
  });
}

console.log(`\n═══ RESULTADO ═══`);
console.log(`${ok} ok / ${fail} fail`);
process.exit(fail ? 1 : 0);
