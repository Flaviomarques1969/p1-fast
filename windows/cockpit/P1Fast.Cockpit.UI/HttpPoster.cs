// HttpPoster — IHttpPoster real (HttpClient compartilhado) pro SalaVideoPublisher.
// POST JSON simples; sucesso = status 2xx. Timeout curto: o POST da sala é best-effort
// e nunca pode segurar o abrir do stint (roda fire-and-forget lá no MainWindow.Live).

using System;
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

    public async Task<bool> PostJsonAsync(string url, string jsonBody, CancellationToken ct)
    {
        using var content = new StringContent(jsonBody, Encoding.UTF8, "application/json");
        using var resp = await _http.PostAsync(url, content, ct).ConfigureAwait(false);
        return resp.IsSuccessStatusCode;
    }
}
