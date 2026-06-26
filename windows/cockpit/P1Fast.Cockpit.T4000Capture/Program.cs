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
        var diagOnly = args.Any(a => a is "--diag" or "--diagnose");

        if (help)
        {
            PrintHelp();
            return 0;
        }

        // Modos novos (aditivos — não mexem na captura crua .bin abaixo):
        //   --gravar    liga o leitor USB ao gravador blindado (sessão pronta pro app)
        //   --conferir  relê as sessões gravadas e reporta integridade
        if (args.Any(a => a is "--conferir" or "--verificar")) return RunConferirMode(args);
        if (args.Any(a => a is "--nuvem-teste"))               return RunNuvemTesteMode(args);
        if (args.Any(a => a is "--gps-teste"))                 return RunGpsTesteMode(args);
        if (args.Any(a => a is "--gravar"   or "--record"))    return RunGravarMode(args);

        // Sempre roda o diagnóstico USB antes de qualquer coisa. Mostra TODOS
        // os cabos USB conectados, identifica candidatos a T4000, e aponta
        // quando falta driver. Se --diag, sai depois do relatório.
        var devices = UsbScanner.ScanAll();
        UsbScanner.PrintReport(devices);

        if (diagOnly)
        {
            Console.WriteLine("Modo --diag: relatório acima. Saindo sem capturar.");
            return 0;
        }

        if (portName is null)
        {
            // 1ª tentativa: usar o melhor candidato detectado pelo diagnóstico WMI.
            portName = UsbScanner.FindBestComPort(devices);

            // 2ª tentativa: fallback pra enumeração tradicional de portas COM.
            if (portName is null)
            {
                var ports = SerialPort.GetPortNames().OrderBy(x => x, StringComparer.Ordinal).ToArray();
                if (ports.Length > 0)
                {
                    portName = ports[^1];
                    Console.WriteLine($"Sem candidato USB-Serial óbvio. Usando porta: {portName}");
                }
            }
            else
            {
                Console.WriteLine($"Candidato T4000 identificado automaticamente: {portName}");
            }

            if (portName is null)
            {
                Console.Error.WriteLine();
                Console.Error.WriteLine("Não consegui encontrar uma porta serial pra abrir.");
                Console.Error.WriteLine("Veja o diagnóstico USB acima — provavelmente um destes:");
                Console.Error.WriteLine("  1. Cabo USB da T4000 não está plugado (relatório lista 0 dispositivos)");
                Console.Error.WriteLine("  2. Cabo plugado mas Windows não tem o driver do chip (relatório mostra 'SEM DRIVER')");
                Console.Error.WriteLine("  3. Use --port=COMx pra forçar uma porta específica");
                return 1;
            }
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

    // === MODO --gravar: captura de sessão ponta a ponta (motor T3000 -> disco) ===
    //
    // Liga o leitor USB PROVADO (T3000UsbLiveReader) ao gravador blindado PROVADO
    // (SessionRecorder + FileSessionStore). Cada amostra do motor é gravada
    // append-only em disco ANTES e independente de qualquer rede — é a fonte da
    // verdade que faltava em 20-21/06. GPS continua na Central (navegador), Fase 6.
    private static int RunGravarMode(string[] args)
    {
        var portName = ParseArg(args, "--port");
        var pasta    = ParseArg(args, "--pasta")
            ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "p1fast-sessoes");

        // Nuvem ao vivo (opcional). O LOCAL sempre grava; a nuvem é a redundância ao
        // vivo pro app P1 Fast e a tela do Command Box, com fila que não perde na queda.
        var usarNuvem  = args.Any(a => a is "--nuvem");
        var producao   = args.Any(a => a is "--producao");
        var canalNuvem = ParseArg(args, "--canal") ?? (producao ? LivePublisher.CanalProducao : "cockpit-bubi-dev-teste");
        var urlNuvem   = ParseArg(args, "--url") ?? "https://fvhwltzhytpnhlqbttmd.supabase.co";
        var anon       = Environment.GetEnvironmentVariable("P1FAST_SUPABASE_ANON");

        Console.WriteLine("=== P1 Fast — GRAVAÇÃO DE SESSÃO (motor T3000 pela USB) ===");
        Console.WriteLine($"Pasta de gravação: {pasta}");
        Console.WriteLine(usarNuvem
            ? $"Nuvem ao vivo: LIGADA — canal '{canalNuvem}'{(producao ? " (PRODUÇÃO)" : " (teste)")}"
            : "Nuvem ao vivo: desligada (use --nuvem pra ligar)");
        Console.WriteLine();

        // Diagnóstico USB + resolução de porta (mesma lógica do capturador cru).
        var devices = UsbScanner.ScanAll();
        UsbScanner.PrintReport(devices);
        if (portName is null)
        {
            portName = UsbScanner.FindBestComPort(devices);
            if (portName is null)
            {
                var ports = SerialPort.GetPortNames().OrderBy(x => x, StringComparer.Ordinal).ToArray();
                if (ports.Length > 0)
                {
                    portName = ports[^1];
                    Console.WriteLine($"Sem candidato óbvio. Usando porta: {portName}");
                }
            }
            else Console.WriteLine($"Candidato T4000 identificado: {portName}");
        }
        if (portName is null)
        {
            Console.Error.WriteLine("Não achei porta serial. Veja o diagnóstico acima (cabo? driver? use --port=COMx).");
            return 1;
        }

        // Gravador blindado (fonte da verdade) + recuperação de sessão órfã no boot.
        using var store = new FileSessionStore(pasta);
        var recorder = new SessionRecorder(store);
        var orfas = recorder.RecuperarOrfas();
        if (orfas.Count > 0)
        {
            Console.WriteLine($"Recuperei {orfas.Count} sessão(ões) que ficaram abertas (notebook caiu sem fechar):");
            foreach (var o in orfas)
                Console.WriteLine($"  - {o.Id}  motor={o.NMotor} gps={o.NGps} -> marcada 'interrompida' (dado preservado)");
            Console.WriteLine();
        }

        var cts = new CancellationTokenSource();
        Console.CancelKeyPress += (_, e) => { e.Cancel = true; cts.Cancel(); };

        // Fio + publicador da nuvem (só se ligado E com a chave configurada).
        SupabaseRealtimeChannel? nuvem = null;
        LivePublisher? publisher = null;
        if (usarNuvem)
        {
            if (string.IsNullOrWhiteSpace(anon))
                Console.WriteLine("AVISO: --nuvem pedido, mas falta a chave (variável de ambiente P1FAST_SUPABASE_ANON). Seguindo SÓ local.");
            else
            {
                nuvem = new SupabaseRealtimeChannel(urlNuvem, anon, canalNuvem);
                publisher = new LivePublisher(nuvem, canalNuvem, permitirProducao: producao);
                Console.WriteLine($"Conectando na nuvem (canal '{canalNuvem}')…");
                try { nuvem.ConnectAsync(cts.Token).Wait(4000); } catch { /* tenta de novo no laço */ }
            }
        }

        // Leitor ao vivo na tomada real -> cada amostra GRAVA no disco E entra na fila da nuvem.
        var serial = new SerialPortT3000UsbChannel(portName);
        var reader = new T3000UsbLiveReader(
            serial,
            onSample: s => { var reg = recorder.Motor(s); if (reg is not null) publisher?.Oferecer(s, reg.TWall); },
            onStatus: (txt, nivel) => Console.WriteLine($"[{nivel.ToUpperInvariant()}] {txt}"),
            onLog:    txt => Console.WriteLine("  " + txt));

        Console.WriteLine($"Lendo de {portName}. Aperte Q ou Esc pra encerrar (Ctrl+C também).");
        Console.WriteLine();

        var readerTask = reader.RunAsync(cts.Token);
        long ultimaTentativaNuvem = 0;

        // Painel de saúde ~1x/s + vigia de tecla, no fio principal. Alarme NUNCA silencioso.
        SessionResumo? resultado = null;
        while (!cts.IsCancellationRequested)
        {
            Thread.Sleep(1000);
            var fimSilencio = recorder.Tick();        // atualiza estado; encerra por silêncio
            if (fimSilencio is not null) resultado = fimSilencio;

            // Nuvem: religa sozinho se caiu, depois drena a fila (reenvia o acumulado).
            if (publisher is not null && nuvem is not null)
            {
                if (!nuvem.Online)
                {
                    long agora = Environment.TickCount64;
                    if (agora - ultimaTentativaNuvem > 2000)
                    {
                        ultimaTentativaNuvem = agora;
                        try { nuvem.ConnectAsync(cts.Token).Wait(4000); } catch { /* tenta depois */ }
                    }
                }
                try { publisher.DrenarAsync(cts.Token).Wait(2000); } catch { /* mantém na fila */ }
            }

            var e = recorder.Estado();
            var alarme = e.Alarme is null ? "" : $"   *** ALARME: {e.Alarme} ***";
            var linhaNuvem = publisher is null ? "" :
                $"  | nuvem={publisher.Saude()} enviadas={publisher.GetStats().Enviadas} fila={publisher.GetStats().NaFila}";
            Console.WriteLine(
                $"[{DateTime.Now:HH:mm:ss}] gravando={(e.Gravando ? "sim" : "não")}  " +
                $"motor={e.NMotor} ({e.HzMotor:0.0} Hz)  lacunas={e.Lacunas}  descartadas={e.Dropped}{linhaNuvem}{alarme}");

            if (Console.KeyAvailable)
            {
                var key = Console.ReadKey(intercept: true).Key;
                if (key is ConsoleKey.Q or ConsoleKey.Escape) cts.Cancel();
            }
            if (readerTask.IsCompleted && !recorder.Gravando) break;
        }

        cts.Cancel();
        try { readerTask.Wait(3000); } catch { /* cancelamento esperado */ }
        // Última drenada do que sobrou na fila antes de fechar (se a nuvem estiver de pé).
        if (publisher is not null) { try { publisher.DrenarAsync(CancellationToken.None).Wait(3000); } catch { } }
        resultado ??= recorder.Encerrar("manual");

        Console.WriteLine();
        if (resultado is not null)
        {
            Console.WriteLine($"Sessão encerrada: {resultado.Id}  (motivo: {resultado.MotivoFim})");
            Console.WriteLine($"  motor={resultado.NMotor}  gps={resultado.NGps}  duração={resultado.DuracaoS:0.0}s  " +
                              $"descartadas={resultado.Dropped}  maior lacuna={resultado.MaiorLacunaMs} ms");
            Console.WriteLine($"  arquivo: {Path.Combine(pasta, resultado.Id + ".jsonl")}");
            var conf = SessionIntegrity.Conferir(resultado.Id, recorder.ExportarSessao(resultado.Id));
            Console.WriteLine("  conferência: " + conf.Linha);
            if (resultado.NMotor == 0)
                Console.WriteLine("  AVISO: zero amostras de motor — confira cabo/driver (diagnóstico USB acima).");
        }
        else Console.WriteLine("Nenhuma sessão gravada (não chegou dado do motor).");

        var st = reader.GetStats();
        Console.WriteLine($"  leitor: emitidas={st.SamplesEmitted} religações={st.Reconnects} " +
                          $"blocosCurtos={st.ShortBlocks} leiturasRuins={st.BadReads} errosLeitura={st.ReadErrors}");
        if (publisher is not null)
        {
            var cs = publisher.GetStats();
            Console.WriteLine($"  nuvem: enviadas={cs.Enviadas} fila={cs.NaFila} descartadas={cs.Descartadas} " +
                              $"erros={cs.Erros} barradas={cs.BarradasGuarda}");
        }
        if (nuvem is not null) { try { nuvem.DisposeAsync().AsTask().Wait(2000); } catch { } }
        return 0;
    }

    // === MODO --nuvem-teste: prova o FIO da nuvem na bancada (sem carro) ===
    // Conecta num canal de TESTE e manda algumas amostras sintéticas, mostrando se a
    // nuvem aceitou. NUNCA toca o canal de produção. Pra o operador confirmar, antes
    // da pista, que o notebook fala com a nuvem.
    private static int RunNuvemTesteMode(string[] args)
    {
        var canal = ParseArg(args, "--canal") ?? "cockpit-bubi-dev-teste";
        var url   = ParseArg(args, "--url")   ?? "https://fvhwltzhytpnhlqbttmd.supabase.co";
        var anon  = Environment.GetEnvironmentVariable("P1FAST_SUPABASE_ANON");
        if (canal == LivePublisher.CanalProducao)
        {
            Console.Error.WriteLine("Recusado: --nuvem-teste NÃO publica no canal de produção. Use um canal de teste.");
            return 1;
        }
        if (string.IsNullOrWhiteSpace(anon))
        {
            Console.Error.WriteLine("Falta a chave: defina a variável de ambiente P1FAST_SUPABASE_ANON.");
            return 1;
        }

        Console.WriteLine($"=== Teste do fio da nuvem — canal de teste '{canal}' ===");
        var cts = new CancellationTokenSource();
        cts.CancelAfter(15000);
        var nuvem = new SupabaseRealtimeChannel(url, anon, canal);
        var pub = new LivePublisher(nuvem, canal);
        try { nuvem.ConnectAsync(cts.Token).Wait(6000); } catch { }

        for (int i = 0; i < 30 && !cts.IsCancellationRequested; i++)
        {
            var s = new T3000Sample { Rpm = 3000 + i * 50, SpeedKmh = 100 + i, LeituraPlausivel = true, Source = "sim-replay", TMono = i * 200 };
            pub.Oferecer(s, Environment.TickCount64);
            try { pub.DrenarAsync(cts.Token).Wait(2000); } catch { }
            Console.WriteLine($"  online={nuvem.Online}  saude={pub.Saude()}  enviadas={pub.GetStats().Enviadas} fila={pub.GetStats().NaFila}");
            Thread.Sleep(300);
        }

        var st = pub.GetStats();
        Console.WriteLine($"Resultado: enviadas={st.Enviadas} fila={st.NaFila} erros={st.Erros}");
        Console.WriteLine(st.Enviadas > 0
            ? "OK — o notebook FALA com a nuvem (canal de teste)."
            : "FALHOU — não consegui publicar. Verifique internet / chave / URL.");
        try { nuvem.DisposeAsync().AsTask().Wait(2000); } catch { }
        return st.Enviadas > 0 ? 0 : 2;
    }

    // === MODO --gps-teste: prova o GPS na nuvem na bancada (sem RaceBox) ===
    // Publica GPS sintético (uma voltinha andando em Brasília) no canal de TESTE, no MESMO
    // formato que o .exe publica (lat,lng,kmh,numSV,fix,accM,tWall). Serve pro ensaio do
    // item 3: o web (apontado pro mesmo canal) deve receber e repassar pro vídeo. NUNCA toca
    // a produção.
    private static int RunGpsTesteMode(string[] args)
    {
        var canal = ParseArg(args, "--canal") ?? "cockpit-bubi-dev-teste";
        var url   = ParseArg(args, "--url")   ?? "https://fvhwltzhytpnhlqbttmd.supabase.co";
        var anon  = Environment.GetEnvironmentVariable("P1FAST_SUPABASE_ANON");
        if (canal == LivePublisher.CanalProducao)
        {
            Console.Error.WriteLine("Recusado: --gps-teste NÃO publica no canal de produção. Use um canal de teste.");
            return 1;
        }
        if (string.IsNullOrWhiteSpace(anon))
        {
            Console.Error.WriteLine("Falta a chave: defina a variável de ambiente P1FAST_SUPABASE_ANON.");
            return 1;
        }

        Console.WriteLine($"=== Teste do GPS na nuvem — canal de teste '{canal}' (gps sintético) ===");
        var cts = new CancellationTokenSource();
        cts.CancelAfter(30000);
        var nuvem = new SupabaseRealtimeChannel(url, anon, canal);
        try { nuvem.ConnectAsync(cts.Token).Wait(6000); } catch { }

        double lat = -15.7720, lng = -47.8870; // andando perto da pista de Brasília
        int enviados = 0;
        for (int i = 0; i < 150 && !cts.IsCancellationRequested; i++)
        {
            lat += 0.00002; lng += 0.00001;
            var payload = new Dictionary<string, object?>
            {
                ["lat"] = lat, ["lng"] = lng, ["kmh"] = 80 + (i % 40),
                ["numSV"] = 9, ["fix"] = 3, ["accM"] = 1.2,
                ["tWall"] = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
            };
            bool ok = false;
            try { ok = nuvem.PublishAsync("gps", payload, cts.Token).Result; } catch { }
            if (ok) enviados++;
            if (i % 10 == 0) Console.WriteLine($"  online={nuvem.Online} enviados={enviados}  (lat={lat:F5} kmh={payload["kmh"]})");
            Thread.Sleep(200); // ~5 Hz no ensaio (o real é 25 Hz)
        }

        Console.WriteLine($"Resultado: gps enviados={enviados}");
        Console.WriteLine(enviados > 0
            ? "OK — gps sintético publicado no canal de teste (o web apontado pro mesmo canal deve mostrar/repassar)."
            : "FALHOU — não publicou. Verifique internet / chave / URL.");
        try { nuvem.DisposeAsync().AsTask().Wait(2000); } catch { }
        return enviados > 0 ? 0 : 2;
    }

    // === MODO --conferir: relê as sessões gravadas e reporta integridade ===
    private static int RunConferirMode(string[] args)
    {
        var pasta = ParseArg(args, "--pasta")
            ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "p1fast-sessoes");

        Console.WriteLine($"=== Conferência das sessões gravadas em: {pasta} ===");
        if (!Directory.Exists(pasta))
        {
            Console.WriteLine("(a pasta não existe — nada foi gravado aqui ainda)");
            return 0;
        }

        using var store = new FileSessionStore(pasta);
        var sessoes = store.ListarSessoes();
        if (sessoes.Count == 0)
        {
            Console.WriteLine("(nenhuma sessão encontrada)");
            return 0;
        }

        foreach (var s in sessoes.OrderBy(x => x.InicioWall))
        {
            var conf = SessionIntegrity.Conferir(s.Id, store.LerSessao(s.Id));
            Console.WriteLine($"[{s.Status}] " + conf.Linha);
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
        Console.WriteLine("  p1fast-t4000-capture --gravar [--nuvem [--producao]] [--port=COMx] [--pasta=DIR]  (GRAVA + envia ao vivo)");
        Console.WriteLine("  p1fast-t4000-capture --conferir [--pasta=DIR]                 (confere o que foi gravado)");
        Console.WriteLine("  p1fast-t4000-capture --nuvem-teste [--canal=NOME]            (prova o fio da nuvem, sem carro)");
        Console.WriteLine("  p1fast-t4000-capture [--port=COMx] [--out=arquivo.bin] [--diag] (captura crua .bin — legado)");
        Console.WriteLine();
        Console.WriteLine("Opções:");
        Console.WriteLine("  --gravar      liga o leitor da USB (T3000) ao gravador blindado: decodifica o motor e");
        Console.WriteLine("                grava cada amostra em disco (sessão recuperável). É o modo do dia de pista.");
        Console.WriteLine("  --nuvem       junto com --gravar: ENVIA ao vivo pra nuvem (app + Command Box), com fila");
        Console.WriteLine("                que reenvia o acumulado quando a internet volta. Canal de teste por padrão.");
        Console.WriteLine("  --producao    junto com --nuvem: publica no canal de produção 'cockpit-bubi-live' (o que");
        Console.WriteLine("                todos assistem). Exige a chave em P1FAST_SUPABASE_ANON.");
        Console.WriteLine("  --conferir    relê as sessões já gravadas e mostra nº de amostras, sequência e lacunas");
        Console.WriteLine("  --nuvem-teste conecta num canal de TESTE e manda amostras sintéticas pra provar a internet");
        Console.WriteLine("  --pasta=DIR   onde gravar/ler as sessões (default: <perfil do usuário>\\p1fast-sessoes)");
        Console.WriteLine("  --diag        só roda o diagnóstico USB (lista todos os cabos plugados,");
        Console.WriteLine("                identifica candidatos a T4000, aponta drivers faltando) — não captura");
        Console.WriteLine("  --port=COMx   força uma porta serial específica (default: detecta automaticamente)");
        Console.WriteLine("  --out=path    [modo legado] arquivo cru de saída (default: t4000-capture-<timestamp>.bin)");
        Console.WriteLine("  --help        mostra esta ajuda");
        Console.WriteLine();
        Console.WriteLine("Pra parar a captura: aperte Q, Esc, ou Ctrl+C.");
        Console.WriteLine();
        Console.WriteLine("Observação: o diagnóstico USB roda automaticamente toda vez antes da captura.");
        Console.WriteLine("Mostra TODOS os cabos USB plugados (mesmo sem driver instalado), identifica");
        Console.WriteLine("o chip de comunicação pelo VID (FTDI / CH340 / Silicon Labs / Prolific).");
    }
}
