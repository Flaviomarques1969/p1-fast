// DeltaCoach — delta por sub-trecho (ghost) + frases do coach.
// Port de delta-calculator.js + mensagens-pedagogicas.js. Incremento 4 da Fase 4.

using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class DeltaCoachTests
{
    private const double Lat0 = -15.7727;
    private const double Lng0 = -47.9001;
    private const double MPerDegLat = 111_132.0;

    private static string SubPorFracao(double f) =>
        f < 0.2 ? "entrada" : f < 0.4 ? "freio" : f < 0.6 ? "apice" : f < 0.8 ? "pace" : "saida";

    /// <summary>Reta com N pontos espaçados ~5 m; velocidade dada por kmhAt(fracao).</summary>
    private static Passagem Reta(int n, Func<double, double> kmhAt, string segId = "S1")
    {
        var pts = new List<PontoPassagem>();
        for (var i = 0; i < n; i++)
        {
            var frac = (double)i / (n - 1);
            var lat = Lat0 + i * 5.0 / MPerDegLat; // ~5 m por ponto
            pts.Add(new PontoPassagem(lat, Lng0, kmhAt(frac), i, frac, SubPorFracao(frac)));
        }
        return new Passagem(segId, pts);
    }

    // ── Delta ───────────────────────────────────────────────

    [Fact]
    public void DC_01_Delta_da_volta_contra_ela_mesma_eh_zero()
    {
        var p = Reta(50, _ => 100);
        var r = DeltaCalculator.Calcular(p, p);
        Assert.True(Math.Abs(r.DeltaTotalS) < 1e-6, $"delta={r.DeltaTotalS}");
    }

    [Fact]
    public void DC_02_Mais_lento_perde_tempo_e_acha_o_pior_sub()
    {
        var referencia = Reta(50, _ => 100);
        // mais devagar SÓ no freio (fração 0.2..0.4): perde tempo ali.
        var atual = Reta(50, f => f is >= 0.2 and < 0.4 ? 70 : 100);
        var r = DeltaCalculator.Calcular(atual, referencia);
        Assert.True(r.DeltaTotalS > 0, $"esperava perder tempo, delta={r.DeltaTotalS}");
        Assert.Equal("freio", r.PiorSubTrecho);
        Assert.True(r.PorSubTrecho["freio"].DeltaS > r.PorSubTrecho["apice"].DeltaS);
    }

    [Fact]
    public void DC_03_Passagem_curta_lanca()
    {
        var curta = new Passagem("S1", new List<PontoPassagem> { new(Lat0, Lng0, 100, 0, 0, "entrada") });
        Assert.Throws<ArgumentException>(() => DeltaCalculator.Calcular(curta, Reta(50, _ => 100)));
    }

    // ── Coach: resultado da volta ───────────────────────────

    private static DeltaResultado Res(double total, string pior, double piorDelta,
        double entradaDelta = 0, double? tempoAtual = null)
    {
        var por = new Dictionary<string, SubDelta>
        {
            ["entrada"] = new(entradaDelta, 0, 1),
            ["freio"]   = new(pior == "freio" ? piorDelta : 0, 0, 1),
            ["apice"]   = new(pior == "apice" ? piorDelta : 0, 0, 1),
            ["pace"]    = new(0, 0, 1),
            ["saida"]   = new(pior == "saida" ? piorDelta : 0, 0, 1),
        };
        if (pior == "entrada") por["entrada"] = new(piorDelta, 0, 1);
        return new DeltaResultado("S1", total, por, pior, piorDelta, tempoAtual);
    }

    [Fact]
    public void DC_04_Primeira_passagem_ou_sem_referencia_eh_REGISTRANDO()
    {
        Assert.Equal("13", MensagensPedagogicas.Decidir(primeiraPassagem: true)!.Codigo);
        Assert.Equal("13", MensagensPedagogicas.Decidir(resultadoDelta: null)!.Codigo);
    }

    [Fact]
    public void DC_05_Delta_zero_nao_emite_frase()
    {
        // spec v2 (Flávio 04/07): BUSCAR LIMITE saiu — delta ~zero não gera coach.
        Assert.Null(MensagensPedagogicas.Decidir(Res(0.0, "entrada", 0)));
    }

    [Fact]
    public void DC_06_Ganho_pequeno_MANTEVE_e_grande_RECORDE()
    {
        Assert.Equal("MANTEVE LINHA", MensagensPedagogicas.Decidir(Res(-0.08, "entrada", 0))!.Texto);
        Assert.Equal("RECORDE", MensagensPedagogicas.Decidir(Res(-0.30, "entrada", 0))!.Texto);
    }

    [Fact]
    public void DC_07_Ganho_grande_sem_bater_absoluto_vira_MELHOR_STINT()
    {
        // ganho 0.20, recorde absoluto existe e a volta NÃO foi melhor que ele, mas bateu o stint.
        var m = MensagensPedagogicas.Decidir(
            Res(-0.20, "entrada", 0, tempoAtual: 95.0),
            recordeAbsolutoS: 90.0, bateuMelhorStint: true);
        Assert.Equal("MELHOR STINT", m!.Texto);
    }

    // ── Coach: foco no pior sub-trecho ──────────────────────

    [Fact]
    public void DC_08_Entrada_ruim_eh_PISOU_POUCO()
        => Assert.Equal("Acelere Mais", MensagensPedagogicas.Decidir(Res(0.30, "entrada", 0.30))!.Texto);

    [Fact]
    public void DC_09_Freio_ruim_distingue_CEDO_de_TARDE()
    {
        // entrada normal -> FREOU CEDO
        Assert.Equal("FREOU CEDO", MensagensPedagogicas.Decidir(Res(0.30, "freio", 0.30, entradaDelta: 0))!.Texto);
        // chegou mais rápido na entrada (delta < -0.02) + perdeu no freio -> FREOU TARDE
        Assert.Equal("FREOU TARDE", MensagensPedagogicas.Decidir(Res(0.30, "freio", 0.30, entradaDelta: -0.10))!.Texto);
    }

    [Theory]
    [InlineData(0)]    // ápice à frente
    [InlineData(90)]   // ápice à direita
    [InlineData(180)]  // ápice atrás
    [InlineData(270)]  // ápice à esquerda
    public void DC_10_Apice_ruim_nao_emite_frase_de_volante(double angulo)
    {
        // spec v2 (Flávio 04/07): as 4 VIROU saíram — o piloto corrige seguindo a BOLINHA
        // do ápice (visual, gap 5). O ramo "apice" não emite frase, em qualquer ângulo.
        Assert.Null(MensagensPedagogicas.Decidir(Res(0.30, "apice", 0.30), new ContextoApice(angulo, 5)));
    }

    [Fact]
    public void DC_11_Saida_ruim_eh_ACELEROU_TARDE()
        => Assert.Equal("ACELEROU TARDE", MensagensPedagogicas.Decidir(Res(0.30, "saida", 0.30))!.Texto);

    [Fact]
    public void DC_12_Perda_imensuravel_nao_atrapalha_o_piloto()
        // perdeu 0.06 no total (fora da faixa "zero"), mas espalhado: o pior
        // sub-trecho é só 0.04 (< 0.05) — nenhuma frase, não atrapalha o piloto.
        => Assert.Null(MensagensPedagogicas.Decidir(Res(0.06, "freio", 0.04)));
}
