// SessionRecorder — GRAVAÇÃO LOCAL BLINDADA da sessão no .exe do notebook (Fase 2).
//
// Resolve a causa-raiz da auditoria de 20/06: no caminho do notebook não havia
// NADA que GRAVASSE a sessão decodificada — o dado só passava ao vivo e morria.
// Aqui cada amostra (motor T3000, GPS, evento) é gravada APPEND-ONLY em disco,
// ANTES e INDEPENDENTE da nuvem, do liga ao desliga do carro. Princípios
// ADR-003/004: fonte da verdade local durante a sessão; append-only (só
// acrescenta, nunca apaga a série crua); fora da fila de envio.
//
// Port FIEL do gravador provado em campo (web/cockpit/session-recorder.js, 43
// testes): mesmos contadores, mesmas lacunas, MESMO alarme de saúde
// ('parada-armazenamento' / 'perdendo-amostras') — perda NUNCA silenciosa.
//
// DESENHO PARA TESTE: a lógica viva está em SessionRecorder, que recebe um
// ISessionStore injetável. Em disco real usa FileSessionStore (System.IO puro,
// sem dependência de Windows — roda e é provado aqui fora do carro). Nos testes,
// um store de memória ou um store que falha de propósito.

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text.Json;

namespace P1Fast.Cockpit.Domain;

/// <summary>Metadado de uma sessão gravada.</summary>
public sealed record SessionMeta(string Id, long InicioWall, bool Sim, string Status);

/// <summary>Um registro append-only. Dados = payload decodificado (motor/gps/evento).
/// TWall = carimbo de tempo da CAPTURA (epoch ms), separado do tempo de envio.</summary>
public sealed class SessionRecord
{
    public string SessaoId { get; init; } = "";
    public long Seq { get; init; }
    public string Tipo { get; init; } = "";   // "t4000" | "gps" | "evento"
    public long TWall { get; init; }
    public long TMono { get; init; }
    public object? Dados { get; init; }
    public string? RawHex { get; init; }
}

/// <summary>Resumo de fechamento de uma sessão.</summary>
public sealed class SessionResumo
{
    public string Id { get; init; } = "";
    public bool Sim { get; init; }
    public string Status { get; init; } = "encerrada";
    public string MotivoFim { get; init; } = "manual";
    public long InicioWall { get; init; }
    public long FimWall { get; init; }
    public double DuracaoS { get; init; }
    public int NGps { get; init; }
    public int NMotor { get; init; }
    public int Dropped { get; init; }
    public long MaiorLacunaMs { get; init; }
}

/// <summary>Resumo parcial sem materializar todas as amostras (sessão de pista tem milhares).</summary>
public sealed record SessionResumoParcial(int NGps, int NMotor, long DurMs, long InicioWall, long FimWall);

/// <summary>Estado vivo da gravação — pra tela mostrar, NUNCA silencioso.</summary>
public sealed record SessionEstado(
    bool Gravando,
    string? SessaoId,
    bool Sim,
    double TempoS,
    int NGps,
    int NMotor,
    double HzGps,
    double HzMotor,
    int Lacunas,
    bool Ativo,
    int Dropped,
    string? Alarme,
    double VelKmh = 0,        // velocidade do GPS (km/h) — pra tela e pro liga/desliga por movimento
    bool Auto = false,        // captura automática por movimento está ligada?
    long? GpsHaMs = null);    // há quanto tempo (ms) chegou o último GPS; null = nunca chegou

/// <summary>Onde a sessão é persistida. Gravar() é append-only e LANÇA em falha de
/// I/O — o recorder transforma a falha em alarme visível.</summary>
public interface ISessionStore
{
    void NovaSessao(SessionMeta meta);
    void Gravar(SessionRecord registro);                 // append-only; LANÇA em falha
    void Finalizar(string id, SessionResumo resumo);
    SessionResumoParcial ResumirSessao(string id);
    IReadOnlyList<SessionMeta> ListarSessoes();
    IReadOnlyList<SessionRecord> LerSessao(string id);   // replay / conferência pós-sessão
}

/// <summary>Config da captura AUTOMÁTICA por movimento (pista x box). Passe ao
/// recorder pra ligar o liga/desliga sozinho; sem ela, o gravador se comporta como
/// sempre (abre no 1º dado, fecha por silêncio). Valores em km/h e ms.</summary>
public sealed record AutoCaptura(
    double VOn = SessionRecorder.AutoVOnKmh,
    double VOff = SessionRecorder.AutoVOffKmh,
    int ParadoMs = SessionRecorder.AutoParadoMs);

public sealed class SessionRecorder
{
    // Silêncio (sem GPS nem motor) acima disto = carro desligado.
    public const int SilencioFimMs = 8000;
    // Buraco dentro da sessão acima disto vira "lacuna" registrada (honestidade:
    // notebook dormindo não finge continuidade — o intervalo fica marcado).
    public const int LacunaMinMs = 2000;

    // Captura AUTOMÁTICA por movimento (sem botão): grava quando o carro ANDA (pista)
    // e para quando fica PARADO (box). Só liga quando se passa um AutoCaptura ao
    // construtor; sem ele, o comportamento é o de sempre (abre no 1º dado, fecha por
    // silêncio). Em km/h e ms — defaults sensatos, a calibrar na pista.
    public const double AutoVOnKmh   = 15;     // andou acima disto => abre (entrou na pista)
    public const double AutoVOffKmh  = 6;      // abaixo disto = parado
    public const int    AutoParadoMs = 12000;  // parado por tanto tempo => fecha (entrou no box)

    private readonly ISessionStore _store;
    private readonly Func<double> _now;     // relógio monotônico (ms)
    private readonly Func<long> _wall;      // relógio de parede (epoch ms) = tCapture
    private readonly Func<string> _gerarId;
    private readonly Action<SessionEstado, string>? _onEstado;
    private readonly int _silencioMs;
    private readonly AutoCaptura? _auto;

    private (string Id, long InicioWall, double InicioMono, bool Sim)? _sessao;
    private long _seq;
    private int _nGps, _nMotor, _dropped, _okWrites;
    private bool _storeMorto;
    private double _ultimoMono, _ultimoGpsMono, _ultimoMotorMono;
    private double _velAtual;               // km/h da última amostra de GPS (auto por movimento)
    private double _ultimoMovimentoMono;    // quando o carro esteve acima de VOff pela última vez
    private double _ultimoGpsQualquerMono;  // chegada de QUALQUER GPS (mesmo parado) — pra tela saber se há sinal
    private bool _algumGps;                 // já chegou algum GPS? (pra gpsHaMs não mentir no boot)
    private readonly List<double> _janGps = new();
    private readonly List<double> _janMotor = new();
    private readonly List<long> _lacunas = new();

    public SessionRecorder(
        ISessionStore store,
        Func<double>? now = null,
        Func<long>? wall = null,
        Func<string>? gerarId = null,
        Action<SessionEstado, string>? onEstado = null,
        int silencioMs = SilencioFimMs,
        AutoCaptura? auto = null)
    {
        ArgumentNullException.ThrowIfNull(store);
        _store = store;
        if (now is not null) _now = now;
        else { var sw = Stopwatch.StartNew(); _now = () => sw.Elapsed.TotalMilliseconds; }
        _wall = wall ?? (() => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
        // Opção A (Flávio 2026-07-01): o id da sessão/stint É um UUID gerado AQUI, na captura.
        // É o sessao_id ÚNICO que atravessa tudo — .jsonl local, upload pro sessao_dumps, ponteiro
        // sessao-corrente.json do vídeo, e as tabelas sessoes/video_streams na nuvem (Postgres uuid
        // aceita direto). Cada Abrir() (carro começou a andar) = 1 stint = 1 UUID novo.
        // Contrato: docs/CONTRATO_VIDEO_GRAVACAO.md (5 formatos).
        _gerarId = gerarId ?? (() => Guid.NewGuid().ToString());
        _onEstado = onEstado;
        _silencioMs = silencioMs;
        _auto = auto;
    }

    public bool Ativo => !_storeMorto;
    public bool Gravando => _sessao is not null;
    /// <summary>Id da sessão aberta agora (null se nenhuma). Pro .exe achar o .jsonl
    /// recém-fechado e disparar o upload durável no fim (capture ANTES de Encerrar).</summary>
    public string? SessaoAtualId => _sessao?.Id;
    /// <summary>Por que a última sessão fechou ("parado" = entrou no box, "silencio" =
    /// carro desligou, "manual"). Pra tela mostrar e pros testes conferirem.</summary>
    public string? MotivoUltimoFim { get; private set; }

    private static double TaxaHz(List<double> janela, double agora)
    {
        while (janela.Count > 0 && agora - janela[0] > 5000) janela.RemoveAt(0);
        return janela.Count / 5.0;
    }

    private void Abrir(bool sim)
    {
        var id = _gerarId();
        _sessao = (id, _wall(), _now(), sim);
        _seq = 0; _nGps = 0; _nMotor = 0; _dropped = 0;
        _janGps.Clear(); _janMotor.Clear(); _lacunas.Clear();
        _ultimoMono = _ultimoGpsMono = _ultimoMotorMono = _now();
        try { _store.NovaSessao(new SessionMeta(id, _sessao.Value.InicioWall, sim, "gravando")); } catch { /* best-effort */ }
        _onEstado?.Invoke(Estado(), "inicio");
    }

    private void MarcarLacuna(double agora)
    {
        double desde = _ultimoMono;
        if (_sessao is not null && agora - desde >= LacunaMinMs)
            _lacunas.Add((long)Math.Round(agora - desde));
    }

    private SessionRecord? Gravar(string tipo, object? dados, string? rawHex, bool sim, double? velKmh = null)
    {
        double agora = _now();
        if (tipo == "gps") { _algumGps = true; _ultimoGpsQualquerMono = agora; }

        // ── Captura AUTOMÁTICA por movimento (sem botão): abre quando o carro começa a
        //    andar (pista) e fecha quando fica parado (box). Só com _auto; sem ela, o
        //    fluxo é o de sempre. O motor (marcha lenta no box) NÃO abre nem segura a
        //    gravação — só o movimento do GPS manda.
        if (_auto is not null)
        {
            if (tipo == "gps")
            {
                double? v = velKmh ?? (dados is AmostraGps ag ? ag.Kmh : (double?)null);
                if (v is double vv)
                {
                    _velAtual = vv;
                    if (_velAtual >= _auto.VOff) _ultimoMovimentoMono = agora;
                }
            }
            if (_sessao is null)
            {
                // EM ESPERA (box/parado): só começa a gravar quando o carro anda
                if (!(tipo == "gps" && _velAtual >= _auto.VOn)) { _onEstado?.Invoke(Estado(), "espera"); return null; }
            }
            else if (agora - _ultimoMovimentoMono >= _auto.ParadoMs)
            {
                // parado tempo suficiente => entrou no box: fecha a sessão (dado preservado)
                Encerrar("parado");
                return null;
            }
        }

        if (_sessao is null) Abrir(sim);   // primeiro dado = carro ligou (ou começou a andar)
        else MarcarLacuna(agora);          // buraco dentro da sessão fica registrado

        var reg = new SessionRecord
        {
            SessaoId = _sessao!.Value.Id,
            Seq = ++_seq,
            Tipo = tipo,
            TWall = _wall(),
            TMono = (long)Math.Round(agora),
            Dados = dados,
            RawHex = rawHex,
        };

        // append-only; falha de escrita conta como DESCARTADA (visível, nunca silenciosa).
        // 50 falhas sem 1 sucesso => armazenamento morto (o chamador pode parar de gastar).
        try { _store.Gravar(reg); _okWrites++; }
        catch { _dropped++; if (_okWrites == 0 && _dropped >= 50) _storeMorto = true; }

        _ultimoMono = agora;
        if (tipo == "gps") { _nGps++; _ultimoGpsMono = agora; _janGps.Add(agora); }
        else if (tipo == "t4000") { _nMotor++; _ultimoMotorMono = agora; _janMotor.Add(agora); }
        return reg;
    }

    /// <summary>Grava uma amostra de motor (T3000) decodificada. Retorna null se a
    /// captura automática estiver em espera (carro parado no box) — o motor não abre
    /// nem segura a gravação sozinho.</summary>
    public SessionRecord? Motor(T3000Sample sample, string? rawHex = null, bool? simOverride = null)
    {
        bool sim = simOverride ?? (sample?.Source == "sim-replay");
        return Gravar("t4000", sample, rawHex, sim);
    }

    /// <summary>Grava um ponto de GPS cru (taxa de chegada), na mesma sessão/relógio.
    /// Passe velKmh quando souber a velocidade (ou um AmostraGps, de onde ela é lida)
    /// pra a captura automática por movimento funcionar. Retorna null em espera/box.</summary>
    public SessionRecord? Gps(object decoded, string? rawHex = null, bool sim = false, double? velKmh = null)
        => Gravar("gps", decoded, rawHex, sim, velKmh);

    /// <summary>Grava um evento (ex.: passou no box, marcou volta), na mesma sessão.</summary>
    public SessionRecord? Evento(string nome, object? dados = null, bool sim = false)
        => Gravar("evento", new { nome, dados }, null, sim);

    /// <summary>Vigia do fim: chamar ~1x/s. Sem dado há silencioMs => carro desligou.
    /// Com captura automática, também fecha se ficou parado tempo demais (entrou no box).</summary>
    public SessionResumo? Tick()
    {
        if (_sessao is null) { if (_auto is not null) _onEstado?.Invoke(Estado(), "espera"); return null; }
        if (_now() - _ultimoMono >= _silencioMs) return Encerrar("silencio");
        if (_auto is not null && _now() - _ultimoMovimentoMono >= _auto.ParadoMs) return Encerrar("parado");
        _onEstado?.Invoke(Estado(), "tick");
        return null;
    }

    public SessionResumo? Encerrar(string motivo = "manual")
    {
        if (_sessao is null) return null;
        MotivoUltimoFim = motivo;
        var s = _sessao.Value;
        double durMs = _ultimoMono - s.InicioMono;
        var resumo = new SessionResumo
        {
            Id = s.Id,
            Sim = s.Sim,
            Status = "encerrada",
            MotivoFim = motivo,
            InicioWall = s.InicioWall,
            FimWall = _wall(),
            DuracaoS = Math.Round(durMs / 100) / 10,
            NGps = _nGps,
            NMotor = _nMotor,
            Dropped = _dropped,
            MaiorLacunaMs = _lacunas.Count > 0 ? _lacunas.Max() : 0,
        };
        try { _store.Finalizar(s.Id, resumo); } catch { /* best-effort */ }
        _sessao = null;
        _onEstado?.Invoke(Estado(), "fim");
        return resumo;
    }

    private string? Alarme()
    {
        if (_storeMorto) return "parada-armazenamento";  // nada mais grava → perda total daqui pra frente
        if (_dropped > 0) return "perdendo-amostras";     // alguma escrita falhou → perda parcial
        return null;
    }

    public SessionEstado Estado()
    {
        long? gpsHa = _algumGps ? (long)Math.Round(_now() - _ultimoGpsQualquerMono) : null;
        if (_sessao is null)
            return new SessionEstado(false, null, false, 0, _nGps, _nMotor, 0, 0, 0, !_storeMorto, _dropped, Alarme(),
                                     VelKmh: Math.Round(_velAtual), Auto: _auto is not null, GpsHaMs: gpsHa);
        var s = _sessao.Value;
        double agora = _now();
        return new SessionEstado(
            Gravando: true,
            SessaoId: s.Id,
            Sim: s.Sim,
            TempoS: Math.Round((agora - s.InicioMono) / 100) / 10,
            NGps: _nGps,
            NMotor: _nMotor,
            HzGps: Math.Round(TaxaHz(_janGps, agora) * 10) / 10,
            HzMotor: Math.Round(TaxaHz(_janMotor, agora) * 10) / 10,
            Lacunas: _lacunas.Count,
            Ativo: !_storeMorto,
            Dropped: _dropped,
            Alarme: Alarme(),
            VelKmh: Math.Round(_velAtual),
            Auto: _auto is not null,
            GpsHaMs: gpsHa);
    }

    /// <summary>Replay/conferência: devolve todos os registros gravados de uma sessão.</summary>
    public IReadOnlyList<SessionRecord> ExportarSessao(string id) => _store.LerSessao(id);
    public IReadOnlyList<SessionMeta> ListarSessoes() => _store.ListarSessoes();

    /// <summary>Recuperação de órfãs: chamar no boot, ANTES de qualquer dado novo. Acha
    /// sessões que ficaram 'gravando' (notebook dormiu/caiu sem fechar) e as marca
    /// 'interrompida' — o dado nunca se perde (é append-only), isto só devolve o acesso.</summary>
    public IReadOnlyList<SessionResumo> RecuperarOrfas()
    {
        var orfas = new List<SessionResumo>();
        foreach (var s in _store.ListarSessoes())
        {
            if (s.Status != "gravando") continue;
            var r = _store.ResumirSessao(s.Id);
            long durMs = r.DurMs;
            var resumo = new SessionResumo
            {
                Id = s.Id,
                Sim = s.Sim,
                Status = "interrompida",
                MotivoFim = "interrompida",
                InicioWall = s.InicioWall,
                FimWall = r.FimWall != 0 ? r.FimWall : s.InicioWall,
                DuracaoS = Math.Round(durMs / 100.0) / 10,
                NGps = r.NGps,
                NMotor = r.NMotor,
            };
            try { _store.Finalizar(s.Id, resumo); } catch { /* best-effort */ }
            orfas.Add(resumo);
        }
        return orfas.OrderByDescending(o => o.FimWall).ToList();
    }
}

/// <summary>Store em disco real: 1 arquivo de dados append-only por sessão
/// (&lt;id&gt;.jsonl, um registro por linha, com flush por registro) + 1 arquivo de
/// metadado (&lt;id&gt;.meta.json). System.IO puro, sem dependência de Windows.</summary>
public sealed class FileSessionStore : ISessionStore, IDisposable
{
    /// <summary>A cada N registros, força o SO a gravar no DISCO FÍSICO (Flush(true)),
    /// não só na cache de escrita do SO. Por amostra seria um fsync a 10 Hz (engasga o
    /// disco); N=10 ≈ perde no máximo ~1 s a 10 Hz numa queda de ENERGIA — trade-off
    /// aprovado pelo Flávio (2026-06-25). A queda só do PROCESSO já é coberta pelo
    /// Flush por registro (o dado vai pro SO na hora).</summary>
    public const int FlushDiscoCada = 10;

    private static readonly JsonSerializerOptions JsonOpts = new() { WriteIndented = false };
    private readonly string _dir;
    private readonly Dictionary<string, StreamWriter> _writers = new();
    private readonly Dictionary<string, int> _escritasDesdeDisco = new();

    public FileSessionStore(string dir)
    {
        _dir = dir ?? throw new ArgumentNullException(nameof(dir));
        Directory.CreateDirectory(_dir);
    }

    private string DataPath(string id) => Path.Combine(_dir, id + ".jsonl");
    private string MetaPath(string id) => Path.Combine(_dir, id + ".meta.json");

    public void NovaSessao(SessionMeta meta)
        => File.WriteAllText(MetaPath(meta.Id), JsonSerializer.Serialize(meta, JsonOpts));

    public void Gravar(SessionRecord registro)
    {
        if (!_writers.TryGetValue(registro.SessaoId, out var w))
        {
            // append mode: sobrevive a reabertura sem apagar a série já gravada.
            var fs = new FileStream(DataPath(registro.SessaoId), FileMode.Append, FileAccess.Write, FileShare.Read);
            w = new StreamWriter(fs);
            _writers[registro.SessaoId] = w;
        }
        w.WriteLine(JsonSerializer.Serialize(registro, JsonOpts));
        w.Flush();          // entrega ao SO por registro → sobrevive à queda do PROCESSO

        // A cada N registros força o DISCO FÍSICO (Flush(true)): uma queda de ENERGIA não
        // perde o que ficou só na cache do SO. Best-effort — se o fsync falhar, o dado já
        // está no SO e o próximo ciclo tenta de novo (não conta como perda).
        int n = (_escritasDesdeDisco.TryGetValue(registro.SessaoId, out var c) ? c : 0) + 1;
        if (n >= FlushDiscoCada)
        {
            n = 0;
            if (w.BaseStream is FileStream fsDisco) { try { fsDisco.Flush(flushToDisk: true); } catch { /* já no SO */ } }
        }
        _escritasDesdeDisco[registro.SessaoId] = n;
    }

    public void Finalizar(string id, SessionResumo resumo)
    {
        if (_writers.TryGetValue(id, out var w))
        {
            w.Flush();
            // Tail no disco antes de fechar: os registros desde o último flush-to-disk
            // periódico vão pro disco físico AGORA (fim de sessão não perde o resto).
            if (w.BaseStream is FileStream fsDisco) { try { fsDisco.Flush(flushToDisk: true); } catch { } }
            w.Dispose();
            _writers.Remove(id);
        }
        _escritasDesdeDisco.Remove(id);
        // grava o metadado já com o status final (resumo embutido)
        var obj = new { resumo.Id, resumo.Sim, resumo.Status, resumo.MotivoFim, resumo.InicioWall,
                        resumo.FimWall, resumo.DuracaoS, resumo.NGps, resumo.NMotor, resumo.Dropped, resumo.MaiorLacunaMs };
        File.WriteAllText(MetaPath(id), JsonSerializer.Serialize(obj, JsonOpts));
    }

    public SessionResumoParcial ResumirSessao(string id)
    {
        int nGps = 0, nMotor = 0;
        long minT = long.MaxValue, maxT = long.MinValue;
        var path = DataPath(id);
        if (File.Exists(path))
        {
            foreach (var line in File.ReadLines(path))
            {
                if (string.IsNullOrWhiteSpace(line)) continue;
                try
                {
                    using var doc = JsonDocument.Parse(line);
                    var root = doc.RootElement;
                    string tipo = root.TryGetProperty("Tipo", out var t) ? (t.GetString() ?? "") : "";
                    if (tipo == "gps") nGps++; else if (tipo == "t4000") nMotor++;
                    if (root.TryGetProperty("TWall", out var tw) && tw.TryGetInt64(out var v))
                    { if (v < minT) minT = v; if (v > maxT) maxT = v; }
                }
                catch { /* linha corrompida (queda no meio da escrita) — ignora, não trava */ }
            }
        }
        long inicio = minT == long.MaxValue ? 0 : minT;
        long fim = maxT == long.MinValue ? 0 : maxT;
        return new SessionResumoParcial(nGps, nMotor, fim - inicio, inicio, fim);
    }

    public IReadOnlyList<SessionMeta> ListarSessoes()
    {
        var lista = new List<SessionMeta>();
        if (!Directory.Exists(_dir)) return lista;
        foreach (var f in Directory.EnumerateFiles(_dir, "*.meta.json"))
        {
            try
            {
                using var doc = JsonDocument.Parse(File.ReadAllText(f));
                var r = doc.RootElement;
                lista.Add(new SessionMeta(
                    r.GetProperty("Id").GetString() ?? "",
                    r.TryGetProperty("InicioWall", out var iw) && iw.TryGetInt64(out var v) ? v : 0,
                    r.TryGetProperty("Sim", out var sm) && sm.ValueKind == JsonValueKind.True,
                    r.TryGetProperty("Status", out var st) ? (st.GetString() ?? "") : ""));
            }
            catch { /* metadado corrompido — ignora */ }
        }
        return lista;
    }

    public IReadOnlyList<SessionRecord> LerSessao(string id)
    {
        var regs = new List<SessionRecord>();
        var path = DataPath(id);
        if (!File.Exists(path)) return regs;
        foreach (var line in File.ReadLines(path))
        {
            if (string.IsNullOrWhiteSpace(line)) continue;
            try
            {
                var r = JsonSerializer.Deserialize<SessionRecord>(line, JsonOpts);
                if (r is not null) regs.Add(r);
            }
            catch { /* linha corrompida (queda no meio da escrita) — ignora, relê o resto */ }
        }
        return regs;
    }

    public void Dispose()
    {
        foreach (var w in _writers.Values)
        {
            try { w.Flush(); if (w.BaseStream is FileStream fsDisco) fsDisco.Flush(flushToDisk: true); w.Dispose(); } catch { }
        }
        _writers.Clear();
        _escritasDesdeDisco.Clear();
    }
}

/// <summary>Store em memória — testes e degradação se o disco faltar.</summary>
public sealed class InMemorySessionStore : ISessionStore
{
    private readonly Dictionary<string, SessionMeta> _sessoes = new();
    private readonly Dictionary<string, List<SessionRecord>> _amostras = new();

    public void NovaSessao(SessionMeta meta) { _sessoes[meta.Id] = meta; _amostras[meta.Id] = new(); }

    public void Gravar(SessionRecord registro)
    {
        if (!_amostras.TryGetValue(registro.SessaoId, out var l)) { l = new(); _amostras[registro.SessaoId] = l; }
        l.Add(registro);
    }

    public void Finalizar(string id, SessionResumo resumo)
        => _sessoes[id] = new SessionMeta(id, resumo.InicioWall, resumo.Sim, resumo.Status);

    public SessionResumoParcial ResumirSessao(string id)
    {
        var l = _amostras.TryGetValue(id, out var x) ? x : new List<SessionRecord>();
        int nGps = l.Count(r => r.Tipo == "gps");
        int nMotor = l.Count(r => r.Tipo == "t4000");
        long minT = l.Count > 0 ? l.Min(r => r.TWall) : 0;
        long maxT = l.Count > 0 ? l.Max(r => r.TWall) : 0;
        return new SessionResumoParcial(nGps, nMotor, maxT - minT, minT, maxT);
    }

    public IReadOnlyList<SessionMeta> ListarSessoes() => _sessoes.Values.ToList();
    public IReadOnlyList<SessionRecord> LerSessao(string id)
        => _amostras.TryGetValue(id, out var l) ? l.ToList() : new List<SessionRecord>();
}
