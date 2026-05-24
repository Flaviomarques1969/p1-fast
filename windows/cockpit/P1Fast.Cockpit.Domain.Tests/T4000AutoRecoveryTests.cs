// Cobertura T4000HealthAccumulator + T4000RecoveryStrategy: contadores
// corretos, decisão por estado, troca de baud, throttle de rescan.

using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class T4000AutoRecoveryTests
{
    // ── Acumulador de saúde ───────────────────────────────────────

    [Fact]
    public void HEALTH_01_RegisterBytes_atualiza_total_e_timestamp()
    {
        var t = 1000L;
        var h = new T4000HealthAccumulator(() => t);

        h.RegisterBytes(40);
        t = 2000L;
        h.RegisterBytes(10);

        var s = h.Snapshot();
        Assert.Equal(50, s.BytesReceivedTotal);
        Assert.Equal(0,  s.MsSinceLastByte); // last byte at 2000, now=2000
    }

    [Fact]
    public void HEALTH_02_CountSentinelsIn_acha_P4_tail_e_P5_head()
    {
        var h = new T4000HealthAccumulator(() => 0L);
        // P4 cauda 0x1E 0xFC, P5 cabeça 0xFB 0xFA
        var chunk = new byte[] { 0x00, 0x1E, 0xFC, 0xAA, 0xFB, 0xFA, 0x00 };
        h.CountSentinelsIn(chunk);

        var s = h.Snapshot();
        Assert.Equal(1, s.SentinelsP4Total);
        Assert.Equal(1, s.SentinelsP5Total);
    }

    [Fact]
    public void HEALTH_03_RegisterCycleResult_separa_ok_e_bad()
    {
        var h = new T4000HealthAccumulator(() => 0L);
        h.RegisterCycleResult(ok: true);
        h.RegisterCycleResult(ok: false);
        h.RegisterCycleResult(ok: true);
        h.RegisterCycleResult(ok: true);

        var s = h.Snapshot();
        Assert.Equal(3, s.CyclesOkTotal);
        Assert.Equal(1, s.CyclesBadTotal);
    }

    [Fact]
    public void HEALTH_04_Reset_zera_contadores_mas_mantem_StartedAt()
    {
        var h = new T4000HealthAccumulator(() => 100L);
        h.RegisterBytes(100);
        h.RegisterCycleResult(ok: true);

        h.Reset();

        var s = h.Snapshot();
        Assert.Equal(0, s.BytesReceivedTotal);
        Assert.Equal(0, s.CyclesOkTotal);
    }

    // ── Estratégia de recuperação ─────────────────────────────────

    [Fact]
    public void REC_01_NoPortsDetected_dispara_rescan_apos_intervalo()
    {
        var s = new T4000RecoveryStrategy(new T4000AutoRecoveryConfig(
            BaudRatesToTry: new[] { 1_000_000 },
            RescanPortsIntervalMs: 2000));

        var a1 = s.Decide(T4000ConnectionState.NoPortsDetected, Array.Empty<string>(), nowMs: 0);
        Assert.Equal("rescan-ports", a1.Tipo);

        var a2 = s.Decide(T4000ConnectionState.NoPortsDetected, Array.Empty<string>(), nowMs: 500);
        Assert.Equal("wait", a2.Tipo);

        var a3 = s.Decide(T4000ConnectionState.NoPortsDetected, Array.Empty<string>(), nowMs: 2500);
        Assert.Equal("rescan-ports", a3.Tipo);
    }

    [Fact]
    public void REC_02_PortBusy_dispara_retry_apos_intervalo()
    {
        var s = new T4000RecoveryStrategy(new T4000AutoRecoveryConfig(
            BaudRatesToTry: new[] { 1_000_000 },
            RetryBusyPortIntervalMs: 5000));

        var a1 = s.Decide(T4000ConnectionState.PortBusy, new[] { "COM3" }, nowMs: 0);
        Assert.Equal("retry-busy", a1.Tipo);

        var a2 = s.Decide(T4000ConnectionState.PortBusy, new[] { "COM3" }, nowMs: 1000);
        Assert.Equal("wait", a2.Tipo);

        var a3 = s.Decide(T4000ConnectionState.PortBusy, new[] { "COM3" }, nowMs: 5500);
        Assert.Equal("retry-busy", a3.Tipo);
    }

    [Fact]
    public void REC_03_PortOpenNoData_pede_reopen_no_mesmo_baud()
    {
        var s = new T4000RecoveryStrategy();
        s.OnPortOpened("COM4");

        var a = s.Decide(T4000ConnectionState.PortOpenNoData, new[] { "COM4" }, nowMs: 1000);
        Assert.Equal("reopen-same", a.Tipo);
        Assert.Contains("COM4", a.Detalhe);
    }

    [Fact]
    public void REC_04_ProtocolMismatch_troca_baud_e_cicla_de_volta()
    {
        var s = new T4000RecoveryStrategy(new T4000AutoRecoveryConfig(
            BaudRatesToTry: new[] { 1_000_000, 921_600, 460_800 }));

        Assert.Equal(1_000_000, s.CurrentBaudRate);

        s.Decide(T4000ConnectionState.ProtocolMismatch, new[] { "COM3" }, nowMs: 0);
        Assert.Equal(921_600, s.CurrentBaudRate);

        s.Decide(T4000ConnectionState.ProtocolMismatch, new[] { "COM3" }, nowMs: 0);
        Assert.Equal(460_800, s.CurrentBaudRate);

        s.Decide(T4000ConnectionState.ProtocolMismatch, new[] { "COM3" }, nowMs: 0);
        Assert.Equal(1_000_000, s.CurrentBaudRate); // ciclou
    }

    [Fact]
    public void REC_05_ChecksumFlapping_pede_resync_do_feeder()
    {
        var s = new T4000RecoveryStrategy();
        var a = s.Decide(T4000ConnectionState.ChecksumFlapping, new[] { "COM3" }, nowMs: 0);
        Assert.Equal("resync-feeder", a.Tipo);
    }

    [Fact]
    public void REC_06_ConnectionFlapping_pede_reopen_apos_queda()
    {
        var s = new T4000RecoveryStrategy();
        var a = s.Decide(T4000ConnectionState.ConnectionFlapping, new[] { "COM3" }, nowMs: 0);
        Assert.Equal("reopen-after-drop", a.Tipo);
    }

    [Fact]
    public void REC_07_Healthy_nao_pede_acao()
    {
        var s = new T4000RecoveryStrategy();
        var a = s.Decide(T4000ConnectionState.Healthy, new[] { "COM3" }, nowMs: 0);
        Assert.Equal("none", a.Tipo);
    }

    [Fact]
    public void REC_08_Unknown_tenta_porta_mais_alta_se_nada_aberto()
    {
        var s = new T4000RecoveryStrategy();
        var a = s.Decide(T4000ConnectionState.Unknown, new[] { "COM3", "COM4", "COM5" }, nowMs: 0);
        Assert.Equal("try-first-port", a.Tipo);
        Assert.Contains("COM5", a.Detalhe); // pega a mais alta (^1)
    }

    [Fact]
    public void REC_09_Unknown_sem_portas_aguarda()
    {
        var s = new T4000RecoveryStrategy();
        var a = s.Decide(T4000ConnectionState.Unknown, Array.Empty<string>(), nowMs: 0);
        Assert.Equal("wait", a.Tipo);
    }
}
