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
// AccelXg/Yg/Zg: aceleração CRUA do aparelho (RaceBox), em g, no referencial do aparelho —
// NÃO é longitudinal/lateral ainda (o mapeamento do eixo é calibração de bancada, Flávio 2026-07-07).
// null quando a fonte não fornece (ex.: replay antigo). Ainda NÃO usado pelo cérebro — só carregado
// pro dia de bancada ligar a confirmação da troca de marcha pelo "tranco" longitudinal.
// AccelLongG/AccelLatG (item 1 da ordem de 27/10): G do CARRO pelo AceleracaoCarro — eixos provados
// (+gx frente, −gy lado) e zero aprendido no box; ZeroOk=false = ainda sem zero (não é medida fina).
// null quando a fonte não traz aceleração.
public sealed record AmostraGps(double Lat, double Lng, double Kmh = 0, double T = 0, double? HeadingDeg = null,
    double? AccelXg = null, double? AccelYg = null, double? AccelZg = null,
    double? AccelLongG = null, double? AccelLatG = null, bool ZeroOk = false);

public enum TrechoFase { AntesEntrada, EntradaFreio, FreioApice, ApiceSaida, PosSaida }

/// <summary>Evento do detector (entrada/freada/ápice/saída/resync).</summary>
public sealed record TrechoEvento(
    string Type, string SegmentId, double T, double Kmh,
    double? DistFromEntradaM = null, double? DistFromIdealM = null, double? AngleFromIdealDeg = null,
    bool Completed = false, bool FechamentoDeEmergencia = false, string? DeSegmentId = null, string? ParaSegmentId = null,
    // Item 4 (ordem de 27/10), só com G do carro (ZeroOk): "apice-pelo-g" traz GLatPico e KmhMin (menor km/h da
    // entrada até o ápice); "saida-cruzou" traz o resumo da curva — FreioNaCurvaS/M = tempo e metros freando
    // E virando juntos (longitudinal ≤ −0,10 G com lateral ≥ 0,15 G), GCombinadoMax e GLatPico (maior lateral).
    double? GLatPico = null, double? KmhMin = null, double? FreioNaCurvaS = null, double? FreioNaCurvaM = null,
    double? GCombinadoMax = null);

public sealed class TrechoDetector
{
    public const double FreadaLimiarPadraoG = 0.5;
    private const int    FreadaJanela  = 5;
    // Item 3 (ordem de 27/10): com o G do carro (zero aprendido) a freada é lida no acelerômetro —
    // mesmo limiar de 0,5 G para CONFIRMAR, e o ponto marcado é onde a desaceleração COMEÇOU
    // (1ª amostra da sequência contínua abaixo de −0,10 G; ruído do aparelho ~0,015 G, análise 27/10).
    // Sem G confiável (replay antigo, iPhone, zero ainda não aprendido) segue a conta pela velocidade.
    private const double FreadaInicioG = 0.10;
    // Item 4 (ordem de 27/10): ápice REAL = pico do G lateral (média de 5) dentro do trecho; confirmado quando a
    // média cai a 80% do pico. Pico abaixo do limiar (0,3 G padrão; curva de pista passa disso) = sem ápice pelo G,
    // fica o geométrico. Frear na curva = freio (≤ −0,10 G, o mesmo início da freada) com lateral ≥ 0,15 G
    // (o limiar de "curva" da análise de 27/10); cada intervalo conta no máximo 0,5 s (buraco no dado não infla).
    public const double ApiceLatLimiarPadraoG = 0.3;
    private const double ApiceConfirmaFracao = 0.8;
    private const double CurvaLatMinG = 0.15;
    private const double IntervaloMaxS = 0.5;
    private const double HeadingMinDistM = 1.0;
    private const double ApiceDistMaxM = 60;

    private readonly IReadOnlyList<TrechoSegmento> _segments;
    private readonly Action<TrechoEvento> _onEvent;
    private readonly double _freadaLimiarG;

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
    private bool? _decelPeloG;          // fonte da janela (true = acelerômetro); trocou → janela limpa
    private AmostraGps? _inicioFreada;  // onde a desaceleração atual começou (só pelo G)
    private readonly double _apiceLatLimiarG;
    private readonly Queue<(AmostraGps A, double Lat, double KmhMin)> _latWindow = new();
    private double _apiceGPico;
    private double _apiceGKmhMin;       // menor km/h da entrada até a amostra do pico
    private AmostraGps? _apiceGAmostra;
    private bool _apiceGEmitido;
    private double _kmhMinTrecho;
    private double _freioCurvaS, _freioCurvaM, _gCombMax, _gLatMax;
    private bool _temG;                 // o trecho teve G lateral confiável em alguma amostra
    private AmostraGps? _anteriorNoTrecho;

    /// <param name="freadaLimiarG">limiar de confirmação da freada (g). Padrão 0,5 G (o de sempre);
    /// outro valor só em prova de bancada (ex.: volta de rua, onde a freada não passa de 0,3 G).</param>
    /// <param name="apiceLatLimiarG">pico lateral mínimo para o ápice pelo G (padrão 0,3 G); outro valor só em prova.</param>
    public TrechoDetector(IReadOnlyList<TrechoSegmento> segments, Action<TrechoEvento>? onEvent = null,
        double freadaLimiarG = FreadaLimiarPadraoG, double apiceLatLimiarG = ApiceLatLimiarPadraoG)
    {
        _freadaLimiarG = freadaLimiarG;
        _apiceLatLimiarG = apiceLatLimiarG;
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
        _decelPeloG = null;
        _inicioFreada = null;
        ZerarCurvaG();
    }

    private void ZerarCurvaG()
    {
        _latWindow.Clear();
        _apiceGPico = 0;
        _apiceGKmhMin = double.PositiveInfinity;
        _apiceGAmostra = null;
        _apiceGEmitido = false;
        _kmhMinTrecho = double.PositiveInfinity;
        _freioCurvaS = _freioCurvaM = _gCombMax = _gLatMax = 0;
        _temG = false;
        _anteriorNoTrecho = null;
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
        _inicioFreada = null;
        ZerarCurvaG();
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

        // deceleração (g): pelo acelerômetro quando há G do carro com zero; senão desde a última amostra
        var peloG = sample.AccelLongG is { } gLong && double.IsFinite(gLong) && sample.ZeroOk;
        if (_decelPeloG is { } fonteAnt && fonteAnt != peloG) { _decelWindow.Clear(); _inicioFreada = null; }
        _decelPeloG = peloG;
        if (peloG)
        {
            _decelWindow.Add(sample.AccelLongG!.Value);
            if (_decelWindow.Count > FreadaJanela) _decelWindow.RemoveAt(0);
        }
        else if (_last is not null)
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
            _inicioFreada = null;
            ZerarCurvaG();
            _onEvent(new TrechoEvento("entrada-cruzou", seg.Id, t, kmh));
        }
        _lastEntradaSide = entradaSide;

        // ── Início da freada ──
        // Pelo G: acompanha onde a desaceleração começou depois da entrada (sequência contínua).
        if (_phase == TrechoFase.EntradaFreio && peloG)
        {
            if (sample.AccelLongG!.Value <= -FreadaInicioG) _inicioFreada ??= sample;
            else _inicioFreada = null;
        }
        if (_phase == TrechoFase.EntradaFreio && avgDecel <= -_freadaLimiarG)
        {
            var ponto = peloG && _inicioFreada is { } ini ? ini : sample;
            var distFromEntradaM = _entradaPos is { } ep ? Ghost.DistMeters(ep, P(ponto)) : 0;
            _phase = TrechoFase.FreioApice;
            _onEvent(new TrechoEvento("freada-iniciou", seg.Id, ponto.T, ponto.Kmh, DistFromEntradaM: distFromEntradaM));
        }

        // ── Item 4: ápice pelo pico do G lateral + frear na curva ──
        if (_phase is TrechoFase.EntradaFreio or TrechoFase.FreioApice or TrechoFase.ApiceSaida)
            AcompanharCurvaG(sample, seg, peloG);

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
            // pico ainda subindo na saída: o ápice pelo G sai aqui, marcado como fechamento de emergência
            if (!_apiceGEmitido && _apiceGAmostra is not null && _apiceGPico >= _apiceLatLimiarG)
                EmitirApiceG(seg, emergencia: true);
            _phase = TrechoFase.PosSaida;
            _onEvent(_temG
                ? new TrechoEvento("saida-cruzou", seg.Id, t, kmh, Completed: true,
                    GLatPico: _gLatMax, KmhMin: double.IsInfinity(_kmhMinTrecho) ? null : _kmhMinTrecho,
                    FreioNaCurvaS: _freioCurvaS, FreioNaCurvaM: _freioCurvaM, GCombinadoMax: _gCombMax)
                : new TrechoEvento("saida-cruzou", seg.Id, t, kmh, Completed: true));
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
            _inicioFreada = null;
            ZerarCurvaG();
            _onEvent(new TrechoEvento("resync", novo.Id, t, kmh, DeSegmentId: de, ParaSegmentId: novo.Id));
            _onEvent(new TrechoEvento("entrada-cruzou", novo.Id, t, kmh));
        }
        AtualizarLadosEntradas(sample);

        _last = sample;
    }

    // Dentro do trecho: menor km/h (até o ápice, ver a prova de 27/10: contar até a confirmação pegava a queda de
    // velocidade DEPOIS do ápice), pico do G lateral (média de 5, ponto = amostra do MEIO da janela) e o tempo/
    // distância freando E virando. Sem G lateral confiável (ZeroOk) não mede nada — sem inventar ápice.
    private void AcompanharCurvaG(AmostraGps sample, TrechoSegmento seg, bool peloG)
    {
        if (sample.Kmh > 0 && sample.Kmh < _kmhMinTrecho) _kmhMinTrecho = sample.Kmh;
        if (sample.AccelLatG is not { } gLat || !double.IsFinite(gLat) || !sample.ZeroOk)
        {
            _anteriorNoTrecho = sample;
            return;
        }
        _temG = true;
        var lat = Math.Abs(gLat);
        if (lat > _gLatMax) _gLatMax = lat;
        if (peloG)
        {
            var gLong = sample.AccelLongG!.Value;
            var comb = Math.Sqrt(gLong * gLong + lat * lat);
            if (comb > _gCombMax) _gCombMax = comb;
            if (gLong <= -FreadaInicioG && lat >= CurvaLatMinG && _anteriorNoTrecho is { } ant)
            {
                var dt = (sample.T - ant.T) / 1000.0;
                if (dt > 0 && dt <= IntervaloMaxS)
                {
                    _freioCurvaS += dt;
                    _freioCurvaM += Ghost.DistMeters(P(ant), P(sample));
                }
            }
        }
        _anteriorNoTrecho = sample;

        if (_apiceGEmitido) return;
        _latWindow.Enqueue((sample, lat, _kmhMinTrecho));
        if (_latWindow.Count > FreadaJanela) _latWindow.Dequeue();
        if (_latWindow.Count < FreadaJanela) return;
        var media = _latWindow.Average(x => x.Lat);
        if (media > _apiceGPico)
        {
            _apiceGPico = media;
            var meio = _latWindow.ElementAt(FreadaJanela / 2);
            _apiceGAmostra = meio.A;
            _apiceGKmhMin = meio.KmhMin;
        }
        else if (_apiceGPico >= _apiceLatLimiarG && media <= ApiceConfirmaFracao * _apiceGPico)
            EmitirApiceG(seg, emergencia: false);
    }

    private void EmitirApiceG(TrechoSegmento seg, bool emergencia)
    {
        var a = _apiceGAmostra!;
        _apiceGEmitido = true;
        _onEvent(new TrechoEvento("apice-pelo-g", seg.Id, a.T, a.Kmh,
            DistFromIdealM: Ghost.DistMeters(P(a), seg.ApicePoint), FechamentoDeEmergencia: emergencia,
            GLatPico: _apiceGPico, KmhMin: double.IsInfinity(_apiceGKmhMin) ? null : _apiceGKmhMin));
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
