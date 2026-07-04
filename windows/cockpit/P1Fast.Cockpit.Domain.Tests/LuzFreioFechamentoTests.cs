// LuzFreio.FecharTrecho — L1 (auditoria 2026-07-02): o onset da freada é gravado pela
// curva MAIS PRÓXIMA na aproximação; em pares de ápices vizinhos (<220 m, existem em
// Brasília) a chave pode divergir do segId do detector no fechamento. Prova: (a) chave
// exata funciona e é CONSUMIDA; (b) chave divergente adota o onset do vizinho; (c) sem
// nova aproximação, fechar de novo devolve null (não reaproveita freada velha).

using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class LuzFreioFechamentoTests
{
    // Dois trechos com ápices ~167 m um do outro (0.0015° de longitude no equador) —
    // o par "colado" (<220 m) que dispara a divergência de chave.
    private static (LuzFreio Luz, TrechoSegmento A, TrechoSegmento B) NovaLuzComPar()
    {
        var a = new TrechoSegmento("cA", "Curva A",
            new LinhaGps(new PontoGps(0, 0), new PontoGps(0.001, 0)),
            new PontoGps(0, 0.0005),
            new LinhaGps(new PontoGps(0, 0.001), new PontoGps(0.001, 0.001)));
        var b = new TrechoSegmento("cB", "Curva B",
            new LinhaGps(new PontoGps(0, 0.0015), new PontoGps(0.001, 0.0015)),
            new PontoGps(0, 0.002),
            new LinhaGps(new PontoGps(0, 0.0025), new PontoGps(0.001, 0.0025)));
        return (new LuzFreio(new[] { a, b }), a, b);
    }

    // Aproxima do ápice da curva A (a mais próxima da trajetória): 3 amostras com pico
    // de velocidade no meio — o onset (início da freada por desaceleração) fica gravado.
    private static void AproximarDeA(LuzFreio luz)
    {
        // distâncias ao ápice de A: ~250 m → ~200 m → ~150 m (a oeste do ápice).
        luz.Atualizar(0, 0.0005 - 250.0 / 111_320, kmh: 100);
        luz.Atualizar(0, 0.0005 - 200.0 / 111_320, kmh: 120);   // pico de velocidade → onset aqui
        luz.Atualizar(0, 0.0005 - 150.0 / 111_320, kmh: 110);   // desacelerou
    }

    [Fact]
    public void FCH_01_Chave_exata_fecha_e_consome()
    {
        var (luz, _, _) = NovaLuzComPar();
        AproximarDeA(luz);

        var r1 = luz.FecharTrecho("cA", tempoS: 10);
        Assert.NotNull(r1);                       // 1ª passagem: vira referência
        Assert.Equal("REFERÊNCIA", r1!.Palavra);

        // Consumido: fechar de novo SEM nova aproximação não reaproveita a freada velha.
        Assert.Null(luz.FecharTrecho("cA", tempoS: 10));
    }

    [Fact]
    public void FCH_02_Chave_divergente_adota_o_onset_do_vizinho_colado()
    {
        var (luz, _, _) = NovaLuzComPar();
        AproximarDeA(luz);                        // onset gravado sob "cA" (mais próxima)

        // O detector fecha o par pelo OUTRO id ("cB", ápice a ~167 m): adota o onset de cA.
        var r = luz.FecharTrecho("cB", tempoS: 10);
        Assert.NotNull(r);
        Assert.Equal("REFERÊNCIA", r!.Palavra);

        // A adoção também consome: nem cB nem cA têm freada sobrando.
        Assert.Null(luz.FecharTrecho("cB", tempoS: 10));
        Assert.Null(luz.FecharTrecho("cA", tempoS: 10));
    }

    [Fact]
    public void FCH_03_Sem_aproximacao_nenhuma_devolve_null()
    {
        var (luz, _, _) = NovaLuzComPar();
        Assert.Null(luz.FecharTrecho("cA", tempoS: 10));
        Assert.Null(luz.FecharTrecho("cB", tempoS: 10));
        Assert.Null(luz.FecharTrecho("nao-existe", tempoS: 10));
    }
}
