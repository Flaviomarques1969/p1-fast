// Motor de alertas críticos (port de web/cockpit/alertas-criticos.js).
// Incremento 2 da Fase 4. Cobre o catálogo, o avaliador, a ordem por gravidade
// e — principalmente — o conserto do SENSOR AUSENTE que o dado real de 21/06
// revelou (óleo veio vazio; não pode virar alerta falso).

using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class AlertasCriticosTests
{
    // ── Catálogo ────────────────────────────────────────────

    [Fact]
    public void ALR_01_Catalogo_tem_19_alertas()
    {
        Assert.Equal(19, CatalogoAlertas.Todos.Count);
        Assert.Equal("MOTOR QUENTE", CatalogoAlertas.Todos["MOTOR_QUENTE"].Texto);
        Assert.Equal(AlertaGravidade.Super, CatalogoAlertas.Todos["MOTOR_QUENTE"].Gravidade);
    }

    // ── Água (Bubi opera frio: 70 aquecendo, 80 quente) ─────

    [Theory]
    [InlineData(58, null)]                 // frio: nada (como a sessão real)
    [InlineData(70, "MOTOR_AQUECENDO")]
    [InlineData(79, "MOTOR_AQUECENDO")]
    [InlineData(80, "MOTOR_QUENTE")]
    [InlineData(95, "MOTOR_QUENTE")]
    public void ALR_02_Agua_dispara_nas_bordas_do_Bubi(double water, string? esperado)
    {
        var ids = CatalogoAlertas.AvaliarT4000(new AmostraAlerta { WaterTempC = water });
        if (esperado is null) Assert.Empty(ids);
        else Assert.Contains(esperado, ids);
    }

    // ── O CONSERTO: sensor ausente nunca dispara ────────────

    [Fact]
    public void ALR_03_Sensor_de_oleo_AUSENTE_nao_dispara_alerta_falso()
    {
        // É exatamente o caso da sessão real: óleo ausente + rotação alta.
        // Antes (modelado como pressão 0 bar) dispararia ÓLEO BAIXO falso.
        var ids = CatalogoAlertas.AvaliarT4000(new AmostraAlerta
        {
            BaixaPressaoOleo = null,   // sensor ausente
            Rpm = 5000,
            WaterTempC = 55,
        });
        Assert.DoesNotContain("OLEO_BAIXO", ids);
        Assert.Empty(ids);
    }

    [Fact]
    public void ALR_04_Oleo_dispara_pelo_BIT_de_alarme_com_rpm_acima_de_2000()
    {
        Assert.Contains("OLEO_BAIXO",
            CatalogoAlertas.AvaliarT4000(new AmostraAlerta { BaixaPressaoOleo = true, Rpm = 3000 }));
        // rpm baixo: não dispara (motor em marcha lenta pode ter pressão baixa normal)
        Assert.DoesNotContain("OLEO_BAIXO",
            CatalogoAlertas.AvaliarT4000(new AmostraAlerta { BaixaPressaoOleo = true, Rpm = 1500 }));
    }

    // ── Lambda (igual aos picos da sessão real: 0.6 e 1.6) ──

    [Fact]
    public void ALR_05_Lambda_pobre_e_rica_quando_andando()
    {
        // sob carga (rpm alto): a mistura é avaliada.
        Assert.Contains("MISTURA_POBRE", CatalogoAlertas.AvaliarT4000(new AmostraAlerta { Lambda = 1.6, Rpm = 4000 }));
        Assert.Contains("MISTURA_RICA",  CatalogoAlertas.AvaliarT4000(new AmostraAlerta { Lambda = 0.6, Rpm = 4000 }));
        Assert.Empty(CatalogoAlertas.AvaliarT4000(new AmostraAlerta { Lambda = 0.95, Rpm = 4000 }));
        Assert.Empty(CatalogoAlertas.AvaliarT4000(new AmostraAlerta { Lambda = null, Rpm = 4000 })); // ausente
    }

    // ── Bateria / combustível / falhando ────────────────────

    [Fact]
    public void ALR_06_Bateria_combustivel_e_falhando()
    {
        Assert.Contains("BATERIA", CatalogoAlertas.AvaliarT4000(new AmostraAlerta { BatteryV = 11.0, Rpm = 4000 }));
        Assert.Empty(CatalogoAlertas.AvaliarT4000(new AmostraAlerta { BatteryV = 12.5, Rpm = 4000 }));

        Assert.Contains("COMBUSTIVEL_BAIXO",
            CatalogoAlertas.AvaliarT4000(new AmostraAlerta { AlertaNivelCombustivel = true }));
        Assert.Contains("COMBUSTIVEL_BAIXO_CRITICO",
            CatalogoAlertas.AvaliarT4000(new AmostraAlerta { AlertaNivelCombustivel = true, BaixaPressaoCombustivel = true }));

        Assert.Contains("FALHANDO",
            CatalogoAlertas.AvaliarT4000(new AmostraAlerta { FuelInjectionBalanced = false }));
    }

    // ── Orquestrador: prioridade por gravidade ──────────────

    [Fact]
    public void ALR_07_Mensagem_principal_pega_a_maior_gravidade()
    {
        var ac = new AlertasCriticos();
        ac.IngestT4000(new AmostraAlerta { WaterTempC = 85, BatteryV = 11.0, Rpm = 4000 }); // QUENTE(super) + BATERIA(atencao)
        var m = ac.GetMensagemPrincipal();
        Assert.NotNull(m);
        Assert.Equal("MOTOR_QUENTE", m!.Id);
        Assert.Equal(MsgTipo.Grave, m.Tipo);
        Assert.Equal(1, m.CountOutros); // a bateria fica "embaixo"
    }

    [Fact]
    public void ALR_08_Sem_alerta_retorna_null_e_motor_frio_limpa()
    {
        var ac = new AlertasCriticos();
        Assert.Null(ac.GetMensagemPrincipal());

        ac.IngestT4000(new AmostraAlerta { WaterTempC = 85 }); // quente
        Assert.NotNull(ac.GetMensagemPrincipal());

        ac.IngestT4000(new AmostraAlerta { WaterTempC = 55 }); // esfriou: alerta some sozinho
        Assert.Null(ac.GetMensagemPrincipal());
    }

    // ── Gate de "carro andando" (achado do dado real 21/06) ─────────

    [Fact]
    public void ALR_10_Marcha_lenta_nao_dispara_mistura_nem_bateria()
    {
        // Caso real: carro parado/marcha lenta, lambda pobre e bateria caída.
        var idle = new AmostraAlerta { Rpm = 1000, Lambda = 1.6, BatteryV = 11.0, WaterTempC = 85 };
        var ids = CatalogoAlertas.AvaliarT4000(idle);
        Assert.DoesNotContain("MISTURA_POBRE", ids); // gate de carga segurou
        Assert.DoesNotContain("BATERIA", ids);       // gate de carga segurou
        Assert.Contains("MOTOR_QUENTE", ids);        // segurança NÃO é gated (vale parado)

        // Acelerador aberto (mesmo em rpm baixo) = sob carga -> volta a avaliar.
        var pisando = idle with { TpsPct = 50 };
        Assert.Contains("MISTURA_POBRE", CatalogoAlertas.AvaliarT4000(pisando));
        Assert.Contains("BATERIA", CatalogoAlertas.AvaliarT4000(pisando));
    }

    [Fact]
    public void ALR_09_Manual_BOX_some_so_no_clear()
    {
        var ac = new AlertasCriticos();
        ac.RaiseManual("BOX");
        Assert.Equal("BOX", ac.GetMensagemPrincipal()!.Id);
        ac.IngestT4000(new AmostraAlerta { WaterTempC = 55 }); // amostra normal não derruba o manual
        Assert.Equal("BOX", ac.GetMensagemPrincipal()!.Id);
        ac.ClearManual("BOX");
        Assert.Null(ac.GetMensagemPrincipal());
    }
}
