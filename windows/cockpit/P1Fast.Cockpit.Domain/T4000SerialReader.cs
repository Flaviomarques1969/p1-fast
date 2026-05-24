// T4000SerialReader — pega bytes brutos vindo de uma porta (USB CDC-ACM,
// arquivo de captura, ou simulador em memória) e alimenta o T4000Provider
// pacote a pacote (8 bytes por vez).
//
// Plano: PLANO_FASE_1.md §6 MS-9.3.
//
// Princípio:
// - ISerialBytePort é a interface mínima — quem entrega bytes implementa.
//   - InMemorySerialBytePort (simulador, testes).
//   - Real implementation (System.IO.Ports.SerialPort) mora no projeto
//     T4000Capture/Live e injeta neste reader.
// - O reader bufferiza bytes até completar 8, então chama
//   T4000Provider.FeedPacket(). O T4000PacketFeeder interno do provider
//   já trata reordenação e ressincronização — aqui só fatiamos.
// - Loop assíncrono usa CancellationToken pra parar limpo.
//
// O reader é puro .NET 8 (sem dependência de Windows) e roda em qualquer
// SO pra testes — a porta serial real é abstraída via ISerialBytePort.

namespace P1Fast.Cockpit.Domain;

/// <summary>Interface mínima de uma fonte de bytes em stream contínuo.</summary>
public interface ISerialBytePort
{
    /// <summary>Lê até <paramref name="buffer"/>.Length bytes; retorna quantos foram lidos. 0 = sem dado disponível agora.</summary>
    Task<int> ReadAsync(byte[] buffer, CancellationToken cancellationToken);
}

/// <summary>Stats observáveis do leitor.</summary>
public sealed record T4000SerialReaderStats(
    long BytesRead,
    long PacketsFed,
    long ReadErrors,
    int PendingBufferBytes);

public sealed class T4000SerialReader
{
    private readonly ISerialBytePort _port;
    private readonly T4000Provider _provider;
    private readonly Action<Exception>? _onReadError;
    private readonly int _readChunkBytes;

    private readonly List<byte> _pending = new();
    private long _bytesRead;
    private long _packetsFed;
    private long _readErrors;

    public T4000SerialReader(
        ISerialBytePort port,
        T4000Provider provider,
        Action<Exception>? onReadError = null,
        int readChunkBytes = 256)
    {
        ArgumentNullException.ThrowIfNull(port);
        ArgumentNullException.ThrowIfNull(provider);
        if (readChunkBytes < T4000PacketParser.BytesPerPacket)
            throw new ArgumentOutOfRangeException(nameof(readChunkBytes),
                $"readChunkBytes={readChunkBytes} precisa ser >= {T4000PacketParser.BytesPerPacket}");

        _port            = port;
        _provider        = provider;
        _onReadError     = onReadError;
        _readChunkBytes  = readChunkBytes;
    }

    public T4000SerialReaderStats GetStats() => new(
        BytesRead:          _bytesRead,
        PacketsFed:         _packetsFed,
        ReadErrors:         _readErrors,
        PendingBufferBytes: _pending.Count);

    /// <summary>Loop principal: lê da porta, fatia em pacotes de 8 bytes, alimenta o provider.
    /// Termina quando o token for cancelado ou a porta retornar -1 (EOF).</summary>
    public async Task RunAsync(CancellationToken cancellationToken)
    {
        var chunk = new byte[_readChunkBytes];

        while (!cancellationToken.IsCancellationRequested)
        {
            int n;
            try
            {
                n = await _port.ReadAsync(chunk, cancellationToken).ConfigureAwait(false);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _readErrors++;
                _onReadError?.Invoke(ex);
                // pausa curta pra não saturar o loop em erro permanente
                try { await Task.Delay(50, cancellationToken).ConfigureAwait(false); }
                catch (OperationCanceledException) { break; }
                continue;
            }

            if (n < 0) break; // EOF — porta fechada upstream
            if (n == 0)
            {
                // sem dado agora; cede CPU
                try { await Task.Delay(5, cancellationToken).ConfigureAwait(false); }
                catch (OperationCanceledException) { break; }
                continue;
            }

            _bytesRead += n;
            for (var i = 0; i < n; i++) _pending.Add(chunk[i]);
            DrainPending();
        }
    }

    /// <summary>Versão síncrona pra testes: alimenta um bloco de bytes e fatia imediatamente.</summary>
    public void IngestBytes(IReadOnlyList<byte> bytes)
    {
        ArgumentNullException.ThrowIfNull(bytes);
        _bytesRead += bytes.Count;
        for (var i = 0; i < bytes.Count; i++) _pending.Add(bytes[i]);
        DrainPending();
    }

    private void DrainPending()
    {
        while (_pending.Count >= T4000PacketParser.BytesPerPacket)
        {
            var packet = new byte[T4000PacketParser.BytesPerPacket];
            for (var i = 0; i < T4000PacketParser.BytesPerPacket; i++) packet[i] = _pending[i];
            _pending.RemoveRange(0, T4000PacketParser.BytesPerPacket);
            _packetsFed++;
            _provider.FeedPacket(packet);
        }
    }
}

/// <summary>Implementação em memória — testes injetam bytes pelo método Push().</summary>
public sealed class InMemorySerialBytePort : ISerialBytePort
{
    private readonly Queue<byte> _queue = new();
    private readonly object _lock = new();
    private bool _closed;

    /// <summary>Adiciona bytes pra serem entregues no próximo ReadAsync().</summary>
    public void Push(IReadOnlyList<byte> bytes)
    {
        ArgumentNullException.ThrowIfNull(bytes);
        lock (_lock)
        {
            for (var i = 0; i < bytes.Count; i++) _queue.Enqueue(bytes[i]);
        }
    }

    /// <summary>Fecha a porta (próximo ReadAsync retorna -1 = EOF) — useful pra terminar RunAsync em testes.</summary>
    public void Close()
    {
        lock (_lock) _closed = true;
    }

    public Task<int> ReadAsync(byte[] buffer, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        lock (_lock)
        {
            if (_queue.Count == 0)
                return Task.FromResult(_closed ? -1 : 0);

            var n = Math.Min(buffer.Length, _queue.Count);
            for (var i = 0; i < n; i++) buffer[i] = _queue.Dequeue();
            return Task.FromResult(n);
        }
    }
}
