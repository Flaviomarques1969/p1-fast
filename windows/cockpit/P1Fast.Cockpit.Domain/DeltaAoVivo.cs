// DeltaAoVivo — o número do cartão do centro, MOMENTO A MOMENTO (Flávio 2026-10-30, painel
// p1fast-cartao-delta-mapa-0013): tempo da volta em que o piloto está × tempo da MELHOR volta daquele
// carro naquela pista no MESMO PONTO do traçado.
//
// Como: grava o traço de cada volta (posição + ms e metros desde a linha). Quando a volta vira a melhor
// (ReferenciaMelhorVolta), o traço dela vira a régua. A cada GPS acha o mesmo ponto no traço da régua —
// projeção no segmento mais perto, numa janela que anda junto com o carro (a pista dobra sobre si:
// procurar na volta inteira pularia de dobra) — e compara os tempos desde a linha. Perdeu o traço 3 fixes
// seguidos → reancora pela distância já percorrida na volta (±150 m).
//
// A linha: no fechamento da volta procura, para trás nos últimos 5 s de GPS, o par de fixes que cruzou a
// linha de chegada e interpola o instante. No replay alguns fixes depois da linha já entraram antes do
// fechamento — eles passam para a volta nova. Sem linha conhecida (pista nova) ou sem o par, a volta
// começa no último fix.
//
// Puro: zero UI, zero I/O, sem relógio próprio (o tempo é o T do GPS). Quem grava o traço é a UI.

namespace P1Fast.Cockpit.Domain;

/// <summary>Um ponto do traço de uma volta: posição, ms e metros desde a linha.</summary>
public sealed record PontoTraco(double Lat, double Lng, double Ms, double M);

/// <summary>O traço de uma volta inteira + o tempo dela (o mesmo da referência da melhor volta).</summary>
public sealed record TracoVolta(double TempoMs, IReadOnlyList<PontoTraco> Pontos);

public sealed class DeltaAoVivo
{
    // Traço que serve de régua: volta inteira, sem buraco, com a duração do tempo da volta.
    public const int PontosMinimos = 100;
    public const double ToleranciaDuracaoMs = 2000;   // relógio da tela × relógio do GPS
    public const double BuracoMaximoMs = 3000;

    // Rastreio no traço da régua.
    public const double PortaoM = 25;                 // mais longe que isso do traço = não é o mesmo ponto
    public const int JanelaAtras = 2, JanelaFrente = 40;
    public const int PerdidosParaReancorar = 3;
    public const double ReancoraM = 150;

    public const double IntervaloEmissaoMs = 100;     // no máximo 10 números por segundo de GPS
    public const double JanelaLinhaMs = 5000;         // onde procurar o par que cruzou a linha
    public const int PontosMaximosVolta = 15000;      // ~10 min a 25 Hz sem linha: não é volta

    private const double MetrosPorGrau = 6_378_137 * Math.PI / 180.0;   // mesma Terra do Ghost.DistMeters

    // Fixes desde o último cruzamento (o 1º é o próprio cruzamento, M = 0). Antes da 1ª linha, só os
    // últimos 5 s (para interpolar o cruzamento). T = relógio do GPS (ms); M = metros desde o 1º.
    private readonly List<(double Lat, double Lng, double T, double M)> _fixes = new();
    private double? _inicioT;
    private IReadOnlyList<PontoTraco>? _ref;
    private int _idx, _perdidos;
    private double _ultimaEmissaoT = double.NegativeInfinity;

    /// <summary>Hora do GPS (ms) em que a volta corrente começou; null = ainda não cruzou a linha.</summary>
    public double? InicioVoltaT => _inicioT;

    /// <summary>true = há régua e a volta começou: o número é contínuo (o delta por fim de curva sai de cena).</summary>
    public bool Ativo => _ref is not null && _inicioT is not null;

    /// <summary>Sessão/pista nova: troca a régua e esquece a volta corrente (o cartão espera a linha).
    /// Devolve true se o traço vale como régua.</summary>
    public bool Semear(TracoVolta? traco)
    {
        _fixes.Clear();
        _inicioT = null;
        return TrocarReferencia(traco);
    }

    /// <summary>A volta que acabou de fechar virou a melhor: o traço dela passa a ser a régua. Traço ruim
    /// = sem régua (nunca a régua antiga, que é de outra volta). Devolve true se o traço vale.</summary>
    public bool TrocarReferencia(TracoVolta? traco)
    {
        _ref = traco is not null && TracoValido(traco.Pontos, traco.TempoMs) ? traco.Pontos : null;
        _idx = 0;
        _perdidos = 0;
        return _ref is not null;
    }

    /// <summary>O traço serve de régua: pelo menos 100 pontos, começa na linha, tempo e metros só andam
    /// para a frente, sem buraco de GPS acima de 3 s e com a duração da volta (±2 s).</summary>
    public static bool TracoValido(IReadOnlyList<PontoTraco>? pts, double tempoMs)
    {
        if (pts is null || pts.Count < PontosMinimos || !double.IsFinite(tempoMs) || tempoMs <= 0) return false;
        if (Math.Abs(pts[0].Ms) > 1 || Math.Abs(pts[^1].Ms - tempoMs) > ToleranciaDuracaoMs) return false;
        for (var k = 0; k < pts.Count; k++)
        {
            var p = pts[k];
            if (!double.IsFinite(p.Lat) || !double.IsFinite(p.Lng) || !double.IsFinite(p.Ms) || !double.IsFinite(p.M)) return false;
            if (k == 0) continue;
            var dt = p.Ms - pts[k - 1].Ms;
            if (dt < 0 || dt > BuracoMaximoMs || p.M < pts[k - 1].M) return false;
        }
        return true;
    }

    /// <summary>Um fix do GPS (o mesmo fluxo filtrado do maestro). Devolve o número novo do cartão, ou
    /// null quando não há o que mostrar agora (sem régua, sem início de volta, fora do traço, ou menos de
    /// 100 ms de GPS desde o último número).</summary>
    public DeltaVoltaInfo? Ingerir(AmostraGps gps)
    {
        if (gps is null || !double.IsFinite(gps.T) || !double.IsFinite(gps.Lat) || !double.IsFinite(gps.Lng)) return null;
        if (_fixes.Count > 0)
        {
            if (gps.T == _fixes[^1].T) return null;               // fix repetido
            if (gps.T < _fixes[^1].T) { _fixes.Clear(); _inicioT = null; }   // relógio voltou (replay em loop)
        }

        var m = _fixes.Count == 0 ? 0
            : _fixes[^1].M + Ghost.DistMeters(new PontoGps(_fixes[^1].Lat, _fixes[^1].Lng), new PontoGps(gps.Lat, gps.Lng));
        _fixes.Add((gps.Lat, gps.Lng, gps.T, m));
        Aparar();

        if (_inicioT is not { } t0 || _ref is null) return null;
        var ms = gps.T - t0;
        if (ms <= 0 || Projetar(gps.Lat, gps.Lng, m) is not { } refMs) return null;
        if (gps.T - _ultimaEmissaoT < IntervaloEmissaoMs) return null;
        _ultimaEmissaoT = gps.T;
        return DeltaVoltaInfo.DaDiferenca(ms - refMs);
    }

    /// <summary>Cruzamento da linha. Devolve o traço da volta que acabou (null = ela não tinha início
    /// conhecido) e começa a volta nova no instante interpolado do cruzamento.</summary>
    public IReadOnlyList<PontoTraco>? FecharVolta(LinhaGps? linha)
    {
        if (_fixes.Count == 0) { _inicioT = null; return null; }   // sem GPS: a volta seguinte não tem início

        var ultimo = _fixes[^1];
        var novo = _fixes.Count;                                    // 1º fix da volta nova
        (double Lat, double Lng, double T, double M) cruz = ultimo;
        var interpolou = false;
        if (linha is not null)
            for (var k = _fixes.Count - 1; k >= 1 && ultimo.T - _fixes[k].T <= JanelaLinhaMs; k--)
            {
                var a = _fixes[k - 1]; var b = _fixes[k];
                var pa = new PontoGps(a.Lat, a.Lng); var pb = new PontoGps(b.Lat, b.Lng);
                var sa = TrechoDetector.SideOfLine(pa, linha.A, linha.B);
                var sb = TrechoDetector.SideOfLine(pb, linha.A, linha.B);
                if (Math.Sign(sa) == Math.Sign(sb) || !TrechoDetector.CaminhoCruzaLinha(pa, pb, linha.A, linha.B)) continue;
                var f = sa / (sa - sb);                              // lados opostos: 0..1 do caminho
                cruz = (a.Lat + f * (b.Lat - a.Lat), a.Lng + f * (b.Lng - a.Lng), a.T + f * (b.T - a.T), a.M + f * (b.M - a.M));
                novo = k;
                interpolou = true;
                break;
            }

        List<PontoTraco>? traco = null;
        if (_inicioT is { } t0)
        {
            traco = new List<PontoTraco>(novo + 1);
            for (var k = 0; k < novo; k++)
                traco.Add(new PontoTraco(_fixes[k].Lat, _fixes[k].Lng, _fixes[k].T - t0, _fixes[k].M));
            if (interpolou) traco.Add(new PontoTraco(cruz.Lat, cruz.Lng, cruz.T - t0, cruz.M));
        }

        // A volta nova começa no cruzamento; os fixes que já entraram depois da linha vão com ela.
        var depois = _fixes.Skip(novo).Select(x => x with { M = x.M - cruz.M }).ToList();
        _fixes.Clear();
        _fixes.Add(cruz with { M = 0 });
        _fixes.AddRange(depois);
        _inicioT = cruz.T;
        _idx = 0;
        _perdidos = 0;
        _ultimaEmissaoT = double.NegativeInfinity;
        return traco;
    }

    private void Aparar()
    {
        if (_inicioT is not null && _fixes.Count > PontosMaximosVolta) _inicioT = null;   // não é volta (box, bandeira)
        if (_inicioT is not null) return;
        var corte = _fixes[^1].T - JanelaLinhaMs;
        var n = 0;
        while (n < _fixes.Count - 2 && _fixes[n].T < corte) n++;
        if (n > 0) _fixes.RemoveRange(0, n);
    }

    // Tempo da régua (ms desde a linha) no ponto do traço mais perto do carro; null = fora do traço.
    private double? Projetar(double lat, double lng, double mVolta)
    {
        var r = _ref!;
        var achou = MaisPerto(r, lat, lng, Math.Max(0, _idx - JanelaAtras), Math.Min(r.Count - 2, _idx + JanelaFrente), null);
        var reancorou = false;
        if (achou is null && ++_perdidos >= PerdidosParaReancorar)
        {
            achou = MaisPerto(r, lat, lng, 0, r.Count - 2, mVolta);
            reancorou = achou is not null;
        }
        if (achou is not { } p) return null;

        _perdidos = 0;
        _idx = reancorou ? p.Seg : Math.Max(_idx, p.Seg);
        // Passou do fim do traço (depois da linha, antes do fechamento): não compara com o fim parado.
        if (p.Seg == r.Count - 2 && p.U >= 1) return null;
        return r[p.Seg].Ms + p.U * (r[p.Seg + 1].Ms - r[p.Seg].Ms);
    }

    // Segmento do traço mais perto do ponto (dentro do portão), entre os índices de..ate. Com mVolta,
    // só os segmentos a até ±150 m da distância percorrida na volta (reancoragem).
    private static (int Seg, double U)? MaisPerto(IReadOnlyList<PontoTraco> r, double lat, double lng, int de, int ate, double? mVolta)
    {
        (int Seg, double U)? melhor = null;
        var melhorD = PortaoM;
        var kx = MetrosPorGrau * Math.Cos(lat * Math.PI / 180.0);
        for (var j = de; j <= ate; j++)
        {
            if (mVolta is { } mv && Math.Abs(r[j].M - mv) > ReancoraM) continue;
            var ax = (r[j].Lng - lng) * kx; var ay = (r[j].Lat - lat) * MetrosPorGrau;
            var dx = (r[j + 1].Lng - lng) * kx - ax; var dy = (r[j + 1].Lat - lat) * MetrosPorGrau - ay;
            var len2 = dx * dx + dy * dy;
            var u = len2 > 0 ? Math.Clamp(-(ax * dx + ay * dy) / len2, 0, 1) : 0;
            var px = ax + u * dx; var py = ay + u * dy;
            var d = Math.Sqrt(px * px + py * py);
            if (d < melhorD) { melhorD = d; melhor = (j, u); }
        }
        // Mais perto da PONTA da janela = o carro está FORA dela (adiante ou atrás): não é o mesmo ponto.
        // Decide pelo vencedor, não pulando o segmento da ponta — senão o vizinho de dentro (que termina
        // quase no mesmo lugar) entra no lugar dele e o cartão mostra um número falso.
        if (melhor is { } m && ((m.U >= 1 && m.Seg == ate && ate < r.Count - 2) || (m.U <= 0 && m.Seg == de && de > 0)))
            return null;
        return melhor;
    }
}
