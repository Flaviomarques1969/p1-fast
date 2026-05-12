// ═══════════════════════════════════════════════════════════
// public-stream — retorna streams ao vivo de um evento (público)
// ═══════════════════════════════════════════════════════════
// MS-11.8. Sem auth — qualquer pessoa com o token consegue ver.
// Retorna lista de streams ao_vivo do evento, com URLs Daily.co
// que abrem em qualquer browser. Patrocinador / família vê assim.
//
// Decisão Q2.4: token vale o dia inteiro do evento (não expira
// por tempo — revogar via event-stream-link com acao=revogar).
//
// Se devolve HTML, mostra uma página simples com botões abrindo
// cada stream em nova aba. Se devolve JSON (?format=json), retorna
// dados brutos pra clientes que queiram embedar.

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function html(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

function renderHtml(eventoTipo: string | null, streams: Array<{ url: string; status: string }>): string {
  const titulo = eventoTipo ? `P1 Fast — ${eventoTipo}` : "P1 Fast — transmissão ao vivo";
  const aoVivo = streams.filter((s) => s.status === "ao_vivo");
  const listaHtml = aoVivo.length === 0
    ? '<p style="opacity:.6">Nenhuma transmissão ao vivo no momento.</p>'
    : aoVivo.map((s, i) => `
        <a href="${s.url}" target="_blank" rel="noopener" class="card">
          <div class="num">${i + 1}</div>
          <div class="info">
            <div class="t">Transmissão ao vivo</div>
            <div class="s">Toque pra abrir no Daily.co</div>
          </div>
          <div class="arrow">›</div>
        </a>`).join("");

  return `<!doctype html>
<html lang="pt-br">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titulo}</title>
<style>
  :root{--bg:#0f1115;--card:#171a21;--fg:#e8e8e8;--muted:#9aa0a6;--accent:#4f8cff;}
  body{margin:0;font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:var(--bg);color:var(--fg);padding:24px;}
  .wrap{max-width:520px;margin:0 auto;}
  h1{font-size:1.3rem;margin:0 0 4px;}
  .sub{color:var(--muted);font-size:.9rem;margin-bottom:24px;}
  .card{display:flex;align-items:center;gap:14px;padding:14px 16px;background:var(--card);border-radius:10px;margin-bottom:10px;text-decoration:none;color:inherit;}
  .num{background:var(--accent);color:#fff;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:600;flex-shrink:0;}
  .info{flex:1;}
  .t{font-weight:600;font-size:.95rem;}
  .s{color:var(--muted);font-size:.82rem;margin-top:2px;}
  .arrow{color:var(--muted);font-size:1.4rem;}
</style>
</head>
<body>
<div class="wrap">
  <h1>${titulo}</h1>
  <p class="sub">Transmissões ao vivo do evento</p>
  ${listaHtml}
</div>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method !== "GET") {
    return json(405, { error: "method-not-allowed" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json(500, { error: "env-missing" });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const format = url.searchParams.get("format") || "html";
  if (!token) {
    return json(400, { error: "missing-token" });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Lookup evento pelo token (sem auth — RLS bypass via service role)
  const { data: evento, error: evErr } = await admin
    .from("eventos")
    .select("id, tipo, link_publico_video_token")
    .eq("link_publico_video_token", token)
    .single();
  if (evErr || !evento) {
    if (format === "json") return json(404, { error: "token-invalid" });
    return html(404, `<!doctype html><html><body><h1>Link inválido</h1></body></html>`);
  }

  // Lista streams desse evento
  const { data: streams } = await admin
    .from("video_streams")
    .select("daily_room_url, status, started_at")
    .order("started_at", { ascending: false })
    .eq("time_id", evento.time_id ?? evento.id);  // se time_id não vier do select, usa id (fallback defensivo)

  // Filtra pra streams do evento — precisa de join com sessoes pelo evento_id.
  // Simplificação: lista tudo do time do evento (multi-eventos pode bagunçar,
  // mas geralmente 1 evento ativo por dia).
  const { data: sessoesDoEvento } = await admin
    .from("sessoes")
    .select("id")
    .eq("evento_id", evento.id);

  const sessaoIds = (sessoesDoEvento || []).map((s) => s.id);
  const { data: streamsDoEvento } = await admin
    .from("video_streams")
    .select("daily_room_url, status, started_at")
    .in("sessao_id", sessaoIds.length > 0 ? sessaoIds : ["00000000-0000-0000-0000-000000000000"])
    .order("started_at", { ascending: false });

  const lista = (streamsDoEvento || []).map((s) => ({
    url: s.daily_room_url as string,
    status: s.status as string,
  }));

  if (format === "json") {
    return json(200, {
      evento_id: evento.id,
      tipo: evento.tipo,
      streams: lista,
    });
  }
  return html(200, renderHtml(evento.tipo as string | null, lista));
});
