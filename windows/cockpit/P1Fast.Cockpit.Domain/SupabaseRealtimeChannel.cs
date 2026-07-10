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
// Online só vira true quando o servidor confirma a entrada NO NOSSO canal (phx_reply
// ok com o topic E o ref do NOSSO join) — não com um phx_reply qualquer (ex.: o do
// heartbeat, topic "phoenix"). phx_error/phx_close derrubam o online, e um heartbeat
// sem resposta (conexão meia-aberta) também — senão o publisher achava que entregou e
// o ao-vivo se perdia em silêncio (bug de campo 2026-07-09).

using System.Net.WebSockets;
using System.Text;
using System.Text.Json;

namespace P1Fast.Cockpit.Domain;

/// <summary>Costura mínima sobre o WebSocket real, pra o canal ser provável fora da
/// rede (fake nos testes). Espelha 1:1 o que o SupabaseRealtimeChannel usa do
/// ClientWebSocket — nada a mais. A implementação de produção é ClientWebSocketAdapter.</summary>
public interface IRealtimeSocket : IDisposable
{
    WebSocketState State { get; }
    Task ConnectAsync(Uri uri, CancellationToken ct);
    ValueTask SendAsync(ReadOnlyMemory<byte> buffer, WebSocketMessageType messageType, bool endOfMessage, CancellationToken ct);
    ValueTask<ValueWebSocketReceiveResult> ReceiveAsync(Memory<byte> buffer, CancellationToken ct);
    Task CloseAsync(WebSocketCloseStatus closeStatus, string? statusDescription, CancellationToken ct);
}

/// <summary>Fio de produção: um ClientWebSocket de verdade. Fininho de propósito —
/// zero lógica, só repassa. É a única parte NÃO exercida pelos testes (é o transporte).</summary>
public sealed class ClientWebSocketAdapter : IRealtimeSocket
{
    private readonly ClientWebSocket _ws = new();
    public WebSocketState State => _ws.State;
    public Task ConnectAsync(Uri uri, CancellationToken ct) => _ws.ConnectAsync(uri, ct);
    public ValueTask SendAsync(ReadOnlyMemory<byte> buffer, WebSocketMessageType messageType, bool endOfMessage, CancellationToken ct)
        => _ws.SendAsync(buffer, messageType, endOfMessage, ct);
    public ValueTask<ValueWebSocketReceiveResult> ReceiveAsync(Memory<byte> buffer, CancellationToken ct)
        => _ws.ReceiveAsync(buffer, ct);
    public Task CloseAsync(WebSocketCloseStatus closeStatus, string? statusDescription, CancellationToken ct)
        => _ws.CloseAsync(closeStatus, statusDescription, ct);
    public void Dispose() => _ws.Dispose();
}

public sealed class SupabaseRealtimeChannel : ILiveChannel, IAsyncDisposable
{
    private readonly Uri _wsUri;
    private readonly string _topic;
    private readonly SemaphoreSlim _sendLock = new(1, 1);
    private readonly Func<IRealtimeSocket> _socketFactory;
    private readonly TimeSpan _heartbeatIntervalo;

    // _ws e _joined são lidos/escritos por 3 threads (quem chama + laço de recebimento +
    // laço de heartbeat). volatile garante que cada thread veja a última escrita das outras.
    private volatile IRealtimeSocket? _ws;
    private volatile bool _joined;
    private long _ref;
    private string _joinRef = "";          // ref do NOSSO phx_join (só ele confirma a entrada)
    private volatile bool _heartbeatPendente; // heartbeat enviado ainda sem resposta = meia-aberta
    private CancellationTokenSource? _bg;

    public SupabaseRealtimeChannel(
        string supabaseUrl,
        string anonKey,
        string canal,
        Func<IRealtimeSocket>? socketFactory = null,
        TimeSpan? heartbeatIntervalo = null)
    {
        if (string.IsNullOrWhiteSpace(supabaseUrl)) throw new ArgumentException("URL vazia", nameof(supabaseUrl));
        if (string.IsNullOrWhiteSpace(anonKey))     throw new ArgumentException("chave anon vazia", nameof(anonKey));
        if (string.IsNullOrWhiteSpace(canal))       throw new ArgumentException("canal vazio", nameof(canal));

        var baseWs = supabaseUrl.Replace("https://", "wss://").Replace("http://", "ws://").TrimEnd('/');
        _wsUri = new Uri($"{baseWs}/realtime/v1/websocket?apikey={Uri.EscapeDataString(anonKey)}&vsn=1.0.0");
        _topic = "realtime:" + canal;
        _socketFactory = socketFactory ?? (() => new ClientWebSocketAdapter());
        _heartbeatIntervalo = heartbeatIntervalo ?? TimeSpan.FromSeconds(25);
    }

    public bool Online => _ws?.State == WebSocketState.Open && _joined;

    /// <summary>Conecta, entra no canal e liga os laços de recebimento + heartbeat.
    /// Best-effort: lança se nem conectar; quem chama trata e tenta de novo (backoff).</summary>
    public async Task ConnectAsync(CancellationToken ct)
    {
        await DisposeSocketAsync().ConfigureAwait(false);
        _joined = false;
        _heartbeatPendente = false;

        var ws = _socketFactory();
        await ws.ConnectAsync(_wsUri, ct).ConfigureAwait(false);
        _ws = ws;

        // L5: cópia local pros laços — se uma religação trocar _bg no meio, cada laço
        // segue preso ao token da SUA conexão (nunca null/trocado por baixo). E cada laço
        // recebe a SUA instância de socket: uma religação nunca deixa o laço velho derrubar
        // o _joined da conexão nova (só mexe se ainda for o socket ATIVO — MarcarDesconectado).
        var bg = CancellationTokenSource.CreateLinkedTokenSource(ct);
        _bg = bg;
        _ = Task.Run(() => ReceiveLoopAsync(ws, bg.Token));
        _ = Task.Run(() => HeartbeatLoopAsync(ws, bg.Token));

        // Entra no canal (broadcast ack:false / self:false — igual ao cloud-bridge.js).
        // Guarda o ref do join: só o phx_reply com ESTE ref (e o nosso topic) confirma a entrada.
        _joinRef = NextRef();
        await SendRawAsync(new Dictionary<string, object?>
        {
            ["topic"]   = _topic,
            ["event"]   = "phx_join",
            ["payload"] = new { config = new { broadcast = new { ack = false, self = false } } },
            ["ref"]     = _joinRef,
        }, ct).ConfigureAwait(false);
    }

    public async Task<bool> PublishAsync(string evento, object payload, CancellationToken cancellationToken)
    {
        if (!Online) return false;
        var socket = _ws;
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
        catch { MarcarDesconectado(socket); return false; }
    }

    private string NextRef() => Interlocked.Increment(ref _ref).ToString();

    // Só derruba o online se o socket que falhou/fechou AINDA é o ativo. Sem isto, um laço
    // de uma conexão velha (religação em curso) zerava o _joined da conexão nova (corrida).
    private void MarcarDesconectado(IRealtimeSocket? socket)
    {
        if (ReferenceEquals(_ws, socket)) _joined = false;
    }

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

    private async Task ReceiveLoopAsync(IRealtimeSocket socket, CancellationToken ct)
    {
        var buf = new byte[16 * 1024];
        var acc = new StringBuilder();
        try
        {
            while (!ct.IsCancellationRequested && socket.State == WebSocketState.Open)
            {
                var res = await socket.ReceiveAsync(buf, ct).ConfigureAwait(false);
                if (res.MessageType == WebSocketMessageType.Close) { MarcarDesconectado(socket); break; }
                acc.Append(Encoding.UTF8.GetString(buf, 0, res.Count));
                if (!res.EndOfMessage) continue;

                var texto = acc.ToString();
                acc.Clear();
                TratarMensagem(texto, socket);
            }
        }
        catch (OperationCanceledException) { /* encerrando */ }
        catch { MarcarDesconectado(socket); }
    }

    // Interpreta uma mensagem do servidor:
    //   • phx_reply ok NO NOSSO topic com o ref do NOSSO join  => entrou no canal (online).
    //   • phx_reply no topic "phoenix"                          => resposta do heartbeat (viva).
    //   • phx_error / phx_close no nosso topic                  => saiu do canal (offline).
    private void TratarMensagem(string texto, IRealtimeSocket socket)
    {
        try
        {
            using var doc = JsonDocument.Parse(texto);
            var root = doc.RootElement;
            string? evento = root.TryGetProperty("event", out var ev) ? ev.GetString() : null;
            string? topic  = root.TryGetProperty("topic", out var tp) ? tp.GetString() : null;
            string? refMsg = root.TryGetProperty("ref",   out var rf) && rf.ValueKind == JsonValueKind.String ? rf.GetString() : null;

            switch (evento)
            {
                case "phx_reply":
                    bool ok = root.TryGetProperty("payload", out var pl) &&
                              pl.TryGetProperty("status", out var st) && st.GetString() == "ok";
                    // Resposta do heartbeat (topic phoenix): a conexão respondeu, não está meia-aberta.
                    if (topic == "phoenix") { _heartbeatPendente = false; break; }
                    // Confirmação da entrada: SÓ o nosso topic + o ref do NOSSO join. Um phx_reply
                    // de outra coisa (ou de uma conexão velha) não liga o online por engano.
                    if (ok && topic == _topic && refMsg == _joinRef && ReferenceEquals(_ws, socket))
                        _joined = true;
                    break;

                case "phx_error":
                case "phx_close":
                    // Servidor recusou/fechou o NOSSO canal => offline (a religação do dono do
                    // laço da nuvem dispara porque Online passa a ser false).
                    if (topic == _topic || topic is null) MarcarDesconectado(socket);
                    break;
            }
        }
        catch { /* mensagem que não interessa — ignora, não derruba o laço */ }
    }

    private async Task HeartbeatLoopAsync(IRealtimeSocket socket, CancellationToken ct)
    {
        try
        {
            while (!ct.IsCancellationRequested && socket.State == WebSocketState.Open)
            {
                await Task.Delay(_heartbeatIntervalo, ct).ConfigureAwait(false);

                // O heartbeat anterior nunca voltou => conexão meia-aberta (o socket escreve mas
                // o outro lado morreu). PublishAsync devolveria true escrevendo no vácuo e o
                // ao-vivo se perdia em silêncio. Derruba o online pra a religação agir.
                if (_heartbeatPendente) { MarcarDesconectado(socket); break; }

                _heartbeatPendente = true;
                try
                {
                    await SendRawAsync(new Dictionary<string, object?>
                    {
                        ["topic"] = "phoenix", ["event"] = "heartbeat",
                        ["payload"] = new { }, ["ref"] = NextRef(),
                    }, ct).ConfigureAwait(false);
                }
                catch { MarcarDesconectado(socket); break; }
            }
        }
        catch (OperationCanceledException) { /* encerrando */ }
    }

    private async Task DisposeSocketAsync()
    {
        // L5: Cancel + Dispose (antes só Cancel) — cada religação criava um CTS linkado
        // novo e o anterior ficava registrado no token pai pra sempre (vazamento por
        // reconexão). Cancelar primeiro acorda os laços; descartar solta o registro.
        try { _bg?.Cancel(); } catch { }
        try { _bg?.Dispose(); } catch { }
        _bg = null;
        var ws = _ws;
        if (ws is not null)
        {
            try
            {
                if (ws.State == WebSocketState.Open)
                    await ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "bye", CancellationToken.None).ConfigureAwait(false);
            }
            catch { /* já caiu */ }
            ws.Dispose();
            _ws = null;
        }
        _joined = false;
        _heartbeatPendente = false;
    }

    public async ValueTask DisposeAsync()
    {
        await DisposeSocketAsync().ConfigureAwait(false);
        _sendLock.Dispose();
        _bg?.Dispose();
    }
}
