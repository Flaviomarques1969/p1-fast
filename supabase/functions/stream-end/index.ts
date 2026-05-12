// ═══════════════════════════════════════════════════════════
// supabase/functions/stream-end — encerra room no Daily.co
// ═══════════════════════════════════════════════════════════
// MS-11.2. iPhone chama esta rota ao encerrar um stint (ou Q26:
// bateria <= 10%). Servidor encerra room no Daily.co e marca
// video_streams.ended_at + status='encerrado'.
//
// Motivos canônicos:
//   - manual         (piloto encerrou stint pelo aplicativo)
//   - bateria_baixa  (Q26: iPhone <= 10%)
//   - sem_internet   (heartbeat falhou 3× seguidas)
//   - stint_cancelado (MS-4.5: stint cancelado)
//   - falha          (erro genérico — Daily.co timeout, etc.)

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

interface EndRequest {
  video_stream_id: string;
  motivo?: string;
  bateria_fim?: number;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

async function deleteDailyRoom(apiKey: string, roomName: string): Promise<void> {
  // DELETE não-fatal: se room não existir mais, segue. Daily.co retorna 404
  // se já foi removida (exp atingido ou DELETE prévio).
  const resp = await fetch(`https://api.daily.co/v1/rooms/${encodeURIComponent(roomName)}`, {
    method: "DELETE",
    headers: { "authorization": `Bearer ${apiKey}` },
  });
  if (!resp.ok && resp.status !== 404) {
    const errText = await resp.text();
    throw new Error(`daily-delete-failed: ${resp.status} ${errText}`);
  }
}

serve(async (req) => {
  if (req.method !== "POST") {
    return json(405, { error: "method-not-allowed" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const dailyKey = Deno.env.get("DAILY_API_KEY");
  if (!supabaseUrl || !serviceKey || !dailyKey) {
    return json(500, { error: "env-missing" });
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return json(401, { error: "unauthorized" });
  }
  const userClient = createClient(supabaseUrl, serviceKey, {
    global: { headers: { authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return json(401, { error: "invalid-token" });
  }

  let body: EndRequest;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid-body" });
  }
  if (!body.video_stream_id) {
    return json(400, { error: "missing-video_stream_id" });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Lê o stream (RLS valida que user é membro do time)
  const { data: stream, error: streamErr } = await userClient
    .from("video_streams")
    .select("id, daily_room_name, status, time_id")
    .eq("id", body.video_stream_id)
    .single();
  if (streamErr || !stream) {
    return json(404, { error: "stream-not-found-or-no-access" });
  }

  // Idempotência: se já encerrado, retorna sucesso
  if (stream.status === "encerrado") {
    return json(200, { ok: true, already_ended: true });
  }

  // Tenta encerrar room no Daily.co. Falha não-fatal — marca o stream
  // como encerrado de qualquer jeito (a room expira pelo TTL de 4h).
  let dailyOk = true;
  try {
    await deleteDailyRoom(dailyKey, stream.daily_room_name);
  } catch (_e) {
    dailyOk = false;
  }

  const now = new Date().toISOString();
  const motivoFinal = body.motivo ?? "manual";
  const { error: updErr } = await admin
    .from("video_streams")
    .update({
      status: "encerrado",
      ended_at: now,
      bateria_fim: body.bateria_fim ?? null,
      motivo_encerramento: motivoFinal,
    })
    .eq("id", body.video_stream_id);

  if (updErr) {
    return json(500, { error: "update-failed", detail: updErr.message });
  }

  return json(200, { ok: true, daily_room_deleted: dailyOk });
});
