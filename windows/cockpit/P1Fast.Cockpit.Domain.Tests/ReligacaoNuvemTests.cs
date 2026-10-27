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
        public Action? AoConectar { get; init; }           // ex.: avança o relógio falso
        public bool Descartado { get; private set; }
        public WebSocketState State { get; private set; } = WebSocketState.None;

        public async Task ConnectAsync(Uri uri, CancellationToken ct)
        {
            await Task.Delay(ConectarMs, ct).ConfigureAwait(false);   // -1 = rede que nunca responde
            AoConectar?.Invoke();
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
        public void Dispose() { Descartado = true; State = WebSocketState.Closed; _entrada.Writer.TryComplete(); }
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
    [Fact(Timeout = 10_000)]
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
    [Fact(Timeout = 10_000)]
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
    [Fact(Timeout = 10_000)]
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

    // ── Auditoria 27/10: os buracos que a 1ª bateria não pegava. ──

    // 4) A espera conta do FIM da tentativa (relógio falso, sem depender de tempo de máquina):
    //    conectar levou 3 s e falhou; 1 s depois do fim (4 s depois do começo) ainda NÃO religa.
    [Fact(Timeout = 10_000)]
    public async Task EsperaContaDoFimDaTentativa_NaoDoComeco()
    {
        long relogio = 0;
        await using var canal = new SupabaseRealtimeChannel(Url, Anon, Canal,
            socketFactory: () => new SocketLento { ConectarMs = 0, Falha = true, AoConectar = () => relogio += 3000 },
            heartbeatIntervalo: TimeSpan.FromSeconds(30));
        var regra = new ReligacaoNuvem(TimeSpan.FromSeconds(2), TimeSpan.FromSeconds(10), () => relogio);

        relogio = 2500;
        Assert.True(await regra.GarantirAsync(canal, CancellationToken.None));   // tentou; terminou em 5500
        Assert.Equal(5500, relogio);

        relogio = 6500;                                     // 1 s do fim, 4 s do começo
        Assert.False(regra.DeveReligar(canal), "contar do começo religaria aqui");
        relogio = 7600;                                     // 2,1 s do fim
        Assert.True(regra.DeveReligar(canal));
    }

    // 5) Prazo de conectar: rede que nunca responde ao abrir o socket desiste no prazo.
    [Fact(Timeout = 10_000)]
    public async Task ConectarSemResposta_DesisteNoPrazo()
    {
        var criados = new List<SocketLento>();
        await using var canal = new SupabaseRealtimeChannel(Url, Anon, Canal,
            socketFactory: () => Add(criados, new SocketLento { ConectarMs = -1 }),
            heartbeatIntervalo: TimeSpan.FromSeconds(30), conexaoTimeout: TimeSpan.FromMilliseconds(300));

        var conecta = canal.ConnectAsync(CancellationToken.None);
        Assert.True(await Task.WhenAny(conecta, Task.Delay(3000)) == conecta, "conectar sem resposta tem que desistir sozinho");
        await Assert.ThrowsAsync<TimeoutException>(() => conecta);
        Assert.False(canal.Online);
        Assert.False(canal.Conectando);
        Assert.True(criados[0].Descartado, "socket que não abriu tem que ser descartado");
    }

    // 6) Duas ConnectAsync sobrepostas (conexão inicial lenta + religação): no fim só UM socket
    //    pode estar vivo e, depois do descarte, nenhum. Antes, o da perdedora ficava aberto para sempre.
    [Fact(Timeout = 10_000)]
    public async Task DuasConexoesSobrepostas_NaoDeixamSocketOrfao()
    {
        var criados = new List<SocketLento>();
        var demoras = new Queue<int>(new[] { 600, 300 });
        var canal = new SupabaseRealtimeChannel(Url, Anon, Canal,
            socketFactory: () => Add(criados, new SocketLento { ConectarMs = demoras.Dequeue(), ConfirmarEntradaMs = 10 }),
            heartbeatIntervalo: TimeSpan.FromSeconds(30));

        var a = canal.ConnectAsync(CancellationToken.None);
        await Task.Delay(50);
        Assert.True(canal.Conectando);
        var b = canal.ConnectAsync(CancellationToken.None);
        await Task.WhenAll(a, b);

        Assert.True(await Ate(() => canal.Online));
        lock (criados) Assert.Equal(1, criados.FindAll(s => !s.Descartado).Count);
        await canal.DisposeAsync();
        lock (criados) Assert.All(criados, s => Assert.True(s.Descartado, "socket órfão depois do descarte"));
    }

    // 7) Enquanto uma ConnectAsync está em curso (conexão inicial lenta do console), a regra não
    //    dispara outra — mesmo passado o intervalo.
    [Fact(Timeout = 10_000)]
    public async Task ConexaoEmCurso_RegraNaoEmpilhaOutra()
    {
        var criados = new List<SocketLento>();
        await using var canal = new SupabaseRealtimeChannel(Url, Anon, Canal,
            socketFactory: () => Add(criados, new SocketLento { ConectarMs = 900, ConfirmarEntradaMs = 10 }),
            heartbeatIntervalo: TimeSpan.FromSeconds(30));
        var regra = Regra();
        var inicial = canal.ConnectAsync(CancellationToken.None);

        await GirarLacoAsync(regra, canal, 700);           // intervalo (200 ms) já passou várias vezes
        Assert.Equal(0, regra.Tentativas);
        await inicial;
        Assert.True(await Ate(() => canal.Online));
        Assert.Single(criados);
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
