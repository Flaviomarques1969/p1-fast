using Microsoft.UI;
using Microsoft.UI.Windowing;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI.Xaml.Shapes;
using P1Fast.Cockpit.Domain;
using Windows.Graphics;
using Windows.UI;
using WinRT.Interop;

namespace P1Fast.Cockpit.UI;

/// <summary>
/// Janela principal do cockpit. Quando recebe <c>--display-index N</c>,
/// move pra esse monitor (1-indexado) e entra em fullscreen — alvo é a
/// tela 10,5" externa invertida no painel (ADR-023 amendment 5). Sem
/// essa flag, abre janelado no primário pra desenvolvimento.
///
/// Esta iteração (PR-B+C) traz:
/// - Halo radial — cor por TrechoStatus (versão simplificada com
///   SolidColorBrush; radial fica pra próxima quando confirmar a
///   sintaxe de RadialGradientBrush no WinUI 3 1.6).
/// - Shift light — 12 LEDs horizontais top, tiers 1..6 espelhados,
///   cores verde/amarelo/vermelho. Fire vira branco; overrev vira
///   vermelho strobe (animações virão depois).
/// - Demo loop sintético — cicla cenas (halo neutro→recorde, shift
///   level 0→6→fire→overrev) a cada 2 s.
/// </summary>
public sealed partial class MainWindow : Window
{
    private readonly CockpitState _cockpitState = new();
    private readonly LaunchOptions _options;
    private readonly Microsoft.UI.Dispatching.DispatcherQueueTimer _demoTimer;

    /// <summary>Cores do halo radial — conversão aproximada das tokens OKlch.</summary>
    private static readonly Dictionary<TrechoStatus, Color> HaloColors = new()
    {
        [TrechoStatus.Neutro]          = Color.FromArgb(0x00, 0x00, 0x00, 0x00),
        [TrechoStatus.RecordeStint]    = Color.FromArgb(0x6B, 0xF0, 0xA0, 0x60),
        [TrechoStatus.MelhorHistorico] = Color.FromArgb(0x00, 0x00, 0x00, 0x00),
        [TrechoStatus.PiorStint]       = Color.FromArgb(0x6B, 0x92, 0x52, 0xC8),
    };

    /// <summary>
    /// Cores dos LEDs por tier (mapeamento simplificado das OKlch do mockup):
    /// tier 1-2 verde, tier 3-4 amarelo, tier 5-6 vermelho.
    /// Off é cinza escuro; fire é branco azulado; overrev é vermelho saturado.
    /// </summary>
    private static readonly Color LedOff       = Color.FromArgb(0xFF, 0x1A, 0x1A, 0x1A);
    private static readonly Color LedTier1Green = Color.FromArgb(0xFF, 0x4F, 0xE0, 0x60);
    private static readonly Color LedTier2Green = Color.FromArgb(0xFF, 0x4F, 0xE0, 0x60);
    private static readonly Color LedTier3Yellow = Color.FromArgb(0xFF, 0xF0, 0xC0, 0x40);
    private static readonly Color LedTier4Yellow = Color.FromArgb(0xFF, 0xF0, 0xC0, 0x40);
    private static readonly Color LedTier5Red    = Color.FromArgb(0xFF, 0xE0, 0x40, 0x40);
    private static readonly Color LedTier6Red    = Color.FromArgb(0xFF, 0xE0, 0x40, 0x40);
    private static readonly Color LedFireWhite   = Color.FromArgb(0xFF, 0xFF, 0xFF, 0xFF);
    private static readonly Color LedOverrevRed  = Color.FromArgb(0xFF, 0xC0, 0x10, 0x10);

    /// <summary>Tier de cada uma das 12 posições (espelhado: 1,2,3,4,5,6,6,5,4,3,2,1).</summary>
    private static readonly int[] LedTierByPosition = { 1, 2, 3, 4, 5, 6, 6, 5, 4, 3, 2, 1 };

    private Ellipse[] _leds = Array.Empty<Ellipse>();

    public MainWindow() : this(new LaunchOptions(DisplayIndex: null)) { }

    public MainWindow(LaunchOptions options)
    {
        _options = options;
        InitializeComponent();
        ApplyDisplayPlacement();

        _leds = new[] { Led01, Led02, Led03, Led04, Led05, Led06, Led07, Led08, Led09, Led10, Led11, Led12 };

        _cockpitState.OnChange((cur, _, keys) =>
        {
            DispatcherQueue.TryEnqueue(() =>
            {
                if (keys.Contains("trechoStatus")) ApplyHalo(cur.TrechoStatus);
                if (keys.Contains("shift")) ApplyShift(cur.Shift);
                UpdateStatusText();
            });
        });

        ApplyHalo(_cockpitState.Get().TrechoStatus);
        ApplyShift(_cockpitState.Get().Shift);
        UpdateStatusText();

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
    }

    /// <summary>
    /// Sequência de cenas do demo loop. Cada cena é uma mutação no
    /// CockpitState que dispara visualmente: halo + shift level/mode.
    /// </summary>
    private record DemoScene(TrechoStatus Halo, ShiftMode Mode, int Level);

    private static readonly IReadOnlyList<DemoScene> DemoScenes = new List<DemoScene>
    {
        new(TrechoStatus.Neutro,          ShiftMode.Off,     0),
        new(TrechoStatus.Neutro,          ShiftMode.Lit,     1),
        new(TrechoStatus.Neutro,          ShiftMode.Lit,     2),
        new(TrechoStatus.Neutro,          ShiftMode.Lit,     3),
        new(TrechoStatus.RecordeStint,    ShiftMode.Lit,     4),
        new(TrechoStatus.RecordeStint,    ShiftMode.Lit,     5),
        new(TrechoStatus.RecordeStint,    ShiftMode.Lit,     6),
        new(TrechoStatus.RecordeStint,    ShiftMode.Fire,    0),
        new(TrechoStatus.PiorStint,       ShiftMode.Overrev, 0),
        new(TrechoStatus.MelhorHistorico, ShiftMode.Off,     0),
    };

    private void ApplyScene(int index)
    {
        var scene = DemoScenes[index];
        _cockpitState.SetTrechoStatus(scene.Halo);
        _cockpitState.ApplyShift(scene.Mode, scene.Level);
    }

    private void ApplyHalo(TrechoStatus status)
    {
        if (HaloColors.TryGetValue(status, out var color))
        {
            HaloBrush.Color = color;
        }
    }

    /// <summary>
    /// Aplica o estado do shift nos 12 LEDs.
    /// Off: todos LedOff.
    /// Lit N: apaga tudo, depois acende os N LEDs centrais (de fora pra dentro)
    ///   com a cor do tier de cada posição (LedTierByPosition).
    /// Fire: todos brancos.
    /// Overrev: todos vermelhos saturados.
    /// </summary>
    private void ApplyShift(ShiftState shift)
    {
        if (_leds.Length != 12) return;

        if (shift.Mode == ShiftMode.Fire)
        {
            foreach (var led in _leds) ((SolidColorBrush)led.Fill).Color = LedFireWhite;
            return;
        }
        if (shift.Mode == ShiftMode.Overrev)
        {
            foreach (var led in _leds) ((SolidColorBrush)led.Fill).Color = LedOverrevRed;
            return;
        }

        // Off ou Lit: começa apagando tudo
        for (var i = 0; i < _leds.Length; i++)
        {
            ((SolidColorBrush)_leds[i].Fill).Color = LedOff;
        }

        if (shift.Mode != ShiftMode.Lit || shift.Level <= 0) return;

        // Acende os LEDs do meio pra fora.
        // Convenção: level 1 acende 2 (par central, posições 5+6), level 6 acende todos 12.
        // Distribuição: dotsForLevel = ShiftDotsForLevel(level)
        var dots = CockpitState.ShiftDotsForLevel(shift.Level);
        // Acende dots/2 pra cada lado a partir do centro.
        var halfDots = dots / 2;
        var center = _leds.Length / 2; // 6 → posição 6 (índice 6) = primeiro do par central
        for (var d = 0; d < halfDots; d++)
        {
            var leftIdx  = center - 1 - d;
            var rightIdx = center + d;
            if (leftIdx >= 0)
                ((SolidColorBrush)_leds[leftIdx].Fill).Color = ColorForTier(LedTierByPosition[leftIdx]);
            if (rightIdx < _leds.Length)
                ((SolidColorBrush)_leds[rightIdx].Fill).Color = ColorForTier(LedTierByPosition[rightIdx]);
        }
    }

    private static Color ColorForTier(int tier) => tier switch
    {
        1 => LedTier1Green,
        2 => LedTier2Green,
        3 => LedTier3Yellow,
        4 => LedTier4Yellow,
        5 => LedTier5Red,
        6 => LedTier6Red,
        _ => LedOff,
    };

    private void UpdateStatusText()
    {
        var s = _cockpitState.Get();
        var displayInfo = _options.DisplayIndex is { } idx
            ? $"display {idx} fullscreen"
            : "janelado (primário)";
        StatusText.Text = $"{displayInfo}  •  trecho={s.TrechoStatus}  •  shift={s.Shift.Mode} L{s.Shift.Level}";
    }

    private void ApplyDisplayPlacement()
    {
        var hwnd = WindowNative.GetWindowHandle(this);
        var windowId = Win32Interop.GetWindowIdFromWindow(hwnd);
        var appWindow = AppWindow.GetFromWindowId(windowId);

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

        var size = new SizeInt32 { Width = 1280, Height = 800 };
        appWindow.Resize(size);
    }
}
