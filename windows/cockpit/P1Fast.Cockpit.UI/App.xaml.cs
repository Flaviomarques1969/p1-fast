using System.Threading;
using Microsoft.UI.Xaml;

namespace P1Fast.Cockpit.UI;

/// <summary>
/// Aplicação WinUI 3 do cockpit do piloto. Roda em notebook + tela 10,5"
/// externa invertida no painel — ADR-023 amendments 4 e 5.
///
/// Argumentos de linha de comando:
///   --display-index N   abre fullscreen no monitor N (1-indexado; Display
///                        Settings do Windows usa a mesma numeração).
///   --janela            abre janelado (1280×800) em vez de tela cheia — só
///                        pra desenvolvimento. Por padrão é kiosk fullscreen.
///   --video-url URL     URL da página de vídeo embutida (WebView2 escondido).
///                        Padrão: a página de teste-aparelhos em modo ?video-only.
///   --sem-video         não sobe o WebView2 de vídeo (desenvolvimento).
/// </summary>
public partial class App : Application
{
    private Window? _window;

    // Mantido vivo pela duração do app: garante instância única (dois apps
    // disputando a mesma central USB dão conflito).
    private static Mutex? _instanceMutex;

    public App()
    {
        InitializeComponent();
    }

    protected override void OnLaunched(LaunchActivatedEventArgs args)
    {
        _instanceMutex = new Mutex(initiallyOwned: true, "P1Fast.Cockpit.SingleInstance", out bool ehNova);
        if (!ehNova)
        {
            // Já tem um cockpit rodando — sai sem abrir outra janela nem tocar na USB.
            Exit();
            return;
        }

        var options = LaunchOptions.FromCommandLine(Environment.GetCommandLineArgs());
        _window = new MainWindow(options);
        _window.Activate();
    }
}

/// <summary>Configuração resolvida dos argumentos de linha de comando.</summary>
public sealed record LaunchOptions(
    int? DisplayIndex,
    bool Windowed = false,
    string VideoUrl = LaunchOptions.DefaultVideoUrl,
    bool SemVideo = false)
{
    /// <summary>Página de teste-aparelhos em modo só-vídeo (não toca no RaceBox).</summary>
    public const string DefaultVideoUrl = "https://p1tv.vercel.app/?video-only=1";

    /// <summary>Faz parsing dos args do <see cref="Environment.GetCommandLineArgs"/>.</summary>
    public static LaunchOptions FromCommandLine(string[] args)
    {
        int? displayIndex = null;
        bool windowed = false;
        string videoUrl = DefaultVideoUrl;
        bool semVideo = false;
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
            else if (a.StartsWith("--video-url=", StringComparison.Ordinal))
            {
                videoUrl = a["--video-url=".Length..];
            }
            else if (a == "--video-url" && i + 1 < args.Length)
            {
                videoUrl = args[i + 1];
            }
            else if (a is "--sem-video" or "--no-video")
            {
                semVideo = true;
            }
            else if (a is "--janela" or "--windowed")
            {
                windowed = true;
            }
        }
        return new LaunchOptions(displayIndex, windowed, videoUrl, semVideo);
    }
}
