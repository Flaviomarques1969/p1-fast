// Ponte interna do teste de aparelhos.
// O navegador (notebook e celular) chama ESTE endereço (mesmo site, sem trava).
// Aqui dentro, no servidor, a gente chama o backend de vídeo do fam-racing
// (que bloqueia chamada de outro site, mas libera chamada de servidor pra servidor).
// Retorna a mesma sala + acessos pros dois lados (transmite / assiste).

const ROOM_BACKEND = 'https://fam-racing.vercel.app/api/video/room';
const EVENT_ID = 'p1-teste-aparelhos';

export default async function handler(req, res) {
  try {
    // data de hoje (YYYY-MM-DD) — sala é determinística por evento+dia,
    // então notebook e celular caem na MESMA sala automaticamente.
    const dateISO = new Date().toISOString().slice(0, 10);
    const r = await fetch(ROOM_BACKEND, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: EVENT_ID, dateISO }),
    });
    const text = await r.text();
    res.setHeader('Content-Type', 'application/json');
    res.status(r.status).send(text);
  } catch (e) {
    res.status(502).json({ ok: false, error: String(e && e.message || e) });
  }
}
