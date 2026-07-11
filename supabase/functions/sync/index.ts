// ═══════════════════════════════════════════════════════════
// supabase/functions/sync — drainer de mutations local → remote
// ═══════════════════════════════════════════════════════════
// Sprint 1A.6 (sub-prompt A do docs/SPRINT_1A6_SYNC_DRAINER_DESIGN.md).
//
// Espelha estrutura de `ingest` mas pra mutations genéricas (insert /
// update / delete) em tabelas com `time_id` (whitelist abaixo).
// telemetry_samples NÃO passa por aqui (ADR-014, vai por `ingest`).
//
// Auth:    Authorization: Bearer <JWT>
// Body:    { rows: SyncRow[] }
// Resposta: { accepted: string[], rejected: { row_id, reason, ... }[] }
//
// Conflict resolution: Last-Write-Wins por client_updated_at vs
// server.updated_at. Cliente envia client_updated_at; se < server,
// rejeita 'stale-write' (cliente refaz o pull).
//
// Whitelist intencional — exclui:
//   • telemetry_samples (vai por ingest)
//   • times (só RPC create_team)
//   • usuarios_time (admin only via Studio/RPC)
//   • trofeus_ganhos (server-awarded, sem cliente)
//   • tracks/track_layouts/track_segments/marcos (catálogo global, write via service_role)
// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
export const ALLOWED_TABLES = new Set([
  "carros",
  "configuracoes",
  "pilotos",
  "passageiros",
  "pneus",
  "freios",
  "combustiveis",
  "eventos",
  "sessoes",
  "voltas",
  "segment_executions",
  "mensagens",
  "retas_especiais",
  "evento_pendencias",
  "pecas_locais",
  "pecas",
  "pecas_movimentacoes",
  "manutencoes",
  // Estoque unificado (geral + por carro) — backup na nuvem desde 2026-06-14
  // (migration 0046_estoque_unificado_sync). Tem time_id direto, igual a `pecas`.
  "estoque_item",
  // Fase 1 multi-aparelho (migration 0049): equipe + checklists com time_id direto.
  "equipe_membros",
  "stint_check",
  "dia_check"
]);
export const ALLOWED_OPS = new Set([
  "insert",
  "update",
  "delete"
]);
const MAX_ROWS_PER_REQUEST = 500;
/**
 * Tabelas cujo `time_id` é derivado via FK em vez de vir direto no
 * payload. Necessário pra `evento_pendencias` (referencia evento, não
 * tem coluna time_id própria) e similares. Inserts dessas tabelas
 * NÃO precisam mandar time_id; o servidor faz lookup pela parent FK.
 */ export const TIME_VIA_FK = {
  evento_pendencias: {
    fkColumn: "evento_id",
    parentTable: "eventos"
  }
};
/**
 * Colunas que existem só no schema LOCAL (SQLite cliente) e NÃO devem
 * ir pro Postgres. Hoje só `synced_at` — flag client-only que marca se
 * a row já foi sincronizada com o servidor; o cliente sempre envia
 * `synced_at: null` no payload (porque local NÃO está sincronizado AINDA),
 * mas o Postgres não tem essa coluna e devolve `column not found`.
 */ const CLIENT_ONLY_COLUMNS = new Set([
  "synced_at"
]);
/** Strip de colunas client-only do payload (in-place). */ export function stripClientOnly(payload) {
  if (!payload) return;
  for (const k of CLIENT_ONLY_COLUMNS){
    delete payload[k];
  }
}
/**
 * Normaliza colunas de timestamp do payload. Cliente Swift serializa
 * `created_at`/`updated_at`/`data_evento`/etc como ms epoch (Int64), mas
 * Postgres `timestamptz`/`date` exige string ISO 8601 — passar inteiro
 * faz `to_timestamp` interpretar como segundos e gerar "out of range"
 * (1.778e12 → ano 56371). Convertido in-place: `1778164744000` →
 * `"2026-05-07T14:39:04.000Z"`. Idempotente — se já vem string, ignora.
 *
 * Whitelist de nomes (todos os campos timestamp/date no schema atual):
 *   - termina em `_at` (created_at, updated_at, synced_at, ...)
 *   - começa com `data_` (data_evento, data_aplicacao, data_inicio, ...)
 *   - exatamente `nascimento`
 */ export function coerceTimestamps(payload) {
  if (!payload) return;
  for (const k of Object.keys(payload)){
    const isTs = k.endsWith("_at") || k.startsWith("data_") || k === "nascimento";
    if (!isTs) continue;
    const v = payload[k];
    if (typeof v === "number" && Number.isFinite(v)) {
      payload[k] = new Date(v).toISOString();
    }
  }
}
export function validateRow(r) {
  if (typeof r !== "object" || r === null) return {
    ok: false,
    reason: "row-nao-objeto"
  };
  if (typeof r.table_name !== "string" || !ALLOWED_TABLES.has(r.table_name)) {
    return {
      ok: false,
      reason: "table-nao-permitida"
    };
  }
  if (typeof r.op !== "string" || !ALLOWED_OPS.has(r.op)) {
    return {
      ok: false,
      reason: "op-invalida"
    };
  }
  if (r.op === "insert") {
    if (typeof r.payload !== "object" || r.payload === null) {
      return {
        ok: false,
        reason: "insert-sem-payload"
      };
    }
    // Tabelas com TIME_VIA_FK derivam time_id via parent — não exigem
    // payload.time_id (a tabela nem tem essa coluna no Postgres).
    if (!TIME_VIA_FK[r.table_name] && typeof r.payload.time_id !== "string") {
      return {
        ok: false,
        reason: "insert-sem-time_id"
      };
    }
  }
  if (r.op === "update") {
    if (typeof r.row_id !== "string") return {
      ok: false,
      reason: "update-sem-row_id"
    };
    if (typeof r.payload !== "object" || r.payload === null) {
      return {
        ok: false,
        reason: "update-sem-payload"
      };
    }
    if (typeof r.client_updated_at !== "number") {
      return {
        ok: false,
        reason: "update-sem-client_updated_at"
      };
    }
  }
  if (r.op === "delete" && typeof r.row_id !== "string") {
    return {
      ok: false,
      reason: "delete-sem-row_id"
    };
  }
  return {
    ok: true
  };
}
function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json"
    }
  });
}
serve(async (req)=>{
  if (req.method !== "POST") {
    return jsonResponse(405, {
      error: "method-not-allowed",
      expected: "POST"
    });
  }
  const auth = req.headers.get("authorization") || "";
  if (!auth.toLowerCase().startsWith("bearer ")) {
    return jsonResponse(401, {
      error: "missing-bearer-token"
    });
  }
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceKey || !anonKey) {
    return jsonResponse(500, {
      error: "supabase-env-missing"
    });
  }
  // Cliente admin pra mutações (bypassa RLS; validamos manualmente).
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
  // Cliente do user pra validar JWT (não-admin, anon obrigatório).
  const userClient = createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    global: {
      headers: {
        Authorization: auth
      }
    }
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return jsonResponse(401, {
      error: "invalid-jwt",
      detail: userErr?.message
    });
  }
  const userId = userData.user.id;
  let body;
  try {
    body = await req.json();
  } catch  {
    return jsonResponse(400, {
      error: "invalid-json"
    });
  }
  if (!Array.isArray(body?.rows)) {
    return jsonResponse(400, {
      error: "rows-must-be-array"
    });
  }
  if (body.rows.length === 0) {
    return jsonResponse(200, {
      accepted: [],
      rejected: [],
      note: "empty"
    });
  }
  if (body.rows.length > MAX_ROWS_PER_REQUEST) {
    return jsonResponse(413, {
      error: "too-many-rows",
      limit: MAX_ROWS_PER_REQUEST,
      received: body.rows.length
    });
  }
  const accepted = [];
  const rejected = [];
  // Cache membership por time_id (1 lookup por time)
  const memberOfTime = new Map();
  async function isMember(timeId) {
    if (memberOfTime.has(timeId)) return memberOfTime.get(timeId);
    const { data } = await admin.from("usuarios_time").select("user_id").eq("user_id", userId).eq("time_id", timeId).maybeSingle();
    const ok = !!data;
    memberOfTime.set(timeId, ok);
    return ok;
  }
  for (const r of body.rows){
    const v = validateRow(r);
    if (!v.ok) {
      rejected.push({
        row_id: r.row_id,
        table_name: r.table_name,
        reason: v.reason || "invalid"
      });
      continue;
    }
    // Determina time_id da row (vem do payload em insert; do server em update/delete)
    let timeId = null;
    const timeViaFk = TIME_VIA_FK[r.table_name];
    if (r.op === "insert") {
      if (timeViaFk) {
        // Tabelas tipo evento_pendencias: lookup time_id via parent FK
        // (evento_id → eventos.time_id). Parent precisa existir no
        // servidor — se ainda está na fila do mesmo batch, depende
        // da ordem que veio (created_at asc no drainer cuida disso).
        const fkValue = r.payload[timeViaFk.fkColumn];
        if (typeof fkValue !== "string") {
          rejected.push({
            row_id: r.row_id,
            table_name: r.table_name,
            reason: `insert-sem-${timeViaFk.fkColumn}`
          });
          continue;
        }
        const { data: parent } = await admin.from(timeViaFk.parentTable).select("time_id").eq("id", fkValue).maybeSingle();
        if (!parent) {
          rejected.push({
            row_id: r.row_id,
            table_name: r.table_name,
            reason: "parent-not-found",
            detail: {
              fk: timeViaFk.fkColumn,
              value: fkValue
            }
          });
          continue;
        }
        timeId = parent.time_id;
      } else {
        timeId = r.payload.time_id;
      }
    } else {
      // Update/delete: lookup do time_id atual no Postgres
      const selectCols = timeViaFk ? `${timeViaFk.fkColumn}, updated_at` : "time_id, updated_at";
      const { data: existing } = await admin.from(r.table_name).select(selectCols).eq("id", r.row_id).maybeSingle();
      if (!existing) {
        rejected.push({
          row_id: r.row_id,
          table_name: r.table_name,
          reason: "row-not-found"
        });
        continue;
      }
      if (timeViaFk) {
        const fkValue = existing[timeViaFk.fkColumn];
        const { data: parent } = await admin.from(timeViaFk.parentTable).select("time_id").eq("id", fkValue).maybeSingle();
        timeId = parent?.time_id ?? null;
      } else {
        timeId = existing.time_id;
      }
      // LWW pra update: rejeita se cliente está stale
      if (r.op === "update" && r.client_updated_at !== undefined) {
        const serverUpdatedAt = new Date(existing.updated_at).getTime();
        if (r.client_updated_at < serverUpdatedAt) {
          rejected.push({
            row_id: r.row_id,
            table_name: r.table_name,
            reason: "stale-write",
            detail: {
              server_updated_at: serverUpdatedAt,
              client_updated_at: r.client_updated_at
            }
          });
          continue;
        }
      }
    }
    if (!timeId || !await isMember(timeId)) {
      rejected.push({
        row_id: r.row_id,
        table_name: r.table_name,
        reason: "not-member-of-time"
      });
      continue;
    }
    // Normaliza ms epoch → ISO 8601 nas colunas de timestamp (cliente
    // Swift envia Int64 ms; Postgres `timestamptz` quebra com inteiro).
    // E remove colunas client-only (synced_at é flag do SQLite local,
    // não existe no Postgres — `column not found` se passar).
    if (r.op === "insert" || r.op === "update") {
      coerceTimestamps(r.payload);
      stripClientOnly(r.payload);
    }
    // Executa a mutation
    let dbError = null;
    let writtenId;
    if (r.op === "insert") {
      const { data, error } = await admin.from(r.table_name).insert(r.payload).select("id").single();
      dbError = error;
      writtenId = data?.id;
    } else if (r.op === "update") {
      const { error } = await admin.from(r.table_name).update(r.payload).eq("id", r.row_id);
      dbError = error;
      writtenId = r.row_id;
    } else if (r.op === "delete") {
      const { error } = await admin.from(r.table_name).delete().eq("id", r.row_id);
      dbError = error;
      writtenId = r.row_id;
    }
    if (dbError) {
      // Idempotência (insert): chave duplicada (23505) = registro já está
      // na nuvem (retentativa após falha de rede). Trata como sucesso
      // pra cliente parar de retentar e marcar como sincronizado.
      // Sem isso, o app retenta 5x, marca dead-letter e empilha fila.
      if (r.op === "insert" && (dbError.code === "23505" || /duplicate key/i.test(dbError.message ?? ""))) {
        const idFromPayload = r.payload?.id;
        accepted.push(idFromPayload ?? r.row_id ?? "");
        continue;
      }
      rejected.push({
        row_id: r.row_id,
        table_name: r.table_name,
        reason: "db-error",
        detail: dbError.message
      });
      continue;
    }
    accepted.push(writtenId);
  }
  return jsonResponse(200, {
    accepted,
    rejected
  });
});
