// Cobertura T4000SerialReader: ingestao sincrona, fatiamento em pacotes de 8,
// integracao com simulador, loop assincrono com porta em memoria.

using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class T4000SerialReaderTests
{
    [Fact]
    public void RDR_01_IngestBytes_um_ciclo_completo_dispara_um_sample()
    {
        var port = new InMemorySerialBytePort();
        T4000ProviderSample? captured = null;
        var provider = new T4000Provider(onT4000Sample: s => captured = s, now: () => 100.0);
        var reader = new T4000SerialReader(port, provider);

        var sim = new T4000Simulator();
        sim.ApplyScenario(T4000Scenario.Cruise);
        reader.IngestBytes(sim.EmitBytes());

        Assert.NotNull(captured);
        Assert.True(captured!.ChecksumOk);
        Assert.Equal(3500, captured.Telemetry.Rpm);

        var stats = reader.GetStats();
        Assert.Equal(40, stats.BytesRead);
        Assert.Equal(5,  stats.PacketsFed);
        Assert.Equal(0,  stats.PendingBufferBytes);
    }

    [Fact]
    public void RDR_02_IngestBytes_fragmentado_em_pedacos_pequenos_ainda_monta_ciclo()
    {
        var port = new InMemorySerialBytePort();
        T4000ProviderSample? captured = null;
        var provider = new T4000Provider(onT4000Sample: s => captured = s);
        var reader = new T4000SerialReader(port, provider);

        var sim = new T4000Simulator();
        sim.ApplyScenario(T4000Scenario.Idle);
        var allBytes = sim.EmitBytes();

        // Quebra em pedaços de 3 bytes (não múltiplo de 8) pra estressar o buffer.
        for (var i = 0; i < allBytes.Length; i += 3)
        {
            var n = Math.Min(3, allBytes.Length - i);
            var chunk = new byte[n];
            Array.Copy(allBytes, i, chunk, 0, n);
            reader.IngestBytes(chunk);
        }

        Assert.NotNull(captured);
        Assert.True(captured!.ChecksumOk);
        Assert.Equal(850, captured.Telemetry.Rpm);
        Assert.Equal(0, reader.GetStats().PendingBufferBytes);
    }

    [Fact]
    public void RDR_03_IngestBytes_multiplos_ciclos_disparam_multiplos_samples()
    {
        var port = new InMemorySerialBytePort();
        var captured = new List<T4000ProviderSample>();
        var provider = new T4000Provider(onT4000Sample: s => captured.Add(s));
        var reader = new T4000SerialReader(port, provider);

        var sim = new T4000Simulator();
        sim.ApplyScenario(T4000Scenario.Cruise);
        var cycle = sim.EmitBytes();

        // 5 ciclos = 200 bytes.
        for (var i = 0; i < 5; i++) reader.IngestBytes(cycle);

        Assert.Equal(5, captured.Count);
        foreach (var s in captured) Assert.True(s.ChecksumOk);
        Assert.Equal(25, reader.GetStats().PacketsFed); // 5 ciclos × 5 pacotes
    }

    [Fact]
    public async Task RDR_04_RunAsync_para_quando_porta_devolve_EOF()
    {
        var port = new InMemorySerialBytePort();
        T4000ProviderSample? captured = null;
        var provider = new T4000Provider(onT4000Sample: s => captured = s);
        var reader = new T4000SerialReader(port, provider, readChunkBytes: 16);

        var sim = new T4000Simulator();
        sim.ApplyScenario(T4000Scenario.Redline);
        port.Push(sim.EmitBytes());
        port.Close();

        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(2));
        await reader.RunAsync(cts.Token);

        Assert.NotNull(captured);
        Assert.True(captured!.ChecksumOk);
        Assert.Equal(7450, captured.Telemetry.Rpm);
    }

    [Fact]
    public async Task RDR_05_RunAsync_respeita_cancellation_token()
    {
        var port = new InMemorySerialBytePort();
        var provider = new T4000Provider(onT4000Sample: _ => { });
        var reader = new T4000SerialReader(port, provider);

        using var cts = new CancellationTokenSource();
        var task = reader.RunAsync(cts.Token);

        // Sem dados, porta aberta — RunAsync deve continuar até cancelar.
        await Task.Delay(50);
        Assert.False(task.IsCompleted);

        cts.Cancel();
        await task; // não lança OperationCanceledException — o reader trata
    }

    [Fact]
    public void RDR_06_chunk_minimo_e_8_bytes()
    {
        var port = new InMemorySerialBytePort();
        var provider = new T4000Provider(onT4000Sample: _ => { });
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new T4000SerialReader(port, provider, readChunkBytes: 4));
    }
}
