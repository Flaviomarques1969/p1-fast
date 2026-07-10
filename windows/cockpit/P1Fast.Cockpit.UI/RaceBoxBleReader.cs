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
using P1Fast.Cockpit.Domain;

namespace P1Fast.Cockpit.UI;

/// <summary>Um fix decodificado do RaceBox.</summary>
// HeadingDeg (L2): rumo do movimento do PACOTE (headMot, 0=norte, horário) — antes era
// descartado e o ângulo do ápice saía por 2 posições (mais ruidoso). Null quando não
// confiável (parado/quase parado: o RaceBox congela/inventa o rumo em baixa velocidade).
// GX/GY/GZ: aceleração do RaceBox em g (eixos CRUS do aparelho). Decodificados dos offsets
// 68/70/72 do pacote (protocolo RaceBox Mini, int16 mili-g) — Flávio 2026-07-07. PENDENTE de
// verificação de BANCADA (offsets + qual eixo é o longitudinal); por isso ainda não gatilham nada.
// TWallMs (5.3a): carimbo de parede JÁ espaçado por frame — quando um notify BLE traz
// vários fixes, cada um recebe seu tempo pelo iTOW (não todos na mesma chegada). 0 = não
// informado (fluxos que não passam pelo espaçador).
public readonly record struct RaceBoxFix(double Lat, double Lng, double Kmh, int Fix, int NumSV, double HaccM,
    double? HeadingDeg = null, double GX = 0, double GY = 0, double GZ = 0, long TWallMs = 0);

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
    private int _conectando;   // 0/1 via Interlocked (advertisements vêm em threads do pool)

    // Teto do buffer de reassembly: acima disto o começo é lixo velho (nunca fechou um
    // frame) — descarta o mais antigo, mantendo a cauda (onde mora um frame parcial real).
    private const int MaxBufBytes = 2048;

    // Watchdog de DADOS: conectado mas sem fix por tanto tempo = pilha BLE travada sem
    // evento Disconnected. Derruba e religa (senão o GPS morre com o app achando que vive).
    private const int WatchdogSemFixMs = 5000;
    private long _ultimoFixTick;   // Environment.TickCount64 do último fix decodificado
    private Task? _watchdogTask;

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
        _watchdogTask = VigiarDadosAsync(ct);
    }

    // Watchdog de DADOS (5.4): a reconexão só por evento Disconnected não pega a pilha BLE
    // que trava SEM disparar evento — aí o GPS morre com o app achando que está ligado. Aqui,
    // se há assinatura viva (_rx != null) mas nenhum fix há WatchdogSemFixMs, derruba e religa.
    private async Task VigiarDadosAsync(CancellationToken ct)
    {
        try
        {
            while (!ct.IsCancellationRequested)
            {
                await Task.Delay(2000, ct).ConfigureAwait(false);
                bool assinado = _rx is not null;
                long ultimo = System.Threading.Interlocked.Read(ref _ultimoFixTick);
                if (assinado && ultimo > 0 && Environment.TickCount64 - ultimo >= WatchdogSemFixMs)
                {
                    _onStatus?.Invoke("GPS: RaceBox mudo (sem fix) — religando…");
                    try { if (_rx is not null) _rx.ValueChanged -= OnNotify; } catch { }
                    _rx = null;
                    DescartarDevice();
                    lock (_bufLock) _buf = Array.Empty<byte>();
                    System.Threading.Interlocked.Exchange(ref _ultimoFixTick, 0);
                    IniciarVarredura();
                }
            }
        }
        catch (OperationCanceledException) { /* encerrando */ }
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
        if (_ct.IsCancellationRequested || _rx is not null) return;
        var name = args.Advertisement.LocalName;
        if (string.IsNullOrEmpty(name) || !name.StartsWith("RaceBox", StringComparison.OrdinalIgnoreCase)) return;

        // H5 (por outra porta): advertisements chegam em threads do pool — duas podiam entrar
        // em ConectarAsync ao mesmo tempo. CompareExchange garante UMA só (troca atômica).
        if (System.Threading.Interlocked.CompareExchange(ref _conectando, 1, 0) != 0) return;
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
        finally { System.Threading.Interlocked.Exchange(ref _conectando, 0); }
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

        // Junta os pedaços e delega a extração/decode/resync ao parser PURO (testável).
        List<RaceBoxDecoded> decs;
        lock (_bufLock)
        {
            var buf = new byte[_buf.Length + chunk.Length];
            System.Buffer.BlockCopy(_buf, 0, buf, 0, _buf.Length);
            System.Buffer.BlockCopy(chunk, 0, buf, _buf.Length, chunk.Length);

            decs = RaceBoxUbxParser.Extract(buf, out int consumido);

            int restante = buf.Length - consumido;
            // Teto do buffer (5.4): nunca deixa a cauda crescer sem limite (len corrompido
            // que nunca fecha um frame) — mantém só o final (onde um frame parcial real vive).
            if (restante > MaxBufBytes)
            {
                var corte = new byte[MaxBufBytes];
                System.Buffer.BlockCopy(buf, buf.Length - MaxBufBytes, corte, 0, MaxBufBytes);
                _buf = corte;
            }
            else
            {
                var tail = new byte[restante];
                System.Buffer.BlockCopy(buf, consumido, tail, 0, restante);
                _buf = tail;
            }
        }

        if (decs.Count == 0) return;

        // 5.3a: quando vários frames vêm num MESMO notify, espaça os carimbos pelo iTOW —
        // senão todos ganham a mesma chegada (dt~0 → km/h absurdo no cérebro).
        _ultimoFixTick = Environment.TickCount64;
        long chegada = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var itows = new long[decs.Count];
        for (int k = 0; k < decs.Count; k++) itows[k] = decs[k].ITowMs;
        var tWalls = RaceBoxUbxParser.EspacarTimestamps(itows, chegada);

        // Entrega FORA do lock (o consumidor re-enfileira pra thread da UI).
        for (int k = 0; k < decs.Count; k++)
        {
            var d = decs[k];
            _onFix(new RaceBoxFix(d.Lat, d.Lng, d.Kmh, d.Fix, d.NumSV, d.HaccM,
                                  d.HeadingDeg, d.GX, d.GY, d.GZ, tWalls[k]));
        }
    }
}
