// Paridade do modelo de estado em C# com web/cockpit/cockpit-state.js
// (Incremento 1 da Fase 4 — ligar a tela aos dados reais + mensagens/ghost/ia).
//
// Cobre os campos/comportamentos ADICIONADOS pra paridade: silencioso, noBox,
// aprendizado (status derivado do pct), flashIa, bolinha do ápice (distM/angleDeg),
// ponto pace, e o preset de calibração do Bubi na luz de marcha.
//
// Cada fato espelha a regra exata do JS (citado na assertion).

using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class CockpitStateParidadeTests
{
    // ── Defaults novos (cockpit-state.js:81-126) ────────────────────

    [Fact]
    public void PAR_01_Default_tem_campos_novos_no_estado_limpo()
    {
        var s = CockpitStateModel.Default();
        Assert.False(s.Silencioso);
        Assert.False(s.NoBox);
        Assert.False(s.FlashIa);
        Assert.Equal(AprendizadoStatus.Inativo, s.Aprendizado.Status);
        Assert.Equal(0, s.Aprendizado.Pct);
        // apex pontos nascem Pendente (sem referência) — paridade com o JS.
        Assert.Equal(ApexEstado.Pendente, s.Apex.Entrada.Estado);
        Assert.Equal(ApexEstado.Pendente, s.Apex.Freio.Estado);
        Assert.Equal(ApexEstado.Pendente, s.Apex.Apice.Estado);
        Assert.Equal(ApexEstado.Pendente, s.Apex.Saida.Estado);
        // 5º marco (pace) existe e nasce pendente.
        Assert.Equal(ApexEstado.Pendente, s.Apex.Pace.Estado);
        Assert.Null(s.Apex.Apice.DistM);
        Assert.Null(s.Apex.Apice.AngleDeg);
    }

    // ── Modo silencioso (cockpit-state.js:234-272) ──────────────────

    [Fact]
    public void PAR_02_Silencioso_bloqueia_COMUNICACAO_mas_nunca_GRAVE()
    {
        var c = new CockpitState();
        c.SetSilencioso(true);

        c.ShowMessage(MsgTipo.Comunicacao, "Foco: freie mais cedo");
        Assert.Null(c.Get().Message); // comunicação bloqueada

        c.ShowMessage(MsgTipo.Grave, "Temperatura motor crítica");
        Assert.NotNull(c.Get().Message);
        Assert.Equal(MsgTipo.Grave, c.Get().Message!.Tipo); // grave sempre passa
    }

    [Fact]
    public void PAR_03_Ligar_silencioso_esconde_comunicacao_corrente()
    {
        var c = new CockpitState();
        c.ShowMessage(MsgTipo.Comunicacao, "Out-lap • pneus a 35C");
        Assert.NotNull(c.Get().Message);

        var keys = new List<string>();
        c.OnChange((_, _, k) => keys.AddRange(k));
        c.SetSilencioso(true);

        Assert.Null(c.Get().Message);              // comunicação corrente sumiu
        Assert.Contains("silencioso", keys);
        Assert.Contains("message", keys);
    }

    [Fact]
    public void PAR_04_Ligar_silencioso_preserva_GRAVE_corrente()
    {
        var c = new CockpitState();
        c.ShowMessage(MsgTipo.Grave, "Pressão óleo crítica");
        c.SetSilencioso(true);
        Assert.NotNull(c.Get().Message); // grave não é escondida pelo silêncio
    }

    // ── noBox (cockpit-state.js:250-257) ────────────────────────────

    [Fact]
    public void PAR_05_NoBox_alterna_e_emite()
    {
        var c = new CockpitState();
        Assert.False(c.IsNoBox());
        var emitido = 0;
        c.OnChange((_, _, k) => { if (k.Contains("noBox")) emitido++; });
        c.SetNoBox(true);
        Assert.True(c.IsNoBox());
        c.SetNoBox(true);          // idempotente: não reemite
        c.SetNoBox(false);
        Assert.False(c.IsNoBox());
        Assert.Equal(2, emitido);  // só as duas mudanças reais
    }

    // ── Aprendizado: status derivado do pct (statusFromPct) ─────────

    [Theory]
    [InlineData(0,   AprendizadoStatus.Inativo)]
    [InlineData(1,   AprendizadoStatus.Aprendendo)]
    [InlineData(33,  AprendizadoStatus.Aprendendo)]
    [InlineData(34,  AprendizadoStatus.Parcial)]
    [InlineData(66,  AprendizadoStatus.Parcial)]
    [InlineData(67,  AprendizadoStatus.Calibrado)]
    [InlineData(100, AprendizadoStatus.Calibrado)]
    public void PAR_06_StatusFromPct_respeita_as_bordas(double pct, AprendizadoStatus esperado)
    {
        Assert.Equal(esperado, CockpitState.StatusFromPct(pct));
    }

    [Fact]
    public void PAR_07_SetAprendizado_clampa_e_deriva_status()
    {
        var c = new CockpitState();
        c.SetAprendizado(150);
        Assert.Equal(100, c.Get().Aprendizado.Pct);
        Assert.Equal(AprendizadoStatus.Calibrado, c.Get().Aprendizado.Status);

        c.SetAprendizado(-10);
        Assert.Equal(0, c.Get().Aprendizado.Pct);
        Assert.Equal(AprendizadoStatus.Inativo, c.Get().Aprendizado.Status);

        c.SetAprendizado(50);
        Assert.Equal(AprendizadoStatus.Parcial, c.Get().Aprendizado.Status);
    }

    // ── flashIa (cockpit-state.js:339-345) ──────────────────────────

    [Fact]
    public void PAR_08_FlashIa_alterna_e_emite()
    {
        var c = new CockpitState();
        string? ultimaChave = null;
        c.OnChange((_, _, k) => { if (k.Contains("flashIa")) ultimaChave = "flashIa"; });
        c.SetFlashIa(true);
        Assert.True(c.Get().FlashIa);
        Assert.Equal("flashIa", ultimaChave);
    }

    // ── Bolinha do ápice + merge parcial + pace ─────────────────────

    [Fact]
    public void PAR_09_Apice_bolinha_distM_angleDeg_e_merge_preserva_o_resto()
    {
        var c = new CockpitState();
        c.SetApexPonto("apice", estado: ApexEstado.OkMelhor, distM: 1.2, angleDeg: 90);
        var ap = c.Get().Apex.Apice;
        Assert.Equal(ApexEstado.OkMelhor, ap.Estado);
        Assert.Equal(1.2, ap.DistM);
        Assert.Equal(90, ap.AngleDeg);

        // merge: muda só distM; angleDeg e estado preservados (igual ao JS {...cur,...fields}).
        c.SetApexPonto("apice", distM: 0.4);
        ap = c.Get().Apex.Apice;
        Assert.Equal(0.4, ap.DistM);
        Assert.Equal(90, ap.AngleDeg);                 // preservado
        Assert.Equal(ApexEstado.OkMelhor, ap.Estado);  // preservado
    }

    [Fact]
    public void PAR_10_Pace_eh_papel_valido()
    {
        var c = new CockpitState();
        c.SetApexPonto("pace", estado: ApexEstado.OkMelhor, valorKmh: 118);
        Assert.Equal(118.0, c.Get().Apex.Pace.ValorKmh);
        Assert.Equal(ApexEstado.OkMelhor, c.Get().Apex.Pace.Estado);
    }

    [Fact]
    public void PAR_11_Freio_deltaM_e_papel_invalido_lanca()
    {
        var c = new CockpitState();
        c.SetApexPonto("freio", atualM: 92, refM: 84, deltaM: 8);
        Assert.Equal(8.0, c.Get().Apex.Freio.DeltaM);
        Assert.Throws<ArgumentException>(() => c.SetApexPonto("inexistente", valorKmh: 1));
    }

    // ── Calibração do Bubi na luz de marcha (LiveLimits.Bubi) ───────

    [Fact]
    public void PAR_12_LiveLimits_Bubi_tem_redline_e_limites_reais()
    {
        Assert.Equal(6300, LiveLimits.Bubi.RedlineRpm);
        Assert.Equal(80,   LiveLimits.Bubi.WaterTempMaxC);   // Bubi opera frio
        Assert.Equal(115,  LiveLimits.Bubi.OilTempMaxC);
    }

    [Fact]
    public void PAR_13_RpmToShift_no_Bubi_dispara_perto_do_pico_de_potencia()
    {
        Assert.Equal(ShiftMode.Off,     LiveDataBridge.RpmToShift(3000, LiveLimits.Bubi).Mode); // abaixo do litStart
        Assert.Equal(ShiftMode.Lit,     LiveDataBridge.RpmToShift(5000, LiveLimits.Bubi).Mode);
        Assert.Equal(ShiftMode.Fire,    LiveDataBridge.RpmToShift(6100, LiveLimits.Bubi).Mode); // ~pico 6.050
        Assert.Equal(ShiftMode.Overrev, LiveDataBridge.RpmToShift(6400, LiveLimits.Bubi).Mode); // além do redline 6.300
    }

    // ── Reação da MARCHA — paridade com pilot-reaction.js (gap 2) ────

    [Fact]
    public void PAR_14_PilotReaction_bate_com_o_web()
    {
        // observedReactionMs: delta 50 rpm / 250 rpm/s * 1000 = 200 ms (pilot-reaction.js:34-47).
        Assert.Equal(200, PilotReaction.ObservedReactionMs(new ReactionEvent(6100, 6050, RpmRiseRate: 250))!.Value, 1);

        var ag = new PilotReaction();
        // Sem perfil → default 250 ms, comp = rt*rate/1000 = 62.5, fonte 'default' (pilot-reaction.js:90-115).
        var d = ag.ComputeCompensation("p", "c", 3, "t", rpmRiseRate: 250);
        Assert.Equal(250, d.RtMs, 1);
        Assert.Equal(62.5, d.CompensationRpm, 1);
        Assert.Equal("default", d.Source);
        // Modo != 'assisted' → não antecipa (pilot-reaction.js:91-93).
        Assert.Equal(0, ag.ComputeCompensation("p", "c", 3, "t", 250, mode: "learning").CompensationRpm);
    }

    // ── Reação do FREIO — paridade com trail-cockpit-motor.js (gap 3) ─

    [Fact]
    public void PAR_15_LuzFreio_reacao_bate_com_o_web()
    {
        var seg = new TrechoSegmento("s0", "S0",
            new LinhaGps(new PontoGps(0, 0), new PontoGps(0.001, 0)),
            new PontoGps(0, 0.0005),
            new LinhaGps(new PontoGps(0, 0.001), new PontoGps(0.001, 0.001)));
        var luz = new LuzFreio(new[] { seg });

        Assert.Equal(0.25, luz.ReacaoS("s0"), 3);         // reacaoDefaultS (trail-cockpit-motor.js:44)
        luz.RegistrarAmostraReacao("s0", 0.40);
        luz.RegistrarAmostraReacao("s0", 0.20);           // EMA α=0.25: 0.40+0.25*(0.20-0.40)=0.35 (:388-392)
        Assert.Equal(0.35, luz.ReacaoS("s0"), 3);
        Assert.Null(luz.RegistrarAmostraReacao("s0", 2.0)); // > reacaoAmostraMaxS 1.2 → descarta (:48,387)
    }

    // ── 3 modos da luz — paridade com shift-light-modos.js (gap 4) ───

    [Fact]
    public void PAR_16_ShiftLightModos_janelas_do_Bubi_batem_com_o_web()
    {
        // Janelas derivadas do PERFIL_BUBI (shift-light-modos.js:45-88).
        Assert.Equal((5800.0, 6050.0), (ShiftLightModos.JanelaParaModo(ModoStint.Durabilidade).RpmMin,
                                        ShiftLightModos.JanelaParaModo(ModoStint.Durabilidade).RpmMax));
        Assert.Equal((6100.0, 6250.0), (ShiftLightModos.JanelaParaModo(ModoStint.Normal).RpmMin,
                                        ShiftLightModos.JanelaParaModo(ModoStint.Normal).RpmMax));
        Assert.Equal((6250.0, 6350.0), (ShiftLightModos.JanelaParaModo(ModoStint.Agressivo).RpmMin,
                                        ShiftLightModos.JanelaParaModo(ModoStint.Agressivo).RpmMax));
        Assert.Equal(6050, ShiftLightModos.PerfilBubi.PicoPotenciaRpm); // shift-light-modos.js:30
    }
}
