// DeltaCalculator: paridade com web/cockpit/delta-calculator.js — integração
// dt = ds/v_atual - ds/v_ref por par de amostras, atribuição por sub-trecho
// (entrada/freio/apice/pace/saida), pior sub-trecho e helper pontoCanonico.

using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class DeltaCalculatorTests
{
    // Passagem reta (lat constante, lng crescente) — ~10,75 m entre pontos consecutivos,
    // velocidade bem acima do piso de 0,5 m/s. Todos os pontos no mesmo sub-trecho,
    // fração distribuída 0..1.
    private static PassagemTrecho Passagem(string sub, double kmh, int n = 3, string segId = "T1")
    {
        var pts = new List<DeltaPonto>(n);
        for (int i = 0; i < n; i++)
        {
            double frac = n == 1 ? 0 : (double)i / (n - 1);
            pts.Add(new DeltaPonto(-15.0, -47.0 + i * 0.0001, kmh, 1000L * i, frac, sub));
        }
        return new PassagemTrecho(segId, pts);
    }

    [Fact]
    public void Passagem_identica_a_referencia_da_delta_zero()
    {
        var r = DeltaCalculator.CalcularDelta(Passagem("freio", 100), Passagem("freio", 100));

        Assert.Equal(0, r.DeltaTotalS, 9);
        Assert.Equal(2, r.PorSubTrecho["freio"].Amostras);
        Assert.Equal(0, r.PorSubTrecho["freio"].DeltaS, 9);
        // todos zerados → o laço do pior pega o primeiro (entrada), igual ao JS.
        Assert.Equal("entrada", r.PiorSubTrecho);
    }

    [Fact]
    public void Mais_lento_que_a_referencia_perde_tempo_positivo()
    {
        var r = DeltaCalculator.CalcularDelta(Passagem("freio", 100), Passagem("freio", 110));

        Assert.True(r.DeltaTotalS > 0, "atual mais lento deve perder tempo (delta positivo)");
        Assert.Equal("freio", r.PiorSubTrecho);
        Assert.Equal(2, r.PorSubTrecho["freio"].Amostras);
        Assert.Equal(0, r.PorSubTrecho["entrada"].Amostras);
        Assert.Equal(r.DeltaTotalS, r.PorSubTrecho["freio"].DeltaS, 9);
    }

    [Fact]
    public void Mais_rapido_que_a_referencia_ganha_tempo_negativo()
    {
        var r = DeltaCalculator.CalcularDelta(Passagem("freio", 120), Passagem("freio", 100));

        Assert.True(r.DeltaTotalS < 0, "atual mais rápido deve ganhar tempo (delta negativo)");
        // pior = mais positivo; com tudo negativo, vence o 'entrada' zerado (primeiro).
        Assert.Equal("entrada", r.PiorSubTrecho);
        Assert.Equal(0, r.PiorDeltaS, 9);
    }

    [Fact]
    public void Pace_e_um_sub_trecho_valido_e_pode_ser_o_pior()
    {
        // 5º marco (Flávio 13/06): a aceleração pós-Vmin tem que entrar no balde 'pace'.
        var r = DeltaCalculator.CalcularDelta(Passagem("pace", 90), Passagem("pace", 110));

        Assert.Equal("pace", r.PiorSubTrecho);
        Assert.True(r.PorSubTrecho["pace"].DeltaS > 0);
        Assert.Equal(2, r.PorSubTrecho["pace"].Amostras);
    }

    [Fact]
    public void Trocar_atual_e_referencia_inverte_o_sinal()
    {
        var a = DeltaCalculator.CalcularDelta(Passagem("freio", 100), Passagem("freio", 110));
        var b = DeltaCalculator.CalcularDelta(Passagem("freio", 110), Passagem("freio", 100));

        // mesma geometria, só kmh trocado → dt vira -dt par a par.
        Assert.Equal(a.DeltaTotalS, -b.DeltaTotalS, 9);
    }

    [Fact]
    public void Amostras_quase_coincidentes_sao_descartadas()
    {
        // dois pontos na MESMA posição → ds < 0,05 m → o par é ignorado.
        var pts = new List<DeltaPonto>
        {
            new(-15.0, -47.0, 100, 0, 0.0, "freio"),
            new(-15.0, -47.0, 100, 1000, 1.0, "freio"),
        };
        var atual = new PassagemTrecho("T1", pts);

        var r = DeltaCalculator.CalcularDelta(atual, Passagem("freio", 100));

        Assert.Equal(0, r.PorSubTrecho["freio"].Amostras);
        Assert.Equal(0, r.DeltaTotalS, 9);
    }

    [Fact]
    public void Velocidade_parada_ou_invalida_e_descartada()
    {
        // kmh = 0 → vAtual < 0,5 m/s → par descartado (carro parado).
        var rParado = DeltaCalculator.CalcularDelta(Passagem("freio", 0), Passagem("freio", 100));
        Assert.Equal(0, rParado.PorSubTrecho["freio"].Amostras);

        // kmh = NaN → guarda IsFinite descarta sem envenenar o trecho.
        var rNaN = DeltaCalculator.CalcularDelta(Passagem("freio", double.NaN), Passagem("freio", 100));
        Assert.Equal(0, rNaN.PorSubTrecho["freio"].Amostras);
    }

    [Fact]
    public void Referencia_lenta_e_descartada_sem_contaminar()
    {
        // vRef < 0,5 → par ignorado (sem dividir por ~0).
        var r = DeltaCalculator.CalcularDelta(Passagem("freio", 100), Passagem("freio", 0));
        Assert.Equal(0, r.PorSubTrecho["freio"].Amostras);
        Assert.Equal(0, r.DeltaTotalS, 9);
    }

    [Fact]
    public void Menos_de_dois_pontos_lanca()
    {
        var umPonto = new PassagemTrecho("T1", new List<DeltaPonto>
        {
            new(-15.0, -47.0, 100, 0, 0.0, "freio"),
        });

        Assert.Throws<ArgumentException>(() =>
            DeltaCalculator.CalcularDelta(umPonto, Passagem("freio", 100)));
        Assert.Throws<ArgumentException>(() =>
            DeltaCalculator.CalcularDelta(Passagem("freio", 100), umPonto));
    }

    [Fact]
    public void Pontos_nulos_lanca()
    {
        var semPontos = new PassagemTrecho("T1", null!);
        Assert.Throws<ArgumentException>(() =>
            DeltaCalculator.CalcularDelta(semPontos, Passagem("freio", 100)));
    }

    [Fact]
    public void Sub_desconhecido_nao_quebra_nem_acumula()
    {
        // sub fora do conjunto canônico é simplesmente ignorado (igual ao JS: porSub[sub] undefined).
        var r = DeltaCalculator.CalcularDelta(Passagem("xpto", 100), Passagem("xpto", 110));
        foreach (var k in DeltaCalculator.SubTrechos)
            Assert.Equal(0, r.PorSubTrecho[k].Amostras);
        Assert.Equal(0, r.DeltaTotalS, 9);
    }

    [Fact]
    public void Calculo_e_deterministico()
    {
        var a = DeltaCalculator.CalcularDelta(Passagem("freio", 100), Passagem("freio", 110));
        var b = DeltaCalculator.CalcularDelta(Passagem("freio", 100), Passagem("freio", 110));
        Assert.Equal(a.DeltaTotalS, b.DeltaTotalS, 12);
        Assert.Equal(a.PiorSubTrecho, b.PiorSubTrecho);
    }

    [Theory]
    [InlineData(50, 100, 0.5)]   // metade do trecho
    [InlineData(150, 100, 1.0)]  // passou do fim → satura em 1
    [InlineData(-10, 100, 0.0)]  // negativo → satura em 0
    [InlineData(5, 0, 1.0)]      // dsTotal 0 → denominador vira max(1,0)=1 → 5/1 satura em 1
    public void PontoCanonico_satura_a_fracao_em_0_1(double dsAcum, double dsTotal, double esperado)
    {
        var p = DeltaCalculator.PontoCanonico(-15.0, -47.0, 88, 1234, "apice", dsAcum, dsTotal);
        Assert.Equal(esperado, p.Fracao, 9);
        Assert.Equal("apice", p.Sub);
        Assert.Equal(88.0, p.Kmh);
    }
}
