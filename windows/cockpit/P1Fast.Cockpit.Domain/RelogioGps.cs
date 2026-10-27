// RelogioGps — carimbo de tempo de CADA fix pelo relógio do próprio GPS (iTOW), não pela
// chegada no Bluetooth.
//
// Item 1 (BASE) da ordem aprovada pelo Flávio em 27/10/2026. Antes (5.3a) só a RAJADA era
// espaçada pelo iTOW e o último frame de cada notify ficava colado na CHEGADA — o atraso
// variável do Bluetooth entrava no dt de um notify para o outro (km/h por dist/dt e
// desaceleração tremendo). Aqui o relógio é contínuo: âncora na 1ª chegada e, daí em
// diante, t = âncoraParede + (iTOW − iTOW da âncora).
// Reancora (volta para a chegada) quando o iTOW não serve mais de régua: volta para trás
// (virada da semana GPS, aparelho reiniciou), pula mais de 1 s (Bluetooth caiu e voltou) ou
// o carimbo calculado se afasta mais de 1 s da chegada (âncora ruim — o tWall precisa casar
// com o motor e com o vídeo, que usam o relógio de parede).

namespace P1Fast.Cockpit.Domain;

/// <summary>Relógio de fixes pelo iTOW do GPS (uma instância por conexão do aparelho).</summary>
public sealed class RelogioGps
{
    /// <summary>Salto máximo de iTOW entre fixes seguidos (ms) antes de reancorar.</summary>
    public const long SaltoMaxMs = 1000;
    /// <summary>Distância máxima (ms) entre o carimbo calculado e a chegada antes de reancorar.</summary>
    public const long DerivaMaxMs = 1000;

    private long _ancoraWall, _ancoraItow, _ultimoItow;
    private bool _ancorado;

    /// <summary>Quantas vezes reancorou (diagnóstico de campo; a 1ª âncora não conta).</summary>
    public int Reancoragens { get; private set; }

    /// <summary>Carimba os frames de UM notify (em ordem); chegadaWallMs = chegada do notify.</summary>
    public long[] CarimbarRajada(IReadOnlyList<long> itows, long chegadaWallMs)
    {
        int n = itows?.Count ?? 0;
        var outp = new long[n];
        if (n == 0) return outp;

        // Estimativa pela chegada (último frame = chegada, anteriores recuam pelo iTOW): é a
        // âncora quando precisa ancorar e a régua da deriva.
        var pelaChegada = RaceBoxUbxParser.EspacarTimestamps(itows!, chegadaWallMs);

        for (int i = 0; i < n; i++)
        {
            long itow = itows![i];
            long d = itow - _ultimoItow;
            bool reguaOk = _ancorado && d > 0 && d <= SaltoMaxMs
                && Math.Abs(Carimbo(itow) - pelaChegada[i]) <= DerivaMaxMs;
            if (!reguaOk)
            {
                if (_ancorado) Reancoragens++;
                _ancoraItow = itow;
                _ancoraWall = pelaChegada[i];
                _ancorado = true;
            }
            outp[i] = Carimbo(itow);
            _ultimoItow = itow;
        }
        return outp;
    }

    private long Carimbo(long itow) => _ancoraWall + (itow - _ancoraItow);
}
