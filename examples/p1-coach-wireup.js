// ═══════════════════════════════════════════════════════════
// Exemplo de integração: P1 Coach + Detector + fase-curva
// ═══════════════════════════════════════════════════════════
// Mostra como o caller (cockpit/UI) liga o P1 Coach ao pipeline real.
//
// Não é código vivo do pacote — fica em examples/ pra servir de
// referência quando a UI nova for construída. Auditável + roda em
// node se importado por um harness de teste.
//
// Cenário coberto:
//   1. Mobile telemetry emite Sample (GPS + IMU @ 10-60Hz)
//   2. Detector observa Sample e emite onSegmentStart/onSegmentEnd
//   3. Cada Sample alimenta um classificador de FASE LIVE (ao vivo,
//      não apenas pós-trecho como classificarFases())
//   4. Cada Sample (durante curva) vai pro p1Coach.consume()
//   5. p1Coach.onMessage entrega CoachMessage pra UI renderizar
//
// O caller resolve dois gaps:
//   • cornerType — Detector emite só segmentId; o caller faz
//     lookup em TrackSegments para enriquecer.
//   • fase live — fase-curva.classificarFases roda no fim do
//     trecho. Para coaching ao vivo, usamos uma máquina de estado
//     simples baseada em accLong (mesmo limiar do fase-curva).

import { P1Coach } from '../src/domain/p1-coach.js';
import { Phase } from '../src/domain/lesson-schema.js';
import { TrackSegments } from '../src/domain/track-segment.js';
import { TrajectoryMonitor } from '../src/domain/trajectory-monitor.js';

// Limiares idênticos a src/telemetry/fase-curva.js — manter em sincronia.
const LIMIAR_FREIO_G = -0.35;
const LIMIAR_ACEL_G  = +0.25;

/**
 * Máquina de estado mínima para classificar a fase corrente do trecho
 * ao vivo, sample a sample. Estado se reseta a cada onSegmentEnter.
 *
 * Fase de saída ('inicio'|'meio'|'fim') casa com PHASE_FROM_FASE_CURVA
 * dentro do P1Coach.
 */
function makeFaseLiveStateMachine() {
  let fase = 'inicio';
  return {
    reset() { fase = 'inicio'; },
    next(sample) {
      const a = sample.accLong;
      if (a == null) return fase;
      // INICIO → MEIO: deixou de frear forte
      if (fase === 'inicio' && a > LIMIAR_FREIO_G) fase = 'meio';
      // MEIO → FIM: começou a acelerar
      if (fase === 'meio' && a > LIMIAR_ACEL_G) fase = 'fim';
      return fase;
    },
    current() { return fase; },
  };
}

/**
 * Liga o P1 Coach ao pipeline. Retorna handle com `start/stop` e o
 * coach instanciado para a UI controlar a sessão de aprendizado.
 *
 * @param {object} deps
 * @param {object} deps.detector       instância de Detector
 * @param {object} deps.sampleBus      instância do sample-bus (sub a samples)
 * @param {function} deps.onMessage    UI consumer; recebe CoachMessage
 * @returns {{coach: P1Coach, stop: ()=>void}}
 */
export function wireUpP1Coach({ detector, sampleBus, onMessage }) {
  const coach = new P1Coach({ onMessage });
  const fase = makeFaseLiveStateMachine();
  let currentSegment = null;          // TrackSegment enriquecido
  let currentVelMinima = null;        // streaming V-min dentro do trecho atual

  // ── Sample → coach.consume ──
  const offSample = sampleBus.attach('p1-coach', async (sample) => {
    if (!currentSegment) return;       // só faz coaching dentro de trecho

    // Atualiza V-min live (fase-curva calcula no fim, mas pra coaching
    // queremos a info parcial já durante o MEIO).
    if (sample.kmh != null) {
      if (currentVelMinima == null || sample.kmh < currentVelMinima) {
        currentVelMinima = sample.kmh;
      }
    }

    const faseAtual = fase.next(sample);
    const faseStats = {
      velEntrada: currentSegment.velEntradaSnapshot ?? null,
      velMinima:  currentVelMinima,
      // velSaida e apexT só existem no fim do trecho — coach não exige
    };
    const signals = P1Coach.signalsFromSnapshot(sample, faseStats);
    coach.consume({ faseCurva: faseAtual, snapshot: sample, signals });
  });

  // ── Detector → coach.onSegmentEnter/Exit ──
  const offSegStart = detector.onSegmentStart(async (ev) => {
    // Detector emite só { segmentId, ... }. Enriquecemos com TrackSegments.
    const seg = await TrackSegments.get(ev.segmentId);
    if (!seg) return;
    currentSegment = { ...seg, velEntradaSnapshot: ev.velEntrada };
    currentVelMinima = ev.velEntrada ?? null;
    fase.reset();

    // Sinais ainda não derivados nesse instante — usamos um snapshot
    // mínimo só com velEntrada para deixar o coach eleger lição com
    // o que tem.
    const stubSnapshot = { kmh: ev.velEntrada, lat: 0, lng: 0, accLong: 0 };
    const signals = P1Coach.signalsFromSnapshot(stubSnapshot, { velEntrada: ev.velEntrada });
    coach.onSegmentEnter(seg, signals);
  });

  const offSegEnd = detector.onSegmentEnd(() => {
    coach.onSegmentExit();
    currentSegment = null;
    currentVelMinima = null;
    fase.reset();
  });

  const offLap = detector.onLap(() => coach.onLapEnd());

  // ── shutdown ──
  return {
    coach,
    stop() {
      offSample?.();
      offSegStart?.();
      offSegEnd?.();
      offLap?.();
      coach.endLearningSession();
    },
  };
}

// ─── Uso típico na UI do cockpit ───────────────────────────
//
// import { wireUpP1Coach } from '../examples/p1-coach-wireup.js';
//
// const handle = wireUpP1Coach({
//   detector,
//   sampleBus,
//   onMessage: (msg) => cockpit.showCoachMessage(msg.text),
// });
//
// // piloto toca botão "Aprendizado com IA"
// btnAprendizado.onclick = () => {
//   const focus = await ui.askFocusPhase();        // 'entrada'|'apex'|'saida'
//   handle.coach.startLearningSession({ focusPhase: focus });
// };
//
// // alerta crítico chega → suspender coaching
// criticalRulesEngine.onAlert = (a) => {
//   if (a.nivel === 'CRITICO' || a.nivel === 'BOX_AGORA') {
//     handle.coach.pause();
//   }
// };
//
// // alerta resolveu → retomar
// criticalRulesEngine.onClear = () => handle.coach.resume();
