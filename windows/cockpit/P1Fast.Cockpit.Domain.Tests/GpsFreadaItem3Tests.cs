// Item 3 da ordem do GPS (Flávio 27/10/2026): freada pelo acelerômetro do RaceBox.
// CATRACA: com G do carro (ZeroOk) o TrechoDetector confirma a freada no G (limiar 0,5 G de sempre)
// e marca o ponto onde a desaceleração COMEÇOU; sem G confiável segue a conta pela velocidade.
// Curva sintética: carro anda pro leste (lat 0), entrada em lng 0, ápice 0,002, saída 0,003.

using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class GpsFreadaItem3Tests
{
    private const double Passo = 0.00003;      // ~3,3 m por amostra
    private const double LngInicio = -0.000315; // nenhuma amostra cai em cima da linha de entrada
    private static double Lng(int i) => LngInicio + i * Passo;

    private static TrechoSegmento Curva() =>
        new("c0", "c0",
            new LinhaGps(new PontoGps(-0.001, 0.0), new PontoGps(0.001, 0.0)),
            new PontoGps(0, 0.002),
            new LinhaGps(new PontoGps(-0.001, 0.003), new PontoGps(0.001, 0.003)));

    // Uma amostra a cada 100 ms; lng = início + i*Passo. g[i] = G longitudinal; kmh[i] = velocidade.
    private static List<TrechoEvento> Rodar(int n, Func<int, double?> g, Func<int, double> kmh, bool zeroOk = true)
    {
        var eventos = new List<TrechoEvento>();
        var det = new TrechoDetector(new[] { Curva() }, eventos.Add);
        for (var i = 0; i < n; i++)
            det.IngestGps(new AmostraGps(Lat: 0, Lng: Lng(i), Kmh: kmh(i), T: i * 100,
                AccelLongG: g(i), AccelLatG: 0, ZeroOk: zeroOk));
        return eventos;
    }

    private static TrechoEvento? Freada(List<TrechoEvento> ev) => ev.FirstOrDefault(e => e.Type == "freada-iniciou");

    [Fact]
    public void F3_01_Pelo_G_marca_onde_a_desaceleracao_comecou()
    {
        // amostra 20 começa a frear e sobe até −0,9 G; a média de 5 só confirma ~3 amostras depois.
        double[] rampa = { -0.15, -0.30, -0.60, -0.80, -0.90 };
        var ev = Rodar(60, i => i < 20 ? 0.0 : (i - 20 < rampa.Length ? rampa[i - 20] : -0.9), _ => 120);
        var ent = ev.First(e => e.Type == "entrada-cruzou");
        var f = Freada(ev);
        Assert.NotNull(f);
        Assert.Equal(2000, f!.T); // instante da amostra 20 (início), não o da confirmação
        // distância da amostra da entrada até a amostra 20, pela mesma régua do detector
        var iEnt = (int)(ent.T / 100);
        var distEsperada = Ghost.DistMeters(new PontoGps(0, Lng(iEnt)), new PontoGps(0, Lng(20)));
        Assert.InRange(f.DistFromEntradaM!.Value, distEsperada - 0.01, distEsperada + 0.01);
        Assert.True(distEsperada > 25, "cenário: início bem depois da entrada");
    }

    [Fact]
    public void F3_02_Pelo_G_queda_de_velocidade_sem_G_de_freada_nao_dispara()
    {
        // velocidade despenca (a conta pela posição veria ~−2,8 G), mas o acelerômetro diz −0,05 G.
        var ev = Rodar(60, _ => -0.05, i => i < 20 ? 150 : Math.Max(50, 150 - (i - 20) * 10));
        Assert.Null(Freada(ev));
    }

    [Fact]
    public void F3_03_Controle_sem_zero_cai_na_conta_pela_velocidade()
    {
        // MESMO cenário do F3_02 com ZeroOk=false: o G não vale → a conta pela velocidade dispara.
        var ev = Rodar(60, _ => -0.05, i => i < 20 ? 150 : Math.Max(50, 150 - (i - 20) * 10), zeroOk: false);
        Assert.NotNull(Freada(ev));
    }

    [Fact]
    public void F3_04_Sem_G_na_amostra_cai_na_conta_pela_velocidade()
    {
        var ev = Rodar(60, _ => null, i => i < 20 ? 150 : Math.Max(50, 150 - (i - 20) * 10));
        Assert.NotNull(Freada(ev));
    }

    [Fact]
    public void F3_05_Toque_isolado_no_freio_nao_vira_o_inicio()
    {
        // amostra 15: toque −0,15 e solta; a freada de verdade começa na 25.
        var ev = Rodar(70, i => i == 15 ? -0.15 : (i < 25 ? 0.0 : -0.9), _ => 120);
        var f = Freada(ev);
        Assert.NotNull(f);
        Assert.Equal(2500, f!.T);
    }

    [Fact]
    public void F3_06_Ja_freando_antes_da_entrada_marca_na_entrada()
    {
        var ev = Rodar(40, _ => -0.9, _ => 120);
        var ent = ev.First(e => e.Type == "entrada-cruzou");
        var f = Freada(ev);
        Assert.NotNull(f);
        Assert.Equal(ent.T, f!.T);
        Assert.Equal(0, f.DistFromEntradaM!.Value, 6);
    }

    [Fact]
    public void F3_07_Abaixo_do_limiar_de_sempre_nao_confirma()
    {
        // −0,40 G sustentado: abaixo do limiar de 0,5 G (não mudou) → nenhuma freada.
        var ev = Rodar(60, i => i < 20 ? 0.0 : -0.40, _ => 120);
        Assert.Null(Freada(ev));
    }
}
