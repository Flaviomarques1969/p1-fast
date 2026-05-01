// ═══════════════════════════════════════════════════════════
// supabase/functions/ingest — recebe Samples do iPhone
// ═══════════════════════════════════════════════════════════
// Edge Function (Deno) que substitui api/ingest/iphone.js (Vercel).
//
// Auth:    Authorization: Bearer <JWT do Supabase Auth>
// Body:    { sessionId, chunkId, samples: [...] }
// Persist: insert em batch em public.telemetry_samples (1000 rows / chunk)
//
// Sample canônico (mobile-telemetry.js):
//   { t: number, tMono: number, source: string, signalQuality: string,
//     lat?, lng?, speed?, ax?, ay?, az?, gx?, gy?, gz? ... }
//
// time_id é extraído do JWT (claim app_metadata.time_id ou via lookup
// em usuarios_time se preferir). Para esta versão usamos lookup pelo
// user_id no JWT — o request tem que pertencer a um time.
//
// Resposta:
//   { accepted: number, rejected: number, errors: [...] }

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const MAX_SAMPLES_PER_REQUEST = 5000;
const BATCH_SIZE = 1000;

interface Sample {
  t: number;
  tMono: number;
  source: string;
  signalQuality: string;
  [k: string]: unknown;
}

interface IngestBody {
  sessionId: string;
  chunkId?: string;
  samples: Sample[];
}

interface ValidationResult {
  ok: boolean;
  reason?: string;
}

export function validateSample(s: any): ValidationResult {
  if (typeof s !== "object" || s === null) return { ok: false, reason: "sample-nao-objeto" };
  if (typeof s.t !== "number") return { ok: false, reason: "sample-sem-t" };
  if (typeof s.tMono !== "number") return { ok: false, reason: "sample-sem-tMono" };
  if (typeof s.source !== "string") return { ok: false, reason: "sample-sem-source" };
  if (typeof s.signalQuality !== "string") return { ok: false, reason: "sample-sem-signalQuality" };
  return { ok: true };
}

export function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "method-not-allowed", expected: "POST" });
  }

  const auth = req.headers.get("authorization") || "";
  if (!auth.toLowerCase().startsWith("bearer ")) {
    return jsonResponse(401, { error: "missing-bearer-token" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse(500, { error: "supabase-env-missing" });
  }

  // Cliente admin pra insert (bypassa RLS, mas validamos manualmente).
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Extrai user_id do JWT pra checar membership no time.
  const userClient = createClient(
    supabaseUrl,
    Deno.env.get("SUPABASE_ANON_KEY") || serviceKey,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: auth } },
    },
  );

  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return jsonResponse(401, { error: "invalid-jwt", detail: userErr?.message });
  }
  const userId = userData.user.id;

  let body: IngestBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: "invalid-json" });
  }

  if (!body || typeof body !== "object") {
    return jsonResponse(400, { error: "body-invalid" });
  }
  if (typeof body.sessionId !== "string" || body.sessionId.length === 0) {
    return jsonResponse(400, { error: "sessionId-required" });
  }
  if (!Array.isArray(body.samples)) {
    return jsonResponse(400, { error: "samples-must-be-array" });
  }
  if (body.samples.length === 0) {
    return jsonResponse(200, { accepted: 0, rejected: 0, errors: [], note: "heartbeat" });
  }
  if (body.samples.length > MAX_SAMPLES_PER_REQUEST) {
    return jsonResponse(413, {
      error: "too-many-samples",
      limit: MAX_SAMPLES_PER_REQUEST,
      received: body.samples.length,
    });
  }

  // Verifica que a sessão pertence a um time onde o user é membro.
  const { data: ses, error: sesErr } = await supabase
    .from("sessoes")
    .select("id, time_id")
    .eq("id", body.sessionId)
    .single();

  if (sesErr || !ses) {
    return jsonResponse(404, { error: "session-not-found", sessionId: body.sessionId });
  }

  const { data: membership } = await supabase
    .from("usuarios_time")
    .select("user_id")
    .eq("user_id", userId)
    .eq("time_id", ses.time_id)
    .maybeSingle();

  if (!membership) {
    return jsonResponse(403, { error: "user-not-in-team", time_id: ses.time_id });
  }

  // Valida samples; separa válidos dos inválidos.
  const errors: { index: number; reason: string }[] = [];
  const valid: Sample[] = [];
  for (let i = 0; i < body.samples.length; i++) {
    const v = validateSample(body.samples[i]);
    if (v.ok) {
      valid.push(body.samples[i]);
    } else {
      errors.push({ index: i, reason: v.reason || "invalid" });
    }
  }

  if (valid.length === 0) {
    return jsonResponse(400, { accepted: 0, rejected: errors.length, errors });
  }

  // Insert em batches de BATCH_SIZE.
  let accepted = 0;
  for (const batch of chunkArray(valid, BATCH_SIZE)) {
    const rows = batch.map((s, i) => ({
      time_id: ses.time_id,
      sessao_id: ses.id,
      seq: (s as any).seq ?? (accepted + i),
      t: Math.round(s.t),
      t_mono: s.tMono,
      payload: s,
    }));
    const { error } = await supabase.from("telemetry_samples").insert(rows);
    if (error) {
      return jsonResponse(502, {
        error: "insert-failed",
        detail: error.message,
        accepted,
        rejected: errors.length + (valid.length - accepted),
        errors,
      });
    }
    accepted += batch.length;
  }

  return jsonResponse(200, {
    accepted,
    rejected: errors.length,
    errors,
    sessionId: ses.id,
  });
});
