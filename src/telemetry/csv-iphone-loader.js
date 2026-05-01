// ═══════════════════════════════════════════════════════════
// csv-iphone-loader — parsea CSV do P1FastIMUTest em Sample[]
// ═══════════════════════════════════════════════════════════
// Formato esperado (header obrigatório, exato):
//   ts_iso,tMono_s,kind,accLong_ms2,accLat_ms2,accVert_ms2,lat,lng,speed_ms,gpsAcc_m
//
// Cada linha vira um Sample canônico do TelemetryProvider:
//   - kind='imu'  → accLong/accLat/accVert preenchidos; lat/lng/speed/gpsAccuracy null
//   - kind='gps'  → lat/lng (e speed/gpsAccuracy quando presentes); acc* null
//
// `t` = Date.parse(ts_iso)   (ms unix)
// `tMono` = tMono_s * 1000   (ms)
//
// Não funde IMU+GPS. Cada linha é um Sample independente.
// Pra alimentar o Detector (que precisa de x/y), passe os samples
// por TelemetryTimebase (faz a fusão multi-source) ou aplique uma
// projeção lat/lng→viewBox com track conhecido.
//
// Função pura, síncrona — recebe texto. Leitura de arquivo é
// responsabilidade de quem chama (fs/readFile ou fetch).

const REQUIRED_HEADER = [
  'ts_iso', 'tMono_s', 'kind',
  'accLong_ms2', 'accLat_ms2', 'accVert_ms2',
  'lat', 'lng', 'speed_ms', 'gpsAcc_m',
];

function parseFloatOrNull(s) {
  if (s == null || s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parsea CSV do P1FastIMUTest em Array<Sample>.
 *
 * @param {string} text                       conteúdo bruto do CSV
 * @param {object} [opts]
 * @param {string} [opts.source='iphone-csv'] aplicado a sample.source
 * @param {string} [opts.sessionId=null]      aplicado a sample.sessionId
 * @returns {{
 *   samples: Array<object>,
 *   dropped: number,
 *   imuCount: number,
 *   gpsCount: number,
 *   firstT: number|null,
 *   lastT: number|null,
 * }}
 */
export function loadIphoneCsv(text, opts = {}) {
  if (typeof text !== 'string') {
    throw new Error('[csv-iphone-loader] text deve ser string');
  }
  const source = opts.source || 'iphone-csv';
  const sessionId = opts.sessionId || null;

  const lines = text.split(/\r?\n/);
  // Filtra header + linhas significativas
  let headerLine = null;
  let firstDataIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === '' || line.startsWith('#')) continue;
    headerLine = line;
    firstDataIdx = i + 1;
    break;
  }
  if (!headerLine) {
    throw new Error('[csv-iphone-loader] CSV vazio (sem header)');
  }
  const header = headerLine.split(',');
  if (header.length !== REQUIRED_HEADER.length ||
      !REQUIRED_HEADER.every((h, i) => header[i] === h)) {
    throw new Error('[csv-iphone-loader] header inválido. Esperado: ' + REQUIRED_HEADER.join(','));
  }

  const samples = [];
  let dropped = 0;
  let imuCount = 0;
  let gpsCount = 0;
  let firstT = null;
  let lastT = null;
  let seq = 0;

  for (let i = firstDataIdx; i < lines.length; i++) {
    const raw = lines[i];
    if (raw === '' || raw.startsWith('#')) continue;
    const cols = raw.split(',');
    if (cols.length !== REQUIRED_HEADER.length) { dropped++; continue; }

    const tsIso = cols[0];
    const tMonoS = cols[1];
    const kind = cols[2];

    const t = Date.parse(tsIso);
    if (!Number.isFinite(t)) { dropped++; continue; }
    const tMono = parseFloatOrNull(tMonoS);
    if (tMono == null) { dropped++; continue; }
    if (kind !== 'imu' && kind !== 'gps') { dropped++; continue; }

    const accLong = parseFloatOrNull(cols[3]);
    const accLat  = parseFloatOrNull(cols[4]);
    const accVert = parseFloatOrNull(cols[5]);
    const lat     = parseFloatOrNull(cols[6]);
    const lng     = parseFloatOrNull(cols[7]);
    const speed   = parseFloatOrNull(cols[8]);
    const gpsAcc  = parseFloatOrNull(cols[9]);

    const sample = {
      sessionId,
      seq: seq++,
      t,
      tMono: tMono * 1000,
      source,
      signalQuality: 'good',
      kind,
      lat: lat,
      lng: lng,
      alt: null,
      speed: speed,
      heading: null,
      accLong: accLong,
      accLat: accLat,
      accVert: accVert,
      gyroX: null, gyroY: null, gyroZ: null,
      gpsAccuracy: gpsAcc,
      x: null, y: null,
    };

    if (kind === 'imu') imuCount++;
    else gpsCount++;

    if (firstT == null) firstT = t;
    lastT = t;
    samples.push(sample);
  }

  return { samples, dropped, imuCount, gpsCount, firstT, lastT };
}
