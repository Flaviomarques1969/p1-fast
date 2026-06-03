// ═══════════════════════════════════════════════════════════
// serve-local.ts — sobe o Tradutor em http://localhost:8765
// ═══════════════════════════════════════════════════════════
// Usado pelos mockups HTML dos 3 Command Box · Visão Engenheiro
// (Lambda · PAce · Motor Health) pra puxar dados reais sem precisar
// do Supabase no ar. Não é produção — não tem auth.
//
// Rodar:
//   deno run --allow-net --allow-read serve-local.ts
//
// Para nos mockups: window.P1_TRADUTOR_URL = "http://localhost:8765".

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { handler } from "./index.ts";

console.log("[trecho-analisar] servidor local no ar em http://localhost:8765");
serve(handler, { port: 8765 });
