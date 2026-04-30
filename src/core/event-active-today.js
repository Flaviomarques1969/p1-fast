// ═══════════════════════════════════════════════════════════════════════════
// event-active-today — descobre o evento ativo do dia (compartilhado)
// ═══════════════════════════════════════════════════════════════════════════
// Fonte: localStorage `fam_app_v1` (mantido pelo App do Usuário em app.html).
// Estrutura: { carros, eventos: [{ id, dias: [{ id, data, desc, ... }], finalizado }], pends }
//
// "Evento ativo do dia" =
//   evento NÃO finalizado que tem ALGUM dia com data === hoje (TZ local).
//
// Usado por:
//   - cockpit-mobile.html → auto-iniciar VideoPublisher quando piloto entra
//   - box-view.js         → auto-iniciar VideoViewer quando engenheiro entra
//   - api/video/room.js   → cliente envia { eventId, dateISO } pra sala determinística
//
// Decisão Flavio 2026-04-26: gatilho da videoconferência = "cockpit aberto +
// evento do dia". Sem evento do dia → não cria sala (sem fala vazia, sem
// custo Daily). Com evento → ambas as pontas convergem na mesma sala
// determinística sem signaling extra.

const STORAGE_KEY = 'fam_app_v1';
const ACTIVE_STINT_KEY = 'fam_active_stint';

/**
 * Hoje em formato YYYY-MM-DD (timezone local).
 * @returns {string}
 */
export function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Lê o DB do app (localStorage). Retorna estrutura vazia se não existe.
 * @returns {{ carros: any[], eventos: any[], pends: any[] }}
 */
function readDB() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { carros: [], eventos: [], pends: [] };
    const parsed = JSON.parse(raw);
    return {
      carros: parsed.carros || [],
      eventos: parsed.eventos || [],
      pends: parsed.pends || [],
    };
  } catch {
    return { carros: [], eventos: [], pends: [] };
  }
}

/**
 * Encontra o evento ativo HOJE.
 * @param {{ today?: string }} [opts]
 * @returns {{ eventId: string, eventNome: string, diaId: string, dateISO: string } | null}
 */
export function getEventoAtivoDoDia(opts = {}) {
  const today = opts.today || todayISO();
  const { eventos } = readDB();
  for (const ev of eventos) {
    if (ev.finalizado) continue;
    const dias = ev.dias || [];
    const dia = dias.find(d => d && d.data === today);
    if (dia) {
      return {
        eventId: String(ev.id),
        eventNome: String(ev.nome || ''),
        diaId: String(dia.id),
        dateISO: today,
        trackId: ev.trackId ? String(ev.trackId) : null,
      };
    }
  }
  return null;
}

/**
 * Sanitiza eventId pra uso em nome de sala (alfanumérico/underscore/hífen).
 * @param {string} s
 * @returns {string}
 */
export function safeEventId(s) {
  return String(s || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 32);
}

/**
 * Constrói nome determinístico da sala Daily a partir de evento+dia.
 * Mesmo evento+dia em ambas as pontas → mesma sala, sem signaling.
 * @param {{ eventId: string, dateISO: string }} ctx
 * @returns {string}
 */
export function deterministicRoomName({ eventId, dateISO }) {
  const safe = safeEventId(eventId);
  const date = String(dateISO).replace(/-/g, '');
  return `evento-${safe}-${date}`;
}

/**
 * Lê ?stint=ID da URL atual (cockpit-mobile.html?stint=xxx ou box.html?stint=xxx).
 * @returns {string | null}
 */
export function getStintIdFromUrl() {
  try {
    const params = new URLSearchParams(location.search);
    return params.get('stint') || null;
  } catch {
    return null;
  }
}

/**
 * Resolve o stint ATIVO completo (evento, dia, stint, carro, config).
 * Prioridade de origem do ID:
 *   1. ?stint=ID na URL (vem do app: cockpitHub abriu cockpit/box)
 *   2. localStorage `fam_active_stint` (último marcado USAR no app)
 * Cruza com fam_app_v1 pra montar o objeto completo.
 *
 * Inclui `config` (objeto config-base completo) e `overrides` (ajustes
 * deste stint) — consumidores aplicam getEffectiveSetup() pra obter o
 * setup efetivo. Campos `posStint` (se preenchido) também são expostos.
 *
 * Inclui `trackId` (entidade Dexie do autódromo do evento) e `trechosFoco`
 * (lista de IDs de TrackSegment marcados como foco no stint) — pipeline
 * F4 dinâmico (FocusMode + ProximityWatcher) consome esses campos pra
 * acionar PREPARANDO/EXECUTANDO/RESULTADO no cockpit do piloto.
 *
 * @returns {{
 *   eventId: string, eventNome: string, dateISO: string, diaId: string,
 *   stintId: string,
 *   carId: string|null, carNome: string,
 *   configId: string|null, configNome: string,
 *   config: object|null, overrides: object|null, posStint: object|null,
 *   voltasPlanejadas: number|null, objetivo: string,
 *   trackId: string|null, trechosFoco: string[],
 * } | null}
 */
export function resolveActiveStint() {
  let stintId = getStintIdFromUrl();
  let activeMeta = null;
  try {
    const raw = localStorage.getItem(ACTIVE_STINT_KEY);
    if (raw) activeMeta = JSON.parse(raw);
  } catch {}
  if (!stintId && activeMeta?.stintId) stintId = activeMeta.stintId;
  if (!stintId) return null;

  let db;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    db = raw ? JSON.parse(raw) : null;
  } catch { db = null; }
  if (!db) return null;

  for (const ev of (db.eventos || [])) {
    if (ev.finalizado) continue;
    const stintsByDia = ev.stintsByDia || {};
    for (const diaId of Object.keys(stintsByDia)) {
      const lista = stintsByDia[diaId] || [];
      const found = lista.find(s => s && s.id === stintId);
      if (found) {
        const dia = (ev.dias || []).find(d => d.id === diaId);
        const carro = (db.carros || []).find(c => c.id === found.carId) || null;
        const cfg = (db.configs || []).find(cf => cf.id === found.configId) || null;
        return {
          eventId: String(ev.id),
          eventNome: String(ev.nome || ''),
          dateISO: String(dia?.data || ev.data || ''),
          diaId: String(diaId),
          stintId: String(stintId),
          carId: carro?.id || null,
          carNome: carro?.nome || '',
          configId: cfg?.id || null,
          configNome: cfg?.nome || '',
          config:    cfg || null,
          overrides: found.overrides || null,
          posStint:  found.posStint  || null,
          voltasPlanejadas: found.voltasPlanejadas ?? null,
          objetivo: String(found.objetivo || ''),
          trackId: ev.trackId ? String(ev.trackId) : null,
          trechosFoco: Array.isArray(found.trechosFoco) ? [...found.trechosFoco] : [],
        };
      }
    }
  }
  return null;
}
