using Microsoft.UI.Xaml;
using P1Fast.Cockpit.Domain;

namespace P1Fast.Cockpit.UI;

/// <summary>
/// Janela principal do cockpit. Por enquanto é placeholder — o port do
/// mockup canônico (DOM, classes OKlch, keyframes, halo radial, shift
/// light, apex pontos, mensagem, delta, ação) entra em iterações seguintes.
/// O <see cref="CockpitState"/> já é instanciado e observado, pra a próxima
/// fase só ligar os data-binds.
/// </summary>
public sealed partial class MainWindow : Window
{
    private readonly CockpitState _cockpitState = new();

    public MainWindow()
    {
        InitializeComponent();
        StatusText.Text = $"CockpitState pronto — modo do shift: {_cockpitState.Get().Shift.Mode}";

        _cockpitState.OnChange((_, _, _) =>
        {
            // Próxima iteração: aplicar mudanças nos elementos XAML aqui.
            // Por enquanto só registra que o observador está ligado.
        });
    }
}
