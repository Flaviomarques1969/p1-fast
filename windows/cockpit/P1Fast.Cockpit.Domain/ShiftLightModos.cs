// ShiftLightModos — os 3 modos do shift light (Durabilidade / Normal / Agressivo).
// Port fiel de web/cockpit/shift-light-modos.js (decisão Flávio 2026-05-29, janelas
// recalibradas pra curva real do Bubi por auditor de competição sênior).
//
// As 3 janelas são DERIVADAS do perfil do motor (4 pontos-chave da curva do dyno) —
// NÃO há janela hardcoded universal; cada motor tem as suas. A IA da luz de marcha
// opera SOMENTE dentro da janela do modo escolhido.

namespace P1Fast.Cockpit.Domain;

/// <summary>Os 3 modos canônicos, em ordem (Durabilidade &lt; Normal &lt; Agressivo).</summary>
public enum ModoStint { Durabilidade, Normal, Agressivo }

/// <summary>Perfil do motor: os 4 pontos-chave que definem sua "personalidade" (do dyno).</summary>
public sealed record PerfilMotor(
    string Apelido,
    double PicoTorqueRpm,
    double PicoPotenciaRpm,
    double RedlineRpm,     // operacional
    double LimiteHardRpm); // mecânico (acima disso, risco real de quebra)

/// <summary>Janela de um modo: faixa de RPM de troca + rótulos e custo/ganho.</summary>
public sealed record JanelaModo(
    ModoStint Modo,
    string Nome,
    string NomeBreve,
    double RpmMin,
    double RpmMax,
    string Cor,
    double GanhoVoltaEstimadoS,
    string DesgasteRelativo);

public static class ShiftLightModos
{
    /// <summary>Bubi (Celta 1.4 motor Onix) — pico torque 5.200, pico HP 6.050, redline 6.300, limite 6.350.</summary>
    public static readonly PerfilMotor PerfilBubi = new(
        Apelido: "Bubi (Celta 1.4 motor Onix)",
        PicoTorqueRpm: 5200,
        PicoPotenciaRpm: 6050,
        RedlineRpm: 6300,
        LimiteHardRpm: 6350);

    /// <summary>
    /// Deriva as 3 janelas do perfil do motor (heurística validada pelo auditor):
    ///  - Durabilidade: começa pouco antes do pico de potência, termina no pico (troca cedo, motor dura).
    ///  - Normal: logo após o pico até pouco antes do redline (padrão recomendado).
    ///  - Agressivo: antes do redline até o limite mecânico (aceita risco, máximo ganho).
    /// Pra Bubi: Dur 5800-6050, Normal 6100-6250, Agr 6250-6350.
    /// </summary>
    public static IReadOnlyDictionary<ModoStint, JanelaModo> DerivarJanelas(PerfilMotor perfil)
    {
        ArgumentNullException.ThrowIfNull(perfil);
        var pico = perfil.PicoPotenciaRpm;
        var redline = perfil.RedlineRpm;
        var limite = perfil.LimiteHardRpm;
        return new Dictionary<ModoStint, JanelaModo>
        {
            [ModoStint.Durabilidade] = new(ModoStint.Durabilidade, "Durabilidade", "DUR",
                RpmMin: pico - 250, RpmMax: pico, Cor: "azul", GanhoVoltaEstimadoS: -0.4, DesgasteRelativo: "baixo"),
            [ModoStint.Normal] = new(ModoStint.Normal, "Normal", "NRM",
                RpmMin: pico + 50, RpmMax: redline - 50, Cor: "verde", GanhoVoltaEstimadoS: 0.0, DesgasteRelativo: "normal"),
            [ModoStint.Agressivo] = new(ModoStint.Agressivo, "Agressivo", "AGR",
                RpmMin: redline - 50, RpmMax: limite, Cor: "vermelho", GanhoVoltaEstimadoS: 0.4, DesgasteRelativo: "alto"),
        };
    }

    /// <summary>Janelas do Bubi (default), derivadas do <see cref="PerfilBubi"/>.</summary>
    public static readonly IReadOnlyDictionary<ModoStint, JanelaModo> JanelasBubi = DerivarJanelas(PerfilBubi);

    /// <summary>Janela do modo pro motor dado (default = Bubi).</summary>
    public static JanelaModo JanelaParaModo(ModoStint modo, PerfilMotor? perfil = null)
    {
        var janelas = perfil is null || ReferenceEquals(perfil, PerfilBubi) ? JanelasBubi : DerivarJanelas(perfil);
        return janelas[modo];
    }

    /// <summary>Os 3 modos em ordem canônica.</summary>
    public static IReadOnlyList<JanelaModo> Listar(PerfilMotor? perfil = null)
    {
        var j = perfil is null ? JanelasBubi : DerivarJanelas(perfil);
        return new[] { j[ModoStint.Durabilidade], j[ModoStint.Normal], j[ModoStint.Agressivo] };
    }

    /// <summary>Um RPM está dentro da janela do modo?</summary>
    public static bool RpmDentroDaJanela(double rpm, ModoStint modo, PerfilMotor? perfil = null)
    {
        var jan = JanelaParaModo(modo, perfil);
        return rpm >= jan.RpmMin && rpm <= jan.RpmMax;
    }
}
