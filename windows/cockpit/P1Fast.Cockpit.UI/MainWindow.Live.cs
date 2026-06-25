// MainWindow.Live — Etapa 2 do "ligar o dado real": cockpit AO VIVO na pista.
//
// Lê a Injepro T4000 de verdade pela USB (T3000UsbLiveReader, protocolo provado em
// campo) e alimenta o MESMO maestro (CockpitOrchestrator) que o replay usa — agora
// com o carro ligado. Cada amostra também GRAVA em disco (SessionRecorder, fonte da
// verdade local, ADR-003/004) ANTES de qualquer nuvem.
//
// Liga-se com --live (porta resolvida sozinha, ou --port=COMx). Sem a T4000 plugada,
// a tela avisa e o leitor religa sozinho quando o cabo aparece.
//
// GPS ao vivo: RaceBox Mini por BLUETOOTH no notebook (RaceBoxBleReader, port fiel
// do leitor provado em web/teste-aparelhos/index.html). LIGADO aqui — alimenta
// AlimentarGps → curva/ápice/delta/freada ao vivo. NÃO é o iPhone (ADR-023 era
// stale). Verificação final com o RaceBox na mão (bench), igual à T4000.
//
// PENDENTE: publicação na nuvem (Supabase Realtime). NÃO é redundância — é o
// ÚNICO caminho do dado ao vivo chegar no app P1 Fast e no Command Box (o cockpit
// do piloto é local/baixa latência; o app e o box dependem da nuvem). Camada à parte.

using System.Threading;
using P1Fast.Cockpit.Domain;

namespace P1Fast.Cockpit.UI;

public sealed partial class MainWindow
{
    private CancellationTokenSource? _liveCts;
    private SessionRecorder? _liveRecorder;
    private readonly object _liveRecLock = new();
    private Microsoft.UI.Dispatching.DispatcherQueueTimer? _liveHealthTimer;
    private RaceBoxBleReader? _raceBox;

    // Liga o cockpit ao vivo: carrega as curvas fora da thread da UI, resolve a porta
    // e religa o maestro + leitor na thread da UI.
    private void StartLive()
    {
        StatusText.Text = "ao vivo: procurando T4000…";

        _ = System.Threading.Tasks.Task.Run(() =>
        {
            // Curvas de Brasília (mesmo arquivo do replay) — deixam o maestro pronto
            // pro GPS quando ele chegar; sem GPS ainda não são exercidas.
            IReadOnlyList<TrechoSegmento> segs = Array.Empty<TrechoSegmento>();
            try
            {
                var root = ResolveRepoRoot();
                var barrasPath = Path.Combine(root, "_design-reference", "BARRAS-BRASILIA-FLAVIO-APROVADO-2026-05-27.json");
                if (File.Exists(barrasPath))
                    segs = SessaoReplay.CarregarSegmentos(File.ReadAllText(barrasPath));
            }
            catch { /* sem curvas: a tela mostra o motor mesmo assim */ }

            return (segs, port: ResolveLivePort(_options.Port));
        }).ContinueWith(t =>
        {
            var (segs, port) = t.Result;
            DispatcherQueue.TryEnqueue(() => IniciarLive(segs, port));
        });
    }

    private void IniciarLive(IReadOnlyList<TrechoSegmento> segs, string? port)
    {
        IniciarFeedReal(segs);    // para timers de demo + cria _orquestrador
        AtualizarSensores(null);  // motor sem amostra ainda → tudo "a comunicar"

        _liveCts = new CancellationTokenSource();

        // Gravação local blindada (fonte da verdade), ANTES da nuvem. Best-effort:
        // falha de IO não derruba a tela do piloto.
        try
        {
            var pasta = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "p1fast-sessoes");
            _liveRecorder = new SessionRecorder(new FileSessionStore(pasta));
        }
        catch { _liveRecorder = null; }

        // GPS ao vivo: RaceBox Mini por Bluetooth — INDEPENDE da T4000. Best-effort:
        // sem RaceBox, segue varrendo; sem GPS a tela mostra o motor mesmo assim.
        _raceBox = new RaceBoxBleReader(OnLiveGps, txt => DispatcherQueue.TryEnqueue(() => StatusText.Text = txt));
        _raceBox.Start(_liveCts.Token);

        // Motor: T4000 pela USB. Sem porta, segue só com o GPS até plugar o cabo.
        if (port is null)
        {
            StatusText.Text = "ao vivo: GPS ligando; T4000 sem porta — pluga o cabo USB (ou --port=COMx)";
        }
        else
        {
            var channel = new LiveUsbChannel(port);
            var reader = new T3000UsbLiveReader(
                channel,
                onSample: OnLiveMotor,
                onStatus: (txt, nivel) => DispatcherQueue.TryEnqueue(() => StatusText.Text = $"ao vivo [{nivel}]: {txt}"),
                onLog: _ => { });
            StatusText.Text = $"ao vivo: T4000 em {port} + GPS RaceBox…";
            _ = reader.RunAsync(_liveCts.Token);
        }

        // Saúde da gravação ~1 Hz (fecha por silêncio; alarme nunca silencioso).
        _liveHealthTimer = DispatcherQueue.CreateTimer();
        _liveHealthTimer.Interval = TimeSpan.FromSeconds(1);
        _liveHealthTimer.Tick += (_, _) => { lock (_liveRecLock) _liveRecorder?.Tick(); };
        _liveHealthTimer.Start();
    }

    // Cada amostra do motor (vem na thread do leitor): grava em disco e move a tela.
    // A gravação fica FORA da thread da UI (disco a 10 Hz não pode travar o cockpit);
    // a mutação do estado é re-enfileirada pra thread da UI.
    private void OnLiveMotor(T3000Sample s)
    {
        lock (_liveRecLock) _liveRecorder?.Motor(s);

        var (rpm, alerta) = BridgeMotor(s);
        DispatcherQueue.TryEnqueue(() =>
        {
            _orquestrador?.IngestMotor(rpm, alerta);
            AtualizarSensores(alerta);
        });
    }

    // Cada fix do GPS (vem na thread do BLE): grava em disco e move a tela (curva/
    // ápice/delta/freada). Só fix 3D entra — fix fraco não envenena o detector.
    private void OnLiveGps(RaceBoxFix f)
    {
        if (f.Fix < 3) return;
        var t = (double)DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        lock (_liveRecLock)
            _liveRecorder?.Gps(
                new { lat = f.Lat, lon = f.Lng, kmh = f.Kmh, fix = f.Fix, numSV = f.NumSV, hacc = f.HaccM },
                velKmh: f.Kmh);
        AlimentarGps(new AmostraGps(f.Lat, f.Lng, f.Kmh, t));
    }

    // Ponte T3000Sample (USB) → AmostraAlerta, MESMO mapeamento que o replay usa
    // (SessaoReplay.Carregar). Campo ausente = null = "sem dado" (nunca alerta falso).
    private static (double rpm, AmostraAlerta alerta) BridgeMotor(T3000Sample s)
    {
        bool? Alm(string k) => s.Alarmes is not null && s.Alarmes.TryGetValue(k, out var v) ? v : (bool?)null;
        var alerta = new AmostraAlerta
        {
            Rpm                     = s.Rpm,
            WaterTempC              = s.WaterTempC.HasValue ? (double?)s.WaterTempC.Value : null,
            TpsPct                  = s.TpsPct,
            Lambda                  = s.Lambda,
            BatteryV                = s.BatteryV,
            FuelInjectionBalanced   = s.FuelInjectionBalanced,
            BaixaPressaoOleo        = Alm("baixaPressaoOleo"),
            AlertaNivelCombustivel  = Alm("alertaNivelCombustivel"),
            BaixaPressaoCombustivel = Alm("baixaPressaoCombustivel"),
        };
        return (s.Rpm, alerta);
    }

    // Porta da T4000: usa --port se veio; senão a última porta COM enumerada.
    private static string? ResolveLivePort(string? requested)
    {
        if (!string.IsNullOrWhiteSpace(requested)) return requested;
        try
        {
            var ports = System.IO.Ports.SerialPort.GetPortNames();
            if (ports.Length > 0) { Array.Sort(ports, StringComparer.Ordinal); return ports[^1]; }
        }
        catch { /* sem acesso a portas → null */ }
        return null;
    }
}
