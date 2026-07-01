// Prova da peça 2 (ponteiro de vídeo): o .exe escreve ~/p1fast-sessoes/sessao-corrente.json
// no formato EXATO do contrato (formato 1), atômico, e o SessionRecorder dispara o
// ponteiro em "gravando" (abriu o stint) e "encerrada" (fechou o stint).

using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class PonteiroSessaoTests
{
    private static T3000Sample MotorSample(int rpm) => new() { Rpm = rpm, Source = "t3000-usb" };

    // Sink de memória: guarda o último ponteiro escrito (pros testes do recorder).
    private sealed class MemPonteiroSink : IPonteiroSink
    {
        public readonly List<PonteiroDados> Escritos = new();
        public void Escrever(PonteiroDados p) => Escritos.Add(p);
    }

    [Fact]
    public void Serializar_ChavesExatasDoContrato_camelCase()
    {
        var p = new PonteiroDados("11111111-1111-1111-1111-111111111111", 1_700_000_000_000,
                                  "22222222-2222-2222-2222-222222222222",
                                  "33333333-3333-3333-3333-333333333333", "gravando");
        using var doc = JsonDocument.Parse(PonteiroJson.Serializar(p));
        var r = doc.RootElement;

        // as 5 chaves EXATAS que a página de campo espera (formato 1 do contrato)
        Assert.Equal("11111111-1111-1111-1111-111111111111", r.GetProperty("sessaoId").GetString());
        Assert.Equal(1_700_000_000_000, r.GetProperty("startedAt").GetInt64());   // número, não string
        Assert.Equal("22222222-2222-2222-2222-222222222222", r.GetProperty("eventId").GetString());
        Assert.Equal("33333333-3333-3333-3333-333333333333", r.GetProperty("timeId").GetString());
        Assert.Equal("gravando", r.GetProperty("status").GetString());
        Assert.Equal(5, CountProps(r));   // nada a mais, nada a menos
    }

    private static int CountProps(JsonElement obj)
    {
        int n = 0;
        foreach (var _ in obj.EnumerateObject()) n++;
        return n;
    }

    [Fact]
    public void ArquivoSink_EscreveReleAtomico_SemDeixarTmp()
    {
        var dir = Path.Combine(Path.GetTempPath(), "p1fast-pont-" + Guid.NewGuid().ToString("N"));
        try
        {
            var caminho = Path.Combine(dir, "sessao-corrente.json");
            var sink = new ArquivoPonteiroSink(caminho);   // cria o diretório

            sink.Escrever(new PonteiroDados("id-A", 100, "ev", "tm", "gravando"));
            Assert.True(File.Exists(caminho));
            using (var doc = JsonDocument.Parse(File.ReadAllText(caminho)))
                Assert.Equal("gravando", doc.RootElement.GetProperty("status").GetString());

            // sobrescreve por cima (mesmo sessão, agora encerrada) — substituição inteira
            sink.Escrever(new PonteiroDados("id-A", 100, "ev", "tm", "encerrada"));
            using (var doc = JsonDocument.Parse(File.ReadAllText(caminho)))
            {
                Assert.Equal("encerrada", doc.RootElement.GetProperty("status").GetString());
                Assert.Equal("id-A", doc.RootElement.GetProperty("sessaoId").GetString());
            }

            // não deixou lixo .tmp pra trás (rename consumiu)
            Assert.False(File.Exists(caminho + ".tmp"));
        }
        finally { Directory.Delete(dir, true); }
    }

    [Fact]
    public void Recorder_DisparaGravandoNoAbrir_EEncerradaNoEncerrar()
    {
        var sink = new MemPonteiroSink();
        long wall = 1_700_000_000_000;
        // eventId/timeId são compostos pela camada de cima (config); aqui o recorder só
        // entrega (sessaoId, startedAt, status) — o teste monta o PonteiroDados como o .exe faz.
        var rec = new SessionRecorder(
            new InMemorySessionStore(),
            wall: () => wall,
            aoStint: (sid, started, status) => sink.Escrever(new PonteiroDados(sid, started, "EV", "TM", status)));

        rec.Motor(MotorSample(3000));            // 1º dado abre o stint → "gravando"
        Assert.Single(sink.Escritos);
        var abriu = sink.Escritos[0];
        Assert.Equal("gravando", abriu.Status);
        Assert.Equal(wall, abriu.StartedAt);          // startedAt = InicioWall (relógio comum)
        Assert.True(Guid.TryParse(abriu.SessaoId, out _), $"sessaoId não é UUID: {abriu.SessaoId}");

        rec.Encerrar();                          // fecha o stint → "encerrada"
        Assert.Equal(2, sink.Escritos.Count);
        var fechou = sink.Escritos[1];
        Assert.Equal("encerrada", fechou.Status);
        Assert.Equal(abriu.SessaoId, fechou.SessaoId);   // mesmo stint
        Assert.Equal(abriu.StartedAt, fechou.StartedAt);
    }

    [Fact]
    public void Recorder_SemPonteiro_NaoQuebra()
    {
        // sem aoStint injetado, o comportamento é o de sempre (nenhum ponteiro, nenhum erro)
        var rec = new SessionRecorder(new InMemorySessionStore());
        rec.Motor(MotorSample(3000));
        var resumo = rec.Encerrar();
        Assert.NotNull(resumo);
    }
}
