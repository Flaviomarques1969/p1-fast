// SessaoReplay — lê uma sessão de pista GRAVADA (motor T4000 + GPS) e devolve a
// lista de eventos em ordem de tempo (tWall), pronta pra ser bombeada pela MESMA
// cadeia que roda no .exe: CockpitOrchestrator.IngestMotor / IngestGps.
//
// É o port reutilizável do laço que o P1Fast.Cockpit.SessaoReplay/Program.cs já
// provou (replay da sessão real de 21/06 pelo cérebro real). Antes essa leitura
// vivia só no console com caminho fixo; agora a UI (MainWindow, modo --replay)
// usa a mesma classe pra animar a tela com o dado real, sem hardware.
//
// Regras herdadas do dado real (achados de 21/06):
//  - Sensor AUSENTE (campo null/ausente) vira "sem dado" (NaN), NUNCA 0 — senão o
//    cockpit dispararia alerta falso (ex.: óleo baixo).
//  - GPS só conta com fix>=3, hacc<50 e dentro da caixa de Brasília.
//  - Pra alimentar o detector de curvas, fica só com pontos em MOVIMENTO (>=3 m de
//    espaçamento): o carro ficou parado 93% do tempo e o jitter parado vira curva
//    falsa. A velocidade de cada ponto sai do GPS (dist/dt).

using System;
using System.Text.Json;

namespace P1Fast.Cockpit.Domain;

/// <summary>Um evento da sessão gravada, no instante tWall (ms). Motor OU GPS.</summary>
public sealed record ReplayEvento(double TWallMs, bool IsMotor, double Rpm, AmostraAlerta? Alerta, AmostraGps? Gps);

/// <summary>
/// Sessão de pista gravada, decodificada em eventos ordenados por tempo. Use
/// <see cref="Carregar"/> pra ler do JSON e <see cref="Eventos"/>/<see cref="Janela"/>
/// pra alimentar o <see cref="CockpitOrchestrator"/>.
/// </summary>
public sealed class SessaoReplay
{
    /// <summary>Eventos (motor + GPS) ordenados por tWall (ms).</summary>
    public IReadOnlyList<ReplayEvento> Eventos { get; }

    /// <summary>tWall (ms) de cada cruzamento da linha de chegada — fronteiras de volta.</summary>
    public IReadOnlyList<double> CruzamentosMs { get; }

    public int MotorCount { get; }
    public int GpsCount { get; }
    public int GpsValidos { get; }

    /// <summary>Duração coberta pelos eventos (ms): do 1º ao último evento.</summary>
    public double DuracaoMs => Eventos.Count > 0 ? Eventos[^1].TWallMs - Eventos[0].TWallMs : 0;

    private SessaoReplay(
        IReadOnlyList<ReplayEvento> eventos, IReadOnlyList<double> cruzamentos,
        int motorCount, int gpsCount, int gpsValidos)
    {
        Eventos = eventos;
        CruzamentosMs = cruzamentos;
        MotorCount = motorCount;
        GpsCount = gpsCount;
        GpsValidos = gpsValidos;
    }

    /// <summary>Lê a sessão gravada e devolve os eventos ordenados. Aceita DOIS formatos (item 3.3):
    ///  (a) 1 documento JSON com raiz <c>{"amostras":[…]}</c> — a sessão web de 21/06 (camelCase);
    ///  (b) <c>.jsonl</c> do PRÓPRIO gravador do .exe (SessionRecorder/FileSessionStore): N registros
    ///      PascalCase, 1 por linha. Sem isto, as sessões capturadas em campo pelo .exe não eram
    ///      replayáveis (só a de 21/06). O formato é detectado pela 1ª linha (doc único vs várias
    ///      linhas). A leitura dos campos é CASE-INSENSITIVE, então os dois casings casam na mesma peça.</summary>
    public static SessaoReplay Carregar(string sessaoJson)
    {
        var motorList = new List<(double T, double Rpm, AmostraAlerta A)>();
        var gpsValidos = new List<(PontoGps P, double T)>();
        int gpsTotal = 0;

        void ProcessarAmostra(JsonElement a)
        {
            var tipo = GetStr(a, "tipo");
            var tWall = GetNum(a, "tWall") ?? 0;

            if (tipo == "gps")
            {
                gpsTotal++;
                if (!TryProp(a, "dados", out var gd)) return;
                var fix = GetNum(gd, "fix") ?? 0;
                var hacc = GetNum(gd, "hacc") ?? double.MaxValue;
                var lat = GetNum(gd, "lat") ?? 0;
                var lon = GetNum(gd, "lon") ?? 0;
                // Mesmo filtro de QUALIDADE do ao vivo (H3): fonte única em GpsFiltroAoVivo.
                if (GpsFiltroAoVivo.QualidadeOk(lat, lon, fix, hacc))
                    gpsValidos.Add((new PontoGps(lat, lon), tWall));
                return;
            }

            if (tipo != "t4000") return;
            if (!TryProp(a, "dados", out var dados)) return;

            var rpm = GetNum(dados, "rpm") ?? 0;
            TryProp(dados, "alarmes", out var alarmes);
            var amAlerta = new AmostraAlerta
            {
                WaterTempC = GetNum(dados, "waterTempC"),
                Rpm = GetNum(dados, "rpm"),
                TpsPct = GetNum(dados, "tpsPct"),
                // M3 (item 3.4): a MESMA guarda da sonda WB do ao vivo (CapturaDiaDePista.AlertaDeSample) —
                // lambda fora do físico (0.3–1.6) ou com o raw da banda larga em 0 (sonda desconectada) vira
                // "sem dado" (null), pra o replay NÃO disparar MISTURA RICA/POBRE falsa que o live não daria.
                Lambda = GuardaLambda(GetNum(dados, "lambda"), GetNum(dados, "lambdaWBRaw")),
                BatteryV = GetNum(dados, "batteryV"),
                FuelInjectionBalanced = GetBool(dados, "fuelInjectionBalanced"),
                BaixaPressaoOleo = alarmes.ValueKind == JsonValueKind.Object ? GetBool(alarmes, "baixaPressaoOleo") : null,
                AlertaNivelCombustivel = alarmes.ValueKind == JsonValueKind.Object ? GetBool(alarmes, "alertaNivelCombustivel") : null,
                BaixaPressaoCombustivel = alarmes.ValueKind == JsonValueKind.Object ? GetBool(alarmes, "baixaPressaoCombustivel") : null,
            };
            motorList.Add((tWall, rpm, amAlerta));
        }

        if (TentarDocAmostras(sessaoJson, out var doc, out var amostras))
        {
            // (a) doc único {"amostras":[…]} — sessão web.
            using (doc)
                foreach (var a in amostras.EnumerateArray()) ProcessarAmostra(a);
        }
        else
        {
            // (b) .jsonl do gravador do .exe: 1 registro por linha.
            foreach (var linha in sessaoJson.Split('\n'))
            {
                var t = linha.Trim();
                if (t.Length == 0) continue;
                JsonDocument ld;
                try { ld = JsonDocument.Parse(t); } catch (JsonException) { continue; } // linha corrompida: pula
                using (ld) ProcessarAmostra(ld.RootElement);
            }
        }

        // Pontos em MOVIMENTO (>=3 m), com velocidade real tirada do GPS (dist/dt).
        // Decimação pela MESMA peça do ao vivo (H3): GpsFiltroAoVivo.AceitarValido.
        var gpsDet = new List<AmostraGps>();
        var filtroMov = new GpsFiltroAoVivo();
        foreach (var (p, tw) in gpsValidos)
        {
            var am = filtroMov.AceitarValido(p, tw);
            if (am is not null) gpsDet.Add(am);
        }

        // Cruzamentos da linha de chegada (fronteiras de volta) sobre o GPS em movimento.
        var cruzamentos = new List<double>();
        for (var k = 1; k < gpsDet.Count; k++)
        {
            var p0 = new PontoGps(gpsDet[k - 1].Lat, gpsDet[k - 1].Lng);
            var p1 = new PontoGps(gpsDet[k].Lat, gpsDet[k].Lng);
            if (Math.Sign(TrechoDetector.SideOfLine(p1, PistaBrasilia.ChegadaA, PistaBrasilia.ChegadaB)) != Math.Sign(TrechoDetector.SideOfLine(p0, PistaBrasilia.ChegadaA, PistaBrasilia.ChegadaB))
                && TrechoDetector.CaminhoCruzaLinha(p0, p1, PistaBrasilia.ChegadaA, PistaBrasilia.ChegadaB))
                cruzamentos.Add(gpsDet[k].T);
        }

        // Funde motor + GPS num só fluxo ordenado por tWall.
        var eventos = new List<ReplayEvento>(motorList.Count + gpsDet.Count);
        foreach (var m in motorList) eventos.Add(new ReplayEvento(m.T, true, m.Rpm, m.A, null));
        foreach (var g in gpsDet) eventos.Add(new ReplayEvento(g.T, false, 0, null, g));
        eventos.Sort((x, y) => x.TWallMs.CompareTo(y.TWallMs));

        return new SessaoReplay(eventos, cruzamentos, motorList.Count, gpsTotal, gpsValidos.Count);
    }

    /// <summary>Lê os 8 trechos de Brasília do arquivo BARRAS aprovado (chave "trechos").</summary>
    public static IReadOnlyList<TrechoSegmento> CarregarSegmentos(string barrasJson)
    {
        using var doc = JsonDocument.Parse(barrasJson);
        PontoGps Pt(JsonElement e) => new(e.GetProperty("lat").GetDouble(), e.GetProperty("lng").GetDouble());

        var segs = new List<TrechoSegmento>();
        if (!doc.RootElement.TryGetProperty("trechos", out var trechos) || trechos.ValueKind != JsonValueKind.Array)
            return segs;

        foreach (var tr in trechos.EnumerateArray())
        {
            var ent = tr.GetProperty("entrada_line_gps");
            var sai = tr.GetProperty("saida_line_gps");
            var id = tr.TryGetProperty("id", out var idv) ? idv.GetString() : null;
            var nome = tr.TryGetProperty("nome", out var nv) ? nv.GetString() : null;
            segs.Add(new TrechoSegmento(
                id ?? nome ?? "?",
                nome ?? "?",
                new LinhaGps(Pt(ent.GetProperty("a")), Pt(ent.GetProperty("b"))),
                Pt(tr.GetProperty("apice_gps")),
                new LinhaGps(Pt(sai.GetProperty("a")), Pt(sai.GetProperty("b")))));
        }
        return segs;
    }

    /// <summary>Eventos dentro da janela [iniMs, fimMs] (inclusive).</summary>
    public IReadOnlyList<ReplayEvento> Janela(double iniMs, double fimMs)
        => Eventos.Where(e => e.TWallMs >= iniMs && e.TWallMs <= fimMs).ToList();

    /// <summary>
    /// Janela contínua das voltas completas (do 1º ao último cruzamento da linha de
    /// chegada). Dá ao maestro uma volta de REFERÊNCIA antes das comparadas, gerando
    /// delta/coach reais. Null se houver menos de 2 cruzamentos.
    /// </summary>
    public (double Ini, double Fim)? JanelaVoltasCompletas()
        => CruzamentosMs.Count >= 2 ? (CruzamentosMs[0], CruzamentosMs[^1]) : null;

    // ── Detecção de formato ──
    // Tenta ler como doc único {"amostras":[…]}. Sucesso → mantém o doc vivo (o chamador o usa e
    // descarta). Falha (raiz sem "amostras", ou JSON multi-linha do .jsonl que não é 1 doc só) →
    // devolve false pro chamador ler linha a linha. NÃO descarta silenciosamente dado.
    private static bool TentarDocAmostras(string json, out JsonDocument doc, out JsonElement amostras)
    {
        doc = null!;
        amostras = default;
        try
        {
            var d = JsonDocument.Parse(json);
            if (d.RootElement.ValueKind == JsonValueKind.Object &&
                TryProp(d.RootElement, "amostras", out var arr) && arr.ValueKind == JsonValueKind.Array)
            {
                doc = d;
                amostras = arr;
                return true;
            }
            d.Dispose();   // objeto único SEM "amostras" (p.ex. 1 registro .jsonl) → cai no leitor de linhas
        }
        catch (JsonException) { /* várias linhas (jsonl) não formam 1 doc → leitor de linhas */ }
        return false;
    }

    // Guarda M3 canônica (espelha CapturaDiaDePista.AlertaDeSample): sonda WB em 0, ou lambda fora do
    // físico (0.3–1.6), = "sem dado" (null). O 0 já cai em <0.3. (Flávio 2026-07-09, item 3.4.)
    private static double? GuardaLambda(double? lambda, double? lambdaWbRaw)
        => (lambdaWbRaw == 0 || lambda is null || lambda < 0.3 || lambda > 1.6) ? null : lambda;

    // ── Helpers de leitura CASE-INSENSITIVE (ausente => null = sem dado) ──
    // O casing muda entre os formatos: web camelCase ("tWall","dados","rpm") x .jsonl PascalCase do
    // gravador ("TWall","Dados","Rpm"); a leitura CI faz uma peça só servir aos dois (item 3.3).
    private static bool TryProp(JsonElement e, string prop, out JsonElement value)
    {
        if (e.ValueKind == JsonValueKind.Object)
            foreach (var p in e.EnumerateObject())
                if (string.Equals(p.Name, prop, StringComparison.OrdinalIgnoreCase))
                { value = p.Value; return true; }
        value = default;
        return false;
    }

    private static double? GetNum(JsonElement e, string prop)
        => TryProp(e, prop, out var v) && v.ValueKind == JsonValueKind.Number ? v.GetDouble() : null;

    private static string? GetStr(JsonElement e, string prop)
        => TryProp(e, prop, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;

    private static bool? GetBool(JsonElement e, string prop)
    {
        if (!TryProp(e, prop, out var v)) return null;
        if (v.ValueKind == JsonValueKind.True) return true;
        if (v.ValueKind == JsonValueKind.False) return false;
        return null;
    }
}
