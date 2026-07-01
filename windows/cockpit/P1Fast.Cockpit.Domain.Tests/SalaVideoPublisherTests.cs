// Prova da peça 3 (POST do .exe, Opção A): no início do stint o .exe manda o payload
// AUMENTADO (formato 2 do contrato) pro fam-racing, com chaves EXATAS e best-effort.

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
    // Poster falso: captura a última chamada (ou explode, pro teste de best-effort).
    private sealed class FakePoster : IHttpPoster
    {
        public string? Url;
        public string? Body;
        public bool Retorno = true;
        public bool Explode;
        public int Chamadas;

        public Task<bool> PostJsonAsync(string url, string jsonBody, CancellationToken ct)
        {
            Chamadas++;
            if (Explode) throw new InvalidOperationException("rede fora (simulada)");
            Url = url; Body = jsonBody;
            return Task.FromResult(Retorno);
        }
    }

    private static PonteiroDados Ponteiro(string status = "gravando") => new(
        SessaoId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        StartedAt: 1_700_000_000_000,
        EventId: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
        TimeId: "tttttttt-tttt-tttt-tttt-tttttttttttt",
        Status: status);

    [Fact]
    public void MontarPayload_FormatoDoContrato_camelCase()
    {
        var pub = new SalaVideoPublisher(new FakePoster(), dateISO: _ => "2026-06-21");
        using var doc = JsonDocument.Parse(pub.MontarPayload(Ponteiro()));
        var r = doc.RootElement;

        Assert.Equal("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee", r.GetProperty("eventId").GetString());
        Assert.Equal("2026-06-21", r.GetProperty("dateISO").GetString());
        Assert.Equal("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", r.GetProperty("sessaoId").GetString());
        Assert.Equal("tttttttt-tttt-tttt-tttt-tttttttttttt", r.GetProperty("timeId").GetString());
        Assert.Equal(1_700_000_000_000, r.GetProperty("startedAt").GetInt64());   // número, não string
        Assert.Equal(5, Count(r));   // exatamente as 5 chaves do formato 2
    }

    private static int Count(JsonElement o) { int n = 0; foreach (var _ in o.EnumerateObject()) n++; return n; }

    [Fact]
    public async Task AbrirSala_POSTa_NoBackendPadrao_ComOPayload()
    {
        var poster = new FakePoster();
        var pub = new SalaVideoPublisher(poster, dateISO: _ => "2026-06-21");

        var ok = await pub.AbrirSalaAsync(Ponteiro());

        Assert.True(ok);
        Assert.Equal(1, poster.Chamadas);
        Assert.Equal(SalaVideoPublisher.RoomBackendPadrao, poster.Url);
        Assert.Equal(pub.MontarPayload(Ponteiro()), poster.Body);
    }

    [Fact]
    public async Task AbrirSala_BestEffort_EngoleFalhaDeRede()
    {
        var pub = new SalaVideoPublisher(new FakePoster { Explode = true });
        var ok = await pub.AbrirSalaAsync(Ponteiro());   // não lança
        Assert.False(ok);
    }

    [Fact]
    public async Task AbrirSala_UrlCustomizada_Respeitada()
    {
        var poster = new FakePoster();
        var pub = new SalaVideoPublisher(poster, url: "https://exemplo.test/room", dateISO: _ => "2026-06-21");
        await pub.AbrirSalaAsync(Ponteiro());
        Assert.Equal("https://exemplo.test/room", poster.Url);
    }
}
