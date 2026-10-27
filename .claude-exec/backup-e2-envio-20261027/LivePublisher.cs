// LivePublisher — ENVIO AO VIVO do motor pra nuvem, sem perder dado (Fase 3).
//
// Conserta a causa-raiz do "carro só na tela local": hoje, quando a nuvem oscila,
// a amostra é DESCARTADA pra sempre (cloud-bridge.js:120-122). Aqui, quando a nuvem
// cai, a amostra entra numa FILA e é reenviada quando a conexão volta — o app P1 Fast
// e a tela do Command Box recebem TODO o período, não só o tempo online.
//
// Contrato IDÊNTICO ao que o app já consome (web/cockpit/cloud-bridge.js):
//   - canal de produção 'cockpit-bubi-live', evento 'sample', formato broadcast;
//   - payload = o mesmo stripSample (chaves camelCase), pra não quebrar consumidor.
//
// DESENHO PARA TESTE: a lógica viva (throttle, fila, reenvio, trava de produção,
// saúde) mora aqui, pura, provada com um canal-fake. O transporte WebSocket real
// (SupabaseRealtimeChannel) implementa ILiveChannel e é provado na bancada/online.

using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace P1Fast.Cockpit.Domain;

/// <summary>O "fio" pra nuvem — só transporte. Online diz se dá pra mandar agora;
/// PublishAsync devolve true se entregou. Implementação real = WebSocket; fake = testes.</summary>
public interface ILiveChannel
{
    bool Online { get; }
    /// <summary>Publica um evento broadcast (ex.: "sample"/"evento"). True = entregue.</summary>
    Task<bool> PublishAsync(string evento, object payload, CancellationToken cancellationToken);
}

public sealed record LivePublisherConfig(
    int PublishHz = 5,        // mesma taxa do cloud-bridge.js (5 Hz)
    int FilaMax   = 9000)     // ~30 min a 5 Hz; acima disso descarta o MAIS VELHO (conta)
{
    public int PeriodoMs => 1000 / Math.Max(1, PublishHz);
    public static LivePublisherConfig Default { get; } = new();
}

public sealed record LivePublisherStats(
    long Enviadas,
    int  NaFila,
    long Descartadas,   // estouro de fila (perda consciente, contada)
    long Erros,
    long Estranguladas, // puladas pelo throttle (esperado, não é perda)
    long BarradasGuarda // barradas pela trava (sim em produção / fora de faixa)
);

public sealed class LivePublisher
{
    /// <summary>Canal de PRODUÇÃO (o que o app/Command Box assistem). Só pode ser usado
    /// com autorização explícita — senão o publisher nem é construído.</summary>
    public const string CanalProducao = "cockpit-bubi-live";

    private readonly ILiveChannel _canal;
    private readonly string _canalNome;
    private readonly bool _producao;
    private readonly LivePublisherConfig _cfg;
    private readonly Func<long> _agora; // epoch ms

    private readonly Queue<IDictionary<string, object?>> _fila = new();
    private long _ultimoEnfileiradoWall = long.MinValue;
    private long _enviadas, _descartadas, _erros, _estranguladas, _barradas;

    /// <param name="canalNome">Nome do canal. Se for 'cockpit-bubi-live' exige permitirProducao=true.</param>
    /// <param name="permitirProducao">Trava dura: só true quando o Flávio autorizar tocar produção.</param>
    public LivePublisher(
        ILiveChannel canal,
        string canalNome,
        bool permitirProducao = false,
        LivePublisherConfig? config = null,
        Func<long>? agora = null)
    {
        ArgumentNullException.ThrowIfNull(canal);
        if (string.IsNullOrWhiteSpace(canalNome))
            throw new ArgumentException("canal não pode ser vazio", nameof(canalNome));
        if (canalNome == CanalProducao && !permitirProducao)
            throw new InvalidOperationException(
                "Canal de produção 'cockpit-bubi-live' exige autorização explícita (permitirProducao=true). " +
                "Use um canal de teste pra validar.");

        _canal     = canal;
        _canalNome = canalNome;
        _producao  = canalNome == CanalProducao;
        _cfg       = config ?? LivePublisherConfig.Default;
        _agora     = agora ?? (() => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
    }

    public string Canal => _canalNome;
    public bool Producao => _producao;

    public LivePublisherStats GetStats() => new(
        Enviadas: _enviadas, NaFila: _fila.Count, Descartadas: _descartadas,
        Erros: _erros, Estranguladas: _estranguladas, BarradasGuarda: _barradas);

    /// <summary>Saúde pro operador, NUNCA silenciosa.</summary>
    public string Saude()
    {
        if (!_canal.Online) return _fila.Count > 0 ? "offline-enfileirando" : "offline";
        if (_fila.Count > 0) return "online-drenando";
        return "online";
    }

    /// <summary>Recebe uma amostra do motor. Aplica trava + throttle e ENFILEIRA
    /// (não envia aqui — o envio é no Drenar, pra reenviar o acumulado quando voltar).</summary>
    public void Oferecer(T3000Sample sample, long tWallCaptura)
    {
        if (sample is null) return;

        // Trava 1: nunca manda leitura fora de faixa física (defesa em profundidade).
        if (!sample.LeituraPlausivel) { _barradas++; return; }
        // Trava 2: NUNCA injeta dado de simulação no canal de produção (o que todos assistem).
        if (_producao && sample.Source == "sim-replay") { _barradas++; return; }

        // Throttle por tempo de CAPTURA: 5 Hz, igual ao cloud-bridge.js.
        if (_ultimoEnfileiradoWall != long.MinValue &&
            tWallCaptura - _ultimoEnfileiradoWall < _cfg.PeriodoMs)
        {
            _estranguladas++;
            return;
        }
        _ultimoEnfileiradoWall = tWallCaptura;

        // Fila limitada: se encher, descarta o MAIS VELHO (mantém o ao-vivo fresco) e conta.
        while (_fila.Count >= _cfg.FilaMax) { _fila.Dequeue(); _descartadas++; }
        _fila.Enqueue(StripSample(sample, tWallCaptura));
    }

    /// <summary>Drena a fila pra nuvem enquanto online e houver entrega. Se a nuvem
    /// cai no meio, PARA (mantém o resto na fila) — reenvia na próxima chamada.</summary>
    public async Task DrenarAsync(CancellationToken ct)
    {
        if (!_canal.Online) return;
        while (_fila.Count > 0 && !ct.IsCancellationRequested)
        {
            var payload = _fila.Peek();
            bool ok;
            try { ok = await _canal.PublishAsync("sample", payload, ct).ConfigureAwait(false); }
            catch (OperationCanceledException) { throw; }
            catch { _erros++; break; }   // erro de envio: segura na fila, tenta depois

            if (!ok) { _erros++; break; } // nuvem recusou/caiu: mantém na fila
            _fila.Dequeue();
            _enviadas++;
        }
    }

    /// <summary>stripSample fiel (chaves camelCase EXATAS do cloud-bridge.js). tWall = tempo
    /// de CAPTURA (preservado), não o de envio — pra casar com vídeo e ordenar certo.</summary>
    internal static IDictionary<string, object?> StripSample(T3000Sample s, long tWallCaptura) => new Dictionary<string, object?>
    {
        ["source"]               = s.Source,
        ["parserVersion"]        = s.ParserVersion,
        ["tMono"]                = s.TMono,
        ["tWall"]                = tWallCaptura,
        ["bytesLen"]             = s.BytesLen,
        // motor
        ["rpm"]                  = s.Rpm,
        ["batteryV"]             = s.BatteryV,
        ["mapBar"]               = s.MapBar,
        ["tpsPct"]               = s.TpsPct,
        ["tpsTargetPct"]         = s.TpsTargetPct,
        ["airTempC"]             = s.AirTempC,
        ["waterTempC"]           = s.WaterTempC,
        ["lambda"]               = s.Lambda,
        ["mapaAtual"]            = s.MapaAtual,
        ["consumoBorboleta"]     = s.ConsumoBorboleta,
        // pilotagem
        ["pedalAceleradorPct"]   = s.PedalAceleradorPct,
        ["pedalFreioPct"]        = s.PedalFreioPct,
        ["pressaoFreioBar"]      = s.PressaoFreioBar,
        ["speedKmh"]             = s.SpeedKmh,
        ["accelXg"]              = s.AccelXg,
        ["accelYg"]              = s.AccelYg,
        ["accelZg"]              = s.AccelZg,
        // cilindros
        ["fuelInjectionBalanced"] = s.FuelInjectionBalanced,
        ["fuelInjectionSpread"]   = s.FuelInjectionSpread,
        ["fuelTimeA"]             = s.FuelTimeA,
        // alarmes + status
        ["alarmes"]              = s.Alarmes,
        ["statusSinais"]         = s.StatusSinais,
        ["cronometroParcialS"]   = s.CronometroParcialS,
        ["cronometroTotalS"]     = s.CronometroTotalS,
    };
}

/// <summary>Canal-fake pra teste: liga/desliga "online" na mão pra simular queda de
/// internet; guarda o que foi publicado, na ordem; pode forçar erro de envio.</summary>
public sealed class InMemoryLiveChannel : ILiveChannel
{
    private readonly List<(string Evento, IDictionary<string, object?> Payload)> _publicadas = new();
    private readonly object _lock = new();

    public bool Online { get; set; } = true;
    public int FalharProximosEnvios { get; set; }

    public IReadOnlyList<(string Evento, IDictionary<string, object?> Payload)> Publicadas
    {
        get { lock (_lock) return _publicadas.ToArray(); }
    }

    public Task<bool> PublishAsync(string evento, object payload, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        lock (_lock)
        {
            if (!Online) return Task.FromResult(false);
            if (FalharProximosEnvios > 0) { FalharProximosEnvios--; return Task.FromResult(false); }
            _publicadas.Add((evento, (IDictionary<string, object?>)payload));
            return Task.FromResult(true);
        }
    }
}
