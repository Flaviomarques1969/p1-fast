using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class ConnectivityTrackerTests
{
    [Fact]
    public void Comeca_online()
    {
        Assert.True(new ConnectivityTracker().Online);
    }

    [Fact]
    public void Falhas_abaixo_do_limite_nao_derrubam()
    {
        var t = new ConnectivityTracker(limiteFalhas: 3);
        Assert.Equal(ConnTransicao.Nenhuma, t.Registrar(false));
        Assert.Equal(ConnTransicao.Nenhuma, t.Registrar(false));
        Assert.True(t.Online);
    }

    [Fact]
    public void No_limite_de_falhas_declara_caiu_uma_vez_so()
    {
        var t = new ConnectivityTracker(limiteFalhas: 3);
        t.Registrar(false);
        t.Registrar(false);
        Assert.Equal(ConnTransicao.Caiu, t.Registrar(false));   // 3ª falha
        Assert.Equal(ConnTransicao.Nenhuma, t.Registrar(false)); // já caiu, não repete
        Assert.False(t.Online);
    }

    [Fact]
    public void Um_sucesso_apos_queda_religa()
    {
        var t = new ConnectivityTracker(limiteFalhas: 2);
        t.Registrar(false);
        t.Registrar(false); // caiu
        Assert.False(t.Online);
        Assert.Equal(ConnTransicao.Voltou, t.Registrar(true));
        Assert.True(t.Online);
        Assert.Equal(ConnTransicao.Nenhuma, t.Registrar(true)); // estável, sem repetir
    }

    [Fact]
    public void Sucesso_zera_contador_evitando_falso_caiu()
    {
        var t = new ConnectivityTracker(limiteFalhas: 3);
        t.Registrar(false);
        t.Registrar(false);
        t.Registrar(true);                                      // zera
        Assert.Equal(ConnTransicao.Nenhuma, t.Registrar(false));
        Assert.Equal(ConnTransicao.Nenhuma, t.Registrar(false));
        Assert.True(t.Online);                                  // só 2 seguidas após o reset
    }
}
