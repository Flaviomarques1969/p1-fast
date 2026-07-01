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
    private Task? _liveScanTask;     // fila resiliente: sobe sessões pendentes em fundo (fora da UI)
    private RaceBoxBleReader? _raceBox;
    private bool _liveParado;        // guarda de fechamento (StopLive idempotente)

    // Nuvem ao vivo (C5): publica MOTOR (LivePublisher) e GPS (GpsLivePublisher), AMBOS
    // com fila-que-não-perde + reenvio na religação. UM só dono mexe nos publishers/canal
    // — o laço da nuvem — então o leitor só ENFILEIRA (motor e GPS) sem corrida.
    private SupabaseRealtimeChannel? _liveNuvem;
    private LivePublisher? _livePublisher;
    private GpsLivePublisher? _liveGpsPublisher;
    private Task? _liveCloudTask;
    private readonly ConcurrentQueue<(T3000Sample s, long tWall)> _liveCloudMotor = new();
    private readonly ConcurrentQueue<IDictionary<string, object?>> _liveCloudGps = new();
    private string _liveCanalRotulo = ""; // PRODUÇÃO vs TESTE — visível pro operador (bug 28/06)

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

            // Ponteiro de vídeo (peça 2): a página de campo lê ~/p1fast-sessoes/sessao-corrente.json
            // pra ligar a gravação ao stint. Escrito ATÔMICO no abrir ("gravando") e fechar
            // ("encerrada") de cada stint (formato 1 do contrato). eventId/timeId vêm da config
            // do dia (--evento/--time). Best-effort duplo: falha do ponteiro nunca derruba a
            // gravação nem a tela do piloto.
            Action<string, long, string>? aoStint = null;
            try
            {
                var sinkPonteiro = new ArquivoPonteiroSink(Path.Combine(pasta, "sessao-corrente.json"));
                var eventId = _options.Evento;
                var timeId = _options.Time;
                // Opção A (peça 3): no INÍCIO do stint, o .exe cria/recupera a sala de vídeo no
                // fam-racing e manda o payload aumentado (server-to-server) — sidesteps o
                // Vercel-vs-local + mixed-content. Só dispara quando há evento configurado
                // (--evento): sem config de dia de corrida não há vídeo a registrar.
                var salaVideo = new SalaVideoPublisher(new HttpPoster());
                var ctLive = _liveCts.Token;
                aoStint = (sid, started, status) =>
                {
                    var dados = new PonteiroDados(sid, started, eventId, timeId, status);
                    try { sinkPonteiro.Escrever(dados); }
                    catch { /* best-effort: ponteiro não derruba a gravação */ }
                    if (status == "gravando" && !string.IsNullOrWhiteSpace(eventId))
                    {
                        // fire-and-forget: nunca segura o abrir do stint nem a tela do piloto
                        try { _ = salaVideo.AbrirSalaAsync(dados, ctLive); }
                        catch { /* best-effort */ }
                    }
                };
            }
            catch { aoStint = null; }

            _liveRecorder = new SessionRecorder(new FileSessionStore(pasta), aoStint: aoStint);
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
                _liveGpsPublisher = new GpsLivePublisher(_liveNuvem, canal, permitirProducao: _options.Producao);
                _liveCloudTask = Task.Run(() => LacoNuvemAsync(_liveCts.Token));

                // Visibilidade do canal (lição do bug de 28/06: o .exe sem --producao publicava
                // SILENCIOSAMENTE no canal de teste e o app não recebia). Avisa o operador qual
                // canal está no ar — sem mexer no painel do piloto.
                _liveCanalRotulo = _options.Producao
                    ? "nuvem AO VIVO: PRODUÇÃO (cockpit-bubi-live) — app/Box recebem"
                    : "nuvem AO VIVO: TESTE (cockpit-bubi-dev-teste) — app NÃO recebe; suba com --producao";
                StatusText.Text = _liveCanalRotulo;
                System.Diagnostics.Debug.WriteLine($"[nuvem ao vivo] canal={canal} producao={_options.Producao}");
            }
        }
        catch { _liveNuvem = null; _livePublisher = null; _liveGpsPublisher = null; }

        // Fila resiliente (Fase 4): no INÍCIO do --live, sobe em FUNDO as sessões ENCERRADAS
        // de runs anteriores que ficaram pendentes (rede caiu no fim, app fechou antes, etc.).
        // É o que garante a resiliência entre reinícios: o disco é a verdade (.jsonl sem
        // .uploaded = pendente) e o uploader retoma de onde parou. Não toca a tela do piloto.
        _liveScanTask = VarrerPendentesAsync(_liveCts.Token);

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
                        DispatcherQueue.TryEnqueue(() => StatusText.Text = $"ao vivo: GPS ok; esperando a T4000 (USB) plugar… · {_liveCanalRotulo}");
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
        //    Captura o id ANTES (Encerrar zera a sessão) pra o upload achar o .jsonl.
        string? sessaoFechada = null;
        try { lock (_liveRecLock) { sessaoFechada = _liveRecorder?.SessaoAtualId; _liveRecorder?.Encerrar("fechou-app"); } }
        catch { /* best-effort */ }
        // 1b) Upload durável (Parte B / Fase 4): dispara o p1fast-upload como processo
        //     DESTACADO (sobrevive ao fechamento; nunca trava a tela) pra TODA sessão real,
        //     destino sessao_dumps (a ferramenta SEMPRE sobe pro dump de teste, indepe do
        //     canal AO VIVO). Antes isto era travado em --producao — por isso o fim de
        //     semana (modo teste) não subia sozinho. Agora só exige a chave no ambiente; a
        //     PRODUÇÃO ao vivo (cockpit-bubi-live) segue à parte e só com ordem do Flávio.
        //     Se a rede cair no meio, a varredura de pendentes (no próximo boot) retoma.
        try { DispararUploadFimDeSessao(sessaoFechada); } catch { /* best-effort */ }
        // 2) Cancela laços + aparelhos em FUNDO: o Cancel() roda o teardown do RaceBox
        //    (Stop() do watcher BLE), que pode bloquear alguns segundos numa pilha
        //    Bluetooth fria — não pode travar o fechamento da janela.
        var cts = _liveCts;
        _ = Task.Run(() => { try { cts?.Cancel(); } catch { /* já caindo */ } });
    }

    // Dispara o p1fast-upload (ferramenta SEPARADA, fora do .exe — arquitetura) pra subir
    // a gravação .jsonl recém-fechada pra sessao_dumps. Processo DESTACADO: sobrevive ao
    // fechamento da janela e roda por conta própria; aqui é só "atira e esquece".
    private void DispararUploadFimDeSessao(string? sessaoId)
    {
        if (string.IsNullOrWhiteSpace(sessaoId)) return;
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("P1FAST_SUPABASE_ANON"))) return;

        var pasta = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "p1fast-sessoes");
        var jsonl = Path.Combine(pasta, sessaoId + ".jsonl");
        if (!File.Exists(jsonl)) return;

        var exe = ResolveUploadExe();
        if (exe is null) return;   // sem a ferramenta por perto: desiste (best-effort)

        var psi = new System.Diagnostics.ProcessStartInfo
        {
            FileName = exe,
            UseShellExecute = false,
            CreateNoWindow = true,
            WorkingDirectory = Path.GetDirectoryName(exe)!,
        };
        psi.ArgumentList.Add(jsonl);
        psi.ArgumentList.Add($"--sessao-id={sessaoId}");
        System.Diagnostics.Process.Start(psi);   // destacado: não esperamos o término
    }

    // Acha o p1fast-upload.exe ao lado do repo (dev). Best-effort: null se não existir.
    private string? ResolveUploadExe()
    {
        try
        {
            var root = ResolveRepoRoot();
            foreach (var cfg in new[] { "Debug", "Release" })
            {
                var p = Path.Combine(root, "windows", "cockpit", "P1Fast.Cockpit.Upload",
                                     "bin", cfg, "net8.0", "p1fast-upload.exe");
                if (File.Exists(p)) return p;
            }
        }
        catch { /* best-effort */ }
        return null;
    }

    // Fila resiliente de upload (Fase 4): em FUNDO, sobe as sessões ENCERRADAS pendentes
    // (sem o marcador .uploaded) com retry/backoff. O uploader é resumível+idempotente:
    // a internet da pista cai/volta → ele retoma de onde parou; entre reinícios a verdade
    // é o disco. NÃO mexe na sessão AO VIVO atual (ela sobe no fim, por DispararUpload).
    // Erro aqui NUNCA derruba a tela do piloto. Sem chave ou sem a ferramenta: não faz nada.
    private Task VarrerPendentesAsync(CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("P1FAST_SUPABASE_ANON")))
            return Task.CompletedTask;
        var exe = ResolveUploadExe();
        if (exe is null) return Task.CompletedTask;
        var pasta = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "p1fast-sessoes");

        return Task.Run(async () =>
        {
            // Algumas rodadas com espera crescente entre elas: se a rede está fora agora,
            // tenta de novo daqui a pouco (a pista religa). Marcadores no disco encolhem a
            // fila a cada rodada; quando nada fica pendente, encerra.
            for (int rodada = 0; rodada < 6 && !ct.IsCancellationRequested; rodada++)
            {
                List<SessaoNoDisco> noDisco;
                try { noDisco = LerSessoesDoDisco(pasta); }
                catch { return; }

                string? idAtual;
                lock (_liveRecLock) idAtual = _liveRecorder?.SessaoAtualId;
                var excluir = idAtual is null ? null : new HashSet<string> { idAtual };

                var pend = PendenciasUpload.Selecionar(noDisco, excluir: excluir);
                if (pend.Count == 0) return; // nada pendente: encerra a varredura

                foreach (var id in pend)
                {
                    if (ct.IsCancellationRequested) return;
                    try { await RodarUploadAsync(exe, pasta, id, ct).ConfigureAwait(false); }
                    catch (OperationCanceledException) { return; }
                    catch { /* falhou esta: tenta na próxima rodada (resumível) */ }
                }

                try { await Task.Delay(TimeSpan.FromSeconds(15 * (rodada + 1)), ct).ConfigureAwait(false); }
                catch { return; }
            }
        }, ct);
    }

    // Lê o estado das sessões no disco (id, encerrada?, nº de amostras, já subiu?) pro
    // seletor puro PendenciasUpload decidir o que enfileirar. Meta ausente/ilegível =
    // trata como NÃO encerrada (não sobe). Marcador = <jsonl>.uploaded (escrito pelo uploader).
    private static List<SessaoNoDisco> LerSessoesDoDisco(string pasta)
    {
        var lista = new List<SessaoNoDisco>();
        var dir = new DirectoryInfo(pasta);
        if (!dir.Exists) return lista;
        foreach (var jsonl in dir.GetFiles("*.jsonl"))
        {
            var id = Path.GetFileNameWithoutExtension(jsonl.Name);
            var metaPath = Path.Combine(pasta, id + ".meta.json");
            bool encerrada = false; int n = 0;
            try
            {
                if (File.Exists(metaPath))
                {
                    using var doc = System.Text.Json.JsonDocument.Parse(File.ReadAllText(metaPath));
                    var root = doc.RootElement;
                    encerrada = root.TryGetProperty("Status", out var st)
                                && string.Equals(st.GetString(), "encerrada", StringComparison.Ordinal);
                    int ng = root.TryGetProperty("NGps", out var g) && g.ValueKind == System.Text.Json.JsonValueKind.Number ? g.GetInt32() : 0;
                    int nm = root.TryGetProperty("NMotor", out var m) && m.ValueKind == System.Text.Json.JsonValueKind.Number ? m.GetInt32() : 0;
                    n = ng + nm;
                }
            }
            catch { /* meta ilegível: não-encerrada → não sobe */ }
            bool jaSubida = File.Exists(jsonl.FullName + ".uploaded");
            lista.Add(new SessaoNoDisco(id, encerrada, n, jaSubida));
        }
        return lista;
    }

    // Roda o p1fast-upload pra UMA sessão e ESPERA o término (managed, pra poder retomar).
    // Pula se a sessão já tem o marcador. O exit code não importa aqui: sucesso escreve o
    // marcador (some da fila); falha deixa sem marcador (volta na próxima rodada/boot).
    private static async Task RodarUploadAsync(string exe, string pasta, string sessaoId, CancellationToken ct)
    {
        var jsonl = Path.Combine(pasta, sessaoId + ".jsonl");
        if (!File.Exists(jsonl) || File.Exists(jsonl + ".uploaded")) return;

        var psi = new System.Diagnostics.ProcessStartInfo
        {
            FileName = exe,
            UseShellExecute = false,
            CreateNoWindow = true,
            WorkingDirectory = Path.GetDirectoryName(exe)!,
        };
        psi.ArgumentList.Add(jsonl);
        psi.ArgumentList.Add($"--sessao-id={sessaoId}");
        using var proc = System.Diagnostics.Process.Start(psi);
        if (proc is null) return;
        await proc.WaitForExitAsync(ct).ConfigureAwait(false);
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

        // Nuvem: ENFILEIRA todo fix (o laço da nuvem drena pelo GpsLivePublisher, fila-que-
        // não-perde, e reenvia na religação — o disco acima já guarda TODOS os fixes de
        // qualquer jeito). Chaves EXATAS do cloudSend('gps',…) de web/teste-aparelhos — não
        // quebrar consumidor. (O web amostra a 5 Hz; aqui vai o full 25 Hz, agora SEM perder fix.)
        if (_liveNuvem is not null)
            _liveCloudGps.Enqueue(new Dictionary<string, object?>
            {
                ["lat"]   = f.Lat,
                ["lng"]   = f.Lng,
                ["kmh"]   = f.Kmh,
                ["numSV"] = f.NumSV,
                ["fix"]   = f.Fix,
                ["accM"]  = f.HaccM,
                ["tWall"] = tWall,
            });

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
        var gpsPub = _liveGpsPublisher!;
        try { await nuvem.ConnectAsync(ct).ConfigureAwait(false); } catch { /* religa abaixo */ }
        long ultimaTentativa = Environment.TickCount64;
        try
        {
            while (!ct.IsCancellationRequested)
            {
                // 1) Motor + GPS: passa pros publishers tudo o que chegou (cada um com sua
                //    fila-que-não-perde; o motor estrangula a 5 Hz, o GPS é lossless a 25 Hz).
                while (_liveCloudMotor.TryDequeue(out var item))
                    pub.Oferecer(item.s, item.tWall);
                while (_liveCloudGps.TryDequeue(out var fix))
                    gpsPub.Oferecer(fix);

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

                // 3) Drena motor E GPS (cada um reenvia TODO o acumulado quando a nuvem volta).
                try { await pub.DrenarAsync(ct).ConfigureAwait(false); }
                catch (OperationCanceledException) { break; }
                catch { /* erro de envio: segura na fila, tenta no próximo giro */ }

                try { await gpsPub.DrenarAsync(ct).ConfigureAwait(false); }
                catch (OperationCanceledException) { break; }
                catch { /* erro de envio: segura na fila, tenta no próximo giro */ }

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
