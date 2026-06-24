// Program.cs — Leitor AUTO-CORRETIVO da Injepro T3000/T4000 via USB.
//
// Filosofia (pedido do Flávio): a ferramenta tenta SOZINHA varias formas de
// conectar, mostra o andamento NA TELA, aprende qual funciona, trava nela e
// fica lendo ao vivo — sem o usuario mexer em config. Se nada funcionar, diz
// em portugues claro o proximo passo (provavelmente trocar o driver no Zadig).
//
// Estrategias tentadas, em ordem, pra CADA par de endpoints bulk (OUT,IN):
//   1) ACK->OK->RI   (handshake documentado)
//   2) RI direto     (sem ACK; algumas versoes ja respondem)
//   3) so ler        (firmware que faz streaming sem pedir)
// Para cada combinacao mede quantos bytes vieram e se o parser entende
// (RPM/agua coerentes). A primeira que "entende" vence.

using System.Text.Json;
using LibUsbDotNet;
using LibUsbDotNet.Main;
using P1Fast.Cockpit.Domain;

Console.OutputEncoding = System.Text.Encoding.UTF8;
Banner();
Espelho.Inicializar();   // pede 1x o token e abre o canal pro Claude acompanhar online

while (true)
{
    try
    {
        if (!TentarUmaRodada())
        {
            Console.WriteLine();
            Console.WriteLine("Nenhuma estrategia funcionou nesta rodada. Tentando de novo em 3s…");
            Console.WriteLine("(Se isto se repetir muitas vezes, quase sempre e DRIVER:");
            Console.WriteLine(" a central precisa estar no driver WinUSB — eu te passo o Zadig.)");
            Thread.Sleep(3000);
        }
    }
    catch (Exception e)
    {
        Console.WriteLine($"  erro inesperado: {e.Message} — tentando de novo em 3s");
        Thread.Sleep(3000);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Uma rodada completa: enumera, escolhe a central, tenta as estrategias.
// Retorna true se conseguiu ler (entao ja ficou no loop ao vivo).
static bool TentarUmaRodada()
{
    var all = UsbDevice.AllDevices;
    Console.WriteLine($"\n[{Agora()}] Dispositivos USB visiveis ao WinUSB: {all.Count}");
    if (all.Count == 0)
    {
        Console.WriteLine("  → Nenhum dispositivo no driver WinUSB.");
        Console.WriteLine("  → MUITO provavelmente a central esta no driver da Injepro.");
        Console.WriteLine("    Solucao (1 minuto, uma vez): Zadig → trocar o driver da Injepro pra WinUSB.");
        return false;
    }

    // lista e escolhe candidatos (Injepro pelo nome, senao todos)
    var candidatos = new List<UsbRegistry>();
    foreach (UsbRegistry reg in all)
    {
        string nome = SafeName(reg);
        Console.WriteLine($"  • VID:{reg.Vid:X4} PID:{reg.Pid:X4}  {nome}");
        if (nome.Contains("injepro", StringComparison.OrdinalIgnoreCase)) candidatos.Insert(0, reg);
        else candidatos.Add(reg);
    }

    foreach (var reg in candidatos)
    {
        Console.WriteLine($"\n→ Tentando VID:{reg.Vid:X4} PID:{reg.Pid:X4} ({SafeName(reg)})…");
        if (!reg.Open(out UsbDevice dev) || dev is null)
        {
            Console.WriteLine("  (nao abriu — ocupado ou sem permissao; pulo)");
            continue;
        }
        try
        {
            if (dev is IUsbDevice whole) { whole.SetConfiguration(1); whole.ClaimInterface(0); }

            var ins = new List<byte>();
            var outs = new List<byte>();
            foreach (var cfg in dev.Configs)
                foreach (var iface in cfg.InterfaceInfoList)
                    foreach (var ep in iface.EndpointInfoList)
                    {
                        byte addr = ep.Descriptor.EndpointID;
                        if ((addr & 0x80) != 0) ins.Add(addr); else outs.Add(addr);
                    }
            Console.WriteLine($"  endpoints: IN=[{Hexs(ins)}]  OUT=[{Hexs(outs)}]");
            if (ins.Count == 0)
            {
                Console.WriteLine("  (sem endpoint de leitura — nao e o canal de dados)");
                continue;
            }

            // tenta cada combinacao OUT x IN x modo
            string[] modos = { "ack_ri", "ri_direto", "so_ler" };
            foreach (byte epOut in (outs.Count > 0 ? outs : new List<byte> { 0 }))
                foreach (byte epIn in ins)
                    foreach (var modo in modos)
                    {
                        Console.Write($"  estrategia: OUT=0x{epOut:X2} IN=0x{epIn:X2} modo={modo,-9} … ");
                        var sample = TentarEstrategia(dev, epOut, epIn, modo, out string detalhe);
                        if (sample is not null)
                        {
                            Console.WriteLine($"✓ FUNCIONOU! ({detalhe})");
                            Console.WriteLine($"\n  >>> Travado nesta estrategia. Lendo ao vivo (Ctrl+C pra sair) <<<\n");
                            LerAoVivo(dev, epOut, epIn, modo);
                            return true;
                        }
                        Console.WriteLine($"x ({detalhe})");
                    }
        }
        finally
        {
            try { if (dev.IsOpen) { if (dev is IUsbDevice w) w.ReleaseInterface(0); dev.Close(); } } catch { }
        }
    }
    return false;
}

// Tenta UMA estrategia uma vez; retorna a amostra se o parser entendeu.
static T3000Sample? TentarEstrategia(UsbDevice dev, byte epOut, byte epIn, string modo, out string detalhe)
{
    detalhe = "";
    try
    {
        var reader = dev.OpenEndpointReader((ReadEndpointID)epIn);
        UsbEndpointWriter? writer = epOut != 0 ? dev.OpenEndpointWriter((WriteEndpointID)epOut) : null;

        if (modo is "ack_ri" && writer is not null)
        {
            if (writer.Write(T3000RiBlockParser.AckBytes, 1500, out _) != ErrorCode.None) { detalhe = "sem enviar ACK"; return null; }
            var ack = new byte[64];
            if (reader.Read(ack, 1500, out int an) != ErrorCode.None) { detalhe = "sem resposta ao ACK"; return null; }
            if (!T3000RiBlockParser.IsAckOk(ack.AsSpan(0, Math.Max(2, an)))) { detalhe = $"OK errado: {Hex(ack, an)}"; return null; }
        }
        if (modo is "ack_ri" or "ri_direto" && writer is not null)
        {
            if (writer.Write(T3000RiBlockParser.RiBytes, 1000, out _) != ErrorCode.None) { detalhe = "sem enviar RI"; return null; }
        }

        var (bloco, total) = AcumularBloco(reader);
        detalhe = $"{total} bytes";
        if (total < 92) return null;
        var s = T3000RiBlockParser.Parse(bloco.AsSpan(0, total));
        if (s is null) return null;
        // coerencia: rpm plausivel e bateria plausivel evita "lixo que parseia"
        if (s.Rpm < 0 || s.Rpm > 20000) { detalhe += " (rpm absurdo)"; return null; }
        if (s.BatteryV < 3 || s.BatteryV > 20) { detalhe += " (bateria absurda)"; return null; }
        return s;
    }
    catch (Exception e) { detalhe = e.Message; return null; }
}

static (byte[] buf, int total) AcumularBloco(UsbEndpointReader reader)
{
    var buf = new byte[1024];
    var merged = new byte[1024];
    int total = 0; var t0 = Environment.TickCount;
    while (Environment.TickCount - t0 < 300 && total < 460)
    {
        var ec = reader.Read(buf, 250, out int n);
        if (ec == ErrorCode.IoTimedOut) break;
        if (ec != ErrorCode.None || n <= 0) break;
        Array.Copy(buf, 0, merged, total, Math.Min(n, merged.Length - total));
        total += n;
    }
    return (merged, total);
}

static void LerAoVivo(UsbDevice dev, byte epOut, byte epIn, string modo)
{
    var reader = dev.OpenEndpointReader((ReadEndpointID)epIn);
    UsbEndpointWriter? writer = epOut != 0 ? dev.OpenEndpointWriter((WriteEndpointID)epOut) : null;
    int ok = 0;
    while (true)
    {
        if (modo is "ack_ri" or "ri_direto" && writer is not null)
            writer.Write(T3000RiBlockParser.RiBytes, 1000, out _);
        var (bloco, total) = AcumularBloco(reader);
        if (total >= 92)
        {
            var s = T3000RiBlockParser.Parse(bloco.AsSpan(0, total));
            if (s is not null)
            {
                ok++;
                var a = s.Alarmes.QualquerAtivo ? "  ⚠ALARME" : "";
                Console.WriteLine($"[{ok,5}] rpm={s.Rpm,5}  agua={(s.WaterTempC?.ToString() ?? "—")}C  " +
                    $"λ={s.Lambda:F2}  tps={s.TpsPct:F0}%  bat={s.BatteryV:F1}V  vel={s.SpeedKmh:F0}{a}");
                Nuvem.Publicar(s);   // transmite pra nuvem (best-effort; nao atrapalha a leitura)
                Arquivo.Salvar(s);   // salva no notebook pra consulta futura (historico completo)
                Espelho.Registrar(s); // espelha pro GitHub pra o Claude acompanhar/avisar online
            }
        }
        Thread.Sleep(50);
    }
}

// ─── helpers ────────────────────────────────────────────────────────────────
static void Banner()
{
    Console.WriteLine("====================================================================");
    Console.WriteLine("  P1 Fast · Leitor AUTO-CORRETIVO da central Injepro T3000/T4000");
    Console.WriteLine("  Tenta sozinho varias formas de conectar e mostra o progresso aqui.");
    Console.WriteLine("  Deixe a central LIGADA (chave/motor). Ctrl+C pra sair.");
    Console.WriteLine("====================================================================");
}
static string Agora() => $"{DateTime.Now:HH:mm:ss}";
static string SafeName(UsbRegistry reg) { try { return reg.FullName ?? reg.Name ?? "(sem nome)"; } catch { return "(sem nome)"; } }
static string Hexs(System.Collections.Generic.List<byte> xs) => string.Join(",", xs.ConvertAll(x => $"0x{x:X2}"));
static string Hex(byte[] b, int n) => string.Join(" ", b.AsSpan(0, Math.Min(n, 8)).ToArray().Select(x => x.ToString("X2")));

// ─── Envio pra nuvem (Supabase Realtime broadcast via HTTP) ──────────────────
// Publica cada amostra no canal 'cockpit-bubi-live' usando o endpoint HTTP de
// broadcast do Supabase (POST /realtime/v1/api/broadcast). O notebook alcança o
// Supabase normalmente; assim o iPhone/Box que assinam o canal veem ao vivo.
// Best-effort: qualquer falha de rede e ignorada e NUNCA trava a leitura.
static class Nuvem
{
    const string Url  = "https://fvhwltzhytpnhlqbttmd.supabase.co";
    const string Anon = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2aHdsdHpoeXRwbmhscWJ0dG1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MTExNDAsImV4cCI6MjA5MzM4NzE0MH0._ZpxksUnuVFhLzCB5x7bBiZ_VLQQR5cH4A1T-0-mvrA";
    static readonly HttpClient http = new() { Timeout = TimeSpan.FromSeconds(4) };
    static long ultimoMs = 0;
    static bool avisou = false;

    public static void Publicar(T3000Sample s)
    {
        long agora = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        if (agora - ultimoMs < 100) return;   // ~10 Hz
        ultimoMs = agora;
        try
        {
            var payload = new
            {
                rpm = s.Rpm, waterTempC = s.WaterTempC, lambda = s.Lambda, tpsPct = s.TpsPct,
                batteryV = s.BatteryV, speedKmh = s.SpeedKmh, mapBar = s.MapBar,
                pedalAceleradorPct = s.PedalAceleradorPct, pressaoFreioBar = s.PressaoFreioBar,
                source = "t3000-usb-exe", ts = agora,
            };
            var body = new { messages = new[] { new { topic = "cockpit-bubi-live", @event = "sample", payload } } };
            var req = new HttpRequestMessage(HttpMethod.Post, $"{Url}/realtime/v1/api/broadcast")
            {
                Content = new StringContent(JsonSerializer.Serialize(body), System.Text.Encoding.UTF8, "application/json"),
            };
            req.Headers.TryAddWithoutValidation("apikey", Anon);
            req.Headers.TryAddWithoutValidation("Authorization", "Bearer " + Anon);
            _ = http.SendAsync(req).ContinueWith(t =>
            {
                if (!avisou && t.Status == TaskStatus.RanToCompletion)
                {
                    avisou = true;
                    Console.WriteLine("  ↑ transmitindo pra nuvem (canal cockpit-bubi-live) — iPhone/Box podem ver");
                }
            });
        }
        catch { /* envio e best-effort; leitura continua normal */ }
    }
}

// ─── Salvamento local pra consulta futura ────────────────────────────────────
// Grava cada amostra (uma por linha, JSON) num arquivo do dia, na mesma pasta do
// programa. Vira o historico completo do dia de pista, pra consultar depois.
static class Arquivo
{
    static readonly string caminho = $"p1-t4000-{DateTime.Now:yyyyMMdd}.jsonl";
    static bool avisou = false;

    public static void Salvar(T3000Sample s)
    {
        try
        {
            var o = new
            {
                ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                rpm = s.Rpm, waterTempC = s.WaterTempC, lambda = s.Lambda, tpsPct = s.TpsPct,
                batteryV = s.BatteryV, speedKmh = s.SpeedKmh, mapBar = s.MapBar,
                pedalAceleradorPct = s.PedalAceleradorPct, pressaoFreioBar = s.PressaoFreioBar,
                alarme = s.Alarmes.QualquerAtivo,
            };
            File.AppendAllText(caminho, JsonSerializer.Serialize(o) + "\n");
            if (!avisou) { avisou = true; Console.WriteLine($"  💾 salvando historico em {caminho} (mesma pasta do programa)"); }
        }
        catch { /* salvar e best-effort */ }
    }
}

// ─── Espelho pro GitHub (pra o Claude acompanhar ONLINE e avisar) ────────────
// Empurra um retrato rolante (ultimas amostras + status) pra um arquivo no
// repositorio via API do GitHub, usando um token que o usuario gera 1 vez.
// O Claude le esse arquivo e faz o monitoramento/avisos. Best-effort: sem token
// ou com falha de rede, o programa segue lendo/salvando normalmente.
static class Espelho
{
    const string Owner = "flaviomarques1969";
    const string Repo = "p1-fast";
    const string Branch = "claude/t3000-t4000-live-stream-tdrk70";
    const string Path = "live/cockpit-live.json";
    const string TokenFile = "gh-token.txt";

    static string? token;
    static string? sha;
    static long ultimoPush = 0;
    static int total = 0;
    static bool avisou = false;
    static readonly Queue<object> recentes = new();
    static readonly HttpClient http = new() { Timeout = TimeSpan.FromSeconds(10) };

    public static void Inicializar()
    {
        try { if (File.Exists(TokenFile)) token = File.ReadAllText(TokenFile).Trim(); } catch { }
        http.DefaultRequestHeaders.TryAddWithoutValidation("User-Agent", "p1fast-probe");
        http.DefaultRequestHeaders.TryAddWithoutValidation("Accept", "application/vnd.github+json");

        if (string.IsNullOrWhiteSpace(token))
        {
            Console.WriteLine();
            Console.WriteLine("====================================================================");
            Console.WriteLine("  PARA O CLAUDE ACOMPANHAR ONLINE — falta 1 permissao (so 1 vez):");
            Console.WriteLine();
            Console.WriteLine("  1) Abra no navegador (Ctrl+clique ou copie):");
            Console.WriteLine("     https://github.com/settings/tokens/new?description=P1Fast&scopes=public_repo");
            Console.WriteLine("  2) Role ate o fim e clique em 'Generate token'.");
            Console.WriteLine("  3) Copie o token (comeca com ghp_) e cole aqui embaixo + Enter.");
            Console.WriteLine();
            Console.WriteLine("  (So quer ler/salvar e nao quer que o Claude veja? deixe vazio + Enter.)");
            Console.WriteLine("====================================================================");
            Console.Write("  Token: ");
            var t = Console.ReadLine();
            if (!string.IsNullOrWhiteSpace(t))
            {
                token = t.Trim();
                try { File.WriteAllText(TokenFile, token); } catch { }
                Console.WriteLine("  ✓ Token salvo. Vou transmitir pro Claude acompanhar ao vivo.\n");
            }
            else Console.WriteLine("  (sem token — segue lendo/salvando; o Claude nao vera online)\n");
        }
        else Console.WriteLine("  📡 Token ja configurado — transmitindo pro Claude acompanhar.\n");
    }

    public static void Registrar(T3000Sample s)
    {
        if (string.IsNullOrEmpty(token)) return;
        total++;
        recentes.Enqueue(new
        {
            ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
            rpm = s.Rpm, waterTempC = s.WaterTempC, lambda = s.Lambda, tpsPct = s.TpsPct,
            batteryV = s.BatteryV, speedKmh = s.SpeedKmh, alarme = s.Alarmes.QualquerAtivo,
        });
        while (recentes.Count > 40) recentes.Dequeue();

        long agora = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        if (agora - ultimoPush < 3000) return;   // ~1 push a cada 3s
        ultimoPush = agora;
        _ = Push();
    }

    static async Task Push()
    {
        try
        {
            var snap = new { atualizadoEm = DateTimeOffset.UtcNow.ToString("o"), fluindo = true, total, amostras = recentes.ToArray() };
            string content = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(JsonSerializer.Serialize(snap)));
            string url = $"https://api.github.com/repos/{Owner}/{Repo}/contents/{Path}";

            if (sha is null)
            {
                using var g = Req(HttpMethod.Get, $"{url}?ref={Branch}");
                var gr = await http.SendAsync(g);
                if (gr.IsSuccessStatusCode)
                    sha = JsonDocument.Parse(await gr.Content.ReadAsStringAsync()).RootElement.GetProperty("sha").GetString();
            }

            var body = new Dictionary<string, object> { ["message"] = "live cockpit snapshot", ["content"] = content, ["branch"] = Branch };
            if (sha is not null) body["sha"] = sha;
            using var p = Req(HttpMethod.Put, url);
            p.Content = new StringContent(JsonSerializer.Serialize(body), System.Text.Encoding.UTF8, "application/json");
            var pr = await http.SendAsync(p);
            if (pr.IsSuccessStatusCode)
            {
                sha = JsonDocument.Parse(await pr.Content.ReadAsStringAsync()).RootElement.GetProperty("content").GetProperty("sha").GetString();
                if (!avisou) { avisou = true; Console.WriteLine("  📡 Claude recebendo ao vivo (live/cockpit-live.json no GitHub)"); }
            }
            else if ((int)pr.StatusCode is 401 or 403)
            {
                Console.WriteLine($"  (token recusado: HTTP {(int)pr.StatusCode}. Gere outro e apague o arquivo gh-token.txt)");
                token = null;
            }
            else { sha = null; }   // re-busca o sha na proxima
        }
        catch { /* best-effort */ }
    }

    static HttpRequestMessage Req(HttpMethod m, string url)
    {
        var r = new HttpRequestMessage(m, url);
        r.Headers.TryAddWithoutValidation("Authorization", "token " + token);
        r.Headers.TryAddWithoutValidation("User-Agent", "p1fast-probe");
        r.Headers.TryAddWithoutValidation("Accept", "application/vnd.github+json");
        return r;
    }
}
