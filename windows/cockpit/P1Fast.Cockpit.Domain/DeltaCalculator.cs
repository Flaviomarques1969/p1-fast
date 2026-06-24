// DeltaCalculator — porte fiel de web/cockpit/delta-calculator.js (próximo tijolo do
// MS-13.5). Compara a passagem ATUAL num trecho com a melhor passagem histórica
// daquele carro + autódromo + pneu, e calcula a perda de tempo (em segundos) por
// sub-trecho. É o "delta vivo vs melhor volta" — o número grande no centro do cockpit
// que hoje ainda vem da simulação.
//
// Algoritmo idêntico ao JS:
//   1. Para cada par de amostras GPS consecutivas da passagem atual, calcula
//      dtAtual = ds / v_atual.
//   2. Acha na referência o ponto com a MESMA fração de progresso no trecho e
//      calcula dtRef = ds / v_ref. dt = dtAtual - dtRef (positivo = perdeu tempo).
//   3. Acumula dt no sub-trecho da amostra (entrada/freio/apice/pace/saida).
//   4. Devolve a perda total + por sub-trecho + qual sub-trecho mais custou.
//
// PACE = zona de aceleração depois do Vmin (5º marco, decisão Flávio 13/06/2026).
// Entra na PARTIÇÃO de dados (entrada→freio→apice→pace→saida); NÃO é um 4º+1 widget
// (a tela mantém 4 widgets canônicos + Pace central — §9.1, mockup congelado).
//
// Puro e sem IO (igual ao resto do domínio): quem dá a referência (melhor histórica
// do banco) e quem monta os pontos canônicos é o chamador. O loader Supabase fica fora.

namespace P1Fast.Cockpit.Domain;

/// <summary>
/// Amostra canônica de uma passagem por um trecho. <c>Fracao</c> é o progresso 0..1
/// ao longo do segmento (entrada=0, saída=1); <c>Sub</c> ∈ entrada|freio|apice|pace|saida.
/// </summary>
public sealed record DeltaPonto(double Lat, double Lng, double Kmh, long T, double Fracao, string? Sub);

/// <summary>Passagem por um trecho: o id do segmento e a lista de pontos canônicos.</summary>
public sealed record PassagemTrecho(string SegmentId, IReadOnlyList<DeltaPonto> Pontos);

/// <summary>Perda acumulada de um sub-trecho.</summary>
public sealed record SubTrechoDelta(double DeltaS, double DistM, int Amostras);

/// <summary>Resultado do cálculo de delta de uma passagem por um trecho.</summary>
public sealed record DeltaResultado(
    string SegmentId,
    double DeltaTotalS,
    IReadOnlyDictionary<string, SubTrechoDelta> PorSubTrecho,
    string PiorSubTrecho,
    double PiorDeltaS);

public static class DeltaCalculator
{
    /// <summary>Sub-trechos na ordem canônica (entrada→freio→apice→pace→saida).</summary>
    public static readonly IReadOnlyList<string> SubTrechos =
        new[] { "entrada", "freio", "apice", "pace", "saida" };

    /// <summary>
    /// Calcula o delta de tempo de uma única passagem. Veja o contrato no topo do arquivo.
    /// </summary>
    /// <exception cref="ArgumentException">
    /// Se atual/referência forem nulos, sem pontos, ou com menos de 2 pontos.
    /// </exception>
    public static DeltaResultado CalcularDelta(PassagemTrecho atual, PassagemTrecho referencia)
    {
        if (atual?.Pontos is null || referencia?.Pontos is null)
            throw new ArgumentException("CalcularDelta: atual e referencia precisam ter pontos[]");
        if (atual.Pontos.Count < 2 || referencia.Pontos.Count < 2)
            throw new ArgumentException("CalcularDelta: passagem com menos de 2 pontos — descartada");

        var porSub = new Dictionary<string, Acc>(SubTrechos.Count);
        foreach (var k in SubTrechos)
            porSub[k] = new Acc();

        int refIdx = 0;

        // percorre cada par de amostras consecutivas da passagem atual
        for (int i = 1; i < atual.Pontos.Count; i++)
        {
            var a0 = atual.Pontos[i - 1];
            var a1 = atual.Pontos[i];

            // distância percorrida e velocidade média no par
            double ds = DistMeters(a0, a1);
            if (ds < 0.05) continue; // amostras quase coincidentes — descarta
            double vAtual = ((a0.Kmh + a1.Kmh) / 2) / 3.6; // m/s
            // kmh ausente vira NaN; sem a guarda UM ponto sem velocidade envenenava o
            // delta do trecho inteiro (risco (e) da auditoria 10/06).
            if (!double.IsFinite(vAtual) || vAtual < 0.5) continue; // inválido/parado

            double dtAtual = ds / vAtual;

            // ponto de referência correspondente: mesma fração de progresso no trecho
            double fracao = a1.Fracao;
            var (pRef, idxRef) = PontoRefNaFracao(referencia.Pontos, fracao, refIdx);
            refIdx = idxRef;
            double vRef = pRef.Kmh / 3.6;
            if (!double.IsFinite(vRef) || vRef < 0.5) continue;
            double dtRef = ds / vRef;

            // dt positivo = atual mais lento que ref (perdeu tempo); negativo = ganhou
            double dt = dtAtual - dtRef;

            // atribui ao sub-trecho da amostra atual
            string? sub = a1.Sub;
            if (sub is not null && porSub.TryGetValue(sub, out var acc))
            {
                acc.DeltaS += dt;
                acc.DistM += ds;
                acc.Amostras++;
            }
        }

        // total e pior sub-trecho
        double deltaTotalS = 0;
        foreach (var k in SubTrechos) deltaTotalS += porSub[k].DeltaS;

        string pior = "entrada";
        double piorVal = double.NegativeInfinity;
        foreach (var sub in SubTrechos)
        {
            // pior = mais positivo (mais perdeu)
            if (porSub[sub].DeltaS > piorVal)
            {
                piorVal = porSub[sub].DeltaS;
                pior = sub;
            }
        }

        var resultado = new Dictionary<string, SubTrechoDelta>(SubTrechos.Count);
        foreach (var k in SubTrechos)
            resultado[k] = new SubTrechoDelta(porSub[k].DeltaS, porSub[k].DistM, porSub[k].Amostras);

        return new DeltaResultado(atual.SegmentId, deltaTotalS, resultado, pior, piorVal);
    }

    /// <summary>
    /// Monta o ponto canônico de uma amostra durante a passagem, já com fração e
    /// sub-trecho. Porte de <c>pontoCanonico</c>. <c>Fracao</c> sai sempre em [0,1].
    /// </summary>
    public static DeltaPonto PontoCanonico(
        double lat, double lng, double kmh, long t, string? sub,
        double dsAcumuladoM, double dsTotalEstimadoM)
    {
        double fracao = Math.Min(1, Math.Max(0, dsAcumuladoM / Math.Max(1, dsTotalEstimadoM)));
        return new DeltaPonto(lat, lng, kmh, t, fracao, sub);
    }

    // Distância em metros entre dois pontos GPS (equirectangular, mesma aproximação
    // do trecho-detector / do JS).
    private static double DistMeters(DeltaPonto a, DeltaPonto b)
    {
        const double Deg2Rad = Math.PI / 180;
        const double EarthRM = 6_378_137;
        double lat1 = a.Lat * Deg2Rad;
        double lat2 = b.Lat * Deg2Rad;
        double dLat = lat2 - lat1;
        double dLng = (b.Lng - a.Lng) * Deg2Rad;
        double x = dLng * Math.Cos((lat1 + lat2) / 2);
        double y = dLat;
        return Math.Sqrt(x * x + y * y) * EarthRM;
    }

    // Procura na referência o ponto com a fração mais próxima da fracaoAlvo. A fração
    // é monotônica crescente — para a busca quando já passou do alvo (otimização
    // sequencial). Porte fiel de pontoRefNaFracao.
    private static (DeltaPonto Ponto, int Idx) PontoRefNaFracao(
        IReadOnlyList<DeltaPonto> referenciaPontos, double fracaoAlvo, int idxStart)
    {
        var melhor = referenciaPontos[idxStart];
        int melhorIdx = idxStart;
        double melhorDiff = Math.Abs(melhor.Fracao - fracaoAlvo);
        for (int i = idxStart; i < referenciaPontos.Count; i++)
        {
            var p = referenciaPontos[i];
            double diff = Math.Abs(p.Fracao - fracaoAlvo);
            if (diff < melhorDiff)
            {
                melhor = p;
                melhorIdx = i;
                melhorDiff = diff;
            }
            // a fracao é monotônica crescente — para se já passou do alvo
            if (p.Fracao > fracaoAlvo + 0.02) break;
        }
        return (melhor, melhorIdx);
    }

    // Acumulador mutável interno (os records de saída são imutáveis).
    private sealed class Acc
    {
        public double DeltaS;
        public double DistM;
        public int Amostras;
    }
}
