// TelaTermica — cérebro das telas dedicadas de AQUECIMENTO e RESFRIAMENTO (aprovado por
// Flávio 2026-07-06). Trava o gatilho "as duas juntas" (volta + fase térmica), o progresso
// SEMPRE CRESCENTE rumo ao ideal (0 vermelho → 1 verde), e a regra §9 (motor mudo → Off).

using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class TelaTermicaTests
{
    // Stint de exemplo: 11 voltas, índices 0..10 (0 = 1ª/aquecimento, 10 = última/cool-down).
    private const int Ultima = 10;

    [Fact]
    public void TT_01_Motor_mudo_nunca_entra()
    {
        Assert.Equal(ModoTelaTermica.Off, TelaTermica.Avaliar(null, 0, Ultima).Modo);
        Assert.Equal(ModoTelaTermica.Off, TelaTermica.Avaliar(double.NaN, 0, Ultima).Modo);
    }

    [Theory]
    // 1ª volta E frio → AQUECIMENTO
    [InlineData(40.0, 0, ModoTelaTermica.Aquecimento)]
    [InlineData(48.0, 0, ModoTelaTermica.Aquecimento)]
    [InlineData(54.0, 0, ModoTelaTermica.Aquecimento)]  // dentro do ideal, ainda na 1ª volta → mostra o verde
    // 1ª volta mas já passou do teto do ideal → sai (volta à corrida)
    [InlineData(56.0, 0, ModoTelaTermica.Off)]
    // volta do meio → nunca é tela dedicada, mesmo frio
    [InlineData(40.0, 3, ModoTelaTermica.Off)]
    // última volta E quente → RESFRIAMENTO
    [InlineData(78.0, Ultima, ModoTelaTermica.Resfriamento)]
    [InlineData(60.0, Ultima, ModoTelaTermica.Resfriamento)]
    [InlineData(51.0, Ultima, ModoTelaTermica.Resfriamento)]  // dentro do ideal, última volta → mostra o verde
    // última volta mas já abaixo do piso do ideal → sai
    [InlineData(49.0, Ultima, ModoTelaTermica.Off)]
    // última volta e FRIO (raro) → não é resfriamento
    [InlineData(40.0, Ultima, ModoTelaTermica.Off)]
    public void TT_02_Gatilho_as_duas_juntas(double agua, int voltaIdx, ModoTelaTermica esperado)
        => Assert.Equal(esperado, TelaTermica.Avaliar(agua, voltaIdx, Ultima).Modo);

    [Theory]
    // progresso rumo ao ideal (janela 50–55; frio total 40, quente total 78)
    [InlineData(40.0, 0.0)]     // frio total = 0 (vermelho)
    [InlineData(45.0, 0.5)]     // meio do caminho subindo
    [InlineData(50.0, 1.0)]     // piso do ideal = cheio (verde)
    [InlineData(52.5, 1.0)]     // dentro do ideal
    [InlineData(55.0, 1.0)]     // teto do ideal
    [InlineData(78.0, 0.0)]     // quente total = 0 (vermelho)
    public void TT_03_Progresso_sempre_crescente_rumo_ao_ideal(double agua, double esperado)
    {
        var g = TelaTermica.Progresso(agua, CortesChuvaTermica.Bubi,
            TelaTermica.FrioTotalBubiC, TelaTermica.QuenteTotalBubiC);
        Assert.Equal(esperado, g, 3);
    }

    [Fact]
    public void TT_04_Progresso_do_resfriamento_cresce_conforme_esfria()
    {
        // esfriando 78 → 66 → 55: o progresso SOBE (nunca anda pra trás).
        var g78 = TelaTermica.Progresso(78, CortesChuvaTermica.Bubi, 40, 78);
        var g66 = TelaTermica.Progresso(66, CortesChuvaTermica.Bubi, 40, 78);
        var g55 = TelaTermica.Progresso(55, CortesChuvaTermica.Bubi, 40, 78);
        Assert.True(g78 < g66 && g66 < g55, $"esperado crescente: {g78} < {g66} < {g55}");
        Assert.Equal(1.0, g55, 3);
    }

    [Fact]
    public void TT_05_Sem_stint_nenhuma_volta_nao_entra()
    {
        // ultimaVoltaIdx = -1 (sem plano) → resfriamento nunca dispara; aquecimento só na idx 0.
        Assert.Equal(ModoTelaTermica.Off, TelaTermica.Avaliar(70, 5, -1).Modo);
        Assert.Equal(ModoTelaTermica.Aquecimento, TelaTermica.Avaliar(42, 0, -1).Modo);
    }

    [Fact]
    public void TT_06_TempC_ecoa_a_agua_crua()
        => Assert.Equal(47.3, TelaTermica.Avaliar(47.3, 0, Ultima).TempC);
}
