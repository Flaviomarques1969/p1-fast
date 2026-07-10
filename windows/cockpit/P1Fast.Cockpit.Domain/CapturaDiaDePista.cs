// CapturaDiaDePista — o CÉREBRO ÚNICO do dia de pista.
//
// Antes, três coisas viviam soltas em programas diferentes:
//   (1) o console de captura lia a USB, GRAVAVA em disco e mandava pra nuvem;
//   (2) a tela do piloto (WinUI) ACENDIA, mas em modo demonstração;
//   (3) ninguém ligava (1) a (2) ao vivo.
//
// Esta peça costura tudo num feed só: cada amostra de motor (pela USB) e cada
// ponto de GPS entram aqui UMA vez e, ao mesmo tempo:
//   • GRAVAM em disco à prova de queda — começando e parando sozinho por
//     movimento (captura automática: anda = pista = grava; parou = box = fecha);
//   • ACENDEM o painel do piloto (luz de marcha, curva, bolinha do ápice, coach,
//     alertas), pelo CockpitState que a tela observa;
//   • são MANDADAS pra nuvem (o que foi gravado), via um publicador injetável.
//
// É domínio puro (sem Windows): a tela (WinUI) e o console de captura usam a MESMA
// instância — a tela só observa o CockpitState que este maestro muta. Provado por
// teste aqui fora do carro (CapturaDiaDePistaTests).

namespace P1Fast.Cockpit.Domain;

public sealed class CapturaDiaDePista
{
    private readonly SessionRecorder _gravador;
    private readonly CockpitOrchestrator _painel;
    private readonly Action<T3000Sample, long>? _publicarNuvem;

    public CapturaDiaDePista(
        SessionRecorder gravador,
        CockpitOrchestrator painel,
        Action<T3000Sample, long>? publicarNuvem = null)
    {
        _gravador = gravador ?? throw new ArgumentNullException(nameof(gravador));
        _painel = painel ?? throw new ArgumentNullException(nameof(painel));
        _publicarNuvem = publicarNuvem;
    }

    /// <summary>Converte a amostra crua do motor (T3000) nos sinais que os alertas
    /// pedem — o mapeamento CANÔNICO (L6: era divergente do ao vivo; agora o
    /// MainWindow.Live.BridgeMotor delega pra cá — UMA ponte só, mesma do replay
    /// provado: tpsPct, guarda M3 da sonda, alarmes de combustível). Sensor que não
    /// existe (pneu/câmbio) fica null — regra dura: alerta falso NUNCA dispara.</summary>
    public static AmostraAlerta AlertaDeSample(T3000Sample s)
    {
        bool? Alm(string k) => s.Alarmes is not null && s.Alarmes.TryGetValue(k, out var v) ? v : (bool?)null;
        return new AmostraAlerta
        {
            Rpm        = s.Rpm,
            WaterTempC = s.WaterTempC.HasValue ? (double?)s.WaterTempC.Value : null,
            TpsPct     = s.TpsPct,   // TPS % (gate de "sob carga") — mesmo campo do replay (tpsPct)
            // M3: sonda WB ausente/desconectada lê 0 (ou fora do físico 0.3–1.6) — NÃO é
            // mistura 0.0; vira null (sem dado) pra NÃO disparar MISTURA RICA falsa (§9).
            Lambda     = (s.LambdaWBRaw == 0 || s.Lambda < 0.3 || s.Lambda > 1.6) ? (double?)null : s.Lambda,
            BatteryV   = s.BatteryV,
            FuelInjectionBalanced   = s.FuelInjectionBalanced,
            BaixaPressaoOleo        = Alm("baixaPressaoOleo"),
            AlertaNivelCombustivel  = Alm("alertaNivelCombustivel"),
            BaixaPressaoCombustivel = Alm("baixaPressaoCombustivel"),
        };
    }

    /// <summary>Uma amostra de motor (T3000 pela USB). Acende o painel SEMPRE (mesmo
    /// parado no box a tela mostra o motor); GRAVA e PUBLICA só quando a captura
    /// automática está gravando (na pista) — marcha lenta no box não vira sessão.</summary>
    public void Motor(T3000Sample s)
    {
        // TMono vem em MILISSEGUNDOS (Stopwatch do leitor T3000); o contrato do maestro é
        // SEGUNDOS (histerese 2b do óleo/rica + Onda 7). Converte na fiação — o Domain fica em s.
        _painel.IngestMotor(s.Rpm, AlertaDeSample(s), s.TMono / 1000.0);   // tela ao vivo, sempre (TMono ms → s)
        var reg = _gravador.Motor(s);                            // grava (respeita o auto por movimento)
        if (reg is not null) _publicarNuvem?.Invoke(s, reg.TWall); // nuvem só do que foi gravado
    }

    /// <summary>Um ponto de GPS. Dirige a captura automática (liga/desliga por
    /// movimento), grava na sessão, e atualiza curva/bolinha/coach no painel.</summary>
    public void Gps(AmostraGps g)
    {
        _gravador.Gps(g, velKmh: g.Kmh);   // grava + liga/desliga sozinho pela velocidade
        _painel.IngestGps(g);              // curva atual + bolinha do ápice + coach
    }

    /// <summary>Vigia ~1x/s: encerra a sessão por silêncio (carro desligou) ou por
    /// parado no box. Devolve o resumo quando fecha; null caso contrário.</summary>
    public SessionResumo? Tick() => _gravador.Tick();

    /// <summary>Estado vivo da gravação — pra tela: "GRAVANDO na pista" x "EM ESPERA box".</summary>
    public SessionEstado Estado => _gravador.Estado();
}
