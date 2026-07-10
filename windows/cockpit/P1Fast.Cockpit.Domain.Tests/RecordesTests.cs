// Recordes — armazém de recordes persistido no notebook (Flávio 2026-07-06). Trava a regra
// "superou → substitui" (por sentido), independência dos dados ("um dado cada"), e o round-trip
// à prova de queda do arquivo (grava, relê, tolera ausência/corrupção).

using System.IO;
using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class RecordesTests
{
    private static MetadadosRecorde Meta(double quando = 1000, string sessao = "s1")
        => new(quando, sessao, "Brasilia", "bubi", "");

    [Fact]
    public void REC_01_Primeiro_valor_sempre_vira_recorde()
    {
        var a = new ArmazemRecordes { CarroId = "bubi" };
        Assert.True(a.Tentar("volta", 99000, SentidoRecorde.Menor, Meta()));
        Assert.Equal(99000, a.Obter("volta")!.Valor);
    }

    [Fact]
    public void REC_02_Menor_bate_so_com_valor_menor()
    {
        var a = new ArmazemRecordes();
        a.Tentar("volta", 99000, SentidoRecorde.Menor, Meta());
        Assert.False(a.Tentar("volta", 99500, SentidoRecorde.Menor, Meta()));   // mais lento não bate
        Assert.True(a.Tentar("volta", 98000, SentidoRecorde.Menor, Meta(2000, "s2")));
        Assert.Equal(98000, a.Obter("volta")!.Valor);
        Assert.Equal("s2", a.Obter("volta")!.Meta.SessaoId);                    // guardou o metadado do novo
    }

    [Fact]
    public void REC_03_Maior_bate_so_com_valor_maior()
    {
        var a = new ArmazemRecordes();
        a.Tentar("c3.vmin", 82, SentidoRecorde.Maior, Meta());
        Assert.False(a.Tentar("c3.vmin", 80, SentidoRecorde.Maior, Meta()));    // Vmin menor não bate
        Assert.True(a.Tentar("c3.vmin", 85, SentidoRecorde.Maior, Meta()));
        Assert.Equal(85, a.Obter("c3.vmin")!.Valor);
    }

    [Fact]
    public void REC_04_NaN_e_Infinito_nunca_viram_recorde()
    {
        var a = new ArmazemRecordes();
        Assert.False(a.Tentar("volta", double.NaN, SentidoRecorde.Menor, Meta()));
        Assert.False(a.Tentar("volta", double.PositiveInfinity, SentidoRecorde.Menor, Meta()));
        Assert.Null(a.Obter("volta"));
    }

    [Fact]
    public void REC_05_Um_dado_cada_independentes()
    {
        // A passagem tem tempo pior, mas Vmin melhor → só o Vmin bate (dados independentes).
        var a = new ArmazemRecordes();
        a.AplicarPassagem(new DadosPassagem("c3", TempoS: 12.0, EntradaKmh: 120, FrenagemM: 40, ApiceKmh: 78, SaidaKmh: 130, VminKmh: 74), Meta());
        var mudou = a.AplicarPassagem(new DadosPassagem("c3", TempoS: 12.5, EntradaKmh: 118, FrenagemM: 42, ApiceKmh: 77, SaidaKmh: 128, VminKmh: 80), Meta(2000, "s2"));
        Assert.True(mudou);                                    // o Vmin melhorou
        Assert.Equal(12.0, a.Obter("c3.tempo")!.Valor);        // tempo NÃO mudou (a 2ª foi mais lenta)
        Assert.Equal(80,   a.Obter("c3.vmin")!.Valor);         // Vmin mudou
        Assert.Equal("s2", a.Obter("c3.vmin")!.Meta.SessaoId); // e veio de outra sessão
    }

    [Fact]
    public void REC_06_Passagem_sem_melhora_nao_muda()
    {
        var a = new ArmazemRecordes();
        a.AplicarPassagem(new DadosPassagem("c3", 12.0, 120, 40, 78, 130, 74), Meta());
        // 2ª passagem pior em TODOS os dados (inclusive freou mais CEDO: 38 < 40) → nada muda.
        var mudou = a.AplicarPassagem(new DadosPassagem("c3", 12.9, 110, 38, 70, 120, 70), Meta());
        Assert.False(mudou);
    }

    [Fact]
    public void REC_07_Roundtrip_salva_e_rele()
    {
        var dir = Path.Combine(Path.GetTempPath(), "p1fast-rec-" + Path.GetRandomFileName());
        try
        {
            var store = new FileRecordesStore(dir);
            var a = store.Carregar("bubi");
            a.AplicarVolta(98450, Meta());
            a.AplicarPassagem(new DadosPassagem("c1", 8.2, 140, 30, 95, 150, 88), Meta());
            store.Salvar(a);

            var b = store.Carregar("bubi");
            Assert.Equal(98450, b.Obter("volta")!.Valor);
            Assert.Equal(8.2, b.Obter("c1.tempo")!.Valor);
            Assert.Equal(88, b.Obter("c1.vmin")!.Valor);
            Assert.Equal("Brasilia", b.Obter("volta")!.Meta.Pista);
        }
        finally { try { Directory.Delete(dir, true); } catch { } }
    }

    [Fact]
    public void REC_08_Carro_inexistente_da_armazem_vazio()
    {
        var dir = Path.Combine(Path.GetTempPath(), "p1fast-rec-" + Path.GetRandomFileName());
        try
        {
            var store = new FileRecordesStore(dir);
            var a = store.Carregar("naoexiste");
            Assert.Empty(a.Itens);
            Assert.Equal("naoexiste", a.CarroId);
        }
        finally { try { Directory.Delete(dir, true); } catch { } }
    }

    // ── Item 3.2: piso de plausibilidade da volta ──────────────

    [Fact]
    public void REC_09_Volta_implausivel_nao_vira_recorde()
    {
        // O trecho box→linha (ex.: 30 s) NÃO é uma volta — não pode virar melhor volta histórica.
        var a = new ArmazemRecordes();
        Assert.False(a.AplicarVolta(30_000, Meta()));                 // < 40 s → descartada
        Assert.Null(a.Obter(ArmazemRecordes.ChaveVolta));            // nada foi gravado
        Assert.True(a.AplicarVolta(92_000, Meta()));                 // volta real → grava
        Assert.Equal(92_000, a.Obter(ArmazemRecordes.ChaveVolta)!.Valor);
        // E uma volta implausível DEPOIS nunca substitui a boa (mesmo sendo "menor").
        Assert.False(a.AplicarVolta(30_000, Meta()));
        Assert.Equal(92_000, a.Obter(ArmazemRecordes.ChaveVolta)!.Valor);
    }

    [Fact]
    public void REC_10_Piso_da_volta_eh_configuravel()
    {
        var a = new ArmazemRecordes();
        Assert.True(a.AplicarVolta(10_000, Meta(), pisoPlausivelMs: 5_000));  // piso menor: aceita
        Assert.Equal(10_000, a.Obter(ArmazemRecordes.ChaveVolta)!.Valor);
    }

    // ── Item 3.6: recorde de ponto de freada ───────────────────

    [Fact]
    public void REC_11_Frenagem_mais_tarde_vira_recorde()
    {
        // Ponto de freada = metros da linha de entrada até onde freou; freou MAIS TARDE (mais metros)
        // = melhor (Maior), na mesma família das velocidades. Antes FrenagemM viajava e era ignorado.
        var a = new ArmazemRecordes();
        a.AplicarPassagem(new DadosPassagem("c3", 12.0, 120, 40, 78, 130, 74), Meta());
        Assert.Equal(40, a.Obter(ArmazemRecordes.ChaveTrecho("c3", ArmazemRecordes.MetFrenagem))!.Valor);
        Assert.False(a.AplicarPassagem(new DadosPassagem("c3", 12.0, 120, 35, 78, 130, 74), Meta())); // freou mais cedo: não bate
        var mudou = a.AplicarPassagem(new DadosPassagem("c3", 12.0, 120, 47, 78, 130, 74), Meta());   // freou mais tarde: bate
        Assert.True(mudou);
        Assert.Equal(47, a.Obter(ArmazemRecordes.ChaveTrecho("c3", ArmazemRecordes.MetFrenagem))!.Valor);
    }

    // ── Item 3.1: armazém em MEMÓRIA no replay (não carrega nem grava) ──

    [Fact]
    public void REC_12_Memoria_store_nao_persiste_nem_carrega()
    {
        var store = new MemoriaRecordesStore();
        var a = store.Carregar("bubi");
        a.AplicarVolta(92_000, Meta());
        store.Salvar(a);                       // no-op — não toca disco
        var b = store.Carregar("bubi");        // recarrega: sempre VAZIO (replay não persiste)
        Assert.Empty(b.Itens);
        Assert.Equal("bubi", b.CarroId);
    }
}
