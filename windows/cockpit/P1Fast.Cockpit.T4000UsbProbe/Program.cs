// Program.cs — sonda nativa de leitura da Injepro T3000/T4000 via USB.
//
// Espelha o caminho da página WebUSB (web/cockpit/main-t3000.js) que JÁ
// funciona, mas em .NET nativo com LibUsbDotNet (WinUSB/libusb):
//   1. enumera os dispositivos USB visíveis ao WinUSB;
//   2. escolhe a Injepro (pelo nome, ou o único com endpoints bulk in+out);
//   3. handshake: manda "ACK" -> espera "OK";
//   4. loop ~10 Hz: manda "RI" -> acumula ~460 bytes -> decodifica com
//      T3000RiBlockParser (Domain) -> imprime RPM/água/λ/TPS ao vivo.
//
// Tudo é verboso de propósito: se algo falhar, a saída diz em português o
// que houve, pra eu (Claude) corrigir sem depender de log/foto manual.
//
// Uso:  p1fast-t4000-usb-probe.exe            (auto-detecta)
//       p1fast-t4000-usb-probe.exe --scan     (só lista dispositivos e sai)
//       p1fast-t4000-usb-probe.exe --vid 1234 --pid 5678

using LibUsbDotNet;
using LibUsbDotNet.Main;
using P1Fast.Cockpit.Domain;

Console.OutputEncoding = System.Text.Encoding.UTF8;
Console.WriteLine("=== P1 Fast · sonda USB nativa Injepro T3000/T4000 ===");

bool scanOnly = args.Contains("--scan");
int? wantVid = ArgHex(args, "--vid");
int? wantPid = ArgHex(args, "--pid");

UsbRegDeviceList all = UsbDevice.AllDevices;
Console.WriteLine($"Dispositivos USB visíveis ao WinUSB/libusb: {all.Count}\n");

if (all.Count == 0)
{
    Console.WriteLine("NENHUM dispositivo no driver WinUSB/libusb.");
    Console.WriteLine("→ A Injepro provavelmente está no driver proprietário. Rode o Zadig e");
    Console.WriteLine("  troque o driver da Injepro pra WinUSB (uma vez só). Depois rode de novo.");
    Pausa();
    return;
}

UsbRegistry? chosen = null;
foreach (UsbRegistry reg in all)
{
    string desc = SafeName(reg);
    Console.WriteLine($"  • VID:{reg.Vid:X4} PID:{reg.Pid:X4}  {desc}");
    if (wantVid is int v && wantPid is int p)
    {
        if (reg.Vid == v && reg.Pid == p) chosen = reg;
    }
    else if (desc.Contains("injepro", StringComparison.OrdinalIgnoreCase))
    {
        chosen ??= reg;
    }
}
Console.WriteLine();

if (scanOnly) { Console.WriteLine("(--scan: só listagem)"); Pausa(); return; }

// Sem match por nome/VID: se só há 1 dispositivo, usa ele.
chosen ??= all.Count == 1 ? all[0] : null;
if (chosen is null)
{
    Console.WriteLine("Não consegui escolher a Injepro automaticamente (vários dispositivos).");
    Console.WriteLine("→ Rode de novo com --vid XXXX --pid YYYY (em hex) do dispositivo Injepro acima.");
    Pausa();
    return;
}

Console.WriteLine($"Abrindo VID:{chosen.Vid:X4} PID:{chosen.Pid:X4} ({SafeName(chosen)})…");
if (!chosen.Open(out UsbDevice dev) || dev is null)
{
    Console.WriteLine("✗ Falhou ao abrir o dispositivo (ocupado ou sem permissão).");
    Pausa();
    return;
}

try
{
    if (dev is IUsbDevice whole)
    {
        whole.SetConfiguration(1);
        whole.ClaimInterface(0);
    }

    // Descobre endpoints bulk IN/OUT a partir do descritor.
    byte epIn = 0, epOut = 0;
    foreach (var cfg in dev.Configs)
        foreach (var iface in cfg.InterfaceInfoList)
            foreach (var ep in iface.EndpointInfoList)
            {
                byte addr = ep.Descriptor.EndpointID;
                bool isIn = (addr & 0x80) != 0;
                if (isIn && epIn == 0) epIn = addr;
                if (!isIn && epOut == 0) epOut = addr;
            }
    Console.WriteLine($"Endpoints: IN=0x{epIn:X2}  OUT=0x{epOut:X2}");
    if (epIn == 0 || epOut == 0)
    {
        Console.WriteLine("✗ Dispositivo sem par de endpoints IN/OUT — não é o canal de dados esperado.");
        return;
    }

    var writer = dev.OpenEndpointWriter((WriteEndpointID)epOut);
    var reader = dev.OpenEndpointReader((ReadEndpointID)epIn);

    // ── Handshake: ACK -> OK ────────────────────────────────────────────
    int n;
    var ec = writer.Write(T3000RiBlockParser.AckBytes, 2000, out n);
    if (ec != ErrorCode.None) { Console.WriteLine($"✗ Falha ao mandar ACK: {ec}"); return; }
    var ackResp = new byte[64];
    ec = reader.Read(ackResp, 2000, out n);
    if (ec != ErrorCode.None) { Console.WriteLine($"✗ Sem resposta ao ACK: {ec}"); return; }
    if (!T3000RiBlockParser.IsAckOk(ackResp.AsSpan(0, Math.Max(2, n))))
    {
        Console.WriteLine($"✗ Saudação rejeitada (esperava 'OK'). Recebido: {Hex(ackResp, n)}");
        return;
    }
    Console.WriteLine("✓ Handshake OK — central respondeu. Lendo ao vivo (Ctrl+C pra parar):\n");

    // ── Loop de leitura ─────────────────────────────────────────────────
    var buf = new byte[512];
    int ciclos = 0, ok = 0;
    while (true)
    {
        ec = writer.Write(T3000RiBlockParser.RiBytes, 1000, out n);
        if (ec != ErrorCode.None) { Console.WriteLine($"  leitura caiu (write RI): {ec}"); break; }

        // acumula até ~460 bytes (a central manda em pacotes de 64)
        int total = 0;
        var merged = new byte[512];
        var t0 = Environment.TickCount;
        while (Environment.TickCount - t0 < 200 && total < 460)
        {
            ec = reader.Read(buf, 200, out n);
            if (ec == ErrorCode.IoTimedOut) break;
            if (ec != ErrorCode.None) { break; }
            if (n <= 0) break;
            Array.Copy(buf, 0, merged, total, Math.Min(n, merged.Length - total));
            total += n;
        }
        ciclos++;
        if (total < 92) continue;

        var sample = T3000RiBlockParser.Parse(merged.AsSpan(0, total));
        if (sample is null) continue;
        ok++;
        if (ok <= 3 || ok % 5 == 0)
        {
            var a = sample.Alarmes.QualquerAtivo ? " ⚠ALARME" : "";
            Console.WriteLine(
                $"[{ok,4}] rpm={sample.Rpm,5}  água={(sample.WaterTempC?.ToString() ?? "—")}°C  " +
                $"λ={sample.Lambda:F2}  tps={sample.TpsPct:F0}%  bat={sample.BatteryV:F1}V  " +
                $"vel={sample.SpeedKmh:F0}km/h  bytes={sample.BytesLen}{a}");
        }
        System.Threading.Thread.Sleep(50);
    }
    Console.WriteLine($"\nciclos={ciclos} amostras_ok={ok}");
}
finally
{
    if (dev.IsOpen)
    {
        if (dev is IUsbDevice w) w.ReleaseInterface(0);
        dev.Close();
    }
    UsbDevice.Exit();
}

// ── helpers ─────────────────────────────────────────────────────────────
static string SafeName(UsbRegistry reg)
{
    try { return reg.FullName ?? reg.Name ?? "(sem nome)"; }
    catch { return "(sem nome)"; }
}
static int? ArgHex(string[] args, string flag)
{
    int i = Array.IndexOf(args, flag);
    if (i >= 0 && i + 1 < args.Length && int.TryParse(args[i + 1],
        System.Globalization.NumberStyles.HexNumber, null, out int v)) return v;
    return null;
}
static string Hex(byte[] b, int n)
    => string.Join(" ", b.AsSpan(0, Math.Min(n, 8)).ToArray().Select(x => x.ToString("X2")));
static void Pausa()
{
    Console.WriteLine("\n(enter pra sair)");
    try { Console.ReadLine(); } catch { }
}
