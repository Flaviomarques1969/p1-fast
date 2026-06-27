// FallbackT3000UsbChannel — tenta a tomada PREFERIDA (WinUSB) e, se ela falhar ao
// ABRIR, cai pra RESERVA (serial COM). Rede de seguranca de dia-de-pista: se por
// qualquer motivo o WinUSB nao iniciar (driver trocado, permissao, ou o aparelho
// subiu como CDC-ACM), o motor ainda entra pela serial em vez de ficar mudo.
//
// A escolha e' por ABERTURA, nao so' por presenca: cobre o caso "o device com o
// VID/PID existe (Present()==true) mas WinUsb_Initialize falha". A cada religacao
// (o reader fecha e reabre) tenta a PREFERIDA de novo primeiro — se o WinUSB
// voltar, volta a usa-lo; senao, segue na reserva. NENHUMA logica de protocolo
// aqui (vive no T3000UsbLiveReader, Domain); isto so' delega o transporte.

using P1Fast.Cockpit.Domain;

namespace P1Fast.Cockpit.UI;

public sealed class FallbackT3000UsbChannel : IT3000UsbChannel
{
    private readonly IT3000UsbChannel _preferida;
    private readonly Func<IT3000UsbChannel> _reservaFactory;
    private IT3000UsbChannel? _ativa;

    /// <param name="preferida">Tomada tentada primeiro (ex.: WinUSB).</param>
    /// <param name="reservaFactory">Cria a tomada de reserva (ex.: serial COM) so'
    /// quando a preferida falha — uma instancia nova por queda, pra reabrir limpo.</param>
    public FallbackT3000UsbChannel(IT3000UsbChannel preferida, Func<IT3000UsbChannel> reservaFactory)
    {
        _preferida = preferida ?? throw new ArgumentNullException(nameof(preferida));
        _reservaFactory = reservaFactory ?? throw new ArgumentNullException(nameof(reservaFactory));
    }

    public async Task OpenAsync(CancellationToken cancellationToken)
    {
        // 1) Tenta a preferida (WinUSB).
        try
        {
            await _preferida.OpenAsync(cancellationToken).ConfigureAwait(false);
            _ativa = _preferida;
            return;
        }
        catch (OperationCanceledException) { throw; }
        catch
        {
            // Falhou ao abrir: garante que a preferida fica fechada antes da reserva.
            try { await _preferida.CloseAsync().ConfigureAwait(false); } catch { /* ja' caiu */ }
        }

        // 2) Cai pra reserva (serial). Se ela tambem falhar, propaga — o reader
        //    religa (e na proxima rodada tenta a preferida de novo primeiro).
        var reserva = _reservaFactory();
        await reserva.OpenAsync(cancellationToken).ConfigureAwait(false);
        _ativa = reserva;
    }

    public Task WriteAsync(byte[] data, CancellationToken cancellationToken)
        => (_ativa ?? throw new InvalidOperationException("canal nao aberto")).WriteAsync(data, cancellationToken);

    public Task<int> ReadAsync(byte[] buffer, CancellationToken cancellationToken)
        => (_ativa ?? throw new InvalidOperationException("canal nao aberto")).ReadAsync(buffer, cancellationToken);

    public Task CloseAsync()
    {
        var ativa = _ativa;
        _ativa = null;
        return ativa?.CloseAsync() ?? Task.CompletedTask;
    }
}
