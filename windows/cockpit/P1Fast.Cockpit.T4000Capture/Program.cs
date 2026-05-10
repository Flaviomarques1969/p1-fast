// P1 Fast — T4000 capture tool
//
// Console pequeno que captura tudo o que chega da Injepro T4000 quando ela
// está plugada no notebook via USB. Saída: um arquivo binário cru
// (.bin) + um índice CSV de tempo (.timing.csv) que registra "no segundo X
// já tinha lido Y bytes" pra reconstruir o tempo depois.
//
// Uso esperado pelo Flávio (2026-05-10):
// 1. Liga o carro + a central T4000.
// 2. Pluga cabo USB da T4000 no notebook.
// 3. Roda este .exe. Ele detecta a porta serial sozinho.
// 4. Quando achar que capturou o suficiente (5-10 min com o motor em
//    diferentes regimes), aperta Q ou Esc.
// 5. Manda os arquivos `.bin` + `.timing.csv` pra mim.
//
// Não interpreta nada — só grava o stream cru. A análise (parse, detecção
// de pacotes, validação de checksum) acontece offline depois.

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
        var portName = ParseArg(args, "--port");
        var outPath  = ParseArg(args, "--out");
        var help     = args.Any(a => a is "--help" or "-h" or "/?");

        if (help)
        {
            PrintHelp();
            return 0;
        }

        if (portName is null)
        {
            var ports = SerialPort.GetPortNames().OrderBy(x => x, StringComparer.Ordinal).ToArray();
            if (ports.Length == 0)
            {
                Console.Error.WriteLine("Nenhuma porta serial encontrada.");
                Console.Error.WriteLine("Verifique se o cabo USB da T4000 está plugado e a central está ligada.");
                Console.Error.WriteLine();
                Console.Error.WriteLine("No Windows, geralmente aparece como COM3, COM4, etc. Use --port=COMx pra forçar.");
                return 1;
            }
            Console.WriteLine($"Portas disponíveis: {string.Join(", ", ports)}");
            // Usa a porta de número mais alto — costuma ser a USB recém-plugada.
            portName = ports[^1];
            Console.WriteLine($"Selecionado automaticamente: {portName}  (use --port=COMx pra escolher outra)");
        }

        outPath ??= $"t4000-capture-{DateTime.Now:yyyyMMdd-HHmmss}.bin";
        var timingPath = Path.ChangeExtension(outPath, ".timing.csv");

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
            sp.Open();
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"Falha ao abrir {portName}: {ex.Message}");
            Console.Error.WriteLine();
            Console.Error.WriteLine("Possíveis causas:");
            Console.Error.WriteLine("  - Outro programa (Injepro T Software?) já está usando a porta.");
            Console.Error.WriteLine("  - Driver USB CDC da T4000 não está instalado.");
            Console.Error.WriteLine("  - Cabo USB ruim ou central T4000 desligada.");
            return 2;
        }

        Console.WriteLine();
        Console.WriteLine($"Capturando de {portName} pra {outPath}");
        Console.WriteLine($"Índice de tempo:        {timingPath}");
        Console.WriteLine("Aperte Q ou Esc pra parar (ou Ctrl+C).");
        Console.WriteLine();

        return RunCaptureLoop(sp, outPath, timingPath);
    }

    private static int RunCaptureLoop(SerialPort sp, string outPath, string timingPath)
    {
        using var binStream    = File.Create(outPath);
        using var timingStream = new StreamWriter(timingPath);
        timingStream.WriteLine("timestamp_unix_ms,total_bytes,bytes_per_sec,p4_sentinels,p5_sentinels");

        var stopRequested = false;
        Console.CancelKeyPress += (_, e) => { e.Cancel = true; stopRequested = true; };

        var buffer        = new byte[ReadBufferBytes];
        var totalBytes    = 0L;
        var p4Sentinels   = 0; // ocorrências de 0x1E 0xFC consecutivos (cauda do pacote 4)
        var p5Sentinels   = 0; // ocorrências de 0xFB 0xFA consecutivos (cabeça do pacote 5)
        var bytesAtLastReport = 0L;
        var stopwatch     = System.Diagnostics.Stopwatch.StartNew();
        var lastReportMs  = 0L;
        byte? prevByte    = null;

        while (!stopRequested)
        {
            int n;
            try { n = sp.Read(buffer, 0, buffer.Length); }
            catch (TimeoutException) { n = 0; }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"Erro de leitura: {ex.Message}");
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

                Console.WriteLine(
                    $"[{DateTime.Now:HH:mm:ss}]  total: {totalBytes,12:N0} bytes   " +
                    $"velocidade: {bytesThisSec,7:N0} B/s   " +
                    $"sentinelas P4/P5: {p4Sentinels}/{p5Sentinels}");

                lastReportMs      = nowMs;
                bytesAtLastReport = totalBytes;
            }

            if (Console.KeyAvailable)
            {
                var key = Console.ReadKey(intercept: true).Key;
                if (key is ConsoleKey.Q or ConsoleKey.Escape) stopRequested = true;
            }
        }

        try { sp.Close(); } catch { /* swallow on shutdown */ }
        binStream.Flush();
        timingStream.Flush();

        Console.WriteLine();
        Console.WriteLine($"Capturado: {totalBytes:N0} bytes em {outPath}");
        Console.WriteLine($"Sentinelas vistas — P4 (cauda 0x1E 0xFC): {p4Sentinels}, P5 (cabeça 0xFB 0xFA): {p5Sentinels}");

        if (totalBytes == 0)
        {
            Console.WriteLine();
            Console.WriteLine("AVISO: zero bytes recebidos. Possíveis causas:");
            Console.WriteLine("  - A USB da T4000 é só pro Injepro T Software e NÃO transmite CAN — vai precisar de adaptador USB-CAN.");
            Console.WriteLine("  - A central T4000 não está alimentada (carro precisa estar com chave em ON, não só em Acessórios).");
            Console.WriteLine("  - Driver da T4000 não negociou o stream — testa fechar e abrir o app, e/ou testa o cabo no Injepro T Software primeiro.");
            return 3;
        }
        if (p4Sentinels == 0 && p5Sentinels == 0)
        {
            Console.WriteLine();
            Console.WriteLine("AVISO: bytes recebidos, mas zero sentinelas FIXED do T4000.");
            Console.WriteLine("Pode ser um stream diferente do CAN documentado no PDF (ou a USB usa outro protocolo).");
            Console.WriteLine("Mande o .bin pro Claude analisar mesmo assim.");
        }
        return 0;
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
        Console.WriteLine();
        Console.WriteLine("Opções:");
        Console.WriteLine("  --port=COMx   força uma porta serial específica (default: detecta automaticamente)");
        Console.WriteLine("  --out=path    arquivo de saída (default: t4000-capture-<timestamp>.bin)");
        Console.WriteLine("  --help        mostra esta ajuda");
        Console.WriteLine();
        Console.WriteLine("Pra parar a captura: aperte Q, Esc, ou Ctrl+C.");
    }
}
