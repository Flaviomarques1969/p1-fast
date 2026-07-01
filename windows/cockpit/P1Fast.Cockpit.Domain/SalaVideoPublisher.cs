// SalaVideoPublisher — peça 3 (Opção A + registrar-direto, Flávio/iMac 2026-07-01): no
// INÍCIO do stint, o .exe (1) cria/recupera a sala de vídeo no fam-racing e (2) REGISTRA
// no cofre chamando o video-registrar DIRETO — sem tocar o api/video/room.js do fam-racing
// (deploy manual antigo, via da transmissão ao vivo). Server-to-server; sidesteps de vez o
// "Vercel vs local" + mixed-content: não depende de como a página de campo abre.
//
// Fluxo do Abrir:
//   (1) POST fam-racing /api/room  {eventId,dateISO,sessaoId,timeId,startedAt}  (formato 2)
//       → resposta { roomUrl, tokenPiloto, tokenBox, exp } → dailyRoomUrl = roomUrl
//   (2) POST video-registrar  {sessaoId,timeId,startedAt,eventId,dailyRoomName,dailyRoomUrl}
//       header x-registrar-secret (JWT OFF: SEM apikey/Bearer). SÓ se há segredo; sem ele,
//       cria a sala e PULA o registrar (best-effort dev).
//
// STOP fica com a PÁGINA local (Daily start/stop in-call, poll no /api/sessao-corrente) —
// o .exe NÃO grava (a Daily não tem stop-recording-on-room server-side).
//
// DESENHO PARA TESTE: o POST é abstraído por IHttpPoster (o UI passa impl com HttpClient
// real; os testes passam um poster falso). Best-effort: falha de rede NUNCA derruba a
// gravação nem a tela do piloto.

using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace P1Fast.Cockpit.Domain;

/// <summary>Resultado de um POST JSON: ok (2xx), status e corpo da resposta.</summary>
public sealed record HttpResposta(bool Ok, int Status, string Corpo);

/// <summary>Faz um POST JSON (com headers opcionais) e devolve status + corpo. Abstraído
/// pra testar sem rede.</summary>
public interface IHttpPoster
{
    Task<HttpResposta> PostJsonAsync(string url, string jsonBody, IReadOnlyDictionary<string, string>? headers, CancellationToken ct);
}

public sealed class SalaVideoPublisher
{
    /// <summary>O MESMO backend de sala que o servidor-video-local já usa (o iMac confirmou).</summary>
    public const string RoomBackendPadrao = "https://fam-racing.vercel.app/api/video/room";
    /// <summary>video-registrar (Edge Function, JWT OFF): registra no cofre pelo UUID.</summary>
    public const string RegistrarUrlPadrao = "https://fvhwltzhytpnhlqbttmd.supabase.co/functions/v1/video-registrar";

    private readonly IHttpPoster _http;
    private readonly string _roomUrl;
    private readonly string _registrarUrl;
    private readonly Func<string?> _segredo;   // lê env/arquivo; vazio/null = sem segredo → pula registrar
    private readonly Func<long, string> _dateISO;

    /// <param name="segredo">Provedor do x-registrar-secret (env P1FAST_VIDEO_REGISTRAR_SECRET
    /// ou arquivo). Null/vazio = dev sem segredo: cria a sala e pula o registrar.</param>
    /// <param name="dateISO">epoch ms → data LOCAL do dia (YYYY-MM-DD). Injetável pra teste.</param>
    public SalaVideoPublisher(
        IHttpPoster http,
        Func<string?>? segredo = null,
        string? roomUrl = null,
        string? registrarUrl = null,
        Func<long, string>? dateISO = null)
    {
        _http = http ?? throw new ArgumentNullException(nameof(http));
        _roomUrl = string.IsNullOrWhiteSpace(roomUrl) ? RoomBackendPadrao : roomUrl!;
        _registrarUrl = string.IsNullOrWhiteSpace(registrarUrl) ? RegistrarUrlPadrao : registrarUrl!;
        _segredo = segredo ?? (() => null);
        _dateISO = dateISO ?? (ms => DateTimeOffset.FromUnixTimeMilliseconds(ms)
                                        .ToLocalTime().ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
    }

    /// <summary>Payload da sala (formato 2 do contrato). Chaves EXATAS camelCase.</summary>
    public string MontarPayloadRoom(PonteiroDados p) => JsonSerializer.Serialize(new
    {
        eventId = p.EventId,
        dateISO = _dateISO(p.StartedAt),
        sessaoId = p.SessaoId,
        timeId = p.TimeId,
        startedAt = p.StartedAt,
    });

    /// <summary>Nome determinístico da sala do dia (o iMac confirmou este formato).</summary>
    public string DailyRoomName(PonteiroDados p) => $"evento-{p.EventId}-{_dateISO(p.StartedAt)}";

    /// <summary>Payload do video-registrar (o que casa com o cofre video_streams).</summary>
    public string MontarPayloadRegistrar(PonteiroDados p, string dailyRoomName, string dailyRoomUrl) =>
        JsonSerializer.Serialize(new
        {
            sessaoId = p.SessaoId,
            timeId = p.TimeId,
            startedAt = p.StartedAt,
            eventId = p.EventId,
            dailyRoomName,
            dailyRoomUrl,
        });

    /// <summary>Tira o roomUrl da resposta do /api/room. Oficial = campo "roomUrl" no topo
    /// (resposta {roomUrl,tokenPiloto,tokenBox,exp}); parse defensivo aceita "url" e
    /// "room.url". Null se não achar.</summary>
    public static string? ExtrairRoomUrl(string corpo)
    {
        if (string.IsNullOrWhiteSpace(corpo)) return null;
        try
        {
            using var doc = JsonDocument.Parse(corpo);
            var r = doc.RootElement;
            if (r.ValueKind != JsonValueKind.Object) return null;
            if (r.TryGetProperty("roomUrl", out var a) && a.ValueKind == JsonValueKind.String) return a.GetString();
            if (r.TryGetProperty("url", out var b) && b.ValueKind == JsonValueKind.String) return b.GetString();
            if (r.TryGetProperty("room", out var room) && room.ValueKind == JsonValueKind.Object
                && room.TryGetProperty("url", out var c) && c.ValueKind == JsonValueKind.String) return c.GetString();
        }
        catch { /* corpo não-JSON */ }
        return null;
    }

    /// <summary>No início do stint: cria a sala e registra no cofre. Retorna true se o
    /// registro entrou (ou, sem segredo, se a sala foi criada). Best-effort — engole erro.</summary>
    public async Task<bool> AbrirSalaAsync(PonteiroDados p, CancellationToken ct = default)
    {
        try
        {
            // (1) cria/recupera a sala do dia
            var r1 = await _http.PostJsonAsync(_roomUrl, MontarPayloadRoom(p), null, ct).ConfigureAwait(false);
            if (!r1.Ok) return false;
            var roomUrl = ExtrairRoomUrl(r1.Corpo);
            if (string.IsNullOrWhiteSpace(roomUrl)) return false;   // sem roomUrl não dá pra registrar

            // (2) registra no cofre — SÓ com segredo (dev sem segredo: sala criada, registrar pulado)
            var segredo = _segredo();
            if (string.IsNullOrWhiteSpace(segredo)) return true;

            var headers = new Dictionary<string, string> { ["x-registrar-secret"] = segredo! };
            var body = MontarPayloadRegistrar(p, DailyRoomName(p), roomUrl!);
            var r2 = await _http.PostJsonAsync(_registrarUrl, body, headers, ct).ConfigureAwait(false);
            return r2.Ok;
        }
        catch { return false; }
    }
}
