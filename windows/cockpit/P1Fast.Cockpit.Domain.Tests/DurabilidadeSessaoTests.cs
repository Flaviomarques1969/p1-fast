// Prova da DURABILIDADE À PROVA DE QUEDA DE ENERGIA (auditoria 2026-07-09):
//   • EscritaAtomica: grava tmp+fsync+rename, nunca deixa meio-arquivo.
//   • Recuperação de órfãs de META: um .jsonl íntegro cujo meta.json ficou truncado/ausente
//     (queda no meio da escrita) volta a ser VISÍVEL pra a fila de upload — antes sumia em
//     silêncio (ListarSessoes engole meta corrompido).
//   • Âncora do 4.2: no box, SessionRecorder.Motor() devolve null — era esse null que o
//     gate antigo da nuvem usava pra NÃO enfileirar, sumindo com o box/aquecimento.

using System.IO;
using System.Linq;
using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class DurabilidadeSessaoTests
{
    private static string DirTemp()
    {
        var d = Path.Combine(Path.GetTempPath(), "p1fast-durab-" + Path.GetRandomFileName());
        Directory.CreateDirectory(d);
        return d;
    }

    private static SessionRecord Reg(string id, int seq, string tipo) =>
        new() { SessaoId = id, Seq = seq, Tipo = tipo, TWall = 1_700_000_000_000 + seq, TMono = seq, Dados = new { x = seq } };

    // ── EscritaAtomica: escreve o conteúdo, sobrescreve, e NÃO deixa .tmp pra trás. ──
    [Fact]
    public void EscritaAtomica_EscreveESobrescreve_SemDeixarTmp()
    {
        var dir = DirTemp();
        var alvo = Path.Combine(dir, "meta.json");

        EscritaAtomica.WriteAllText(alvo, "{\"v\":1}");
        Assert.Equal("{\"v\":1}", File.ReadAllText(alvo));

        EscritaAtomica.WriteAllText(alvo, "{\"v\":2}");     // sobrescreve por cima
        Assert.Equal("{\"v\":2}", File.ReadAllText(alvo));

        Assert.False(File.Exists(alvo + ".tmp"));           // rename consumiu o tmp
    }

    // ── Meta AUSENTE: .jsonl íntegro sem meta.json volta a ser visível na recuperação. ──
    [Fact]
    public void RecuperarOrfas_MetaAusente_TornaSessaoVisivel()
    {
        var dir = DirTemp();
        using (var store = new FileSessionStore(dir))
            for (int i = 1; i <= 12; i++) store.Gravar(Reg("orfa-sem-meta", i, i % 2 == 0 ? "gps" : "t4000"));
        // de propósito: NENHUM .meta.json foi escrito (a queda truncou/perdeu o meta)
        Assert.False(File.Exists(Path.Combine(dir, "orfa-sem-meta.meta.json")));

        using var store2 = new FileSessionStore(dir);   // "reboot"
        var rec = new SessionRecorder(store2);
        var orfas = rec.RecuperarOrfas();

        var o = orfas.SingleOrDefault(x => x.Id == "orfa-sem-meta");
        Assert.NotNull(o);
        Assert.Equal("interrompida", o!.Status);
        Assert.Equal("meta-perdido", o.MotivoFim);
        Assert.Equal(6, o.NGps);
        Assert.Equal(6, o.NMotor);
        // agora ENTRA na listagem, com meta gravado (atômico) — visível pra fila de upload.
        Assert.Contains(store2.ListarSessoes(), m => m.Id == "orfa-sem-meta" && m.Status == "interrompida");
    }

    // ── Meta TRUNCADO/corrompido: mesma recuperação (ListarSessoes sozinho engoliria e sumiria). ──
    [Fact]
    public void RecuperarOrfas_MetaTruncado_TornaSessaoVisivel()
    {
        var dir = DirTemp();
        using (var store = new FileSessionStore(dir))
            for (int i = 1; i <= 8; i++) store.Gravar(Reg("orfa-meta-truncado", i, "gps"));
        // meta pela metade (queda no meio da escrita) — JSON inválido, sem Id
        File.WriteAllText(Path.Combine(dir, "orfa-meta-truncado.meta.json"), "{\"Id\":\"orfa-meta-tr");

        using var store2 = new FileSessionStore(dir);
        // ListarSessoes SOZINHO não enxerga (meta inválido é engolido) — o dado sumiria.
        Assert.DoesNotContain(store2.ListarSessoes(), m => m.Id == "orfa-meta-truncado");
        // ListarDadosSemMeta enxerga o .jsonl órfão.
        Assert.Contains("orfa-meta-truncado", store2.ListarDadosSemMeta());

        var rec = new SessionRecorder(store2);
        var orfas = rec.RecuperarOrfas();
        Assert.Contains(orfas, x => x.Id == "orfa-meta-truncado" && x.Status == "interrompida");
        Assert.Contains(store2.ListarSessoes(), m => m.Id == "orfa-meta-truncado");
    }

    // ── Sessão SÃ (meta legível): NÃO é falsa-positiva de órfã. ──
    [Fact]
    public void SessaoComMetaLegivel_NaoEhOrfaDeMeta()
    {
        var dir = DirTemp();
        using var store = new FileSessionStore(dir);
        store.NovaSessao(new SessionMeta("sadia", 1_700_000_000_000, false, "gravando"));
        store.Gravar(Reg("sadia", 1, "gps"));
        Assert.DoesNotContain("sadia", store.ListarDadosSemMeta());
    }

    // ── Âncora do 4.2: no box (auto em espera), Motor() devolve NULL — o null que o gate
    //    antigo da nuvem (`reg is not null`) usava pra NÃO enfileirar, sumindo com o box. ──
    [Fact]
    public void Motor_NoBox_DevolveNull_ContratoNuvemDesacoplada()
    {
        var store = new InMemorySessionStore();
        var g = new SessionRecorder(store, auto: new AutoCaptura(VOn: 15, VOff: 6, ParadoMs: 12000));

        var reg = g.Motor(new T3000Sample { Rpm = 1100, Source = "real", LeituraPlausivel = true });

        Assert.Null(reg);            // sample válido, mas o gravador não gravou (espera/box)
        Assert.False(g.Gravando);    // — por isso a nuvem NÃO pode depender de reg pra enfileirar
    }
}
