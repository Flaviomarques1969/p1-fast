// MainWindow.CoachZoom.cs — fiação do VIDRO DO MAPA CENTRAL (coach-zoom).
// Port do comportamento de web/cockpit/coach-zoom-live.js (estado c840e129 do iMac,
// spec pelo canal 2026-07-11). A conta vive em Domain/CoachZoom.cs (CoachZoomCerebro);
// aqui é SÓ exibição: cada fix aceito vira um alvo, e um tick de ~33 ms interpola
// câmera/ghost/ponta do rastro até o alvo — o papel que as transitions CSS fazem no web.
//
// Fontes de dado (a MESMA entrada do cérebro do painel, nada de conexão própria):
//   · live  → MainWindow.Live.cs (fix filtrado, dentro da caixa de Brasília)
//   · replay→ MainWindow.Replay.cs (mesmos AmostraGps da sessão real)
// Ghost = melhor volta COMPLETA real do fixture canônico (GhostVoltaLoader); sem
// fixture o mapa segue sem ghost — honesto, nada inventado.

using System;
using System.Collections.Generic;
using System.IO;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Media;
using P1Fast.Cockpit.Domain;

namespace P1Fast.Cockpit.UI;

public sealed partial class MainWindow
{
    private const string CzFixtureRelativo = @"web\command-box\fixtures\passagens-bubi-brasilia.v1.json";

    private CoachZoomCerebro? _czCerebro;
    private Microsoft.UI.Dispatching.DispatcherQueueTimer? _czTimer;

    // interpolação entre fixes (o "transition" do CSS): de → até, começando em _czAnimT0
    private double _czDeX, _czDeY, _czDeRumo, _czDeEscala;
    private double _czAteX, _czAteY, _czAteRumo, _czAteEscala;
    private long _czAnimT0;
    private double _czAnimDurMs = 300;
    private bool _czTemQuadro;

    // relógio do ghost entre fixes: extrapola o tempo GPS pela taxa observada
    // (live ≈ 1×; replay anda na velocidade da sessão × Speed — a taxa se auto-mede)
    private long _czUltimoTGps;
    private long _czUltimoTick;
    private double _czTaxaRelogio = 1.0;
    private bool _czGhostVisivel;

    // rastro: a cabeça é redesenhada por tick com a ponta interpolada (revelação contínua)
    private (double X, double Y)[] _czCabeca = Array.Empty<(double, double)>();

    private string? _czRotuloAtual;

    /// <summary>Liga o vidro do mapa. Chamado 1× no IniciarFeedReal (replay E live).</summary>
    private void InicializarCoachZoom()
    {
        if (_czCerebro is not null) return;
        _czCerebro = new CoachZoomCerebro();
        CoachZoomRoot.Opacity = 1;   // o cartão aparece; o MUNDO só depois do 1º rumo

        // ghost: leitura de disco fora da thread da UI; sem fixture = sem ghost (honesto)
        var cerebro = _czCerebro;
        _ = System.Threading.Tasks.Task.Run(() =>
        {
            var caminho = ResolverCaminhoFixtureGhost();
            var ghost = caminho is null ? null : GhostVoltaLoader.CarregarDeArquivo(caminho);
            DispatcherQueue.TryEnqueue(() => cerebro.DefinirGhost(ghost));
        });

        _czTimer = DispatcherQueue.CreateTimer();
        _czTimer.Interval = TimeSpan.FromMilliseconds(33);   // mesmo passo do pump do replay
        _czTimer.Tick += (_, _) => TickCoachZoom();
        _czTimer.Start();
    }

    /// <summary>Acha o fixture subindo do diretório do .exe até a raiz do repo (o Release
    /// roda em bin\...\; em produção fora do repo, devolve null e o mapa fica sem ghost).</summary>
    private static string? ResolverCaminhoFixtureGhost()
    {
        try
        {
            var dir = new DirectoryInfo(AppContext.BaseDirectory);
            for (var i = 0; i < 10 && dir is not null; i++, dir = dir.Parent)
            {
                var cand = Path.Combine(dir.FullName, CzFixtureRelativo);
                if (File.Exists(cand)) return cand;
            }
        }
        catch { /* best-effort */ }
        return null;
    }

    /// <summary>Um fix aceito (live filtrado ou replay). Roda na thread da UI.</summary>
    private void AtualizarCoachZoom(AmostraGps g)
    {
        if (_czCerebro is null) return;
        var tick = Environment.TickCount64;
        var tGps = (long)g.T;

        var q = _czCerebro.ProcessarFix(g.Lat, g.Lng, g.Kmh, tGps, tick);
        if (q is null) return;   // anti-salto: fix descartado

        // taxa do relógio (ghost anda em tempo de SESSÃO; o tick, em tempo de PAREDE)
        if (_czUltimoTick > 0)
        {
            var dTick = tick - _czUltimoTick;
            var dGps = tGps - _czUltimoTGps;
            if (dTick > 0 && dGps > 0)
            {
                var taxa = Math.Clamp((double)dGps / dTick, 0.25, 12.0);
                _czTaxaRelogio += (taxa - _czTaxaRelogio) * 0.3;
            }
        }
        _czUltimoTick = tick; _czUltimoTGps = tGps;

        // câmera: o valor interpolado de agora vira o "de"; o quadro novo é o "até"
        if (_czTemQuadro)
        {
            var (x, y, r, e) = CamInterpolada(tick);
            _czDeX = x; _czDeY = y; _czDeRumo = r; _czDeEscala = e;
        }
        else
        {
            _czDeX = q.CamX; _czDeY = q.CamY; _czDeRumo = q.RumoDeg; _czDeEscala = q.Escala;
            _czTemQuadro = true;
        }
        _czAteX = q.CamX; _czAteY = q.CamY; _czAteRumo = q.RumoDeg; _czAteEscala = q.Escala;
        _czAnimT0 = tick;
        _czAnimDurMs = Math.Max(1, q.DtWallMs * 1.05);

        if (q.MundoVisivel && CzMundo.Opacity < 1) CzMundo.Opacity = 1;

        // fatia da pista (asfalto + borda) — só quando o cérebro re-cortou
        if (q.Fatia is { } fatia)
        {
            var geo = CaminhoParaGeometry(fatia);
            CzPista.Data = geo;
            CzPistaBorda.Data = CaminhoParaGeometry(fatia);
        }

        // rastro: cauda inteira agora; cabeça fica pro tick (ponta revelada)
        CzTrailCauda.Data = CaminhoParaGeometry(q.Cauda);
        _czCabeca = q.Cabeca;

        // cores do rastro acompanham o lado do gap (âmbar só quando ATRÁS)
        var cor = q.Lado == GapLado.Atras ? CzAmbar : CzVerde;
        CzTrail.Stroke = cor; CzTrailHalo.Stroke = cor; CzTrailCauda.Stroke = cor;

        // GAP ao vivo: sem sinal — a COR diz o lado (canônico: cor, nunca sinal)
        _czGhostVisivel = q.GhostVisivel;
        CzGdotG.Visibility = q.GhostVisivel ? Visibility.Visible : Visibility.Collapsed;
        if (q.GapS is { } gap)
        {
            CzGap.Text = Math.Abs(gap).ToString("0.0").Replace('.', ',') + " s";
            CzGap.Foreground = q.Lado == GapLado.Atras ? CzAmbar : CzVerde;
            CzGap.Opacity = 1;
        }
        else
        {
            CzGap.Text = ""; CzGap.Opacity = 0;
        }

        // rótulo = curva atual (só informação)
        var nome = _orquestrador?.CurvaAtualNome;
        if (nome != _czRotuloAtual)
        {
            _czRotuloAtual = nome;
            CzRotulo.Text = (nome ?? "").ToUpperInvariant();
        }
    }

    /// <summary>Fim/reinício de volta (port do coach:volta-fim): zera rastro e re-âncora.</summary>
    private void CoachZoomVoltaFim()
    {
        if (_czCerebro is null) return;
        _czCerebro.ReiniciarVolta();
        _czCabeca = Array.Empty<(double, double)>();
        CzTrail.Data = null; CzTrailHalo.Data = null; CzTrailCauda.Data = null;
    }

    // ── tick (~33 ms): o papel das transitions CSS ───────────────────

    private (double X, double Y, double Rumo, double Escala) CamInterpolada(long tick)
    {
        var f = Math.Clamp((tick - _czAnimT0) / Math.Max(1.0, _czAnimDurMs), 0, 1);
        return (_czDeX + (_czAteX - _czDeX) * f,
                _czDeY + (_czAteY - _czDeY) * f,
                CoachZoomCerebro.LerpAng(_czDeRumo, _czAteRumo, f),
                _czDeEscala + (_czAteEscala - _czDeEscala) * f);
    }

    private void TickCoachZoom()
    {
        if (_czCerebro is null || !_czTemQuadro) return;
        var tick = Environment.TickCount64;

        // câmera heading-up
        var (x, y, rumo, escala) = CamInterpolada(tick);
        var m = CoachZoomGeometria.MatrizCamera(x, y, rumo, escala);
        CzMundo.RenderTransform = new MatrixTransform
        {
            Matrix = new Microsoft.UI.Xaml.Media.Matrix(m.M11, m.M12, m.M21, m.M22, m.OffsetX, m.OffsetY),
        };

        // rastro vivo com a PONTA REVELADA: o último segmento anda junto com a câmera
        if (_czCabeca.Length >= 2)
        {
            var f = Math.Clamp((tick - _czAnimT0) / Math.Max(1.0, _czAnimDurMs), 0, 1);
            var pts = new List<(double X, double Y)>(_czCabeca.Length);
            for (var i = 0; i < _czCabeca.Length - 1; i++) pts.Add(_czCabeca[i]);
            var a = _czCabeca[^2]; var b = _czCabeca[^1];
            pts.Add((a.X + (b.X - a.X) * f, a.Y + (b.Y - a.Y) * f));
            var geo = CaminhoParaGeometry(pts);
            CzTrail.Data = geo;
            CzTrailHalo.Data = CaminhoParaGeometry(pts);
        }

        // ghost: o relógio corre sozinho entre fixes (na taxa medida da sessão)
        if (_czGhostVisivel && _czUltimoTick > 0)
        {
            var tGpsAgora = _czUltimoTGps + (long)((tick - _czUltimoTick) * _czTaxaRelogio);
            if (_czCerebro.PosicaoGhostEm(tGpsAgora) is { } gp)
            {
                CzGdotG.RenderTransform = new TranslateTransform { X = gp.X, Y = gp.Y };
            }
        }
    }

    // ── geometria: Catmull-Rom→Bézier do Domain vira PathGeometry ────

    private static PathGeometry? CaminhoParaGeometry(IReadOnlyList<(double X, double Y)> pts)
    {
        var suave = CoachZoomGeometria.CaminhoSuave(pts);
        if (suave is null) return null;
        var (inicio, cubicas) = suave.Value;
        var fig = new PathFigure
        {
            StartPoint = new Windows.Foundation.Point(inicio.X, inicio.Y),
            IsClosed = false, IsFilled = false,
        };
        foreach (var c in cubicas)
            fig.Segments.Add(new BezierSegment
            {
                Point1 = new Windows.Foundation.Point(c.C1x, c.C1y),
                Point2 = new Windows.Foundation.Point(c.C2x, c.C2y),
                Point3 = new Windows.Foundation.Point(c.X, c.Y),
            });
        var geo = new PathGeometry();
        geo.Figures.Add(fig);
        return geo;
    }

    // cores do gap/rastro (oklch da spec → ARGB)
    private static readonly SolidColorBrush CzVerde = new(Windows.UI.Color.FromArgb(0xFF, 0x45, 0xE0, 0x59));
    private static readonly SolidColorBrush CzAmbar = new(Windows.UI.Color.FromArgb(0xFF, 0xFF, 0xAA, 0x00));
}
