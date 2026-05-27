// Smoke da Edge Function `daily-recording-hook`. Testa:
//   - Validação HMAC SHA-256
//   - Replay protection (timestamp fora da janela)
//   - Parse de payload aninhado (Daily.co às vezes aninha `payload.payload`)
//   - Filtro de tipo de evento
//   - Asserções estruturais sobre o source TS
//
// E2E real (com Supabase + Daily.co) depende de DAILY_WEBHOOK_SECRET
// configurado no painel — não é parte deste smoke.

import { readFile } from 'node:fs/promises';
import { createHmac, randomBytes } from 'node:crypto';

const src = await readFile('supabase/functions/daily-recording-hook/index.ts', 'utf8');

let ok = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log('✓', name); ok++; }
  catch (e) { console.log('✗', name, '—', e.message); fail++; }
}

// ─── Re-impl JS pura — paridade com a TS ──────────────────

function validarAssinatura(bodyTexto, assinaturaHex, segredoBase64) {
  if (!assinaturaHex) return false;
  let keyBytes;
  try { keyBytes = Buffer.from(segredoBase64, 'base64'); }
  catch { return false; }
  const hmac = createHmac('sha256', keyBytes);
  hmac.update(bodyTexto, 'utf8');
  const sigHex = hmac.digest('hex');
  if (sigHex.length !== assinaturaHex.length) return false;
  let igual = 0;
  for (let i = 0; i < sigHex.length; i++) {
    igual |= sigHex.charCodeAt(i) ^ assinaturaHex.charCodeAt(i);
  }
  return igual === 0;
}

function extrairPayload(event) {
  const p = event.payload;
  if (!p) return undefined;
  return p.payload ?? p;
}

const MAX_TIMESTAMP_SKEW_SECONDS = 5 * 60;

function timestampValido(timestampStr, agoraSegundos) {
  if (!timestampStr) return true;
  const ts = Number(timestampStr);
  if (!Number.isFinite(ts)) return true;
  return Math.abs(agoraSegundos - ts) <= MAX_TIMESTAMP_SKEW_SECONDS;
}

// ─── Fixtures ─────────────────────────────────────────────

const segredoB64 = Buffer.from('chave-de-teste-bem-longa-pra-bater-com-base64-de-daily', 'utf8').toString('base64');

const payloadCanonico = {
  version: '1.0.0',
  type: 'recording.ready-to-download',
  id: 'evt_test_001',
  event_ts: 1714693200,
  payload: {
    type: 'cloud',
    recording_id: 'rec_abc123',
    room_name: 'evento-12345-20260526',
    start_ts: 1714693100,
    status: 'finished',
    max_participants: 2,
    duration: 1200,
    s3_key: 'recordings/rec_abc123.mp4',
  },
};

// Daily.co às vezes aninha payload.payload — fixture com aninhamento.
const payloadAninhado = {
  type: 'recording.ready-to-download',
  payload: {
    payload: payloadCanonico.payload,
  },
};

function gerarAssinatura(bodyTexto, segredo) {
  const hmac = createHmac('sha256', Buffer.from(segredo, 'base64'));
  hmac.update(bodyTexto, 'utf8');
  return hmac.digest('hex');
}

// ─── Testes de assinatura ─────────────────────────────────

t('DW-01: assinatura HMAC válida é aceita', () => {
  const body = JSON.stringify(payloadCanonico);
  const sig = gerarAssinatura(body, segredoB64);
  if (!validarAssinatura(body, sig, segredoB64)) {
    throw new Error('assinatura válida foi rejeitada');
  }
});

t('DW-02: assinatura HMAC errada é rejeitada', () => {
  const body = JSON.stringify(payloadCanonico);
  const sigErrada = '0'.repeat(64);
  if (validarAssinatura(body, sigErrada, segredoB64)) {
    throw new Error('assinatura inválida foi aceita');
  }
});

t('DW-03: assinatura ausente é rejeitada', () => {
  const body = JSON.stringify(payloadCanonico);
  if (validarAssinatura(body, null, segredoB64)) {
    throw new Error('assinatura nula foi aceita');
  }
});

t('DW-04: assinatura de body diferente é rejeitada', () => {
  const body1 = JSON.stringify(payloadCanonico);
  const body2 = JSON.stringify({ ...payloadCanonico, id: 'evt_outro' });
  const sigBody1 = gerarAssinatura(body1, segredoB64);
  if (validarAssinatura(body2, sigBody1, segredoB64)) {
    throw new Error('assinatura cross-body foi aceita (proteção quebrada)');
  }
});

t('DW-05: segredo errado falha validação', () => {
  const body = JSON.stringify(payloadCanonico);
  const sig = gerarAssinatura(body, segredoB64);
  const outroSegredo = Buffer.from('outro-segredo-diferente-completo', 'utf8').toString('base64');
  if (validarAssinatura(body, sig, outroSegredo)) {
    throw new Error('segredo errado aceitou (chave HMAC vazando?)');
  }
});

// ─── Testes de timestamp ──────────────────────────────────

t('DW-06: timestamp dentro da janela é aceito', () => {
  const agora = Math.floor(Date.now() / 1000);
  if (!timestampValido(String(agora), agora)) {
    throw new Error('timestamp do agora rejeitado');
  }
  if (!timestampValido(String(agora - 30), agora)) {
    throw new Error('timestamp de 30s atrás rejeitado');
  }
});

t('DW-07: timestamp velho (> 5 min) é rejeitado', () => {
  const agora = Math.floor(Date.now() / 1000);
  const seisMinutosAtras = agora - (6 * 60);
  if (timestampValido(String(seisMinutosAtras), agora)) {
    throw new Error('timestamp de 6 min atrás aceito');
  }
});

t('DW-08: timestamp futuro (> 5 min adiante) é rejeitado', () => {
  const agora = Math.floor(Date.now() / 1000);
  const seisMinutosFrente = agora + (6 * 60);
  if (timestampValido(String(seisMinutosFrente), agora)) {
    throw new Error('timestamp futuro aceito');
  }
});

t('DW-09: timestamp ausente é aceito (Daily.co pode não mandar em alguns eventos)', () => {
  const agora = Math.floor(Date.now() / 1000);
  if (!timestampValido(null, agora)) {
    throw new Error('timestamp ausente foi rejeitado (proteção comeu o evento legítimo)');
  }
});

t('DW-10: timestamp não-numérico é aceito (defensive — não trava)', () => {
  const agora = Math.floor(Date.now() / 1000);
  if (!timestampValido('abc', agora)) {
    throw new Error('timestamp não-numérico travou');
  }
});

// ─── Testes de extração de payload ────────────────────────

t('DW-11: extrairPayload retorna payload direto', () => {
  const p = extrairPayload(payloadCanonico);
  if (!p || p.recording_id !== 'rec_abc123') {
    throw new Error('payload direto não extraído');
  }
});

t('DW-12: extrairPayload achatado lê aninhado payload.payload', () => {
  const p = extrairPayload(payloadAninhado);
  if (!p || p.recording_id !== 'rec_abc123') {
    throw new Error('payload aninhado não foi achatado');
  }
});

t('DW-13: extrairPayload retorna undefined sem payload', () => {
  const p = extrairPayload({ type: 'recording.ready-to-download' });
  if (p !== undefined) {
    throw new Error('deveria retornar undefined');
  }
});

// ─── Asserções estruturais sobre o source TS ──────────────

t('DW-14: source TS decodifica base64 do segredo (atob nativo)', () => {
  if (!/atob\(SEC\)/.test(src)) {
    throw new Error('source não usa atob pra decodificar segredo');
  }
});

t('DW-15: source TS usa MAX_SKEW_S = 5 * 60 (replay protection 5 min)', () => {
  if (!/MAX_SKEW_S\s*=\s*5\s*\*\s*60/.test(src)) {
    throw new Error('constante de janela de tempo não encontrada');
  }
});

t('DW-16: source TS exige DAILY_WEBHOOK_SECRET', () => {
  if (!/DAILY_WEBHOOK_SECRET/.test(src)) {
    throw new Error('source não menciona DAILY_WEBHOOK_SECRET');
  }
});

t('DW-17: source TS filtra type recording.ready-to-download', () => {
  if (!/recording\.ready-to-download/.test(src)) {
    throw new Error('source não filtra evento recording.ready-to-download');
  }
});

t('DW-18: source TS atualiza tabela video_streams via REST', () => {
  if (!/video_streams\?id=eq/.test(src)) {
    throw new Error('source não atualiza video_streams via REST PATCH');
  }
});

t('DW-19: source TS rejeita métodos não-POST (exceto GET/HEAD handshake)', () => {
  if (!/method-not-allowed/.test(src) || !/req\.method === "GET"/.test(src)) {
    throw new Error('source não trata GET handshake nem rejeita métodos não-POST');
  }
});

t('DW-20: source TS valida campos obrigatórios recording_id e room_name', () => {
  if (!/recording_id.*room_name|room_name.*recording_id/.test(src)) {
    throw new Error('source não menciona ambos os campos obrigatórios');
  }
});

t('DW-21: idempotência por recording_id presente no source', () => {
  if (!/already_recorded|stream\.recording_id/.test(src)) {
    throw new Error('source não tem idempotência por recording_id');
  }
});

t('DW-22: source retorna 200 quando stream não encontrado (evita reentrega)', () => {
  if (!/stream-nao-encontrado/.test(src)) {
    throw new Error('source não tem fallback de stream-nao-encontrado');
  }
});

// ─── Sumário ─────────────────────────────────────────────

console.log(`\n${ok} ok / ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
