// 26 facts xUnit equivalentes 1:1 aos smokes LDB-01..LDB-26 do
// tests/node-smoke-live-data-bridge.mjs.

using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class LiveDataBridgeTests
{
    /// <summary>Builder de T4000ProviderSample com defaults limpos + overrides.</summary>
    private static T4000ProviderSample Fresh(
        int rpm                = 3000,
        double speedKmh        = 80,
        double oilPressBar     = 4.0,
        double oilTempC        = 80,
        double waterTempC      = 80,
        bool egtOutOfRange     = false,
        int ecuErrorBits       = 0,
        bool checksumOk        = true,
        double tMono           = 1234)
    {
        var telemetry = new T4000Sample(
            Rpm:           rpm,
            SpeedKmh:      speedKmh,
            OilPressBar:   oilPressBar,
            OilTempC:      oilTempC,
            WaterTempC:    waterTempC,
            FuelPressBar:  4.0,
            BatteryV:      12.5,
            TpsPct:        30,
            MapBar:        1.0,
            AirTempC:      30,
            EgtC:          600,
            EgtOutOfRange: egtOutOfRange,
            Lambda:        0.95,
            FuelTempC:     50,
            Marcha:        3,
            EcuErrorBits:  ecuErrorBits
        );
        return new T4000ProviderSample(telemetry, tMono, checksumOk);
    }

    // ── RpmToShift puro ──────────────────────────────────────

    [Fact]
    public void LDB_01_RpmToShift_menos_de_50pct_redline_OFF()
    {
        var r = LiveDataBridge.RpmToShift(3000); // 40%
        Assert.Equal(ShiftMode.Off, r.Mode);
        Assert.Equal(0, r.Level);
    }

    [Fact]
    public void LDB_02_RpmToShift_50pct_redline_LIT_level_1()
    {
        var r = LiveDataBridge.RpmToShift(3750); // 50%
        Assert.Equal(ShiftMode.Lit, r.Mode);
        Assert.True(r.Level >= 1);
    }

    [Fact]
    public void LDB_03_RpmToShift_95pct_redline_FIRE()
    {
        var r = LiveDataBridge.RpmToShift(7125); // 95%
        Assert.Equal(ShiftMode.Fire, r.Mode);
    }

    [Fact]
    public void LDB_04_RpmToShift_acima_redline_OVERREV()
    {
        var r = LiveDataBridge.RpmToShift(7800);
        Assert.Equal(ShiftMode.Overrev, r.Mode);
    }

    [Fact]
    public void LDB_05_RpmToShift_70pct_redline_LIT_level_no_meio()
    {
        var r = LiveDataBridge.RpmToShift(5250); // 70%
        Assert.Equal(ShiftMode.Lit, r.Mode);
        Assert.InRange(r.Level, 2, 5);
    }

    [Fact]
    public void LDB_06_RpmToShift_NaN_negativo_infinito_OFF_defensive()
    {
        foreach (var bad in new[] { double.NaN, -100, double.NegativeInfinity, double.PositiveInfinity })
        {
            var r = LiveDataBridge.RpmToShift(bad);
            Assert.Equal(ShiftMode.Off, r.Mode);
        }
    }

    [Fact]
    public void LDB_07_RpmToShift_respeita_redlineRpm_injetado()
    {
        var r = LiveDataBridge.RpmToShift(8500, LiveLimits.Default with { RedlineRpm = 9000 });
        // 8500/9000 = 94.4% < 95% fire threshold → LIT
        Assert.Equal(ShiftMode.Lit, r.Mode);
    }

    // ── CheckCriticalAlerts puro ────────────────────────────

    [Fact]
    public void LDB_08_CheckCriticalAlerts_erro_ECU_diferente_de_zero_grave_Erro_ECU()
    {
        var a = LiveDataBridge.CheckCriticalAlerts(Fresh(ecuErrorBits: 0x0005));
        Assert.NotNull(a);
        Assert.Equal(MsgTipo.Grave, a!.Tipo);
        Assert.Contains("Erro ECU", a.Texto, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void LDB_09_CheckCriticalAlerts_prioridade_erro_ECU_vence_outras_condicoes()
    {
        var a = LiveDataBridge.CheckCriticalAlerts(Fresh(ecuErrorBits: 0x0001, waterTempC: 130));
        Assert.NotNull(a);
        Assert.Contains("Erro ECU", a!.Texto, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void LDB_10_CheckCriticalAlerts_agua_acima_do_limite_grave()
    {
        var a = LiveDataBridge.CheckCriticalAlerts(Fresh(waterTempC: 115));
        Assert.NotNull(a);
        Assert.Contains("água", a!.Texto, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void LDB_11_CheckCriticalAlerts_oleo_temperatura_acima_de_130_grave()
    {
        var a = LiveDataBridge.CheckCriticalAlerts(Fresh(oilTempC: 135));
        Assert.NotNull(a);
        Assert.Contains("óleo", a!.Texto, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void LDB_12_CheckCriticalAlerts_pressao_oleo_baixa_so_dispara_com_RPM_acima_de_2000()
    {
        // RPM baixo → não alerta
        var aLow = LiveDataBridge.CheckCriticalAlerts(Fresh(rpm: 1500, oilPressBar: 0.3));
        Assert.Null(aLow);
        // RPM alto → alerta
        var aHigh = LiveDataBridge.CheckCriticalAlerts(Fresh(rpm: 4000, oilPressBar: 0.3));
        Assert.NotNull(aHigh);
        Assert.Contains("Pressão óleo", aHigh!.Texto, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void LDB_13_CheckCriticalAlerts_EGT_out_of_range_grave()
    {
        var a = LiveDataBridge.CheckCriticalAlerts(Fresh(egtOutOfRange: true));
        Assert.NotNull(a);
        Assert.Contains("EGT", a!.Texto, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void LDB_14_CheckCriticalAlerts_tudo_OK_null()
    {
        var a = LiveDataBridge.CheckCriticalAlerts(Fresh());
        Assert.Null(a);
    }

    [Fact]
    public void LDB_15_CheckCriticalAlerts_checksum_ok_false_null_nao_interpreta()
    {
        var a = LiveDataBridge.CheckCriticalAlerts(Fresh(checksumOk: false, ecuErrorBits: 0xFFFF));
        Assert.Null(a);
    }

    // ── LiveDataBridge — integração T4000 → CockpitState ─────

    [Fact]
    public void LDB_16_IngestT4000_RPM_7200_96pct_cockpit_shift_FIRE()
    {
        var cs = new CockpitState();
        var b  = new LiveDataBridge(cs);
        b.IngestT4000(Fresh(rpm: 7200));
        Assert.Equal(ShiftMode.Fire, cs.Get().Shift.Mode);
    }

    [Fact]
    public void LDB_17_IngestT4000_RPM_5000_66pct_cockpit_shift_LIT_level_medio()
    {
        var cs = new CockpitState();
        var b  = new LiveDataBridge(cs);
        b.IngestT4000(Fresh(rpm: 5000));
        var s = cs.Get().Shift;
        Assert.Equal(ShiftMode.Lit, s.Mode);
        Assert.InRange(s.Level, 1, 6);
    }

    [Fact]
    public void LDB_18_IngestT4000_com_erro_ECU_cockpit_message_GRAVE_Erro_ECU()
    {
        var cs = new CockpitState();
        var b  = new LiveDataBridge(cs);
        b.IngestT4000(Fresh(ecuErrorBits: 0x0001));
        var m = cs.Get().Message;
        Assert.NotNull(m);
        Assert.Equal(MsgTipo.Grave, m!.Tipo);
        Assert.Contains("Erro ECU", m.Texto, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void LDB_19_IngestT4000_com_alerta_resolvido_cockpit_message_volta_a_null()
    {
        var cs = new CockpitState();
        var b  = new LiveDataBridge(cs);
        b.IngestT4000(Fresh(ecuErrorBits: 0x0001)); // alerta
        Assert.NotNull(cs.Get().Message);
        b.IngestT4000(Fresh(ecuErrorBits: 0));      // resolveu
        Assert.Null(cs.Get().Message);
    }

    [Fact]
    public void LDB_20_IngestT4000_nao_dispara_show_message_repetida_com_mesmo_alerta()
    {
        var cs = new CockpitState();
        var messageChanges = 0;
        cs.OnChange((_, _, keys) => { if (keys.Contains("message")) messageChanges++; });
        var b = new LiveDataBridge(cs);
        b.IngestT4000(Fresh(waterTempC: 115));
        b.IngestT4000(Fresh(waterTempC: 116)); // mesmo alerta semântico
        b.IngestT4000(Fresh(waterTempC: 117));
        Assert.Equal(1, messageChanges);
    }

    [Fact]
    public void LDB_21_IngestT4000_com_checksum_ok_false_nao_atualiza_shift_nem_alerta()
    {
        var cs = new CockpitState();
        var b  = new LiveDataBridge(cs);
        b.IngestT4000(Fresh(checksumOk: false, rpm: 7800, ecuErrorBits: 0xFFFF));
        Assert.Equal(ShiftMode.Off, cs.Get().Shift.Mode);
        Assert.Null(cs.Get().Message);
    }

    // LDB_22 e LDB_23 (IngestImuGps) removidos na faxina onda 2: a fonte de IMU/GPS
    // do iPhone (TransportSelector/ADR-023 iPhone-cabo) saiu; o GPS vivo entra pelo
    // RaceBox/GpsFiltroAoVivo, não por esta ponte.

    [Fact]
    public void LDB_24_stats_expoe_contadores()
    {
        var cs = new CockpitState();
        var b  = new LiveDataBridge(cs);
        b.IngestT4000(Fresh());
        b.IngestT4000(Fresh(ecuErrorBits: 1));
        b.IngestT4000(Fresh(ecuErrorBits: 0));
        var s = b.GetStats();
        Assert.Equal(3, s.T4000Count);
        Assert.Equal(1, s.AlertsRaised);
        Assert.Equal(1, s.AlertsCleared);
    }

    [Fact]
    public void LDB_25_onEvent_recebe_alert_raised_e_alert_cleared()
    {
        var cs = new CockpitState();
        var events = new List<LiveBridgeEvent>();
        var b = new LiveDataBridge(cs, onEvent: events.Add);
        b.IngestT4000(Fresh(waterTempC: 120));
        b.IngestT4000(Fresh(waterTempC: 80));
        Assert.Contains(events, e => e.Stage == "alert-raised");
        Assert.Contains(events, e => e.Stage == "alert-cleared");
    }

    [Fact]
    public void LDB_26_construtor_exige_cockpitState()
    {
        Assert.Throws<ArgumentNullException>(() => new LiveDataBridge((CockpitState)null!));
    }
}
