// TelaPrimeiraVersao — a 1ª versão da tela do piloto no notebook (Flávio 2026-10-29). Depois de ver a
// f251c0be ("tá cheio de frases... não é assim que nós vamos trabalhar") e a b9dfd3cd (que escondia a tela
// inteira — errado): "eu me referia somente aos dois números do centro e não aparecerem mensagens
// escritas... todo o resto era para se manter" + "os números podem ser 40% maiores e ficarem
// centralizados nas suas metades da tela".
//
// Como: UMA chave (Ligada). Com ela ligada, só os TEXTOS ESCRITOS saem da tela (TextosEscondidos:
// mensagem, linha de status, borda e palavra do alerta crítico). Sensores, barra de voltas, mapa,
// ápice (entrada/freio/vmin/ápice/saída), shift light, halo, luzes e lavados de freio, tela térmica e
// chuva ficam como estavam. Os 2 números (MainWindow.xaml) ficam 40% maiores, cada um no centro da
// sua metade. A mensagem segue no estado (gravação e TV não mudam); desligar a chave devolve a tela
// de antes. Catraca: TelaPrimeiraVersaoTests (lê o MainWindow.xaml e os MainWindow*.cs). Puro: zero UI.
//
// Luz de freio na barra de baixo (Flávio 2026-10-29 ~23h, depois de ver a ef7ac0dc: "o shift light do freio só
// que vai funcionar. põe ele na parte debaixo no shift light horizontal"). Com a chave ligada, as 2 colunas
// verticais de freio saem da tela e a barra de 17 luzes de baixo passa a ser a luz de FREIO: o mesmo nível 0..9,
// das PONTAS para o CENTRO (degrau 8 = a luz do centro), as mesmas cores e o mesmo pisca vermelho no ponto. O
// shift de giro (marcha) não acende nesta versão.

namespace P1Fast.Cockpit.Domain;

public static class TelaPrimeiraVersao
{
    /// <summary>A chave da 1ª versão. true = sem mensagem escrita na tela.</summary>
    public static readonly bool Ligada = true;

    /// <summary>Os textos escritos que saem da tela com a chave ligada (x:Name no MainWindow.xaml).</summary>
    public static readonly IReadOnlyList<string> TextosEscondidos = new[]
    {
        "AlertBlocoRoot",   // mensagem (comunicação)
        "StatusText",       // linha de status de baixo
        "CriticoBorda",     // alerta crítico: borda piscando
        "CriticoOverlay",   // alerta crítico: palavra vermelha
    };

    /// <summary>Quanto os 2 números cresceram sobre a f251c0be (116 e 92 de fonte).</summary>
    public const double AumentoDosNumeros = 1.4;

    /// <summary>Os textos escondidos aparecem? Só com a chave desligada.</summary>
    public static bool MostraTextos(bool? ligada = null) => !(ligada ?? Ligada);

    /// <summary>Mensagem e alerta crítico aparecem na tela (e por isso podem esconder os 2 números e
    /// apagar a luz de freio enquanto tomam a tela)? Só com a chave desligada.</summary>
    public static bool MensagensNaTela(bool? ligada = null) => !(ligada ?? Ligada);

    /// <summary>As 2 colunas verticais de luz de freio (x:Name no MainWindow.xaml), que saem da tela com a
    /// chave ligada — a luz de freio passa para a barra de baixo.</summary>
    public static readonly IReadOnlyList<string> ColunasDeFreioEscondidas = new[] { "BrakeLColuna", "BrakeRColuna" };

    /// <summary>A barra de 17 luzes de baixo mostra a luz de FREIO? Só com a chave ligada.</summary>
    public static bool FreioNaBarraDeBaixo(bool? ligada = null) => ligada ?? Ligada;

    /// <summary>O shift de giro (marcha) acende a barra de baixo? Só com a chave desligada.</summary>
    public static bool ShiftDeGiroNaTela(bool? ligada = null) => !(ligada ?? Ligada);

    /// <summary>Luzes na barra de baixo.</summary>
    public const int LuzesDaBarra = 17;

    /// <summary>O par de luzes da barra de baixo que o degrau <paramref name="degrau"/> (0..8) da luz de
    /// freio acende: das PONTAS para o CENTRO; o degrau 8 é a luz do centro, a mesma dos dois lados.</summary>
    public static (int Esquerda, int Direita) LuzesDoDegrau(int degrau) => (degrau, LuzesDaBarra - 1 - degrau);

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
