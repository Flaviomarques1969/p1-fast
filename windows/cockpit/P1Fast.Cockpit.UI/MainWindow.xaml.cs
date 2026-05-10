using Microsoft.UI;
using Microsoft.UI.Windowing;
using Microsoft.UI.Xaml;
using P1Fast.Cockpit.Domain;
using Windows.Graphics;
using WinRT.Interop;

namespace P1Fast.Cockpit.UI;

/// <summary>
/// Janela principal do cockpit. Quando recebe <c>--display-index N</c>,
/// move pra esse monitor (1-indexado) e entra em fullscreen — alvo é a
/// tela 10,5" externa invertida no painel (ADR-023 amendment 5). Sem
/// essa flag, abre janelado no primário pra desenvolvimento.
///
/// O port do mockup canônico (DOM, classes OKlch, keyframes, halo radial,
/// shift light, apex pontos, mensagem, delta, ação) entra em iterações
/// seguintes consumindo o <see cref="CockpitState"/>.
/// </summary>
public sealed partial class MainWindow : Window
{
    private readonly CockpitState _cockpitState = new();
    private readonly LaunchOptions _options;

    public MainWindow() : this(new LaunchOptions(DisplayIndex: null)) { }

    public MainWindow(LaunchOptions options)
    {
        _options = options;
        InitializeComponent();
        ApplyDisplayPlacement();
        UpdateStatusText();

        _cockpitState.OnChange((_, _, _) =>
        {
            // Próxima iteração: aplicar mudanças nos elementos XAML aqui.
            UpdateStatusText();
        });
    }

    private void UpdateStatusText()
    {
        var s = _cockpitState.Get();
        var displayInfo = _options.DisplayIndex is { } idx
            ? $"display {idx} fullscreen"
            : "janelado (primário)";
        StatusText.Text = $"{displayInfo} • shift {s.Shift.Mode}";
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
                // OuterBounds já é RectInt32 — passa direto.
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
