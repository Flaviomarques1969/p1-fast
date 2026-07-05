// AprendizadoTemperatura — a "parte inteligente" da Fase 2 (spec Flávio 05/07/2026).
//
// Em vez de um número-limite FIXO, aprende a temperatura NORMAL do carro e avisa
// quando ela sobe fora do padrão. O mesmo modelo serve pra QUALQUER canal de
// temperatura (água do motor — ativo hoje; pneu e câmbio — preparados, ligam com
// o sensor). Princípios da spec:
//   1. APRENDIZADO CONTÍNUO — aprende o tempo todo, sem número fixo de voltas;
//      nunca "trava" (cada amostra válida continua ensinando).
//   2. HISTÓRICO GRAVADO — o estado aprendido é exportável/importável (memória do
//      que é normal naquele carro), pra sobreviver entre sessões.
//   3. PADRÃO DE REFERÊNCIA — uma "máxima normal" semente (ex.: 62°C do Bubi) de
//      onde a inteligência parte antes de ter histórico suficiente.
//   4. AJUSTE PELA TEMPERATURA DO AMBIENTE — o aprendizado contínuo já embute o dia
//      quente/frio (a máxima normal sobe/desce com o dia). Um offset explícito
//      (AmbienteOffsetC) fica PREPARADO pra quando houver sensor/entrada de ambiente.
//
// Como decide "normal x fora do normal":
//   • máxima normal = envelope superior lento da temperatura em operação (sobe
//     devagar rumo a novos picos normais — τSobe; esquece mais devagar ainda —
//     τDesce). NÃO aprende amostras no teto de segurança (superaquecimento real
//     não vira "normal").
//   • dispara "subindo" quando a temperatura fica ACIMA de (máxima normal + delta,
//     default +3°C) de forma CONSISTENTE (persistência ≥ N s) — não por um pico.
//   • a trava dura de segurança (ex.: Motor Quente a 70°C) é independente e mora no
//     AvaliarT4000; aqui é só o AVISO ANTECIPADO relativo ao padrão do carro.
//
// Tudo é parâmetro (AprendizadoConfig) — nada de número cravado no código. Função
// pura de estado encapsulado (persistência via Exportar/ImportarEstado), igual ao
// padrão dos outros aprendizes do cérebro (web/cockpit/aprendizado-tempo-passagem.js).

namespace P1Fast.Cockpit.Domain;

/// <summary>Parâmetros calibráveis do aprendiz de um canal de temperatura. Default = Bubi/motor.</summary>
public sealed record AprendizadoConfig(
    // Semente da "máxima normal" antes de ter histórico (padrão de referência, princípio 3).
    // Bubi (água): 62°C — a máxima normal do exemplo do Flávio (avisa a 65, quente a 70).
    double ReferenciaMaximaNormalC,
    // Quantos °C acima da máxima normal aprendida dispara "subindo" (princípio do +3°C).
    double DeltaSubindoC = 3.0,
    // Piso do limite de disparo: o limite nunca cai abaixo disto (evita alarme absurdamente
    // baixo se o aprendizado enxergar um dia muito frio). 0 = sem piso.
    double PisoLimiteC = 0.0,
    // Teto de aprendizado: amostras >= isto NÃO entram na "máxima normal" (superaquecimento
    // real não pode se ensinar como normal). Em geral = a trava dura de segurança do canal.
    double TetoAprendidoC = double.PositiveInfinity,
    // Tempo (s) pra aprender uma máxima normal MAIS ALTA (envelope subindo) quando o aprendizado
    // JÁ está maduro. Alto o bastante pra um pico de 3-5s quase não mexer.
    double TauSobeS = 30.0,
    // Tempo (s) MÍNIMO do envelope subindo enquanto o aprendizado é imaturo (confiança baixa). O τ
    // efetivo cresce de TauSobeMinS até TauSobeS conforme a confiança sobe — assim o carro "trava"
    // rápido no normal do DIA no começo da sessão (sem alarme falso de largada), e fica estável
    // depois pra pegar subida real. Sem número fixo de voltas; nunca trava o aprendizado.
    double TauSobeMinS = 2.0,
    // Tempo (s) pra "esquecer" (baixar) a máxima normal. Bem mais lento — um trecho frio não
    // derruba o padrão a ponto de dar alarme falso na sessão seguinte.
    double TauDesceS = 300.0,
    // Segundos contínuos ACIMA do limite pra confirmar "subindo" (ignora pico transitório).
    double PersistSubindoS = 3.0,
    // Amostras válidas pra "confiança plena" (informativo — pra UI/telemetria; NÃO trava o disparo,
    // que sempre tem a semente de referência por trás).
    double AmostrasConfianca = 300.0,
    // Ajuste por temperatura de ambiente (°C somados ao limite). 0 = neutro/desligado — hoje o
    // carro não tem sensor de ambiente; fica preparado.
    double AmbienteOffsetC = 0.0
)
{
    /// <summary>Default do canal ÁGUA DO MOTOR (Bubi). Teto = Motor Quente (70°C) é ligado no
    /// construtor do AlertasCriticos, pra acompanhar WaterMaxC sem duplicar o número.</summary>
    public static AprendizadoConfig MotorBubi { get; } = new(ReferenciaMaximaNormalC: 62.0, TetoAprendidoC: 70.0);
}

/// <summary>Resultado de uma avaliação do aprendiz (o que a inteligência "acha" agora).</summary>
public readonly record struct AprendizadoResultado(
    bool Subindo,          // true = temperatura acima do padrão de forma consistente (dispara o aviso)
    double LimiteC,        // limite atual de disparo (máxima normal + delta + ambiente, com piso)
    double MaximaNormalC,  // a máxima normal aprendida agora
    double Confianca       // 0..1 — quão maduro está o aprendizado
);

/// <summary>Estado persistível do aprendiz (a "história gravada" — princípio 2).</summary>
public sealed record AprendizadoEstado(int Versao, double MaximaNormalC, double Amostras);

/// <summary>
/// Aprendiz contínuo de um canal de temperatura. Sem estado global, sem número fixo de
/// voltas: cada <see cref="Avaliar"/> ensina e decide. Reusa o padrão dos aprendizes do
/// cérebro (estado encapsulado + Exportar/Importar).
/// </summary>
public sealed class AprendizadoTemperatura
{
    private readonly AprendizadoConfig _cfg;
    private double _maxNormal;
    private double _amostras;
    private double? _lastT;
    private double? _acimaDesdeT;

    public AprendizadoTemperatura(AprendizadoConfig? cfg = null)
    {
        _cfg = cfg ?? AprendizadoConfig.MotorBubi;
        _maxNormal = _cfg.ReferenciaMaximaNormalC;
    }

    /// <summary>Máxima normal aprendida agora (°C).</summary>
    public double MaximaNormalC => _maxNormal;

    /// <summary>Confiança 0..1 do aprendizado (informativo).</summary>
    public double Confianca => Math.Min(1.0, _amostras / Math.Max(1.0, _cfg.AmostrasConfianca));

    /// <summary>Limite atual de disparo do aviso "subindo" (°C).</summary>
    public double LimiteSubindoC => Math.Max(_cfg.PisoLimiteC, _maxNormal + _cfg.DeltaSubindoC + _cfg.AmbienteOffsetC);

    /// <summary>
    /// Ensina com a amostra e decide se está "subindo". <paramref name="tempC"/> null (sensor
    /// ausente) ou <paramref name="motorRodando"/> false → não aprende e não dispara (mas
    /// PRESERVA a máxima normal já aprendida — é a história do carro). <paramref name="t"/> =
    /// relógio monotônico em segundos (mesmo do AlertasCriticos).
    /// </summary>
    public AprendizadoResultado Avaliar(double? tempC, bool motorRodando, double t)
    {
        if (tempC is not { } w || !motorRodando)
        {
            _acimaDesdeT = null;   // quebrou a sequência de "acima"
            _lastT = t;
            return new AprendizadoResultado(false, LimiteSubindoC, _maxNormal, Confianca);
        }

        var limite = LimiteSubindoC;

        // Persistência: só confirma "subindo" depois de ≥ PersistSubindoS contínuos acima.
        bool subindo;
        if (w >= limite)
        {
            _acimaDesdeT ??= t;
            subindo = t - _acimaDesdeT.Value >= _cfg.PersistSubindoS;
        }
        else { _acimaDesdeT = null; subindo = false; }

        // Aprendizado contínuo (envelope de dois ritmos), só abaixo do teto de segurança —
        // superaquecimento real (que a trava dura pega) não vira "normal". Baseado no tempo
        // decorrido (τ), então é robusto à taxa de amostragem.
        if (w < _cfg.TetoAprendidoC)
        {
            var dt = _lastT is { } last ? Math.Max(0.0, t - last) : 0.0;
            if (dt > 0.0)
            {
                var tau = w > _maxNormal ? _cfg.TauSobeS : _cfg.TauDesceS;
                var alfa = tau > 0.0 ? 1.0 - Math.Exp(-dt / tau) : 1.0;
                _maxNormal += alfa * (w - _maxNormal);
            }
            _amostras += 1;
        }

        _lastT = t;
        return new AprendizadoResultado(subindo, limite, _maxNormal, Confianca);
    }

    /// <summary>Exporta o estado aprendido pra persistir entre sessões (princípio 2).</summary>
    public AprendizadoEstado ExportarEstado() => new(1, _maxNormal, _amostras);

    /// <summary>Importa estado persistido (idempotente; substitui o atual). Zera os relógios
    /// transitórios (persistência/último t) — a máxima normal e a contagem seguem.</summary>
    public void ImportarEstado(AprendizadoEstado? estado)
    {
        if (estado is { } e && double.IsFinite(e.MaximaNormalC))
        {
            _maxNormal = e.MaximaNormalC;
            _amostras = double.IsFinite(e.Amostras) && e.Amostras >= 0 ? e.Amostras : 0;
        }
        _lastT = null;
        _acimaDesdeT = null;
    }

    /// <summary>Reseta pro padrão de referência (ex.: trocou config mecânica/refrigeração do carro).</summary>
    public void Reset()
    {
        _maxNormal = _cfg.ReferenciaMaximaNormalC;
        _amostras = 0;
        _lastT = null;
        _acimaDesdeT = null;
    }
}
