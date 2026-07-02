// PilotReaction (gap 2, port de pilot-reaction.js): antecipa a luz de marcha pelo tempo
// de reação aprendido. Paridade com o JS de referência.

using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class PilotReactionTests
{
    [Fact]
    public void PR_01_TupleKey_formata_com_x_pros_ausentes()
    {
        Assert.Equal("x:x:x:x", PilotReaction.TupleKey(null, null, null, null));
        Assert.Equal("p:c:3:t", PilotReaction.TupleKey("p", "c", 3, "t"));
    }

    [Fact]
    public void PR_02_ObservedReactionMs_infere_e_rejeita_early()
    {
        // delta 50 rpm / 250 rpm/s * 1000 = 200 ms
        Assert.Equal(200, PilotReaction.ObservedReactionMs(new ReactionEvent(6100, 6050, RpmRiseRate: 250))!.Value, 1);
        // taxa derivada de rpm_before: (6100-6050)/0.2 = 250 → mesmos 200 ms
        Assert.Equal(200, PilotReaction.ObservedReactionMs(new ReactionEvent(6100, 6050, RpmBefore: 6050))!.Value, 1);
        // trocou ANTES do sinal (delta < 0) → não conta
        Assert.Null(PilotReaction.ObservedReactionMs(new ReactionEvent(6000, 6050, RpmRiseRate: 250)));
        // taxa inválida → null
        Assert.Null(PilotReaction.ObservedReactionMs(new ReactionEvent(6100, 6050, RpmRiseRate: 0)));
    }

    [Fact]
    public void PR_03_So_antecipa_depois_de_MinSamples_e_learning_mode_zera()
    {
        var ag = new PilotReaction();

        // Sem perfil → default 250 ms, comp = 250*250/1000 = 62.5, fonte 'default'.
        var d = ag.ComputeCompensation("p", "c", 3, "t", rpmRiseRate: 250);
        Assert.Equal("default", d.Source);
        Assert.Equal(250, d.RtMs, 1);
        Assert.Equal(62.5, d.CompensationRpm, 1);

        // Modo learning → não antecipa.
        Assert.Equal(0, ag.ComputeCompensation("p", "c", 3, "t", 250, mode: "learning").CompensationRpm);

        // Aprende 10 amostras de 200 ms (EMA de 200 sobre 200 = 200).
        for (var i = 0; i < 10; i++)
            ag.LearnFromEvent(new ReactionEvent(6100, 6050, RpmRiseRate: 250,
                GearConfidence: 1.0, GearAfter: 3, PilotoId: "p", CarroId: "c", TrechoId: "t"), nowMs: i);

        var c = ag.ComputeCompensation("p", "c", 3, "t", rpmRiseRate: 250);
        Assert.Equal("exact", c.Source);          // achou o perfil exato com >= 10 amostras
        Assert.Equal(200, c.RtMs, 1);             // convergiu pra 200 ms
        Assert.Equal(50, c.CompensationRpm, 1);   // 200*250/1000
    }

    [Fact]
    public void PR_04_Rejeita_confianca_baixa_e_conta_amostras()
    {
        var ag = new PilotReaction();

        // gear_confidence < 0.8 → não aprende.
        Assert.Null(ag.LearnFromEvent(new ReactionEvent(6100, 6050, RpmRiseRate: 250, GearConfidence: 0.5)));
        Assert.Empty(ag.Profiles);

        // 5 amostras válidas → ainda default (precisa de 10).
        for (var i = 0; i < 5; i++)
            ag.LearnFromEvent(new ReactionEvent(6100, 6050, RpmRiseRate: 250,
                GearConfidence: 1.0, GearAfter: 3, PilotoId: "p", CarroId: "c", TrechoId: "t"), nowMs: i);
        Assert.Equal("default", ag.ComputeCompensation("p", "c", 3, "t", 250).Source);
    }
}
