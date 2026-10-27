// Ponte interna do teste de aparelhos.
// O navegador (notebook e celular) chama ESTE endereço (mesmo site, sem trava).
// Aqui dentro, no servidor, a gente chama o backend de vídeo do fam-racing
// (que bloqueia chamada de outro site, mas libera chamada de servidor pra servidor).
// Retorna a mesma sala + acessos pros dois lados (transmite / assiste).
//
// E3 da TV do box ao vivo (27/10/2026): esta MESMA ponte vai no pacote do p1box (a TV chama
// /api/room do próprio site — a TV não pode chamar o fam-racing direto, a trava de origem barra).
//  • data da sala em BRASÍLIA (antes UTC: das 21h às 24h o notebook caía na sala de "amanhã" e a
//    TV/celular na de "hoje" — salas diferentes, vídeo preto). O notebook manda a mesma data.
//  • { papel: 'tv' } no corpo → só o acesso de espectador volta (a TV nunca leva o tokenPiloto),
//    mesmo com o backend antigo no ar.

const ROOM_BACKEND = 'https://fam-racing.vercel.app/api/video/room';
const EVENT_ID = 'p1-teste-aparelhos';

// Brasília = UTC−3 o ano todo (sem horário de verão desde 2019).
export function dataSalaBrasilia(agoraMs = Date.now()) {
  return new Date(agoraMs - 3 * 3600 * 1000).toISOString().slice(0, 10);
}

function papelDoPedido(req) {
  let b = req && req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = null; } }
  const p = b && typeof b === 'object' ? b.papel : null;
  return p === 'tv' || p === 'box' ? 'tv' : null;
}

export default async function handler(req, res, { fetchFn = fetch, agoraMs } = {}) {
  try {
    const papel = papelDoPedido(req);
    // sala determinística por evento+dia: notebook, TV e celular caem na MESMA sala.
    const dateISO = dataSalaBrasilia(agoraMs);
    const r = await fetchFn(ROOM_BACKEND, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(papel ? { eventId: EVENT_ID, dateISO, papel } : { eventId: EVENT_ID, dateISO }),
    });
    let text = await r.text();
    if (papel && r.ok) {
      const j = JSON.parse(text);
      delete j.tokenPiloto;
      text = JSON.stringify(j);
    }
    res.setHeader('Content-Type', 'application/json');
    res.status(r.status).send(text);
  } catch (e) {
    res.status(502).json({ ok: false, error: String(e && e.message || e) });
  }
}
