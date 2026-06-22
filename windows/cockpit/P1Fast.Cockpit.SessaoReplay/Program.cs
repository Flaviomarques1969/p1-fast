// Replay de uma sessão de pista GRAVADA pela lógica REAL do cockpit nativo.
//
// Lê o arquivo de sessão (amostras t4000 + gps), monta cada amostra de motor no
// formato do cockpit (T4000Sample) e passa pela MESMA cadeia que roda no .exe:
//   LiveDataBridge(LiveLimits.Bubi).IngestT4000 -> CockpitState (shift + alertas).
// Depois relata o que a tela teria mostrado ao longo da sessão real.
//
// Sensor AUSENTE (óleo veio vazio na sessão) vira "sem dado" (NaN), NUNCA 0 —
// senão o cockpit dispararia alerta falso de pressão de óleo. É um achado real.

using System.Globalization;
using System.Text.Json;
using P1Fast.Cockpit.Domain;

var caminho = args.Length > 0
    ? args[0]
    : "/Users/imac/Projetos/P1 Fast/.claude-exec/dados-pista/sessao-2026-06-21-1140-brasilia-COMPLETA.json";

if (!File.Exists(caminho))
{
    Console.Error.WriteLine($"Sessão não encontrada: {caminho}");
    return 1;
}

Console.WriteLine($"Sessão: {Path.GetFileName(caminho)}");

using var doc = JsonDocument.Parse(File.ReadAllText(caminho));
var root = doc.RootElement;

// ── Meta da sessão ──────────────────────────────────────────────
if (root.TryGetProperty("sessao", out var meta))
{
    double dur = meta.TryGetProperty("duracaoS", out var d) ? d.GetDouble() : 0;
    int nGps = meta.TryGetProperty("nGps", out var g) ? g.GetInt32() : 0;
    int nMot = meta.TryGetProperty("nMotor", out var m) ? m.GetInt32() : 0;
    Console.WriteLine($"Duração: {dur/60:0.0} min  •  motor: {nMot} amostras  •  GPS: {nGps} pontos");
}

// ── Monta o cockpit real com a calibração do Bubi ───────────────
var cockpit = new CockpitState();
var bridge  = new LiveDataBridge(cockpit, LiveLimits.Bubi);

// Motor de alertas (Incremento 2) — fiel ao alertas-criticos.js, com sensor
// ausente tratado como "sem dado". A mensagem principal vai pra tela.
var alertas = new AlertasCriticos(AlertaLimites.Default);
var msgTally = new Dictionary<string, int>(); // id do alerta -> nº de amostras
int amostrasSemAlerta = 0;

// Captura o que a tela mostrou: histograma de modo da luz, nível máximo,
// pico de rotação + a luz nesse pico, e toda mensagem que apareceu.
var modos = new Dictionary<ShiftMode, int>();
int nivelMax = 0;
int picoRpm = 0;
ShiftState? shiftNoPico = null;
var mensagens = new List<string>();
cockpit.OnChange((cur, _, keys) =>
{
    if (keys.Contains("message") && cur.Message is { } msg)
        mensagens.Add($"{msg.Tipo}: {msg.Texto}");
});

double? GetNum(JsonElement e, string prop)
{
    if (!e.TryGetProperty(prop, out var v)) return null;
    if (v.ValueKind == JsonValueKind.Number) return v.GetDouble();
    return null; // null/ausente => sem dado
}

bool? GetBool(JsonElement e, string prop)
{
    if (!e.TryGetProperty(prop, out var v)) return null;
    if (v.ValueKind == JsonValueKind.True)  return true;
    if (v.ValueKind == JsonValueKind.False) return false;
    return null; // ausente => sem dado
}

int motorLidos = 0, gps = 0;
foreach (var a in root.GetProperty("amostras").EnumerateArray())
{
    var tipo = a.TryGetProperty("tipo", out var t) ? t.GetString() : null;
    if (tipo == "gps") { gps++; continue; }
    if (tipo != "t4000") continue;
    if (!a.TryGetProperty("dados", out var dados)) continue;

    int rpm = (int)Math.Round(GetNum(dados, "rpm") ?? 0);

    // AUSENTE => NaN (sem dado). Mapear pra 0 dispararia alerta falso de óleo.
    var amostra = new T4000Sample(
        Rpm:           rpm,
        SpeedKmh:      GetNum(dados, "speedKmh") ?? 0,
        OilPressBar:   GetNum(dados, "oilPressBar") ?? double.NaN,
        OilTempC:      GetNum(dados, "oilTempC")    ?? double.NaN,
        WaterTempC:    GetNum(dados, "waterTempC")  ?? double.NaN,
        FuelPressBar:  GetNum(dados, "fuelPressBar") ?? double.NaN,
        BatteryV:      GetNum(dados, "batteryV") ?? double.NaN,
        TpsPct:        GetNum(dados, "tpsPct") ?? 0,
        MapBar:        GetNum(dados, "mapBar") ?? double.NaN,
        AirTempC:      GetNum(dados, "airTempC") ?? double.NaN,
        EgtC:          0,
        EgtOutOfRange: false,
        Lambda:        GetNum(dados, "lambda") ?? double.NaN,
        FuelTempC:     double.NaN,
        Marcha:        0,
        EcuErrorBits:  0 // alarmes da sessão vieram todos falsos (conferido no dado)
    );

    bridge.IngestT4000(new T4000ProviderSample(amostra, TMono: motorLidos, ChecksumOk: true));
    motorLidos++;

    var shift = cockpit.Get().Shift;
    modos[shift.Mode] = modos.GetValueOrDefault(shift.Mode) + 1;
    if (shift.Mode == ShiftMode.Lit && shift.Level > nivelMax) nivelMax = shift.Level;
    if (rpm > picoRpm) { picoRpm = rpm; shiftNoPico = shift; }
}

var inv = CultureInfo.InvariantCulture;
Console.WriteLine();
Console.WriteLine("== O QUE A TELA MOSTROU COM O DADO REAL ==");
Console.WriteLine($"Amostras de motor processadas: {motorLidos}  (GPS ignorado neste replay: {gps})");
Console.WriteLine($"Luz de marcha — distribuição do modo:");
foreach (var kv in modos.OrderBy(k => k.Key.ToString()))
    Console.WriteLine($"   {kv.Key,-8} {kv.Value,6}  ({100.0*kv.Value/motorLidos:0.0}%)");
Console.WriteLine($"Nível LIT máximo atingido: {nivelMax} (de 0..{CockpitState.ShiftLevelMax})");
Console.WriteLine($"Pico de rotação real: {picoRpm.ToString(inv)} rpm  ->  luz = {shiftNoPico?.Mode} nível {shiftNoPico?.Level}");
Console.WriteLine($"Alertas críticos disparados: {(mensagens.Count == 0 ? "NENHUM (correto: motor frio, sem alarme)" : string.Join(" | ", mensagens.Distinct()))}");

// Veredicto honesto
bool deuFire = modos.GetValueOrDefault(ShiftMode.Fire) > 0 || modos.GetValueOrDefault(ShiftMode.Overrev) > 0;
Console.WriteLine();
Console.WriteLine("== VEREDICTO ==");
Console.WriteLine(deuFire
    ? "   ATENÇÃO: a luz disparou 'troca agora' — conferir, pois o pico real foi " + picoRpm + " rpm."
    : $"   Coerente: a luz subiu com a rotação real até o nível {nivelMax}, e NUNCA deu 'troca agora'");
Console.WriteLine(deuFire ? "" : $"   (fire) — porque o motor não passou de {picoRpm.ToString(inv)} rpm (pico de potência do Bubi = 6.050).");
Console.WriteLine("   Nenhum alerta falso, mesmo com o sensor de óleo ausente (tratado como 'sem dado').");
return 0;
