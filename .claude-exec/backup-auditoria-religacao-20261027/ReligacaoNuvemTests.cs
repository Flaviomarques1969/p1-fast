// Prova da regra de religação do laço da nuvem (ReligacaoNuvem) SEM rede real.
//
// Bug de campo 2026-10-27 (teste de rua no celular): conectar passava do intervalo de religação
// e o laço derrubava a conexão nova antes de o servidor confirmar a entrada no canal — em laço,
// com internet boa. Aqui o tempo é encolhido 10×: conectar leva 300 ms (no celular, ~3 s) contra
// um intervalo de 200 ms (no cockpit, 2 s); a confirmação chega 150 ms depois do pedido de entrada.

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

public class ReligacaoNuvemTests
{
    private const string Url   = "https://exemplo.supabase.co";
    private const string Anon  = "chave-anon-fake";
    private const string Canal = "cockpit-teste";
    private const string Topic = "realtime:cockpit-teste";

    // Socket de rede lenta: conectar demora; o servidor confirma a entrada depois de um tempo
    // (ou nunca, se Mudo). ServidorFecha simula a queda da conexão (troca de rede).
    private sealed class SocketLento : IRealtimeSocket
    {
        private readonly Channel<byte[]?> _entrada = Channel.CreateUnbounded<byte[]?>();
        public int ConectarMs { get; init; }
        public int ConfirmarEntradaMs { get; init; }
        public bool Mudo { get; init; }
        public bool Falha { get; init; }
        public WebSocketState State { get; private set; } = WebSocketState.None;

        public async Task ConnectAsync(Uri uri, CancellationToken ct)
        {
            await Task.Delay(ConectarMs, ct).ConfigureAwait(false);
            if (Falha) throw new WebSocketException("sem rede");
            State = WebSocketState.Open;
        }

        public ValueTask SendAsync(ReadOnlyMemory<byte> buffer, WebSocketMessageType t, bool fim, CancellationToken ct)
        {
            using var doc = JsonDocument.Parse(Encoding.UTF8.GetString(buffer.Span));
            var r = doc.RootElement;
            if (!Mudo && r.GetProperty("event").GetString() == "phx_join")
            {
                var @ref = r.GetProperty("ref").GetString();
                var reply = $"{{\"topic\":\"{Topic}\",\"event\":\"phx_reply\",\"ref\":\"{@ref}\",\"payload\":{{\"status\":\"ok\"}}}}";
                _ = Task.Delay(ConfirmarEntradaMs).ContinueWith(_ => _entrada.Writer.TryWrite(Encoding.UTF8.GetBytes(reply)));
            }
            return ValueTask.CompletedTask;
        }

        public async ValueTask<ValueWebSocketReceiveResult> ReceiveAsync(Memory<byte> buffer, CancellationToken ct)
        {
            var dados = await _entrada.Reader.ReadAsync(ct).ConfigureAwait(false);
            if (dados is null)
            {
                State = WebSocketState.CloseReceived;
                return new ValueWebSocketReceiveResult(0, WebSocketMessageType.Close, true);
            }
            new ReadOnlySpan<byte>(dados).CopyTo(buffer.Span);
            return new ValueWebSocketReceiveResult(dados.Length, WebSocketMessageType.Text, true);
        }

        public Task CloseAsync(WebSocketCloseStatus s, string? d, CancellationToken ct) { State = WebSocketState.Closed; return Task.CompletedTask; }
        public void Dispose() { State = WebSocketState.Closed; _entrada.Writer.TryComplete(); }
        public void ServidorFecha() => _entrada.Writer.TryWrite(null);
    }

    // Laço igual ao do cockpit (MainWindow.Live.LacoNuvemAsync): gira a cada 40 ms chamando a regra.
    private static async Task GirarLacoAsync(ReligacaoNuvem regra, SupabaseRealtimeChannel canal, int duranteMs)
    {
        var fim = Environment.TickCount64 + duranteMs;
        while (Environment.TickCount64 < fim)
        {
            await regra.GarantirAsync(canal, CancellationToken.None);
            await Task.Delay(40);
        }
    }

    private static ReligacaoNuvem Regra(int esperaEntradaMs = 1500) =>
        new(intervalo: TimeSpan.FromMilliseconds(200), esperaEntrada: TimeSpan.FromMilliseconds(esperaEntradaMs));

    // ── 1) O BUG: rede caiu, a religação no celular demora mais que o intervalo. Tem que ficar
    //    online com UMA conexão nova — o código antigo abria uma atrás da outra e nunca entrava. ──
    [Fact]
    public async Task ConexaoLenta_NaoDerrubaAntesDaConfirmacao_FicaOnlineComUmaReligacao()
    {
        var wifi = new SocketLento { ConectarMs = 0, ConfirmarEntradaMs = 0 };
        var criados = new List<SocketLento>();
        // 1ª conexão = Wi-Fi (rápida); daí em diante = celular (conectar 300 ms, confirmação +150 ms)
        await using var canal = new SupabaseRealtimeChannel(Url, Anon, Canal, socketFactory: () =>
            Add(criados, criados.Count == 0 ? wifi : new SocketLento { ConectarMs = 300, ConfirmarEntradaMs = 150 }),
            heartbeatIntervalo: TimeSpan.FromSeconds(30));

        await canal.ConnectAsync(CancellationToken.None);
        var regra = Regra();
        Assert.True(await Ate(() => canal.Online), "no Wi-Fi entra na hora");

        wifi.ServidorFecha();                              // saiu do Wi-Fi
        Assert.True(await Ate(() => !canal.Online), "queda tem que aparecer como offline");

        await GirarLacoAsync(regra, canal, 2500);

        Assert.True(canal.Online, "no celular tem que voltar a ficar online");
        Assert.Equal(1, regra.Tentativas);                 // uma religação só, sem derrubar a que estava chegando
        Assert.Equal(2, criados.Count);                    // wifi + 1 celular
    }

    // ── 2) Servidor mudo (socket abre, entrada nunca confirmada): não fica preso — religa depois
    //    do prazo de espera da entrada, não antes. ──
    [Fact]
    public async Task ServidorMudo_ReligaSoDepoisDoPrazoDaEntrada()
    {
        var criados = new List<SocketLento>();
        await using var canal = new SupabaseRealtimeChannel(Url, Anon, Canal,
            socketFactory: () => Add(criados, new SocketLento { ConectarMs = 0, Mudo = true }),
            heartbeatIntervalo: TimeSpan.FromSeconds(30));
        var regra = Regra(esperaEntradaMs: 800);
        await canal.ConnectAsync(CancellationToken.None);

        await GirarLacoAsync(regra, canal, 500);
        Assert.Equal(0, regra.Tentativas);                 // dentro do prazo: espera a confirmação
        Assert.True(canal.AguardandoEntrada);

        await GirarLacoAsync(regra, canal, 700);           // passou de 800 ms
        Assert.True(regra.Tentativas >= 1, "servidor mudo além do prazo = religa");
        Assert.False(canal.Online);
    }

    // ── 3) Sem rede nenhuma (conectar falha): tenta de novo a cada intervalo, sem martelar. ──
    [Fact]
    public async Task SemRede_TentaNoIntervaloSemMartelar()
    {
        var criados = new List<SocketLento>();
        await using var canal = new SupabaseRealtimeChannel(Url, Anon, Canal,
            socketFactory: () => Add(criados, new SocketLento { ConectarMs = 50, Falha = true }),
            heartbeatIntervalo: TimeSpan.FromSeconds(30));
        var regra = Regra();

        await GirarLacoAsync(regra, canal, 1300);

        Assert.False(canal.Online);
        Assert.False(canal.AguardandoEntrada);
        // ~1300 / (200 + 50) ≈ 5; o código sem intervalo daria ~14 (uma por giro de 40 ms + 50)
        Assert.InRange(regra.Tentativas, 3, 6);
    }

    private static SocketLento Add(List<SocketLento> lista, SocketLento s) { lock (lista) lista.Add(s); return s; }

    private static async Task<bool> Ate(Func<bool> cond, int timeoutMs = 3000)
    {
        var fim = Environment.TickCount64 + timeoutMs;
        while (Environment.TickCount64 < fim)
        {
            if (cond()) return true;
            await Task.Delay(10);
        }
        return cond();
    }
}
