// LiveDataBridge — cola entre os dados que chegam (transports + T4000) e o
// CockpitState (modelo do painel). Roda no notebook Windows.
//
// Equivalente JS: web/cockpit/live-data-bridge.js
// Spec: PLANO_FASE_1.md §6 MS-13.4 + ADR-023 amendment 2 (Flávio 2026-05-09)
//
// Fontes:
// 1. TransportSelector → IMU/GPS do iPhone (envelope { tMono, source, payload })
//    ingerido por IngestImuGps; armazenado pra detector consumir mais tarde.
// 2. T4000Provider local → samples T4000 (RPM, marcha, MAP, λ, temperaturas,
//    pressões, erro ECU, etc.) ingeridos por IngestT4000.
//
// O bridge faz duas tarefas:
// - Mapear T4000 → estado direto do cockpit (shift light + alertas críticos).
// - Armazenar último IMU/GPS pra detector futuro (MS-13.5) consumir.

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
}

/// <summary>Resultado de RpmToShift: modo do shift light + nível 0..6.</summary>
public sealed record ShiftDecision(ShiftMode Mode, int Level);

/// <summary>Alerta crítico do T4000 — { tipo, texto } pra ShowMessage.</summary>
public sealed record LiveAlert(MsgTipo Tipo, string Texto);

/// <summary>Payload típico do iPhone IMU/GPS (campos mínimos pra detector consumir).</summary>
public sealed record ImuGpsPayload(
    double X,
    double Y,
    double? AccLong  = null,
    double? AccLat   = null,
    double? SpeedKmh = null
);

public sealed record LiveDataBridgeStats(
    int ImuGpsCount,
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

    private object? _lastImuGps;
    private T4000ProviderSample? _lastT4000;
    private string? _activeAlertTexto;

    private int _imuGpsCount;
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

    /// <summary>Plugado no TransportSelector — recebe envelope do cabo OU do realtime, indistinto.</summary>
    public void IngestImuGps(TransportEnvelope envelope)
    {
        if (envelope is null || envelope.Source != "iphone-imu" || envelope.Payload is null) return;
        _lastImuGps = envelope.Payload;
        _imuGpsCount++;
    }

    /// <summary>Plugado no T4000Provider — recebe sample já parseado e validado.</summary>
    public void IngestT4000(T4000ProviderSample sample)
    {
        if (sample is null) return;
        _lastT4000 = sample;
        _t4000Count++;
        ApplyT4000ToCockpit(sample);
    }

    /// <summary>
    /// Plugado no leitor USB nativo da T3000/T4000 (bloco RI). Recebe o sample já
    /// decodificado e aplica no cockpit: RPM → shift light + alarmes → mensagem.
    /// É o caminho usado pelo app WinUI lendo a central de verdade.
    /// </summary>
    public void IngestT3000(T3000Sample sample)
    {
        if (sample is null) return;
        _t4000Count++;
        ApplyT3000ToCockpit(sample);
    }

    public object? GetLastImuGps() => _lastImuGps;
    public T4000ProviderSample? GetLastT4000() => _lastT4000;

    public LiveDataBridgeStats GetStats() => new(
        ImuGpsCount:   _imuGpsCount,
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

    /// <summary>
    /// Alertas críticos a partir do sample RI da T3000/T4000 (bitfield de alarmes
    /// da central + temperatura de água). Ordem de gravidade espelha o JS
    /// (ALARM_PRIORITY em web/cockpit/live-data-bridge.js).
    /// </summary>
    public static LiveAlert? CheckCriticalAlertsT3000(T3000Sample s, LiveLimits? limits = null)
    {
        if (s is null || !s.ChecksumOk) return null;
        var l = limits ?? LiveLimits.Default;
        var a = s.Alarmes;

        if (a.BaixaPressaoOleo)         return new LiveAlert(MsgTipo.Grave, "ÓLEO BAIXO");
        if (a.ExcessoTempMotor)         return new LiveAlert(MsgTipo.Grave, "MOTOR QUENTE");
        if (a.BaixaPressaoCombustivel)  return new LiveAlert(MsgTipo.Grave, "COMBUSTÍVEL BAIXO");
        if (a.ExcessoRotacao)           return new LiveAlert(MsgTipo.Grave, "ROTAÇÃO ALTA");
        if (a.ExcessoPressao)           return new LiveAlert(MsgTipo.Grave, "PRESSÃO ALTA");
        if (s.WaterTempC is int w && w > l.WaterTempMaxC)
                                        return new LiveAlert(MsgTipo.Grave, "Temperatura água crítica");
        if (a.WbMaximo)                 return new LiveAlert(MsgTipo.Comunicacao, "Pra box");
        if (a.WbMinimo)                 return new LiveAlert(MsgTipo.Comunicacao, "Alivie");
        if (a.AlertaNivelCombustivel)   return new LiveAlert(MsgTipo.Comunicacao, "Abasteça");
        return null;
    }

    private void ApplyT3000ToCockpit(T3000Sample s)
    {
        if (!s.ChecksumOk)
        {
            _onEvent?.Invoke(new LiveBridgeEvent("t3000-bad-checksum"));
            return;
        }

        // 1. RPM → shift mode/level (mesma lógica do T4000)
        var decision = RpmToShift(s.Rpm, _limits);
        _cockpitState.ApplyShift(decision.Mode, decision.Level);

        // 2. Alertas críticos (bitfield da central + água)
        var alert = CheckCriticalAlertsT3000(s, _limits);
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
            _cockpitState.HideMessage();
            _activeAlertTexto = null;
            _alertsCleared++;
            _onEvent?.Invoke(new LiveBridgeEvent("alert-cleared"));
        }
    }
}
