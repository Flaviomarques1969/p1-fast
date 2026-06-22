// Modelo de estado do cockpit do piloto — records imutáveis (.NET 8 / C# 12).
//
// Equivalente JS: web/cockpit/cockpit-state.js (defaultCockpitState)
// Spec: PLANO_FASE_1.md §6 MS-13.3 (reescrito 2026-05-09 — ADR-023)
// Mockup canônico: _design-reference/mockup-cockpit-piloto.html
//
// Espelha 1:1 os 4 data-attrs externos do cockpit + campos derivados de
// delta, ação e apex pontos. Modelo puro: zero UI, zero I/O. Roda igual
// em CI multi-OS, no host WinUI 3, ou em testes xUnit.

namespace P1Fast.Cockpit.Domain;

/// <summary>Estado completo do cockpit num instante. Imutável; mutações criam novo record via <c>with</c>.</summary>
public sealed record CockpitStateModel(
    TrechoStatus TrechoStatus,
    ShiftState Shift,
    Message? Message,
    DeltaInfo Delta,
    AcaoInfo Acao,
    ApexState Apex
)
{
    // ── Paridade com cockpit-state.js (campos adicionados, default seguro) ──
    // Declarados como propriedades init pra não quebrar o construtor posicional
    // existente (Default + with continuam compilando).

    /// <summary>Modo silencioso: bloqueia mensagens de pilotagem (COMUNICACAO). GRAVE nunca é silenciado.</summary>
    public bool Silencioso { get; init; }

    /// <summary>Carro dentro do pit lane (após pit-in, antes de pit-out). Pausa cronômetro e silencia pilotagem.</summary>
    public bool NoBox { get; init; }

    /// <summary>Barra de aprendizado da IA da luz de marcha (status derivado do pct).</summary>
    public AprendizadoInfo Aprendizado { get; init; } = AprendizadoInfo.Default();

    /// <summary>Flash de celebração quando a IA atinge 100% (dispara no meio da próxima reta).</summary>
    public bool FlashIa { get; init; }

    /// <summary>Retorna o estado default (espelha o que o mockup carrega ao boot).</summary>
    public static CockpitStateModel Default() => new(
        TrechoStatus: TrechoStatus.Neutro,
        Shift: new ShiftState(ShiftMode.Off, 0, ShiftFire.Idle),
        Message: null,
        Delta: new DeltaInfo("0.00", Tone.Neutro),
        Acao: new AcaoInfo("", Tone.Neutro),
        Apex: ApexState.Default()
    );
}

/// <summary>Barra de aprendizado: % de calibração da combinação ativa + status derivado.</summary>
public sealed record AprendizadoInfo(AprendizadoStatus Status, double Pct)
{
    public static AprendizadoInfo Default() => new(AprendizadoStatus.Inativo, 0);
}

/// <summary>Estado do shift light: modo + nível 0..6 + estado do flash.</summary>
public sealed record ShiftState(ShiftMode Mode, int Level, ShiftFire Fire);

/// <summary>Mensagem ativa no cockpit (alerta ou comunicação). null = oculta.</summary>
public sealed record Message(MsgTipo Tipo, string Texto);

/// <summary>Delta de tempo formatado (string vinda do caller) + tom semântico.</summary>
public sealed record DeltaInfo(string Value, Tone Tone);

/// <summary>Texto da ação corretiva + tom semântico.</summary>
public sealed record AcaoInfo(string Texto, Tone Tone);

/// <summary>Os 4 apex pontos do trecho atual (entrada, freio, ápice, saída).</summary>
public sealed record ApexState(
    ApexPonto Entrada,
    ApexPonto Freio,
    ApexPonto Apice,
    ApexPonto Saida
)
{
    public static ApexState Default() => new(
        Entrada: new ApexPonto(ApexEstado.OkPior, ValorKmh: null, AtualM: null, RefM: null),
        Freio:   new ApexPonto(ApexEstado.OkPior, ValorKmh: null, AtualM: null, RefM: null),
        Apice:   new ApexPonto(ApexEstado.OkPior, ValorKmh: null, AtualM: null, RefM: null),
        Saida:   new ApexPonto(ApexEstado.OkPior, ValorKmh: null, AtualM: null, RefM: null)
    );

    /// <summary>Acessa apex ponto por papel canônico (entrada/freio/apice/saida).</summary>
    public ApexPonto Get(string papel) => papel switch
    {
        "entrada" => Entrada,
        "freio"   => Freio,
        "apice"   => Apice,
        "saida"   => Saida,
        _ => throw new ArgumentException($"apex papel=\"{papel}\" inválido", nameof(papel)),
    };

    /// <summary>Retorna novo ApexState com o papel substituído.</summary>
    public ApexState With(string papel, ApexPonto novo) => papel switch
    {
        "entrada" => this with { Entrada = novo },
        "freio"   => this with { Freio   = novo },
        "apice"   => this with { Apice   = novo },
        "saida"   => this with { Saida   = novo },
        _ => throw new ArgumentException($"apex papel=\"{papel}\" inválido", nameof(papel)),
    };
}

/// <summary>Um apex ponto: estado + valor (km/h pra entrada/ápice/saída, metros pra freio).</summary>
public sealed record ApexPonto(
    ApexEstado Estado,
    double? ValorKmh,
    double? AtualM,
    double? RefM
);
