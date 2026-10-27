// GpsLivePublisher — ENVIO AO VIVO do GPS pra nuvem, SEM perder fix (Parte A do
// docs/PLANO_ENVIO_DADOS_NUVEM.md §3). Irmão do LivePublisher (motor): mesma fila-
// que-não-perde + reenvio na religação, mas pro evento 'gps' e a ~25 Hz (taxa do
// RaceBox), SEM throttle — todo fix válido entra e é entregue (ou reenviado quando a
// nuvem volta). Antes o GPS era "último-valor-vence" (MainWindow.Live.cs _liveUltimoGps):
// se dois fixes caíam entre ticks do laço, o 1º era perdido pra sempre. Aqui não.
//
// Contrato IDÊNTICO ao que o app consome (web/cockpit/cloud-bridge.js, evento 'gps'):
// o payload é montado pelo chamador no formato {lat,lng,kmh,numSV,fix,accM,tWall} e só
// trafega — este publisher não inventa nem normaliza nada.
//
// DESENHO PARA TESTE: a lógica viva (fila, reenvio, estouro, trava de produção) mora
// aqui, pura, provada com o InMemoryLiveChannel. O transporte real é o
// SupabaseRealtimeChannel (o MESMO canal do motor — uma conexão só).

using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace P1Fast.Cockpit.Domain;

public sealed record GpsLivePublisherStats(
    long Enviadas,
    int  NaFila,
    long Descartadas,  // estouro de fila (perda consciente, contada)
    long Erros);

public sealed class GpsLivePublisher
{
    /// <summary>Canal de PRODUÇÃO (o que o app/Command Box assistem). Mesmo nome do motor;
    /// só pode ser usado com autorização explícita — senão o publisher nem é construído.</summary>
    public const string CanalProducao = LivePublisher.CanalProducao;

    // ~30 min a 25 Hz. Acima disso descarta o MAIS VELHO (mantém o ao-vivo fresco) e conta.
    private const int FilaMaxDefault = 45_000;

    private readonly ILiveChannel _canal;
    private readonly string _canalNome;
    private readonly bool _producao;
    private readonly int _filaMax;

    private readonly Queue<IDictionary<string, object?>> _fila = new();
    private long _enviadas, _descartadas, _erros;

    /// <param name="canalNome">Nome do canal. Se for 'cockpit-bubi-live' exige permitirProducao=true.</param>
    /// <param name="permitirProducao">Trava dura: só true quando o Flávio autorizar tocar produção.</param>
    public GpsLivePublisher(
        ILiveChannel canal,
        string canalNome,
        bool permitirProducao = false,
        int filaMax = FilaMaxDefault)
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
        _filaMax   = Math.Max(1, filaMax);
    }

    public string Canal => _canalNome;
    public bool Producao => _producao;

    public GpsLivePublisherStats GetStats() => new(
        Enviadas: _enviadas, NaFila: _fila.Count, Descartadas: _descartadas, Erros: _erros);

    /// <summary>Saúde pro operador, NUNCA silenciosa.</summary>
    public string Saude()
    {
        if (!_canal.Online) return _fila.Count > 0 ? "offline-enfileirando" : "offline";
        return _fila.Count > 0 ? "online-drenando" : "online";
    }

    /// <summary>Recebe um fix já no formato do contrato (lat,lng,kmh,numSV,fix,accM,tWall)
    /// e ENFILEIRA (não envia aqui — o envio é no Drenar, pra reenviar o acumulado quando
    /// a nuvem voltar). SEM throttle: todo fix conta (o RaceBox já vem a ~25 Hz).</summary>
    public void Oferecer(IDictionary<string, object?> gpsPayload)
    {
        if (gpsPayload is null) return;
        while (_fila.Count >= _filaMax) { _fila.Dequeue(); _descartadas++; }
        _fila.Enqueue(gpsPayload);
    }

    /// <summary>Drena a fila pra nuvem enquanto online e houver entrega. Se a nuvem cai
    /// no meio, PARA (mantém o resto na fila) — reenvia na próxima chamada.</summary>
    public async Task DrenarAsync(CancellationToken ct)
    {
        if (!_canal.Online) return;
        while (_fila.Count > 0 && !ct.IsCancellationRequested)
        {
            var payload = _fila.Peek();
            bool ok;
            try { ok = await _canal.PublishAsync("gps", payload, ct).ConfigureAwait(false); }
            catch (OperationCanceledException) { throw; }
            catch { _erros++; break; }   // erro de envio: segura na fila, tenta depois

            if (!ok) { _erros++; break; } // nuvem recusou/caiu: mantém na fila
            _fila.Dequeue();
            _enviadas++;
        }
    }
}
