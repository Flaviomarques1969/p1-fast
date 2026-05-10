// P1 Fast — T4000 capture session logger
//
// Grava em arquivo TUDO que vai pro console + extras (info de sistema,
// porta, parâmetros, exceções). Objetivo: quando o Flávio rodar a tool
// no notebook e algo der errado, ele tem um arquivo de texto compacto
// (~5-15 KB pra sessão de 5-10 min) pra mandar pro Claude analisar.
//
// Local: %LOCALAPPDATA%\P1Fast.Cockpit.T4000Capture\logs\session-YYYYMMDD-HHMMSS.log
//
// Não substitui o .bin / .timing.csv (esses são os DADOS) — é o LOG da
// execução. Erro silencioso na escrita do log NÃO derruba a captura
// (tudo dentro de try/catch best-effort).

using System.Globalization;
using System.Reflection;

namespace P1Fast.Cockpit.T4000Capture;

internal sealed class SessionLogger : IDisposable
{
    public string LogPath { get; }
    public string LogsFolder { get; }

    private readonly StreamWriter? _writer;
    private readonly object _lock = new();
    private bool _disposed;

    public SessionLogger()
    {
        LogsFolder = System.IO.Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "P1Fast.Cockpit.T4000Capture",
            "logs");
        var fileName = $"session-{DateTime.Now:yyyyMMdd-HHmmss}.log";
        LogPath = System.IO.Path.Combine(LogsFolder, fileName);

        try
        {
            Directory.CreateDirectory(LogsFolder);
            _writer = new StreamWriter(LogPath, append: false) { AutoFlush = true };
        }
        catch (Exception ex)
        {
            // Sem log em arquivo — só console. Imprime aviso e segue.
            Console.Error.WriteLine($"[aviso] Não consegui criar log em {LogPath}: {ex.Message}");
            _writer = null;
        }
    }

    public void WriteHeader(string[] args)
    {
        var version = Assembly.GetExecutingAssembly().GetName().Version?.ToString() ?? "?";
        var osDescription = System.Runtime.InteropServices.RuntimeInformation.OSDescription;
        var runtimeId     = System.Runtime.InteropServices.RuntimeInformation.RuntimeIdentifier;
        var dotnet        = Environment.Version.ToString();

        WriteLine("=== p1fast-t4000-capture — diagnostic log ===");
        WriteLine($"Iniciado em:      {DateTime.Now:yyyy-MM-dd HH:mm:ss zzz}");
        WriteLine($"Versão tool:      {version}");
        WriteLine($"OS:               {osDescription}");
        WriteLine($"Runtime:          {runtimeId}  (.NET {dotnet})");
        WriteLine($"Args:             {(args.Length == 0 ? "(nenhum)" : string.Join(" ", args))}");
        WriteLine($"Working dir:      {Directory.GetCurrentDirectory()}");
        WriteLine(new string('-', 60));
    }

    public void Info(string message)  => WriteLineWithTimestamp("INFO", message);
    public void Warn(string message)  => WriteLineWithTimestamp("WARN", message);
    public void Error(string message) => WriteLineWithTimestamp("ERR ", message);

    /// <summary>
    /// Escreve no console E no log com mesmo conteúdo. Mantém saída
    /// pro Flávio na tela e pra mim no arquivo.
    /// </summary>
    public void TeeConsole(string message)
    {
        Console.WriteLine(message);
        WriteLine(message);
    }

    public void TeeConsoleError(string message)
    {
        Console.Error.WriteLine(message);
        WriteLineWithTimestamp("ERR ", message);
    }

    public void Footer(int totalBytes, int p4Sentinels, int p5Sentinels, string exitReason)
    {
        WriteLine(new string('-', 60));
        WriteLine($"Encerrado em:     {DateTime.Now:yyyy-MM-dd HH:mm:ss zzz}");
        WriteLine($"Motivo:           {exitReason}");
        WriteLine($"Total bytes:      {totalBytes:N0}");
        WriteLine($"Sentinelas P4:    {p4Sentinels}  (cauda 0x1E 0xFC)");
        WriteLine($"Sentinelas P5:    {p5Sentinels}  (cabeça 0xFB 0xFA)");
        WriteLine("=== fim ===");
    }

    private void WriteLineWithTimestamp(string tag, string message)
    {
        var ts = DateTime.Now.ToString("HH:mm:ss.fff", CultureInfo.InvariantCulture);
        WriteLine($"[{ts}] {tag}  {message}");
    }

    private void WriteLine(string line)
    {
        if (_writer is null) return;
        try
        {
            lock (_lock)
            {
                _writer.WriteLine(line);
            }
        }
        catch
        {
            // Best-effort. Não quebra a captura por causa do log.
        }
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        try
        {
            lock (_lock)
            {
                _writer?.Flush();
                _writer?.Dispose();
            }
        }
        catch { /* swallow */ }
    }
}
