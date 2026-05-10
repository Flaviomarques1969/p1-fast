// 4 facts xUnit equivalentes 1:1 aos smokes T4K-24..T4K-27 do
// tests/node-smoke-t4000.mjs (T4000Provider).

using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class T4000ProviderTests
{
    private static void FeedFullCycle(T4000Provider p)
    {
        var fx = T4000PacketParser.PdfFixture();
        p.FeedPacket(fx.P1);
        p.FeedPacket(fx.P2);
        p.FeedPacket(fx.P3);
        p.FeedPacket(fx.P4);
        p.FeedPacket(fx.P5);
    }

    [Fact]
    public void T4K_24_Provider_emite_sample_do_ciclo_PDF_com_checksumOk_true_e_tMono()
    {
        T4000ProviderSample? captured = null;
        var p = new T4000Provider(
            onT4000Sample: s => captured = s,
            now: () => 12345.0);

        FeedFullCycle(p);

        Assert.NotNull(captured);
        Assert.True(captured!.ChecksumOk);
        Assert.Equal(12345.0, captured.TMono);
        Assert.Equal(1000, captured.Telemetry.Rpm);
        Assert.Equal(4,    captured.Telemetry.Marcha);
        Assert.Equal(1.00, captured.Telemetry.Lambda, 1e-6);
    }

    [Fact]
    public void T4K_25_Provider_stats_cyclesOk_1_apos_ciclo_valido()
    {
        var p = new T4000Provider(onT4000Sample: _ => { });
        FeedFullCycle(p);

        var s = p.GetStats();
        Assert.Equal(1, s.CyclesOk);
        Assert.Equal(0, s.CyclesBad);
        Assert.Equal(0, s.ConsecutiveBadCycles);
        Assert.Equal(T4000Signal.Good, s.SignalQuality);
    }

    [Fact]
    public void T4K_26_Provider_sinaliza_DEGRADED_apos_2_bad_cycles_consecutivos()
    {
        var p = new T4000Provider(onT4000Sample: _ => { });
        var fx = T4000PacketParser.PdfFixture();

        // 2 ressincronizacoes seguidas (p4 antes da hora) → 2 onError
        p.FeedPacket(fx.P1);
        p.FeedPacket(fx.P4); // resync
        p.FeedPacket(fx.P1);
        p.FeedPacket(fx.P4); // resync

        var s = p.GetStats();
        Assert.Equal(T4000Signal.Degraded, s.SignalQuality);
    }

    [Fact]
    public void T4K_27_constantes_expostas_CAN_ID_e_Hz_alvo()
    {
        Assert.Equal(0x7FB, T4000Provider.CanId);
        Assert.Equal(20,    T4000Provider.ExpectedCycleHz);  // 5 pacotes × 10ms
        Assert.Equal(10,    T4000Provider.PublishTargetHz);  // MS-9.5 Realtime
    }
}
