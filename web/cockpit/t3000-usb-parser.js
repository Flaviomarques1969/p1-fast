// t3000-usb-parser.js — decodificador mínimo do bloco RI da Injepro T3000.
//
// Spec descoberta em 2026-05-25 (memória: p1-fast-injepro-protocolo-2026-05-25).
//
// Protocolo: você manda "ACK" (3 bytes ASCII) e recebe "OK" (2 bytes).
// Depois manda "RI" (Read Instruments) e recebe um bloco de ~460 bytes
// little-endian com leitura completa dos sensores da central.
//
// Esta v1 mapeia APENAS os campos confirmados em campo com o Celta "Bubi"
// (Flávio, 2026-05-25, marcha lenta 940-949 rpm):
//   - bytes 0-1   → RPM (little-endian uint16, rpm direto)
//   - bytes 2-3   → Tensão da bateria (little-endian uint16, ÷10 = volts)
//   - bytes 84-91 → Tempo de injeção por cilindro (4 × uint16 little-endian)
//   - byte  ???   → Erro ECU (a confirmar — posição candidata: byte 65 = 0x02
//                    em motor parado, pode ser bitfield de status)
//
// Campos NÃO confirmados (decodificador NÃO devolve, painel ignora alertas):
//   temperatura água/óleo/ar, pressão óleo/combustível, lambda, MAP, TPS,
//   marcha, velocidade, EGT, temp combustível.
//
// Próxima rodada: expandir mapeamento via engenharia reversa do software
// oficial T LINE (já descompactado em /tmp/T10000-extracted/).

const PARSER_VERSION = '1.0.0-mvp';

function le16(buf, off) {
  if (off + 1 >= buf.length) return null;
  return buf[off] | (buf[off + 1] << 8);
}

/**
 * Decodifica um bloco RI da T3000 em um sample compatível com LiveDataBridge.
 *
 * @param {Uint8Array} buf  Bytes brutos retornados pelo endpoint IN após "RI".
 *                          Espera ≥ 92 bytes (mínimo pra cobrir tempo injeção).
 * @param {Object} [opts]
 * @param {number} [opts.tMono]  Timestamp monotônico (Performance.now()).
 *                               Se omitido, usa Date.now().
 * @returns {Object|null} sample no formato esperado por LiveDataBridge,
 *                        ou null se buffer é curto/invalido.
 */
export function parseT3000RIBlock(buf, opts = {}) {
  if (!(buf instanceof Uint8Array)) return null;
  if (buf.length < 92) return null;

  const tMono = typeof opts.tMono === 'number' ? opts.tMono : Date.now();

  const rpmRaw = le16(buf, 0);
  const batRaw = le16(buf, 2);

  // Tempo de injeção por cilindro (4 × uint16, bytes 84..91).
  // Em marcha lenta no Bubi, todos os 4 lemos 0x0850 = 2128 (unidade interna
  // Injepro, provavelmente microsegundos de pulso ÷ algum fator). Mantemos
  // raw + helper de balanceamento.
  const injRaw = [
    le16(buf, 84),
    le16(buf, 86),
    le16(buf, 88),
    le16(buf, 90),
  ];

  // Balanceamento entre cilindros — útil pra diagnóstico mecânico futuro.
  const injMin = Math.min(...injRaw);
  const injMax = Math.max(...injRaw);
  const injSpread = injMax - injMin;

  return {
    // Identificação
    source: 't3000-usb',
    parserVersion: PARSER_VERSION,
    tMono,
    checksumOk: true, // protocolo USB não tem checksum nesta posição;
                     // futura validação por estrutura/sanidade
    bytesLen: buf.length,

    // Sensores confirmados
    rpm: rpmRaw,
    batteryV: batRaw / 10, // décimos de volt → V

    // Diagnóstico de cilindros (4 cil)
    fuelInjectionRaw: injRaw,
    fuelInjectionBalanced: injSpread <= 200, // tolerância empírica
    fuelInjectionSpread: injSpread,

    // Campos esperados pelo LiveDataBridge — não confirmados ainda,
    // deixamos undefined pra ele NÃO disparar alertas falsos.
    waterTempC: undefined,
    oilTempC: undefined,
    oilPressBar: undefined,
    egtOutOfRange: undefined,
    ecuErrorBits: undefined, // próxima rodada
  };
}

/**
 * Saudação inicial: bytes ASCII "ACK" pra mandar pelo endpoint OUT.
 * Resposta esperada: bytes ASCII "OK".
 */
export const ACK_BYTES = new Uint8Array([0x41, 0x43, 0x4B]);
export const ACK_RESPONSE = new Uint8Array([0x4F, 0x4B]);

/**
 * Comando "Read Instruments" — pede o bloco de medidores.
 */
export const RI_BYTES = new Uint8Array([0x52, 0x49]);

/**
 * Confere se uma resposta começa com "OK" (handshake validado).
 */
export function isAckOk(buf) {
  if (!(buf instanceof Uint8Array) || buf.length < 2) return false;
  return buf[0] === 0x4F && buf[1] === 0x4B;
}
