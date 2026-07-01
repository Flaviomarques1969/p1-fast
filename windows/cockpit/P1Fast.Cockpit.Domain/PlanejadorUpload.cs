// PlanejadorUpload — a DECISÃO pura de "como subir esta sessão" dado o que JÁ está no
// destino durável (sessao_dumps), sem rede. É o cérebro da RETOMADA sem duplicar
// (Fase 4 do docs/PLANO_ENVIO_DADOS_NUVEM.md): a internet da pista cai no meio do upload
// e, na próxima tentativa, reenvia SÓ as partes que faltam — em vez de recusar a sessão
// inteira (a guarda antiga) ou re-empilhar tudo (duplicação).
//
// Contrato do destino (migração 0050, iMac 2026-06-30): a sessao_dumps é PERMANENTE e tem
// TRAVA UNIQUE(sessao_id, parte). Ou seja, existe NO MÁXIMO uma linha por (sessao_id,
// parte) — a coluna 'envio' virou só proveniência, não conta mais pra unicidade. Então a
// completude é simples: a sessão está completa quando as partes 0..total-1 estão TODAS
// presentes (parte 0 = meta, 1..N = blocos). O reenvio é idempotente no servidor
// (on_conflict=sessao_id,parte + Prefer: resolution=ignore-duplicates → 201 no-op), então
// mandar uma parte que já existe nunca duplica; aqui só evitamos o trabalho à toa.
//
// Mantém a lógica viva AQUI, pura e provada (igual LivePublisher/GpsLivePublisher); o
// Program.cs do p1fast-upload só executa o plano contra a rede real.

using System;
using System.Collections.Generic;
using System.Linq;

namespace P1Fast.Cockpit.Domain;

public enum AcaoUpload { Completa, Subir }

/// <param name="Acao">Completa = nada a fazer (idempotente). Subir = enviar as faltantes.</param>
/// <param name="PartesFaltantes">Partes a enviar (0=meta..total-1), em ordem. Vazio em Completa.</param>
public sealed record PlanoUpload(AcaoUpload Acao, IReadOnlyList<int> PartesFaltantes);

public static class PlanejadorUpload
{
    /// <summary>Decide o que enviar, dado o total esperado de partes (meta + blocos) e as
    /// partes JÁ presentes no destino pra esta sessão (distintas; envio é irrelevante pela
    /// trava UNIQUE(sessao_id, parte)).</summary>
    public static PlanoUpload Planejar(int total, IEnumerable<int> partesPresentes)
    {
        if (total <= 0) throw new ArgumentOutOfRangeException(nameof(total), "total deve ser > 0");

        var presentes = new HashSet<int>();
        foreach (var p in partesPresentes ?? Array.Empty<int>())
            if (p >= 0 && p < total) presentes.Add(p);   // ruído fora da faixa: ignora

        var faltantes = Enumerable.Range(0, total).Where(p => !presentes.Contains(p)).ToList();
        return faltantes.Count == 0
            ? new PlanoUpload(AcaoUpload.Completa, Array.Empty<int>())
            : new PlanoUpload(AcaoUpload.Subir, faltantes);
    }
}
