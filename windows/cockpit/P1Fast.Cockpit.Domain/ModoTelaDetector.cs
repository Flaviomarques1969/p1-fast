// ModoTelaDetector — decide qual tela mostrar a partir da velocidade do carro:
// parado → painel de sensores + status; andando → cockpit do piloto.
//
// Histerese pra não "piscar" no limiar: entra em ANDANDO a uma velocidade maior
// do que a que faz voltar pra PARADO. Puro e determinístico (testável).
//
// Regra de negócio (Flávio 2026-06-24): "se o carro está parado, a tela é o
// painel dos sensores e o status; se o carro sai, entra a tela de cockpit."

namespace P1Fast.Cockpit.Domain;

public enum ModoTela
{
    Parado,   // carro parado → painel de sensores + status do sistema
    Andando,  // carro em movimento → cockpit do piloto
}

public sealed class ModoTelaDetector
{
    private readonly double _entraAndandoKmh;
    private readonly double _voltaParadoKmh;
    private ModoTela _modo = ModoTela.Parado;

    /// <param name="entraAndandoKmh">Velocidade pra sair de parado e virar cockpit.</param>
    /// <param name="voltaParadoKmh">Velocidade (menor) pra voltar ao painel de sensores.</param>
    public ModoTelaDetector(double entraAndandoKmh = 6.0, double voltaParadoKmh = 2.0)
    {
        if (voltaParadoKmh > entraAndandoKmh)
            (voltaParadoKmh, entraAndandoKmh) = (entraAndandoKmh, voltaParadoKmh);
        _entraAndandoKmh = entraAndandoKmh;
        _voltaParadoKmh = voltaParadoKmh;
    }

    public ModoTela Modo => _modo;

    /// <summary>Atualiza com a velocidade atual. Retorna true se o modo MUDOU.</summary>
    public bool Atualizar(double speedKmh)
    {
        if (double.IsNaN(speedKmh) || double.IsInfinity(speedKmh)) return false;

        if (_modo == ModoTela.Parado && speedKmh >= _entraAndandoKmh)
        {
            _modo = ModoTela.Andando;
            return true;
        }
        if (_modo == ModoTela.Andando && speedKmh <= _voltaParadoKmh)
        {
            _modo = ModoTela.Parado;
            return true;
        }
        return false;
    }
}
