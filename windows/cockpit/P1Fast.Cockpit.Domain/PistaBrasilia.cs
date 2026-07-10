// PistaBrasilia — constantes geográficas ÚNICAS do Autódromo de Brasília.
//
// Antes estavam TRIPLICADAS: a linha de chegada aparecia copiada em SessaoReplay.cs
// (Domain), MainWindow.VoltaAtual.cs (UI) e SessaoReplay/Program.cs (console); a caixa
// geográfica da pista vivia dentro de GpsFiltroAoVivo. Faxina onda 2 (2026-07-10):
// fonte única aqui, com os MESMOS valores de antes (nenhum número mudou).
//
// A decisão de pista hardcoded = Brasília continua sendo do Flávio (fora dela o cérebro
// fica cego em silêncio) — este arquivo NÃO muda essa decisão, só centraliza os números
// pra não divergirem entre os pontos.

namespace P1Fast.Cockpit.Domain;

public static class PistaBrasilia
{
    /// <summary>Linha de chegada oficial de Brasília — os dois pontos (A, B) que definem o
    /// segmento. Cruzar de um lado pro outro = fronteira de volta. Fonte única do valor.</summary>
    public static readonly PontoGps ChegadaA = new(-15.7728816, -47.9000707);
    public static readonly PontoGps ChegadaB = new(-15.7725493, -47.9001926);

    /// <summary>Caixa geográfica grosseira da pista ("está em Brasília"). Um fix fora desta
    /// caixa é reprovado antes de alimentar o cérebro (ver GpsFiltroAoVivo.QualidadeOk).</summary>
    public const double LatMin = -16.1, LatMax = -15.4, LonMin = -48.3, LonMax = -47.6;
}
