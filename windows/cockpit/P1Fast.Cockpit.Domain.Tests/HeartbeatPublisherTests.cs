// Guarda do HeartbeatPublisher.Stop() (auditoria 2026-07-09): Stop() cancela E descarta o
// CTS (antes só cancelava e largava a referência → vazamento a cada Start/Stop) e o loop
// para de fato (não fica um 2º vivo publicando). Sem rede real: um HttpMessageHandler-fake
// conta os envios. OBS: a classe está SEM uso fora de teste — candidata a remoção (ver relatório).

using System.Net;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class HeartbeatPublisherTests
{
    private sealed class ContadorHandler : HttpMessageHandler
    {
        private int _n;
        public int N => Volatile.Read(ref _n);
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Interlocked.Increment(ref _n);
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK));
        }
    }

    private static async Task<bool> AteAsync(System.Func<bool> cond, int timeoutMs = 2000)
    {
        var fim = System.Environment.TickCount64 + timeoutMs;
        while (System.Environment.TickCount64 < fim) { if (cond()) return true; await Task.Delay(10); }
        return cond();
    }

    // Stop() para o loop de fato: nenhum publish depois do Stop (não sobra um 2º loop vivo).
    [Fact]
    public async Task Stop_ParaOLoop_SemPublicarDepois()
    {
        var handler = new ContadorHandler();
        var http = new HttpClient(handler);
        await using var hb = new HeartbeatPublisher(http, "https://x.supabase.co", "anon", () => null);

        hb.Start("stream1", "team1");
        Assert.True(await AteAsync(() => handler.N >= 1), "deveria ter publicado ao menos 1 heartbeat");

        hb.Stop();
        var depoisDoStop = handler.N;
        await Task.Delay(200);
        Assert.Equal(depoisDoStop, handler.N); // parou: nada publicado após o Stop
    }

    // Start/Stop repetidos não vazam em loops sobrepostos nem lançam (o CTS é descartado a cada Stop).
    [Fact]
    public async Task StartStop_Repetido_NaoLanca_ELimpa()
    {
        var handler = new ContadorHandler();
        var http = new HttpClient(handler);
        await using var hb = new HeartbeatPublisher(http, "https://x.supabase.co", "anon", () => null);

        for (int i = 0; i < 5; i++) { hb.Start("s", "t"); hb.Stop(); }
        var n = handler.N;
        await Task.Delay(150);
        Assert.Equal(n, handler.N); // depois do último Stop, nenhum loop remanescente publica
    }
}
