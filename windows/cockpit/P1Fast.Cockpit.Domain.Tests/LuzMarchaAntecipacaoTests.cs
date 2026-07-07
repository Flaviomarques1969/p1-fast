// LuzMarchaAntecipacao (Onda 7, Flávio 2026-07-07): antecipa a luz de marcha pelo tempo de
// reação do piloto e APRENDE observando as trocas (queda do giro — o USB não dá a marcha).
// Cobre: antecipação em modo assistido, piso de segurança, não-antecipação (learning/giro parado),
// aprendizado de uma subida de marcha, rejeição de troca ANTES do ponto, e a fiação no maestro.

using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class LuzMarchaAntecipacaoTests
{
    private const double Alvo = 6050; // potência máxima (Bubi) — o ponto que a luz mira

    [Fact]
    public void LMA_01_assistido_com_giro_subindo_antecipa_o_ponto_visual()
    {
        var a = new LuzMarchaAntecipacao();
        a.Amostra(5900, 0.0, Alvo, null);
        a.Amostra(6000, 0.2, Alvo, null); // ritmo = (6000-5900)/0.2 = 500 rpm/s
        // default 250 ms × 500 rpm/s / 1000 = 125 rpm de antecipação
        Assert.Equal(5925, a.RpmVisual(Alvo, 0.2, null), 1);
    }

    [Fact]
    public void LMA_02_giro_parado_nao_antecipa()
    {
        var a = new LuzMarchaAntecipacao();
        a.Amostra(6000, 0.0, Alvo, null);
        a.Amostra(6000, 0.2, Alvo, null); // ritmo 0 → compensação 0
        Assert.Equal(Alvo, a.RpmVisual(Alvo, 0.2, null), 1);
    }

    [Fact]
    public void LMA_03_modo_learning_nunca_antecipa()
    {
        var a = new LuzMarchaAntecipacao();
        a.Amostra(5900, 0.0, Alvo, null);
        a.Amostra(6000, 0.2, Alvo, null); // subindo, mas...
        Assert.Equal(Alvo, a.RpmVisual(Alvo, 0.2, null, mode: "learning"), 1); // ...learning = comp 0
    }

    [Fact]
    public void LMA_04_piso_de_seguranca_nunca_antecipa_alem_de_800rpm()
    {
        var a = new LuzMarchaAntecipacao();
        a.Amostra(5000, 0.0, Alvo, null);
        a.Amostra(6400, 0.2, Alvo, null); // ritmo 7000 rpm/s → comp 1750, mas o piso corta em 800
        Assert.Equal(Alvo - 800, a.RpmVisual(Alvo, 0.2, null), 1);
    }

    [Fact]
    public void LMA_05_subida_de_marcha_apos_o_ponto_vira_aprendizado()
    {
        var a = new LuzMarchaAntecipacao();
        a.Amostra(5000, 0.0, Alvo, "c1");
        a.Amostra(5500, 0.1, Alvo, "c1");
        a.Amostra(6100, 0.2, Alvo, "c1"); // pico 6100 (acima do alvo = trocou DEPOIS)
        a.Amostra(4800, 0.3, Alvo, "c1"); // queda de 1300 → subiu de marcha → evento
        Assert.NotEmpty(a.Perfis);
    }

    [Fact]
    public void LMA_06_troca_ANTES_do_ponto_nao_aprende()
    {
        var a = new LuzMarchaAntecipacao();
        a.Amostra(4500, 0.0, Alvo, "c1");
        a.Amostra(5100, 0.1, Alvo, "c1"); // pico 5100 (abaixo do alvo 6050)
        a.Amostra(4300, 0.2, Alvo, "c1"); // caiu → troca, mas delta<0 (antes do ponto) → rejeitada
        Assert.Empty(a.Perfis);
    }

    [Fact]
    public void LMA_07_reset_zera_o_historico()
    {
        var a = new LuzMarchaAntecipacao();
        a.Amostra(5000, 0.0, Alvo, null);
        a.Amostra(6000, 0.2, Alvo, null);
        a.Reset();
        // histórico vazio → sem ritmo → sem antecipação
        Assert.Equal(Alvo, a.RpmVisual(Alvo, 0.3, null), 1);
    }

    [Fact]
    public void LMA_08_maestro_liga_a_antecipacao_no_IngestMotor()
    {
        var cs = new CockpitState();
        var orq = new CockpitOrchestrator(cs);
        // Sem subida, 5900 rpm ainda é só faixa (Lit), não Fire (ponto 6050).
        orq.IngestMotor(5900, new AmostraAlerta(), tSeg: 0.0);
        Assert.Equal(ShiftMode.Lit, cs.Get().Shift.Mode);

        // Giro sobe forte de 5000→5900: a antecipação adianta o ponto e a luz FIRA antes de 6050.
        orq.IngestMotor(5000, new AmostraAlerta(), tSeg: 1.0);
        orq.IngestMotor(5900, new AmostraAlerta(), tSeg: 1.2);
        Assert.Equal(ShiftMode.Fire, cs.Get().Shift.Mode);
    }
}
