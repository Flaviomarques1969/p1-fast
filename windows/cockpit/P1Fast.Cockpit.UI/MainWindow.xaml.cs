using Microsoft.UI;
using Microsoft.UI.Windowing;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Media;
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
/// Esta iteração (PR-B) traz o **halo radial** (4 estados do mockup
/// canônico: neutro, recorde-stint, melhor-historico, pior-stint) +
/// um demo loop sintético que cicla pelos 4 estados a cada 5 s. Próximas
/// iterações trazem shift light, apex pontos, info bloco, alerta, etc.
/// </summary>
public sealed partial class MainWindow : Window
{
    private readonly CockpitState _cockpitState = new();
    private readonly LaunchOptions _options;
    private readonly Microsoft.UI.Dispatching.DispatcherQueueTimer _demoTimer;

    /// <summary>
    /// Cores do halo radial — conversão aproximada das tokens OKlch do
    /// mockup canônico (linhas 24-25, 77-78). Refinar quando o Flávio
    /// vir o resultado na tela 10,5" real e comparar com o navegador.
    ///
    /// CSS: oklch(78% 0.18 65 / .42) = laranja quente translúcido
    /// CSS: oklch(56% 0.22 305 / .42) = roxo translúcido
    /// </summary>
    private static readonly Dictionary<TrechoStatus, Color> HaloColors = new()
    {
        [TrechoStatus.Neutro]          = Color.FromArgb(0x00, 0x00, 0x00, 0x00),
        [TrechoStatus.RecordeStint]    = Color.FromArgb(0x6B, 0xF0, 0xA0, 0x60),
        // Mockup canônico não define halo pra MelhorHistorico — fica
        // transparente até spec virar. (TODO: pedir cor pro Flávio.)
        [TrechoStatus.MelhorHistorico] = Color.FromArgb(0x00, 0x00, 0x00, 0x00),
        [TrechoStatus.PiorStint]       = Color.FromArgb(0x6B, 0x92, 0x52, 0xC8),
    };

    /// <summary>Demo loop: cicla pelos 4 estados a cada 5 segundos.</summary>
    private static readonly TrechoStatus[] DemoCycle = new[]
    {
        TrechoStatus.Neutro,
        TrechoStatus.RecordeStint,
        TrechoStatus.MelhorHistorico,
        TrechoStatus.PiorStint,
    };

    public MainWindow() : this(new LaunchOptions(DisplayIndex: null)) { }

    public MainWindow(LaunchOptions options)
    {
        _options = options;
        InitializeComponent();
        ApplyDisplayPlacement();

        _cockpitState.OnChange((cur, _, keys) =>
        {
            if (keys.Contains("trechoStatus"))
            {
                DispatcherQueue.TryEnqueue(() => ApplyHalo(cur.TrechoStatus));
            }
            DispatcherQueue.TryEnqueue(UpdateStatusText);
        });

        ApplyHalo(_cockpitState.Get().TrechoStatus);
        UpdateStatusText();

        _demoTimer = DispatcherQueue.CreateTimer();
        _demoTimer.Interval = TimeSpan.FromSeconds(5);
        var demoIndex = 0;
        _demoTimer.Tick += (_, _) =>
        {
            _cockpitState.SetTrechoStatus(DemoCycle[demoIndex % DemoCycle.Length]);
            demoIndex++;
        };
        _demoTimer.Start();
    }

    private void ApplyHalo(TrechoStatus status)
    {
        if (HaloColors.TryGetValue(status, out var color))
        {
            HaloColorStop.Color = color;
        }
    }

    private void UpdateStatusText()
    {
        var s = _cockpitState.Get();
        var displayInfo = _options.DisplayIndex is { } idx
            ? $"display {idx} fullscreen"
            : "janelado (primário)";
        StatusText.Text = $"{displayInfo}  •  trechoStatus = {s.TrechoStatus}";
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
            // Se o índice pedido não existe, cai pro fallback janelado abaixo.
        }

        // Default: janelado, tamanho confortável pra dev no primário.
        var size = new SizeInt32 { Width = 1280, Height = 800 };
        appWindow.Resize(size);
    }
}
