// RaceBoxUbxParser — a LÓGICA PURA (testável) da leitura do RaceBox Mini que antes
// vivia inteira dentro do RaceBoxBleReader (WinRT/UI, fora do alcance dos testes):
//   - varredura/desmontagem dos frames UBX (0xB5 0x62 + checksum Fletcher) com RESYNC;
//   - decodificação do pacote de dados (classe 0xFF / id 0x01), INCLUINDO o iTOW;
//   - espaçamento dos timestamps de frames que chegam juntos num mesmo notify BLE.
//
// Extraído SEM mudar os offsets provados em campo (fix@20, numSV@23, lon@24, lat@28,
// hacc@40, speed@48, heading@52, accel@68/70/72). A novidade é só decodificar o iTOW
// (offset 0 do payload, u32 ms — tempo GPS da semana) e usá-lo pra ESPAÇAR os frames de
// uma mesma rajada BLE, que antes ganhavam todos o mesmo carimbo de chegada (dt~0 →
// km/h absurdo no cérebro). O RaceBoxBleReader passa a delegar aqui.

using System;
using System.Collections.Generic;

namespace P1Fast.Cockpit.Domain;

/// <summary>Um fix decodificado do RaceBox (espelho de RaceBoxFix da UI + o iTOW cru).</summary>
public readonly record struct RaceBoxDecoded(
    double Lat, double Lng, double Kmh, int Fix, int NumSV, double HaccM,
    double? HeadingDeg, double GX, double GY, double GZ, long ITowMs);

public static class RaceBoxUbxParser
{
    // Velocidade mínima (km/h) pro heading do pacote valer: abaixo disto o RaceBox
    // congela/inventa o rumo (comportamento u-blox) — vira null (o cérebro cai no rumo
    // por 2 posições, como sempre).
    public const double HeadingMinKmh = 5.0;

    // Teto do campo len do UBX: acima disto o cabeçalho está corrompido (não é frame
    // real do RaceBox). Evita confiar num len lixo pra pular bytes ou reter o buffer.
    public const int MaxPayloadLen = 512;

    /// <summary>Extrai TODOS os frames de dados completos do buffer acumulado e devolve
    /// quantos bytes foram consumidos (o chamador guarda o resto como cauda). RESYNC (5.4):
    /// em checksum inválido anda 1 byte e re-escaneia (não confia no len possivelmente
    /// corrompido); len absurdo → anda 1 byte. Assim um frame corrompido não desloca nem
    /// engole os frames bons seguintes.</summary>
    public static List<RaceBoxDecoded> Extract(byte[] buf, out int consumed)
    {
        var fixes = new List<RaceBoxDecoded>();
        int i = 0;
        while (i + 8 <= buf.Length)
        {
            if (buf[i] != 0xB5 || buf[i + 1] != 0x62) { i++; continue; }
            int len = buf[i + 4] | (buf[i + 5] << 8);
            if (len < 0 || len > MaxPayloadLen) { i++; continue; }  // len lixo: resync 1 byte
            int tot = 6 + len + 2;
            if (i + tot > buf.Length) break;                        // frame incompleto: espera mais bytes

            int a = 0, b = 0;
            for (int k = i + 2; k < i + 6 + len; k++) { a = (a + buf[k]) & 0xFF; b = (b + a) & 0xFF; }
            bool ok = a == buf[i + 6 + len] && b == buf[i + 7 + len];
            if (ok)
            {
                if (buf[i + 2] == 0xFF && buf[i + 3] == 0x01 && len >= 80)
                    fixes.Add(Decode(buf, i + 6));
                i += tot;   // frame válido: pula o frame inteiro
            }
            else
            {
                i++;        // checksum ruim: NÃO confia no len — anda 1 byte e re-escaneia (resync)
            }
        }
        consumed = i;
        return fixes;
    }

    /// <summary>Decodifica o payload de dados do RaceBox (offsets provados no web; iTOW no
    /// offset 0). o = início do payload.</summary>
    public static RaceBoxDecoded Decode(byte[] b, int o)
    {
        long itow   = BitConverter.ToUInt32(b, o + 0);      // tempo GPS da semana (ms)
        int fix     = b[o + 20];
        int numSV   = b[o + 23];
        double hacc = BitConverter.ToUInt32(b, o + 40) / 1000.0;
        double kmh  = BitConverter.ToInt32(b, o + 48) / 1000.0 * 3.6;
        double lat  = BitConverter.ToInt32(b, o + 28) / 1e7;
        double lon  = BitConverter.ToInt32(b, o + 24) / 1e7;
        double hdg  = BitConverter.ToInt32(b, o + 52) / 1e5;
        double? heading = kmh >= HeadingMinKmh && hdg >= 0 && hdg < 360 ? hdg : null;
        double gx = BitConverter.ToInt16(b, o + 68) / 1000.0;
        double gy = BitConverter.ToInt16(b, o + 70) / 1000.0;
        double gz = BitConverter.ToInt16(b, o + 72) / 1000.0;
        return new RaceBoxDecoded(lat, lon, kmh, fix, numSV, hacc, heading, gx, gy, gz, itow);
    }

    /// <summary>Espaça os timestamps de parede dos frames de UMA MESMA rajada BLE (5.3a).
    /// Um notify pode trazer vários frames de 40 ms; carimbados todos na CHEGADA, o dt entre
    /// eles vira ~0 e o cérebro calcula km/h absurdo. Aqui o iTOW (tempo GPS por frame) dá o
    /// espaçamento REAL: o último frame fica na chegada e os anteriores recuam pelo delta de
    /// iTOW. Delta inválido (iTOW ausente/rollover/corrompido) → cai no nominal de 40 ms.</summary>
    public static long[] EspacarTimestamps(
        IReadOnlyList<long> itow, long chegadaWallMs, long nominalMs = 40, long maxDeltaMs = 1000)
    {
        int n = itow?.Count ?? 0;
        var outp = new long[n];
        if (n == 0) return outp;
        outp[n - 1] = chegadaWallMs;
        for (int i = n - 2; i >= 0; i--)
        {
            long d = itow![i + 1] - itow[i];
            if (d <= 0 || d > maxDeltaMs) d = nominalMs;  // iTOW não confiável → nominal 40 ms
            outp[i] = outp[i + 1] - d;
        }
        return outp;
    }
}
