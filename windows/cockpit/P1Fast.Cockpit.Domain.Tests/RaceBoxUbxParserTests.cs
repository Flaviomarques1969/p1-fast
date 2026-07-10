// RaceBoxUbxParser — a lógica pura extraída do RaceBoxBleReader (WinRT/UI, intestável).
// Prova o framing UBX com RESYNC (5.4), o decode com iTOW (5.3a) e o espaçamento de
// timestamps de uma rajada BLE (5.3a) — tudo fora do Bluetooth, com bytes sintéticos.

using System;
using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class RaceBoxUbxParserTests
{
    // Monta o payload de dados do RaceBox (>= 80 bytes) com os offsets provados em campo.
    private static byte[] Payload(long itow, int fix, int numSV, double lat, double lon, double kmh,
                                  double hdg = 90, double hacc = 1.2)
    {
        var p = new byte[80];
        void U32(int o, uint v) { p[o] = (byte)(v & 0xFF); p[o + 1] = (byte)((v >> 8) & 0xFF); p[o + 2] = (byte)((v >> 16) & 0xFF); p[o + 3] = (byte)((v >> 24) & 0xFF); }
        void I32(int o, int v) => U32(o, unchecked((uint)v));
        U32(0, unchecked((uint)itow));
        p[20] = (byte)fix; p[23] = (byte)numSV;
        I32(24, (int)Math.Round(lon * 1e7));
        I32(28, (int)Math.Round(lat * 1e7));
        U32(40, (uint)Math.Round(hacc * 1000));
        I32(48, (int)Math.Round(kmh / 3.6 * 1000));  // mm/s
        I32(52, (int)Math.Round(hdg * 1e5));
        return p;
    }

    // Envelopa um payload num frame UBX completo (0xB5 0x62 + classe/id + len + Fletcher).
    private static byte[] Frame(byte[] payload)
    {
        int len = payload.Length;
        var f = new byte[6 + len + 2];
        f[0] = 0xB5; f[1] = 0x62; f[2] = 0xFF; f[3] = 0x01;
        f[4] = (byte)(len & 0xFF); f[5] = (byte)((len >> 8) & 0xFF);
        Array.Copy(payload, 0, f, 6, len);
        int a = 0, b = 0;
        for (int k = 2; k < 6 + len; k++) { a = (a + f[k]) & 0xFF; b = (b + a) & 0xFF; }
        f[6 + len] = (byte)a; f[7 + len] = (byte)b;
        return f;
    }

    [Fact]
    public void Extract_FrameValido_DecodificaCamposEiTOW()
    {
        var frame = Frame(Payload(itow: 123456, fix: 3, numSV: 11, lat: -15.77, lon: -47.90, kmh: 108));
        var fixes = RaceBoxUbxParser.Extract(frame, out int consumido);

        Assert.Single(fixes);
        Assert.Equal(frame.Length, consumido);
        var f = fixes[0];
        Assert.Equal(3, f.Fix);
        Assert.Equal(11, f.NumSV);
        Assert.Equal(-15.77, f.Lat, 5);
        Assert.Equal(-47.90, f.Lng, 5);
        Assert.Equal(108, f.Kmh, 1);
        Assert.Equal(123456, f.ITowMs);
        Assert.Equal(90, f.HeadingDeg!.Value, 3);  // kmh>=5 → heading vale
    }

    [Fact]
    public void Extract_FramesEmSequencia_SaemNaOrdem()
    {
        var a = Frame(Payload(1000, 3, 10, -15.77, -47.90, 100));
        var b = Frame(Payload(1040, 3, 10, -15.771, -47.901, 102));
        var buf = new byte[a.Length + b.Length];
        Array.Copy(a, 0, buf, 0, a.Length);
        Array.Copy(b, 0, buf, a.Length, b.Length);

        var fixes = RaceBoxUbxParser.Extract(buf, out _);

        Assert.Equal(2, fixes.Count);
        Assert.Equal(1000, fixes[0].ITowMs);
        Assert.Equal(1040, fixes[1].ITowMs);
    }

    // 5.4: um cabeçalho falso com len GRANDE e checksum ruim NÃO pode fazer o parser pular
    // (i += tot) por cima do frame BOM seguinte. Com o resync (anda 1 byte em checksum ruim),
    // o frame bom é recuperado; sem ele, seria engolido (0 fixes).
    [Fact]
    public void Extract_ChecksumRuim_ResincronizaEAchaOProximoBom()
    {
        var bom = Frame(Payload(itow: 7777, fix: 3, numSV: 9, lat: -15.78, lon: -47.91, kmh: 96));

        // cabeçalho falso: B5 62 FF 01, len=100 (tot=108, pularia por cima do bom em 90),
        // checksum garantidamente errado (0xFF/0xFF sobre payload de zeros).
        var buf = new byte[90 + bom.Length];
        buf[0] = 0xB5; buf[1] = 0x62; buf[2] = 0xFF; buf[3] = 0x01; buf[4] = 100; buf[5] = 0;
        buf[106] = 0xFF; buf[107] = 0xFF; // dentro do "frame falso" (len 100), checksum inválido
        Array.Copy(bom, 0, buf, 90, bom.Length);

        var fixes = RaceBoxUbxParser.Extract(buf, out _);

        Assert.Single(fixes);
        Assert.Equal(7777, fixes[0].ITowMs);   // achou o bom apesar do lixo com len enganoso
        Assert.Equal(96, fixes[0].Kmh, 1);
    }

    [Fact]
    public void Extract_FrameIncompleto_GuardaCaudaSemConsumir()
    {
        var frame = Frame(Payload(2020, 3, 8, -15.77, -47.90, 80));
        var parcial = new byte[frame.Length - 5];   // faltam os últimos 5 bytes
        Array.Copy(frame, parcial, parcial.Length);

        var fixes = RaceBoxUbxParser.Extract(parcial, out int consumido);

        Assert.Empty(fixes);
        Assert.Equal(0, consumido);   // não consumiu nada: espera o resto no próximo notify
    }

    [Fact]
    public void EspacarTimestamps_Rajada_EspacaPeloITOW()
    {
        var itows = new long[] { 1000, 1040, 1080 };
        var t = RaceBoxUbxParser.EspacarTimestamps(itows, chegadaWallMs: 5000);

        Assert.Equal(3, t.Length);
        Assert.Equal(5000, t[2]);                 // último frame na chegada
        Assert.Equal(40, t[2] - t[1]);            // 40 ms de espaçamento (delta iTOW)
        Assert.Equal(40, t[1] - t[0]);
    }

    [Fact]
    public void EspacarTimestamps_ITOWInvalido_CaiNoNominal()
    {
        // iTOW decrescente (rollover/corrompido): delta <= 0 → usa o nominal de 40 ms.
        var itows = new long[] { 1000, 500 };
        var t = RaceBoxUbxParser.EspacarTimestamps(itows, chegadaWallMs: 8000, nominalMs: 40);

        Assert.Equal(8000, t[1]);
        Assert.Equal(40, t[1] - t[0]);
    }
}
