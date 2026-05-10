// T4000PacketParser — decodifica frames CAN da Injepro T4000.
//
// Equivalente JS: src/telemetry/t4000-packet-parser.js
// Spec: docs/hardware/T4000_CAN_SPEC.md
// Fixture canônica do PDF (checksum 0x91) reproduzida nos testes.
//
// Frame: 5 pacotes de 8 bytes cada, mesmo CAN ID 0x7FB, big-endian
// unsigned 16-bit por par de bytes, intervalo 10ms entre pacotes.
// Cycle total = 50ms (~20Hz).

namespace P1Fast.Cockpit.Domain;

public static class T4000PacketParser
{
    public const int CanId             = 0x7FB;
    public const int PacketsPerCycle   = 5;
    public const int BytesPerPacket    = 8;
    public const int PacketIntervalMs  = 10;

    /// <summary>Heurística de range — refinar com captura real (MS-9.1).</summary>
    public const int EgtMaxC = 1500;

    /// <summary>Sentinela FIXED bytes 6-7 do pacote 4.</summary>
    public static readonly IReadOnlyList<byte> P4FixedTail = new byte[] { 0x1E, 0xFC };

    /// <summary>Sentinela FIXED bytes 0-1 do pacote 5.</summary>
    public static readonly IReadOnlyList<byte> P5FixedHead = new byte[] { 0xFB, 0xFA };

    // ── Helpers internos ───────────────────────────────────────────

    private static int U16Be(byte b0, byte b1) => ((b0 & 0xFF) << 8) | (b1 & 0xFF);

    private static bool RangeEq(IReadOnlyList<byte> bytes, int start, IReadOnlyList<byte> expected)
    {
        if (start + expected.Count > bytes.Count) return false;
        for (var i = 0; i < expected.Count; i++)
            if (bytes[start + i] != expected[i]) return false;
        return true;
    }

    private static void Ensure8Bytes(string name, IReadOnlyList<byte>? bytes)
    {
        if (bytes is null || bytes.Count != BytesPerPacket)
            throw new ArgumentException(
                $"T4000 {name}: esperado {BytesPerPacket} bytes, recebeu {bytes?.Count.ToString() ?? "null"}",
                nameof(bytes));
    }

    // ── Parse pacote a pacote ──────────────────────────────────────

    public static T4000Packet1 ParsePacket1(IReadOnlyList<byte> bytes)
    {
        Ensure8Bytes("pacote 1", bytes);
        return new T4000Packet1(
            Rpm:         U16Be(bytes[0], bytes[1]),
            SpeedKmh:    U16Be(bytes[2], bytes[3]) / 10.0,
            OilPressBar: U16Be(bytes[4], bytes[5]) / 10.0,
            OilTempC:    U16Be(bytes[6], bytes[7]) / 10.0
        );
    }

    public static T4000Packet2 ParsePacket2(IReadOnlyList<byte> bytes)
    {
        Ensure8Bytes("pacote 2", bytes);
        return new T4000Packet2(
            WaterTempC:   U16Be(bytes[0], bytes[1]) / 10.0,
            FuelPressBar: U16Be(bytes[2], bytes[3]) / 10.0,
            BatteryV:     U16Be(bytes[4], bytes[5]) / 10.0,
            TpsPct:       U16Be(bytes[6], bytes[7]) / 10.0
        );
    }

    public static T4000Packet3 ParsePacket3(IReadOnlyList<byte> bytes)
    {
        Ensure8Bytes("pacote 3", bytes);
        var egtRaw = U16Be(bytes[4], bytes[5]);
        return new T4000Packet3(
            MapBar:        U16Be(bytes[0], bytes[1]) / 100.0,
            AirTempC:      U16Be(bytes[2], bytes[3]) / 10.0,
            EgtC:          egtRaw,
            EgtOutOfRange: egtRaw > EgtMaxC,
            Lambda:        U16Be(bytes[6], bytes[7]) / 100.0
        );
    }

    public static T4000Packet4 ParsePacket4(IReadOnlyList<byte> bytes)
    {
        Ensure8Bytes("pacote 4", bytes);
        if (!RangeEq(bytes, 6, P4FixedTail))
            throw new InvalidDataException(
                $"T4000 pacote 4: cauda fixa esperada 0x1E 0xFC, recebeu 0x{bytes[6]:X2} 0x{bytes[7]:X2}");
        return new T4000Packet4(
            FuelTempC:    U16Be(bytes[0], bytes[1]) / 10.0,
            Marcha:       U16Be(bytes[2], bytes[3]),
            EcuErrorBits: U16Be(bytes[4], bytes[5])
        );
    }

    public static T4000Packet5 ParsePacket5(IReadOnlyList<byte> bytes)
    {
        Ensure8Bytes("pacote 5", bytes);
        if (!RangeEq(bytes, 0, P5FixedHead))
            throw new InvalidDataException(
                $"T4000 pacote 5: cabeça fixa esperada 0xFB 0xFA, recebeu 0x{bytes[0]:X2} 0x{bytes[1]:X2}");
        var reserved = new byte[5];
        for (var i = 0; i < 5; i++) reserved[i] = bytes[2 + i];
        return new T4000Packet5(
            ReservedBytes: reserved,
            Checksum:      bytes[7] & 0xFF
        );
    }

    // ── Identificação heurística (sem contexto temporal) ──────────

    /// <summary>Identifica pacote 4 (cauda fixa) ou 5 (cabeça fixa). Retorna null pra 1/2/3 (ambíguos).</summary>
    public static int? IdentifyPacketType(IReadOnlyList<byte> bytes)
    {
        Ensure8Bytes("identify", bytes);
        if (RangeEq(bytes, 6, P4FixedTail)) return 4;
        if (RangeEq(bytes, 0, P5FixedHead)) return 5;
        return null;
    }

    // ── Checksum ───────────────────────────────────────────────────

    public static int ComputeChecksum(T4000CycleBytes cycle)
    {
        ArgumentNullException.ThrowIfNull(cycle);
        var sum = 0;
        foreach (var pkt in new[] { cycle.P1, cycle.P2, cycle.P3, cycle.P4 })
        {
            for (var i = 0; i < BytesPerPacket; i++) sum += pkt[i] & 0xFF;
        }
        // Pacote 5: bytes 0..6 (cabeça fixa + 5 reservados); byte 7 é o próprio checksum.
        for (var i = 0; i < BytesPerPacket - 1; i++) sum += cycle.P5[i] & 0xFF;
        return sum % 256;
    }

    public static T4000ChecksumResult ValidateChecksum(T4000CycleBytes cycle)
    {
        ArgumentNullException.ThrowIfNull(cycle);
        var expected = ComputeChecksum(cycle);
        var got = cycle.P5[BytesPerPacket - 1] & 0xFF;
        return new T4000ChecksumResult(expected == got, expected, got);
    }

    // ── Parse de ciclo completo ────────────────────────────────────

    public static T4000CycleResult ParseCycle(T4000CycleBytes cycle)
    {
        ArgumentNullException.ThrowIfNull(cycle);
        Ensure8Bytes("p1", cycle.P1);
        Ensure8Bytes("p2", cycle.P2);
        Ensure8Bytes("p3", cycle.P3);
        Ensure8Bytes("p4", cycle.P4);
        Ensure8Bytes("p5", cycle.P5);

        var f1 = ParsePacket1(cycle.P1);
        var f2 = ParsePacket2(cycle.P2);
        var f3 = ParsePacket3(cycle.P3);
        var f4 = ParsePacket4(cycle.P4);
        var f5 = ParsePacket5(cycle.P5);
        var cs = ValidateChecksum(cycle);

        var sample = new T4000Sample(
            Rpm:           f1.Rpm,
            SpeedKmh:      f1.SpeedKmh,
            OilPressBar:   f1.OilPressBar,
            OilTempC:      f1.OilTempC,
            WaterTempC:    f2.WaterTempC,
            FuelPressBar:  f2.FuelPressBar,
            BatteryV:      f2.BatteryV,
            TpsPct:        f2.TpsPct,
            MapBar:        f3.MapBar,
            AirTempC:      f3.AirTempC,
            EgtC:          f3.EgtC,
            EgtOutOfRange: f3.EgtOutOfRange,
            Lambda:        f3.Lambda,
            FuelTempC:     f4.FuelTempC,
            Marcha:        f4.Marcha,
            EcuErrorBits:  f4.EcuErrorBits
        );

        return new T4000CycleResult(cs.Ok, cs, sample, f5.ReservedBytes);
    }

    // ── Fixture canônica do PDF (ground truth) ────────────────────
    //
    // Exemplo do documento oficial Injepro 2026-04-24. Soma total: 1937.
    // 1937 mod 256 = 145 = 0x91 (checksum). Validado matematicamente.
    // Os 5 bytes reservados do pacote 5 são zero-padding (única forma do checksum fechar).

    public static T4000CycleBytes PdfFixture() => new(
        P1: new byte[] { 0x03, 0xE8, 0x0A, 0xF0, 0x00, 0x28, 0x03, 0x20 },
        P2: new byte[] { 0x03, 0x20, 0x00, 0x28, 0x00, 0x78, 0x02, 0x58 },
        P3: new byte[] { 0x00, 0x64, 0x03, 0x20, 0x03, 0x20, 0x00, 0x64 },
        P4: new byte[] { 0x03, 0x20, 0x00, 0x04, 0x00, 0x00, 0x1E, 0xFC },
        P5: new byte[] { 0xFB, 0xFA, 0x00, 0x00, 0x00, 0x00, 0x00, 0x91 }
    );

    public static T4000Sample PdfExpected() => new(
        Rpm:           1000,
        SpeedKmh:      280,
        OilPressBar:   4.0,
        OilTempC:      80,
        WaterTempC:    80,
        FuelPressBar:  4.0,
        BatteryV:      12.0,
        TpsPct:        60.0,
        MapBar:        1.00,
        AirTempC:      80,
        EgtC:          800,
        EgtOutOfRange: false,
        Lambda:        1.00,
        FuelTempC:     80,
        Marcha:        4,
        EcuErrorBits:  0
    );
}
