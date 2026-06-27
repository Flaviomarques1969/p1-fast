// MainWindow.Live — Etapa 2 do "ligar o dado real": cockpit AO VIVO na pista.
//
// Lê a Injepro T4000 de verdade pela USB (T3000UsbLiveReader, protocolo provado em
// campo) e alimenta o MESMO maestro (CockpitOrchestrator) que o replay usa — agora
// com o carro ligado. Cada amostra também GRAVA em disco (SessionRecorder, fonte da
// verdade local, ADR-003/004) ANTES de qualquer nuvem.
//
// Liga-se com --live (porta resolvida sozinha, ou --port=COMx). Sem a T4000 plugada,
// a tela avisa e o leitor religa sozinho quando o cabo aparece.
//
// GPS ao vivo: RaceBox Mini por BLUETOOTH no notebook (RaceBoxBleReader, port fiel
// do leitor provado em web/teste-aparelhos/index.html). LIGADO aqui — alimenta
// AlimentarGps → curva/ápice/delta/freada ao vivo. NÃO é o iPhone (ADR-023 era
// stale). Verificação final com o RaceBox na mão (bench), igual à T4000.
//
// NUVEM (C5, ligada 2026-06-25): publica MOTOR (LivePublisher, fila que não perde) e
// GPS a ~25 Hz pro app P1 Fast e o Command Box — é o ÚNICO caminho do ao-vivo até eles
// (o cockpit do piloto é local/baixa latência; o app e o box dependem da nuvem). Canal
// de TESTE por padrão; produção 'cockpit-bubi-live' só com ordem. Vive em LacoNuvemAsync,
// dono único do publisher/canal; sem a chave P1FAST_SUPABASE_ANON, segue 100% local.

using System.Collections.Concurrent;
using System.Threading;
using P1Fast.Cockpit.Domain;

namespace P1Fast.Cockpit.UI;

public sealed partial class MainWindow
{
    private CancellationTokenSource? _liveCts;
    private SessionRecorder? _liveRecorder;
    private readonly object _liveRecLock = new();
    private Task? _liveReaderTask;   // motor USB numa thread dedicada (fora da thread da UI)
    private Task? _liveHealthTask;   // vigia de saúde da gravação, em fundo (fora da UI)
    private RaceBoxBleReader? _raceBox;
    private bool _liveParado;        // guarda de fechamento (StopLive idempotente)

    // Nuvem ao vivo (C5): publica MOTOR (LivePublisher, com fila que não perde) e GPS
    // (evento à parte). UM só dono mexe no publisher/canal — o laço da nuvem — então o
    // motor entrega na fila abaixo e o GPS guarda o último fix; sem corrida com o leitor.
    private SupabaseRealtimeChannel? _liveNuvem;
    private LivePublisher? _livePublisher;
    private Task? _liveCloudTask;
    private readonly ConcurrentQueue<(T3000Sample s, long tWall)> _liveCloudMotor = new();
    private volatile IDictionary<string, object?>? _liveUltimoGps;

    // Nuvem: URL do projeto + canal de TESTE por padrão. PRODUÇÃO ('cockpit-bubi-live',
    // o que o app/Command Box assistem) só com ORDEM do Flávio — exige trocar o canal E
    // permitirProducao=true no LivePublisher (trava dura). NÃO publicar em produção aqui.
    private const string LiveSupabaseUrl = "https://fvhwltzhytpnhlqbttmd.supabase.co";
    private const string LiveCanalTeste  = "cockpit-bubi-dev-teste";

    // Liga o cockpit ao vivo: carrega as curvas fora da thread da UI, resolve a porta
    // e religa o maestro + leitor na thread da UI.
    private void StartLive()
    {
        StatusText.Text = "ao vivo: procurando T4000…";

        _ = System.Threading.Tasks.Task.Run(() =>
        {
            // Curvas de Brasília (mesmo arquivo do replay) — deixam o maestro pronto
            // pro GPS quando ele chegar; sem GPS ainda não são exercidas.
            IReadOnlyList<TrechoSegmento> segs = Array.Empty<TrechoSegmento>();
            try
            {
                var root = ResolveRepoRoot();
                var barrasPath = Path.Combine(root, "_design-reference", "BARRAS-BRASILIA-FLAVIO-APROVADO-2026-05-27.json");
                if (File.Exists(barrasPath))
                    segs = SessaoReplay.CarregarSegmentos(File.ReadAllText(barrasPath));
            }
            catch { /* sem curvas: a tela mostra o motor mesmo assim */ }

            return (segs, port: ResolveLivePort(_options.Port));
        }).ContinueWith(t =>
        {
            var (segs, port) = t.Result;
            DispatcherQueue.TryEnqueue(() => IniciarLive(segs, port));
        });
    }

    private void IniciarLive(IReadOnlyList<TrechoSegmento> segs, string? port)
    {
        IniciarFeedReal(segs);    // para timers de demo + cria _orquestrador
        AtualizarSensores(null);  // motor sem amostra ainda → tudo "a comunicar"

        _liveCts = new CancellationTokenSource();

        // Fechamento limpo: ao fechar a janela, cancela os laços e encerra a sessão
        // (sem deixar órfã). Uma só vez (StopLive é idempotente).
        this.Closed += (_, _) => StopLive();

        // Gravação local blindada (fonte da verdade), ANTES da nuvem. Best-effort:
        // falha de IO não derruba a tela do piloto.
        try
        {
            var pasta = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "p1fast-sessoes");
            _liveRecorder = new SessionRecorder(new FileSessionStore(pasta));
        }
        catch { _liveRecorder = null; }

        // Nuvem ao vivo (C5): liga SÓ se a chave estiver no ambiente (peça ao Flávio).
        // Sem chave, segue 100% local — o gravador blindado acima é a durabilidade.
        // Canal de TESTE por padrão; a redundância nunca derruba a tela do piloto.
        try
        {
            var anon = Environment.GetEnvironmentVariable("P1FAST_SUPABASE_ANON");
            if (!string.IsNullOrWhiteSpace(anon))
            {
                // Canal: TESTE por padrão (seguro). Só vai pra PRODUÇÃO (cockpit-bubi-live,
                // o que o app/Command Box assistem) com --producao — ordem expressa do
                // Flávio, por execução. A trava do LivePublisher só abre nesse caso.
                var canal = _options.Producao ? LivePublisher.CanalProducao : LiveCanalTeste;
                _liveNuvem = new SupabaseRealtimeChannel(LiveSupabaseUrl, anon, canal);
                _livePublisher = new LivePublisher(_liveNuvem, canal, permitirProducao: _options.Producao);
                _liveCloudTask = Task.Run(() => LacoNuvemAsync(_liveCts.Token));
            }
        }
        catch { _liveNuvem = null; _livePublisher = null; }

        // GPS ao vivo: RaceBox Mini por Bluetooth — INDEPENDE da T4000. Best-effort:
        // sem RaceBox, segue varrendo; sem GPS a tela mostra o motor mesmo assim.
        _raceBox = new RaceBoxBleReader(OnLiveGps, txt => DispatcherQueue.TryEnqueue(() => StatusText.Text = txt));
        _raceBox.Start(_liveCts.Token);

        // Motor: T4000 pela USB. O aparelho REAL (Injepro T4000, chip Microchip
        // VID_04D8&PID_014A) fala WinUSB — EXATAMENTE como o leitor web provado
        // (main-t3000.js, por WebUSB). Caminho preferido = WinUSB, 100% local; o COM
        // (CDC-ACM, LiveUsbChannel) vira contingencia se o aparelho for porta serial.
        //
        // Monta o canal de acordo com o que esta presente NESTE instante (re-chamado
        // a cada tentativa do supervisor abaixo). Null = nenhuma fonte de motor agora.
        IT3000UsbChannel? CriarCanalMotor(out string fonte)
        {
            bool win = false;
            try { win = WinUsbT3000Channel.Present(); } catch { win = false; }
            if (win && port is not null)
            {
                // WinUSB com a serial de RESERVA: se o WinUSB nao ABRIR, cai pra COM.
                fonte = $"T4000 (WinUSB, COM {port} de reserva)";
                return new FallbackT3000UsbChannel(new WinUsbT3000Channel(), () => new LiveUsbChannel(port));
            }
            if (win) { fonte = "T4000 (WinUSB)"; return new WinUsbT3000Channel(); }
            if (port is not null) { fonte = $"T4000 (COM {port})"; return new LiveUsbChannel(port); }
            fonte = ""; return null;
        }

        // Supervisor do motor numa thread DEDICADA (C8): abrir + handshake + 1º Read
        // BLOQUEIAM — nao podem rodar na thread da UI. E, igual ao GPS (que faz scan
        // continuo), o motor NAO desiste: o RunAsync provado so' retorna se a abertura/
        // handshake inicial falha (a religacao interna so' age DEPOIS de abrir uma vez).
        // Como o --live sobe no boot ANTES de a injecao ser plugada/energizada, um
        // disparo unico nunca pegava o motor (gravacoes 26/06: 0 motor, GPS cheio).
        // Aqui o supervisor espera o aparelho aparecer e RE-TENTA pra sempre.
        _liveReaderTask = Task.Factory.StartNew(async () =>
        {
            var ct = _liveCts.Token;
            bool avisouEsperando = false;
            while (!ct.IsCancellationRequested)
            {
                var canal = CriarCanalMotor(out var fonte);
                if (canal is null)
                {
                    if (!avisouEsperando)
                    {
                        avisouEsperando = true;
                        DispatcherQueue.TryEnqueue(() => StatusText.Text = "ao vivo: GPS ok; esperando a T4000 (USB) plugar…");
                    }
                    try { await Task.Delay(1500, ct).ConfigureAwait(false); } catch { break; }
                    continue;
                }
                avisouEsperando = false;
                DispatcherQueue.TryEnqueue(() => StatusText.Text = $"ao vivo: {fonte} + GPS RaceBox…");

                var reader = new T3000UsbLiveReader(
                    canal,
                    onSample: OnLiveMotor,
                    onStatus: (txt, nivel) => DispatcherQueue.TryEnqueue(() => StatusText.Text = $"ao vivo [{nivel}]: {txt}"),
                    onLog: _ => { });
                try { await reader.RunAsync(ct).ConfigureAwait(false); }
                catch (OperationCanceledException) { break; }
                catch { /* caiu na abertura/handshake — respira e tenta de novo */ }

                // So' chega aqui se cancelou ou se a abertura/handshake inicial falhou.
                // Nao cancelou => espera e RETENTA (cabo plugado depois, central acordando).
                if (ct.IsCancellationRequested) break;
                try { await Task.Delay(1500, ct).ConfigureAwait(false); } catch { break; }
            }
        }, _liveCts.Token, TaskCreationOptions.LongRunning, TaskScheduler.Default).Unwrap();

        // Saúde da gravação ~1 Hz numa thread de FUNDO, NÃO na UI (C8): o Tick pega o
        // _liveRecLock; tirá-lo da UI separa esse lock da thread da UI — a tela do
        // piloto nunca mais espera o disco. Fecha por silêncio; alarme nunca silencioso.
        _liveHealthTask = Task.Run(async () =>
        {
            var ct = _liveCts.Token;
            try
            {
                while (!ct.IsCancellationRequested)
                {
                    await Task.Delay(1000, ct).ConfigureAwait(false);
                    lock (_liveRecLock) _liveRecorder?.Tick();
                    // Re-avalia os sensores ~1 Hz mesmo SEM amostra nova: se motor e/ou GPS
                    // pararem, os LEDs degradam (apagam) em vez de congelar verdes. O live é
                    // event-driven; sem este tick, no silêncio total nada mais re-pintaria.
                    DispatcherQueue.TryEnqueue(() => AtualizarSensores(_ultimaAlerta));
                }
            }
            catch (OperationCanceledException) { /* encerrando */ }
        });
    }

    // Fechamento limpo do --live: cancela os laços de fundo (motor/saúde/nuvem) e o
    // RaceBox (que se desliga pelo token), e ENCERRA a sessão de gravação — fechada,
    // não órfã. Best-effort e idempotente: nunca trava o fechamento da janela. O disco
    // já tem tudo (append-only + flush por registro); a nuvem é redundância e o laço
    // dela libera o canal no próprio finally ao cancelar.
    private void StopLive()
    {
        if (_liveParado) return;
        _liveParado = true;
        // 1) Encerra a sessão JÁ (síncrono, rápido): fecha o meta, nunca deixa órfã.
        try { lock (_liveRecLock) _liveRecorder?.Encerrar("fechou-app"); } catch { /* best-effort */ }
        // 2) Cancela laços + aparelhos em FUNDO: o Cancel() roda o teardown do RaceBox
        //    (Stop() do watcher BLE), que pode bloquear alguns segundos numa pilha
        //    Bluetooth fria — não pode travar o fechamento da janela.
        var cts = _liveCts;
        _ = Task.Run(() => { try { cts?.Cancel(); } catch { /* já caindo */ } });
    }

    // Cada amostra do motor (vem na thread do leitor): grava em disco e move a tela.
    // A gravação fica FORA da thread da UI (disco a 10 Hz não pode travar o cockpit);
    // a mutação do estado é re-enfileirada pra thread da UI.
    private void OnLiveMotor(T3000Sample s)
    {
        _ultimoMotorTick = Environment.TickCount64;   // chegada do motor (pra guarda de recência dos sensores)
        SessionRecord? reg;
        lock (_liveRecLock) reg = _liveRecorder?.Motor(s);

        // Nuvem: entrega pro laço (1 só dono do publisher — sem corrida). tWall = tempo
        // de CAPTURA (do registro gravado), pra casar com o vídeo e ordenar certo.
        if (_livePublisher is not null && reg is not null)
            _liveCloudMotor.Enqueue((s, reg.TWall));

        var (rpm, alerta) = BridgeMotor(s);
        DispatcherQueue.TryEnqueue(() =>
        {
            _orquestrador?.IngestMotor(rpm, alerta);
            _ultimaAlerta = alerta;      // guarda pro refresh de sensores quando vier GPS
            AtualizarSensores(alerta);
        });
    }

    // Cada fix do GPS (vem na thread do BLE): grava em disco e move a tela (curva/
    // ápice/delta/freada). Só fix 3D entra — fix fraco não envenena o detector.
    private void OnLiveGps(RaceBoxFix f)
    {
        if (f.Fix < 3) return;
        long tWall = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        lock (_liveRecLock)
            _liveRecorder?.Gps(
                new { lat = f.Lat, lon = f.Lng, kmh = f.Kmh, fix = f.Fix, numSV = f.NumSV, hacc = f.HaccM },
                velKmh: f.Kmh);

        // Nuvem: guarda o ÚLTIMO fix (o laço amostra a ~25 Hz, taxa real do RaceBox; o
        // disco acima já gravou TODOS os fixes). Chaves EXATAS do cloudSend('gps',…) de
        // web/teste-aparelhos — não quebrar consumidor. (O web amostra a 5 Hz; aqui o
        // .exe carrega o full 25 Hz pro app/Command Box terem o GPS na resolução cheia.)
        if (_liveNuvem is not null)
            _liveUltimoGps = new Dictionary<string, object?>
            {
                ["lat"]   = f.Lat,
                ["lng"]   = f.Lng,
                ["kmh"]   = f.Kmh,
                ["numSV"] = f.NumSV,
                ["fix"]   = f.Fix,
                ["accM"]  = f.HaccM,
                ["tWall"] = tWall,
            };

        // Move a tela na thread da UI, EM ORDEM: GPS no maestro → ponte do stint (barra
        // de trechos) → sensores (MOVIMENTO acende). _ultimoGpsTick marca a chegada em
        // tempo real (pro sensor de GPS). Antes só o replay fazia essas pontes.
        _ultimoGpsTick = Environment.TickCount64;
        var amostra = new AmostraGps(f.Lat, f.Lng, f.Kmh, (double)tWall);
        DispatcherQueue.TryEnqueue(() =>
        {
            _orquestrador?.IngestGps(amostra);
            AtualizarStint();
            AtualizarSensores(_ultimaAlerta);
        });
    }

    // Laço da nuvem (C5) — UM só dono do publisher e do canal: conecta, religa sozinho
    // (backoff ~2 s), oferece ao publisher tudo o que o motor empurrou (ele estrangula
    // a 5 Hz e enfileira sem perder), drena pra nuvem e publica o último GPS a ~25 Hz
    // (taxa do RaceBox; evento à parte, sem fila durável — o disco já guardou). O giro do
    // laço (40 ms) casa com o GPS; o motor segue 5 Hz pelo throttle do Oferecer, não pelo
    // giro. Roda em fundo até o _liveCts cair. Erro aqui NUNCA derruba a tela do piloto.
    private async Task LacoNuvemAsync(CancellationToken ct)
    {
        var nuvem = _liveNuvem!;
        var pub = _livePublisher!;
        try { await nuvem.ConnectAsync(ct).ConfigureAwait(false); } catch { /* religa abaixo */ }
        long ultimaTentativa = Environment.TickCount64;
        IDictionary<string, object?>? ultimoGpsEnviado = null;
        try
        {
            while (!ct.IsCancellationRequested)
            {
                // 1) Motor: passa pro publisher tudo o que chegou (ele estrangula a 5 Hz).
                while (_liveCloudMotor.TryDequeue(out var item))
                    pub.Oferecer(item.s, item.tWall);

                // 2) Religa se caiu (backoff ~2 s), igual ao console de captura.
                if (!nuvem.Online)
                {
                    long agora = Environment.TickCount64;
                    if (agora - ultimaTentativa > 2000)
                    {
                        ultimaTentativa = agora;
                        try { await nuvem.ConnectAsync(ct).ConfigureAwait(false); } catch { /* tenta depois */ }
                    }
                }

                // 3) Drena o motor acumulado (reenvia TODO o período quando a nuvem volta).
                try { await pub.DrenarAsync(ct).ConfigureAwait(false); }
                catch (OperationCanceledException) { break; }
                catch { /* erro de envio: segura na fila, tenta no próximo giro */ }

                // 4) GPS ao vivo (evento à parte): só o último fix, só online e só se novo
                //    (o guarda evita reenviar o mesmo fix quando o giro corre na frente).
                var gps = _liveUltimoGps;
                if (gps is not null && nuvem.Online && !ReferenceEquals(gps, ultimoGpsEnviado))
                {
                    try { if (await nuvem.PublishAsync("gps", gps, ct).ConfigureAwait(false)) ultimoGpsEnviado = gps; }
                    catch (OperationCanceledException) { break; }
                    catch { /* GPS é best-effort; o disco já guardou */ }
                }

                try { await Task.Delay(40, ct).ConfigureAwait(false); } // ~25 Hz, taxa do RaceBox
                catch (OperationCanceledException) { break; }
            }
        }
        finally
        {
            try { await nuvem.DisposeAsync().ConfigureAwait(false); } catch { }
        }
    }

    // Ponte T3000Sample (USB) → AmostraAlerta, MESMO mapeamento que o replay usa
    // (SessaoReplay.Carregar). Campo ausente = null = "sem dado" (nunca alerta falso).
    private static (double rpm, AmostraAlerta alerta) BridgeMotor(T3000Sample s)
    {
        bool? Alm(string k) => s.Alarmes is not null && s.Alarmes.TryGetValue(k, out var v) ? v : (bool?)null;
        var alerta = new AmostraAlerta
        {
            Rpm                     = s.Rpm,
            WaterTempC              = s.WaterTempC.HasValue ? (double?)s.WaterTempC.Value : null,
            TpsPct                  = s.TpsPct,
            Lambda                  = s.Lambda,
            BatteryV                = s.BatteryV,
            FuelInjectionBalanced   = s.FuelInjectionBalanced,
            BaixaPressaoOleo        = Alm("baixaPressaoOleo"),
            AlertaNivelCombustivel  = Alm("alertaNivelCombustivel"),
            BaixaPressaoCombustivel = Alm("baixaPressaoCombustivel"),
        };
        return (s.Rpm, alerta);
    }

    // Porta da T4000: usa --port se veio; senão a última porta COM enumerada.
    private static string? ResolveLivePort(string? requested)
    {
        if (!string.IsNullOrWhiteSpace(requested)) return requested;
        try
        {
            var ports = System.IO.Ports.SerialPort.GetPortNames();
            if (ports.Length > 0) { Array.Sort(ports, StringComparer.Ordinal); return ports[^1]; }
        }
        catch { /* sem acesso a portas → null */ }
        return null;
    }
}
