// T4000AutoRecoveringReader — orquestra a abertura da porta, leitura e
// recuperação automática quando algo dá errado.
//
// Princípio:
// - Usa ISerialPortDiscovery pra listar/abrir portas.
// - Tenta cada porta candidata; pra cada uma, tenta uma lista de velocidades
//   (1Mbit primeiro, depois 921600, 460800, 115200).
// - Mede saúde via T4000HealthAccumulator e roda T4000ConnectionDiagnostic
//   a cada tick.
// - Estratégia de recuperação por estado:
//     NoPortsDetected   → re-listar a cada 2s
//     PortBusy          → re-tentar a porta a cada 5s (talvez liberou)
//     PortOpenNoData    → reabrir após 3s sem byte
//     ProtocolMismatch  → mudar pra próxima velocidade da lista
//     ChecksumFlapping  → resync do feeder
//     ConnectionFlapping→ reabrir porta
//     Healthy           → ficar onde está, só monitorar
//
// Esta camada é assíncrona, com loop dedicado. O ISerialPortDiscovery é
// abstrato — quem implementa de verdade vive no projeto de aplicação
// (System.IO.Ports.SerialPort).

namespace P1Fast.Cockpit.Domain;

/// <summary>Erro categorizado ao tentar abrir/listar portas.</summary>
public enum SerialPortOpenFailure
{
    None,
    NoPortsDetected,
    PortBusy,
    PortNotFound,
    Other,
}

/// <summary>Resultado de TryOpen — porta aberta ou motivo da falha.</summary>
public sealed record SerialPortOpenResult(
    ISerialBytePort? Port,
    SerialPortOpenFailure Failure,
    string? ErrorMessage);

/// <summary>Quem sabe listar portas e abrir uma com baud rate específico.</summary>
public interface ISerialPortDiscovery
{
    /// <summary>Lista portas disponíveis no SO (ex.: ["COM3", "COM4"]). Vazio = nenhuma.</summary>
    IReadOnlyList<string> ListPortNames();

    /// <summary>Tenta abrir <paramref name="portName"/> com <paramref name="baudRate"/>.
    /// Failure indica por que não abriu — usado pelo diagnóstico pra distinguir "ocupada" de "não existe".</summary>
    SerialPortOpenResult TryOpen(string portName, int baudRate);
}

/// <summary>Acumulador de saúde — alimenta o diagnóstico a cada tick.</summary>
public sealed class T4000HealthAccumulator
{
    private readonly Func<long> _nowMs;

    public long BytesReceivedTotal { get; private set; }
    public long SentinelsP4Total { get; private set; }
    public long SentinelsP5Total { get; private set; }
    public long CyclesOkTotal { get; private set; }
    public long CyclesBadTotal { get; private set; }

    public int PortsDetected { get; set; }
    public bool PortOpenAttempted { get; set; }
    public bool PortOpenSucceeded { get; set; }
    public bool PortBusyError { get; set; }

    public long LastByteAtMs { get; private set; }
    public long LastCycleOkAtMs { get; private set; }
    public long StartedAtMs { get; }

    public T4000HealthAccumulator(Func<long>? nowMs = null)
    {
        _nowMs       = nowMs ?? (() => Environment.TickCount64);
        StartedAtMs  = _nowMs();
        LastByteAtMs = StartedAtMs;
        LastCycleOkAtMs = StartedAtMs;
    }

    public void RegisterBytes(int n)
    {
        if (n <= 0) return;
        BytesReceivedTotal += n;
        LastByteAtMs = _nowMs();
    }

    /// <summary>Conta sentinelas FIXED dentro de um chunk recém-lido.</summary>
    public void CountSentinelsIn(IReadOnlyList<byte> chunk)
    {
        if (chunk.Count < 2) return;
        for (var i = 1; i < chunk.Count; i++)
        {
            if (chunk[i - 1] == T4000PacketParser.P4FixedTail[0] && chunk[i] == T4000PacketParser.P4FixedTail[1])
                SentinelsP4Total++;
            if (chunk[i - 1] == T4000PacketParser.P5FixedHead[0] && chunk[i] == T4000PacketParser.P5FixedHead[1])
                SentinelsP5Total++;
        }
    }

    public void RegisterCycleResult(bool ok)
    {
        if (ok)
        {
            CyclesOkTotal++;
            LastCycleOkAtMs = _nowMs();
        }
        else
        {
            CyclesBadTotal++;
        }
    }

    public void Reset()
    {
        BytesReceivedTotal = 0;
        SentinelsP4Total = 0;
        SentinelsP5Total = 0;
        CyclesOkTotal = 0;
        CyclesBadTotal = 0;
        PortOpenAttempted = false;
        PortOpenSucceeded = false;
        PortBusyError = false;
        LastByteAtMs = _nowMs();
        LastCycleOkAtMs = _nowMs();
    }

    public T4000HealthSample Snapshot()
    {
        var now = _nowMs();
        return new T4000HealthSample(
            PortsDetected:       PortsDetected,
            PortOpenAttempted:   PortOpenAttempted,
            PortOpenSucceeded:   PortOpenSucceeded,
            PortBusyError:       PortBusyError,
            BytesReceivedTotal:  BytesReceivedTotal,
            MsSinceLastByte:     Math.Max(0, now - LastByteAtMs),
            SentinelsP4Total:    SentinelsP4Total,
            SentinelsP5Total:    SentinelsP5Total,
            CyclesOkTotal:       CyclesOkTotal,
            CyclesBadTotal:      CyclesBadTotal,
            MsSinceLastCycleOk:  Math.Max(0, now - LastCycleOkAtMs));
    }
}

/// <summary>Configuração da estratégia de auto-recuperação.</summary>
public sealed record T4000AutoRecoveryConfig(
    IReadOnlyList<int> BaudRatesToTry,
    int RescanPortsIntervalMs   = 2_000,
    int RetryBusyPortIntervalMs = 5_000,
    int ReopenSilenceMs         = 3_000,
    int EvaluateIntervalMs      = 500)
{
    public static T4000AutoRecoveryConfig Default { get; } = new(
        BaudRatesToTry: new[] { 1_000_000, 921_600, 460_800, 115_200 });
}

/// <summary>Decisão tomada pela orquestração — útil pra log e tests.</summary>
public sealed record T4000RecoveryAction(string Tipo, string Detalhe);

/// <summary>
/// Orquestrador puro (sem loop assíncrono — quem chama dirige o relógio).
/// Decide qual recuperação fazer com base no estado atual.
/// Loop assíncrono real fica na camada de aplicação (LiveDemo / Capture).
/// </summary>
public sealed class T4000RecoveryStrategy
{
    private readonly T4000AutoRecoveryConfig _config;

    private int _currentBaudIdx;
    private string? _currentPortName;
    private long _lastPortsScanAtMs;
    private long _lastBusyRetryAtMs;
    private bool _firstPortsScan = true;
    private bool _firstBusyRetry = true;

    public T4000RecoveryStrategy(T4000AutoRecoveryConfig? config = null)
    {
        _config = config ?? T4000AutoRecoveryConfig.Default;
    }

    public int CurrentBaudRate => _config.BaudRatesToTry[_currentBaudIdx];
    public string? CurrentPortName => _currentPortName;

    /// <summary>Marca a porta que está aberta agora — usado pra decidir "reabrir mesma" vs "varrer".</summary>
    public void OnPortOpened(string portName)
    {
        _currentPortName = portName;
    }

    public void OnPortClosed()
    {
        _currentPortName = null;
    }

    /// <summary>Decide a próxima ação com base no estado + tempo atual + lista de portas.</summary>
    public T4000RecoveryAction Decide(
        T4000ConnectionState state,
        IReadOnlyList<string> portsAvailable,
        long nowMs)
    {
        switch (state)
        {
            case T4000ConnectionState.NoPortsDetected:
                if (_firstPortsScan || nowMs - _lastPortsScanAtMs >= _config.RescanPortsIntervalMs)
                {
                    _firstPortsScan    = false;
                    _lastPortsScanAtMs = nowMs;
                    return new T4000RecoveryAction("rescan-ports",
                        "Re-listando portas USB disponíveis no notebook.");
                }
                return new T4000RecoveryAction("wait", "Aguardando intervalo do próximo escaneamento de portas.");

            case T4000ConnectionState.PortBusy:
                if (_firstBusyRetry || nowMs - _lastBusyRetryAtMs >= _config.RetryBusyPortIntervalMs)
                {
                    _firstBusyRetry    = false;
                    _lastBusyRetryAtMs = nowMs;
                    return new T4000RecoveryAction("retry-busy",
                        "Tentando reabrir porta que estava ocupada (talvez o outro programa fechou).");
                }
                return new T4000RecoveryAction("wait", "Aguardando intervalo antes de tentar porta ocupada de novo.");

            case T4000ConnectionState.PortOpenNoData:
                return new T4000RecoveryAction("reopen-same",
                    $"Reabrindo a porta {_currentPortName ?? "?"} no mesmo baud rate ({CurrentBaudRate}).");

            case T4000ConnectionState.ProtocolMismatch:
                // Avança pra próxima velocidade da lista — se acabou, volta ao começo.
                _currentBaudIdx = (_currentBaudIdx + 1) % _config.BaudRatesToTry.Count;
                return new T4000RecoveryAction("change-baud",
                    $"Trocando velocidade pra {CurrentBaudRate} (talvez a T4000 esteja noutra).");

            case T4000ConnectionState.ChecksumFlapping:
                return new T4000RecoveryAction("resync-feeder",
                    "Ressincronizando o decodificador — pode estar fora de fase.");

            case T4000ConnectionState.ConnectionFlapping:
                return new T4000RecoveryAction("reopen-after-drop",
                    "Reabrindo porta após queda de conexão. Se acontecer 3× em 5min, troque o cabo.");

            case T4000ConnectionState.Healthy:
                return new T4000RecoveryAction("none", "Tudo certo, não preciso fazer nada.");

            case T4000ConnectionState.Unknown:
                if (portsAvailable.Count > 0 && _currentPortName == null)
                    return new T4000RecoveryAction("try-first-port",
                        $"Tentando abrir a porta {portsAvailable[^1]} no baud rate {CurrentBaudRate}.");
                return new T4000RecoveryAction("wait", "Aguardando estado se estabilizar.");

            default:
                return new T4000RecoveryAction("wait", "Estado desconhecido, esperando.");
        }
    }
}
