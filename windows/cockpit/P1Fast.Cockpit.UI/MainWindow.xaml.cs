using Microsoft.UI;
using Microsoft.UI.Windowing;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI.Xaml.Media.Animation;
using Microsoft.UI.Xaml.Shapes;
using P1Fast.Cockpit.Domain;
using Windows.Graphics;
using Windows.UI;
using WinRT.Interop;

namespace P1Fast.Cockpit.UI;

/// <summary>
/// Janela principal do cockpit. PR-D adiciona apex header (4 pontos) +
/// info bloco (delta + ação) sobre o que já existia (halo + shift light).
/// </summary>
public sealed partial class MainWindow : Window
{
    private readonly CockpitState _cockpitState = new();
    private readonly LaunchOptions _options;
    private Microsoft.UI.Dispatching.DispatcherQueueTimer? _demoTimer;

    // Maestro que comanda a tela com dado REAL (motor + GPS). Fica nulo até o feed
    // ser ligado (IniciarFeedReal), chamado pela ligação USB/replay no notebook.
    private CockpitOrchestrator? _orquestrador;

    // ── Cores ──────────────────────────────────────────────

    private static readonly Color White       = Color.FromArgb(0xFF, 0xFF, 0xFF, 0xFF);
    private static readonly Color Muted       = Color.FromArgb(0xFF, 0xA0, 0xA0, 0xA0);
    private static readonly Color Faint       = Color.FromArgb(0xFF, 0x60, 0x60, 0x60);
    private static readonly Color Bom         = Color.FromArgb(0xFF, 0x4F, 0xE0, 0x60);
    private static readonly Color Erro        = Color.FromArgb(0xFF, 0xE0, 0x40, 0x40);
    private static readonly Color Foco        = Color.FromArgb(0xFF, 0xF0, 0xC0, 0x40);
    private static readonly Color Sistema     = Color.FromArgb(0xFF, 0x82, 0xC8, 0xFF);
    private static readonly Color Ouro        = Color.FromArgb(0xFF, 0xE0, 0xC0, 0x60);

    // Cor central do halo radial. A borda continua transparente (offset 0.65).
    // RecordeStint: laranja (oklch 78% 0.18 65 / .42 do mockup web).
    // MelhorHistorico: ouro mais brilhante (alpha 0x80) — pulsa pra evidenciar PB ever.
    // PiorStint: roxo (oklch 56% 0.22 305 / .42) — fixo, alerta sem fadiga visual.
    private static readonly Dictionary<TrechoStatus, Color> HaloColors = new()
    {
        [TrechoStatus.Neutro]          = Color.FromArgb(0x00, 0x00, 0x00, 0x00),
        [TrechoStatus.RecordeStint]    = Color.FromArgb(0x6B, 0xF0, 0xA0, 0x60),
        [TrechoStatus.MelhorHistorico] = Color.FromArgb(0x80, 0xE0, 0xC0, 0x60),
        [TrechoStatus.PiorStint]       = Color.FromArgb(0x6B, 0x92, 0x52, 0xC8),
    };

    private Storyboard? _haloPulse;

    // Rampa de cor do painel APROVADO 22/06 (cockpit.css .shift-light__dot.is-on[data-tier]):
    // tiers 1-4 verde · 5-7 amarelo · 8-9 vermelho. RGB convertidos dos oklch canônicos
    // (verde oklch80% .23 145 · amarelo oklch86% .21 92 · vermelho oklch75% .26 28).
    private static readonly Color LedOff         = Color.FromArgb(0xFF, 0x1A, 0x1A, 0x1A);
    private static readonly Color LedShiftGreen  = Color.FromArgb(0xFF, 0x39, 0xE2, 0x52);
    private static readonly Color LedShiftYellow = Color.FromArgb(0xFF, 0xFF, 0xCA, 0x00);
    private static readonly Color LedShiftRed    = Color.FromArgb(0xFF, 0xFF, 0x4D, 0x43);
    private static readonly Color LedFireWhite   = Color.FromArgb(0xFF, 0xFF, 0xFF, 0xFF);
    private static readonly Color LedOverrevRed  = Color.FromArgb(0xFF, 0xC0, 0x10, 0x10);

    // ── Luz de freio lateral (Flávio 22/06) ───────────────────
    // Vertical nas duas laterais, enche de cima pra baixo conforme chega o ponto
    // de freada. Tiers iguais ao HTML (.brake-dot[data-tier]): 5 verde, 1 âmbar,
    // 3 vermelho — mesma rampa de cor do shift light.
    private static readonly char[] BrakeTierByPosition = { 'g', 'g', 'g', 'g', 'g', 'a', 'r', 'r', 'r' };

    // ── Cluster de sensores (Flávio 22/06) ────────────────────
    // Vermelho = sem comunicação · Verde = comunicando · Amarelo = falha.
    private static readonly Color SensorOff  = Color.FromArgb(0xFF, 0x8A, 0x3A, 0x34);
    private static readonly Color SensorOk   = Bom;
    private static readonly Color SensorWarn = Foco;

    // 17 posições, pirâmide simétrica: tier 1 nas pontas, tier 9 no centro.
    private static readonly int[] LedTierByPosition = { 1, 2, 3, 4, 5, 6, 7, 8, 9, 8, 7, 6, 5, 4, 3, 2, 1 };

    // ── Shift light flash (troca de marcha) ───────────────────
    // Detecta upshift = RPM caiu de patamar alto (>=5) — proxy do "shift up"
    // do volante real. Quando dispara, todos os 17 LEDs viram brancos por
    // ~140 ms e depois voltam pro patamar atual. Espelha o flash de strobe
    // que o piloto vê quando a transmissão troca.
    private int _previousShiftLevel = 0;
    private ShiftMode _previousShiftMode = ShiftMode.Off;
    private Microsoft.UI.Dispatching.DispatcherQueueTimer? _shiftFlashTimer;
    private ShiftState? _flashRestoreState;

    private Ellipse[] _leds = Array.Empty<Ellipse>();
    private Microsoft.UI.Xaml.Controls.Border[] _stintBlocks = Array.Empty<Microsoft.UI.Xaml.Controls.Border>();

    // Luzes de freio (9 por lado) + cluster de sensores (Motor 7 · Movimento 2 · Chassi 5).
    private Ellipse[] _brakeLeft = Array.Empty<Ellipse>();
    private Ellipse[] _brakeRight = Array.Empty<Ellipse>();
    private Ellipse[] _sensorsMotor = Array.Empty<Ellipse>();
    private Ellipse[] _sensorsMov = Array.Empty<Ellipse>();
    private Ellipse[] _sensorsChassi = Array.Empty<Ellipse>();

    // Halos (Ellipses maiores atrás de cada LED) — transbordam e criam o "wash".
    private Ellipse[] _ledGlows = Array.Empty<Ellipse>();
    private Ellipse[] _brakeLeftGlow = Array.Empty<Ellipse>();
    private Ellipse[] _brakeRightGlow = Array.Empty<Ellipse>();

    // Cache de pincéis (domo 3D + brilho) por cor — evita recriar a cada frame.
    private readonly Dictionary<uint, RadialGradientBrush> _domeCache = new();
    private readonly Dictionary<uint, RadialGradientBrush> _glowCache = new();
    private RadialGradientBrush? _offDome;

    // LEDs cujo halo já está aceso — pra disparar a "ignição" (pop) só na transição.
    private readonly HashSet<Ellipse> _glowsLit = new();

    // Animações demo: varredura sequencial do shift e da luz de freio (com flash no topo).
    private Microsoft.UI.Dispatching.DispatcherQueueTimer? _brakeTimer;
    private Microsoft.UI.Dispatching.DispatcherQueueTimer? _shiftSweepTimer;
    private int _brakeStep;
    private int _shiftStep;

    // Pulso da mensagem GRAVE: opacidade + leve escala (1.0↔1.06) num
    // Storyboard sine, autoreverse forever. Comunicação fica fixa (sem
    // pulso — não é alerta, é informação).
    private Storyboard? _alertPulse;

    /// <summary>Estados visuais de cada bloco da stint bar.</summary>
    public enum StintBlockState
    {
        Pending,      // ainda não rodou — cinza faint
        Neutral,      // sem comparação clara — branco
        Faster,       // mais rápido que a melhor anterior — verde
        Slower,       // mais devagar — vermelho
        BestStint,    // melhor do stint atual — verde com shimmer
        BestAlltime,  // melhor de todos os tempos — dourado bloom
        Current,      // trecho em curso — amarelo (foco)
    }

    private static readonly Dictionary<StintBlockState, Color> StintColors = new()
    {
        [StintBlockState.Pending]     = Color.FromArgb(0xFF, 0x60, 0x60, 0x60),
        [StintBlockState.Neutral]     = Color.FromArgb(0xFF, 0xFF, 0xFF, 0xFF),
        [StintBlockState.Faster]      = Bom,
        [StintBlockState.Slower]      = Erro,
        [StintBlockState.BestStint]   = Bom,
        [StintBlockState.BestAlltime] = Ouro,
        [StintBlockState.Current]     = Foco,
    };

    public MainWindow() : this(new LaunchOptions(DisplayIndex: null)) { }

    public MainWindow(LaunchOptions options)
    {
        _options = options;
        InitializeComponent();
        ApplyDisplayPlacement();

        _leds = new[] { Led01, Led02, Led03, Led04, Led05, Led06, Led07, Led08, Led09,
                        Led10, Led11, Led12, Led13, Led14, Led15, Led16, Led17 };
        _stintBlocks = new[]
        {
            StintBlock01, StintBlock02, StintBlock03, StintBlock04,
            StintBlock05, StintBlock06, StintBlock07, StintBlock08,
            StintBlock09, StintBlock10, StintBlock11, StintBlock12,
        };

        _ledGlows = new[] { LedGlow01, LedGlow02, LedGlow03, LedGlow04, LedGlow05, LedGlow06,
                            LedGlow07, LedGlow08, LedGlow09, LedGlow10, LedGlow11, LedGlow12,
                            LedGlow13, LedGlow14, LedGlow15, LedGlow16, LedGlow17 };
        _brakeLeft  = new[] { BrakeL1, BrakeL2, BrakeL3, BrakeL4, BrakeL5, BrakeL6, BrakeL7, BrakeL8, BrakeL9 };
        _brakeRight = new[] { BrakeR1, BrakeR2, BrakeR3, BrakeR4, BrakeR5, BrakeR6, BrakeR7, BrakeR8, BrakeR9 };
        _brakeLeftGlow  = new[] { BrakeLGlow1, BrakeLGlow2, BrakeLGlow3, BrakeLGlow4, BrakeLGlow5, BrakeLGlow6, BrakeLGlow7, BrakeLGlow8, BrakeLGlow9 };
        _brakeRightGlow = new[] { BrakeRGlow1, BrakeRGlow2, BrakeRGlow3, BrakeRGlow4, BrakeRGlow5, BrakeRGlow6, BrakeRGlow7, BrakeRGlow8, BrakeRGlow9 };

        // Halos maiores (transbordam mais = wash mais forte) + ScaleTransform pra ignição.
        foreach (var g in _ledGlows)        InitGlow(g, 60, 13);
        foreach (var g in _brakeLeftGlow)   InitGlow(g, 72, 14);
        foreach (var g in _brakeRightGlow)  InitGlow(g, 72, 14);
        _sensorsMotor  = new[] { SensorRpm, SensorAcel, SensorFreioPedal, SensorAgua, SensorLambda, SensorBateria, SensorAlarme };
        _sensorsMov    = new[] { SensorGps, SensorAccel };
        _sensorsChassi = new[] { SensorPneus, SensorSusp, SensorCambio, SensorFreioDed, SensorDirecao };

        _cockpitState.OnChange((cur, _, keys) =>
        {
            DispatcherQueue.TryEnqueue(() =>
            {
                if (keys.Contains("trechoStatus")) ApplyHalo(cur.TrechoStatus);
                if (keys.Contains("shift"))        ApplyShift(cur.Shift);
                if (keys.Contains("delta"))        ApplyDelta(cur.Delta);
                if (keys.Contains("acao"))         ApplyAcao(cur.Acao);
                if (keys.Contains("apex"))         ApplyApex(cur.Apex);
                if (keys.Contains("message"))      ApplyMessage(cur.Message);
                if (keys.Contains("freio"))        ApplyFreio(cur.Freio);
                UpdateStatusText();
            });
        });

        var initial = _cockpitState.Get();
        ApplyHalo(initial.TrechoStatus);
        ApplyShift(initial.Shift);
        ApplyDelta(initial.Delta);
        ApplyAcao(initial.Acao);
        ApplyApex(initial.Apex);
        ApplyMessage(initial.Message);
        UpdateStatusText();

        // Demonstração de cenas fixas só com --demo. Sem a flag, a tela espera o
        // dado real do maestro (ligado por IniciarFeedReal no notebook).
        if (_options.Demo)
        {
            _demoTimer = DispatcherQueue.CreateTimer();
            _demoTimer.Interval = TimeSpan.FromSeconds(2);
            var sceneIndex = 0;
            _demoTimer.Tick += (_, _) =>
            {
                ApplyScene(sceneIndex % DemoScenes.Count);
                sceneIndex++;
            };
            _demoTimer.Start();
            ApplyScene(0);

            // Luz de freio: varre 0→9 (sequencial), pisca vermelho no fim, repete.
            _brakeTimer = DispatcherQueue.CreateTimer();
            _brakeTimer.Interval = TimeSpan.FromMilliseconds(120);
            _brakeTimer.Tick += (_, _) => { DemoBrakeRender(_brakeStep); _brakeStep = (_brakeStep + 1) % 17; };
            _brakeTimer.Start();

            // Shift light de marcha: varre das pontas pro centro (sequencial), pisca
            // vermelho ao atingir o topo (ponto de troca), reinicia. É o "RPM subindo".
            _shiftSweepTimer = DispatcherQueue.CreateTimer();
            _shiftSweepTimer.Interval = TimeSpan.FromMilliseconds(110);
            _shiftSweepTimer.Tick += (_, _) => { DemoShiftRender(_shiftStep); _shiftStep = (_shiftStep + 1) % 16; };
            _shiftSweepTimer.Start();
        }
        else if (_options.Replay)
        {
            // Etapa 1 do "ligar o dado real": maestro real alimentado por sessão gravada.
            StartReplay();
        }
    }

    // ── Varredura demo do SHIFT (marcha) ──────────────────────
    // steps 0..8: enche par a par das pontas pro centro (ignição em cada novo LED).
    // steps 9,11,13: pisca tudo vermelho (atingiu o ponto de troca). 10,12,14,15: apaga.
    private void DemoShiftRender(int step)
    {
        if (step <= 8)                              RenderShiftFill(step);
        else if (step == 9 || step == 11 || step == 13) RenderAllShift(LedShiftRed, on: true);
        else                                        RenderAllShift(LedOff, on: false);

        if (step == 9) WashTroca();   // demo: bateu o máximo → wash da troca (branco-azul)
    }

    // WASH DA TROCA (Flávio 25/06): clarão branco-azulado, 0,30 s, 3 pulsos a ~10 Hz,
    // uma vez por troca (debounce evita disparo duplo quando FIRE e a troca caem juntos).
    // São 3 CAMADAS sincronizadas no mesmo ritmo:
    //   1) o LED central acende e ESTOURA (cresce);
    //   2) a moldura do shift ganha brilho AZUL em volta;
    //   3) a tela inteira dá o lavado branco-azul.
    private long _lastWashTick;
    private void WashTroca()
    {
        var now = Environment.TickCount64;
        if (now - _lastWashTick < 280) return;   // uma vez por troca
        _lastWashTick = now;

        // Camada 3 (a principal): lavado da tela — storyboard PRÓPRIO, dispara sempre,
        // mesmo que uma camada secundária falhe.
        var sbWash = new Storyboard();
        WashPulseInto(sbWash, ShiftWashRect, "Opacity", 1.0);
        sbWash.Begin();

        // Camada 2: moldura do shift com brilho azul (dois anéis).
        try
        {
            var sbFrame = new Storyboard();
            WashPulseInto(sbFrame, ShiftPillGlow,  "Opacity", 1.0);
            WashPulseInto(sbFrame, ShiftPillGlow2, "Opacity", 0.85);
            sbFrame.Begin();
        }
        catch { /* moldura é secundária — nunca derruba o wash */ }

        // Camada 1: o LED central acende branco e o halo "estoura" (escala 1 → 2.6).
        try
        {
            if (_leds.Length == 17 && _ledGlows[8].RenderTransform is ScaleTransform st)
            {
                SetLedVisual(_leds[8], _ledGlows[8], LedFireWhite, true);
                var sbC = new Storyboard();
                WashScaleInto(sbC, st, "ScaleX");
                WashScaleInto(sbC, st, "ScaleY");
                sbC.Begin();
            }
        }
        catch { /* estouro do central é secundário */ }
    }

    // LAVADO DA FREADA: clarão VERMELHO (hora de frear), distinto do branco-azul da
    // troca. Mesmos 3 pulsos punchy, ponto forte embaixo. Uma vez por ponto de freada.
    private long _lastWashFreioTick;
    private void WashFreio()
    {
        var now = Environment.TickCount64;
        if (now - _lastWashFreioTick < 280) return;
        _lastWashFreioTick = now;
        var sb = new Storyboard();
        WashPulseInto(sb, BrakeWashRect, "Opacity", 1.0);
        sb.Begin();
    }

    // 3 pulsos PUNCHY (0 → pico → 0, três vezes) em 300 ms ≈ 10 Hz. Para a percepção
    // humana ser MÁXIMA: subida quase instantânea (~8 ms), platô no pico (~50 ms) e
    // queda rápida (~12 ms), com escuro total entre os pulsos = contraste máximo.
    private static void WashPulseInto(Storyboard sb, DependencyObject target, string prop, double peak)
    {
        var a = new DoubleAnimationUsingKeyFrames();
        void K(double ms, double v) => a.KeyFrames.Add(new LinearDoubleKeyFrame
        { KeyTime = KeyTime.FromTimeSpan(TimeSpan.FromMilliseconds(ms)), Value = v });
        // 3 estrobos: cada um sobe rápido, segura no pico, cai rápido, apaga.
        K(0, 0.0);   K(8, peak);   K(60, peak);   K(72, 0.0);    // pulso 1
        K(100, 0.0); K(108, peak); K(160, peak);  K(172, 0.0);   // pulso 2
        K(200, 0.0); K(208, peak); K(260, peak);  K(272, 0.0);   // pulso 3
        K(300, 0.0);
        Storyboard.SetTarget(a, target);
        Storyboard.SetTargetProperty(a, prop);
        sb.Children.Add(a);
    }

    // Escala que "estoura" forte nos picos (3.2) e recua entre eles, terminando em 1.
    private static void WashScaleInto(Storyboard sb, ScaleTransform st, string prop)
    {
        var a = new DoubleAnimationUsingKeyFrames();
        void K(double ms, double v) => a.KeyFrames.Add(new LinearDoubleKeyFrame
        { KeyTime = KeyTime.FromTimeSpan(TimeSpan.FromMilliseconds(ms)), Value = v });
        K(0, 1.0); K(8, 3.2); K(60, 3.2); K(72, 1.2); K(100, 1.2);
        K(108, 3.2); K(160, 3.2); K(172, 1.2); K(200, 1.2);
        K(208, 3.2); K(260, 3.2); K(272, 1.2); K(300, 1.0);
        Storyboard.SetTarget(a, st);
        Storyboard.SetTargetProperty(a, prop);
        sb.Children.Add(a);
    }

    private void RenderShiftFill(int pairs)
    {
        var n = _leds.Length;
        for (var i = 0; i < n; i++) SetLedVisual(_leds[i], _ledGlows[i], LedOff, false);
        for (var d = 0; d < pairs; d++)
        {
            var li = d;
            var ri = n - 1 - d;
            SetLedVisual(_leds[li], _ledGlows[li], ColorForTier(LedTierByPosition[li]), on: true, animate: true);
            SetLedVisual(_leds[ri], _ledGlows[ri], ColorForTier(LedTierByPosition[ri]), on: true, animate: true);
        }
    }

    private void RenderAllShift(Color color, bool on)
    {
        for (var i = 0; i < _leds.Length; i++) SetLedVisual(_leds[i], _ledGlows[i], color, on);
    }

    // ── Varredura demo da LUZ DE FREIO ────────────────────────
    private void DemoBrakeRender(int step)
    {
        if (step <= 9)                               ApplyBrake(step);
        else if (step == 10 || step == 12 || step == 14) RenderAllBrake(LedShiftRed, on: true);
        else                                         ApplyBrake(0);
    }

    private void RenderAllBrake(Color color, bool on)
    {
        for (var i = 0; i < _brakeLeft.Length; i++)
        {
            SetLedVisual(_brakeLeft[i],  _brakeLeftGlow[i],  color, on);
            SetLedVisual(_brakeRight[i], _brakeRightGlow[i], color, on);
        }
    }

    // ── Feed REAL (maestro) — ligado pela captura no notebook Windows ──────
    //
    // A ligação USB do motor e o GPS chamam AlimentarMotor/AlimentarGps; o maestro
    // muta o MESMO CockpitState que a tela observa. Tudo é despachado pra thread da
    // UI. As curvas (8 de Brasília) entram opcionais — sem elas, a tela mostra luz
    // de marcha + alertas; com elas, também bolinha do ápice + coach por curva.

    /// <summary>Liga o feed de dado real. Chamar uma vez, com as curvas da pista (ou null).</summary>
    public void IniciarFeedReal(IReadOnlyList<TrechoSegmento>? curvas = null)
    {
        _demoTimer?.Stop();
        _brakeTimer?.Stop();
        _shiftSweepTimer?.Stop();
        _orquestrador = new CockpitOrchestrator(_cockpitState, curvas);
    }

    /// <summary>Amostra de motor (rotação + dados pros alertas). Thread-safe.</summary>
    public void AlimentarMotor(double rpm, AmostraAlerta alerta)
        => DispatcherQueue.TryEnqueue(() => _orquestrador?.IngestMotor(rpm, alerta));

    /// <summary>Amostra de GPS (curva atual + bolinha + coach). Thread-safe.</summary>
    public void AlimentarGps(AmostraGps amostra)
        => DispatcherQueue.TryEnqueue(() => _orquestrador?.IngestGps(amostra));

    // ── Demo loop ──────────────────────────────────────────

    private record DemoScene(
        TrechoStatus Halo,
        ShiftMode Mode,
        int Level,
        string DeltaValue,
        Tone DeltaTone,
        string AcaoTexto,
        Tone AcaoTone,
        ApexEstado EntradaEstado,
        double EntradaKmh,
        ApexEstado FreioEstado,
        double FreioAtualM,
        double FreioRefM,
        ApexEstado ApiceEstado,
        double ApiceKmh,
        MsgTipo? MsgTipo,
        string MsgTexto,
        StintBlockState[]? StintPattern
    );

    private static readonly StintBlockState P = StintBlockState.Pending;
    private static readonly StintBlockState N = StintBlockState.Neutral;
    private static readonly StintBlockState F = StintBlockState.Faster;
    private static readonly StintBlockState S = StintBlockState.Slower;
    private static readonly StintBlockState BS = StintBlockState.BestStint;
    private static readonly StintBlockState BA = StintBlockState.BestAlltime;
    private static readonly StintBlockState C = StintBlockState.Current;

    /// <summary>
    /// Stint patterns que progridem ao longo do demo de 4 voltas (V5 out-lap,
    /// V6 média, V7 ruim, V8 boa-PB-ever). Histórico fictício pra antes da V5.
    /// </summary>
    private static readonly StintBlockState[] StintDuringV5     = { N, N, N, N, C, P, P, P, P, P, P, P };
    private static readonly StintBlockState[] StintAfterV5Neutral = { N, N, N, N, N, C, P, P, P, P, P, P };
    private static readonly StintBlockState[] StintDuringV6     = { N, N, N, N, N, C, P, P, P, P, P, P };
    private static readonly StintBlockState[] StintAfterV6Slower = { N, N, N, N, N, S, C, P, P, P, P, P };
    private static readonly StintBlockState[] StintDuringV7     = { N, N, N, N, N, S, C, P, P, P, P, P };
    private static readonly StintBlockState[] StintAfterV7Slower = { N, N, N, N, N, S, S, C, P, P, P, P };
    private static readonly StintBlockState[] StintDuringV8     = { N, N, N, N, N, S, S, C, P, P, P, P };
    private static readonly StintBlockState[] StintAfterV8Best  = { N, N, N, N, N, S, S, BA, P, P, P, P };

    /// <summary>
    /// Demo loop completo de 4 voltas baseado na fixture
    /// web/cockpit/fixtures/stint-brasilia-3-laps.v1.json. 30 cenas
    /// (V5 out-lap → V6 média → V7 ruim → V8 boa-PB-ever) × 2s = 60s.
    /// </summary>
    private static readonly IReadOnlyList<DemoScene> DemoScenes = new List<DemoScene>
    {
        // ── V5 out-lap aquecimento (+16.50s, comm AQUECENDO) ───────────
        new(TrechoStatus.Neutro,       ShiftMode.Lit, 2,
            "+5.50", Tone.Neutro, "AQUECENDO PNEUS", Tone.Neutro,
            ApexEstado.OkMelhor, 130, ApexEstado.OkMelhor, 100, 84, ApexEstado.OkMelhor, 60,
            P1Fast.Cockpit.Domain.MsgTipo.Comunicacao, "Out-lap • pneus a 35°C",
            StintDuringV5),
        new(TrechoStatus.Neutro,       ShiftMode.Lit, 3,
            "+11.00", Tone.Neutro, "SOBE NA C4", Tone.Neutro,
            ApexEstado.OkMelhor, 150, ApexEstado.OkMelhor, 90, 76, ApexEstado.OkMelhor, 75,
            P1Fast.Cockpit.Domain.MsgTipo.Comunicacao, "Aquecendo • alvo 78°C",
            StintDuringV5),
        new(TrechoStatus.Neutro,       ShiftMode.Off, 0,
            "+16.50", Tone.Neutro, "OUT-LAP FECHOU", Tone.Neutro,
            ApexEstado.OkMelhor, 165, ApexEstado.OkMelhor, 70, 56, ApexEstado.OkMelhor, 95,
            null, "",
            StintAfterV5Neutral),

        // ── V6 média (+0.78s) ─────────────────────────────────────────
        new(TrechoStatus.Neutro,       ShiftMode.Lit, 3,
            "-0.05", Tone.Bom, "C1 — NO RITMO", Tone.Bom,
            ApexEstado.OkMelhor, 172, ApexEstado.OkMelhor, 84, 84, ApexEstado.OkMelhor, 68,
            null, "",
            StintDuringV6),
        new(TrechoStatus.Neutro,       ShiftMode.Lit, 4,
            "+0.12", Tone.Erro, "C2 — PERDEU NA ENTRADA", Tone.Erro,
            ApexEstado.OkPior, 158, ApexEstado.OkPior, 72, 72, ApexEstado.OkPior, 87,
            null, "",
            StintDuringV6),
        new(TrechoStatus.Neutro,       ShiftMode.Lit, 4,
            "+0.18", Tone.Erro, "C3 — TÍMIDO NA 3", Tone.Erro,
            ApexEstado.OkMelhor, 166, ApexEstado.OkPior, 92, 92, ApexEstado.OkPior, 78,
            null, "",
            StintDuringV6),
        new(TrechoStatus.Neutro,       ShiftMode.Lit, 5,
            "+0.14", Tone.Bom, "C4 — NO RITMO", Tone.Bom,
            ApexEstado.OkMelhor, 182, ApexEstado.OkMelhor, 76, 76, ApexEstado.OkMelhor, 96,
            null, "",
            StintDuringV6),
        new(TrechoStatus.Neutro,       ShiftMode.Lit, 4,
            "+0.35", Tone.Erro, "C5 — PERDEU NA SAÍDA", Tone.Erro,
            ApexEstado.OkPior, 174, ApexEstado.OkPior, 88, 88, ApexEstado.OkPior, 84,
            null, "",
            StintDuringV6),
        new(TrechoStatus.Neutro,       ShiftMode.Lit, 2,
            "+0.33", Tone.Bom, "C6 — NO RITMO", Tone.Bom,
            ApexEstado.OkMelhor, 148, ApexEstado.OkMelhor, 104, 104, ApexEstado.OkMelhor, 62,
            null, "",
            StintDuringV6),
        new(TrechoStatus.Neutro,       ShiftMode.Lit, 4,
            "+0.56", Tone.Erro, "C7 — PERDEU NA SAÍDA", Tone.Erro,
            ApexEstado.OkPior, 166, ApexEstado.OkPior, 72, 72, ApexEstado.OkPior, 95,
            null, "",
            StintDuringV6),
        new(TrechoStatus.Neutro,       ShiftMode.Lit, 6,
            "+0.78", Tone.Bom, "C8 — NO RITMO", Tone.Bom,
            ApexEstado.OkMelhor, 178, ApexEstado.OkMelhor, 56, 56, ApexEstado.OkMelhor, 118,
            null, "",
            StintDuringV6),
        new(TrechoStatus.PiorStint,    ShiftMode.Off, 0,
            "+0.78", Tone.Erro, "V6 FECHOU +0,78", Tone.Erro,
            ApexEstado.OkMelhor, 178, ApexEstado.OkMelhor, 56, 56, ApexEstado.OkMelhor, 118,
            P1Fast.Cockpit.Domain.MsgTipo.Comunicacao, "Foco: freie mais cedo na 3",
            StintAfterV6Slower),

        // ── V7 ruim (+1.85s, atacou demais, motor 121°C, travou C5) ───
        new(TrechoStatus.PiorStint,    ShiftMode.Lit, 4,
            "+0.14", Tone.Erro, "C1 — VIOLENTO", Tone.Erro,
            ApexEstado.OkMelhor, 174, ApexEstado.OkPior, 84, 84, ApexEstado.OkPior, 62,
            P1Fast.Cockpit.Domain.MsgTipo.Grave, "Temperatura motor crítica",
            StintDuringV7),
        new(TrechoStatus.PiorStint,    ShiftMode.Lit, 3,
            "+0.20", Tone.Erro, "C2 — PERDEU NO ÁPICE", Tone.Erro,
            ApexEstado.OkMelhor, 160, ApexEstado.OkPior, 72, 72, ApexEstado.OkPior, 84,
            P1Fast.Cockpit.Domain.MsgTipo.Grave, "Temperatura motor crítica",
            StintDuringV7),
        new(TrechoStatus.PiorStint,    ShiftMode.Lit, 4,
            "+0.18", Tone.Erro, "C3 — PERDEU NA SAÍDA", Tone.Erro,
            ApexEstado.OkMelhor, 168, ApexEstado.OkPior, 92, 92, ApexEstado.OkPior, 75,
            P1Fast.Cockpit.Domain.MsgTipo.Grave, "Temperatura motor crítica",
            StintDuringV7),
        new(TrechoStatus.Neutro,       ShiftMode.Lit, 5,
            "-0.04", Tone.Bom, "C4 — ÚNICA BOA", Tone.Bom,
            ApexEstado.OkMelhor, 184, ApexEstado.OkMelhor, 76, 76, ApexEstado.OkMelhor, 96,
            null, "",
            StintDuringV7),
        new(TrechoStatus.PiorStint,    ShiftMode.Off, 0,
            "+0.45", Tone.Erro, "C5 — TRAVOU RODA", Tone.Erro,
            ApexEstado.OkMelhor, 176, ApexEstado.OkPior, 88, 88, ApexEstado.OkPior, 80,
            P1Fast.Cockpit.Domain.MsgTipo.Grave, "Pista — DEMO off-track",
            StintDuringV7),
        new(TrechoStatus.Neutro,       ShiftMode.Lit, 2,
            "-0.02", Tone.Bom, "C6 — SALVOU", Tone.Bom,
            ApexEstado.OkMelhor, 150, ApexEstado.OkMelhor, 104, 104, ApexEstado.OkMelhor, 62,
            null, "",
            StintDuringV7),
        new(TrechoStatus.PiorStint,    ShiftMode.Lit, 4,
            "+0.22", Tone.Erro, "C7 — TARDE + ATRASOU", Tone.Erro,
            ApexEstado.OkMelhor, 168, ApexEstado.OkPior, 72, 72, ApexEstado.OkPior, 92,
            null, "",
            StintDuringV7),
        new(TrechoStatus.PiorStint,    ShiftMode.Lit, 6,
            "+0.14", Tone.Erro, "C8 — VIOLENTO", Tone.Erro,
            ApexEstado.OkMelhor, 178, ApexEstado.OkPior, 56, 56, ApexEstado.OkPior, 115,
            null, "",
            StintDuringV7),
        new(TrechoStatus.PiorStint,    ShiftMode.Off, 0,
            "+1.85", Tone.Erro, "V7 FECHOU +1,85", Tone.Erro,
            ApexEstado.OkMelhor, 178, ApexEstado.OkPior, 56, 56, ApexEstado.OkPior, 115,
            P1Fast.Cockpit.Domain.MsgTipo.Grave, "Respira • você atacou demais",
            StintAfterV7Slower),

        // ── V8 boa (-0.11s, PB ever, 4 ápices PERFEITOS) ──────────────
        new(TrechoStatus.RecordeStint, ShiftMode.Lit, 3,
            "-0.08", Tone.Bom, "C1 — PERFEITO", Tone.Bom,
            ApexEstado.OkMelhor, 173, ApexEstado.OkMelhor, 84, 84, ApexEstado.OkMelhor, 70,
            null, "",
            StintDuringV8),
        new(TrechoStatus.RecordeStint, ShiftMode.Lit, 4,
            "-0.04", Tone.Bom, "C2 — NO PONTO", Tone.Bom,
            ApexEstado.OkMelhor, 161, ApexEstado.OkMelhor, 72, 72, ApexEstado.OkMelhor, 88,
            null, "",
            StintDuringV8),
        new(TrechoStatus.RecordeStint, ShiftMode.Lit, 4,
            "-0.02", Tone.Bom, "C3 — NO PONTO", Tone.Bom,
            ApexEstado.OkMelhor, 169, ApexEstado.OkMelhor, 92, 92, ApexEstado.OkMelhor, 79,
            null, "",
            StintDuringV8),
        new(TrechoStatus.RecordeStint, ShiftMode.Lit, 5,
            "-0.07", Tone.Bom, "C4 — PERFEITO", Tone.Bom,
            ApexEstado.OkMelhor, 184, ApexEstado.OkMelhor, 76, 76, ApexEstado.OkMelhor, 97,
            null, "",
            StintDuringV8),
        new(TrechoStatus.RecordeStint, ShiftMode.Lit, 4,
            "-0.03", Tone.Bom, "C5 — NO PONTO", Tone.Bom,
            ApexEstado.OkMelhor, 175, ApexEstado.OkMelhor, 88, 88, ApexEstado.OkMelhor, 86,
            P1Fast.Cockpit.Domain.MsgTipo.Comunicacao, "Combustível 12% • atenção",
            StintDuringV8),
        new(TrechoStatus.RecordeStint, ShiftMode.Lit, 2,
            "-0.04", Tone.Bom, "C6 — NO PONTO", Tone.Bom,
            ApexEstado.OkMelhor, 149, ApexEstado.OkMelhor, 104, 104, ApexEstado.OkMelhor, 64,
            null, "",
            StintDuringV8),
        new(TrechoStatus.RecordeStint, ShiftMode.Lit, 4,
            "-0.03", Tone.Bom, "C7 — NO PONTO", Tone.Bom,
            ApexEstado.OkMelhor, 168, ApexEstado.OkMelhor, 72, 72, ApexEstado.OkMelhor, 96,
            null, "",
            StintDuringV8),
        new(TrechoStatus.RecordeStint, ShiftMode.Lit, 6,
            "-0.05", Tone.Bom, "C8 — PERFEITO", Tone.Bom,
            ApexEstado.OkMelhor, 180, ApexEstado.OkMelhor, 56, 56, ApexEstado.OkMelhor, 119,
            null, "",
            StintDuringV8),
        // V8 fim — PB EVER, halo ouro (MelhorHistorico), mensagem do coach
        new(TrechoStatus.MelhorHistorico, ShiftMode.Off, 0,
            "-0.11", Tone.Bom, "PB EVER • RITMO BOM", Tone.Bom,
            ApexEstado.OkMelhor, 180, ApexEstado.OkMelhor, 56, 56, ApexEstado.OkMelhor, 119,
            P1Fast.Cockpit.Domain.MsgTipo.Comunicacao, "Repete • 1:31.89",
            StintAfterV8Best),
    };

    private void ApplyScene(int index)
    {
        var s = DemoScenes[index];
        _cockpitState.SetTrechoStatus(s.Halo);
        // O shift light é comandado pela varredura demo (DemoShiftRender), não pela cena.
        _cockpitState.SetDelta(s.DeltaValue, s.DeltaTone);
        // Só a mensagem — sem "C1/C2/…" na frente (o piloto não quer o nome do trecho).
        _cockpitState.SetAcao(StripCurva(s.AcaoTexto), s.AcaoTone);

        if (s.EntradaKmh > 0)
            _cockpitState.SetApexPonto("entrada", estado: s.EntradaEstado, valorKmh: s.EntradaKmh);
        if (s.FreioAtualM > 0)
            _cockpitState.SetApexPonto("freio", estado: s.FreioEstado, atualM: s.FreioAtualM, refM: s.FreioRefM);
        if (s.ApiceKmh > 0)
            _cockpitState.SetApexPonto("apice", estado: s.ApiceEstado, valorKmh: s.ApiceKmh);

        if (s.MsgTipo is { } tipo && !string.IsNullOrEmpty(s.MsgTexto))
            _cockpitState.ShowMessage(tipo, s.MsgTexto);
        else
            _cockpitState.HideMessage();

        if (s.StintPattern is not null)
            ApplyStintPattern(s.StintPattern);

        // Resultado da freada (à direita) — espelha o ponto de freio do trecho.
        ApplyBrakeResult(s.FreioEstado, s.FreioAtualM, s.FreioRefM);

        // Sensores: motor/movimento comunicando (verde); chassi "a instalar" (vermelho).
        // Falha de motor (mensagem GRAVE) acende água/lambda/alarme em amarelo.
        ApplySensors(falhaMotor: s.MsgTipo == P1Fast.Cockpit.Domain.MsgTipo.Grave);
    }

    // ── Apply* ─────────────────────────────────────────────

    private void ApplyHalo(TrechoStatus status)
    {
        if (!HaloColors.TryGetValue(status, out var color)) return;
        HaloStopCenter.Color = color;

        // Pulsa só nos estados de glória (recorde do stint e PB ever).
        // Pior fica fixo: pulso seria fadiga visual em cima de alerta vermelho.
        var shouldPulse = status is TrechoStatus.RecordeStint or TrechoStatus.MelhorHistorico;
        if (shouldPulse) StartHaloPulse(); else StopHaloPulse();
    }

    private void StartHaloPulse()
    {
        if (_haloPulse is not null) return;
        var anim = new DoubleAnimation
        {
            From = 0.55,
            To = 1.0,
            Duration = new Duration(TimeSpan.FromMilliseconds(900)),
            AutoReverse = true,
            RepeatBehavior = RepeatBehavior.Forever,
            EasingFunction = new SineEase { EasingMode = EasingMode.EaseInOut },
        };
        Storyboard.SetTarget(anim, HaloRect);
        Storyboard.SetTargetProperty(anim, "Opacity");
        _haloPulse = new Storyboard();
        _haloPulse.Children.Add(anim);
        _haloPulse.Begin();
    }

    private void StopHaloPulse()
    {
        if (_haloPulse is null) return;
        _haloPulse.Stop();
        _haloPulse = null;
        HaloRect.Opacity = 1.0;
    }

    private void ApplyShift(ShiftState shift)
    {
        if (_leds.Length != 17) return;

        // Upshift = vinha em RPM alto (level>=5) e caiu — em modo Lit nos dois
        // lados. Em real racing equivale a "trocou pra marcha mais alta, RPM
        // despencou". Off→Lit ou Lit→Off (boxes / fim de volta) não conta.
        var isUpshift =
            _previousShiftMode == ShiftMode.Lit &&
            shift.Mode == ShiftMode.Lit &&
            _previousShiftLevel >= 5 &&
            shift.Level < _previousShiftLevel;

        // Entrou em FIRE ("troca agora", potência máxima): wash da troca. OVERREV NÃO
        // lava — é o alarme vermelho separado. Só na transição.
        var entrouFire =
            shift.Mode == ShiftMode.Fire &&
            _previousShiftMode != ShiftMode.Fire;

        _previousShiftLevel = shift.Level;
        _previousShiftMode = shift.Mode;

        if (entrouFire) WashTroca();

        if (isUpshift)
        {
            BeginShiftFlash(shift);
            return;
        }

        // Se um flash está em curso, segura o próximo render — restaura sozinho
        // quando o timer terminar. Evita que o branco seja sobrescrito antes
        // de ser percebido.
        if (_shiftFlashTimer is { IsRunning: true })
        {
            _flashRestoreState = shift;
            return;
        }

        RenderShiftLeds(shift);
    }

    private void BeginShiftFlash(ShiftState restoreAfter)
    {
        // Troca de marcha detectada (upshift): wash da troca + LEDs estouram brancos.
        WashTroca();
        for (var i = 0; i < _leds.Length; i++) SetLedVisual(_leds[i], _ledGlows[i], LedFireWhite, true);
        _flashRestoreState = restoreAfter;

        if (_shiftFlashTimer is null)
        {
            _shiftFlashTimer = DispatcherQueue.CreateTimer();
            _shiftFlashTimer.IsRepeating = false;
            _shiftFlashTimer.Interval = TimeSpan.FromMilliseconds(140);
            _shiftFlashTimer.Tick += EndShiftFlash;
        }
        _shiftFlashTimer.Stop();
        _shiftFlashTimer.Start();
    }

    private void EndShiftFlash(Microsoft.UI.Dispatching.DispatcherQueueTimer sender, object args)
    {
        sender.Stop();
        var restore = _flashRestoreState ?? _cockpitState.Get().Shift;
        _flashRestoreState = null;
        RenderShiftLeds(restore);
    }

    private void RenderShiftLeds(ShiftState shift)
    {
        if (shift.Mode == ShiftMode.Fire)
        {
            for (var i = 0; i < _leds.Length; i++) SetLedVisual(_leds[i], _ledGlows[i], LedFireWhite, true);
            return;
        }
        if (shift.Mode == ShiftMode.Overrev)
        {
            for (var i = 0; i < _leds.Length; i++) SetLedVisual(_leds[i], _ledGlows[i], LedOverrevRed, true);
            return;
        }
        for (var i = 0; i < _leds.Length; i++)
            SetLedVisual(_leds[i], _ledGlows[i], LedOff, false);

        if (shift.Mode != ShiftMode.Lit || shift.Level <= 0) return;

        // Acende das PONTAS pro CENTRO, par a par (igual ao aprovado: tier 1 nas
        // pontas acende primeiro, sobe rumo ao centro). A central (tier 9, índice 8)
        // NUNCA acende em LIT — fica reservada pro FIRE. Por isso os pares varrem só
        // as 16 laterais: com halfDots ≤ 8, leftIdx vai 0..7 e rightIdx 16..9.
        var dots = CockpitState.ShiftDotsForLevel(shift.Level);
        var halfDots = dots / 2;
        var n = _leds.Length;
        for (var d = 0; d < halfDots; d++)
        {
            var leftIdx  = d;
            var rightIdx = n - 1 - d;
            SetLedVisual(_leds[leftIdx],  _ledGlows[leftIdx],  ColorForTier(LedTierByPosition[leftIdx]),  on: true, animate: true);
            SetLedVisual(_leds[rightIdx], _ledGlows[rightIdx], ColorForTier(LedTierByPosition[rightIdx]), on: true, animate: true);
        }
    }

    // Halo: tamanho maior (mais wash) + origem central pro pop de ignição.
    // Centraliza o halo na célula via Canvas (o Canvas, ao contrário do Grid de
    // tamanho fixo, NÃO recorta o halo — por isso ele transborda redondo em vez de
    // virar quadrado). Em células ainda em Grid, o Canvas.Left/Top é ignorado.
    private static void InitGlow(Ellipse glow, double size, double cellSize)
    {
        glow.Width = size;
        glow.Height = size;
        Microsoft.UI.Xaml.Controls.Canvas.SetLeft(glow, (cellSize - size) / 2);
        Microsoft.UI.Xaml.Controls.Canvas.SetTop(glow, (cellSize - size) / 2);
        glow.RenderTransformOrigin = new Windows.Foundation.Point(0.5, 0.5);
        glow.RenderTransform = new ScaleTransform { ScaleX = 1.0, ScaleY = 1.0 };
    }

    // ── LED premium: domo 3D no ponto + halo (glow) atrás que transborda (wash) ──
    // `animate` dispara a ignição (pop) quando o LED passa de apagado pra aceso.
    private void SetLedVisual(Ellipse dot, Ellipse glow, Color color, bool on, bool animate = false)
    {
        if (on)
        {
            dot.Fill = Dome(color);
            glow.Fill = Glow(color);
            var wasLit = _glowsLit.Contains(glow);
            if (animate && !wasLit)
                IgniteGlow(glow);
            else if (!wasLit || !animate)
                glow.Opacity = 1.0;
            _glowsLit.Add(glow);
        }
        else
        {
            dot.Fill = OffDome();
            glow.Opacity = 0.0;
            if (glow.RenderTransform is ScaleTransform st) { st.ScaleX = 1.0; st.ScaleY = 1.0; }
            _glowsLit.Remove(glow);
        }
    }

    // Ignição: o halo "estoura" (escala 0.5 → overshoot → 1.0) e a luz sobe rápido —
    // espelha o ledIgnite do web (brightness flash quando o LED acende).
    private void IgniteGlow(Ellipse glow)
    {
        glow.Opacity = 1.0;
        if (glow.RenderTransform is not ScaleTransform st) return;

        var ease = new BackEase { EasingMode = EasingMode.EaseOut, Amplitude = 0.7 };
        var dur = new Duration(TimeSpan.FromMilliseconds(360));
        var sb = new Storyboard();
        foreach (var prop in new[] { "ScaleX", "ScaleY" })
        {
            var a = new DoubleAnimation { From = 0.45, To = 1.0, Duration = dur, EasingFunction = ease };
            Storyboard.SetTarget(a, st);
            Storyboard.SetTargetProperty(a, prop);
            sb.Children.Add(a);
        }
        var op = new DoubleAnimation { From = 0.25, To = 1.0, Duration = new Duration(TimeSpan.FromMilliseconds(220)) };
        Storyboard.SetTarget(op, glow);
        Storyboard.SetTargetProperty(op, "Opacity");
        sb.Children.Add(op);
        sb.Begin();
    }

    private RadialGradientBrush OffDome()
    {
        if (_offDome is null)
        {
            _offDome = new RadialGradientBrush { Center = new(0.4, 0.32), GradientOrigin = new(0.4, 0.32), RadiusX = 0.72, RadiusY = 0.72 };
            _offDome.GradientStops.Add(new GradientStop { Color = Color.FromArgb(0xFF, 0x26, 0x26, 0x26), Offset = 0.0 });
            _offDome.GradientStops.Add(new GradientStop { Color = Color.FromArgb(0xFF, 0x15, 0x15, 0x15), Offset = 0.6 });
            _offDome.GradientStops.Add(new GradientStop { Color = Color.FromArgb(0xFF, 0x0A, 0x0A, 0x0A), Offset = 1.0 });
        }
        return _offDome;
    }

    private RadialGradientBrush Dome(Color c)
    {
        var key = ColorKey(c);
        if (!_domeCache.TryGetValue(key, out var b))
        {
            // Domo de vidro: especular quente no topo-esquerda, corpo na cor, borda
            // funda pra dar volume 3D (acabamento premium — Flávio 25/06).
            b = new RadialGradientBrush { Center = new(0.34, 0.26), GradientOrigin = new(0.30, 0.22), RadiusX = 0.95, RadiusY = 0.95 };
            b.GradientStops.Add(new GradientStop { Color = MixColor(c, White, 0.94), Offset = 0.0 });   // brilho especular
            b.GradientStops.Add(new GradientStop { Color = MixColor(c, White, 0.46), Offset = 0.16 });
            b.GradientStops.Add(new GradientStop { Color = c,                        Offset = 0.52 });
            b.GradientStops.Add(new GradientStop { Color = MixColor(c, Black, 0.28), Offset = 0.82 });
            b.GradientStops.Add(new GradientStop { Color = MixColor(c, Black, 0.62), Offset = 1.0 });   // borda funda = volume
            _domeCache[key] = b;
        }
        return b;
    }

    private RadialGradientBrush Glow(Color c)
    {
        var key = ColorKey(c);
        if (!_glowCache.TryGetValue(key, out var b))
        {
            // Bloom suave e largo (halo que transborda = "wash"). Núcleo quente,
            // cauda longa até transparente pra lavar o painel sem borda dura.
            b = new RadialGradientBrush { Center = new(0.5, 0.5), GradientOrigin = new(0.5, 0.5), RadiusX = 0.5, RadiusY = 0.5 };
            b.GradientStops.Add(new GradientStop { Color = WithAlpha(MixColor(c, White, 0.38), 0xFF), Offset = 0.0 });
            b.GradientStops.Add(new GradientStop { Color = WithAlpha(c, 0xCC), Offset = 0.15 });
            b.GradientStops.Add(new GradientStop { Color = WithAlpha(c, 0x8A), Offset = 0.34 });
            b.GradientStops.Add(new GradientStop { Color = WithAlpha(c, 0x38), Offset = 0.62 });
            b.GradientStops.Add(new GradientStop { Color = WithAlpha(c, 0x00), Offset = 1.0 });
            _glowCache[key] = b;
        }
        return b;
    }

    private static readonly Color Black = Color.FromArgb(0xFF, 0x00, 0x00, 0x00);
    private static uint ColorKey(Color c) => (uint)((c.A << 24) | (c.R << 16) | (c.G << 8) | c.B);
    private static byte Lerp(byte a, byte b, double t) => (byte)Math.Round(a + (b - a) * t);
    private static Color MixColor(Color a, Color b, double t) => Color.FromArgb(0xFF, Lerp(a.R, b.R, t), Lerp(a.G, b.G, t), Lerp(a.B, b.B, t));
    private static Color WithAlpha(Color c, byte alpha) => Color.FromArgb(alpha, c.R, c.G, c.B);

    // Rampa do aprovado: tiers 1-4 verde · 5-7 amarelo · 8-9 vermelho.
    private static Color ColorForTier(int tier) => tier switch
    {
        >= 1 and <= 4 => LedShiftGreen,
        5 or 6 or 7   => LedShiftYellow,
        8 or 9        => LedShiftRed,
        _             => LedOff,
    };

    // ── Luz de freio lateral ───────────────────────────────
    // Acende os primeiros `level` pontos (de cima pra baixo) nas duas laterais,
    // cada um com a cor do seu tier (verde → âmbar → vermelho).
    private void ApplyBrake(int level)
    {
        if (_brakeLeft.Length != 9 || _brakeRight.Length != 9) return;
        for (var i = 0; i < 9; i++)
        {
            var on = i < level;
            var color = on ? BrakeColorForTier(BrakeTierByPosition[i]) : LedOff;
            SetLedVisual(_brakeLeft[i],  _brakeLeftGlow[i],  color, on, animate: true);
            SetLedVisual(_brakeRight[i], _brakeRightGlow[i], color, on, animate: true);
        }
    }

    private static Color BrakeColorForTier(char tier) => tier switch
    {
        'g' => LedShiftGreen,
        'a' => LedShiftYellow,
        'r' => LedShiftRed,
        _   => LedOff,
    };

    // ── Resultado da freada (à direita, espelha o delta) ───
    private void ApplyBrakeResult(ApexEstado estado, double atualM, double refM)
    {
        if (atualM <= 0 || refM <= 0)
        {
            BrakeResultNum.Text = "—";
            BrakeResultNum.Foreground = new SolidColorBrush(Muted);
            BrakeResultWord.Foreground = new SolidColorBrush(Muted);
            return;
        }
        // Sem sinal — a cor (verde/vermelho) já diz se foi bom ou ruim.
        var diff = (int)Math.Round(atualM - refM);
        BrakeResultNum.Text = Math.Abs(diff).ToString();
        var color = ColorForApexEstado(estado);
        BrakeResultNum.Foreground = new SolidColorBrush(color);
        BrakeResultWord.Foreground = new SolidColorBrush(color);
    }

    // ── Luz de freio REAL (observada do CockpitState, comandada pelo maestro) ──
    // Lit (0..9) enche por tempo; FlashSeq sobe → pisca no ponto; resultado à direita.
    private int _lastBrakeFlashSeq;
    private int _lastBrakeLit;
    private Microsoft.UI.Dispatching.DispatcherQueueTimer? _brakeRealFlashTimer;

    private void ApplyFreio(FreioState f)
    {
        _lastBrakeLit = f.Lit;
        ApplyBrake(f.Lit);
        ApplyFreioResultado(f);

        if (f.FlashSeq != _lastBrakeFlashSeq)
        {
            _lastBrakeFlashSeq = f.FlashSeq;
            BeginBrakeRealFlash();   // luzes de freio laterais piscam no ponto
            WashFreio();             // + a tela LAVA vermelho (hora de frear) — Flávio 25/06
        }
    }

    private void ApplyFreioResultado(FreioState f)
    {
        BrakeResultNum.Text = f.ResultadoM is { } m ? m.ToString() : "—";
        BrakeResultWord.Text = f.ResultadoPalavra;
        var color = f.ResultadoTom switch
        {
            FreioTom.Bom  => Bom,
            FreioTom.Foco => Foco,
            FreioTom.Erro => Erro,
            _             => Muted,
        };
        BrakeResultNum.Foreground = new SolidColorBrush(color);
        BrakeResultWord.Foreground = new SolidColorBrush(color);
    }

    // Pisca as luzes laterais todas vermelhas no ponto de freada e restaura o nível.
    private void BeginBrakeRealFlash()
    {
        for (var i = 0; i < _brakeLeft.Length; i++)
        {
            SetLedVisual(_brakeLeft[i],  _brakeLeftGlow[i],  LedShiftRed, on: true);
            SetLedVisual(_brakeRight[i], _brakeRightGlow[i], LedShiftRed, on: true);
        }
        if (_brakeRealFlashTimer is null)
        {
            _brakeRealFlashTimer = DispatcherQueue.CreateTimer();
            _brakeRealFlashTimer.IsRepeating = false;
            _brakeRealFlashTimer.Interval = TimeSpan.FromMilliseconds(340);
            _brakeRealFlashTimer.Tick += (_, _) => ApplyBrake(_lastBrakeLit);
        }
        _brakeRealFlashTimer.Stop();
        _brakeRealFlashTimer.Start();
    }

    // ── Cluster de sensores (topo) ─────────────────────────
    private void ApplySensors(bool falhaMotor)
    {
        foreach (var s in _sensorsMotor) ((SolidColorBrush)s.Fill).Color = SensorOk;
        foreach (var s in _sensorsMov)   ((SolidColorBrush)s.Fill).Color = SensorOk;
        // Chassi ainda não instalado → sem comunicação (vermelho), igual ao web.
        foreach (var s in _sensorsChassi) ((SolidColorBrush)s.Fill).Color = SensorOff;

        if (falhaMotor)
        {
            ((SolidColorBrush)SensorAgua.Fill).Color   = SensorWarn;
            ((SolidColorBrush)SensorLambda.Fill).Color = SensorWarn;
            ((SolidColorBrush)SensorAlarme.Fill).Color = SensorWarn;
        }
    }

    private void ApplyDelta(DeltaInfo delta)
    {
        // Sem sinal (+/-): a COR diz se é bom (verde) ou ruim (vermelho) — nem sempre
        // negativo é ruim. Mostra só o valor absoluto.
        var txt = string.IsNullOrEmpty(delta.Value) ? "0.00" : delta.Value.TrimStart('+', '-', ' ');
        DeltaText.Text = txt;
        DeltaText.Foreground = new SolidColorBrush(ColorForTone(delta.Tone, fallback: Muted));
    }

    private void ApplyAcao(AcaoInfo acao)
    {
        AcaoText.Text = acao.Texto ?? string.Empty;
        AcaoText.Foreground = new SolidColorBrush(ColorForTone(acao.Tone, fallback: Foco));
    }

    // Tira o prefixo de trecho/curva ("C6 — ", "V7 — ") — fica só a mensagem.
    private static string StripCurva(string? texto) =>
        System.Text.RegularExpressions.Regex.Replace(texto ?? string.Empty, @"^[CV]\d+\s*[—\-:]\s*", "");

    private static Color ColorForTone(Tone tone, Color fallback) => tone switch
    {
        Tone.Bom    => Bom,
        Tone.Erro   => Erro,
        _           => fallback,
    };

    private void ApplyApex(ApexState apex)
    {
        // Entrada/Saída = velocidade (só o número, sem "km/h"). Ápice = distância da
        // bolinha em METROS (não velocidade). Freio = atual/ref em metros. (Flávio 25/06)
        ApplyApexPonto(ApexEntradaValor, apex.Entrada, formatKmh: false);
        ApplyApexFreio(ApexFreioValor,   apex.Freio);
        ApplyApexApice(ApexApiceValor,   apex.Apice);
        ApplyApexPonto(ApexSaidaValor,   apex.Saida,   formatKmh: false);
    }

    // Ápice mostra a distância da bolinha ao ápice ideal, em metros.
    private static void ApplyApexApice(Microsoft.UI.Xaml.Controls.TextBlock text, ApexPonto p)
    {
        if (p.DistM is { } d)
        {
            text.Text = $"{d:0} m";
            text.Foreground = new SolidColorBrush(ColorForApexEstado(p.Estado));
        }
        else if (p.ValorKmh is { } kmh)
        {
            text.Text = kmh.ToString("0");
            text.Foreground = new SolidColorBrush(ColorForApexEstado(p.Estado));
        }
        else
        {
            text.Text = "—";
            text.Foreground = new SolidColorBrush(Faint);
        }
    }

    private static void ApplyApexPonto(Microsoft.UI.Xaml.Controls.TextBlock text, ApexPonto p, bool formatKmh)
    {
        if (p.ValorKmh is { } kmh)
        {
            text.Text = formatKmh ? $"{kmh:0} km/h" : kmh.ToString("0");
            text.Foreground = new SolidColorBrush(ColorForApexEstado(p.Estado));
        }
        else
        {
            text.Text = "—";
            text.Foreground = new SolidColorBrush(Faint);
        }
    }

    private static void ApplyApexFreio(Microsoft.UI.Xaml.Controls.TextBlock text, ApexPonto p)
    {
        if (p.AtualM is { } atual && p.RefM is { } refM)
        {
            text.Text = $"{atual:0}/{refM:0} m";
            text.Foreground = new SolidColorBrush(ColorForApexEstado(p.Estado));
        }
        else
        {
            text.Text = "—";
            text.Foreground = new SolidColorBrush(Faint);
        }
    }

    private static Color ColorForApexEstado(ApexEstado estado) => estado switch
    {
        ApexEstado.OkMelhor => Bom,
        ApexEstado.OkPior   => Erro,
        _                   => Muted,
    };

    private void ApplyMessage(P1Fast.Cockpit.Domain.Message? msg)
    {
        if (msg is null)
        {
            StopAlertPulse();
            AlertBlocoRoot.Visibility = Visibility.Collapsed;
            BrakeResultPanel.Visibility = Visibility.Visible;   // mensagem saiu → volta a FREADA
            return;
        }
        AlertText.Text = msg.Texto;
        AlertText.Foreground = new SolidColorBrush(
            msg.Tipo == P1Fast.Cockpit.Domain.MsgTipo.Grave ? Erro : Sistema);
        AlertBlocoRoot.Visibility = Visibility.Visible;
        BrakeResultPanel.Visibility = Visibility.Collapsed;     // mensagem ocupa a direita → some a FREADA

        if (msg.Tipo == P1Fast.Cockpit.Domain.MsgTipo.Grave)
            StartAlertPulse();
        else
            StopAlertPulse();
    }

    private void StartAlertPulse()
    {
        if (_alertPulse is not null) return;

        var ease = new SineEase { EasingMode = EasingMode.EaseInOut };
        var dur = new Duration(TimeSpan.FromMilliseconds(700));

        var opacity = new DoubleAnimation
        {
            From = 0.6,
            To = 1.0,
            Duration = dur,
            AutoReverse = true,
            RepeatBehavior = RepeatBehavior.Forever,
            EasingFunction = ease,
        };
        Storyboard.SetTarget(opacity, AlertBlocoRoot);
        Storyboard.SetTargetProperty(opacity, "Opacity");

        var scaleX = new DoubleAnimation
        {
            From = 1.0,
            To = 1.06,
            Duration = dur,
            AutoReverse = true,
            RepeatBehavior = RepeatBehavior.Forever,
            EasingFunction = ease,
        };
        Storyboard.SetTarget(scaleX, AlertScale);
        Storyboard.SetTargetProperty(scaleX, "ScaleX");

        var scaleY = new DoubleAnimation
        {
            From = 1.0,
            To = 1.06,
            Duration = dur,
            AutoReverse = true,
            RepeatBehavior = RepeatBehavior.Forever,
            EasingFunction = ease,
        };
        Storyboard.SetTarget(scaleY, AlertScale);
        Storyboard.SetTargetProperty(scaleY, "ScaleY");

        _alertPulse = new Storyboard();
        _alertPulse.Children.Add(opacity);
        _alertPulse.Children.Add(scaleX);
        _alertPulse.Children.Add(scaleY);
        _alertPulse.Begin();
    }

    private void StopAlertPulse()
    {
        if (_alertPulse is null) return;
        _alertPulse.Stop();
        _alertPulse = null;
        AlertBlocoRoot.Opacity = 1.0;
        AlertScale.ScaleX = 1.0;
        AlertScale.ScaleY = 1.0;
    }

    private void ApplyStintPattern(StintBlockState[] pattern)
    {
        if (_stintBlocks.Length != 12) return;
        for (var i = 0; i < _stintBlocks.Length && i < pattern.Length; i++)
        {
            if (StintColors.TryGetValue(pattern[i], out var color))
                _stintBlocks[i].Background = new SolidColorBrush(color);
        }
    }

    private void UpdateStatusText()
    {
        var s = _cockpitState.Get();
        var displayInfo = _options.DisplayIndex is { } idx
            ? $"display {idx} fullscreen"
            : "janelado (primário)";
        StatusText.Text = $"{displayInfo}  •  trecho={s.TrechoStatus}  •  shift={s.Shift.Mode} L{s.Shift.Level}  •  Δ={s.Delta.Value}";
    }

    // Escala o device pra caber INTEIRO na tela, centralizado, com letterbox na sobra.
    // O conteúdo do cockpit transborda a caixa nominal 956×440 (os rótulos do ápice
    // ficam abaixo de 440 e os halos da barra de marcha estouram pra fora). Escalar/
    // centralizar pela caixa nominal jogava esse conteúdo de baixo pra fora da tela.
    // Por isso usamos uma MOLDURA SEGURA que engloba a sobra.
    private const double SafeW = 1030.0;  // 956 + folga lateral (FREADA à direita)
    private const double SafeH = 545.0;   // 440 + folga embaixo (ápice + barra/halos do shift)

    private void OnRootSizeChanged(object sender, SizeChangedEventArgs e)
    {
        var w = e.NewSize.Width;
        var h = e.NewSize.Height;
        var s = Math.Min(w / SafeW, h / SafeH);
        if (s <= 0 || double.IsNaN(s) || double.IsInfinity(s)) return;
        DeviceScale.ScaleX = s;
        DeviceScale.ScaleY = s;
        // Ancora o canto superior-esquerdo do device no canto da MOLDURA SEGURA
        // centralizada. Como a sobra é só pra direita (FREADA) e pra baixo (ápice/halos),
        // ela preenche o espaço extra da moldura e cabe inteira na tela.
        DeviceTranslate.X = (w - SafeW * s) / 2.0;
        DeviceTranslate.Y = (h - SafeH * s) / 2.0;
    }

    private void ApplyDisplayPlacement()
    {
        var hwnd = WindowNative.GetWindowHandle(this);
        var windowId = Win32Interop.GetWindowIdFromWindow(hwnd);
        var appWindow = AppWindow.GetFromWindowId(windowId);

        // Display externo explícito (10,5" no painel quando plugado) → tela cheia nele.
        if (_options.DisplayIndex is { } oneIndexed)
        {
            var areas = DisplayArea.FindAll();
            var zeroIndexed = oneIndexed - 1;
            if (zeroIndexed >= 0 && zeroIndexed < areas.Count)
            {
                var area = areas[zeroIndexed];
                appWindow.MoveAndResize(area.OuterBounds);
                appWindow.SetPresenter(AppWindowPresenterKind.FullScreen);
                return;
            }
        }

        // Dev: --windowed abre janelado (não cobre a tela toda) pra ajustar/inspecionar.
        if (_options.Windowed)
        {
            appWindow.Resize(new SizeInt32 { Width = 1180, Height = 660 });
            return;
        }

        // PADRÃO neste notebook: TELA CHEIA na tela atual (a de 10,5"). Antes abria
        // janelado 1280×800 — alto demais pra esta tela de 720 e cortava a barra de
        // marcha embaixo. Tela cheia usa os 720 inteiros e cabe o device completo.
        appWindow.SetPresenter(AppWindowPresenterKind.FullScreen);
    }
}
