// LiveDataBridge — cola entre os samples T4000 e o CockpitState (modelo do painel).
// Roda no notebook Windows.
//
// Equivalente JS: web/cockpit/live-data-bridge.js
//
// Fonte: T4000Provider local → samples T4000 (RPM, marcha, MAP, λ, temperaturas,
// pressões, erro ECU, etc.) ingeridos por IngestT4000.
//
// O caminho VIVO do cockpit usa daqui SÓ o helper estático RpmToShift (a luz de
// marcha, chamada pelo CockpitOrchestrator). O mapeamento de alertas críticos por
// VALOR (IngestT4000 → CheckCriticalAlerts) é LEGADO e só sobrevive pro
// p1fast-t4000-live-demo — ver os comentários DUROS nesses membros.
//
// A antiga fonte de IMU/GPS do iPhone (TransportSelector, ADR-023 iPhone-cabo) foi
// removida na faxina de código morto (onda 2, 2026-07-10): o GPS vivo entra hoje
// pelo RaceBox/GpsFiltroAoVivo, não por esta ponte.

namespace P1Fast.Cockpit.Domain;

/// <summary>Limites de calibração (DEFAULT_LIMITS no JS). Cada carro pode ter override.</summary>
public sealed record LiveLimits(
    int RedlineRpm            = 7500,
    double FireThresholdRatio = 0.95,
    double LitStartRatio      = 0.50,
    double OilPressMinBar     = 0.5,
    int OilPressMinAtRpm      = 2000, // só alerta abaixo do mínimo se RPM > este
    double OilTempMaxC        = 130,
    double WaterTempMaxC      = 110
)
{
    public static LiveLimits Default { get; } = new();

    /// <summary>
    /// Calibração do Bubi (Celta 1.4 "Bolinha"). Fontes reais:
    /// PERFIL_BUBI/ENVELOPE_DEFAULT_BUBI (shift-light-modos.js) — redline 6.300,
    /// pico de potência 6.050; alertas-criticos.js + memória "Bubi opera frio"
    /// (Flávio 27/05) — água crítica 80°C, óleo 115°C.
    /// Aqui está só o modelo SIMPLES (faixa por razão até o redline). A mira fina
    /// na POTÊNCIA MÁXIMA (6.050) + antecipação/aprendizado vivem no orquestrador
    /// da IA da luz de marcha (incremento seguinte), não neste mapa linear.
    /// </summary>
    public static LiveLimits Bubi { get; } = new(
        RedlineRpm:         6300,
        FireThresholdRatio: 6050.0 / 6300.0, // dispara perto do pico de potência
        LitStartRatio:      0.50,
        OilPressMinBar:     0.5,
        OilPressMinAtRpm:   2000,
        OilTempMaxC:        115,
        WaterTempMaxC:      80);
}

/// <summary>Resultado de RpmToShift: modo do shift light + nível 0..6.</summary>
public sealed record ShiftDecision(ShiftMode Mode, int Level);

/// <summary>Alerta crítico do T4000 — { tipo, texto } pra ShowMessage.</summary>
public sealed record LiveAlert(MsgTipo Tipo, string Texto);

public sealed record LiveDataBridgeStats(
    int T4000Count,
    int AlertsRaised,
    int AlertsCleared
);

/// <summary>Evento de observabilidade emitido pelo bridge.</summary>
public sealed record LiveBridgeEvent(string Stage, LiveAlert? Alert = null, double? TMono = null);

public sealed class LiveDataBridge
{
    private readonly CockpitState _cockpitState;
    private readonly LiveLimits _limits;
    private readonly Action<LiveBridgeEvent>? _onEvent;

    private T4000ProviderSample? _lastT4000;
    private string? _activeAlertTexto;

    private int _t4000Count;
    private int _alertsRaised;
    private int _alertsCleared;

    public LiveDataBridge(
        CockpitState cockpitState,
        LiveLimits? limits = null,
        Action<LiveBridgeEvent>? onEvent = null)
    {
        ArgumentNullException.ThrowIfNull(cockpitState);
        _cockpitState = cockpitState;
        _limits       = limits ?? LiveLimits.Default;
        _onEvent      = onEvent;
    }

    /// <summary>LEGADO — plugado no T4000Provider (hoje só o p1fast-t4000-live-demo). Aplica
    /// shift + alertas críticos por VALOR ao cockpit. NÃO usar no cockpit do piloto: os limiares
    /// de CheckCriticalAlerts divergem do catálogo v2 (AlertasCriticos é a cadeia canônica).</summary>
    public void IngestT4000(T4000ProviderSample sample)
    {
        if (sample is null) return;
        _lastT4000 = sample;
        _t4000Count++;
        ApplyT4000ToCockpit(sample);
    }

    public T4000ProviderSample? GetLastT4000() => _lastT4000;

    public LiveDataBridgeStats GetStats() => new(
        T4000Count:    _t4000Count,
        AlertsRaised:  _alertsRaised,
        AlertsCleared: _alertsCleared);

    // ── Helpers puros (testáveis isoladamente) ─────────────────────

    /// <summary>
    /// Mapeia RPM para shift mode + level conforme limites:
    /// >redline → Overrev; ≥fireThreshold → Fire; ≥litStart → Lit linear 1..6; &lt;litStart → Off.
    /// Defensivo: NaN/Infinity/negativo → Off.
    /// </summary>
    public static ShiftDecision RpmToShift(double rpm, LiveLimits? limits = null)
    {
        if (double.IsNaN(rpm) || double.IsInfinity(rpm) || rpm < 0)
            return new ShiftDecision(ShiftMode.Off, 0);

        var l = limits ?? LiveLimits.Default;
        if (rpm > l.RedlineRpm) return new ShiftDecision(ShiftMode.Overrev, 0);

        var ratio = rpm / l.RedlineRpm;
        if (ratio >= l.FireThresholdRatio) return new ShiftDecision(ShiftMode.Fire, 0);
        if (ratio < l.LitStartRatio)       return new ShiftDecision(ShiftMode.Off, 0);

        var span = l.FireThresholdRatio - l.LitStartRatio;
        var norm = (ratio - l.LitStartRatio) / span; // 0..<1
        var rounded = (int)Math.Round(norm * CockpitState.ShiftLevelMax, MidpointRounding.AwayFromZero);
        if (rounded == 0) rounded = 1;
        var level = Math.Max(1, Math.Min(CockpitState.ShiftLevelMax, rounded));
        return new ShiftDecision(ShiftMode.Lit, level);
    }

    /// <summary>
    /// Avalia condições críticas do T4000. Retorna alerta de maior prioridade ou null.
    /// Ordem: erro ECU &gt; água &gt; óleo (temp) &gt; pressão óleo (com RPM) &gt; EGT.
    /// </summary>
    public static LiveAlert? CheckCriticalAlerts(T4000ProviderSample sample, LiveLimits? limits = null)
    {
        if (sample is null || !sample.ChecksumOk) return null;
        var t = sample.Telemetry;
        var l = limits ?? LiveLimits.Default;

        if (t.EcuErrorBits != 0)
            return new LiveAlert(MsgTipo.Grave, "Erro ECU");
        if (t.WaterTempC > l.WaterTempMaxC)
            return new LiveAlert(MsgTipo.Grave, "Temperatura água crítica");
        if (t.OilTempC > l.OilTempMaxC)
            return new LiveAlert(MsgTipo.Grave, "Temperatura óleo crítica");
        if (t.OilPressBar < l.OilPressMinBar && t.Rpm > l.OilPressMinAtRpm)
            return new LiveAlert(MsgTipo.Grave, "Pressão óleo crítica");
        if (t.EgtOutOfRange)
            return new LiveAlert(MsgTipo.Grave, "EGT crítica");
        return null;
    }

    // ── Interno ────────────────────────────────────────────────────

    private void ApplyT4000ToCockpit(T4000ProviderSample sample)
    {
        if (!sample.ChecksumOk)
        {
            _onEvent?.Invoke(new LiveBridgeEvent("t4000-bad-checksum", TMono: sample.TMono));
            return; // não interpreta dado corrompido
        }

        // 1. RPM → shift mode/level
        var decision = RpmToShift(sample.Telemetry.Rpm, _limits);
        _cockpitState.ApplyShift(decision.Mode, decision.Level);

        // 2. Alertas críticos
        var alert = CheckCriticalAlerts(sample, _limits);
        if (alert is not null)
        {
            if (_activeAlertTexto != alert.Texto)
            {
                _cockpitState.ShowMessage(alert.Tipo, alert.Texto);
                _activeAlertTexto = alert.Texto;
                _alertsRaised++;
                _onEvent?.Invoke(new LiveBridgeEvent("alert-raised", Alert: alert));
            }
        }
        else if (_activeAlertTexto is not null)
        {
            // Condição limpou. Limpa só se a mensagem ativa era um alerta deste bridge.
            // (Mensagens de coach/comunicação ficam preservadas — futuro: priority manager.)
            _cockpitState.HideMessage();
            _activeAlertTexto = null;
            _alertsCleared++;
            _onEvent?.Invoke(new LiveBridgeEvent("alert-cleared"));
        }
    }
}
