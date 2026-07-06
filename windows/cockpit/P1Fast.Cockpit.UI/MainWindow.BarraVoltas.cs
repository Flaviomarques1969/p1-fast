// MainWindow.BarraVoltas.cs — Direção "C" da barra de voltas (Flávio 2026-07-05, escolhida entre A/B/C).
//
// A barra do topo é o PLANO do stint por VOLTA (aquecimento · planejadas · box · cool-down). Aqui ela
// vira CÁPSULAS NUMERADAS e reativas: RepintarBarra() lê o plano (_barraPattern) + a volta atual
// (_voltaAtualRender, vinda da etapa 4 em MainWindow.VoltaAtual.cs) e pinta cada cápsula num de 3 estados:
//   • FEITA  (i < atual)   — cor cheia do tipo, opaca.
//   • ATUAL  (i == atual)  — dourada (#F0C040=Foco), sobe 3 px, com GLOW (VoltaGlow) + sinal (VoltaCaret).
//   • A-FAZER (i > atual)   — cor do tipo esmaecida (opacity 0.42).
// Antes de começar (atual < 0) a barra mostra o plano inteiro em cor cheia (igual ao repouso de hoje).
//
// É a ÚNICA fonte de verdade da pintura da barra: ApplyStintPattern (plano mudou) e ApplyVoltaAtualHalo
// (volta atual mudou) só atualizam o estado e chamam RepintarBarra(). Telas só EXIBEM — o plano vem da nuvem.

using System;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Media;
using Windows.UI;

namespace P1Fast.Cockpit.UI;

public sealed partial class MainWindow
{
    // Geometria FIXA da barra (casa 1:1 com o XAML: device 956, cápsula 56×24, gap 5, topo 50).
    // O device inteiro é escalado como um bloco (OnRootSizeChanged), então posição fixa é consistente.
    private const double BarBlockW = 56, BarBlockH = 24, BarGap = 5, BarTop = 50, DeviceW = 956;
    private const int    BarN = 12;
    private static readonly double BarLeft = (DeviceW - (BarN * BarBlockW + (BarN - 1) * BarGap)) / 2.0;
    private const double BarLift = 3;   // quanto a cápsula atual sobe (px)

    // Labels (número) de cada cápsula — preenchidas no construtor, em paralelo a _stintBlocks.
    private Microsoft.UI.Xaml.Controls.TextBlock[] _stintLabels = Array.Empty<Microsoft.UI.Xaml.Controls.TextBlock>();

    // Plano exibido AGORA (o real da nuvem ou o placeholder). ApplyStintPattern mantém em dia.
    private StintBlockState[] _barraPattern = PlanoStintPlaceholder;
    // Volta atual JÁ clampeada ao plano (a etapa 4 escreve via ApplyVoltaAtualHalo). -1 = nenhuma.
    private int _voltaAtualRender = -1;

    // Tinta do número: escura em cápsula clara, clara em cápsula escura (luminância perceptual).
    private static readonly Color TintaEscura = Color.FromArgb(0xFF, 0x14, 0x11, 0x0A);
    private static readonly Color TintaClara  = Color.FromArgb(0xFF, 0xF2, 0xF2, 0xF2);
    private static Color TintaDe(Color bg)
        => (0.299 * bg.R + 0.587 * bg.G + 0.114 * bg.B) > 140 ? TintaEscura : TintaClara;

    private static readonly Color VagaFill  = Color.FromArgb(0xFF, 0x0E, 0x0E, 0x0E);
    private static readonly Color VagaBorda  = Color.FromArgb(0xFF, 0x24, 0x24, 0x24);

    // Pinta a barra inteira a partir de (_barraPattern, _voltaAtualRender). Idempotente e barata.
    private void RepintarBarra()
    {
        if (_stintBlocks.Length != BarN || _stintLabels.Length != BarN) return;
        var plano = _barraPattern;
        var atual = _voltaAtualRender;

        for (var i = 0; i < BarN; i++)
        {
            var st  = i < plano.Length ? plano[i] : StintBlockState.Pending;
            var blk = _stintBlocks[i];
            var lbl = _stintLabels[i];

            if (st == StintBlockState.Pending)   // vaga (slot além do stint) — moldura discreta, sem número
            {
                blk.Background      = new SolidColorBrush(VagaFill);
                blk.BorderBrush     = new SolidColorBrush(VagaBorda);
                blk.BorderThickness = new Thickness(1);
                blk.Opacity         = 1;
                blk.RenderTransform = null;
                lbl.Text            = "";
                continue;
            }

            var isAtual    = i == atual;
            var isAFazer   = atual >= 0 && i > atual;
            var baseCol    = StintColors.TryGetValue(st, out var c) ? c : Faint;
            var fill       = isAtual ? Foco : baseCol;

            blk.Background      = new SolidColorBrush(fill);
            blk.BorderBrush     = null;
            blk.BorderThickness = new Thickness(0);
            blk.Opacity         = isAFazer ? 0.42 : 1.0;
            blk.RenderTransform = isAtual ? new TranslateTransform { Y = -BarLift } : null;

            lbl.Text       = st == StintBlockState.Box ? "BOX" : (i + 1).ToString();
            lbl.FontSize   = st == StintBlockState.Box ? 10 : 12;
            lbl.Foreground = new SolidColorBrush(TintaDe(fill));
        }

        AtualizarGlowVoltaAtual(atual);
    }

    // Move o glow dourado + o sinal pra cápsula da volta atual (ou esconde se não há volta em curso).
    private void AtualizarGlowVoltaAtual(int atual)
    {
        var mostra = atual >= 0 && atual < BarN
                     && atual < _barraPattern.Length && _barraPattern[atual] != StintBlockState.Pending;
        if (!mostra)
        {
            VoltaGlow.Visibility  = Visibility.Collapsed;
            VoltaCaret.Visibility = Visibility.Collapsed;
            return;
        }

        var cx = BarLeft + atual * (BarBlockW + BarGap) + BarBlockW / 2.0;

        VoltaGlowXf.X = cx - VoltaGlow.Width / 2.0;
        VoltaGlowXf.Y = BarTop + BarBlockH / 2.0 - VoltaGlow.Height / 2.0 - BarLift;
        VoltaGlow.Visibility = Visibility.Visible;

        VoltaCaretXf.X = cx - 6;                 // caret tem 12 px de base
        VoltaCaretXf.Y = BarTop - BarLift - 9;   // logo acima da cápsula (que subiu BarLift)
        VoltaCaret.Visibility = Visibility.Visible;
    }
}
