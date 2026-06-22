using Microsoft.UI.Xaml;

namespace P1Fast.Cockpit.UI;

/// <summary>
/// Aplicação WinUI 3 do cockpit do piloto. Roda em notebook + tela 10,5"
/// externa invertida no painel — ADR-023 amendments 4 e 5.
///
/// Argumentos de linha de comando:
///   --display-index N   abre fullscreen no monitor N (1-indexado;
///                        Display Settings do Windows usa a mesma
///                        numeração). Sem essa flag, abre janelado no
///                        primário pra desenvolvimento.
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
        var options = LaunchOptions.FromCommandLine(Environment.GetCommandLineArgs());
        _window = new MainWindow(options);
        _window.Activate();
    }
}

/// <summary>Configuração resolvida dos argumentos de linha de comando.</summary>
/// <param name="DisplayIndex">Monitor pra abrir em tela cheia (1-indexado).</param>
/// <param name="Demo">--demo liga a demonstração de cenas fixas. Sem ela, a tela
/// é comandada pelo dado real (maestro) — o jeito de produção.</param>
public sealed record LaunchOptions(int? DisplayIndex, bool Demo = false)
{
    /// <summary>Faz parsing dos args do <see cref="Environment.GetCommandLineArgs"/>.</summary>
    public static LaunchOptions FromCommandLine(string[] args)
    {
        int? displayIndex = null;
        var demo = false;
        for (var i = 0; i < args.Length; i++)
        {
            var a = args[i];
            if (a.StartsWith("--display-index=", StringComparison.Ordinal))
            {
                if (int.TryParse(a["--display-index=".Length..], out var n) && n >= 1)
                    displayIndex = n;
            }
            else if (a == "--display-index" && i + 1 < args.Length)
            {
                if (int.TryParse(args[i + 1], out var n) && n >= 1)
                    displayIndex = n;
            }
            else if (a == "--demo")
            {
                demo = true;
            }
        }
        return new LaunchOptions(displayIndex, demo);
    }
}
