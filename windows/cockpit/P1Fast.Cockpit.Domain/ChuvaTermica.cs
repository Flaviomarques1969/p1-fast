// ChuvaTermica — o cérebro da CHUVA TÉRMICA do cockpit do piloto (spec do iMac
// 2026-07-04: specs/SPEC_ELEMENTO_CHUVA_TERMICA.md §5 no canal claude-comms).
//
// Sobre o painel inteiro cai uma chuva de tela cheia guiada pela ÁGUA DO MOTOR
// (waterTempC, T3000/T4000). Semântica do Bubi (motor opera FRIO, ideal 50–55 °C):
// AZUL = ainda abaixo de 50 (aquecendo) · VERMELHO = passou de 50 subindo (esquentando
// demais). A intensidade DECAI conforme se aproxima da janela ideal e some dentro dela.
//
// Cortes = decisão Flávio 27/05/2026 (Bubi Celta 1.4), PARAMETRIZÁVEIS por carro (vêm
// do cadastro; não fixar na tela):
//   < 45 → warmup-alto · 45–48 → warmup-médio · 48–50 → warmup-leve · 50–55 → OFF
//   55–65 → cooldown-leve · 65–70 → cooldown-médio · ≥70 → cooldown-alto
//
// O ESCANDALOSO (água ≥70 "MOTOR AQUECENDO" / ≥80 "MOTOR QUENTE") NÃO vive aqui: já é
// conta do AlertasCriticos (gravidade Super → modo crítico da tela, gap 6). Uma conta,
// uma casa — aqui só a FASE da chuva. Sem água (motor mudo/sensor ausente) → Off:
// chuva nunca cai por dado velho ou inventado (§9).

namespace P1Fast.Cockpit.Domain;

/// <summary>As 7 fases da chuva térmica (espelho 1:1 do data-rain do web).</summary>
public enum FaseChuva
{
    Off,
    WarmupAlto,
    WarmupMedio,
    WarmupLeve,
    CooldownLeve,
    CooldownMedio,
    CooldownAlto,
}

/// <summary>
/// Cortes de temperatura da chuva, por carro. Default = Bubi (Celta 1.4, Flávio
/// 27/05/2026). Bordas: cada limite pertence à faixa DE CIMA (45.0 já é médio;
/// 50.0 já é ideal/off; 55.0 já é cooldown-leve; 70.0 já é cooldown-alto).
/// </summary>
public sealed record CortesChuvaTermica(
    double WarmupAltoAteC   = 45,
    double WarmupMedioAteC  = 48,
    double IdealDeC         = 50,
    double IdealAteC        = 55,
    double CooldownLeveAteC = 65,
    double CooldownMedioAteC = 70)
{
    /// <summary>Cortes do Bubi (Celta 1.4) — o default de toda a Fase 1.</summary>
    public static readonly CortesChuvaTermica Bubi = new();
}

/// <summary>Decisão pura: água do motor → fase da chuva. Zero UI, zero I/O.</summary>
public static class ChuvaTermica
{
    /// <summary>
    /// Mapeia a água do motor pra fase da chuva. null/NaN (sem sensor, motor mudo)
    /// → <see cref="FaseChuva.Off"/> — a chuva NUNCA cai sem dado vivo.
    /// </summary>
    public static FaseChuva Avaliar(double? waterTempC, CortesChuvaTermica? cortes = null)
    {
        if (waterTempC is not { } t || double.IsNaN(t)) return FaseChuva.Off;
        var c = cortes ?? CortesChuvaTermica.Bubi;

        if (t < c.WarmupAltoAteC)   return FaseChuva.WarmupAlto;
        if (t < c.WarmupMedioAteC)  return FaseChuva.WarmupMedio;
        if (t < c.IdealDeC)         return FaseChuva.WarmupLeve;
        if (t < c.IdealAteC)        return FaseChuva.Off;          // janela ideal — carro pronto
        if (t < c.CooldownLeveAteC) return FaseChuva.CooldownLeve;
        if (t < c.CooldownMedioAteC) return FaseChuva.CooldownMedio;
        return FaseChuva.CooldownAlto; // ≥70: o escandaloso é do AlertasCriticos; a chuva segue no máximo
    }
}
