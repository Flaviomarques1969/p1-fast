// Ghost — geometria do ápice e da bolinha (port de apice-calculator.js +
// trecho-detector.js). Incremento 3 da Fase 4. Testa com geometria de valor
// conhecido (arco de raio definido, rumo, ângulo da bolinha).

using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class GhostTests
{
    private const double Lat0 = -15.7727;
    private const double Lng0 = -47.9001;
    private const double MPerDegLat = 111_132.0;
    private static double MPerDegLng(double lat) => 111_320.0 * Math.Cos(lat * Math.PI / 180.0);

    /// <summary>Gera pontos num arco de raio R (m) centrado em Lat0/Lng0.</summary>
    private static List<PontoGps> Arco(double raioM, int n, double deTheta, double ateTheta)
    {
        var pts = new List<PontoGps>();
        var mLng = MPerDegLng(Lat0);
        for (var i = 0; i < n; i++)
        {
            var th = deTheta + (ateTheta - deTheta) * i / (n - 1);
            var dx = raioM * Math.Cos(th); // leste (m)
            var dy = raioM * Math.Sin(th); // norte (m)
            pts.Add(new PontoGps(Lat0 + dy / MPerDegLat, Lng0 + dx / mLng));
        }
        return pts;
    }

    // ── Distância / rumo ────────────────────────────────────

    [Fact]
    public void GH_01_DistMeters_bate_com_a_escala_real()
    {
        // 0,001° de latitude ≈ 111 m.
        var d = Ghost.DistMeters(new PontoGps(Lat0, Lng0), new PontoGps(Lat0 + 0.001, Lng0));
        Assert.InRange(d, 109, 113);
    }

    [Fact]
    public void GH_02_BearingDeg_norte_e_leste()
    {
        var p = new PontoGps(Lat0, Lng0);
        var norte = Ghost.BearingDeg(p, new PontoGps(Lat0 + 0.001, Lng0)); // ~0/360
        Assert.True(norte < 1 || norte > 359, $"norte={norte}");
        Assert.InRange(Ghost.BearingDeg(p, new PontoGps(Lat0, Lng0 + 0.001)), 89, 91); // leste ~90
    }

    // ── Ângulo da bolinha (referencial do carro) ────────────

    [Fact]
    public void GH_03_ApexErrorAngle_frente_direita_atras_esquerda()
    {
        var carro = new PontoGps(Lat0, Lng0);
        var aoNorte = new PontoGps(Lat0 + 0.001, Lng0);
        var aLeste  = new PontoGps(Lat0, Lng0 + 0.001);
        var aoSul    = new PontoGps(Lat0 - 0.001, Lng0);

        // Carro apontando pro norte (heading 0): ápice ao norte = FRENTE (~0)
        Assert.True(Perto(Ghost.ApexErrorAngleDeg(carro, 0, aoNorte), 0, 1));
        // ápice a leste = DIREITA (~90)
        Assert.True(Perto(Ghost.ApexErrorAngleDeg(carro, 0, aLeste), 90, 1));
        // ápice ao sul = ATRÁS (~180)
        Assert.True(Perto(Ghost.ApexErrorAngleDeg(carro, 0, aoSul), 180, 1));
        // Carro apontando pro leste (heading 90): ápice ao norte = ESQUERDA (~270)
        Assert.True(Perto(Ghost.ApexErrorAngleDeg(carro, 90, aoNorte), 270, 1));
    }

    // ── Ápice = ponto mais fechado ──────────────────────────

    [Fact]
    public void GH_04_AcharApice_recupera_o_raio_do_arco()
    {
        var pts = Arco(raioM: 25, n: 31, deTheta: 0, ateTheta: Math.PI); // semicírculo de 25 m
        var r = Ghost.AcharApice(pts);
        Assert.NotNull(r);
        Assert.InRange(r!.RaioM, 22.5, 27.5); // ~25 m (±10%)
    }

    [Fact]
    public void GH_05_AcharApice_pega_a_curva_mais_fechada_entre_duas()
    {
        // Curva aberta (raio 80) seguida de curva fechada (raio 15): o ápice
        // tem que cair na fechada.
        var aberta  = Arco(raioM: 80, n: 20, deTheta: 0, ateTheta: Math.PI / 2);
        var fechada = Arco(raioM: 15, n: 20, deTheta: Math.PI, ateTheta: Math.PI * 1.6);
        var pts = aberta.Concat(fechada).ToList();
        var r = Ghost.AcharApice(pts);
        Assert.NotNull(r);
        Assert.InRange(r!.RaioM, 13, 18);   // achou a fechada, não a aberta
        Assert.True(r.Idx >= aberta.Count - 4); // índice na metade fechada
    }

    [Fact]
    public void GH_06_AcharApice_passagem_curta_retorna_null()
    {
        Assert.Null(Ghost.AcharApice(new List<PontoGps> { new(Lat0, Lng0), new(Lat0, Lng0) }));
    }

    // ── Bolinha ao vivo ─────────────────────────────────────

    [Fact]
    public void GH_07_Bolinha_no_apice_eh_mira_certa_e_sem_heading_sem_angulo()
    {
        var apice = new PontoGps(Lat0, Lng0);
        // Em cima do ápice (dist 0) = mira certa.
        var b0 = Ghost.CalcularBolinha(apice, headingDeg: null, apice);
        Assert.True(b0.DistM < 0.01);
        Assert.Equal(ApexEstado.OkMelhor, b0.Estado);
        Assert.Null(b0.AngleDeg); // sem rumo confiável → sem direção

        // Longe (>2 m) = mira errada, e com rumo dá a direção.
        var carro = new PontoGps(Lat0 - 0.001, Lng0); // ~111 m ao sul do ápice
        var b1 = Ghost.CalcularBolinha(carro, headingDeg: 0, apice); // apontando pro norte
        Assert.True(b1.DistM > 100);
        Assert.Equal(ApexEstado.OkPior, b1.Estado);
        Assert.True(Perto(b1.AngleDeg!.Value, 0, 1)); // ápice à frente (norte)
    }

    private static bool Perto(double a, double b, double tol)
    {
        var diff = Math.Abs((a - b) % 360);
        if (diff > 180) diff = 360 - diff;
        return diff <= tol;
    }
}
