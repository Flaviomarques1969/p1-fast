// SystemHealth.cs — módulo de SAÚDE + AUTO-TESTE + MONITORAMENTO ONLINE do app
// do notebook. É a "função que monitora os avanços do sistema e mantém integrado
// com manutenção e testes" pedida pelo Flávio.
//
// O que faz, continuamente e fora da thread de UI:
//  1. Acompanha o estado vivo do módulo: leitor (procurando/conectado/estratégia),
//     taxa de amostras, idade da última amostra, sucesso/falha de envio pra nuvem.
//  2. Roda AUTO-TESTES na partida (stack USB, parser, escrita local) e guarda o
//     resultado — manutenção/diagnóstico embutido.
//  3. Escreve um retrato rolante local (p1-cockpit-health.json) e, se houver token,
//     ESPELHA pro GitHub (live/cockpit-health.json) pra eu (Claude) acompanhar
//     ONLINE e avisar o Flávio. Sem token, tudo segue funcionando — só não fico
//     vendo de fora.
//
// Best-effort: nada aqui pode derrubar a leitura nem travar a tela.

using System.Collections.Concurrent;
using System.Text;
using System.Text.Json;
using P1Fast.Cockpit.Domain;

namespace P1Fast.Cockpit.UI;

public static class SystemHealth
{
    // Espelho GitHub (mesma convenção do probe: token num arquivo ao lado do .exe).
    private const string Owner = "flaviomarques1969";
    private const string Repo = "p1-fast";
    private const string Branch = "claude/t3000-t4000-live-stream-tdrk70";
    private const string CaminhoRepo = "live/cockpit-health.json";
    private const string ArquivoToken = "p1fast-token.txt";

    private static readonly HttpClient http = new() { Timeout = TimeSpan.FromSeconds(10) };
    private static readonly object trava = new();
    private static readonly ConcurrentQueue<string> eventos = new();

    private static string _versao = "?";
    private static long _inicioTick;
    private static long _amostras;
    private static long _ultimaAmostraTick;
    private static string _estrategia = "?";
    private static long _nuvemOk;
    private static long _nuvemFalha;
    private static long _salvosOk;
    private static long _salvosFalha;

    private static bool _testeUsb;
    private static bool _testeParser;
    private static bool _testeEscrita;

    private static string? _token;
    private static string? _sha;
    private static System.Threading.Timer? _timer;
    private static string _arquivoLocal = "p1-cockpit-health.json";

    /// <summary>Liga o módulo: roda auto-testes, carrega token (se houver) e começa a publicar saúde a cada 2 s.</summary>
    public static void Iniciar(string versao)
    {
        _versao = versao;
        _inicioTick = Environment.TickCount64;
        _arquivoLocal = Path.Combine(AppContext.BaseDirectory, "p1-cockpit-health.json");

        http.DefaultRequestHeaders.TryAddWithoutValidation("User-Agent", "p1fast-cockpit");
        http.DefaultRequestHeaders.TryAddWithoutValidation("Accept", "application/vnd.github+json");
        try
        {
            var tk = Path.Combine(AppContext.BaseDirectory, ArquivoToken);
            if (File.Exists(tk)) _token = File.ReadAllText(tk).Trim();
        }
        catch { }

        RodarAutoTestes();
        Log(_token is null
            ? "iniciado (sem token — Claude não vê online; tudo o mais funciona)"
            : "iniciado (token ok — transmitindo saúde pro Claude acompanhar)");

        _timer = new System.Threading.Timer(_ => Tick(), null, 2000, 2000);
    }

    public static void Parar()
    {
        try { _timer?.Dispose(); } catch { }
        Tick(); // último retrato
    }

    // ── Entradas que o resto do app alimenta ───────────────────────

    public static void Amostra(T3000Sample _, string estrategia)
    {
        Interlocked.Increment(ref _amostras);
        Interlocked.Exchange(ref _ultimaAmostraTick, Environment.TickCount64);
        if (estrategia != _estrategia) lock (trava) _estrategia = estrategia;
    }

    public static void NuvemResultado(bool ok)
    {
        if (ok) Interlocked.Increment(ref _nuvemOk);
        else Interlocked.Increment(ref _nuvemFalha);
    }

    public static void SalvoResultado(bool ok)
    {
        if (ok) Interlocked.Increment(ref _salvosOk);
        else Interlocked.Increment(ref _salvosFalha);
    }

    public static void Log(string linha)
    {
        var carimbado = $"{DateTime.Now:HH:mm:ss} {linha}";
        eventos.Enqueue(carimbado);
        while (eventos.Count > 40 && eventos.TryDequeue(out _)) { }
    }

    /// <summary>Resumo curto e ao vivo pra linha de status da tela (captura + nuvem).</summary>
    public static string ResumoCurto()
    {
        long agora = Environment.TickCount64;
        long idadeMs = _ultimaAmostraTick == 0 ? -1 : agora - _ultimaAmostraTick;
        string leitor = idadeMs >= 0 && idadeMs < 3000
            ? "central OK"
            : (_amostras > 0 ? "reconectando" : "procurando central");
        long uptimeS = Math.Max(1, (agora - _inicioTick) / 1000);
        double porSeg = Math.Round(Interlocked.Read(ref _amostras) / (double)uptimeS, 1);
        long ok = Interlocked.Read(ref _nuvemOk);
        long falhas = Interlocked.Read(ref _nuvemFalha);
        string nuvem = falhas == 0 ? $"nuvem ✓{ok}" : $"nuvem ✓{ok}/✗{falhas}";
        return $"{leitor} • {porSeg}/s • {nuvem}";
    }

    // ── Auto-testes (manutenção/diagnóstico na partida) ────────────

    private static void RodarAutoTestes()
    {
        // 1. Stack USB acessível (LibUsbDotNet carrega + enumera sem estourar).
        try { _ = LibUsbDotNet.UsbDevice.AllDevices.Count; _testeUsb = true; }
        catch (Exception e) { _testeUsb = false; Log("auto-teste USB falhou: " + e.Message); }

        // 2. Parser do bloco RI não estoura num bloco sintético.
        try { _ = T3000RiBlockParser.Parse(new byte[460]); _testeParser = true; }
        catch (Exception e) { _testeParser = false; Log("auto-teste parser falhou: " + e.Message); }

        // 3. Escrita local funciona (onde vai o histórico).
        try
        {
            var probe = Path.Combine(AppContext.BaseDirectory, ".p1-escrita-teste");
            File.WriteAllText(probe, "ok");
            File.Delete(probe);
            _testeEscrita = true;
        }
        catch (Exception e) { _testeEscrita = false; Log("auto-teste escrita falhou: " + e.Message); }
    }

    // ── Retrato + publicação ───────────────────────────────────────

    private static void Tick()
    {
        long agora = Environment.TickCount64;
        long idadeMs = _ultimaAmostraTick == 0 ? -1 : agora - _ultimaAmostraTick;
        bool conectado = idadeMs >= 0 && idadeMs < 3000;
        long uptimeS = (agora - _inicioTick) / 1000;
        double porSeg = uptimeS > 0 ? Math.Round(_amostras / (double)uptimeS, 1) : 0;

        string[] evs;
        string estrategia;
        lock (trava) { estrategia = _estrategia; }
        evs = eventos.ToArray();

        var snap = new
        {
            atualizadoEm = DateTime.UtcNow.ToString("o"),
            appVersion = _versao,
            uptimeS,
            leitor = new
            {
                estado = conectado ? "conectado" : (_amostras > 0 ? "reconectando" : "procurando"),
                estrategia,
                amostras = Interlocked.Read(ref _amostras),
                amostrasPorSeg = porSeg,
                ultimaAmostraHaMs = idadeMs,
            },
            nuvem = new { ok = Interlocked.Read(ref _nuvemOk), falhas = Interlocked.Read(ref _nuvemFalha) },
            historicoLocal = new { ok = Interlocked.Read(ref _salvosOk), falhas = Interlocked.Read(ref _salvosFalha) },
            autoTeste = new { usbStack = _testeUsb, parser = _testeParser, escritaLocal = _testeEscrita },
            eventos = evs,
        };

        string json = JsonSerializer.Serialize(snap, new JsonSerializerOptions { WriteIndented = true });
        try { File.WriteAllText(_arquivoLocal, json); } catch { }

        if (_token is not null) _ = Espelhar(json);
    }

    private static async Task Espelhar(string json)
    {
        try
        {
            string content = Convert.ToBase64String(Encoding.UTF8.GetBytes(json));
            string url = $"https://api.github.com/repos/{Owner}/{Repo}/contents/{CaminhoRepo}";

            if (_sha is null)
            {
                using var g = Req(HttpMethod.Get, $"{url}?ref={Branch}");
                var gr = await http.SendAsync(g);
                if (gr.IsSuccessStatusCode)
                    _sha = JsonDocument.Parse(await gr.Content.ReadAsStringAsync())
                        .RootElement.GetProperty("sha").GetString();
            }

            var body = new Dictionary<string, object>
            {
                ["message"] = "cockpit health snapshot",
                ["content"] = content,
                ["branch"] = Branch,
            };
            if (_sha is not null) body["sha"] = _sha;

            using var p = Req(HttpMethod.Put, url);
            p.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
            var pr = await http.SendAsync(p);
            if (pr.IsSuccessStatusCode)
                _sha = JsonDocument.Parse(await pr.Content.ReadAsStringAsync())
                    .RootElement.GetProperty("content").GetProperty("sha").GetString();
            else if ((int)pr.StatusCode is 401 or 403)
                _token = null; // token recusado — para de tentar, app segue normal
            else
                _sha = null;    // re-busca o sha na próxima
        }
        catch { /* best-effort */ }
    }

    private static HttpRequestMessage Req(HttpMethod m, string url)
    {
        var r = new HttpRequestMessage(m, url);
        r.Headers.TryAddWithoutValidation("Authorization", "token " + _token);
        r.Headers.TryAddWithoutValidation("User-Agent", "p1fast-cockpit");
        r.Headers.TryAddWithoutValidation("Accept", "application/vnd.github+json");
        return r;
    }
}
