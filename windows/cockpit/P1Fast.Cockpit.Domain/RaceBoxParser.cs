// RaceBoxParser — decodifica o stream BLE do RaceBox (GPS da pista) no notebook.
//
// Porte fiel do leitor já provado em campo em web/teste-aparelhos/index.html
// (onNotify/decode). Protocolo UBX-like: header B5 62, classe/id, comprimento LE,
// payload, checksum Fletcher de 2 bytes. A mensagem de dados é classe 0xFF id 0x01.
//
// Puro e sem IO (igual T3000RiBlockParser): a casca BLE (Windows.Devices.Bluetooth)
// só empurra bytes; esta classe faz o enquadramento + decodificação, coberta por teste.
//
// Spec dos offsets (dentro do payload, espelha decode() do JS):
//   p[20]      u8   fix
//   p[23]      u8   numSV
//   p[24..27]  i32  longitude  ÷ 1e7  (graus)
//   p[28..31]  i32  latitude   ÷ 1e7  (graus)
//   p[40..43]  u32  hAcc       ÷ 1000 (metros)
//   p[48..51]  i32  velocidade ÷ 1000 × 3.6 (km/h; bruto em mm/s)

using System.Collections.Generic;

namespace P1Fast.Cockpit.Domain;

/// <summary>Amostra de GPS do RaceBox (campos que o transmissor já usa).</summary>
public sealed record RaceBoxGpsSample(
    int Fix,
    int NumSV,
    double HAccM,
    double SpeedKmh,
    double Lat,
    double Lon)
{
    /// <summary>Tem posição utilizável (fix 2D/3D e ao menos alguns satélites).</summary>
    public bool TemSinal => Fix >= 2 && NumSV >= 4;
}

public static class RaceBoxParser
{
    // BLE Nordic UART Service (mesmos UUIDs do leitor web provado).
    public const string NusService = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
    public const string NusRxCharacteristic = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";
    public const string NamePrefix = "RaceBox";

    /// <summary>
    /// Processa todos os frames COMPLETOS no buffer. Devolve as amostras achadas e
    /// quantos bytes foram consumidos — o chamador guarda o resto (buffer rolante),
    /// igual ao onNotify() do JS. Frames com checksum ruim são descartados (mas
    /// consumidos); um frame incompleto no fim para o avanço (espera mais bytes).
    /// </summary>
    public static (List<RaceBoxGpsSample> amostras, int consumido) Parse(ReadOnlySpan<byte> buf)
    {
        var saida = new List<RaceBoxGpsSample>();
        int i = 0;
        while (i + 8 <= buf.Length)
        {
            if (buf[i] != 0xB5 || buf[i + 1] != 0x62) { i++; continue; }

            int len = buf[i + 4] | (buf[i + 5] << 8);
            int tot = 6 + len + 2;
            if (i + tot > buf.Length) break; // frame incompleto — espera próximo notify

            int a = 0, b = 0;
            for (int k = i + 2; k < i + 6 + len; k++) { a = (a + buf[k]) & 0xFF; b = (b + a) & 0xFF; }
            bool ok = a == buf[i + 6 + len] && b == buf[i + 7 + len];

            int cls = buf[i + 2], id = buf[i + 3];
            if (ok && cls == 0xFF && id == 0x01 && len >= 80)
                saida.Add(Decode(buf.Slice(i + 6, len)));

            i += tot;
        }
        return (saida, i);
    }

    private static RaceBoxGpsSample Decode(ReadOnlySpan<byte> p) => new(
        Fix: p[20],
        NumSV: p[23],
        HAccM: U32(p, 40) / 1000.0,
        SpeedKmh: I32(p, 48) / 1000.0 * 3.6,
        Lat: I32(p, 28) / 1e7,
        Lon: I32(p, 24) / 1e7);

    private static uint U32(ReadOnlySpan<byte> b, int o) =>
        (uint)(b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24));

    private static int I32(ReadOnlySpan<byte> b, int o) => unchecked((int)U32(b, o));
}
