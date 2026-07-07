// LuzMarchaAntecipacao — liga o PilotReaction (Onda 7) na luz de marcha do maestro.
//
// A luz de marcha mira a POTÊNCIA MÁXIMA do motor (Bubi 6.050 rpm — sem modos, decisão
// Flávio 14/06: carro de corrida = um comportamento só). Este módulo ANTECIPA o ponto
// VISUAL da luz pelo tempo de reação do piloto, pra a troca REAL cair no ponto ótimo:
//   rpm_visual = rpm_alvo − (tempo_reacao_ms × ritmo_subida_giro / 1000)
//
// E APRENDE esse tempo observando as trocas. Porém o caminho vivo é USB/T3000, que NÃO
// fornece a marcha (T3000RIBlockParser: Marcha = null) — então o EVENTO de troca é detectado
// pela QUEDA forte do giro vindo da zona de troca (uma subida de marcha derruba o RPM). A
// marcha fica nula na tupla (aprende um perfil único do piloto/carro/trecho, não por marcha).
//
// Porte fiel da parte "Onda 7" de web/cockpit/shift-light-orquestrador.js + pilot-reaction.js.
// Puro: sem I/O, sem relógio — o instante monotônico vem de fora, em segundos.

namespace P1Fast.Cockpit.Domain;

public sealed class LuzMarchaAntecipacao
{
    // Janela pra média do ritmo de subida do giro (rpm/s). Igual ao JS (0,8 s).
    private const double JanelaRitmoS = 0.8;
    // Detecção de troca (subida de marcha): o giro estava perto do ponto e CAIU forte.
    private const double PicoZonaMinRpm = 5000;   // só conta troca vinda de perto do ponto de troca
    private const double QuedaTrocaRpm  = 700;    // queda que caracteriza uma subida de marcha
    // Piso de segurança: a luz nunca acende MUITO antes do alvo, por mais alto que o ritmo suba.
    private const double AntecipacaoMaxRpm = 800;

    private readonly PilotReaction _reacao = new();
    private readonly string? _carroId;

    private readonly List<(double Rpm, double TSeg)> _hist = new();
    private double _picoCorrente = double.NegativeInfinity; // maior giro desde a última troca/rearme
    private double _ritmoNoPico;                             // ritmo de subida (rpm/s) capturado NO pico
    private bool _emZonaDeTroca;                             // pico já entrou na zona (armado pra detectar a queda)

    public LuzMarchaAntecipacao(string? carroId = null) { _carroId = carroId; }

    /// <summary>Perfis de reação aprendidos (debug/telemetria).</summary>
    public IReadOnlyDictionary<string, PerfilReacao> Perfis => _reacao.Profiles;

    /// <summary>Zera o histórico (motor emudeceu / reinício) — evita troca-fantasma por giro velho.</summary>
    public void Reset()
    {
        _hist.Clear();
        _picoCorrente = double.NegativeInfinity;
        _ritmoNoPico = 0;
        _emZonaDeTroca = false;
    }

    /// <summary>Ritmo de subida do giro (rpm/s) na janela; 0 se insuficiente. Também poda a janela.</summary>
    private double RitmoSubida(double tSeg)
    {
        _hist.RemoveAll(p => tSeg - p.TSeg > JanelaRitmoS);
        if (_hist.Count < 2) return 0;
        var f = _hist[0]; var l = _hist[^1];
        var dt = l.TSeg - f.TSeg;
        return dt > 0.05 ? (l.Rpm - f.Rpm) / dt : 0;
    }

    /// <summary>Ingere uma amostra de motor: guarda no histórico e, se detectar uma SUBIDA de
    /// marcha (giro caiu forte vindo da zona de troca), ensina o PilotReaction.
    /// <paramref name="alvoRpm"/> = ponto ótimo (6.050); <paramref name="trechoId"/> = curva atual.</summary>
    public void Amostra(double rpm, double tSeg, double alvoRpm, string? trechoId)
    {
        if (!double.IsFinite(rpm) || !double.IsFinite(tSeg)) return;
        _hist.Add((rpm, tSeg));
        var ritmo = RitmoSubida(tSeg);

        if (rpm > _picoCorrente)
        {
            _picoCorrente = rpm;
            _ritmoNoPico = ritmo;                       // ritmo enquanto SUBIA (positivo); usado na reação
            if (rpm >= PicoZonaMinRpm) _emZonaDeTroca = true;
        }

        // Queda forte a partir de um pico na zona de troca = subiu de marcha → evento de reação.
        if (_emZonaDeTroca && _picoCorrente - rpm >= QuedaTrocaRpm)
        {
            var ev = new ReactionEvent(
                RpmAtShift: _picoCorrente,
                TargetVisualRpm: alvoRpm,
                RpmRiseRate: _ritmoNoPico > 0 ? _ritmoNoPico : null,
                GearConfidence: 1.0,
                DeltaRpm: _picoCorrente - alvoRpm, // <0 (trocou antes do ponto) → LearnFromEvent rejeita
                CarroId: _carroId,
                GearAfter: null,
                TrechoId: trechoId);
            _reacao.LearnFromEvent(ev, nowMs: (long)(tSeg * 1000.0));

            // Rearma: só conta a próxima troca depois de o giro subir de novo até a zona.
            _picoCorrente = rpm;
            _ritmoNoPico = 0;
            _emZonaDeTroca = false;
        }
    }

    /// <summary>RPM VISUAL da luz = alvo − compensação (antecipação). mode "assisted" antecipa
    /// (default 250 ms até aprender ≥10 trocas do piloto); "learning" não antecipa (comp 0).
    /// Ritmo ≤ 0 (giro não sobe) → sem antecipação. Nunca antecipa além do piso de segurança.</summary>
    public double RpmVisual(double alvoRpm, double tSeg, string? trechoId, string mode = "assisted")
    {
        var ritmo = RitmoSubida(tSeg);
        var comp = _reacao.ComputeCompensation(null, _carroId, null, trechoId, Math.Max(0, ritmo), mode);
        var visual = alvoRpm - comp.CompensationRpm;
        return Math.Max(alvoRpm - AntecipacaoMaxRpm, visual);
    }

    /// <summary>Atalho: ingere a amostra e devolve o RPM visual já antecipado.</summary>
    public double IngerirEObterVisual(double rpm, double tSeg, double alvoRpm, string? trechoId, string mode = "assisted")
    {
        Amostra(rpm, tSeg, alvoRpm, trechoId);
        return RpmVisual(alvoRpm, tSeg, trechoId, mode);
    }
}
