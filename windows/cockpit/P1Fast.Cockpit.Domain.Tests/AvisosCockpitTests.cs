// AvisosCockpit — trava a HONESTIDADE da linha de status (JANELA 2).
//  • ComporStatus: o rótulo do canal e o alarme de gravação NUNCA somem quando o
//    diagnóstico (trecho/shift/Δ, 10-25 Hz) muda — antes o diagnóstico sobrescrevia tudo.
//  • AvisoFlags: combinação conflitante de flags e --producao sem efeito viram aviso
//    (antes eram engolidos em silêncio: --live --replay virava replay mudo).

using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class AvisosCockpitTests
{
    // ── ComporStatus (2.3) ────────────────────────────────────────────

    [Fact]
    public void AC_01_Tudo_vazio_vira_travessao()
        => Assert.Equal("—", AvisosCockpit.ComporStatus(null, null, null, null, null));

    [Fact]
    public void AC_02_Diagnostico_sozinho_aparece()
        => Assert.Equal("trecho=1", AvisosCockpit.ComporStatus(null, null, null, null, "trecho=1"));

    [Fact]
    public void AC_03_Canal_persiste_quando_diagnostico_muda()
    {
        // A REGRESSÃO do 2.3: com o diagnóstico presente, o rótulo do canal continua na linha.
        var linha = AvisosCockpit.ComporStatus(null, null, "nuvem: TESTE", null, "trecho=2");
        Assert.Contains("nuvem: TESTE", linha);
        Assert.Contains("trecho=2", linha);
    }

    [Fact]
    public void AC_04_Alarme_de_gravacao_vem_primeiro()
    {
        var linha = AvisosCockpit.ComporStatus("GRAVACAO com perda: disco", null, "nuvem: PRODUCAO", "ao vivo: T4000", "Δ=0");
        // ordem de prioridade: alarme antes de tudo.
        Assert.StartsWith("GRAVACAO com perda: disco", linha);
        Assert.Contains("nuvem: PRODUCAO", linha);
        Assert.Contains("ao vivo: T4000", linha);
        Assert.Contains("Δ=0", linha);
    }

    [Fact]
    public void AC_05_Regioes_vazias_sao_puladas_sem_separador_duplo()
    {
        var linha = AvisosCockpit.ComporStatus(null, null, "canal", "", "diag");
        Assert.Equal("canal" + AvisosCockpit.Sep + "diag", linha);
    }

    // ── AvisoFlags (2.7) ──────────────────────────────────────────────

    [Fact]
    public void AC_10_Live_sozinho_sem_aviso()
        => Assert.Null(AvisosCockpit.AvisoFlags(demo: false, replay: false, live: true, telaTermica: false, producao: false));

    [Fact]
    public void AC_11_Live_com_producao_sem_aviso()
        => Assert.Null(AvisosCockpit.AvisoFlags(demo: false, replay: false, live: true, telaTermica: false, producao: true));

    [Fact]
    public void AC_12_Live_mais_replay_avisa_conflito_e_vale_replay()
    {
        // Precedência real: Replay vence Live.
        var aviso = AvisosCockpit.AvisoFlags(demo: false, replay: true, live: true, telaTermica: false, producao: false);
        Assert.NotNull(aviso);
        Assert.Contains("CONFLITO", aviso!);
        Assert.Contains("--replay", aviso);
    }

    [Fact]
    public void AC_13_Replay_com_producao_avisa_producao_ignorado()
    {
        var aviso = AvisosCockpit.AvisoFlags(demo: false, replay: true, live: false, telaTermica: false, producao: true);
        Assert.NotNull(aviso);
        Assert.Contains("--producao IGNORADO", aviso!);
    }

    [Fact]
    public void AC_14_Producao_sozinho_sem_modo_avisa_ignorado()
    {
        var aviso = AvisosCockpit.AvisoFlags(demo: false, replay: false, live: false, telaTermica: false, producao: true);
        Assert.NotNull(aviso);
        Assert.Contains("--producao IGNORADO", aviso!);
    }

    [Fact]
    public void AC_15_Demo_vence_todos_no_conflito_triplo()
    {
        var aviso = AvisosCockpit.AvisoFlags(demo: true, replay: true, live: true, telaTermica: false, producao: true);
        Assert.NotNull(aviso);
        Assert.Contains("--demo", aviso!);
        Assert.Contains("--producao IGNORADO", aviso);
    }
}
