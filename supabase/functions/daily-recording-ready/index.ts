// ═══════════════════════════════════════════════════════════
// supabase/functions/daily-recording-ready — webhook da Daily.co
// ═══════════════════════════════════════════════════════════
// Recebe o aviso (webhook) da Daily.co quando uma gravação fica pronta
// pra download (evento `recording.ready-to-download`). Atualiza
// `video_streams` com `recording_id`, `s3_key`, duração, etc.
//
// Segurança:
//   - Validação HMAC SHA-256 com `X-Webhook-Signature` (Daily.co).
//   - Segredo `DAILY_WEBHOOK_SECRET` (base64) configurado como segredo
//     do Supabase Edge Functions (NÃO confundir com `DAILY_API_KEY`).
//   - Rejeita timestamp mais antigo que 5 minutos (replay protection).
//
// Como a Daily.co é configurada:
//   1. Painel Daily.co → Webhooks → Create webhook
//   2. URL: https://<projeto>.functions.supabase.co/daily-recording-ready
//   3. Event types: `recording.ready-to-download`
//   4. Use o segredo gerado pela Daily.co (base64). Copie pro Supabase
//      como `DAILY_WEBHOOK_SECRET`.
//
// Idempotência:
//   - Se o mesmo `recording_id` chegar 2 vezes, a 2ª é no-op.
//   - Se não acharmos o `video_streams` pelo `room_name`, retorna 200
//     mesmo assim (Daily.co não deve reentregar) e loga warning.

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { decodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const MAX_TIMESTAMP_SKEW_SECONDS = 5 * 60;

interface DailyWebhookEvent {
  version?: string;
  type?: string;
  id?: string;
  event_ts?: number;
  payload?: {
    type?: string;
    recording_id?: string;
    room_name?: string;
    start_ts?: number;
    status?: string;
    max_participants?: number;
    duration?: number;
    s3_key?: string;
    // Daily.co às vezes aninha um segundo `payload` — a função aceita
    // ambos os formatos (raiz e aninhado) e dá preferência ao mais
    // específico.
    payload?: DailyWebhookEvent["payload"];
  };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

/**
 * Valida assinatura HMAC SHA-256 do webhook Daily.co.
 *
 * Daily.co assina o body cru (UTF-8) com o segredo (base64-decoded como
 * bytes da chave). Resultado é hex. Header esperado: `X-Webhook-Signature`.
 *
 * Se o formato real da Daily.co diferir (ex: timestamp + "." + body, como
 * Stripe), ajustar aqui. Inicialmente assume "só body cru" — padrão mais
 * comum em webhooks.
 */
async function validarAssinatura(
  bodyTexto: string,
  assinaturaHex: string | null,
  segredoBase64: string,
): Promise<boolean> {
  if (!assinaturaHex) return false;
  let keyBytes: Uint8Array;
  try {
    keyBytes = decodeBase64(segredoBase64);
  } catch {
    return false;
  }
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(bodyTexto),
  );
  const sigHex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  // Comparação constante-no-tempo
  if (sigHex.length !== assinaturaHex.length) return false;
  let igual = 0;
  for (let i = 0; i < sigHex.length; i++) {
    igual |= sigHex.charCodeAt(i) ^ assinaturaHex.charCodeAt(i);
  }
  return igual === 0;
}

/** Achata payload aninhado: aceita event.payload.payload OU event.payload. */
function extrairPayload(event: DailyWebhookEvent): DailyWebhookEvent["payload"] {
  const p = event.payload;
  if (!p) return undefined;
  return p.payload ?? p;
}

serve(async (req) => {
  if (req.method !== "POST") {
    return json(405, { error: "method-not-allowed" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const webhookSecret = Deno.env.get("DAILY_WEBHOOK_SECRET");

  if (!supabaseUrl || !serviceKey) {
    return json(500, { error: "env-missing-supabase" });
  }
  if (!webhookSecret) {
    return json(500, { error: "env-missing-DAILY_WEBHOOK_SECRET" });
  }

  // Lê body como texto pra validar assinatura ANTES de parsear JSON.
  // Não dá pra confiar em req.json() porque ele consome o stream.
  const bodyTexto = await req.text();
  const assinatura = req.headers.get("x-webhook-signature");
  const timestampStr = req.headers.get("x-webhook-timestamp");

  // Replay protection: rejeita avisos mais velhos que 5 min
  if (timestampStr) {
    const tsWebhook = Number(timestampStr);
    if (Number.isFinite(tsWebhook)) {
      const agora = Math.floor(Date.now() / 1000);
      if (Math.abs(agora - tsWebhook) > MAX_TIMESTAMP_SKEW_SECONDS) {
        return json(401, { error: "timestamp-fora-da-janela" });
      }
    }
  }

  const assinaturaOk = await validarAssinatura(bodyTexto, assinatura, webhookSecret);
  if (!assinaturaOk) {
    return json(401, { error: "assinatura-invalida" });
  }

  // Parse só DEPOIS da validação
  let event: DailyWebhookEvent;
  try {
    event = JSON.parse(bodyTexto);
  } catch {
    return json(400, { error: "json-invalido" });
  }

  // Filtra evento desejado. Daily.co manda vários tipos — só nos importa
  // `recording.ready-to-download`. Outros são ignorados com 200
  // (a Daily.co não vai reentregar e a gente não quer 4xx em massa).
  if (event.type !== "recording.ready-to-download") {
    return json(200, { ok: true, ignored: true, type: event.type ?? null });
  }

  const payload = extrairPayload(event);
  if (!payload) {
    return json(400, { error: "payload-ausente" });
  }
  if (!payload.recording_id || !payload.room_name) {
    return json(400, { error: "campos-obrigatorios-ausentes" });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Acha o stream pelo room_name (campo `daily_room_name`).
  // Em uso normal, há 1 stream por room_name (TTL de 4h).
  const { data: stream, error: streamErr } = await admin
    .from("video_streams")
    .select("id, recording_id")
    .eq("daily_room_name", payload.room_name)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (streamErr) {
    return json(500, { error: "db-erro", detail: streamErr.message });
  }

  if (!stream) {
    // Não achou — não é fatal (200 evita Daily.co reentregar em loop).
    // Pode ser room de teste manual ou stream apagado.
    return json(200, {
      ok: true,
      warning: "stream-nao-encontrado",
      room_name: payload.room_name,
    });
  }

  // Idempotência: se já registrado, no-op
  if (stream.recording_id === payload.recording_id) {
    return json(200, { ok: true, already_recorded: true });
  }

  // Update
  const startedAtIso = payload.start_ts
    ? new Date(payload.start_ts * 1000).toISOString()
    : null;

  const { error: updErr } = await admin
    .from("video_streams")
    .update({
      recording_id: payload.recording_id,
      recording_s3_key: payload.s3_key ?? null,
      recording_duration_s: payload.duration ?? null,
      recording_max_participants: payload.max_participants ?? null,
      recording_started_at: startedAtIso,
      recording_ready_at: new Date().toISOString(),
    })
    .eq("id", stream.id);

  if (updErr) {
    return json(500, { error: "db-update-erro", detail: updErr.message });
  }

  return json(200, {
    ok: true,
    stream_id: stream.id,
    recording_id: payload.recording_id,
  });
});
