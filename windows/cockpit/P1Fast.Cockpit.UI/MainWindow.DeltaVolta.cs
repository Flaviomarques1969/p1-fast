// MainWindow.DeltaVolta.cs — o cartão do delta no centro da tela do piloto (Flávio 2026-10-30, painel
// p1fast-cartao-delta-mapa-0013). O número (centésimos, sem sinal) e o lado vêm prontos do cérebro
// (CockpitState.DeltaVolta, chave "deltaVolta"); aqui só se pinta: face em degradê, degraus do relevo, tinta
// do vidro, aura e filete de baixo na cor do lado (verde = igual ou mais rápido, vermelho = mais lento). Sem
// delta = cartão neutro, sem número. Quando o lado muda, o cartão dá um pulo curto (1 → 1,06 → 1) — o delta
// ao vivo chega até 10×/s, por isso a pintura e o pulo só acontecem na troca de lado, nunca a cada número.
// Linha de baixo (dentro do cartão, sem rótulo): melhor volta, a que o delta usa, e última volta.

using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI.Xaml.Media.Animation;
using P1Fast.Cockpit.Domain;
using Windows.UI;

namespace P1Fast.Cockpit.UI;

public sealed partial class MainWindow
{
    private Tone _dvTomPintado = Tone.Neutro;
    private Storyboard? _dvPulo;

    private void ApplyDeltaVolta(DeltaVoltaInfo d)
    {
        var texto = d.Texto();
        foreach (var t in new[] { DvNumSombra, DvNumFundo3, DvNumFundo2, DvNumFundo1, DvNum }) t.Text = texto;

        var tom = texto.Length == 0 ? Tone.Neutro : d.Tom == Tone.Erro ? Tone.Erro : Tone.Bom;
        if (tom == _dvTomPintado) return;
        _dvTomPintado = tom;
        PintarCartaoDelta(tom);
        if (tom != Tone.Neutro) PularCartaoDelta();
    }

    private void PintarCartaoDelta(Tone tom)
    {
        var transparente = new SolidColorBrush(Color.FromArgb(0, 0, 0, 0));
        if (tom == Tone.Neutro)
        {
            DvTinta.Background = transparente;
            DvBordaBaixo.Background = transparente;
            DvAura1.BorderBrush = transparente;
            DvAura2.BorderBrush = transparente;
            DvAura3.BorderBrush = transparente;
            return;
        }

        var cor = tom == Tone.Erro ? Erro : Bom;
        // Face: clara no alto, a cor cheia embaixo (luz vindo de cima, como o brilho do vidro).
        var face = new LinearGradientBrush
        {
            StartPoint = new Windows.Foundation.Point(0.5, 0),
            EndPoint   = new Windows.Foundation.Point(0.5, 1),
        };
        face.GradientStops.Add(new GradientStop { Color = MixColor(cor, White, 0.55), Offset = 0.00 });
        face.GradientStops.Add(new GradientStop { Color = MixColor(cor, White, 0.15), Offset = 0.45 });
        face.GradientStops.Add(new GradientStop { Color = cor, Offset = 1.00 });
        DvNum.Foreground = face;
        // Degraus do relevo: a mesma cor, cada vez mais escura para baixo.
        DvNumFundo1.Foreground = new SolidColorBrush(MixColor(cor, Color.FromArgb(0xFF, 0, 0, 0), 0.35));
        DvNumFundo2.Foreground = new SolidColorBrush(MixColor(cor, Color.FromArgb(0xFF, 0, 0, 0), 0.55));
        DvNumFundo3.Foreground = new SolidColorBrush(MixColor(cor, Color.FromArgb(0xFF, 0, 0, 0), 0.75));

        // Vidro acende de baixo para cima na cor; filete de luz na borda de baixo; aura que some para fora.
        var tinta = new LinearGradientBrush
        {
            StartPoint = new Windows.Foundation.Point(0.5, 0),
            EndPoint   = new Windows.Foundation.Point(0.5, 1),
        };
        tinta.GradientStops.Add(new GradientStop { Color = WithAlpha(cor, 0x00), Offset = 0.35 });
        tinta.GradientStops.Add(new GradientStop { Color = WithAlpha(cor, 0x2E), Offset = 1.00 });
        DvTinta.Background = tinta;
        DvBordaBaixo.Background = new SolidColorBrush(WithAlpha(cor, 0xCC));
        DvAura1.BorderBrush = new SolidColorBrush(WithAlpha(cor, 0x40));
        DvAura2.BorderBrush = new SolidColorBrush(WithAlpha(cor, 0x22));
        DvAura3.BorderBrush = new SolidColorBrush(WithAlpha(cor, 0x10));
    }

    private void PularCartaoDelta()
    {
        _dvPulo?.Stop();
        var sb = new Storyboard();
        foreach (var prop in new[] { "ScaleX", "ScaleY" })
        {
            var a = new DoubleAnimation
            {
                From = 1.0,
                To = 1.06,
                Duration = new Duration(TimeSpan.FromMilliseconds(110)),
                AutoReverse = true,
                EasingFunction = new CubicEase { EasingMode = EasingMode.EaseOut },
            };
            Storyboard.SetTarget(a, DvEscala);
            Storyboard.SetTargetProperty(a, prop);
            sb.Children.Add(a);
        }
        _dvPulo = sb;
        sb.Begin();
    }

    /// <summary>Linha de baixo do cartão: melhor volta (a referência do delta) à esquerda e última volta à
    /// direita. Sem tempo = em branco.</summary>
    private void ApplyVoltasDoCartao(double? melhorMs, double? ultimaMs)
    {
        DvMelhor.Text = DeltaVoltaInfo.TempoDeVolta(melhorMs);
        DvUltima.Text = DeltaVoltaInfo.TempoDeVolta(ultimaMs);
    }

    /// <summary>A linha de baixo com o que a sessão tem agora (chamado quando a volta fecha e quando a
    /// referência é semeada).</summary>
    private void AtualizarVoltasDoCartao()
        => ApplyVoltasDoCartao(_orquestrador?.MelhorVolta.TempoMs, _sessaoLapsMs.Count > 0 ? _sessaoLapsMs[^1] : null);
}
