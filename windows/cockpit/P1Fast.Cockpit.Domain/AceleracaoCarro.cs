// AceleracaoCarro — transforma o G CRU do RaceBox (referencial do aparelho) em G do CARRO:
// longitudinal (+ acelerando, − freando) e lateral, já descontado o "zero" do aparelho.
//
// Item 1 (BASE) da ordem aprovada pelo Flávio em 27/10/2026 (painel p1fast-gps-funcoes-0850).
// Eixos PROVADOS na volta real de 27/10 00h24 (.claude-exec/analise-gps-20261027/eixos.txt):
//   frente/trás = +gx (correlação +0,96 com a derivada da velocidade do GPS);
//   lateral     = −gy (−0,93 com velocidade × giro do rumo); gz não correlaciona (controle).
// Zero: o aparelho parado não marca 0 (mediu gx −0,048 · gy +0,035). Aqui o zero é aprendido
// SOZINHO no box: média das leituras com o carro parado (km/h do aparelho < 0,5), no mínimo
// 1 s seguido (25 leituras a 25 Hz), janela móvel de até ~5 s, refeito a cada parada.
// Sem zero ainda → G orientado mas não descontado, marcado ZeroOk=false (a tela não deve
// tratar como medida fina). Chão inclinado no box entra no zero — limitação conhecida.

namespace P1Fast.Cockpit.Domain;

/// <summary>G do carro já orientado e descontado do zero. Long: + acelera, − freia. Lat: lado.</summary>
public readonly record struct GCarro(double Long, double Lat, bool ZeroOk);

/// <summary>Zero no box automático + mapeamento dos eixos do RaceBox (uma instância por sessão).</summary>
public sealed class AceleracaoCarro
{
    /// <summary>Abaixo disto (km/h do aparelho) o carro conta como parado.</summary>
    public const double KmhParado = 0.5;
    /// <summary>Leituras paradas seguidas para o zero valer (1 s a 25 Hz).</summary>
    public const int LeiturasMinZero = 25;
    /// <summary>Janela móvel do zero (~5 s a 25 Hz): o zero é a média das últimas N paradas.</summary>
    public const int JanelaMaxZero = 125;

    private readonly double _sinalLong;
    private readonly double _sinalLat;
    private readonly Queue<(double X, double Y)> _parado = new();
    private double _somaX, _somaY;

    /// <summary>Zero vigente (g, referencial do aparelho). 0 enquanto <see cref="ZeroOk"/> = false.</summary>
    public double ZeroX { get; private set; }
    public double ZeroY { get; private set; }
    /// <summary>true depois da 1ª parada de >= 1 s; continua true (último zero) com o carro andando.</summary>
    public bool ZeroOk { get; private set; }

    /// <summary>Sinais configuráveis; o padrão (+gx, −gy) é o provado em 27/10.</summary>
    public AceleracaoCarro(double sinalLong = +1, double sinalLat = -1)
    {
        _sinalLong = sinalLong;
        _sinalLat = sinalLat;
    }

    /// <summary>Recebe CADA leitura (inclusive parado — é parado que o zero aprende) e devolve o G
    /// do carro. null quando a fonte não traz aceleração (replay antigo, iPhone).
    /// kmhAparelho null = não dá para saber se está parado → não aprende zero.</summary>
    public GCarro? Ler(double? kmhAparelho, double? gx, double? gy)
    {
        if (gx is not { } x || gy is not { } y || !double.IsFinite(x) || !double.IsFinite(y)) return null;

        if (kmhAparelho is { } k && double.IsFinite(k) && k < KmhParado)
        {
            _parado.Enqueue((x, y));
            _somaX += x; _somaY += y;
            if (_parado.Count > JanelaMaxZero)
            {
                var (ox, oy) = _parado.Dequeue();
                _somaX -= ox; _somaY -= oy;
            }
            if (_parado.Count >= LeiturasMinZero)
            {
                ZeroX = _somaX / _parado.Count;
                ZeroY = _somaY / _parado.Count;
                ZeroOk = true;
            }
        }
        else
        {
            // Andou (ou velocidade desconhecida): a parada acabou. A próxima parada recomeça a
            // contagem do zero; o zero que já vale continua valendo.
            _parado.Clear();
            _somaX = _somaY = 0;
        }

        return Orientar(x, y);
    }

    /// <summary>Item 5 (27/10): G do carro com o zero VIGENTE, SEM aprender — é o que o notebook publica
    /// no canal (gLong/gLat/zeroOk) para a TV do box. Mesma conta do <see cref="Ler"/> (uma conta, um
    /// lugar), mas não alimenta o zero: quem aprende é só o fluxo do filtro. null sem aceleração.</summary>
    public GCarro? Converter(double? gx, double? gy)
        => gx is { } x && gy is { } y && double.IsFinite(x) && double.IsFinite(y) ? Orientar(x, y) : null;

    private GCarro Orientar(double x, double y)
        => new(_sinalLong * (x - ZeroX), _sinalLat * (y - ZeroY), ZeroOk);
}
