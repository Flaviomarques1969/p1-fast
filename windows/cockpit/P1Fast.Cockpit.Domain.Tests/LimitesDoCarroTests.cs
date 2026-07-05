// Etapa 3 da tela Garagem — LimitesDoCarro converte o JSON `configuracoes.overrides` do carro
// (salvo pelo app, chaves alerta_*) nos limites que o cérebro usa. Chave ausente = default do
// sistema. Best-effort: JSON ausente/inválido nunca derruba a tela.

using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class LimitesDoCarroTests
{
    [Fact]
    public void LDC_01_Sem_overrides_usa_tudo_default()
    {
        foreach (var json in new string?[] { null, "", "   ", "{}" })
        {
            var (al, ap) = LimitesDoCarro.De(json);
            Assert.Equal(AlertaLimites.Default.WaterMaxC, al.WaterMaxC, 6);
            Assert.Equal(AlertaLimites.Default.BatteryMinV, al.BatteryMinV, 6);
            Assert.Equal(AprendizadoLimites.Default.Motor.ReferenciaMaximaNormalC, ap.Motor.ReferenciaMaximaNormalC, 6);
            Assert.Equal(AprendizadoLimites.Default.PneuRadial185AtencaoC, ap.PneuRadial185AtencaoC, 6);
        }
    }

    [Fact]
    public void LDC_02_Um_campo_aplica_so_ele_o_resto_fica_default()
    {
        var (al, ap) = LimitesDoCarro.De("{\"alerta_motor_quente_c\": 68}");
        Assert.Equal(68, al.WaterMaxC, 6);                                   // aplicou
        Assert.Equal(AlertaLimites.Default.LambdaPobre, al.LambdaPobre, 6);  // resto default
        Assert.Equal(AlertaLimites.Default.BatteryMinV, al.BatteryMinV, 6);
        Assert.Equal(AprendizadoLimites.Default.Motor.ReferenciaMaximaNormalC, ap.Motor.ReferenciaMaximaNormalC, 6);
    }

    [Fact]
    public void LDC_03_Motor_referencia_e_delta_vao_pro_aprendizado_do_motor()
    {
        var (_, ap) = LimitesDoCarro.De("{\"alerta_motor_referencia_c\": 58, \"alerta_motor_delta_c\": 4}");
        Assert.Equal(58, ap.Motor.ReferenciaMaximaNormalC, 6);
        Assert.Equal(4, ap.Motor.DeltaSubindoC, 6);
        // o limite de disparo passa a ser 58 + 4 = 62 num carro sem histórico
        var aprendiz = new AprendizadoTemperatura(ap.Motor);
        Assert.Equal(62, aprendiz.LimiteSubindoC, 6);
    }

    [Fact]
    public void LDC_04_Mistura_e_bateria_aplicadas()
    {
        var (al, _) = LimitesDoCarro.De("{\"alerta_lambda_pobre\": 1.05, \"alerta_lambda_rica\": 0.80, \"alerta_bateria_min_v\": 12.2}");
        Assert.Equal(1.05, al.LambdaPobre, 6);
        Assert.Equal(0.80, al.LambdaRica, 6);
        Assert.Equal(12.2, al.BatteryMinV, 6);
    }

    [Fact]
    public void LDC_05_Pneu_dois_niveis_por_tipo_aplicados()
    {
        var (_, ap) = LimitesDoCarro.De(
            "{\"alerta_pneu_radial_atencao_c\": 92, \"alerta_pneu_radial_critico_c\": 102," +
            " \"alerta_pneu_slick_atencao_c\": 108, \"alerta_pneu_slick_critico_c\": 118}");
        Assert.Equal(92, ap.PneuRadial185AtencaoC, 6);
        Assert.Equal(102, ap.PneuRadial185CriticoC, 6);
        Assert.Equal(108, ap.PneuSemiSlick195AtencaoC, 6);
        Assert.Equal(118, ap.PneuSemiSlick195CriticoC, 6);
    }

    [Fact]
    public void LDC_06_Carro_antigo_so_com_setup_nao_muda_os_limites()
    {
        // JSON de um carro já cadastrado (só setup, sem nenhum alerta_*): tudo default.
        var (al, ap) = LimitesDoCarro.De("{\"pressao_de\": 20, \"combustivel\": \"Etanol\", \"mola_dianteira\": 350}");
        Assert.Equal(AlertaLimites.Default.WaterMaxC, al.WaterMaxC, 6);
        Assert.Equal(AprendizadoLimites.Default.PneuSemiSlick195CriticoC, ap.PneuSemiSlick195CriticoC, 6);
    }

    [Fact]
    public void LDC_07_JSON_invalido_nao_quebra_cai_no_default()
    {
        foreach (var lixo in new[] { "{lixo", "[1,2,3]", "\"texto\"", "42" })
        {
            var (al, ap) = LimitesDoCarro.De(lixo);
            Assert.Equal(AlertaLimites.Default.WaterMaxC, al.WaterMaxC, 6);
            Assert.Equal(AprendizadoLimites.Default.Motor.DeltaSubindoC, ap.Motor.DeltaSubindoC, 6);
        }
    }

    [Fact]
    public void LDC_08_Pacote_completo_do_carro_todos_aplicados()
    {
        var json = "{" +
            "\"alerta_motor_quente_c\": 72, \"alerta_motor_referencia_c\": 60, \"alerta_motor_delta_c\": 3," +
            "\"alerta_lambda_pobre\": 1.0, \"alerta_lambda_rica\": 0.74, \"alerta_bateria_min_v\": 12.5," +
            "\"alerta_pneu_radial_atencao_c\": 95, \"alerta_pneu_radial_critico_c\": 105," +
            "\"alerta_pneu_slick_atencao_c\": 105, \"alerta_pneu_slick_critico_c\": 115," +
            "\"pressao_de\": 20}";   // setup junto, ignorado pelos limites
        var (al, ap) = LimitesDoCarro.De(json);
        Assert.Equal(72, al.WaterMaxC, 6);
        Assert.Equal(60, ap.Motor.ReferenciaMaximaNormalC, 6);
        Assert.Equal(95, ap.PneuRadial185AtencaoC, 6);
        Assert.Equal(115, ap.PneuSemiSlick195CriticoC, 6);
    }
}
