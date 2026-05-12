// ═══════════════════════════════════════════════════════════
// supabase/functions/stream-heartbeat — keep-alive a cada 5s
// ═══════════════════════════════════════════════════════════
// MS-11.2. iPhone chama esta rota a cada 5s enquanto transmite (Q15).
// Servidor atualiza ultima_heartbeat. Se bateria != null, aplica
// regras Q26:
//   - ≤ 20%: retorna aviso (Command Box mostra banner amarelo)
//   - ≤ 10%: encerra automaticamente (status='encerrado', motivo='bateria_baixa')

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

interface HeartbeatRequest {
  video_stream_id: string;
  bateria?: number;  // 0-100
}

interface HeartbeatResponse {
  ok: boolean;
  status: "ao_vivo" | "encerrado";
  aviso?: "bateria_baixa" | "bateria_critica";
  motivo_encerramento?: string;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

serve(async (req) => {
  if (req.method !== "POST") {
    return json(405, { error: "method-not-allowed" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
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

  let body: HeartbeatRequest;
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

  // Valida acesso via userClient (RLS)
  const { data: stream, error: streamErr } = await userClient
    .from("video_streams")
    .select("id, status")
    .eq("id", body.video_stream_id)
    .single();
  if (streamErr || !stream) {
    return json(404, { error: "stream-not-found-or-no-access" });
  }
  if (stream.status === "encerrado") {
    // Heartbeat de stream já encerrado é no-op
    return json(200, { ok: true, status: "encerrado" } as HeartbeatResponse);
  }

  const now = new Date().toISOString();
  const bateria = body.bateria;

  // Regra Q26: bateria ≤ 10% → encerra automaticamente
  if (bateria !== undefined && bateria <= 10) {
    await admin
      .from("video_streams")
      .update({
        status: "encerrado",
        ended_at: now,
        ultima_heartbeat: now,
        bateria_fim: bateria,
        motivo_encerramento: "bateria_baixa",
      })
      .eq("id", body.video_stream_id);
    return json(200, {
      ok: true,
      status: "encerrado",
      aviso: "bateria_critica",
      motivo_encerramento: "bateria_baixa",
    } as HeartbeatResponse);
  }

  // Atualização normal
  await admin
    .from("video_streams")
    .update({ ultima_heartbeat: now })
    .eq("id", body.video_stream_id);

  const resp: HeartbeatResponse = { ok: true, status: "ao_vivo" };
  // Regra Q26: bateria entre 10 e 20% → aviso
  if (bateria !== undefined && bateria <= 20) {
    resp.aviso = "bateria_baixa";
  }
  return json(200, resp);
});
