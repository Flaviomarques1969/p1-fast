// CockpitOrchestrator — o "maestro" que junta as 5 peças do cérebro e comanda
// o CockpitState a partir do dado real, ao vivo:
//   motor  -> luz de marcha (Bubi) + alertas (mensagem)
//   GPS    -> em qual curva está (TrechoDetector) + bolinha do ápice (Ghost) +
//            ao fechar a curva: diferença de tempo vs a passagem de referência
//            (a 1ª passagem por aquela curva) -> frase do coach (acao)
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
    private readonly Dictionary<string, TrechoSegmento> _segPorId;

    // Buffer da passagem atual (pra fechar a curva e comparar com a referência).
    private readonly Dictionary<string, Passagem> _referencias = new(); // 1ª passagem por curva
    private readonly List<(double Lat, double Lng, double Kmh, double T, double CumDist, string Sub)> _buf = new();
    private string? _segAtual;
    private string _subAtual = "entrada";
    private double _cumDist;
    private AmostraGps? _lastGps;

    public CockpitOrchestrator(CockpitState cockpit, IReadOnlyList<TrechoSegmento>? segments = null, LiveLimits? limites = null)
    {
        _cockpit = cockpit ?? throw new ArgumentNullException(nameof(cockpit));
        _limites = limites ?? LiveLimits.Bubi;
        _alertas = new AlertasCriticos();
        _segPorId = segments?.ToDictionary(s => s.Id, s => s) ?? new();
        if (segments is { Count: > 0 }) _detector = new TrechoDetector(segments, OnTrechoEvento);
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
        _lastGps = gps;
    }

    // ── Eventos do detector ─────────────────────────────────────────

    private void OnTrechoEvento(TrechoEvento ev)
    {
        switch (ev.Type)
        {
            case "entrada-cruzou":
                IniciarPassagem(ev.SegmentId);
                break;
            case "freada-iniciou":
                _subAtual = "freio";
                break;
            case "apice-cruzou":
                _subAtual = "apice";
                break;
            case "saida-cruzou":
                FecharPassagem(ev.SegmentId);
                break;
            case "resync":
                IniciarPassagem(ev.ParaSegmentId ?? ev.SegmentId);
                break;
        }
    }

    private void IniciarPassagem(string segId)
    {
        _segAtual = segId;
        _subAtual = "entrada";
        _cumDist = 0;
        _buf.Clear();
    }

    private void FecharPassagem(string segId)
    {
        if (_segAtual is null || _buf.Count < 2) { _segAtual = null; _buf.Clear(); return; }

        var total = Math.Max(1, _buf[^1].CumDist);
        var pontos = _buf.Select(b => new PontoPassagem(
            b.Lat, b.Lng, b.Kmh, b.T, Math.Min(1, Math.Max(0, b.CumDist / total)), b.Sub)).ToList();
        var passagem = new Passagem(segId, pontos);

        if (_referencias.TryGetValue(segId, out var referencia))
        {
            // 2ª volta+ por essa curva: diferença de tempo REAL vs a 1ª.
            var delta = DeltaCalculator.Calcular(passagem, referencia);
            var apex = _cockpit.Get().Apex.Apice;
            var coach = MensagensPedagogicas.Decidir(delta, new ContextoApice(apex.AngleDeg, apex.DistM));
            if (coach is not null)
                _cockpit.SetAcao(coach.Texto, delta.DeltaTotalS > 0 ? Tone.Erro : Tone.Bom);
        }
        else
        {
            // 1ª passagem: vira a referência; mostra REGISTRANDO.
            _referencias[segId] = passagem;
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
