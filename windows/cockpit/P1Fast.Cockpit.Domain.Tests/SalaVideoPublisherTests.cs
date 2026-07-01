// Prova da peça 3 (POST do .exe): no início do stint o .exe (1) cria a sala no fam-racing
// e (2) registra no cofre chamando o video-registrar DIRETO (header x-registrar-secret,
// SEM apikey/Bearer). Chaves EXATAS, best-effort, e sem segredo só cria a sala.

using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class SalaVideoPublisherTests
{
    private sealed record Chamada(string Url, string Body, IReadOnlyDictionary<string, string>? Headers);

    // Poster falso: registra cada chamada e devolve respostas na ordem configurada.
    private sealed class FakePoster : IHttpPoster
    {
        public readonly List<Chamada> Chamadas = new();
        public readonly Queue<HttpResposta> Respostas = new();
        public bool Explode;

        public Task<HttpResposta> PostJsonAsync(string url, string jsonBody, IReadOnlyDictionary<string, string>? headers, CancellationToken ct)
        {
            if (Explode) throw new InvalidOperationException("rede fora (simulada)");
            Chamadas.Add(new Chamada(url, jsonBody, headers));
            var r = Respostas.Count > 0 ? Respostas.Dequeue() : new HttpResposta(true, 200, "{}");
            return Task.FromResult(r);
        }
    }

    // Resposta REAL do fam-racing: roomName no topo (eventId truncado + data sem hífens),
    // roomUrl com o MESMO nome. O nome NÃO é o derivado (`evento-EV-2026-06-21`).
    private static readonly string RoomOk = "{\"ok\":true,\"roomName\":\"evento-EV-20260621\",\"roomUrl\":\"https://fam-racing.daily.co/evento-EV-20260621\",\"tokenPiloto\":\"x\",\"tokenBox\":\"y\",\"exp\":1}";

    private static PonteiroDados Ponteiro() => new(
        SessaoId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        StartedAt: 1_700_000_000_000,
        EventId: "EV",
        TimeId: "TM",
        Status: "gravando");

    // ── payloads ──────────────────────────────────────────────────────────────
    [Fact]
    public void MontarPayloadRoom_FormatoDoContrato_camelCase()
    {
        var pub = new SalaVideoPublisher(new FakePoster(), dateISO: _ => "2026-06-21");
        using var doc = JsonDocument.Parse(pub.MontarPayloadRoom(Ponteiro()));
        var r = doc.RootElement;
        Assert.Equal("EV", r.GetProperty("eventId").GetString());
        Assert.Equal("2026-06-21", r.GetProperty("dateISO").GetString());
        Assert.Equal("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", r.GetProperty("sessaoId").GetString());
        Assert.Equal("TM", r.GetProperty("timeId").GetString());
        Assert.Equal(1_700_000_000_000, r.GetProperty("startedAt").GetInt64());
        Assert.Equal(5, Count(r));
    }

    [Fact]
    public void MontarPayloadRegistrar_CamposDoCofre()
    {
        var pub = new SalaVideoPublisher(new FakePoster(), dateISO: _ => "2026-06-21");
        var json = pub.MontarPayloadRegistrar(Ponteiro(), "evento-EV-2026-06-21", "https://cdai.daily.co/evento-EV-2026-06-21");
        using var doc = JsonDocument.Parse(json);
        var r = doc.RootElement;
        Assert.Equal("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", r.GetProperty("sessaoId").GetString());
        Assert.Equal("TM", r.GetProperty("timeId").GetString());
        Assert.Equal(1_700_000_000_000, r.GetProperty("startedAt").GetInt64());
        Assert.Equal("EV", r.GetProperty("eventId").GetString());
        Assert.Equal("evento-EV-2026-06-21", r.GetProperty("dailyRoomName").GetString());
        Assert.Equal("https://cdai.daily.co/evento-EV-2026-06-21", r.GetProperty("dailyRoomUrl").GetString());
        Assert.Equal(6, Count(r));
    }

    private static int Count(JsonElement o) { int n = 0; foreach (var _ in o.EnumerateObject()) n++; return n; }

    // ── parse do roomUrl ──────────────────────────────────────────────────────
    [Fact]
    public void ExtrairRoomUrl_CampoOficial_roomUrl() =>
        Assert.Equal("https://fam-racing.daily.co/evento-EV-20260621", SalaVideoPublisher.ExtrairRoomUrl(RoomOk));

    [Fact]
    public void ExtrairRoomName_PreferaCampoRoomName()
    {
        // usa o roomName da resposta (nome REAL da sala), NÃO o derivado
        Assert.Equal("evento-EV-20260621", SalaVideoPublisher.ExtrairRoomName(RoomOk));
    }

    [Fact]
    public void ExtrairRoomName_SemCampo_CaiNoUltimoSegmentoDoRoomUrl()
    {
        Assert.Equal("sala-xyz", SalaVideoPublisher.ExtrairRoomName("{\"roomUrl\":\"https://a.daily.co/sala-xyz\"}"));
        Assert.Null(SalaVideoPublisher.ExtrairRoomName("{\"nada\":1}"));
    }

    [Fact]
    public void ExtrairRoomUrl_Defensivo_url_e_roomPontoUrl()
    {
        Assert.Equal("https://a/x", SalaVideoPublisher.ExtrairRoomUrl("{\"url\":\"https://a/x\"}"));
        Assert.Equal("https://a/y", SalaVideoPublisher.ExtrairRoomUrl("{\"room\":{\"url\":\"https://a/y\"}}"));
    }

    [Fact]
    public void ExtrairRoomUrl_SemCampo_ou_Lixo_Null()
    {
        Assert.Null(SalaVideoPublisher.ExtrairRoomUrl("{\"nada\":1}"));
        Assert.Null(SalaVideoPublisher.ExtrairRoomUrl("nao-json"));
        Assert.Null(SalaVideoPublisher.ExtrairRoomUrl(""));
    }

    // ── fluxo do Abrir ────────────────────────────────────────────────────────
    [Fact]
    public async Task AbrirSala_ComSegredo_POSTa_Room_Depois_Registrar()
    {
        var poster = new FakePoster();
        poster.Respostas.Enqueue(new HttpResposta(true, 200, RoomOk));   // resposta do /api/room
        poster.Respostas.Enqueue(new HttpResposta(true, 200, "{\"ok\":true}"));   // resposta do registrar
        var pub = new SalaVideoPublisher(poster, segredo: () => "SEGREDO-123", dateISO: _ => "2026-06-21");

        var ok = await pub.AbrirSalaAsync(Ponteiro());

        Assert.True(ok);
        Assert.Equal(2, poster.Chamadas.Count);
        // 1ª = criar sala (fam-racing), sem header de segredo
        Assert.Equal(SalaVideoPublisher.RoomBackendPadrao, poster.Chamadas[0].Url);
        Assert.Null(poster.Chamadas[0].Headers);
        // 2ª = registrar, COM x-registrar-secret e o payload do cofre
        Assert.Equal(SalaVideoPublisher.RegistrarUrlPadrao, poster.Chamadas[1].Url);
        Assert.Equal("SEGREDO-123", poster.Chamadas[1].Headers!["x-registrar-secret"]);
        using var doc = JsonDocument.Parse(poster.Chamadas[1].Body);
        Assert.Equal("https://fam-racing.daily.co/evento-EV-20260621", doc.RootElement.GetProperty("dailyRoomUrl").GetString());
        // dailyRoomName vem da RESPOSTA (roomName real), não do derivado evento-EV-2026-06-21
        Assert.Equal("evento-EV-20260621", doc.RootElement.GetProperty("dailyRoomName").GetString());
    }

    [Fact]
    public async Task AbrirSala_SemSegredo_SoCriaSala_PulaRegistrar()
    {
        var poster = new FakePoster();
        poster.Respostas.Enqueue(new HttpResposta(true, 200, RoomOk));
        var pub = new SalaVideoPublisher(poster, segredo: () => null, dateISO: _ => "2026-06-21");

        var ok = await pub.AbrirSalaAsync(Ponteiro());

        Assert.True(ok);                       // sala criada
        Assert.Single(poster.Chamadas);        // registrar NÃO foi chamado
        Assert.Equal(SalaVideoPublisher.RoomBackendPadrao, poster.Chamadas[0].Url);
    }

    [Fact]
    public async Task AbrirSala_SalaFalha_NaoRegistra()
    {
        var poster = new FakePoster();
        poster.Respostas.Enqueue(new HttpResposta(false, 502, "erro"));
        var pub = new SalaVideoPublisher(poster, segredo: () => "SEGREDO-123");
        Assert.False(await pub.AbrirSalaAsync(Ponteiro()));
        Assert.Single(poster.Chamadas);        // parou na sala, não registrou
    }

    [Fact]
    public async Task AbrirSala_SemRoomUrlNaResposta_NaoRegistra()
    {
        var poster = new FakePoster();
        poster.Respostas.Enqueue(new HttpResposta(true, 200, "{\"semRoomUrl\":true}"));
        var pub = new SalaVideoPublisher(poster, segredo: () => "SEGREDO-123");
        Assert.False(await pub.AbrirSalaAsync(Ponteiro()));
        Assert.Single(poster.Chamadas);
    }

    [Fact]
    public async Task AbrirSala_BestEffort_EngoleExcecao()
    {
        var pub = new SalaVideoPublisher(new FakePoster { Explode = true }, segredo: () => "x");
        Assert.False(await pub.AbrirSalaAsync(Ponteiro()));   // não lança
    }
}
