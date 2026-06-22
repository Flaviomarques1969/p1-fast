// Prova PONTA A PONTA do dia de pista, fora do carro: o leitor ao vivo da USB
// (T3000UsbLiveReader, canal-fake) alimenta o gravador blindado (SessionRecorder)
// gravando em DISCO real (FileSessionStore). Depois relê de um store NOVO — prova
// que o dado está no disco, não na memória — e confere integridade.
//
// É exatamente o que o modo --gravar do .exe faz; só a tomada física (porta serial)
// fica de fora (provada na bancada). Se isto passa, o caminho de não-perder-dado
// está provado.

using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class CapturaPontaAPontaTests
{
    private static readonly T3000UsbLiveReaderConfig Fast =
        new(ThrottleMs: 1, ReadTimeoutMs: 1000, ReconnectIntervalMs: 1);

    // Mesmo bloco RI bom usado nos testes do leitor/tradutor (410 bytes).
    private static byte[] BlocoBom(int rpm)
    {
        var b = new byte[410];
        void U16(int o, int v) { b[o] = (byte)(v & 0xFF); b[o + 1] = (byte)((v >> 8) & 0xFF); }
        U16(0, rpm);
        U16(2, 138);
        U16(46, 7);
        U16(52, 55);
        U16(56, 28);
        U16(58, 52);
        U16(62, 896);
        U16(102, 1606);
        return b;
    }

    [Fact]
    public async Task LeitorAteDisco_GravaTudo_EReleSemBuraco()
    {
        var dir = Path.Combine(Path.GetTempPath(), "p1fast-itest-" + Guid.NewGuid().ToString("N"));
        try
        {
            const int N = 25;
            long wall = 1_000_000;
            var store = new FileSessionStore(dir);
            var recorder = new SessionRecorder(store, wall: () => wall);

            var canal = new InMemoryT3000UsbChannel();
            for (int i = 0; i < N; i++) canal.EnqueueBlock(BlocoBom(3000 + i));

            var cts = new CancellationTokenSource();
            cts.CancelAfter(5000); // teto de segurança
            var reader = new T3000UsbLiveReader(
                canal, Fast,
                onSample: s =>
                {
                    wall += 100;            // 100 ms entre amostras (abaixo da lacuna)
                    recorder.Motor(s);
                    if (recorder.Estado().NMotor >= N) cts.Cancel();
                });

            await reader.RunAsync(cts.Token);
            var resumo = recorder.Encerrar("manual");
            store.Dispose(); // fecha os arquivos -> garante tudo no disco

            Assert.NotNull(resumo);
            Assert.Equal(N, resumo!.NMotor);
            Assert.Equal(0, resumo.Dropped);
            Assert.Equal(0, resumo.MaiorLacunaMs);

            // Relê de um store NOVO (outro processo leria assim) — prova de disco.
            using var store2 = new FileSessionStore(dir);
            var regs = store2.LerSessao(resumo.Id);
            Assert.Equal(N, regs.Count);

            var conf = SessionIntegrity.Conferir(resumo.Id, regs);
            Assert.True(conf.SeqContigua);
            Assert.Null(conf.PrimeiraQuebraSeq);
            Assert.Equal(N, conf.Motor);
            Assert.Equal(0, conf.Lacunas);
        }
        finally
        {
            try { Directory.Delete(dir, recursive: true); } catch { /* limpeza best-effort */ }
        }
    }

    [Fact]
    public void SessaoOrfa_RecuperadaNoBoot_SemPerderRegistro()
    {
        var dir = Path.Combine(Path.GetTempPath(), "p1fast-orfa-" + Guid.NewGuid().ToString("N"));
        try
        {
            long wall = 2_000_000;
            // Grava 5 amostras e NÃO encerra (simula notebook caindo sem fechar).
            var store = new FileSessionStore(dir);
            var rec = new SessionRecorder(store, wall: () => wall);
            for (int i = 0; i < 5; i++)
            {
                wall += 100;
                var sample = T3000RIBlockParser.Parse(BlocoBom(3000 + i), i);
                Assert.NotNull(sample);
                rec.Motor(sample!);
            }
            store.Dispose(); // some sem Finalizar -> meta fica "gravando"

            // Novo boot: recupera a órfã ANTES de qualquer dado novo.
            using var store2 = new FileSessionStore(dir);
            var rec2 = new SessionRecorder(store2);
            var orfas = rec2.RecuperarOrfas();

            Assert.Single(orfas);
            Assert.Equal("interrompida", orfas[0].Status);
            Assert.Equal(5, orfas[0].NMotor);

            // Os 5 registros continuam no disco (append-only nunca apaga).
            var regs = store2.LerSessao(orfas[0].Id);
            Assert.Equal(5, regs.Count);
            Assert.True(SessionIntegrity.Conferir(orfas[0].Id, regs).SeqContigua);
        }
        finally
        {
            try { Directory.Delete(dir, recursive: true); } catch { /* limpeza best-effort */ }
        }
    }
}
