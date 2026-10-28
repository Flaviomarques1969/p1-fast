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

/// <summary>Medidas de uma curva numa volta: onde começou a freada (m até o ápice) e a velocidade de saída.</summary>
public sealed record ReferenciaCurva(double? FreadaM, double? SaidaKmh);

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

    /// <summary>Carrega a referência gravada (UI, ao abrir a sessão). Substitui a atual inteira.</summary>
    public void Semear(double tempoMs, IReadOnlyDictionary<string, ReferenciaCurva> curvas)
    {
        if (!double.IsFinite(tempoMs) || tempoMs <= 0 || curvas is null || curvas.Count == 0) return;
        _referencia.Clear();
        foreach (var (seg, c) in curvas) _referencia[seg] = c;
        TempoMs = tempoMs;
    }

    /// <summary>Anota a passagem desta volta. Passar de novo pela mesma curva sobrescreve (fica a última).</summary>
    public void AnotarPassagem(string segId, double? freadaM, double? saidaKmh)
    {
        if (string.IsNullOrEmpty(segId)) return;
        var f = freadaM is { } fv && double.IsFinite(fv) && fv > 0 ? fv : (double?)null;
        var s = saidaKmh is { } sv && double.IsFinite(sv) && sv > 0 ? sv : (double?)null;
        if (f is null && s is null) return;
        _voltaCorrente[segId] = new ReferenciaCurva(f, s);
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
                _referencia[seg] = new ReferenciaCurva(c.FreadaM ?? antiga?.FreadaM, c.SaidaKmh ?? antiga?.SaidaKmh);
            }
            TempoMs = t;
            virou = true;
        }
        _voltaCorrente.Clear();
        return virou;
    }
}
