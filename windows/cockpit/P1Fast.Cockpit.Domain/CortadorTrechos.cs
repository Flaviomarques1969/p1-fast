// CortadorTrechos — corta uma pista DESCONHECIDA em trechos a partir de voltas fechadas
// (Fase C do desenho .claude-exec/DESENHO-MAPEAMENTO-PISTA-2026-07-10.md, aprovado Flávio 2026-07-10).
//
// Recebe voltas já fechadas pelo mapeador (VoltaMapeada) e vai montando o perfil médio
// velocidade × distância-na-volta. ÁPICE = mínimo local de velocidade (com proeminência e
// separação mínimas, senão todo ruído vira curva). FRONTEIRA de trecho = ponto de velocidade
// MÁXIMA entre dois ápices (meio da "reta"). A saída é a MESMA estrutura TrechoSegmento que o
// TrechoDetector já consome — o detector não muda, muda a ORIGEM dos segmentos.
//
// CONGELAMENTO (D1): quando 2 cortes CONSECUTIVOS derem o mesmo resultado (mesmo nº de trechos e
// fronteiras/ápices dentro de ±20 m), congela — cortes seguintes não mudam mais nada. Uma volta
// divergente ANTES de congelar reinicia a contagem de consistência (não o aprendizado inteiro).
//
// Domain PURO: sem relógio, sem IO. O perfil é CIRCULAR (dist 0 == fim da volta = linha aprendida).

namespace P1Fast.Cockpit.Domain;

public sealed class CortadorTrechos
{
    private readonly double _passoM;
    private readonly double _proeminenciaMinKmh;
    private readonly double _separacaoMinM;
    private readonly double _larguraLinhaM;
    private readonly double _toleranciaCongelaM;

    // Perfis reamostrados (N bins fixos, fração da volta) — um por volta vista.
    private readonly List<double[]> _kmhPorVolta = new();
    private readonly List<PontoGps[]> _ptsPorVolta = new();
    private int _n;                 // nº de bins circulares (fixado na 1ª volta)
    private double _refLenM;        // comprimento de referência (1ª volta) — eixo em metros
    private ResultadoCorte? _corteAnterior;

    public bool Congelado { get; private set; }
    public IReadOnlyList<TrechoSegmento>? Segmentos { get; private set; }

    public CortadorTrechos(
        double passoM = 5.0,
        double proeminenciaMinKmh = 8.0,
        double separacaoMinM = 50.0,
        double larguraLinhaM = 40.0,
        double toleranciaCongelaM = 20.0)
    {
        _passoM = passoM > 0 ? passoM : 5.0;
        _proeminenciaMinKmh = proeminenciaMinKmh;
        _separacaoMinM = separacaoMinM;
        _larguraLinhaM = larguraLinhaM;
        _toleranciaCongelaM = toleranciaCongelaM;
    }

    /// <summary>Ingere uma volta fechada. Devolve null até CONGELAR; depois de congelado devolve
    /// sempre a MESMA lista de trechos (e ignora novas voltas).</summary>
    public IReadOnlyList<TrechoSegmento>? Ingest(VoltaMapeada volta)
    {
        if (Congelado) return Segmentos;
        ArgumentNullException.ThrowIfNull(volta);
        if (volta.Pontos is null || volta.Pontos.Count < 3) return null;

        var lenM = volta.Pontos[^1].DistM;
        if (!(lenM > 0) || double.IsNaN(lenM) || double.IsInfinity(lenM)) return null;

        // 1ª volta fixa o eixo de referência (metros) e o nº de bins circulares.
        if (_kmhPorVolta.Count == 0)
        {
            _refLenM = lenM;
            _n = Math.Max(8, (int)Math.Round(_refLenM / _passoM));
        }

        var (kmh, pts) = Reamostrar(volta, _n);
        _kmhPorVolta.Add(kmh);
        _ptsPorVolta.Add(pts);

        var novo = Cortar(MediaKmh(), MediaPts());
        if (novo is null) return null;   // não deu pra cortar ainda (sem ápice claro)

        if (_corteAnterior is not null && Consistente(_corteAnterior, novo))
        {
            Congelado = true;
            Segmentos = novo.Segmentos;
            _corteAnterior = novo;
            return Segmentos;
        }

        _corteAnterior = novo;
        return null;
    }

    // ── Reamostragem por FRAÇÃO da volta → N bins circulares ────────────────
    // Bin i cobre a fração i/N da volta; como toda volta começa na linha aprendida (dist 0),
    // bin i alinha entre voltas mesmo com pequena variação de comprimento (normaliza esticando).

    private (double[] Kmh, PontoGps[] Pts) Reamostrar(VoltaMapeada volta, int n)
    {
        var lenM = volta.Pontos[^1].DistM;
        var kmh = new double[n];
        var pts = new PontoGps[n];
        for (var i = 0; i < n; i++)
        {
            var d = (i / (double)n) * lenM;
            (kmh[i], pts[i]) = InterpolarEm(volta.Pontos, d);
        }
        return (kmh, pts);
    }

    private static (double Kmh, PontoGps P) InterpolarEm(IReadOnlyList<AmostraTrilha> pontos, double dist)
    {
        // pontos em ordem de DistM crescente. Clampa nas pontas.
        if (dist <= pontos[0].DistM) return (pontos[0].Kmh, pontos[0].P);
        var ultimo = pontos[^1];
        if (dist >= ultimo.DistM) return (ultimo.Kmh, ultimo.P);

        var lo = 0;
        var hi = pontos.Count - 1;
        while (hi - lo > 1)
        {
            var mid = (lo + hi) / 2;
            if (pontos[mid].DistM <= dist) lo = mid; else hi = mid;
        }
        var a = pontos[lo];
        var b = pontos[hi];
        var span = b.DistM - a.DistM;
        var f = span > 1e-9 ? (dist - a.DistM) / span : 0.0;
        var kmh = a.Kmh + (b.Kmh - a.Kmh) * f;
        var lat = a.P.Lat + (b.P.Lat - a.P.Lat) * f;
        var lng = a.P.Lng + (b.P.Lng - a.P.Lng) * f;
        return (kmh, new PontoGps(lat, lng));
    }

    private double[] MediaKmh()
    {
        var media = new double[_n];
        for (var i = 0; i < _n; i++)
        {
            double soma = 0;
            foreach (var v in _kmhPorVolta) soma += v[i];
            media[i] = soma / _kmhPorVolta.Count;
        }
        return media;
    }

    private PontoGps[] MediaPts()
    {
        var media = new PontoGps[_n];
        for (var i = 0; i < _n; i++)
        {
            double sLat = 0, sLng = 0;
            foreach (var v in _ptsPorVolta) { sLat += v[i].Lat; sLng += v[i].Lng; }
            media[i] = new PontoGps(sLat / _ptsPorVolta.Count, sLng / _ptsPorVolta.Count);
        }
        return media;
    }

    // ── O corte propriamente dito ───────────────────────────────────────────

    private ResultadoCorte? Cortar(double[] kmh, PontoGps[] pts)
    {
        var n = kmh.Length;
        var passo = _refLenM / n;   // metros por bin (circular)

        double DistM(int i) => i * passo;
        double ArcoM(int de, int ate) => (((ate - de) % n + n) % n) * passo;   // arco pra FRENTE

        // 1) mínimos locais (circular): candidatos a ápice.
        var mins = new List<int>();
        for (var i = 0; i < n; i++)
        {
            var prev = kmh[(i - 1 + n) % n];
            var next = kmh[(i + 1) % n];
            if (kmh[i] <= prev && kmh[i] < next) mins.Add(i);
        }
        if (mins.Count == 0) return null;

        // 2) filtro de PROEMINÊNCIA: remove o mínimo mais raso abaixo do limiar, iterando.
        //    Proeminência = min(pico à esquerda, pico à direita) - velocidade do mínimo.
        double PicoEntre(int a, int b)   // maior kmh no arco (a -> b) pra frente, exclusivo nas pontas
        {
            var maior = double.NegativeInfinity;
            var passos = (((b - a) % n) + n) % n;
            for (var k = 1; k < passos; k++)
            {
                var idx = (a + k) % n;
                if (kmh[idx] > maior) maior = kmh[idx];
            }
            return double.IsNegativeInfinity(maior) ? Math.Max(kmh[a], kmh[b]) : maior;
        }

        while (mins.Count > 1)
        {
            var piorProm = double.PositiveInfinity;
            var piorK = -1;
            for (var k = 0; k < mins.Count; k++)
            {
                var esq = mins[(k - 1 + mins.Count) % mins.Count];
                var dir = mins[(k + 1) % mins.Count];
                var picoEsq = PicoEntre(esq, mins[k]);
                var picoDir = PicoEntre(mins[k], dir);
                var prom = Math.Min(picoEsq, picoDir) - kmh[mins[k]];
                if (prom < piorProm) { piorProm = prom; piorK = k; }
            }
            if (piorProm < _proeminenciaMinKmh && piorK >= 0) mins.RemoveAt(piorK);
            else break;
        }

        // 3) filtro de SEPARAÇÃO: ápices muito próximos (< separacaoMinM) viram um só (fica o mais fundo).
        var mudou = true;
        while (mins.Count > 1 && mudou)
        {
            mudou = false;
            for (var k = 0; k < mins.Count; k++)
            {
                var prox = (k + 1) % mins.Count;
                if (ArcoM(mins[k], mins[prox]) < _separacaoMinM)
                {
                    var remover = kmh[mins[k]] >= kmh[mins[prox]] ? k : prox;
                    mins.RemoveAt(remover);
                    mudou = true;
                    break;
                }
            }
        }

        if (mins.Count == 0) return null;

        // ápices em ordem de DistM (mins já está crescente por construção).
        var apices = mins;
        var k0 = apices.Count;

        // 4) fronteiras = pico (máxima velocidade) entre ápices consecutivos (circular).
        //    bnd[k] fica ENTRE apex[k] e apex[k+1].
        var bnd = new int[k0];
        for (var k = 0; k < k0; k++)
            bnd[k] = ArgMaxArco(kmh, apices[k], apices[(k + 1) % k0], n);

        // 5) monta os TrechoSegmento: entrada = fronteira ANTES do ápice, saída = fronteira DEPOIS.
        var segs = new List<TrechoSegmento>(k0);
        var apiceDistM = new double[k0];
        var fronteiraDistM = new double[k0];
        for (var k = 0; k < k0; k++)
        {
            var apiceIdx = apices[k];
            var entradaIdx = bnd[(k - 1 + k0) % k0];
            var saidaIdx = bnd[k];

            var id = "t" + (k + 1).ToString("D2");
            var nome = "T" + (k + 1);
            segs.Add(new TrechoSegmento(
                id, nome,
                LinhaPerpendicular(pts, entradaIdx, n),
                pts[apiceIdx],
                LinhaPerpendicular(pts, saidaIdx, n)));

            apiceDistM[k] = DistM(apiceIdx);
            fronteiraDistM[k] = DistM(saidaIdx);
        }

        return new ResultadoCorte(segs, apiceDistM, fronteiraDistM);
    }

    private static int ArgMaxArco(double[] kmh, int de, int ate, int n)
    {
        // maior velocidade no arco (de -> ate) pra frente, incluindo as pontas.
        var passos = (((ate - de) % n) + n) % n;
        var melhorIdx = de;
        var melhor = kmh[de];
        for (var k = 0; k <= passos; k++)
        {
            var idx = (de + k) % n;
            if (kmh[idx] > melhor) { melhor = kmh[idx]; melhorIdx = idx; }
        }
        return melhorIdx;
    }

    // Segmento PERPENDICULAR ao rumo local da trilha no ponto de fronteira, ~larguraLinhaM de largura.
    private LinhaGps LinhaPerpendicular(PontoGps[] pts, int i, int n)
    {
        var antes = pts[(i - 1 + n) % n];
        var depois = pts[(i + 1) % n];
        var rumo = Ghost.BearingDeg(antes, depois);
        var perp = rumo + 90.0;
        var meia = _larguraLinhaM / 2.0;
        var a = Deslocar(pts[i], perp, meia);
        var b = Deslocar(pts[i], perp, -meia);
        return new LinhaGps(a, b);
    }

    private const double Deg2Rad = Math.PI / 180.0;
    private const double MPorGrauLat = 111_132.0;

    private static PontoGps Deslocar(PontoGps p, double rumoDeg, double metros)
    {
        var rad = rumoDeg * Deg2Rad;
        var mPorGrauLng = 111_320.0 * Math.Cos(p.Lat * Deg2Rad);
        var dLat = (metros * Math.Cos(rad)) / MPorGrauLat;
        var dLng = mPorGrauLng > 1e-6 ? (metros * Math.Sin(rad)) / mPorGrauLng : 0.0;
        return new PontoGps(p.Lat + dLat, p.Lng + dLng);
    }

    // ── Consistência entre cortes (D1) ──────────────────────────────────────

    private bool Consistente(ResultadoCorte a, ResultadoCorte b)
    {
        if (a.Segmentos.Count != b.Segmentos.Count) return false;
        for (var k = 0; k < a.ApiceDistM.Length; k++)
        {
            if (Math.Abs(a.ApiceDistM[k] - b.ApiceDistM[k]) > _toleranciaCongelaM) return false;
            if (Math.Abs(a.FronteiraDistM[k] - b.FronteiraDistM[k]) > _toleranciaCongelaM) return false;
        }
        return true;
    }

    private sealed record ResultadoCorte(
        IReadOnlyList<TrechoSegmento> Segmentos,
        double[] ApiceDistM,
        double[] FronteiraDistM);
}
