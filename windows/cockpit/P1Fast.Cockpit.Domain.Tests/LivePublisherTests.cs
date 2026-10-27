// Prova do ENVIO AO VIVO sem perder dado (LivePublisher), fora de rede real:
// throttle 5 Hz, queda de internet com reenvio do acumulado, fila cheia descartando
// o mais velho, e a trava dura do canal de produção. Tudo com o canal-fake.

using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class LivePublisherTests
{
    private static T3000Sample Amostra(int rpm = 4000, string source = "t3000-usb", bool plausivel = true) =>
        new() { Rpm = rpm, SpeedKmh = 120, LeituraPlausivel = plausivel, Source = source };

    private static long TWall(object payload) => (long)((IDictionary<string, object?>)payload)["tWall"]!;

    [Fact]
    public async Task Throttle_LimitaEnvioA5Hz()
    {
        var canal = new InMemoryLiveChannel();
        var pub = new LivePublisher(canal, "teste");

        // Oferece a 10 Hz (de 100 em 100 ms). Throttle de 200 ms deixa passar 1 sim, 1 não.
        for (int t = 0; t <= 1000; t += 100) pub.Oferecer(Amostra(), t);
        await pub.DrenarAsync(CancellationToken.None);

        Assert.Equal(6, canal.Publicadas.Count);      // 0,200,400,600,800,1000
        Assert.Equal(6, pub.GetStats().Enviadas);
        Assert.Equal(5, pub.GetStats().Estranguladas); // 100,300,500,700,900
    }

    [Fact]
    public async Task QuedaDeInternet_NaoPerde_EReenviaQuandoVolta()
    {
        var canal = new InMemoryLiveChannel { Online = false }; // internet caída
        var pub = new LivePublisher(canal, "teste");

        // 10 amostras espaçadas 200 ms (todas passam o throttle) durante a queda.
        for (int i = 0; i < 10; i++) pub.Oferecer(Amostra(rpm: 3000 + i), i * 200);
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
        for (int i = 0; i < 10; i++) Assert.Equal(i * 200, TWall(canal.Publicadas[i].Payload)); // ordem preservada
    }

    [Fact]
    public async Task FilaCheia_DescartaOMaisVelho_EConta()
    {
        var canal = new InMemoryLiveChannel { Online = false };
        var pub = new LivePublisher(canal, "teste", config: new LivePublisherConfig(PublishHz: 5, FilaMax: 3));

        for (int i = 0; i < 5; i++) pub.Oferecer(Amostra(), i * 200); // 5 na fila de 3

        Assert.Equal(3, pub.GetStats().NaFila);
        Assert.Equal(2, pub.GetStats().Descartadas);

        canal.Online = true;
        await pub.DrenarAsync(CancellationToken.None);

        // Sobraram os 3 MAIS NOVOS (tWall 400, 600, 800).
        Assert.Equal(3, canal.Publicadas.Count);
        Assert.Equal(400, TWall(canal.Publicadas[0].Payload));
        Assert.Equal(800, TWall(canal.Publicadas[2].Payload));
    }

    [Fact]
    public void CanalProducao_SemAutorizacao_NaoConstroi()
    {
        var canal = new InMemoryLiveChannel();
        Assert.Throws<System.InvalidOperationException>(
            () => new LivePublisher(canal, LivePublisher.CanalProducao, permitirProducao: false));
    }

    [Fact]
    public async Task CanalProducao_RecusaSimulacao_AceitaReal()
    {
        var canal = new InMemoryLiveChannel();
        var pub = new LivePublisher(canal, LivePublisher.CanalProducao, permitirProducao: true);

        pub.Oferecer(Amostra(source: "sim-replay"), 0);   // simulação -> barrada
        pub.Oferecer(Amostra(source: "t3000-usb"), 1000); // real -> aceita
        await pub.DrenarAsync(CancellationToken.None);

        Assert.Equal(1, canal.Publicadas.Count);
        Assert.Equal(1, pub.GetStats().BarradasGuarda);
    }

    [Fact]
    public async Task LeituraForaDeFaixa_Barrada()
    {
        var canal = new InMemoryLiveChannel();
        var pub = new LivePublisher(canal, "teste");

        pub.Oferecer(Amostra(plausivel: false), 0);
        await pub.DrenarAsync(CancellationToken.None);

        Assert.Empty(canal.Publicadas);
        Assert.Equal(1, pub.GetStats().BarradasGuarda);
    }

    // E2 "TV do box ao vivo" (27/10/2026): queda longa NÃO despeja o passado na TV — o ao vivo só
    // leva os últimos ~10 s; o resto é contado (o disco e a gravação guardam tudo).
    [Fact]
    public async Task QuedaLonga_AoVivoSoLevaOsUltimos10s_EConta()
    {
        var canal = new InMemoryLiveChannel { Online = false };
        long relogio = 0;
        var pub = new LivePublisher(canal, "teste", relogioMs: () => relogio);

        for (int i = 0; i < 300; i++) { relogio = i * 200; pub.Oferecer(Amostra(rpm: 3000 + i), i * 200); } // 1 min a 5 Hz
        await pub.DrenarAsync(CancellationToken.None);
        var st = pub.GetStats();
        Assert.InRange(st.NaFila, 50, 51);                   // ~10 s a 5 Hz
        Assert.Equal(300 - st.NaFila, st.ForaDoAoVivo);

        canal.Online = true;
        await pub.DrenarAsync(CancellationToken.None);
        Assert.Equal(299 * 200, TWall(canal.Publicadas[^1].Payload));   // chega até a mais nova
        Assert.True(TWall(canal.Publicadas[0].Payload) >= 49_800);       // nada de mais de 10 s atrás
    }

    [Fact]
    public async Task Controle_QuedaCurta_NadaSaiDoAoVivo()
    {
        var canal = new InMemoryLiveChannel { Online = false };
        long relogio = 0;
        var pub = new LivePublisher(canal, "teste", relogioMs: () => relogio);
        for (int i = 0; i < 40; i++) { relogio = i * 200; pub.Oferecer(Amostra(), i * 200); }   // 8 s
        canal.Online = true;
        await pub.DrenarAsync(CancellationToken.None);
        Assert.Equal(40, canal.Publicadas.Count);
        Assert.Equal(0, pub.GetStats().ForaDoAoVivo);
    }
}
