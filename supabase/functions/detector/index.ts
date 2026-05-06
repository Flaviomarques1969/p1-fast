// ═══════════════════════════════════════════════════════════
// supabase/functions/detector — pipeline de análise pós-stint
// ═══════════════════════════════════════════════════════════
// Edge Function (Deno) que recebe um stream de samples (já em coords
// do viewBox) + config de pista, instancia o Detector portado
// (path-mapper.ts + detector.ts), drena os eventos e devolve um
// debrief JSON `{ laps, segments, stats }`.
//
// Use case (PLANO_FASE_1.md §3 MS-3):
//   - Reprocessar stints quando o track layout muda
//   - Backup quando o detector iOS client-side falhou
//   - Análises offline em batch
//   - Fontes Tier 3 (datalogger externo) que não têm detector embarcado
//
// O detector iOS client-side (MS-2.6) continua sendo o caminho normal
// — esta função é independente e idempotente, não persiste em nenhuma
// tabela. Caller decide se grava em segment_executions ou consome só
// o JSON.
//
// Auth: Authorization: Bearer <JWT> — checado contra Supabase Auth.
// Smoke E2E: deno test detector_test.ts (independente da Edge Runtime).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { runDetector, validateBody } from "./pipeline.ts";

const MAX_SAMPLES_PER_REQUEST = 20000;

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
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) {
    return jsonResponse(500, { error: "supabase-env-missing" });
  }

  // Apenas valida que o JWT é válido (qualquer usuário autenticado pode
  // pedir análise — a função não lê nem escreve em nenhuma tabela).
  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: auth } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return jsonResponse(401, { error: "invalid-jwt", detail: userErr?.message });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonResponse(400, { error: "invalid-json" });
  }

  const v = validateBody(raw);
  if (!v.ok) return jsonResponse(400, { error: v.reason });
  if (v.body.samples.length > MAX_SAMPLES_PER_REQUEST) {
    return jsonResponse(413, {
      error: "too-many-samples",
      limit: MAX_SAMPLES_PER_REQUEST,
      received: v.body.samples.length,
    });
  }

  const result = runDetector(v.body);
  return jsonResponse(200, result);
});
