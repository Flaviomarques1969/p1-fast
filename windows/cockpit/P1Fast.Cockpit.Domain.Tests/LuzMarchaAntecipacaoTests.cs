// LuzMarchaAntecipacao (Onda 7, Flávio 2026-07-07): antecipa a luz de marcha pelo tempo de
// reação do piloto e APRENDE por marcha observando as trocas (queda do giro; a marcha vem do
// detector razão giro÷velocidade). Cobre: antecipação assistida, piso, não-antecipação
// (learning/giro parado), aprendizado genérico e POR MARCHA, rejeição de troca antes do ponto,
// reset e a fiação no maestro.

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
        a.Amostra(5900, 0, 0.0, Alvo, null);
        a.Amostra(6000, 0, 0.2, Alvo, null); // ritmo = (6000-5900)/0.2 = 500 rpm/s
        // default 250 ms × 500 rpm/s / 1000 = 125 rpm de antecipação
        Assert.Equal(5925, a.RpmVisual(Alvo, 0.2, null), 1);
    }

    [Fact]
    public void LMA_02_giro_parado_nao_antecipa()
    {
        var a = new LuzMarchaAntecipacao();
        a.Amostra(6000, 0, 0.0, Alvo, null);
        a.Amostra(6000, 0, 0.2, Alvo, null); // ritmo 0 → compensação 0
        Assert.Equal(Alvo, a.RpmVisual(Alvo, 0.2, null), 1);
    }

    [Fact]
    public void LMA_03_modo_learning_nunca_antecipa()
    {
        var a = new LuzMarchaAntecipacao();
        a.Amostra(5900, 0, 0.0, Alvo, null);
        a.Amostra(6000, 0, 0.2, Alvo, null); // subindo, mas...
        Assert.Equal(Alvo, a.RpmVisual(Alvo, 0.2, null, mode: "learning"), 1); // ...learning = comp 0
    }

    [Fact]
    public void LMA_04_piso_de_seguranca_nunca_antecipa_alem_de_800rpm()
    {
        var a = new LuzMarchaAntecipacao();
        a.Amostra(5000, 0, 0.0, Alvo, null);
        a.Amostra(6400, 0, 0.2, Alvo, null); // ritmo 7000 rpm/s → comp 1750, mas o piso corta em 800
        Assert.Equal(Alvo - 800, a.RpmVisual(Alvo, 0.2, null), 1);
    }

    [Fact]
    public void LMA_05_subida_de_marcha_apos_o_ponto_vira_aprendizado()
    {
        var a = new LuzMarchaAntecipacao();
        a.Amostra(5000, 0, 0.0, Alvo, "c1");
        a.Amostra(5500, 0, 0.1, Alvo, "c1");
        a.Amostra(6100, 0, 0.2, Alvo, "c1"); // pico 6100 (acima do alvo = trocou DEPOIS)
        a.Amostra(4800, 0, 0.3, Alvo, "c1"); // queda de 1300 → subiu de marcha → evento
        Assert.NotEmpty(a.Perfis);
    }

    [Fact]
    public void LMA_06_troca_ANTES_do_ponto_nao_aprende()
    {
        var a = new LuzMarchaAntecipacao();
        a.Amostra(4500, 0, 0.0, Alvo, "c1");
        a.Amostra(5100, 0, 0.1, Alvo, "c1"); // pico 5100 (abaixo do alvo 6050)
        a.Amostra(4300, 0, 0.2, Alvo, "c1"); // caiu → troca, mas delta<0 (antes do ponto) → rejeitada
        Assert.Empty(a.Perfis);
    }

    [Fact]
    public void LMA_07_reset_zera_o_historico()
    {
        var a = new LuzMarchaAntecipacao();
        a.Amostra(5000, 0, 0.0, Alvo, null);
        a.Amostra(6000, 0, 0.2, Alvo, null);
        a.Reset();
        // histórico vazio → sem ritmo → sem antecipação
        Assert.Equal(Alvo, a.RpmVisual(Alvo, 0.3, null), 1);
    }

    [Fact]
    public void LMA_08_com_velocidade_aprende_POR_MARCHA()
    {
        var a = new LuzMarchaAntecipacao();
        // Firma a assinatura da marcha atual (razão 40 = 4000rpm/100kmh) com giro estável.
        for (var i = 0; i < 30; i++) a.Amostra(4000, 100, i * 0.1, Alvo, "c1");
        Assert.Equal(1, a.MarchaAtual);                       // descobriu a 1ª marcha
        // Agora uma troca real: giro sobe além do ponto e cai (a marcha continua a mesma até o detector virar).
        a.Amostra(5200, 100, 3.1, Alvo, "c1");
        a.Amostra(6100, 100, 3.2, Alvo, "c1");                // pico 6100
        a.Amostra(4800, 100, 3.3, Alvo, "c1");                // queda → aprende keado pela MARCHA
        // Chave = ÂNCORA absoluta da razão 40 (não o rótulo posicional "1") — Flávio 2026-07-11.
        var ancora = DetectorMarchaOnline.AncoraDaRazao(40.0);
        Assert.Contains(a.Perfis.Keys, k => k.Contains($":{ancora}:"));
    }

    [Fact]
    public void LMA_11_perfil_persistido_reconhece_a_marcha_FISICA_mesmo_com_ordem_de_descoberta_diferente()
    {
        // Regressão da migração de rótulo (decisão Flávio 2026-07-11, âncora absoluta):
        // com a chave POSICIONAL, um perfil aprendido na marcha de razão 40 ("1ª descoberta"
        // na sessão A) era aplicado a OUTRA marcha física na sessão B, onde a ordem de
        // descoberta muda o rótulo. Com a âncora (bucket da razão), a chave é a mesma em
        // qualquer ordem. Simula: sessão A maturou 380 ms na marcha de razão 40 (snapshot);
        // sessão B descobre PRIMEIRO a razão 60 (a de 40 vira posicional "2") e mesmo assim
        // a antecipação usa os 380 ms aprendidos — no código antigo cairia no default 250 ms.
        var chave = PilotReaction.TupleKey(null, null, DetectorMarchaOnline.AncoraDaRazao(40.0), "c1");
        var snap = new PilotReactionSnapshot(PilotReaction.SnapshotVersao, new[]
        {
            new PerfilReacao(chave, ReactionTimeMs: 380, SampleCount: 12, LastUpdated: 0),
        });

        var b = new LuzMarchaAntecipacao();
        b.ImportarReacao(snap);
        // Giro constante (estabilidade do detector), velocidade muda a razão — padrão do DMO_02.
        for (var i = 0; i < 10; i++) b.Amostra(3000, 50, i * 0.1, Alvo, "c1");        // razão 60 descoberta 1º
        for (var i = 0; i < 10; i++) b.Amostra(3000, 75, 2.0 + i * 0.1, Alvo, "c1");  // razão 40 = posicional 2
        Assert.Equal(2, b.MarchaAtual);                       // contraprova: o rótulo posicional mudou...

        b.Amostra(5900, 0, 5.0, Alvo, "c1");                  // kmh 0: detector ignora, marcha não vira
        b.Amostra(6000, 0, 5.2, Alvo, "c1");                  // ritmo 500 rpm/s
        // ...mas a âncora achou o perfil: comp = 380 ms × 500 rpm/s = 190 rpm (default 250 ms daria 125).
        Assert.Equal(Alvo - 190, b.RpmVisual(Alvo, 5.2, "c1"), 1);
    }

    [Fact]
    public void LMA_10_circuito_fechado_converge_pra_reacao_REAL_do_piloto()
    {
        // Regressão da meia-convergência (decisão Flávio 2026-07-10, corrigido C# + JS):
        // medindo a reação a partir do ALVO FIXO (e não de onde a luz ACENDEU), o EMA
        // convergia pra METADE da reação real (ponto fixo rt_real/2 ≈ 150 ms) e a luz
        // antecipava só metade do necessário. Simula um piloto de reação constante
        // (300 ms) em circuito fechado: a luz acende onde o módulo mandar, o piloto
        // troca 300 ms depois. O aprendizado tem que convergir pra ~300 ms.
        const double RtRealMs = 300, RitmoRpmS = 1000, PassoS = 0.01;   // passo fino: o degrau de detecção (≤10 rpm) não infla a medição
        var a = new LuzMarchaAntecipacao();
        var t = 0.0;
        for (var ciclo = 0; ciclo < 30; ciclo++)
        {
            var rpm = 4800.0;
            double? cruzouEm = null;
            while (true)
            {
                a.Amostra(rpm, 0, t, Alvo, "c1");
                var luzAcesa = rpm >= a.RpmVisual(Alvo, t, "c1");
                if (luzAcesa && cruzouEm is null) cruzouEm = t;   // a luz acendeu AQUI
                // O piloto reage RtReal depois de ver a luz: o giro segue subindo até lá.
                if (cruzouEm is { } tc && t - tc >= RtRealMs / 1000.0) break;
                rpm += RitmoRpmS * PassoS;
                t += PassoS;
            }
            t += PassoS;
            a.Amostra(rpm - 900, 0, t, Alvo, "c1");   // queda forte = a troca aconteceu
            t += 1.0;                                  // respiro entre ciclos (limpa a janela de ritmo)
        }
        var perfil = Assert.Single(a.Perfis.Values);
        Assert.True(perfil.SampleCount >= 10, $"esperava ≥10 amostras, veio {perfil.SampleCount}");
        Assert.InRange(perfil.ReactionTimeMs, 280, 320); // no código antigo convergia pra ~150
    }

    [Fact]
    public void LMA_09_maestro_liga_a_antecipacao_no_IngestMotor()
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
