// T4000PacketFeeder — agrupa pacotes em ciclos, ressincroniza por sentinelas.
//
// Equivalente JS: src/telemetry/t4000-packet-parser.js (createT4000PacketFeeder)
//
// Recebe pacotes 1-a-1 na ordem em que chegam do barramento, monta ciclos
// de 5 e dispara onCycle(result). Quando detecta pacote fora de ordem
// (ex.: pacote 4 sem ter visto 1/2/3 antes), reseta e dispara onError com
// motivo da resync. Hipótese (a)+(b) da spec.

namespace P1Fast.Cockpit.Domain;

public sealed class T4000PacketFeeder
{
    private readonly Action<T4000CycleResult>? _onCycle;
    private readonly Action<T4000FeederError>? _onError;

    private readonly IReadOnlyList<byte>?[] _buf = new IReadOnlyList<byte>?[5];
    private int _nextSlot;

    public T4000PacketFeeder(
        Action<T4000CycleResult>? onCycle = null,
        Action<T4000FeederError>? onError = null)
    {
        _onCycle = onCycle;
        _onError = onError;
    }

    /// <summary>Recebe um pacote bruto de 8 bytes. Encaixa, ressincroniza ou emite ciclo.</summary>
    public void Feed(IReadOnlyList<byte> bytes)
    {
        if (bytes is null || bytes.Count != T4000PacketParser.BytesPerPacket)
            throw new ArgumentException(
                $"T4000 feed: esperado {T4000PacketParser.BytesPerPacket} bytes, recebeu {bytes?.Count.ToString() ?? "null"}",
                nameof(bytes));

        var detected = T4000PacketParser.IdentifyPacketType(bytes); // 4, 5, ou null

        if (detected == 4)
        {
            if (_nextSlot != 3)
            {
                Reset($"pacote 4 chegou em slot {_nextSlot}, ressincronizando");
                return;
            }
            _buf[3] = bytes;
            _nextSlot = 4;
            return;
        }

        if (detected == 5)
        {
            if (_nextSlot != 4)
            {
                Reset($"pacote 5 chegou em slot {_nextSlot}, ressincronizando");
                return;
            }
            _buf[4] = bytes;
            _nextSlot = 5;
            EmitIfReady();
            return;
        }

        // detected == null → pacote 1, 2 ou 3 por exclusão; encaixa por ordem temporal
        if (_nextSlot >= 3)
        {
            Reset($"pacote ambíguo chegou em slot {_nextSlot} (esperando p4 ou p5)");
            return;
        }
        _buf[_nextSlot] = bytes;
        _nextSlot++;
    }

    /// <summary>Reset manual (resync explícita).</summary>
    public void Reset() => Reset(null);

    private void Reset(string? reason)
    {
        for (var i = 0; i < _buf.Length; i++) _buf[i] = null;
        _nextSlot = 0;
        if (reason is not null && _onError is not null)
            _onError(new T4000FeederError(Stage: "resync", Reason: reason));
    }

    private void EmitIfReady()
    {
        if (_nextSlot != 5) return;

        try
        {
            var cycle = new T4000CycleBytes(
                P1: _buf[0]!, P2: _buf[1]!, P3: _buf[2]!, P4: _buf[3]!, P5: _buf[4]!
            );
            var result = T4000PacketParser.ParseCycle(cycle);
            _onCycle?.Invoke(result);
        }
        catch (Exception e)
        {
            _onError?.Invoke(new T4000FeederError(Stage: "parse", Reason: e.Message));
        }

        Reset(null);
    }
}
