// 24 facts xUnit equivalentes 1:1 aos smokes CST-01..CST-24 do
// tests/node-smoke-cockpit-state.mjs (web/cockpit/cockpit-state.js).
//
// Spec: PLANO_FASE_1.md §6 MS-13.3 (reescrito 2026-05-09 — ADR-023)
//
// Cada Fact reproduz a assertion lógica do smoke JS correspondente. Onde a
// linguagem (C# tipado vs JS dinâmico) torna o teste original impossível
// (ex.: passar string num enum), o caso é portado pro equivalente C# mais
// próximo — ex.: cast pra valor de enum não-definido.

using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class CockpitStateTests
{
    // ── Defaults ────────────────────────────────────────────

    [Fact]
    public void CST_01_DefaultCockpitState_retorna_estado_limpo()
    {
        var s = CockpitStateModel.Default();
        Assert.Equal(TrechoStatus.Neutro, s.TrechoStatus);
        Assert.Equal(ShiftMode.Off,       s.Shift.Mode);
        Assert.Equal(0,                   s.Shift.Level);
        Assert.Equal(ShiftFire.Idle,      s.Shift.Fire);
        Assert.Null(s.Message);
        Assert.Equal(Tone.Neutro, s.Delta.Tone);
        Assert.Equal(Tone.Neutro, s.Acao.Tone);
        Assert.NotNull(s.Apex.Entrada);
        Assert.NotNull(s.Apex.Freio);
        Assert.NotNull(s.Apex.Apice);
        Assert.NotNull(s.Apex.Saida);
    }

    [Fact]
    public void CST_02_CockpitState_sem_args_retorna_defaults()
    {
        var c = new CockpitState();
        Assert.Equal(TrechoStatus.Neutro, c.Get().TrechoStatus);
    }

    // ── Constantes da spec ───────────────────────────────────

    [Fact]
    public void CST_03_Limites_do_shift_level_conferem_com_mockup()
    {
        Assert.Equal(0,  CockpitState.ShiftLevelMin);
        Assert.Equal(6,  CockpitState.ShiftLevelMax);
        Assert.Equal(12, CockpitState.ShiftDotsTotal);
    }

    [Fact]
    public void CST_04_ShiftDotsForLevel_mapeia_0_para_0_e_6_para_12_e_clampa()
    {
        Assert.Equal(0,  CockpitState.ShiftDotsForLevel(0));
        Assert.Equal(12, CockpitState.ShiftDotsForLevel(6));
        Assert.Equal(6,  CockpitState.ShiftDotsForLevel(3));
        Assert.Equal(0,  CockpitState.ShiftDotsForLevel(-1));   // clamp negativo
        Assert.Equal(12, CockpitState.ShiftDotsForLevel(99));   // clamp acima
    }

    // ── trechoStatus ─────────────────────────────────────────

    [Fact]
    public void CST_05_SetTrechoStatus_aceita_os_4_valores_canonicos()
    {
        var c = new CockpitState();
        foreach (var v in Enum.GetValues<TrechoStatus>())
        {
            c.SetTrechoStatus(v);
            Assert.Equal(v, c.Get().TrechoStatus);
        }
    }

    [Fact]
    public void CST_06_SetTrechoStatus_rejeita_valor_fora_do_enum()
    {
        var c = new CockpitState();
        Assert.Throws<ArgumentException>(() => c.SetTrechoStatus((TrechoStatus)999));
    }

    // ── shift ────────────────────────────────────────────────

    [Fact]
    public void CST_07_SetShift_aceita_combinacao_parcial()
    {
        var c = new CockpitState();
        c.SetShift(level: 3);
        Assert.Equal(3, c.Get().Shift.Level);
        c.SetShift(mode: ShiftMode.Lit);
        Assert.Equal(ShiftMode.Lit, c.Get().Shift.Mode);
        c.SetShift(fire: ShiftFire.Active);
        Assert.Equal(ShiftFire.Active, c.Get().Shift.Fire);
    }

    [Fact]
    public void CST_08_SetShift_rejeita_level_fora_de_0_a_6()
    {
        var c = new CockpitState();
        foreach (var bad in new[] { -1, 7, int.MaxValue, int.MinValue })
        {
            Assert.Throws<ArgumentOutOfRangeException>(() => c.SetShift(level: bad));
        }
    }

    [Fact]
    public void CST_09_ApplyShift_LIT_4_resulta_em_mode_lit_level_4_fire_idle()
    {
        var c = new CockpitState();
        c.ApplyShift(ShiftMode.Lit, 4);
        var s = c.Get().Shift;
        Assert.Equal(ShiftMode.Lit,  s.Mode);
        Assert.Equal(4,              s.Level);
        Assert.Equal(ShiftFire.Idle, s.Fire);
    }

    [Fact]
    public void CST_10_ApplyShift_FIRE_resulta_em_mode_fire_fire_active_level_0()
    {
        var c = new CockpitState();
        c.ApplyShift(ShiftMode.Lit, 6);
        c.ApplyShift(ShiftMode.Fire);
        var s = c.Get().Shift;
        Assert.Equal(ShiftMode.Fire,    s.Mode);
        Assert.Equal(ShiftFire.Active,  s.Fire);
        Assert.Equal(0,                 s.Level);
    }

    [Fact]
    public void CST_11_ApplyShift_OVERREV_resulta_em_mode_overrev_fire_idle_level_0()
    {
        var c = new CockpitState();
        c.ApplyShift(ShiftMode.Overrev);
        var s = c.Get().Shift;
        Assert.Equal(ShiftMode.Overrev, s.Mode);
        Assert.Equal(ShiftFire.Idle,    s.Fire);
        Assert.Equal(0,                 s.Level);
    }

    // ── message ──────────────────────────────────────────────

    [Fact]
    public void CST_12_ShowMessage_seta_tipo_e_texto_HideMessage_volta_a_null()
    {
        var c = new CockpitState();
        c.ShowMessage(MsgTipo.Comunicacao, "Pneu DD acima da janela");
        Assert.NotNull(c.Get().Message);
        Assert.Equal(MsgTipo.Comunicacao, c.Get().Message!.Tipo);
        c.HideMessage();
        Assert.Null(c.Get().Message);
    }

    [Fact]
    public void CST_13_ShowMessage_rejeita_tipo_invalido_e_texto_vazio()
    {
        var c = new CockpitState();
        Assert.Throws<ArgumentException>(() => c.ShowMessage((MsgTipo)999, "oi"));
        Assert.Throws<ArgumentException>(() => c.ShowMessage(MsgTipo.Grave, ""));
    }

    // ── delta + ação ────────────────────────────────────────

    [Fact]
    public void CST_14_SetDelta_valida_tone_enum()
    {
        var c = new CockpitState();
        c.SetDelta("0.27", Tone.Bom);
        Assert.Equal("0.27",  c.Get().Delta.Value);
        Assert.Equal(Tone.Bom, c.Get().Delta.Tone);
        Assert.Throws<ArgumentException>(() => c.SetDelta("0.27", (Tone)999));
    }

    [Fact]
    public void CST_15_SetAcao_valida_tone_e_exige_texto_nao_nulo()
    {
        var c = new CockpitState();
        c.SetAcao("ÁPICE TARDE", Tone.Neutro);
        Assert.Equal("ÁPICE TARDE", c.Get().Acao.Texto);
        Assert.Throws<ArgumentNullException>(() => c.SetAcao(null!, Tone.Bom));
        Assert.Throws<ArgumentException>(() => c.SetAcao("ok", (Tone)999));
    }

    // ── apex ─────────────────────────────────────────────────

    [Fact]
    public void CST_16_SetApexPonto_aceita_papel_canonico()
    {
        var c = new CockpitState();
        c.SetApexPonto("entrada", estado: ApexEstado.OkMelhor, valorKmh: 95);
        var e = c.Get().Apex.Entrada;
        Assert.Equal(ApexEstado.OkMelhor, e.Estado);
        Assert.Equal(95.0, e.ValorKmh);
    }

    [Fact]
    public void CST_17_SetApexPonto_rejeita_papel_invalido()
    {
        var c = new CockpitState();
        Assert.Throws<ArgumentException>(() => c.SetApexPonto("saida2", valorKmh: 80));
    }

    [Fact]
    public void CST_18_ClassifyFreio_dentro_de_10pct_vira_ok_melhor_fora_vira_ok_pior()
    {
        Assert.Equal(ApexEstado.OkMelhor, CockpitState.ClassifyFreio(15, 16));   // dentro de 16±1.6
        Assert.Equal(ApexEstado.OkMelhor, CockpitState.ClassifyFreio(17, 16));   // dentro
        Assert.Equal(ApexEstado.OkPior,   CockpitState.ClassifyFreio(13, 16));   // fora
        Assert.Equal(ApexEstado.OkPior,   CockpitState.ClassifyFreio(22, 16));   // fora
        Assert.Equal(ApexEstado.OkPior,   CockpitState.ClassifyFreio(double.NaN, 16)); // input inválido
        Assert.Equal(ApexEstado.OkPior,   CockpitState.ClassifyFreio(15, 0));    // ref zero
    }

    // ── observer ─────────────────────────────────────────────

    [Fact]
    public void CST_19_OnChange_dispara_so_quando_estado_realmente_mudou()
    {
        var c = new CockpitState();
        var calls = 0;
        c.OnChange((_, _, _) => calls++);
        c.SetTrechoStatus(TrechoStatus.RecordeStint);
        c.SetTrechoStatus(TrechoStatus.RecordeStint); // no-op
        Assert.Equal(1, calls);
    }

    [Fact]
    public void CST_20_OnChange_recebe_newState_prevState_changedKeys()
    {
        var c = new CockpitState();
        IReadOnlyList<string>? observedKeys = null;
        string? observedDeltaValPrev = null;
        c.OnChange((_, prev, keys) =>
        {
            observedKeys = keys;
            observedDeltaValPrev = prev.Delta.Value;
        });
        c.SetDelta("0.42", Tone.Erro);
        Assert.NotNull(observedKeys);
        Assert.Contains("delta", observedKeys!);
        Assert.Equal("0.00", observedDeltaValPrev);
    }

    [Fact]
    public void CST_21_OnChange_unsubscribe_nao_vaza_listener()
    {
        var c = new CockpitState();
        var calls = 0;
        var unsub = c.OnChange((_, _, _) => calls++);
        c.SetTrechoStatus(TrechoStatus.RecordeStint);
        unsub();
        c.SetTrechoStatus(TrechoStatus.PiorStint);
        Assert.Equal(1, calls);
    }

    [Fact]
    public void CST_22_Listener_que_lanca_erro_nao_derruba_outros_listeners()
    {
        var c = new CockpitState();
        var okCalled = false;
        c.OnChange((_, _, _) => throw new InvalidOperationException("boom"));
        c.OnChange((_, _, _) => okCalled = true);
        c.SetTrechoStatus(TrechoStatus.RecordeStint);
        Assert.True(okCalled);
    }

    // ── applyHaloPreset (mapeia presets canônicos do mockup) ──

    [Fact]
    public void CST_23_ApplyHaloPreset_recorde_stint_bate_com_haloStates_do_canonico()
    {
        // preset extraído de cockpit.js linha ~100
        var preset = new HaloPreset
        {
            Halo          = "recorde-stint",
            DeltaClass    = "bom",
            DeltaVal      = "0.27",
            AcaoText      = "ÁPICE TARDE",
            AcaoClass     = "",
            EntradaEstado = "ok-melhor",
            EntradaVal    = 95,
            FreioAtual    = 15,
        };
        var c = new CockpitState();
        c.ApplyHaloPreset(preset);
        var s = c.Get();
        Assert.Equal(TrechoStatus.RecordeStint, s.TrechoStatus);
        Assert.Equal(Tone.Bom,                  s.Delta.Tone);
        Assert.Equal("0.27",                    s.Delta.Value);
        Assert.Equal("ÁPICE TARDE",             s.Acao.Texto);
        Assert.Equal(Tone.Neutro,               s.Acao.Tone); // acaoClass vazio
        Assert.Equal(ApexEstado.OkMelhor,       s.Apex.Entrada.Estado);
        Assert.Equal(95.0,                      s.Apex.Entrada.ValorKmh);
        Assert.Equal(15.0,                      s.Apex.Freio.AtualM);
    }

    [Fact]
    public void CST_24_ApplyHaloPreset_pior_stint_leva_a_delta_ERRO_e_entrada_ok_pior()
    {
        var preset = new HaloPreset
        {
            Halo          = "pior-stint",
            DeltaClass    = "erro",
            DeltaVal      = "0.42",
            AcaoText      = "FREIE TARDE",
            AcaoClass     = "erro",
            EntradaEstado = "ok-pior",
            EntradaVal    = 88,
            FreioAtual    = 22,
        };
        var c = new CockpitState();
        c.ApplyHaloPreset(preset);
        var s = c.Get();
        Assert.Equal(TrechoStatus.PiorStint, s.TrechoStatus);
        Assert.Equal(Tone.Erro,              s.Delta.Tone);
        Assert.Equal(Tone.Erro,              s.Acao.Tone);
        Assert.Equal(ApexEstado.OkPior,      s.Apex.Entrada.Estado);
    }
}
