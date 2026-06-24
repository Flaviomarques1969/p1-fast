// Troca de telas por movimento: parado → painel de sensores; andando → cockpit.
// Foco na histerese (não piscar no limiar).

using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class ModoTelaDetectorTests
{
    [Fact]
    public void Comeca_parado()
    {
        Assert.Equal(ModoTela.Parado, new ModoTelaDetector().Modo);
    }

    [Fact]
    public void Abaixo_do_limiar_continua_parado()
    {
        var d = new ModoTelaDetector(entraAndandoKmh: 6, voltaParadoKmh: 2);
        Assert.False(d.Atualizar(0));
        Assert.False(d.Atualizar(5.9));
        Assert.Equal(ModoTela.Parado, d.Modo);
    }

    [Fact]
    public void Cruzar_o_limiar_entra_em_andando_uma_vez()
    {
        var d = new ModoTelaDetector(entraAndandoKmh: 6, voltaParadoKmh: 2);
        Assert.True(d.Atualizar(6));               // mudou
        Assert.Equal(ModoTela.Andando, d.Modo);
        Assert.False(d.Atualizar(40));             // já andando, não repete
    }

    [Fact]
    public void Histerese_nao_volta_pra_parado_na_zona_morta()
    {
        var d = new ModoTelaDetector(entraAndandoKmh: 6, voltaParadoKmh: 2);
        d.Atualizar(10);                           // andando
        Assert.False(d.Atualizar(3));              // entre 2 e 6 → segue andando
        Assert.Equal(ModoTela.Andando, d.Modo);
    }

    [Fact]
    public void Abaixo_do_piso_volta_pra_parado()
    {
        var d = new ModoTelaDetector(entraAndandoKmh: 6, voltaParadoKmh: 2);
        d.Atualizar(10);
        Assert.True(d.Atualizar(2));               // <= piso → volta a parado
        Assert.Equal(ModoTela.Parado, d.Modo);
    }

    [Fact]
    public void Valores_invalidos_nao_quebram()
    {
        var d = new ModoTelaDetector();
        Assert.False(d.Atualizar(double.NaN));
        Assert.False(d.Atualizar(double.PositiveInfinity));
        Assert.Equal(ModoTela.Parado, d.Modo);
    }

    [Fact]
    public void Limiares_invertidos_sao_normalizados()
    {
        // Mesmo passando trocado, entra/volta com histerese coerente.
        var d = new ModoTelaDetector(entraAndandoKmh: 2, voltaParadoKmh: 6);
        Assert.True(d.Atualizar(6));
        Assert.Equal(ModoTela.Andando, d.Modo);
    }
}
