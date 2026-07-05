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
    // Teto do intervalo entre amostras usado no aprendizado (s). Uma pausa longa (parada no box,
    // motor religado, buraco na captura) NÃO pode virar um salto no padrão — sem isso, dt gigante
    // faria a máxima normal pular pra uma leitura de box frio e dar alarme falso na volta seguinte.
    double DtMaxS = 5.0,
    // Ajuste MANUAL/externo de ambiente (°C somados ao limite). 0 = neutro. Fica pra sensor futuro
    // ou entrada externa; soma com o offset dinâmico da água pré-ignição (abaixo).
    double AmbienteOffsetC = 0.0,
    // --- Item 3 (decisão Flávio 05/07): água ANTES de ligar o motor = referência do ambiente ---
    // Liga o uso da água pré-ignição (partida a frio do dia) como referência do ambiente.
    bool AmbienteUsarAguaPreIgnicao = false,
    // Água parada "de referência" (°C) em que os defaults foram pensados. Quanto o dia desvia disto
    // desloca o limite (dia mais quente → limite um pouco mais alto; mais frio → mais baixo).
    double AmbienteBaseC = 30.0,
    // Fração do desvio de ambiente que vira offset (conservador; calibrar com dado real do Bubi).
    double AmbienteFator = 0.5,
    // Teto do |offset| de ambiente (°C) — nunca desloca demais.
    double AmbienteOffsetMaxC = 6.0,
    // Só aceita a água pré-ignição como "ambiente" se estiver abaixo disto (evita usar água QUENTE
    // de box numa religada como se fosse o ambiente). Acima → offset de ambiente = 0.
    double AmbienteTetoFrioC = 45.0,
    // Margem (°C) que o aviso "subindo" fica ABAIXO da trava dura (TetoAprendido/Motor Quente): o
    // aviso antecipado nunca pode subir até o ponto do Motor Quente, senão some. 0 = sem margem.
    double MargemAbaixoTetoC = 2.0
)
{
    /// <summary>Default do canal ÁGUA DO MOTOR (Bubi). Teto = Motor Quente (70°C) é ligado no
    /// construtor do AlertasCriticos, pra acompanhar WaterMaxC sem duplicar o número.</summary>
    public static AprendizadoConfig MotorBubi { get; } = new(
        ReferenciaMaximaNormalC: 62.0, TetoAprendidoC: 70.0, AmbienteUsarAguaPreIgnicao: true);
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
    private bool _motorJaLigou;         // já houve ignição nesta sessão? (congela o ambiente do dia)
    private double? _aguaFriaMinC;      // menor água lida ANTES da 1ª ignição (≈ ambiente do dia)
    private double _ambienteOffsetDinC; // offset de ambiente derivado da água pré-ignição (item 3)

    public AprendizadoTemperatura(AprendizadoConfig? cfg = null)
    {
        _cfg = cfg ?? AprendizadoConfig.MotorBubi;
        _maxNormal = _cfg.ReferenciaMaximaNormalC;
    }

    /// <summary>Máxima normal aprendida agora (°C).</summary>
    public double MaximaNormalC => _maxNormal;

    /// <summary>Confiança 0..1 do aprendizado (informativo).</summary>
    public double Confianca => Math.Min(1.0, _amostras / Math.Max(1.0, _cfg.AmostrasConfianca));

    /// <summary>Offset de ambiente atual (°C) derivado da água pré-ignição do dia (item 3).</summary>
    public double AmbienteOffsetDinamicoC => _ambienteOffsetDinC;

    /// <summary>Limite atual de disparo do aviso "subindo" (°C). Soma máxima normal + delta + ambiente
    /// (manual + dinâmico da água pré-ignição), com piso, e SEMPRE abaixo da trava dura por
    /// <see cref="AprendizadoConfig.MargemAbaixoTetoC"/> (o aviso antecipado não pode sumir dentro do Motor Quente).</summary>
    public double LimiteSubindoC
    {
        get
        {
            var bruto = _maxNormal + _cfg.DeltaSubindoC + _cfg.AmbienteOffsetC + _ambienteOffsetDinC;
            var comPiso = Math.Max(_cfg.PisoLimiteC, bruto);
            var teto = _cfg.TetoAprendidoC - _cfg.MargemAbaixoTetoC;
            return double.IsFinite(teto) ? Math.Min(comPiso, teto) : comPiso;
        }
    }

    /// <summary>
    /// Ensina com a amostra e decide se está "subindo". <paramref name="tempC"/> null (sensor
    /// ausente) ou <paramref name="motorRodando"/> false → não aprende e não dispara (mas
    /// PRESERVA a máxima normal já aprendida — é a história do carro). <paramref name="t"/> =
    /// relógio monotônico em segundos (mesmo do AlertasCriticos).
    /// </summary>
    public AprendizadoResultado Avaliar(double? tempC, bool motorRodando, double t)
    {
        // Ambiente do dia (item 3): antes da 1ª ignição, a água PARADA ≈ temperatura do ambiente.
        // Guarda a menor leitura fria vista com o motor desligado.
        if (_cfg.AmbienteUsarAguaPreIgnicao && !_motorJaLigou && !motorRodando && tempC is { } wFrio)
            _aguaFriaMinC = _aguaFriaMinC is { } min ? Math.Min(min, wFrio) : wFrio;

        if (tempC is not { } w || !motorRodando)
        {
            _acimaDesdeT = null;   // quebrou a sequência de "acima"
            _lastT = t;
            return new AprendizadoResultado(false, LimiteSubindoC, _maxNormal, Confianca);
        }

        // 1ª ignição da sessão: congela o offset de ambiente a partir da água fria medida (item 3).
        // Só usa se a água fria for baixa o bastante (senão foi religada com o motor ainda morno).
        if (!_motorJaLigou)
        {
            _motorJaLigou = true;
            if (_cfg.AmbienteUsarAguaPreIgnicao && _aguaFriaMinC is { } fria && fria <= _cfg.AmbienteTetoFrioC)
            {
                var off = (fria - _cfg.AmbienteBaseC) * _cfg.AmbienteFator;
                _ambienteOffsetDinC = Math.Clamp(off, -_cfg.AmbienteOffsetMaxC, _cfg.AmbienteOffsetMaxC);
            }
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
            // Teto no dt: uma pausa longa não vira salto no padrão (box, religada, buraco na captura).
            var dt = _lastT is { } last ? Math.Min(_cfg.DtMaxS, Math.Max(0.0, t - last)) : 0.0;
            if (dt > 0.0)
            {
                // Envelope subindo: τ efetivo cresce com a confiança (rápido imaturo → estável maduro).
                // Descendo: sempre lento (não esquecer o normal a ponto de dar alarme falso depois).
                var tau = w > _maxNormal
                    ? Math.Max(_cfg.TauSobeMinS, _cfg.TauSobeS * Confianca)
                    : _cfg.TauDesceS;
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
        // O ambiente é do DIA, não da história: recomeça a medir a água fria na nova sessão.
        _motorJaLigou = false;
        _aguaFriaMinC = null;
        _ambienteOffsetDinC = 0.0;
    }

    /// <summary>Reseta pro padrão de referência (ex.: trocou config mecânica/refrigeração do carro).</summary>
    public void Reset()
    {
        _maxNormal = _cfg.ReferenciaMaximaNormalC;
        _amostras = 0;
        _lastT = null;
        _acimaDesdeT = null;
        _motorJaLigou = false;
        _aguaFriaMinC = null;
        _ambienteOffsetDinC = 0.0;
    }
}
