// CATRACA do item 7 (pancadas e consistência) da ordem do GPS aprovada pelo Flávio em 27/10/2026:
// o G VERTICAL do carro (gVert = gz − zero de gz da MESMA parada; + = para cima) sai da MESMA peça
// (AceleracaoCarro) que já faz Long/Lat. A contagem das pancadas e a consistência ficam no web
// (cerebro-gps-tv.js, catraca tests/node-smoke-gps-tv.mjs). Cada regra tem controle oposto.

using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class GpsTvItem7Tests
{
    private const double Z0x = -0.048, Z0y = 0.035, Z0z = 1.013;   // zero medido parado em 27/10 (eixos.txt)

    private static void Parar(AceleracaoCarro a, int n, double? gz = Z0z)
    {
        for (int i = 0; i < n; i++) a.Ler(0, Z0x, Z0y, gz);
    }

    [Fact]
    public void V1_zero_de_gz_aprende_na_mesma_parada_e_desconta()
    {
        var a = new AceleracaoCarro();
        Parar(a, AceleracaoCarro.LeiturasMinZero);
        Assert.Equal(Z0z, a.ZeroZ, 6);
        var g = a.Ler(80, Z0x, Z0y, Z0z + 0.30)!.Value;
        Assert.Equal(0.30, g.Vert!.Value, 6);
        Assert.Equal(-0.20, a.Ler(80, Z0x, Z0y, Z0z - 0.20)!.Value.Vert!.Value, 6);
        // Controle: parada curta demais (< 1 s) não faz zero de gz — fica a gravidade nominal.
        var b = new AceleracaoCarro();
        Parar(b, AceleracaoCarro.LeiturasMinZero - 1);
        Assert.Equal(AceleracaoCarro.GravidadeNominal, b.ZeroZ, 6);
    }

    [Fact]
    public void V2_sem_zero_ainda_desconta_a_gravidade_nominal()
    {
        var a = new AceleracaoCarro();
        var g = a.Ler(80, 0.0, 0.0, 1.25)!.Value;
        Assert.False(g.ZeroOk);
        Assert.Equal(0.25, g.Vert!.Value, 6);
    }

    [Fact]
    public void V3_sem_gz_Vert_null_e_Long_Lat_iguais_com_ou_sem_gz()
    {
        var com = new AceleracaoCarro();
        var sem = new AceleracaoCarro();
        Parar(com, AceleracaoCarro.LeiturasMinZero);
        Parar(sem, AceleracaoCarro.LeiturasMinZero, gz: null);
        var gc = com.Ler(80, Z0x + 0.3, Z0y - 0.2, 1.4)!.Value;
        var gs = sem.Ler(80, Z0x + 0.3, Z0y - 0.2)!.Value;
        Assert.Null(gs.Vert);
        Assert.NotNull(gc.Vert);
        Assert.Equal(gs.Long, gc.Long, 9);
        Assert.Equal(gs.Lat, gc.Lat, 9);
        Assert.Equal(gs.ZeroOk, gc.ZeroOk);
        // gz não finito = sem gz (não vira NaN na tela).
        Assert.Null(com.Ler(80, Z0x, Z0y, double.NaN)!.Value.Vert);
    }

    [Fact]
    public void V4_parada_sem_gz_faz_zero_de_Long_Lat_mas_nao_de_gz()
    {
        var a = new AceleracaoCarro();
        Parar(a, AceleracaoCarro.LeiturasMinZero, gz: null);
        Assert.True(a.ZeroOk);
        Assert.Equal(AceleracaoCarro.GravidadeNominal, a.ZeroZ, 6);
        // Controle: a próxima parada COM gz aprende o zero de gz.
        a.Ler(80, Z0x, Z0y, 1.0);
        Parar(a, AceleracaoCarro.LeiturasMinZero);
        Assert.Equal(Z0z, a.ZeroZ, 6);
    }

    [Fact]
    public void V5_janela_movel_do_zero_de_gz_esquece_as_leituras_antigas()
    {
        var a = new AceleracaoCarro();
        Parar(a, AceleracaoCarro.JanelaMaxZero, gz: 0.90);
        Assert.Equal(0.90, a.ZeroZ, 6);
        Parar(a, AceleracaoCarro.JanelaMaxZero, gz: 1.10);   // a mesma parada continua: só valem as últimas N
        Assert.Equal(1.10, a.ZeroZ, 6);
    }

    [Fact]
    public void V6_converter_traz_Vert_sem_aprender_o_zero_de_gz()
    {
        var a = new AceleracaoCarro();
        for (int i = 0; i < AceleracaoCarro.JanelaMaxZero; i++) a.Converter(Z0x, Z0y, 0.70);
        Assert.Equal(AceleracaoCarro.GravidadeNominal, a.ZeroZ, 6);
        Assert.Equal(-0.30, a.Converter(Z0x, Z0y, 0.70)!.Value.Vert!.Value, 6);
        // Controle: depois do zero aprendido pelo Ler, o Converter dá o MESMO Vert do Ler.
        Parar(a, AceleracaoCarro.LeiturasMinZero);
        Assert.Equal(a.Ler(80, Z0x, Z0y, 1.2), a.Converter(Z0x, Z0y, 1.2));
    }

    [Fact]
    public void V7_filtro_ao_vivo_passa_o_gz_para_a_peca_do_G()
    {
        // O filtro alimenta o zero com az: parado com gz 1,013 → zero de gz 1,013.
        var f = new GpsFiltroAoVivo();
        for (int i = 0; i < AceleracaoCarro.LeiturasMinZero; i++)
            f.Aceitar(-15.7464, -47.8497, 3, 1, 1000 + i * 40, kmhAparelho: 0, ax: Z0x, ay: Z0y, az: Z0z);
        Assert.Equal(Z0z, f.Acel.ZeroZ, 6);
    }
}
