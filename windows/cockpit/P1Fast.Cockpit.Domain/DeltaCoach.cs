// DeltaCoach — a diferença de tempo por sub-trecho (ghost) + a frase do coach.
//
// Port fiel de:
//   web/cockpit/delta-calculator.js     (calcularDelta: perda de tempo por sub-trecho)
//   web/cockpit/mensagens-pedagogicas.js (decidirMensagemPedagogica)
//
// Compara a passagem ATUAL do trecho com a passagem de REFERÊNCIA (a melhor
// histórica daquele carro+pneu) ponto a ponto, acumula a perda/ganho em cada
// sub-trecho (entrada/freio/apice/pace/saida), e traduz o pior sub-trecho numa
// frase aprovada ("FREOU CEDO", "ACELERE MAIS"...). Spec v2 (Flávio 04/07): 8 frases;
// o ápice NÃO gera mais frase de volante — o piloto corrige pela BOLINHA (visual, gap 5).

namespace P1Fast.Cockpit.Domain;

/// <summary>Ponto da passagem já com fração (0..1 no trecho) e sub-trecho.</summary>
public sealed record PontoPassagem(double Lat, double Lng, double Kmh, double T, double Fracao, string Sub);

/// <summary>Uma passagem por um trecho (atual ou referência).</summary>
public sealed record Passagem(string SegmentId, IReadOnlyList<PontoPassagem> Pontos);

/// <summary>Perda/ganho acumulado de um sub-trecho.</summary>
public sealed record SubDelta(double DeltaS, double DistM, int Amostras);

/// <summary>Resultado do delta: total + por sub-trecho + o pior (que recebe a frase).</summary>
public sealed record DeltaResultado(
    string SegmentId,
    double DeltaTotalS,
    IReadOnlyDictionary<string, SubDelta> PorSubTrecho,
    string PiorSubTrecho,
    double PiorDeltaS,
    double? TempoAtualS = null);

/// <summary>Bolinha do ápice pro coach (direção + distância).</summary>
public sealed record ContextoApice(double? AngleDeg, double? DistM);

/// <summary>Uma das frases pedagógicas aprovadas.</summary>
public sealed record MensagemPedagogica(string Codigo, string Texto, string Controle, MsgTipo Tipo);

public static class DeltaCalculator
{
    public static readonly IReadOnlyList<string> SubTrechos = new[] { "entrada", "freio", "apice", "pace", "saida" };

    private static (PontoPassagem Ponto, int Idx) PontoRefNaFracao(IReadOnlyList<PontoPassagem> refPts, double fracaoAlvo, int idxStart)
    {
        var melhor = refPts[idxStart];
        var melhorIdx = idxStart;
        var melhorDiff = Math.Abs(melhor.Fracao - fracaoAlvo);
        for (var i = idxStart; i < refPts.Count; i++)
        {
            var p = refPts[i];
            var diff = Math.Abs(p.Fracao - fracaoAlvo);
            if (diff < melhorDiff) { melhor = p; melhorIdx = i; melhorDiff = diff; }
            if (p.Fracao > fracaoAlvo + 0.02) break; // fração é monotônica crescente
        }
        return (melhor, melhorIdx);
    }

    /// <summary>Calcula o delta de tempo da passagem atual vs a referência.</summary>
    public static DeltaResultado Calcular(Passagem atual, Passagem referencia)
    {
        if (atual is null || referencia is null || atual.Pontos is null || referencia.Pontos is null)
            throw new ArgumentException("calcularDelta: atual e referencia precisam ter pontos");
        if (atual.Pontos.Count < 2 || referencia.Pontos.Count < 2)
            throw new ArgumentException("calcularDelta: passagem com menos de 2 pontos");

        var porSub = SubTrechos.ToDictionary(k => k, _ => (deltaS: 0.0, distM: 0.0, amostras: 0));
        var refIdx = 0;

        for (var i = 1; i < atual.Pontos.Count; i++)
        {
            var a0 = atual.Pontos[i - 1];
            var a1 = atual.Pontos[i];

            var ds = Ghost.DistMeters(new PontoGps(a0.Lat, a0.Lng), new PontoGps(a1.Lat, a1.Lng));
            if (ds < 0.05) continue;

            var vAtual = ((a0.Kmh + a1.Kmh) / 2) / 3.6; // m/s
            if (double.IsNaN(vAtual) || double.IsInfinity(vAtual) || vAtual < 0.5) continue;
            var dtAtual = ds / vAtual;

            var (pRef, idxRef) = PontoRefNaFracao(referencia.Pontos, a1.Fracao, refIdx);
            refIdx = idxRef;
            var vRef = pRef.Kmh / 3.6;
            if (double.IsNaN(vRef) || double.IsInfinity(vRef) || vRef < 0.5) continue;
            var dtRef = ds / vRef;

            var dt = dtAtual - dtRef; // >0 = perdeu tempo

            var sub = a1.Sub;
            if (sub is not null && porSub.ContainsKey(sub))
            {
                var cur = porSub[sub];
                porSub[sub] = (cur.deltaS + dt, cur.distM + ds, cur.amostras + 1);
            }
        }

        var total = SubTrechos.Sum(k => porSub[k].deltaS);
        var pior = "entrada";
        var piorVal = double.NegativeInfinity;
        foreach (var sub in SubTrechos)
            if (porSub[sub].deltaS > piorVal) { piorVal = porSub[sub].deltaS; pior = sub; }

        var resultado = SubTrechos.ToDictionary(
            k => k,
            k => new SubDelta(porSub[k].deltaS, porSub[k].distM, porSub[k].amostras));

        return new DeltaResultado(atual.SegmentId, total, resultado, pior, piorVal);
    }
}

public static class MensagensPedagogicas
{
    // Spec v2 (Flávio 04/07): saíram BUSCAR LIMITE (12) e as 4 VIROU (03/04/06/07). O ápice
    // deixou de ter frase de volante — o piloto corrige seguindo a BOLINHA do ápice (visual,
    // gap 5, que FICA). Códigos 03/04/06/07/12 ficam vagos de propósito (são identificadores).
    public static readonly MensagemPedagogica FreouCedo     = new("01", "FREOU CEDO",     "Freio",      MsgTipo.Comunicacao);
    public static readonly MensagemPedagogica FreouTarde    = new("02", "FREOU TARDE",    "Freio",      MsgTipo.Comunicacao);
    public static readonly MensagemPedagogica AcelerouTarde = new("05", "ACELEROU TARDE", "Acelerador", MsgTipo.Comunicacao);
    public static readonly MensagemPedagogica PisouPouco    = new("08", "Acelere Mais",   "Acelerador", MsgTipo.Comunicacao);
    public static readonly MensagemPedagogica Recorde       = new("09", "RECORDE",        "Resultado",  MsgTipo.Comunicacao);
    public static readonly MensagemPedagogica ManteveLinha  = new("10", "MANTEVE LINHA",  "Resultado",  MsgTipo.Comunicacao);
    public static readonly MensagemPedagogica MelhorStint   = new("11", "MELHOR STINT",   "Resultado",  MsgTipo.Comunicacao);
    public static readonly MensagemPedagogica Registrando   = new("13", "Coletando Dados", "Sistema",   MsgTipo.Comunicacao);

    private const double DeltaZeroS            = 0.05;
    private const double SubTrechoMinS         = 0.05;
    private const double ManteveLinhaGanhoMaxS = 0.15;
    private const double RecordeGanhoMinS      = 0.10;

    /// <summary>Decide a frase pedagógica (port fiel de decidirMensagemPedagogica).</summary>
    public static MensagemPedagogica? Decidir(
        DeltaResultado? resultadoDelta = null,
        ContextoApice? contextoApice = null,
        bool primeiraPassagem = false,
        double? recordeAbsolutoS = null,
        bool bateuMelhorStint = false)
    {
        // Caso 1 — sem referência ainda
        if (primeiraPassagem || resultadoDelta is null) return Registrando;

        var pior = resultadoDelta.PiorSubTrecho;
        var piorDeltaS = resultadoDelta.PiorDeltaS;
        var deltaTotalS = resultadoDelta.DeltaTotalS;

        // Caso 2 — ganhou tempo (delta negativo)
        if (!double.IsNaN(deltaTotalS) && deltaTotalS <= -DeltaZeroS)
        {
            var ganho = -deltaTotalS;
            if (ganho >= RecordeGanhoMinS)
            {
                if (recordeAbsolutoS is null) return Recorde;
                if (resultadoDelta.TempoAtualS is { } t && t < recordeAbsolutoS) return Recorde;
                if (bateuMelhorStint) return MelhorStint;
                return Recorde;
            }
            if (ganho <= ManteveLinhaGanhoMaxS) return ManteveLinha;
            return MelhorStint;
        }

        // Caso 3 — delta ~zero: sem frase (BUSCAR LIMITE saiu na spec v2, Flávio 04/07)
        if (!double.IsNaN(deltaTotalS) && Math.Abs(deltaTotalS) < DeltaZeroS) return null;

        // Caso 4 — perdeu tempo: foco no pior sub-trecho
        if (string.IsNullOrEmpty(pior) || double.IsNaN(piorDeltaS) || piorDeltaS < SubTrechoMinS)
            return null; // perda imensurável

        return pior switch
        {
            "entrada" => PisouPouco,
            "freio"   => ClassificarFreio(resultadoDelta),
            "apice"   => null,   // spec v2: sem frase de volante — a BOLINHA do ápice (visual) cobre
            "saida"   => AcelerouTarde,
            _         => null,
        };
    }

    private static MensagemPedagogica ClassificarFreio(DeltaResultado r)
    {
        var entradaDelta = r.PorSubTrecho.TryGetValue("entrada", out var e) ? e.DeltaS : 0;
        // chegou mais rápido na entrada + perdeu no freio = freou TARDE (atropelou)
        return entradaDelta < -0.02 ? FreouTarde : FreouCedo;
    }

}
