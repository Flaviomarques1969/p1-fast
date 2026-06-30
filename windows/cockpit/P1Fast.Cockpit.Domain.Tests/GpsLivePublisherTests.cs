// Prova do ENVIO AO VIVO do GPS sem perder fix (GpsLivePublisher), fora de rede real:
// enfileira todo fix (sem throttle), queda de internet com reenvio do acumulado em
// ordem, fila cheia descartando o mais velho, e a trava dura do canal de produção.
// Tudo com o canal-fake (InMemoryLiveChannel), igual ao do motor.

using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class GpsLivePublisherTests
{
    // Fix no formato EXATO do contrato (cloud-bridge.js evento 'gps').
    private static IDictionary<string, object?> Fix(double lat = -15.77, double lng = -47.90, double kmh = 120, long tWall = 0) =>
        new Dictionary<string, object?>
        {
            ["lat"] = lat, ["lng"] = lng, ["kmh"] = kmh,
            ["numSV"] = 12, ["fix"] = 3, ["accM"] = 1.0, ["tWall"] = tWall,
        };

    private static long TWall(object payload) => (long)((IDictionary<string, object?>)payload)["tWall"]!;

    [Fact]
    public async Task EnfileiraTodoFix_SemThrottle_EnviaNaOrdem()
    {
        var canal = new InMemoryLiveChannel();
        var pub = new GpsLivePublisher(canal, "teste");

        // 25 Hz (40 em 40 ms): NENHUM é estrangulado — GPS é lossless.
        for (int t = 0; t <= 400; t += 40) pub.Oferecer(Fix(tWall: t));
        await pub.DrenarAsync(CancellationToken.None);

        Assert.Equal(11, canal.Publicadas.Count);                 // 0,40,...,400
        Assert.Equal("gps", canal.Publicadas[0].Evento);          // evento certo
        Assert.Equal(11, pub.GetStats().Enviadas);
        for (int i = 0; i <= 10; i++) Assert.Equal(i * 40, TWall(canal.Publicadas[i].Payload));
    }

    [Fact]
    public async Task QuedaDeInternet_NaoPerde_EReenviaQuandoVolta()
    {
        var canal = new InMemoryLiveChannel { Online = false }; // internet caída
        var pub = new GpsLivePublisher(canal, "teste");

        for (int i = 0; i < 10; i++) pub.Oferecer(Fix(kmh: 100 + i, tWall: i * 40));
        await pub.DrenarAsync(CancellationToken.None);     // offline: não envia nada

        Assert.Empty(canal.Publicadas);
        Assert.Equal(10, pub.GetStats().NaFila);
        Assert.Equal("offline-enfileirando", pub.Saude());

        // Internet volta -> drena TODO o acumulado, em ordem.
        canal.Online = true;
        await pub.DrenarAsync(CancellationToken.None);

        Assert.Equal(10, canal.Publicadas.Count);
        Assert.Equal(10, pub.GetStats().Enviadas);
        Assert.Equal(0, pub.GetStats().NaFila);
        for (int i = 0; i < 10; i++) Assert.Equal(i * 40, TWall(canal.Publicadas[i].Payload)); // ordem preservada
    }

    [Fact]
    public async Task FilaCheia_DescartaOMaisVelho_EConta()
    {
        var canal = new InMemoryLiveChannel { Online = false };
        var pub = new GpsLivePublisher(canal, "teste", filaMax: 3);

        for (int i = 0; i < 5; i++) pub.Oferecer(Fix(tWall: i * 40)); // 5 numa fila de 3

        Assert.Equal(3, pub.GetStats().NaFila);
        Assert.Equal(2, pub.GetStats().Descartadas);

        canal.Online = true;
        await pub.DrenarAsync(CancellationToken.None);

        // Sobraram os 3 MAIS NOVOS (tWall 80, 120, 160).
        Assert.Equal(3, canal.Publicadas.Count);
        Assert.Equal(80, TWall(canal.Publicadas[0].Payload));
        Assert.Equal(160, TWall(canal.Publicadas[2].Payload));
    }

    [Fact]
    public async Task QuedaNoMeioDoDreno_SeguraOResto_EReenvia()
    {
        var canal = new InMemoryLiveChannel();
        var pub = new GpsLivePublisher(canal, "teste");

        for (int i = 0; i < 5; i++) pub.Oferecer(Fix(tWall: i * 40));
        canal.FalharProximosEnvios = 1;          // 1 hiccup de envio, depois recupera
        await pub.DrenarAsync(CancellationToken.None);

        Assert.Empty(canal.Publicadas);          // parou no 1º envio que falhou
        Assert.Equal(5, pub.GetStats().NaFila);  // nada perdido

        await pub.DrenarAsync(CancellationToken.None); // 2ª passada: nuvem ok
        Assert.Equal(5, canal.Publicadas.Count);
        Assert.Equal(0, pub.GetStats().NaFila);
        Assert.Equal(0, TWall(canal.Publicadas[0].Payload)); // ordem mantida
    }

    [Fact]
    public void CanalProducao_SemAutorizacao_NaoConstroi()
    {
        var canal = new InMemoryLiveChannel();
        Assert.Throws<System.InvalidOperationException>(
            () => new GpsLivePublisher(canal, GpsLivePublisher.CanalProducao, permitirProducao: false));
    }

    [Fact]
    public async Task CanalProducao_ComAutorizacao_Publica()
    {
        var canal = new InMemoryLiveChannel();
        var pub = new GpsLivePublisher(canal, GpsLivePublisher.CanalProducao, permitirProducao: true);

        pub.Oferecer(Fix(tWall: 0));
        await pub.DrenarAsync(CancellationToken.None);

        Assert.Single(canal.Publicadas);
        Assert.Equal("gps", canal.Publicadas[0].Evento);
    }
}
