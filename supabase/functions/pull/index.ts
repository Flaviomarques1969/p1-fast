// ═══════════════════════════════════════════════════════════
// supabase/functions/pull — sync inicial / catch-up cliente
// ═══════════════════════════════════════════════════════════
// Sprint 1A.6 — sub-prompt E (de 5).
//
// Cliente envia: { tables: [...], since: { table: ms_epoch } }
// Server responde: { rows: { table: [...] }, max_updated_at: { table: ms_epoch } }
//
// Cliente usa max_updated_at como próximo cursor (last_sync_at por tabela).
// Idempotente: chamadas repetidas com mesmo `since` retornam mesmas rows.
//
// Auth: Bearer JWT. Membership por time_id.
// Whitelist: mesma do `sync` (12 tabelas com time_id).
// Catálogo global (tracks/layouts/segments/marcos): bypass de membership,
// retornado na íntegra (não tem time_id — só leitura pública).
//
// Limite: 1000 rows por tabela por request. Cliente pagina via cursor.

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export const TEAM_TABLES = new Set([
  "carros", "configuracoes", "pilotos", "passageiros", "pneus", "freios", "combustiveis",
  "eventos", "sessoes", "voltas", "segment_executions", "mensagens",
  "retas_especiais", "trofeus_ganhos",
  "estoque_item", // estoque unificado — restaurável em outro aparelho (0046)
]);

export const GLOBAL_TABLES = new Set([
  "tracks", "track_layouts", "track_segments", "marcos",
]);

const ROW_LIMIT_PER_TABLE = 1000;

interface PullBody {
  tables: string[];
  since?: Record<string, number>; // table_name → ms_epoch
}

export interface RequestValidation {
  ok: boolean;
  reason?: string;
}

export function validatePullRequest(b: any): RequestValidation {
  if (typeof b !== "object" || b === null) return { ok: false, reason: "body-invalid" };
  if (!Array.isArray(b.tables)) return { ok: false, reason: "tables-must-be-array" };
  if (b.tables.length === 0) return { ok: false, reason: "tables-empty" };
  if (b.tables.length > 30) return { ok: false, reason: "too-many-tables" };
  for (const t of b.tables) {
    if (typeof t !== "string") return { ok: false, reason: "table-not-string" };
    if (!TEAM_TABLES.has(t) && !GLOBAL_TABLES.has(t)) {
      return { ok: false, reason: `table-not-pullable:${t}` };
    }
  }
  if (b.since !== undefined && (typeof b.since !== "object" || b.since === null)) {
    return { ok: false, reason: "since-must-be-object" };
  }
  return { ok: true };
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
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceKey || !anonKey) {
    return jsonResponse(500, { error: "supabase-env-missing" });
  }

  // Cliente do user pra validar JWT (não-admin).
  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: auth } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return jsonResponse(401, { error: "invalid-jwt", detail: userErr?.message });
  }
  const userId = userData.user.id;

  // Cliente admin pra ler dados (RLS já valida via JOIN, mas pulamos pra
  // simplificar — fazemos membership check explícito por time).
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body: PullBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: "invalid-json" });
  }

  const v = validatePullRequest(body);
  if (!v.ok) {
    return jsonResponse(400, { error: v.reason });
  }

  // Resolve time_ids do user (pode ser membro de múltiplos)
  const { data: memberships } = await admin
    .from("usuarios_time")
    .select("time_id")
    .eq("user_id", userId);
  const userTimeIds = (memberships || []).map((m: any) => m.time_id as string);

  const rowsByTable: Record<string, any[]> = {};
  const maxUpdatedByTable: Record<string, number> = {};

  for (const table of body.tables) {
    const sinceMs = body.since?.[table] ?? 0;
    const sinceIso = new Date(sinceMs).toISOString();

    let query = admin
      .from(table)
      .select("*")
      .gt("updated_at", sinceIso)
      .order("updated_at", { ascending: true })
      .limit(ROW_LIMIT_PER_TABLE);

    // Team tables: filtra por time_ids do user
    if (TEAM_TABLES.has(table)) {
      if (userTimeIds.length === 0) {
        rowsByTable[table] = [];
        maxUpdatedByTable[table] = sinceMs;
        continue;
      }
      query = query.in("time_id", userTimeIds);
    }
    // Global tables: sem filtro (tudo público)

    const { data, error } = await query;
    if (error) {
      return jsonResponse(502, { error: "db-error", table, detail: error.message });
    }

    const rows = (data || []) as any[];
    rowsByTable[table] = rows;

    // max_updated_at = última row (já ordenada asc) ou cursor enviado
    if (rows.length > 0) {
      const last = rows[rows.length - 1];
      maxUpdatedByTable[table] = new Date(last.updated_at).getTime();
    } else {
      maxUpdatedByTable[table] = sinceMs;
    }
  }

  return jsonResponse(200, {
    rows: rowsByTable,
    max_updated_at: maxUpdatedByTable,
    has_more: Object.fromEntries(
      Object.entries(rowsByTable).map(([t, rs]) => [t, rs.length === ROW_LIMIT_PER_TABLE]),
    ),
  });
});
