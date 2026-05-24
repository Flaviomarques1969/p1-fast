// T4000ConnectionDiagnostic — detecta por que a leitura da T4000 não está
// funcionando e propõe correção em linguagem humana.
//
// Plano: complemento ao MS-9.3 — robustez de campo. Construído pra que o
// Flávio (não-desenvolvedor) consiga diagnosticar problema sem precisar
// de mim em modo "olha pro console e me diz".
//
// Princípio: a saúde da conexão T4000 evolui por estados claros. Cada
// estado tem um diagnóstico em PT-BR + sugestão de ação humana + decisão
// de auto-recuperação.
//
// O detector roda em cima de qualquer ISerialBytePort + T4000Provider já
// existentes. Não faz IO direto — quem mexe em porta serial real é o
// AutoRecoveringSerialReader (camada externa).
//
// Estados, em ordem do "mais ruim" pro "tudo certo":
//
//   NoPortsDetected     — nenhuma porta serial no notebook. Cabo USB
//                         desplugado, ou driver da T4000 não instalado.
//   PortBusy            — porta achada, mas outro programa está usando
//                         (Injepro T Software aberto?).
//   PortOpenNoData      — porta abriu mas zero bytes em N segundos. T4000
//                         alimentada? Cabo bom? Modo CAN ativo?
//   ProtocolMismatch    — bytes chegando, mas nenhuma sentinela do T4000
//                         (P4 cauda 0x1E 0xFC ou P5 cabeça 0xFB 0xFA).
//                         Pode ser outro protocolo (USB de programação?
//                         outro baud rate?).
//   ChecksumFlapping    — sentinelas reconhecidas mas checksum falha em
//                         > 50% dos ciclos. Interferência, baud rate
//                         errado, ou frame corrompido.
//   ConnectionFlapping  — funcionou e depois caiu (silêncio > 5s após
//                         período com dados). Driver/cabo instável.
//   Healthy             — ciclos OK chegando regularmente. Tudo certo.
//
// Cada transição é exposta via onStateChanged pra UI/log mostrar.

namespace P1Fast.Cockpit.Domain;

public enum T4000ConnectionState
{
    Unknown,
    NoPortsDetected,
    PortBusy,
    PortOpenNoData,
    ProtocolMismatch,
    ChecksumFlapping,
    ConnectionFlapping,
    Healthy,
}

/// <summary>Diagnóstico humano de cada estado: mensagem + sugestão de ação + se vale auto-recuperar.</summary>
public sealed record T4000Diagnostic(
    T4000ConnectionState State,
    string MensagemHumana,
    string SugestaoAcao,
    bool AutoRecoveryRecomendada);

/// <summary>Sample do telemetria de saúde — alimenta o diagnóstico.</summary>
public sealed record T4000HealthSample(
    int PortsDetected,
    bool PortOpenAttempted,
    bool PortOpenSucceeded,
    bool PortBusyError,
    long BytesReceivedTotal,
    long MsSinceLastByte,
    long SentinelsP4Total,
    long SentinelsP5Total,
    long CyclesOkTotal,
    long CyclesBadTotal,
    long MsSinceLastCycleOk);

public sealed class T4000ConnectionDiagnostic
{
    public const int PortOpenNoDataThresholdMs   = 3_000;   // 3s sem 1 byte sequer
    public const int ProtocolMismatchMinBytes    = 200;     // já recebeu >=200 bytes e zero sentinelas
    public const double ChecksumBadRatioWarn     = 0.5;     // > 50% ruins = flapping
    public const int ChecksumMinSamplesForRatio  = 10;      // só avalia ratio depois de 10 ciclos
    public const int ConnectionLostMsSinceLastOk = 5_000;   // 5s sem ciclo OK após ter funcionado

    public T4000ConnectionState CurrentState { get; private set; } = T4000ConnectionState.Unknown;
    public T4000Diagnostic? LastDiagnostic { get; private set; }

    private readonly Action<T4000Diagnostic>? _onStateChanged;
    private bool _everHealthy;

    public T4000ConnectionDiagnostic(Action<T4000Diagnostic>? onStateChanged = null)
    {
        _onStateChanged = onStateChanged;
    }

    /// <summary>Avalia o estado atual com base no telemetria de saúde.</summary>
    public T4000Diagnostic Evaluate(T4000HealthSample h)
    {
        ArgumentNullException.ThrowIfNull(h);

        var state = ClassifyState(h);

        // Marca "já funcionou alguma vez" pra distinguir "nunca conectou" de "caiu depois"
        if (state == T4000ConnectionState.Healthy) _everHealthy = true;

        var diag = MakeDiagnostic(state);
        if (state != CurrentState)
        {
            CurrentState   = state;
            LastDiagnostic = diag;
            _onStateChanged?.Invoke(diag);
        }
        else
        {
            LastDiagnostic = diag;
        }
        return diag;
    }

    private T4000ConnectionState ClassifyState(T4000HealthSample h)
    {
        // 1. Nenhuma porta detectada
        if (h.PortsDetected == 0) return T4000ConnectionState.NoPortsDetected;

        // 2. Tentou abrir e bateu erro de porta ocupada
        if (h.PortOpenAttempted && !h.PortOpenSucceeded && h.PortBusyError)
            return T4000ConnectionState.PortBusy;

        // 3. Abriu mas zero bytes há muito tempo
        if (h.PortOpenSucceeded && h.BytesReceivedTotal == 0 && h.MsSinceLastByte >= PortOpenNoDataThresholdMs)
            return T4000ConnectionState.PortOpenNoData;

        // 4. Recebeu bytes razoáveis mas zero sentinelas FIXED — outro protocolo
        if (h.BytesReceivedTotal >= ProtocolMismatchMinBytes
            && (h.SentinelsP4Total + h.SentinelsP5Total) == 0)
            return T4000ConnectionState.ProtocolMismatch;

        // 5. Já viu ciclos suficientes mas razão de erro alta
        var cyclesTotal = h.CyclesOkTotal + h.CyclesBadTotal;
        if (cyclesTotal >= ChecksumMinSamplesForRatio)
        {
            var badRatio = (double)h.CyclesBadTotal / cyclesTotal;
            if (badRatio > ChecksumBadRatioWarn)
                return T4000ConnectionState.ChecksumFlapping;
        }

        // 6. Funcionou e parou
        if (_everHealthy && h.MsSinceLastCycleOk >= ConnectionLostMsSinceLastOk)
            return T4000ConnectionState.ConnectionFlapping;

        // 7. Tem ciclo OK recente
        if (h.CyclesOkTotal > 0 && h.MsSinceLastCycleOk < ConnectionLostMsSinceLastOk)
            return T4000ConnectionState.Healthy;

        // Caso default: ainda esperando o primeiro ciclo OK
        return CurrentState == T4000ConnectionState.Unknown
            ? T4000ConnectionState.Unknown
            : CurrentState;
    }

    private static T4000Diagnostic MakeDiagnostic(T4000ConnectionState state) => state switch
    {
        T4000ConnectionState.NoPortsDetected => new T4000Diagnostic(
            State: state,
            MensagemHumana: "Nenhuma porta USB detectada no notebook.",
            SugestaoAcao:   "Plugue o cabo da T4000 no notebook e confira se a chave do carro está em ON (não só Acessórios). Se já estiver plugado, talvez o driver da T4000 não esteja instalado.",
            AutoRecoveryRecomendada: true),

        T4000ConnectionState.PortBusy => new T4000Diagnostic(
            State: state,
            MensagemHumana: "A porta USB existe, mas outro programa está usando ela.",
            SugestaoAcao:   "Feche o Injepro T Software (ou qualquer outro programa que esteja lendo a T4000) e tente de novo. Você só pode ter um programa lendo a central por vez.",
            AutoRecoveryRecomendada: true),

        T4000ConnectionState.PortOpenNoData => new T4000Diagnostic(
            State: state,
            MensagemHumana: "Conectei na porta USB mas a T4000 não está cospindo dados.",
            SugestaoAcao:   "Confira: (1) a central T4000 está alimentada? (2) a chave do carro está em ON? (3) o cabo USB está firme nos dois lados? (4) o conector da T4000 não está sujo? Vou tentar reabrir a porta automaticamente.",
            AutoRecoveryRecomendada: true),

        T4000ConnectionState.ProtocolMismatch => new T4000Diagnostic(
            State: state,
            MensagemHumana: "Recebi dados, mas eles não parecem ser do padrão da T4000 que conheço.",
            SugestaoAcao:   "Pode ser que: (1) a USB da T4000 esteja num modo diferente (programação, não leitura), ou (2) você precise de um adaptador USB-CAN. Vou tentar velocidades alternativas automaticamente. Se nada funcionar, me mande os bytes brutos e eu analiso o que está vindo.",
            AutoRecoveryRecomendada: true),

        T4000ConnectionState.ChecksumFlapping => new T4000Diagnostic(
            State: state,
            MensagemHumana: "Os dados estão chegando, mas mais da metade está chegando corrompida.",
            SugestaoAcao:   "Pode ser cabo USB ruim, conector frouxo, ou interferência elétrica no carro. Vou continuar ressincronizando — se melhorar, vou avisar; se piorar, troque o cabo USB.",
            AutoRecoveryRecomendada: true),

        T4000ConnectionState.ConnectionFlapping => new T4000Diagnostic(
            State: state,
            MensagemHumana: "A T4000 funcionava, mas parou de mandar dados.",
            SugestaoAcao:   "Pode ter sido reset do driver, cabo que afrouxou ou central que reiniciou. Vou tentar reabrir a porta. Se acontecer mais de 3 vezes em 5 minutos, troque o cabo USB ou reinicie o notebook.",
            AutoRecoveryRecomendada: true),

        T4000ConnectionState.Healthy => new T4000Diagnostic(
            State: state,
            MensagemHumana: "Tudo certo. T4000 conectada e mandando dados.",
            SugestaoAcao:   "Nada a fazer.",
            AutoRecoveryRecomendada: false),

        T4000ConnectionState.Unknown => new T4000Diagnostic(
            State: state,
            MensagemHumana: "Ainda estou conferindo a conexão com a T4000.",
            SugestaoAcao:   "Aguarde uns segundos.",
            AutoRecoveryRecomendada: false),

        _ => throw new ArgumentOutOfRangeException(nameof(state)),
    };
}
