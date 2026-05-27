// ═══════════════════════════════════════════════════════════
// supabase/functions/daily-recording-hook — webhook da Daily.co
// ═══════════════════════════════════════════════════════════
// Recebe o aviso (webhook) da Daily.co quando uma gravação fica pronta
// pra download (evento `recording.ready-to-download`). Atualiza
// `video_streams` com `recording_id`, `s3_key`, duração, etc.
//
// Segurança:
//   - Validação HMAC SHA-256 com `X-Webhook-Signature` (Daily.co).
//   - Segredo `DAILY_WEBHOOK_SECRET` (base64) configurado como segredo
//     do Supabase Edge Functions.
//   - Rejeita timestamp mais antigo que 5 minutos (replay protection).
//   - Handshake: a Daily.co manda POST {"type":"test","id":"test-id"}
//     ao criar/atualizar o webhook — respondemos 200 imediatamente.
//
// Versão minimalista (sem supabase-js) — chama PostgREST direto via
// fetch usando service_role JWT. Reduz cold-start.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const MAX_SKEW_S = 5 * 60;
const SUPA = Deno.env.get("SUPABASE_URL") ?? "";
const SVC  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SEC  = Deno.env.get("DAILY_WEBHOOK_SECRET") ?? "";

function json(s: number, b: unknown): Response {
  return new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });
}

async function valida(body: string, sig: string | null): Promise<boolean> {
  if (!sig || !SEC) return false;
  const keyBytes = Uint8Array.from(atob(SEC), c => c.charCodeAt(0));
  const k = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const s = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(body));
  const hex = Array.from(new Uint8Array(s)).map(b => b.toString(16).padStart(2, "0")).join("");
  if (hex.length !== sig.length) return false;
  let eq = 0;
  for (let i = 0; i < hex.length; i++) eq |= hex.charCodeAt(i) ^ sig.charCodeAt(i);
  return eq === 0;
}

serve(async (req) => {
  // GET/HEAD = handshake do gateway/uptime
  if (req.method === "GET" || req.method === "HEAD") return json(200, { ok: true, handshake: req.method });
  if (req.method !== "POST") return json(405, { error: "method-not-allowed" });

  const body = await req.text();
  // Handshake: body vazio ou payload de teste da Daily.co
  if (!body || body.trim() === "" || body.trim() === "{}") return json(200, { ok: true, handshake: "empty" });
  try {
    const p = JSON.parse(body);
    if (p && (p.test === true || p.type === "test" || p.type === "ping" || p.type === "verify")) {
      return json(200, { ok: true, handshake: p.type ?? "test" });
    }
  } catch (_e) { /* segue */ }

  // Evento real: exige env + assinatura
  if (!SUPA || !SVC) return json(500, { error: "env-missing-supabase" });
  if (!SEC) return json(500, { error: "env-missing-DAILY_WEBHOOK_SECRET" });

  const ts = req.headers.get("x-webhook-timestamp");
  if (ts) {
    const n = Number(ts);
    if (Number.isFinite(n)) {
      const agora = Math.floor(Date.now() / 1000);
      if (Math.abs(agora - n) > MAX_SKEW_S) return json(401, { error: "timestamp-fora-da-janela" });
    }
  }

  if (!(await valida(body, req.headers.get("x-webhook-signature")))) {
    return json(401, { error: "assinatura-invalida" });
  }

  let event: any;
  try { event = JSON.parse(body); } catch { return json(400, { error: "json-invalido" }); }
  if (event.type !== "recording.ready-to-download") return json(200, { ok: true, ignored: true });

  // Daily.co às vezes aninha payload.payload
  const pl = event.payload?.payload ?? event.payload;
  if (!pl?.recording_id || !pl?.room_name) return json(400, { error: "campos-obrigatorios-ausentes" });

  // Busca stream pelo daily_room_name
  const sel = await fetch(`${SUPA}/rest/v1/video_streams?daily_room_name=eq.${encodeURIComponent(pl.room_name)}&select=id,recording_id&order=created_at.desc&limit=1`, {
    headers: { apikey: SVC, authorization: `Bearer ${SVC}` },
  });
  const arr = await sel.json();
  if (!Array.isArray(arr) || arr.length === 0) {
    // Não achou — 200 evita Daily.co reentregar em loop
    return json(200, { ok: true, warning: "stream-nao-encontrado", room: pl.room_name });
  }

  const stream = arr[0];
  // Idempotência
  if (stream.recording_id === pl.recording_id) return json(200, { ok: true, already_recorded: true });

  const startedAt = pl.start_ts ? new Date(pl.start_ts * 1000).toISOString() : null;
  const upd = await fetch(`${SUPA}/rest/v1/video_streams?id=eq.${stream.id}`, {
    method: "PATCH",
    headers: { apikey: SVC, authorization: `Bearer ${SVC}`, "content-type": "application/json", prefer: "return=minimal" },
    body: JSON.stringify({
      recording_id: pl.recording_id,
      recording_s3_key: pl.s3_key ?? null,
      recording_duration_s: pl.duration ?? null,
      recording_max_participants: pl.max_participants ?? null,
      recording_started_at: startedAt,
      recording_ready_at: new Date().toISOString(),
    }),
  });
  if (!upd.ok) {
    const t = await upd.text();
    return json(500, { error: "db-update-erro", detail: t.slice(0, 200) });
  }
  return json(200, { ok: true, stream_id: stream.id, recording_id: pl.recording_id });
});
