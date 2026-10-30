// MelhorVoltaReferencia — os 2 números grandes do painel do piloto comparam com a MESMA curva
// na MELHOR VOLTA de sempre do carro (Flávio 2026-10-28, decisão no chat):
//   esquerda = ponto de FREADA (m)   — amarelo = freou ANTES, verde = até 10% do ponto de
//                                       referência, vermelho = freou DEPOIS;
//   direita  = velocidade de SAÍDA (km/h) — verde = mais rápido (ou igual), vermelho = mais lento.
// Sem frase nenhuma debaixo dos números; sem referência daquela curva = número em branco.
//
// Por que um armazém próprio: a referência antiga era a passagem mais rápida de CADA curva na
// sessão (só em memória) — curvas de voltas diferentes. Aqui a referência é o conjunto de curvas
// de UMA volta: a mais rápida que já teve as curvas gravadas. Ao fechar uma volta mais rápida
// que essa, as curvas DAQUELA volta viram a nova referência (curva sem medida nela mantém a
// anterior — nunca apaga referência por buraco de GPS).
//
// Régua da freada = a mesma da LuzFreio: distância ao ápice no pico de velocidade da aproximação
// (maior = freou mais longe do ápice = ANTES). Assim o número e as luzes laterais miram o MESMO ponto.
//
// Puro: zero UI, zero I/O. Quem persiste é a UI (ArmazemRecordes, chaves "melhorvolta.*").

namespace P1Fast.Cockpit.Domain;

/// <summary>Medidas de uma curva numa volta: onde começou a freada (m até o ápice), a velocidade de saída
/// e quanto tempo de volta já tinha passado no fim da curva (ms desde a linha; null = volta sem início
/// conhecido ou referência gravada antes do cartão do delta).</summary>
public sealed record ReferenciaCurva(double? FreadaM, double? SaidaKmh, double? TempoNaVoltaMs = null);

/// <summary>
/// Cartão do centro (Flávio 2026-10-30): delta da volta em que o piloto está × a melhor volta daquele
/// carro naquela pista, em centésimos, SEM sinal — a cor diz o lado: verde = igual ou mais rápido,
/// vermelho = mais lento. Momento a momento pelo traço da melhor volta (DeltaAoVivo); sem traço, no fim de
/// cada curva (tempo de volta até ali × o da melhor volta no mesmo ponto); na linha, o tempo da volta
/// fechada × o da melhor. null = cartão em branco.
/// </summary>
public sealed record DeltaVoltaInfo(int? Centesimos, Tone Tom)
{
    public static DeltaVoltaInfo Vazio() => new(null, Tone.Neutro);

    /// <summary>Compara o tempo de volta até um ponto com o da melhor volta no mesmo ponto (ms).</summary>
    public static DeltaVoltaInfo Comparar(double? atualMs, double? melhorMs)
    {
        if (atualMs is not { } a || melhorMs is not { } m || !double.IsFinite(a) || !double.IsFinite(m) || a <= 0 || m <= 0)
            return Vazio();
        return DaDiferenca(a - m);
    }

    /// <summary>A diferença já calculada (ms; + = mais lento) — o delta ao vivo, que no começo da volta
    /// compara com o ponto 0 da melhor volta.</summary>
    public static DeltaVoltaInfo DaDiferenca(double diferencaMs)
    {
        if (!double.IsFinite(diferencaMs)) return Vazio();
        // O tom sai do número ARREDONDADO que a tela mostra: "00" é igual = verde, nunca vermelho.
        var cs = (int)Math.Round(diferencaMs / 10.0, MidpointRounding.AwayFromZero);
        return new DeltaVoltaInfo(Math.Abs(cs), cs <= 0 ? Tone.Bom : Tone.Erro);
    }

    /// <summary>O número do cartão. Abaixo de 1 s só os centésimos, sem o "0," (Flávio 2026-10-30: 0,42 → "42",
    /// 0,05 → "05", igual → "00"); de 1 s para cima com vírgula ("1,07"); de 10 s para cima uma casa só ("12,3");
    /// 100 s ou mais = "99,9".</summary>
    public string Texto()
    {
        if (Centesimos is not { } c) return "";
        if (c >= 10000) return "99,9";
        if (c < 100) return c.ToString("00", System.Globalization.CultureInfo.InvariantCulture);
        var s = c / 100.0;
        return (c >= 1000 ? s.ToString("0.0", System.Globalization.CultureInfo.InvariantCulture)
                          : s.ToString("0.00", System.Globalization.CultureInfo.InvariantCulture)).Replace('.', ',');
    }

    /// <summary>Tempo de volta da linha de baixo do cartão (melhor e última): "1:12,34". A conta é a mesma do
    /// FormatarTempo da tela térmica (centésimos cortados, não arredondados), para a mesma volta aparecer igual
    /// nas duas telas. Sem tempo (null, zero, negativo ou inválido) = "" (em branco, nunca "—").</summary>
    public static string TempoDeVolta(double? ms)
    {
        if (ms is not { } v || !double.IsFinite(v) || v <= 0) return "";
        var total = (long)Math.Round(v);
        var min = total / 60000; var rem = total % 60000;
        return $"{min}:{rem / 1000:00},{rem % 1000 / 10:00}";
    }
}

/// <summary>Os 2 números grandes do painel: freada (m, sem sinal) à esquerda e saída (km/h, sem
/// sinal) à direita, cada um com a cor. null = sem referência daquela curva (número em branco).</summary>
public sealed record NumerosInfo(int? FreadaM, FreioTom FreadaTom, int? SaidaKmh, Tone SaidaTom)
{
    public static NumerosInfo Vazio() => new(null, FreioTom.Neutro, null, Tone.Neutro);

    /// <summary>Faixa verde da freada: até 10% do ponto de referência (decisão Flávio 2026-10-28).</summary>
    public const double FreadaFaixaVerde = 0.10;

    /// <summary>Compara a passagem com a referência da mesma curva na melhor volta.</summary>
    public static NumerosInfo Comparar(double? freadaM, double? saidaKmh, ReferenciaCurva? referencia)
    {
        int? freada = null; var freadaTom = FreioTom.Neutro;
        if (freadaM is { } f && double.IsFinite(f) && referencia?.FreadaM is { } rf && double.IsFinite(rf) && rf > 0)
        {
            var d = f - rf; // + freou ANTES (mais longe do ápice), − freou DEPOIS
            freada = (int)Math.Round(Math.Abs(d), MidpointRounding.AwayFromZero);
            freadaTom = Math.Abs(d) <= FreadaFaixaVerde * rf ? FreioTom.Bom
                      : d > 0 ? FreioTom.Foco
                      : FreioTom.Erro;
        }

        int? saida = null; var saidaTom = Tone.Neutro;
        if (saidaKmh is { } s && double.IsFinite(s) && s > 0 && referencia?.SaidaKmh is { } rs && double.IsFinite(rs) && rs > 0)
        {
            var d = s - rs;
            saida = (int)Math.Round(Math.Abs(d), MidpointRounding.AwayFromZero);
            saidaTom = d >= 0 ? Tone.Bom : Tone.Erro;
        }
        return new NumerosInfo(freada, freadaTom, saida, saidaTom);
    }
}

/// <summary>
/// Referência por curva da MELHOR VOLTA (a mais rápida com curvas gravadas). O maestro anota cada
/// passagem fechada; a UI fecha a volta no cruzamento da linha com o tempo dela. Uma instância por sessão.
/// </summary>
public sealed class ReferenciaMelhorVolta
{
    private readonly Dictionary<string, ReferenciaCurva> _referencia = new();
    private readonly Dictionary<string, ReferenciaCurva> _voltaCorrente = new();

    /// <summary>Tempo (ms) da volta que é a referência hoje; null = ainda não há.</summary>
    public double? TempoMs { get; private set; }

    public IReadOnlyDictionary<string, ReferenciaCurva> Curvas => _referencia;

    public ReferenciaCurva? Obter(string segId)
        => _referencia.TryGetValue(segId, out var r) ? r : null;

    /// <summary>Carrega a referência gravada (UI, ao abrir a sessão ou trocar de pista). Substitui a
    /// atual inteira; sem referência gravada (tempo inválido ou nenhuma curva) = fica sem referência.</summary>
    public void Semear(double? tempoMs, IReadOnlyDictionary<string, ReferenciaCurva>? curvas)
    {
        _referencia.Clear();
        TempoMs = null;
        if (tempoMs is not { } t || !double.IsFinite(t) || t <= 0 || curvas is null || curvas.Count == 0) return;
        foreach (var (seg, c) in curvas) _referencia[seg] = c;
        TempoMs = t;
    }

    /// <summary>Anota a passagem desta volta. Passar de novo pela mesma curva sobrescreve (fica a última).
    /// <paramref name="tempoNaVoltaMs"/> = tempo de volta no fim da curva (o cartão do delta).</summary>
    public void AnotarPassagem(string segId, double? freadaM, double? saidaKmh, double? tempoNaVoltaMs = null)
    {
        if (string.IsNullOrEmpty(segId)) return;
        var f = freadaM is { } fv && double.IsFinite(fv) && fv > 0 ? fv : (double?)null;
        var s = saidaKmh is { } sv && double.IsFinite(sv) && sv > 0 ? sv : (double?)null;
        var t = tempoNaVoltaMs is { } tv && double.IsFinite(tv) && tv > 0 ? tv : (double?)null;
        if (f is null && s is null && t is null) return;
        _voltaCorrente[segId] = new ReferenciaCurva(f, s, t);
    }

    /// <summary>
    /// Fecha a volta no cruzamento da linha. <paramref name="tempoMs"/> = tempo da volta, ou null
    /// quando o cruzamento não fecha volta válida (1º cruzamento, volta implausível). Se a volta é
    /// válida e mais rápida que a referência (ou não havia), as curvas dela viram a referência e
    /// devolve true (a UI então grava). As anotações sempre zeram para a volta seguinte.
    /// </summary>
    public bool FecharVolta(double? tempoMs, double pisoPlausivelMs = ArmazemRecordes.VoltaMinimaPlausivelMs)
    {
        var virou = false;
        if (tempoMs is { } t && double.IsFinite(t) && t >= pisoPlausivelMs && _voltaCorrente.Count > 0
            && (TempoMs is not { } atual || t < atual))
        {
            foreach (var (seg, c) in _voltaCorrente)
            {
                var antiga = Obter(seg);
                // Tempo de volta: SÓ desta volta — o de uma volta antiga não soma com o desta (outra base).
                _referencia[seg] = new ReferenciaCurva(c.FreadaM ?? antiga?.FreadaM, c.SaidaKmh ?? antiga?.SaidaKmh,
                                                       c.TempoNaVoltaMs);
            }
            foreach (var seg in _referencia.Keys.Where(k => !_voltaCorrente.ContainsKey(k)).ToList())
                _referencia[seg] = _referencia[seg] with { TempoNaVoltaMs = null };
            TempoMs = t;
            virou = true;
        }
        _voltaCorrente.Clear();
        return virou;
    }
}
