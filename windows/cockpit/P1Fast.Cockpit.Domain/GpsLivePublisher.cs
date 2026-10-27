// GpsLivePublisher — ENVIO AO VIVO do GPS pra nuvem (Parte A do docs/PLANO_ENVIO_DADOS_NUVEM.md §3).
// Irmão do LivePublisher (motor): fila + reenvio na religação, pro evento 'gps'.
//
// E2 da obra "TV do box ao vivo" (Flávio 27/10/2026), achados N2/N7 da auditoria:
//  - LOTE: em vez de 1 mensagem por fix (25/s por espectador, contra a cota do Supabase), sai 1
//    mensagem a cada ~200 ms. O TOPO do payload é o fix mais novo, com as MESMAS chaves de sempre
//    (consumidor antigo vê o ponto mais novo a 5 Hz e não quebra); a chave aditiva "lote" leva os
//    fixes anteriores do intervalo, em ordem de tempo (web/cockpit/gps-fonte-unica.js pontosDoGps
//    desmonta na TV). Fidelidade continua 25 Hz.
//  - FILA AO VIVO SÓ DOS ÚLTIMOS ~10 s: antes a fila guardava até 45 mil fixes (~30 min) e, na
//    volta da internet, despejava tudo do mais velho pro mais novo — a TV mostrava o passado como
//    se fosse agora. Fix com mais de 10 s na fila sai do ao vivo (contado em ForaDoAoVivo); o disco
//    (SessionRecorder) e a subida da gravação (sessao_dumps) já guardam todos.
//  - CONEXÃO MEIO-MORTA (achado da auditoria da religação, 27/10): com a rede morta e o socket
//    ainda "aberto", o envio volta "ok" por alguns segundos antes de o canal perceber a queda.
//    Por isso o enviado fica guardado por 10 s; quando o canal cai, esses fixes voltam pra frente
//    da fila e são reenviados na religação. A TV descarta o que já tinha (mesmo tWall).
//  - ENTREGA CONFIRMADA (ensaio no celular 27/10, hotspot caindo: buracos de até 26 s na TV, porque a
//    queda só era percebida pelo heartbeat de 25 s e os 10 s fixos de guarda não cobriam): com canal
//    que confirma (IConfirmaEntrega — o SupabaseRealtimeChannel, heartbeat de 5 s), o enviado fica
//    guardado até o heartbeat seguinte CONFIRMAR, no mesmo socket (até 30 s, folga). Na queda — ou se a
//    conexão trocou sem o publisher ver o offline — o não confirmado volta pra frente da fila; o
//    devolvido vale até 30 s no ao vivo (o novo continua com 10 s). Canal sem confirmação: como antes.
//
// Contrato: cada fix é montado pelo chamador no formato {lat,lng,kmh,numSV,fix,accM,tWall,...} e
// só trafega — este publisher não inventa nem normaliza nada.
//
// DESENHO PARA TESTE: a lógica (lote, janela de 10 s, reenvio, trava de produção) mora aqui, pura,
// com relógio injetável, provada com o InMemoryLiveChannel. O transporte real é o
// SupabaseRealtimeChannel (o MESMO canal do motor — uma conexão só).

using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace P1Fast.Cockpit.Domain;

public sealed record GpsLivePublisherStats(
    long Enviadas,      // fixes entregues (somando os de dentro dos lotes)
    int  NaFila,
    long Descartadas,   // estouro da fila (perda consciente, contada)
    long Erros,
    long Mensagens = 0,     // mensagens 'gps' enviadas (o que conta na cota)
    long ForaDoAoVivo = 0,  // fixes que passaram de 10 s na fila: só no disco/gravação
    long Reenviados = 0,    // fixes devolvidos à fila porque o canal caiu logo depois de "enviar"
    long? MsDesdeUltimoEnvio = null,
    int AguardandoConfirmacao = 0);   // enviados que o servidor ainda não confirmou (reenviados se cair)

public sealed class GpsLivePublisher
{
    /// <summary>Canal de PRODUÇÃO (o que o app/Command Box assistem). Mesmo nome do motor;
    /// só pode ser usado com autorização explícita — senão o publisher nem é construído.</summary>
    public const string CanalProducao = LivePublisher.CanalProducao;

    public const int  IntervaloLoteMsDefault = 200;     // 5 mensagens/s
    public const int  LoteMaxDefault         = 25;      // 1 s de RaceBox por mensagem (recuperação)
    public const long JanelaAoVivoMsDefault  = 10_000;  // o ao vivo só leva os últimos ~10 s
    public const long GuardaSemConfirmacaoMsDefault = 30_000; // enviado não confirmado: até 30 s (queda percebida em 5–10 s)

    // Rede de segurança acima das janelas (relógio parado/teste): 30 s devolvidos + 10 s novos a 25 Hz, com folga.
    private const int FilaMaxDefault = 2_000;

    private readonly ILiveChannel _canal;
    private readonly string _canalNome;
    private readonly bool _producao;
    private readonly int _filaMax;
    private readonly int _intervaloLoteMs;
    private readonly int _loteMax;
    private readonly long _janelaAoVivoMs;
    private readonly long _guardaSemConfirmacaoMs;
    private readonly Func<long> _relogioMs;
    private readonly IConfirmaEntrega? _confirma;

    private sealed record Item(IDictionary<string, object?> Payload, long ChegadaMs, bool Devolvido = false);
    private sealed record Enviado(Item Item, long ConcluidoMs, int Conexao);

    private readonly LinkedList<Item> _fila = new();
    private readonly Queue<Enviado> _enviadosRecentes = new();
    private long _enviadas, _descartadas, _erros, _mensagens, _foraDoAoVivo, _reenviados;
    private long? _ultimoEnvioMs;
    private bool _estavaOnline;

    /// <param name="canalNome">Nome do canal. Se for 'cockpit-bubi-live' exige permitirProducao=true.</param>
    /// <param name="permitirProducao">Trava dura: só true quando o Flávio autorizar tocar produção.</param>
    /// <param name="relogioMs">Relógio monotônico em ms (padrão Environment.TickCount64); injetável pra teste.</param>
    public GpsLivePublisher(
        ILiveChannel canal,
        string canalNome,
        bool permitirProducao = false,
        int filaMax = FilaMaxDefault,
        int intervaloLoteMs = IntervaloLoteMsDefault,
        int loteMax = LoteMaxDefault,
        long janelaAoVivoMs = JanelaAoVivoMsDefault,
        Func<long>? relogioMs = null,
        long guardaSemConfirmacaoMs = GuardaSemConfirmacaoMsDefault)
    {
        ArgumentNullException.ThrowIfNull(canal);
        if (string.IsNullOrWhiteSpace(canalNome))
            throw new ArgumentException("canal não pode ser vazio", nameof(canalNome));
        if (canalNome == CanalProducao && !permitirProducao)
            throw new InvalidOperationException(
                "Canal de produção 'cockpit-bubi-live' exige autorização explícita (permitirProducao=true). " +
                "Use um canal de teste pra validar.");

        _canal           = canal;
        _canalNome       = canalNome;
        _producao        = canalNome == CanalProducao;
        _filaMax         = Math.Max(1, filaMax);
        _intervaloLoteMs = Math.Max(0, intervaloLoteMs);
        _loteMax         = Math.Max(1, loteMax);
        _janelaAoVivoMs  = Math.Max(1, janelaAoVivoMs);
        _guardaSemConfirmacaoMs = Math.Max(_janelaAoVivoMs, guardaSemConfirmacaoMs);
        _relogioMs       = relogioMs ?? (() => Environment.TickCount64);
        _confirma        = canal as IConfirmaEntrega;
    }

    public string Canal => _canalNome;
    public bool Producao => _producao;

    public GpsLivePublisherStats GetStats() => new(
        Enviadas: _enviadas, NaFila: _fila.Count, Descartadas: _descartadas, Erros: _erros,
        Mensagens: _mensagens, ForaDoAoVivo: _foraDoAoVivo, Reenviados: _reenviados,
        MsDesdeUltimoEnvio: _ultimoEnvioMs is { } u ? _relogioMs() - u : null,
        AguardandoConfirmacao: _enviadosRecentes.Count);

    /// <summary>Saúde pro operador, NUNCA silenciosa.</summary>
    public string Saude()
    {
        if (!_canal.Online) return _fila.Count > 0 ? "offline-enfileirando" : "offline";
        return _fila.Count > 0 ? "online-drenando" : "online";
    }

    /// <summary>Recebe um fix já no formato do contrato e ENFILEIRA (o envio é no Drenar, em lote).
    /// SEM throttle: todo fix conta (o RaceBox já vem a ~25 Hz).</summary>
    public void Oferecer(IDictionary<string, object?> gpsPayload)
    {
        if (gpsPayload is null) return;
        var agora = _relogioMs();
        _fila.AddLast(new Item(gpsPayload, agora));
        while (_fila.Count > _filaMax) { _fila.RemoveFirst(); _descartadas++; }
        Aparar(agora);
    }

    /// <summary>Envia o que estiver na hora: 1 lote a cada ~200 ms; com atraso acumulado (volta da
    /// internet), lotes cheios em sequência até alcançar o presente. Se a nuvem cai no meio, PARA
    /// (mantém o resto na fila) — reenvia na próxima chamada.</summary>
    public async Task DrenarAsync(CancellationToken ct)
    {
        var agora = _relogioMs();
        Confirmar();
        Aparar(agora);

        if (!_canal.Online)
        {
            if (_estavaOnline) DevolverRecentes();
            _estavaOnline = false;
            return;
        }
        _estavaOnline = true;

        while (_fila.Count > 0 && !ct.IsCancellationRequested)
        {
            agora = _relogioMs();
            bool naHora = _ultimoEnvioMs is not { } u || agora - u >= _intervaloLoteMs;
            if (!naHora && _fila.Count < _loteMax) break;   // junta mais um pouco pro próximo lote

            var itens = _fila.Take(_loteMax).ToList();
            var payload = MontarLote(itens);

            // conexão lida ANTES do envio: se trocar no meio, o lote fica marcado com a velha e volta à
            // fila no próximo Confirmar (pior caso: reenvio a mais, que a TV descarta pelo tWall — nunca
            // perda). Lida depois, um lote escrito no socket morto ganhava a conexão nova e a confirmação dela.
            int conexao = _confirma?.Confirmacao.Conexao ?? 0;
            bool ok;
            try { ok = await _canal.PublishAsync("gps", payload, ct).ConfigureAwait(false); }
            catch (OperationCanceledException) { throw; }
            catch { _erros++; break; }   // erro de envio: segura na fila, tenta depois

            if (!ok) { _erros++; break; } // nuvem recusou/caiu: mantém na fila
            for (int i = 0; i < itens.Count; i++) _fila.RemoveFirst();
            long concluido = _relogioMs();
            foreach (var it in itens) _enviadosRecentes.Enqueue(new Enviado(it with { Devolvido = false }, concluido, conexao));
            _enviadas += itens.Count;
            _mensagens++;
            _ultimoEnvioMs = agora;
        }
    }

    // Topo = o fix mais novo (cópia, com as chaves do contrato); "lote" = os anteriores, em ordem.
    private static IDictionary<string, object?> MontarLote(List<Item> itens)
    {
        var topo = new Dictionary<string, object?>(itens[^1].Payload);
        if (itens.Count > 1)
            topo["lote"] = itens.Take(itens.Count - 1).Select(i => i.Payload).ToList();
        return topo;
    }

    // Canal que confirma: solta o que o servidor já confirmou (enviado ANTES do heartbeat respondido,
    // na MESMA conexão). Enviado numa conexão que já foi trocada nunca será confirmado: volta à fila.
    private void Confirmar()
    {
        if (_confirma is null || _enviadosRecentes.Count == 0) return;
        var c = _confirma.Confirmacao;   // conexão e confirmação numa leitura só
        if (_enviadosRecentes.Any(e => e.Conexao != c.Conexao)) { DevolverRecentes(); return; }
        while (_enviadosRecentes.Count > 0 && c.AteMs is { } a && _enviadosRecentes.Peek().ConcluidoMs < a)
            _enviadosRecentes.Dequeue();
    }

    // Tira do ao vivo o que passou da janela: novo = 10 s; devolvido (escrito num socket morto) = guarda
    // de 30 s com canal que confirma (sem confirmação: 10 s, como antes). A fila está em ordem de
    // chegada com os devolvidos na frente.
    private void Aparar(long agora)
    {
        var node = _fila.First;
        while (node is not null)
        {
            var prox = node.Next;
            long limite = node.Value.Devolvido && _confirma is not null ? _guardaSemConfirmacaoMs : _janelaAoVivoMs;
            if (agora - node.Value.ChegadaMs > limite) { _fila.Remove(node); _foraDoAoVivo++; }
            else if (!node.Value.Devolvido) break;   // daqui pra frente só novos, mais recentes
            node = prox;
        }
        long guarda = _confirma is null ? _janelaAoVivoMs : _guardaSemConfirmacaoMs;
        while (_enviadosRecentes.Count > 0 && agora - _enviadosRecentes.Peek().Item.ChegadaMs > guarda)
            _enviadosRecentes.Dequeue();
    }

    // O canal caiu (ou trocou de conexão): o enviado ainda não confirmado pode ter ido pro buffer de um
    // socket morto. Volta pra FRENTE da fila, em ordem; a TV descarta o que já tinha recebido.
    private void DevolverRecentes()
    {
        if (_enviadosRecentes.Count == 0) return;
        var node = _fila.First;
        foreach (var e in _enviadosRecentes)
        {
            var it = e.Item with { Devolvido = true };
            if (node is null) _fila.AddLast(it); else _fila.AddBefore(node, it);
            _reenviados++;
        }
        _enviadosRecentes.Clear();
        while (_fila.Count > _filaMax) { _fila.RemoveFirst(); _descartadas++; }
    }
}
