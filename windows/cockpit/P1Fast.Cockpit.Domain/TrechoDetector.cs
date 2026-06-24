// TrechoDetector — porte fiel de web/cockpit/trecho-detector.js. Detector AO VIVO
// dos quatro momentos canônicos de cada trecho (curva): cruzou a linha de entrada,
// começou a frear, cruzou o ponto de ápice, cruzou a linha de saída. É a peça que
// dá o `sub` (entrada/freio/apice/saida) e a posição que o DeltaCalculator consome.
//
// Spec: PLANO_FASE_1.md §6 MS-13.5. Algoritmo idêntico ao JS:
//   - cruzamento de linha = sinal do produto vetorial (sideOfLine) muda entre
//     amostras consecutivas, CONFIRMADO por interseção real do segmento caminho×linha
//     (caminhoCruzaLinha, folga de 50% nas pontas) — sem isso o prolongamento
//     infinito da linha cortaria a pista inteira (achado no replay real de 10/06);
//   - início de freada = média móvel (5 amostras) da desaceleração longitudinal
//     cruza -0,5 g (robusto sem sensor de pedal do T4000);
//   - ápice = mínimo local da distância ao ponto ideal (≤ 60 m, sanidade física);
//   - ressincronização = vigia paralelo das entradas de TODOS os trechos: se o carro
//     cruza a entrada de OUTRO trecho (porque o atual foi perdido), reengata no real
//     sem inventar medição — 1 curva perdida não cega mais o resto da volta.
//
// Puro e sem IO (igual ao resto do domínio): o chamador empurra GPS e recebe os
// eventos via callback. Quem dá os segmentos (semente da pista ou banco) é o chamador.

namespace P1Fast.Cockpit.Domain;

/// <summary>Linha de pista (entrada ou saída), definida por duas pontas GPS.</summary>
public readonly record struct GpsLinha(GpsPonto A, GpsPonto B);

/// <summary>
/// Segmento (curva) da pista: a linha que abre o trecho, o ponto ideal de ápice
/// (opcional) e a linha que fecha o trecho.
/// </summary>
public sealed record TrechoSegmento(
    string Id,
    string? Nome,
    GpsLinha EntradaLine,
    GpsPonto? ApicePoint,
    GpsLinha SaidaLine);

/// <summary>Fase do carro dentro de um trecho.</summary>
public enum TrechoFase
{
    AntesEntrada,
    EntradaFreio,
    FreioApice,
    ApiceSaida,
    PosSaida,
}

/// <summary>
/// Evento emitido pelo detector. <c>Type</c> ∈ entrada-cruzou | freada-iniciou |
/// apice-cruzou | saida-cruzou | resync. Os campos extras são preenchidos conforme
/// o tipo (null quando não se aplicam) — paridade com os objetos de evento do JS.
/// </summary>
public sealed record TrechoEvento(
    string Type,
    string? SegmentId,
    long T,
    double Kmh,
    double? DistFromEntradaM = null,
    double? DistFromIdealM = null,
    double? AngleFromIdealDeg = null,
    bool Completed = false,
    bool FechamentoDeEmergencia = false,
    string? DeSegmentId = null,
    string? ParaSegmentId = null);

/// <summary>Geometria pura, exportada pra teste isolado (igual aos exports do JS).</summary>
public static class TrechoGeometria
{
    private const double Deg2Rad = Math.PI / 180;
    private const double Rad2Deg = 180 / Math.PI;
    private const double EarthRM = 6_378_137;

    /// <summary>Distância aproximada em metros entre dois pontos GPS (equirectangular).</summary>
    public static double DistMeters(GpsPonto a, GpsPonto b)
    {
        double lat1 = a.Lat * Deg2Rad;
        double lat2 = b.Lat * Deg2Rad;
        double dLat = lat2 - lat1;
        double dLng = (b.Lng - a.Lng) * Deg2Rad;
        double x = dLng * Math.Cos((lat1 + lat2) / 2);
        double y = dLat;
        return Math.Sqrt(x * x + y * y) * EarthRM;
    }

    /// <summary>
    /// Lado da linha a→b em que o ponto p está (sinal do produto vetorial 2D no plano
    /// lat-lng): &gt;0 esquerda, &lt;0 direita, =0 sobre a linha.
    /// </summary>
    public static double SideOfLine(GpsPonto p, GpsPonto a, GpsPonto b) =>
        (b.Lng - a.Lng) * (p.Lat - a.Lat) - (b.Lat - a.Lat) * (p.Lng - a.Lng);

    /// <summary>
    /// O caminho p0→p1 cruza o SEGMENTO a–b de verdade? Projeção local (metros),
    /// folga de 50% em cada ponta da linha.
    /// </summary>
    public static bool CaminhoCruzaLinha(GpsPonto p0, GpsPonto p1, GpsPonto a, GpsPonto b)
    {
        const double kLat = 110540;
        double kLng = 111320 * Math.Cos(a.Lat * Math.PI / 180);
        double X(GpsPonto q) => (q.Lng - a.Lng) * kLng;
        double Y(GpsPonto q) => (q.Lat - a.Lat) * kLat;

        double rx = X(p1) - X(p0), ry = Y(p1) - Y(p0);
        double dx = X(b),          dy = Y(b);
        double den = rx * dy - ry * dx;
        if (Math.Abs(den) < 1e-9) return false;

        double qpx = -X(p0), qpy = -Y(p0);
        double v = (qpx * dy - qpy * dx) / den;
        double u = (qpx * ry - qpy * rx) / den;
        return v >= 0 && v <= 1 && u >= -0.5 && u <= 1.5;
    }

    /// <summary>Heading em graus (0=norte, 90=leste) de "from" para "to".</summary>
    public static double BearingDeg(GpsPonto from, GpsPonto to)
    {
        double lat1 = from.Lat * Deg2Rad;
        double lat2 = to.Lat * Deg2Rad;
        double dLng = (to.Lng - from.Lng) * Deg2Rad;
        double y = Math.Sin(dLng) * Math.Cos(lat2);
        double x = Math.Cos(lat1) * Math.Sin(lat2) -
                   Math.Sin(lat1) * Math.Cos(lat2) * Math.Cos(dLng);
        return (Math.Atan2(y, x) * Rad2Deg + 360) % 360;
    }

    /// <summary>
    /// Ângulo (0..360) do vetor erro carro→ápice no referencial do carro (heading = 0°):
    /// 0° ápice à frente, 90° à direita, 180° atrás, 270° à esquerda.
    /// </summary>
    public static double ApexErrorAngleDeg(GpsPonto carPos, double carHeadingDeg, GpsPonto apexIdealPos)
    {
        double bearingToApex = BearingDeg(carPos, apexIdealPos);
        return (bearingToApex - carHeadingDeg + 360) % 360;
    }
}

public sealed class TrechoDetector
{
    private const double FreadaLimiarG = 0.5;
    private const int FreadaJanela = 5;
    private const double HeadingMinDistM = 1.0;
    private const double ApiceDistMaxM = 60;

    private readonly IReadOnlyList<TrechoSegmento> _segments;
    private readonly Action<TrechoEvento> _onEvent;

    private int _currentIdx;
    private TrechoFase _phase;
    private Amostra? _last;
    private double? _lastEntradaSide;
    private double? _lastSaidaSide;
    private double?[] _entradaSides = Array.Empty<double?>();
    private GpsPonto? _entradaPos;
    private double _lastApiceDist;
    private bool _apiceCrossed;
    private readonly List<double> _decelWindow = new();

    public TrechoDetector(IReadOnlyList<TrechoSegmento> segments, Action<TrechoEvento>? onEvent = null)
    {
        if (segments is null || segments.Count == 0)
            throw new ArgumentException("TrechoDetector: segments é obrigatório (array não-vazio)");
        _segments = segments;
        _onEvent = onEvent ?? (_ => { });
        Reset();
    }

    private void Reset()
    {
        _currentIdx = 0;
        _phase = TrechoFase.AntesEntrada;
        _last = null;
        _lastEntradaSide = null;
        _lastSaidaSide = null;
        _entradaSides = new double?[_segments.Count];
        _entradaPos = null;
        _lastApiceDist = double.PositiveInfinity;
        _apiceCrossed = false;
        _decelWindow.Clear();
    }

    /// <summary>Posiciona o detector num segmento específico (pra retomar).</summary>
    public void SetSegment(int index)
    {
        if (index < 0 || index >= _segments.Count)
            throw new ArgumentException("TrechoDetector: índice fora dos segmentos");
        _currentIdx = index;
        _phase = TrechoFase.AntesEntrada;
        _last = null;
        _lastEntradaSide = null;
        _lastSaidaSide = null;
        _entradaPos = null;
        _lastApiceDist = double.PositiveInfinity;
        _apiceCrossed = false;
        _decelWindow.Clear();
    }

    private void Advance()
    {
        _currentIdx = (_currentIdx + 1) % _segments.Count;
        _phase = TrechoFase.AntesEntrada;
        _lastEntradaSide = null;
        _lastSaidaSide = null;
        _entradaPos = null;
        _lastApiceDist = double.PositiveInfinity;
        _apiceCrossed = false;
        _decelWindow.Clear();
    }

    public int CurrentSegmentIdx => _currentIdx;
    public string? CurrentSegmentId => _segments[_currentIdx].Id;
    public TrechoFase Phase => _phase;

    /// <summary>
    /// Ingere uma amostra GPS. <paramref name="headingDeg"/> é opcional (course do
    /// CLLocation); se ausente, é calculado entre amostras. Dispara os eventos via callback.
    /// </summary>
    public void IngestGps(double lat, double lng, double kmh, long t, double? headingDeg = null)
    {
        if (double.IsNaN(lat) || double.IsNaN(lng) || double.IsInfinity(lat) || double.IsInfinity(lng))
            return;

        var seg = _segments[_currentIdx];
        var pAtual = new GpsPonto(lat, lng);

        // heading: usa o do GPS se vier, senão calcula entre amostras
        if ((headingDeg is null || !double.IsFinite(headingDeg.Value)) && _last is { } lastH)
        {
            var pLastH = new GpsPonto(lastH.Lat, lastH.Lng);
            if (TrechoGeometria.DistMeters(pLastH, pAtual) >= HeadingMinDistM)
                headingDeg = TrechoGeometria.BearingDeg(pLastH, pAtual);
        }

        // deceleração desde a última amostra (g)
        if (_last is { } lastD)
        {
            double dt = Math.Max(0.001, (t - lastD.T) / 1000.0);
            double lastKmh = double.IsFinite(lastD.Kmh) ? lastD.Kmh : 0;
            double dv = (kmh - lastKmh) / 3.6; // m/s
            double aG = (dv / dt) / 9.80665;
            _decelWindow.Add(aG);
            if (_decelWindow.Count > FreadaJanela) _decelWindow.RemoveAt(0);
        }
        double avgDecel = _decelWindow.Count > 0 ? _decelWindow.Average() : 0;

        // ── cruzamento da linha de entrada ──
        // O vigia paralelo (_entradaSides) é a memória do lado anterior: sobrevive ao
        // avanço de trecho (sem o "tick cego" que perdia a curva seguinte com reta curta).
        double entradaSide = TrechoGeometria.SideOfLine(pAtual, seg.EntradaLine.A, seg.EntradaLine.B);
        double? ladoAnteriorEntrada = _entradaSides[_currentIdx] ?? _lastEntradaSide;
        if (ladoAnteriorEntrada is { } lae
            && Math.Sign(entradaSide) != Math.Sign(lae)
            && (_last is not { } le || TrechoGeometria.CaminhoCruzaLinha(
                    new GpsPonto(le.Lat, le.Lng), pAtual, seg.EntradaLine.A, seg.EntradaLine.B))
            && _phase == TrechoFase.AntesEntrada)
        {
            _phase = TrechoFase.EntradaFreio;
            _entradaPos = pAtual;
            _onEvent(new TrechoEvento("entrada-cruzou", seg.Id, t, kmh));
        }
        _lastEntradaSide = entradaSide;

        // ── início da freada ──
        if (_phase == TrechoFase.EntradaFreio && avgDecel <= -FreadaLimiarG)
        {
            double distFromEntradaM = _entradaPos is { } ep
                ? TrechoGeometria.DistMeters(ep, pAtual) : 0;
            _phase = TrechoFase.FreioApice;
            _onEvent(new TrechoEvento("freada-iniciou", seg.Id, t, kmh, DistFromEntradaM: distFromEntradaM));
        }

        // ── ápice (mínimo de distância ao ponto ideal) ──
        if ((_phase == TrechoFase.FreioApice || _phase == TrechoFase.EntradaFreio)
            && seg.ApicePoint is { } apice)
        {
            double distToApex = TrechoGeometria.DistMeters(pAtual, apice);
            if (distToApex < _lastApiceDist)
            {
                _lastApiceDist = distToApex;
            }
            else if (!_apiceCrossed && _lastApiceDist < ApiceDistMaxM)
            {
                // distância começou a aumentar → cruzou o ponto mais próximo
                _apiceCrossed = true;
                _phase = TrechoFase.ApiceSaida;
                double? angleDeg = (headingDeg is { } hd && double.IsFinite(hd))
                    ? TrechoGeometria.ApexErrorAngleDeg(
                        _last is { } lc ? new GpsPonto(lc.Lat, lc.Lng) : pAtual, hd, apice)
                    : (double?)null;
                _onEvent(new TrechoEvento("apice-cruzou", seg.Id, t, kmh,
                    DistFromIdealM: _lastApiceDist, AngleFromIdealDeg: angleDeg));
            }
        }

        // ── cruzamento da linha de saída ──
        // Fecha a partir de qualquer fase INTERNA. Ápice não reconhecido → fecha com o
        // melhor que viu (mínimo observado, ou null se nunca chegou perto — NUNCA inventa).
        double saidaSide = TrechoGeometria.SideOfLine(pAtual, seg.SaidaLine.A, seg.SaidaLine.B);
        bool dentroDoTrecho = _phase == TrechoFase.EntradaFreio
            || _phase == TrechoFase.FreioApice
            || _phase == TrechoFase.ApiceSaida;
        if (_lastSaidaSide is { } lss
            && Math.Sign(saidaSide) != Math.Sign(lss)
            && (_last is not { } ls || TrechoGeometria.CaminhoCruzaLinha(
                    new GpsPonto(ls.Lat, ls.Lng), pAtual, seg.SaidaLine.A, seg.SaidaLine.B))
            && dentroDoTrecho)
        {
            if (!_apiceCrossed)
            {
                _onEvent(new TrechoEvento("apice-cruzou", seg.Id, t, kmh,
                    DistFromIdealM: _lastApiceDist < double.PositiveInfinity ? _lastApiceDist : (double?)null,
                    AngleFromIdealDeg: null,
                    FechamentoDeEmergencia: true));
            }
            _phase = TrechoFase.PosSaida;
            _onEvent(new TrechoEvento("saida-cruzou", seg.Id, t, kmh, Completed: true));
            Advance();
            _last = new Amostra(lat, lng, kmh, t);
            AtualizarLadosEntradas(pAtual);
            return;
        }
        _lastSaidaSide = saidaSide;

        // ── RESSINCRONIZAÇÃO: vigia paralelo das entradas de TODOS os trechos ──
        int? cruzouOutra = DetectarEntradaDeOutro(pAtual);
        if (cruzouOutra is { } novoIdx && novoIdx != _currentIdx)
        {
            string de = seg.Id;
            _currentIdx = novoIdx;
            var novo = _segments[_currentIdx];
            _phase = TrechoFase.EntradaFreio;
            _entradaPos = pAtual;
            _lastSaidaSide = null;
            _lastApiceDist = double.PositiveInfinity;
            _apiceCrossed = false;
            _decelWindow.Clear();
            _onEvent(new TrechoEvento("resync", null, t, 0, DeSegmentId: de, ParaSegmentId: novo.Id));
            _onEvent(new TrechoEvento("entrada-cruzou", novo.Id, t, kmh));
        }
        AtualizarLadosEntradas(pAtual);

        _last = new Amostra(lat, lng, kmh, t);
    }

    /// <summary>Atualiza o lado de cada linha de entrada (estado do vigia paralelo).</summary>
    private void AtualizarLadosEntradas(GpsPonto p)
    {
        for (int j = 0; j < _segments.Count; j++)
        {
            var sj = _segments[j];
            _entradaSides[j] = TrechoGeometria.SideOfLine(p, sj.EntradaLine.A, sj.EntradaLine.B);
        }
    }

    /// <summary>Algum OUTRO trecho teve a entrada cruzada nesta amostra? Índice ou null.</summary>
    private int? DetectarEntradaDeOutro(GpsPonto p)
    {
        if (_last is not { } last) return null;
        var pLast = new GpsPonto(last.Lat, last.Lng);
        int n = _segments.Count;
        // varre na ordem da volta a partir do trecho atual (o mais provável primeiro)
        for (int passo = 1; passo < n; passo++)
        {
            int j = (_currentIdx + passo) % n;
            var sj = _segments[j];
            double lado = TrechoGeometria.SideOfLine(p, sj.EntradaLine.A, sj.EntradaLine.B);
            double? anterior = _entradaSides[j];
            if (anterior is { } ant
                && Math.Sign(lado) != Math.Sign(ant)
                && TrechoGeometria.CaminhoCruzaLinha(pLast, p, sj.EntradaLine.A, sj.EntradaLine.B))
            {
                return j;
            }
        }
        return null;
    }

    // Última amostra GPS guardada (lat/lng pra geometria, kmh/t pra deceleração).
    private readonly record struct Amostra(double Lat, double Lng, double Kmh, long T);
}
