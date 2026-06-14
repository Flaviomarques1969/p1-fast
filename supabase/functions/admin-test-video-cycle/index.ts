// ADMIN TEST — ciclo completo da videoconferência.
// Cria time + sessão + chama stream-start (via fetch interno com service_role)
// Verifica video_streams. Simula webhook recording.ready-to-download.
// Confirma UPDATE. Limpa tudo no final.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const SUPA = Deno.env.get("SUPABASE_URL")!;
const SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DAILY_API = Deno.env.get("DAILY_API_KEY")!;
const SEC = Deno.env.get("DAILY_WEBHOOK_SECRET")!;

async function rest(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("apikey", SVC);
  headers.set("authorization", `Bearer ${SVC}`);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  return fetch(`${SUPA}/rest/v1/${path}`, { ...init, headers });
}

async function hmacHex(body: string): Promise<string> {
  const keyBytes = Uint8Array.from(atob(SEC), c => c.charCodeAt(0));
  const k = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const s = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(s)).map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(async () => {
  const log: string[] = [];
  const errors: string[] = [];
  let timeId: string | null = null;
  let sessaoId: string | null = null;
  let videoStreamId: string | null = null;
  let dailyRoomName: string | null = null;
  
  try {
    // 1. Criar time de teste
    log.push("=== TESTE 1: criar time ===");
    const timeResp = await rest("times", {
      method: "POST",
      headers: { prefer: "return=representation" },
      body: JSON.stringify({ nome: `TEST-VIDEO-${Date.now()}` }),
    });
    if (!timeResp.ok) {
      errors.push(`time-create: ${timeResp.status} ${await timeResp.text()}`);
      throw new Error("falha criar time");
    }
    const timeData = await timeResp.json();
    timeId = Array.isArray(timeData) ? timeData[0].id : timeData.id;
    log.push(`✓ time criado: ${timeId}`);

    // 2. Criar sessão de teste (status='ao_vivo' pra simular stint em andamento)
    log.push("=== TESTE 2: criar sessão ===");
    const sessaoResp = await rest("sessoes", {
      method: "POST",
      headers: { prefer: "return=representation" },
      body: JSON.stringify({
        time_id: timeId,
        status: "ao_vivo",
        data_inicio: new Date().toISOString(),
      }),
    });
    if (!sessaoResp.ok) {
      errors.push(`sessao-create: ${sessaoResp.status} ${await sessaoResp.text()}`);
      throw new Error("falha criar sessao");
    }
    const sessaoData = await sessaoResp.json();
    sessaoId = Array.isArray(sessaoData) ? sessaoData[0].id : sessaoData.id;
    log.push(`✓ sessão criada: ${sessaoId}`);

    // 3. Criar sala Daily.co (replicando lógica do stream-start)
    log.push("=== TESTE 3: criar sala Daily.co ===");
    const roomName = `p1fast-test-${sessaoId.slice(0, 8)}-${Date.now()}`;
    const dailyResp = await fetch("https://api.daily.co/v1/rooms", {
      method: "POST",
      headers: {
        authorization: `Bearer ${DAILY_API}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: roomName,
        properties: {
          max_participants: 25,
          exp: Math.floor(Date.now() / 1000) + 4 * 60 * 60,
          start_audio_off: true,
          enable_recording: "cloud",
        },
      }),
    });
    if (!dailyResp.ok) {
      errors.push(`daily-room: ${dailyResp.status} ${await dailyResp.text()}`);
      throw new Error("falha criar sala daily.co");
    }
    const daily = await dailyResp.json();
    dailyRoomName = daily.name;
    log.push(`✓ sala Daily.co criada: ${dailyRoomName}`);
    log.push(`  URL: ${daily.url}`);
    log.push(`  enable_recording: ${daily.config?.enable_recording ?? "(não-veio-no-response)"}`);

    // 4. Insert em video_streams (simulando o que stream-start faz)
    log.push("=== TESTE 4: insert video_streams ===");
    const vsResp = await rest("video_streams", {
      method: "POST",
      headers: { prefer: "return=representation" },
      body: JSON.stringify({
        time_id: timeId,
        sessao_id: sessaoId,
        daily_room_url: daily.url,
        daily_room_name: roomName,
        status: "ao_vivo",
        started_at: new Date().toISOString(),
        ultima_heartbeat: new Date().toISOString(),
        bateria_inicio: 87,
      }),
    });
    if (!vsResp.ok) {
      errors.push(`video_streams-insert: ${vsResp.status} ${await vsResp.text()}`);
      throw new Error("falha criar video_streams");
    }
    const vs = await vsResp.json();
    videoStreamId = Array.isArray(vs) ? vs[0].id : vs.id;
    log.push(`✓ video_streams criado: ${videoStreamId}`);

    // 5. Simular heartbeat (atualizar ultima_heartbeat)
    log.push("=== TESTE 5: simular heartbeat ===");
    const hb = await rest(`video_streams?id=eq.${videoStreamId}`, {
      method: "PATCH",
      headers: { prefer: "return=minimal" },
      body: JSON.stringify({ ultima_heartbeat: new Date().toISOString() }),
    });
    log.push(`heartbeat: ${hb.status} ${hb.ok ? "OK" : "FAIL"}`);

    // 6. Simular stream-end (status='encerrado')
    log.push("=== TESTE 6: simular stream-end ===");
    const end = await rest(`video_streams?id=eq.${videoStreamId}`, {
      method: "PATCH",
      headers: { prefer: "return=minimal" },
      body: JSON.stringify({
        status: "encerrado",
        ended_at: new Date().toISOString(),
        bateria_fim: 72,
        motivo_encerramento: "manual",
      }),
    });
    log.push(`stream-end: ${end.status} ${end.ok ? "OK" : "FAIL"}`);

    // 7. AGORA O TESTE GRANDE: simular webhook recording.ready-to-download
    log.push("=== TESTE 7: webhook recording.ready-to-download REAL ===");
    const fakeRecordingId = `rec_test_${Date.now()}`;
    const eventBody = JSON.stringify({
      version: "1.0.0",
      type: "recording.ready-to-download",
      id: `evt_test_${Date.now()}`,
      event_ts: Math.floor(Date.now() / 1000),
      payload: {
        type: "cloud",
        recording_id: fakeRecordingId,
        room_name: roomName,
        start_ts: Math.floor(Date.now() / 1000) - 600,
        status: "finished",
        max_participants: 2,
        duration: 600,
        s3_key: `recordings/${fakeRecordingId}.mp4`,
      },
    });
    const sig = await hmacHex(eventBody);
    const ts = String(Math.floor(Date.now() / 1000));

    const whResp = await fetch(`${SUPA}/functions/v1/daily-recording-hook`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-webhook-signature": sig,
        "x-webhook-timestamp": ts,
      },
      body: eventBody,
    });
    const whBody = await whResp.json();
    log.push(`webhook resposta: HTTP ${whResp.status}`);
    log.push(`webhook body: ${JSON.stringify(whBody)}`);
    if (whResp.status !== 200) errors.push(`webhook-non-200: ${whResp.status}`);

    // 8. Verificar que video_streams foi ATUALIZADO com recording_id
    log.push("=== TESTE 8: verificar update do video_streams ===");
    const check = await rest(`video_streams?id=eq.${videoStreamId}&select=recording_id,recording_s3_key,recording_duration_s,recording_ready_at,recording_started_at`);
    const checkData = await check.json();
    log.push(`video_streams após webhook: ${JSON.stringify(checkData[0])}`);
    if (checkData[0]?.recording_id !== fakeRecordingId) {
      errors.push(`recording_id não foi atualizado! esperado ${fakeRecordingId}, recebido ${checkData[0]?.recording_id}`);
    } else {
      log.push(`✓ recording_id ATUALIZADO corretamente`);
    }

    // 9. Idempotência — webhook chamado novamente deve retornar already_recorded
    log.push("=== TESTE 9: idempotência (chamar webhook 2× com mesmo evento) ===");
    const sig2 = await hmacHex(eventBody);
    const wh2 = await fetch(`${SUPA}/functions/v1/daily-recording-hook`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-webhook-signature": sig2 },
      body: eventBody,
    });
    const wh2Body = await wh2.json();
    log.push(`2ª chamada: HTTP ${wh2.status} body: ${JSON.stringify(wh2Body)}`);
    if (!wh2Body.already_recorded) errors.push(`não detectou idempotência`);

    // 10. Assinatura inválida → 401
    log.push("=== TESTE 10: assinatura inválida ===");
    const whBad = await fetch(`${SUPA}/functions/v1/daily-recording-hook`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-webhook-signature": "0".repeat(64) },
      body: eventBody,
    });
    log.push(`assinatura ruim: HTTP ${whBad.status}`);
    if (whBad.status !== 401) errors.push(`esperava 401 com assinatura ruim, recebeu ${whBad.status}`);

  } finally {
    // CLEANUP — sempre roda
    log.push("=== CLEANUP ===");
    if (dailyRoomName) {
      const del = await fetch(`https://api.daily.co/v1/rooms/${dailyRoomName}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${DAILY_API}` },
      });
      log.push(`sala Daily.co deletada: ${del.status}`);
    }
    if (videoStreamId) {
      const del = await rest(`video_streams?id=eq.${videoStreamId}`, { method: "DELETE" });
      log.push(`video_streams deletado: ${del.status}`);
    }
    if (sessaoId) {
      const del = await rest(`sessoes?id=eq.${sessaoId}`, { method: "DELETE" });
      log.push(`sessao deletada: ${del.status}`);
    }
    if (timeId) {
      const del = await rest(`times?id=eq.${timeId}`, { method: "DELETE" });
      log.push(`time deletado: ${del.status}`);
    }
  }

  return new Response(JSON.stringify({
    ok: errors.length === 0,
    errors,
    log,
  }, null, 2), {
    status: errors.length === 0 ? 200 : 500,
    headers: { "content-type": "application/json" },
  });
});
