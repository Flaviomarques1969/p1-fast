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
}
