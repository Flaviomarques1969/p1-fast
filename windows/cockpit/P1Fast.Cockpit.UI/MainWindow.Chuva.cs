// MainWindow.Chuva.cs — visual da CHUVA TÉRMICA do cockpit (spec do canal 2026-07-04,
// specs/SPEC_ELEMENTO_CHUVA_TERMICA.md; implantada por ordem do Flávio na noite de 04/07).
//
// A FASE vem do cérebro (ChuvaTermica no Domain → CockpitState.Chuva); aqui é SÓ desenho:
// 90 gotas em 3 profundidades (frente 15% grande/rápida/opaca · meio 55% · fundo 30%
// pequena/lenta/fraca), cada uma com corpo (cabeça sólida + cauda que some) e bloom
// (o "glow" do box-shadow do web), halo de cor (TOPO no aquecimento / RODAPÉ no cool
// down) e 6 respingos cintilando no chão. Cores canônicas §2: azul #00C9FF (+8°) /
// vermelho #FF0027 (−7°). Opacidade global por fase (§5), cross-fade 900 ms (§9).
//
// Desenho de engenharia (difere do CSS só no COMO, nunca nos valores):
//  • A queda é GPU pura: um relógio de Composition (escala 1 s/s) + uma ExpressionAnimation
//    por gota — Mod(t/dur + fase, 1) — em Translation.Y. Nada roda na thread da UI a cada
//    frame (o CSS anima transform; Storyboard de transform no WinUI seria dependente/CPU).
//  • A fase inicial de cada gota é ALEATÓRIA (0..1): ao ligar, a chuva já está cheia —
//    mesmo intento do animation-delay negativo do CSS (-0..-2.5 s), cobertura melhor.
//  • O envelope de opacidade por gota (8%/88% do CSS) foi dispensado: o Clip do device
//    esconde a gota fora da tela, que é o que o envelope fazia por baixo do overflow:hidden.
//  • Pincéis COMPARTILHADOS pelas 90 gotas: trocar azul↔vermelho é mutar 4 GradientStops,
//    não 90 elementos. A troca de direção sempre atravessa a janela ideal (opacidade 0),
//    então a cor troca invisível — só a OPACIDADE precisa de cross-fade (900 ms).
//
// O ESCANDALOSO (água ≥70/≥80) não vive aqui: AlertasCriticos já levanta MOTOR AQUECENDO /
// MOTOR QUENTE (Super) e o modo crítico (gap 6) toma a tela com o visual APROVADO do .exe.

using System;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Hosting;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI.Xaml.Media.Animation;
using Microsoft.UI.Xaml.Shapes;
using P1Fast.Cockpit.Domain;
using Windows.UI;

namespace P1Fast.Cockpit.UI;

public sealed partial class MainWindow
{
    // Cores canônicas da spec §2 (oklch convertido por script — não estimar de olho).
    private static readonly Color ChuvaAzul     = Color.FromArgb(0xFF, 0x00, 0xC9, 0xFF); // oklch(78% 0.20 232)
    private static readonly Color ChuvaVermelho = Color.FromArgb(0xFF, 0xFF, 0x00, 0x27); // oklch(64% 0.30 22)

    private const double ChuvaTiltWarmup   = 8;   // gota ↘ (aquecimento)
    private const double ChuvaTiltCooldown = -7;  // gota ↙ (cool down — direção oposta = leitura instantânea)

    private bool _chuvaPronta;
    private FaseChuva _faseChuvaAtual = FaseChuva.Off;
    private bool _chuvaQuente; // direção corrente: false = aquecimento (azul), true = cool down (vermelho)

    // Semente FIXA: a mesma chuva a cada boot — determinística pra testes/screenshot.
    private readonly Random _chuvaRnd = new(20260704);

    private LinearGradientBrush? _gotaBrush;   // corpo da gota (cabeça sólida + cauda) — compartilhado
    private LinearGradientBrush? _bloomBrush;  // glow suave atrás — compartilhado
    private SolidColorBrush? _splashBrush;     // respingos — compartilhado
    private RadialGradientBrush? _haloAzul, _haloVermelho;
    private RotateTransform[] _gotaTilts = Array.Empty<RotateTransform>();
    private Storyboard? _chuvaFade;
    private Storyboard? _splashFlicker;
    private Microsoft.UI.Composition.CompositionPropertySet? _chuvaClock;
    private double _chuvaOpacidadeAlvo;   // último alvo do cross-fade (From confiável; Stop reverteria pra base)

    /// <summary>Aplica a fase vinda do cérebro. Nasce preguiçoso: os 180 retângulos e as
    /// 90 animações só existem depois da PRIMEIRA fase ≠ Off.</summary>
    private void ApplyChuva(FaseChuva fase)
    {
        if (fase == _faseChuvaAtual) return;
        if (!_chuvaPronta)
        {
            if (fase == FaseChuva.Off) { _faseChuvaAtual = fase; return; }
            InitChuva();
        }
        _faseChuvaAtual = fase;

        var quente = fase is FaseChuva.CooldownLeve or FaseChuva.CooldownMedio or FaseChuva.CooldownAlto;
        if (fase != FaseChuva.Off && quente != _chuvaQuente) RetargetChuva(quente);

        if (fase != FaseChuva.Off)
        {
            // Volta a compor a camada ANTES de fazer o fade-in (foi colapsada no Off pra
            // não gastar GPU rodando 90 gotas invisíveis na pista) e retoma os respingos.
            RainLayer.Visibility = Visibility.Visible;
            _splashFlicker?.Resume();

            // Halo por fase (§6.1): aquece 0.85 (0.30 no -leve) · esfria 0.75.
            RainHalo.Opacity = fase switch
            {
                FaseChuva.WarmupLeve => 0.30,
                FaseChuva.WarmupMedio or FaseChuva.WarmupAlto => 0.85,
                _ => 0.75,
            };
        }

        AnimarChuvaOpacidade(OpacidadeGlobal(fase));
    }

    // Opacidade global por fase — §5 da spec, valores exatos do cockpit.css:694-708.
    private static double OpacidadeGlobal(FaseChuva f) => f switch
    {
        FaseChuva.WarmupAlto    => 1.00,
        FaseChuva.WarmupMedio   => 0.55,
        FaseChuva.WarmupLeve    => 0.20,
        FaseChuva.CooldownAlto  => 0.95,
        FaseChuva.CooldownMedio => 0.50,
        FaseChuva.CooldownLeve  => 0.18,
        _                       => 0.0,
    };

    // Cross-fade de fase: 900 ms ease-out (§9) — nunca corta seco. From EXPLÍCITO: no WinUI
    // Storyboard.Stop() reverte a Opacity pro valor BASE (0) — sem From, todo fade pularia
    // pra preto e subiria (flash). Uso o último alvo como From (fases mudam devagar → o fade
    // anterior já fechou, então o alvo anterior == valor visível). Ao chegar em 0, COLAPSA a
    // camada (para de compor as 90 gotas) e pausa os respingos — nada de GPU invisível.
    private void AnimarChuvaOpacidade(double alvo)
    {
        var de = _chuvaOpacidadeAlvo;
        _chuvaOpacidadeAlvo = alvo;
        _chuvaFade?.Stop();

        var anim = new DoubleAnimation
        {
            From = de,
            To = alvo,
            Duration = new Duration(TimeSpan.FromMilliseconds(900)),
            EasingFunction = new CubicEase { EasingMode = EasingMode.EaseOut },
        };
        Storyboard.SetTarget(anim, RainLayer);
        Storyboard.SetTargetProperty(anim, "Opacity");
        _chuvaFade = new Storyboard();
        _chuvaFade.Children.Add(anim);
        if (alvo <= 0)
            _chuvaFade.Completed += (_, _) =>
            {
                // Só colapsa se AINDA estamos em Off (uma fase nova pode ter chegado no meio).
                if (_chuvaOpacidadeAlvo <= 0)
                {
                    RainLayer.Visibility = Visibility.Collapsed;
                    _splashFlicker?.Pause();
                }
            };
        _chuvaFade.Begin();
    }

    // Troca de direção (azul↔vermelho): muta os pincéis compartilhados + inclina as 90
    // gotas + troca o halo de lugar. Acontece com a camada invisível (atravessou o ideal).
    private void RetargetChuva(bool quente)
    {
        _chuvaQuente = quente;
        var cor = quente ? ChuvaVermelho : ChuvaAzul;

        if (_gotaBrush is not null)
        {
            _gotaBrush.GradientStops[0].Color = cor;
            _gotaBrush.GradientStops[1].Color = cor;
            _gotaBrush.GradientStops[2].Color = ComAlpha(cor, 0x80);
            _gotaBrush.GradientStops[3].Color = ComAlpha(cor, 0x00);
        }
        if (_bloomBrush is not null)
        {
            _bloomBrush.GradientStops[0].Color = ComAlpha(cor, 0x58);
            _bloomBrush.GradientStops[1].Color = ComAlpha(cor, 0x2E);
            _bloomBrush.GradientStops[2].Color = ComAlpha(cor, 0x00);
        }
        if (_splashBrush is not null) _splashBrush.Color = cor;
        RainHalo.Fill = quente ? _haloVermelho : _haloAzul;

        var tilt = quente ? ChuvaTiltCooldown : ChuvaTiltWarmup;
        foreach (var t in _gotaTilts) t.Angle = tilt;
    }

    private static Color ComAlpha(Color c, byte a) => Color.FromArgb(a, c.R, c.G, c.B);

    private static string Inv(double v) => v.ToString("0.####", System.Globalization.CultureInfo.InvariantCulture);

    // Gera as 90 gotas (§3, algoritmo exato do cockpit.js:223-252), o halo e os respingos,
    // e liga o relógio de Composition. Roda UMA vez, na primeira fase ≠ Off.
    private void InitChuva()
    {
        _chuvaPronta = true;

        // Pincel do corpo: gradiente vertical — cabeça SÓLIDA embaixo (a frente da queda),
        // cauda que some pra cima (§3: 0–30% cor cheia → 60% a 50% → 100% transparente).
        _gotaBrush = new LinearGradientBrush
        {
            StartPoint = new Windows.Foundation.Point(0, 1),
            EndPoint   = new Windows.Foundation.Point(0, 0),
        };
        _gotaBrush.GradientStops.Add(new GradientStop { Color = ChuvaAzul, Offset = 0.00 });
        _gotaBrush.GradientStops.Add(new GradientStop { Color = ChuvaAzul, Offset = 0.30 });
        _gotaBrush.GradientStops.Add(new GradientStop { Color = ComAlpha(ChuvaAzul, 0x80), Offset = 0.60 });
        _gotaBrush.GradientStops.Add(new GradientStop { Color = ComAlpha(ChuvaAzul, 0x00), Offset = 1.00 });

        // Bloom (o box-shadow 4px+10px do web): retângulo maior e suave atrás do corpo.
        _bloomBrush = new LinearGradientBrush
        {
            StartPoint = new Windows.Foundation.Point(0, 1),
            EndPoint   = new Windows.Foundation.Point(0, 0),
        };
        _bloomBrush.GradientStops.Add(new GradientStop { Color = ComAlpha(ChuvaAzul, 0x58), Offset = 0.00 });
        _bloomBrush.GradientStops.Add(new GradientStop { Color = ComAlpha(ChuvaAzul, 0x2E), Offset = 0.50 });
        _bloomBrush.GradientStops.Add(new GradientStop { Color = ComAlpha(ChuvaAzul, 0x00), Offset = 1.00 });

        // Halos (§6.1): elipse 80%×70%, cor até 35% → transparente em 65%.
        _haloAzul     = HaloChuva(ChuvaAzul,     centroY: 0.25); // TOPO (aquecimento)
        _haloVermelho = HaloChuva(ChuvaVermelho, centroY: 0.75); // RODAPÉ (cool down)
        RainHalo.Fill = _haloAzul;

        // Relógio único da queda: t anda 1/s por 24 h numa iteração só (nenhuma sessão
        // chega perto; evita o pulo de fase que um loop com Mod teria a cada volta).
        var compositor = ElementCompositionPreview.GetElementVisual(RainCanvas).Compositor;
        _chuvaClock = compositor.CreatePropertySet();
        _chuvaClock.InsertScalar("t", 0f);
        var clock = compositor.CreateScalarKeyFrameAnimation();
        clock.InsertKeyFrame(1f, 86400f, compositor.CreateLinearEasingFunction());
        clock.Duration = TimeSpan.FromSeconds(86400);
        _chuvaClock.StartAnimation("t", clock);

        // As 90 gotas — 3 camadas de profundidade (§3, probabilidades e faixas exatas).
        _gotaTilts = new RotateTransform[90];
        for (var i = 0; i < 90; i++)
        {
            var r = _chuvaRnd.NextDouble();
            double w, h, dur, op;
            if (r < 0.15)      { w = 2.4 + _chuvaRnd.NextDouble() * 0.8; h = 26 + _chuvaRnd.NextDouble() * 18;
                                 dur = 1.0 + _chuvaRnd.NextDouble() * 0.6; op = 0.85 + _chuvaRnd.NextDouble() * 0.15; }
            else if (r < 0.70) { w = 1.4 + _chuvaRnd.NextDouble() * 0.6; h = 14 + _chuvaRnd.NextDouble() * 14;
                                 dur = 1.5 + _chuvaRnd.NextDouble() * 1.0; op = 0.65 + _chuvaRnd.NextDouble() * 0.30; }
            else               { w = 0.9 + _chuvaRnd.NextDouble() * 0.4; h = 8 + _chuvaRnd.NextDouble() * 10;
                                 dur = 2.4 + _chuvaRnd.NextDouble() * 1.5; op = 0.30 + _chuvaRnd.NextDouble() * 0.30; }

            var tilt = new RotateTransform { Angle = ChuvaTiltWarmup, CenterX = w / 2, CenterY = h / 2 };
            _gotaTilts[i] = tilt;

            var gota = new Microsoft.UI.Xaml.Controls.Canvas
            {
                Width = w, Height = h, Opacity = op,
                RenderTransform = tilt,
                IsHitTestVisible = false,
            };
            Microsoft.UI.Xaml.Controls.Canvas.SetLeft(gota, _chuvaRnd.NextDouble() * 956);
            Microsoft.UI.Xaml.Controls.Canvas.SetTop(gota, 0);

            var bloomW = w * 3.6;
            var bloom = new Rectangle { Width = bloomW, Height = h + 10, RadiusX = 3, RadiusY = 3, Fill = _bloomBrush };
            Microsoft.UI.Xaml.Controls.Canvas.SetLeft(bloom, -(bloomW - w) / 2);
            Microsoft.UI.Xaml.Controls.Canvas.SetTop(bloom, -5);
            gota.Children.Add(bloom);

            var corpo = new Rectangle { Width = w, Height = h, RadiusX = 2, RadiusY = 2, Fill = _gotaBrush };
            gota.Children.Add(corpo);

            RainCanvas.Children.Add(gota);

            // Queda: y = Mod(t/dur + faseInicial, 1) * percurso − (40+h). Percurso −40−h → 490
            // (entra inteira por cima, sai inteira por baixo — o Clip do device esconde as pontas).
            var fase0 = _chuvaRnd.NextDouble();
            var percurso = 530.0 + h;
            ElementCompositionPreview.SetIsTranslationEnabled(gota, true);
            var visual = ElementCompositionPreview.GetElementVisual(gota);
            var expr = compositor.CreateExpressionAnimation(
                $"Mod(clk.t / {Inv(dur)} + {Inv(fase0)}, 1f) * {Inv(percurso)} - {Inv(40 + h)}");
            expr.SetReferenceParameter("clk", _chuvaClock);
            visual.StartAnimation("Translation.Y", expr);
        }

        // Respingos no chão (§6.2): 6 elipses em 12/28/44/60/76/90% da largura, cintilando
        // 0.30↔0.65 a cada 1.6 s (o Canvas inteiro pulsa — mesmas fases do splashFlicker).
        _splashBrush = new SolidColorBrush(ChuvaAzul);
        foreach (var pct in new[] { 0.12, 0.28, 0.44, 0.60, 0.76, 0.90 })
        {
            var e = new Ellipse { Width = 16, Height = 4, Fill = _splashBrush, Opacity = 0.9 };
            Microsoft.UI.Xaml.Controls.Canvas.SetLeft(e, pct * 956 - 8);
            Microsoft.UI.Xaml.Controls.Canvas.SetTop(e, 94);
            RainSplash.Children.Add(e);
        }
        var flick = new DoubleAnimation
        {
            From = 0.30, To = 0.65,
            Duration = new Duration(TimeSpan.FromMilliseconds(800)),
            AutoReverse = true, RepeatBehavior = RepeatBehavior.Forever,
            EasingFunction = new SineEase { EasingMode = EasingMode.EaseInOut },
        };
        Storyboard.SetTarget(flick, RainSplash);
        Storyboard.SetTargetProperty(flick, "Opacity");
        _splashFlicker = new Storyboard();
        _splashFlicker.Children.Add(flick);
        _splashFlicker.Begin();
    }

    // Halo de cor (§6.1): radial 80%×70% no topo (aquece) ou rodapé (esfria).
    private static RadialGradientBrush HaloChuva(Color cor, double centroY)
    {
        var b = new RadialGradientBrush
        {
            Center = new Windows.Foundation.Point(0.5, centroY),
            GradientOrigin = new Windows.Foundation.Point(0.5, centroY),
            RadiusX = 0.8, RadiusY = 0.7,
        };
        b.GradientStops.Add(new GradientStop { Color = ComAlpha(cor, 0x66), Offset = 0.00 });
        b.GradientStops.Add(new GradientStop { Color = ComAlpha(cor, 0x55), Offset = 0.35 });
        b.GradientStops.Add(new GradientStop { Color = ComAlpha(cor, 0x00), Offset = 0.65 });
        return b;
    }
}
