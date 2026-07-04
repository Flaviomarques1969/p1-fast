// Prova do leitor REST (PlanoStintReader) com um HttpMessageHandler falso — sem rede
// real. Cobre: 200 com plano do dia → plano; a REQUISIÇÃO certa (GET, URL, query,
// apikey + Bearer); e a TOLERÂNCIA (HTTP != 2xx, rede caindo, carroId vazio, fora do
// dia → null, NUNCA lança). A decisão de conteúdo já é provada em PlanoStintTests.

using System.Net;
using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class PlanoStintReaderTests
{
    private sealed class FakeHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, HttpResponseMessage> _responder;
        public HttpRequestMessage? UltimaRequisicao { get; private set; }

        public FakeHandler(Func<HttpRequestMessage, HttpResponseMessage> responder) => _responder = responder;

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            UltimaRequisicao = request;
            return Task.FromResult(_responder(request));
        }
    }

    private const string HojeIso = "2026-07-03T23:00:00Z";
    private const string CorpoValido = """
    [{ "created_at":"2026-07-03T14:30:00Z",
       "plano_stint": { "proposito":"treinar", "foco":"frenagem", "voltas":10,
                        "paradas":[{"volta":5,"motivo":"pneus"}] } }]
    """;

    private static HttpResponseMessage Ok(string corpo)
        => new(HttpStatusCode.OK) { Content = new StringContent(corpo) };

    [Fact]
    public async Task DuzentosComPlanoDoDia_DevolvePlano()
    {
        var reader = new PlanoStintReader(new HttpClient(new FakeHandler(_ => Ok(CorpoValido))), "chave-de-teste");

        var plano = await reader.BuscarAsync(PlanoStintReader.CarroIdBubi, agoraIso: HojeIso);

        Assert.NotNull(plano);
        Assert.Equal(10, plano!.Voltas);
    }

    [Fact]
    public async Task Requisicao_EhGet_ComUrlHeadersEQuery()
    {
        var handler = new FakeHandler(_ => Ok(CorpoValido));
        var reader = new PlanoStintReader(new HttpClient(handler), "chave-de-teste");

        await reader.BuscarAsync(PlanoStintReader.CarroIdBubi, agoraIso: HojeIso);

        var req = handler.UltimaRequisicao!;
        Assert.Equal(HttpMethod.Get, req.Method);
        var url = req.RequestUri!.ToString();
        Assert.Contains("/rest/v1/envelopes_seguranca_stint", url);
        Assert.Contains($"carro_id=eq.{PlanoStintReader.CarroIdBubi}", url);
        Assert.Contains("order=created_at.desc", url);
        Assert.Contains("limit=1", url);
        Assert.Contains("chave-de-teste", req.Headers.GetValues("apikey"));
        Assert.Equal("Bearer", req.Headers.Authorization!.Scheme);
        Assert.Equal("chave-de-teste", req.Headers.Authorization.Parameter);
    }

    [Fact]
    public async Task CarroId_ComCaractereReservado_EhEscapadoNaQuery()
    {
        // Prova que Uri.EscapeDataString está de fato ligado: um carroId com espaço e '&'
        // tem que sair %-encoded na query (senão o '&' quebraria a query silenciosamente).
        // Os outros testes só passam o UUID cru (sem char reservado), onde escapar é no-op.
        var handler = new FakeHandler(_ => Ok(CorpoValido));
        var reader = new PlanoStintReader(new HttpClient(handler), "chave");

        await reader.BuscarAsync("a b&c", agoraIso: HojeIso);

        var url = handler.UltimaRequisicao!.RequestUri!.AbsoluteUri; // AbsoluteUri preserva o %-encoding
        Assert.Contains("carro_id=eq.a%20b%26c", url);
        Assert.DoesNotContain("a b&c", url); // o valor cru NÃO vaza pra query
    }

    [Fact]
    public async Task HttpErro_DevolveNull_SemLancar()
    {
        var reader = new PlanoStintReader(
            new HttpClient(new FakeHandler(_ => new HttpResponseMessage(HttpStatusCode.InternalServerError))), "chave");
        Assert.Null(await reader.BuscarAsync(PlanoStintReader.CarroIdBubi, agoraIso: HojeIso));
    }

    [Fact]
    public async Task RedeCai_DevolveNull_SemLancar()
    {
        var reader = new PlanoStintReader(
            new HttpClient(new FakeHandler(_ => throw new HttpRequestException("sem rede"))), "chave");
        Assert.Null(await reader.BuscarAsync(PlanoStintReader.CarroIdBubi, agoraIso: HojeIso));
    }

    [Fact]
    public async Task CarroIdVazio_DevolveNull_SemChamarRede()
    {
        var chamou = false;
        var reader = new PlanoStintReader(
            new HttpClient(new FakeHandler(_ => { chamou = true; return Ok(CorpoValido); })), "chave");

        Assert.Null(await reader.BuscarAsync("   ", agoraIso: HojeIso));
        Assert.False(chamou); // nem toca a rede com carroId vazio
    }

    [Fact]
    public async Task ForaDoDia_DevolveNull()
    {
        var corpoOntem = CorpoValido.Replace("2026-07-03T14:30:00Z", "2026-07-02T14:30:00Z");
        var reader = new PlanoStintReader(new HttpClient(new FakeHandler(_ => Ok(corpoOntem))), "chave");
        Assert.Null(await reader.BuscarAsync(PlanoStintReader.CarroIdBubi, agoraIso: HojeIso));
    }

    [Fact]
    public async Task BuscarBarra_DevolveOsBlocos()
    {
        var reader = new PlanoStintReader(new HttpClient(new FakeHandler(_ => Ok(CorpoValido))), "chave");

        var barra = await reader.BuscarBarraAsync(PlanoStintReader.CarroIdBubi, slots: 12, agoraIso: HojeIso);

        Assert.NotNull(barra);
        Assert.Equal(TipoVoltaStint.Aquecimento, barra![0]);
        Assert.Equal(TipoVoltaStint.Box, barra[4]);
        Assert.Equal(TipoVoltaStint.CoolDown, barra[9]);
    }

    [Fact]
    public async Task Log_RegistraDiagnostico()
    {
        var logs = new List<string>();
        var reader = new PlanoStintReader(new HttpClient(new FakeHandler(_ => Ok(CorpoValido))), "chave", log: logs.Add);

        await reader.BuscarAsync(PlanoStintReader.CarroIdBubi, agoraIso: HojeIso);

        Assert.Contains(logs, l => l.Contains("plano do dia carregado"));
    }

    [Fact]
    public void DoAmbiente_SemChave_DevolveNull_ComChave_Cria()
    {
        var original = Environment.GetEnvironmentVariable("P1FAST_SUPABASE_ANON");
        try
        {
            Environment.SetEnvironmentVariable("P1FAST_SUPABASE_ANON", null);
            Assert.Null(PlanoStintReader.DoAmbiente(new HttpClient(new FakeHandler(_ => Ok("[]")))));

            Environment.SetEnvironmentVariable("P1FAST_SUPABASE_ANON", "chave-do-ambiente");
            Assert.NotNull(PlanoStintReader.DoAmbiente(new HttpClient(new FakeHandler(_ => Ok("[]")))));
        }
        finally
        {
            Environment.SetEnvironmentVariable("P1FAST_SUPABASE_ANON", original);
        }
    }

    [Fact]
    public async Task DoAmbiente_UrlDaEnv_RedirecionaAsRequisicoes()
    {
        // Override P1FAST_SUPABASE_URL (validação local com stub, 2026-07-04): a
        // requisição tem que ir pra URL da env, não pra produção.
        var origAnon = Environment.GetEnvironmentVariable("P1FAST_SUPABASE_ANON");
        var origUrl  = Environment.GetEnvironmentVariable("P1FAST_SUPABASE_URL");
        try
        {
            Environment.SetEnvironmentVariable("P1FAST_SUPABASE_ANON", "chave-do-ambiente");
            Environment.SetEnvironmentVariable("P1FAST_SUPABASE_URL", "http://localhost:8123/");

            Uri? chamada = null;
            var http = new HttpClient(new FakeHandler(req => { chamada = req.RequestUri; return Ok("[]"); }));
            var reader = PlanoStintReader.DoAmbiente(http);
            Assert.NotNull(reader);

            await reader!.BuscarAsync(PlanoStintReader.CarroIdBubi);
            Assert.NotNull(chamada);
            Assert.StartsWith("http://localhost:8123/rest/v1/", chamada!.ToString());
        }
        finally
        {
            Environment.SetEnvironmentVariable("P1FAST_SUPABASE_ANON", origAnon);
            Environment.SetEnvironmentVariable("P1FAST_SUPABASE_URL", origUrl);
        }
    }
}
