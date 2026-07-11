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
        _modoReplay = true;                    // item 3.1: recordes em memória (não carrega nem grava no disco)
        IniciarFeedReal(segs);                 // para os timers de demo + cria _orquestrador

        var janela = sessao.JanelaVoltasCompletas();
        _replayEventos = janela is { } j ? sessao.Janela(j.Ini, j.Fim) : sessao.Eventos;
        _replayBaseMs = _replayEventos.Count > 0 ? _replayEventos[0].TWallMs : 0;
        _replayIdx = 0;

        // Etapa 4 (volta atual): guarda os cruzamentos e quantos já passaram antes da janela,
        // pra o halo dourado da volta corrente andar conforme o replay cruza a linha de chegada.
        _replayCruzamentos = sessao.CruzamentosMs;
        _replayCruzBase = 0;
        foreach (var c in _replayCruzamentos) if (c <= _replayBaseMs) _replayCruzBase++;
        SemearLapsRegistrados();               // item 3.5: pula as voltas anteriores à janela do replay
        ResetVoltaAtual();

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
                _orquestrador.IngestMotor(ev.Rpm, ev.Alerta ?? new AmostraAlerta(), ev.TWallMs / 1000.0); // tempo da SESSÃO (não do replay 8×) p/ histerese 2b
                _ultimaAlerta = ev.Alerta;
                _ultimoMotorTick = Environment.TickCount64;
            }
            else if (ev.Gps is { } g)
            {
                _orquestrador.IngestGps(g);
                AtualizarCoachZoom(g);   // vidro do mapa central: mesmos AmostraGps da sessão
                _ultimoGpsTick = Environment.TickCount64;
                alimentouGps = true;
            }
        }

        // Sensores acompanham a última amostra de motor; stint, o estado das curvas.
        AtualizarSensores(_ultimaAlerta);
        if (alimentouGps) AtualizarStint();
        AtualizarVoltaAtualReplay(alvoMs);   // etapa 4: halo dourado anda com os cruzamentos
        AtualizarTelaTermica();              // telas dedicadas de aquecimento/resfriamento (Flávio 2026-07-06)

        RegistrarLog(alvoMs);

        if (_replayIdx >= _replayEventos.Count)
        {
            if (_options.Loop)
            {
                // Recomeça: novo maestro (zera referências/freio) e relógio do zero.
                IniciarFeedReal(_replaySegs);
                _replayIdx = 0;
                _ultimaAlerta = null;
                _lastBrakeFlashSeq = 0;
                SemearLapsRegistrados();   // item 3.5: IniciarFeedReal zerou _lapsRegistradosReplay — re-semeia
                _replayClock?.Restart();
                ResetVoltaAtual();   // etapa 4: recomeça o halo na volta 1
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
    // BARRA DE VOLTAS (Flávio 2026-07-03): 1ª = aquecimento, última = cool-down, as do
    // meio = voltas planejadas pelo piloto (incl. parada no box). Enquanto o PLANO real
    // do stint não está ligado ao cockpit (telas só EXIBEM — virá do envelope da nuvem
    // `plano_stint`), mostra um plano de EXEMPLO. Estático até o plano real chegar, então
    // aplica uma vez por sessão. (Antes a barra mapeava as 8 curvas por ritmo — isso não
    // era a barra de VOLTAS; ver docs/COCKPIT_FONTE_DA_VERDADE.md §11.)
    private void AtualizarStint()
    {
        if (_barraVoltasAplicada) return;
        _barraVoltasAplicada = true;
        // Etapa 3 (Flávio 2026-07-04): se o plano REAL do piloto já chegou da nuvem, mostra
        // ELE; senão o placeholder — idêntico byte-a-byte ao de hoje. (Se o plano real chegar
        // DEPOIS, AplicarPlanoStintReal repinta e trava o guard; ver MainWindow.Live.cs.)
        ApplyStintPattern(_planoStintReal ?? PlanoStintPlaceholder);
    }

    // ── Ponte do CLUSTER DE SENSORES (estado real do motor) ────────────────────
    // Port do aplicarMotorStatus do web: verde = comunicando, amarelo = condição de
    // alerta (água quente, mistura fora da faixa, alarme), vermelho = sem dado/sem
    // sensor. Movimento (GPS) verde se chegou ponto recente. Chassi não instalado.
    private void AtualizarSensores(AmostraAlerta? a)
    {
        // Motor: só "comunicando" (verde) se a última amostra chegou há pouco (tempo real).
        // Se a T4000 (USB) cair, os LEDs do MOTOR apagam em ~3 s — NÃO ficam verdes com
        // dado congelado (mesmo que o GPS, independente, siga vindo). Em replay o motor
        // flui contínuo, então fica verde normal; em lacuna/fim, apaga (honesto).
        var motorVivo = Environment.TickCount64 - _ultimoMotorTick < 3000;
        var am = motorVivo ? a : null;
        SetSensor(SensorRpm,        am?.Rpm is not null);
        SetSensor(SensorAcel,       am?.TpsPct is not null);
        SetSensor(SensorFreioPedal, am is not null);          // pedal vem no mesmo quadro do motor
        // M4: mistura e bateria só ALERTAM (amarelo) com o carro SOB CARGA (motor puxando) —
        // em marcha lenta/parado a lambda lê pobre por corte de combustível e a bateria cai
        // sozinha (regra §4/§9). Água e Alarme NÃO dependem disto (segurança vale parado).
        var sobCarga = am?.Rpm is >= 3000 || am?.TpsPct is >= 15;
        SetSensor(SensorAgua,       am?.WaterTempC is not null, warn: am?.WaterTempC is > 80);
        SetSensor(SensorLambda,     am?.Lambda is not null, warn: sobCarga && (am?.Lambda is < 0.80 or > 1.15));
        SetSensor(SensorBateria,    am?.BatteryV is not null, warn: sobCarga && am?.BatteryV is < 11.8);
        SetSensor(SensorAlarme,     am is not null, warn: am?.BaixaPressaoOleo == true || am?.AlertaNivelCombustivel == true || am?.FuelInjectionBalanced == false);

        // Movimento: GPS verde se chegou amostra há pouco (tempo REAL monotônico — vale
        // pro replay E pro live); acelerômetro acompanha.
        var gpsVivo = Environment.TickCount64 - _ultimoGpsTick < 3000;
        foreach (var s in _sensorsMov) SetSensorColor(s, gpsVivo ? SensorOk : SensorOff);

        // Chassi (pneus/susp/câmbio/freio dedicado/direção): sensores a instalar.
        foreach (var s in _sensorsChassi) SetSensorColor(s, SensorOff);
    }

    private static void SetSensor(Microsoft.UI.Xaml.Shapes.Shape s, bool comunicando, bool warn = false)
        => SetSensorColor(s, !comunicando ? SensorOff : warn ? SensorWarn : SensorOk);

    private static void SetSensorColor(Microsoft.UI.Xaml.Shapes.Shape s, Windows.UI.Color color)
    {
        // O ícone do sensor é desenhado por TRAÇO (Stroke) — a cor do estado vai no Stroke.
        if (s.Stroke is SolidColorBrush b) b.Color = color;
        else s.Stroke = new SolidColorBrush(color);
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
