// Prova da peça a2: o evento-corrente.json (config do dia) sai no formato EXATO do contrato
// e é escrito atômico. É daqui que o servidor local deriva a sala do dia desde o load.

using System;
using System.IO;
using System.Text.Json;
using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class EventoCorrenteTests
{
    [Fact]
    public void Serializar_ChavesExatas_camelCase()
    {
        var json = EventoCorrenteJson.Serializar(new EventoCorrenteDados(
            "4ff84907-8697-4c51-a0c6-0ad78794bb35",
            "c027a716-dc05-4d3c-9b8f-59f288d5e12c",
            "2026-06-20"));
        using var doc = JsonDocument.Parse(json);
        var r = doc.RootElement;
        Assert.Equal("4ff84907-8697-4c51-a0c6-0ad78794bb35", r.GetProperty("eventId").GetString());
        Assert.Equal("c027a716-dc05-4d3c-9b8f-59f288d5e12c", r.GetProperty("timeId").GetString());
        Assert.Equal("2026-06-20", r.GetProperty("dateISO").GetString());
        int n = 0; foreach (var _ in r.EnumerateObject()) n++;
        Assert.Equal(3, n);   // exatamente as 3 chaves do contrato
    }

    [Fact]
    public void ArquivoSink_EscreveReleAtomico_SemDeixarTmp()
    {
        var dir = Path.Combine(Path.GetTempPath(), "p1fast-ev-" + Guid.NewGuid().ToString("N"));
        try
        {
            var caminho = Path.Combine(dir, "evento-corrente.json");
            var sink = new ArquivoEventoCorrenteSink(caminho);   // cria o diretório

            sink.Escrever(new EventoCorrenteDados("EV1", "TM1", "2026-06-20"));
            using (var doc = JsonDocument.Parse(File.ReadAllText(caminho)))
                Assert.Equal("EV1", doc.RootElement.GetProperty("eventId").GetString());

            // sobrescreve (novo dia/evento) — substituição inteira, sem lixo .tmp
            sink.Escrever(new EventoCorrenteDados("EV2", "TM2", "2026-06-21"));
            using (var doc = JsonDocument.Parse(File.ReadAllText(caminho)))
                Assert.Equal("EV2", doc.RootElement.GetProperty("eventId").GetString());
            Assert.False(File.Exists(caminho + ".tmp"));
        }
        finally { Directory.Delete(dir, true); }
    }
}
