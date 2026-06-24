// RaceBoxBleReader.cs — leitura REAL do GPS RaceBox por Bluetooth dentro do .exe.
//
// ADR-024 amendment 6: o GPS deixa de vir da página web e passa a ser nativo do
// notebook. Esta é a "casca BLE" que o RaceBoxParser (domínio, puro+testado)
// menciona: acha o RaceBox por nome, conecta no Nordic UART Service, assina as
// notificações e empurra os bytes crus pro parser. O parser faz o enquadramento
// (buffer rolante) e devolve amostras de GPS já decodificadas.
//
// Porte fiel do connect/assinar/religar de web/teste-aparelhos/index.html
// (connectRaceBox / assinarRaceBox / religarRaceBox) + auto-recuperação no mesmo
// espírito do T4000LiveReader: se o RaceBox cair, volta a procurar sozinho.
//
// Tudo event-driven do BLE (callbacks vêm do threadpool) — não toca a thread de
// UI. O chamador (MainWindow) decide a troca de tela e o envio pra nuvem.

using System.Collections.Generic;
using P1Fast.Cockpit.Domain;
using Windows.Devices.Bluetooth;
using Windows.Devices.Bluetooth.Advertisement;
using Windows.Devices.Bluetooth.GenericAttributeProfile;
using Windows.Storage.Streams;

namespace P1Fast.Cockpit.UI;

public sealed class RaceBoxBleReader
{
    private readonly Action<RaceBoxGpsSample> _onSample;
    private readonly Action<string>? _onLog;

    private BluetoothLEAdvertisementWatcher? _watcher;
    private BluetoothLEDevice? _device;
    private GattCharacteristic? _rx;

    private readonly List<byte> _buffer = new();
    private readonly object _bufLock = new();
    private volatile bool _running;
    private volatile bool _conectando;

    // Guarda contra buffer travado por um frame corrompido que nunca completa
    // (header B5 62 com comprimento absurdo). RaceBox manda ~80 B por pacote.
    private const int MaxBuffer = 4096;

    /// <summary>Estado da conexão BLE — pra diagnóstico/saúde.</summary>
    public string Estado { get; private set; } = "ocioso";

    public RaceBoxBleReader(Action<RaceBoxGpsSample> onSample, Action<string>? onLog = null)
    {
        _onSample = onSample;
        _onLog = onLog;
    }

    public void Start()
    {
        if (_running) return;
        _running = true;
        IniciarBusca();
    }

    public void Stop()
    {
        _running = false;
        try { _watcher?.Stop(); } catch { }
        Desconectar();
        Estado = "parado";
    }

    // ── Busca (advertising scan) ───────────────────────────────

    private void IniciarBusca()
    {
        if (!_running) return;
        try
        {
            var w = new BluetoothLEAdvertisementWatcher { ScanningMode = BluetoothLEScanningMode.Active };
            w.Received += OnAdvert;
            _watcher = w;
            Estado = "procurando RaceBox";
            _onLog?.Invoke("procurando RaceBox por Bluetooth…");
            w.Start();
        }
        catch (Exception e)
        {
            _onLog?.Invoke("erro ao iniciar busca BLE: " + e.Message);
        }
    }

    private async void OnAdvert(BluetoothLEAdvertisementWatcher sender, BluetoothLEAdvertisementReceivedEventArgs args)
    {
        if (!_running || _conectando || _device is not null) return;

        var nome = args.Advertisement.LocalName;
        if (string.IsNullOrEmpty(nome) ||
            !nome.StartsWith(RaceBoxParser.NamePrefix, StringComparison.OrdinalIgnoreCase))
            return;

        _conectando = true;
        try { sender.Stop(); } catch { }

        try
        {
            await ConectarAsync(args.BluetoothAddress, nome);
        }
        catch (Exception e)
        {
            _onLog?.Invoke("falha ao conectar no RaceBox: " + e.Message);
            Desconectar();
            if (_running) IniciarBusca();   // tenta de novo (religação automática)
        }
    }

    // ── Conexão GATT + assinatura ──────────────────────────────

    private async System.Threading.Tasks.Task ConectarAsync(ulong address, string nome)
    {
        var dev = await BluetoothLEDevice.FromBluetoothAddressAsync(address);
        if (dev is null) throw new Exception("dispositivo BLE nulo");
        _device = dev;
        dev.ConnectionStatusChanged += OnConnStatus;

        var svcRes = await dev.GetGattServicesForUuidAsync(new Guid(RaceBoxParser.NusService));
        if (svcRes.Status != GattCommunicationStatus.Success || svcRes.Services.Count == 0)
            throw new Exception("serviço Nordic UART não encontrado");
        var svc = svcRes.Services[0];

        var chRes = await svc.GetCharacteristicsForUuidAsync(new Guid(RaceBoxParser.NusRxCharacteristic));
        if (chRes.Status != GattCommunicationStatus.Success || chRes.Characteristics.Count == 0)
            throw new Exception("característica de notificação não encontrada");
        var ch = chRes.Characteristics[0];

        var cfg = await ch.WriteClientCharacteristicConfigurationDescriptorAsync(
            GattClientCharacteristicConfigurationDescriptorValue.Notify);
        if (cfg != GattCommunicationStatus.Success)
            throw new Exception("não foi possível habilitar notificações");

        ch.ValueChanged += OnNotify;
        _rx = ch;
        lock (_bufLock) _buffer.Clear();

        _conectando = false;
        Estado = "ligado: " + nome;
        _onLog?.Invoke("RaceBox conectado: " + nome);
    }

    // ── Notificação: bytes crus → parser → amostras ────────────

    private void OnNotify(GattCharacteristic sender, GattValueChangedEventArgs args)
    {
        byte[] bytes;
        using (var reader = DataReader.FromBuffer(args.CharacteristicValue))
        {
            bytes = new byte[args.CharacteristicValue.Length];
            reader.ReadBytes(bytes);
        }

        List<RaceBoxGpsSample> amostras;
        lock (_bufLock)
        {
            _buffer.AddRange(bytes);
            var arr = _buffer.ToArray();
            var (saida, consumido) = RaceBoxParser.Parse(arr);
            if (consumido > 0) _buffer.RemoveRange(0, consumido);
            if (_buffer.Count > MaxBuffer) _buffer.Clear();   // resync defensivo
            amostras = saida;
        }

        foreach (var s in amostras)
        {
            try { _onSample(s); } catch { }
        }
    }

    // ── Queda → religa sozinho ─────────────────────────────────

    private void OnConnStatus(BluetoothLEDevice sender, object args)
    {
        if (sender.ConnectionStatus != BluetoothConnectionStatus.Disconnected) return;
        if (!_running) return;
        _onLog?.Invoke("RaceBox caiu — religando automaticamente…");
        Desconectar();
        IniciarBusca();
    }

    private void Desconectar()
    {
        try { if (_rx is not null) _rx.ValueChanged -= OnNotify; } catch { }
        _rx = null;
        try
        {
            if (_device is not null)
            {
                _device.ConnectionStatusChanged -= OnConnStatus;
                _device.Dispose();
            }
        }
        catch { }
        _device = null;
        _conectando = false;
    }
}
