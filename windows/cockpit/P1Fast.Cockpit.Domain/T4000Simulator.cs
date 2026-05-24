// T4000Simulator — gera ciclos de 5 pacotes (40 bytes) idênticos ao que a
// central Injepro T4000 cospe no barramento CAN.
//
// Spec: docs/hardware/T4000_CAN_SPEC.md + fixture canônica do manual (0x91).
// Plano: PLANO_FASE_1.md §6 MS-9.0 (alternativa ao hardware real durante dev).
//
// O parser (T4000PacketParser) é a verdade — este simulador apenas inverte
// suas regras de encoding e SEMPRE produz um ciclo com checksum válido.
// A fixture do PDF (rpm=1000, marcha=4, λ=1.00, etc.) é o ponto de partida
// e é replicada byte-a-byte por ApplyScenario(Scenario.PdfFixture).
//
// Cenários cobertos:
//   - Idle             — motor parado em marcha lenta
//   - Cruise           — andando estável
//   - Accelerating     — subindo de marcha
//   - NearRedline      — antes da troca
//   - Redline          — limite, shift FIRE deve disparar
//   - Overrev          — passou do limite
//   - OverheatWater    — alerta de temperatura
//   - LowOilPressure   — alerta de pressão
//   - EcuError         — bit de erro da central
//   - PdfFixture       — exemplo exato do manual (checksum 0x91)
//
// Uso típico:
//   var sim = new T4000Simulator();
//   sim.ApplyScenario(T4000Scenario.Cruise);
//   var cycle = sim.EmitCycle();           // T4000CycleBytes pronto
//   // ou pacote a pacote:
//   var bytes = sim.EmitPackets();         // [P1, P2, P3, P4, P5]

namespace P1Fast.Cockpit.Domain;

/// <summary>Cenários pré-definidos pra simular regimes diferentes do motor.</summary>
public enum T4000Scenario
{
    Idle,
    Cruise,
    Accelerating,
    NearRedline,
    Redline,
    Overrev,
    OverheatWater,
    LowOilPressure,
    EcuError,
    PdfFixture,
}

public sealed class T4000Simulator
{
    /// <summary>Sample atual — o que o próximo EmitCycle vai codificar.</summary>
    public T4000Sample CurrentSample { get; private set; }

    public T4000Simulator() : this(SampleForScenario(T4000Scenario.Cruise)) { }

    public T4000Simulator(T4000Sample initial)
    {
        ArgumentNullException.ThrowIfNull(initial);
        CurrentSample = initial;
    }

    /// <summary>Substitui o sample atual sem aplicar cenário.</summary>
    public void SetSample(T4000Sample sample)
    {
        ArgumentNullException.ThrowIfNull(sample);
        CurrentSample = sample;
    }

    /// <summary>Aplica um cenário pré-definido — sobrescreve o sample atual.</summary>
    public void ApplyScenario(T4000Scenario scenario)
    {
        CurrentSample = SampleForScenario(scenario);
    }

    /// <summary>Gera um ciclo completo (5 pacotes × 8 bytes) com checksum válido.</summary>
    public T4000CycleBytes EmitCycle()
    {
        var p1 = EncodePacket1(CurrentSample);
        var p2 = EncodePacket2(CurrentSample);
        var p3 = EncodePacket3(CurrentSample);
        var p4 = EncodePacket4(CurrentSample);
        var p5Open = EncodePacket5Skeleton(); // checksum ainda zerado

        var draftCycle = new T4000CycleBytes(p1, p2, p3, p4, p5Open);
        var checksum = T4000PacketParser.ComputeChecksum(draftCycle);

        var p5Final = new byte[T4000PacketParser.BytesPerPacket];
        for (var i = 0; i < T4000PacketParser.BytesPerPacket; i++) p5Final[i] = p5Open[i];
        p5Final[T4000PacketParser.BytesPerPacket - 1] = (byte)(checksum & 0xFF);

        return new T4000CycleBytes(p1, p2, p3, p4, p5Final);
    }

    /// <summary>Gera lista de 5 pacotes prontos pra alimentar T4000Provider.FeedPacket() em sequência.</summary>
    public IReadOnlyList<byte[]> EmitPackets()
    {
        var c = EmitCycle();
        return new[]
        {
            ToArray(c.P1), ToArray(c.P2), ToArray(c.P3), ToArray(c.P4), ToArray(c.P5),
        };
    }

    /// <summary>Concatena um ciclo num único bloco de 40 bytes (formato do stream serial).</summary>
    public byte[] EmitBytes()
    {
        var c = EmitCycle();
        var total = T4000PacketParser.PacketsPerCycle * T4000PacketParser.BytesPerPacket;
        var output = new byte[total];
        var offset = 0;
        foreach (var pkt in new[] { c.P1, c.P2, c.P3, c.P4, c.P5 })
        {
            for (var i = 0; i < T4000PacketParser.BytesPerPacket; i++)
                output[offset + i] = pkt[i];
            offset += T4000PacketParser.BytesPerPacket;
        }
        return output;
    }

    // ── Encoding (inverso do parser) ──────────────────────────────

    private static byte[] EncodePacket1(T4000Sample s)
    {
        var bytes = new byte[T4000PacketParser.BytesPerPacket];
        WriteU16Be(bytes, 0, ClampU16(s.Rpm));
        WriteU16Be(bytes, 2, ClampU16ToTenths(s.SpeedKmh));
        WriteU16Be(bytes, 4, ClampU16ToTenths(s.OilPressBar));
        WriteU16Be(bytes, 6, ClampU16ToTenths(s.OilTempC));
        return bytes;
    }

    private static byte[] EncodePacket2(T4000Sample s)
    {
        var bytes = new byte[T4000PacketParser.BytesPerPacket];
        WriteU16Be(bytes, 0, ClampU16ToTenths(s.WaterTempC));
        WriteU16Be(bytes, 2, ClampU16ToTenths(s.FuelPressBar));
        WriteU16Be(bytes, 4, ClampU16ToTenths(s.BatteryV));
        WriteU16Be(bytes, 6, ClampU16ToTenths(s.TpsPct));
        return bytes;
    }

    private static byte[] EncodePacket3(T4000Sample s)
    {
        var bytes = new byte[T4000PacketParser.BytesPerPacket];
        WriteU16Be(bytes, 0, ClampU16ToHundredths(s.MapBar));
        WriteU16Be(bytes, 2, ClampU16ToTenths(s.AirTempC));
        WriteU16Be(bytes, 4, ClampU16(s.EgtC));
        WriteU16Be(bytes, 6, ClampU16ToHundredths(s.Lambda));
        return bytes;
    }

    private static byte[] EncodePacket4(T4000Sample s)
    {
        var bytes = new byte[T4000PacketParser.BytesPerPacket];
        WriteU16Be(bytes, 0, ClampU16ToTenths(s.FuelTempC));
        WriteU16Be(bytes, 2, ClampU16(s.Marcha));
        WriteU16Be(bytes, 4, ClampU16(s.EcuErrorBits));
        bytes[6] = T4000PacketParser.P4FixedTail[0];
        bytes[7] = T4000PacketParser.P4FixedTail[1];
        return bytes;
    }

    private static byte[] EncodePacket5Skeleton()
    {
        var bytes = new byte[T4000PacketParser.BytesPerPacket];
        bytes[0] = T4000PacketParser.P5FixedHead[0];
        bytes[1] = T4000PacketParser.P5FixedHead[1];
        // bytes 2..6 = zero-padding (hipótese do manual — única forma do checksum fechar)
        // byte 7 = checksum (preenchido por EmitCycle depois)
        return bytes;
    }

    // ── Helpers de encoding ───────────────────────────────────────

    private static void WriteU16Be(byte[] bytes, int offset, int value)
    {
        bytes[offset]     = (byte)((value >> 8) & 0xFF);
        bytes[offset + 1] = (byte)(value & 0xFF);
    }

    private static int ClampU16(int v) => v < 0 ? 0 : v > 0xFFFF ? 0xFFFF : v;

    private static int ClampU16ToTenths(double v)
    {
        if (double.IsNaN(v) || double.IsInfinity(v)) return 0;
        var scaled = (int)Math.Round(v * 10.0, MidpointRounding.AwayFromZero);
        return ClampU16(scaled);
    }

    private static int ClampU16ToHundredths(double v)
    {
        if (double.IsNaN(v) || double.IsInfinity(v)) return 0;
        var scaled = (int)Math.Round(v * 100.0, MidpointRounding.AwayFromZero);
        return ClampU16(scaled);
    }

    private static byte[] ToArray(IReadOnlyList<byte> src)
    {
        var dst = new byte[src.Count];
        for (var i = 0; i < src.Count; i++) dst[i] = src[i];
        return dst;
    }

    // ── Catálogo de cenários ──────────────────────────────────────

    private static T4000Sample SampleForScenario(T4000Scenario s) => s switch
    {
        T4000Scenario.Idle => new T4000Sample(
            Rpm: 850, SpeedKmh: 0, OilPressBar: 1.5, OilTempC: 75,
            WaterTempC: 85, FuelPressBar: 3.0, BatteryV: 13.8, TpsPct: 0.0,
            MapBar: 0.40, AirTempC: 35, EgtC: 350, EgtOutOfRange: false, Lambda: 0.95,
            FuelTempC: 30, Marcha: 0, EcuErrorBits: 0),

        T4000Scenario.Cruise => new T4000Sample(
            Rpm: 3500, SpeedKmh: 100, OilPressBar: 4.0, OilTempC: 90,
            WaterTempC: 90, FuelPressBar: 3.5, BatteryV: 14.0, TpsPct: 25.0,
            MapBar: 0.70, AirTempC: 38, EgtC: 600, EgtOutOfRange: false, Lambda: 0.98,
            FuelTempC: 40, Marcha: 4, EcuErrorBits: 0),

        T4000Scenario.Accelerating => new T4000Sample(
            Rpm: 5500, SpeedKmh: 140, OilPressBar: 4.5, OilTempC: 95,
            WaterTempC: 95, FuelPressBar: 3.8, BatteryV: 14.1, TpsPct: 75.0,
            MapBar: 1.20, AirTempC: 42, EgtC: 800, EgtOutOfRange: false, Lambda: 0.88,
            FuelTempC: 45, Marcha: 3, EcuErrorBits: 0),

        T4000Scenario.NearRedline => new T4000Sample(
            Rpm: 7100, SpeedKmh: 170, OilPressBar: 5.0, OilTempC: 100,
            WaterTempC: 98, FuelPressBar: 4.0, BatteryV: 14.0, TpsPct: 95.0,
            MapBar: 1.40, AirTempC: 45, EgtC: 850, EgtOutOfRange: false, Lambda: 0.85,
            FuelTempC: 48, Marcha: 4, EcuErrorBits: 0),

        T4000Scenario.Redline => new T4000Sample(
            Rpm: 7450, SpeedKmh: 180, OilPressBar: 5.2, OilTempC: 102,
            WaterTempC: 100, FuelPressBar: 4.1, BatteryV: 14.0, TpsPct: 100.0,
            MapBar: 1.45, AirTempC: 46, EgtC: 870, EgtOutOfRange: false, Lambda: 0.85,
            FuelTempC: 50, Marcha: 4, EcuErrorBits: 0),

        T4000Scenario.Overrev => new T4000Sample(
            Rpm: 7800, SpeedKmh: 185, OilPressBar: 5.0, OilTempC: 105,
            WaterTempC: 102, FuelPressBar: 4.0, BatteryV: 14.0, TpsPct: 100.0,
            MapBar: 1.45, AirTempC: 47, EgtC: 880, EgtOutOfRange: false, Lambda: 0.84,
            FuelTempC: 52, Marcha: 4, EcuErrorBits: 0),

        T4000Scenario.OverheatWater => new T4000Sample(
            Rpm: 4500, SpeedKmh: 130, OilPressBar: 4.0, OilTempC: 110,
            WaterTempC: 115, FuelPressBar: 3.5, BatteryV: 13.9, TpsPct: 60.0,
            MapBar: 1.00, AirTempC: 45, EgtC: 750, EgtOutOfRange: false, Lambda: 0.92,
            FuelTempC: 50, Marcha: 4, EcuErrorBits: 0),

        T4000Scenario.LowOilPressure => new T4000Sample(
            Rpm: 5000, SpeedKmh: 140, OilPressBar: 0.3, OilTempC: 110,
            WaterTempC: 100, FuelPressBar: 3.6, BatteryV: 14.0, TpsPct: 70.0,
            MapBar: 1.10, AirTempC: 42, EgtC: 780, EgtOutOfRange: false, Lambda: 0.88,
            FuelTempC: 48, Marcha: 3, EcuErrorBits: 0),

        T4000Scenario.EcuError => new T4000Sample(
            Rpm: 3500, SpeedKmh: 100, OilPressBar: 4.0, OilTempC: 90,
            WaterTempC: 92, FuelPressBar: 3.5, BatteryV: 14.0, TpsPct: 25.0,
            MapBar: 0.70, AirTempC: 38, EgtC: 600, EgtOutOfRange: false, Lambda: 0.98,
            FuelTempC: 40, Marcha: 4, EcuErrorBits: 0x0042),

        // Fixture canônica do manual (T4000PacketParser.PdfExpected).
        T4000Scenario.PdfFixture => T4000PacketParser.PdfExpected(),

        _ => throw new ArgumentOutOfRangeException(nameof(s), s, $"cenário {s} não conhecido"),
    };
}
