// Prova da GRAVAÇÃO LOCAL BLINDADA (Fase 2): cada amostra decodificada vai pro
// disco append-only, sobrevive a queda, relê sem buraco, e a falha de gravação
// NUNCA é silenciosa (alarme). Cobre os "pronto quando" do plano da Fase 2 +
// uma prova de ponta a ponta leitor da USB → tradutor → gravação no disco.

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class SessionRecorderTests
{
    // ── auxiliares ────────────────────────────────────────────────────────────
    private static string NovaPasta()
    {
        var dir = Path.Combine(Path.GetTempPath(), "p1fast-rec-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(dir);
        return dir;
    }

    private static T3000Sample MotorSample(int rpm) => new() { Rpm = rpm, Source = "t3000-usb" };

    // 5.6: o gravador é tocado por DOIS fios (Motor no fio do leitor × Tick/Estado no
    // principal). Sem trava, TaxaHz dá RemoveAt na MESMA List que Gravar dá Add → estoura.
    // Este teste martela os dois em paralelo: com a trava interna, NENHUMA exceção escapa.
    [Fact]
    public async Task ThreadSafe_MotorEmParaleloComTickEstado_NaoEstoura()
    {
        var rec = new SessionRecorder(new InMemorySessionStore());
        var cts = new CancellationTokenSource();
        cts.CancelAfter(1500);
        Exception? erro = null;

        var motor = Task.Run(() =>
        {
            try { while (!cts.IsCancellationRequested) rec.Motor(MotorSample(3200)); }
            catch (Exception e) { erro = e; cts.Cancel(); }
        });
        var principal = Task.Run(() =>
        {
            try { while (!cts.IsCancellationRequested) { rec.Estado(); rec.Tick(); _ = rec.SessaoAtualId; } }
            catch (Exception e) { erro = e; cts.Cancel(); }
        });

        await Task.WhenAll(motor, principal);

        Assert.Null(erro);                     // sem a trava, a corrida da List estoura aqui
        Assert.True(rec.Estado().NMotor > 0);  // e o gravador seguiu funcionando
    }

    // Bloco RI bom de 410 bytes (pro teste de ponta a ponta com o leitor real).
    private static byte[] BlocoBom(int rpm)
    {
        var b = new byte[410];
        void U16(int o, int v) { b[o] = (byte)(v & 0xFF); b[o + 1] = (byte)((v >> 8) & 0xFF); }
        U16(0, rpm); U16(2, 138); U16(46, 7); U16(52, 55); U16(56, 28); U16(58, 52);
        U16(62, 896); U16(102, 1606);
        return b;
    }

    // Store que falha SEMPRE na escrita (disco cheio / I/O morto).
    private sealed class FailingSessionStore : ISessionStore
    {
        public void NovaSessao(SessionMeta meta) { }
        public void Gravar(SessionRecord registro) => throw new IOException("disco cheio (simulado)");
        public void Finalizar(string id, SessionResumo resumo) { }
        public SessionResumoParcial ResumirSessao(string id) => new(0, 0, 0, 0, 0);
        public IReadOnlyList<SessionMeta> ListarSessoes() => Array.Empty<SessionMeta>();
        public IReadOnlyList<SessionRecord> LerSessao(string id) => Array.Empty<SessionRecord>();
    }

    // ── testes ────────────────────────────────────────────────────────────────

    [Fact]
    public void GravaEReleSemBuraco_SequenciaIntegra()
    {
        var dir = NovaPasta();
        try
        {
            long wall = 1_700_000_000_000;
            using var store = new FileSessionStore(dir);
            var rec = new SessionRecorder(store, wall: () => wall++);

            for (int i = 0; i < 100; i++) rec.Motor(MotorSample(3000 + i));
            var resumo = rec.Encerrar();

            Assert.NotNull(resumo);
            Assert.Equal(100, resumo!.NMotor);

            var lidos = rec.ExportarSessao(resumo.Id);
            Assert.Equal(100, lidos.Count);
            // sequência contígua 1..100 (relê SEM buraco)
            for (int i = 0; i < 100; i++)
            {
                Assert.Equal(i + 1, (int)lidos[i].Seq);
                Assert.Equal("t4000", lidos[i].Tipo);
                var el = (JsonElement)lidos[i].Dados!;
                Assert.Equal(3000 + i, el.GetProperty("Rpm").GetInt32());
            }
            // tWall (carimbo de captura) preservado e crescente
            Assert.True(lidos[0].TWall < lidos[99].TWall);
            Assert.Null(rec.Estado().Alarme);
        }
        finally { Directory.Delete(dir, true); }
    }

    [Fact]
    public void DiscoCheio_DisparaAlarme_PerdaNuncaSilenciosa()
    {
        var rec = new SessionRecorder(new FailingSessionStore());

        rec.Motor(MotorSample(5000)); // 1ª escrita falha
        Assert.Equal("perdendo-amostras", rec.Estado().Alarme);
        Assert.True(rec.Ativo); // ainda tenta

        for (int i = 0; i < 49; i++) rec.Motor(MotorSample(5000)); // total 50 falhas, 0 sucesso
        var est = rec.Estado();
        Assert.Equal("parada-armazenamento", est.Alarme); // armazenamento morto
        Assert.False(rec.Ativo);
        Assert.Equal(50, est.Dropped);
    }

    [Fact]
    public void RecuperaOrfa_AposQuedaSemFechar_SemPerderDado()
    {
        var dir = NovaPasta();
        try
        {
            string id;
            // sessão 1: grava 10 e "cai" (não encerra; processo morre = Dispose do store)
            {
                var store1 = new FileSessionStore(dir);
                var rec1 = new SessionRecorder(store1);
                for (int i = 0; i < 10; i++) rec1.Motor(MotorSample(4000 + i));
                id = rec1.Estado().SessaoId!;
                store1.Dispose(); // simula o processo terminando sem Encerrar()
            }

            // sessão 2 (boot): recupera a órfã
            using var store2 = new FileSessionStore(dir);
            var rec2 = new SessionRecorder(store2);
            var orfas = rec2.RecuperarOrfas();

            Assert.Single(orfas);
            Assert.Equal("interrompida", orfas[0].Status);
            Assert.Equal(10, orfas[0].NMotor);
            // o dado cru continua íntegro e legível (append-only não perde)
            Assert.Equal(10, rec2.ExportarSessao(id).Count);
            // depois de recuperada, não aparece mais como órfã
            Assert.Empty(rec2.RecuperarOrfas());
        }
        finally { Directory.Delete(dir, true); }
    }

    [Fact]
    public void Lacuna_BuracoNaSessaoFicaRegistrado()
    {
        double mono = 0;
        var rec = new SessionRecorder(new InMemorySessionStore(), now: () => mono);

        rec.Motor(MotorSample(3000));  // abre a sessão em mono=0
        mono = 3000;                   // 3 s sem dado (> 2 s) = lacuna
        rec.Motor(MotorSample(3100));

        Assert.Equal(1, rec.Estado().Lacunas);
    }

    [Fact]
    public void Tick_SemDadoPorMuitoTempo_EncerraSozinho()
    {
        double mono = 0;
        var rec = new SessionRecorder(new InMemorySessionStore(), now: () => mono, silencioMs: 8000);

        rec.Motor(MotorSample(3000)); // sessão aberta
        Assert.True(rec.Gravando);

        mono = 8000;                  // 8 s de silêncio = carro desligou
        var resumo = rec.Tick();

        Assert.NotNull(resumo);
        Assert.Equal("silencio", resumo!.MotivoFim);
        Assert.False(rec.Gravando);
    }

    [Fact]
    public async Task PontaAPonta_LeitorUsbAlimentaGravacaoNoDisco_MesmoSemNuvem()
    {
        // Prova Fase 1 + Fase 2 juntas e o "pronto quando" da queda de internet:
        // NADA neste caminho toca a rede — o leitor da USB decodifica e o gravador
        // salva em disco. Se a nuvem cair, o dado continua íntegro no notebook.
        var dir = NovaPasta();
        try
        {
            using var store = new FileSessionStore(dir);
            var rec = new SessionRecorder(store);

            var canal = new InMemoryT3000UsbChannel();
            canal.EnqueueBlock(BlocoBom(3000));
            canal.EnqueueBlock(BlocoBom(4000));
            canal.EnqueueBlock(BlocoBom(5000));

            int n = 0;
            var cts = new CancellationTokenSource();
            cts.CancelAfter(5000);
            var reader = new T3000UsbLiveReader(
                canal,
                new T3000UsbLiveReaderConfig(ThrottleMs: 1, ReadTimeoutMs: 1000, ReconnectIntervalMs: 1),
                onSample: s => { rec.Motor(s); if (++n >= 3) cts.Cancel(); });

            await reader.RunAsync(cts.Token);
            var resumo = rec.Encerrar();

            Assert.NotNull(resumo);
            Assert.Equal(3, resumo!.NMotor);
            var lidos = rec.ExportarSessao(resumo.Id);
            var rpms = lidos.Select(r => ((JsonElement)r.Dados!).GetProperty("Rpm").GetInt32()).ToList();
            Assert.Equal(new[] { 3000, 4000, 5000 }, rpms);
            Assert.Null(rec.Estado().Alarme);
        }
        finally { Directory.Delete(dir, true); }
    }
}
