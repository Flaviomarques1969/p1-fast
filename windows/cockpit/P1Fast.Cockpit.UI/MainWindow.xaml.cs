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
/// Janela principal do cockpit. PR-D adiciona apex header (4 pontos) +
/// info bloco (delta + ação) sobre o que já existia (halo + shift light).
/// </summary>
public sealed partial class MainWindow : Window
{
    private readonly CockpitState _cockpitState = new();
    private readonly LaunchOptions _options;
    private readonly Microsoft.UI.Dispatching.DispatcherQueueTimer _demoTimer;

    // ── Cores ──────────────────────────────────────────────

    private static readonly Color White       = Color.FromArgb(0xFF, 0xFF, 0xFF, 0xFF);
    private static readonly Color Muted       = Color.FromArgb(0xFF, 0xA0, 0xA0, 0xA0);
    private static readonly Color Faint       = Color.FromArgb(0xFF, 0x60, 0x60, 0x60);
    private static readonly Color Bom         = Color.FromArgb(0xFF, 0x4F, 0xE0, 0x60);
    private static readonly Color Erro        = Color.FromArgb(0xFF, 0xE0, 0x40, 0x40);
    private static readonly Color Foco        = Color.FromArgb(0xFF, 0xF0, 0xC0, 0x40);

    private static readonly Dictionary<TrechoStatus, Color> HaloColors = new()
    {
        [TrechoStatus.Neutro]          = Color.FromArgb(0x00, 0x00, 0x00, 0x00),
        [TrechoStatus.RecordeStint]    = Color.FromArgb(0x6B, 0xF0, 0xA0, 0x60),
        [TrechoStatus.MelhorHistorico] = Color.FromArgb(0x00, 0x00, 0x00, 0x00),
        [TrechoStatus.PiorStint]       = Color.FromArgb(0x6B, 0x92, 0x52, 0xC8),
    };

    private static readonly Color LedOff         = Color.FromArgb(0xFF, 0x1A, 0x1A, 0x1A);
    private static readonly Color LedTier1Green  = Color.FromArgb(0xFF, 0x4F, 0xE0, 0x60);
    private static readonly Color LedTier3Yellow = Color.FromArgb(0xFF, 0xF0, 0xC0, 0x40);
    private static readonly Color LedTier5Red    = Color.FromArgb(0xFF, 0xE0, 0x40, 0x40);
    private static readonly Color LedFireWhite   = Color.FromArgb(0xFF, 0xFF, 0xFF, 0xFF);
    private static readonly Color LedOverrevRed  = Color.FromArgb(0xFF, 0xC0, 0x10, 0x10);

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
                if (keys.Contains("shift"))        ApplyShift(cur.Shift);
                if (keys.Contains("delta"))        ApplyDelta(cur.Delta);
                if (keys.Contains("acao"))         ApplyAcao(cur.Acao);
                if (keys.Contains("apex"))         ApplyApex(cur.Apex);
                UpdateStatusText();
            });
        });

        var initial = _cockpitState.Get();
        ApplyHalo(initial.TrechoStatus);
        ApplyShift(initial.Shift);
        ApplyDelta(initial.Delta);
        ApplyAcao(initial.Acao);
        ApplyApex(initial.Apex);
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
        double ApiceKmh
    );

    private static readonly IReadOnlyList<DemoScene> DemoScenes = new List<DemoScene>
    {
        // Cena 1: corrida limpa, sem comparações ainda
        new(TrechoStatus.Neutro,       ShiftMode.Off,  0,
            "0.00", Tone.Neutro, "—", Tone.Neutro,
            ApexEstado.OkPior, 0,    ApexEstado.OkPior, 0,  0,    ApexEstado.OkPior, 0),
        // Cena 2: subindo RPM, melhor que a anterior
        new(TrechoStatus.Neutro,       ShiftMode.Lit,  2,
            "-0.08", Tone.Bom, "MANTÉM LINHA", Tone.Neutro,
            ApexEstado.OkMelhor, 92, ApexEstado.OkMelhor, 18, 16, ApexEstado.OkMelhor, 73),
        // Cena 3: tier 4 (amarelo), recorde
        new(TrechoStatus.RecordeStint, ShiftMode.Lit,  4,
            "-0.27", Tone.Bom, "ÁPICE TARDE", Tone.Neutro,
            ApexEstado.OkMelhor, 95, ApexEstado.OkMelhor, 15, 16, ApexEstado.OkMelhor, 75),
        // Cena 4: peak vermelho, troca de marcha
        new(TrechoStatus.RecordeStint, ShiftMode.Lit,  6,
            "-0.27", Tone.Bom, "TROCAR AGORA", Tone.Neutro,
            ApexEstado.OkMelhor, 95, ApexEstado.OkMelhor, 15, 16, ApexEstado.OkMelhor, 75),
        // Cena 5: fire — flash
        new(TrechoStatus.RecordeStint, ShiftMode.Fire, 0,
            "-0.27", Tone.Bom, "TROCAR AGORA", Tone.Neutro,
            ApexEstado.OkMelhor, 95, ApexEstado.OkMelhor, 15, 16, ApexEstado.OkMelhor, 75),
        // Cena 6: errou — pior stint
        new(TrechoStatus.PiorStint,    ShiftMode.Lit,  3,
            "+0.42", Tone.Erro, "FREIE TARDE", Tone.Erro,
            ApexEstado.OkPior, 88,   ApexEstado.OkPior, 22, 16, ApexEstado.OkPior, 68),
        // Cena 7: overrev — alarme
        new(TrechoStatus.PiorStint,    ShiftMode.Overrev, 0,
            "+0.42", Tone.Erro, "OVERREV!", Tone.Erro,
            ApexEstado.OkPior, 88,   ApexEstado.OkPior, 22, 16, ApexEstado.OkPior, 68),
    };

    private void ApplyScene(int index)
    {
        var s = DemoScenes[index];
        _cockpitState.SetTrechoStatus(s.Halo);
        _cockpitState.ApplyShift(s.Mode, s.Level);
        _cockpitState.SetDelta(s.DeltaValue, s.DeltaTone);
        _cockpitState.SetAcao(s.AcaoTexto, s.AcaoTone);

        if (s.EntradaKmh > 0)
            _cockpitState.SetApexPonto("entrada", estado: s.EntradaEstado, valorKmh: s.EntradaKmh);
        if (s.FreioAtualM > 0)
            _cockpitState.SetApexPonto("freio", estado: s.FreioEstado, atualM: s.FreioAtualM, refM: s.FreioRefM);
        if (s.ApiceKmh > 0)
            _cockpitState.SetApexPonto("apice", estado: s.ApiceEstado, valorKmh: s.ApiceKmh);
    }

    // ── Apply* ─────────────────────────────────────────────

    private void ApplyHalo(TrechoStatus status)
    {
        if (HaloColors.TryGetValue(status, out var color)) HaloBrush.Color = color;
    }

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
        for (var i = 0; i < _leds.Length; i++)
            ((SolidColorBrush)_leds[i].Fill).Color = LedOff;

        if (shift.Mode != ShiftMode.Lit || shift.Level <= 0) return;

        var dots = CockpitState.ShiftDotsForLevel(shift.Level);
        var halfDots = dots / 2;
        var center = _leds.Length / 2;
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
        1 or 2 => LedTier1Green,
        3 or 4 => LedTier3Yellow,
        5 or 6 => LedTier5Red,
        _      => LedOff,
    };

    private void ApplyDelta(DeltaInfo delta)
    {
        DeltaText.Text = string.IsNullOrEmpty(delta.Value) ? "0.00" : delta.Value;
        DeltaText.Foreground = new SolidColorBrush(ColorForTone(delta.Tone, fallback: Muted));
    }

    private void ApplyAcao(AcaoInfo acao)
    {
        AcaoText.Text = acao.Texto ?? string.Empty;
        AcaoText.Foreground = new SolidColorBrush(ColorForTone(acao.Tone, fallback: Foco));
    }

    private static Color ColorForTone(Tone tone, Color fallback) => tone switch
    {
        Tone.Bom    => Bom,
        Tone.Erro   => Erro,
        _           => fallback,
    };

    private void ApplyApex(ApexState apex)
    {
        ApplyApexPonto(ApexEntradaValor, apex.Entrada, formatKmh: true);
        ApplyApexFreio(ApexFreioValor,   apex.Freio);
        ApplyApexPonto(ApexApiceValor,   apex.Apice,   formatKmh: true);
        ApplyApexPonto(ApexSaidaValor,   apex.Saida,   formatKmh: true);
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

    private void UpdateStatusText()
    {
        var s = _cockpitState.Get();
        var displayInfo = _options.DisplayIndex is { } idx
            ? $"display {idx} fullscreen"
            : "janelado (primário)";
        StatusText.Text = $"{displayInfo}  •  trecho={s.TrechoStatus}  •  shift={s.Shift.Mode} L{s.Shift.Level}  •  Δ={s.Delta.Value}";
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
