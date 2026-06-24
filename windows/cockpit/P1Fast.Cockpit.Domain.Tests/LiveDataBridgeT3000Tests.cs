// Caminho T3000/T4000 do LiveDataBridge: IngestT3000 + CheckCriticalAlertsT3000.
// Exercita o pipeline real de produção (bloco RI → sample → shift light + alarme
// → CockpitState) — o mesmo que o app WinUI roda lendo a central de verdade.

using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class LiveDataBridgeT3000Tests
{
    private static T3000Sample SampleParse(
        int rpm = 3000, int? waterTempC = 90, double lambda = 0.95,
        T3000Alarmes? alarmes = null)
    {
        var bloco = T3000RiBlockBuilder.Build(rpm: rpm, waterTempC: waterTempC, lambda: lambda, alarmes: alarmes);
        var s = T3000RiBlockParser.Parse(bloco);
        Assert.NotNull(s);
        return s!;
    }

    private static T3000Alarmes NoAlarmes() => new(
        false, false, false, false, false, false, false, false, false, false, false);

    // ── IngestT3000 → shift light no CockpitState ──────────────────

    [Fact]
    public void IngestT3000_rpm_baixo_deixa_shift_off()
    {
        var cs = new CockpitState();
        var bridge = new LiveDataBridge(cs);
        bridge.IngestT3000(SampleParse(rpm: 3000)); // 40% de 7500
        Assert.Equal(ShiftMode.Off, cs.Get().Shift.Mode);
    }

    [Fact]
    public void IngestT3000_rpm_no_fire_acende_fire()
    {
        var cs = new CockpitState();
        var bridge = new LiveDataBridge(cs);
        bridge.IngestT3000(SampleParse(rpm: 7200)); // 96% → FIRE
        Assert.Equal(ShiftMode.Fire, cs.Get().Shift.Mode);
    }

    [Fact]
    public void IngestT3000_acima_redline_overrev()
    {
        var cs = new CockpitState();
        var bridge = new LiveDataBridge(cs);
        bridge.IngestT3000(SampleParse(rpm: 7900));
        Assert.Equal(ShiftMode.Overrev, cs.Get().Shift.Mode);
    }

    [Fact]
    public void IngestT3000_conta_amostras_nas_stats()
    {
        var cs = new CockpitState();
        var bridge = new LiveDataBridge(cs);
        bridge.IngestT3000(SampleParse());
        bridge.IngestT3000(SampleParse());
        Assert.Equal(2, bridge.GetStats().T4000Count);
    }

    [Fact]
    public void IngestT3000_null_nao_estoura()
    {
        var bridge = new LiveDataBridge(new CockpitState());
        bridge.IngestT3000(null!);
        Assert.Equal(0, bridge.GetStats().T4000Count);
    }

    // ── Alarme → mensagem no cockpit ───────────────────────────────

    [Fact]
    public void IngestT3000_oleo_baixo_mostra_mensagem_grave()
    {
        var cs = new CockpitState();
        var bridge = new LiveDataBridge(cs);
        var alarmes = NoAlarmes() with { BaixaPressaoOleo = true };
        bridge.IngestT3000(SampleParse(alarmes: alarmes));

        var msg = cs.Get().Message;
        Assert.NotNull(msg);
        Assert.Equal(MsgTipo.Grave, msg!.Tipo);
        Assert.Equal("ÓLEO BAIXO", msg.Texto);
    }

    [Fact]
    public void IngestT3000_alarme_que_some_limpa_a_mensagem()
    {
        var cs = new CockpitState();
        var bridge = new LiveDataBridge(cs);
        bridge.IngestT3000(SampleParse(alarmes: NoAlarmes() with { ExcessoTempMotor = true }));
        Assert.NotNull(cs.Get().Message);

        bridge.IngestT3000(SampleParse(alarmes: NoAlarmes())); // condição limpou
        Assert.Null(cs.Get().Message);
        Assert.Equal(1, bridge.GetStats().AlertsCleared);
    }

    // ── CheckCriticalAlertsT3000 puro: ordem de gravidade ──────────

    [Fact]
    public void Prioridade_oleo_vence_motor_quente()
    {
        var s = SampleParse(waterTempC: 130, alarmes: NoAlarmes() with
        {
            BaixaPressaoOleo = true,
            ExcessoTempMotor = true,
        });
        var alert = LiveDataBridge.CheckCriticalAlertsT3000(s);
        Assert.Equal("ÓLEO BAIXO", alert!.Texto);
    }

    [Fact]
    public void Agua_acima_do_limite_dispara_alerta_grave()
    {
        var s = SampleParse(waterTempC: 115, alarmes: NoAlarmes());
        var alert = LiveDataBridge.CheckCriticalAlertsT3000(s);
        Assert.NotNull(alert);
        Assert.Equal(MsgTipo.Grave, alert!.Tipo);
        Assert.Equal("Temperatura água crítica", alert.Texto);
    }

    [Fact]
    public void Wb_maximo_e_comunicacao_pra_box()
    {
        var s = SampleParse(alarmes: NoAlarmes() with { WbMaximo = true });
        var alert = LiveDataBridge.CheckCriticalAlertsT3000(s);
        Assert.NotNull(alert);
        Assert.Equal(MsgTipo.Comunicacao, alert!.Tipo);
        Assert.Equal("Pra box", alert.Texto);
    }

    [Fact]
    public void Sem_alarme_e_agua_ok_retorna_null()
    {
        var s = SampleParse(waterTempC: 90, alarmes: NoAlarmes());
        Assert.Null(LiveDataBridge.CheckCriticalAlertsT3000(s));
    }
}
