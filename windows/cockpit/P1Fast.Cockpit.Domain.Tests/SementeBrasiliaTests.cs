// SementeBrasilia: a linha de chegada embarcada (meio da reta dos boxes) fecha
// volta quando o GPS cruza. Pontos calculados straddleando a linha semente.

using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class SementeBrasiliaTests
{
    // Dois pontos no rumo da reta que cruzam a linha de chegada semente (u=v=0.5).
    private static readonly (double lat, double lng) Antes  = (-15.7729301, -47.9001924);
    private static readonly (double lat, double lng) Depois = (-15.7727539, -47.8996626);

    [Fact]
    public void Linha_de_chegada_semente_fecha_volta_no_cruzamento()
    {
        var det = SementeBrasilia.NovoDetectorChegada();
        Assert.Null(det.IngestGps(Antes.lat, Antes.lng, 0));
        var e = det.IngestGps(Depois.lat, Depois.lng, 1000);

        Assert.NotNull(e);
        Assert.Equal(1, e!.VoltaN);
        Assert.Equal(1, det.Voltas);
    }

    [Fact]
    public void Pontas_da_linha_sao_distintas_e_plausiveis()
    {
        Assert.NotEqual(SementeBrasilia.ChegadaA, SementeBrasilia.ChegadaB);
        // Brasília fica em ~ -15.77, -47.90.
        Assert.InRange(SementeBrasilia.ChegadaA.Lat, -15.78, -15.77);
        Assert.InRange(SementeBrasilia.ChegadaA.Lng, -47.91, -47.89);
    }
}
