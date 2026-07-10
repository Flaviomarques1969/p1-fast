// Prova do FIO da nuvem (SupabaseRealtimeChannel) SEM rede real, com um WebSocket-fake.
//
// A classe nasceu com ZERO testes e um furo grave (auditoria 2026-07-09): QUALQUER
// phx_reply ok — inclusive o do heartbeat — ligava o Online, e phx_error/phx_close/
// heartbeat-sem-resposta não o derrubavam. Resultado: o publisher achava que entregou e
// o ao-vivo se perdia em SILÊNCIO ("online, enviadas N" com nada chegando no app).
//
// Estes testes fixam o contrato: Online só liga com o phx_reply ok NO NOSSO topic e com o
// ref do NOSSO join; e cai com phx_error, phx_close e com heartbeat sem resposta.

using System;
using System.Collections.Generic;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Channels;
using System.Threading.Tasks;
using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class SupabaseRealtimeChannelTests
{
    private const string Url   = "https://exemplo.supabase.co";
    private const string Anon  = "chave-anon-fake";
    private const string Canal = "cockpit-teste";
    private const string Topic = "realtime:cockpit-teste";

    // ── Fake do IRealtimeSocket: guarda o que foi enviado, deixa o teste injetar mensagens
    //    "do servidor" e opcionalmente auto-responder a cada envio (simula o Phoenix). ──
    private sealed class FakeRealtimeSocket : IRealtimeSocket
    {
        private readonly Channel<(WebSocketMessageType Tipo, byte[] Dados)> _entrada =
            Channel.CreateUnbounded<(WebSocketMessageType, byte[])>();

        public WebSocketState State { get; private set; } = WebSocketState.None;
        public List<string> Enviadas { get; } = new();
        /// <summary>Chamado a cada SendAsync com o texto enviado — o teste responde como o servidor.</summary>
        public Action<FakeRealtimeSocket, string>? AoEnviar { get; set; }

        public Task ConnectAsync(Uri uri, CancellationToken ct) { State = WebSocketState.Open; return Task.CompletedTask; }

        public ValueTask SendAsync(ReadOnlyMemory<byte> buffer, WebSocketMessageType messageType, bool endOfMessage, CancellationToken ct)
        {
            var texto = Encoding.UTF8.GetString(buffer.Span);
            lock (Enviadas) Enviadas.Add(texto);
            AoEnviar?.Invoke(this, texto);
            return ValueTask.CompletedTask;
        }

        public async ValueTask<ValueWebSocketReceiveResult> ReceiveAsync(Memory<byte> buffer, CancellationToken ct)
        {
            var (tipo, dados) = await _entrada.Reader.ReadAsync(ct).ConfigureAwait(false);
            if (tipo == WebSocketMessageType.Close)
            {
                State = WebSocketState.CloseReceived;
                return new ValueWebSocketReceiveResult(0, WebSocketMessageType.Close, true);
            }
            new ReadOnlySpan<byte>(dados).CopyTo(buffer.Span); // mensagens de teste cabem no buffer (16 KB)
            return new ValueWebSocketReceiveResult(dados.Length, WebSocketMessageType.Text, true);
        }

        public Task CloseAsync(WebSocketCloseStatus closeStatus, string? statusDescription, CancellationToken ct)
        { State = WebSocketState.Closed; return Task.CompletedTask; }

        public void Dispose() { State = WebSocketState.Closed; _entrada.Writer.TryComplete(); }

        // Injeta uma mensagem "vinda do servidor" pro laço de recebimento.
        public void ServidorEnvia(string json) => _entrada.Writer.TryWrite((WebSocketMessageType.Text, Encoding.UTF8.GetBytes(json)));
        public void ServidorFecha() => _entrada.Writer.TryWrite((WebSocketMessageType.Close, Array.Empty<byte>()));
    }

    private static string RefDe(string mensagemEnviada)
    {
        using var doc = JsonDocument.Parse(mensagemEnviada);
        return doc.RootElement.GetProperty("ref").GetString()!;
    }
    private static string Evento(string mensagemEnviada)
    {
        using var doc = JsonDocument.Parse(mensagemEnviada);
        return doc.RootElement.GetProperty("event").GetString()!;
    }

    private static string ReplyOk(string topic, string @ref) =>
        $"{{\"topic\":\"{topic}\",\"event\":\"phx_reply\",\"ref\":\"{@ref}\",\"payload\":{{\"status\":\"ok\"}}}}";
    private static string ReplyErro(string topic, string @ref) =>
        $"{{\"topic\":\"{topic}\",\"event\":\"phx_reply\",\"ref\":\"{@ref}\",\"payload\":{{\"status\":\"error\"}}}}";

    private static async Task<bool> AteAsync(Func<bool> cond, int timeoutMs = 3000)
    {
        var fim = Environment.TickCount64 + timeoutMs;
        while (Environment.TickCount64 < fim)
        {
            if (cond()) return true;
            await Task.Delay(10).ConfigureAwait(false);
        }
        return cond();
    }

    private static SupabaseRealtimeChannel Criar(FakeRealtimeSocket fake, int heartbeatMs = 25_000) =>
        new(Url, Anon, Canal, socketFactory: () => fake, heartbeatIntervalo: TimeSpan.FromMilliseconds(heartbeatMs));

    // ── 1) Join ok no NOSSO topic + ref => Online liga. ──
    [Fact]
    public async Task JoinOk_NoNossoTopicComNossoRef_LigaOnline()
    {
        var fake = new FakeRealtimeSocket
        {
            // servidor responde ok ao NOSSO join (topic + ref corretos)
            AoEnviar = (s, msg) => { if (Evento(msg) == "phx_join") s.ServidorEnvia(ReplyOk(Topic, RefDe(msg))); }
        };
        await using var canal = Criar(fake);
        await canal.ConnectAsync(CancellationToken.None);

        Assert.True(await AteAsync(() => canal.Online), "Online deveria ligar com o phx_reply ok do nosso join");
    }

    // ── 2) O BUG: heartbeat reply (topic phoenix) SOZINHO não pode ligar o Online. ──
    [Fact]
    public async Task HeartbeatReplyOk_SemJoinAceito_NaoLigaOnline()
    {
        var fake = new FakeRealtimeSocket
        {
            AoEnviar = (s, msg) =>
            {
                var ev = Evento(msg);
                if (ev == "phx_join") s.ServidorEnvia(ReplyErro(Topic, RefDe(msg)));   // join RECUSADO
                if (ev == "heartbeat") s.ServidorEnvia(ReplyOk("phoenix", RefDe(msg))); // mas o heartbeat responde ok
            }
        };
        await using var canal = Criar(fake, heartbeatMs: 40);
        await canal.ConnectAsync(CancellationToken.None);

        // Dá tempo pra vários heartbeats responderem ok — nenhum pode ligar o Online.
        await Task.Delay(200);
        Assert.False(canal.Online, "phx_reply ok do heartbeat (topic phoenix) NÃO pode ligar o Online");
    }

    // ── 3) phx_reply ok com ref ERRADO (não é o do nosso join) não liga o Online. ──
    [Fact]
    public async Task ReplyOk_ComRefErrado_NaoLigaOnline()
    {
        var fake = new FakeRealtimeSocket
        {
            AoEnviar = (s, msg) => { if (Evento(msg) == "phx_join") s.ServidorEnvia(ReplyOk(Topic, "999")); }
        };
        await using var canal = Criar(fake);
        await canal.ConnectAsync(CancellationToken.None);

        await Task.Delay(150);
        Assert.False(canal.Online, "só o ref do NOSSO join confirma a entrada");
    }

    // ── 4) phx_close do servidor derruba o Online (antes ficava true eterno). ──
    [Fact]
    public async Task PhxClose_DerrubaOnline()
    {
        var fake = new FakeRealtimeSocket
        {
            AoEnviar = (s, msg) => { if (Evento(msg) == "phx_join") s.ServidorEnvia(ReplyOk(Topic, RefDe(msg))); }
        };
        await using var canal = Criar(fake);
        await canal.ConnectAsync(CancellationToken.None);
        Assert.True(await AteAsync(() => canal.Online));

        fake.ServidorEnvia($"{{\"topic\":\"{Topic}\",\"event\":\"phx_close\",\"ref\":null,\"payload\":{{}}}}");
        Assert.True(await AteAsync(() => !canal.Online), "phx_close tem que derrubar o Online");
    }

    // ── 5) phx_error do servidor derruba o Online. ──
    [Fact]
    public async Task PhxError_DerrubaOnline()
    {
        var fake = new FakeRealtimeSocket
        {
            AoEnviar = (s, msg) => { if (Evento(msg) == "phx_join") s.ServidorEnvia(ReplyOk(Topic, RefDe(msg))); }
        };
        await using var canal = Criar(fake);
        await canal.ConnectAsync(CancellationToken.None);
        Assert.True(await AteAsync(() => canal.Online));

        fake.ServidorEnvia($"{{\"topic\":\"{Topic}\",\"event\":\"phx_error\",\"ref\":null,\"payload\":{{}}}}");
        Assert.True(await AteAsync(() => !canal.Online), "phx_error tem que derrubar o Online");
    }

    // ── 6) Heartbeat SEM resposta (conexão meia-aberta) derruba o Online. ──
    [Fact]
    public async Task HeartbeatSemResposta_DerrubaOnline()
    {
        var fake = new FakeRealtimeSocket
        {
            // responde ao join, mas NUNCA ao heartbeat (o outro lado morreu, o socket "escreve" no vácuo)
            AoEnviar = (s, msg) => { if (Evento(msg) == "phx_join") s.ServidorEnvia(ReplyOk(Topic, RefDe(msg))); }
        };
        await using var canal = Criar(fake, heartbeatMs: 60);
        await canal.ConnectAsync(CancellationToken.None);
        Assert.True(await AteAsync(() => canal.Online));

        // 1º heartbeat vai (fica pendente), 2º ciclo vê pendente e derruba.
        Assert.True(await AteAsync(() => !canal.Online, 2000), "heartbeat sem resposta tem que derrubar o Online");
    }

    // ── 7) Com heartbeat RESPONDIDO, o Online se mantém (não derruba um saudável). ──
    [Fact]
    public async Task HeartbeatRespondido_MantemOnline()
    {
        var fake = new FakeRealtimeSocket
        {
            AoEnviar = (s, msg) =>
            {
                var ev = Evento(msg);
                if (ev == "phx_join") s.ServidorEnvia(ReplyOk(Topic, RefDe(msg)));
                if (ev == "heartbeat") s.ServidorEnvia(ReplyOk("phoenix", RefDe(msg)));
            }
        };
        await using var canal = Criar(fake, heartbeatMs: 250);
        await canal.ConnectAsync(CancellationToken.None);
        Assert.True(await AteAsync(() => canal.Online));

        // Espera por CONTAGEM de heartbeats, não por relógio: o canal só envia o N+1 se o N foi
        // respondido a tempo — 3 enviados com o Online de pé provam o ciclo saudável. (A versão
        // com intervalo de 50 ms + Task.Delay fixo flakeava sob carga do runner: a thread do laço
        // de recebimento perdia a fatia e o tick seguinte via o heartbeat "pendente".)
        bool TresHeartbeats()
        {
            lock (fake.Enviadas) return fake.Enviadas.Count(m => Evento(m) == "heartbeat") >= 3;
        }
        Assert.True(await AteAsync(TresHeartbeats, timeoutMs: 5000), "esperava 3 heartbeats respondidos");
        Assert.True(canal.Online, "conexão saudável não pode ser derrubada");
    }

    // ── 8) Online => Publish entrega o broadcast; offline => Publish recusa (não mente). ──
    [Fact]
    public async Task Publish_SoEntregaOnline()
    {
        var fake = new FakeRealtimeSocket
        {
            AoEnviar = (s, msg) => { if (Evento(msg) == "phx_join") s.ServidorEnvia(ReplyOk(Topic, RefDe(msg))); }
        };
        await using var canal = Criar(fake);

        // Antes de conectar: offline, recusa.
        Assert.False(await canal.PublishAsync("sample", new { rpm = 1000 }, CancellationToken.None));

        await canal.ConnectAsync(CancellationToken.None);
        Assert.True(await AteAsync(() => canal.Online));

        Assert.True(await canal.PublishAsync("sample", new { rpm = 4000 }, CancellationToken.None));
        bool mandouBroadcast;
        lock (fake.Enviadas) mandouBroadcast = fake.Enviadas.Exists(m => m.Contains("\"event\":\"broadcast\""));
        Assert.True(mandouBroadcast, "o broadcast tem que ter ido pro socket");
    }
}
