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
    public void ALR_01_Catalogo_tem_16_alertas()
    {
        Assert.Equal(16, CatalogoAlertas.Todos.Count);
        Assert.Equal("Motor Quente", CatalogoAlertas.Todos["MOTOR_QUENTE"].Texto);
        Assert.Equal(AlertaGravidade.Super, CatalogoAlertas.Todos["MOTOR_QUENTE"].Gravidade);
    }

    // ── Água (Bubi opera frio: Motor Quente a 70; aquecendo fixo saiu, vira IA na Fase 2) ─────

    [Theory]
    [InlineData(58, null)]                 // frio: nada (como a sessão real)
    [InlineData(69, null)]                 // abaixo de 70: nada (Temperatura Subindo fixo saiu)
    [InlineData(70, "MOTOR_QUENTE")]
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
    public void ALR_04_Oleo_dispara_pelo_BIT_em_qualquer_rpm()
    {
        // spec v2 (Flávio 04/07): gate de rpm removido — o BIT dispara em qualquer rpm.
        // A salvaguarda de PARTIDA (suprime só o pico dos ~2s ao ligar) vem no bloco 2b.
        Assert.Contains("OLEO_BAIXO",
            CatalogoAlertas.AvaliarT4000(new AmostraAlerta { BaixaPressaoOleo = true, Rpm = 3000 }));
        Assert.Contains("OLEO_BAIXO",
            CatalogoAlertas.AvaliarT4000(new AmostraAlerta { BaixaPressaoOleo = true, Rpm = 1500 }));
    }

    // ── Lambda (igual aos picos da sessão real: 0.6 e 1.6) ──

    [Fact]
    public void ALR_05_Lambda_pobre_e_rica_quando_andando()
    {
        // Pobre: gate giro≥3500 OU tps≥50 — giro 4000 basta.
        Assert.Contains("MISTURA_POBRE", CatalogoAlertas.AvaliarT4000(new AmostraAlerta { Lambda = 1.6, Rpm = 4000 }));
        // Rica: gate giro>3000 E tps>40 (carga real) — precisa dos dois.
        Assert.Contains("MISTURA_RICA",  CatalogoAlertas.AvaliarT4000(new AmostraAlerta { Lambda = 0.6, Rpm = 4000, TpsPct = 50 }));
        Assert.Empty(CatalogoAlertas.AvaliarT4000(new AmostraAlerta { Lambda = 0.95, Rpm = 4000, TpsPct = 50 }));
        Assert.Empty(CatalogoAlertas.AvaliarT4000(new AmostraAlerta { Lambda = null, Rpm = 4000, TpsPct = 50 })); // ausente
    }

    // M3 (auditoria 2026-07-02): sonda WB ausente lê 0.0 (double válido, ≠ null) — mesmo sob
    // carga NÃO pode disparar MISTURA RICA falsa; leitura fora do físico (0.3–1.6) idem (§9).
    [Fact]
    public void ALR_11_Lambda_zero_ou_implausivel_nao_dispara_mistura()
    {
        Assert.Empty(CatalogoAlertas.AvaliarT4000(new AmostraAlerta { Lambda = 0.0, Rpm = 4000 }));  // sonda ausente lida como 0
        Assert.Empty(CatalogoAlertas.AvaliarT4000(new AmostraAlerta { Lambda = 5.0, Rpm = 4000 }));  // fora do físico
        Assert.Contains("MISTURA_RICA", CatalogoAlertas.AvaliarT4000(new AmostraAlerta { Lambda = 0.6, Rpm = 4000, TpsPct = 50 })); // real segue disparando
    }

    // ── Bateria / combustível / falhando ────────────────────

    [Fact]
    public void ALR_06_Bateria_e_falhando()
    {
        Assert.Contains("BATERIA", CatalogoAlertas.AvaliarT4000(new AmostraAlerta { BatteryV = 11.0, Rpm = 4000 }));
        Assert.Empty(CatalogoAlertas.AvaliarT4000(new AmostraAlerta { BatteryV = 12.5, Rpm = 4000 }));

        // Combustível (os 2 alertas) saiu na spec v2 — o bit não levanta mais nada.
        Assert.Empty(CatalogoAlertas.AvaliarT4000(new AmostraAlerta { AlertaNivelCombustivel = true, BaixaPressaoCombustivel = true }));

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

    // ── Histerese temporal (bloco 2b, spec v2 — Flávio 04/07) ───────

    [Fact]
    public void ALR_12_Oleo_suprime_o_pico_da_partida_e_depois_alarma()
    {
        var ac = new AlertasCriticos();
        var oleo = new AmostraAlerta { BaixaPressaoOleo = true, Rpm = 3000 };

        // motor acabou de ligar (t=0): nos primeiros ~2s o pico da partida é suprimido.
        ac.IngestT4000(oleo, 0.0);
        Assert.Null(ac.GetMensagemPrincipal());
        ac.IngestT4000(oleo, 1.5);
        Assert.Null(ac.GetMensagemPrincipal());

        // passados 2s de motor rodando, o alarme REAL aparece (instantâneo dali em diante).
        ac.IngestT4000(oleo, 2.0);
        Assert.Equal("OLEO_BAIXO", ac.GetMensagemPrincipal()!.Id);
    }

    [Fact]
    public void ALR_13_Oleo_nao_alarma_com_motor_desligado()
    {
        var ac = new AlertasCriticos();
        // rpm ~0 (off/partida) + bit ligado: não é alarme (pressão baixa com motor parado é normal).
        ac.IngestT4000(new AmostraAlerta { BaixaPressaoOleo = true, Rpm = 0 }, 0.0);
        Assert.Null(ac.GetMensagemPrincipal());
        ac.IngestT4000(new AmostraAlerta { BaixaPressaoOleo = true, Rpm = 0 }, 5.0);
        Assert.Null(ac.GetMensagemPrincipal());
    }

    [Fact]
    public void ALR_14_Rica_so_avisa_se_persistir_1s()
    {
        var ac = new AlertasCriticos();
        var rica = new AmostraAlerta { Lambda = 0.6, Rpm = 4000, TpsPct = 50 }; // rica sob carga real

        ac.IngestT4000(rica, 10.0);  // começou agora
        Assert.Null(ac.GetMensagemPrincipal());
        ac.IngestT4000(rica, 10.5);  // 0.5s: ainda não
        Assert.Null(ac.GetMensagemPrincipal());
        ac.IngestT4000(rica, 11.0);  // 1.0s contínuo → avisa
        Assert.Equal("MISTURA_RICA", ac.GetMensagemPrincipal()!.Id);
    }

    [Fact]
    public void ALR_15_Rica_transitoria_reseta_o_cronometro()
    {
        var ac = new AlertasCriticos();
        var rica  = new AmostraAlerta { Lambda = 0.6, Rpm = 4000, TpsPct = 50 };
        var limpa = new AmostraAlerta { Lambda = 0.9, Rpm = 4000, TpsPct = 50 }; // mistura ok

        ac.IngestT4000(rica,  0.0);
        ac.IngestT4000(rica,  0.8);   // quase 1s
        ac.IngestT4000(limpa, 0.9);   // quebrou a mistura rica → zera o cronômetro
        Assert.Null(ac.GetMensagemPrincipal());
        ac.IngestT4000(rica,  1.5);   // recomeçou a contar em 1.5
        Assert.Null(ac.GetMensagemPrincipal());
        ac.IngestT4000(rica,  2.5);   // 1s desde o recomeço → avisa
        Assert.Equal("MISTURA_RICA", ac.GetMensagemPrincipal()!.Id);
    }

    [Fact]
    public void ALR_20_Pobre_freio_motor_transitorio_NAO_alarma_persistente_SIM()
    {
        // Decisão Flávio 2026-07-10: a POBRE ganha a mesma persistência de 1s da Rica.
        // Freio motor em giro alto (pé FORA, tps 0, giro 4500): o gate de carga da pobre
        // passa só pelo giro e a sonda LÊ pobre de verdade — sem persistência, UMA amostra
        // virava alerta crítico falso na tela do piloto.
        var ac = new AlertasCriticos();
        var pobreFreioMotor = new AmostraAlerta { Lambda = 1.3, Rpm = 4500, TpsPct = 0 };
        var normal          = new AmostraAlerta { Lambda = 0.9, Rpm = 4500, TpsPct = 60 };

        ac.IngestT4000(pobreFreioMotor, 10.0);   // 1 amostra de freio motor…
        Assert.Null(ac.GetMensagemPrincipal());  // …não grita mais
        ac.IngestT4000(normal, 10.3);            // pé voltou, mistura ok → cronômetro zera
        Assert.Null(ac.GetMensagemPrincipal());

        // Mistura pobre REAL (persiste sob carga): continua alertando depois de 1s contínuo.
        var pobreReal = new AmostraAlerta { Lambda = 1.3, Rpm = 4500, TpsPct = 60 };
        ac.IngestT4000(pobreReal, 20.0);
        Assert.Null(ac.GetMensagemPrincipal());
        ac.IngestT4000(pobreReal, 20.5);
        Assert.Null(ac.GetMensagemPrincipal());
        ac.IngestT4000(pobreReal, 21.0);         // 1s contínuo → avisa
        Assert.Equal("MISTURA_POBRE", ac.GetMensagemPrincipal()!.Id);
    }

    // ── Fase 2 — "Temperatura Motor Subindo" por IA de padrão histórico (Flávio 05/07) ───────

    // Aprendizado com confiança cheia em 1 amostra (τ maduro imediato) e máx normal semente 60 →
    // limite de "subindo" em 63 — determinístico pros testes de integração.
    private static AlertasCriticos ComIaMotor(double refC = 60) =>
        new(limits: null, aprendizado: AprendizadoLimites.Default with
        {
            Motor = AprendizadoLimites.Default.Motor with { AmostrasConfianca = 1, ReferenciaMaximaNormalC = refC }
        });

    [Fact]
    public void ALR_16_Temperatura_subindo_dispara_por_padrao_com_persistencia()
    {
        var ac = ComIaMotor();
        var s = new AmostraAlerta { WaterTempC = 66, Rpm = 4000 }; // acima do padrão (63), abaixo do quente (70)
        ac.IngestT4000(s, 0.0);
        ac.IngestT4000(s, 1.0);
        ac.IngestT4000(s, 2.0);
        Assert.Null(ac.GetMensagemPrincipal());               // 2s: ainda não (persistência)
        ac.IngestT4000(s, 3.0);
        var m = ac.GetMensagemPrincipal();
        Assert.Equal("MOTOR_AQUECENDO", m!.Id);
        Assert.Equal("Temperatura Motor Subindo", m.Texto);   // texto da Fase 1
    }

    [Fact]
    public void ALR_17_Aquecendo_NAO_aparece_junto_do_quente()
    {
        var ac = ComIaMotor();
        var s = new AmostraAlerta { WaterTempC = 72, Rpm = 4000 }; // ≥70 → Motor Quente (trava dura)
        for (var t = 0.0; t <= 4.0; t += 1.0) ac.IngestT4000(s, t);
        Assert.Equal("MOTOR_QUENTE", ac.GetMensagemPrincipal()!.Id);
        Assert.DoesNotContain("MOTOR_AQUECENDO", ac.GetAtivos()); // a trava dura vence
    }

    [Fact]
    public void ALR_18_Aquecendo_SOME_quando_normaliza_nunca_trava()
    {
        var ac = ComIaMotor();
        var sobe = new AmostraAlerta { WaterTempC = 66, Rpm = 4000 };
        for (var t = 0.0; t <= 3.0; t += 1.0) ac.IngestT4000(sobe, t);
        Assert.Equal("MOTOR_AQUECENDO", ac.GetMensagemPrincipal()!.Id);

        ac.IngestT4000(new AmostraAlerta { WaterTempC = 60, Rpm = 4000 }, 4.0); // normalizou
        Assert.Null(ac.GetMensagemPrincipal()); // o aviso saiu sozinho — não travou pra sessão
    }

    [Fact]
    public void ALR_19_Sem_relogio_nao_ha_Fase_2()
    {
        var ac = ComIaMotor();
        var s = new AmostraAlerta { WaterTempC = 66, Rpm = 4000 };
        for (var i = 0; i < 10; i++) ac.IngestT4000(s); // sem tSeg → sem aprendizado/aviso
        Assert.Null(ac.GetMensagemPrincipal());
    }

    [Fact]
    public void ALR_20_Pneu_e_cambio_SEM_sensor_nunca_disparam_aquecendo()
    {
        var ac = new AlertasCriticos(); // defaults
        var semSensor = new AmostraAlerta { WaterTempC = 60, Rpm = 4000, TireTempC = null, CambioTempC = null };
        for (var t = 0.0; t <= 6.0; t += 1.0) ac.IngestT4000(semSensor, t);
        Assert.DoesNotContain("PNEU_AQUECENDO", ac.GetAtivos());
        Assert.DoesNotContain("CAMBIO_AQUECENDO", ac.GetAtivos());
    }

    [Fact]
    public void ALR_21_Pneu_COM_sensor_dispara_aquecendo_prova_que_esta_fiado()
    {
        // Prova que a arquitetura genérica funciona: no dia em que o sensor de pneu existir,
        // o mesmo modelo já avisa. Padrão do pneu 90 (delta 5 → limite 95).
        var ac = new AlertasCriticos(limits: null, aprendizado: AprendizadoLimites.Default with
        {
            Pneu = AprendizadoLimites.Default.Pneu with { AmostrasConfianca = 1, ReferenciaMaximaNormalC = 90 }
        });
        ac.IngestT4000(new AmostraAlerta { WaterTempC = 60, Rpm = 4000, TireTempC = 90 }, 0.0); // firma o padrão
        for (var t = 1.0; t <= 4.0; t += 1.0)
            ac.IngestT4000(new AmostraAlerta { WaterTempC = 60, Rpm = 4000, TireTempC = 98 }, t); // acima e persistente
        Assert.Contains("PNEU_AQUECENDO", ac.GetAtivos());
    }

    [Fact]
    public void ALR_22_Historia_gravada_exportar_e_importar_o_padrao()
    {
        var apr = AprendizadoLimites.Default with
        {
            Motor = AprendizadoLimites.Default.Motor with { AmostrasConfianca = 1, ReferenciaMaximaNormalC = 60 }
        };
        var ac = new AlertasCriticos(limits: null, aprendizado: apr);
        ac.IngestT4000(new AmostraAlerta { WaterTempC = 66, Rpm = 4000 }, 0.0);
        ac.IngestT4000(new AmostraAlerta { WaterTempC = 66, Rpm = 4000 }, 5.0);
        var maxAntes = ac.MotorMaximaNormalC;
        Assert.True(maxAntes > 60, "deveria ter aprendido pra cima");

        var snap = ac.ExportarAprendizado();
        var ac2 = new AlertasCriticos(limits: null, aprendizado: apr);
        ac2.ImportarAprendizado(snap);
        Assert.Equal(maxAntes, ac2.MotorMaximaNormalC, 6);
    }
}
