// PlanoStintReader — a ÚNICA leitura REST do cockpit: busca na nuvem o último envelope
// aprovado do carro e devolve o plano do stint DO DIA pra barra de voltas. É o achado que
// destrava a tarefa: o .exe é transmissor de mão única (só publica motor/GPS); esta é a
// primeira leitura GET que ele ganha. Espelha buscarPlanoStintDaNuvem do web
// (treino-stint.js 102-131): a decisão pura vive no PlanoStintParser; aqui só a rede.
//
// Tolerante por desenho (NUNCA derruba o boot): sem chave, sem rede, HTTP != 2xx, coluna
// plano_stint ausente (migration 0042 não aplicada em produção) ou plano fora do dia →
// null → a barra usa o placeholder, idêntico ao de hoje. Diagnóstico opcional via `log`
// (o JS falhava em silêncio; aqui dá pra ver por quê). Chave via env, NUNCA hardcode.

using System.Net.Http.Headers;

namespace P1Fast.Cockpit.Domain;

public sealed class PlanoStintReader
{
    /// <summary>Base REST do projeto (mesma do p1fast-upload/Heartbeat).</summary>
    public const string UrlPadrao = "https://fvhwltzhytpnhlqbttmd.supabase.co";

    /// <summary>carro_id do Bubi (default; overrideável — mesmo UUID do p1fast-upload).</summary>
    public const string CarroIdBubi = "641a81e7-3192-4e68-8183-b8401f105574";

    private readonly HttpClient _http;
    private readonly string _url;
    private readonly string _anonKey;
    private readonly Action<string>? _log;

    public PlanoStintReader(HttpClient http, string anonKey, string? url = null, Action<string>? log = null)
    {
        _http = http;
        _anonKey = anonKey;
        _url = (url ?? UrlPadrao).TrimEnd('/');
        _log = log;
    }

    /// <summary>Cria um leitor a partir do ambiente (chave P1FAST_SUPABASE_ANON — mesmo
    /// padrão do Heartbeat/Upload). Devolve null se não há chave: a barra segue no
    /// placeholder, 100% local. NUNCA hardcode a chave.</summary>
    public static PlanoStintReader? DoAmbiente(HttpClient http, string? url = null, Action<string>? log = null)
    {
        var anon = Environment.GetEnvironmentVariable("P1FAST_SUPABASE_ANON");
        if (string.IsNullOrWhiteSpace(anon))
        {
            log?.Invoke("[plano-stint] sem P1FAST_SUPABASE_ANON — barra usa placeholder.");
            return null;
        }
        return new PlanoStintReader(http, anon, url, log);
    }

    /// <summary>Busca o plano do stint DO DIA pro carro, ou null (→ placeholder). Best-effort
    /// total: qualquer falha vira null + log. Injete `agoraIso` pra testar a regra do dia;
    /// null = agora.</summary>
    public async Task<PlanoStint?> BuscarAsync(
        string carroId, CancellationToken ct = default, string? agoraIso = null)
    {
        if (string.IsNullOrWhiteSpace(carroId))
        {
            _log?.Invoke("[plano-stint] carroId vazio — barra usa placeholder.");
            return null;
        }
        try
        {
            var url = $"{_url}/rest/v1/envelopes_seguranca_stint" +
                      $"?carro_id=eq.{Uri.EscapeDataString(carroId)}&order=created_at.desc&limit=1";
            using var req = new HttpRequestMessage(HttpMethod.Get, url);
            req.Headers.Add("apikey", _anonKey);
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _anonKey);

            using var resp = await _http.SendAsync(req, ct).ConfigureAwait(false);
            if (!resp.IsSuccessStatusCode)
            {
                _log?.Invoke($"[plano-stint] HTTP {(int)resp.StatusCode} — barra usa placeholder.");
                return null;
            }

            var corpo = await resp.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
            var plano = PlanoStintParser.DaRespostaNuvem(corpo, agoraIso);
            _log?.Invoke(plano is null
                ? "[plano-stint] sem plano do dia — barra usa placeholder."
                : $"[plano-stint] plano do dia carregado: {plano.Voltas} voltas, {plano.Paradas.Count} parada(s).");
            return plano;
        }
        catch (Exception e)
        {
            _log?.Invoke($"[plano-stint] falha ({e.GetType().Name}: {e.Message}) — barra usa placeholder.");
            return null;
        }
    }

    /// <summary>Igual ao BuscarAsync, mas já expande na barra de `slots` tipos de volta (o
    /// que a UI consome). null = placeholder.</summary>
    public async Task<TipoVoltaStint[]?> BuscarBarraAsync(
        string carroId, int slots, CancellationToken ct = default, string? agoraIso = null)
    {
        var plano = await BuscarAsync(carroId, ct, agoraIso).ConfigureAwait(false);
        return PlanoStintParser.ExpandirBarra(plano, slots);
    }
}
