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
    double WaterPredictivoC = 70,  // MOTOR AQUECENDO
    double WaterMaxC        = 80,  // MOTOR QUENTE (Bubi opera frio)
    double OilPressRpmMin   = 2000,
    double LambdaPobre      = 1.15,
    double LambdaRica       = 0.80,
    double BatteryMinV      = 11.8,
    double TireTempMaxC     = 120,
    double CambioTempMaxC   = 140,
    // Gate de "carro sob carga" (achado do dado real 21/06, NÃO está no JS):
    // mistura e bateria só fazem sentido com o motor puxando. Em marcha lenta a
    // lambda nada lê (corte de combustível = pobre falso) e a bateria cai sozinha.
    // Default Bubi vindo do split real (andando = rpm>=3000; parado nunca).
    double CargaRpmMin      = 3000,
    double CargaTpsPctMin   = 15
)
{
    public static AlertaLimites Default { get; } = new();
}

/// <summary>Mensagem principal pra tela (o alerta de maior gravidade).</summary>
public sealed record AlertaMensagem(string Id, string Texto, AlertaGravidade Gravidade, MsgTipo Tipo, int CountOutros);

public static class CatalogoAlertas
{
    /// <summary>Catálogo v2 — 19 alertas (port fiel do ALERTAS do JS).</summary>
    public static readonly IReadOnlyDictionary<string, Alerta> Todos = new Dictionary<string, Alerta>
    {
        // Super crítico (9)
        ["MOTOR_AQUECENDO"]           = new("MOTOR_AQUECENDO", "MOTOR AQUECENDO", AlertaGravidade.Super),
        ["MOTOR_QUENTE"]              = new("MOTOR_QUENTE", "MOTOR QUENTE", AlertaGravidade.Super),
        ["OLEO_BAIXO"]                = new("OLEO_BAIXO", "ÓLEO BAIXO", AlertaGravidade.Super),
        ["COMBUSTIVEL_BAIXO_CRITICO"] = new("COMBUSTIVEL_BAIXO_CRITICO", "COMBUSTÍVEL BAIXO", AlertaGravidade.Super),
        ["PNEU_AQUECENDO"]            = new("PNEU_AQUECENDO", "PNEU AQUECENDO", AlertaGravidade.Super),
        ["PRESSAO_PNEU"]              = new("PRESSAO_PNEU", "PRESSÃO PNEU", AlertaGravidade.Super),
        ["PNEU_QUENTE"]               = new("PNEU_QUENTE", "PNEU QUENTE", AlertaGravidade.Super),
        ["CAMBIO_AQUECENDO"]          = new("CAMBIO_AQUECENDO", "CÂMBIO AQUECENDO", AlertaGravidade.Super),
        ["CAMBIO_QUENTE"]             = new("CAMBIO_QUENTE", "CÂMBIO QUENTE", AlertaGravidade.Super),
        // Crítico (3)
        ["MOTOR_ESFRIANDO"]           = new("MOTOR_ESFRIANDO", "MOTOR ESFRIANDO", AlertaGravidade.Critico),
        ["MISTURA_POBRE"]             = new("MISTURA_POBRE", "MISTURA POBRE", AlertaGravidade.Critico),
        ["SEM_DADOS"]                 = new("SEM_DADOS", "SEM DADOS", AlertaGravidade.Critico),
        // Atenção (4)
        ["COMBUSTIVEL_BAIXO"]         = new("COMBUSTIVEL_BAIXO", "COMBUSTÍVEL BAIXO", AlertaGravidade.Atencao),
        ["MISTURA_RICA"]              = new("MISTURA_RICA", "MISTURA RICA", AlertaGravidade.Atencao),
        ["FALHANDO"]                  = new("FALHANDO", "FALHANDO", AlertaGravidade.Atencao),
        ["BATERIA"]                   = new("BATERIA", "BATERIA", AlertaGravidade.Atencao),
        // Informação (3)
        ["BOX"]                       = new("BOX", "BOX", AlertaGravidade.Info),
        ["ULTIMA_VOLTA"]              = new("ULTIMA_VOLTA", "ÚLTIMA VOLTA", AlertaGravidade.Info),
        ["SEM_GPS"]                   = new("SEM_GPS", "SEM GPS", AlertaGravidade.Info),
    };

    /// <summary>Ids automáticos que avaliarT4000 pode gerar (pra o _set substituir só esses).</summary>
    public static readonly IReadOnlyList<string> Automaticos = new[]
    {
        "MOTOR_AQUECENDO", "MOTOR_QUENTE", "MOTOR_ESFRIANDO",
        "OLEO_BAIXO", "MISTURA_POBRE", "MISTURA_RICA", "FALHANDO", "BATERIA",
        "COMBUSTIVEL_BAIXO", "COMBUSTIVEL_BAIXO_CRITICO",
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

        // Carro "sob carga"? (motor puxando). Mistura e bateria só valem aqui —
        // em marcha lenta/parado dão alarme falso (provado no dado real de 21/06).
        // Segurança (motor quente, óleo) NÃO depende disto: vale parado também.
        var sobCarga = (s.Rpm is { } r && r >= l.CargaRpmMin)
                    || (s.TpsPct is { } tp && tp >= l.CargaTpsPctMin);

        // Motor (água da refrigeração) — sempre vale (superaquece parado também)
        if (s.WaterTempC is { } water)
        {
            if (water >= l.WaterMaxC) ativos.Add("MOTOR_QUENTE");
            else if (water >= l.WaterPredictivoC) ativos.Add("MOTOR_AQUECENDO");
        }

        // Óleo — BIT de alarme + rpm > 2000 (NÃO valor de pressão) — sempre vale
        if (s.BaixaPressaoOleo == true && s.Rpm is { } rpm && rpm > l.OilPressRpmMin)
            ativos.Add("OLEO_BAIXO");

        // Lambda (mistura) — só sob carga
        if (sobCarga && s.Lambda is { } lambda)
        {
            if (lambda > l.LambdaPobre) ativos.Add("MISTURA_POBRE");
            if (lambda < l.LambdaRica)  ativos.Add("MISTURA_RICA");
        }

        // Cilindros desbalanceados → FALHANDO
        if (s.FuelInjectionBalanced == false) ativos.Add("FALHANDO");

        // Bateria — só sob carga (em marcha lenta/parado cai sozinha)
        if (sobCarga && s.BatteryV is { } bat && bat < l.BatteryMinV) ativos.Add("BATERIA");

        // Combustível (bits): nível + baixa pressão = crítico; nível só = atenção
        if (s.AlertaNivelCombustivel == true)
            ativos.Add(s.BaixaPressaoCombustivel == true ? "COMBUSTIVEL_BAIXO_CRITICO" : "COMBUSTIVEL_BAIXO");

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

    public void IngestT4000(AmostraAlerta sample) => Set(CatalogoAlertas.AvaliarT4000(sample, _limits));

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
        "COMBUSTIVEL_BAIXO_CRITICO" => 0,
        _ => 9,
    };
}
