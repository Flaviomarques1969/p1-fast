// ═══════════════════════════════════════════════════════════
// Exemplo de integração: Smart Shift Light Premium
// ═══════════════════════════════════════════════════════════
// Mostra como o caller (cockpit) liga todos os pedaços do Shift Light
// ao pipeline real:
//
//   1. MobileTelemetry emite Sample (GPS + IMU)
//   2. Detector consome Sample → mantém segmentoAtual ao vivo
//   3. trecho-resolver lê o Detector via getCurrentTrechoIdSync()
//   4. shift-light-bridge mapeia Sample + RPM (canal externo) → ShiftSample
//   5. shift-event-detector emite shift_event com 25 campos
//   6. shift-events.saveEvent persiste com idempotência
//   7. Pós-sessão: listEventsBySession → buildShiftCardsListHTML
//      renderiza os cards Fast Coach (mesmo HTML do mockup)
//
// Não é código vivo do pacote — fica em examples/ como referência.

import { Detector } from '../src/telemetry/detector.js';
import { createShiftEventDetector } from '../src/pipeline/shift-event-detector.js';
import { createShiftLightBridge } from '../src/pipeline/shift-light-bridge.js';
import {
  setTrechoSource, getCurrentTrechoIdSync
} from '../src/data/trecho-resolver.js';
import { saveEvent, listEventsBySession } from '../src/data/shift-events.js';
import { buildShiftCardsListHTML } from '../src/ui/shift-cards-view.js';

// ─── Setup ────────────────────────────────────────────────────────────────

export function wireUpShiftLight({ mobileTelemetry, detector, car, session, getRpm, getTps }) {
  // 1. Detector vira fonte de verdade pro trecho atual
  setTrechoSource(detector);

  // 2. Cria o shift-event-detector com persistência idempotente
  const shiftDetector = createShiftEventDetector({
    piloto_id: session.piloto_id,
    carro_id: car.id,
    sessao_id: session.id,
    car,
    onEvent: (ev) => { saveEvent(ev); },
    resolveTrecho: () => getCurrentTrechoIdSync()
  });

  // 3. Cria a bridge: Sample do MobileTelemetry → ShiftSample
  const bridge = createShiftLightBridge({
    shiftDetector,
    getRpm,
    getTps
  });

  // 4. Subscreve o stream do MobileTelemetry
  const originalOnSample = mobileTelemetry.onSample;
  mobileTelemetry.onSample = (sample) => {
    detector.consumeSnapshot
      ? detector.consumeSnapshot({ position: { lat: sample.lat, lng: sample.lng }, t: sample.t, kmh: sample.kmh })
      : null;
    bridge.onTelemetrySample(sample);
    if (originalOnSample) originalOnSample(sample);
  };

  return { shiftDetector, bridge };
}

// renderPostSession(sessionId, container, car, trechoNameLookup)
// Helper para a tela pós-sessão. trechoNameLookup pode vir do TrackSegments.
export async function renderPostSession({ sessionId, container, car, trechoNameLookup = null }) {
  const events = await listEventsBySession(sessionId);
  container.innerHTML = buildShiftCardsListHTML(events, car, trechoNameLookup);
  return events.length;
}
