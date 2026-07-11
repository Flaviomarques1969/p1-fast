// CoachZoom — cérebro do zoom ao vivo do trecho (port de coach-zoom-live.js v3, estado
// c840e129 do iMac via canal 2026-07-11). Testa: paridade do traçado/amarração, matriz
// da câmera heading-up (carro cai na âncora; marcha aponta pra CIMA), anti-salto, zoom
// pela velocidade, rumo pela tangente, rastro, ghost (âncora/gap frente-atrás) e o
// carregador da melhor volta do fixture.

using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class CoachZoomTests
{
    // ── inverso da amarração (SÓ pro teste): leva um alvo do desenho pra lat/lng ──
    private const double Lat0 = -15.775052602468472, Lng0 = -47.89942302308552;
    private const double KLat = 110540.0, KLng = 107127.29439406893;
    private const double TRe = 0.5907778659589077, TIm = -6.123065980062232e-05;
    private const double CRe = 418.7324422244304, CIm = 366.02935043692474;

    private static (double Lat, double Lng) DesenhoParaGeo(double x, double y)
    {
        var px = x - CRe; var py = y - CIm;
        var den = TRe * TRe + TIm * TIm;
        var zx = (px * TRe + py * TIm) / den;
        var zy = (py * TRe - px * TIm) / den;
        return (Lat0 + (-zy) / KLat, Lng0 + zx / KLng);
    }

    // ── traçado + amarração ─────────────────────────────────────────

    [Fact]
    public void PistaDesenho_495PontosDentroDoQuadro()
    {
        Assert.Equal(495, PistaDesenhoBrasilia.Pontos.Length);
        foreach (var (x, y) in PistaDesenhoBrasilia.Pontos)
        {
            Assert.InRange(x, 0, PistaDesenhoBrasilia.LarguraDesenho);
            Assert.InRange(y, 0, PistaDesenhoBrasilia.AlturaDesenho);
        }
    }

    [Fact]
    public void GeoParaDesenho_ParidadeComJs_LinhaDeChegada()
    {
        // referência calculada FORA do Domain com a conta do JS (mesmos números)
        var a = PistaDesenhoBrasilia.GeoParaDesenho(PistaBrasilia.ChegadaA.Lat, PistaBrasilia.ChegadaA.Lng);
        var b = PistaDesenhoBrasilia.GeoParaDesenho(PistaBrasilia.ChegadaB.Lat, PistaBrasilia.ChegadaB.Lng);
        Assert.Equal(377.7272900367559, a.X, 9);
        Assert.Equal(224.25718296181967, a.Y, 9);
        Assert.Equal(370.0101807358586, b.X, 9);
        Assert.Equal(202.55726886558145, b.Y, 9);
    }

    [Fact]
    public void DesenhoParaGeo_DoTeste_InverteDeVerdade()
    {
        var (lat, lng) = DesenhoParaGeo(400, 300);
        var (x, y) = PistaDesenhoBrasilia.GeoParaDesenho(lat, lng);
        Assert.Equal(400, x, 6);
        Assert.Equal(300, y, 6);
    }

    // ── câmera heading-up ───────────────────────────────────────────

    [Theory]
    [InlineData(400.0, 300.0, 0.0, 1.60)]
    [InlineData(651.2, 517.5, 137.4, 0.95)]
    [InlineData(228.1, 455.9, -63.0, 1.2)]
    public void MatrizCamera_CarroCaiExatoNaAncora(double cx, double cy, double rumo, double esc)
    {
        var m = CoachZoomGeometria.MatrizCamera(cx, cy, rumo, esc);
        var sx = cx * m.M11 + cy * m.M21 + m.OffsetX;
        var sy = cx * m.M12 + cy * m.M22 + m.OffsetY;
        Assert.Equal(CoachZoomCerebro.AncoraX, sx, 9);
        Assert.Equal(CoachZoomCerebro.AncoraY, sy, 9);
    }

    [Theory]
    [InlineData(0.0)]
    [InlineData(90.0)]
    [InlineData(217.0)]
    public void MatrizCamera_DirecaoDeMarchaApontaPraCima(double rumo)
    {
        // um passo de 1px na direção do rumo tem que virar (0, -escala) na tela
        const double esc = 1.3;
        var rad = rumo * Math.PI / 180;
        var (cx, cy) = (500.0, 400.0);
        var (px, py) = (cx + Math.Cos(rad), cy + Math.Sin(rad));
        var m = CoachZoomGeometria.MatrizCamera(cx, cy, rumo, esc);
        var sx = px * m.M11 + py * m.M21 + m.OffsetX - CoachZoomCerebro.AncoraX;
        var sy = py * m.M22 + px * m.M12 + m.OffsetY - CoachZoomCerebro.AncoraY;
        Assert.Equal(0, sx, 9);
        Assert.Equal(-esc, sy, 9);
    }

    [Fact]
    public void LerpAng_SempreOMenorArco()
    {
        Assert.Equal(370, CoachZoomCerebro.LerpAng(350, 10, 1), 9);   // cruza o 0 subindo
        Assert.Equal(-10, CoachZoomCerebro.LerpAng(10, 350, 1), 9);   // cruza o 0 descendo
        Assert.Equal(45, CoachZoomCerebro.LerpAng(0, 90, 0.5), 9);
    }

    // ── caminho suave (Catmull-Rom→Bézier, divisor 6) ───────────────

    [Fact]
    public void CaminhoSuave_MenosDeDoisPontos_Null()
    {
        Assert.Null(CoachZoomGeometria.CaminhoSuave(Array.Empty<(double, double)>()));
        Assert.Null(CoachZoomGeometria.CaminhoSuave(new[] { (1.0, 2.0) }));
    }

    [Fact]
    public void CaminhoSuave_DoisPontos_UmaCubicaAteODestino()
    {
        var c = CoachZoomGeometria.CaminhoSuave(new[] { (0.0, 0.0), (6.0, 0.0) });
        Assert.NotNull(c);
        var (inicio, cubicas) = c!.Value;
        Assert.Equal((0.0, 0.0), inicio);
        var seg = Assert.Single(cubicas);
        Assert.Equal(6.0, seg.X, 9); Assert.Equal(0.0, seg.Y, 9);
        Assert.Equal(1.0, seg.C1x, 9);   // p1 + (p2-p0)/6, com clamps nas pontas
        Assert.Equal(5.0, seg.C2x, 9);   // p2 - (p3-p1)/6
    }

    // ── cérebro: fluxo de fixes ─────────────────────────────────────

    private static CoachZoomQuadro? FixNoDesenho(CoachZoomCerebro c, double x, double y,
        double kmh, long tGpsMs, double tWallMs)
    {
        var (lat, lng) = DesenhoParaGeo(x, y);
        return c.ProcessarFix(lat, lng, kmh, tGpsMs, tWallMs);
    }

    [Fact]
    public void Cerebro_AntiSalto_DescartaOFixQueTeleporta()
    {
        var c = new CoachZoomCerebro();
        Assert.NotNull(FixNoDesenho(c, 400, 300, 80, 0, 0));
        Assert.Null(FixNoDesenho(c, 400 + CoachZoomCerebro.PassoMaxPx + 5, 300, 80, 200, 200));
        // o salto vira a nova origem: o próximo passo curto volta a pintar
        Assert.NotNull(FixNoDesenho(c, 400 + CoachZoomCerebro.PassoMaxPx + 7, 300, 80, 400, 400));
    }

    [Fact]
    public void Cerebro_PrimeiroQuadro_JaTemFatiaDaPista()
    {
        var c = new CoachZoomCerebro();
        var q = FixNoDesenho(c, 400, 300, 80, 0, 0);
        Assert.NotNull(q!.Fatia);
        Assert.Equal(2 * CoachZoomCerebro.FatiaR + 1, q.Fatia!.Length);
        Assert.False(q.MundoVisivel);   // sem rumo ainda (1º fix)
    }

    [Fact]
    public void Cerebro_ZoomConverge_PertoEmLento_LongeEmRapido()
    {
        var c = new CoachZoomCerebro();
        CoachZoomQuadro? q = null;
        for (var i = 0; i < 80; i++) q = FixNoDesenho(c, 400 + i * 0.5, 300, 40, i * 200, i * 200);
        Assert.Equal(CoachZoomCerebro.ZoomPerto, q!.Escala, 2);
        for (var i = 0; i < 120; i++) q = FixNoDesenho(c, 440 + i * 0.5, 300, 200, 20000 + i * 200, 20000 + i * 200);
        Assert.Equal(CoachZoomCerebro.ZoomLonge, q!.Escala, 2);
    }

    [Fact]
    public void Cerebro_RumoSegueATangenteDaPista()
    {
        var c = new CoachZoomCerebro();
        var pista = PistaDesenhoBrasilia.Pontos;
        CoachZoomQuadro? q = null;
        for (var i = 10; i < 26; i++)
            q = FixNoDesenho(c, pista[i].X, pista[i].Y, 100, i * 200, i * 200);
        Assert.True(q!.MundoVisivel);
        var a = pista[25]; var b = pista[28];   // tangente local (ADIANTE=3 do último ci=25)
        var tang = Math.Atan2(b.Y - a.Y, b.X - a.X) * 180 / Math.PI;
        var erro = Math.Abs((q.RumoDeg - tang + 540) % 360 - 180);
        Assert.True(erro < 10, $"rumo {q.RumoDeg:F1}° longe da tangente {tang:F1}° (erro {erro:F1}°)");
    }

    [Fact]
    public void Cerebro_Trail_Capado26_CaudaECabecaEmendam()
    {
        var c = new CoachZoomCerebro();
        CoachZoomQuadro? q = null;
        for (var i = 0; i < 40; i++) q = FixNoDesenho(c, 400 + i, 300, 80, i * 200, i * 200);
        Assert.Equal(CoachZoomCerebro.TrailCabeca, q!.Cabeca.Length);
        Assert.Equal(CoachZoomCerebro.TrailMax - CoachZoomCerebro.TrailCabeca + 1, q.Cauda.Length);
        Assert.Equal(q.Cauda[^1], q.Cabeca[0]);           // emenda sem furo
        // a ponta é a posição atual (ida-e-volta geo↔desenho tem ruído de double)
        Assert.Equal(439.0, q.Cabeca[^1].X, 6);
        Assert.Equal(300.0, q.Cabeca[^1].Y, 6);
    }

    // ── ghost: âncora espacial + gap circular ───────────────────────

    private static GhostVolta GhostDaPista(int n, double passoS)
    {
        var pista = PistaDesenhoBrasilia.Pontos;
        var pts = new GhostPonto[n];
        for (var i = 0; i < n; i++) pts[i] = new GhostPonto(pista[i].X, pista[i].Y, i * passoS);
        return new GhostVolta(pts, (n - 1) * passoS);
    }

    [Fact]
    public void Cerebro_Ghost_CarroMaisRapido_GapFrente()
    {
        var c = new CoachZoomCerebro();
        c.DefinirGhost(GhostDaPista(100, 0.2));   // ghost anda 1 ponto a cada 200 ms
        var pista = PistaDesenhoBrasilia.Pontos;
        CoachZoomQuadro? q = null;
        for (var k = 0; k < 10; k++)              // carro anda 2 pontos a cada 200 ms
        {
            var i = 10 + 2 * k;
            q = FixNoDesenho(c, pista[i].X, pista[i].Y, 100, k * 200, k * 200);
        }
        Assert.True(q!.GhostVisivel);
        Assert.NotNull(q.GapS);
        Assert.True(q.GapS > 0);
        Assert.Equal(GapLado.Frente, q.Lado);
    }

    [Fact]
    public void Cerebro_Ghost_CarroMaisLento_GapAtras()
    {
        var c = new CoachZoomCerebro();
        c.DefinirGhost(GhostDaPista(100, 0.2));
        var pista = PistaDesenhoBrasilia.Pontos;
        CoachZoomQuadro? q = null;
        for (var k = 0; k < 10; k++)              // carro anda 1 ponto a cada 400 ms
        {
            var i = 10 + k;
            q = FixNoDesenho(c, pista[i].X, pista[i].Y, 60, k * 400, k * 400);
        }
        Assert.True(q!.GhostVisivel);
        Assert.NotNull(q.GapS);
        Assert.True(q.GapS < 0);
        Assert.Equal(GapLado.Atras, q.Lado);
    }

    [Fact]
    public void Cerebro_Ghost_SemVoltaCarregada_NadaAparece()
    {
        var c = new CoachZoomCerebro();
        var pista = PistaDesenhoBrasilia.Pontos;
        CoachZoomQuadro? q = null;
        for (var i = 10; i < 16; i++) q = FixNoDesenho(c, pista[i].X, pista[i].Y, 100, i * 200, i * 200);
        Assert.False(q!.GhostVisivel);
        Assert.Null(q.GapS);
        Assert.Equal(GapLado.Nenhum, q.Lado);
    }

    [Fact]
    public void Cerebro_PosicaoGhostEm_ContinuaEntreFixes()
    {
        var c = new CoachZoomCerebro();
        c.DefinirGhost(GhostDaPista(100, 0.2));
        var pista = PistaDesenhoBrasilia.Pontos;
        for (var k = 0; k < 4; k++) FixNoDesenho(c, pista[10 + k].X, pista[10 + k].Y, 100, k * 200, k * 200);
        var em600 = c.PosicaoGhostEm(600);
        var em700 = c.PosicaoGhostEm(700);   // 100 ms depois: o ghost andou
        Assert.NotNull(em600); Assert.NotNull(em700);
        Assert.NotEqual(em600, em700);
    }

    [Fact]
    public void Cerebro_ReiniciarVolta_LimpaRastroEReAncora()
    {
        var c = new CoachZoomCerebro();
        c.DefinirGhost(GhostDaPista(100, 0.2));
        var pista = PistaDesenhoBrasilia.Pontos;
        for (var k = 0; k < 6; k++) FixNoDesenho(c, pista[10 + k].X, pista[10 + k].Y, 100, k * 200, k * 200);
        c.ReiniciarVolta();
        Assert.Null(c.PosicaoGhostEm(1400));   // âncora zerada
        var q = FixNoDesenho(c, pista[16].X, pista[16].Y, 100, 1400, 1400);
        Assert.Single(q!.Cabeca);               // rastro recomeçou do zero
    }

    // ── carregador do fixture (melhor volta completa) ───────────────

    private static string PassagemJson(string dia, int volta, string curva, double tempo, long t0) =>
        // tempo formatado invariante: em pt-BR "9.5" viraria "9,5" e quebraria o JSON
        $$"""
        {"dia":"{{dia}}","volta":{{volta}},"curva":"{{curva}}","tempo_trecho_s":{{tempo.ToString(System.Globalization.CultureInfo.InvariantCulture)}},
         "pontos":[{"lat":-15.7728816,"lng":-47.9000707,"t":{{t0}}},
                   {"lat":-15.7725493,"lng":-47.9001926,"t":{{t0 + 1500}}}]}
        """;

    [Fact]
    public void Loader_EscolheAMelhorVoltaCOMPLETA_IgnorandoAFurada()
    {
        var json = $$"""
        {"passagens":[
          {{PassagemJson("23/05", 1, "CURVA 01", 8.0, 1000)}},
          {{PassagemJson("23/05", 1, "CURVA 2", 7.0, 4000)}},
          {{PassagemJson("23/05", 2, "CURVA 01", 1.0, 9000)}},
          {{PassagemJson("24/05", 1, "CURVA 01", 9.0, 20000)}},
          {{PassagemJson("24/05", 1, "CURVA 2", 9.5, 23000)}}
        ]}
        """;
        var g = GhostVoltaLoader.CarregarDeJson(json);
        Assert.NotNull(g);
        // 23/05|1 (15,0 s) vence 24/05|1 (18,5 s); 23/05|2 é furada (só 1 das 2 curvas)
        Assert.Equal(4, g!.Pts.Count);
        Assert.Equal(0, g.Pts[0].TRelS, 9);            // tRel nasce no 1º ponto
        Assert.Equal(4.5, g.DurS, 9);                  // 1000→5500 ms
        for (var i = 1; i < g.Pts.Count; i++)
            Assert.True(g.Pts[i].TRelS >= g.Pts[i - 1].TRelS);   // ordenado por t
    }

    [Fact]
    public void Loader_SemVoltaCompleta_Null()
    {
        var json = $$"""
        {"passagens":[
          {{PassagemJson("23/05", 1, "CURVA 01", 8.0, 1000)}},
          {{PassagemJson("23/05", 2, "CURVA 2", 7.0, 4000)}}
        ]}
        """;
        Assert.Null(GhostVoltaLoader.CarregarDeJson(json));
    }

    [Fact]
    public void Loader_JsonQuebradoOuVazio_NullSemExplodir()
    {
        Assert.Null(GhostVoltaLoader.CarregarDeJson("{"));
        Assert.Null(GhostVoltaLoader.CarregarDeJson("{}"));
        Assert.Null(GhostVoltaLoader.CarregarDeJson("""{"passagens":[]}"""));
    }
}
