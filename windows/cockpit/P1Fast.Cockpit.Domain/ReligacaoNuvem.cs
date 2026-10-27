// Quando o laço da nuvem religa o canal (cockpit e console de captura usam a MESMA regra).
//
// BUG DE CAMPO 2026-10-27 (teste de rua, celular/5G): o laço marcava a hora da tentativa ANTES
// de conectar, e o ConnectAsync volta logo depois de PEDIR a entrada no canal — o Online só liga
// quando o servidor confirma (phx_reply). No Wi-Fi a conexão leva < 2 s e ninguém via; no celular,
// conectar (TLS + upgrade) passa de 2 s, então no giro seguinte "faz mais de 2 s e não está online"
// e o laço derrubava a conexão nova antes da confirmação chegar — para sempre, com internet boa.
//
// Regra: a espera conta a partir do FIM da tentativa; e socket aberto aguardando a confirmação
// da entrada ganha até 10 s antes de ser derrubado (servidor mudo = religa).

using System;
using System.Threading;
using System.Threading.Tasks;

namespace P1Fast.Cockpit.Domain;

public sealed class ReligacaoNuvem
{
    private readonly TimeSpan _intervalo;       // entre tentativas que falharam (backoff)
    private readonly TimeSpan _esperaEntrada;   // socket aberto esperando o phx_reply do join
    private readonly Func<long> _relogioMs;
    private long _fimUltimaTentativa;

    public ReligacaoNuvem(TimeSpan? intervalo = null, TimeSpan? esperaEntrada = null, Func<long>? relogioMs = null)
    {
        _intervalo     = intervalo ?? TimeSpan.FromSeconds(2);
        _esperaEntrada = esperaEntrada ?? TimeSpan.FromSeconds(10);
        _relogioMs     = relogioMs ?? (() => Environment.TickCount64);
        _fimUltimaTentativa = _relogioMs();
    }

    /// <summary>Quantas vezes o canal foi (re)conectado por aqui — prova de que não fica em laço.</summary>
    public int Tentativas { get; private set; }

    public bool DeveReligar(SupabaseRealtimeChannel nuvem)
    {
        if (nuvem.Online || nuvem.Conectando) return false;   // conexão em curso: não empilha outra
        var espera = nuvem.AguardandoEntrada ? _esperaEntrada : _intervalo;
        return _relogioMs() - _fimUltimaTentativa > (long)espera.TotalMilliseconds;
    }

    /// <summary>Religa se for a hora; nunca lança (erro = tenta depois). Volta true se tentou.</summary>
    public async Task<bool> GarantirAsync(SupabaseRealtimeChannel nuvem, CancellationToken ct)
    {
        if (!DeveReligar(nuvem)) return false;
        Tentativas++;
        try { await nuvem.ConnectAsync(ct).ConfigureAwait(false); }
        catch { /* tenta depois */ }
        finally { _fimUltimaTentativa = _relogioMs(); }
        return true;
    }
}
