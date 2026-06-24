// ChegadaDetector — porte fiel de web/cockpit/chegada-detector.js (decisão Flávio
// 2026-05-28). Primeiro tijolo do MS-13.5: detecta o cruzamento da linha de chegada
// a partir do GPS — que o .exe agora lê nativo do RaceBox (ADR-024 amendment 6) —
// fechando a volta e dando o tempo de volta.
//
// Algoritmo idêntico ao JS:
//   - troca de sinal do produto vetorial (sideOfLine) entre 2 amostras consecutivas;
//   - confirmação por interseção REAL do segmento caminho × linha (folga de 50% em
//     cada ponta da linha) — sem isso o prolongamento infinito da linha fecharia
//     "volta" em qualquer canto (achado no replay real de 10/06);
//   - debounce de 5 s pra não disparar com o carro parado em cima da linha.
//
// Puro e sem IO (igual aos outros do domínio): o chamador empurra GPS e recebe o
// evento. O loader Supabase do marco (loadMarcoChegada no JS) fica fora — quem dá a
// linha é o chamador (semente da pista ou banco).

namespace P1Fast.Cockpit.Domain;

/// <summary>Ponto GPS de uma das pontas da linha de chegada.</summary>
public readonly record struct GpsPonto(double Lat, double Lng);

/// <summary>Volta fechada: instante, número da volta e o tempo da volta que fechou.</summary>
public sealed record ChegadaEvento(long TMs, int VoltaN, long? TempoVoltaMs);

public sealed class ChegadaDetector
{
    private const long DebounceMs = 5000;

    private readonly GpsPonto _a;
    private readonly GpsPonto _b;
    private double? _lastSide;
    private GpsPonto? _lastPos;
    private long _lastCrossT;
    private bool _jaCruzou;
    private int _voltas;

    /// <param name="a">Ponta A da linha de chegada.</param>
    /// <param name="b">Ponta B da linha de chegada.</param>
    public ChegadaDetector(GpsPonto a, GpsPonto b)
    {
        _a = a;
        _b = b;
    }

    public int Voltas => _voltas;

    /// <summary>
    /// Ingere uma amostra de GPS. Devolve o <see cref="ChegadaEvento"/> se fechou
    /// volta nesta amostra; senão null. TempoVoltaMs é null no primeiro cruzamento
    /// (não há volta anterior pra cronometrar).
    /// </summary>
    public ChegadaEvento? IngestGps(double lat, double lng, long tMs)
    {
        if (double.IsNaN(lat) || double.IsNaN(lng) || double.IsInfinity(lat) || double.IsInfinity(lng))
            return null;

        var p = new GpsPonto(lat, lng);
        double side = SideOfLine(p, _a, _b);

        ChegadaEvento? evento = null;
        if (_lastSide is { } ls
            && Math.Sign(side) != Math.Sign(ls)
            && _lastPos is { } lp
            && CaminhoCruzaLinha(lp, p, _a, _b)
            && (!_jaCruzou || tMs - _lastCrossT > DebounceMs))
        {
            long? tempo = _jaCruzou ? tMs - _lastCrossT : null;
            _lastCrossT = tMs;
            _jaCruzou = true;
            _voltas++;
            evento = new ChegadaEvento(tMs, _voltas, tempo);
        }

        _lastSide = side;
        _lastPos = p;
        return evento;
    }

    private static double SideOfLine(GpsPonto p, GpsPonto a, GpsPonto b) =>
        (b.Lng - a.Lng) * (p.Lat - a.Lat) - (b.Lat - a.Lat) * (p.Lng - a.Lng);

    // O caminho p0→p1 corta a LINHA a–b de verdade? Interseção de segmentos em
    // projeção local (metros), com folga de 50% em cada ponta da linha.
    private static bool CaminhoCruzaLinha(GpsPonto p0, GpsPonto p1, GpsPonto a, GpsPonto b)
    {
        const double kLat = 110540;
        double kLng = 111320 * Math.Cos(a.Lat * Math.PI / 180);
        double X(GpsPonto q) => (q.Lng - a.Lng) * kLng;
        double Y(GpsPonto q) => (q.Lat - a.Lat) * kLat;

        double rx = X(p1) - X(p0), ry = Y(p1) - Y(p0);
        double dx = X(b),          dy = Y(b);
        double den = rx * dy - ry * dx;
        if (Math.Abs(den) < 1e-9) return false; // paralelos

        double qpx = -X(p0), qpy = -Y(p0);
        double v = (qpx * dy - qpy * dx) / den;  // posição ao longo do caminho
        double u = (qpx * ry - qpy * rx) / den;  // posição ao longo da linha
        return v >= 0 && v <= 1 && u >= -0.5 && u <= 1.5;
    }
}
