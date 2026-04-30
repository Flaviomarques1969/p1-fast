// ═══════════════════════════════════════════════════════════
// security — CORS allowlist + rate limit in-memory
// ═══════════════════════════════════════════════════════════
// Usado por /api/advisor e /api/post-stint. Reduz blast radius:
//   - Origin allowlist: bloqueia sites de terceiros queimando a
//     ANTHROPIC_API_KEY do Flavio.
//   - Rate limit simples por IP: 30 req / 60s por endpoint.
//     In-memory → reseta a cada cold start da function (aceitável
//     no perfil de uso pessoal; se ficar insuficiente, migrar pra
//     Vercel KV).
//
// Pode ser afrouxado via env:
//   FAM_ALLOWED_ORIGINS=https://fam-racing.vercel.app,https://foo.bar
//   FAM_RATE_LIMIT_PER_MIN=30

const DEFAULT_ALLOWED = [
  'https://fam-racing.vercel.app',
  'http://localhost:5186',
  'http://localhost:5187',
  'http://127.0.0.1:5186',
  'http://127.0.0.1:5187',
];

function allowedOrigins() {
  const env = process.env.FAM_ALLOWED_ORIGINS;
  if (!env) return DEFAULT_ALLOWED;
  return env.split(',').map(s => s.trim()).filter(Boolean);
}

function pickOrigin(reqOrigin) {
  const list = allowedOrigins();
  if (!reqOrigin) return null;
  return list.includes(reqOrigin) ? reqOrigin : null;
}

const RATE_WINDOW_MS = 60_000;
const buckets = new Map();

function rateLimitKey(req, endpoint) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || req.socket?.remoteAddress
    || 'unknown';
  return `${endpoint}:${ip}`;
}

function rateLimit(req, endpoint) {
  const max = Number(process.env.FAM_RATE_LIMIT_PER_MIN) || 30;
  const key = rateLimitKey(req, endpoint);
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry || now - entry.start > RATE_WINDOW_MS) {
    buckets.set(key, { start: now, count: 1 });
    return { ok: true, remaining: max - 1 };
  }
  entry.count += 1;
  if (entry.count > max) {
    return { ok: false, retryAfterMs: RATE_WINDOW_MS - (now - entry.start) };
  }
  return { ok: true, remaining: max - entry.count };
}

/**
 * Aplica CORS + rate limit. Retorna `true` se a request pode prosseguir,
 * `false` se já respondeu (caller deve retornar).
 */
export function guardRequest(req, res, { endpoint } = {}) {
  const reqOrigin = req.headers.origin || '';
  const origin = pickOrigin(reqOrigin);

  // Preflight
  if (req.method === 'OPTIONS') {
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '600');
    res.status(204).end();
    return false;
  }

  // Origin enforcement (browsers). Server-to-server (sem Origin) passa.
  if (reqOrigin && !origin) {
    res.status(403).json({ error: 'origin não permitida', origin: reqOrigin });
    return false;
  }

  // Method
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' });
    return false;
  }

  // Rate limit
  const rl = rateLimit(req, endpoint || 'default');
  if (!rl.ok) {
    res.setHeader('Retry-After', Math.ceil(rl.retryAfterMs / 1000));
    res.status(429).json({ error: 'rate limit', retryAfterMs: rl.retryAfterMs });
    return false;
  }

  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  return true;
}
