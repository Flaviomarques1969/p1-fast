// MainWindow.BarraVoltas.cs — Direção "C" da barra de voltas (Flávio 2026-07-05), agora DINÂMICA.
//
// A barra é o PLANO do stint por VOLTA. Decisões do Flávio (2026-07-05):
//   • Nº de voltas é definido no STINT → a barra tem N CÁPSULAS = nº de voltas (não mais 12 fixas);
//     as cápsulas encolhem/alargam pra caber numa largura fixa (BarTotalW). Aquecimento e cool-down
//     nunca somem. (Antes, stint > 12 voltas perdia a cauda; ver PlanoStint.ExpandirBarra.)
//   • O piloto pode registrar QUANTAS paradas no box quiser → cada Box vira uma cápsula magenta.
//   • A 1ª volta (aquecimento) e a última (cool-down) levam um MOTIVO DE CHUVA dentro da cápsula
//     (aquecendo o motor / resfriando) — gotas leves, atrás do número.
//
// Cápsulas são GERADAS por código (MontarBarra) a partir do plano; a pintura de estado
// (feita/atual/a-fazer + glow/caret) é centralizada em RepintarBarra. Telas só EXIBEM.

using System;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI.Xaml.Media.Animation;
using Microsoft.UI.Xaml.Shapes;
using Windows.UI;
using P1Fast.Cockpit.Domain;

namespace P1Fast.Cockpit.UI;

public sealed partial class MainWindow
{
    // Geometria da barra. Largura TOTAL fixa (device 956 escalado como um bloco); as cápsulas
    // dividem essa largura. Topo 50, altura 24 (cápsula "padrão" do combo aprovado).
    private const double DeviceW = 956, BarTotalW = 800, BarGap = 5, BarTop = 50, BarBlockH = 24, BarLift = 3;
    private static readonly double BarLeft = (DeviceW - BarTotalW) / 2.0;   // 78
    private const int BarMaxSlots = 40;   // teto de segurança de voltas (o leitor expande até aqui)

    private Microsoft.UI.Xaml.Controls.TextBlock[] _stintLabels = Array.Empty<Microsoft.UI.Xaml.Controls.TextBlock>();
    private Canvas?[] _stintRain = Array.Empty<Canvas?>();   // motivo de chuva por cápsula (null = sem chuva)
    private double _capWAtual = 56;                            // largura atual de cada cápsula

    private StintBlockState[] _barraPattern = PlanoStintPlaceholder;
    private int _voltaAtualRender = -1;

    private static readonly Color TintaEscura = Color.FromArgb(0xFF, 0x14, 0x11, 0x0A);
    private static readonly Color TintaClara  = Color.FromArgb(0xFF, 0xF2, 0xF2, 0xF2);
    private static Color TintaDe(Color bg)
        => (0.299 * bg.R + 0.587 * bg.G + 0.114 * bg.B) > 140 ? TintaEscura : TintaClara;

    private static readonly Color VagaFill  = Color.FromArgb(0xFF, 0x0E, 0x0E, 0x0E);
    private static readonly Color VagaBorda = Color.FromArgb(0xFF, 0x24, 0x24, 0x24);
    // Chuva nas cápsulas de aquecimento/cool-down (Flávio 2026-07-05): AZUL quando o motor
    // precisa ESQUENTAR, VERMELHO quando precisa ESFRIAR — mesma convenção da chuva térmica de
    // tela cheia (ChuvaAzul/ChuvaVermelho em MainWindow.Chuva.cs). A opacidade segue a FASE do
    // cérebro (ChuvaTermica) e SOME conforme a temperatura chega na meta (leve/médio/alto → off).
    private Canvas? _chuvaCapAquece, _chuvaCapEsfria;
    private double _opCapAquece, _opCapEsfria;
    private Storyboard? _fadeCapAquece, _fadeCapEsfria;

    // Tira as vagas do fim (padding além de Voltas) — a barra dinâmica mostra só voltas reais.
    private static StintBlockState[] SemVagaFinal(StintBlockState[] p)
    {
        var n = p.Length;
        while (n > 0 && p[n - 1] == StintBlockState.Pending) n--;
        if (n == p.Length) return p;
        if (n <= 0) return p;              // tudo vaga? deixa como veio (o chamador trata)
        var r = new StintBlockState[n];
        Array.Copy(p, r, n);
        return r;
    }

    // (Re)constrói as cápsulas a partir do plano: N cápsulas = N voltas, largura dividindo BarTotalW.
    private void MontarBarra(StintBlockState[] plano)
    {
        if (StintBar is null) return;
        var n = Math.Max(1, plano.Length);
        var capW = Math.Round((BarTotalW - (n - 1) * BarGap) / n, 2);
        _capWAtual = capW;

        StintBar.Children.Clear();
        _chuvaCapAquece = null; _chuvaCapEsfria = null;
        _opCapAquece = 0; _opCapEsfria = 0;
        var blocks = new Border[n];
        var labels = new TextBlock[n];
        var rains  = new Canvas?[n];

        for (var i = 0; i < n; i++)
        {
            var st = i < plano.Length ? plano[i] : StintBlockState.Pending;
            var grid = new Grid();

            Canvas? rain = null;
            if (st == StintBlockState.Aquecimento) { rain = CriarChuva(capW, ChuvaAzul);     _chuvaCapAquece = rain; }
            else if (st == StintBlockState.CoolDown) { rain = CriarChuva(capW, ChuvaVermelho); _chuvaCapEsfria = rain; }
            if (rain is not null) grid.Children.Add(rain);

            var lbl = new TextBlock
            {
                HorizontalAlignment = HorizontalAlignment.Center,
                VerticalAlignment = VerticalAlignment.Center,
                FontWeight = Microsoft.UI.Text.FontWeights.Bold,
            };
            grid.Children.Add(lbl);

            var b = new Border
            {
                Width = capW,
                Height = BarBlockH,
                CornerRadius = new CornerRadius(6),
                Child = grid,
            };
            StintBar.Children.Add(b);
            blocks[i] = b; labels[i] = lbl; rains[i] = rain;
        }

        _stintBlocks = blocks; _stintLabels = labels; _stintRain = rains;
        AtualizarChuvaCapsulas(_faseChuvaAtual);   // reafirma o estado da chuva após remontar
    }

    // Motivo de chuva (gotas leves na diagonal) — atrás do número. Opacidade 0 por padrão;
    // quem acende/apaga é AtualizarChuvaCapsulas conforme a fase térmica do cérebro.
    private static Canvas CriarChuva(double capW, Color tint)
    {
        var cv = new Canvas { Width = capW, Height = BarBlockH, IsHitTestVisible = false, Opacity = 0 };
        var brush = new SolidColorBrush(tint);
        var drops = Math.Max(3, (int)(capW / 15));
        var step = capW / (drops + 1);
        for (var k = 0; k < drops; k++)
        {
            var d = new Rectangle
            {
                Width = 1.6, Height = 6, RadiusX = 1, RadiusY = 1, Fill = brush,
                RenderTransform = new RotateTransform { Angle = 22 },
            };
            Canvas.SetLeft(d, step * (k + 1) + (k % 2 == 0 ? -2 : 2));
            Canvas.SetTop(d, (k % 3) * 5 + 3);
            cv.Children.Add(d);
        }
        return cv;
    }

    // Pinta a barra a partir de (_barraPattern, _voltaAtualRender). Idempotente e barata.
    private void RepintarBarra()
    {
        var n = _stintBlocks.Length;
        if (n == 0 || _stintLabels.Length != n) return;
        var plano = _barraPattern;
        var atual = _voltaAtualRender;

        for (var i = 0; i < n; i++)
        {
            var st  = i < plano.Length ? plano[i] : StintBlockState.Pending;
            var blk = _stintBlocks[i];
            var lbl = _stintLabels[i];

            if (st == StintBlockState.Pending)   // vaga (raro na barra dinâmica) — moldura discreta
            {
                blk.Background = new SolidColorBrush(VagaFill);
                blk.BorderBrush = new SolidColorBrush(VagaBorda);
                blk.BorderThickness = new Thickness(1);
                blk.Opacity = 1;
                blk.RenderTransform = null;
                lbl.Text = "";
                continue;
            }

            var isAtual  = i == atual;
            var isAFazer = atual >= 0 && i > atual;
            var baseCol  = StintColors.TryGetValue(st, out var c) ? c : Faint;
            var fill     = isAtual ? Foco : baseCol;

            blk.Background = new SolidColorBrush(fill);
            blk.BorderBrush = null;
            blk.BorderThickness = new Thickness(0);
            blk.Opacity = isAFazer ? 0.60 : 1.0;                                  // a-fazer a 60%
            blk.RenderTransform = isAtual ? new TranslateTransform { Y = -BarLift } : null;

            lbl.Text = st == StintBlockState.Box ? "BOX" : (i + 1).ToString();
            lbl.FontSize = st == StintBlockState.Box ? 12 : 15;                    // número grande
            lbl.Foreground = new SolidColorBrush(TintaDe(fill));
        }

        AtualizarGlowVoltaAtual(atual);
    }

    // Acende/apaga a chuva das cápsulas conforme a FASE térmica do cérebro: AZUL na cápsula de
    // aquecimento enquanto o motor esquenta, VERMELHO na do cool-down enquanto esfria; a opacidade
    // cai (leve/médio/alto → off) conforme a temperatura chega na meta — o "some lentamente".
    private void AtualizarChuvaCapsulas(FaseChuva fase)
    {
        var warm = fase is FaseChuva.WarmupLeve or FaseChuva.WarmupMedio or FaseChuva.WarmupAlto;
        var cool = fase is FaseChuva.CooldownLeve or FaseChuva.CooldownMedio or FaseChuva.CooldownAlto;
        // Reaproveita a opacidade global por fase da spec (§5), teto 0.9 pra a cápsula não saturar.
        var opWarm = warm ? Math.Min(0.9, OpacidadeGlobal(fase)) : 0.0;
        var opCool = cool ? Math.Min(0.9, OpacidadeGlobal(fase)) : 0.0;

        if (_chuvaCapAquece is { } a) AnimarOpacidade(a, ref _opCapAquece, ref _fadeCapAquece, opWarm);
        if (_chuvaCapEsfria is { } e) AnimarOpacidade(e, ref _opCapEsfria, ref _fadeCapEsfria, opCool);
    }

    // Fade suave (700 ms ease-out) da opacidade de um elemento — o "some lentamente".
    private static void AnimarOpacidade(UIElement el, ref double atual, ref Storyboard? sb, double alvo)
    {
        if (Math.Abs(atual - alvo) < 0.001) return;
        sb?.Stop();
        var anim = new DoubleAnimation
        {
            From = atual, To = alvo,
            Duration = new Duration(TimeSpan.FromMilliseconds(700)),
            EasingFunction = new CubicEase { EasingMode = EasingMode.EaseOut },
        };
        Storyboard.SetTarget(anim, el);
        Storyboard.SetTargetProperty(anim, "Opacity");
        var s = new Storyboard();
        s.Children.Add(anim);
        s.Begin();
        sb = s;
        atual = alvo;
    }

    // Move o glow dourado + o sinal pra cápsula da volta atual (ou esconde se não há volta em curso).
    private void AtualizarGlowVoltaAtual(int atual)
    {
        var n = _stintBlocks.Length;
        var mostra = atual >= 0 && atual < n
                     && atual < _barraPattern.Length && _barraPattern[atual] != StintBlockState.Pending;
        if (!mostra)
        {
            VoltaGlow.Visibility = Visibility.Collapsed;
            VoltaCaret.Visibility = Visibility.Collapsed;
            return;
        }

        var cx = BarLeft + atual * (_capWAtual + BarGap) + _capWAtual / 2.0;

        VoltaGlow.Width = _capWAtual + 72;   // glow proporcional à cápsula (bloom transborda ~36 px)
        VoltaGlowXf.X = cx - VoltaGlow.Width / 2.0;
        VoltaGlowXf.Y = BarTop + BarBlockH / 2.0 - VoltaGlow.Height / 2.0 - BarLift;
        VoltaGlow.Visibility = Visibility.Visible;

        VoltaCaretXf.X = cx - 6;
        VoltaCaretXf.Y = BarTop - BarLift - 9;
        VoltaCaret.Visibility = Visibility.Visible;
    }
}
