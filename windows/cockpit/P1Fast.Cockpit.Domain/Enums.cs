// Enums espelham o vocabulário do mockup canônico
// (_design-reference/mockup-cockpit-piloto.html). Cada string bate
// 1:1 com os data-attrs / classes que o XAML vai consumir depois.
//
// Equivalente JS: web/cockpit/cockpit-state.js (TrechoStatus, ShiftMode, etc.)

namespace P1Fast.Cockpit.Domain;

/// <summary>Status do trecho atual no halo radial.</summary>
public enum TrechoStatus
{
    Neutro,
    RecordeStint,
    MelhorHistorico,
    PiorStint,
}

/// <summary>Modo do shift light.</summary>
public enum ShiftMode
{
    Off,
    Lit,      // 0..6 LEDs acesos baseado em level
    Fire,     // strobe de troca
    Overrev,  // erro: além do limite
}

/// <summary>Estado do device flash sincronizado com fire.</summary>
public enum ShiftFire
{
    Idle,
    Active,
}

/// <summary>Visibilidade da mensagem (alerta ou comunicação).</summary>
public enum MsgState
{
    Oculta,
    Ativa,
}

/// <summary>Tipo da mensagem ativa.</summary>
public enum MsgTipo
{
    Comunicacao,
    Grave,
}

/// <summary>Tom semântico de delta / ação.</summary>
public enum Tone
{
    Neutro,
    Bom,
    Erro,
}

/// <summary>Estado de cada apex ponto.</summary>
public enum ApexEstado
{
    // Pendente = ainda não há referência/passagem (boot e sem volta de referência).
    // Espelha ApexEstado.PENDENTE do cockpit-state.js.
    Pendente,
    OkMelhor,
    OkPior,
}

/// <summary>
/// Status da barra de aprendizado da IA da luz de marcha. Derivado do pct.
/// Espelha AprendizadoStatus do cockpit-state.js (statusFromPct).
/// </summary>
public enum AprendizadoStatus
{
    Inativo,
    Aprendendo,
    Parcial,
    Calibrado,
}

/// <summary>Mapeamento string ↔ enum pra paridade com data-attrs do mockup.</summary>
public static class EnumMapping
{
    public static string ToCockpitString(this TrechoStatus v) => v switch
    {
        TrechoStatus.Neutro          => "neutro",
        TrechoStatus.RecordeStint    => "recorde-stint",
        TrechoStatus.MelhorHistorico => "melhor-historico",
        TrechoStatus.PiorStint       => "pior-stint",
        _ => throw new ArgumentOutOfRangeException(nameof(v)),
    };

    public static string ToCockpitString(this ShiftMode v) => v switch
    {
        ShiftMode.Off     => "off",
        ShiftMode.Lit     => "lit",
        ShiftMode.Fire    => "fire",
        ShiftMode.Overrev => "overrev",
        _ => throw new ArgumentOutOfRangeException(nameof(v)),
    };

    public static string ToCockpitString(this ShiftFire v) => v switch
    {
        ShiftFire.Idle   => "idle",
        ShiftFire.Active => "active",
        _ => throw new ArgumentOutOfRangeException(nameof(v)),
    };

    public static string ToCockpitString(this MsgState v) => v switch
    {
        MsgState.Oculta => "oculta",
        MsgState.Ativa  => "ativa",
        _ => throw new ArgumentOutOfRangeException(nameof(v)),
    };

    public static string ToCockpitString(this MsgTipo v) => v switch
    {
        MsgTipo.Comunicacao => "comunicacao",
        MsgTipo.Grave       => "grave",
        _ => throw new ArgumentOutOfRangeException(nameof(v)),
    };

    public static string ToCockpitClass(this Tone v) => v switch
    {
        Tone.Neutro => "",
        Tone.Bom    => "bom",
        Tone.Erro   => "erro",
        _ => throw new ArgumentOutOfRangeException(nameof(v)),
    };

    public static string ToCockpitString(this ApexEstado v) => v switch
    {
        ApexEstado.OkMelhor => "ok-melhor",
        ApexEstado.OkPior   => "ok-pior",
        _ => throw new ArgumentOutOfRangeException(nameof(v)),
    };

    // ── Reverso: string canônica → enum ──

    public static TrechoStatus TrechoStatusFromString(string s) => s switch
    {
        "neutro"           => TrechoStatus.Neutro,
        "recorde-stint"    => TrechoStatus.RecordeStint,
        "melhor-historico" => TrechoStatus.MelhorHistorico,
        "pior-stint"       => TrechoStatus.PiorStint,
        _ => throw new ArgumentException($"trechoStatus=\"{s}\" inválido", nameof(s)),
    };

    public static ShiftMode ShiftModeFromString(string s) => s switch
    {
        "off"     => ShiftMode.Off,
        "lit"     => ShiftMode.Lit,
        "fire"    => ShiftMode.Fire,
        "overrev" => ShiftMode.Overrev,
        _ => throw new ArgumentException($"shift.mode=\"{s}\" inválido", nameof(s)),
    };

    public static ShiftFire ShiftFireFromString(string s) => s switch
    {
        "idle"   => ShiftFire.Idle,
        "active" => ShiftFire.Active,
        _ => throw new ArgumentException($"shift.fire=\"{s}\" inválido", nameof(s)),
    };

    public static MsgTipo MsgTipoFromString(string s) => s switch
    {
        "comunicacao" => MsgTipo.Comunicacao,
        "grave"       => MsgTipo.Grave,
        _ => throw new ArgumentException($"message.tipo=\"{s}\" inválido", nameof(s)),
    };

    public static ApexEstado ApexEstadoFromString(string s) => s switch
    {
        "ok-melhor" => ApexEstado.OkMelhor,
        "ok-pior"   => ApexEstado.OkPior,
        _ => throw new ArgumentException($"apex.estado=\"{s}\" inválido", nameof(s)),
    };
}
