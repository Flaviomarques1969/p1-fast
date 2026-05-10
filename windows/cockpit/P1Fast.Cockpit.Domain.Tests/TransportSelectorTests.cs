// 17 facts xUnit equivalentes 1:1 aos smokes TRP-01..TRP-17 do
// tests/node-smoke-transport.mjs.

using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class TransportSelectorTests
{
    /// <summary>Rig de teste: clock controlavel + selector + 2 mocks.</summary>
    private sealed class Rig
    {
        public TransportSelector Sel { get; }
        public MockTransport Primary { get; }
        public MockTransport Fallback { get; }
        public List<TransportEnvelope> Messages { get; } = new();
        public List<SwitchEvent> Switches { get; } = new();
        private double _now;

        public Rig()
        {
            Primary  = new MockTransport("primary");
            Fallback = new MockTransport("fallback");
            Sel = new TransportSelector(
                primary:    Primary,
                fallback:   Fallback,
                onMessage:  e => Messages.Add(e),
                onSwitch:   s => Switches.Add(s),
                now:        () => _now);
        }

        public double Now => _now;
        public void Advance(double ms) { _now += ms; Sel.Tick(); }
    }

    private static TransportEnvelope HB(double now) => new(now, "heartbeat", null);
    private static TransportEnvelope Sample(double now, string value) =>
        new(now, "iphone-imu", new SamplePayload(value));

    private sealed record SamplePayload(string V);

    // ── Defaults da spec ─────────────────────────────────────

    [Fact]
    public void TRP_01_defaults_silence_3000_recovery_1000_heartbeat_1000()
    {
        Assert.Equal(3000, TransportDefaults.SilenceTimeoutMs);
        Assert.Equal(1000, TransportDefaults.RecoveryDebounceMs);
        Assert.Equal(1000, TransportDefaults.HeartbeatExpectedMs);
    }

    // ── Início no primary ───────────────────────────────────

    [Fact]
    public void TRP_02_comeca_em_OnPrimary()
    {
        var rig = new Rig();
        rig.Sel.Start();
        Assert.Equal(SelectorState.OnPrimary, rig.Sel.GetStats().State);
    }

    [Fact]
    public void TRP_03_forwarda_mensagem_do_primary_quando_saudavel()
    {
        var rig = new Rig();
        rig.Sel.Start();
        rig.Primary.Inject(Sample(0, "a"));
        Assert.Single(rig.Messages);
        Assert.Equal("a", ((SamplePayload)rig.Messages[0].Payload!).V);
    }

    [Fact]
    public void TRP_04_ignora_mensagem_do_fallback_enquanto_no_primary()
    {
        var rig = new Rig();
        rig.Sel.Start();
        rig.Fallback.Inject(Sample(0, "b"));
        Assert.Empty(rig.Messages);
        Assert.Equal(1, rig.Sel.GetStats().PacketsDropped);
    }

    // ── Heartbeat e silêncio ────────────────────────────────

    [Fact]
    public void TRP_05_heartbeat_do_primary_nao_e_forwardado_pro_consumer()
    {
        var rig = new Rig();
        rig.Sel.Start();
        rig.Primary.Inject(HB(0));
        Assert.Empty(rig.Messages);
    }

    [Fact]
    public void TRP_06_silencio_de_3s_do_primary_switch_pro_fallback()
    {
        var rig = new Rig();
        rig.Sel.Start();
        rig.Primary.Inject(HB(0));
        rig.Advance(2999);
        Assert.Equal(SelectorState.OnPrimary, rig.Sel.GetStats().State);
        rig.Advance(2);
        Assert.Equal(SelectorState.OnFallback, rig.Sel.GetStats().State);
        Assert.Equal(1, rig.Sel.GetStats().SwitchesToFallback);
        var sc = rig.Switches.Find(s => s.Stage == "state-change" && s.To == SelectorState.OnFallback);
        Assert.NotNull(sc);
        Assert.Equal("silence", sc!.Reason);
    }

    // ── No fallback ─────────────────────────────────────────

    [Fact]
    public void TRP_07_ja_no_fallback_forwarda_mensagem_do_fallback()
    {
        var rig = new Rig();
        rig.Sel.Start();
        rig.Advance(3001);
        rig.Fallback.Inject(Sample(rig.Now, "c"));
        Assert.Single(rig.Messages);
        Assert.Equal("c", ((SamplePayload)rig.Messages[0].Payload!).V);
    }

    [Fact]
    public void TRP_08_ja_no_fallback_ignora_mensagem_do_primary()
    {
        var rig = new Rig();
        rig.Sel.Start();
        rig.Advance(3001);
        rig.Primary.Inject(Sample(rig.Now, "d"));
        Assert.Empty(rig.Messages);
        Assert.True(rig.Sel.GetStats().PacketsDropped >= 1);
    }

    // ── Recovery (primary volta) ────────────────────────────

    [Fact]
    public void TRP_09_primary_volta_a_heartbeatar_entra_em_Recovering()
    {
        var rig = new Rig();
        rig.Sel.Start();
        rig.Advance(3001);
        rig.Primary.Inject(HB(rig.Now));
        Assert.Equal(SelectorState.Recovering, rig.Sel.GetStats().State);
    }

    [Fact]
    public void TRP_10_Recovering_mais_1s_de_heartbeat_estavel_volta_pro_primary()
    {
        var rig = new Rig();
        rig.Sel.Start();
        rig.Advance(3001);
        rig.Primary.Inject(HB(rig.Now));
        rig.Advance(500);
        rig.Primary.Inject(HB(rig.Now));
        rig.Advance(600); // total 1100ms desde inicio da recovery
        Assert.Equal(SelectorState.OnPrimary, rig.Sel.GetStats().State);
        Assert.Equal(1, rig.Sel.GetStats().SwitchesToPrimary);
    }

    [Fact]
    public void TRP_11_Recovering_aborta_se_primary_silencia_de_novo()
    {
        var rig = new Rig();
        rig.Sel.Start();
        rig.Advance(3001);
        rig.Primary.Inject(HB(rig.Now)); // entra em Recovering
        rig.Advance(3001);
        Assert.Equal(SelectorState.OnFallback, rig.Sel.GetStats().State);
        var aborted = rig.Switches.Find(s => s.Reason == "recovery-aborted");
        Assert.NotNull(aborted);
    }

    [Fact]
    public void TRP_12_Recovering_forwarda_dados_do_primary_mesmo_antes_do_debounce()
    {
        var rig = new Rig();
        rig.Sel.Start();
        rig.Advance(3001);
        rig.Primary.Inject(HB(rig.Now));
        rig.Primary.Inject(Sample(rig.Now, "recover-data"));
        Assert.Single(rig.Messages);
        Assert.Equal("recover-data", ((SamplePayload)rig.Messages[0].Payload!).V);
    }

    // ── Edge cases ──────────────────────────────────────────

    [Fact]
    public void TRP_13_Stop_impede_novos_forwards()
    {
        var rig = new Rig();
        rig.Sel.Start();
        rig.Sel.Stop();
        rig.Primary.Inject(Sample(0, "after-stop"));
        Assert.Empty(rig.Messages);
    }

    [Fact]
    public void TRP_14_construtor_exige_primary_fallback_e_onMessage()
    {
        var p = new MockTransport("p");
        var f = new MockTransport("f");
        Action<TransportEnvelope> on = _ => { };
        Assert.Throws<ArgumentNullException>(() => new TransportSelector(null!, f,    on));
        Assert.Throws<ArgumentNullException>(() => new TransportSelector(p,     null!, on));
        Assert.Throws<ArgumentNullException>(() => new TransportSelector(p,     f,    null!));
    }

    [Fact]
    public void TRP_15_stats_exibe_contadores_e_last_heartbeat_ago()
    {
        var rig = new Rig();
        rig.Sel.Start();
        rig.Primary.Inject(HB(0));
        rig.Advance(500);
        rig.Primary.Inject(Sample(0, "x"));
        rig.Advance(500);
        var s = rig.Sel.GetStats();
        Assert.Equal(1, s.PacketsForwarded);
        Assert.NotNull(s.LastPrimaryHeartbeatAgoMs);
        Assert.InRange(s.LastPrimaryHeartbeatAgoMs!.Value, 900, 1100);
    }

    [Fact]
    public void TRP_16_transport_error_propaga_via_onSwitch_sem_derrubar_selector()
    {
        var rig = new Rig();
        rig.Sel.Start();
        rig.Primary.InjectError(new Exception("USB unplugged"));
        var ev = rig.Switches.Find(s => s.Stage == "transport-error" && s.Which == "primary");
        Assert.NotNull(ev);
        Assert.Contains("USB unplugged", ev!.Err);
        Assert.Equal(SelectorState.OnPrimary, rig.Sel.GetStats().State);
    }

    // ── Cenário composto ────────────────────────────────────

    [Fact]
    public void TRP_17_cenario_ponta_a_ponta_cabo_derruba_fallback_assume_cabo_volta()
    {
        var rig = new Rig();
        rig.Sel.Start();

        // 1. funcionando no primary com heartbeat regular
        for (var i = 0; i < 5; i++)
        {
            rig.Primary.Inject(HB(rig.Now));
            rig.Primary.Inject(Sample(rig.Now, $"p{i}"));
            rig.Advance(1000);
        }
        Assert.Equal(5, rig.Messages.Count);

        // 2. cabo cai (sem heartbeat por 4s)
        rig.Advance(4000);
        Assert.Equal(SelectorState.OnFallback, rig.Sel.GetStats().State);

        // 3. fallback Realtime entra com 3 samples
        for (var i = 0; i < 3; i++)
        {
            rig.Fallback.Inject(Sample(rig.Now, $"f{i}"));
            rig.Advance(100);
        }
        Assert.Equal(8, rig.Messages.Count);

        // 4. cabo volta com heartbeat estável por 1.3s
        rig.Primary.Inject(HB(rig.Now)); // Recovering
        rig.Advance(500);
        rig.Primary.Inject(HB(rig.Now));
        rig.Advance(800); // total 1.3s desde inicio da recovery
        Assert.Equal(SelectorState.OnPrimary, rig.Sel.GetStats().State);

        var stats = rig.Sel.GetStats();
        Assert.Equal(1, stats.SwitchesToFallback);
        Assert.Equal(1, stats.SwitchesToPrimary);
    }
}
