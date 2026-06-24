// ChegadaDetector: paridade com web/cockpit/chegada-detector.js — cruzamento real
// da linha, debounce de 5 s, contagem de voltas e tempo de volta.

using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class ChegadaDetectorTests
{
    // Linha leste-oeste (mesma latitude), perto de Brasília. O carro cruza indo
    // de sul (lat menor) pra norte (lat maior) sobre lng = -47.0005 (meio da linha).
    private static readonly GpsPonto A = new(-15.0000, -47.0000);
    private static readonly GpsPonto B = new(-15.0000, -47.0010);

    private const double Sul   = -15.0001;
    private const double Norte = -14.9999;
    private const double MeioLng = -47.0005;

    [Fact]
    public void Cruzar_a_linha_fecha_a_primeira_volta_sem_tempo()
    {
        var det = new ChegadaDetector(A, B);
        Assert.Null(det.IngestGps(Sul, MeioLng, 0));        // 1ª amostra: só inicializa
        var e = det.IngestGps(Norte, MeioLng, 1000);        // cruzou

        Assert.NotNull(e);
        Assert.Equal(1, e!.VoltaN);
        Assert.Null(e.TempoVoltaMs);                        // não há volta anterior
        Assert.Equal(1, det.Voltas);
    }

    [Fact]
    public void Segunda_volta_traz_o_tempo_entre_cruzamentos()
    {
        var det = new ChegadaDetector(A, B);
        det.IngestGps(Sul, MeioLng, 0);
        det.IngestGps(Norte, MeioLng, 1000);                // volta 1 (t=1000)
        var e = det.IngestGps(Sul, MeioLng, 91000);         // volta 2, 90 s depois

        Assert.NotNull(e);
        Assert.Equal(2, e!.VoltaN);
        Assert.Equal(90000, e.TempoVoltaMs);
    }

    [Fact]
    public void Debounce_ignora_cruzamento_a_menos_de_5s()
    {
        var det = new ChegadaDetector(A, B);
        det.IngestGps(Sul, MeioLng, 0);
        det.IngestGps(Norte, MeioLng, 1000);                // volta 1
        var ignorado = det.IngestGps(Sul, MeioLng, 3000);   // re-cruza 2 s depois → ignora

        Assert.Null(ignorado);
        Assert.Equal(1, det.Voltas);
    }

    [Fact]
    public void Mudanca_de_lado_longe_da_linha_nao_conta()
    {
        // Mesmo movimento sul→norte, mas bem a leste das pontas da linha: o produto
        // vetorial troca de sinal, porém o segmento caminho×linha NÃO se cruza.
        var det = new ChegadaDetector(A, B);
        det.IngestGps(Sul, -46.9000, 0);
        var e = det.IngestGps(Norte, -46.9000, 1000);
        Assert.Null(e);
        Assert.Equal(0, det.Voltas);
    }

    [Fact]
    public void Mesmo_lado_nao_cruza()
    {
        var det = new ChegadaDetector(A, B);
        det.IngestGps(Sul, MeioLng, 0);
        var e = det.IngestGps(Sul, MeioLng, 1000);          // continua ao sul
        Assert.Null(e);
        Assert.Equal(0, det.Voltas);
    }

    [Fact]
    public void Gps_invalido_e_ignorado()
    {
        var det = new ChegadaDetector(A, B);
        Assert.Null(det.IngestGps(double.NaN, MeioLng, 0));
        Assert.Null(det.IngestGps(Sul, double.PositiveInfinity, 0));
        Assert.Equal(0, det.Voltas);
    }

    [Fact]
    public void Tres_voltas_seguidas_contam_certo()
    {
        var det = new ChegadaDetector(A, B);
        det.IngestGps(Sul, MeioLng, 0);
        Assert.Equal(1, det.IngestGps(Norte, MeioLng, 10000)!.VoltaN);
        Assert.Equal(2, det.IngestGps(Sul,   MeioLng, 20000)!.VoltaN);
        Assert.Equal(3, det.IngestGps(Norte, MeioLng, 30000)!.VoltaN);
        Assert.Equal(3, det.Voltas);
    }
}
