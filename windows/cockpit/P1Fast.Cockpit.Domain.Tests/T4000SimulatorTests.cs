// Cobertura T4000Simulator: ida-e-volta de cada cenário, paridade com fixture
// PDF, validação de checksum em todos os scenarios, integração com Provider.

using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class T4000SimulatorTests
{
    [Fact]
    public void SIM_01_PdfFixture_reproduz_bytes_exatos_do_manual()
    {
        var sim = new T4000Simulator();
        sim.ApplyScenario(T4000Scenario.PdfFixture);

        var got = sim.EmitCycle();
        var expected = T4000PacketParser.PdfFixture();

        AssertBytesEqual(expected.P1, got.P1, "P1");
        AssertBytesEqual(expected.P2, got.P2, "P2");
        AssertBytesEqual(expected.P3, got.P3, "P3");
        AssertBytesEqual(expected.P4, got.P4, "P4");
        AssertBytesEqual(expected.P5, got.P5, "P5");
    }

    [Theory]
    [InlineData(T4000Scenario.Idle)]
    [InlineData(T4000Scenario.Cruise)]
    [InlineData(T4000Scenario.Accelerating)]
    [InlineData(T4000Scenario.NearRedline)]
    [InlineData(T4000Scenario.Redline)]
    [InlineData(T4000Scenario.Overrev)]
    [InlineData(T4000Scenario.OverheatWater)]
    [InlineData(T4000Scenario.LowOilPressure)]
    [InlineData(T4000Scenario.EcuError)]
    [InlineData(T4000Scenario.PdfFixture)]
    public void SIM_02_todos_cenarios_geram_checksum_valido(T4000Scenario scenario)
    {
        var sim = new T4000Simulator();
        sim.ApplyScenario(scenario);
        var cycle = sim.EmitCycle();
        var result = T4000PacketParser.ParseCycle(cycle);

        Assert.True(result.Ok, $"checksum inválido pro cenário {scenario}");
        Assert.True(result.Checksum.Ok);
    }

    [Theory]
    [InlineData(T4000Scenario.Idle)]
    [InlineData(T4000Scenario.Cruise)]
    [InlineData(T4000Scenario.Redline)]
    [InlineData(T4000Scenario.OverheatWater)]
    [InlineData(T4000Scenario.LowOilPressure)]
    [InlineData(T4000Scenario.EcuError)]
    public void SIM_03_ida_e_volta_preserva_grandezas_principais(T4000Scenario scenario)
    {
        var sim = new T4000Simulator();
        sim.ApplyScenario(scenario);

        var original = sim.CurrentSample;
        var roundTrip = T4000PacketParser.ParseCycle(sim.EmitCycle()).Sample;

        Assert.Equal(original.Rpm,           roundTrip.Rpm);
        Assert.Equal(original.SpeedKmh,      roundTrip.SpeedKmh, 1);
        Assert.Equal(original.OilPressBar,   roundTrip.OilPressBar, 1);
        Assert.Equal(original.OilTempC,      roundTrip.OilTempC, 1);
        Assert.Equal(original.WaterTempC,    roundTrip.WaterTempC, 1);
        Assert.Equal(original.MapBar,        roundTrip.MapBar, 2);
        Assert.Equal(original.Lambda,        roundTrip.Lambda, 2);
        Assert.Equal(original.Marcha,        roundTrip.Marcha);
        Assert.Equal(original.EcuErrorBits,  roundTrip.EcuErrorBits);
    }

    [Fact]
    public void SIM_04_EmitPackets_devolve_5_pacotes_de_8_bytes()
    {
        var sim = new T4000Simulator();
        sim.ApplyScenario(T4000Scenario.Cruise);

        var pkts = sim.EmitPackets();

        Assert.Equal(5, pkts.Count);
        foreach (var pkt in pkts) Assert.Equal(8, pkt.Length);
    }

    [Fact]
    public void SIM_05_EmitBytes_devolve_40_bytes_concatenados_e_o_provider_processa()
    {
        var sim = new T4000Simulator();
        sim.ApplyScenario(T4000Scenario.Accelerating);

        var bytes = sim.EmitBytes();
        Assert.Equal(40, bytes.Length);

        // Alimenta o provider e confirma que o ciclo foi reconhecido.
        T4000ProviderSample? captured = null;
        var p = new T4000Provider(onT4000Sample: s => captured = s, now: () => 7000.0);

        // Reusa o feeder do provider via FeedPacket em fatias de 8 bytes.
        for (var i = 0; i < bytes.Length; i += 8)
        {
            var pkt = new byte[8];
            Array.Copy(bytes, i, pkt, 0, 8);
            p.FeedPacket(pkt);
        }

        Assert.NotNull(captured);
        Assert.True(captured!.ChecksumOk);
        Assert.Equal(5500, captured.Telemetry.Rpm); // cenário Accelerating
        Assert.Equal(7000.0, captured.TMono);
    }

    [Fact]
    public void SIM_06_SetSample_personalizado_tambem_fecha_checksum()
    {
        var custom = new T4000Sample(
            Rpm: 4200, SpeedKmh: 120.5, OilPressBar: 4.3, OilTempC: 92.7,
            WaterTempC: 91.2, FuelPressBar: 3.7, BatteryV: 14.05, TpsPct: 50.5,
            MapBar: 0.95, AirTempC: 41.3, EgtC: 720, EgtOutOfRange: false, Lambda: 0.93,
            FuelTempC: 44.1, Marcha: 4, EcuErrorBits: 0);

        var sim = new T4000Simulator(custom);
        var cycle = sim.EmitCycle();
        var parsed = T4000PacketParser.ParseCycle(cycle);

        Assert.True(parsed.Ok);
        Assert.Equal(4200, parsed.Sample.Rpm);
        Assert.Equal(4,    parsed.Sample.Marcha);
    }

    [Fact]
    public void SIM_07_pacote5_zero_padding_e_cabeca_fixa()
    {
        var sim = new T4000Simulator();
        sim.ApplyScenario(T4000Scenario.Cruise);
        var c = sim.EmitCycle();

        Assert.Equal(0xFB, c.P5[0]);
        Assert.Equal(0xFA, c.P5[1]);
        for (var i = 2; i < 7; i++) Assert.Equal(0, c.P5[i]);
        // c.P5[7] = checksum (variável)
    }

    [Fact]
    public void SIM_08_pacote4_cauda_fixa()
    {
        var sim = new T4000Simulator();
        sim.ApplyScenario(T4000Scenario.Cruise);
        var c = sim.EmitCycle();

        Assert.Equal(0x1E, c.P4[6]);
        Assert.Equal(0xFC, c.P4[7]);
    }

    private static void AssertBytesEqual(IReadOnlyList<byte> expected, IReadOnlyList<byte> got, string label)
    {
        Assert.Equal(expected.Count, got.Count);
        for (var i = 0; i < expected.Count; i++)
        {
            Assert.True(
                expected[i] == got[i],
                $"{label} byte[{i}]: esperado 0x{expected[i]:X2}, recebeu 0x{got[i]:X2}");
        }
    }
}
