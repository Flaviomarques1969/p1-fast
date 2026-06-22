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

var caminho = args.FirstOrDefault(a => !a.StartsWith("--"))
    ?? "/Users/imac/Projetos/P1 Fast/.claude-exec/dados-pista/sessao-2026-06-21-1140-brasilia-COMPLETA.json";

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
var gpsT = new List<double>(); // tWall de cada ponto válido (alinhado com gpsValidos)
var motorList = new List<(double T, double Rpm, AmostraAlerta A)>(); // pra exportar a fita do cockpit
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
            {
                gpsValidos.Add(new PontoGps(lat, lon));
                gpsT.Add(a.TryGetProperty("tWall", out var twv) && twv.ValueKind == JsonValueKind.Number ? twv.GetDouble() : 0);
            }
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
    var amAlerta = new AmostraAlerta
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
    };
    alertas.IngestT4000(amAlerta);
    motorList.Add((a.TryGetProperty("tWall", out var twm) && twm.ValueKind == JsonValueKind.Number ? twm.GetDouble() : 0, rpm, amAlerta));
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
    if (i == apice.Idx - 6 && b.AngleDeg is { } a1) angAntes = a1;
    if (i == apice.Idx + 6 && b.AngleDeg is { } a2) angDepois = a2;
}
Console.WriteLine($"Bolinha na passagem pelo ápice: distância mínima {menorDist:0.0} m (chega na mira)");
Console.WriteLine($"   direção ANTES do ápice: {(angAntes is { } x ? x.ToString("0") + " graus" : "—")}  |  DEPOIS: {(angDepois is { } y ? y.ToString("0") + " graus" : "—")}");
Console.WriteLine($"Estado do cockpit ao fim: apex.distM={cockpit.Get().Apex.Apice.DistM:0.0} m  apex.angleDeg={cockpit.Get().Apex.Apice.AngleDeg:0}");
Console.WriteLine("   (frente ~0 / lado ~90 / atrás ~180: a bolinha cruza o lado quando passa pelo ápice — 'siga a bolinha')");

// ── DELTA + COACH (encanamento completo na linha REAL) ──────────
Console.WriteLine();
Console.WriteLine("== DELTA + COACH (encanamento completo) ==");
int w0 = Math.Max(0, apice.Idx - 25), w1 = Math.Min(gpsMov.Count - 1, apice.Idx + 25);
var janela = gpsMov.GetRange(w0, w1 - w0 + 1);
int nn = janela.Count;
string SubDe(double f) => f < 0.2 ? "entrada" : f < 0.4 ? "freio" : f < 0.6 ? "apice" : f < 0.8 ? "pace" : "saida";
if (nn >= 6)
{
    // Referência = a linha real da curva a 100 km/h.
    var refPts = new List<PontoPassagem>();
    var atualPts = new List<PontoPassagem>();
    for (var i = 0; i < nn; i++)
    {
        var f = (double)i / (nn - 1);
        refPts.Add(new PontoPassagem(janela[i].Lat, janela[i].Lng, 100, i, f, SubDe(f)));
        // Passagem ATUAL: mais lenta SÓ na freada (simulada — só há 1 volta real).
        var kmh = (f >= 0.2 && f < 0.4) ? 72 : 100;
        atualPts.Add(new PontoPassagem(janela[i].Lat, janela[i].Lng, kmh, i, f, SubDe(f)));
    }
    var delta = DeltaCalculator.Calcular(new Passagem("brasilia-curva", atualPts), new Passagem("brasilia-curva", refPts));
    var coach = MensagensPedagogicas.Decidir(delta, new ContextoApice(cockpit.Get().Apex.Apice.AngleDeg, cockpit.Get().Apex.Apice.DistM));
    if (coach is not null) cockpit.SetAcao(coach.Texto, Tone.Erro);

    Console.WriteLine($"Linha real usada: {nn} pontos da curva (ápice no meio).");
    Console.WriteLine($"Diferença de tempo (passagem mais lenta na freada vs referência): {delta.DeltaTotalS:0.000} s no total");
    Console.WriteLine($"   pior sub-trecho: {delta.PiorSubTrecho} ({delta.PiorDeltaS:0.000} s)");
    Console.WriteLine($"Frase do coach na tela: \"{coach?.Texto ?? "(nenhuma)"}\"  ->  cockpit.acao = \"{cockpit.Get().Acao.Texto}\"");
    Console.WriteLine("   (passagem mais lenta SIMULADA: só há 1 volta real; o valor real vem com uma 2ª volta mais rápida)");
}

// ── SEGMENTAÇÃO: "em qual curva o carro está" na volta real ─────
Console.WriteLine();
Console.WriteLine("== EM QUAL CURVA O CARRO ESTÁ (8 curvas de Brasília) ==");
var barrasPath = "/Users/imac/Projetos/P1 Fast/_design-reference/BARRAS-BRASILIA-FLAVIO-APROVADO-2026-05-27.json";
if (File.Exists(barrasPath))
{
    using var bdoc = JsonDocument.Parse(File.ReadAllText(barrasPath));
    PontoGps Pt(JsonElement e) => new(e.GetProperty("lat").GetDouble(), e.GetProperty("lng").GetDouble());
    var segs = new List<TrechoSegmento>();
    foreach (var tr in bdoc.RootElement.GetProperty("trechos").EnumerateArray())
    {
        var ent = tr.GetProperty("entrada_line_gps");
        var sai = tr.GetProperty("saida_line_gps");
        segs.Add(new TrechoSegmento(
            tr.GetProperty("id").GetString() ?? tr.GetProperty("nome").GetString()!,
            tr.GetProperty("nome").GetString() ?? "?",
            new LinhaGps(Pt(ent.GetProperty("a")), Pt(ent.GetProperty("b"))),
            Pt(tr.GetProperty("apice_gps")),
            new LinhaGps(Pt(sai.GetProperty("a")), Pt(sai.GetProperty("b")))));
    }
    var nomePorId = segs.ToDictionary(s => s.Id, s => s.Nome);

    // pontos em movimento (>=3 m) com velocidade REAL tirada do GPS
    var gpsDet = new List<AmostraGps>();
    PontoGps? prev = null; double prevT = 0;
    for (var k = 0; k < gpsValidos.Count; k++)
    {
        var p = gpsValidos[k]; var tw = gpsT[k];
        if (prev is null || Ghost.DistMeters(prev, p) >= 3)
        {
            double kmh = 0;
            if (prev is not null) { var dtS = Math.Max(0.001, (tw - prevT) / 1000.0); kmh = Ghost.DistMeters(prev, p) / dtS * 3.6; }
            gpsDet.Add(new AmostraGps(p.Lat, p.Lng, kmh, tw));
            prev = p; prevT = tw;
        }
    }

    var entradas = new List<string>();
    int apices = 0, saidas = 0, freadas = 0, resyncs = 0;
    var det = new TrechoDetector(segs, ev =>
    {
        switch (ev.Type)
        {
            case "entrada-cruzou": entradas.Add(nomePorId.GetValueOrDefault(ev.SegmentId, ev.SegmentId)); break;
            case "apice-cruzou":   apices++; break;
            case "saida-cruzou":   saidas++; break;
            case "freada-iniciou": freadas++; break;
            case "resync":         resyncs++; break;
        }
    });
    foreach (var s in gpsDet) det.IngestGps(s);

    Console.WriteLine($"Pontos em movimento alimentados: {gpsDet.Count}");
    Console.WriteLine($"Curvas distintas reconhecidas: {entradas.Distinct().Count()} de {segs.Count}");
    Console.WriteLine($"Eventos: {entradas.Count} entradas, {apices} ápices, {saidas} saídas, {freadas} freadas, {resyncs} ressincronizações");
    Console.WriteLine("Sequência de curvas que o carro percorreu (entradas):");
    Console.WriteLine("   " + (entradas.Count > 0 ? string.Join(" -> ", entradas.Take(20)) : "(nenhuma)"));
    Console.WriteLine("   (o detector se vira sozinho: se perde uma curva, reengata na curva onde o carro REALMENTE está)");

    // ── CAPSTONE: a sessão inteira pelo MAESTRO (tudo junto) ────────
    Console.WriteLine();
    Console.WriteLine("== MAESTRO: o cérebro inteiro comandando a tela com a sessão real ==");
    var telaState = new CockpitState();
    var maestro = new CockpitOrchestrator(telaState, segs);
    var frasesCoach = new List<string>();
    string ultimaAcao = "";
    telaState.OnChange((cur, _, ks) =>
    {
        if (ks.Contains("acao") && cur.Acao.Texto != ultimaAcao && cur.Acao.Texto != "REGISTRANDO" && !string.IsNullOrEmpty(cur.Acao.Texto))
            frasesCoach.Add(cur.Acao.Texto);
        if (ks.Contains("acao")) ultimaAcao = cur.Acao.Texto;
    });
    foreach (var s in gpsDet) maestro.IngestGps(s); // GPS real -> curva + bolinha + coach
    Console.WriteLine($"Curvas que viraram referência (1ª passagem): {maestro.CurvasComReferencia} de {segs.Count}");
    Console.WriteLine($"Frases REAIS do coach na 2ª passagem (2ª volta vs 1ª, SEM simulação): {frasesCoach.Count}");
    if (frasesCoach.Count > 0)
        Console.WriteLine("   " + string.Join(" | ", frasesCoach.Take(12)));
    Console.WriteLine($"Estado final da tela: acao=\"{telaState.Get().Acao.Texto}\"  apex.distM={telaState.Get().Apex.Apice.DistM:0.0}m");
    Console.WriteLine("   (a tela observa esse mesmo estado; no Windows, o maestro o muta ao vivo e a tela acende)");

    // ── EXPORTAR A FITA DA TELA (pro player no navegador) ───────────
    var expArg = args.FirstOrDefault(a => a.StartsWith("--exportar-tela="));
    if (expArg is not null)
    {
        var saida = expArg["--exportar-tela=".Length..];
        var telaC = new CockpitState();
        var maestroT = new CockpitOrchestrator(telaC, segs);

        var eventos2 = new List<(double T, bool Motor, double Rpm, AmostraAlerta? A, AmostraGps? G)>();
        foreach (var m in motorList) eventos2.Add((m.T, true, m.Rpm, m.A, null));
        foreach (var g in gpsDet) eventos2.Add((g.T, false, 0, null, g));
        eventos2.Sort((x, y) => x.T.CompareTo(y.T));

        string J(string? s) => "\"" + (s ?? "").Replace("\\", "\\\\").Replace("\"", "\\\"") + "\"";
        string Num(double? d) => d is { } v && !double.IsNaN(v) ? v.ToString("0.0", inv) : "null";

        // Isolar UMA volta: detecta os cruzamentos da linha de chegada oficial de
        // Brasília e corta a janela [cruzamento N, cruzamento N+1]. --volta=2 = a de 2:39.
        var chgA = new PontoGps(-15.7728816, -47.9000707);
        var chgB = new PontoGps(-15.7725493, -47.9001926);
        var cruz = new List<double>();
        for (var k = 1; k < gpsDet.Count; k++)
        {
            var p0 = new PontoGps(gpsDet[k - 1].Lat, gpsDet[k - 1].Lng);
            var p1 = new PontoGps(gpsDet[k].Lat, gpsDet[k].Lng);
            if (Math.Sign(TrechoDetector.SideOfLine(p1, chgA, chgB)) != Math.Sign(TrechoDetector.SideOfLine(p0, chgA, chgB))
                && TrechoDetector.CaminhoCruzaLinha(p0, p1, chgA, chgB))
                cruz.Add(gpsDet[k].T);
        }
        var voltaArg = args.FirstOrDefault(a => a.StartsWith("--volta="));
        int voltaN = voltaArg is not null && int.TryParse(voltaArg["--volta=".Length..], out var vn) ? vn : 0;
        var duas = args.Contains("--duas-voltas"); // volta 1 (referência) + volta 2 (comparada), contínuas
        double lapStart = eventos2.Count > 0 ? eventos2[0].T : 0;
        double lapEnd = eventos2.Count > 0 ? eventos2[^1].T : 0;
        double seam = -1; // tWall onde a volta 2 começa
        bool semComp = false;     // true = sem comparação (volta isolada)
        bool soDaJanela = false;      // true = alimenta só a janela escolhida
        if (duas && cruz.Count >= 3) { lapStart = cruz[0]; lapEnd = cruz[2]; seam = cruz[1]; soDaJanela = true; }
        else if (voltaN >= 1 && cruz.Count > voltaN) { lapStart = cruz[voltaN - 1]; lapEnd = cruz[voltaN]; semComp = true; soDaJanela = true; }
        Console.WriteLine($"Cruzamentos: {cruz.Count} | modo: {(duas ? $"DUAS VOLTAS ({(lapEnd - lapStart) / 1000:0.0}s)" : voltaN >= 1 ? $"volta #{voltaN}" : "sessao inteira")}");

        var frames = new List<string>();
        double ultimoFrame = -1, lastRpm = 0, lastMotorT = -1e9, lastGpsT = -1e9;
        string curva = "";
        foreach (var e in eventos2)
        {
            if (soDaJanela && (e.T < lapStart || e.T > lapEnd)) continue; // só a janela escolhida
            if (e.Motor) { maestroT.IngestMotor(e.Rpm, e.A!); lastRpm = e.Rpm; lastMotorT = e.T; }
            else { maestroT.IngestGps(e.G!); lastGpsT = e.T; }
            curva = maestroT.CurvaAtualNome ?? curva;
            var rel = e.T - lapStart;
            if (ultimoFrame < 0 || rel - ultimoFrame >= 200) // ~5 quadros por segundo
            {
                ultimoFrame = rel;
                var st = telaC.Get();
                var ap = st.Apex.Apice;
                var apx = st.Apex;
                // HONESTIDADE: sem motor vivo (injeção não gravou nesta parte), NÃO mostra luz/rotação
                // velha — apaga a luz e deixa a rotação em branco. Só o que é real aparece.
                var mVivo = e.T - lastMotorT < 2000;
                var shMode = mVivo ? st.Shift.Mode.ToString() : "Off";
                var shLevel = mVivo ? st.Shift.Level : 0;
                var vnum = duas ? (e.T >= seam ? 2 : 1) : voltaN; // qual volta (1=aquecimento, 2=rápida)
                // volta isolada: sem comparação (recorde/diferença/coach) — não há referência válida.
                var trechoOut = semComp ? "Neutro" : st.TrechoStatus.ToString();
                var deltaOut = semComp ? "" : st.Delta.Value;
                var deltaTOut = semComp ? "Neutro" : st.Delta.Tone.ToString();
                var acaoOut = semComp ? "" : st.Acao.Texto;
                var acaoTOut = semComp ? "Neutro" : st.Acao.Tone.ToString();
                // mensagem vem do motor (lambda etc.): só com motor VIVO, nunca dado velho.
                var msgOut = mVivo ? (st.Message?.Texto ?? "") : "";
                var msgTOut = mVivo && st.Message is not null ? st.Message.Tipo.ToString() : "";
                frames.Add("{" +
                    $"\"t\":{(rel / 1000).ToString("0.0", inv)}," +
                    $"\"rpm\":{(mVivo ? lastRpm.ToString("0", inv) : "null")}," +
                    $"\"shiftMode\":{J(shMode)},\"shiftLevel\":{shLevel}," +
                    $"\"trecho\":{J(trechoOut)}," +
                    $"\"delta\":{J(deltaOut)},\"deltaTone\":{J(deltaTOut)}," +
                    $"\"acao\":{J(acaoOut)},\"acaoTone\":{J(acaoTOut)}," +
                    $"\"msg\":{J(msgOut)},\"msgTipo\":{J(msgTOut)}," +
                    $"\"apiceDist\":{Num(ap.DistM)},\"apiceAng\":{Num(ap.AngleDeg)},\"apiceEstado\":{J(ap.Estado.ToString())}," +
                    // 4 pontos do ápice com VELOCIDADE REAL do GPS no cruzamento
                    $"\"entKmh\":{Num(apx.Entrada.ValorKmh)},\"entEst\":{J(apx.Entrada.Estado.ToString())}," +
                    $"\"freM\":{Num(apx.Freio.AtualM)},\"freRef\":{Num(apx.Freio.RefM)},\"freEst\":{J(apx.Freio.Estado.ToString())}," +
                    $"\"apiKmh\":{Num(apx.Apice.ValorKmh)},\"apiEst\":{J(apx.Apice.Estado.ToString())}," +
                    $"\"saiKmh\":{Num(apx.Saida.ValorKmh)},\"saiEst\":{J(apx.Saida.Estado.ToString())}," +
                    // barra de stint: resultado REAL por curva (na ordem da pista) + a atual
                    $"\"stint\":[{string.Join(",", segs.Select(sg => J(sg.Id == maestroT.CurvaAtualId ? "current" : (maestroT.EstadoDoTrecho(sg.Id) is var st2 && st2 != "" ? st2 : "pending"))))}]," +
                    // sinais vivos de verdade (pro indicador de telemetria não ser fixo)
                    $"\"motorVivo\":{(e.T - lastMotorT < 2000 ? "true" : "false")},\"gpsVivo\":{(e.T - lastGpsT < 2000 ? "true" : "false")}," +
                    $"\"volta\":{vnum}," +
                    $"\"curva\":{J(curva)}" +
                    "}");
            }
        }
        // Escreve como .js (window.FITA) pra a tela carregar via <script src> sem
        // travar no navegador local (fetch de file:// costuma ser bloqueado).
        File.WriteAllText(saida, "window.FITA = [\n" + string.Join(",\n", frames) + "\n];\n");
        Console.WriteLine($"Fita da tela exportada: {frames.Count} quadros -> {saida}");
    }

    // ── AUDITORIA: provar que cada função É data-driven (falsificação) ──
    if (args.Contains("--auditoria"))
    {
        Console.WriteLine();
        Console.WriteLine("== AUDITORIA (falsificação: a saída muda quando o dado muda?) ==");

        // A) LUZ DE MARCHA — computada do rpm real?
        var sReal = LiveDataBridge.RpmToShift(picoRpm, LiveLimits.Bubi);
        var sMais = LiveDataBridge.RpmToShift(picoRpm + 400, LiveLimits.Bubi);
        var sZero = LiveDataBridge.RpmToShift(0, LiveLimits.Bubi);
        Console.WriteLine($"A) LUZ: rpm real {picoRpm}->{sReal.Mode} L{sReal.Level} | +400={picoRpm + 400}->{sMais.Mode} | 0->{sZero.Mode}");
        Console.WriteLine($"   VEREDICTO: {(sReal.Mode != sMais.Mode && sZero.Mode == ShiftMode.Off ? "muda com o rpm = COMPUTADO do dado real" : "SUSPEITO")}");

        // B) ALERTAS — da água/lambda reais? (pega a amostra de maior rpm = andando)
        JsonElement md = default; double maxr = -1;
        foreach (var a2 in root.GetProperty("amostras").EnumerateArray())
            if (a2.TryGetProperty("tipo", out var tp2) && tp2.GetString() == "t4000" && a2.TryGetProperty("dados", out var dd))
            { var r2 = GetNum(dd, "rpm") ?? 0; if (r2 > maxr) { maxr = r2; md = dd; } }
        var amReal = new AmostraAlerta { WaterTempC = GetNum(md, "waterTempC"), Rpm = GetNum(md, "rpm"), TpsPct = GetNum(md, "tpsPct"), Lambda = GetNum(md, "lambda"), BatteryV = GetNum(md, "batteryV") };
        var idsReal = CatalogoAlertas.AvaliarT4000(amReal);
        var idsQuente = CatalogoAlertas.AvaliarT4000(amReal with { WaterTempC = 85 });
        Console.WriteLine($"B) ALERTAS: amostra real (água {amReal.WaterTempC:0}C, rpm {amReal.Rpm:0}) -> [{string.Join(",", idsReal)}]");
        Console.WriteLine($"   mesma amostra com água=85 -> [{string.Join(",", idsQuente)}]");
        Console.WriteLine($"   VEREDICTO: {(!idsReal.Contains("MOTOR_QUENTE") && idsQuente.Contains("MOTOR_QUENTE") ? "aparece MOTOR QUENTE só quando a água sobe = lê o dado real" : "SUSPEITO")}");

        // C) ÁPICE/BOLINHA — coordenada real de Brasília? distância varia?
        var apiceAud = Ghost.AcharApice(gpsDet.Select(a => new PontoGps(a.Lat, a.Lng)).ToList());
        if (apiceAud is not null)
        {
            var longe = Ghost.DistMeters(new PontoGps(gpsDet[0].Lat, gpsDet[0].Lng), apiceAud.Ponto);
            Console.WriteLine($"C) ÁPICE: lat {apiceAud.Ponto.Lat:0.00000} lng {apiceAud.Ponto.Lng:0.00000} (Brasília ~ -15.77/-47.90), raio {apiceAud.RaioM:0.0}m");
            Console.WriteLine($"   bolinha: longe dele = {longe:0}m, em cima dele = 0m (distância VARIA com a posição real)");
            Console.WriteLine($"   VEREDICTO: {(apiceAud.Ponto.Lat < -15 && apiceAud.Ponto.Lat > -16 && longe > 10 ? "coordenada real da pista + distância varia = GPS real" : "SUSPEITO")}");
        }

        // D) SEGMENTAÇÃO — depende da pista real? (joga o GPS pra longe da pista)
        int entradasLonge = 0;
        var detLonge = new TrechoDetector(segs, ev => { if (ev.Type == "entrada-cruzou") entradasLonge++; });
        foreach (var s in gpsDet) detLonge.IngestGps(s with { Lat = s.Lat + 0.05, Lng = s.Lng + 0.05 }); // ~5 km fora
        Console.WriteLine($"D) CURVAS: GPS real -> {entradas.Distinct().Count()} de 8 | GPS deslocado 5km fora da pista -> {entradasLonge}");
        Console.WriteLine($"   VEREDICTO: {(entradas.Distinct().Count() == 8 && entradasLonge == 0 ? "8/8 na pista real, 0 fora = depende da geometria real de Brasília" : "SUSPEITO")}");

        // E) COACH/DELTA — responde à velocidade real? (mais rápido vs mais lento)
        if (gpsDet.Count > 60)
        {
            var baseTrecho = gpsDet.Skip(20).Take(40).ToList();
            Passagem Mk(double fator) => new("aud", baseTrecho.Select((a, i) =>
                new PontoPassagem(a.Lat, a.Lng, a.Kmh * fator, a.T, (double)i / (baseTrecho.Count - 1), i < 20 ? "entrada" : "saida")).ToList());
            var refp = Mk(1.0);
            var dSelf   = DeltaCalculator.Calcular(refp, refp).DeltaTotalS;       // piso de ruído do algoritmo
            var dRapido = DeltaCalculator.Calcular(Mk(1.10), refp).DeltaTotalS;   // 10% mais rápido
            var dLento  = DeltaCalculator.Calcular(Mk(0.90), refp).DeltaTotalS;   // 10% mais lento
            Console.WriteLine($"E) COACH: capstone real (2ª volta vs 1ª) deu {frasesCoach.Count} frases REAIS (sem simulação): {string.Join(", ", frasesCoach.Take(6))}");
            Console.WriteLine($"   prova de direção: mesma linha 10% mais rápida -> {dRapido:0.000}s (ganha) | 10% mais lenta -> {dLento:0.000}s (perde)");
            Console.WriteLine($"   piso de ruído do algoritmo (igual vs igual, velocidade variando) = {dSelf:0.000}s (assimetria fiel ao JS; deltas abaixo disso são insignificantes)");
            Console.WriteLine($"   VEREDICTO: {(dRapido < 0 && dLento > 0 ? "ganha tempo quando acelera, perde quando freia = compara VELOCIDADE REAL" : "SUSPEITO")}");
        }
    }
}
else
{
    Console.WriteLine("   Arquivo das curvas de Brasília não encontrado.");
}
return 0;
