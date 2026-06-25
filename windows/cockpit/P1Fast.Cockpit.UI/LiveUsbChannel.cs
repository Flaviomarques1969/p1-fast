// LiveUsbChannel — a TOMADA física da USB pro cockpit AO VIVO (--live).
//
// Implementação real do IT3000UsbChannel (Domain): só abre/escreve/lê/fecha a
// porta serial (a Injepro T4000 aparece como USB CDC-ACM no Windows). NENHUMA
// lógica de protocolo aqui — handshake, montagem do bloco RI, 10 Hz e religação
// vivem no T3000UsbLiveReader (Domain), provado fora do carro com o canal-fake.
//
// É a MESMA tomada do console de captura (P1Fast.Cockpit.T4000Capture/
// SerialPortT3000UsbChannel.cs), trazida pro projeto da UI pra o .exe ler o motor
// direto, sem depender do console. A prova final é na bancada: notebook + carro.

using System.IO.Ports;
using P1Fast.Cockpit.Domain;

namespace P1Fast.Cockpit.UI;

/// <summary>Tomada serial real pro leitor ao vivo. Read() bloqueante com timeout
/// curto: devolve 0 quando "secou" (igual ao canal-fake), o reader junta os pedaços.</summary>
public sealed class LiveUsbChannel : IT3000UsbChannel
{
    private readonly string _portName;
    private readonly int _readTimeoutMs;
    private SerialPort? _sp;

    /// <param name="portName">Ex.: "COM5". Resolvida antes de instanciar.</param>
    /// <param name="readTimeoutMs">Janela de um Read bloqueante. Curto pra o reader
    /// juntar vários pedaços dentro da janela de montagem do bloco (~200 ms).</param>
    public LiveUsbChannel(string portName, int readTimeoutMs = 150)
    {
        _portName = portName ?? throw new ArgumentNullException(nameof(portName));
        _readTimeoutMs = readTimeoutMs;
    }

    public Task OpenAsync(CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        // Fecha um anterior (caso de religação) antes de reabrir.
        try { _sp?.Dispose(); } catch { /* já caiu */ }

        var sp = new SerialPort(_portName)
        {
            // CDC-ACM ignora baud, mas o framework exige um valor; mantém o do capturador.
            BaudRate     = 1_000_000,
            DataBits     = 8,
            Parity       = Parity.None,
            StopBits     = StopBits.One,
            Handshake    = Handshake.None,
            ReadTimeout  = _readTimeoutMs,
            WriteTimeout = 1000,
            // Muitos conversores CDC só começam a transmitir com DTR/RTS ligados.
            DtrEnable    = true,
            RtsEnable    = true,
        };
        sp.Open();
        try { sp.DiscardInBuffer(); sp.DiscardOutBuffer(); } catch { /* best-effort */ }
        _sp = sp;
        return Task.CompletedTask;
    }

    public Task WriteAsync(byte[] data, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var sp = _sp ?? throw new InvalidOperationException("porta não aberta");
        sp.Write(data, 0, data.Length);
        return Task.CompletedTask;
    }

    public Task<int> ReadAsync(byte[] buffer, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var sp = _sp ?? throw new InvalidOperationException("porta não aberta");
        try
        {
            // Bloqueia até chegar ao menos 1 byte ou estourar ReadTimeout.
            int n = sp.Read(buffer, 0, buffer.Length);
            return Task.FromResult(n);
        }
        catch (TimeoutException)
        {
            // "Secou" agora — 0 é o sinal que o reader espera pra parar de juntar.
            return Task.FromResult(0);
        }
    }

    public Task CloseAsync()
    {
        try { _sp?.Close(); } catch { /* swallow on shutdown */ }
        try { _sp?.Dispose(); } catch { }
        _sp = null;
        return Task.CompletedTask;
    }
}
