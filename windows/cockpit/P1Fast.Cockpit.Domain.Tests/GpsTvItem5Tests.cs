// CATRACA do item 5 (TV do box) da ordem do GPS aprovada pelo Flávio em 27/10/2026:
// o notebook publica no canal o G do CARRO (gLong/gLat/zeroOk) pela MESMA peça do cérebro
// (AceleracaoCarro.Converter), sem aprender o zero de novo. A conta da TV fica no web
// (cerebro-gps-tv.js, catraca tests/node-smoke-gps-tv.mjs). Cada regra tem controle oposto.

using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class GpsTvItem5Tests
{
    private const double Z0x = -0.048, Z0y = 0.035;   // zero medido parado em 27/10 (eixos.txt)

    private static void Parar(AceleracaoCarro a, int n, double gx = Z0x, double gy = Z0y)
    {
        for (int i = 0; i < n; i++) a.Ler(0, gx, gy);
    }

    [Fact]
    public void T1_converter_da_o_mesmo_G_que_o_Ler_depois_do_zero()
    {
        var a = new AceleracaoCarro();
        Parar(a, AceleracaoCarro.LeiturasMinZero);
        var c = a.Converter(Z0x + 0.30, Z0y - 0.20)!.Value;
        var l = a.Ler(80, Z0x + 0.30, Z0y - 0.20)!.Value;
        Assert.Equal(l, c);
        Assert.Equal(0.30, c.Long, 6);
        Assert.Equal(0.20, c.Lat, 6);
        Assert.True(c.ZeroOk);
    }

    [Fact]
    public void T2_converter_nao_aprende_zero_controle_Ler_aprende()
    {
        // Leituras PARADAS passadas só pelo Converter não fazem zero (quem aprende é o filtro).
        var a = new AceleracaoCarro();
        for (int i = 0; i < AceleracaoCarro.JanelaMaxZero; i++) a.Converter(Z0x, Z0y);
        Assert.False(a.ZeroOk);
        Assert.Equal(0, a.ZeroX);
        var cru = a.Converter(0.10, 0.20)!.Value;
        Assert.False(cru.ZeroOk);
        Assert.Equal(0.10, cru.Long, 6);
        Assert.Equal(-0.20, cru.Lat, 6);

        // Controle: as mesmas leituras pelo Ler fazem o zero valer.
        var b = new AceleracaoCarro();
        Parar(b, AceleracaoCarro.LeiturasMinZero);
        Assert.True(b.ZeroOk);
    }

    [Fact]
    public void T3_converter_nao_muda_o_zero_vigente_nem_a_contagem_da_parada()
    {
        var a = new AceleracaoCarro();
        Parar(a, AceleracaoCarro.LeiturasMinZero);
        // Leituras bem diferentes pelo Converter (o canal publica cada fix) não mexem no zero…
        for (int i = 0; i < 50; i++) a.Converter(0.5, -0.5);
        Assert.Equal(Z0x, a.ZeroX, 6);
        Assert.Equal(Z0y, a.ZeroY, 6);
        // …nem quebram uma parada em curso (Ler segue contando a mesma janela).
        var b = new AceleracaoCarro();
        Parar(b, AceleracaoCarro.LeiturasMinZero - 1, 0.02, 0.03);
        b.Converter(0.9, 0.9);
        Parar(b, 1, 0.02, 0.03);
        Assert.True(b.ZeroOk);
        Assert.Equal(0.02, b.ZeroX, 6);
    }

    [Fact]
    public void T4_sem_aceleracao_null_controle_com_aceleracao_valor()
    {
        var a = new AceleracaoCarro();
        Assert.Null(a.Converter(null, 0.1));
        Assert.Null(a.Converter(0.1, null));
        Assert.Null(a.Converter(double.NaN, 0.1));
        Assert.NotNull(a.Converter(0.1, 0.1));
    }
}
