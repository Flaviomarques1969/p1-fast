// T3000RiBlockBuilder — inverso do T3000RiBlockParser: monta um bloco RI
// (little-endian) byte-a-byte a partir de valores de engenharia. Serve como
// FIXTURE de teste (round-trip build→parse) e como base do simulador de volta.
//
// O parser é a verdade; este builder apenas inverte os mesmos offsets. Se um
// offset mudar no parser, o teste de round-trip quebra — exatamente o que se quer.
//
// Spec dos offsets: T3000RiBlockParser.Parse (mesmo arquivo do parser).

namespace P1Fast.Cockpit.Domain;

public static class T3000RiBlockBuilder
{
    /// <summary>
    /// Monta um bloco RI com os campos dados. Comprimento padrão 320 bytes
    /// (cobre alarmes@288 e cronômetros@292/296, como a central manda de verdade).
    /// </summary>
    public static byte[] Build(
        int rpm            = 3000,
        double batteryV    = 13.8,
        double mapBar      = 0.5,
        double tpsPct      = 20,
        double tpsTargetPct = 20,
        double pedalAceleradorPct = 20,
        double pedalFreioPct      = 0,
        int? airTempC      = 35,
        int? waterTempC    = 90,
        double lambda      = 0.95,
        int lambdaNbRaw    = 500,
        int mapaAtual      = 1,
        double speedKmh    = 80,
        double? pressaoFreioBar = 0,
        double? accelXg    = 0,
        double? accelYg    = 0,
        double? accelZg    = 0,
        double? cronoParcialS = null,
        double? cronoTotalS   = null,
        T3000Alarmes? alarmes = null,
        int len            = 320)
    {
        if (len < 110) len = 110;
        var b = new byte[len];

        U16(b, 0, rpm);
        U16(b, 2, R(batteryV * 10));
        I16(b, 4, R(mapBar * 100));
        U16(b, 46, R(tpsPct * 10));
        U16(b, 50, R(tpsTargetPct * 10));
        U16(b, 52, R(pedalAceleradorPct * 10));
        U16(b, 54, R(pedalFreioPct * 10));
        I16(b, 56, EncTemp(airTempC));
        I16(b, 58, EncTemp(waterTempC));
        U16(b, 60, lambdaNbRaw);
        U16(b, 62, R(lambda * 1000));
        if (len > 102) U16(b, 102, R(speedKmh * 10));
        if (len > 108) b[108] = (byte)Math.Clamp(mapaAtual - 1, 0, 255);

        if (len >= 270 && pressaoFreioBar.HasValue) I16(b, 268, R(pressaoFreioBar.Value * 100));
        if (len >= 276)
        {
            if (accelXg.HasValue) I16(b, 270, R(accelXg.Value * 1000));
            if (accelYg.HasValue) I16(b, 272, R(accelYg.Value * 1000));
            if (accelZg.HasValue) I16(b, 274, R(accelZg.Value * 1000));
        }
        if (len >= 292) U32(b, 288, EncodeAlarmes(alarmes));
        if (len >= 296 && cronoParcialS.HasValue) U32(b, 292, (uint)R(cronoParcialS.Value * 1000));
        if (len >= 300 && cronoTotalS.HasValue)   U32(b, 296, (uint)R(cronoTotalS.Value * 1000));

        return b;
    }

    /// <summary>Inverte o bitfield de alarmes lido por Parse (Bit32 0..10).</summary>
    public static uint EncodeAlarmes(T3000Alarmes? a)
    {
        if (a is null) return 0u;
        uint v = 0;
        void Set(bool on, int bit) { if (on) v |= 1u << bit; }
        Set(a.ExcessoRotacao, 0);
        Set(a.ExcessoPressao, 1);
        Set(a.ExcessoTempMotor, 2);
        Set(a.ExcessoAberturaInjetor, 3);
        Set(a.BaixaPressaoOleo, 4);
        Set(a.WbMinimo, 5);
        Set(a.WbMaximo, 6);
        Set(a.NbMinimo, 7);
        Set(a.NbMaximo, 8);
        Set(a.BaixaPressaoCombustivel, 9);
        Set(a.AlertaNivelCombustivel, 10);
        return v;
    }

    private static int R(double v) => (int)Math.Round(v, MidpointRounding.AwayFromZero);

    // Temperatura: valor especial -2 quando não há sonda (parser devolve null).
    private static int EncTemp(int? c) => c ?? -2;

    private static void U16(byte[] b, int o, int v)
    {
        b[o] = (byte)(v & 0xFF);
        b[o + 1] = (byte)((v >> 8) & 0xFF);
    }

    private static void I16(byte[] b, int o, int v) => U16(b, o, v & 0xFFFF);

    private static void U32(byte[] b, int o, uint v)
    {
        b[o] = (byte)(v & 0xFF);
        b[o + 1] = (byte)((v >> 8) & 0xFF);
        b[o + 2] = (byte)((v >> 16) & 0xFF);
        b[o + 3] = (byte)((v >> 24) & 0xFF);
    }
}
