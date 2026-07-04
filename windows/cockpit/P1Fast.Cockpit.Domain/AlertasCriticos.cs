// AlertasCriticos — motor de mensagens críticas do cockpit no app nativo.
//
// Port fiel de web/cockpit/alertas-criticos.js (catálogo v2 aprovado por Flávio
// 27/05/2026). Avalia a amostra viva do motor e devolve a mensagem de maior
// gravidade pra tela.
//
// DIFERENÇA-CHAVE em relação ao LiveDataBridge.CheckCriticalAlerts antigo (que
// modela o protocolo T4000-CAN): aqui o óleo é o BIT de alarme (baixaPressaoOleo),
// NÃO um valor de pressão; e todo sensor AUSENTE (null) é "sem dado" — NUNCA
// dispara alerta. Foi o que o dado real de 21/06 revelou: o sensor de óleo veio
// ausente, e tratar ausente como "0 bar" dispararia ÓLEO BAIXO falso.

namespace P1Fast.Cockpit.Domain;

/// <summary>Gravidade do alerta (ordem de prioridade na tela).</summary>
public enum AlertaGravidade
{
    Super,    // escancarado, esconde o painel
    Critico,  // sobrepõe pilotagem, mantém painel
    Atencao,  // informa sem alarme
    Info,     // operacional
}

/// <summary>Um item do catálogo de alertas.</summary>
public sealed record Alerta(string Id, string Texto, AlertaGravidade Gravidade);

/// <summary>
/// Amostra do motor pro avaliador de alertas. Campos null = SENSOR AUSENTE
/// (sem dado) — nunca disparam alerta. Espelha exatamente o que avaliarT4000 lê.
/// </summary>
public sealed record AmostraAlerta
{
    public double? WaterTempC             { get; init; }
    public double? Rpm                    { get; init; }
    public double? TpsPct                 { get; init; } // acelerador % (pro gate de carga)
    public double? Lambda                 { get; init; }
    public double? BatteryV               { get; init; }
    public bool?   BaixaPressaoOleo       { get; init; } // bit de alarme do T3000
    public bool?   AlertaNivelCombustivel { get; init; }
    public bool?   BaixaPressaoCombustivel{ get; init; }
    public bool?   FuelInjectionBalanced  { get; init; }
    public double? TireTempC              { get; init; } // sensor a instalar
    public double? CambioTempC            { get; init; } // sensor a instalar
}

/// <summary>Limites calibráveis (ALERTA_LIMITES_DEFAULT). Default = Bubi.</summary>
public sealed record AlertaLimites(
    // MOTOR QUENTE. Bubi opera frio: cai de 80 -> 70 (spec v2, Flávio 04/07). O antigo
    // "Temperatura Motor Subindo" fixo (era 70) SAIU na Fase 1 — volta como IA de padrão
    // histórico na Fase 2 (não é mais limiar fixo), por isso não há mais WaterPredictivoC.
    double WaterMaxC        = 70,
    double LambdaPobre      = 1.0,   // era 1.15 (spec v2, Flávio 04/07)
    double LambdaRica       = 0.74,  // era 0.80
    double BatteryMinV      = 12.5,  // era 11.8
    double TireTempMaxC     = 120,
    double CambioTempMaxC   = 140,
    // Gates de "carro sob carga" (motor puxando). Achado do dado real 21/06: mistura e
    // bateria só fazem sentido puxando (em marcha lenta a lambda lê corte = pobre falso e
    // a bateria cai sozinha). Pós-spec v2 o gate deixou de ser único e virou POR-ALERTA:
    //  • Mistura Pobre: giro ≥3500 OU acelerador ≥50%.
    //  • Mistura Rica:  giro >3000 E acelerador >40% (carga real).
    //  • Bateria:       gate antigo (giro ≥3000 OU acelerador ≥15%).
    // Segurança (motor quente, óleo) NÃO depende de carga (vale parado também).
    double PobreCargaRpmMin = 3500,
    double PobreCargaTpsMin = 50,
    double RicaCargaRpmMin  = 3000,
    double RicaCargaTpsMin  = 40,
    double CargaRpmMin      = 3000,
    double CargaTpsPctMin   = 15,
    // Histerese temporal (bloco 2b, spec v2, Flávio 04/07). Precisa de relógio (tSeg).
    //  • Óleo: só alarma depois de ~2s de motor RODANDO (suprime o pico da partida —
    //    a pressão sobe em 1–2s ao ligar). Depois é INSTANTÂNEO em qualquer rpm.
    //  • Rica: só avisa se a mistura rica persistir ≥1s contínuo (ignora pico transitório).
    double MotorLigadoRpmMin     = 500,   // acima = motor rodando; abaixo = off/partida
    double OleoPartidaSupressaoS = 2.0,
    double RicaPersistenciaMinS  = 1.0
)
{
    public static AlertaLimites Default { get; } = new();
}

/// <summary>Mensagem principal pra tela (o alerta de maior gravidade).</summary>
public sealed record AlertaMensagem(string Id, string Texto, AlertaGravidade Gravidade, MsgTipo Tipo, int CountOutros);

public static class CatalogoAlertas
{
    /// <summary>
    /// Catálogo v2 — 16 alertas. Spec v2 (Flávio 04/07) removeu Combustível Baixo (os 2,
    /// sem medição de combustível) e Motor Esfriando (virou a chuva térmica azul, §12).
    /// Os outros 6 removidos da spec (Óleo Quente, Escape Quente, Detonação, Roda Travou,
    /// Freio Quente, Pista Suja) nunca foram portados pro .exe — não existiam aqui.
    /// </summary>
    public static readonly IReadOnlyDictionary<string, Alerta> Todos = new Dictionary<string, Alerta>
    {
        // Super crítico (8)
        ["MOTOR_AQUECENDO"]           = new("MOTOR_AQUECENDO", "Temperatura Motor Subindo", AlertaGravidade.Super),
        ["MOTOR_QUENTE"]              = new("MOTOR_QUENTE", "Motor Quente", AlertaGravidade.Super),
        ["OLEO_BAIXO"]                = new("OLEO_BAIXO", "Óleo Baixo", AlertaGravidade.Super),
        ["PNEU_AQUECENDO"]            = new("PNEU_AQUECENDO", "Pneu Aquecendo", AlertaGravidade.Super),
        ["PRESSAO_PNEU"]              = new("PRESSAO_PNEU", "Pressão Pneu", AlertaGravidade.Super),
        ["PNEU_QUENTE"]               = new("PNEU_QUENTE", "Pneu Quente", AlertaGravidade.Super),
        ["CAMBIO_AQUECENDO"]          = new("CAMBIO_AQUECENDO", "Câmbio Aquecendo", AlertaGravidade.Super),
        ["CAMBIO_QUENTE"]             = new("CAMBIO_QUENTE", "Câmbio Quente", AlertaGravidade.Super),
        // Crítico (3)
        ["MISTURA_POBRE"]             = new("MISTURA_POBRE", "Mistura Pobre", AlertaGravidade.Critico),
        ["SEM_DADOS"]                 = new("SEM_DADOS", "Desconectou", AlertaGravidade.Critico),
        ["FALHANDO"]                  = new("FALHANDO", "Falha Cilindros", AlertaGravidade.Critico),
        // Atenção (2)
        ["MISTURA_RICA"]              = new("MISTURA_RICA", "Mistura Rica", AlertaGravidade.Atencao),
        ["BATERIA"]                   = new("BATERIA", "Bateria", AlertaGravidade.Atencao),
        // Informação (3)
        ["BOX"]                       = new("BOX", "Box", AlertaGravidade.Info),
        ["ULTIMA_VOLTA"]              = new("ULTIMA_VOLTA", "Última Volta", AlertaGravidade.Info),
        ["SEM_GPS"]                   = new("SEM_GPS", "Sem GPS", AlertaGravidade.Info),
    };

    /// <summary>Ids automáticos que avaliarT4000 pode gerar (pra o _set substituir só esses).</summary>
    public static readonly IReadOnlyList<string> Automaticos = new[]
    {
        "MOTOR_AQUECENDO", "MOTOR_QUENTE",
        "OLEO_BAIXO", "MISTURA_POBRE", "MISTURA_RICA", "FALHANDO", "BATERIA",
        "PNEU_AQUECENDO", "PNEU_QUENTE", "PRESSAO_PNEU",
        "CAMBIO_AQUECENDO", "CAMBIO_QUENTE",
    };

    /// <summary>
    /// Avalia uma amostra do motor e devolve os ids de alerta ativos.
    /// Sensor ausente (null) NÃO dispara nada (port fiel do typeof===number do JS).
    /// </summary>
    public static List<string> AvaliarT4000(AmostraAlerta s, AlertaLimites? limits = null)
    {
        var l = limits ?? AlertaLimites.Default;
        var ativos = new List<string>();
        if (s is null) return ativos;

        // Carro "sob carga"? (motor puxando). Pós-spec v2 cada alerta tem seu gate:
        // Pobre = giro≥3500 OU tps≥50; Rica = giro>3000 E tps>40 (carga real); Bateria =
        // gate antigo (giro≥3000 OU tps≥15). Segurança (água, óleo) NÃO depende disto.
        var cargaPobre = (s.Rpm is { } rp && rp >= l.PobreCargaRpmMin)
                      || (s.TpsPct is { } tpp && tpp >= l.PobreCargaTpsMin);
        var cargaRica = (s.Rpm is { } rr && rr > l.RicaCargaRpmMin)
                     && (s.TpsPct is { } trr && trr > l.RicaCargaTpsMin);
        var cargaBateria = (s.Rpm is { } rb && rb >= l.CargaRpmMin)
                        || (s.TpsPct is { } tb && tb >= l.CargaTpsPctMin);

        // Motor (água da refrigeração) — sempre vale (superaquece parado também).
        // "Temperatura Motor Subindo" (aquecendo) fixo saiu na Fase 1 (spec v2, Flávio 04/07);
        // volta como IA de padrão histórico na Fase 2. Aqui só o QUENTE fixo (Bubi opera frio, 70).
        if (s.WaterTempC is { } water && water >= l.WaterMaxC) ativos.Add("MOTOR_QUENTE");

        // Óleo — BIT de alarme em QUALQUER rpm (spec v2: gate de rpm removido; NÃO é valor de
        // pressão). A salvaguarda de PARTIDA (suprime o pico dos ~2s ao ligar) vem no bloco 2b.
        if (s.BaixaPressaoOleo == true) ativos.Add("OLEO_BAIXO");

        // Lambda (mistura) — só com leitura FISICAMENTE plausível (0.3–1.6). Lambda 0.0 (ou fora
        // da faixa) = sonda WB ausente/em falha, NÃO 0.0 de mistura — nunca dispara falso (§9;
        // M3 da auditoria 2026-07-02). Pobre e rica têm gates de carga distintos (spec v2).
        if (s.Lambda is { } lambda && lambda is >= 0.3 and <= 1.6)
        {
            if (cargaPobre && lambda > l.LambdaPobre) ativos.Add("MISTURA_POBRE");
            if (cargaRica  && lambda < l.LambdaRica)  ativos.Add("MISTURA_RICA");
        }

        // Cilindros desbalanceados → FALHANDO
        if (s.FuelInjectionBalanced == false) ativos.Add("FALHANDO");

        // Bateria — só sob carga (em marcha lenta/parado cai sozinha)
        if (cargaBateria && s.BatteryV is { } bat && bat < l.BatteryMinV) ativos.Add("BATERIA");

        // Combustível: os 2 alertas SAÍRAM na spec v2 (Flávio 04/07) — não há medição real de
        // combustível na injeção, nunca teriam base. Os bits do T4000 continuam sendo lidos em
        // AmostraAlerta (plumbing do parser), mas não levantam mais alerta.

        // Pneu / câmbio (sensores a instalar)
        if (s.TireTempC is { } tt && tt > l.TireTempMaxC) ativos.Add("PNEU_QUENTE");
        if (s.CambioTempC is { } ct && ct > l.CambioTempMaxC) ativos.Add("CAMBIO_QUENTE");

        return ativos;
    }
}

/// <summary>
/// Orquestrador: mantém o conjunto de alertas ativos e entrega a mensagem de
/// maior gravidade pra tela. Port fiel da classe AlertasCriticos do JS
/// (ingestT4000 / getAtivos com ordem de gravidade + estágio / getMensagemPrincipal).
/// </summary>
public sealed class AlertasCriticos
{
    private readonly AlertaLimites _limits;
    private readonly HashSet<string> _ativos = new();
    private readonly HashSet<string> _manuais = new();

    public AlertasCriticos(AlertaLimites? limits = null) => _limits = limits ?? AlertaLimites.Default;

    // Estado temporal da histerese (bloco 2b). _ligadoDesdeT = instante em que o motor
    // passou a rodar continuamente (pra suprimir o pico de óleo da partida). _ricaDesdeT =
    // instante em que a mistura rica começou (pra exigir ≥1s de persistência).
    private double? _ligadoDesdeT;
    private double? _ricaDesdeT;

    /// <summary>Ingere uma amostra. Passe <paramref name="tSeg"/> (relógio monotônico em
    /// segundos) pra ligar a histerese temporal do óleo e da mistura rica (bloco 2b); sem
    /// ele, avalia cru por amostra (comportamento antigo).</summary>
    public void IngestT4000(AmostraAlerta sample, double? tSeg = null)
    {
        var ids = CatalogoAlertas.AvaliarT4000(sample, _limits);
        if (tSeg is { } t) AplicarHisterese(ids, sample, t);
        Set(ids);
    }

    // Filtra os ids crus pela histerese temporal (spec v2, bloco 2b). Óleo: alarma só depois
    // de ~2s de motor rodando (o pico da partida some; depois é instantâneo em qualquer rpm,
    // sem atrasar alarme real na pista). Rica: exige ≥1s contínuo de mistura rica.
    private void AplicarHisterese(List<string> ids, AmostraAlerta s, double t)
    {
        var ligado = s.Rpm is { } rpm && rpm >= _limits.MotorLigadoRpmMin;
        if (ligado) _ligadoDesdeT ??= t; else _ligadoDesdeT = null;
        var passouDaPartida = _ligadoDesdeT is { } d && t - d >= _limits.OleoPartidaSupressaoS;
        if (!passouDaPartida) ids.Remove("OLEO_BAIXO");

        if (ids.Contains("MISTURA_RICA"))
        {
            _ricaDesdeT ??= t;
            if (t - _ricaDesdeT.Value < _limits.RicaPersistenciaMinS) ids.Remove("MISTURA_RICA");
        }
        else _ricaDesdeT = null;
    }

    public void RaiseManual(string id) { _manuais.Add(id); _ativos.Add(id); }
    public void ClearManual(string id) { _manuais.Remove(id); _ativos.Remove(id); }

    /// <summary>Ativos em ordem de gravidade; desempate pelo estágio pior (QUENTE antes de AQUECENDO).</summary>
    public IReadOnlyList<string> GetAtivos()
    {
        return _ativos
            .OrderBy(id => OrdemGravidade(id))
            .ThenBy(id => Estagio(id))
            .ToList();
    }

    /// <summary>O alerta de maior gravidade pra tela (ou null).</summary>
    public AlertaMensagem? GetMensagemPrincipal()
    {
        var ativos = GetAtivos();
        if (ativos.Count == 0) return null;
        if (!CatalogoAlertas.Todos.TryGetValue(ativos[0], out var a)) return null;
        var tipo = a.Gravidade is AlertaGravidade.Super or AlertaGravidade.Critico
            ? MsgTipo.Grave
            : MsgTipo.Comunicacao;
        return new AlertaMensagem(a.Id, a.Texto, a.Gravidade, tipo, ativos.Count - 1);
    }

    // ── internos ──

    private void Set(List<string> ids)
    {
        // Substitui só os automáticos conhecidos; não mexe nos manuais.
        foreach (var id in CatalogoAlertas.Automaticos)
        {
            var deveria = ids.Contains(id);
            var ja = _ativos.Contains(id);
            if (deveria && !ja) _ativos.Add(id);
            else if (!deveria && ja && !_manuais.Contains(id)) _ativos.Remove(id);
        }
    }

    private static int OrdemGravidade(string id) =>
        CatalogoAlertas.Todos.TryGetValue(id, out var a)
            ? a.Gravidade switch
            {
                AlertaGravidade.Super   => 0,
                AlertaGravidade.Critico => 1,
                AlertaGravidade.Atencao => 2,
                _                       => 3,
            }
            : 3;

    private static int Estagio(string id) => id switch
    {
        "MOTOR_QUENTE" => 0, "MOTOR_AQUECENDO" => 1,
        "PNEU_QUENTE" => 0, "PNEU_AQUECENDO" => 1,
        "CAMBIO_QUENTE" => 0, "CAMBIO_AQUECENDO" => 1,
        _ => 9,
    };
}
