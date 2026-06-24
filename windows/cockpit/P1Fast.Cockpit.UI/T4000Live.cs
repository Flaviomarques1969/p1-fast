// T4000Live.cs — leitura REAL da central Injepro T3000/T4000 dentro do app WinUI.
//
// Porte (sem Console) do leitor auto-corretivo já provado em campo
// (P1Fast.Cockpit.T4000UsbProbe): roda numa thread de fundo, acha a estratégia
// de conexão sozinho, lê o bloco RI, decodifica com T3000RiBlockParser e entrega
// cada amostra via callback. O MainWindow pluga esse callback em:
//   LiveDataBridge.IngestT3000  → processa (shift light + alertas) → CockpitState → tela
//   LiveSink.Publicar           → transmite pra nuvem (iPhone/Box)
//   LiveSink.Salvar             → histórico local
//
// Requisito: alta velocidade + estabilidade. Por isso roda fora da thread de UI
// (não trava a tela) e tudo é best-effort (nuvem/arquivo nunca derrubam a leitura).

using System.Text.Json;
using LibUsbDotNet;
using LibUsbDotNet.Main;
using P1Fast.Cockpit.Domain;

namespace P1Fast.Cockpit.UI;

public sealed class T4000LiveReader
{
    private readonly Action<T3000Sample> _onSample;
    private readonly Action<string>? _onLog;
    private volatile bool _running;

    /// <summary>Estratégia (endpoints/modo) que está funcionando — pra diagnóstico.</summary>
    public string Estrategia { get; private set; } = "?";

    public T4000LiveReader(Action<T3000Sample> onSample, Action<string>? onLog = null)
    {
        _onSample = onSample;
        _onLog = onLog;
    }

    public void Start()
    {
        if (_running) return;
        _running = true;
        var t = new Thread(Loop) { IsBackground = true, Name = "t4000-reader" };
        t.Start();
    }

    public void Stop() => _running = false;

    private void Loop()
    {
        while (_running)
        {
            try
            {
                if (!UmaRodada()) Thread.Sleep(2000);   // nada conectou — tenta de novo
            }
            catch (Exception e)
            {
                _onLog?.Invoke("erro: " + e.Message);
                Thread.Sleep(2000);
            }
        }
    }

    private bool UmaRodada()
    {
        var all = UsbDevice.AllDevices;
        if (all.Count == 0)
        {
            _onLog?.Invoke("sem dispositivo WinUSB (driver/Zadig?)");
            SystemHealth.Dispositivos("0 — nenhum dispositivo WinUSB visível (driver/Zadig?)");
            return false;
        }

        var candidatos = new List<UsbRegistry>();
        foreach (UsbRegistry reg in all)
        {
            if (SafeName(reg).Contains("injepro", StringComparison.OrdinalIgnoreCase)) candidatos.Insert(0, reg);
            else candidatos.Add(reg);
        }
        SystemHealth.Dispositivos($"{all.Count}: " + string.Join(" | ", candidatos.Select(SafeName)));

        foreach (var reg in candidatos)
        {
            if (!reg.Open(out UsbDevice dev) || dev is null) continue;
            try
            {
                if (dev is IUsbDevice whole) { whole.SetConfiguration(1); whole.ClaimInterface(0); }

                var ins = new List<byte>(); var outs = new List<byte>();
                foreach (var cfg in dev.Configs)
                    foreach (var iface in cfg.InterfaceInfoList)
                        foreach (var ep in iface.EndpointInfoList)
                        {
                            byte addr = ep.Descriptor.EndpointID;
                            if ((addr & 0x80) != 0) ins.Add(addr); else outs.Add(addr);
                        }
                if (ins.Count == 0) continue;

                string[] modos = { "ack_ri", "ri_direto", "so_ler" };
                foreach (byte epOut in (outs.Count > 0 ? outs : new List<byte> { 0 }))
                    foreach (byte epIn in ins)
                        foreach (var modo in modos)
                        {
                            if (TentarEstrategia(dev, epOut, epIn, modo) is not null)
                            {
                                Estrategia = $"OUT=0x{epOut:X2} IN=0x{epIn:X2} {modo}";
                                _onLog?.Invoke("conectado: " + Estrategia);
                                LerAoVivo(dev, epOut, epIn, modo);
                                return true;
                            }
                        }
            }
            finally
            {
                try { if (dev.IsOpen) { if (dev is IUsbDevice w) w.ReleaseInterface(0); dev.Close(); } } catch { }
            }
        }
        return false;
    }

    private T3000Sample? TentarEstrategia(UsbDevice dev, byte epOut, byte epIn, string modo)
    {
        try
        {
            var reader = dev.OpenEndpointReader((ReadEndpointID)epIn);
            UsbEndpointWriter? writer = epOut != 0 ? dev.OpenEndpointWriter((WriteEndpointID)epOut) : null;

            if (modo == "ack_ri" && writer is not null)
            {
                if (writer.Write(T3000RiBlockParser.AckBytes, 1500, out _) != ErrorCode.None) return null;
                var ack = new byte[64];
                if (reader.Read(ack, 1500, out int an) != ErrorCode.None) return null;
                if (!T3000RiBlockParser.IsAckOk(ack.AsSpan(0, Math.Max(2, an)))) return null;
            }
            if ((modo == "ack_ri" || modo == "ri_direto") && writer is not null)
                if (writer.Write(T3000RiBlockParser.RiBytes, 1000, out _) != ErrorCode.None) return null;

            var (bloco, total) = Acumular(reader);
            if (total < 92) return null;
            var s = T3000RiBlockParser.Parse(bloco.AsSpan(0, total));
            if (!T3000RiBlockParser.EhLeituraPlausivel(s)) return null;
            return s;
        }
        catch { return null; }
    }

    // Frames seguidos sem dado válido antes de considerar a central caída e
    // voltar a (re)enumerar. ~15 × (até ~320 ms) ≈ alguns segundos de tolerância
    // a ruído antes de reconectar — rápido o bastante pro piloto, sem flapping.
    private const int MaxFalhasSeguidas = 15;

    private void LerAoVivo(UsbDevice dev, byte epOut, byte epIn, string modo)
    {
        var reader = dev.OpenEndpointReader((ReadEndpointID)epIn);
        UsbEndpointWriter? writer = epOut != 0 ? dev.OpenEndpointWriter((WriteEndpointID)epOut) : null;
        int falhasSeguidas = 0;

        while (_running)
        {
            if ((modo == "ack_ri" || modo == "ri_direto") && writer is not null)
            {
                if (writer.Write(T3000RiBlockParser.RiBytes, 1000, out _) != ErrorCode.None)
                {
                    // Escrita falhou: cabo/porta caiu. Conta como falha e segue;
                    // se persistir, o limite abaixo força a reconexão.
                    if (++falhasSeguidas >= MaxFalhasSeguidas) break;
                    Thread.Sleep(50);
                    continue;
                }
            }

            var (bloco, total) = Acumular(reader);
            if (total >= 92)
            {
                var s = T3000RiBlockParser.Parse(bloco.AsSpan(0, total));
                if (s is not null)
                {
                    falhasSeguidas = 0;            // leitura boa — zera o contador
                    SystemHealth.RegistrarFrame(s, bloco, total);  // evidência p/ diagnóstico (throttle interno)
                    try { _onSample(s); } catch { }
                }
                else if (++falhasSeguidas >= MaxFalhasSeguidas) break;
            }
            else if (++falhasSeguidas >= MaxFalhasSeguidas)
            {
                break;                            // central sumiu — sai pra re-enumerar
            }
            Thread.Sleep(20);   // ~ até 50 Hz; rápido e estável
        }

        if (_running)
            _onLog?.Invoke("central parou de responder — reprocurando");
    }

    private static (byte[] buf, int total) Acumular(UsbEndpointReader reader)
    {
        var buf = new byte[1024]; var merged = new byte[1024];
        int total = 0; var t0 = Environment.TickCount;
        while (Environment.TickCount - t0 < 300 && total < 460)
        {
            var ec = reader.Read(buf, 250, out int n);
            if (ec != ErrorCode.None || n <= 0) break;
            Array.Copy(buf, 0, merged, total, Math.Min(n, merged.Length - total));
            total += n;
        }
        return (merged, total);
    }

    private static string SafeName(UsbRegistry reg)
    {
        try { return reg.FullName ?? reg.Name ?? ""; } catch { return ""; }
    }
}

/// <summary>Envio pra nuvem (Supabase broadcast) + salvamento local. Best-effort.</summary>
internal static class LiveSink
{
    private const string Url = "https://fvhwltzhytpnhlqbttmd.supabase.co";
    private const string Anon = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2aHdsdHpoeXRwbmhscWJ0dG1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MTExNDAsImV4cCI6MjA5MzM4NzE0MH0._ZpxksUnuVFhLzCB5x7bBiZ_VLQQR5cH4A1T-0-mvrA";
    private static readonly HttpClient http = new() { Timeout = TimeSpan.FromSeconds(4) };
    private static readonly string arquivo = $"p1-t4000-{DateTime.Now:yyyyMMdd}.jsonl";
    private static long ultimoNuvem = 0;

    // Detecta wifi/nuvem caindo e voltando (histerese) pra avisar na saúde.
    private static readonly ConnectivityTracker conectividade = new(limiteFalhas: 3);
    private static readonly object travaConn = new();

    private static void RegistrarNuvem(bool ok)
    {
        SystemHealth.NuvemResultado(ok);
        ConnTransicao transicao;
        lock (travaConn) transicao = conectividade.Registrar(ok);
        if (transicao == ConnTransicao.Caiu)
            SystemHealth.Log("nuvem caiu (wifi do celular?) — seguindo, religa sozinha");
        else if (transicao == ConnTransicao.Voltou)
            SystemHealth.Log("nuvem voltou — transmitindo de novo");
    }

    public static void Publicar(T3000Sample s)
    {
        long agora = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        if (agora - ultimoNuvem < 100) return;   // ~10 Hz pra nuvem
        ultimoNuvem = agora;
        try
        {
            // Payload canônico completo (mesmos campos do web/cockpit/cloud-bridge.js)
            // pra o app P1 Fast renderizar todos os sensores, não só alguns.
            var payload = T3000CloudPayload.Build(s, agora);
            var body = new { messages = new[] { new { topic = "cockpit-bubi-live", @event = "sample", payload } } };
            var req = new HttpRequestMessage(HttpMethod.Post, $"{Url}/realtime/v1/api/broadcast")
            {
                Content = new StringContent(JsonSerializer.Serialize(body), System.Text.Encoding.UTF8, "application/json"),
            };
            req.Headers.TryAddWithoutValidation("apikey", Anon);
            req.Headers.TryAddWithoutValidation("Authorization", "Bearer " + Anon);
            _ = http.SendAsync(req).ContinueWith(t =>
            {
                if (t.Status == TaskStatus.RanToCompletion)
                {
                    SystemHealth.NuvemHttp((int)t.Result.StatusCode);
                    RegistrarNuvem(t.Result.IsSuccessStatusCode);
                    t.Result.Dispose();
                }
                else { SystemHealth.NuvemHttp(-1); RegistrarNuvem(false); _ = t.Exception; }
            }, TaskContinuationOptions.ExecuteSynchronously);
        }
        catch { SystemHealth.NuvemHttp(-1); RegistrarNuvem(false); }
    }

    public static void Salvar(T3000Sample s)
    {
        try
        {
            var o = new
            {
                ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                rpm = s.Rpm, waterTempC = s.WaterTempC, lambda = s.Lambda, tpsPct = s.TpsPct,
                batteryV = s.BatteryV, speedKmh = s.SpeedKmh, alarme = s.Alarmes.QualquerAtivo,
            };
            File.AppendAllText(arquivo, JsonSerializer.Serialize(o) + "\n");
            SystemHealth.SalvoResultado(true);
        }
        catch { SystemHealth.SalvoResultado(false); }
    }
}
