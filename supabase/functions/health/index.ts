// ═══════════════════════════════════════════════════════════
// supabase/functions/health — admin readiness/diagnostic endpoint
// ═══════════════════════════════════════════════════════════
// Não precisa de auth (é diagnostic). Retorna status do schema +
// counts canônicos pra detectar drift entre o repo e o que está
// aplicado no Supabase real.
//
// Útil pra:
//   • Validar deploy (após `supabase db push` + seed.sql, bate com expected?)
//   • UI "Sincronização" (Sprint 1A.6 sub-prompt D)
//   • Monitoring (cron externo bate hourly + alerta se status != ok)

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const VERSION = "0.0.1";

export const EXPECTED_TABLES = [
  "times", "usuarios_time",
  "tracks", "track_layouts", "track_segments", "marcos", "retas_especiais",
  "carros", "configuracoes", "pilotos", "passageiros", "pneus", "combustiveis",
  "eventos", "sessoes", "voltas", "segment_executions", "telemetry_samples",
  "mensagens", "trofeus_ganhos",
];

export const EXPECTED_RPCS = ["create_team", "is_member", "is_admin"];

export interface HealthSchema {
  tables_count: number;
  rls_enabled_count: number;
  expected_tables: string[];
  missing: string[];
  extras: string[];
}

export interface HealthSeed {
  tracks: number;
  track_layouts: number;
  track_segments: number;
  marcos: number;
  retas_especiais_global: number;
}

export interface HealthResponse {
  status: "ok" | "drift" | "error";
  schema: HealthSchema;
  seed: HealthSeed;
  rpcs: Record<string, boolean>;
  version: string;
  checked_at: string;
  error?: string;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export function computeStatus(schema: HealthSchema, rpcs: Record<string, boolean>): "ok" | "drift" {
  if (schema.missing.length > 0) return "drift";
  if (schema.extras.length > 0) return "drift";
  if (schema.tables_count !== EXPECTED_TABLES.length) return "drift";
  if (schema.rls_enabled_count !== EXPECTED_TABLES.length) return "drift";
  for (const rpc of EXPECTED_RPCS) {
    if (!rpcs[rpc]) return "drift";
  }
  return "ok";
}

serve(async (req) => {
  if (req.method !== "GET" && req.method !== "POST") {
    return jsonResponse(405, { error: "method-not-allowed", expected: "GET or POST" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse(500, {
      status: "error",
      error: "supabase-env-missing",
      version: VERSION,
      checked_at: new Date().toISOString(),
    });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ─── 1. Schema check (existência de cada tabela esperada) ─
  const tablesActual: string[] = [];
  for (const name of EXPECTED_TABLES) {
    const { error } = await admin.from(name).select("*", { count: "exact", head: true });
    if (!error) tablesActual.push(name);
  }
  const expectedSet = new Set(EXPECTED_TABLES);
  const actualSet = new Set(tablesActual);
  const missing = EXPECTED_TABLES.filter((t) => !actualSet.has(t));
  const extras = tablesActual.filter((t) => !expectedSet.has(t));

  const schema: HealthSchema = {
    tables_count: tablesActual.length,
    rls_enabled_count: tablesActual.length, // proxy: service_role reach == existence
    expected_tables: EXPECTED_TABLES,
    missing,
    extras,
  };

  // ─── 2. Seed canônico (Brasília) ─────────────────────────
  const seed: HealthSeed = {
    tracks: 0,
    track_layouts: 0,
    track_segments: 0,
    marcos: 0,
    retas_especiais_global: 0,
  };
  try {
    seed.tracks = (await admin.from("tracks").select("*", { count: "exact", head: true })).count || 0;
    seed.track_layouts = (await admin.from("track_layouts").select("*", { count: "exact", head: true })).count || 0;
    seed.track_segments = (await admin.from("track_segments").select("*", { count: "exact", head: true })).count || 0;
    seed.marcos = (await admin.from("marcos").select("*", { count: "exact", head: true })).count || 0;
    const reGlobal = await admin.from("retas_especiais").select("*", { count: "exact", head: true }).is("time_id", null);
    seed.retas_especiais_global = reGlobal.count || 0;
  } catch (_) {
    // Seed counts não-crítico — drift no schema já vai disparar status=drift.
  }

  // ─── 3. RPCs presentes ───────────────────────────────────
  const rpcs: Record<string, boolean> = {};
  for (const rpc of EXPECTED_RPCS) {
    try {
      const { error } = await admin.rpc(
        rpc as any,
        rpc === "create_team"
          ? ({ p_nome: null } as any)
          : ({ p_time_id: "00000000-0000-0000-0000-000000000000" } as any)
      );
      const msg = (error?.message || "").toLowerCase();
      rpcs[rpc] = !(msg.includes("could not find") || msg.includes("does not exist"));
    } catch {
      rpcs[rpc] = false;
    }
  }

  const status = computeStatus(schema, rpcs);
  const response: HealthResponse = {
    status,
    schema,
    seed,
    rpcs,
    version: VERSION,
    checked_at: new Date().toISOString(),
  };

  return jsonResponse(200, response);
});
