// CoachZoom — cérebro do ZOOM AO VIVO DO TRECHO (o mapa do cartão de vidro central).
// Port fiel de web/cockpit/coach-zoom-live.js v3 (estado c840e129 do iMac, spec trocada
// pelo canal claude-comms em 2026-07-11):
//   · Câmera pela ROTA: tangente do traçado oficial (sentido deduzido por VOTOS dos
//     índices já passados) — trilho suave; GPS cru só pro esterço/estado do rumo.
//   · GHOST v3: UMA bolinha, CONTÍNUA a volta inteira, na posição da MELHOR VOLTA
//     COMPLETA real; âncora ESPACIAL (perto + mesmo sentido), rastreio em janela
//     (a pista dobra sobre si — pular de dobra era a fonte dos gaps absurdos).
//   · GAP ao vivo contínuo SEM SINAL — a cor diz o lado (regra dura dos canônicos).
//   · Zoom pela velocidade; pista como FAIXA (fatia única ±26 pontos).
// AQUI é só a conta (testável, sem relógio próprio — tempos vêm do chamador); quem
// pinta é MainWindow.CoachZoom.cs. Números idênticos ao JS — divergir só com ordem.

namespace P1Fast.Cockpit.Domain;

/// <summary>Um ponto da melhor volta real (px do desenho + tempo relativo em s).</summary>
public sealed record GhostPonto(double X, double Y, double TRelS);

/// <summary>A melhor volta COMPLETA real — a linha do ghost.</summary>
public sealed record GhostVolta(IReadOnlyList<GhostPonto> Pts, double DurS);

public enum GapLado { Nenhum, Frente, Atras }

/// <summary>O que a tela pinta depois de cada fix aceito. Alvos "no instante do fix";
/// a suavização visual entre fixes (DtWallMs) é obra da tela, como as transitions CSS.</summary>
public sealed record CoachZoomQuadro(
    double CamX, double CamY,            // centro da câmera (px do desenho)
    double RumoDeg, double Escala,       // rumo suavizado + zoom suavizado
    double DtWallMs,                     // intervalo real entre leituras (80..1400, 1º=300)
    bool MundoVisivel,                   // só depois do 1º rumo (JS: mundo.opacity 0→1)
    (double X, double Y)[]? Fatia,       // nova fatia da pista (null = não mudou)
    (double X, double Y)[] Cauda,        // rastro esmaecido (inclui emenda com a cabeça)
    (double X, double Y)[] Cabeca,       // rastro vivo (ponta = posição atual)
    bool GhostVisivel,
    double GhostX, double GhostY,
    double? GapS,                        // gap suavizado (s); null = esconde
    GapLado Lado);                       // Frente = verde, Atras = âmbar (cor, nunca sinal)

public sealed class CoachZoomCerebro
{
    // ── Constantes do JS (não mexer sem espelhar o web) ──────────────
    public const double VW = 330, VH = 228;
    public const double AncoraX = VW / 2, AncoraY = VH * 0.64;
    public const double ZoomPerto = 1.60, ZoomLonge = 0.95;
    public const double KmhPerto = 60, KmhLonge = 170;
    public const double SuavizaZoom = 0.12;
    public const int    TrailMax = 26, TrailCabeca = 9;
    public const double SuavizaRumo = 0.30;
    public const double PxPorM = 0.59078;
    public const double GateGhostPx = 55 * PxPorM;   // projeção carro→ghost até ~55 m
    public const double PassoMaxPx = 45;              // anti-salto de GPS
    public const int    FatiaR = 26;                  // fatia da pista: ±26 pontos

    private readonly (double X, double Y)[] _pista;
    private GhostVolta? _ghost;

    // ── estado (espelho 1:1 do JS) ───────────────────────────────────
    private double _rumoDeg, _rumoBrutoDeg;
    private bool _temRumo;
    private int _dirVotos, _dirPista, _ciPrev = -1;
    private double? _wallPrev;
    private double _escala = ZoomPerto;
    private double? _gapSuave;
    private (double X, double Y)? _prevXY;
    private readonly List<(double X, double Y)> _trail = new();
    private bool _ghostAncorado;
    private double _ghostT0;
    private long _ghostT0ms;
    private int _gIdx = -1, _gPerdido;
    private int _pistaIdx = -1;

    public CoachZoomCerebro((double X, double Y)[]? pista = null)
        => _pista = pista ?? PistaDesenhoBrasilia.Pontos;

    /// <summary>Entrega a melhor volta (carregada async pela tela). Igual ao JS
    /// (carregarGhost().then): zera a âncora pra re-ancorar honesto.</summary>
    public void DefinirGhost(GhostVolta? ghost)
    {
        _ghost = ghost;
        _ghostAncorado = false; _gIdx = -1; _gPerdido = 0;
    }

    /// <summary>Fim/reinício de volta (port do coach:volta-fim): limpa rastro e re-ancora.</summary>
    public void ReiniciarVolta()
    {
        _trail.Clear();
        _gapSuave = null;
        _ghostAncorado = false; _gIdx = -1;
    }

    /// <summary>Posição do ghost num instante GPS qualquer (pro tick da tela continuar o
    /// deslize entre fixes). Null = ghost não ancorado.</summary>
    public (double X, double Y)? PosicaoGhostEm(long tGpsMs)
    {
        if (!_ghostAncorado || _ghost is null) return null;
        var p = GhostLapPos(_ghostT0 + (tGpsMs - _ghostT0ms) / 1000.0);
        return (p.X, p.Y);
    }

    /// <summary>Interpolação circular de ângulo (port do lerpAng do JS).</summary>
    public static double LerpAng(double a, double b, double f)
    {
        var d = (b - a) % 360;
        if (d > 180) d -= 360; else if (d < -180) d += 360;
        return a + d * f;
    }

    /// <summary>Processa um fix aceito (a tela já filtrou qualidade/caixa). tGpsMs = carimbo
    /// do GPS (relógio do ghost); tWallMs = chegada na tela (duração das animações).
    /// Null = fix descartado pelo anti-salto (JS: return sem pintar).</summary>
    public CoachZoomQuadro? ProcessarFix(double lat, double lng, double kmh, long tGpsMs, double tWallMs)
    {
        var (x, y) = PistaDesenhoBrasilia.GeoParaDesenho(lat, lng);
        var xy = (X: x, Y: y);

        // rejeição de salto de GPS + rumo bruto pelo passo
        if (_prevXY is { } prev)
        {
            var dx = xy.X - prev.X; var dy = xy.Y - prev.Y;
            var passo2 = dx * dx + dy * dy;
            if (passo2 > PassoMaxPx * PassoMaxPx) { _prevXY = xy; return null; }
            if (passo2 > 0.4)
            {
                var alvo = Math.Atan2(dy, dx) * 180 / Math.PI;
                _rumoBrutoDeg = _temRumo ? LerpAng(_rumoBrutoDeg, alvo, 0.85) : alvo;
                if (!_temRumo) { _rumoDeg = alvo; _temRumo = true; }
            }
        }
        _prevXY = xy;

        // APONTAMENTO PELA ROTA: tangente do traçado; sentido por votos dos índices passados
        var ciAqui = IdxPistaMaisPerto(xy);
        var n = _pista.Length;
        if (_ciPrev >= 0 && ciAqui != _ciPrev)
        {
            var dIdx = ((ciAqui - _ciPrev) % n + n) % n;
            if (dIdx > n / 2) dIdx -= n;
            if (dIdx != 0 && Math.Abs(dIdx) <= 12)
            {
                _dirVotos = Math.Clamp(_dirVotos + Math.Sign(dIdx), -6, 6);
                if (Math.Abs(_dirVotos) >= 2) _dirPista = Math.Sign(_dirVotos);
            }
        }
        _ciPrev = ciAqui;
        if (_temRumo)
        {
            var pp = _pista[ciAqui];
            var ddRota = (pp.X - xy.X) * (pp.X - xy.X) + (pp.Y - xy.Y) * (pp.Y - xy.Y);
            var pertoDaRota = ddRota <= 26 * 26;
            if (_dirPista != 0 && pertoDaRota)
            {
                const int Adiante = 3;
                var a = _pista[ciAqui];
                var b = _pista[(((ciAqui + Adiante * _dirPista) % n) + n) % n];
                var alvoTang = Math.Atan2(b.Y - a.Y, b.X - a.X) * 180 / Math.PI;
                _rumoDeg = LerpAng(_rumoDeg, alvoTang, 0.5);
            }
            else
            {
                _rumoDeg = LerpAng(_rumoDeg, _rumoBrutoDeg, SuavizaRumo);
            }
        }

        // ANTI-SALTO das animações: duram o intervalo REAL entre leituras
        double dtWall = 300;
        if (_wallPrev is { } wp) dtWall = Math.Min(1400, Math.Max(80, tWallMs - wp));
        _wallPrev = tWallMs;

        // ZOOM inteligente pela velocidade
        var f = Math.Min(1.0, Math.Max(0.0, (kmh - KmhPerto) / (KmhLonge - KmhPerto)));
        _escala += (ZoomPerto + (ZoomLonge - ZoomPerto) * f - _escala) * SuavizaZoom;

        // fatia da pista (asfalto + borda) — só re-corta quando andou > 2 índices
        (double X, double Y)[]? fatia = null;
        if (_pistaIdx < 0 || Math.Min(Math.Abs(ciAqui - _pistaIdx), n - Math.Abs(ciAqui - _pistaIdx)) > 2)
        {
            _pistaIdx = ciAqui;
            fatia = FatiaPista(ciAqui);
        }

        // ═══ GHOST v3: bolinha contínua da melhor volta completa ═══
        bool ghostVisivel = false; double gx = 0, gy = 0;
        double? gapOut = null; var lado = GapLado.Nenhum;
        if (_ghost is { } ghost)
        {
            var durS = Math.Max(0.001, ghost.DurS);
            // rastreia a projeção do carro na volta do ghost SEM pular de dobra
            GhostPonto? proj = null;
            if (_gIdx >= 0)
            {
                var np = ghost.Pts.Count;
                double bd = double.PositiveInfinity; var bi = -1;
                for (var k = -8; k <= 30; k++)
                {
                    var i = ((_gIdx + k) % np + np) % np;
                    var q = ghost.Pts[i];
                    var d2 = (q.X - xy.X) * (q.X - xy.X) + (q.Y - xy.Y) * (q.Y - xy.Y);
                    if (d2 < bd) { bd = d2; bi = i; }
                }
                if (bi >= 0 && Math.Sqrt(bd) <= GateGhostPx) { _gIdx = bi; _gPerdido = 0; proj = ghost.Pts[bi]; }
                else if (++_gPerdido > 2) { _ghostAncorado = false; _gIdx = -1; _gPerdido = 0; }
            }
            // (re)ancoragem: início, relógio rebobinado (auto-cura) ou trava perdida
            var dtSeg = _ghostAncorado ? (tGpsMs - _ghostT0ms) / 1000.0 : (double?)null;
            if (!_ghostAncorado || dtSeg < -1 || dtSeg > durS * 1.6)
            {
                var idx = _temRumo ? AncorarGhost(xy, _rumoBrutoDeg) : null;
                if (idx is { } i)
                {
                    _ghostT0 = ghost.Pts[i].TRelS; _ghostT0ms = tGpsMs; _ghostAncorado = true; _gapSuave = null;
                    _gIdx = i; _gPerdido = 0; proj = ghost.Pts[i];
                }
                else { _ghostAncorado = false; _gIdx = -1; }
            }
            if (_ghostAncorado)
            {
                var relogio = _ghostT0 + (tGpsMs - _ghostT0ms) / 1000.0;
                var gp = GhostLapPos(relogio);
                ghostVisivel = true; gx = gp.X; gy = gp.Y;
                if (proj is not null)
                {
                    // diferença CIRCULAR (a volta fecha em si)
                    var gapBruto = (proj.TRelS - relogio % durS) % durS;
                    if (gapBruto > durS / 2) gapBruto -= durS; else if (gapBruto < -durS / 2) gapBruto += durS;
                    _gapSuave = _gapSuave is { } gs ? gs + (gapBruto - gs) * 0.35 : gapBruto;
                    gapOut = _gapSuave;
                    lado = _gapSuave >= 0 ? GapLado.Frente : GapLado.Atras;
                }
            }
        }

        // rastro: cauda esmaecida + cabeça viva (a ponta é revelada pela tela, por tick)
        _trail.Add(xy);
        if (_trail.Count > TrailMax) _trail.RemoveAt(0);
        var corte = Math.Max(0, _trail.Count - TrailCabeca);
        var cauda = _trail.Take(corte + 1).ToArray();
        var cabeca = _trail.Skip(corte).ToArray();

        return new CoachZoomQuadro(
            xy.X, xy.Y, _rumoDeg, _escala, dtWall, _temRumo,
            fatia, cauda, cabeca,
            ghostVisivel, gx, gy, gapOut, lado);
    }

    // ── privadas (ports 1:1) ─────────────────────────────────────────

    private int IdxPistaMaisPerto((double X, double Y) c)
    {
        var bi = 0; var bd = double.PositiveInfinity;
        for (var i = 0; i < _pista.Length; i++)
        {
            var p = _pista[i];
            var d = (p.X - c.X) * (p.X - c.X) + (p.Y - c.Y) * (p.Y - c.Y);
            if (d < bd) { bd = d; bi = i; }
        }
        return bi;
    }

    private (double X, double Y)[] FatiaPista(int ci)
    {
        var n = _pista.Length;
        var pts = new (double X, double Y)[2 * FatiaR + 1];
        for (var k = -FatiaR; k <= FatiaR; k++)
            pts[k + FatiaR] = _pista[((ci + k) % n + n) % n];
        return pts;
    }

    /// <summary>Âncora INTELIGENTE: só num ponto do ghost PERTO do carro e no MESMO sentido
    /// de marcha (dobras da pista têm sentidos ≠). Null = ainda não dá com honestidade.
    /// Devolve o ÍNDICE do ponto (o JS guarda tRel e re-acha por findIndex — primeiro
    /// duplicado; espelhado no laço de desempate abaixo).</summary>
    private int? AncorarGhost((double X, double Y) xy, double rumoGraus)
    {
        if (_ghost is not { } ghost) return null;
        var rum = rumoGraus * Math.PI / 180;
        var ux = Math.Cos(rum); var uy = Math.Sin(rum);
        var melhorIdx = -1; var melhorD2 = double.PositiveInfinity;
        for (var i = 0; i < ghost.Pts.Count - 1; i++)
        {
            var q = ghost.Pts[i];
            var d2 = (q.X - xy.X) * (q.X - xy.X) + (q.Y - xy.Y) * (q.Y - xy.Y);
            if (d2 > GateGhostPx * GateGhostPx) continue;
            var q2 = ghost.Pts[i + 1];
            if ((q2.X - q.X) * ux + (q2.Y - q.Y) * uy <= 0) continue;   // sentido contrário
            if (melhorIdx < 0 || d2 < melhorD2) { melhorD2 = d2; melhorIdx = i; }
        }
        if (melhorIdx < 0) return null;
        // findIndex do JS acha o PRIMEIRO tRel igual (duplicados são adjacentes na volta)
        while (melhorIdx > 0 && ghost.Pts[melhorIdx - 1].TRelS == ghost.Pts[melhorIdx].TRelS) melhorIdx--;
        return melhorIdx;
    }

    private GhostPonto GhostLapPos(double tS)
    {
        var ghost = _ghost!;
        var pts = ghost.Pts;
        var t = tS % Math.Max(0.001, ghost.DurS);       // o ghost também "dá voltas"
        if (t <= pts[0].TRelS) return pts[0];
        for (var i = 0; i < pts.Count - 1; i++)
        {
            var a = pts[i]; var b = pts[i + 1];
            if (t <= b.TRelS)
            {
                var f = (t - a.TRelS) / Math.Max(0.001, b.TRelS - a.TRelS);
                return new GhostPonto(a.X + (b.X - a.X) * f, a.Y + (b.Y - a.Y) * f, t);
            }
        }
        return pts[^1];
    }
}

/// <summary>Geometria de apresentação do coach-zoom, testável fora da tela.</summary>
public static class CoachZoomGeometria
{
    /// <summary>Matriz da câmera heading-up — igual ao transform CSS do JS:
    /// translate(âncora) · rotate(-90 − rumo) · scale(escala) · translate(−carro).
    /// Convenção XAML (linha-vetor): x' = x·M11 + y·M21 + Ox; y' = x·M12 + y·M22 + Oy.
    /// Invariante: o CARRO cai exatamente na ÂNCORA, qualquer rumo/escala.</summary>
    public static (double M11, double M12, double M21, double M22, double OffsetX, double OffsetY)
        MatrizCamera(double carX, double carY, double rumoDeg, double escala)
    {
        var th = (-90 - rumoDeg) * Math.PI / 180;
        var c = Math.Cos(th); var s = Math.Sin(th);
        var m11 = escala * c;  var m12 = escala * s;
        var m21 = -escala * s; var m22 = escala * c;
        var ox = CoachZoomCerebro.AncoraX - (carX * m11 + carY * m21);
        var oy = CoachZoomCerebro.AncoraY - (carX * m12 + carY * m22);
        return (m11, m12, m21, m22, ox, oy);
    }

    /// <summary>Port do pathSuave: Catmull-Rom→Bézier (divisor 6), sem filtrar ponto.
    /// Devolve o ponto inicial + as cúbicas; null se não há caminho (&lt; 2 pontos).</summary>
    public static ((double X, double Y) Inicio,
                   (double C1x, double C1y, double C2x, double C2y, double X, double Y)[] Cubicas)?
        CaminhoSuave(IReadOnlyList<(double X, double Y)> pts)
    {
        if (pts is null || pts.Count < 2) return null;
        (double X, double Y) P(int i) => pts[Math.Max(0, Math.Min(pts.Count - 1, i))];
        var seg = new (double, double, double, double, double, double)[pts.Count - 1];
        for (var i = 0; i < pts.Count - 1; i++)
        {
            var p0 = P(i - 1); var p1 = P(i); var p2 = P(i + 1); var p3 = P(i + 2);
            seg[i] = (p1.X + (p2.X - p0.X) / 6, p1.Y + (p2.Y - p0.Y) / 6,
                      p2.X - (p3.X - p1.X) / 6, p2.Y - (p3.Y - p1.Y) / 6,
                      p2.X, p2.Y);
        }
        return (pts[0], seg);
    }
}
