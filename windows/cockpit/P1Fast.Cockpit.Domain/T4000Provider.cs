// T4000Provider — adapta T4000PacketParser num produtor de samples.
//
// Equivalente JS: src/telemetry/t4000-provider.js
// Spec: docs/hardware/T4000_CAN_SPEC.md
// Plano: PLANO_FASE_1.md §6 MS-9.4 (reescrito 2026-05-09 — ADR-023)
//
// Roda no notebook Windows. Recebe pacotes de 8 bytes do reader concreto
// (USB CDC-ACM, CAN-USB, ou mock) via FeedPacket(bytes) e emite samples
// normalizados via callback OnT4000Sample.
//
// Não herda de TelemetryProvider (provider.js) propositalmente: aquele
// contrato é pra GPS/IMU + sample-store/Dexie do hub legado. T4000 é ECU,
// fluxo separado. Quando o cockpit consumir os dois, a fusão acontece
// numa camada de cima (LiveDataBridge — MS-13.4).

namespace P1Fast.Cockpit.Domain;

/// <summary>Qualidade do sinal do barramento T4000 baseada em ciclos consecutivos.</summary>
public enum T4000Signal
{
    Good,
    Degraded,
    Bad,
    Lost,
}

/// <summary>Sample de saída do provider — telemetria fundida + timing + flag de checksum.</summary>
public sealed record T4000ProviderSample(T4000Sample Telemetry, double TMono, bool ChecksumOk);

/// <summary>Métricas de saúde do barramento expostas por GetStats.</summary>
public sealed record T4000ProviderStats(
    int CyclesOk,
    int CyclesBad,
    int ConsecutiveBadCycles,
    T4000Signal SignalQuality
);

public sealed class T4000Provider
{
    public const int CanId            = T4000PacketParser.CanId;
    public const int ExpectedCycleHz  = 20; // 5 pacotes × 10ms = 50ms = 20Hz
    public const int PublishTargetHz  = 10; // MS-9.5: agregação pra Realtime

    public string Source => "t4000-can";

    private readonly Func<double> _now;
    private readonly Action<T4000ProviderSample>? _onSample;
    private readonly T4000PacketFeeder _feeder;

    private int _cyclesOk;
    private int _cyclesBad;
    private int _consecutiveBadCycles;

    public T4000Provider(
        Action<T4000ProviderSample>? onT4000Sample = null,
        Func<double>? now = null)
    {
        _onSample = onT4000Sample;
        _now = now ?? (() => (double)Environment.TickCount64);

        _feeder = new T4000PacketFeeder(
            onCycle: OnCycle,
            onError: OnFeederError);
    }

    /// <summary>Recebe pacote bruto de 8 bytes do reader concreto.</summary>
    public void FeedPacket(IReadOnlyList<byte> bytes) => _feeder.Feed(bytes);

    /// <summary>Reset do feeder (resync manual).</summary>
    public void ResetFeeder() => _feeder.Reset();

    public T4000ProviderStats GetStats() => new(
        CyclesOk:             _cyclesOk,
        CyclesBad:            _cyclesBad,
        ConsecutiveBadCycles: _consecutiveBadCycles,
        SignalQuality:        ComputeSignalQuality()
    );

    private void OnCycle(T4000CycleResult cycle)
    {
        if (cycle.Ok)
        {
            _cyclesOk++;
            _consecutiveBadCycles = 0;
        }
        else
        {
            _cyclesBad++;
            _consecutiveBadCycles++;
        }

        _onSample?.Invoke(new T4000ProviderSample(
            Telemetry:  cycle.Sample,
            TMono:      _now(),
            ChecksumOk: cycle.Ok
        ));
    }

    private void OnFeederError(T4000FeederError err)
    {
        // Resync ou parse error: não é sample, mas conta como degradação.
        _consecutiveBadCycles++;
    }

    private T4000Signal ComputeSignalQuality()
    {
        if (_consecutiveBadCycles >= 5) return T4000Signal.Lost;
        if (_consecutiveBadCycles >= 2) return T4000Signal.Degraded;
        if (_cyclesOk == 0)             return T4000Signal.Bad;
        return T4000Signal.Good;
    }
}
