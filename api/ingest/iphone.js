// ═══════════════════════════════════════════════════════════
// /api/ingest/iphone — recebe Samples do iPhone (cockpit-mobile)
// ═══════════════════════════════════════════════════════════
// Vercel serverless function (Node runtime). Recebe chunk de samples
// canônicos + persiste em Vercel Blob.
//
// Etapa 3 do PLANO_PERNA1_IPHONE.md (2026-04-26).
//
// Storage: Vercel Blob (decisão Flavio — setup zero, ~$0.01/sessão).
// Schema:
//   key:  `samples/{sessionId}/{chunkId}.json`
//   body: { sessionId, chunkId, samples: [...], firstT, lastT, count, sources, signalSummary, deviceId, ingestedAt }
//   ttl:  manual cleanup (cron mensal — não automático)
//
// Idempotência: se mesmo `{sessionId, chunkId}` chegar 2× (retry),
// segundo upload sobrescreve o primeiro (`addRandomSuffix: false` +
// `allowOverwrite: true`). Mesmo conteúdo = mesma key = no-op efetivo.
//
// Input (POST JSON):
//   {
//     deviceId?: string,
//     sessionId: string,    OBRIGATÓRIO pra persistência
//     chunkId: string,      OBRIGATÓRIO pra idempotência
//     samples: [
//       { t, tMono, source, signalQuality, lat?, lng?, speed?, ... }
//     ]
//   }
//
// Output (JSON):
//   { ok: true, count, firstT, lastT, sources, signalSummary,
//     persisted: true|false, blobUrl?, alreadyUploaded? }

import { guardRequest } from '../_lib/security.js';

const MAX_SAMPLES_PER_REQUEST = 1000;

function summarizeSamples(samples) {
  if (!Array.isArray(samples) || samples.length === 0) {
    return { count: 0, firstT: null, lastT: null, sources: [], signalSummary: {} };
  }
  let firstT = Infinity, lastT = -Infinity;
  const sources = new Set();
  const signalSummary = {};
  for (const s of samples) {
    if (typeof s.t === 'number') {
      if (s.t < firstT) firstT = s.t;
      if (s.t > lastT)  lastT  = s.t;
    }
    if (typeof s.source === 'string') sources.add(s.source);
    const q = s.signalQuality || 'UNKNOWN';
    signalSummary[q] = (signalSummary[q] || 0) + 1;
  }
  return {
    count: samples.length,
    firstT: Number.isFinite(firstT) ? firstT : null,
    lastT:  Number.isFinite(lastT)  ? lastT  : null,
    sources: [...sources],
    signalSummary,
  };
}

function validateSample(s) {
  if (typeof s !== 'object' || s == null) return 'sample-nao-objeto';
  if (typeof s.t !== 'number')             return 'sample-sem-t';
  if (typeof s.tMono !== 'number')         return 'sample-sem-tMono';
  if (typeof s.source !== 'string')        return 'sample-sem-source';
  if (typeof s.signalQuality !== 'string') return 'sample-sem-signalQuality';
  return null;
}

function safeId(s) {
  // Sanitiza pra usar em path de Blob (sem '/', '..', etc)
  return String(s || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
}

export default async function handler(req, res) {
  if (!guardRequest(req, res, { endpoint: 'ingest-iphone' })) return;

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'body JSON inválido' });
  }
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'body ausente ou inválido' });
  }

  const samples = body.samples;
  if (!Array.isArray(samples)) {
    return res.status(400).json({ error: 'campo samples deve ser array' });
  }
  if (samples.length === 0) {
    return res.status(200).json({ ok: true, count: 0, note: 'array vazio aceito (heartbeat)' });
  }
  if (samples.length > MAX_SAMPLES_PER_REQUEST) {
    return res.status(413).json({
      error: 'samples acima do limite por request',
      limit: MAX_SAMPLES_PER_REQUEST,
      received: samples.length,
    });
  }

  for (let i = 0; i < samples.length; i++) {
    const erro = validateSample(samples[i]);
    if (erro) {
      return res.status(400).json({
        error: 'sample inválido',
        index: i,
        razao: erro,
        sample: samples[i],
      });
    }
  }

  const summary = summarizeSamples(samples);
  const sessionId = body.sessionId ? safeId(body.sessionId) : null;
  const chunkId   = body.chunkId   ? safeId(body.chunkId)   : null;

  // Quando há samples reais, sessionId+chunkId são obrigatórios — sem eles
  // o blob não é gravado e o cliente não tem como retry. Antes era silent
  // (200 OK sem persistir), o que mascarava perda de dados.
  if (samples.length > 0 && (!sessionId || !chunkId)) {
    return res.status(400).json({
      error: 'sessionId e chunkId obrigatórios quando há samples',
      hint: 'envie {sessionId, chunkId, samples[]} — sem isso o servidor não consegue persistir o chunk',
      received: { hasSessionId: !!sessionId, hasChunkId: !!chunkId, sampleCount: samples.length },
    });
  }

  // Persistência Vercel Blob — só ativa quando BLOB_READ_WRITE_TOKEN
  // configurado E sessionId+chunkId presentes. Cliente legacy (sem
  // chunkId) ainda funciona, mas vira heartbeat (não persiste).
  let persisted = false;
  let blobUrl = null;
  if (sessionId && chunkId && process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      // Import dinâmico — evita carregar @vercel/blob em chamadas
      // que só fazem heartbeat (sem chunkId)
      const { put } = await import('@vercel/blob');
      const key = `samples/${sessionId}/${chunkId}.json`;
      const payload = JSON.stringify({
        deviceId: body.deviceId || null,
        sessionId,
        chunkId,
        ...summary,
        samples,
        ingestedAt: Date.now(),
      });
      const result = await put(key, payload, {
        // @vercel/blob SDK 0.27: `access:'public'` é o único modo suportado
        // hoje (samples = GPS+IMU sem credenciais, baixo risco). URL é
        // adivinhável só com a chave aleatória que o Blob gera; sem
        // BLOB_READ_WRITE_TOKEN, ninguém lista ou enumera.
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: false,    // idempotência: mesmo chunkId = mesma key
        allowOverwrite: true,      // retry seguro: 2ª chamada sobrescreve
      });
      persisted = true;
      blobUrl = result.url;
    } catch (err) {
      // Não falha a request — cliente já tem dado local
      // (Etapa 2). Servidor reporta `persisted: false` pro cliente
      // saber pra retry futuro (uploader marca chunk como NÃO uploaded).
      console.warn('[ingest-iphone] persist blob falhou', String(err).slice(0, 200));
      return res.status(502).json({
        error: 'persist falhou',
        detail: String(err).slice(0, 200),
        ...summary,
        persisted: false,
      });
    }
  }

  return res.status(200).json({
    ok: true,
    deviceId: body.deviceId || null,
    sessionId,
    chunkId,
    ...summary,
    persisted,
    blobUrl,
    note: persisted
      ? 'persistido em Vercel Blob'
      : (sessionId && chunkId)
        ? 'BLOB_READ_WRITE_TOKEN não configurada — apenas validado'
        : 'heartbeat — sessionId+chunkId ausentes, não persiste',
  });
}
