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
    private Task? _planoStintTask;   // barra de voltas: 1ª leitura REST do plano real do piloto (etapa 3), em fundo
    private RaceBoxBleReader? _raceBox;
    private bool _liveParado;        // guarda de fechamento (StopLive idempotente)

    // Filtro de GPS pro CÉREBRO (H3): a MESMA peça do replay (qualidade hacc/caixa + decimação
    // por movimento). O disco e a nuvem recebem TODOS os fixes crus; só o maestro recebe o
    // fluxo filtrado — senão fix impreciso/jitter parado gera curva/ápice/freada falsos.
    private readonly GpsFiltroAoVivo _gpsFiltro = new();

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

    // Liga o cockpit ao vivo: carrega as curvas fora da thread da UI e religa o
    // maestro + leitor na thread da UI. (A porta COM é resolvida POR TENTATIVA no
    // supervisor do motor — L3 —, não mais aqui no boot.)
    private void StartLive()
    {
        _statusVivo = "ao vivo: procurando T4000…";   // 2.3: região efêmera, composta com o resto
        RenderStatus();

        // Fechamento limpo assinado JÁ na thread da UI (M6): se a janela fechar antes do
        // IniciarLive assíncrono rodar, StopLive ainda encerra a sessão e cancela os laços —
        // sem deixar sessão órfã nem threads soltas numa corrida de boot.
        this.Closed += (_, _) => StopLive();

        _ = System.Threading.Tasks.Task.Run(async () =>
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

            // Fase 2 item 4 (tela Garagem): limites de alerta DESTE carro, da nuvem (best-effort,
            // timeout curto). Sem chave/rede/override → defaults do sistema (idêntico a hoje).
            var (al, ap) = await BuscarLimitesDoCarroAsync(CancellationToken.None).ConfigureAwait(false);
            return (segs, al, ap);
        }).ContinueWith(t =>
        {
            var (segs, al, ap) = t.Result;
            DispatcherQueue.TryEnqueue(() => IniciarLive(segs, al, ap));
        });
    }

    private void IniciarLive(IReadOnlyList<TrechoSegmento> segs,
        AlertaLimites? alertaLimites = null, AprendizadoLimites? aprendizadoLimites = null)
    {
        // M6: se a janela já fechou enquanto este IniciarLive estava enfileirado, aborta —
        // não cria recorder/RaceBox/laços numa janela morta (que ficariam órfãos e sem monitor).
        if (_liveParado) return;

        IniciarFeedReal(segs, alertaLimites, aprendizadoLimites);  // timers off + cria _orquestrador com os limites do carro
        CarregarAprendizado();    // Fase 2: restaura a máxima normal do carro (memória entre sessões)
        CarregarLuzMarcha();      // Onda 7: restaura a reação por marcha (antecipação da luz) do carro
        AtualizarSensores(null);  // motor sem amostra ainda → tudo "a comunicar"

        _liveCts = new CancellationTokenSource();

        // Gravação local blindada (fonte da verdade), ANTES da nuvem. Best-effort:
        // falha de IO não derruba a tela do piloto.
        try
        {
            var pasta = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "p1fast-sessoes");
            // M5 (decisão Flávio 2026-07-03): captura AUTOMÁTICA por movimento — grava quando o
            // carro ANDA (>=15 km/h) e fecha quando fica PARADO (~12 s no box). 1 sessão = 1 ida
            // à pista; o motor em marcha lenta no box NÃO abre nem segura a gravação (só o GPS).
            _liveRecorder = new SessionRecorder(new FileSessionStore(pasta), auto: new AutoCaptura());
            // H1: sessões que ficaram 'gravando' (queda de energia/crash sem fechar) viram
            // 'interrompida' AGORA, ANTES de qualquer amostra nova — assim a fila de upload as
            // pega. Sem isto, o dado gravado à prova de queda nunca chegava no app/Command Box.
            try { _liveRecorder.RecuperarOrfas(); } catch { /* best-effort */ }
        }
        catch { _liveRecorder = null; }

        // Nuvem ao vivo (C5): liga SÓ se a chave estiver no ambiente (peça ao Flávio).
        // Sem chave, segue 100% local — o gravador blindado acima é a durabilidade.
        // Canal de TESTE por padrão; a redundância nunca derruba a tela do piloto.
        try
        {
            var anon = Environment.GetEnvironmentVariable("P1FAST_SUPABASE_ANON");
            if (string.IsNullOrWhiteSpace(anon))
            {
                // 2.5 — sem a chave, NENHUM publisher nasce: o --live roda 100% LOCAL. Antes
                // isso era SILENCIOSO (modo de falha do bug de campo de 28/06 por outra porta).
                // Agora vira aviso VISÍVEL e persistente no status — mais duro com --producao,
                // que pediu nuvem e não terá efeito nenhum.
                _liveCanalRotulo = _options.Producao
                    ? "SEM NUVEM — falta P1FAST_SUPABASE_ANON (--producao SEM efeito; 100% local)"
                    : "SEM NUVEM — falta P1FAST_SUPABASE_ANON (100% local; app não recebe)";
                _statusCanal = _liveCanalRotulo;
                RenderStatus();
            }
            else
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
                // 2.3 — o rótulo do canal é uma REGIÃO persistente do status (não mais escrito
                // cru em StatusText.Text, que o diagnóstico a 10-25 Hz apagava).
                _statusCanal = _liveCanalRotulo;
                RenderStatus();
                System.Diagnostics.Debug.WriteLine($"[nuvem ao vivo] canal={canal} producao={_options.Producao}");
            }
        }
        catch { _liveNuvem = null; _livePublisher = null; _liveGpsPublisher = null; }

        // BARRA DE VOLTAS — plano REAL do piloto (etapa 3, Flávio 2026-07-04): a PRIMEIRA
        // leitura REST do .exe. Best-effort TOTAL, fora da thread da UI, nunca bloqueia o boot:
        // sem chave/rede/plano-do-dia, a barra fica no placeholder (idêntica a hoje). Mesma env
        // P1FAST_SUPABASE_ANON da nuvem; carro_id = --carro-id ou Bubi (default).
        CarregarPlanoStintReal(_liveCts.Token);

        // Fila resiliente (Fase 4): no INÍCIO do --live, sobe em FUNDO as sessões ENCERRADAS
        // de runs anteriores que ficaram pendentes (rede caiu no fim, app fechou antes, etc.).
        // É o que garante a resiliência entre reinícios: o disco é a verdade (.jsonl sem
        // .uploaded = pendente) e o uploader retoma de onde parou. Não toca a tela do piloto.
        _liveScanTask = VarrerPendentesAsync(_liveCts.Token);

        // GPS ao vivo: RaceBox Mini por Bluetooth — INDEPENDE da T4000. Best-effort:
        // sem RaceBox, segue varrendo; sem GPS a tela mostra o motor mesmo assim.
        _raceBox = new RaceBoxBleReader(OnLiveGps, txt => DispatcherQueue.TryEnqueue(() => { _statusVivo = txt; RenderStatus(); }));
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
            // L3: re-resolve a COM a CADA tentativa (antes era 1× no boot) — se a T4000
            // enumerar como serial só depois de energizada, a contingência COM aparece
            // sem reiniciar o app. --port explícito continua mandando.
            var comPort = ResolveLivePort(_options.Port);
            bool win = false;
            try { win = WinUsbT3000Channel.Present(); } catch { win = false; }
            if (win && comPort is not null)
            {
                // WinUSB com a serial de RESERVA: se o WinUSB nao ABRIR, cai pra COM.
                fonte = $"T4000 (WinUSB, COM {comPort} de reserva)";
                return new FallbackT3000UsbChannel(new WinUsbT3000Channel(), () => new LiveUsbChannel(comPort));
            }
            if (win) { fonte = "T4000 (WinUSB)"; return new WinUsbT3000Channel(); }
            if (comPort is not null) { fonte = $"T4000 (COM {comPort})"; return new LiveUsbChannel(comPort); }
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
                        // 2.3 — status efêmero na sua região (o canal é região à parte, não
                        // mais concatenado aqui; a composição junta os dois sem se apagarem).
                        DispatcherQueue.TryEnqueue(() => { _statusVivo = "ao vivo: GPS ok; esperando a T4000 (USB) plugar…"; RenderStatus(); });
                    }
                    try { await Task.Delay(1500, ct).ConfigureAwait(false); } catch { break; }
                    continue;
                }
                avisouEsperando = false;
                DispatcherQueue.TryEnqueue(() => { _statusVivo = $"ao vivo: {fonte} + GPS RaceBox…"; RenderStatus(); });

                var reader = new T3000UsbLiveReader(
                    canal,
                    onSample: OnLiveMotor,
                    onStatus: (txt, nivel) => DispatcherQueue.TryEnqueue(() => { _statusVivo = $"ao vivo [{nivel}]: {txt}"; RenderStatus(); }),
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
                    string? alarme;
                    lock (_liveRecLock) { _liveRecorder?.Tick(); alarme = _liveRecorder?.Estado().Alarme; }
                    // Silêncio das fontes (só depois de a fonte ter vivido — não no boot antes
                    // de plugar): motor sem amostra há >=3 s, GPS sem fix há >=5 s.
                    var agora = Environment.TickCount64;
                    var motorMudo = _ultimoMotorTick > 0 && agora - _ultimoMotorTick >= 3000;
                    var gpsMudo   = _ultimoGpsTick   > 0 && agora - _ultimoGpsTick   >= 5000;
                    // Re-avalia os sensores ~1 Hz mesmo SEM amostra nova: se motor e/ou GPS
                    // pararem, os LEDs degradam (apagam) em vez de congelar verdes. O live é
                    // event-driven; sem este tick, no silêncio total nada mais re-pintaria.
                    DispatcherQueue.TryEnqueue(() =>
                    {
                        // H2 + M1: fonte que emudeceu não deixa GRAVE congelado na tela — limpa
                        // o alerta órfão do motor e mostra SEM DADOS / SEM GPS honestos.
                        _orquestrador?.VigiarFontes(motorMudo, gpsMudo);
                        AtualizarSensores(_ultimaAlerta);
                        AtualizarTelaTermica();   // ~1 Hz: a água muda devagar, mas a tela térmica acompanha
                        // H6: perda de gravação NUNCA silenciosa — o alarme do gravador (disco
                        // cheio/morto) aparece no status (sem tocar o layout aprovado). 2.3: é
                        // REGIÃO própria e persistente (não some com o diagnóstico a 10-25 Hz) e
                        // se LIMPA quando o alarme cessa — antes ficava concatenado e piscava.
                        _statusAlarme = alarme is not null ? $"GRAVACAO com perda: {alarme}" : "";
                        RenderStatus();
                    });
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
        // 0) Fase 2: grava a máxima normal aprendida NESTA sessão (memória do carro pra a
        //    próxima). Antes de tudo (rápido, síncrono) — best-effort, não trava o fechamento.
        SalvarAprendizado();
        SalvarLuzMarcha();     // Onda 7: grava a reação por marcha aprendida NESTA sessão (memória do carro)
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
        // 1c) Fila de FIM DE APP (2026-07-09): o dia pode ter deixado VÁRIAS sessões fechadas
        //     pela captura automática (3 stints) ainda não subidas — se o app fecha com o carro
        //     parado, SessaoAtualId é null e, sem isto, nada delas subia até o PRÓXIMO boot.
        //     Varre TODAS as pendentes (mesma seleção do boot) e dispara upload destacado de cada.
        try { DispararUploadPendentesFimDeApp(sessaoFechada); } catch { /* best-effort */ }
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

    // Fim de app: dispara upload DESTACADO de TODAS as sessões pendentes no disco (não só a
    // recém-fechada). Mesma seleção do boot (PendenciasUpload): fechada + não-subida + com
    // conteúdo. Exclui a que já foi disparada por DispararUploadFimDeSessao (evita processo
    // dobrado; o upload é idempotente de qualquer forma). Síncrono e rápido — só lê metadados
    // e atira processos, nunca trava o fechamento da janela. Sem chave/ferramenta: não faz nada.
    private void DispararUploadPendentesFimDeApp(string? jaDisparada)
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("P1FAST_SUPABASE_ANON"))) return;
        if (ResolveUploadExe() is null) return;
        var pasta = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "p1fast-sessoes");
        List<SessaoNoDisco> noDisco;
        try { noDisco = LerSessoesDoDisco(pasta); } catch { return; }
        var excluir = string.IsNullOrWhiteSpace(jaDisparada) ? null : new HashSet<string> { jaDisparada! };
        var pend = PendenciasUpload.Selecionar(noDisco, excluir: excluir);
        foreach (var id in pend)
            try { DispararUploadFimDeSessao(id); } catch { /* best-effort: segue as outras */ }
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
                    // H1: 'encerrada' (fim normal) E 'interrompida' (órfã recuperada de uma queda)
                    // sobem — ambas são sessões fechadas com dado durável. Só 'gravando' não.
                    var status = root.TryGetProperty("Status", out var st) ? st.GetString() : null;
                    encerrada = string.Equals(status, "encerrada", StringComparison.Ordinal)
                                || string.Equals(status, "interrompida", StringComparison.Ordinal);
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

        // Nuvem DESACOPLADA do disco (2026-07-09): o app/Command Box recebem TODA amostra do
        // motor, mesmo quando o gravador NÃO gravou este sample — carro parado no box/aquecimento
        // (captura automática em espera, Motor() devolve null) ou gravador que falhou ao criar.
        // Antes o gate era `reg is not null` e o box/aquecimento nunca subia (o GPS já não tinha
        // esse gate — prova de que era acidente). tWall = tempo de CAPTURA: usa o do registro
        // quando gravou (casa 1:1 com o disco/vídeo), senão o relógio de parede AGORA (mesma
        // base epoch-ms do gravador) — ordena certo e casa com o vídeo do mesmo jeito.
        if (_livePublisher is not null)
        {
            long tWallMotor = reg?.TWall ?? DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            _liveCloudMotor.Enqueue((s, tWallMotor));
        }

        var (rpm, alerta) = BridgeMotor(s);
        DispatcherQueue.TryEnqueue(() =>
        {
            // TMono é ms (Stopwatch do leitor); o contrato do maestro é SEGUNDOS (histerese 2b
            // do óleo/rica + Onda 7). Converte na fiação — igual ao replay (TWallMs / 1000.0).
            _orquestrador?.IngestMotor(rpm, alerta, s.TMono / 1000.0);   // TMono ms → s (relógio da histerese 2b/Onda 7)
            _ultimaAlerta = alerta;      // guarda pro refresh de sensores quando vier GPS
            AtualizarSensores(alerta);
        });
    }

    // Cada fix do GPS (vem na thread do BLE): grava em disco e move a tela (curva/
    // ápice/delta/freada). Só fix 3D entra — fix fraco não envenena o detector.
    private void OnLiveGps(RaceBoxFix f)
    {
        if (f.Fix < 3) return;
        // 5.3a: usa o carimbo JÁ espaçado por frame (pelo iTOW no RaceBoxBleReader). Assim,
        // vários fixes de um mesmo notify BLE não colam no mesmo ms (dt~0 → km/h absurdo no
        // cérebro). Fallback pra chegada só se o espaçador não informou (TWallMs == 0).
        long tWall = f.TWallMs > 0 ? f.TWallMs : DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        lock (_liveRecLock)
            _liveRecorder?.Gps(
                // gx/gy/gz = aceleração crua do RaceBox (g), gravada pro dia de bancada calibrar
                // o eixo + verificar os offsets. Ainda não alimenta a lógica da tela.
                new { lat = f.Lat, lon = f.Lng, kmh = f.Kmh, fix = f.Fix, numSV = f.NumSV, hacc = f.HaccM,
                      gx = f.GX, gy = f.GY, gz = f.GZ },
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
                ["gx"]    = f.GX,   // aceleração crua do RaceBox (g) — chaves NOVAS, aditivas (bancada)
                ["gy"]    = f.GY,
                ["gz"]    = f.GZ,
                ["tWall"] = tWall,
            });

        // Move a tela na thread da UI, EM ORDEM: GPS no maestro → ponte do stint (barra
        // de trechos) → sensores (MOVIMENTO acende). _ultimoGpsTick marca a chegada em
        // tempo real (pro sensor de GPS). Antes só o replay fazia essas pontes.
        _ultimoGpsTick = Environment.TickCount64;   // sinal de GPS presente (LED do sensor)

        // Cérebro: SÓ o fluxo FILTRADO (H3) — qualidade (hacc<50 + caixa de Brasília) + movimento
        // (>=3 m), a MESMA peça que o replay usa. O disco e a nuvem acima já guardaram TODOS os
        // fixes crus; só o maestro recebe o filtrado, pra fix impreciso/jitter parado não gerar
        // curva/ápice/freada falsos na tela do piloto.
        var cerebro = _gpsFiltro.Aceitar(f.Lat, f.Lng, f.Fix, f.HaccM, tWall, f.HeadingDeg, f.GX, f.GY, f.GZ);
        DispatcherQueue.TryEnqueue(() =>
        {
            if (cerebro is not null)
            {
                _orquestrador?.IngestGps(cerebro);
                AtualizarStint();
                RegistrarCruzamentoLive(cerebro.Lat, cerebro.Lng);   // etapa 4: halo da volta atual ao vivo
            }
            AtualizarSensores(_ultimaAlerta);
            AtualizarTelaTermica();   // telas dedicadas de aquecimento/resfriamento (Flávio 2026-07-06)
        });
    }

    // Barra de voltas — carrega o plano REAL do piloto da nuvem (etapa 3, Flávio 2026-07-04)
    // e, se veio o plano do DIA, repinta a barra com ele (senão fica no placeholder). É a
    // ÚNICA leitura REST do .exe (PlanoStintReader) — antes ele só publicava. Roda FORA da
    // thread da UI e é best-effort total: qualquer falha vira placeholder, o boot nunca quebra.
    // Só ENFILEIRA a repintura na thread da UI (AplicarPlanoStintReal); nada de tela direto aqui.
    private void CarregarPlanoStintReal(CancellationToken ct)
    {
        _planoStintTask = System.Threading.Tasks.Task.Run(async () =>
        {
            try
            {
                using var http = new System.Net.Http.HttpClient { Timeout = TimeSpan.FromSeconds(8) };
                var leitor = PlanoStintReader.DoAmbiente(http, log: txt => System.Diagnostics.Debug.WriteLine(txt));
                if (leitor is null) return; // sem chave → barra no placeholder (100% local)

                var carroId = string.IsNullOrWhiteSpace(_options.CarroId)
                    ? PlanoStintReader.CarroIdBubi
                    : _options.CarroId!;
                var barra = await leitor.BuscarBarraAsync(carroId, BarMaxSlots, ct).ConfigureAwait(false);
                if (barra is null) return; // sem plano do dia → placeholder

                var blocos = Array.ConvertAll(barra, BlockDoTipoVolta);
                DispatcherQueue.TryEnqueue(() => AplicarPlanoStintReal(blocos));
            }
            catch { /* best-effort: barra fica no placeholder, boot nunca quebra */ }
        }, ct);
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
    // L6: delega pro mapeamento CANÔNICO do Domain (CapturaDiaDePista.AlertaDeSample) —
    // era duplicado aqui e a cópia de lá divergia (pedal em vez de TPS, sem guarda M3,
    // sem alarmes de combustível). Uma ponte só: mudou o mapeamento, mudou pros dois.
    private static (double rpm, AmostraAlerta alerta) BridgeMotor(T3000Sample s)
        => (s.Rpm, CapturaDiaDePista.AlertaDeSample(s));

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
