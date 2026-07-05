// Fase 2 — aprendiz contínuo de temperatura (AprendizadoTemperatura). Cobre os 4 princípios
// da spec (Flávio 05/07): aprendizado contínuo, história gravada, padrão de referência,
// ajuste de ambiente; e as garantias duras: persistência antes de disparar, sensor ausente /
// motor parado não mexem, não aprende superaquecimento como normal, nunca trava.

using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class AprendizadoTemperaturaTests
{
    // Config determinística pros testes de disparo: confiança plena com 1 amostra (τ maduro
    // imediato), referência 60, delta +3 (limite 63), teto 70, persistência 3s.
    private static AprendizadoConfig Cfg(double refC = 60) =>
        new(ReferenciaMaximaNormalC: refC, AmostrasConfianca: 1, TetoAprendidoC: 70);

    [Fact]
    public void ATP_01_Semente_de_referencia_antes_de_historico()
    {
        var a = new AprendizadoTemperatura(); // MotorBubi: ref 62, delta 3
        Assert.Equal(62, a.MaximaNormalC, 3);
        Assert.Equal(65, a.LimiteSubindoC, 3);   // 62 + 3
        Assert.Equal(0, a.Confianca, 3);
    }

    [Fact]
    public void ATP_02_Uma_amostra_acima_NAO_dispara_precisa_persistir()
    {
        var a = new AprendizadoTemperatura(Cfg());
        var r = a.Avaliar(66, motorRodando: true, t: 0.0); // acima do limite 63, mas 1 amostra só
        Assert.False(r.Subindo);
    }

    [Fact]
    public void ATP_03_Dispara_so_depois_da_persistencia()
    {
        var a = new AprendizadoTemperatura(Cfg());
        a.Avaliar(66, true, 0.0);
        a.Avaliar(66, true, 1.0);
        Assert.False(a.Avaliar(66, true, 2.0).Subindo); // 2s acima: ainda não
        Assert.True(a.Avaliar(66, true, 3.0).Subindo);  // 3s contínuos: dispara
    }

    [Fact]
    public void ATP_04_Sensor_ausente_nao_dispara_e_preserva_a_maxima_normal()
    {
        var a = new AprendizadoTemperatura(Cfg(62));
        a.Avaliar(58, true, 0.0);              // aprende um pouco
        a.Avaliar(58, true, 30.0);
        var maxAntes = a.MaximaNormalC;
        var r = a.Avaliar(null, true, 60.0);   // sensor ausente
        Assert.False(r.Subindo);
        Assert.Equal(maxAntes, a.MaximaNormalC, 6); // preservou a história
    }

    [Fact]
    public void ATP_05_Motor_parado_nao_aprende_nem_dispara()
    {
        var a = new AprendizadoTemperatura(Cfg());
        for (var t = 0.0; t <= 5.0; t += 1.0)
            Assert.False(a.Avaliar(90, motorRodando: false, t).Subindo); // bem acima, mas parado
        Assert.Equal(60, a.MaximaNormalC, 6); // não aprendeu nada
    }

    [Fact]
    public void ATP_06_Aprende_pra_BAIXO_carro_que_roda_frio_desce_o_limite()
    {
        var a = new AprendizadoTemperatura(Cfg(62)); // começa em 62 -> limite 65
        for (var i = 1; i <= 300; i++) a.Avaliar(55, true, i * 1.0); // carro rodando frio, amostra a amostra
        Assert.True(a.LimiteSubindoC < 61.5, $"limite deveria ter descido, veio {a.LimiteSubindoC:0.0}");
    }

    [Fact]
    public void ATP_07_Dia_quente_ADAPTA_sem_alarme_falso_sustentado()
    {
        // Sessão de dia quente: normal real ~66, acima da semente 62. O aprendizado imaturo
        // "trava" rápido no normal do dia e NÃO deixa o aviso ficar ligado.
        var a = new AprendizadoTemperatura(); // MotorBubi (ref 62), aprendizado maduro lento
        var algumSubiu = false;
        for (var i = 0; i < 200; i++)
        {
            var r = a.Avaliar(66, true, i * 0.5);
            if (r.Subindo) algumSubiu = true;
        }
        Assert.False(algumSubiu, "não pode alarmar falso no normal do dia");
        Assert.True(a.MaximaNormalC > 64, $"deveria ter aprendido o dia quente, veio {a.MaximaNormalC:0.0}");
    }

    [Fact]
    public void ATP_08_Nao_aprende_superaquecimento_real_como_normal()
    {
        var a = new AprendizadoTemperatura(Cfg(60)); // teto 70
        a.Avaliar(75, true, 0.0);   // acima do teto de segurança
        a.Avaliar(75, true, 30.0);
        a.Avaliar(75, true, 60.0);
        Assert.Equal(60, a.MaximaNormalC, 6); // continua na referência: não virou "normal"
    }

    [Fact]
    public void ATP_09_Exportar_e_importar_mantem_a_historia()
    {
        var a = new AprendizadoTemperatura(Cfg(62));
        a.Avaliar(58, true, 0.0);
        a.Avaliar(58, true, 300.0);
        var estado = a.ExportarEstado();

        var b = new AprendizadoTemperatura(Cfg(62)); // outro, do zero
        b.ImportarEstado(estado);
        Assert.Equal(a.MaximaNormalC, b.MaximaNormalC, 6);
    }

    [Fact]
    public void ATP_10_Reset_volta_pra_referencia()
    {
        var a = new AprendizadoTemperatura(Cfg(62));
        a.Avaliar(55, true, 0.0);
        a.Avaliar(55, true, 300.0);
        a.Reset();
        Assert.Equal(62, a.MaximaNormalC, 6);
    }

    [Fact]
    public void ATP_11_Plato_normal_abaixo_do_limite_nunca_dispara()
    {
        var a = new AprendizadoTemperatura(); // MotorBubi: limite ~65
        for (var i = 0; i < 100; i++)
            Assert.False(a.Avaliar(60, true, i * 1.0).Subindo); // 60 < 65 sempre
    }

    [Fact]
    public void ATP_12_Ajuste_de_ambiente_desloca_o_limite()
    {
        var frio  = new AprendizadoTemperatura(new AprendizadoConfig(62, AmbienteOffsetC: 0));
        var quente = new AprendizadoTemperatura(new AprendizadoConfig(62, AmbienteOffsetC: 4));
        Assert.Equal(65, frio.LimiteSubindoC, 3);
        Assert.Equal(69, quente.LimiteSubindoC, 3); // +4°C de ambiente sobe o limite
    }

    // --- Item 3 (Flávio 05/07): água ANTES de ligar o motor = referência do ambiente do dia ---
    private static AprendizadoConfig CfgAmb(double refC = 62) =>
        new(ReferenciaMaximaNormalC: refC, AmbienteUsarAguaPreIgnicao: true,
            AmbienteBaseC: 30, AmbienteFator: 0.5, AmbienteOffsetMaxC: 6,
            AmbienteTetoFrioC: 45, TetoAprendidoC: 70, MargemAbaixoTetoC: 2);

    [Fact]
    public void ATP_13_Agua_fria_antes_de_ligar_baixa_o_limite_avisa_mais_cedo()
    {
        var a = new AprendizadoTemperatura(CfgAmb());
        a.Avaliar(20, motorRodando: false, 0.0);  // dia frio: água parada 20°C, motor desligado
        a.Avaliar(20, motorRodando: false, 1.0);
        a.Avaliar(50, motorRodando: true, 2.0);   // liga o motor -> congela o ambiente do dia
        Assert.Equal(-5, a.AmbienteOffsetDinamicoC, 3);                 // (20-30)*0.5
        Assert.True(a.LimiteSubindoC < 61, $"limite {a.LimiteSubindoC:0.0} deveria cair em dia frio");
    }

    [Fact]
    public void ATP_14_Dia_quente_sobe_o_limite_mas_NUNCA_alcanca_o_Motor_Quente()
    {
        var a = new AprendizadoTemperatura(CfgAmb());
        a.Avaliar(40, motorRodando: false, 0.0);  // dia quente: água parada 40°C (< teto frio 45)
        a.Avaliar(45, motorRodando: true, 1.0);   // liga
        Assert.Equal(5, a.AmbienteOffsetDinamicoC, 3);                  // (40-30)*0.5
        Assert.True(a.LimiteSubindoC <= 68.001, $"aviso nao pode subir ate o Motor Quente (70); veio {a.LimiteSubindoC:0.0}");
        Assert.True(a.LimiteSubindoC >= 66, $"mas subiu com o dia quente; veio {a.LimiteSubindoC:0.0}");
    }

    [Fact]
    public void ATP_15_Religada_com_agua_morna_NAO_vira_ambiente()
    {
        var a = new AprendizadoTemperatura(CfgAmb());
        a.Avaliar(50, motorRodando: false, 0.0);  // religada: água ainda morna 50°C (> teto frio 45)
        a.Avaliar(55, motorRodando: true, 1.0);   // liga
        Assert.Equal(0, a.AmbienteOffsetDinamicoC, 3); // ignora água morna -> sem offset de ambiente
    }

    [Fact]
    public void ATP_16_Offset_de_ambiente_CONGELA_na_1a_ignicao()
    {
        var a = new AprendizadoTemperatura(CfgAmb());
        a.Avaliar(20, motorRodando: false, 0.0);  // frio
        a.Avaliar(60, motorRodando: true, 1.0);   // liga -> offset -5 congela
        var off1 = a.AmbienteOffsetDinamicoC;
        a.Avaliar(66, motorRodando: true, 2.0);   // roda quente: NÃO pode virar o ambiente
        a.Avaliar(68, motorRodando: true, 3.0);
        Assert.Equal(-5, off1, 3);
        Assert.Equal(off1, a.AmbienteOffsetDinamicoC, 6);
    }

    [Fact]
    public void ATP_17_Reset_zera_o_ambiente_do_dia()
    {
        var a = new AprendizadoTemperatura(CfgAmb());
        a.Avaliar(20, motorRodando: false, 0.0);
        a.Avaliar(50, motorRodando: true, 1.0);
        Assert.Equal(-5, a.AmbienteOffsetDinamicoC, 3);
        a.Reset();
        Assert.Equal(0, a.AmbienteOffsetDinamicoC, 3);  // recomeça a medir o ambiente na nova sessão
    }
}
