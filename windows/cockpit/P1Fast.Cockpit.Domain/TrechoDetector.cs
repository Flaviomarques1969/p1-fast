// TrechoDetector — diz em QUAL curva o carro está e dispara os 4 momentos do
// trecho (entrou / começou a freada / passou no ápice / saiu), processando o
// GPS contínuo. Port fiel de web/cockpit/trecho-detector.js.
//
// Tem um "vigia paralelo" de TODAS as entradas: se o carro perde uma curva
// (ruído/semente imprecisa), ele engata na curva onde o carro REALMENTE está,
// sem inventar medição — assim uma curva perdida não cega o resto da volta.

namespace P1Fast.Cockpit.Domain;

/// <summary>Linha (barra) entre dois pontos GPS.</summary>
public sealed record LinhaGps(PontoGps A, PontoGps B);

/// <summary>Uma curva da pista: linha de entrada, ponto de ápice, linha de saída.</summary>
public sealed record TrechoSegmento(string Id, string Nome, LinhaGps EntradaLine, PontoGps ApicePoint, LinhaGps SaidaLine);

/// <summary>Amostra de GPS pro detector.</summary>
public sealed record AmostraGps(double Lat, double Lng, double Kmh = 0, double T = 0, double? HeadingDeg = null);

public enum TrechoFase { AntesEntrada, EntradaFreio, FreioApice, ApiceSaida, PosSaida }

/// <summary>Evento do detector (entrada/freada/ápice/saída/resync).</summary>
public sealed record TrechoEvento(
    string Type, string SegmentId, double T, double Kmh,
    double? DistFromEntradaM = null, double? DistFromIdealM = null, double? AngleFromIdealDeg = null,
    bool Completed = false, bool FechamentoDeEmergencia = false, string? DeSegmentId = null, string? ParaSegmentId = null);

public sealed class TrechoDetector
{
    private const double FreadaLimiarG = 0.5;
    private const int    FreadaJanela  = 5;
    private const double HeadingMinDistM = 1.0;
    private const double ApiceDistMaxM = 60;

    private readonly IReadOnlyList<TrechoSegmento> _segments;
    private readonly Action<TrechoEvento> _onEvent;

    private int _currentIdx;
    private TrechoFase _phase;
    private AmostraGps? _last;
    private double? _lastEntradaSide;
    private double? _lastSaidaSide;
    private readonly double?[] _entradaSides;
    private PontoGps? _entradaPos;
    private double _lastApiceDist;
    private bool _apiceCrossed;
    private readonly List<double> _decelWindow = new();

    public TrechoDetector(IReadOnlyList<TrechoSegmento> segments, Action<TrechoEvento>? onEvent = null)
    {
        if (segments is null || segments.Count == 0)
            throw new ArgumentException("TrechoDetector: segments é obrigatório (não-vazio)");
        _segments = segments;
        _onEvent = onEvent ?? (_ => { });
        _entradaSides = new double?[segments.Count];
        Reset();
    }

    private void Reset()
    {
        _currentIdx = 0;
        _phase = TrechoFase.AntesEntrada;
        _last = null;
        _lastEntradaSide = null;
        _lastSaidaSide = null;
        Array.Clear(_entradaSides, 0, _entradaSides.Length);
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

    public (int Idx, string? Id, TrechoFase Fase) GetState() => (_currentIdx, _segments[_currentIdx]?.Id, _phase);

    // ── Geometria local (port de trecho-detector.js) ────────────────

    public static double SideOfLine(PontoGps p, PontoGps a, PontoGps b)
        => (b.Lng - a.Lng) * (p.Lat - a.Lat) - (b.Lat - a.Lat) * (p.Lng - a.Lng);

    public static bool CaminhoCruzaLinha(PontoGps p0, PontoGps p1, PontoGps a, PontoGps b)
    {
        var kLat = 110540.0;
        var kLng = 111320.0 * Math.Cos(a.Lat * Math.PI / 180.0);
        double X(PontoGps q) => (q.Lng - a.Lng) * kLng;
        double Y(PontoGps q) => (q.Lat - a.Lat) * kLat;
        var rx = X(p1) - X(p0); var ry = Y(p1) - Y(p0);
        var dx = X(b); var dy = Y(b);
        var den = rx * dy - ry * dx;
        if (Math.Abs(den) < 1e-9) return false;
        var qpx = -X(p0); var qpy = -Y(p0);
        var v = (qpx * dy - qpy * dx) / den;
        var u = (qpx * ry - qpy * rx) / den;
        return v >= 0 && v <= 1 && u >= -0.5 && u <= 1.5;
    }

    private static int Sign(double v) => Math.Sign(v);

    public void IngestGps(AmostraGps sample)
    {
        if (sample is null) return;
        var seg = _segments[_currentIdx];
        var t = sample.T;
        var kmh = sample.Kmh;

        // heading: usa o do GPS se vier, senão calcula entre amostras
        double? headingDeg = sample.HeadingDeg;
        if ((headingDeg is null || double.IsNaN(headingDeg.Value)) && _last is not null)
        {
            if (Ghost.DistMeters(P(_last), P(sample)) >= HeadingMinDistM)
                headingDeg = Ghost.BearingDeg(P(_last), P(sample));
        }

        // deceleração desde a última amostra (g)
        if (_last is not null)
        {
            var dt = Math.Max(0.001, (t - _last.T) / 1000.0);
            var dv = (kmh - _last.Kmh) / 3.6;
            var aG = (dv / dt) / 9.80665;
            _decelWindow.Add(aG);
            if (_decelWindow.Count > FreadaJanela) _decelWindow.RemoveAt(0);
        }
        var avgDecel = _decelWindow.Count > 0 ? _decelWindow.Average() : 0;

        // ── Cruzamento da linha de entrada ──
        var entradaSide = SideOfLine(P(sample), seg.EntradaLine.A, seg.EntradaLine.B);
        var ladoAnteriorEntrada = _entradaSides[_currentIdx] ?? _lastEntradaSide;
        if (ladoAnteriorEntrada is { } lae
            && Sign(entradaSide) != Sign(lae)
            && (_last is null || CaminhoCruzaLinha(P(_last), P(sample), seg.EntradaLine.A, seg.EntradaLine.B))
            && _phase == TrechoFase.AntesEntrada)
        {
            _phase = TrechoFase.EntradaFreio;
            _entradaPos = P(sample);
            _onEvent(new TrechoEvento("entrada-cruzou", seg.Id, t, kmh));
        }
        _lastEntradaSide = entradaSide;

        // ── Início da freada ──
        if (_phase == TrechoFase.EntradaFreio && avgDecel <= -FreadaLimiarG)
        {
            var distFromEntradaM = _entradaPos is { } ep ? Ghost.DistMeters(ep, P(sample)) : 0;
            _phase = TrechoFase.FreioApice;
            _onEvent(new TrechoEvento("freada-iniciou", seg.Id, t, kmh, DistFromEntradaM: distFromEntradaM));
        }

        // ── Ápice (mínimo de distância ao ponto ideal) ──
        if (_phase is TrechoFase.FreioApice or TrechoFase.EntradaFreio)
        {
            var distToApex = Ghost.DistMeters(P(sample), seg.ApicePoint);
            if (distToApex < _lastApiceDist) _lastApiceDist = distToApex;
            else if (!_apiceCrossed && _lastApiceDist < ApiceDistMaxM)
            {
                _apiceCrossed = true;
                _phase = TrechoFase.ApiceSaida;
                double? angleDeg = headingDeg is { } h && !double.IsNaN(h)
                    ? Ghost.ApexErrorAngleDeg(_last is not null ? P(_last) : P(sample), h, seg.ApicePoint)
                    : null;
                _onEvent(new TrechoEvento("apice-cruzou", seg.Id, t, kmh, DistFromIdealM: _lastApiceDist, AngleFromIdealDeg: angleDeg));
            }
        }

        // ── Cruzamento da linha de saída ──
        var saidaSide = SideOfLine(P(sample), seg.SaidaLine.A, seg.SaidaLine.B);
        var dentroDoTrecho = _phase is TrechoFase.EntradaFreio or TrechoFase.FreioApice or TrechoFase.ApiceSaida;
        if (_lastSaidaSide is { } lss
            && Sign(saidaSide) != Sign(lss)
            && (_last is null || CaminhoCruzaLinha(P(_last), P(sample), seg.SaidaLine.A, seg.SaidaLine.B))
            && dentroDoTrecho)
        {
            if (!_apiceCrossed)
                _onEvent(new TrechoEvento("apice-cruzou", seg.Id, t, kmh,
                    DistFromIdealM: double.IsInfinity(_lastApiceDist) ? null : _lastApiceDist,
                    AngleFromIdealDeg: null, FechamentoDeEmergencia: true));
            _phase = TrechoFase.PosSaida;
            _onEvent(new TrechoEvento("saida-cruzou", seg.Id, t, kmh, Completed: true));
            Advance();
            _last = sample;
            AtualizarLadosEntradas(sample);
            return;
        }
        _lastSaidaSide = saidaSide;

        // ── Ressincronização: entrou em OUTRO trecho? ──
        var cruzouOutra = DetectarEntradaDeOutro(sample);
        if (cruzouOutra is { } co && co != _currentIdx)
        {
            var de = seg.Id;
            _currentIdx = co;
            var novo = _segments[_currentIdx];
            _phase = TrechoFase.EntradaFreio;
            _entradaPos = P(sample);
            _lastSaidaSide = null;
            _lastApiceDist = double.PositiveInfinity;
            _apiceCrossed = false;
            _decelWindow.Clear();
            _onEvent(new TrechoEvento("resync", novo.Id, t, kmh, DeSegmentId: de, ParaSegmentId: novo.Id));
            _onEvent(new TrechoEvento("entrada-cruzou", novo.Id, t, kmh));
        }
        AtualizarLadosEntradas(sample);

        _last = sample;
    }

    private void AtualizarLadosEntradas(AmostraGps sample)
    {
        for (var j = 0; j < _segments.Count; j++)
            _entradaSides[j] = SideOfLine(P(sample), _segments[j].EntradaLine.A, _segments[j].EntradaLine.B);
    }

    private int? DetectarEntradaDeOutro(AmostraGps sample)
    {
        if (_last is null) return null;
        var n = _segments.Count;
        for (var passo = 1; passo < n; passo++)
        {
            var j = (_currentIdx + passo) % n;
            var sj = _segments[j];
            var lado = SideOfLine(P(sample), sj.EntradaLine.A, sj.EntradaLine.B);
            var anterior = _entradaSides[j];
            if (anterior is { } ant
                && Sign(lado) != Sign(ant)
                && CaminhoCruzaLinha(P(_last), P(sample), sj.EntradaLine.A, sj.EntradaLine.B))
                return j;
        }
        return null;
    }

    private static PontoGps P(AmostraGps s) => new(s.Lat, s.Lng);
}
