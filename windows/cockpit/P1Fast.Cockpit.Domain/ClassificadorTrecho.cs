// ClassificadorTrecho — porte fiel de web/cockpit/classificador-trecho.js. Classifica
// o TIPO de uma curva (T0..T5, SF, ND) e propõe o formato de trail braking, a partir
// dos pontos da MELHOR passagem. Módulo PURO (sem DOM, sem rede).
//
// PRINCÍPIO INEGOCIÁVEL (não reabrir): o ALVO do treino continua sendo a curva real da
// melhor passagem (régua canônica). Este classificador NÃO substitui a régua, NUNCA
// julga e NUNCA vai pro cockpit ao vivo — serve pra (a) bootstrap teórico na calibração,
// (b) nomear o erro com o vocabulário do tipo da curva, (c) alertar coerência.
//
// HONESTIDADE DO DADO: a telemetria preservada é ~1 Hz (25-45 m entre pontos). Raio e
// perfil do raio NÃO saem confiáveis (confianca 'baixa'); a classificação PRIMÁRIA apoia
// em VELOCIDADE (pico antes da mínima ÷ mínima). Os limiares são chute educado declarado.

using System.Globalization;

namespace P1Fast.Cockpit.Domain;

/// <summary>Limiares da classificação (chute educado declarado, a calibrar em pista).</summary>
public sealed record LimiaresClassificador(
    double FreadaMinRazao = 1.10,
    double RazaoLenta = 1.55,
    double RazaoRapida = 1.20,
    double VminLentaKmh = 105,
    double VminRapidaKmh = 130,
    double AceleraSaidaKmh = 12,
    double EncadeadaMaxM = 60,
    int PtsMinGeometria = 14,
    double EspacamentoMaxM = 12,
    double VminSuspeitoKmh = 5,
    double GLateralMaxPlausivel = 1.5,
    double AnguloMinCurvaDeg = 25)
{
    public static readonly LimiaresClassificador Default = new();
}

/// <summary>Ponto de uma passagem (lat/lng/velocidade/instante). Kmh pode ser NaN (dropout GPS).</summary>
public sealed record TrechoPonto(double Lat, double Lng, double Kmh, long T);

/// <summary>Variável de saída com valor (número, texto ou null), fonte e confiança.</summary>
public sealed record VarInfo(object? Valor, string Fonte, string Confianca);

/// <summary>Flags do diagnóstico da passagem.</summary>
public sealed record ClassFlags(
    bool HouveFreada, bool AceleraSaida, bool Encadeada, bool SemAproximacao, bool DadoSuspeito);

/// <summary>Resultado da classificação de um trecho.</summary>
public sealed record ClassificacaoTrecho(
    string Tipo,
    string Rotulo,
    string Formato,
    string Confianca,
    string Motivo,
    IReadOnlyDictionary<string, VarInfo> Variaveis,
    ClassFlags? Flags,
    IReadOnlyList<string> Ressalvas);

public static class ClassificadorTrecho
{
    private const double RTerra = 6378137, D2R = Math.PI / 180;

    /// <summary>Rótulo + formato de trail de cada tipo de curva.</summary>
    public static readonly IReadOnlyDictionary<string, (string Rotulo, string Formato)> Tipos =
        new Dictionary<string, (string, string)>
        {
            ["T0"] = ("MÉDIA CLÁSSICA", "Trail progressivo: pancada inicial e soltura gradual e constante até o ápice."),
            ["T1"] = ("LENTA PÓS-RETA", "100% na pancada inicial, soltura profunda e gradativa até o ápice (o freio ajuda a girar o carro)."),
            ["T2"] = ("RAIO DECRESCENTE", "Pancada parcial (60-75%) + residual constante (35-50%) até o raio mínimo, soltura curta no fim."),
            ["T3"] = ("RÁPIDA", "Toque curto (até 40%) ou só alívio do acelerador — assenta a dianteira, não reduz a velocidade."),
            ["T4"] = ("ENCADEADA", "Residual mantido até a troca de direção — a prioridade é a entrada da próxima curva, não a saída desta."),
            ["T5"] = ("RAIO CRESCENTE", "Ápice cedo, trail curto, acelera cedo — ouro de saída em tração dianteira."),
            ["SF"] = ("SEM FREADA", "Curva de pé embaixo (kink): sem prescrição de freio."),
            ["ND"] = ("INDETERMINADO", "O dado atual não permite afirmar o tipo com segurança — ver ressalvas."),
        };

    // ── geometria pura (exportada pra teste isolado, igual ao JS) ──

    /// <summary>Distância em metros entre dois pontos (equirectangular local).</summary>
    public static double DistM(TrechoPonto a, TrechoPonto b)
    {
        double x = (b.Lng - a.Lng) * D2R * Math.Cos((a.Lat + b.Lat) / 2 * D2R);
        double y = (b.Lat - a.Lat) * D2R;
        return Math.Sqrt(x * x + y * y) * RTerra;
    }

    /// <summary>Projeta os pontos pra um plano local x,y (metros) relativo ao 1º ponto.</summary>
    public static IReadOnlyList<XYPonto> ParaXY(IReadOnlyList<TrechoPonto> pts)
    {
        if (pts.Count == 0) return Array.Empty<XYPonto>();
        double lat0 = pts[0].Lat, lng0 = pts[0].Lng, cos0 = Math.Cos(lat0 * D2R);
        var outp = new List<XYPonto>(pts.Count);
        foreach (var p in pts)
            outp.Add(new XYPonto(
                (p.Lng - lng0) * D2R * cos0 * RTerra,
                (p.Lat - lat0) * D2R * RTerra,
                p.Kmh, p.T));
        return outp;
    }

    /// <summary>
    /// Velocidades-chave da passagem. vEntrada = PICO até a mínima (de onde freou),
    /// não o 1º ponto. Null se nenhum ponto tem velocidade legível.
    /// </summary>
    public static Velocidades? VelocidadesDe(IReadOnlyList<TrechoPonto> pts)
    {
        var fin = new List<int>();
        for (int i = 0; i < pts.Count; i++) if (double.IsFinite(pts[i].Kmh)) fin.Add(i);
        if (fin.Count == 0) return null;
        int first = fin[0], last = fin[^1];
        double vmin = double.PositiveInfinity; int idxMin = first;
        foreach (int i in fin) if (pts[i].Kmh < vmin) { vmin = pts[i].Kmh; idxMin = i; }
        double vEntrada = double.NegativeInfinity;
        foreach (int i in fin) { if (i > idxMin) break; if (pts[i].Kmh > vEntrada) vEntrada = pts[i].Kmh; }
        return new Velocidades(
            VeInicio: pts[first].Kmh,
            VEntrada: vEntrada,
            Vmin: vmin,
            Vs: pts[last].Kmh,
            IdxMin: idxMin,
            SemAproximacao: idxMin == first,
            MinimaNaSaida: idxMin == last,
            DadoSuspeito: vmin <= LimiaresClassificador.Default.VminSuspeitoKmh);
    }

    /// <summary>Comprimento total da passagem (soma dos segmentos).</summary>
    public static double ComprimentoM(IReadOnlyList<TrechoPonto> pts)
    {
        double s = 0;
        for (int i = 1; i < pts.Count; i++) s += DistM(pts[i - 1], pts[i]);
        return s;
    }

    /// <summary>Desaceleração de pico (m/s²) pela física do GPS — grosseira a 1 Hz.</summary>
    public static double DesacelPicoMs2(IReadOnlyList<TrechoPonto> pts)
    {
        double pico = 0;
        for (int i = 1; i < pts.Count; i++)
        {
            if (!double.IsFinite(pts[i].Kmh) || !double.IsFinite(pts[i - 1].Kmh)) continue;
            double dt = (pts[i].T - pts[i - 1].T) / 1000.0;
            if (!(dt > 0)) continue;
            double a = ((pts[i - 1].Kmh - pts[i].Kmh) / 3.6) / dt;
            if (a > pico) pico = a;
        }
        return pico;
    }

    /// <summary>Ângulo total varrido (graus) e sentido ('esq'/'dir'/'reta').</summary>
    public static (double AnguloDeg, string Sentido) CurvaturaTotal(IReadOnlyList<XYPonto> xy)
    {
        if (xy.Count < 3) return (0, "reta");
        double soma = 0;
        for (int i = 2; i < xy.Count; i++)
        {
            double a1 = Math.Atan2(xy[i - 1].Y - xy[i - 2].Y, xy[i - 1].X - xy[i - 2].X);
            double a2 = Math.Atan2(xy[i].Y - xy[i - 1].Y, xy[i].X - xy[i - 1].X);
            double d = a2 - a1;
            while (d > Math.PI) d -= 2 * Math.PI;
            while (d < -Math.PI) d += 2 * Math.PI;
            soma += d;
        }
        return (Math.Abs(soma) * 180 / Math.PI, soma > 0 ? "esq" : "dir");
    }

    /// <summary>Raio do círculo por 3 pontos (m). Colinear = Infinity (reta).</summary>
    public static double RaioPorTresPontos(XYPonto a, XYPonto b, XYPonto c)
    {
        double A = Math.Sqrt(Sq(b.X - a.X) + Sq(b.Y - a.Y));
        double B = Math.Sqrt(Sq(c.X - b.X) + Sq(c.Y - b.Y));
        double C = Math.Sqrt(Sq(c.X - a.X) + Sq(c.Y - a.Y));
        double area2 = Math.Abs((b.X - a.X) * (c.Y - a.Y) - (c.X - a.X) * (b.Y - a.Y));
        if (area2 < 1e-6) return double.PositiveInfinity;
        return (A * B * C) / (2 * area2);
    }

    /// <summary>
    /// Perfil do raio: mediana das metades pra tendência; rminM = mediana do terço mais
    /// fechado (não o mínimo cru, que captura ruído a 1 Hz). Usa os limiares GLOBAIS.
    /// </summary>
    public static PerfilRaioResultado PerfilRaio(IReadOnlyList<XYPonto> xy, int npts, double comprimento)
    {
        var L = LimiaresClassificador.Default;
        double espac = comprimento / Math.Max(1, xy.Count - 1);
        string confianca = (npts >= L.PtsMinGeometria && espac <= L.EspacamentoMaxM) ? "media" : "baixa";
        if (xy.Count < 5) return new PerfilRaioResultado(null, "indeterminado", "baixa", espac);

        var raios = new List<double>();
        for (int i = 1; i < xy.Count - 1; i++)
        {
            double r = RaioPorTresPontos(xy[i - 1], xy[i], xy[i + 1]);
            if (double.IsFinite(r)) raios.Add(r);
        }
        if (raios.Count == 0) return new PerfilRaioResultado(null, "indeterminado", "baixa", espac);

        var ord = raios.OrderBy(x => x).ToList();
        double rminM = Med(ord.Take(Math.Max(1, (int)Math.Ceiling(ord.Count / 3.0))).ToList());
        int meio = raios.Count / 2;
        double r1m = Med(raios.Take(meio == 0 ? 1 : meio).ToList());
        double r2m = Med(raios.Skip(meio).ToList());
        string perfil = "constante";
        if (r2m < r1m * 0.7) perfil = "decrescente";
        else if (r2m > r1m * 1.4) perfil = "crescente";
        return new PerfilRaioResultado(rminM, perfil, confianca, espac);
    }

    /// <summary>
    /// Classifica um trecho. <paramref name="pts"/> = pontos da melhor passagem;
    /// <paramref name="distProximaM"/> = distância (m) da saída deste trecho até a entrada
    /// do próximo (ou null).
    /// </summary>
    public static ClassificacaoTrecho Classificar(
        IReadOnlyList<TrechoPonto> pts,
        double? distProximaM = null,
        LimiaresClassificador? limiares = null)
    {
        var L = limiares ?? LimiaresClassificador.Default;
        if (pts is null || pts.Count < 3)
            return Nd("passagem sem pontos suficientes", new[] { "Sem dados de passagem para este trecho." });
        var v = VelocidadesDe(pts);
        if (v is null)
            return Nd("passagem sem velocidade válida", new[] { "Nenhum ponto da passagem tem velocidade legível." });

        var xy = ParaXY(pts);
        double comprimento = ComprimentoM(pts);
        int npts = pts.Count;
        double razao = v.Vmin > 0 ? v.VEntrada / v.Vmin : double.PositiveInfinity;
        double desacel = DesacelPicoMs2(pts);
        var (anguloDeg, sentido) = CurvaturaTotal(xy);
        var geom = PerfilRaio(xy, npts, comprimento);
        double espacM = comprimento / Math.Max(1, npts - 1);

        bool freou = !v.SemAproximacao && !v.DadoSuspeito && razao >= L.FreadaMinRazao;
        bool aceleraSaida = (v.Vs - v.Vmin) >= L.AceleraSaidaKmh;
        bool encadeada = distProximaM != null && distProximaM <= L.EncadeadaMaxM;

        // g lateral no Vmin (Vmin²/R_min) — só se o raio for plausível; senão o raio a 1 Hz mente.
        double? gLateral = null, rminPlausivel = geom.RminM; string? raioMotivo = null;
        if (geom.RminM is { } rmin && double.IsFinite(rmin) && rmin > 0)
        {
            double g = Math.Pow(v.Vmin / 3.6, 2) / rmin / 9.81;
            if (g <= L.GLateralMaxPlausivel) gLateral = g; else { rminPlausivel = null; raioMotivo = "implausivel"; }
        }
        // recorte quase reto: o "raio" mínimo não representa uma curva (ângulo varrido pequeno)
        if (anguloDeg < L.AnguloMinCurvaDeg) { rminPlausivel = null; gLateral = null; raioMotivo = "reto"; }

        var ressalvas = new List<string>();
        if (espacM > L.EspacamentoMaxM)
            ressalvas.Add($"Pontos a ~{Fixed0(espacM)} m (telemetria ~1 Hz): raio, perfil do raio e g lateral são aproximações grossas (não confiáveis). Para o formato fino do trail, regravar a 25 Hz (RaceBox Mini S).");
        if (raioMotivo == "implausivel")
            ressalvas.Add("O raio estimado deu fisicamente implausível (ruído do GPS a 1 Hz) — omitido em vez de mostrar número falso.");
        if (raioMotivo == "reto")
            ressalvas.Add($"Ângulo varrido pequeno neste recorte (~{Num(R1(anguloDeg))}°): o trecho está quase reto aqui — o raio não representa a curva (omitido).");

        string acel = aceleraSaida ? $" Acelera da mínima pra saída (Vs {Num(R1(v.Vs))} km/h): despeja em reta." : "";
        string tipo, confianca, motivo;

        if (v.DadoSuspeito)
        {
            tipo = "ND"; confianca = "baixa";
            motivo = $"Velocidade mínima amostrada ~0 (Vmin {Num(R1(v.Vmin))} km/h): provável falha de leitura do GPS — dado não confiável neste trecho.";
        }
        else if (v.Vmin >= L.VminRapidaKmh && razao < L.RazaoLenta)
        {
            tipo = freou ? "T3" : "SF"; confianca = "media";
            motivo = freou
                ? $"Freada leve (razão {Num(R2(razao))}) com Vmin alto ({Num(R1(v.Vmin))} km/h): rápida.{acel}"
                : $"Velocidade alta e quase constante (Vmin {Num(R1(v.Vmin))} km/h, razão {Num(R2(razao))}): curva de pé embaixo / toque mínimo.{acel}";
        }
        else if (!freou)
        {
            tipo = "ND"; confianca = "baixa";
            motivo = v.SemAproximacao
                ? $"Vmin {Num(R1(v.Vmin))} km/h logo no início do recorte: a freada começou ANTES do início desta passagem (cobre a curva/saída, não a frenagem). Não dá pra avaliar o trail aqui.{acel}"
                : $"A velocidade quase não cai no recorte (entrada {Num(R1(v.VEntrada))} -> mínima {Num(R1(v.Vmin))} km/h, razão {Num(R2(razao))}): sem freada significativa registrada neste trecho. Pode ser trecho de saída/aceleração ou freada fora do recorte.{acel}";
            ressalvas.Add("Para avaliar esta curva, a passagem precisa cobrir a frenagem (recorte/posicionamento da barra de entrada) ou usar captura a 25 Hz.");
        }
        else if (encadeada)
        {
            tipo = "T4"; confianca = "media";
            motivo = $"Saída a {Num(R1(distProximaM!.Value))} m da próxima entrada: trecho encadeado — trail orientado ao posicionamento da curva seguinte.";
        }
        else if (razao >= L.RazaoLenta || v.Vmin <= L.VminLentaKmh)
        {
            tipo = "T1"; confianca = razao >= L.RazaoLenta ? "media" : "baixa";
            motivo = $"Freada forte (entrada {Num(R1(v.VEntrada))} -> mínima {Num(R1(v.Vmin))} km/h, razão {Num(R2(razao))}): lenta pós-reta.{acel}";
        }
        else
        {
            tipo = "T0"; confianca = "media";
            motivo = $"Freada média (entrada {Num(R1(v.VEntrada))} -> mínima {Num(R1(v.Vmin))} km/h, razão {Num(R2(razao))}): média clássica (default).{acel}";
        }
        if (v.MinimaNaSaida && tipo != "ND" && tipo != "SF")
            ressalvas.Add("A velocidade mínima caiu no último ponto: o ápice pode estar fora do recorte — confirmar.");

        // perfil do raio (T2/T5) só como SUGESTÃO e só com geometria confiável
        if (freou && geom.Confianca == "media" && geom.Perfil == "decrescente")
            ressalvas.Add("Geometria sugere raio decrescente — avaliar T2 (residual) ao validar.");
        else if (freou && geom.Confianca == "media" && geom.Perfil == "crescente")
            ressalvas.Add("Geometria sugere raio crescente — avaliar T5 (ápice cedo) ao validar.");
        else if (freou)
            ressalvas.Add("Perfil do raio (T2 decrescente / T5 crescente) não determinável com este dado — precisa de 25 Hz.");
        if (freou && encadeada == false && distProximaM != null && distProximaM < L.EncadeadaMaxM * 1.6)
            ressalvas.Add($"Próxima entrada a {Num(R1(distProximaM.Value))} m — limítrofe de encadeada (T4); validar.");

        var variaveis = new Dictionary<string, VarInfo>
        {
            ["vEntradaKmh"] = new(R1(v.VEntrada), "telemetria: pico de velocidade até a mínima", "media"),
            ["vminKmh"] = new(R1(v.Vmin), "telemetria: mínima amostrada (~1 Hz)", "media"),
            ["vsKmh"] = new(R1(v.Vs), "telemetria: último ponto", "media"),
            ["veInicioKmh"] = new(R1(v.VeInicio), "telemetria: 1º ponto gravado (pode ser na reta)", "media"),
            ["razaoEntradaVmin"] = new(double.IsInfinity(razao) ? null : R2(razao), "calculado: pico / mínima", freou ? "media" : "baixa"),
            ["desacelPicoMs2"] = new(R2(desacel), "física do GPS (estimativa, não sensor)", "baixa"),
            ["gLateralVmin"] = new(gLateral == null ? null : R2(gLateral.Value), "Vmin²/raio (depende do raio)", "baixa"),
            ["comprimentoM"] = new(R1(comprimento), "soma dos pontos da passagem (cobre aproximação + curva)", "media"),
            ["espacamentoM"] = new(R1(espacM), "comprimento / nº de pontos", "alta"),
            ["nPontos"] = new(npts, "pontos_json da melhor passagem", "alta"),
            ["anguloDeg"] = new(R1(anguloDeg), "soma das mudanças de rumo (XY)", espacM > L.EspacamentoMaxM ? "baixa" : "media"),
            ["sentido"] = new(sentido, "sinal da curvatura", "media"),
            ["rminM"] = new(rminPlausivel == null ? null : R1(rminPlausivel.Value), "mediana do terço mais fechado (3 pontos)", geom.Confianca),
            ["perfilRaio"] = new(geom.Perfil, "tendência das medianas", geom.Confianca),
            ["distProximaEntradaM"] = new(distProximaM == null ? null : R1(distProximaM.Value), "saída -> entrada da próxima curva", "media"),
        };

        return new ClassificacaoTrecho(
            tipo, Tipos[tipo].Rotulo, Tipos[tipo].Formato, confianca, motivo,
            variaveis,
            new ClassFlags(freou, aceleraSaida, encadeada, v.SemAproximacao, v.DadoSuspeito),
            ressalvas);
    }

    private static ClassificacaoTrecho Nd(string motivo, IReadOnlyList<string> ressalvas) =>
        new("ND", Tipos["ND"].Rotulo, Tipos["ND"].Formato, "baixa", motivo,
            new Dictionary<string, VarInfo>(), null, ressalvas);

    private static double Med(IReadOnlyList<double> arr)
    {
        var s = arr.OrderBy(x => x).ToList();
        return s[s.Count / 2];
    }

    private static double Sq(double x) => x * x;
    private static double R1(double x) => double.IsFinite(x) ? Math.Round(x * 10, MidpointRounding.AwayFromZero) / 10 : x;
    private static double R2(double x) => double.IsFinite(x) ? Math.Round(x * 100, MidpointRounding.AwayFromZero) / 100 : x;
    private static string Num(double x) => x.ToString(CultureInfo.InvariantCulture);
    private static string Fixed0(double x) =>
        Math.Round(x, MidpointRounding.AwayFromZero).ToString("F0", CultureInfo.InvariantCulture);

    /// <summary>Ponto projetado no plano local (metros).</summary>
    public readonly record struct XYPonto(double X, double Y, double Kmh, long T);

    /// <summary>Velocidades-chave da passagem.</summary>
    public sealed record Velocidades(
        double VeInicio, double VEntrada, double Vmin, double Vs, int IdxMin,
        bool SemAproximacao, bool MinimaNaSaida, bool DadoSuspeito);

    /// <summary>Saída do perfil do raio.</summary>
    public sealed record PerfilRaioResultado(double? RminM, string Perfil, string Confianca, double EspacM);
}
