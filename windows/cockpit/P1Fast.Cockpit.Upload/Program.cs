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
using P1Fast.Cockpit.Domain;

const string URL = "https://fvhwltzhytpnhlqbttmd.supabase.co";
const int CHUNK = 500;   // amostras por linha 'parte'

string? Arg(string k) => args.FirstOrDefault(a => a.StartsWith(k))?.Split('=', 2).ElementAtOrDefault(1);
bool dryRun = args.Contains("--dry-run");
int limite = int.TryParse(Arg("--limit"), out var l) ? l : int.MaxValue;

// Identidade canônica (UUIDs conferidos no banco/seed pelo iMac, 2026-06-27).
// Carimbados no sessao_meta porque a sessao_dumps ainda não tem colunas próprias;
// viram colunas quando a casa durável definitiva for criada. Overrideáveis por arg.
string carroId = Arg("--carro-id") ?? "641a81e7-3192-4e68-8183-b8401f105574"; // Bubi
string trackId = Arg("--track-id") ?? "e8335412-3312-54fe-b634-db2d02c7fa81"; // Brasília
string timeId  = Arg("--time-id")  ?? "00000000-0000-4000-9000-000000000001";

var anon = Environment.GetEnvironmentVariable("P1FAST_SUPABASE_ANON");
if (string.IsNullOrWhiteSpace(anon)) { Console.Error.WriteLine("Falta a chave P1FAST_SUPABASE_ANON."); return 1; }

var sessoesDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "p1fast-sessoes");
string sessPath = args.FirstOrDefault(a => !a.StartsWith("--"))
    ?? new DirectoryInfo(sessoesDir).GetFiles("*.jsonl").OrderByDescending(f => f.LastWriteTime).First().FullName;

// ── Lê as amostras cruas (cada item = JSON de uma amostra) dos DOIS formatos:
//    .jsonl (gravação do --live) OU .json (volta de replay, SessaoReplay) ─
var linhas = new List<string>();
int nGps = 0, nMotor = 0; long? tIni = null, tFim = null;
if (sessPath.EndsWith(".json", StringComparison.OrdinalIgnoreCase) && !sessPath.EndsWith(".jsonl", StringComparison.OrdinalIgnoreCase))
{
    // Replay (.json): reconstrói as linhas no MESMO shape do .jsonl pra nuvem.
    var sess = P1Fast.Cockpit.Domain.SessaoReplay.Carregar(File.ReadAllText(sessPath));
    int seq = 0;
    foreach (var e in sess.Eventos)
    {
        if (linhas.Count >= limite) break;
        long tw = (long)e.TWallMs; seq++;
        object linha = e.Gps is { } g
            ? new { Seq = seq, Tipo = "gps", TWall = tw, Dados = new { lat = g.Lat, lon = g.Lng, kmh = g.Kmh } }
            : (object)new { Seq = seq, Tipo = "motor", TWall = tw, Dados = new { rpm = e.Rpm } };
        if (e.Gps is not null) nGps++; else nMotor++;
        tIni ??= tw; tFim = tw;
        linhas.Add(JsonSerializer.Serialize(linha));
    }
}
else
{
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

// INSERT idempotente (contrato da casa permanente, mig 0050 — trava UNIQUE(sessao_id,
// parte), iMac 2026-06-30): on_conflict + resolution=ignore-duplicates → parte que já
// existe vira 201 no-op em vez de 409. É o que deixa a fila resiliente reenviar à vontade
// quando a internet da pista volta, sem dobrar nem quebrar.
async Task<bool> PostRowAsync(object row)
{
    var body = JsonSerializer.Serialize(new[] { row });
    var req = new HttpRequestMessage(HttpMethod.Post, "/rest/v1/sessao_dumps?on_conflict=sessao_id,parte")
    { Content = new StringContent(body, Encoding.UTF8, "application/json") };
    req.Headers.Add("Prefer", "return=minimal,resolution=ignore-duplicates");
    var resp = await http.SendAsync(req);
    if (!resp.IsSuccessStatusCode)
        Console.Error.WriteLine($"  ERRO {(int)resp.StatusCode}: {await resp.Content.ReadAsStringAsync()}");
    return resp.IsSuccessStatusCode;
}

// Quais PARTES já chegaram pra esta sessão, PAGINANDO (PostgREST devolve no máx. 1000
// linhas por página; sem paginar, uma sessão com >1000 partes travava a verificação e
// nunca fechava). Lê em páginas de 1000 por limit/offset até vir uma página incompleta.
// LANÇA em falha de rede — quem chama decide (retomar/tratar como vazio), sem crash sujo.
async Task<HashSet<int>> PartesPresentesAsync(string sid)
{
    var todas = new HashSet<int>();
    const int pagina = 1000;
    for (int offset = 0; ; offset += pagina)
    {
        var resp = await http.GetAsync(
            $"/rest/v1/sessao_dumps?sessao_id=eq.{Uri.EscapeDataString(sid)}&select=parte&limit={pagina}&offset={offset}");
        if (!resp.IsSuccessStatusCode)
            throw new HttpRequestException($"consulta de partes falhou: {(int)resp.StatusCode}");
        int n = 0;
        foreach (var r in JsonDocument.Parse(await resp.Content.ReadAsStringAsync()).RootElement.EnumerateArray())
        { todas.Add(r.GetProperty("parte").GetInt32()); n++; }
        if (n < pagina) break;   // última página (veio menos que o limite)
    }
    return todas;
}

// RELÓGIO COMUM (pedido do iMac 2026-06-30, pro vídeo Osmo depois): carimba o started_at
// da CAPTURA no MESMO relógio dos timestamps por amostra (TWall, epoch ms). Vem do
// InicioWall do meta lateral (<sessão>.meta.json); cai pro 1º TWall se o meta faltar. É o
// que deixa cruzar vídeo × volta por offset desde o início — hoje inexistente no caminho
// do notebook (relatório plano-motor-gravacao-windows-2026-06-21).
long? startedAt = tIni;
try
{
    var metaLateral = Path.Combine(Path.GetDirectoryName(sessPath) ?? ".", Path.GetFileNameWithoutExtension(sessPath) + ".meta.json");
    if (File.Exists(metaLateral))
    {
        using var md = JsonDocument.Parse(File.ReadAllText(metaLateral));
        if (md.RootElement.TryGetProperty("InicioWall", out var iw) && iw.ValueKind == JsonValueKind.Number)
            startedAt = iw.GetInt64();
    }
}
catch { /* sem meta lateral: started_at = 1º TWall (já no relógio comum) */ }

// Monta a linha de uma PARTE: parte 0 = meta, 1..nPartes = blocos de amostras (JSON cru,
// sem reserializar — fidelidade total). 'envio' é só proveniência (a unicidade no destino
// é UNIQUE(sessao_id, parte), mig 0050); reenviar a mesma parte é no-op idempotente.
object MontarParte(int parte, string envioAlvo)
{
    if (parte == 0)
    {
        var meta = new Dictionary<string, object?>
        {
            ["sessao_id_origem"] = sessaoId, ["origem_arquivo"] = Path.GetFileName(sessPath),
            ["carro_id"] = carroId, ["track_id"] = trackId, ["time_id"] = timeId,
            ["n_amostras"] = linhas.Count, ["n_gps"] = nGps, ["n_motor"] = nMotor,
            ["started_at"] = startedAt,            // relógio comum (mesmo de TWall) — âncora do vídeo
            ["t_ini_wall"] = tIni, ["t_fim_wall"] = tFim, ["enviado_por"] = "p1fast-upload",
        };
        return new Dictionary<string, object?>
        { ["envio"] = envioAlvo, ["origem"] = "p1fast-upload", ["sessao_id"] = sessaoId, ["parte"] = 0, ["total"] = total, ["sessao_meta"] = meta };
    }
    var bloco = linhas.Skip((parte - 1) * CHUNK).Take(CHUNK);
    using var amostrasDoc = JsonDocument.Parse("[" + string.Join(",", bloco) + "]");
    return new Dictionary<string, object?>
    { ["envio"] = envioAlvo, ["origem"] = "p1fast-upload", ["sessao_id"] = sessaoId, ["parte"] = parte, ["total"] = total, ["amostras"] = amostrasDoc.RootElement.Clone() };
}

// RETOMADA SEM DUPLICAR (Fase 4): pergunta ao destino quais PARTES já chegaram pra esta
// sessão e deixa o PlanejadorUpload (puro, provado) decidir — completa → pula; faltando →
// envia só as faltantes. A unicidade é UNIQUE(sessao_id, parte) (mig 0050), então 'envio'
// não conta; reenviar é no-op idempotente (header em PostRowAsync). --forcar sobe tudo de
// novo de propósito (idempotente também). Consulta best-effort: sem rede, trata como vazio.
IEnumerable<int> presentes = Array.Empty<int>();
if (!args.Contains("--forcar"))
{
    try { presentes = await PartesPresentesAsync(sessaoId); }
    catch { /* sem rede: trata como destino vazio → sobe tudo */ }
}
var plano = PlanejadorUpload.Planejar(total, presentes);

// Marcador de disco: prova local "esta sessão está 100% na nuvem", escrito SÓ quando
// confirmada. É o que a fila resiliente do .exe lê pra saber o que ainda falta subir —
// sem depender de rede a cada boot. Best-effort (falha de IO não derruba o upload).
void MarcarSubida(string envioOk)
{
    try { File.WriteAllText(sessPath + ".uploaded", $"{{\"sessao_id\":\"{sessaoId}\",\"envio\":\"{envioOk}\",\"total\":{total}}}"); }
    catch { /* best-effort */ }
}

if (plano.Acao == AcaoUpload.Completa)
{
    MarcarSubida("(já-completa)");
    Console.WriteLine($"Resultado: já COMPLETA na nuvem ({total}/{total}) — nada a enviar (idempotente).");
    return 0;
}

string envio = Guid.NewGuid().ToString("N")[..8];
var faltantes = plano.PartesFaltantes;
if (faltantes.Count < total)
    Console.WriteLine($"  RETOMANDO: faltam {faltantes.Count} de {total} partes (reenvio idempotente, sem duplicar).");

int enviados = 0;
foreach (var parte in faltantes)
{
    if (await PostRowAsync(MontarParte(parte, envio))) enviados++;
    Console.Write($"\r  partes enviadas nesta rodada: {enviados}/{faltantes.Count}");
}
Console.WriteLine();

// Verifica pela VERDADE do destino: conta as partes DISTINTAS desta SESSÃO (sem filtrar
// por envio — a unicidade é UNIQUE(sessao_id, parte), mig 0050; reenvio idempotente mantém
// a parte sob o envio que a gravou primeiro). Sucesso = as 'total' partes presentes.
// Em try/catch: internet caindo NA verificação não pode virar crash sujo — trata como
// INCOMPLETA (a fila resiliente retoma na próxima rodada/boot, idempotente).
int chegaram = -1;
try { chegaram = (await PartesPresentesAsync(sessaoId)).Count; }
catch { /* rede caiu na verificação: incompleta, retoma depois (sem crash) */ }
bool completou = chegaram == total;
if (completou) MarcarSubida(envio);
Console.WriteLine($"Resultado: {enviados}/{faltantes.Count} enviadas nesta rodada; {chegaram}/{total} confirmadas na nuvem (envio={envio}). {(completou ? "COMPLETA." : "INCOMPLETA — retoma na próxima.")}");
return completou ? 0 : 2;
