// Transport — escolhe entre cabo USB (primário) e Supabase Realtime (fallback)
// pra entregar IMU/GPS do iPhone ao cockpit do notebook Windows.
//
// Equivalente JS: web/cockpit/transport.js
// Spec: PLANO_FASE_1.md §6 MS-13.4 + ADR-023 amendment 2 (Flávio 2026-05-09)
//
// Princípio:
// - Primary  = cabo USB (TCP-over-USB via iproxy/usbmuxd) — latência 5-15 ms
// - Fallback = Supabase Realtime canal `live-stint-{stintId}`     — latência 150-500 ms
//
// Healthcheck por heartbeat 1 Hz; switch após silenceTimeoutMs (3 s);
// recovery com debounce de recoveryDebounceMs (1 s) antes de voltar pro primary.
//
// Modelo puro: zero IO. Os transportes concretos (LocalSocket, Realtime)
// implementam ITransport e são plugados no construtor.

namespace P1Fast.Cockpit.Domain;

public enum SelectorState
{
    OnPrimary,
    OnFallback,
    Recovering, // primary voltou a heartbeat, ainda em debounce
}

public enum TransportHealth
{
    Healthy,
    Silent,
    Starting,
}

public sealed record TransportEnvelope(double TMono, string Source, object? Payload);

/// <summary>Evento emitido por <c>onSwitch</c>. Stage é "state-change" | "recovery-started" | "transport-error".</summary>
public sealed record SwitchEvent(
    string Stage,
    SelectorState? From       = null,
    SelectorState? To         = null,
    string? Reason            = null,
    double? SincePrimary      = null,
    string? Which             = null,
    string? Err               = null
);

public interface ITransport
{
    string Name { get; }
    void Start(Action<TransportEnvelope> onMessage, Action<Exception> onError);
    void Stop();
}

/// <summary>Defaults da spec MS-2.8 + MS-13.4.</summary>
public static class TransportDefaults
{
    public const int HeartbeatExpectedMs  = 1000; // 1 Hz
    public const int SilenceTimeoutMs     = 3000; // 3 s sem heartbeat → switch
    public const int RecoveryDebounceMs   = 1000; // 1 s estável antes de voltar
}

public sealed record TransportSelectorStats(
    SelectorState State,
    TransportHealth PrimaryHealth,
    double? LastPrimaryHeartbeatAgoMs,
    int PacketsForwarded,
    int PacketsDropped,
    int SwitchesToPrimary,
    int SwitchesToFallback
);

public sealed class TransportSelector
{
    private readonly ITransport _primary;
    private readonly ITransport _fallback;
    private readonly Action<TransportEnvelope> _onMessage;
    private readonly Action<SwitchEvent>? _onSwitch;
    private readonly int _silenceTimeoutMs;
    private readonly int _recoveryDebounceMs;
    private readonly Func<double> _now;

    private SelectorState _state = SelectorState.OnPrimary;
    private TransportHealth _primaryHealth = TransportHealth.Starting;
    private double? _lastPrimaryHeartbeatAt;
    private double? _recoveryStartedAt;
    private bool _started;

    private int _packetsForwarded;
    private int _packetsDropped;
    private int _switchesToPrimary;
    private int _switchesToFallback;

    public TransportSelector(
        ITransport primary,
        ITransport fallback,
        Action<TransportEnvelope> onMessage,
        Action<SwitchEvent>? onSwitch = null,
        int silenceTimeoutMs   = TransportDefaults.SilenceTimeoutMs,
        int recoveryDebounceMs = TransportDefaults.RecoveryDebounceMs,
        Func<double>? now      = null)
    {
        ArgumentNullException.ThrowIfNull(primary);
        ArgumentNullException.ThrowIfNull(fallback);
        ArgumentNullException.ThrowIfNull(onMessage);

        _primary             = primary;
        _fallback            = fallback;
        _onMessage           = onMessage;
        _onSwitch            = onSwitch;
        _silenceTimeoutMs    = silenceTimeoutMs;
        _recoveryDebounceMs  = recoveryDebounceMs;
        _now                 = now ?? (() => (double)Environment.TickCount64);
    }

    public void Start()
    {
        if (_started) return;
        _started = true;
        _lastPrimaryHeartbeatAt = _now();
        _primary.Start(OnPrimaryMessage, e => OnTransportError("primary", e));
        _fallback.Start(OnFallbackMessage, e => OnTransportError("fallback", e));
    }

    public void Stop()
    {
        if (!_started) return;
        _started = false;
        try { _primary.Stop(); }  catch { /* swallow stop errors */ }
        try { _fallback.Stop(); } catch { /* swallow stop errors */ }
    }

    /// <summary>Avança o relógio interno; aplica regras de switch baseadas em silêncio do primary.</summary>
    public void Tick()
    {
        if (!_started) return;
        var now = _now();
        var sincePrimary = now - (_lastPrimaryHeartbeatAt ?? 0);

        if (_state == SelectorState.OnPrimary)
        {
            if (sincePrimary >= _silenceTimeoutMs)
                SwitchTo(SelectorState.OnFallback, reason: "silence", sincePrimary: sincePrimary);
            return;
        }

        if (_state == SelectorState.Recovering)
        {
            if (sincePrimary >= _silenceTimeoutMs)
            {
                _recoveryStartedAt = null;
                SwitchTo(SelectorState.OnFallback, reason: "recovery-aborted", sincePrimary: null);
                return;
            }
            var recoveryDuration = now - (_recoveryStartedAt ?? now);
            if (recoveryDuration >= _recoveryDebounceMs)
            {
                _recoveryStartedAt = null;
                SwitchTo(SelectorState.OnPrimary, reason: "recovered", sincePrimary: null);
            }
        }
    }

    public TransportSelectorStats GetStats()
    {
        double? ago = _lastPrimaryHeartbeatAt is null
            ? null
            : Math.Max(0, _now() - _lastPrimaryHeartbeatAt.Value);
        return new TransportSelectorStats(
            State:                       _state,
            PrimaryHealth:               _primaryHealth,
            LastPrimaryHeartbeatAgoMs:   ago,
            PacketsForwarded:            _packetsForwarded,
            PacketsDropped:              _packetsDropped,
            SwitchesToPrimary:           _switchesToPrimary,
            SwitchesToFallback:          _switchesToFallback);
    }

    // ── Handlers internos ──────────────────────────────────────────

    private void OnPrimaryMessage(TransportEnvelope env)
    {
        if (!_started) return;
        if (IsHeartbeat(env))
        {
            _lastPrimaryHeartbeatAt = _now();
            _primaryHealth = TransportHealth.Healthy;
            if (_state == SelectorState.OnFallback)
            {
                _state = SelectorState.Recovering;
                _recoveryStartedAt = _now();
                _onSwitch?.Invoke(new SwitchEvent(Stage: "recovery-started"));
            }
            return; // heartbeat não é forwarded
        }
        if (_state == SelectorState.OnPrimary || _state == SelectorState.Recovering)
        {
            _packetsForwarded++;
            _onMessage(env);
        }
        else
        {
            _packetsDropped++;
        }
    }

    private void OnFallbackMessage(TransportEnvelope env)
    {
        if (!_started) return;
        if (IsHeartbeat(env)) return; // heartbeat do fallback é só sinal de vida
        if (_state == SelectorState.OnFallback)
        {
            _packetsForwarded++;
            _onMessage(env);
        }
        else
        {
            _packetsDropped++;
        }
    }

    private void OnTransportError(string which, Exception err)
    {
        _onSwitch?.Invoke(new SwitchEvent(
            Stage: "transport-error",
            Which: which,
            Err:   err.Message));
    }

    private static bool IsHeartbeat(TransportEnvelope env) => env.Source == "heartbeat";

    private void SwitchTo(SelectorState newState, string reason, double? sincePrimary)
    {
        var prev = _state;
        if (prev == newState) return;
        _state = newState;
        if (newState == SelectorState.OnPrimary)  _switchesToPrimary++;
        if (newState == SelectorState.OnFallback) _switchesToFallback++;
        _onSwitch?.Invoke(new SwitchEvent(
            Stage:        "state-change",
            From:         prev,
            To:           newState,
            Reason:       reason,
            SincePrimary: sincePrimary));
    }
}

/// <summary>Transporte de mock pra teste/dev (sem IO real).</summary>
public sealed class MockTransport : ITransport
{
    public string Name { get; }

    private Action<TransportEnvelope>? _onMessage;
    private Action<Exception>? _onError;
    private bool _started;

    public MockTransport(string name)
    {
        Name = name;
    }

    public void Start(Action<TransportEnvelope> onMessage, Action<Exception> onError)
    {
        _onMessage = onMessage;
        _onError   = onError;
        _started   = true;
    }

    public void Stop() => _started = false;

    /// <summary>Helper de teste: simula pacote chegando do transporte.</summary>
    public void Inject(TransportEnvelope envelope)
    {
        if (!_started || _onMessage is null) return;
        _onMessage(envelope);
    }

    public void InjectError(Exception err) => _onError?.Invoke(err);
}
