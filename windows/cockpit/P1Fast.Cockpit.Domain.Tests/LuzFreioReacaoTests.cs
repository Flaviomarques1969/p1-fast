// Reação do freio (gap 3, port de trail-cockpit-motor.js): o zero da luz é adiantado
// pelo tempo de reação aprendido por trecho (EMA, clamp 0.10-0.60s, α=0.25, descarta >1.2s).

using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class LuzFreioReacaoTests
{
    private static LuzFreio NovaLuz()
    {
        var seg = new TrechoSegmento("s0", "S0",
            new LinhaGps(new PontoGps(0, 0), new PontoGps(0.001, 0)),
            new PontoGps(0, 0.0005),
            new LinhaGps(new PontoGps(0, 0.001), new PontoGps(0.001, 0.001)));
        return new LuzFreio(new[] { seg });
    }

    [Fact]
    public void REAC_01_Default_ate_aprender()
    {
        var luz = NovaLuz();
        Assert.Equal(LuzFreio.ReacaoDefaultS, luz.ReacaoS("s0"));   // 0.25 s
        Assert.Equal(LuzFreio.ReacaoDefaultS, luz.ReacaoS("nao-existe"));
    }

    [Fact]
    public void REAC_02_Primeira_amostra_e_EMA_depois()
    {
        var luz = NovaLuz();

        var a = luz.RegistrarAmostraReacao("s0", 0.40);
        Assert.NotNull(a);
        Assert.Equal(0.40, luz.ReacaoS("s0"), 3);
        Assert.Equal(1, a!.Value.N);

        // EMA: 0.40 + 0.25*(0.20 - 0.40) = 0.35
        var b = luz.RegistrarAmostraReacao("s0", 0.20);
        Assert.NotNull(b);
        Assert.Equal(0.35, luz.ReacaoS("s0"), 3);
        Assert.Equal(2, b!.Value.N);
    }

    [Fact]
    public void REAC_03_Clampa_amostra_entre_min_e_max()
    {
        var luz = NovaLuz();
        luz.RegistrarAmostraReacao("s0", 0.02);                     // < min
        Assert.Equal(LuzFreio.ReacaoMinS, luz.ReacaoS("s0"), 3);    // 0.10

        var luz2 = NovaLuz();
        luz2.RegistrarAmostraReacao("s0", 0.90);                    // > max mas <= AmostraMax(1.2)
        Assert.Equal(LuzFreio.ReacaoMaxS, luz2.ReacaoS("s0"), 3);   // 0.60
    }

    [Fact]
    public void REAC_04_Descarta_amostra_invalida_ou_grande_demais()
    {
        var luz = NovaLuz();
        Assert.Null(luz.RegistrarAmostraReacao("s0", 0));      // <= 0
        Assert.Null(luz.RegistrarAmostraReacao("s0", -1));     // negativa
        Assert.Null(luz.RegistrarAmostraReacao("s0", 2.0));    // > 1.2 (não foi reação)
        Assert.Equal(LuzFreio.ReacaoDefaultS, luz.ReacaoS("s0")); // nada mudou
    }
}
