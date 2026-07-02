// GpsFiltroAoVivo — a MESMA porta de entrada de GPS pro cérebro, no replay E ao vivo.
//
// H3 / risco-meta da auditoria 2026-07-02: o replay (a régua com que a gente prova o
// cockpit) sempre filtrou o GPS antes de alimentar o maestro — fix>=3, hacc<50 m, caixa
// de Brasília, e decimação por movimento (>=3 m, senão o jitter do carro PARADO vira curva
// falsa). O caminho AO VIVO (MainWindow.Live.OnLiveGps) filtrava só fix>=3 e entregava o
// resto CRU. Resultado: "verde no replay" NÃO garantia a tela real do piloto, porque as
// duas pontas rodavam pipelines diferentes.
//
// Este helper é a ÚNICA implementação desse filtro. O replay e o ao vivo passam por aqui,
// então provar no replay passa a valer pro piloto. A gravação em disco continua guardando
// TODOS os fixes (resolução cheia) — só o CÉREBRO recebe o fluxo filtrado.

namespace P1Fast.Cockpit.Domain;

/// <summary>
/// Filtro de GPS com estado (uma instância por sessão/volta). Recebe cada fix e devolve a
/// amostra pronta pro <see cref="CockpitOrchestrator"/> (com kmh do GPS por dist/dt sobre
/// pontos em movimento) ou <c>null</c> quando o fix é reprovado (qualidade) ou decimado
/// (parado/jitter). Port do filtro provado em <see cref="SessaoReplay"/>.
/// </summary>
public sealed class GpsFiltroAoVivo
{
    /// <summary>Precisão horizontal máxima aceita (m). Acima disto o fix não alimenta o cérebro.</summary>
    public const double HaccMaxM = 50;
    /// <summary>Espaçamento mínimo entre pontos (m): abaixo disto é jitter de carro parado, descartado.</summary>
    public const double MovimentoMinM = 3;

    // Caixa de Brasília (mesmos limites do detector de voltas em SessaoReplay).
    public const double LatMin = -16.1, LatMax = -15.4, LonMin = -48.3, LonMax = -47.6;

    private PontoGps? _prev;
    private double _prevT;

    /// <summary>Porta de QUALIDADE (sem estado): fix válido, precisão boa e dentro da pista.
    /// Um fix=3 mas hacc>=50 m (comum no início/sob obstrução) NÃO passa — senão gera curva
    /// falsa, bolinha deslocada e ponto de freada errado.</summary>
    public static bool QualidadeOk(double lat, double lon, double fix, double hacc)
        => fix >= 3 && hacc < HaccMaxM
        && lat >= LatMin && lat <= LatMax && lon >= LonMin && lon <= LonMax;

    /// <summary>Decimação por movimento (com estado), assumindo qualidade JÁ aprovada.
    /// Devolve a amostra (kmh = dist/dt do GPS) só quando o carro andou >= <see cref="MovimentoMinM"/>
    /// desde o último ponto aceito; senão <c>null</c> (parado/jitter). A 1ª amostra passa com kmh=0.</summary>
    public AmostraGps? AceitarValido(PontoGps p, double tWall)
    {
        if (_prev is { } prev && Ghost.DistMeters(prev, p) < MovimentoMinM) return null;

        double kmh = 0;
        if (_prev is { } prev2)
        {
            var dtS = Math.Max(0.001, (tWall - _prevT) / 1000.0);
            kmh = Ghost.DistMeters(prev2, p) / dtS * 3.6;
        }
        _prev = p;
        _prevT = tWall;
        return new AmostraGps(p.Lat, p.Lng, kmh, tWall);
    }

    /// <summary>Fluxo AO VIVO: qualidade + decimação num passo só. Devolve a amostra pro
    /// cérebro ou <c>null</c> (reprovado ou decimado). É o que o MainWindow.Live chama por fix.</summary>
    public AmostraGps? Aceitar(double lat, double lon, double fix, double hacc, double tWall)
        => QualidadeOk(lat, lon, fix, hacc) ? AceitarValido(new PontoGps(lat, lon), tWall) : null;
}
