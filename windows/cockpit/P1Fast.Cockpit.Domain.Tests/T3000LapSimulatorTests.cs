// T3000LapSimulator: determinismo + cobertura dos regimes que a tela precisa
// mostrar (FIRE, OVERREV, alerta de água, alerta de óleo), dirigindo o painel
// pelo MESMO LiveDataBridge.IngestT3000 que a central real usa.

using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class T3000LapSimulatorTests
{
    [Fact]
    public void Eh_deterministico_e_faz_loop_a_cada_36s()
    {
        var sim = new T3000LapSimulator();
        var a = sim.Next(5.0);
        var b = sim.Next(5.0);
        var c = sim.Next(5.0 + 36.0);
        Assert.Equal(a.Rpm, b.Rpm);
        Assert.Equal(a.Rpm, c.Rpm);
        Assert.Equal(a.SpeedKmh, c.SpeedKmh, 3);
    }

    [Fact]
    public void Marcha_fica_entre_1_e_6()
    {
        var sim = new T3000LapSimulator();
        for (double t = 0; t < 72; t += 0.25)
        {
            var s = sim.Next(t);
            Assert.InRange(s.MapaAtual, 1, 6);
            Assert.True(s.ChecksumOk);
        }
    }

    [Fact]
    public void Varre_ate_passar_do_redline_em_cada_marcha()
    {
        var sim = new T3000LapSimulator();
        bool viuOverrev = false, viuBaixo = false;
        for (double t = 0; t < 6; t += 0.1)
        {
            int rpm = sim.Next(t).Rpm;
            if (rpm > 7500) viuOverrev = true;
            if (rpm < 3200) viuBaixo = true;
        }
        Assert.True(viuBaixo, "deve começar baixo");
        Assert.True(viuOverrev, "deve passar do redline no topo da marcha");
    }

    [Fact]
    public void Janela_de_oleo_baixo_dispara_mensagem_no_cockpit()
    {
        var cs = new CockpitState();
        var bridge = new LiveDataBridge(cs);
        var sim = new T3000LapSimulator();

        bridge.IngestT3000(sim.Next(31.0)); // dentro de [30,33)
        var msg = cs.Get().Message;
        Assert.NotNull(msg);
        Assert.Equal("ÓLEO BAIXO", msg!.Texto);
    }

    [Fact]
    public void Janela_de_agua_quente_dispara_alerta()
    {
        var sim = new T3000LapSimulator();
        var s = sim.Next(21.0); // dentro de [20,22)
        var alert = LiveDataBridge.CheckCriticalAlertsT3000(s);
        Assert.NotNull(alert);
        Assert.Equal("Temperatura água crítica", alert!.Texto);
    }

    [Fact]
    public void Volta_completa_passa_por_fire_e_overrev_e_volta_a_limpar()
    {
        var cs = new CockpitState();
        var bridge = new LiveDataBridge(cs);
        var sim = new T3000LapSimulator();

        bool fire = false, overrev = false, limpouAlgumaVez = false;
        for (double t = 0; t < 36; t += 0.1)
        {
            bridge.IngestT3000(sim.Next(t));
            var m = cs.Get().Shift.Mode;
            if (m == ShiftMode.Fire) fire = true;
            if (m == ShiftMode.Overrev) overrev = true;
            if (cs.Get().Message is null) limpouAlgumaVez = true;
        }
        Assert.True(fire, "shift FIRE deve aparecer");
        Assert.True(overrev, "OVERREV deve aparecer");
        Assert.True(limpouAlgumaVez, "fora das janelas de alerta a mensagem some");
    }
}
