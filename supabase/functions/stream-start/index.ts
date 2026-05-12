// ═══════════════════════════════════════════════════════════
// supabase/functions/stream-start — cria room no Daily.co
// ═══════════════════════════════════════════════════════════
// MS-11.2. iPhone chama esta rota ao começar um stint (Q11: início
// automático). Servidor cria room no Daily.co com DAILY_API_KEY
// (NUNCA exposta no iPhone) e devolve a URL pública pro app conectar.
//
// Decisões aplicadas:
//   Q13: qualidade adaptativa (Daily.co default)
//   Q14: SEM áudio (room.properties.start_audio_off = true)
//   Q18: gravação ativa (room.properties.enable_recording)
//
// F4 (Triagem volta-por-volta) consome esta gravação. Ver
// `docs/F4_OPERACIONAL.md` pra checklist de ativação da gravação
// na conta Daily.co. O `enable_recording: "cloud"` aqui só pega
// efeito se a conta tem o plano que permite cloud recording.
//
// Segurança:
//   - DAILY_API_KEY só no servidor (variável de ambiente Supabase)
//   - User precisa estar autenticado (JWT no Authorization header)
//   - User precisa ser membro do time da sessao (RLS valida no insert)
//
// Custo: ~US$ 0.10 por 20 min de stream (dentro do teto Q25 = US$ 50/mês)

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

interface StartRequest {
  sessao_id: string;
  bateria_inicio?: number;
}

interface StartResponse {
  video_stream_id: string;
  daily_room_url: string;
  daily_room_name: string;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

async function createDailyRoom(apiKey: string, name: string): Promise<{ url: string; name: string }> {
  // POST https://api.daily.co/v1/rooms com properties que cobrem Q13/Q14/Q18.
  // O room name é único — usamos `p1fast-<sessao_id>-<timestamp>` pra não colidir.
  // Configurações segurança/limites:
  //   - max_participants: 25 (box + pessoas do aplicativo + ~10 link público)
  //   - exp: 4 horas a partir de agora (stint ~20 min com folga)
  //   - start_audio_off: true (Q14 — sem áudio)
  //   - enable_recording: cloud (Q18 — gravação fica no Daily, frente F4 indexa)
  const expEpoch = Math.floor(Date.now() / 1000) + 4 * 60 * 60;
  const resp = await fetch("https://api.daily.co/v1/rooms", {
    method: "POST",
    headers: {
      "authorization": `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      name,
      properties: {
        max_participants: 25,
        exp: expEpoch,
        start_audio_off: true,
        enable_recording: "cloud",
      },
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`daily-create-failed: ${resp.status} ${errText}`);
  }
  const data = await resp.json();
  return { url: data.url, name: data.name };
}

serve(async (req) => {
  if (req.method !== "POST") {
    return json(405, { error: "method-not-allowed", expected: "POST" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const dailyKey = Deno.env.get("DAILY_API_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json(500, { error: "supabase-env-missing" });
  }
  if (!dailyKey) {
    return json(500, { error: "daily-api-key-missing" });
  }

  // Valida auth do user (JWT no Authorization)
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
    return json(401, { error: "invalid-token", detail: userErr?.message });
  }

  // Lê body
  let body: StartRequest;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid-body" });
  }
  if (!body.sessao_id) {
    return json(400, { error: "missing-sessao_id" });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Verifica que sessao existe e descobre time_id (cliente do user
  // tem RLS — se ele não é membro, fetchOne retorna vazio)
  const { data: sessao, error: sessaoErr } = await userClient
    .from("sessoes")
    .select("id, time_id")
    .eq("id", body.sessao_id)
    .single();
  if (sessaoErr || !sessao) {
    return json(404, { error: "sessao-not-found-or-no-access", detail: sessaoErr?.message });
  }

  // Já existe stream pra essa sessao?
  const { data: existing } = await admin
    .from("video_streams")
    .select("id, daily_room_url, daily_room_name, status")
    .eq("sessao_id", body.sessao_id)
    .maybeSingle();
  if (existing) {
    // Retorna o que já existe (idempotência — iPhone pode chamar 2× sem duplicar)
    return json(200, {
      video_stream_id: existing.id,
      daily_room_url: existing.daily_room_url,
      daily_room_name: existing.daily_room_name,
    } as StartResponse);
  }

  // Cria room no Daily.co. Nome legível pro Flávio identificar no dashboard.
  const roomName = `p1fast-${body.sessao_id.slice(0, 8)}-${Date.now()}`;
  let room;
  try {
    room = await createDailyRoom(dailyKey, roomName);
  } catch (e) {
    return json(502, { error: "daily-failed", detail: String(e) });
  }

  // Persiste em video_streams via service role (bypass RLS)
  const now = new Date().toISOString();
  const { data: inserted, error: insertErr } = await admin
    .from("video_streams")
    .insert({
      time_id: sessao.time_id,
      sessao_id: body.sessao_id,
      daily_room_url: room.url,
      daily_room_name: room.name,
      status: "ao_vivo",
      started_at: now,
      ultima_heartbeat: now,
      bateria_inicio: body.bateria_inicio ?? null,
    })
    .select("id")
    .single();

  if (insertErr || !inserted) {
    return json(500, { error: "insert-failed", detail: insertErr?.message });
  }

  return json(200, {
    video_stream_id: inserted.id,
    daily_room_url: room.url,
    daily_room_name: room.name,
  } as StartResponse);
});
