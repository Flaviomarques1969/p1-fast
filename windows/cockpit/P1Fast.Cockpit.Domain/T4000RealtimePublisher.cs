// T4000RealtimePublisher — agrega samples T4000 a 10 Hz e publica num canal
// Realtime (Supabase) pra o iPhone (storage de longo prazo) e o Box Cockpit
// (visualização) consumirem.
//
// Spec: PLANO_FASE_1.md §6 MS-9.5.
//
// Princípio:
// - Cycle real chega a ~20 Hz; publica a 10 Hz pra reduzir banda.
//   Estratégia: "throttle por janela" — emite o sample MAIS RECENTE
//   sempre que o tempo desde a última publicação ≥ MinIntervalMs (100 ms).
// - Payload normalizado (record imutável) entregue ao IRealtimeClient.
// - InMemoryRealtimeClient armazena tudo pra testes asseguirem o ritmo.
// - Cliente real (Supabase) implementa IRealtimeClient e injeta aqui.

namespace P1Fast.Cockpit.Domain;

/// <summary>Cliente abstrato — quem publica de verdade implementa esta interface.</summary>
public interface IRealtimeClient
{
    /// <summary>Publica payload no canal informado. Retorna task que completa quando o servidor confirmou (ou falhou).</summary>
    Task PublishAsync(string channel, T4000RealtimePayload payload, CancellationToken cancellationToken);
}

/// <summary>Payload enviado pro canal — espelha o JSON do MS-9.5.</summary>
public sealed record T4000RealtimePayload(
    double TMono,
    int Rpm,
    int Marcha,
    double MapBar,
    double Lambda,
    double OilTempC,
    double WaterTempC,
    double OilPressBar,
    double FuelPressBar,
    double FuelTempC,
    double AirTempC,
    int EgtC,
    bool EgtOutOfRange,
    double BatteryV,
    double TpsPct,
    double SpeedKmh,
    int EcuErrorBits,
    bool ChecksumOk);

public sealed record T4000RealtimePublisherStats(
    long SamplesReceived,
    long SamplesPublished,
    long SamplesSkipped,
    long PublishErrors,
    double? LastPublishTMono);

public sealed class T4000RealtimePublisher
{
    public const int PublishTargetHz = T4000Provider.PublishTargetHz;
    public const int DefaultMinIntervalMs = 1000 / PublishTargetHz; // 100ms

    private readonly IRealtimeClient _client;
    private readonly string _channel;
    private readonly int _minIntervalMs;
    private readonly Action<Exception>? _onPublishError;

    private double? _lastPublishedTMono;
    private long _samplesReceived;
    private long _samplesPublished;
    private long _samplesSkipped;
    private long _publishErrors;

    public T4000RealtimePublisher(
        IRealtimeClient client,
        string channel,
        int? minIntervalMs = null,
        Action<Exception>? onPublishError = null)
    {
        ArgumentNullException.ThrowIfNull(client);
        if (string.IsNullOrEmpty(channel))
            throw new ArgumentException("channel não pode ser vazio", nameof(channel));

        _client          = client;
        _channel         = channel;
        _minIntervalMs   = minIntervalMs ?? DefaultMinIntervalMs;
        _onPublishError  = onPublishError;
    }

    public T4000RealtimePublisherStats GetStats() => new(
        SamplesReceived:   _samplesReceived,
        SamplesPublished:  _samplesPublished,
        SamplesSkipped:    _samplesSkipped,
        PublishErrors:     _publishErrors,
        LastPublishTMono:  _lastPublishedTMono);

    /// <summary>Ponto de entrada — pluga em T4000Provider.onT4000Sample.
    /// Decide publicar (se passou minInterval) ou descartar (throttle).</summary>
    public void HandleSample(T4000ProviderSample sample)
    {
        HandleSampleAsync(sample, CancellationToken.None).GetAwaiter().GetResult();
    }

    /// <summary>Versão assíncrona — preferir quando o publisher rodar em loop dedicado.</summary>
    public async Task HandleSampleAsync(T4000ProviderSample sample, CancellationToken cancellationToken)
    {
        if (sample is null) return;
        _samplesReceived++;

        if (_lastPublishedTMono is { } last && (sample.TMono - last) < _minIntervalMs)
        {
            _samplesSkipped++;
            return;
        }

        var payload = ToPayload(sample);
        try
        {
            await _client.PublishAsync(_channel, payload, cancellationToken).ConfigureAwait(false);
            _lastPublishedTMono = sample.TMono;
            _samplesPublished++;
        }
        catch (Exception ex)
        {
            _publishErrors++;
            _onPublishError?.Invoke(ex);
        }
    }

    private static T4000RealtimePayload ToPayload(T4000ProviderSample s)
    {
        var t = s.Telemetry;
        return new T4000RealtimePayload(
            TMono:          s.TMono,
            Rpm:            t.Rpm,
            Marcha:         t.Marcha,
            MapBar:         t.MapBar,
            Lambda:         t.Lambda,
            OilTempC:       t.OilTempC,
            WaterTempC:     t.WaterTempC,
            OilPressBar:    t.OilPressBar,
            FuelPressBar:   t.FuelPressBar,
            FuelTempC:      t.FuelTempC,
            AirTempC:       t.AirTempC,
            EgtC:           t.EgtC,
            EgtOutOfRange:  t.EgtOutOfRange,
            BatteryV:       t.BatteryV,
            TpsPct:         t.TpsPct,
            SpeedKmh:       t.SpeedKmh,
            EcuErrorBits:   t.EcuErrorBits,
            ChecksumOk:     s.ChecksumOk);
    }
}

/// <summary>Cliente em memória — armazena tudo pra testes verificarem ritmo, conteúdo e canal.</summary>
public sealed class InMemoryRealtimeClient : IRealtimeClient
{
    private readonly List<(string Channel, T4000RealtimePayload Payload)> _published = new();
    private readonly object _lock = new();

    public IReadOnlyList<(string Channel, T4000RealtimePayload Payload)> Published
    {
        get { lock (_lock) return _published.ToArray(); }
    }

    public Task PublishAsync(string channel, T4000RealtimePayload payload, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        lock (_lock) _published.Add((channel, payload));
        return Task.CompletedTask;
    }
}
