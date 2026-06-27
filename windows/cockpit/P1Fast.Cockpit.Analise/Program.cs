// p1fast-vmin — relatório por sessão: Vmin GEORREFERENCIADO por trecho, com o ponto
// de freada e as velocidades de entrada/saída. Lê a gravação do --live (.jsonl, a
// fonte da verdade gravada no notebook) OU uma volta de replay (.json) e os trechos
// da pista; escreve um CSV ao lado da sessão. Ferramenta de ANÁLISE pós-sessão —
// roda fora do cockpit, NÃO toca a tela do piloto nem o caminho ao vivo.
//
//   uso: p1fast-vmin [<sessao.jsonl|.json>] [<barras-da-pista.json>]
//   sem args: pega a gravação .jsonl mais recente em ~/p1fast-sessoes e os trechos
//             de Brasília aprovados (_design-reference/BARRAS-BRASILIA-...json).

using System.Globalization;
using System.Text;
using System.Text.Json;
using P1Fast.Cockpit.Domain;

var ci = CultureInfo.InvariantCulture;

static string RepoRoot()
{
    var d = new DirectoryInfo(AppContext.BaseDirectory);
    while (d is not null)
    {
        if (Directory.Exists(Path.Combine(d.FullName, "_design-reference"))) return d.FullName;
        d = d.Parent;
    }
    return AppContext.BaseDirectory;
}

var sessoesDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "p1fast-sessoes");
string sessPath = args.Length > 0
    ? args[0]
    : new DirectoryInfo(sessoesDir).GetFiles("*.jsonl").OrderByDescending(f => f.LastWriteTime).First().FullName;
string segPath = args.Length > 1
    ? args[1]
    : Path.Combine(RepoRoot(), "_design-reference", "BARRAS-BRASILIA-FLAVIO-APROVADO-2026-05-27.json");

Console.WriteLine($"== Vmin por trecho ==\n sessão: {sessPath}\n trechos: {segPath}\n");
var segs = SessaoReplay.CarregarSegmentos(File.ReadAllText(segPath));
var nome = segs.ToDictionary(s => s.Id, s => s.Nome);

// ── GPS dos dois formatos → AmostraGps(lat,lng,kmh,t) ───────────
List<AmostraGps> gps;
if (sessPath.EndsWith(".jsonl", StringComparison.OrdinalIgnoreCase))
{
    gps = new();
    foreach (var line in File.ReadLines(sessPath))
    {
        if (string.IsNullOrWhiteSpace(line)) continue;
        using var doc = JsonDocument.Parse(line);
        var r = doc.RootElement;
        if (!r.TryGetProperty("Tipo", out var tp) || tp.GetString() != "gps") continue;
        var d = r.GetProperty("Dados");
        double lat = d.GetProperty("lat").GetDouble();
        double lng = d.TryGetProperty("lon", out var lo) ? lo.GetDouble() : d.GetProperty("lng").GetDouble();
        double kmh = d.TryGetProperty("kmh", out var k) ? k.GetDouble() : 0;
        double t = r.GetProperty("TWall").GetDouble();
        gps.Add(new AmostraGps(lat, lng, kmh, t));
    }
}
else
{
    var sess = SessaoReplay.Carregar(File.ReadAllText(sessPath));
    gps = sess.Eventos.Where(e => e.Gps is not null).Select(e => e.Gps!).ToList();
}
gps = gps.OrderBy(g => g.T).ToList();
Console.WriteLine($"GPS: {gps.Count} amostras");
if (gps.Count == 0) { Console.WriteLine("sem GPS — nada a analisar."); return; }
double t0 = gps[0].T;

// ── Detector → eventos por trecho ───────────────────────────────
var eventos = new List<TrechoEvento>();
var det = new TrechoDetector(segs, ev => eventos.Add(ev));
foreach (var g in gps) det.IngestGps(g);

// Vmin REAL: o ponto mais lento DENTRO da passagem (entrada→saída), não a linha do ápice.
(double kmh, double lat, double lng, double t)? Vmin(double a, double b)
{
    AmostraGps? best = null;
    foreach (var g in gps)
        if (g.T >= a && g.T <= b && (best is null || g.Kmh < best.Kmh)) best = g;
    return best is null ? null : (best.Kmh, best.Lat, best.Lng, best.T);
}

var csv = new StringBuilder("passagem,curva,entrada_kmh,freada_m_da_entrada,vmin_kmh,vmin_lat,vmin_lng,vmin_t_s\n");
int n = 0;
for (int i = 0; i < eventos.Count; i++)
{
    if (eventos[i].Type != "entrada-cruzou") continue;
    var ent = eventos[i];
    var sai = eventos.Skip(i + 1).FirstOrDefault(e => e.Type == "saida-cruzou" && e.SegmentId == ent.SegmentId);
    var fre = eventos.Skip(i).FirstOrDefault(e => e.Type == "freada-iniciou" && e.SegmentId == ent.SegmentId);
    if (sai is null) continue;
    n++;
    var nm = nome.GetValueOrDefault(ent.SegmentId, ent.SegmentId);
    var v = Vmin(ent.T, sai.T);
    string fm = fre?.DistFromEntradaM?.ToString("F0", ci) ?? "";
    if (v is { } vv)
    {
        Console.WriteLine($"#{n,2} {nm,-18} entrada {ent.Kmh,5:F0}  freou {fm,3}m  VMIN {vv.kmh,5:F1} km/h @ {vv.lat:F6},{vv.lng:F6}  +{(vv.t - t0) / 1000.0:F1}s");
        csv.Append($"{n},\"{nm.Replace("\"", "\"\"")}\",{ent.Kmh.ToString("F1", ci)},{fm},{vv.kmh.ToString("F1", ci)},{vv.lat.ToString("F6", ci)},{vv.lng.ToString("F6", ci)},{((vv.t - t0) / 1000.0).ToString("F1", ci)}\n");
    }
}

var outCsv = Path.ChangeExtension(sessPath, null) + ".vmin.csv";
File.WriteAllText(outCsv, csv.ToString());
Console.WriteLine($"\n{n} passagens registradas. CSV: {outCsv}");
if (n == 0) Console.WriteLine("(0 trechos: o carro não completou curvas nesta gravação — ex.: sessão parada/bancada, ou pista ≠ trechos.)");
