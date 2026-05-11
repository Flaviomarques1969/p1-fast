// P1 Fast — varredura de dispositivos USB plug-and-play no Windows
//
// Esse módulo usa WMI (Windows Management Instrumentation — registro
// nativo do Windows que sabe tudo o que está plugado) pra listar
// TODOS os dispositivos USB conectados ao notebook, mesmo aqueles
// que o Windows vê como "Unknown Device" (sem driver).
//
// Pra cada dispositivo, extrai:
//   • Nome amigável (ex: "USB Serial Converter")
//   • Hardware ID (ex: USB\VID_0403&PID_6001) — assinatura única
//     do fabricante (Vendor ID) e modelo (Product ID)
//   • Status (OK / Erro / driver faltando)
//   • Porta COM associada (se já tem driver instalado)
//
// Identifica chips USB-Serial comuns usados em centrais de injeção:
//   0403  FTDI         (FT232R, FT2232 — mais comum em hardware automotivo)
//   1A86  WCH          (CH340, CH341 — comum em hardware barato)
//   10C4  Silicon Labs (CP2102, CP2104 — médio range)
//   067B  Prolific     (PL2303 — comum em conversores USB-Serial)
//
// Os 4 cobrem ~98% dos cabos USB-Serial do mercado. Se a Injepro usa
// outro chip, ainda assim aparece na lista — só não fica destacado.

using System.Management;
using System.Text.RegularExpressions;

namespace P1Fast.Cockpit.T4000Capture;

internal static class UsbScanner
{
    // VID:nome dos chips USB-Serial mais comuns. Se aparecer na lista
    // de dispositivos, é forte candidato a ser uma central de injeção
    // ou conversor USB-Serial qualquer.
    private static readonly Dictionary<string, string> KnownUsbSerialVendors = new()
    {
        { "0403", "FTDI"         },
        { "1A86", "WCH (CH340)"  },
        { "10C4", "Silicon Labs" },
        { "067B", "Prolific"     },
        { "1A40", "Terminus"     }, // hubs USB — informativo
        { "0BDA", "Realtek"      },
        { "8087", "Intel"        },
        { "045E", "Microsoft"    },
        { "046D", "Logitech"     },
    };

    public sealed record UsbDevice(
        string Name,
        string DeviceId,
        string? VendorId,
        string? ProductId,
        string? VendorName,
        string Status,
        string? ComPort,
        bool LooksLikeUsbSerial,
        bool MissingDriver);

    /// <summary>
    /// Lista todos os dispositivos USB plug-and-play. Retorna lista vazia se
    /// rodar fora do Windows ou se o WMI falhar.
    /// </summary>
    public static List<UsbDevice> ScanAll()
    {
        var devices = new List<UsbDevice>();

        if (!OperatingSystem.IsWindows())
            return devices;

        try
        {
            // Query: tudo que tenha DeviceID começando com "USB" — exclui dispositivos
            // internos do tipo PCI, ACPI, etc. Foca só no que está plugado fora.
            using var searcher = new ManagementObjectSearcher(
                "SELECT Name, DeviceID, Status, PNPDeviceID FROM Win32_PnPEntity " +
                "WHERE DeviceID LIKE 'USB\\\\%'");

            foreach (var mo in searcher.Get().Cast<ManagementObject>())
            {
                var name      = (mo["Name"]      as string) ?? "(sem nome)";
                var deviceId  = (mo["DeviceID"]  as string) ?? "";
                var status    = (mo["Status"]    as string) ?? "Unknown";

                var (vid, pid) = ExtractVidPid(deviceId);
                var vendorName = vid is not null && KnownUsbSerialVendors.TryGetValue(vid, out var v) ? v : null;

                var looksLikeUsbSerial =
                    name.Contains("Serial",       StringComparison.OrdinalIgnoreCase) ||
                    name.Contains("UART",         StringComparison.OrdinalIgnoreCase) ||
                    name.Contains("CDC",          StringComparison.OrdinalIgnoreCase) ||
                    name.Contains("FTDI",         StringComparison.OrdinalIgnoreCase) ||
                    name.Contains("CH340",        StringComparison.OrdinalIgnoreCase) ||
                    name.Contains("CP210",        StringComparison.OrdinalIgnoreCase) ||
                    name.Contains("PL2303",       StringComparison.OrdinalIgnoreCase) ||
                    name.Contains("Injepro",      StringComparison.OrdinalIgnoreCase) ||
                    (vid is not null && IsLikelyUsbSerialChipVid(vid));

                var missingDriver =
                    status.Equals("Error", StringComparison.OrdinalIgnoreCase) ||
                    name.Contains("Unknown",  StringComparison.OrdinalIgnoreCase) ||
                    name.Equals("USB Device", StringComparison.OrdinalIgnoreCase) ||
                    name.Equals("USB\\Unknown Device", StringComparison.OrdinalIgnoreCase);

                var comPort = ExtractComPortForDevice(deviceId);

                devices.Add(new UsbDevice(
                    Name:               name,
                    DeviceId:           deviceId,
                    VendorId:           vid,
                    ProductId:          pid,
                    VendorName:         vendorName,
                    Status:             status,
                    ComPort:            comPort,
                    LooksLikeUsbSerial: looksLikeUsbSerial,
                    MissingDriver:      missingDriver));
            }
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"[diag] WMI falhou ao listar USB: {ex.GetType().Name}: {ex.Message}");
        }

        return devices
            .OrderByDescending(d => d.LooksLikeUsbSerial)
            .ThenBy(d => d.Name, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    /// <summary>Verdadeiro se o VID é de um chip USB-Serial conhecido.</summary>
    private static bool IsLikelyUsbSerialChipVid(string vid)
    {
        return vid is "0403" or "1A86" or "10C4" or "067B";
    }

    private static (string? vid, string? pid) ExtractVidPid(string deviceId)
    {
        // Formato típico: USB\VID_0403&PID_6001\AB12CD34
        var m = Regex.Match(deviceId, @"VID_([0-9A-F]{4})&PID_([0-9A-F]{4})", RegexOptions.IgnoreCase);
        if (!m.Success) return (null, null);
        return (m.Groups[1].Value.ToUpperInvariant(), m.Groups[2].Value.ToUpperInvariant());
    }

    /// <summary>
    /// Tenta achar a porta COM (ex: "COM4") associada a um DeviceID USB.
    /// Funciona quando o driver USB-Serial está instalado.
    /// </summary>
    private static string? ExtractComPortForDevice(string parentDeviceId)
    {
        if (!OperatingSystem.IsWindows()) return null;

        try
        {
            // Busca todas as portas COM e olha o PNPDeviceID — se for filho
            // do dispositivo USB acima, é a porta dele.
            using var searcher = new ManagementObjectSearcher(
                "SELECT Name, DeviceID, PNPDeviceID FROM Win32_SerialPort");

            foreach (var port in searcher.Get().Cast<ManagementObject>())
            {
                var portName = (port["Name"]     as string) ?? "";
                var portPnp  = (port["PNPDeviceID"] as string) ?? "";

                // Match por substring — DeviceID do USB pai aparece como prefixo no PNPDeviceID da porta
                if (!string.IsNullOrEmpty(parentDeviceId) && portPnp.StartsWith(parentDeviceId.Replace("\\", "\\"), StringComparison.OrdinalIgnoreCase))
                {
                    // portName vem como "USB Serial Port (COM4)" — extrai só COMx
                    var match = Regex.Match(portName, @"COM\d+");
                    return match.Success ? match.Value : portName;
                }
            }
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"[diag] WMI falhou ao listar portas COM: {ex.GetType().Name}: {ex.Message}");
        }

        return null;
    }

    /// <summary>Imprime relatório formatado pro console.</summary>
    public static void PrintReport(List<UsbDevice> devices)
    {
        Console.WriteLine();
        Console.WriteLine("──────────────────────────────────────────────────────────────");
        Console.WriteLine($"  DIAGNÓSTICO USB — {devices.Count} dispositivos detectados");
        Console.WriteLine("──────────────────────────────────────────────────────────────");
        Console.WriteLine();

        if (devices.Count == 0)
        {
            Console.WriteLine("  Nenhum dispositivo USB plug-and-play encontrado.");
            Console.WriteLine("  Possíveis causas:");
            Console.WriteLine("    • Cabo USB da central T4000 não está plugado");
            Console.WriteLine("    • Porta USB do notebook está com defeito");
            Console.WriteLine("    • Cabo USB é só de carga (sem fios de dados)");
            Console.WriteLine();
            return;
        }

        // Candidatos a ser a Injepro (USB-Serial)
        var serial    = devices.Where(d => d.LooksLikeUsbSerial && !d.MissingDriver).ToList();
        var semDriver = devices.Where(d => d.MissingDriver).ToList();
        var resto     = devices.Where(d => !d.LooksLikeUsbSerial && !d.MissingDriver).ToList();

        if (serial.Count > 0)
        {
            Console.WriteLine("  ✓ CANDIDATOS A T4000 (USB-Serial com driver instalado):");
            foreach (var d in serial) PrintDevice(d, indent: "    ");
            Console.WriteLine();
        }

        if (semDriver.Count > 0)
        {
            Console.WriteLine("  ⚠ DISPOSITIVOS SEM DRIVER (provável Injepro sem driver instalado):");
            foreach (var d in semDriver) PrintDevice(d, indent: "    ");
            Console.WriteLine();
            Console.WriteLine("    SOLUÇÃO: instalar o driver do chip USB-Serial. Use o VID acima");
            Console.WriteLine("    pra identificar o chip:");
            Console.WriteLine("      VID 0403 → FTDI         (https://ftdichip.com/drivers/vcp-drivers/)");
            Console.WriteLine("      VID 1A86 → WCH CH340    (busca: 'CH340 driver Windows')");
            Console.WriteLine("      VID 10C4 → Silicon Labs (busca: 'CP210x driver Windows')");
            Console.WriteLine("      VID 067B → Prolific     (busca: 'PL2303 driver Windows')");
            Console.WriteLine();
        }

        if (resto.Count > 0)
        {
            Console.WriteLine($"  Outros dispositivos USB ({resto.Count}, provavelmente não relevantes):");
            foreach (var d in resto) PrintDevice(d, indent: "    ");
            Console.WriteLine();
        }
    }

    private static void PrintDevice(UsbDevice d, string indent)
    {
        var vidpid = (d.VendorId is not null && d.ProductId is not null)
            ? $"VID:{d.VendorId} PID:{d.ProductId}"
            : "(sem VID/PID)";

        var vendor = d.VendorName is not null ? $" — {d.VendorName}" : "";
        var com    = d.ComPort is not null ? $"  [{d.ComPort}]" : "";
        var status = d.Status != "OK" ? $"  ({d.Status})" : "";

        Console.WriteLine($"{indent}• {d.Name}{com}");
        Console.WriteLine($"{indent}  {vidpid}{vendor}{status}");
    }

    /// <summary>
    /// Encontra o melhor candidato a porta COM da T4000 dentre os dispositivos.
    /// Retorna null se nenhum estiver com driver e porta COM atribuída.
    /// </summary>
    public static string? FindBestComPort(List<UsbDevice> devices)
    {
        // Prioriza dispositivos USB-Serial com driver instalado e porta COM atribuída
        var candidate = devices.FirstOrDefault(d => d.LooksLikeUsbSerial && d.ComPort is not null);
        return candidate?.ComPort;
    }
}
