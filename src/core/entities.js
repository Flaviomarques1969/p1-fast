// ═══════════════════════════════════════════════════════════
// ENTITIES — nomes canônicos para syncQueue.enqueue (T-018 / A-014)
// ═══════════════════════════════════════════════════════════
// Usar sempre via import ao invés de string literal.
// Divergência silenciosa entre literais quebra o drainer remoto quando chegar.

export const ENTITIES = Object.freeze({
  USER:                 'User',
  CAR:                  'Car',
  CAR_CONFIGURATION:    'CarConfiguration',
  TRACK:                'Track',
  TRACK_LAYOUT:         'TrackLayout',
  TRACK_SEGMENT:        'TrackSegment',
  SESSION:              'Session',
  LAP:                  'Lap',
  LAP_VALIDITY_EVENT:   'LapValidityEvent',
  DEVICE:               'Device',
  DEVICE_HANDOVER:      'DeviceHandover',
  PEDAGOGICAL_PLAN:     'PedagogicalPlan',
  SEGMENT_EXECUTION:    'SegmentExecution',
  TELEMETRY_SAMPLE:     'TelemetrySample',   // NOTA ADR-014: não enfileira por row
});
