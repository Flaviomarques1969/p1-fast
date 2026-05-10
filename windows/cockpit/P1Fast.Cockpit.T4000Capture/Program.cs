// P1 Fast — T4000 capture tool
//
// Console pequeno que captura tudo o que chega da Injepro T4000 quando ela
// está plugada no notebook via USB. Saída: um arquivo binário cru
// (.bin) + um índice CSV de tempo (.timing.csv) que registra "no segundo X
// já tinha lido Y bytes" pra reconstruir o tempo depois.
//
// Uso esperado pelo Flávio:
// 1. Liga o carro + a central T4000.
// 2. Pluga cabo USB da T4000 no notebook.
// 3. Roda este .exe. Ele detecta a porta serial sozinho.
// 4. Quando achar que capturou o suficiente (5-10 min com o motor em
//    diferentes regimes), aperta Q ou Esc.
// 5. Manda os arquivos `.bin` + `.timing.csv` + o `.log` da sessão pro
//    Claude. O log fica em
//    %LOCALAPPDATA%\P1Fast.Cockpit.T4000Capture\logs\session-...log
//    e o app imprime o caminho completo no fim.
//
// Não interpreta nada — só grava o stream cru. A análise (parse, detecção
// de pacotes, validação de checksum) acontece offline depois.

using System.Diagnostics;
using System.Globalization;
using System.IO.Ports;
using P1Fast.Cockpit.Domain;

namespace P1Fast.Cockpit.T4000Capture;

internal static class Program
{
    private const int ReadBufferBytes = 4096;
    private const int ReadTimeoutMs   = 200;

    private static int Main(string[] args)
    {
        var portName  = ParseArg(args, "--port");
        var outPath   = ParseArg(args, "--out");
        var help      = args.Any(a => a is "--help" or "-h" or "/?");
        var openLogs  = args.Any(a => a is "--open-logs");

        if (help)
        {
            PrintHelp();
            return 0;
        }

        if (openLogs)
        {
            return OpenLogsFolder();
        }

        using var log = new SessionLogger();
        log.WriteHeader(args);

        if (portName is null)
        {
            var ports = SerialPort.GetPortNames().OrderBy(x => x, StringComparer.Ordinal).ToArray();
            log.Info($"Portas serial detectadas: [{string.Join(", ", ports)}] ({ports.Length})");
            if (ports.Length == 0)
            {
                log.TeeConsoleError("Nenhuma porta serial encontrada.");
                log.TeeConsoleError("Verifique se o cabo USB da T4000 está plugado e a central está ligada.");
                log.TeeConsoleError("");
                log.TeeConsoleError("No Windows, geralmente aparece como COM3, COM4, etc. Use --port=COMx pra forçar.");
                PrintLogPathFooter(log);
                return 1;
            }
            log.TeeConsole($"Portas disponíveis: {string.Join(", ", ports)}");
            // Usa a porta de número mais alto — costuma ser a USB recém-plugada.
            portName = ports[^1];
            log.TeeConsole($"Selecionado automaticamente: {portName}  (use --port=COMx pra escolher outra)");
        }
        else
        {
            log.Info($"Porta forçada via --port: {portName}");
        }

        outPath ??= $"t4000-capture-{DateTime.Now:yyyyMMdd-HHmmss}.bin";
        var timingPath = System.IO.Path.ChangeExtension(outPath, ".timing.csv");
        log.Info($"Output binário: {outPath}");
        log.Info($"Output timing:  {timingPath}");

        SerialPort sp;
        try
        {
            sp = new SerialPort(portName)
            {
                BaudRate     = 1_000_000, // T4000 CAN bus 1 Mbit/s; USB CDC-ACM ignora baud rate
                DataBits     = 8,
                Parity       = Parity.None,
                StopBits     = StopBits.One,
                ReadTimeout  = ReadTimeoutMs,
                WriteTimeout = 1000,
            };
            log.Info($"SerialPort configurado: BaudRate=1000000, 8N1, ReadTimeout={ReadTimeoutMs}ms");
            sp.Open();
            log.Info($"SerialPort.Open() OK em {portName}");
        }
        catch (Exception ex)
        {
            log.TeeConsoleError($"Falha ao abrir {portName}: {ex.Message}");
            log.Error($"Tipo da exceção: {ex.GetType().FullName}");
            log.Error($"Stack: {ex.StackTrace}");
            log.TeeConsoleError("");
            log.TeeConsoleError("Possíveis causas:");
            log.TeeConsoleError("  - Outro programa (Injepro T Software?) já está usando a porta.");
            log.TeeConsoleError("  - Driver USB CDC da T4000 não está instalado.");
            log.TeeConsoleError("  - Cabo USB ruim ou central T4000 desligada.");
            PrintLogPathFooter(log);
            return 2;
        }

        log.TeeConsole("");
        log.TeeConsole($"Capturando de {portName} pra {outPath}");
        log.TeeConsole($"Índice de tempo:        {timingPath}");
        log.TeeConsole("Aperte Q ou Esc pra parar (ou Ctrl+C).");
        log.TeeConsole("");

        var (exitCode, totals) = RunCaptureLoop(sp, outPath, timingPath, log);
        log.Footer(totals.TotalBytes, totals.P4Sentinels, totals.P5Sentinels, totals.ExitReason);
        PrintLogPathFooter(log);
        return exitCode;
    }

    private record CaptureTotals(int TotalBytes, int P4Sentinels, int P5Sentinels, string ExitReason);

    private static (int exit, CaptureTotals totals) RunCaptureLoop(
        SerialPort sp, string outPath, string timingPath, SessionLogger log)
    {
        using var binStream    = File.Create(outPath);
        using var timingStream = new StreamWriter(timingPath);
        timingStream.WriteLine("timestamp_unix_ms,total_bytes,bytes_per_sec,p4_sentinels,p5_sentinels");

        var stopRequested = false;
        var stopReason    = "Q/Esc";
        Console.CancelKeyPress += (_, e) =>
        {
            e.Cancel = true;
            stopRequested = true;
            stopReason = "Ctrl+C";
        };

        var buffer        = new byte[ReadBufferBytes];
        var totalBytes    = 0L;
        var p4Sentinels   = 0; // ocorrências de 0x1E 0xFC consecutivos (cauda do pacote 4)
        var p5Sentinels   = 0; // ocorrências de 0xFB 0xFA consecutivos (cabeça do pacote 5)
        var bytesAtLastReport = 0L;
        var stopwatch     = Stopwatch.StartNew();
        var lastReportMs  = 0L;
        var readErrorCount = 0;
        byte? prevByte    = null;

        while (!stopRequested)
        {
            int n;
            try { n = sp.Read(buffer, 0, buffer.Length); }
            catch (TimeoutException) { n = 0; }
            catch (Exception ex)
            {
                readErrorCount++;
                log.Error($"Erro de leitura serial: {ex.GetType().Name} — {ex.Message}");
                Console.Error.WriteLine($"Erro de leitura: {ex.Message}");
                stopReason = $"erro de leitura: {ex.Message}";
                break;
            }

            if (n > 0)
            {
                binStream.Write(buffer, 0, n);
                totalBytes += n;

                // Conta sentinelas FIXED só pra mostrar sinal de vida no console.
                for (var i = 0; i < n; i++)
                {
                    var b = buffer[i];
                    if (prevByte is { } prev)
                    {
                        if (prev == T4000PacketParser.P4FixedTail[0] && b == T4000PacketParser.P4FixedTail[1])
                            p4Sentinels++;
                        if (prev == T4000PacketParser.P5FixedHead[0] && b == T4000PacketParser.P5FixedHead[1])
                            p5Sentinels++;
                    }
                    prevByte = b;
                }
            }

            var nowMs = stopwatch.ElapsedMilliseconds;
            if (nowMs - lastReportMs >= 1000)
            {
                var bytesThisSec = totalBytes - bytesAtLastReport;
                var unixMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                timingStream.WriteLine(string.Create(
                    CultureInfo.InvariantCulture,
                    $"{unixMs},{totalBytes},{bytesThisSec},{p4Sentinels},{p5Sentinels}"));
                timingStream.Flush();

                log.TeeConsole(
                    $"[{DateTime.Now:HH:mm:ss}]  total: {totalBytes,12:N0} bytes   " +
                    $"velocidade: {bytesThisSec,7:N0} B/s   " +
                    $"sentinelas P4/P5: {p4Sentinels}/{p5Sentinels}");

                lastReportMs      = nowMs;
                bytesAtLastReport = totalBytes;
            }

            if (Console.KeyAvailable)
            {
                var key = Console.ReadKey(intercept: true).Key;
                if (key is ConsoleKey.Q or ConsoleKey.Escape)
                {
                    stopRequested = true;
                    stopReason = $"tecla {key}";
                }
            }
        }

        try { sp.Close(); } catch (Exception ex) { log.Warn($"Erro ao fechar SerialPort: {ex.Message}"); }
        binStream.Flush();
        timingStream.Flush();

        log.TeeConsole("");
        log.TeeConsole($"Capturado: {totalBytes:N0} bytes em {outPath}");
        log.TeeConsole($"Sentinelas vistas — P4 (cauda 0x1E 0xFC): {p4Sentinels}, P5 (cabeça 0xFB 0xFA): {p5Sentinels}");

        if (readErrorCount > 0)
            log.Warn($"Total de erros de leitura serial durante a sessão: {readErrorCount}");

        var totals = new CaptureTotals(checked((int)totalBytes), p4Sentinels, p5Sentinels, stopReason);

        if (totalBytes == 0)
        {
            log.TeeConsole("");
            log.TeeConsole("AVISO: zero bytes recebidos. Possíveis causas:");
            log.TeeConsole("  - A USB da T4000 é só pro Injepro T Software e NÃO transmite CAN — vai precisar de adaptador USB-CAN.");
            log.TeeConsole("  - A central T4000 não está alimentada (carro precisa estar com chave em ON, não só em Acessórios).");
            log.TeeConsole("  - Driver da T4000 não negociou o stream — testa fechar e abrir o app, e/ou testa o cabo no Injepro T Software primeiro.");
            return (3, totals);
        }
        if (p4Sentinels == 0 && p5Sentinels == 0)
        {
            log.TeeConsole("");
            log.TeeConsole("AVISO: bytes recebidos, mas zero sentinelas FIXED do T4000.");
            log.TeeConsole("Pode ser um stream diferente do CAN documentado no PDF (ou a USB usa outro protocolo).");
            log.TeeConsole("Mande o .bin pro Claude analisar mesmo assim.");
        }
        return (0, totals);
    }

    private static void PrintLogPathFooter(SessionLogger log)
    {
        Console.WriteLine();
        Console.WriteLine($"📋 Log da sessão: {log.LogPath}");
        Console.WriteLine($"   Pasta de logs:  {log.LogsFolder}  (use --open-logs pra abrir)");
        Console.WriteLine($"   Pra mandar pro Claude: cole o conteúdo do .log no chat (se pequeno),");
        Console.WriteLine($"   ou suba em https://gist.github.com / paste service e me passe a URL.");
    }

    private static int OpenLogsFolder()
    {
        var folder = System.IO.Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "P1Fast.Cockpit.T4000Capture",
            "logs");

        try
        {
            Directory.CreateDirectory(folder);
            Process.Start(new ProcessStartInfo
            {
                FileName = folder,
                UseShellExecute = true,
            });
            Console.WriteLine($"Aberto: {folder}");
            return 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"Não consegui abrir {folder}: {ex.Message}");
            Console.Error.WriteLine($"Abra manualmente no Explorer, copia o caminho aí.");
            return 1;
        }
    }

    private static string? ParseArg(string[] args, string name)
    {
        var prefix = name + "=";
        var match = args.FirstOrDefault(a => a.StartsWith(prefix, StringComparison.Ordinal));
        if (match is not null) return match[prefix.Length..];

        for (var i = 0; i < args.Length - 1; i++)
            if (args[i] == name) return args[i + 1];

        return null;
    }

    private static void PrintHelp()
    {
        Console.WriteLine("p1fast-t4000-capture — captura raw do barramento T4000 via USB serial.");
        Console.WriteLine();
        Console.WriteLine("Uso:");
        Console.WriteLine("  p1fast-t4000-capture [--port=COMx] [--out=arquivo.bin]");
        Console.WriteLine("  p1fast-t4000-capture --open-logs       (abre pasta de logs no Explorer)");
        Console.WriteLine();
        Console.WriteLine("Opções:");
        Console.WriteLine("  --port=COMx   força uma porta serial específica (default: detecta automaticamente)");
        Console.WriteLine("  --out=path    arquivo de saída (default: t4000-capture-<timestamp>.bin)");
        Console.WriteLine("  --open-logs   abre %LOCALAPPDATA%\\P1Fast.Cockpit.T4000Capture\\logs no Explorer");
        Console.WriteLine("  --help        mostra esta ajuda");
        Console.WriteLine();
        Console.WriteLine("Pra parar a captura: aperte Q, Esc, ou Ctrl+C.");
        Console.WriteLine();
        Console.WriteLine("Cada execução grava um log em");
        Console.WriteLine("  %LOCALAPPDATA%\\P1Fast.Cockpit.T4000Capture\\logs\\session-YYYYMMDD-HHMMSS.log");
        Console.WriteLine("Mande esse .log + os arquivos .bin/.timing.csv pra análise.");
    }
}
