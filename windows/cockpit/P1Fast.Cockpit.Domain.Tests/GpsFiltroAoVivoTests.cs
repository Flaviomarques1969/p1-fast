// GpsFiltroAoVivo — a MESMA porta de GPS pro cérebro no replay E ao vivo (H3, auditoria
// 2026-07-02). Prova que o gate de qualidade (fix/hacc/caixa) e a decimação por movimento
// (>=3 m, kmh por dist/dt) fazem o que o pipeline provado do replay sempre fez.

using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class GpsFiltroAoVivoTests
{
    // Um ponto dentro da caixa de Brasília.
    private const double Lat = -15.77, Lon = -47.90;

    [Fact]
    public void FLT_01_QualidadeOk_reprova_fix_baixo_hacc_alto_e_fora_da_caixa()
    {
        Assert.True(GpsFiltroAoVivo.QualidadeOk(Lat, Lon, fix: 3, hacc: 10));   // bom
        Assert.False(GpsFiltroAoVivo.QualidadeOk(Lat, Lon, fix: 2, hacc: 10));  // fix < 3
        Assert.False(GpsFiltroAoVivo.QualidadeOk(Lat, Lon, fix: 3, hacc: 50));  // hacc >= 50 (o furo do ao vivo)
        Assert.False(GpsFiltroAoVivo.QualidadeOk(Lat, Lon, fix: 3, hacc: 80));
        Assert.False(GpsFiltroAoVivo.QualidadeOk(-10.0, Lon, fix: 3, hacc: 10)); // fora da caixa (lat)
        Assert.False(GpsFiltroAoVivo.QualidadeOk(Lat, -40.0, fix: 3, hacc: 10)); // fora da caixa (lon)
    }

    [Fact]
    public void FLT_05_Heading_do_pacote_atravessa_o_filtro_sem_ser_inventado()
    {
        // L2: o rumo do PACOTE (RaceBox headMot) chega ao cérebro quando fornecido;
        // omitido → null (cérebro cai no rumo por 2 posições, como sempre).
        var f = new GpsFiltroAoVivo();

        var a = f.Aceitar(Lat, Lon, fix: 3, hacc: 10, tWall: 0, headingDeg: 123.4);
        Assert.NotNull(a);
        Assert.Equal(123.4, a!.HeadingDeg);

        var b = f.Aceitar(Lat, Lon + 0.0001, fix: 3, hacc: 10, tWall: 200); // sem heading
        Assert.NotNull(b);
        Assert.Null(b!.HeadingDeg);

        // Reprovado na qualidade → null (heading junto, óbvio — nada vaza).
        Assert.Null(f.Aceitar(Lat, Lon + 0.0002, fix: 2, hacc: 10, tWall: 400, headingDeg: 90));
    }

    [Fact]
    public void FLT_02_Decima_jitter_parado_e_da_kmh_por_dist_dt_no_movimento()
    {
        var f = new GpsFiltroAoVivo();

        // 1º ponto: passa com kmh=0 (não há anterior).
        var a = f.AceitarValido(new PontoGps(Lat, Lon), tWall: 0);
        Assert.NotNull(a);
        Assert.Equal(0, a!.Kmh);

        // ~1 m adiante (jitter de carro parado): DECIMADO.
        var b = f.AceitarValido(new PontoGps(Lat, Lon + 0.00001), tWall: 100);
        Assert.Null(b);

        // ~10 m adiante do último ACEITO (o 1º): passa, com kmh do GPS (dist/dt) > 0.
        var c = f.AceitarValido(new PontoGps(Lat, Lon + 0.0001), tWall: 200);
        Assert.NotNull(c);
        Assert.True(c!.Kmh > 50, $"esperava kmh de movimento, veio {c.Kmh:0.0}");
    }

    // 5.3b: uma rajada BLE carimbada no mesmo ms (dt~0) NÃO pode gerar km/h absurdo no
    // cérebro (falso freada/ápice, referência de curva envenenada). O par implausível é
    // descartado; o próximo fix compara com o último BOM.
    [Fact]
    public void FLT_06_Rajada_colada_no_mesmo_ms_nao_gera_kmh_absurdo()
    {
        var f = new GpsFiltroAoVivo();

        // 1º ponto: passa (kmh=0, sem anterior).
        var a = f.AceitarValido(new PontoGps(Lat, Lon), tWall: 1000);
        Assert.NotNull(a);

        // ~11 m adiante MAS carimbado 1 ms depois (rajada): sem a guarda daria ~40.000 km/h.
        // Com a guarda (dt<20ms → nominal 40ms), 11 m / 0,04 s ≈ 990 km/h > teto → DESCARTA.
        var b = f.AceitarValido(new PontoGps(Lat, Lon + 0.0001), tWall: 1001);
        Assert.Null(b);

        // O ponto seguinte, bem espaçado, compara com o último BOM (o 1º) e passa são.
        var c = f.AceitarValido(new PontoGps(Lat, Lon + 0.0001), tWall: 1400); // 400 ms depois
        Assert.NotNull(c);
        Assert.True(c!.Kmh <= GpsFiltroAoVivo.KmhTetoPlausivel, $"km/h deveria ser plausível, veio {c.Kmh:0}");
    }

    [Fact]
    public void FLT_07_Movimento_bem_espacado_passa_com_kmh_sao()
    {
        var f = new GpsFiltroAoVivo();
        Assert.NotNull(f.AceitarValido(new PontoGps(Lat, Lon), tWall: 0));

        // ~11 m em 200 ms = ~193 km/h: plausível, NÃO descartado.
        var b = f.AceitarValido(new PontoGps(Lat, Lon + 0.0001), tWall: 200);
        Assert.NotNull(b);
        Assert.True(b!.Kmh > 50 && b.Kmh <= GpsFiltroAoVivo.KmhTetoPlausivel);
    }

    [Fact]
    public void FLT_03_Aceitar_junta_qualidade_e_decimacao_num_passo()
    {
        var f = new GpsFiltroAoVivo();

        // fix bom porém hacc ruim → null mesmo com movimento (o furo que o ao vivo tinha).
        Assert.Null(f.Aceitar(Lat, Lon, fix: 3, hacc: 60, tWall: 0));

        // fix bom + hacc bom → passa (1º ponto, kmh=0).
        var ok = f.Aceitar(Lat, Lon, fix: 3, hacc: 10, tWall: 0);
        Assert.NotNull(ok);
    }
}
