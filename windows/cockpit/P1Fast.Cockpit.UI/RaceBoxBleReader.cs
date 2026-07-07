// RaceBoxBleReader — leitura AO VIVO do GPS pelo RaceBox Mini por BLUETOOTH no
// notebook (Windows.Devices.Bluetooth). É o GPS do cockpit ao vivo na pista.
//
// Port FIEL do leitor provado em campo (web/teste-aparelhos/index.html, validado
// 2026-06-09): mesma BLE (Nordic UART Service), mesmo framing UBX (0xB5 0x62 +
// checksum Fletcher), mesmos offsets de byte do pacote de dados (classe 0xFF /
// id 0x01). O navegador lê por Web Bluetooth; aqui o .exe lê direto por WinRT.
//
// Achados herdados do JS: fix em p[20], numSV em p[23], hacc uint32 @40 (/1000 m),
// velocidade int32 @48 (mm/s → km/h), lat int32 @28 (/1e7°), lon int32 @24 (/1e7°).
// UBX é little-endian (= BitConverter no x64 Windows).
//
// Religação automática: se o RaceBox cai, volta a varrer e reassina sozinho —
// igual ao religarRaceBox do web. NÃO toca na tela; só entrega AmostraGps.

using Windows.Devices.Bluetooth;
using Windows.Devices.Bluetooth.Advertisement;
using Windows.Devices.Bluetooth.GenericAttributeProfile;
using Windows.Storage.Streams;

namespace P1Fast.Cockpit.UI;

/// <summary>Um fix decodificado do RaceBox.</summary>
// HeadingDeg (L2): rumo do movimento do PACOTE (headMot, 0=norte, horário) — antes era
// descartado e o ângulo do ápice saía por 2 posições (mais ruidoso). Null quando não
// confiável (parado/quase parado: o RaceBox congela/inventa o rumo em baixa velocidade).
// GX/GY/GZ: aceleração do RaceBox em g (eixos CRUS do aparelho). Decodificados dos offsets
// 68/70/72 do pacote (protocolo RaceBox Mini, int16 mili-g) — Flávio 2026-07-07. PENDENTE de
// verificação de BANCADA (offsets + qual eixo é o longitudinal); por isso ainda não gatilham nada.
public readonly record struct RaceBoxFix(double Lat, double Lng, double Kmh, int Fix, int NumSV, double HaccM,
    double? HeadingDeg = null, double GX = 0, double GY = 0, double GZ = 0);

public sealed class RaceBoxBleReader
{
    // Nordic UART Service: o RaceBox Mini transmite os pacotes UBX por aqui.
    private static readonly Guid NusSvc = new("6e400001-b5a3-f393-e0a9-e50e24dcca9e");
    private static readonly Guid NusRx  = new("6e400003-b5a3-f393-e0a9-e50e24dcca9e");

    private readonly Action<RaceBoxFix> _onFix;
    private readonly Action<string>? _onStatus;
    private readonly object _bufLock = new();

    private BluetoothLEAdvertisementWatcher? _watcher;
    private BluetoothLEDevice? _device;
    private GattCharacteristic? _rx;
    private CancellationToken _ct;
    private byte[] _buf = Array.Empty<byte>();
    private bool _conectando;

    public RaceBoxBleReader(Action<RaceBoxFix> onFix, Action<string>? onStatus = null)
    {
        _onFix = onFix ?? throw new ArgumentNullException(nameof(onFix));
        _onStatus = onStatus;
    }

    /// <summary>Começa a varrer por um dispositivo "RaceBox*" e a assinar os pacotes.</summary>
    public void Start(CancellationToken ct)
    {
        _ct = ct;
        ct.Register(() =>
        {
            try { _watcher?.Stop(); } catch { }
            try { if (_rx is not null) _rx.ValueChanged -= OnNotify; } catch { }
            DescartarDevice();
        });
        IniciarVarredura();
    }

    private void IniciarVarredura()
    {
        if (_ct.IsCancellationRequested) return;
        if (_watcher is null)
        {
            _watcher = new BluetoothLEAdvertisementWatcher { ScanningMode = BluetoothLEScanningMode.Active };
            _watcher.Received += OnAdvReceived;
        }
        try { _watcher.Start(); _onStatus?.Invoke("GPS: procurando RaceBox por Bluetooth…"); } catch { }
    }

    private async void OnAdvReceived(BluetoothLEAdvertisementWatcher w, BluetoothLEAdvertisementReceivedEventArgs args)
    {
        if (_ct.IsCancellationRequested || _conectando || _rx is not null) return;
        var name = args.Advertisement.LocalName;
        if (string.IsNullOrEmpty(name) || !name.StartsWith("RaceBox", StringComparison.OrdinalIgnoreCase)) return;

        _conectando = true;
        try { w.Stop(); } catch { }
        try
        {
            await ConectarAsync(args.BluetoothAddress);
        }
        catch (Exception ex)
        {
            _onStatus?.Invoke($"GPS: falha no RaceBox ({ex.Message}) — religando…");
            IniciarVarredura();
        }
        finally { _conectando = false; }
    }

    private async Task ConectarAsync(ulong addr)
    {
        var dev = await BluetoothLEDevice.FromBluetoothAddressAsync(addr);
        if (dev is null) { IniciarVarredura(); return; }
        // H5: solta o device ANTERIOR antes de sobrescrever — senão ele fica inscrito e,
        // ao cair mais tarde, derruba uma conexão nova e saudável (GPS caindo sozinho).
        DescartarDevice();
        _device = dev;
        dev.ConnectionStatusChanged += OnConnChanged;

        var svc = await dev.GetGattServicesForUuidAsync(NusSvc, BluetoothCacheMode.Uncached);
        if (svc.Status != GattCommunicationStatus.Success || svc.Services.Count == 0) { IniciarVarredura(); return; }

        var chs = await svc.Services[0].GetCharacteristicsForUuidAsync(NusRx, BluetoothCacheMode.Uncached);
        if (chs.Status != GattCommunicationStatus.Success || chs.Characteristics.Count == 0) { IniciarVarredura(); return; }

        var ch = chs.Characteristics[0];
        ch.ValueChanged += OnNotify;
        var cfg = await ch.WriteClientCharacteristicConfigurationDescriptorAsync(
            GattClientCharacteristicConfigurationDescriptorValue.Notify);
        if (cfg != GattCommunicationStatus.Success) { ch.ValueChanged -= OnNotify; IniciarVarredura(); return; }

        _rx = ch;
        _onStatus?.Invoke($"GPS: RaceBox ligado ({dev.Name})");
    }

    private void OnConnChanged(BluetoothLEDevice dev, object _)
    {
        // H5: ignora eventos de um device FANTASMA (sobrescrito numa religação anterior) —
        // só o device corrente pode derrubar a conexão. Sem isto, o disconnect de um device
        // velho zerava o _rx de uma conexão já reconectada e boa.
        if (!ReferenceEquals(dev, _device)) return;
        if (dev.ConnectionStatus == BluetoothConnectionStatus.Disconnected && !_ct.IsCancellationRequested)
        {
            try { if (_rx is not null) _rx.ValueChanged -= OnNotify; } catch { }
            _rx = null;
            DescartarDevice();     // solta o device que caiu antes de revarrer
            _onStatus?.Invoke("GPS: RaceBox caiu — religando…");
            IniciarVarredura();
        }
    }

    // Desinscreve e descarta o device atual (H5). Chamado antes de sobrescrever, na queda
    // e no cancelamento — nunca deixa device inscrito acumulando pra disparar fantasma.
    private void DescartarDevice()
    {
        var d = _device;
        _device = null;
        if (d is null) return;
        try { d.ConnectionStatusChanged -= OnConnChanged; } catch { }
        try { d.Dispose(); } catch { }
    }

    private void OnNotify(GattCharacteristic sender, GattValueChangedEventArgs args)
    {
        var chunk = new byte[args.CharacteristicValue.Length];
        using (var r = DataReader.FromBuffer(args.CharacteristicValue)) r.ReadBytes(chunk);

        // Junta os pedaços e extrai os frames UBX completos (port fiel do onNotify).
        var fixes = new List<RaceBoxFix>();
        lock (_bufLock)
        {
            var buf = new byte[_buf.Length + chunk.Length];
            System.Buffer.BlockCopy(_buf, 0, buf, 0, _buf.Length);
            System.Buffer.BlockCopy(chunk, 0, buf, _buf.Length, chunk.Length);

            int i = 0;
            while (i + 8 <= buf.Length)
            {
                if (buf[i] != 0xB5 || buf[i + 1] != 0x62) { i++; continue; }
                int len = buf[i + 4] | (buf[i + 5] << 8);
                int tot = 6 + len + 2;
                if (i + tot > buf.Length) break;

                int a = 0, b = 0;
                for (int k = i + 2; k < i + 6 + len; k++) { a = (a + buf[k]) & 0xFF; b = (b + a) & 0xFF; }
                bool ok = a == buf[i + 6 + len] && b == buf[i + 7 + len];

                if (ok && buf[i + 2] == 0xFF && buf[i + 3] == 0x01 && len >= 80)
                    fixes.Add(Decode(buf, i + 6));
                i += tot;
            }

            var tail = new byte[buf.Length - i];
            System.Buffer.BlockCopy(buf, i, tail, 0, tail.Length);
            _buf = tail;
        }

        // Entrega FORA do lock (o consumidor re-enfileira pra thread da UI).
        foreach (var f in fixes) _onFix(f);
    }

    // Velocidade mínima (km/h) pro heading do pacote valer: abaixo disto o RaceBox
    // congela/inventa o rumo (comportamento u-blox) — vai null e o cérebro cai no
    // rumo por 2 posições, como antes.
    private const double HeadingMinKmh = 5.0;

    // Decodifica o payload de dados do RaceBox (offsets provados no web; heading no 52
    // conforme o protocolo RaceBox Mini — headMot, graus ×1e-5). o = início do payload.
    private static RaceBoxFix Decode(byte[] b, int o)
    {
        int fix     = b[o + 20];
        int numSV   = b[o + 23];
        double hacc = BitConverter.ToUInt32(b, o + 40) / 1000.0;
        double kmh  = BitConverter.ToInt32(b, o + 48) / 1000.0 * 3.6;
        double lat  = BitConverter.ToInt32(b, o + 28) / 1e7;
        double lon  = BitConverter.ToInt32(b, o + 24) / 1e7;
        double hdg  = BitConverter.ToInt32(b, o + 52) / 1e5;
        double? heading = kmh >= HeadingMinKmh && hdg >= 0 && hdg < 360 ? hdg : null;
        // gForce X/Y/Z (protocolo RaceBox Mini: int16 em mili-g @ 68/70/72). Offsets do spec,
        // PENDENTES de verificação de bancada — hoje só são gravados/publicados, não gatilham nada.
        double gx = BitConverter.ToInt16(b, o + 68) / 1000.0;
        double gy = BitConverter.ToInt16(b, o + 70) / 1000.0;
        double gz = BitConverter.ToInt16(b, o + 72) / 1000.0;
        return new RaceBoxFix(lat, lon, kmh, fix, numSV, hacc, heading, gx, gy, gz);
    }
}
