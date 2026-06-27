// p1fast-upload — sobe a gravação COMPLETA de uma sessão (.jsonl do --live) pro
// destino durável na nuvem, pro app na nuvem ter TODAS as voltas (não só o ao-vivo).
// É a "Parte B (produtor)" do docs/PLANO_ENVIO_DADOS_NUVEM.md, feita como ferramenta
// SEPARADA (fora do .exe/tela do piloto) — roda DEPOIS da sessão.
//
// Destino: tabela public.sessao_dumps (migração 0048), no formato que ela já define:
//   parte 0      = metadados da sessão (sessao_meta)
//   parte 1..N   = blocos de amostras (amostras = array das linhas cruas do .jsonl)
// Hoje a sessao_dumps aceita INSERT anon (é a "caixa de resgate"). O iMac decide o
// destino DEFINITIVO (promover a permanente ou nova tabela); aí re-aponto o uploader.
//
//   uso: p1fast-upload [<sessao.jsonl>] [--sessao-id=ID] [--limit=N] [--dry-run]
//   sem args: pega a gravação .jsonl mais recente em ~/p1fast-sessoes.

using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

const string URL = "https://fvhwltzhytpnhlqbttmd.supabase.co";
const int CHUNK = 500;   // amostras por linha 'parte'

string? Arg(string k) => args.FirstOrDefault(a => a.StartsWith(k))?.Split('=', 2).ElementAtOrDefault(1);
bool dryRun = args.Contains("--dry-run");
int limite = int.TryParse(Arg("--limit"), out var l) ? l : int.MaxValue;

var anon = Environment.GetEnvironmentVariable("P1FAST_SUPABASE_ANON");
if (string.IsNullOrWhiteSpace(anon)) { Console.Error.WriteLine("Falta a chave P1FAST_SUPABASE_ANON."); return 1; }

var sessoesDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "p1fast-sessoes");
string sessPath = args.FirstOrDefault(a => !a.StartsWith("--"))
    ?? new DirectoryInfo(sessoesDir).GetFiles("*.jsonl").OrderByDescending(f => f.LastWriteTime).First().FullName;

// ── Lê as linhas cruas do .jsonl (cada linha já é JSON válido = uma amostra) ─
var linhas = new List<string>();
int nGps = 0, nMotor = 0; long? tIni = null, tFim = null;
foreach (var line in File.ReadLines(sessPath))
{
    if (string.IsNullOrWhiteSpace(line)) continue;
    if (linhas.Count >= limite) break;
    linhas.Add(line);
    if (line.Contains("\"Tipo\":\"gps\"")) nGps++;
    else if (line.Contains("\"Tipo\":\"motor\"")) nMotor++;
    var i = line.IndexOf("\"TWall\":", StringComparison.Ordinal);
    if (i >= 0 && long.TryParse(new string(line.Skip(i + 8).TakeWhile(c => char.IsDigit(c)).ToArray()), out var tw))
    { tIni ??= tw; tFim = tw; }
}
var sessaoId = Arg("--sessao-id") ?? Path.GetFileNameWithoutExtension(sessPath);
int nPartes = (linhas.Count + CHUNK - 1) / CHUNK;
int total = nPartes + 1; // +1 do meta (parte 0)

Console.WriteLine($"== p1fast-upload ==\n sessão: {sessPath}\n sessao_id: {sessaoId}");
Console.WriteLine($" amostras: {linhas.Count} (gps={nGps} motor={nMotor})  →  {nPartes} blocos de {CHUNK} + 1 meta");
if (dryRun) { Console.WriteLine(" [--dry-run] não envia nada."); return 0; }

var http = new HttpClient { BaseAddress = new Uri(URL) };
http.DefaultRequestHeaders.Add("apikey", anon);
http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", anon);

string envio = Guid.NewGuid().ToString("N")[..12];

async Task<bool> PostRowAsync(object row)
{
    var body = JsonSerializer.Serialize(new[] { row });
    var req = new HttpRequestMessage(HttpMethod.Post, "/rest/v1/sessao_dumps")
    { Content = new StringContent(body, Encoding.UTF8, "application/json") };
    req.Headers.Add("Prefer", "return=minimal");
    var resp = await http.SendAsync(req);
    if (!resp.IsSuccessStatusCode)
        Console.Error.WriteLine($"  ERRO {(int)resp.StatusCode}: {await resp.Content.ReadAsStringAsync()}");
    return resp.IsSuccessStatusCode;
}

// parte 0 — metadados
var meta = new Dictionary<string, object?>
{
    ["sessao_id_origem"] = sessaoId, ["origem_arquivo"] = Path.GetFileName(sessPath),
    ["n_amostras"] = linhas.Count, ["n_gps"] = nGps, ["n_motor"] = nMotor,
    ["t_ini_wall"] = tIni, ["t_fim_wall"] = tFim, ["enviado_por"] = "p1fast-upload",
};
bool ok = await PostRowAsync(new Dictionary<string, object?>
{ ["envio"] = envio, ["origem"] = "p1fast-upload", ["sessao_id"] = sessaoId, ["parte"] = 0, ["total"] = total, ["sessao_meta"] = meta });
Console.WriteLine($"  parte 0 (meta): {(ok ? "ok" : "FALHOU")}");

// parte 1..N — blocos de amostras (JSON cru, sem reserializar — fidelidade total)
int enviados = ok ? 1 : 0;
for (int p = 0; p < nPartes; p++)
{
    var bloco = linhas.Skip(p * CHUNK).Take(CHUNK);
    var amostrasJson = "[" + string.Join(",", bloco) + "]";
    using var amostrasDoc = JsonDocument.Parse(amostrasJson);
    var row = new Dictionary<string, object?>
    { ["envio"] = envio, ["origem"] = "p1fast-upload", ["sessao_id"] = sessaoId, ["parte"] = p + 1, ["total"] = total, ["amostras"] = amostrasDoc.RootElement.Clone() };
    if (await PostRowAsync(row)) enviados++;
    Console.Write($"\r  partes enviadas: {enviados}/{total}");
}
Console.WriteLine();

// Verifica: conta as partes que chegaram pra este sessao_id+envio
var verResp = await http.GetAsync($"/rest/v1/sessao_dumps?envio=eq.{envio}&select=parte");
var verBody = await verResp.Content.ReadAsStringAsync();
int chegaram = verResp.IsSuccessStatusCode ? JsonDocument.Parse(verBody).RootElement.GetArrayLength() : -1;
Console.WriteLine($"Resultado: {enviados}/{total} enviadas; {chegaram} confirmadas na nuvem (envio={envio}).");
return enviados == total && chegaram == total ? 0 : 2;
