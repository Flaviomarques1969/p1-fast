// ═══════════════════════════════════════════════════════════
// /api/video/room — cria sala efêmera Daily.co + meeting tokens
// ═══════════════════════════════════════════════════════════
// Etapa V do PLANO_PERNA1_IPHONE.md (2026-04-26).
//
// Stack: Daily.co (conta dedicada `fam-racing.daily.co`, plano Free
// Pay-as-you-go, isolada do CDAI). DAILY_API_KEY no Vercel.
//
// Comportamento:
//   • POST /api/video/room { sessionId? }
//     → cria sala (TTL 2h) + 2 meeting tokens (publisher iPhone, viewer Box)
//     → retorna { roomUrl, tokenPiloto, tokenBox, exp }
//   • Sala = 1 stint. iPhone publica câmera, Box assiste.
//   • Tokens definem role: piloto=publisher (camera/mic), box=viewer.
//   • TTL curto (2h) evita salas órfãs entre stints.
//
// Limite Free Pay-as-you-go: 10.000 participant-min/mês incluídos.
// 1h × 2 participantes = 120 min. ~83 sessões/mês antes de overage.
// Acima de 10k: ~$0.004/min/participante.

import { guardRequest } from '../_lib/security.js';

const DAILY_API = 'https://api.daily.co/v1';
const ROOM_TTL_SECONDS = 2 * 60 * 60;  // 2h

// Sala determinística por evento+dia (Flavio 2026-04-26): cockpit-mobile
// e box convergem no mesmo roomName SEM signaling, derivando o nome do
// evento ativo do dia (localStorage fam_app_v1). Sem evento do dia → 400.
// Mantém compat com `fam-racing-live` se cliente legacy não enviar
// eventId+dateISO (mas client novo SEMPRE envia, ou não cria sala).
const FALLBACK_ROOM_NAME = 'fam-racing-live';

function safeId(s) {
  return String(s || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 32);
}

function deterministicRoomName({ eventId, dateISO }) {
  if (!eventId || !dateISO) return null;
  const safe = safeId(eventId);
  const date = String(dateISO).replace(/-/g, '').slice(0, 8);
  if (!/^\d{8}$/.test(date)) return null;
  return `evento-${safe}-${date}`;
}

async function dailyFetch(path, { method = 'GET', body = null } = {}) {
  const apiKey = process.env.DAILY_API_KEY;
  if (!apiKey) throw new Error('DAILY_API_KEY não configurada');
  const r = await fetch(`${DAILY_API}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) {
    const errTxt = await r.text();
    throw new Error(`Daily ${method} ${path} → ${r.status}: ${errTxt.slice(0, 200)}`);
  }
  return r.json();
}

export default async function handler(req, res) {
  if (!guardRequest(req, res, { endpoint: 'video-room' })) return;

  const apiKey = process.env.DAILY_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'DAILY_API_KEY não configurada' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  } catch {
    return res.status(400).json({ error: 'body JSON inválido' });
  }

  // Validação dura — sem eventId+dateISO, salas colidem entre eventos do
  // mesmo dia. O fallback `fam-racing-live` permitia áudio/câmera cruzada
  // quando 2 eventos rodavam paralelos (auditoria 2026-04-28 #11).
  const { videoRoomPayload, respondInvalid } = await import('../_lib/schemas.js');
  const parsed = videoRoomPayload.parse(body || {});
  if (!parsed.ok) return respondInvalid(res, parsed);

  const sessionIdInput = parsed.value.sessionId ? safeId(parsed.value.sessionId) : null;
  const eventIdInput = safeId(parsed.value.eventId);
  const dateISOInput = parsed.value.dateISO;
  const exp = Math.floor(Date.now() / 1000) + ROOM_TTL_SECONDS;

  // Nome determinístico evento+dia — ambas as pontas convergem.
  const roomName = deterministicRoomName({ eventId: eventIdInput, dateISO: dateISOInput })
                || FALLBACK_ROOM_NAME;

  try {
    // 1. Sala — try create; se já existe (409), estende o exp via update.
    // Idempotente entre stints e entre publisher/viewer.
    const roomConfig = {
      name: roomName,
      properties: {
        exp,
        max_participants: 4,
        enable_chat: false,
        enable_screenshare: false,
        eject_at_room_exp: true,
        start_audio_off: true,
        start_video_off: false,
      },
    };
    let room;
    try {
      room = await dailyFetch('/rooms', { method: 'POST', body: roomConfig });
    } catch (createErr) {
      const msg = String(createErr.message || createErr);
      if (msg.includes('409') || msg.includes('exists')) {
        // Já existe — renova exp via POST update.
        room = await dailyFetch(`/rooms/${roomName}`, {
          method: 'POST',
          body: { properties: { exp } },
        });
      } else {
        throw createErr;
      }
    }

    // 2. Meeting tokens — piloto publisher, box viewer.
    // Owner=true permite controle (importante pro box poder kickar etc).
    // is_owner é só pro Box; piloto entra como participante normal.
    const [tokenPiloto, tokenBox] = await Promise.all([
      dailyFetch('/meeting-tokens', {
        method: 'POST',
        body: {
          properties: {
            room_name: room.name,
            user_name: 'Piloto',
            exp,
            start_audio_off: true,
            start_video_off: false,
            enable_screenshare: false,
          },
        },
      }),
      dailyFetch('/meeting-tokens', {
        method: 'POST',
        body: {
          properties: {
            room_name: room.name,
            user_name: 'Box',
            is_owner: true,
            exp,
            start_audio_off: true,
            start_video_off: true,    // box NÃO publica câmera
            enable_screenshare: false,
          },
        },
      }),
    ]);

    return res.status(200).json({
      ok: true,
      roomName: room.name,
      roomUrl: room.url,
      tokenPiloto: tokenPiloto.token,
      tokenBox: tokenBox.token,
      exp,
      sessionId: sessionIdInput,
      eventId: eventIdInput,
      dateISO: dateISOInput,
    });
  } catch (err) {
    return res.status(502).json({
      error: 'Daily upstream',
      detail: String(err.message || err).slice(0, 300),
    });
  }
}
