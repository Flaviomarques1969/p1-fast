// RaceBoxFrameBuilder — inverso do RaceBoxParser: monta um frame UBX (classe
// 0xFF id 0x01) com checksum válido. Fixture de teste e base pra um simulador
// de GPS, espelhando o formato real do RaceBox.

namespace P1Fast.Cockpit.Domain;

public static class RaceBoxFrameBuilder
{
    /// <summary>Monta um frame de dados do RaceBox com os campos dados (payload de 80 bytes).</summary>
    public static byte[] Build(
        int fix = 3,
        int numSV = 8,
        double hAccM = 2.0,
        double speedKmh = 50,
        double lat = -15.7901,
        double lon = -47.8825,
        int payloadLen = 80)
    {
        if (payloadLen < 52) payloadLen = 52; // precisa cobrir o offset 48..51
        var p = new byte[payloadLen];
        p[20] = (byte)fix;
        p[23] = (byte)numSV;
        I32(p, 24, (int)Math.Round(lon * 1e7));
        I32(p, 28, (int)Math.Round(lat * 1e7));
        U32(p, 40, (uint)Math.Round(hAccM * 1000));
        I32(p, 48, (int)Math.Round(speedKmh / 3.6 * 1000)); // km/h → mm/s

        int len = payloadLen;
        int tot = 6 + len + 2;
        var f = new byte[tot];
        f[0] = 0xB5; f[1] = 0x62; f[2] = 0xFF; f[3] = 0x01;
        f[4] = (byte)(len & 0xFF); f[5] = (byte)((len >> 8) & 0xFF);
        Array.Copy(p, 0, f, 6, len);

        int a = 0, b = 0;
        for (int k = 2; k < 6 + len; k++) { a = (a + f[k]) & 0xFF; b = (b + a) & 0xFF; }
        f[6 + len] = (byte)a;
        f[7 + len] = (byte)b;
        return f;
    }

    private static void U32(byte[] b, int o, uint v)
    {
        b[o] = (byte)(v & 0xFF);
        b[o + 1] = (byte)((v >> 8) & 0xFF);
        b[o + 2] = (byte)((v >> 16) & 0xFF);
        b[o + 3] = (byte)((v >> 24) & 0xFF);
    }

    private static void I32(byte[] b, int o, int v) => U32(b, o, unchecked((uint)v));
}
