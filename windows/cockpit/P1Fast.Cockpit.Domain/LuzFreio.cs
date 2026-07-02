// LuzFreio — luz de freio lateral do cockpit do piloto.
//
// Port fiel de atualizarFreio + o resultado da frenagem de
// web/cockpit/cockpit-volta-real.html (aprovado Flávio 22/06).
//
// Conceito aprovado: as luzes laterais ENCHEM de cima pra baixo por TEMPO —
// começam 4 s ANTES do ponto de freada e chegam a 100% no ponto, onde a tela
// PISCA. O ponto de freada é o da MELHOR passagem do piloto naquele trecho
// (menor tempo); sem sensor de freio, o início da freada vem da DESACELERAÇÃO
// do GPS (pico de velocidade na aproximação = onde a freada começou).
//
// Sem referência ainda (1ª passagem): usa um ponto de partida (50 m do ápice).
// O cálculo mora aqui (domínio), nunca duplicado na tela — COCKPIT_FONTE_DA_VERDADE §5.

namespace P1Fast.Cockpit.Domain;

/// <summary>Tom do resultado da frenagem (a tela colore o número). Inclui foco (âmbar), que o Tone geral não tem.</summary>
public enum FreioTom
{
    Neutro,
    Bom,
    Foco,
    Erro,
}

/// <summary>Preenchimento das luzes laterais (0..9) + se deve PISCAR a tela neste instante.</summary>
public sealed record FreioFill(int Lit, bool Flash);

/// <summary>Resultado da frenagem do trecho fechado: número (m) + palavra + tom. Número null = "—".</summary>
public sealed record FreioResultado(int? DiffM, string Palavra, FreioTom Tom);

/// <summary>
/// Calculadora com estado da luz de freio. Uma instância por sessão; o maestro a
/// alimenta com cada amostra de GPS (<see cref="Atualizar"/>) e fecha o trecho
/// (<see cref="FecharTrecho"/>) pra apurar o resultado e guardar a melhor referência.
/// </summary>
public sealed class LuzFreio
{
    public const double FreioLeadS    = 4.0;  // segundos: do 1º verde até o ponto de freada
    public const double FreioFallbackM = 50;  // ponto de freada de partida (antes de ter referência)
    public const int    FreioN        = 9;    // luzes por lado
    public const double FreioTolM     = 1;    // ±1 m ainda é "NO PONTO"

    // Reação do freio (gap 3, port de trail-cockpit-motor.js:380-396,666): o "zero" da luz é
    // ADIANTADO pelo tempo de reação aprendido do piloto — adiantoM = reacaoS * velMs — pra
    // ele, que reage com atraso, pisar no ponto certo. Aprende por EMA por trecho.
    public const double ReacaoDefaultS    = 0.25;
    public const double ReacaoMinS        = 0.10;
    public const double ReacaoMaxS        = 0.60;
    public const double ReacaoAlpha       = 0.25;
    public const double ReacaoAmostraMaxS = 1.2;  // amostra acima disto não foi reação — descarta

    private readonly IReadOnlyList<TrechoSegmento> _segs;
    private readonly Dictionary<string, double> _pontoFreadaRef = new(); // segId → ponto de freada da MELHOR passagem
    private readonly Dictionary<string, double> _melhorTempo    = new(); // segId → menor tempo do trecho (s)
    private readonly Dictionary<string, double> _onset          = new(); // segId → onde a freada começou NESTA aproximação
    private readonly Dictionary<string, (double ReacaoS, int N)> _reacao = new(); // segId → reação aprendida (EMA)

    private string? _approachId;
    private double _vMaxApp;
    private double _bdAtVmax  = double.PositiveInfinity;
    private double _prevDFreio = double.PositiveInfinity;
    private bool _armado = true;

    public LuzFreio(IReadOnlyList<TrechoSegmento> segs)
        => _segs = segs ?? throw new ArgumentNullException(nameof(segs));

    /// <summary>Ponto de freada de referência do trecho (distância ao ápice da melhor passagem), se houver.</summary>
    public double? PontoFreadaDe(string segId)
        => _pontoFreadaRef.TryGetValue(segId, out var p) ? p : null;

    /// <summary>Tempo de reação (s) do trecho pro zero adiantado; default enquanto não aprendeu.</summary>
    public double ReacaoS(string segId)
        => _reacao.TryGetValue(segId, out var r) ? r.ReacaoS : ReacaoDefaultS;

    /// <summary>Aprende o tempo de reação por EMA (zero→pé medido). Pisar ANTES do zero,
    /// amostra inválida ou grande demais (&gt; <see cref="ReacaoAmostraMaxS"/>) não vira amostra —
    /// devolve null e não muda nada. Port fiel de registrarAmostraReacao (trail-cockpit-motor.js).</summary>
    public (double ReacaoS, int N)? RegistrarAmostraReacao(string segId, double amostraS)
    {
        if (!double.IsFinite(amostraS) || amostraS <= 0 || amostraS > ReacaoAmostraMaxS) return null;
        var clamp = Math.Min(ReacaoMaxS, Math.Max(ReacaoMinS, amostraS));
        (double ReacaoS, int N) novo = _reacao.TryGetValue(segId, out var cur) && double.IsFinite(cur.ReacaoS)
            ? (cur.ReacaoS + ReacaoAlpha * (clamp - cur.ReacaoS), cur.N + 1)
            : (clamp, 1);
        _reacao[segId] = novo;
        return novo;
    }

    private (TrechoSegmento? Best, double Bd) MaisProxima(double lat, double lng)
    {
        TrechoSegmento? best = null;
        double bd = double.PositiveInfinity;
        var pos = new PontoGps(lat, lng);
        foreach (var c in _segs)
        {
            var d = Ghost.DistMeters(pos, c.ApicePoint);
            if (d < bd) { bd = d; best = c; }
        }
        return (best, bd);
    }

    /// <summary>
    /// Atualiza a luz na chegada do GPS. kmh = velocidade real (do GPS); modoCritico
    /// para a luz (a tela é tomada pelo alerta). Retorna o preenchimento + flash.
    /// </summary>
    public FreioFill Atualizar(double lat, double lng, double kmh, bool modoCritico = false)
    {
        var v = kmh / 3.6; // m/s
        var (best, bd) = MaisProxima(lat, lng);
        if (best is null || modoCritico) { _prevDFreio = bd; return new FreioFill(0, false); }

        var id = best.Id;
        if (id != _approachId) { _approachId = id; _vMaxApp = 0; _bdAtVmax = double.PositiveInfinity; }

        var aproximando = bd < _prevDFreio - 0.4;
        var pontoFreada = _pontoFreadaRef.TryGetValue(id, out var pf) ? pf : FreioFallbackM;

        double fill = 0;
        var flash = false;
        if (_armado && aproximando && v > 1)
        {
            // Zero ADIANTADO pela reação aprendida (gap 3): o 100%/flash vem adiantoM
            // metros ANTES do ponto de freada, compensando o atraso do piloto.
            var adiantoM = ReacaoS(id) * v;
            var restoM = bd - pontoFreada - adiantoM;
            if (restoM <= 0) { fill = 1; flash = true; _armado = false; }         // chegou no ponto → pisca
            else { var t = restoM / v; if (t <= FreioLeadS) fill = 1 - t / FreioLeadS; } // 4 s antes = 0%
        }

        var lit = (int)Math.Round(fill * FreioN, MidpointRounding.AwayFromZero);
        if (bd > pontoFreada + 60) _armado = true; // re-arma ao se afastar do ápice

        // INÍCIO da freada (sem sensor): pico de velocidade na aproximação = onde freou.
        if (aproximando && bd < 220)
        {
            if (kmh > _vMaxApp) { _vMaxApp = kmh; _bdAtVmax = bd; }
            _onset[id] = _bdAtVmax;
        }

        _prevDFreio = bd;
        return new FreioFill(lit, flash);
    }

    /// <summary>
    /// Fecha o trecho: compara o ponto onde freou nesta passagem com o da melhor
    /// passagem e, se esta foi a mais rápida (menor tempo), passa a ser a referência.
    /// tempoS = tempo da passagem (entrada→saída) em segundos. Null se não houve freada medida.
    /// </summary>
    public FreioResultado? FecharTrecho(string segId, double tempoS)
    {
        if (!_onset.TryGetValue(segId, out var onset) || !double.IsFinite(onset)) return null;

        FreioResultado res;
        if (_pontoFreadaRef.TryGetValue(segId, out var refOnset))
        {
            var m = (int)Math.Round(onset - refOnset); // + freou ANTES, − freou DEPOIS (vs melhor)
            if (Math.Abs(m) <= FreioTolM) res = new FreioResultado(Math.Abs(m), "NO PONTO", FreioTom.Bom);
            else if (m > 0)               res = new FreioResultado(m, "ANTES", FreioTom.Foco);
            else                          res = new FreioResultado(-m, "DEPOIS", FreioTom.Erro);
        }
        else
        {
            res = new FreioResultado(null, "REFERÊNCIA", FreioTom.Neutro); // 1ª passagem vira referência
        }

        if (tempoS > 0.5 && (!_melhorTempo.TryGetValue(segId, out var bt) || tempoS < bt))
        {
            _melhorTempo[segId] = tempoS;
            _pontoFreadaRef[segId] = onset;
        }
        return res;
    }
}
