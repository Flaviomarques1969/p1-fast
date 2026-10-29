// TelaPrimeiraVersao — a 1ª versão da tela do piloto no notebook (Flávio 2026-10-29, depois de ver a
// demonstração da f251c0be: "tá cheio de frases... não é assim que nós vamos trabalhar"). Na tela fica
// SÓ: os 2 números (freada em m à esquerda, saída em km/h à direita, vs a melhor volta) e o aviso de
// FREIO (luzes das duas laterais + o lavado vermelho do ponto de freada). Sai tudo o resto: mensagem,
// alerta crítico, sensores, barra de voltas, mapa, ápice, status, telas térmicas, chuva, halo do fundo
// e o shift light de MARCHA (leitura de "shift light avisando do freio somente").
//
// Como: UMA chave (Ligada). A UI embrulha cada trecho escondido num Grid com nome (GruposEscondidos,
// na ordem do MainWindow.xaml) e o deixa Collapsed com a chave ligada. O código de cada peça segue
// intacto e roda por baixo (o estado e a publicação para a TV não mudam); desligar a chave devolve a
// tela de antes. A catraca TelaPrimeiraVersaoTests lê o MainWindow.xaml e reprova qualquer peça nova
// que apareça fora dos grupos. Puro: zero UI.

namespace P1Fast.Cockpit.Domain;

public static class TelaPrimeiraVersao
{
    /// <summary>A chave da 1ª versão. true = só os 2 números + aviso de freio na tela.</summary>
    public static readonly bool Ligada = true;

    /// <summary>Filhos diretos do device (MainWindow.xaml) que ficam na tela, na ordem do XAML.</summary>
    public static readonly IReadOnlyList<string> Ficam = new[]
    {
        "BrakeLColuna", "BrakeRColuna", "FreadaPanel", "SaidaPanel", "BrakeWashRect",
    };

    /// <summary>Grids com nome que embrulham o que sai da tela, na ordem do XAML.</summary>
    public static readonly IReadOnlyList<string> GruposEscondidos = new[]
    {
        "EscondidoFundo",    // halo colorido do fundo + moldura preta da esquerda
        "EscondidoTopo",     // sensores + barra de voltas (cápsulas, brilho e sinal da volta atual)
        "EscondidoMeio",     // mapa, mensagem, ápice, shift de marcha, status, lavado da troca
        "EscondidoCamadas",  // telas térmicas, chuva, alerta crítico (borda + palavra)
    };

    /// <summary>Os grupos escondidos aparecem? Só com a chave desligada.</summary>
    public static bool MostraGrupos(bool? ligada = null) => !(ligada ?? Ligada);

    /// <summary>Mensagem e alerta crítico aparecem na tela (e por isso podem esconder os 2 números e
    /// apagar a luz de freio enquanto tomam a tela)? Só com a chave desligada. Com ela ligada nenhum
    /// texto aparece — então nada pode tirar os números nem o aviso de freio da frente do piloto.</summary>
    public static bool MensagensNaTela(bool? ligada = null) => !(ligada ?? Ligada);

    // Demonstração (--demo): as cenas antigas não têm saída e quase sempre freiam igual à
    // referência (número "0" verde, direita vazia). Com a chave ligada a demo passa por estes
    // casos, que exercitam as 3 cores da freada e as 2 da saída. Andaime; o dado real não passa aqui.
    private static readonly (double FreadaM, double RefFreadaM, double SaidaKmh, double RefSaidaKmh)[] CasosDemo =
    {
        (92, 84,  97, 95),   // freada verde 8 (dentro dos 10%) · saída verde 2
        (70, 84,  88, 95),   // freada vermelha 14 (freou depois) · saída vermelha 7
        (102, 84, 91, 95),   // freada amarela 18 (freou antes) · saída vermelha 4
        (80, 84,  99, 95),   // freada verde 4 · saída verde 4
        (60, 72,  90, 87),   // freada vermelha 12 · saída verde 3
        (83, 72,  81, 87),   // freada amarela 11 · saída vermelha 6
    };

    /// <summary>Os 2 números da cena <paramref name="cena"/> da demonstração (cicla pelos casos).</summary>
    public static NumerosInfo NumerosDemo(int cena)
    {
        var c = CasosDemo[((cena % CasosDemo.Length) + CasosDemo.Length) % CasosDemo.Length];
        return NumerosInfo.Comparar(c.FreadaM, c.SaidaKmh, new ReferenciaCurva(c.RefFreadaM, c.RefSaidaKmh));
    }
}
