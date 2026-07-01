// SalaVideoPublisher — peça 3 (Opção A, Flávio/iMac 2026-07-01): no INÍCIO do stint, o
// .exe cria/recupera a sala de vídeo no fam-racing e manda o payload AUMENTADO direto,
// server-to-server. Isso sidesteps de vez o "Vercel vs local" + mixed-content: não
// depende de como a página de campo abre — o .exe já tem o ponteiro e já fala com a nuvem.
//
// Contrato (docs/CONTRATO_VIDEO_GRAVACAO.md, formato 2) — chaves EXATAS, camelCase:
//   { "eventId":"<uuid>", "dateISO":"YYYY-MM-DD", "sessaoId":"<uuid>",
//     "timeId":"<uuid>", "startedAt":<epoch ms> }
// O backend do fam-racing (api/video/room.js, do iMac) recebe isso, cria/recupera a sala
// determinística (evento-<id>-<data>) e chama o video-registrar com o X-Registrar-Secret.
//
// DESENHO PARA TESTE: o POST é abstraído por IHttpPoster (o UI passa uma impl com
// HttpClient real; os testes passam um poster falso). Best-effort: falha de rede NUNCA
// derruba a gravação nem a tela do piloto.

using System;
using System.Globalization;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace P1Fast.Cockpit.Domain;

/// <summary>Faz um POST JSON e diz se deu 2xx. Abstraído pra testar sem rede.</summary>
public interface IHttpPoster
{
    Task<bool> PostJsonAsync(string url, string jsonBody, CancellationToken ct);
}

public sealed class SalaVideoPublisher
{
    /// <summary>O MESMO backend que o servidor-video-local já usa (o iMac confirmou).</summary>
    public const string RoomBackendPadrao = "https://fam-racing.vercel.app/api/video/room";

    private readonly IHttpPoster _http;
    private readonly string _url;
    private readonly Func<long, string> _dateISO;

    /// <param name="dateISO">epoch ms → data LOCAL do dia (YYYY-MM-DD). Injetável pra teste;
    /// default = data local da máquina (Brasília na pista).</param>
    public SalaVideoPublisher(IHttpPoster http, string? url = null, Func<long, string>? dateISO = null)
    {
        _http = http ?? throw new ArgumentNullException(nameof(http));
        _url = string.IsNullOrWhiteSpace(url) ? RoomBackendPadrao : url!;
        _dateISO = dateISO ?? (ms => DateTimeOffset.FromUnixTimeMilliseconds(ms)
                                        .ToLocalTime().ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
    }

    /// <summary>Monta o payload aumentado (formato 2) a partir do ponteiro. Chaves EXATAS.</summary>
    public string MontarPayload(PonteiroDados p) => JsonSerializer.Serialize(new
    {
        eventId = p.EventId,
        dateISO = _dateISO(p.StartedAt),
        sessaoId = p.SessaoId,
        timeId = p.TimeId,
        startedAt = p.StartedAt,
    });

    /// <summary>No início do stint: POST server-to-server pro fam-racing. Retorna true em
    /// 2xx. Best-effort — engole qualquer erro (a gravação local é a verdade; isto é o vídeo).</summary>
    public async Task<bool> AbrirSalaAsync(PonteiroDados p, CancellationToken ct = default)
    {
        try { return await _http.PostJsonAsync(_url, MontarPayload(p), ct).ConfigureAwait(false); }
        catch { return false; }
    }
}
