// CockpitState — store ativo com observer pattern (event-based).
//
// Equivalente JS: web/cockpit/cockpit-state.js (classe CockpitState)
// Spec: PLANO_FASE_1.md §6 MS-13.3 (reescrito 2026-05-09 — ADR-023)
//
// Mantém um CockpitStateModel imutável; cada setter valida, troca o record
// inteiro via with-expression e emite onChange(current, previous, changedKeys)
// pra todos os listeners. Listeners que lançam exceção são contidos — um
// listener com bug não derruba os outros. Modelo puro: zero UI, zero I/O.

using System.Globalization;

namespace P1Fast.Cockpit.Domain;

public delegate void CockpitStateChangedHandler(
    CockpitStateModel current,
    CockpitStateModel previous,
    IReadOnlyList<string> changedKeys);

public sealed class CockpitState
{
    public const int ShiftLevelMin  = 0;
    public const int ShiftLevelMax  = 6;  // canônico vai 0..6 → fire → overrev
    public const int ShiftDotsTotal = 12; // mockup tem 12 LEDs

    private CockpitStateModel _state;
    private readonly List<CockpitStateChangedHandler> _listeners = new();

    public CockpitState() : this(null) { }

    public CockpitState(CockpitStateModel? initial)
    {
        _state = initial ?? CockpitStateModel.Default();
    }

    public CockpitStateModel Get() => _state;

    /// <summary>Subscreve a mudanças de estado. Retorna ação para desinscrever.</summary>
    public Action OnChange(CockpitStateChangedHandler listener)
    {
        ArgumentNullException.ThrowIfNull(listener);
        _listeners.Add(listener);
        return () => _listeners.Remove(listener);
    }

    private void Emit(CockpitStateModel prev, IReadOnlyList<string> changedKeys)
    {
        // Cópia defensiva: listener pode chamar OnChange/desinscrever durante emissão.
        var snapshot = _listeners.ToArray();
        foreach (var cb in snapshot)
        {
            try { cb(_state, prev, changedKeys); }
            catch
            {
                // Listener com bug não pode derrubar o cockpit. Swallow.
            }
        }
    }

    // ── Setters individuais (validam + emitem onChange) ─────────────

    public void SetTrechoStatus(TrechoStatus value)
    {
        AssertEnumDefined(value, nameof(value));
        if (_state.TrechoStatus == value) return;
        var prev = _state;
        _state = prev with { TrechoStatus = value };
        Emit(prev, new[] { "trechoStatus" });
    }

    public void SetShift(ShiftMode? mode = null, int? level = null, ShiftFire? fire = null)
    {
        var cur = _state.Shift;
        var nextMode  = cur.Mode;
        var nextLevel = cur.Level;
        var nextFire  = cur.Fire;

        if (mode is { } m)
        {
            AssertEnumDefined(m, nameof(mode));
            nextMode = m;
        }
        if (level is { } l)
        {
            AssertShiftLevel(l);
            nextLevel = l;
        }
        if (fire is { } f)
        {
            AssertEnumDefined(f, nameof(fire));
            nextFire = f;
        }

        if (cur.Mode == nextMode && cur.Level == nextLevel && cur.Fire == nextFire) return;

        var prev = _state;
        _state = prev with { Shift = new ShiftState(nextMode, nextLevel, nextFire) };
        Emit(prev, new[] { "shift" });
    }

    /// <summary>
    /// Atalho do cockpit canônico: <c>off</c>/<c>overrev</c> zeram nível e fire;
    /// <c>fire</c> dispara active e zera nível; <c>lit</c> aplica o nível recebido.
    /// </summary>
    public void ApplyShift(ShiftMode mode, int level = 0)
    {
        if (mode == ShiftMode.Off)     { SetShift(mode: ShiftMode.Off,     level: 0, fire: ShiftFire.Idle);   return; }
        if (mode == ShiftMode.Overrev) { SetShift(mode: ShiftMode.Overrev, level: 0, fire: ShiftFire.Idle);   return; }
        if (mode == ShiftMode.Fire)    { SetShift(mode: ShiftMode.Fire,    level: 0, fire: ShiftFire.Active); return; }
        SetShift(mode: ShiftMode.Lit, level: level, fire: ShiftFire.Idle);
    }

    public void ShowMessage(MsgTipo tipo, string texto)
    {
        AssertEnumDefined(tipo, nameof(tipo));
        if (string.IsNullOrEmpty(texto))
            throw new ArgumentException("message.texto precisa ser string não-vazia", nameof(texto));

        // Modo silencioso: bloqueia comunicações (coach), mas NUNCA bloqueia
        // alertas críticos (GRAVE). Paridade com cockpit-state.js:241.
        if (_state.Silencioso && tipo == MsgTipo.Comunicacao) return;

        var cur = _state.Message;
        if (cur is not null && cur.Tipo == tipo && cur.Texto == texto) return;
        var prev = _state;
        _state = prev with { Message = new Message(tipo, texto) };
        Emit(prev, new[] { "message" });
    }

    public void HideMessage()
    {
        if (_state.Message is null) return;
        var prev = _state;
        _state = prev with { Message = null };
        Emit(prev, new[] { "message" });
    }

    public void SetDelta(string value, Tone tone)
    {
        ArgumentNullException.ThrowIfNull(value);
        AssertEnumDefined(tone, nameof(tone));
        var cur = _state.Delta;
        if (cur.Value == value && cur.Tone == tone) return;
        var prev = _state;
        _state = prev with { Delta = new DeltaInfo(value, tone) };
        Emit(prev, new[] { "delta" });
    }

    public void SetAcao(string texto, Tone tone)
    {
        ArgumentNullException.ThrowIfNull(texto);
        AssertEnumDefined(tone, nameof(tone));
        var cur = _state.Acao;
        if (cur.Texto == texto && cur.Tone == tone) return;
        var prev = _state;
        _state = prev with { Acao = new AcaoInfo(texto, tone) };
        Emit(prev, new[] { "acao" });
    }

    /// <summary>Atualiza um apex ponto (entrada/freio/apice/saida) com campos parciais.</summary>
    public void SetApexPonto(
        string papel,
        ApexEstado? estado = null,
        double? valorKmh   = null,
        double? atualM     = null,
        double? refM       = null)
    {
        if (papel is not ("entrada" or "freio" or "apice" or "saida"))
            throw new ArgumentException($"apex papel=\"{papel}\" inválido", nameof(papel));

        if (estado is { } e) AssertEnumDefined(e, nameof(estado));

        var cur = _state.Apex.Get(papel);
        var next = new ApexPonto(
            Estado:   estado   ?? cur.Estado,
            ValorKmh: valorKmh ?? cur.ValorKmh,
            AtualM:   atualM   ?? cur.AtualM,
            RefM:     refM     ?? cur.RefM
        );

        if (next == cur) return;

        var prev = _state;
        _state = prev with { Apex = prev.Apex.With(papel, next) };
        Emit(prev, new[] { "apex" });
    }

    /// <summary>Aplica preset canônico do mockup (haloStates) — campos ausentes ficam intactos.</summary>
    public void ApplyHaloPreset(HaloPreset preset)
    {
        ArgumentNullException.ThrowIfNull(preset);

        var trechoRaw = preset.TrechoStatus ?? preset.Halo;
        if (trechoRaw is not null) SetTrechoStatus(EnumMapping.TrechoStatusFromString(trechoRaw));

        if (preset.DeltaVal is not null)
        {
            var tone = preset.DeltaClass switch
            {
                "bom"  => Tone.Bom,
                "erro" => Tone.Erro,
                _      => Tone.Neutro,
            };
            SetDelta(preset.DeltaVal, tone);
        }

        if (preset.AcaoText is not null)
        {
            var tone = preset.AcaoClass switch
            {
                "bom"  => Tone.Bom,
                "erro" => Tone.Erro,
                _      => Tone.Neutro,
            };
            SetAcao(preset.AcaoText, tone);
        }

        if (preset.EntradaEstado is not null || preset.EntradaVal is not null)
        {
            SetApexPonto(
                "entrada",
                estado:   preset.EntradaEstado is not null ? EnumMapping.ApexEstadoFromString(preset.EntradaEstado) : null,
                valorKmh: preset.EntradaVal);
        }

        if (preset.FreioAtual is not null || preset.FreioRef is not null)
        {
            SetApexPonto(
                "freio",
                atualM: preset.FreioAtual,
                refM:   preset.FreioRef);
        }
    }

    // ── Helpers estáticos ──────────────────────────────────────────

    /// <summary>Quantos LEDs acendem quando mode=LIT e level=N. Map linear; clampa fora do range.</summary>
    public static int ShiftDotsForLevel(int level)
    {
        if (level <= ShiftLevelMin) return 0;
        if (level >= ShiftLevelMax) return ShiftDotsTotal;
        return (int)Math.Round((double)level / ShiftLevelMax * ShiftDotsTotal, MidpointRounding.AwayFromZero);
    }

    /// <summary>
    /// Classifica freio atual vs referência. Verde se atual ∈ ref ± tolerância (default 10%);
    /// vermelho fora ou se input inválido.
    /// </summary>
    public static ApexEstado ClassifyFreio(double atualM, double refM, double tolerancePct = 0.10)
    {
        if (double.IsNaN(atualM) || double.IsInfinity(atualM)) return ApexEstado.OkPior;
        if (double.IsNaN(refM)   || double.IsInfinity(refM))   return ApexEstado.OkPior;
        if (refM <= 0) return ApexEstado.OkPior;
        var tol = refM * tolerancePct;
        return Math.Abs(atualM - refM) <= tol ? ApexEstado.OkMelhor : ApexEstado.OkPior;
    }

    // ── Validação interna ──────────────────────────────────────────

    private static void AssertEnumDefined<TEnum>(TEnum value, string paramName) where TEnum : struct, Enum
    {
        if (!Enum.IsDefined(value))
            throw new ArgumentException(
                $"CockpitState: {paramName}={value} não é valor válido de {typeof(TEnum).Name}",
                paramName);
    }

    private static void AssertShiftLevel(int level)
    {
        if (level < ShiftLevelMin || level > ShiftLevelMax)
            throw new ArgumentOutOfRangeException(
                nameof(level),
                level,
                $"shift.level={level.ToString(CultureInfo.InvariantCulture)} fora de [{ShiftLevelMin}..{ShiftLevelMax}]");
    }
}

/// <summary>Preset canônico do mockup (haloStates). Campos null são ignorados.</summary>
public sealed record HaloPreset
{
    /// <summary>Alias antigo do canônico — equivale a <see cref="TrechoStatus"/>.</summary>
    public string? Halo          { get; init; }
    public string? TrechoStatus  { get; init; }
    public string? DeltaClass    { get; init; }
    public string? DeltaVal      { get; init; }
    public string? AcaoText      { get; init; }
    public string? AcaoClass     { get; init; }
    public string? EntradaEstado { get; init; }
    public double? EntradaVal    { get; init; }
    public double? FreioAtual    { get; init; }
    public double? FreioRef      { get; init; }
}
