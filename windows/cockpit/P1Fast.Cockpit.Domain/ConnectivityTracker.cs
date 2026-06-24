// ConnectivityTracker — detecta queda e volta de um canal (ex.: wifi do celular
// → nuvem) a partir de uma sequência de resultados ok/falha, com histerese pra
// não "piscar" a cada falha isolada. Puro e determinístico (testável).
//
// Uso no .exe: cada envio pra nuvem reporta ok/falha; o tracker decide quando
// avisar "nuvem caiu" / "nuvem voltou" no módulo de saúde.

namespace P1Fast.Cockpit.Domain;

/// <summary>Transição de conectividade detectada num Registrar().</summary>
public enum ConnTransicao
{
    Nenhuma,
    Caiu,
    Voltou,
}

public sealed class ConnectivityTracker
{
    private readonly int _limiteFalhas;
    private int _falhasSeguidas;
    private bool _online = true;   // começa otimista: assume ligado até provar o contrário

    /// <param name="limiteFalhas">Falhas seguidas pra declarar "caiu" (histerese). Mín. 1.</param>
    public ConnectivityTracker(int limiteFalhas = 3)
    {
        _limiteFalhas = Math.Max(1, limiteFalhas);
    }

    public bool Online => _online;

    /// <summary>Registra um resultado e devolve a transição, se houver.</summary>
    public ConnTransicao Registrar(bool ok)
    {
        if (ok)
        {
            _falhasSeguidas = 0;
            if (!_online)
            {
                _online = true;
                return ConnTransicao.Voltou;   // 1 sucesso já religa
            }
            return ConnTransicao.Nenhuma;
        }

        _falhasSeguidas++;
        if (_online && _falhasSeguidas >= _limiteFalhas)
        {
            _online = false;
            return ConnTransicao.Caiu;
        }
        return ConnTransicao.Nenhuma;
    }
}
