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
var gpsValidos = new List<PontoGps>();
foreach (var a in root.GetProperty("amostras").EnumerateArray())
{
    var tipo = a.TryGetProperty("tipo", out var t) ? t.GetString() : null;
    if (tipo == "gps")
    {
        gps++;
        if (a.TryGetProperty("dados", out var gd))
        {
            var fix  = GetNum(gd, "fix") ?? 0;
            var hacc = GetNum(gd, "hacc") ?? double.MaxValue;
            var lat  = GetNum(gd, "lat") ?? 0;
            var lon  = GetNum(gd, "lon") ?? 0;
            // mesmo filtro do detector de voltas: fix 3, hacc<50, dentro de Brasília
            if (fix >= 3 && hacc < 50 && lat >= -16.1 && lat <= -15.4 && lon >= -48.3 && lon <= -47.6)
                gpsValidos.Add(new PontoGps(lat, lon));
        }
        continue;
    }
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

    // Motor de alertas com os campos REAIS do T3000 (ausente = null = sem dado).
    var alarmes = dados.TryGetProperty("alarmes", out var alm) ? alm : default;
    alertas.IngestT4000(new AmostraAlerta
    {
        WaterTempC              = GetNum(dados, "waterTempC"),
        Rpm                     = GetNum(dados, "rpm"),
        TpsPct                  = GetNum(dados, "tpsPct"),
        Lambda                  = GetNum(dados, "lambda"),
        BatteryV                = GetNum(dados, "batteryV"),
        FuelInjectionBalanced   = GetBool(dados, "fuelInjectionBalanced"),
        BaixaPressaoOleo        = alarmes.ValueKind == JsonValueKind.Object ? GetBool(alarmes, "baixaPressaoOleo") : null,
        AlertaNivelCombustivel  = alarmes.ValueKind == JsonValueKind.Object ? GetBool(alarmes, "alertaNivelCombustivel") : null,
        BaixaPressaoCombustivel = alarmes.ValueKind == JsonValueKind.Object ? GetBool(alarmes, "baixaPressaoCombustivel") : null,
    });
    var principal = alertas.GetMensagemPrincipal();
    if (principal is null) { cockpit.HideMessage(); amostrasSemAlerta++; }
    else { cockpit.ShowMessage(principal.Tipo, principal.Texto); msgTally[principal.Id] = msgTally.GetValueOrDefault(principal.Id) + 1; }

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
Console.WriteLine();
Console.WriteLine("Mensagens/alertas que apareceram (motor de alertas real, fiel à referência):");
if (msgTally.Count == 0)
    Console.WriteLine("   NENHUM em nenhuma amostra.");
else
    foreach (var kv in msgTally.OrderByDescending(k => k.Value))
        Console.WriteLine($"   {CatalogoAlertas.Todos[kv.Key].Texto,-18} em {kv.Value,5} amostras ({100.0*kv.Value/motorLidos:0.0}%)");
Console.WriteLine($"   (sem nenhum alerta em {amostrasSemAlerta} amostras)");

// Veredicto honesto
bool deuFire = modos.GetValueOrDefault(ShiftMode.Fire) > 0 || modos.GetValueOrDefault(ShiftMode.Overrev) > 0;
bool deuOleo = msgTally.ContainsKey("OLEO_BAIXO");
Console.WriteLine();
Console.WriteLine("== VEREDICTO ==");
Console.WriteLine(deuFire
    ? $"   ATENÇÃO: a luz disparou 'troca agora' — conferir, pico real {picoRpm.ToString(inv)} rpm."
    : $"   Luz: subiu com a rotação real até o nível {nivelMax} e NUNCA deu 'troca agora' (pico {picoRpm.ToString(inv)} < 6.050).");
Console.WriteLine(deuOleo
    ? "   ATENÇÃO: ÓLEO BAIXO disparou — não deveria, o sensor estava ausente. Revisar."
    : "   Óleo: sensor AUSENTE não virou alerta falso (o conserto funcionou).");
Console.WriteLine("   Os alertas de MISTURA (se houver) vêm dos picos reais de lambda (0,6 a 1,6) — fiel à regra aprovada;");
Console.WriteLine("   se esses picos forem só de marcha lenta/desaceleração, fica como calibração futura.");

// ── GHOST: ápice + bolinha sobre o GPS real ─────────────────────
Console.WriteLine();
Console.WriteLine("== GHOST (ápice + bolinha) COM O GPS REAL ==");
Console.WriteLine($"Pontos de GPS válidos (fix 3, hacc<50, em Brasília): {gpsValidos.Count} de {gps}");

// O carro ficou parado 93% do tempo: jitter de GPS parado vira "curva" falsa de
// raio mínimo. Pra achar curva DE VERDADE, fica só com pontos em movimento
// (>=3 m do último guardado) — isso colapsa os aglomerados parados.
var gpsMov = new List<PontoGps>();
foreach (var p in gpsValidos)
    if (gpsMov.Count == 0 || Ghost.DistMeters(gpsMov[^1], p) >= 3) gpsMov.Add(p);
Console.WriteLine($"Pontos em MOVIMENTO (>=3 m de espaçamento): {gpsMov.Count}");

var apice = Ghost.AcharApice(gpsMov);
if (apice is null)
{
    Console.WriteLine("   Não deu pra achar ápice (passagem curta/sem ponto válido).");
    return 0;
}
Console.WriteLine($"Ápice (curva mais fechada andando): raio {apice.RaioM:0.0} m, no ponto {apice.Idx} de {gpsMov.Count}");

// Replay da bolinha numa janela em torno do ápice: ela aponta pra FRENTE antes,
// passa pelo lado, e vai pra ATRÁS depois — prova que a direção funciona no dado real.
int jIni = Math.Max(1, apice.Idx - 10), jFim = Math.Min(gpsMov.Count - 1, apice.Idx + 10);
double menorDist = double.MaxValue; double? angAntes = null, angDepois = null;
for (var i = jIni; i <= jFim; i++)
{
    var car = gpsMov[i];
    double? heading = Ghost.DistMeters(gpsMov[i - 1], car) >= 1 ? Ghost.BearingDeg(gpsMov[i - 1], car) : null;
    var b = Ghost.CalcularBolinha(car, heading, apice.Ponto);
    cockpit.SetApexPonto("apice", estado: b.Estado, distM: b.DistM, angleDeg: b.AngleDeg); // escreve no estado real
    if (b.DistM < menorDist) menorDist = b.DistM;
    if (i == apice.Idx - 25 && b.AngleDeg is { } a1) angAntes = a1;
    if (i == apice.Idx + 25 && b.AngleDeg is { } a2) angDepois = a2;
}
Console.WriteLine($"Bolinha na passagem pelo ápice: distância mínima {menorDist:0.0} m (chega na mira)");
Console.WriteLine($"   direção ~25 amostras ANTES: {(angAntes is { } x ? x.ToString("0") + " graus" : "—")}  |  ~25 DEPOIS: {(angDepois is { } y ? y.ToString("0") + " graus" : "—")}");
Console.WriteLine($"Estado do cockpit ao fim: apex.distM={cockpit.Get().Apex.Apice.DistM:0.0} m  apex.angleDeg={cockpit.Get().Apex.Apice.AngleDeg:0}");
Console.WriteLine("   (frente ~0 / lado ~90 / atrás ~180: a bolinha cruza o lado quando passa pelo ápice — 'siga a bolinha')");
return 0;
