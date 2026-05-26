// t3000-usb-parser.js — decodificador do bloco RI da Injepro T3000.
//
// VERSÃO 2 (2026-05-26): mapeamento completo via engenharia reversa do
// software oficial T LINE v3.3.7. Fonte: t8000.Services.DeviceEFI.
// USBDeviceEFIService linha 6207+ no software oficial decompilado.
//
// Spec: memória p1-fast-injepro-protocolo-2026-05-25.md
//
// Protocolo:
//   1. Manda "ACK" no endpoint OUT — espera "OK" no endpoint IN.
//   2. Manda "RI" (Read Instruments) — recebe bloco binário ~410-490 bytes
//      (variável por versão; valor em `_parameters.TamanhoMedidores`).
//
// Layout little-endian (resumo — detalhes nos comentários do código):
//   off  tipo   var      campo                            conversão
//   ─── ─────── ──────── ────────────────────────────────  ───────────────
//   0   uint16  num100   RPM                                direto
//   2   uint16  num101   Bateria                            ÷10 → V
//   4   int16   num102   MAP interno                        ÷100 → bar
//   6   int16   num103   SensorExterno1                     direto
//   ...                                                     (até num122/of 44)
//   46  uint16  num123   TPS1Borb1                          ÷10 → %
//   48  uint16  num124   TPS2Borb1                          ÷10 → %
//   50  uint16  num125   TPSAlvo                            ÷10 → %
//   52  uint16  num126   Pedal acelerador físico            ÷10 → %
//   54  uint16  num127   Pedal2 (pode ser freio)            ÷10 → %
//   56  int16   num128   TemperaturaAr                      °C direto
//   58  int16   num129   TemperaturaMotor (água)            °C direto
//   60  uint16  num130   SondaLambda                        ÷1000 → λ
//   62  uint16  num131   BandaLarga raw
//   64-67       skip4    int32 reservado
//   68  uint16×8  duty injeção banca A (cil 1..8)           ÷10 → %
//   84  uint16×8  tempo injeção banca A                     ÷100 ou ÷1000
//   100 byte    b18      StatusSinais bitfield
//   101 byte    b19      VelocidadeDestracionamento
//   102 uint16  num148   Velocidade                         ÷10 → km/h
//   104 int16   num149   ConsumoBorboleta                   ÷100
//   106 int16   num150   AnguloInjecao
//   108 byte    b4       MapaAtual (+1)
//   109 byte    b20      AtuacaoCorteIgnicao
//   ...                                                     (mais campos)
//   268 int16   num28    PressaoFreio                       ÷100 → bar
//   270 int16   num30    AxisX  (acelerômetro T3000)        ÷1000 → g
//   272 int16   num31    AxisY                              ÷1000
//   274 int16   num32    AxisZ                              ÷1000
//   288 uint32  num34    Bits ALARMES (excessoRotacao,
//                         excessoTempMotor, baixaPressaoOleo,
//                         baixaPressaoCombustivel, etc — 11 bits)
//   292 uint32  num35    CronometroParcial                  ÷1000 → s
//   296 uint32  num36    CronometroTotal                    ÷1000 → s
//   358 uint16×8  duty injeção banca B
//   374 uint16×4  duty injeção banca C
//
// Campos NÃO presentes na T3000 (esperados pela LiveDataBridge):
//   - Marcha: NÃO existe campo direto; pode ser inferida via RPM×velocidade.
//   - EGT: só vem se houver aparelho CAN tipo Egt4 plugado (offsets 152+).
//   - Pressão de óleo: só aparece como bit booleano (baixaPressaoOleo).
//   - Temperatura óleo: NÃO existe campo direto.

const PARSER_VERSION = '2.0.0';

function u16le(b, o) { return b[o] | (b[o+1] << 8); }
function i16le(b, o) { const v = u16le(b,o); return v > 0x7FFF ? v - 0x10000 : v; }
function u32le(b, o) { return (b[o] | (b[o+1]<<8) | (b[o+2]<<16) | (b[o+3]<<24)) >>> 0; }
function bit(byte, n) { return ((byte >> n) & 1) === 1; }
function bit32(num, n) { return ((num >>> n) & 1) === 1; }

// Sensores de temperatura podem retornar valores especiais quando não há
// sonda física (Bubi tem só 1 de cada). Reconhecemos os valores típicos.
function tempC(raw) {
  if (raw === -2 || raw === -20 || raw === 0x7FFF || raw === -32768) return null;
  return raw;
}

export function parseT3000RIBlock(buf, opts = {}) {
  if (!(buf instanceof Uint8Array)) return null;
  if (buf.length < 110) return null;

  const tMono = typeof opts.tMono === 'number' ? opts.tMono : Date.now();
  const len = buf.length;

  const rpm = u16le(buf, 0);
  const bateriaRaw = u16le(buf, 2);
  const mapRaw = i16le(buf, 4);

  const sensoresExternos = [];
  for (let i = 0; i < 20; i++) sensoresExternos.push(i16le(buf, 6 + i*2));

  const tps1Raw = u16le(buf, 46);
  const tps2Raw = u16le(buf, 48);
  const tpsAlvoRaw = u16le(buf, 50);
  const pedal1Raw = u16le(buf, 52);
  const pedal2Raw = u16le(buf, 54);
  const tempArRaw = i16le(buf, 56);
  const tempMotorRaw = i16le(buf, 58);
  const lambdaRaw = u16le(buf, 60);
  const wbRaw = u16le(buf, 62);
  // offset 64-67: int32 reservado

  const fuelInjDutyA = [];
  for (let i = 0; i < 8; i++) fuelInjDutyA.push(u16le(buf, 68 + i*2));
  const fuelTimeA = [];
  for (let i = 0; i < 8; i++) fuelTimeA.push(u16le(buf, 84 + i*2));

  const b18 = buf[100];
  const b19 = buf[101];
  const velocidadeRaw = u16le(buf, 102);
  const consumoRaw = i16le(buf, 104);
  const anguloInjecaoRaw = i16le(buf, 106);
  const mapaAtual = (buf[108] | 0) + 1;
  const atuacaoCorteIgnicao = buf[109];

  // Os campos abaixo só existem se o bloco for grande o bastante.
  let pressaoFreioRaw = null, accelXRaw = null, accelYRaw = null, accelZRaw = null;
  let alarmesBits = 0, cronoParcial = null, cronoTotal = null;
  if (len >= 270) pressaoFreioRaw = i16le(buf, 268);
  if (len >= 276) {
    accelXRaw = i16le(buf, 270);
    accelYRaw = i16le(buf, 272);
    accelZRaw = i16le(buf, 274);
  }
  if (len >= 292) alarmesBits = u32le(buf, 288);
  if (len >= 296) cronoParcial = u32le(buf, 292);
  if (len >= 300) cronoTotal = u32le(buf, 296);

  const fuelInjDutyB = [];
  if (len >= 374) for (let i = 0; i < 8; i++) fuelInjDutyB.push(u16le(buf, 358 + i*2));
  const fuelInjDutyC = [];
  if (len >= 382) for (let i = 0; i < 4; i++) fuelInjDutyC.push(u16le(buf, 374 + i*2));

  // diagnóstico de cilindros (só primeiros 4 — Celta tem 4 cil)
  const time4 = fuelTimeA.slice(0, 4);
  const time4Min = Math.min(...time4);
  const time4Max = Math.max(...time4);
  const time4Spread = time4Max - time4Min;
  const time4Balanced = time4Spread <= 200; // tolerância empírica

  // Alguma temperatura/sensor pode estar usando 0x7FFF como "fora"
  const waterTempC = tempC(tempMotorRaw);
  const airTempC = tempC(tempArRaw);

  return {
    // metadados
    source: 't3000-usb',
    parserVersion: PARSER_VERSION,
    tMono,
    checksumOk: true,
    bytesLen: len,

    // ── motor (diagnóstico) ──
    rpm,
    batteryV: bateriaRaw / 10,
    mapBar: mapRaw / 100,
    tpsPct: tps1Raw / 10,
    tps2Pct: tps2Raw / 10,
    tpsTargetPct: tpsAlvoRaw / 10,
    airTempC,
    waterTempC,                          // LiveDataBridge consome
    lambda: lambdaRaw / 1000,
    lambdaWBRaw: wbRaw,
    mapaAtual,
    anguloInjecao: anguloInjecaoRaw,
    consumoBorboleta: consumoRaw / 100,
    atuacaoCorteIgnicao,

    // ── pilotagem (entram no painel do piloto) ──
    pedalAceleradorPct: pedal1Raw / 10,
    pedalFreioPct: pedal2Raw / 10,
    pressaoFreioBar: pressaoFreioRaw !== null ? pressaoFreioRaw / 100 : null,
    speedKmh: velocidadeRaw / 10,
    accelXg: accelXRaw !== null ? accelXRaw / 1000 : null,
    accelYg: accelYRaw !== null ? accelYRaw / 1000 : null,
    accelZg: accelZRaw !== null ? accelZRaw / 1000 : null,

    // ── saúde dos cilindros ──
    fuelInjectionRaw: time4,             // mantém compat com v1
    fuelInjectionBalanced: time4Balanced,
    fuelInjectionSpread: time4Spread,
    fuelInjDutyA,
    fuelInjDutyB,
    fuelInjDutyC,
    fuelTimeA,

    // ── alarmes (bitfield → flags humanas) ──
    alarmes: {
      excessoRotacao:          bit32(alarmesBits, 0),
      excessoPressao:          bit32(alarmesBits, 1),
      excessoTempMotor:        bit32(alarmesBits, 2),
      excessoAberturaInjetor:  bit32(alarmesBits, 3),
      baixaPressaoOleo:        bit32(alarmesBits, 4),
      wbMinimo:                bit32(alarmesBits, 5),
      wbMaximo:                bit32(alarmesBits, 6),
      nbMinimo:                bit32(alarmesBits, 7),
      nbMaximo:                bit32(alarmesBits, 8),
      baixaPressaoCombustivel: bit32(alarmesBits, 9),
      alertaNivelCombustivel:  bit32(alarmesBits, 10),
    },
    statusSinais: {
      corteArrancada:    bit(b18, 0),
      corteAquecimento:  bit(b18, 1),
      sinalNitro:        bit(b18, 2),
      arCondicionado:    bit(b18, 3),
      sinalBooster:      bit(b18, 4),
      boostPlus:         bit(b18, 5),
      saidaTrocaMarcha:  bit(b18, 6),
      alarme:            bit(b18, 7),
    },

    // ── cronômetros ──
    cronometroParcialS: cronoParcial !== null ? cronoParcial / 1000 : null,
    cronometroTotalS:   cronoTotal   !== null ? cronoTotal   / 1000 : null,

    // ── compat com LiveDataBridge ──
    // Campos que o bridge consulta — quando não temos, ficam undefined
    // pra ele NÃO disparar alerta falso.
    marcha: null,                  // T3000 não fornece direto
    egtC: null,                    // só via aparelho CAN externo
    egtOutOfRange: false,
    oilPressBar: undefined,        // só bit booleano em alarmes
    oilTempC: undefined,           // não existe campo
    ecuErrorBits: alarmesBits,     // bitfield completo de alarmes

    // ── sensores externos genéricos ──
    sensoresExternos,
  };
}

export const ACK_BYTES = new Uint8Array([0x41, 0x43, 0x4B]);
export const RI_BYTES = new Uint8Array([0x52, 0x49]);

export function isAckOk(buf) {
  if (!(buf instanceof Uint8Array) || buf.length < 2) return false;
  return buf[0] === 0x4F && buf[1] === 0x4B;
}
