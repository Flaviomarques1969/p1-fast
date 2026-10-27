// Prova do letreiro de saúde do AO VIVO (E2 "TV do box ao vivo", 27/10/2026, achado N4): quem está
// no notebook vê se o box recebe, se caiu (e há quanto tempo), se está atrasado ou sem GPS.

using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class LetreiroAoVivoTests
{
    private static GpsLivePublisherStats Gps(int naFila = 0, long? desde = 100) =>
        new(Enviadas: 0, NaFila: naFila, Descartadas: 0, Erros: 0, MsDesdeUltimoEnvio: desde);

    [Fact]
    public void Partida_SemCanalAinda_DizConectando_NaoCaiu()
    {
        var l = new LetreiroAoVivo();
        Assert.Equal("AO VIVO: conectando à nuvem…", l.Atualizar(0, online: false, Gps(desde: null)));
    }

    [Fact]
    public void Normal_DizOk()
    {
        var l = new LetreiroAoVivo();
        Assert.Equal("AO VIVO OK", l.Atualizar(1000, online: true, Gps(desde: 150)));
    }

    [Fact]
    public void Queda_DizHaQuantoTempo_EOQueEstaEsperando()
    {
        var l = new LetreiroAoVivo();
        l.Atualizar(0, true, Gps());
        Assert.StartsWith("AO VIVO CAIU há 0 s · religando", l.Atualizar(1_000, false, Gps()));
        Assert.Equal("AO VIVO CAIU há 12 s · religando · 250 pontos esperando (o disco grava tudo)",
            l.Atualizar(13_000, false, Gps(naFila: 250)));
        Assert.Equal("AO VIVO CAIU há 2 min · religando", l.Atualizar(121_000, false, Gps()));
    }

    [Fact]
    public void Volta_ComFilaGrande_DizAtrasado_DepoisOk_EZeraOTempoDeQueda()
    {
        var l = new LetreiroAoVivo();
        l.Atualizar(0, true, Gps());
        l.Atualizar(5_000, false, Gps(naFila: 250));
        Assert.Equal("AO VIVO ATRASADO · reenviando 250 pontos", l.Atualizar(9_000, true, Gps(naFila: 250)));
        Assert.Equal("AO VIVO OK", l.Atualizar(9_200, true, Gps(naFila: 3)));
        Assert.StartsWith("AO VIVO CAIU há 0 s", l.Atualizar(20_000, false, Gps()));   // queda nova conta do zero
    }

    [Fact]
    public void NuvemOk_MasGpsParou_DizSemGps()
    {
        var l = new LetreiroAoVivo();
        Assert.Equal("AO VIVO: nuvem OK · esperando o GPS", l.Atualizar(0, true, Gps(desde: null)));
        Assert.Equal("AO VIVO: nuvem OK · sem GPS para enviar há 8 s", l.Atualizar(1, true, Gps(desde: 8_000)));
        Assert.Equal("AO VIVO OK", l.Atualizar(2, true, Gps(desde: 3_000)));   // controle: no limite ainda é ok
    }
}
