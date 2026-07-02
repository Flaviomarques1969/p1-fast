// CockpitOrchestrator — o "maestro" que junta as 5 peças do cérebro e comanda
// o CockpitState a partir do dado real, ao vivo:
//   motor  -> luz de marcha (Bubi) + alertas (mensagem)
//   GPS    -> em qual curva está (TrechoDetector) + bolinha do ápice (Ghost) +
//            ao fechar a curva: diferença de tempo vs a passagem de referência
//            (a MELHOR passagem por aquela curva) -> frase do coach (acao)
//
// É a cola que o MainWindow (a tela) usa: a tela só observa o CockpitState; o
// maestro é quem o muta com dado real. Mesma lógica que rodará na pista.

namespace P1Fast.Cockpit.Domain;

public sealed class CockpitOrchestrator
{
    private readonly CockpitState _cockpit;
    private readonly LiveLimits _limites;
    private readonly AlertasCriticos _alertas;
    private readonly TrechoDetector? _detector;
    private readonly LuzFreio? _luzFreio;
    private readonly Dictionary<string, TrechoSegmento> _segPorId;

    // Buffer da passagem atual (pra fechar a curva e comparar com a referência).
    // Referência por curva = a MELHOR passagem histórica (menor tempo), atualizada
    // quando uma passagem mais rápida acontece (decisão Flávio 25/06).
    private readonly Dictionary<string, Passagem> _referencias = new();
    private readonly Dictionary<string, double> _refTempos = new(); // tempo (s) da melhor passagem por curva
    private readonly List<(double Lat, double Lng, double Kmh, double T, double CumDist, string Sub)> _buf = new();
    private string? _segAtual;
    private string _subAtual = "entrada";
    private double _cumDist;
    private AmostraGps? _lastGps;

    // Marcos REAIS da passagem: instantes da freada e do ápice (mesmo relógio do buffer, gps.T).
    // Usados pra (H4) re-etiquetar os subs no fechamento — o sub 'saida' passa a existir de
    // verdade (port do "conserto 11/06" web, retagSubsPorEventos/acharVminBuffer) — e pra
    // (M2) congelar o ângulo do ápice NO cruzamento, não no instante da saída.
    private double? _freadaT, _apiceT;
    private double? _apiceAngulo, _apiceDist;

    // Velocidades/medidas reais de referência por curva (da melhor passagem), pra comparar e colorir.
    private readonly Dictionary<string, (double? Ent, double? Fre, double? Api, double? Sai)> _refPontos = new();
    private double? _pEnt, _pFre, _pApi, _pSai; // o que está sendo medido na passagem atual

    // Resultado real por curva (pra barra de stint): "faster"/"slower"/"neutral".
    private readonly Dictionary<string, string> _estadoTrecho = new();
    public string EstadoDoTrecho(string segId) => _estadoTrecho.GetValueOrDefault(segId, "");
    public string? CurvaAtualId => _segAtual;

    public CockpitOrchestrator(CockpitState cockpit, IReadOnlyList<TrechoSegmento>? segments = null, LiveLimits? limites = null)
    {
        _cockpit = cockpit ?? throw new ArgumentNullException(nameof(cockpit));
        _limites = limites ?? LiveLimits.Bubi;
        _alertas = new AlertasCriticos();
        _segPorId = segments?.ToDictionary(s => s.Id, s => s) ?? new();
        if (segments is { Count: > 0 })
        {
            _detector = new TrechoDetector(segments, OnTrechoEvento);
            _luzFreio = new LuzFreio(segments);
        }
    }

    /// <summary>Quantas curvas já têm passagem de referência (1ª volta registrada).</summary>
    public int CurvasComReferencia => _referencias.Count;

    /// <summary>Nome da curva em que o carro está agora (ou null fora de curva).</summary>
    public string? CurvaAtualNome => _segAtual is not null && _segPorId.TryGetValue(_segAtual, out var s) ? s.Nome : null;

    private static string FormatDelta(double s)
    {
        var v = s.ToString("0.00", System.Globalization.CultureInfo.InvariantCulture);
        return s >= 0 ? "+" + v : v;
    }

    // ── Motor ──────────────────────────────────────────────────────

    /// <summary>Ingere uma amostra de motor: atualiza luz de marcha + alertas.</summary>
    public void IngestMotor(double rpm, AmostraAlerta alerta)
    {
        var dec = LiveDataBridge.RpmToShift(rpm, _limites);
        _cockpit.ApplyShift(dec.Mode, dec.Level);

        _alertas.IngestT4000(alerta);
        var principal = _alertas.GetMensagemPrincipal();
        if (principal is not null) _cockpit.ShowMessage(principal.Tipo, principal.Texto);
        else _cockpit.HideMessage();
    }

    // ── GPS ────────────────────────────────────────────────────────

    /// <summary>Ingere uma amostra de GPS: curva atual + bolinha + buffer da passagem.</summary>
    public void IngestGps(AmostraGps gps)
    {
        _detector?.IngestGps(gps);

        if (_segAtual is not null)
        {
            if (_lastGps is not null)
                _cumDist += Ghost.DistMeters(new PontoGps(_lastGps.Lat, _lastGps.Lng), new PontoGps(gps.Lat, gps.Lng));
            _buf.Add((gps.Lat, gps.Lng, gps.Kmh, gps.T, _cumDist, _subAtual));
        }

        AtualizarBolinha(gps);

        // Luz de freio lateral: enche por tempo na aproximação do ponto de freada
        // da melhor passagem; pisca a tela ao chegar. modoCritico = mensagem GRAVE na tela.
        if (_luzFreio is not null)
        {
            var critico = _cockpit.Get().Message is { Tipo: MsgTipo.Grave };
            var f = _luzFreio.Atualizar(gps.Lat, gps.Lng, gps.Kmh, critico);
            _cockpit.SetFreioFill(f.Lit, f.Flash);
        }

        _lastGps = gps;
    }

    // ── Eventos do detector ─────────────────────────────────────────

    private void OnTrechoEvento(TrechoEvento ev)
    {
        switch (ev.Type)
        {
            case "entrada-cruzou":
                IniciarPassagem(ev.SegmentId);
                _pEnt = ev.Kmh;
                PontoVelocidade("entrada", ev.Kmh, r => r.Ent);
                break;
            case "freada-iniciou":
                _subAtual = "freio";
                _pFre = ev.DistFromEntradaM;
                _freadaT ??= ev.T;
                if (ev.DistFromEntradaM is { } dm) PontoFreio(dm);
                break;
            case "apice-cruzou":
                _subAtual = "apice";
                _pApi = ev.Kmh;
                // Congela o marco do ápice na 1ª passagem pelo ápice (M2): ângulo/dist do
                // CRUZAMENTO, não o da bolinha ao vivo lida perto da saída (que gira p/ ~180°).
                if (_apiceT is null) { _apiceT = ev.T; _apiceAngulo = ev.AngleFromIdealDeg; _apiceDist = ev.DistFromIdealM; }
                PontoVelocidade("apice", ev.Kmh, r => r.Api);
                break;
            case "saida-cruzou":
                _pSai = ev.Kmh;
                PontoVelocidade("saida", ev.Kmh, r => r.Sai);
                FecharPassagem(ev.SegmentId);
                break;
            case "resync":
                IniciarPassagem(ev.ParaSegmentId ?? ev.SegmentId);
                _pEnt = ev.Kmh;
                PontoVelocidade("entrada", ev.Kmh, r => r.Ent);
                break;
        }
    }

    // Escreve o ponto do ápice com a velocidade REAL do cruzamento e colore
    // comparando com a 1ª passagem (mais rápido = melhor; sem referência = pendente).
    private void PontoVelocidade(string papel, double kmh, Func<(double? Ent, double? Fre, double? Api, double? Sai), double?> sel)
    {
        ApexEstado estado = ApexEstado.Pendente;
        if (_segAtual is not null && _refPontos.TryGetValue(_segAtual, out var r) && sel(r) is { } refKmh && refKmh > 0)
            estado = kmh >= refKmh ? ApexEstado.OkMelhor : ApexEstado.OkPior;
        _cockpit.SetApexPonto(papel, estado: estado, valorKmh: kmh);
    }

    private void PontoFreio(double atualM)
    {
        double? refM = _segAtual is not null && _refPontos.TryGetValue(_segAtual, out var r) ? r.Fre : null;
        var estado = refM is { } rm && rm > 0 ? CockpitState.ClassifyFreio(atualM, rm) : ApexEstado.Pendente;
        _cockpit.SetApexPonto("freio", estado: estado, atualM: atualM, refM: refM);
    }

    private void IniciarPassagem(string segId)
    {
        _segAtual = segId;
        _subAtual = "entrada";
        _cumDist = 0;
        _buf.Clear();
        _pEnt = _pFre = _pApi = _pSai = null;
        _freadaT = _apiceT = _apiceAngulo = _apiceDist = null;
    }

    /// <summary>
    /// Re-etiqueta os subs de uma passagem pelos marcos REAIS (instante da freada e do
    /// ápice), fazendo o sub 'saida' existir de verdade (H4). Port fiel de
    /// retagSubsPorEventos + acharVminBuffer (web/cockpit/live-data-bridge.js:174-211):
    /// a Vmin (ponto mais lento) separa a desaceleração da aceleração — nunca se inventa
    /// pedaço de ápice. SEM nenhum marco (nem freada nem ápice) devolve a lista intacta.
    /// Puro e estático → testável direto (paridade com o web).
    /// </summary>
    public static IReadOnlyList<PontoPassagem> RetagSubs(IReadOnlyList<PontoPassagem> pts, double? freadaT, double? apiceT)
    {
        if (pts is null || pts.Count == 0) return pts ?? Array.Empty<PontoPassagem>();
        if (freadaT is null && apiceT is null) return pts;

        int vminIdx = -1; double vminKmh = double.NaN;
        for (var i = 0; i < pts.Count; i++)
        {
            var v = pts[i].Kmh;
            if (!double.IsNaN(v) && v > 0 && (double.IsNaN(vminKmh) || v < vminKmh)) { vminKmh = v; vminIdx = i; }
        }
        double? vminT = vminIdx >= 0 ? pts[vminIdx].T : null;

        var outp = new List<PontoPassagem>(pts.Count);
        for (var i = 0; i < pts.Count; i++)
        {
            var p = pts[i];
            var t = p.T;
            string sub;
            if (freadaT is { } fT && t <= fT)
                sub = "entrada";
            else if (apiceT is { } aT)
            {
                if (t <= aT) sub = freadaT is null ? "entrada" : "freio";
                else if (vminT is { } vT && t <= vT && i <= vminIdx) sub = "apice";
                else sub = "saida";
            }
            else if (vminT is { } vT2)
            {
                if (t <= vT2 || i <= vminIdx) sub = freadaT is null ? "entrada" : "freio";
                else sub = "saida";
            }
            else sub = freadaT is null ? "entrada" : "freio";

            outp.Add(p with { Sub = sub });
        }
        return outp;
    }

    private void FecharPassagem(string segId)
    {
        if (_segAtual is null || _buf.Count < 2) { _segAtual = null; _buf.Clear(); return; }

        // Tempo REAL desta passagem (entrada→saída), em segundos. gps.T vem em ms.
        var tempoAtualS = (_buf[^1].T - _buf[0].T) / 1000.0;

        // Resultado da frenagem (à direita): onde freou nesta passagem vs a melhor.
        if (_luzFreio is not null)
        {
            var resultado = _luzFreio.FecharTrecho(segId, tempoAtualS);
            if (resultado is not null)
                _cockpit.SetFreioResultado(resultado.DiffM, resultado.Palavra, resultado.Tom);
        }

        var total = Math.Max(1, _buf[^1].CumDist);
        var pontosRaw = _buf.Select(b => new PontoPassagem(
            b.Lat, b.Lng, b.Kmh, b.T, Math.Min(1, Math.Max(0, b.CumDist / total)), b.Sub)).ToList();
        // H4: os subs viram entrada/freio/apice/saida pelos marcos reais ANTES do delta.
        var pontos = RetagSubs(pontosRaw, _freadaT, _apiceT);
        var passagem = new Passagem(segId, pontos);

        if (_referencias.TryGetValue(segId, out var referencia) && _refTempos.TryGetValue(segId, out var tempoRefS))
        {
            // 2ª volta+ por essa curva: número HÍBRIDO (decisão Flávio 25/06).
            //  - número grande + cor = CRONÔMETRO simples (tempo desta passagem − tempo da
            //    MELHOR passagem histórica): robusto, é o que a tela aprovada 22/06 mostra.
            //  - a integração ghost por sub-trecho serve SÓ pra apontar o pior sub-trecho e
            //    manter as 13 frases pedagógicas (FREOU CEDO, VIROU POUCO…).
            var deltaCronoS = tempoAtualS - tempoRefS;                 // >0 = mais lento que a melhor
            var ghost = DeltaCalculator.Calcular(passagem, referencia);
            // total = cronômetro, distribuição = ghost: ganhou/perdeu pelo relógio, ONDE pelo ghost.
            var delta = ghost with { DeltaTotalS = deltaCronoS, TempoAtualS = tempoAtualS };

            // M2: usa o ângulo/dist CONGELADOS no cruzamento do ápice, não a bolinha ao vivo
            // (que ao sair da curva aponta pra ~180° e envenena a frase p/ VIROU TARDE).
            var coach = MensagensPedagogicas.Decidir(delta, new ContextoApice(_apiceAngulo, _apiceDist),
                recordeAbsolutoS: tempoRefS);
            if (coach is not null)
                _cockpit.SetAcao(coach.Texto, deltaCronoS > 0 ? Tone.Erro : Tone.Bom);

            // Número grande de tempo + halo da curva (resultado real do trecho), banda morta ±0,05 s.
            var tone = deltaCronoS > 0.05 ? Tone.Erro : deltaCronoS < -0.05 ? Tone.Bom : Tone.Neutro;
            _cockpit.SetDelta(FormatDelta(deltaCronoS), tone);
            _cockpit.SetTrechoStatus(deltaCronoS < -0.05 ? TrechoStatus.RecordeStint
                : deltaCronoS > 0.05 ? TrechoStatus.PiorStint : TrechoStatus.Neutro);
            _estadoTrecho[segId] = deltaCronoS < -0.05 ? "faster"
                : deltaCronoS > 0.05 ? "slower" : "neutral";

            // MELHOR histórica: se esta passagem foi mais rápida, ela vira a nova referência.
            if (tempoAtualS < tempoRefS)
            {
                _referencias[segId] = passagem;
                _refTempos[segId] = tempoAtualS;
                _refPontos[segId] = (_pEnt, _pFre, _pApi, _pSai);
            }
        }
        else
        {
            // 1ª passagem: vira a referência inicial (volta + tempo + velocidades); mostra REGISTRANDO.
            _referencias[segId] = passagem;
            _refTempos[segId] = tempoAtualS;
            _refPontos[segId] = (_pEnt, _pFre, _pApi, _pSai);
            _estadoTrecho[segId] = "reference"; // marca na barra: curva já gravada como referência (quadriculado)
            var coach = MensagensPedagogicas.Decidir(primeiraPassagem: true);
            if (coach is not null) _cockpit.SetAcao(coach.Texto, Tone.Neutro);
        }

        _segAtual = null;
        _buf.Clear();
    }

    // ── Bolinha do ápice (contínua) ─────────────────────────────────

    private void AtualizarBolinha(AmostraGps gps)
    {
        if (_segAtual is null || !_segPorId.TryGetValue(_segAtual, out var seg)) return;

        double? heading = gps.HeadingDeg;
        if ((heading is null || double.IsNaN(heading.Value)) && _lastGps is not null
            && Ghost.DistMeters(new PontoGps(_lastGps.Lat, _lastGps.Lng), new PontoGps(gps.Lat, gps.Lng)) >= 1)
            heading = Ghost.BearingDeg(new PontoGps(_lastGps.Lat, _lastGps.Lng), new PontoGps(gps.Lat, gps.Lng));

        var b = Ghost.CalcularBolinha(new PontoGps(gps.Lat, gps.Lng), heading, seg.ApicePoint);
        _cockpit.SetApexPonto("apice", estado: b.Estado, distM: b.DistM, angleDeg: b.AngleDeg);
    }
}
