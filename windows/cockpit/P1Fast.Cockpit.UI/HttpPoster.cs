// HttpPoster — IHttpPoster real (HttpClient compartilhado) pro SalaVideoPublisher.
// POST JSON com headers opcionais (ex.: x-registrar-secret); devolve status + corpo.
// Timeout curto: o POST da sala/registro é best-effort e roda fire-and-forget lá no
// MainWindow.Live — nunca pode segurar o abrir do stint.

using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using P1Fast.Cockpit.Domain;

namespace P1Fast.Cockpit.UI;

public sealed class HttpPoster : IHttpPoster
{
    // Um só HttpClient pro processo (boa prática: não criar por chamada).
    private static readonly HttpClient _http = new() { Timeout = TimeSpan.FromSeconds(10) };

    public async Task<HttpResposta> PostJsonAsync(string url, string jsonBody, IReadOnlyDictionary<string, string>? headers, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = new StringContent(jsonBody, Encoding.UTF8, "application/json"),
        };
        if (headers is not null)
            foreach (var kv in headers) req.Headers.TryAddWithoutValidation(kv.Key, kv.Value);

        using var resp = await _http.SendAsync(req, ct).ConfigureAwait(false);
        var corpo = await resp.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
        return new HttpResposta(resp.IsSuccessStatusCode, (int)resp.StatusCode, corpo);
    }
}
