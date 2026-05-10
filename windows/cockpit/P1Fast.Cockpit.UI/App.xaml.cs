using Microsoft.UI.Xaml;

namespace P1Fast.Cockpit.UI;

/// <summary>
/// Aplicação WinUI 3 do cockpit do piloto. Roda no notebook 10,5" no painel
/// (kiosk fullscreen — ADR-023). Por enquanto carrega janela vazia; o port
/// do mockup canônico vem em iterações seguintes consumindo
/// <see cref="P1Fast.Cockpit.Domain.CockpitState"/>.
/// </summary>
public partial class App : Application
{
    private Window? _window;

    public App()
    {
        InitializeComponent();
    }

    protected override void OnLaunched(LaunchActivatedEventArgs args)
    {
        _window = new MainWindow();
        _window.Activate();
    }
}
