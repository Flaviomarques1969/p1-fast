// Recordes — o ARMAZÉM de recordes do cockpit, PERSISTIDO no notebook (Flávio 2026-07-06).
//
// Tudo que é do notebook é calculado e guardado AQUI, sem nuvem — é SEPARADO da função de
// publicar os dados pro app (cockpit-bubi-live). O cockpit é autossuficiente (cálculo mora no
// notebook, §5; SQLite/arquivo local é a verdade da sessão, ADR-003).
//
// Guarda um recorde POR DADO (melhor volta; e por trecho: melhor tempo, melhor Vmin, melhor
// entrada/ápice/saída), CADA UM com seus metadados (quando/sessão/pista/carro/pneus) — porque
// o melhor de cada dado pode vir de voltas diferentes. Quando um dado é superado, substitui e
// guarda os metadados do novo recorde.
//
// Puro: zero UI, zero I/O, zero relógio (o instante vem de fora — o Domain não lê Now).
// A persistência à prova de queda fica no IRecordesStore (RecordesStore.cs).

namespace P1Fast.Cockpit.Domain;

/// <summary>De onde veio um recorde. Config de pneus é METADADO (rótulo), não chave (Flávio 2026-07-06).</summary>
public sealed record MetadadosRecorde(
    double QuandoWallMs,   // instante da captura (ms desde epoch) — vem de fora
    string SessaoId,
    string Pista,
    string CarroId,
    string ConfigPneus);   // "" se desconhecido

/// <summary>Um recorde: o valor + de onde veio.</summary>
public sealed record ValorRecorde(double Valor, MetadadosRecorde Meta);

/// <summary>Em que direção um dado é "melhor": menor (tempo) ou maior (velocidade).</summary>
public enum SentidoRecorde { Menor, Maior }

/// <summary>Dados de UMA passagem por um trecho (emitidos pelo cérebro ao fechar a curva);
/// a UI monta os metadados e tenta bater cada recorde independente.</summary>
public sealed record DadosPassagem(
    string SegId,
    double TempoS,
    double? EntradaKmh,
    double? FrenagemM,
    double? ApiceKmh,
    double? SaidaKmh,
    double? VminKmh);

/// <summary>
/// Armazém de recordes de um carro. Coleção de itens chaveados (ver <see cref="ChaveVolta"/> /
/// <see cref="ChaveTrecho"/>), cada um com valor + metadados. Mutável em memória; persistido
/// inteiro (atômico) a cada superação pelo IRecordesStore.
/// </summary>
public sealed class ArmazemRecordes
{
    public string CarroId { get; set; } = "";
    public Dictionary<string, ValorRecorde> Itens { get; set; } = new();

    public const string ChaveVolta = "volta";
    public static string ChaveTrecho(string segId, string metrica) => $"{segId}.{metrica}";

    // Métricas de trecho e o sentido de cada uma (menor tempo / maior velocidade).
    public const string MetTempo    = "tempo";    // Menor
    public const string MetVmin     = "vmin";     // Maior
    public const string MetEntrada  = "entrada";  // Maior
    public const string MetApice    = "apice";    // Maior
    public const string MetSaida    = "saida";    // Maior
    public const string MetFrenagem = "frenagem"; // Maior (freou MAIS TARDE = mais metros da linha de
    //   entrada até o ponto de freada = carregou velocidade mais tempo). Fica na mesma família das
    //   velocidades (Maior = melhor). É um "melhor pessoal" do ponto de freada — separado do ponto de
    //   freada de referência da MELHOR passagem que a LuzFreio mantém. (Flávio 2026-07-09, item 3.6.)

    /// <summary>Piso de plausibilidade da VOLTA (ms): abaixo disto NÃO é uma volta real — é o trecho
    /// box→linha ou ruído do 1º cruzamento. Brasília (~1,6 km) não roda volta abaixo de 40 s; uma
    /// "volta" mais curta que isso NÃO pode virar recorde (contaminaria o alvo da térmica pra sempre).
    /// Configurável pelo parâmetro de <see cref="AplicarVolta"/>. (Flávio 2026-07-09, item 3.2.)</summary>
    public const double VoltaMinimaPlausivelMs = 40_000;

    /// <summary>Tenta bater o recorde da chave. Se o valor supera o atual (ou não havia), grava e
    /// devolve true; senão não muda nada e devolve false. NaN/Infinito nunca vira recorde.</summary>
    public bool Tentar(string chave, double valor, SentidoRecorde sentido, MetadadosRecorde meta)
    {
        if (double.IsNaN(valor) || double.IsInfinity(valor)) return false;
        if (Itens.TryGetValue(chave, out var atual))
        {
            var melhor = sentido == SentidoRecorde.Menor ? valor < atual.Valor : valor > atual.Valor;
            if (!melhor) return false;
        }
        Itens[chave] = new ValorRecorde(valor, meta);
        return true;
    }

    public ValorRecorde? Obter(string chave) => Itens.TryGetValue(chave, out var v) ? v : null;

    /// <summary>Aplica TODOS os dados de uma passagem — um dado cada, independentes. Devolve true
    /// se QUALQUER recorde do trecho foi batido (a UI então persiste).</summary>
    public bool AplicarPassagem(DadosPassagem d, MetadadosRecorde meta)
    {
        var mudou = false;
        mudou |= Tentar(ChaveTrecho(d.SegId, MetTempo), d.TempoS, SentidoRecorde.Menor, meta);
        if (d.VminKmh    is { } vmin) mudou |= Tentar(ChaveTrecho(d.SegId, MetVmin),     vmin, SentidoRecorde.Maior, meta);
        if (d.EntradaKmh is { } ent)  mudou |= Tentar(ChaveTrecho(d.SegId, MetEntrada),  ent,  SentidoRecorde.Maior, meta);
        if (d.FrenagemM  is { } fre)  mudou |= Tentar(ChaveTrecho(d.SegId, MetFrenagem), fre,  SentidoRecorde.Maior, meta);
        if (d.ApiceKmh   is { } api)  mudou |= Tentar(ChaveTrecho(d.SegId, MetApice),    api,  SentidoRecorde.Maior, meta);
        if (d.SaidaKmh   is { } sai)  mudou |= Tentar(ChaveTrecho(d.SegId, MetSaida),    sai,  SentidoRecorde.Maior, meta);
        return mudou;
    }

    /// <summary>Tenta bater a melhor volta (lap time, ms). Menor é melhor. Voltas abaixo do piso de
    /// plausibilidade (<paramref name="pisoPlausivelMs"/>) NÃO viram recorde — não é volta real.</summary>
    public bool AplicarVolta(double tempoMs, MetadadosRecorde meta, double pisoPlausivelMs = VoltaMinimaPlausivelMs)
    {
        if (tempoMs < pisoPlausivelMs) return false;   // implausível (box→linha / ruído): não é volta
        return Tentar(ChaveVolta, tempoMs, SentidoRecorde.Menor, meta);
    }
}
