// ═══════════════════════════════════════════════════════════
// event-stream-link — gera/revoga token público do evento (Q2.4)
// ═══════════════════════════════════════════════════════════
// MS-11.8. Membro do time (chefe_equipe ou admin) gera um token
// único pra evento. Quem tiver o token consegue ver os streams
// ativos do evento via rota public-stream (sem auth).
//
// Token = UUID. Vale enquanto não for revogado (Q2.4: dia inteiro
// do evento). Revogar = setar link_publico_video_token = NULL.

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

interface LinkRequest {
  evento_id: string;
  acao: "gerar" | "revogar";
}

interface LinkResponse {
  ok: boolean;
  token: string | null;
  public_url: string | null;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function uuid(): string {
  return crypto.randomUUID();
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

  let body: LinkRequest;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid-body" });
  }
  if (!body.evento_id || !body.acao) {
    return json(400, { error: "missing-fields" });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Valida acesso via RLS (user precisa ser membro do time do evento)
  const { data: evento, error: evErr } = await userClient
    .from("eventos")
    .select("id, time_id, link_publico_video_token")
    .eq("id", body.evento_id)
    .single();
  if (evErr || !evento) {
    return json(404, { error: "evento-not-found-or-no-access" });
  }

  const novoToken = body.acao === "gerar" ? uuid() : null;
  const { error: updErr } = await admin
    .from("eventos")
    .update({ link_publico_video_token: novoToken })
    .eq("id", body.evento_id);
  if (updErr) {
    return json(500, { error: "update-failed", detail: updErr.message });
  }

  const publicUrl = novoToken
    ? `${supabaseUrl}/functions/v1/public-stream?token=${novoToken}`
    : null;

  return json(200, {
    ok: true,
    token: novoToken,
    public_url: publicUrl,
  } as LinkResponse);
});
