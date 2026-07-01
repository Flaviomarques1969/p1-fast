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
/// <param name="Demo">--demo liga a demonstração de cenas fixas (dados sintéticos).</param>
/// <param name="Replay">--replay liga o maestro REAL alimentado por uma sessão de
/// pista gravada (motor + GPS). É a Etapa 1 do "ligar o dado real": prova a tela
/// inteira pela pipeline real, sem hardware. Sem --demo nem --replay, a tela espera
/// o dado vivo (USB/GPS) que ainda não está plugado.</param>
/// <param name="ReplayPath">Caminho da sessão .json pra --replay (opcional; sem ele,
/// usa a sessão de Brasília 21/06 em .claude-exec/dados-pista/).</param>
/// <param name="Speed">Multiplicador de velocidade do replay (1 = tempo real).</param>
public sealed record LaunchOptions(
    int? DisplayIndex,
    bool Demo = false,
    bool Replay = false,
    string? ReplayPath = null,
    double Speed = 1.0,
    bool Loop = false,
    bool Windowed = false,
    bool Live = false,
    string? Port = null,
    bool Producao = false,
    string Evento = "",
    string Time = "")
{
    /// <summary>Faz parsing dos args do <see cref="Environment.GetCommandLineArgs"/>.</summary>
    public static LaunchOptions FromCommandLine(string[] args)
    {
        int? displayIndex = null;
        var demo = false;
        var replay = false;
        string? replayPath = null;
        var speed = 1.0;
        var loop = false;
        var windowed = false;
        var live = false;
        string? port = null;
        var producao = false;
        var evento = "";
        var tempo = "";
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
            else if (a == "--replay")
            {
                replay = true;
            }
            else if (a.StartsWith("--replay=", StringComparison.Ordinal))
            {
                replay = true;
                replayPath = a["--replay=".Length..];
            }
            else if (a.StartsWith("--speed=", StringComparison.Ordinal))
            {
                if (double.TryParse(a["--speed=".Length..], System.Globalization.CultureInfo.InvariantCulture, out var sp) && sp > 0)
                    speed = sp;
            }
            else if (a == "--loop")
            {
                loop = true;
            }
            else if (a == "--windowed")
            {
                windowed = true;
            }
            else if (a == "--live")
            {
                live = true;
            }
            else if (a == "--producao")
            {
                // Modo PRODUÇÃO: publica no canal que o app/Command Box assistem
                // (cockpit-bubi-live). Só liga quando lançado de propósito; sem ele,
                // a nuvem fica no canal de TESTE (seguro). Ordem expressa do Flávio.
                producao = true;
            }
            else if (a.StartsWith("--port=", StringComparison.Ordinal))
            {
                port = a["--port=".Length..];
            }
            else if (a == "--port" && i + 1 < args.Length)
            {
                port = args[i + 1];
            }
            // Config de dia de corrida pro ponteiro de vídeo (o Flávio passa no dia).
            // eventId/timeId são UUIDs; em dev podem ficar vazios (o ponteiro sai sem eles).
            else if (a.StartsWith("--evento=", StringComparison.Ordinal))
            {
                evento = a["--evento=".Length..];
            }
            else if (a.StartsWith("--time=", StringComparison.Ordinal))
            {
                tempo = a["--time=".Length..];
            }
        }
        return new LaunchOptions(displayIndex, demo, replay, replayPath, speed, loop, windowed, live, port, producao, evento, tempo);
    }
}
