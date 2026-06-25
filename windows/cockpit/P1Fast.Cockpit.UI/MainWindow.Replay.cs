// MainWindow.Replay — Etapa 1 do "ligar o dado real": alimenta o maestro REAL
// (CockpitOrchestrator) com uma sessão de pista GRAVADA (motor + GPS), no tempo
// gravado, e deixa a tela acender pela mesma cadeia que rodará na pista. Sem
// hardware, verificável agora. Liga-se com --replay.
//
// O que isto prova ao vivo na tela (tudo via CockpitState real, não cena fixa):
//   luz de marcha (RPM real → Bubi), alertas do motor, bolinha + velocidades do
//   ápice, diferença de tempo + frase do coach por curva, halo do trecho.
// Além disso faz as DUAS pontes que faltavam (a tela não as observava):
//   barra de stint (EstadoDoTrecho por curva) e cluster de sensores (estado real).

using Microsoft.UI.Xaml.Media;
using P1Fast.Cockpit.Domain;

namespace P1Fast.Cockpit.UI;

public sealed partial class MainWindow
{
    private Microsoft.UI.Dispatching.DispatcherQueueTimer? _replayTimer;
    private System.Diagnostics.Stopwatch? _replayClock;
    private IReadOnlyList<ReplayEvento> _replayEventos = Array.Empty<ReplayEvento>();
    private IReadOnlyList<TrechoSegmento> _replaySegs = Array.Empty<TrechoSegmento>();
    private int _replayIdx;
    private double _replayBaseMs;
    private AmostraAlerta? _ultimaAlerta;
    private double _ultimoGpsMs = double.NegativeInfinity;

    // Diário do replay: registra o que a tela mostrou (snapshot do CockpitState) a
    // cada ~1 s de tempo gravado. Útil pra conferir o dado real sem ver a tela e
    // como histórico de campo. Vai pro %TEMP%\p1fast-cockpit-replay.log.
    private string? _logPath;
    private double _proximoLogMs;

    // Liga o replay: carrega sessão + curvas fora da thread da UI (arquivo grande),
    // depois religa o maestro e arranca o relógio na thread da UI.
    private void StartReplay()
    {
        StatusText.Text = "replay: carregando sessão real…";
        var opts = _options;

        _ = System.Threading.Tasks.Task.Run(() =>
        {
            try
            {
                var root = ResolveRepoRoot();
                var sessaoPath = opts.ReplayPath
                    ?? Path.Combine(root, ".claude-exec", "dados-pista", "sessao-2026-06-21-1140-brasilia-COMPLETA.json");
                var barrasPath = Path.Combine(root, "_design-reference", "BARRAS-BRASILIA-FLAVIO-APROVADO-2026-05-27.json");

                if (!File.Exists(sessaoPath))
                    return (Erro: $"sessão não encontrada: {sessaoPath}", Sessao: (SessaoReplay?)null, Segs: (IReadOnlyList<TrechoSegmento>?)null);

                var sessao = SessaoReplay.Carregar(File.ReadAllText(sessaoPath));
                IReadOnlyList<TrechoSegmento> segs = File.Exists(barrasPath)
                    ? SessaoReplay.CarregarSegmentos(File.ReadAllText(barrasPath))
                    : Array.Empty<TrechoSegmento>();
                return (Erro: (string?)null, Sessao: sessao, Segs: (IReadOnlyList<TrechoSegmento>?)segs);
            }
            catch (Exception ex)
            {
                return (Erro: $"replay falhou: {ex.Message}", Sessao: null, Segs: null);
            }
        }).ContinueWith(t =>
        {
            var (erro, sessao, segs) = t.Result;
            DispatcherQueue.TryEnqueue(() =>
            {
                if (erro is not null || sessao is null)
                {
                    StatusText.Text = erro ?? "replay: sessão vazia";
                    return;
                }
                IniciarReplay(sessao, segs ?? Array.Empty<TrechoSegmento>());
            });
        });
    }

    // Religa o maestro com as curvas reais e escolhe a janela (voltas completas, se
    // houver, pra ter referência → comparação → coach/delta reais).
    private void IniciarReplay(SessaoReplay sessao, IReadOnlyList<TrechoSegmento> segs)
    {
        _replaySegs = segs;
        IniciarFeedReal(segs);                 // para os timers de demo + cria _orquestrador

        var janela = sessao.JanelaVoltasCompletas();
        _replayEventos = janela is { } j ? sessao.Janela(j.Ini, j.Fim) : sessao.Eventos;
        _replayBaseMs = _replayEventos.Count > 0 ? _replayEventos[0].TWallMs : 0;
        _replayIdx = 0;

        var nVoltas = Math.Max(0, sessao.CruzamentosMs.Count - 1);
        StatusText.Text = $"replay {_options.Speed:0.#}×  •  {_replayEventos.Count} eventos  •  {segs.Count} trechos  •  {nVoltas} voltas";

        // Abre o diário do replay (best-effort; falha de IO não derruba a tela).
        try
        {
            _logPath = Path.Combine(Path.GetTempPath(), "p1fast-cockpit-replay.log");
            _proximoLogMs = _replayBaseMs;
            File.WriteAllText(_logPath,
                $"# replay {_options.Speed:0.#}x | eventos={_replayEventos.Count} | curvas={segs.Count} | " +
                $"voltas={nVoltas} | gpsValidos={sessao.GpsValidos}/{sessao.GpsCount} | motor={sessao.MotorCount}\n" +
                "# t(s)  shift  delta  trecho  acao | apex(dist/ang) | msg | curva\n");
        }
        catch { _logPath = null; }

        // Estado inicial dos sensores (motor sem amostra ainda → tudo a comunicar).
        AtualizarSensores(null);
        AtualizarStint();

        _replayClock = System.Diagnostics.Stopwatch.StartNew();
        _replayTimer = DispatcherQueue.CreateTimer();
        _replayTimer.Interval = TimeSpan.FromMilliseconds(33);   // ~30 fps
        _replayTimer.Tick += (_, _) => PumpReplay();
        _replayTimer.Start();
    }

    // A cada quadro: despeja no maestro todos os eventos cujo tempo gravado já
    // "chegou" (relógio × velocidade). Roda na thread da UI — chama o orquestrador
    // direto (sem re-enfileirar) pra ler o estado do stint logo após.
    private void PumpReplay()
    {
        if (_replayClock is null || _orquestrador is null) return;

        var alvoMs = _replayBaseMs + _replayClock.Elapsed.TotalMilliseconds * _options.Speed;
        var alimentouGps = false;

        while (_replayIdx < _replayEventos.Count && _replayEventos[_replayIdx].TWallMs <= alvoMs)
        {
            var ev = _replayEventos[_replayIdx++];
            if (ev.IsMotor)
            {
                _orquestrador.IngestMotor(ev.Rpm, ev.Alerta ?? new AmostraAlerta());
                _ultimaAlerta = ev.Alerta;
            }
            else if (ev.Gps is { } g)
            {
                _orquestrador.IngestGps(g);
                _ultimoGpsMs = ev.TWallMs;
                alimentouGps = true;
            }
        }

        // Sensores acompanham a última amostra de motor; stint, o estado das curvas.
        AtualizarSensores(_ultimaAlerta);
        if (alimentouGps) AtualizarStint();

        RegistrarLog(alvoMs);

        if (_replayIdx >= _replayEventos.Count)
        {
            if (_options.Loop)
            {
                // Recomeça: novo maestro (zera referências/freio) e relógio do zero.
                IniciarFeedReal(_replaySegs);
                _replayIdx = 0;
                _ultimaAlerta = null;
                _ultimoGpsMs = double.NegativeInfinity;
                _lastBrakeFlashSeq = 0;
                _replayClock?.Restart();
            }
            else
            {
                _replayTimer?.Stop();
                StatusText.Text = "replay: fim da sessão real";
            }
        }
    }

    // Snapshot do CockpitState no diário (a cada ~1 s de tempo gravado).
    private void RegistrarLog(double alvoMs)
    {
        if (_logPath is null || alvoMs < _proximoLogMs) return;
        _proximoLogMs = alvoMs + 1000;
        try
        {
            var s = _cockpitState.Get();
            var ap = s.Apex.Apice;
            var inv = System.Globalization.CultureInfo.InvariantCulture;
            var linha = string.Format(inv,
                "{0,6:0.0}  {1}/L{2}  Δ={3} ({4})  {5}  acao=\"{6}\" | apex {7}/{8} | freio {9}/9 {10} | msg=\"{11}\" | {12}\n",
                (alvoMs - _replayBaseMs) / 1000.0,
                s.Shift.Mode, s.Shift.Level,
                string.IsNullOrEmpty(s.Delta.Value) ? "—" : s.Delta.Value, s.Delta.Tone,
                s.TrechoStatus, s.Acao.Texto,
                ap.DistM is { } d ? d.ToString("0", inv) + "m" : "—",
                ap.AngleDeg is { } a ? a.ToString("0") + "°" : "—",
                s.Freio.Lit,
                s.Freio.ResultadoM is { } rm ? $"{s.Freio.ResultadoPalavra}={rm}" : s.Freio.ResultadoPalavra,
                s.Message?.Texto ?? "",
                _orquestrador?.CurvaAtualNome ?? "");
            File.AppendAllText(_logPath, linha);
        }
        catch { /* IO best-effort */ }
    }

    // ── Ponte da BARRA DE STINT (a tela não observava EstadoDoTrecho) ──────────
    // Pinta os 8 trechos de Brasília nos 8 primeiros blocos: faster→verde, slower→
    // vermelho, reference/neutral→neutro, trecho em curso→amarelo, demais→apagado.
    private void AtualizarStint()
    {
        if (_orquestrador is null || _replaySegs.Count == 0) return;

        var atual = _orquestrador.CurvaAtualId;
        var pattern = new StintBlockState[12];
        for (var i = 0; i < 12; i++)
        {
            if (i >= _replaySegs.Count) { pattern[i] = StintBlockState.Pending; continue; }
            var seg = _replaySegs[i];
            if (seg.Id == atual) { pattern[i] = StintBlockState.Current; continue; }
            pattern[i] = _orquestrador.EstadoDoTrecho(seg.Id) switch
            {
                "faster"    => StintBlockState.Faster,
                "slower"    => StintBlockState.Slower,
                "reference" => StintBlockState.Neutral,
                "neutral"   => StintBlockState.Neutral,
                _           => StintBlockState.Pending,
            };
        }
        ApplyStintPattern(pattern);
    }

    // ── Ponte do CLUSTER DE SENSORES (estado real do motor) ────────────────────
    // Port do aplicarMotorStatus do web: verde = comunicando, amarelo = condição de
    // alerta (água quente, mistura fora da faixa, alarme), vermelho = sem dado/sem
    // sensor. Movimento (GPS) verde se chegou ponto recente. Chassi não instalado.
    private void AtualizarSensores(AmostraAlerta? a)
    {
        // Motor: comunica em verde por padrão; campos sem dado (null) ficam vermelho.
        SetSensor(SensorRpm,        a?.Rpm is not null);
        SetSensor(SensorAcel,       a?.TpsPct is not null);
        SetSensor(SensorFreioPedal, a is not null);          // pedal vem no mesmo quadro do motor
        SetSensor(SensorAgua,       a?.WaterTempC is not null, warn: a?.WaterTempC is > 80);
        SetSensor(SensorLambda,     a?.Lambda is not null, warn: a?.Lambda is < 0.80 or > 1.15);
        SetSensor(SensorBateria,    a?.BatteryV is not null, warn: a?.BatteryV is < 11.8);
        SetSensor(SensorAlarme,     a is not null, warn: a?.BaixaPressaoOleo == true || a?.AlertaNivelCombustivel == true || a?.FuelInjectionBalanced == false);

        // Movimento: GPS verde se chegou amostra há pouco; acelerômetro acompanha.
        var gpsVivo = _replayClock is not null
            && (_replayBaseMs + _replayClock.Elapsed.TotalMilliseconds * _options.Speed) - _ultimoGpsMs < 3000;
        foreach (var s in _sensorsMov) SetSensorColor(s, gpsVivo ? SensorOk : SensorOff);

        // Chassi (pneus/susp/câmbio/freio dedicado/direção): sensores a instalar.
        foreach (var s in _sensorsChassi) SetSensorColor(s, SensorOff);
    }

    private static void SetSensor(Microsoft.UI.Xaml.Shapes.Ellipse s, bool comunicando, bool warn = false)
        => SetSensorColor(s, !comunicando ? SensorOff : warn ? SensorWarn : SensorOk);

    private static void SetSensorColor(Microsoft.UI.Xaml.Shapes.Ellipse s, Windows.UI.Color color)
    {
        if (s.Fill is SolidColorBrush b) b.Color = color;
        else s.Fill = new SolidColorBrush(color);
    }

    // Sobe a árvore de diretórios até a raiz do repo (pasta que tem 'windows' e 'web').
    private static string ResolveRepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null)
        {
            if (Directory.Exists(Path.Combine(dir.FullName, "windows")) &&
                Directory.Exists(Path.Combine(dir.FullName, "web")))
                return dir.FullName;
            dir = dir.Parent;
        }
        return AppContext.BaseDirectory;
    }
}
