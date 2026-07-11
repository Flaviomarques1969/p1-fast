// LuzMarchaAntecipacao — liga o PilotReaction (Onda 7) na luz de marcha do maestro.
//
// A luz de marcha mira a POTÊNCIA MÁXIMA do motor (Bubi 6.050 rpm — sem modos, decisão
// Flávio 14/06: carro de corrida = um comportamento só). Este módulo ANTECIPA o ponto
// VISUAL da luz pelo tempo de reação do piloto, pra a troca REAL cair no ponto ótimo:
//   rpm_visual = rpm_alvo − (tempo_reacao_ms × ritmo_subida_giro / 1000)
//
// E APRENDE esse tempo POR MARCHA observando as trocas. Como o caminho vivo é USB/T3000
// (sem sensor de câmbio), a MARCHA vem do DetectorMarchaOnline (razão giro÷velocidade do
// RaceBox a 25 Hz), e o INSTANTE da troca vem da QUEDA forte do giro (o detector tem atraso;
// a queda marca o pico exato). Assim o aprendizado é por (carro, marcha, trecho).
//
// Porte fiel da parte "Onda 7" de web/cockpit/shift-light-orquestrador.js + pilot-reaction.js
// + gear-detector-online.js. Puro: sem I/O, sem relógio — o instante (s) vem de fora.

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
    // Confirmação por acelerador (TPS): a queda do giro na zona vira aprendizado só se o acelerador
    // estiver/voltar ALTO logo após — distingue TROCA de LIFT/FREADA. Cobre os dois estilos de
    // subida de marcha: flat-shift (corte de ignição, pé no fundo → TPS já alto na hora) e troca com
    // alívio (pisca e volta → TPS alto pouco depois). Na freada o acelerador fica baixo → descarta.
    // Sem TPS (sensor ausente) → cai no comportamento antigo (só a queda do giro).
    private const double TpsRetomadaMinPct = 40;  // acelerador "sob potência" logo após a queda
    private const double TpsConfirmS       = 0.6; // janela pro acelerador confirmar a troca

    private readonly PilotReaction _reacao = new();
    private readonly DetectorMarchaOnline _marchas = new();
    private readonly string? _carroId;

    private readonly List<(double Rpm, double TSeg)> _hist = new();
    private double _picoCorrente = double.NegativeInfinity; // maior giro desde a última troca/rearme
    private double _ritmoNoPico;                             // ritmo de subida (rpm/s) capturado NO pico
    private bool _emZonaDeTroca;                             // pico já entrou na zona (armado pra detectar a queda)

    private double _ultimoTpsPct = double.NaN;              // último acelerador lido (%) e quando (s)
    private double _ultimoTpsT = double.NegativeInfinity;
    // Troca detectada aguardando o acelerador confirmar (pico/instante já capturados no evento):
    private ReactionEvent? _pendEvento;
    private double _pendDeadline;                           // até quando o acelerador pode confirmar

    public LuzMarchaAntecipacao(string? carroId = null) { _carroId = carroId; }

    /// <summary>Perfis de reação aprendidos (debug/telemetria).</summary>
    public IReadOnlyDictionary<string, PerfilReacao> Perfis => _reacao.Profiles;
    /// <summary>Marcha atual estimada (do DetectorMarchaOnline) — telemetria/tela.</summary>
    public int? MarchaAtual => _marchas.MarchaAtual;

    /// <summary>Snapshot do aprendizado de reação (por marcha/trecho) pra persistir entre sessões.
    /// Só a memória de longo prazo (perfis do PilotReaction) viaja — o histórico/pico da sessão é volátil.</summary>
    public PilotReactionSnapshot ExportarReacao() => _reacao.ExportarEstado();

    /// <summary>Restaura o aprendizado de reação gravado em sessões anteriores (chamar ao abrir a sessão).</summary>
    public void ImportarReacao(PilotReactionSnapshot? snap) => _reacao.ImportarEstado(snap);

    /// <summary>Zera o histórico e o câmbio aprendido (motor emudeceu / reinício de sessão).</summary>
    public void Reset()
    {
        _hist.Clear();
        _picoCorrente = double.NegativeInfinity;
        _ritmoNoPico = 0;
        _emZonaDeTroca = false;
        _pendEvento = null;
        _ultimoTpsPct = double.NaN;
        _ultimoTpsT = double.NegativeInfinity;
        _marchas.Reset();
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

    /// <summary>Ingere uma amostra de motor+velocidade: alimenta o detector de marcha, guarda o giro
    /// e, se detectar uma SUBIDA de marcha (queda forte vinda da zona de troca CONFIRMADA pelo
    /// acelerador), ensina o PilotReaction keado pela marcha atual. <paramref name="alvoRpm"/> = ponto
    /// ótimo (6.050); <paramref name="kmh"/> = velocidade do RaceBox (0 se sem GPS — perfil genérico);
    /// <paramref name="tpsPct"/> = acelerador % (null = sem sensor → gate desligado, comportamento antigo).</summary>
    public void Amostra(double rpm, double kmh, double tSeg, double alvoRpm, string? trechoId, double? tpsPct = null)
    {
        if (!double.IsFinite(rpm) || !double.IsFinite(tSeg)) return;
        _marchas.Ingest(rpm, kmh, tSeg);
        _hist.Add((rpm, tSeg));
        var ritmo = RitmoSubida(tSeg);

        if (tpsPct is { } tp && double.IsFinite(tp)) { _ultimoTpsPct = tp; _ultimoTpsT = tSeg; }

        if (rpm > _picoCorrente)
        {
            _picoCorrente = rpm;
            _ritmoNoPico = ritmo;                       // ritmo enquanto SUBIA (positivo); usado na reação
            if (rpm >= PicoZonaMinRpm) _emZonaDeTroca = true;
        }

        // Troca já detectada, esperando o acelerador confirmar (ou expirar → foi lift/freada).
        if (_pendEvento is not null) ResolverPendente(tSeg);

        // Queda forte a partir de um pico na zona de troca = candidata a subida de marcha.
        if (_pendEvento is null && _emZonaDeTroca && _picoCorrente - rpm >= QuedaTrocaRpm)
        {
            var ev = MontarEvento(alvoRpm, trechoId);
            if (TpsDisponivel(tSeg))
            {
                // Arma a confirmação: só vira aprendizado se o acelerador estiver/voltar alto.
                _pendEvento = ev;
                _pendDeadline = tSeg + TpsConfirmS;
                ResolverPendente(tSeg);                 // flat-shift já confirma nesta amostra (TPS alto agora)
            }
            else
            {
                // LastUpdated do perfil = epoch-ms (paridade com o Date.now() do JS). NÃO passar o
                // relógio de SESSÃO (tSeg): ele reinicia do zero a cada sessão e não dá pra comparar
                // "qual perfil é mais novo" entre sessões. A medição da reação já vem do ritmo/pico
                // do evento — o carimbo de tempo é só metadado.
                _reacao.LearnFromEvent(ev); // sem TPS → comportamento antigo (epoch no LastUpdated)
            }

            // Rearma: só conta a próxima troca depois de o giro subir de novo até a zona.
            _picoCorrente = rpm;
            _ritmoNoPico = 0;
            _emZonaDeTroca = false;
        }
    }

    /// <summary>Monta o evento de reação a partir do pico/ritmo/marcha atuais.
    /// A referência da reação é o ponto onde a luz ACENDEU (alvo − compensação vigente,
    /// com o mesmo piso da tela), NÃO o alvo fixo: medindo do alvo, o EMA convergia pra
    /// METADE da reação real (observado = rt_real − rt_aprendido → ponto fixo rt_real/2)
    /// e a luz antecipava só metade do necessário. Decisão Flávio 2026-07-10: corrigido
    /// aqui E no JS canônico (web/cockpit/shift-light-orquestrador.js) — paridade mantida.</summary>
    private ReactionEvent MontarEvento(double alvoRpm, string? trechoId)
    {
        // Chave da marcha = ÂNCORA absoluta (bucket da razão giro÷km/h), não o rótulo posicional:
        // o posicional migra de marcha física conforme a ordem de descoberta, e o perfil persistido
        // (luz-marcha-<carro>.json) aplicaria a reação de uma marcha na OUTRA na sessão seguinte.
        // Decisão Flávio 2026-07-11. DIVERGE do JS canônico de propósito (iMac avisado no canal).
        var marcha = _marchas.MarchaAncoraAtual;        // marcha ANTES da troca (detector ainda não virou)
        var conf   = marcha is null ? 1.0 : _marchas.Confianca; // sem marcha → perfil genérico
        // Onde a luz estava acendendo NO PICO: mesma conta da tela (RpmVisual), com o ritmo
        // capturado no pico — é o MESMO ritmo que vai em RpmRiseRate, então o observado vira
        // exatamente (pico − ondeAcendeu)/ritmo = a reação REAL do piloto, e o EMA converge nela.
        var comp = _reacao.ComputeCompensation(null, _carroId, marcha, trechoId, Math.Max(0, _ritmoNoPico), "assisted");
        var ondeAcendeu = Math.Max(alvoRpm - AntecipacaoMaxRpm, alvoRpm - comp.CompensationRpm);
        return new ReactionEvent(
            RpmAtShift: _picoCorrente,
            TargetVisualRpm: ondeAcendeu,
            RpmRiseRate: _ritmoNoPico > 0 ? _ritmoNoPico : null,
            GearConfidence: conf,
            DeltaRpm: _picoCorrente - ondeAcendeu,      // <0 (trocou ANTES de a luz acender) → LearnFromEvent rejeita
            CarroId: _carroId,
            GearAfter: marcha,
            TrechoId: trechoId);
    }

    /// <summary>Há leitura de acelerador recente o bastante pra usar o gate?</summary>
    private bool TpsDisponivel(double tSeg)
        => double.IsFinite(_ultimoTpsPct) && tSeg - _ultimoTpsT <= JanelaRitmoS;

    /// <summary>Resolve a troca pendente: acelerador voltou/segue alto → foi TROCA (aprende, ancorado no
    /// instante da queda); passou da janela sem voltar → foi LIFT/FREADA (descarta). O instante aprendido
    /// é sempre o da queda, então a confirmação atrasada não desloca a reação medida.</summary>
    private void ResolverPendente(double tSeg)
    {
        if (_pendEvento is null) return;
        var tpsAlto = TpsDisponivel(tSeg) && _ultimoTpsPct >= TpsRetomadaMinPct;
        if (tpsAlto)
        {
            // LastUpdated = epoch-ms (paridade com o JS). A medição da reação é ancorada no
            // instante da QUEDA pelos dados do evento (pico/ritmo), não pelo carimbo de tempo —
            // então usar epoch aqui não desloca a reação medida (ver comentário do método).
            _reacao.LearnFromEvent(_pendEvento);
            _pendEvento = null;
        }
        else if (tSeg >= _pendDeadline)
        {
            _pendEvento = null;                         // acelerador não voltou → não foi troca
        }
    }

    /// <summary>RPM VISUAL da luz = alvo − compensação (antecipação), keado pela marcha atual. mode
    /// "assisted" antecipa (default 250 ms até aprender ≥10 trocas daquela marcha); "learning" não
    /// antecipa. Ritmo ≤ 0 → sem antecipação. Nunca antecipa além do piso de segurança.</summary>
    public double RpmVisual(double alvoRpm, double tSeg, string? trechoId, string mode = "assisted")
    {
        var ritmo = RitmoSubida(tSeg);
        // Mesma chave do aprendizado: âncora absoluta da marcha (ver MontarEvento).
        var comp = _reacao.ComputeCompensation(null, _carroId, _marchas.MarchaAncoraAtual, trechoId, Math.Max(0, ritmo), mode);
        var visual = alvoRpm - comp.CompensationRpm;
        return Math.Max(alvoRpm - AntecipacaoMaxRpm, visual);
    }

    /// <summary>Atalho: ingere a amostra (giro+velocidade+acelerador) e devolve o RPM visual já antecipado.</summary>
    public double IngerirEObterVisual(double rpm, double kmh, double tSeg, double alvoRpm, string? trechoId, string mode = "assisted", double? tpsPct = null)
    {
        Amostra(rpm, kmh, tSeg, alvoRpm, trechoId, tpsPct);
        return RpmVisual(alvoRpm, tSeg, trechoId, mode);
    }
}
