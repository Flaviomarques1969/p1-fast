// CortadorTrechos — corta uma pista desconhecida em trechos a partir de voltas fechadas
// (Fase C do mapeamento, desenho 2026-07-10). Voltas SINTÉTICAS com perfil conhecido: um
// retângulo com 4 curvas (mínimos de velocidade) e retas rápidas entre elas. Trava:
// congelamento por 2 cortes consistentes (D1), reset por volta divergente, imutabilidade
// pós-congelamento, ruído abaixo da proeminência não vira curva, e a geometria das linhas.

using System;
using System.Collections.Generic;
using System.Linq;
using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class CortadorTrechosTests
{
    private const double BaseLat = -15.0;
    private const double BaseLng = -48.0;
    private const double MPorGrauLat = 111_132.0;
    private static double MPorGrauLng => 111_320.0 * Math.Cos(BaseLat * Math.PI / 180.0);

    private static PontoGps XYParaGps(double x, double y)
        => new(BaseLat + y / MPorGrauLat, BaseLng + x / MPorGrauLng);

    // ── Retângulo W×H, início no MEIO da reta de baixo (dist 0 = reta rápida, como a linha real).
    private const double W = 400, H = 300;
    private static readonly double P = 2 * W + 2 * H;                 // perímetro 1400
    private static readonly double[] CantosS = { W / 2, W / 2 + H, W / 2 + H + W, W / 2 + 2 * H + W }; // 200,500,900,1200

    private static (double X, double Y) PerimetroXY(double s)
    {
        s = ((s % P) + P) % P;
        double a = W / 2, b = a + H, c = b + W, d = c + H;           // 200,500,900,1200
        if (s < a) return (W / 2 + s, 0);                            // baixo →direita
        if (s < b) return (W, s - a);                                // direita ↑
        if (s < c) return (W - (s - b), H);                          // topo ←
        if (s < d) return (0, H - (s - c));                          // esquerda ↓
        return (s - d, 0);                                           // baixo esquerda→meio
    }

    private static double DistAoCantoMaisProximo(double s)
    {
        double melhor = double.MaxValue;
        foreach (var cs in CantosS)
        {
            var d = Math.Abs(((s - cs) % P + P) % P);
            d = Math.Min(d, P - d);                                  // circular
            if (d < melhor) melhor = d;
        }
        return melhor;
    }

    private static double Gauss(double dist, double profundidade, double sigma)
        => profundidade * Math.Exp(-(dist * dist) / (sigma * sigma));

    /// <summary>Volta retangular: retas a vReta, mergulho gaussiano a cada canto (prof. 60, σ 25).
    /// dipExtraS/dipExtraProf = um mergulho EXTRA numa reta (divergência ou ruído).</summary>
    private static VoltaMapeada Retangulo(double vReta = 120, double? dipExtraS = null, double dipExtraProf = 0)
    {
        var pontos = new List<AmostraTrilha>();
        double distAcum = 0;
        PontoGps? anterior = null;
        for (double s = 0; s < P; s += 8)
        {
            var (x, y) = PerimetroXY(s);
            var p = XYParaGps(x, y);
            if (anterior is not null) distAcum += Ghost.DistMeters(anterior, p);
            var v = vReta - Gauss(DistAoCantoMaisProximo(s), 60, 25);
            if (dipExtraS is { } de)
            {
                var dd = Math.Abs(((s - de) % P + P) % P);
                dd = Math.Min(dd, P - dd);
                v -= Gauss(dd, dipExtraProf, 25);
            }
            pontos.Add(new AmostraTrilha(p, v, distAcum));
            anterior = p;
        }
        return new VoltaMapeada(pontos, PeriodoS: 60);
    }

    [Fact]
    public void CT_01_Duas_voltas_consistentes_congelam_com_quatro_trechos_em_ordem()
    {
        var c = new CortadorTrechos();
        Assert.Null(c.Ingest(Retangulo()));           // 1ª volta: sem corte anterior
        Assert.False(c.Congelado);

        var segs = c.Ingest(Retangulo());             // 2ª volta igual → congela
        Assert.NotNull(segs);
        Assert.True(c.Congelado);
        Assert.Equal(4, segs!.Count);
        // IDs e nomes em ordem de distância acumulada.
        Assert.Equal(new[] { "t01", "t02", "t03", "t04" }, segs.Select(s => s.Id).ToArray());
        Assert.Equal(new[] { "T1", "T2", "T3", "T4" }, segs.Select(s => s.Nome).ToArray());
    }

    [Fact]
    public void CT_02_Volta_divergente_reinicia_a_consistencia()
    {
        var c = new CortadorTrechos();
        Assert.Null(c.Ingest(Retangulo()));                                  // boa
        // Divergente: mergulho extra de 20 km/h numa reta → cria um 5º trecho no perfil médio.
        Assert.Null(c.Ingest(Retangulo(dipExtraS: 350, dipExtraProf: 20)));  // divergente → reseta
        Assert.False(c.Congelado);
        Assert.Null(c.Ingest(Retangulo()));                                  // boa (ainda diluindo)
        Assert.False(c.Congelado);
        var segs = c.Ingest(Retangulo());                                    // boa → agora congela
        Assert.NotNull(segs);
        Assert.True(c.Congelado);
        Assert.Equal(4, segs!.Count);                                        // voltou aos 4 certos
    }

    [Fact]
    public void CT_03_Depois_de_congelado_nada_muda()
    {
        var c = new CortadorTrechos();
        c.Ingest(Retangulo());
        var congelado = c.Ingest(Retangulo());
        Assert.True(c.Congelado);
        Assert.NotNull(congelado);

        // Volta radicalmente diferente (retas mais lentas + mergulho extra) — ignorada.
        var depois = c.Ingest(Retangulo(vReta: 90, dipExtraS: 350, dipExtraProf: 30));
        Assert.Same(congelado, depois);
        Assert.Equal(4, c.Segmentos!.Count);
    }

    [Fact]
    public void CT_04_Ruido_abaixo_da_proeminencia_nao_vira_trecho()
    {
        // Mergulho de só 5 km/h numa reta (abaixo dos ~8 de proeminência) NÃO cria curva.
        var c = new CortadorTrechos();
        c.Ingest(Retangulo(dipExtraS: 350, dipExtraProf: 5));
        var segs = c.Ingest(Retangulo(dipExtraS: 350, dipExtraProf: 5));
        Assert.True(c.Congelado);
        Assert.Equal(4, segs!.Count);                                        // 4, não 5
    }

    [Fact]
    public void CT_05_Linhas_perpendiculares_e_com_quarenta_metros()
    {
        // Trilha reta pra LESTE com dois mergulhos → 2 curvas; as linhas de fronteira devem ficar
        // perpendiculares ao rumo (leste) = orientadas norte-sul, com ~40 m de largura.
        var c = new CortadorTrechos();
        c.Ingest(TrilhaLeste());
        var segs = c.Ingest(TrilhaLeste());
        Assert.True(c.Congelado);
        Assert.Equal(2, segs!.Count);

        foreach (var seg in segs)
        {
            foreach (var linha in new[] { seg.EntradaLine, seg.SaidaLine })
            {
                var largura = Ghost.DistMeters(linha.A, linha.B);
                Assert.InRange(largura, 37, 43);                             // ~40 m
                // rumo leste → perpendicular norte-sul: A e B quase mesma longitude.
                var difLngM = Math.Abs(linha.A.Lng - linha.B.Lng) * MPorGrauLng;
                Assert.True(difLngM < 3, $"linha não perpendicular ao leste (difLng={difLngM:F1} m)");
            }
        }
    }

    // Trilha reta pra leste (lat constante), com dois mergulhos gaussianos → 2 curvas.
    private static VoltaMapeada TrilhaLeste()
    {
        var pontos = new List<AmostraTrilha>();
        double distAcum = 0;
        PontoGps? anterior = null;
        const int K = 200;
        double comprimento = K * 8;                                          // ~1600 m
        for (var i = 0; i < K; i++)
        {
            double s = i * 8;
            var p = XYParaGps(s, 0);                                         // y=0, x cresce → leste
            if (anterior is not null) distAcum += Ghost.DistMeters(anterior, p);
            var d1 = Math.Abs(s - comprimento * 0.25);
            var d2 = Math.Abs(s - comprimento * 0.75);
            var v = 120 - Gauss(d1, 60, 25) - Gauss(d2, 60, 25);
            pontos.Add(new AmostraTrilha(p, v, distAcum));
            anterior = p;
        }
        return new VoltaMapeada(pontos, PeriodoS: 55);
    }

    [Fact]
    public void CT_06_Volta_degenerada_nao_congela_nem_lanca()
    {
        var c = new CortadorTrechos();
        Assert.Null(c.Ingest(new VoltaMapeada(new List<AmostraTrilha>(), 60)));   // vazia
        Assert.Null(c.Ingest(new VoltaMapeada(new List<AmostraTrilha>
        {
            new(new PontoGps(BaseLat, BaseLng), 100, 0),
            new(new PontoGps(BaseLat, BaseLng), 100, 0),                          // comprimento 0
        }, 60)));
        Assert.False(c.Congelado);
    }
}
