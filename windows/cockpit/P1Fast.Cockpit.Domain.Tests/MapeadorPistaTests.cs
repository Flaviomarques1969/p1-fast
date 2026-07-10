// MapeadorPista — Fase B do mapeamento de pista desconhecida (achar o fecho da volta).
// Trilhas SINTÉTICAS geradas em código: um circuito retangular percorrido N voltas, com a
// reta de baixo mais rápida (a "reta principal", onde a linha deve ancorar). Os pontos saem
// de metros locais convertidos pra lat/lng, FORA da caixa de Brasília (pista nova de verdade).

using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class MapeadorPistaTests
{
    // Centro geográfico da pista sintética (Interlagos-ish, fora da caixa de Brasília).
    private const double CentroLat = -23.70;
    private const double CentroLon = -46.70;
    private const double MPerDegLat = 111_132.0;
    private static double MPerDegLon => 111_320.0 * Math.Cos(CentroLat * Math.PI / 180.0);

    private static double Sq(double v) => v * v;

    /// <summary>Ponto GPS a partir de metros locais (leste, norte) em torno do centro.</summary>
    private static PontoGps DeMetros(double xEast, double yNorth)
        => new(CentroLat + yNorth / MPerDegLat, CentroLon + xEast / MPerDegLon);

    /// <summary>Ponto de baixo-centro (a reta principal) em metros → GPS.</summary>
    private static PontoGps BaixoCentro(double hh) => DeMetros(0, -hh);

    /// <summary>
    /// Gera a trilha de um circuito retangular 2*hw × 2*hh, percorrido <paramref name="voltas"/>
    /// vezes no sentido horário a partir do meio da borda esquerda. A borda de baixo é a reta
    /// principal (mais rápida, pico no centro). <paramref name="multVolta"/> escala a velocidade
    /// por volta (pra gerar períodos consistentes ou não).
    /// </summary>
    private static List<(PontoGps P, double Kmh, long T)> GerarRetangulo(
        double hw, double hh, int voltas, double stepM = 8, double baseKmh = 80,
        double bottomPeakKmh = 190, double bottomEndKmh = 150, double[]? multVolta = null)
    {
        (double x, double y)[] wps =
        {
            (-hw, 0), (-hw, hh), (hw, hh), (hw, -hh), (-hw, -hh), (-hw, 0),
        };

        var xy = new List<(double x, double y, int volta)> { (wps[0].x, wps[0].y, 0) };
        for (int v = 0; v < voltas; v++)
            for (int s = 0; s < 5; s++)
            {
                var a = wps[s];
                var b = wps[s + 1];
                double len = Math.Sqrt(Sq(b.x - a.x) + Sq(b.y - a.y));
                int steps = Math.Max(1, (int)Math.Round(len / stepM));
                for (int k = 1; k <= steps; k++)
                {
                    double t = (double)k / steps;
                    xy.Add((a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, v));
                }
            }

        var outp = new List<(PontoGps, double, long)>();
        double tMs = 0;
        (double x, double y)? prev = null;
        foreach (var (x, y, v) in xy)
        {
            double mult = multVolta is not null && v < multVolta.Length ? multVolta[v] : 1.0;
            double kmh = Math.Abs(y - (-hh)) < 0.5
                ? (bottomEndKmh + (bottomPeakKmh - bottomEndKmh) * (1 - Math.Abs(x) / hw)) * mult
                : baseKmh * mult;
            if (prev is { } pr)
                tMs += Math.Sqrt(Sq(x - pr.x) + Sq(y - pr.y)) / (kmh / 3.6) * 1000.0;
            outp.Add((DeMetros(x, y), kmh, (long)tMs));
            prev = (x, y);
        }
        return outp;
    }

    private static MapeadorPista Rodar(IEnumerable<(PontoGps P, double Kmh, long T)> trilha, MapeadorPista? m = null)
    {
        m ??= new MapeadorPista();
        foreach (var (p, kmh, t) in trilha)
            m.Ingest(p, kmh, headingDeg: null, tWallMs: t);   // heading null → cérebro usa o rumo por 2 posições
        return m;
    }

    // (1) Circuito fechado de 3 voltas → LinhaConfirmada e VoltasFechadas correto.
    // A linha nasce na volta 1 (âncora no ponto mais rápido, semeando o 1º cruzamento); daí
    // 3 passadas pela reta principal fecham 2 voltas cronometradas e, sendo consistentes (±10%),
    // confirmam a linha.
    [Fact]
    public void MAP_01_Circuito_fechado_confirma_a_linha_e_conta_as_voltas()
    {
        var m = Rodar(GerarRetangulo(hw: 200, hh: 125, voltas: 3));

        Assert.Equal(MapeamentoEstado.LinhaConfirmada, m.Estado);
        Assert.NotNull(m.Linha);
        Assert.Equal(2, m.VoltasFechadas);          // 3 passadas pela linha → 2 voltas fechadas
        Assert.Equal(2, m.Voltas.Count);
        Assert.All(m.Voltas, v =>
        {
            Assert.True(v.PeriodoS >= MapeadorPista.VoltaMinimaPlausivelS, $"volta curta: {v.PeriodoS:0.0}s");
            Assert.NotEmpty(v.Pontos);
            Assert.True(v.Pontos[^1].DistM > v.Pontos[0].DistM, "DistM deveria acumular na volta");
        });
    }

    // (2) A linha aprendida ancora no ponto mais RÁPIDO (a reta principal = baixo-centro), é
    // perpendicular ao rumo e tem ~40 m de largura.
    [Fact]
    public void MAP_02_Linha_ancora_no_ponto_mais_rapido_da_volta()
    {
        var m = Rodar(GerarRetangulo(hw: 200, hh: 125, voltas: 3));

        Assert.NotNull(m.Linha);
        var linha = m.Linha!;

        // Meio da linha ≈ baixo-centro (a reta principal), longe dos cantos lentos.
        var meio = new PontoGps((linha.A.Lat + linha.B.Lat) / 2, (linha.A.Lng + linha.B.Lng) / 2);
        Assert.True(Ghost.DistMeters(meio, BaixoCentro(125)) < 20,
            $"a linha deveria ancorar na reta principal, veio a {Ghost.DistMeters(meio, BaixoCentro(125)):0} m");

        // Largura ~40 m (mesma ordem da linha real de Brasília).
        double largura = Ghost.DistMeters(linha.A, linha.B);
        Assert.InRange(largura, 35, 45);
    }

    // (3) Períodos de volta INCONSISTENTES (>±10%) NÃO confirmam — as voltas fecham, mas a linha
    // fica só candidata.
    [Fact]
    public void MAP_03_Periodo_inconsistente_nao_confirma()
    {
        // Cada volta bem mais lenta que a anterior → períodos sempre >10% distantes.
        var m = Rodar(GerarRetangulo(hw: 200, hh: 125, voltas: 4,
            multVolta: new[] { 1.0, 0.75, 0.55, 0.40 }));

        Assert.Equal(MapeamentoEstado.LinhaCandidata, m.Estado);   // nunca confirmou
        Assert.True(m.VoltasFechadas >= 2, $"as voltas plausíveis ainda fecham: {m.VoltasFechadas}");
    }

    // (4) Gap de GPS (fixes emudecem) DESCARTA a volta corrente: comparando a mesma trilha com e
    // sem um buraco de tempo no meio, o buraco custa exatamente UMA volta fechada.
    [Fact]
    public void MAP_04_Gap_de_gps_descarta_a_volta_corrente()
    {
        var trilha = GerarRetangulo(hw: 200, hh: 125, voltas: 5);

        // Referência: sem gap.
        var mRef = Rodar(trilha);
        Assert.Equal(MapeamentoEstado.LinhaConfirmada, mRef.Estado);
        int voltasRef = mRef.VoltasFechadas;

        // Com gap: injeta um salto de 10 s a ~70% da trilha (dentro da volta 4, ANTES da reta
        // principal dela) — o cérebro já confirmou (na volta 3) bem antes.
        int gIdx = (int)(0.70 * trilha.Count);
        var comGap = new List<(PontoGps, double, long)>(trilha.Count);
        for (int i = 0; i < trilha.Count; i++)
        {
            var (p, kmh, t) = trilha[i];
            comGap.Add((p, kmh, i >= gIdx ? t + 10_000 : t));
        }

        var mGap = Rodar(comGap);
        Assert.Equal(MapeamentoEstado.LinhaConfirmada, mGap.Estado);
        Assert.Equal(voltasRef - 1, mGap.VoltasFechadas);   // o buraco descartou 1 volta
    }

    // (5) Volta < 40 s NÃO conta (D3, Bubi): um "kartódromo" (voltas ~20 s) até acha o fecho,
    // mas nenhuma volta fecha e a linha nunca confirma.
    [Fact]
    public void MAP_05_Volta_curta_nao_conta()
    {
        var m = Rodar(GerarRetangulo(hw: 75, hh: 50, voltas: 6));

        Assert.NotEqual(MapeamentoEstado.LinhaConfirmada, m.Estado);
        Assert.Equal(0, m.VoltasFechadas);
        Assert.Empty(m.Voltas);
    }

    // (6) Trilha ABERTA (vai e não volta) nunca vira LinhaCandidata — sem re-cruzamento, sem linha.
    [Fact]
    public void MAP_06_Trilha_aberta_nunca_candidata()
    {
        var trilha = new List<(PontoGps, double, long)>();
        double t = 0;
        for (int i = 0; i < 300; i++)   // ~2,4 km reto pro norte, sem dobrar de volta
        {
            double y = i * 8.0;
            trilha.Add((DeMetros(0, y), 100, (long)t));
            t += 8.0 / (100 / 3.6) * 1000.0;
        }

        var m = Rodar(trilha);
        Assert.Equal(MapeamentoEstado.Rastreando, m.Estado);
        Assert.Null(m.Linha);
        Assert.Equal(0, m.VoltasFechadas);
    }

    // (7) A caixa aprendida CONTÉM a trilha, com margem (~200 m) de folga.
    [Fact]
    public void MAP_07_Caixa_aprendida_contem_a_trilha_com_margem()
    {
        double hw = 200, hh = 125;
        var trilha = GerarRetangulo(hw, hh, voltas: 2);
        var m = Rodar(trilha);

        var (latMin, latMax, lonMin, lonMax) = m.Caixa;

        // Toda a trilha cai DENTRO da caixa.
        Assert.All(trilha, x =>
        {
            Assert.InRange(x.Item1.Lat, latMin, latMax);
            Assert.InRange(x.Item1.Lng, lonMin, lonMax);
        });

        // A folga em latitude é ~200 m (nem sem margem, nem exagerada).
        double obsLatMin = trilha.Min(x => x.Item1.Lat);
        double folgaM = (obsLatMin - latMin) * MPerDegLat;
        Assert.InRange(folgaM, 150, 260);
    }
}
