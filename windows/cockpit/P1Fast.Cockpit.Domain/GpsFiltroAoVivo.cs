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
    /// <summary>Abaixo disto (ms) o dt entre fixes é implausível pra um GPS de 25 Hz (rajada BLE
    /// carimbada junto): usa o dt NOMINAL em vez de dividir por ~0. Guarda de sanidade (5.3b).</summary>
    public const double DtImplausivelMs = 20;
    /// <summary>dt nominal de um GPS de 25 Hz (ms) — usado quando o dt real vem implausível.</summary>
    public const double DtNominalMs = 40;
    /// <summary>Teto de km/h plausível pro carro na pista. Um par de fixes que gere velocidade
    /// acima disto (glitch de posição/tempo) é DESCARTADO — não pode virar referência de curva.</summary>
    public const double KmhTetoPlausivel = 260;

    // Caixa de Brasília — fonte única em PistaBrasilia (faxina onda 2). Mantém a superfície
    // pública destes consts (QualidadeOk os usa), mas o valor vem de um lugar só.
    public const double LatMin = PistaBrasilia.LatMin, LatMax = PistaBrasilia.LatMax,
                        LonMin = PistaBrasilia.LonMin, LonMax = PistaBrasilia.LonMax;

    private PontoGps? _prev;
    private double _prevT;
    // Item 1 (27/10): zero no box + eixos do carro. Vive AQUI para o replay e o ao vivo passarem
    // pela MESMA peça (H3) e para aprender o zero com o carro PARADO (antes da decimação).
    private readonly AceleracaoCarro _acel = new();

    /// <summary>Zero no box/eixos desta sessão (leitura para diagnóstico e testes).</summary>
    public AceleracaoCarro Acel => _acel;

    /// <summary>Porta de QUALIDADE (sem estado): fix válido, precisão boa e dentro da pista.
    /// Um fix=3 mas hacc>=50 m (comum no início/sob obstrução) NÃO passa — senão gera curva
    /// falsa, bolinha deslocada e ponto de freada errado.</summary>
    public static bool QualidadeOk(double lat, double lon, double fix, double hacc)
        => fix >= 3 && hacc < HaccMaxM
        && lat >= LatMin && lat <= LatMax && lon >= LonMin && lon <= LonMax;

    /// <summary>Decimação por movimento (com estado), assumindo qualidade JÁ aprovada.
    /// Devolve a amostra só quando o carro andou >= <see cref="MovimentoMinM"/> desde o último ponto
    /// aceito; senão <c>null</c> (parado/jitter). kmh = do aparelho quando vem; senão dist/dt do GPS
    /// (a 1ª amostra sem velocidade do aparelho passa com kmh=0).
    /// headingDeg (L2): rumo do PACOTE quando o aparelho fornece (RaceBox headMot) — só
    /// atravessa, sem inventar; null = cérebro cai no rumo por 2 posições, como sempre.
    /// kmhAparelho (item 1, 27/10): velocidade do PRÓPRIO GPS (RaceBox; provada contra a posição:
    /// média −0,12 km/h, desvio 0,45). Quando vem, É a velocidade da amostra; dist/dt fica só como
    /// guarda de salto de posição e como reserva de fonte sem velocidade (replay antigo, iPhone).</summary>
    public AmostraGps? AceitarValido(PontoGps p, double tWall, double? headingDeg = null,
        double? ax = null, double? ay = null, double? az = null, double? kmhAparelho = null)
    {
        double? kmhAp = kmhAparelho is { } ka && double.IsFinite(ka) && ka >= 0 && ka <= KmhTetoPlausivel
            ? ka : null;
        // G do carro ANTES da decimação: é com o carro parado (decimado) que o zero aprende.
        var g = _acel.Ler(kmhAp, ax, ay);

        if (_prev is { } prev && Ghost.DistMeters(prev, p) < MovimentoMinM) return null;

        double kmh = kmhAp ?? 0;
        if (_prev is { } prev2)
        {
            // 5.3b: dt implausível (rajada BLE colada no mesmo ms) → usa o nominal de 40 ms em
            // vez de dividir por ~0 (que dispara km/h absurdo no cérebro: falso freada/ápice).
            double dtMs = tWall - _prevT;
            double dtS = (dtMs < DtImplausivelMs ? DtNominalMs : dtMs) / 1000.0;
            dtS = Math.Max(0.001, dtS);
            double kmhPos = Ghost.DistMeters(prev2, p) / dtS * 3.6;
            // Mesmo com o dt corrigido, um salto de posição impossível não pode virar referência
            // de curva: acima do teto, DESCARTA o par (não avança _prev — compara com o último bom).
            if (kmhPos > KmhTetoPlausivel) return null;
            kmh = kmhAp ?? kmhPos;
        }
        _prev = p;
        _prevT = tWall;
        return new AmostraGps(p.Lat, p.Lng, kmh, tWall, headingDeg, ax, ay, az,
            g?.Long, g?.Lat, g?.ZeroOk ?? false);
    }

    /// <summary>Fluxo AO VIVO: qualidade + decimação num passo só. Devolve a amostra pro
    /// cérebro ou <c>null</c> (reprovado ou decimado). É o que o MainWindow.Live chama por fix.
    /// ax/ay/az: aceleração crua do RaceBox (g) — atravessa crua e vira G do carro (AccelLongG/LatG).</summary>
    public AmostraGps? Aceitar(double lat, double lon, double fix, double hacc, double tWall, double? headingDeg = null,
        double? ax = null, double? ay = null, double? az = null, double? kmhAparelho = null)
        => QualidadeOk(lat, lon, fix, hacc)
            ? AceitarValido(new PontoGps(lat, lon), tWall, headingDeg, ax, ay, az, kmhAparelho) : null;
}
