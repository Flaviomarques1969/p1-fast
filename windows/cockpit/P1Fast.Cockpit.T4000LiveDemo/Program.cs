// p1fast-t4000-live-demo — demonstração fim-a-fim do pipeline T4000 +
// painel ao vivo fotografável pra mandar pro Claude Code resolver.
//
// Modos:
//   (padrão)     — pipeline saudável: simulador → leitor → provider →
//                  painel ao vivo. Mostra estado "Healthy".
//   --diagnose   — cicla pelos 7 estados de falha em sequência (cada um
//                  por ~8s). Útil pro Flávio ver o painel reagindo a
//                  cada tipo de problema, mesmo sem ter a T4000 ligada.
//
// Em ambos os modos:
//   - Painel ao vivo redesenhado a cada 1s.
//   - Histórico das últimas 8 tentativas de recuperação.
//   - Bloco "INFO PRO CLAUDE CODE" com versão, repositório, branch,
//     arquivo provavelmente afetado.
//
// Você abre, fotografa a tela, manda a foto pro Claude Code (app no
// celular ou outro lugar) e ele resolve.

using System.Globalization;
using P1Fast.Cockpit.Domain;

namespace P1Fast.Cockpit.T4000LiveDemo;

internal static class CancellationExtensions
{
    public static Task AsTaskCompletion(this CancellationToken token)
    {
        var tcs = new TaskCompletionSource<object?>(TaskCreationOptions.RunContinuationsAsynchronously);
        token.Register(() => tcs.TrySetResult(null));
        return tcs.Task;
    }
}

internal static class Program
{
    private const int CycleIntervalMs   = 50;
    private const int ScenarioHoldMs    = 3000;
    private const int DiagnoseHoldMs    = 8000;
    private const int RenderIntervalMs  = 1000;
    private const string DemoChannel    = "live-stint-demo";

    private const string VersaoApp      = "p1fast-t4000-live-demo 2026-05-24";
    private const string Repositorio    = "github.com/Flaviomarques1969/p1-fast";
    private const string Branch         = "main";

    private static readonly T4000Scenario[] ScenarioCycle = new[]
    {
        T4000Scenario.Idle, T4000Scenario.Cruise, T4000Scenario.Accelerating,
        T4000Scenario.NearRedline, T4000Scenario.Redline, T4000Scenario.Overrev,
        T4000Scenario.OverheatWater, T4000Scenario.LowOilPressure, T4000Scenario.EcuError,
    };

    // Ciclo dos 7 estados de falha + Healthy intermediário (pra _everHealthy ligar).
    private static readonly T4000ConnectionState[] DiagnoseCycle = new[]
    {
        T4000ConnectionState.NoPortsDetected,
        T4000ConnectionState.PortBusy,
        T4000ConnectionState.PortOpenNoData,
        T4000ConnectionState.ProtocolMismatch,
        T4000ConnectionState.Healthy,             // habilita _everHealthy
        T4000ConnectionState.ChecksumFlapping,
        T4000ConnectionState.ConnectionFlapping,
        T4000ConnectionState.Healthy,
    };

    private static async Task<int> Main(string[] args)
    {
        if (args.Any(a => a is "--help" or "-h" or "/?"))
        {
            PrintHelp();
            return 0;
        }

        var modoDiagnose = args.Any(a => a is "--diagnose");

        Console.OutputEncoding = System.Text.Encoding.UTF8;
        using var cts = new CancellationTokenSource();
        Console.CancelKeyPress += (_, e) => { e.Cancel = true; cts.Cancel(); };

        return modoDiagnose
            ? await RunDiagnoseMode(cts.Token).ConfigureAwait(false)
            : await RunLiveMode(cts.Token).ConfigureAwait(false);
    }

    // ── Modo padrão: pipeline rodando, painel mostrando Healthy ────

    private static async Task<int> RunLiveMode(CancellationToken token)
    {
        var cockpit       = new CockpitState();
        var bridge        = new LiveDataBridge(cockpit);
        var realtimeClient= new InMemoryRealtimeClient();
        var publisher     = new T4000RealtimePublisher(realtimeClient, channel: DemoChannel);
        var sw            = System.Diagnostics.Stopwatch.StartNew();
        var health        = new T4000HealthAccumulator(() => sw.ElapsedMilliseconds);
        var diagnostic    = new T4000ConnectionDiagnostic();
        var strategy      = new T4000RecoveryStrategy();
        var tentativas    = new List<TentativaLog>();

        // Provider alimenta bridge + publisher + saúde.
        var provider = new T4000Provider(
            onT4000Sample: s =>
            {
                bridge.IngestT4000(s);
                publisher.HandleSample(s);
                health.RegisterCycleResult(s.ChecksumOk);
            },
            now: () => sw.Elapsed.TotalMilliseconds);

        // Porta + leitor.
        var port = new InMemorySerialBytePort();
        var reader = new T4000SerialReader(port, provider);

        // Como o reader em si lê bytes via ReadAsync, precisamos contabilizar
        // bytes ANTES dele consumir. Fazemos isso com um wrapper que conta + repassa.
        // Aqui usamos uma abordagem simples: registramos bytes equivalentes ao
        // que o simulador empurrou (proxy aceitável pra demo).
        var sim = new T4000Simulator();
        var ultimoSampleRef = new SampleRef();

        provider = new T4000Provider(
            onT4000Sample: s =>
            {
                ultimoSampleRef.Value = s.Telemetry;
                bridge.IngestT4000(s);
                publisher.HandleSample(s);
                health.RegisterCycleResult(s.ChecksumOk);
            },
            now: () => sw.Elapsed.TotalMilliseconds);
        reader = new T4000SerialReader(port, provider);

        // Em "modo live", consideramos que a porta foi aberta e está OK.
        health.PortsDetected     = 1;
        health.PortOpenAttempted = true;
        health.PortOpenSucceeded = true;

        var cenarioAtual = ScenarioCycle[0];
        var cenarioRef = new CenarioRef { Atual = cenarioAtual };
        sim.ApplyScenario(cenarioAtual);

        var simTask    = RunSimulatorAsync(sim, port, cenarioRef, health, token);
        var readerTask = reader.RunAsync(token);
        var renderTask = RunRendererAsync(
            getInput: () => BuildPanelInput(
                cenarioRef.Atual.ToString(),
                ultimoSampleRef.Value,
                health,
                diagnostic,
                strategy,
                reader,
                publisher,
                tentativas),
            evaluate: () =>
            {
                var snap = health.Snapshot();
                var diag = diagnostic.Evaluate(snap);
                var acao = strategy.Decide(diag.State, new[] { "COM4" }, sw.ElapsedMilliseconds);
                if (acao.Tipo != "none" && acao.Tipo != "wait")
                    tentativas.Add(new TentativaLog(DateTime.UtcNow, acao.Tipo, acao.Detalhe));
                return acao;
            },
            token: token);
        var keyTask = WatchKeysAsync(cts: CancellationTokenSource.CreateLinkedTokenSource(token));

        await Task.WhenAny(simTask, readerTask, token.AsTaskCompletion()).ConfigureAwait(false);
        port.Close();
        return 0;
    }

    // ── Modo --diagnose: cicla pelos 7 estados de falha ────────────

    private static async Task<int> RunDiagnoseMode(CancellationToken token)
    {
        var diagnostic = new T4000ConnectionDiagnostic();
        var strategy   = new T4000RecoveryStrategy();
        var tentativas = new List<TentativaLog>();
        var swDiag     = System.Diagnostics.Stopwatch.StartNew();
        var stateRef   = new ConnectionStateRef();
        var ultimoSampleRef = new SampleRef();
        var healthRef  = new HealthRef();

        // Loop que avança pelo ciclo de estados a cada DiagnoseHoldMs.
        var stateAdvanceTask = Task.Run(async () =>
        {
            var idx = 0;
            while (!token.IsCancellationRequested)
            {
                stateRef.Atual = DiagnoseCycle[idx];
                healthRef.Sample = SyntheticHealth(stateRef.Atual);
                ultimoSampleRef.Value = stateRef.Atual == T4000ConnectionState.Healthy
                    ? new T4000Simulator { } is { } x ? Helpers.CruiseSample() : null
                    : null;

                idx = (idx + 1) % DiagnoseCycle.Length;
                try { await Task.Delay(DiagnoseHoldMs, token).ConfigureAwait(false); }
                catch (OperationCanceledException) { return; }
            }
        }, token);

        var renderTask = RunRendererAsync(
            getInput: () => new PanelInput(
                AgoraUtc: DateTime.UtcNow,
                CenarioAtual: stateRef.Atual.ToString() + " (simulação)",
                UltimoSample: ultimoSampleRef.Value,
                Health: healthRef.Sample ?? SyntheticHealth(T4000ConnectionState.Unknown),
                Diagnostico: diagnostic.LastDiagnostic ?? new T4000Diagnostic(stateRef.Atual, "...", "...", false),
                AcaoRecuperacao: null,
                BytesRecebidosTotal: healthRef.Sample?.BytesReceivedTotal ?? 0,
                PacotesProcessadosTotal: (healthRef.Sample?.CyclesOkTotal ?? 0) * 5,
                PublicadoRealtime: (healthRef.Sample?.CyclesOkTotal ?? 0) / 2,
                DescartadoThrottle: (healthRef.Sample?.CyclesOkTotal ?? 0) / 2,
                TentativasRecentes: tentativas,
                Versao: VersaoApp,
                Repositorio: Repositorio,
                Branch: Branch),
            evaluate: () =>
            {
                var h = healthRef.Sample ?? SyntheticHealth(stateRef.Atual);
                var d = diagnostic.Evaluate(h);
                var a = strategy.Decide(d.State, new[] { "COM3", "COM4" }, swDiag.ElapsedMilliseconds);
                if (a.Tipo != "none" && a.Tipo != "wait")
                    tentativas.Add(new TentativaLog(DateTime.UtcNow, a.Tipo, a.Detalhe));
                return a;
            },
            token: token);

        var keyTask = WatchKeysAsync(cts: CancellationTokenSource.CreateLinkedTokenSource(token));

        await Task.WhenAny(stateAdvanceTask, renderTask, token.AsTaskCompletion()).ConfigureAwait(false);
        return 0;
    }

    // ── Loops compartilhados ───────────────────────────────────────

    private static async Task RunSimulatorAsync(
        T4000Simulator sim,
        InMemorySerialBytePort port,
        CenarioRef cenarioRef,
        T4000HealthAccumulator health,
        CancellationToken token)
    {
        var scenarioIdx = 0;
        var lastSwitch = 0L;
        var sw = System.Diagnostics.Stopwatch.StartNew();

        while (!token.IsCancellationRequested)
        {
            var bytes = sim.EmitBytes();
            port.Push(bytes);
            health.RegisterBytes(bytes.Length);
            health.CountSentinelsIn(bytes);

            try { await Task.Delay(CycleIntervalMs, token).ConfigureAwait(false); }
            catch (OperationCanceledException) { return; }

            if (sw.ElapsedMilliseconds - lastSwitch >= ScenarioHoldMs)
            {
                lastSwitch = sw.ElapsedMilliseconds;
                scenarioIdx = (scenarioIdx + 1) % ScenarioCycle.Length;
                cenarioRef.Atual = ScenarioCycle[scenarioIdx];
                sim.ApplyScenario(cenarioRef.Atual);
            }
        }
    }

    private static async Task RunRendererAsync(
        Func<PanelInput> getInput,
        Func<T4000RecoveryAction> evaluate,
        CancellationToken token)
    {
        while (!token.IsCancellationRequested)
        {
            try { await Task.Delay(RenderIntervalMs, token).ConfigureAwait(false); }
            catch (OperationCanceledException) { return; }

            var acao = evaluate();
            var input = getInput() with { AcaoRecuperacao = acao };
            try { Console.Clear(); } catch (System.IO.IOException) { /* sem TTY */ }
            Console.Write(LivePanel.Render(input));
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
            catch (InvalidOperationException) { return; }
            if (!available) continue;

            var key = Console.ReadKey(intercept: true).Key;
            if (key is ConsoleKey.Q or ConsoleKey.Escape) { cts.Cancel(); return; }
        }
    }

    // ── Helpers ────────────────────────────────────────────────────

    private static PanelInput BuildPanelInput(
        string cenario,
        T4000Sample? ultimo,
        T4000HealthAccumulator health,
        T4000ConnectionDiagnostic diagnostic,
        T4000RecoveryStrategy strategy,
        T4000SerialReader reader,
        T4000RealtimePublisher publisher,
        IReadOnlyList<TentativaLog> tentativas)
    {
        var snap = health.Snapshot();
        return new PanelInput(
            AgoraUtc: DateTime.UtcNow,
            CenarioAtual: cenario,
            UltimoSample: ultimo,
            Health: snap,
            Diagnostico: diagnostic.LastDiagnostic ?? new T4000Diagnostic(T4000ConnectionState.Unknown, "...", "...", false),
            AcaoRecuperacao: null,
            BytesRecebidosTotal: reader.GetStats().BytesRead,
            PacotesProcessadosTotal: reader.GetStats().PacketsFed,
            PublicadoRealtime: publisher.GetStats().SamplesPublished,
            DescartadoThrottle: publisher.GetStats().SamplesSkipped,
            TentativasRecentes: tentativas,
            Versao: VersaoApp,
            Repositorio: Repositorio,
            Branch: Branch);
    }

    /// <summary>Constrói um T4000HealthSample que força cada estado de falha — usado no modo --diagnose.</summary>
    private static T4000HealthSample SyntheticHealth(T4000ConnectionState target) => target switch
    {
        T4000ConnectionState.NoPortsDetected   => new(0, false, false, false, 0, 0, 0, 0, 0, 0, 0),
        T4000ConnectionState.PortBusy          => new(1, true, false, true, 0, 0, 0, 0, 0, 0, 0),
        T4000ConnectionState.PortOpenNoData    => new(1, true, true,  false, 0, 5_000, 0, 0, 0, 0, 5_000),
        T4000ConnectionState.ProtocolMismatch  => new(1, true, true,  false, 500, 100, 0, 0, 0, 0, 5_000),
        T4000ConnectionState.ChecksumFlapping  => new(1, true, true,  false, 5_000, 100, 50, 50, 4, 12, 200),
        T4000ConnectionState.ConnectionFlapping=> new(1, true, true,  false, 5_000, 100, 50, 50, 30, 0, 6_000),
        T4000ConnectionState.Healthy           => new(1, true, true,  false, 5_000, 50,  50, 50, 50, 0, 100),
        _                                       => new(1, true, true,  false, 0, 0, 0, 0, 0, 0, 0),
    };

    private static void PrintHelp()
    {
        Console.WriteLine("p1fast-t4000-live-demo — demonstração com painel ao vivo fotografável.");
        Console.WriteLine();
        Console.WriteLine("Uso:");
        Console.WriteLine("  p1fast-t4000-live-demo            modo normal (pipeline saudável)");
        Console.WriteLine("  p1fast-t4000-live-demo --diagnose cicla pelos 7 estados de falha");
        Console.WriteLine();
        Console.WriteLine("Pra sair: aperte Q, Esc, ou Ctrl+C.");
        Console.WriteLine();
        Console.WriteLine("Quando algo der errado, tire foto da tela e mande pro Claude Code.");
    }

    // ── Refs mutáveis pra compartilhar entre tasks ─────────────────

    private sealed class CenarioRef { public T4000Scenario Atual; }
    private sealed class SampleRef { public T4000Sample? Value; }
    private sealed class ConnectionStateRef { public T4000ConnectionState Atual; }
    private sealed class HealthRef { public T4000HealthSample? Sample; }

    private static class Helpers
    {
        public static T4000Sample CruiseSample() => new(
            Rpm: 3500, SpeedKmh: 100, OilPressBar: 4, OilTempC: 90,
            WaterTempC: 90, FuelPressBar: 3.5, BatteryV: 14, TpsPct: 25,
            MapBar: 0.7, AirTempC: 38, EgtC: 600, EgtOutOfRange: false, Lambda: 0.98,
            FuelTempC: 40, Marcha: 4, EcuErrorBits: 0);
    }
}
