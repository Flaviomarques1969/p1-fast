// WinUsbT3000Channel - a TOMADA fisica da T4000 por WinUSB (transferencia bulk),
// LOCAL no notebook. Substitui o caminho COM (CDC-ACM) que NAO casa com este
// aparelho: a Injepro T4000 (chip Microchip VID_04D8&PID_014A) se apresenta como
// dispositivo WinUSB, exatamente como o leitor web provado (web/cockpit/main-t3000.js)
// la' por WebUSB. Aqui no .exe fazemos o mesmo, mas 100% local (sem navegador):
// abre o device, acha o endpoint IN e o OUT, e so' transporta bytes. NENHUMA logica
// de protocolo aqui - handshake (ACK/OK), bloco RI, 10 Hz e religacao vivem no
// T3000UsbLiveReader (Domain), agnostico ao canal.
//
// P/Invoke direto em setupapi.dll + winusb.dll (sem dependencia externa, roda
// desempacotado). Sincrono: o reader roda numa thread dedicada (LongRunning), entao
// ReadPipe/WritePipe bloqueantes com timeout de pipe estao certos. Read() devolve 0
// quando "secou" (timeout do pipe), igual o canal-fake espera.

using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;
using P1Fast.Cockpit.Domain;

namespace P1Fast.Cockpit.UI;

public sealed class WinUsbT3000Channel : IT3000UsbChannel
{
    private readonly ushort _vid;
    private readonly ushort _pid;
    private readonly uint _readTimeoutMs;
    private readonly uint _writeTimeoutMs;

    private SafeFileHandle? _file;
    private IntPtr _winusb = IntPtr.Zero;           // interface 0
    private readonly List<IntPtr> _assoc = new();   // interfaces associadas (pra liberar)
    private byte _epIn;
    private byte _epOut;
    private IntPtr _hIn;    // handle WinUSB dono do endpoint de leitura
    private IntPtr _hOut;   // handle WinUSB dono do endpoint de escrita

    /// <param name="vid">Vendor ID (T4000 = 0x04D8 Microchip).</param>
    /// <param name="pid">Product ID (T4000 = 0x014A).</param>
    public WinUsbT3000Channel(ushort vid = 0x04D8, ushort pid = 0x014A, uint readTimeoutMs = 150, uint writeTimeoutMs = 1000)
    {
        _vid = vid; _pid = pid; _readTimeoutMs = readTimeoutMs; _writeTimeoutMs = writeTimeoutMs;
    }

    /// <summary>True se um aparelho WinUSB com esse VID/PID esta plugado agora.</summary>
    public static bool Present(ushort vid = 0x04D8, ushort pid = 0x014A)
        => TryFindDevicePath(vid, pid) is not null;

    public Task OpenAsync(CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        try { Close(); } catch { /* reabertura limpa */ }

        var path = TryFindDevicePath(_vid, _pid)
            ?? throw new InvalidOperationException($"T4000 WinUSB nao encontrada (VID_{_vid:X4}&PID_{_pid:X4})");

        var h = CreateFile(path,
            GENERIC_READ | GENERIC_WRITE,
            FILE_SHARE_READ | FILE_SHARE_WRITE,
            IntPtr.Zero, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, IntPtr.Zero);
        if (h.IsInvalid)
        {
            int err = Marshal.GetLastWin32Error();
            string dica = err == 5 ? " (acesso negado: feche a pagina web/outro app que esteja lendo a T4000)" : "";
            throw new InvalidOperationException($"CreateFile da T4000 falhou (erro {err}){dica}");
        }
        _file = h;

        if (!WinUsb_Initialize(h, out _winusb))
            throw new InvalidOperationException($"WinUsb_Initialize falhou (erro {Marshal.GetLastWin32Error()})");

        // Acha endpoint IN e OUT (igual o web: 1o IN, 1o OUT) na interface 0; se faltar,
        // varre as interfaces associadas.
        byte epIn = 0, epOut = 0;
        IntPtr hIn = IntPtr.Zero, hOut = IntPtr.Zero;
        FindEndpoints(_winusb, ref epIn, ref epOut, ref hIn, ref hOut);
        if (epIn == 0 || epOut == 0)
        {
            byte assocIdx = 0;
            while ((epIn == 0 || epOut == 0) && WinUsb_GetAssociatedInterface(_winusb, assocIdx, out var assoc))
            {
                _assoc.Add(assoc);
                FindEndpoints(assoc, ref epIn, ref epOut, ref hIn, ref hOut);
                assocIdx++;
            }
        }
        if (epIn == 0 || epOut == 0)
            throw new InvalidOperationException("T4000 sem canal de leitura/escrita (endpoints IN/OUT nao achados)");

        _epIn = epIn; _epOut = epOut; _hIn = hIn; _hOut = hOut;

        // Timeout de transferencia: o Read devolve 0 quando seca (sem travar pra sempre).
        SetTimeout(_hIn, _epIn, _readTimeoutMs);
        SetTimeout(_hOut, _epOut, _writeTimeoutMs);
        return Task.CompletedTask;
    }

    public Task WriteAsync(byte[] data, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (_hOut == IntPtr.Zero) throw new InvalidOperationException("canal nao aberto");
        if (!WinUsb_WritePipe(_hOut, _epOut, data, (uint)data.Length, out _, IntPtr.Zero))
            throw new System.IO.IOException($"WinUsb_WritePipe falhou (erro {Marshal.GetLastWin32Error()})");
        return Task.CompletedTask;
    }

    public Task<int> ReadAsync(byte[] buffer, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (_hIn == IntPtr.Zero) throw new InvalidOperationException("canal nao aberto");
        if (WinUsb_ReadPipe(_hIn, _epIn, buffer, (uint)buffer.Length, out uint transferred, IntPtr.Zero))
            return Task.FromResult((int)transferred);
        int err = Marshal.GetLastWin32Error();
        if (err == ERROR_SEM_TIMEOUT) return Task.FromResult(0);   // secou agora
        throw new System.IO.IOException($"WinUsb_ReadPipe falhou (erro {err})");
    }

    public Task CloseAsync() { Close(); return Task.CompletedTask; }

    private void Close()
    {
        foreach (var a in _assoc) { try { WinUsb_Free(a); } catch { } }
        _assoc.Clear();
        if (_winusb != IntPtr.Zero) { try { WinUsb_Free(_winusb); } catch { } _winusb = IntPtr.Zero; }
        try { _file?.Dispose(); } catch { }
        _file = null;
        _epIn = _epOut = 0; _hIn = _hOut = IntPtr.Zero;
    }

    // Varre os pipes de uma interface WinUSB e pega o 1o IN e o 1o OUT (qualquer tipo,
    // igual o web que so' olha a direcao). Marca em qual handle cada endpoint vive.
    private static void FindEndpoints(IntPtr h, ref byte epIn, ref byte epOut, ref IntPtr hIn, ref IntPtr hOut)
    {
        if (!WinUsb_QueryInterfaceSettings(h, 0, out var ifd)) return;
        for (byte p = 0; p < ifd.bNumEndpoints; p++)
        {
            if (!WinUsb_QueryPipe(h, 0, p, out var pi)) continue;
            bool isIn = (pi.PipeId & 0x80) != 0;
            if (isIn && epIn == 0) { epIn = pi.PipeId; hIn = h; }
            else if (!isIn && epOut == 0) { epOut = pi.PipeId; hOut = h; }
        }
    }

    private static void SetTimeout(IntPtr h, byte pipeId, uint ms)
    {
        if (h == IntPtr.Zero) return;
        try { WinUsb_SetPipePolicy(h, pipeId, PIPE_TRANSFER_TIMEOUT, sizeof(uint), ref ms); } catch { /* best-effort */ }
    }

    // ── Descoberta do device path via SetupAPI (GUID_DEVINTERFACE_USB_DEVICE) ──
    private static readonly Guid GuidDevInterfaceUsbDevice =
        new("A5DCBF10-6530-11D2-901F-00C04FB951ED");

    private static string? TryFindDevicePath(ushort vid, ushort pid)
    {
        if (!OperatingSystem.IsWindows()) return null;
        string needle = $"vid_{vid:x4}&pid_{pid:x4}";
        Guid guid = GuidDevInterfaceUsbDevice;
        IntPtr set = SetupDiGetClassDevs(ref guid, IntPtr.Zero, IntPtr.Zero,
            DIGCF_PRESENT | DIGCF_DEVICEINTERFACE);
        if (set == INVALID_HANDLE_VALUE) return null;
        try
        {
            var ifData = new SP_DEVICE_INTERFACE_DATA();
            ifData.cbSize = (uint)Marshal.SizeOf<SP_DEVICE_INTERFACE_DATA>();
            uint i = 0;
            while (SetupDiEnumDeviceInterfaces(set, IntPtr.Zero, ref guid, i, ref ifData))
            {
                i++;
                // 1a chamada: tamanho necessario
                SetupDiGetDeviceInterfaceDetail(set, ref ifData, IntPtr.Zero, 0, out uint required, IntPtr.Zero);
                if (required == 0) continue;
                IntPtr detail = Marshal.AllocHGlobal((int)required);
                try
                {
                    // cbSize do detail: 8 em x64 (4 cbSize + 2 do 1o WCHAR alinhado), 6 em x86.
                    Marshal.WriteInt32(detail, IntPtr.Size == 8 ? 8 : 6);
                    if (SetupDiGetDeviceInterfaceDetail(set, ref ifData, detail, required, out _, IntPtr.Zero))
                    {
                        string path = Marshal.PtrToStringUni(detail + 4) ?? "";
                        if (path.Contains(needle, StringComparison.OrdinalIgnoreCase))
                            return path;
                    }
                }
                finally { Marshal.FreeHGlobal(detail); }
            }
        }
        finally { SetupDiDestroyDeviceInfoList(set); }
        return null;
    }

    // ── P/Invoke ──────────────────────────────────────────────
    private const uint GENERIC_READ = 0x80000000, GENERIC_WRITE = 0x40000000;
    private const uint FILE_SHARE_READ = 1, FILE_SHARE_WRITE = 2;
    private const uint OPEN_EXISTING = 3, FILE_ATTRIBUTE_NORMAL = 0x80;
    private const uint DIGCF_PRESENT = 0x2, DIGCF_DEVICEINTERFACE = 0x10;
    private const uint PIPE_TRANSFER_TIMEOUT = 0x03;
    private const int ERROR_SEM_TIMEOUT = 121;
    private static readonly IntPtr INVALID_HANDLE_VALUE = new(-1);

    [StructLayout(LayoutKind.Sequential)]
    private struct SP_DEVICE_INTERFACE_DATA { public uint cbSize; public Guid InterfaceClassGuid; public uint Flags; public IntPtr Reserved; }

    [StructLayout(LayoutKind.Sequential, Pack = 1)]
    private struct USB_INTERFACE_DESCRIPTOR
    {
        public byte bLength, bDescriptorType, bInterfaceNumber, bAlternateSetting,
                    bNumEndpoints, bInterfaceClass, bInterfaceSubClass, bInterfaceProtocol, iInterface;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct WINUSB_PIPE_INFORMATION
    {
        public int PipeType; public byte PipeId; public ushort MaximumPacketSize; public byte Interval;
    }

    [DllImport("setupapi.dll", SetLastError = true)]
    private static extern IntPtr SetupDiGetClassDevs(ref Guid g, IntPtr enumerator, IntPtr hwndParent, uint flags);
    [DllImport("setupapi.dll", SetLastError = true)]
    private static extern bool SetupDiEnumDeviceInterfaces(IntPtr set, IntPtr devInfo, ref Guid g, uint index, ref SP_DEVICE_INTERFACE_DATA data);
    [DllImport("setupapi.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern bool SetupDiGetDeviceInterfaceDetail(IntPtr set, ref SP_DEVICE_INTERFACE_DATA data, IntPtr detail, uint detailSize, out uint required, IntPtr devInfo);
    [DllImport("setupapi.dll", SetLastError = true)]
    private static extern bool SetupDiDestroyDeviceInfoList(IntPtr set);

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern SafeFileHandle CreateFile(string name, uint access, uint share, IntPtr sec, uint disp, uint flags, IntPtr template);

    [DllImport("winusb.dll", SetLastError = true)]
    private static extern bool WinUsb_Initialize(SafeFileHandle dev, out IntPtr handle);
    [DllImport("winusb.dll", SetLastError = true)]
    private static extern bool WinUsb_Free(IntPtr handle);
    [DllImport("winusb.dll", SetLastError = true)]
    private static extern bool WinUsb_GetAssociatedInterface(IntPtr handle, byte index, out IntPtr assoc);
    [DllImport("winusb.dll", SetLastError = true)]
    private static extern bool WinUsb_QueryInterfaceSettings(IntPtr handle, byte alt, out USB_INTERFACE_DESCRIPTOR desc);
    [DllImport("winusb.dll", SetLastError = true)]
    private static extern bool WinUsb_QueryPipe(IntPtr handle, byte alt, byte index, out WINUSB_PIPE_INFORMATION info);
    [DllImport("winusb.dll", SetLastError = true)]
    private static extern bool WinUsb_SetPipePolicy(IntPtr handle, byte pipeId, uint policyType, uint valueLen, ref uint value);
    [DllImport("winusb.dll", SetLastError = true)]
    private static extern bool WinUsb_ReadPipe(IntPtr handle, byte pipeId, byte[] buffer, uint len, out uint transferred, IntPtr overlapped);
    [DllImport("winusb.dll", SetLastError = true)]
    private static extern bool WinUsb_WritePipe(IntPtr handle, byte pipeId, byte[] buffer, uint len, out uint transferred, IntPtr overlapped);
}
