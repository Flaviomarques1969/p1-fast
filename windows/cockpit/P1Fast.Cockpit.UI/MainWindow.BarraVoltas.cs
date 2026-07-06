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
using Microsoft.UI.Xaml.Shapes;
using Windows.UI;

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
    // Gotas: branco morno no aquecimento, branco frio no cool-down (ecoa a chuva térmica).
    // Alfa alto pra ler mesmo sobre a cápsula colorida (o azul do cool-down "comia" gotas fracas).
    private static readonly Color ChuvaAquece = Color.FromArgb(0xC8, 0xFF, 0xEC, 0xD2);
    private static readonly Color ChuvaEsfria = Color.FromArgb(0xD2, 0xF0, 0xF8, 0xFF);

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
        var blocks = new Border[n];
        var labels = new TextBlock[n];
        var rains  = new Canvas?[n];

        for (var i = 0; i < n; i++)
        {
            var st = i < plano.Length ? plano[i] : StintBlockState.Pending;
            var grid = new Grid();

            Canvas? rain = null;
            if (st == StintBlockState.Aquecimento) rain = CriarChuva(capW, ChuvaAquece);
            else if (st == StintBlockState.CoolDown) rain = CriarChuva(capW, ChuvaEsfria);
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
    }

    // Motivo de chuva (gotas leves na diagonal) — atrás do número, escondido por padrão.
    private static Canvas CriarChuva(double capW, Color tint)
    {
        var cv = new Canvas { Width = capW, Height = BarBlockH, IsHitTestVisible = false, Visibility = Visibility.Collapsed };
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
            var rain = _stintRain.Length == n ? _stintRain[i] : null;

            if (st == StintBlockState.Pending)   // vaga (raro na barra dinâmica) — moldura discreta
            {
                blk.Background = new SolidColorBrush(VagaFill);
                blk.BorderBrush = new SolidColorBrush(VagaBorda);
                blk.BorderThickness = new Thickness(1);
                blk.Opacity = 1;
                blk.RenderTransform = null;
                lbl.Text = "";
                if (rain is not null) rain.Visibility = Visibility.Collapsed;
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

            // Chuva só nas cápsulas de aquecimento e cool-down (sempre visível nelas).
            if (rain is not null)
                rain.Visibility = (st == StintBlockState.Aquecimento || st == StintBlockState.CoolDown)
                    ? Visibility.Visible : Visibility.Collapsed;
        }

        AtualizarGlowVoltaAtual(atual);
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
