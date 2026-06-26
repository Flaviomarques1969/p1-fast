// SupabaseRealtimeChannel — o FIO real pra nuvem (Fase 3, parte de bancada/online).
//
// Implementação REAL do ILiveChannel: fala o protocolo do Supabase Realtime
// (Phoenix sobre WebSocket) — o MESMO canal que o app P1 Fast e a tela do Command
// Box já assistem (web/cockpit/cloud-bridge.js). NENHUMA regra de negócio aqui
// (throttle, fila, reenvio, trava de produção vivem no LivePublisher, no Domain,
// provados por teste). Aqui é só: conectar, entrar no canal, mandar broadcast,
// bater o coração (heartbeat) e dizer se está online.
//
// MORA NO DOMAIN (2026-06-25): a UI (.exe do cockpit) e o console de captura usam
// o MESMO fio. Só transporte (System.Net.WebSockets), sem dependência de Windows —
// roda e é provado fora do carro. Antes vivia em P1Fast.Cockpit.T4000Capture.
//
// Protocolo (igual ao supabase-js):
//   wss://<ref>.supabase.co/realtime/v1/websocket?apikey=<anon>&vsn=1.0.0
//   join:      {topic:"realtime:<canal>", event:"phx_join", payload:{config:{broadcast:{ack:false,self:false}}}, ref}
//   heartbeat: {topic:"phoenix", event:"heartbeat", payload:{}, ref}   (~25 s)
//   broadcast: {topic:"realtime:<canal>", event:"broadcast", payload:{type:"broadcast", event:"sample", payload:{...}}, ref}
//
// Online só vira true quando o servidor confirma a entrada no canal (phx_reply ok).

using System.Net.WebSockets;
using System.Text;
using System.Text.Json;

namespace P1Fast.Cockpit.Domain;

public sealed class SupabaseRealtimeChannel : ILiveChannel, IAsyncDisposable
{
    private readonly Uri _wsUri;
    private readonly string _topic;
    private readonly SemaphoreSlim _sendLock = new(1, 1);

    private ClientWebSocket? _ws;
    private bool _joined;
    private long _ref;
    private CancellationTokenSource? _bg;

    public SupabaseRealtimeChannel(string supabaseUrl, string anonKey, string canal)
    {
        if (string.IsNullOrWhiteSpace(supabaseUrl)) throw new ArgumentException("URL vazia", nameof(supabaseUrl));
        if (string.IsNullOrWhiteSpace(anonKey))     throw new ArgumentException("chave anon vazia", nameof(anonKey));
        if (string.IsNullOrWhiteSpace(canal))       throw new ArgumentException("canal vazio", nameof(canal));

        var baseWs = supabaseUrl.Replace("https://", "wss://").Replace("http://", "ws://").TrimEnd('/');
        _wsUri = new Uri($"{baseWs}/realtime/v1/websocket?apikey={Uri.EscapeDataString(anonKey)}&vsn=1.0.0");
        _topic = "realtime:" + canal;
    }

    public bool Online => _ws?.State == WebSocketState.Open && _joined;

    /// <summary>Conecta, entra no canal e liga os laços de recebimento + heartbeat.
    /// Best-effort: lança se nem conectar; quem chama trata e tenta de novo (backoff).</summary>
    public async Task ConnectAsync(CancellationToken ct)
    {
        await DisposeSocketAsync().ConfigureAwait(false);
        _joined = false;

        var ws = new ClientWebSocket();
        await ws.ConnectAsync(_wsUri, ct).ConfigureAwait(false);
        _ws = ws;

        _bg = CancellationTokenSource.CreateLinkedTokenSource(ct);
        _ = Task.Run(() => ReceiveLoopAsync(_bg.Token));
        _ = Task.Run(() => HeartbeatLoopAsync(_bg.Token));

        // Entra no canal (broadcast ack:false / self:false — igual ao cloud-bridge.js).
        await SendRawAsync(new Dictionary<string, object?>
        {
            ["topic"]   = _topic,
            ["event"]   = "phx_join",
            ["payload"] = new { config = new { broadcast = new { ack = false, self = false } } },
            ["ref"]     = NextRef(),
        }, ct).ConfigureAwait(false);
    }

    public async Task<bool> PublishAsync(string evento, object payload, CancellationToken cancellationToken)
    {
        if (!Online) return false;
        try
        {
            await SendRawAsync(new Dictionary<string, object?>
            {
                ["topic"]   = _topic,
                ["event"]   = "broadcast",
                ["payload"] = new Dictionary<string, object?>
                {
                    ["type"]    = "broadcast",
                    ["event"]   = evento,
                    ["payload"] = payload,
                },
                ["ref"]     = NextRef(),
            }, cancellationToken).ConfigureAwait(false);
            return true; // ack:false => não espera confirmação (igual ao painel)
        }
        catch (OperationCanceledException) { throw; }
        catch { _joined = false; return false; }
    }

    private string NextRef() => Interlocked.Increment(ref _ref).ToString();

    private async Task SendRawAsync(object msg, CancellationToken ct)
    {
        var bytes = JsonSerializer.SerializeToUtf8Bytes(msg);
        await _sendLock.WaitAsync(ct).ConfigureAwait(false);
        try
        {
            var ws = _ws ?? throw new InvalidOperationException("socket não conectado");
            await ws.SendAsync(bytes, WebSocketMessageType.Text, endOfMessage: true, ct).ConfigureAwait(false);
        }
        finally { _sendLock.Release(); }
    }

    private async Task ReceiveLoopAsync(CancellationToken ct)
    {
        var buf = new byte[16 * 1024];
        var acc = new StringBuilder();
        try
        {
            while (!ct.IsCancellationRequested && _ws is { State: WebSocketState.Open })
            {
                var res = await _ws.ReceiveAsync(buf, ct).ConfigureAwait(false);
                if (res.MessageType == WebSocketMessageType.Close) { _joined = false; break; }
                acc.Append(Encoding.UTF8.GetString(buf, 0, res.Count));
                if (!res.EndOfMessage) continue;

                var texto = acc.ToString();
                acc.Clear();
                TratarMensagem(texto);
            }
        }
        catch (OperationCanceledException) { /* encerrando */ }
        catch { _joined = false; }
    }

    // Marca "entrou no canal" quando vem o phx_reply com status ok.
    private void TratarMensagem(string texto)
    {
        try
        {
            using var doc = JsonDocument.Parse(texto);
            var root = doc.RootElement;
            if (root.TryGetProperty("event", out var ev) && ev.GetString() == "phx_reply" &&
                root.TryGetProperty("payload", out var pl) &&
                pl.TryGetProperty("status", out var st) && st.GetString() == "ok")
            {
                _joined = true;
            }
        }
        catch { /* mensagem que não interessa — ignora, não derruba o laço */ }
    }

    private async Task HeartbeatLoopAsync(CancellationToken ct)
    {
        try
        {
            while (!ct.IsCancellationRequested && _ws is { State: WebSocketState.Open })
            {
                await Task.Delay(25_000, ct).ConfigureAwait(false);
                try
                {
                    await SendRawAsync(new Dictionary<string, object?>
                    {
                        ["topic"] = "phoenix", ["event"] = "heartbeat",
                        ["payload"] = new { }, ["ref"] = NextRef(),
                    }, ct).ConfigureAwait(false);
                }
                catch { _joined = false; break; }
            }
        }
        catch (OperationCanceledException) { /* encerrando */ }
    }

    private async Task DisposeSocketAsync()
    {
        try { _bg?.Cancel(); } catch { }
        if (_ws is not null)
        {
            try
            {
                if (_ws.State == WebSocketState.Open)
                    await _ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "bye", CancellationToken.None).ConfigureAwait(false);
            }
            catch { /* já caiu */ }
            _ws.Dispose();
            _ws = null;
        }
        _joined = false;
    }

    public async ValueTask DisposeAsync()
    {
        await DisposeSocketAsync().ConfigureAwait(false);
        _sendLock.Dispose();
        _bg?.Dispose();
    }
}
