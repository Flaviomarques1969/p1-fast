// P1 Fast — T4000 capture tool
//
// Console que aguarda a Injepro T4000 ficar disponível na USB e captura
// tudo que chega do barramento. Saída por execução: .bin (bytes crus) +
// .timing.csv (índice de tempo) + .log (diagnóstico no LocalAppData).
//
// Fluxo (Flávio 2026-05-10, refeito pra notebook longe da pista):
// 1. Roda o .exe — abre console com banner e fica em "modo aguardar".
// 2. Pluga o cabo USB da T4000 e liga a central — app detecta a porta
//    nova em até 2 s e tenta abrir.
// 3. Quando abre OK, vai pra captura: imprime status a cada segundo
//    (total de bytes, B/s, sentinelas FIXED do CAN).
// 4. Se a conexão cai (cabo desplugado, central desligada), volta pro
//    "modo aguardar" sem fechar o console.
// 5. Q, Esc ou Ctrl+C encerra.
//
// Não interpreta nada — só grava o stream cru. Análise (parse, detecção
// de pacotes, validação de checksum) acontece offline depois.

using System.Diagnostics;
using System.Globalization;
using System.IO.Ports;
using P1Fast.Cockpit.Domain;

namespace P1Fast.Cockpit.T4000Capture;

internal static class Program
{
    private const int ReadBufferBytes      = 4096;
    private const int ReadTimeoutMs        = 200;
    private const int DiscoveryPollMs      = 500;   // quão rápido percebe porta nova
    private const int DiscoveryHeartbeatS  = 30;    // tick "ainda esperando" no log

    // Compartilhado entre Main e o handler do Ctrl+C — handler precisa de campo,
    // não dá pra ref bool dentro de lambda registrada uma vez.
    private static volatile bool s_stopRequested;
    private static string s_stopReason = "";

    private static int Main(string[] args)
    {
        var portName  = ParseArg(args, "--port");
        var outBase   = ParseArg(args, "--out");
        var help      = args.Any(a => a is "--help" or "-h" or "/?");
        var openLogs  = args.Any(a => a is "--open-logs");

        if (help)     { PrintHelp(); return 0; }
        if (openLogs) return OpenLogsFolder();

        Console.CancelKeyPress += (_, e) =>
        {
            e.Cancel = true;
            s_stopRequested = true;
            s_stopReason = "Ctrl+C";
        };

        using var log = new SessionLogger();
        log.WriteHeader(args);

        CleanupOldCopies(log);
        PrintBanner(log, portName);

        var captureCount = 0;
        while (!s_stopRequested)
        {
            // 1. Espera porta serial aparecer (ou usa a forçada se já existir).
            var sp = WaitForPort(portName, log);
            if (sp is null) break; // s_stopRequested foi setado

            // 2. Captura. Cada captura tem .bin + .timing.csv com timestamp próprio
            //    pra não sobrescrever quando reconecta no meio do dia.
            captureCount++;
            var outPath = outBase is not null && captureCount == 1
                ? outBase
                : $"t4000-capture-{DateTime.Now:yyyyMMdd-HHmmss}.bin";
            var timingPath = System.IO.Path.ChangeExtension(outPath, ".timing.csv");
            log.Info($"Captura #{captureCount} — saída: {outPath} + {timingPath}");

            log.TeeConsole("");
            log.TeeConsole($"Capturando pra {outPath}");
            log.TeeConsole($"Índice de tempo:    {timingPath}");
            log.TeeConsole("Aperte Q ou Esc pra parar (ou Ctrl+C). Se a T4000 desconectar,");
            log.TeeConsole("o app volta sozinho pro modo aguardar.");
            log.TeeConsole("");

            var totals = RunCaptureLoop(sp, outPath, timingPath, log);
            log.Footer(totals.TotalBytes, totals.P4Sentinels, totals.P5Sentinels, totals.ExitReason);

            if (s_stopRequested) break;

            // Saiu por erro de leitura/conexão — volta pra modo aguardar.
            log.TeeConsole("");
            log.TeeConsole($"⚠ Captura interrompida ({totals.ExitReason}). Voltando pra modo aguardar...");
            log.TeeConsole("");
        }

        log.TeeConsole("");
        log.TeeConsole($"Encerrado: {(string.IsNullOrEmpty(s_stopReason) ? "fim normal" : s_stopReason)}");
        PrintLogPathFooter(log);
        return 0;
    }

    // ── Cleanup de cópias antigas ───────────────────────────────────
    //
    // Quando o Flávio baixa o app de novo, o browser salva como
    // "p1fast-t4000-capture (1).exe", "(2).exe", etc — porque o nome
    // canônico já existe. Resultado: monte de cópias antigas na pasta
    // Downloads e dúvida de qual rodar.
    //
    // Ao iniciar, o app NOVO apaga as cópias com sufixo "(N)" na MESMA
    // pasta dele. Preserva o nome canônico. Nunca tenta se auto-deletar
    // (file lock impede). Best-effort: erro de I/O é só logado, não
    // derruba a captura.

    private static void CleanupOldCopies(SessionLogger log)
    {
        try
        {
            var current = Environment.ProcessPath;
            if (string.IsNullOrEmpty(current)) return;

            var folder = System.IO.Path.GetDirectoryName(current);
            if (string.IsNullOrEmpty(folder)) return;

            var currentFull = System.IO.Path.GetFullPath(current);
            var allCopies = Directory.GetFiles(folder, "p1fast-t4000-capture*.exe");

            var toDelete = new List<string>();
            foreach (var f in allCopies)
            {
                var fullPath = System.IO.Path.GetFullPath(f);
                if (string.Equals(fullPath, currentFull, StringComparison.OrdinalIgnoreCase))
                    continue; // não tenta apagar a si mesmo (file lock)

                // Apaga só cópias com sufixo "(N)" — preserva o canônico
                // pra ser o "candidato a versão limpa" pra próxima execução.
                var name = System.IO.Path.GetFileNameWithoutExtension(f);
                if (name.Contains('(') && name.Contains(')'))
                    toDelete.Add(f);
            }

            if (toDelete.Count == 0)
            {
                log.Info($"Cleanup: nenhuma cópia '(N)' do app na pasta {folder}");
                return;
            }

            log.TeeConsole($"Limpando {toDelete.Count} cópia(s) antiga(s) do app em {folder}:");
            foreach (var f in toDelete)
            {
                try
                {
                    File.Delete(f);
                    log.TeeConsole($"  ✓ Apagado: {System.IO.Path.GetFileName(f)}");
                }
                catch (Exception ex)
                {
                    log.TeeConsoleError($"  ✗ Não consegui apagar {System.IO.Path.GetFileName(f)}: {ex.Message}");
                    log.Error($"   ({ex.GetType().Name})");
                }
            }
            log.TeeConsole("");
        }
        catch (Exception ex)
        {
            log.Warn($"Cleanup de versões antigas falhou: {ex.GetType().Name} — {ex.Message}");
        }
    }

    // ── Banner inicial ──────────────────────────────────────────────

    private static void PrintBanner(SessionLogger log, string? forcedPort)
    {
        log.TeeConsole("════════════════════════════════════════════════════════════");
        log.TeeConsole("  p1fast-t4000-capture — modo aguardar T4000");
        log.TeeConsole("════════════════════════════════════════════════════════════");
        log.TeeConsole("");
        if (forcedPort is not null)
        {
            log.TeeConsole($"Porta forçada: {forcedPort} (vou abrir só essa quando aparecer)");
        }
        else
        {
            log.TeeConsole("Porta: auto-detect (uso a de número mais alto que aparecer)");
        }
        log.TeeConsole("");
        log.TeeConsole("Pra começar: pluga o cabo USB da T4000 e liga a central");
        log.TeeConsole("(carro com chave em ON, não só Acessórios).");
        log.TeeConsole("");
        log.TeeConsole("Pra sair: aperte Q, Esc ou Ctrl+C a qualquer momento.");
        log.TeeConsole("");
    }

    // ── Discovery loop (aguarda T4000) ──────────────────────────────

    /// <summary>
    /// Bloqueia até conseguir abrir uma porta serial. Retorna null se o
    /// usuário pediu pra sair antes de uma porta funcional aparecer.
    /// </summary>
    private static SerialPort? WaitForPort(string? forcedPort, SessionLogger log)
    {
        log.TeeConsole($"[{DateTime.Now:HH:mm:ss}] Aguardando T4000...");
        var lastSeen = new HashSet<string>();
        var lastHeartbeat = DateTime.UtcNow;

        while (!s_stopRequested)
        {
            var ports = SerialPort.GetPortNames()
                .OrderBy(x => x, StringComparer.Ordinal)
                .ToHashSet();

            var newOnes  = ports.Except(lastSeen).ToList();
            var goneOnes = lastSeen.Except(ports).ToList();

            foreach (var p in goneOnes)
                log.TeeConsole($"[{DateTime.Now:HH:mm:ss}] - porta desconectada: {p}");
            foreach (var p in newOnes)
                log.TeeConsole($"[{DateTime.Now:HH:mm:ss}] + porta detectada:    {p}");

            // Decide qual tentar
            string? candidate = null;
            if (forcedPort is not null)
            {
                if (ports.Contains(forcedPort)) candidate = forcedPort;
            }
            else if (ports.Count > 0)
            {
                // Porta de número mais alto = costuma ser a USB recém-plugada.
                candidate = ports.Last();
            }

            if (candidate is not null)
            {
                log.TeeConsole($"[{DateTime.Now:HH:mm:ss}] Tentando abrir {candidate}...");
                var sp = TryOpen(candidate, log);
                if (sp is not null)
                {
                    log.TeeConsole($"[{DateTime.Now:HH:mm:ss}] ✓ Conectado em {candidate}");
                    return sp;
                }
                // Não abriu — log já registrou o erro. Espera um pouco mais
                // pra evitar loop apertado de retry no mesmo problema.
                Thread.Sleep(2000);
            }

            // Heartbeat a cada DiscoveryHeartbeatS segundos pra não dar
            // sensação de "travado" se nada mudar.
            if ((DateTime.UtcNow - lastHeartbeat).TotalSeconds >= DiscoveryHeartbeatS)
            {
                var portsTxt = ports.Count == 0 ? "nenhuma" : string.Join(", ", ports);
                log.TeeConsole(
                    $"[{DateTime.Now:HH:mm:ss}] ainda aguardando... " +
                    $"(portas atuais: {portsTxt})");
                lastHeartbeat = DateTime.UtcNow;
            }

            lastSeen = ports;
            SleepResponsive(DiscoveryPollMs);
        }

        return null;
    }

    private static SerialPort? TryOpen(string portName, SessionLogger log)
    {
        try
        {
            var sp = new SerialPort(portName)
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
            return sp;
        }
        catch (Exception ex)
        {
            log.TeeConsoleError($"[{DateTime.Now:HH:mm:ss}] ✗ Falha ao abrir {portName}: {ex.Message}");
            log.Error($"Tipo da exceção: {ex.GetType().FullName}");
            log.Error($"Stack: {ex.StackTrace}");
            log.TeeConsoleError("   Possíveis causas: outro programa usando a porta (Injepro T Software?),");
            log.TeeConsoleError("   driver USB CDC ausente, cabo ruim, central T4000 desligada.");
            log.TeeConsoleError("   Vou continuar tentando — desconecte e reconecte se persistir.");
            return null;
        }
    }

    /// <summary>
    /// Sleep que escuta tecla Q/Esc — assim o usuário não precisa esperar
    /// o tick inteiro pra sair do modo aguardar.
    /// </summary>
    private static void SleepResponsive(int totalMs)
    {
        var deadline = DateTime.UtcNow.AddMilliseconds(totalMs);
        while (DateTime.UtcNow < deadline && !s_stopRequested)
        {
            if (Console.KeyAvailable)
            {
                var key = Console.ReadKey(intercept: true).Key;
                if (key is ConsoleKey.Q or ConsoleKey.Escape)
                {
                    s_stopRequested = true;
                    s_stopReason = $"tecla {key}";
                    return;
                }
            }
            Thread.Sleep(50);
        }
    }

    // ── Capture loop (lê serial até erro/parar) ─────────────────────

    private record CaptureTotals(int TotalBytes, int P4Sentinels, int P5Sentinels, string ExitReason);

    private static CaptureTotals RunCaptureLoop(
        SerialPort sp, string outPath, string timingPath, SessionLogger log)
    {
        using var binStream    = File.Create(outPath);
        using var timingStream = new StreamWriter(timingPath);
        timingStream.WriteLine("timestamp_unix_ms,total_bytes,bytes_per_sec,p4_sentinels,p5_sentinels");

        var localExitReason = "";

        var buffer            = new byte[ReadBufferBytes];
        var totalBytes        = 0L;
        var p4Sentinels       = 0; // ocorrências de 0x1E 0xFC consecutivos (cauda do pacote 4)
        var p5Sentinels       = 0; // ocorrências de 0xFB 0xFA consecutivos (cabeça do pacote 5)
        var bytesAtLastReport = 0L;
        var stopwatch         = Stopwatch.StartNew();
        var lastReportMs      = 0L;
        var readErrorCount    = 0;
        byte? prevByte        = null;

        while (!s_stopRequested && string.IsNullOrEmpty(localExitReason))
        {
            int n;
            try { n = sp.Read(buffer, 0, buffer.Length); }
            catch (TimeoutException) { n = 0; }
            catch (Exception ex)
            {
                readErrorCount++;
                log.Error($"Erro de leitura serial: {ex.GetType().Name} — {ex.Message}");
                Console.Error.WriteLine($"[{DateTime.Now:HH:mm:ss}] Erro de leitura: {ex.Message}");
                localExitReason = $"erro de leitura: {ex.Message}";
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
                    s_stopRequested = true;
                    s_stopReason = $"tecla {key}";
                }
            }
        }

        try { sp.Close(); } catch (Exception ex) { log.Warn($"Erro ao fechar SerialPort: {ex.Message}"); }
        sp.Dispose();
        binStream.Flush();
        timingStream.Flush();

        log.TeeConsole("");
        log.TeeConsole($"Capturado: {totalBytes:N0} bytes em {outPath}");
        log.TeeConsole($"Sentinelas vistas — P4 (cauda 0x1E 0xFC): {p4Sentinels}, P5 (cabeça 0xFB 0xFA): {p5Sentinels}");

        if (readErrorCount > 0)
            log.Warn($"Total de erros de leitura serial durante a sessão: {readErrorCount}");

        var exitReason = !string.IsNullOrEmpty(localExitReason)
            ? localExitReason
            : (s_stopReason.Length > 0 ? s_stopReason : "fim normal");

        if (totalBytes == 0 && !s_stopRequested)
        {
            log.TeeConsole("");
            log.TeeConsole("AVISO: zero bytes recebidos. Possíveis causas:");
            log.TeeConsole("  - A USB da T4000 é só pro Injepro T Software e NÃO transmite CAN — vai precisar de adaptador USB-CAN.");
            log.TeeConsole("  - A central T4000 não está alimentada (carro precisa estar com chave em ON, não só em Acessórios).");
            log.TeeConsole("  - Driver da T4000 não negociou o stream — testa fechar e abrir o app, e/ou testa o cabo no Injepro T Software primeiro.");
        }
        if (totalBytes > 0 && p4Sentinels == 0 && p5Sentinels == 0)
        {
            log.TeeConsole("");
            log.TeeConsole("AVISO: bytes recebidos, mas zero sentinelas FIXED do T4000.");
            log.TeeConsole("Pode ser um stream diferente do CAN documentado no PDF (ou a USB usa outro protocolo).");
            log.TeeConsole("Mande o .bin pro Claude analisar mesmo assim.");
        }

        return new CaptureTotals(checked((int)totalBytes), p4Sentinels, p5Sentinels, exitReason);
    }

    // ── Helpers ─────────────────────────────────────────────────────

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
        Console.WriteLine("  p1fast-t4000-capture                 (auto-detect, modo aguardar T4000)");
        Console.WriteLine("  p1fast-t4000-capture --port=COM4");
        Console.WriteLine("  p1fast-t4000-capture --open-logs     (abre pasta de logs no Explorer)");
        Console.WriteLine();
        Console.WriteLine("Opções:");
        Console.WriteLine("  --port=COMx   força uma porta serial específica (default: detecta automaticamente)");
        Console.WriteLine("  --out=path    primeira captura usa esse nome (reconexões geram timestamp novo)");
        Console.WriteLine("  --open-logs   abre %LOCALAPPDATA%\\P1Fast.Cockpit.T4000Capture\\logs no Explorer");
        Console.WriteLine("  --help        mostra esta ajuda");
        Console.WriteLine();
        Console.WriteLine("Comportamento: o app entra em \"modo aguardar\" — fica polling pelas portas");
        Console.WriteLine("seriais e abre captura sozinho quando a T4000 aparece. Se a conexão cai,");
        Console.WriteLine("volta sozinho pro modo aguardar (uma nova captura é gravada com timestamp");
        Console.WriteLine("novo). Pra parar: Q, Esc ou Ctrl+C.");
        Console.WriteLine();
        Console.WriteLine("Cada execução grava um log em");
        Console.WriteLine("  %LOCALAPPDATA%\\P1Fast.Cockpit.T4000Capture\\logs\\session-YYYYMMDD-HHMMSS.log");
        Console.WriteLine("Mande esse .log + os arquivos .bin/.timing.csv pra análise.");
    }
}
