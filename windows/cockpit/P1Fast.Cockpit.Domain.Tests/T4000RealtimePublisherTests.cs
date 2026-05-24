// Cobertura T4000RealtimePublisher: throttle 10Hz, payload completo,
// integracao com Provider, erro de publicacao nao quebra fluxo.

using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class T4000RealtimePublisherTests
{
    private static T4000ProviderSample MakeSample(double tMono, int rpm = 1000, bool ok = true)
    {
        var t = new T4000Sample(
            Rpm: rpm, SpeedKmh: 100, OilPressBar: 4, OilTempC: 90,
            WaterTempC: 90, FuelPressBar: 3.5, BatteryV: 14, TpsPct: 25,
            MapBar: 0.7, AirTempC: 38, EgtC: 600, EgtOutOfRange: false, Lambda: 0.98,
            FuelTempC: 40, Marcha: 4, EcuErrorBits: 0);
        return new T4000ProviderSample(t, tMono, ok);
    }

    [Fact]
    public void PUB_01_primeiro_sample_publica_imediatamente()
    {
        var client = new InMemoryRealtimeClient();
        var pub = new T4000RealtimePublisher(client, channel: "live-stint-abc");

        pub.HandleSample(MakeSample(tMono: 0));

        Assert.Single(client.Published);
        Assert.Equal("live-stint-abc", client.Published[0].Channel);
        Assert.Equal(0, client.Published[0].Payload.TMono);
    }

    [Fact]
    public void PUB_02_throttle_descarta_samples_dentro_da_janela_de_100ms()
    {
        var client = new InMemoryRealtimeClient();
        var pub = new T4000RealtimePublisher(client, channel: "live-stint-abc");

        pub.HandleSample(MakeSample(tMono: 0, rpm: 1000));
        pub.HandleSample(MakeSample(tMono: 50, rpm: 1100));  // dentro da janela → descarta
        pub.HandleSample(MakeSample(tMono: 99, rpm: 1200));  // ainda dentro → descarta
        pub.HandleSample(MakeSample(tMono: 100, rpm: 1300)); // bate o limite → publica
        pub.HandleSample(MakeSample(tMono: 199, rpm: 1400)); // dentro → descarta
        pub.HandleSample(MakeSample(tMono: 250, rpm: 1500)); // > 100 desde a última → publica

        Assert.Equal(3, client.Published.Count);
        Assert.Equal(1000, client.Published[0].Payload.Rpm);
        Assert.Equal(1300, client.Published[1].Payload.Rpm);
        Assert.Equal(1500, client.Published[2].Payload.Rpm);

        var stats = pub.GetStats();
        Assert.Equal(6, stats.SamplesReceived);
        Assert.Equal(3, stats.SamplesPublished);
        Assert.Equal(3, stats.SamplesSkipped);
    }

    [Fact]
    public void PUB_03_payload_completo_inclui_todas_as_grandezas_e_flag_de_checksum()
    {
        var client = new InMemoryRealtimeClient();
        var pub = new T4000RealtimePublisher(client, channel: "live-stint-xyz");

        var sim = new T4000Simulator();
        sim.ApplyScenario(T4000Scenario.OverheatWater);
        var cycle = sim.EmitCycle();
        var parsed = T4000PacketParser.ParseCycle(cycle);
        var providerSample = new T4000ProviderSample(parsed.Sample, TMono: 1234.0, ChecksumOk: parsed.Ok);

        pub.HandleSample(providerSample);

        var pub0 = client.Published[0].Payload;
        Assert.Equal(115, pub0.WaterTempC, 1);
        Assert.Equal(110, pub0.OilTempC, 1);
        Assert.Equal(4500, pub0.Rpm);
        Assert.Equal(4, pub0.Marcha);
        Assert.True(pub0.ChecksumOk);
        Assert.Equal(1234.0, pub0.TMono);
    }

    [Fact]
    public void PUB_04_intervalo_minimo_customizavel()
    {
        var client = new InMemoryRealtimeClient();
        var pub = new T4000RealtimePublisher(client, channel: "live-stint-abc", minIntervalMs: 500);

        pub.HandleSample(MakeSample(tMono: 0));
        pub.HandleSample(MakeSample(tMono: 250)); // dentro de 500 → descarta
        pub.HandleSample(MakeSample(tMono: 499)); // dentro de 500 → descarta
        pub.HandleSample(MakeSample(tMono: 500)); // bate → publica

        Assert.Equal(2, client.Published.Count);
    }

    [Fact]
    public void PUB_05_erro_no_cliente_e_capturado_no_callback_sem_quebrar_o_fluxo()
    {
        var errors = new List<Exception>();
        var brokenClient = new BrokenRealtimeClient();
        var pub = new T4000RealtimePublisher(
            brokenClient,
            channel: "live-stint-abc",
            onPublishError: e => errors.Add(e));

        pub.HandleSample(MakeSample(tMono: 0));
        pub.HandleSample(MakeSample(tMono: 200));

        var stats = pub.GetStats();
        Assert.Equal(2, stats.SamplesReceived);
        Assert.Equal(0, stats.SamplesPublished);
        Assert.Equal(2, stats.PublishErrors);
        Assert.Equal(2, errors.Count);
    }

    [Fact]
    public void PUB_06_canal_vazio_rejeitado()
    {
        var client = new InMemoryRealtimeClient();
        Assert.Throws<ArgumentException>(() =>
            new T4000RealtimePublisher(client, channel: ""));
    }

    [Fact]
    public void PUB_07_integracao_provider_publisher_a_10Hz()
    {
        var client = new InMemoryRealtimeClient();
        var pub = new T4000RealtimePublisher(client, channel: "live-stint-int");

        var tMono = 0.0;
        var provider = new T4000Provider(onT4000Sample: pub.HandleSample, now: () => tMono);

        var sim = new T4000Simulator();
        sim.ApplyScenario(T4000Scenario.Cruise);
        var cycle = sim.EmitPackets();

        // 20 ciclos a 50ms cada = 1000ms total → 20 ciclos recebidos, ~10 publicados.
        for (var c = 0; c < 20; c++)
        {
            tMono = c * 50.0;
            foreach (var pkt in cycle) provider.FeedPacket(pkt);
        }

        Assert.InRange(client.Published.Count, 9, 11);
    }

    private sealed class BrokenRealtimeClient : IRealtimeClient
    {
        public Task PublishAsync(string channel, T4000RealtimePayload payload, CancellationToken cancellationToken)
            => throw new InvalidOperationException("simulando rede caída");
    }
}
