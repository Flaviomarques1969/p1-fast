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

    // Linha de chegada oficial de Brasília (mesmos pontos do Program.cs).
    private static readonly PontoGps ChegadaA = new(-15.7728816, -47.9000707);
    private static readonly PontoGps ChegadaB = new(-15.7725493, -47.9001926);

    /// <summary>Lê a sessão a partir do texto JSON gravado (chave "amostras").</summary>
    public static SessaoReplay Carregar(string sessaoJson)
    {
        using var doc = JsonDocument.Parse(sessaoJson);
        var root = doc.RootElement;

        var motorList = new List<(double T, double Rpm, AmostraAlerta A)>();
        var gpsValidos = new List<(PontoGps P, double T)>();
        int gpsTotal = 0;

        if (root.TryGetProperty("amostras", out var amostras) && amostras.ValueKind == JsonValueKind.Array)
        {
            foreach (var a in amostras.EnumerateArray())
            {
                var tipo = a.TryGetProperty("tipo", out var t) ? t.GetString() : null;
                var tWall = a.TryGetProperty("tWall", out var tw) && tw.ValueKind == JsonValueKind.Number ? tw.GetDouble() : 0;

                if (tipo == "gps")
                {
                    gpsTotal++;
                    if (!a.TryGetProperty("dados", out var gd)) continue;
                    var fix = GetNum(gd, "fix") ?? 0;
                    var hacc = GetNum(gd, "hacc") ?? double.MaxValue;
                    var lat = GetNum(gd, "lat") ?? 0;
                    var lon = GetNum(gd, "lon") ?? 0;
                    // Mesmo filtro de QUALIDADE do ao vivo (H3): fonte única em GpsFiltroAoVivo.
                    if (GpsFiltroAoVivo.QualidadeOk(lat, lon, fix, hacc))
                        gpsValidos.Add((new PontoGps(lat, lon), tWall));
                    continue;
                }

                if (tipo != "t4000") continue;
                if (!a.TryGetProperty("dados", out var dados)) continue;

                var rpm = GetNum(dados, "rpm") ?? 0;
                var alarmes = dados.TryGetProperty("alarmes", out var alm) ? alm : default;
                var amAlerta = new AmostraAlerta
                {
                    WaterTempC = GetNum(dados, "waterTempC"),
                    Rpm = GetNum(dados, "rpm"),
                    TpsPct = GetNum(dados, "tpsPct"),
                    Lambda = GetNum(dados, "lambda"),
                    BatteryV = GetNum(dados, "batteryV"),
                    FuelInjectionBalanced = GetBool(dados, "fuelInjectionBalanced"),
                    BaixaPressaoOleo = alarmes.ValueKind == JsonValueKind.Object ? GetBool(alarmes, "baixaPressaoOleo") : null,
                    AlertaNivelCombustivel = alarmes.ValueKind == JsonValueKind.Object ? GetBool(alarmes, "alertaNivelCombustivel") : null,
                    BaixaPressaoCombustivel = alarmes.ValueKind == JsonValueKind.Object ? GetBool(alarmes, "baixaPressaoCombustivel") : null,
                };
                motorList.Add((tWall, rpm, amAlerta));
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
            if (Math.Sign(TrechoDetector.SideOfLine(p1, ChegadaA, ChegadaB)) != Math.Sign(TrechoDetector.SideOfLine(p0, ChegadaA, ChegadaB))
                && TrechoDetector.CaminhoCruzaLinha(p0, p1, ChegadaA, ChegadaB))
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

    // ── Helpers de leitura (ausente => null = sem dado) ──
    private static double? GetNum(JsonElement e, string prop)
        => e.TryGetProperty(prop, out var v) && v.ValueKind == JsonValueKind.Number ? v.GetDouble() : null;

    private static bool? GetBool(JsonElement e, string prop)
    {
        if (!e.TryGetProperty(prop, out var v)) return null;
        if (v.ValueKind == JsonValueKind.True) return true;
        if (v.ValueKind == JsonValueKind.False) return false;
        return null;
    }
}
