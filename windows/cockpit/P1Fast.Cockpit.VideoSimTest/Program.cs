// p1fast-video-simtest — runner do STINT SIMULADO pro teste do cofre (escopo limitado
// autorizado pelo Flávio 2026-07-01: 1 linha de teste em video_streams + limpeza depois).
//
// Por quê um runner à parte: o registrar-direto sai do SessionRecorder do caminho --live
// do .exe, que sem carro (T4000/RaceBox) não recebe dado e não abre stint. Este console
// exercita EXATAMENTE o mesmo código (SalaVideoPublisher, do Domain) contra o backend real:
// gera um sessaoId novo (Guid), monta o ponteiro e chama AbrirSalaAsync — que (1) POSTa a
// sala no fam-racing e (2) POSTa o video-registrar DIRETO com o x-registrar-secret.
//
// Uso:
//   p1fast-video-simtest [--evento=<uuid>] [--time=<uuid>]
// Segredo: env P1FAST_VIDEO_REGISTRAR_SECRET ou ~/p1fast-sessoes/.registrar-secret.
// Sem segredo, cria a sala e PULA o registrar (dry-run seguro, não escreve no cofre).

using System.Net.Http;
using System.Text;
using P1Fast.Cockpit.Domain;

string? Arg(string nome)
{
    foreach (var a in args)
        if (a.StartsWith(nome + "=", StringComparison.Ordinal)) return a[(nome.Length + 1)..];
    return null;
}

// UUIDs de TESTE (existem no banco — resolvem a FK do video_streams). Confirmados pelo
// coordenador: eventId=evento Brasília 20/06, timeId=Bubi.
string eventId = Arg("--evento") ?? "4ff84907-8697-4c51-a0c6-0ad78794bb35";
string timeId = Arg("--time") ?? "c027a716-dc05-4d3c-9b8f-59f288d5e12c";

string? Segredo()
{
    var env = Environment.GetEnvironmentVariable("P1FAST_VIDEO_REGISTRAR_SECRET");
    if (!string.IsNullOrWhiteSpace(env)) return env;
    var f = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "p1fast-sessoes", ".registrar-secret");
    if (File.Exists(f)) return File.ReadAllText(f).Trim();
    return null;
}

var sessaoId = Guid.NewGuid().ToString();
long startedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
var ponteiro = new PonteiroDados(sessaoId, startedAt, eventId, timeId, "gravando");

var temSegredo = !string.IsNullOrWhiteSpace(Segredo());
Console.WriteLine("=== p1fast-video-simtest (stint simulado — teste do cofre) ===");
Console.WriteLine($"sessaoId (UUID do stint) = {sessaoId}");
Console.WriteLine($"eventId  = {eventId}");
Console.WriteLine($"timeId   = {timeId}");
Console.WriteLine($"startedAt= {startedAt}");
Console.WriteLine($"segredo  = {(temSegredo ? "PRESENTE (vai registrar no cofre)" : "AUSENTE (dry-run: cria sala, PULA registrar)")}");

var pub = new SalaVideoPublisher(new ConsolePoster(), segredo: Segredo);
var ok = await pub.AbrirSalaAsync(ponteiro);

Console.WriteLine();
Console.WriteLine($"AbrirSalaAsync => {(ok ? "OK" : "FALHOU")}");
Console.WriteLine($"REPORTE ao coordenador: sessaoId={sessaoId}");
return ok ? 0 : 1;

/// <summary>IHttpPoster de console: imprime cada POST (url, body, status, resposta) — é daqui
/// que sai a prova (status HTTP + id da linha na resposta do registrar).</summary>
sealed class ConsolePoster : IHttpPoster
{
    private static readonly HttpClient _http = new() { Timeout = TimeSpan.FromSeconds(15) };

    public async Task<HttpResposta> PostJsonAsync(string url, string jsonBody, IReadOnlyDictionary<string, string>? headers, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = new StringContent(jsonBody, Encoding.UTF8, "application/json"),
        };
        if (headers is not null)
            foreach (var kv in headers) req.Headers.TryAddWithoutValidation(kv.Key, kv.Value);

        Console.WriteLine();
        Console.WriteLine($"POST {url}");
        Console.WriteLine($"  body: {jsonBody}");
        if (headers is not null) Console.WriteLine($"  headers: {string.Join(", ", headers.Keys)}");
        using var resp = await _http.SendAsync(req, ct).ConfigureAwait(false);
        var corpo = await resp.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
        Console.WriteLine($"  -> HTTP {(int)resp.StatusCode}");
        Console.WriteLine($"  resp: {corpo}");
        return new HttpResposta(resp.IsSuccessStatusCode, (int)resp.StatusCode, corpo);
    }
}
