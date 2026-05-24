// p1fast-t4000-live-demo — demonstração fim-a-fim do pipeline T4000 sem
// hardware real.
//
// Pluga em sequência:
//   Simulador → Porta em memória → Leitor ao vivo → Provider → Bridge → CockpitState
//                                                            └→ Publicador Realtime (fake)
//
// O console imprime o estado do painel (shift light, alerta crítico) e o
// que seria publicado pro Supabase, em tempo real.
//
// Modo padrão: cicla pelos cenários (Idle → Cruise → Accelerating →
// NearRedline → Redline → Overrev → OverheatWater → LowOilPressure → EcuError)
// a cada 3 segundos. Mostra como o painel reage.
//
// Uso pelo Flávio: `dotnet run` ou rodar o .exe empacotado. Aperta Q ou Esc
// pra sair.

using System.Globalization;
using P1Fast.Cockpit.Domain;

namespace P1Fast.Cockpit.T4000LiveDemo;

internal static class CancellationExtensions
{
    /// <summary>Devolve uma Task que completa quando o token for cancelado.</summary>
    public static Task AsTaskCompletion(this CancellationToken token)
    {
        var tcs = new TaskCompletionSource<object?>(TaskCreationOptions.RunContinuationsAsynchronously);
        token.Register(() => tcs.TrySetResult(null));
        return tcs.Task;
    }
}

internal static class Program
{
    private const int CycleIntervalMs   = 50;   // T4000 real: 50ms entre ciclos = 20Hz
    private const int ScenarioHoldMs    = 3000; // troca de cenário a cada 3s
    private const string DemoChannel    = "live-stint-demo";

    private static readonly T4000Scenario[] ScenarioCycle = new[]
    {
        T4000Scenario.Idle,
        T4000Scenario.Cruise,
        T4000Scenario.Accelerating,
        T4000Scenario.NearRedline,
        T4000Scenario.Redline,
        T4000Scenario.Overrev,
        T4000Scenario.OverheatWater,
        T4000Scenario.LowOilPressure,
        T4000Scenario.EcuError,
    };

    private static async Task<int> Main(string[] args)
    {
        if (args.Any(a => a is "--help" or "-h" or "/?"))
        {
            PrintHelp();
            return 0;
        }

        Console.OutputEncoding = System.Text.Encoding.UTF8;
        Console.WriteLine("=== P1 Fast — Demonstração T4000 (sem carro) ===");
        Console.WriteLine();
        Console.WriteLine("Simula a central Injepro T4000 cospindo dados pelo cabo USB,");
        Console.WriteLine("e mostra como o painel do piloto reagiria.");
        Console.WriteLine();
        Console.WriteLine("Aperte Q ou Esc pra sair.");
        Console.WriteLine();

        using var cts = new CancellationTokenSource();
        Console.CancelKeyPress += (_, e) => { e.Cancel = true; cts.Cancel(); };

        // 1. Cockpit state + bridge (consumidores dos samples).
        var cockpit = new CockpitState();
        var bridge  = new LiveDataBridge(cockpit);
        WireCockpitToConsole(cockpit);

        // 2. Realtime publisher fake.
        var realtimeClient = new InMemoryRealtimeClient();
        var publisher = new T4000RealtimePublisher(
            realtimeClient,
            channel: DemoChannel,
            onPublishError: e => Console.Error.WriteLine($"[realtime erro] {e.Message}"));

        // 3. Provider: empurra cada sample pra os 2 consumidores (bridge + publisher).
        var sw = System.Diagnostics.Stopwatch.StartNew();
        var provider = new T4000Provider(
            onT4000Sample: s =>
            {
                bridge.IngestT4000(s);
                publisher.HandleSample(s);
            },
            now: () => sw.Elapsed.TotalMilliseconds);

        // 4. Leitor + porta em memória.
        var port   = new InMemorySerialBytePort();
        var reader = new T4000SerialReader(port, provider);

        // 5. Simulador alimentando a porta em memória num loop.
        var sim = new T4000Simulator();
        var simTask    = RunSimulatorAsync(sim, port, cts.Token);
        var readerTask = reader.RunAsync(cts.Token);
        var keyTask    = WatchKeysAsync(cts);
        var reportTask = RunReporterAsync(reader, publisher, realtimeClient, cts.Token);

        // Aguarda até cancelar (Q/Esc/Ctrl+C). Loops principais (sim/reader)
        // saindo cedo SÓ acontece em erro fatal — só nesse caso encerra.
        await Task.WhenAny(simTask, readerTask, cts.Token.AsTaskCompletion()).ConfigureAwait(false);
        cts.Cancel();
        port.Close();

        // Aguarda até 2s pros loops fecharem direito.
        try
        {
            await Task.WhenAll(simTask, readerTask).WaitAsync(TimeSpan.FromSeconds(2)).ConfigureAwait(false);
        }
        catch (TimeoutException) { /* sai mesmo assim */ }
        catch (OperationCanceledException) { /* esperado */ }

        Console.WriteLine();
        Console.WriteLine($"=== FIM ===");
        Console.WriteLine($"Total publicado no Realtime: {realtimeClient.Published.Count} samples");
        Console.WriteLine($"Leitor: {reader.GetStats().PacketsFed} pacotes alimentados em {reader.GetStats().BytesRead:N0} bytes");
        return 0;
    }

    private static async Task RunSimulatorAsync(
        T4000Simulator sim,
        InMemorySerialBytePort port,
        CancellationToken cancellationToken)
    {
        var scenarioIdx = 0;
        var lastScenarioSwitch = 0L;
        var sw = System.Diagnostics.Stopwatch.StartNew();
        sim.ApplyScenario(ScenarioCycle[0]);
        Console.WriteLine($"[cenário] {ScenarioCycle[0]}");

        while (!cancellationToken.IsCancellationRequested)
        {
            var bytes = sim.EmitBytes();
            port.Push(bytes);

            try { await Task.Delay(CycleIntervalMs, cancellationToken).ConfigureAwait(false); }
            catch (OperationCanceledException) { return; }

            if (sw.ElapsedMilliseconds - lastScenarioSwitch >= ScenarioHoldMs)
            {
                lastScenarioSwitch = sw.ElapsedMilliseconds;
                scenarioIdx = (scenarioIdx + 1) % ScenarioCycle.Length;
                sim.ApplyScenario(ScenarioCycle[scenarioIdx]);
                Console.WriteLine();
                Console.WriteLine($"[cenário] {ScenarioCycle[scenarioIdx]}");
            }
        }
    }

    private static async Task RunReporterAsync(
        T4000SerialReader reader,
        T4000RealtimePublisher publisher,
        InMemoryRealtimeClient client,
        CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            try { await Task.Delay(1000, cancellationToken).ConfigureAwait(false); }
            catch (OperationCanceledException) { return; }

            var rs = reader.GetStats();
            var ps = publisher.GetStats();
            Console.WriteLine(
                $"[health] bytes={rs.BytesRead,7:N0} pacotes={rs.PacketsFed,6:N0} " +
                $"realtime publicado={ps.SamplesPublished,5:N0} descartado={ps.SamplesSkipped,5:N0} " +
                $"último canal={client.Published.LastOrDefault().Channel}");
        }
    }

    private static async Task WatchKeysAsync(CancellationTokenSource cts)
    {
        while (!cts.IsCancellationRequested)
        {
            try { await Task.Delay(100, cts.Token).ConfigureAwait(false); }
            catch (OperationCanceledException) { return; }

            bool available;
            try { available = Console.KeyAvailable; }
            catch (InvalidOperationException)
            {
                // Console redirecionado (CI, Docker sem TTY): desliga o watcher e
                // deixa o programa rodar até Ctrl+C ou cancelamento externo.
                return;
            }
            if (!available) continue;

            var key = Console.ReadKey(intercept: true).Key;
            if (key is ConsoleKey.Q or ConsoleKey.Escape)
            {
                cts.Cancel();
                return;
            }
        }
    }

    private static void WireCockpitToConsole(CockpitState cockpit)
    {
        cockpit.OnChange((current, _, changedKeys) =>
        {
            // Imprime apenas mudanças relevantes pra demo — evita poluir o console.
            foreach (var key in changedKeys)
            {
                if (key == "shift")
                {
                    var s = current.Shift;
                    var line = s.Mode == ShiftMode.Lit
                        ? $"[painel] shift={s.Mode.ToCockpitString()}({s.Level})"
                        : $"[painel] shift={s.Mode.ToCockpitString()}";
                    Console.WriteLine(line.ToString(CultureInfo.InvariantCulture));
                }
                else if (key == "message")
                {
                    if (current.Message is { } m)
                        Console.WriteLine($"[painel] ALERTA {m.Tipo.ToCockpitString()}: {m.Texto}");
                    else
                        Console.WriteLine("[painel] alerta limpo");
                }
            }
        });
    }

    private static void PrintHelp()
    {
        Console.WriteLine("p1fast-t4000-live-demo — demonstração fim-a-fim sem hardware.");
        Console.WriteLine();
        Console.WriteLine("Roda um simulador da Injepro T4000 e mostra o painel reagindo");
        Console.WriteLine("aos dados em tempo real. Útil pra validar o produto antes do");
        Console.WriteLine("primeiro track day.");
        Console.WriteLine();
        Console.WriteLine("Uso:");
        Console.WriteLine("  p1fast-t4000-live-demo");
        Console.WriteLine();
        Console.WriteLine("Pra sair: aperte Q, Esc, ou Ctrl+C.");
    }
}
