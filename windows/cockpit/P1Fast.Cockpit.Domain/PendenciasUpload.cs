// PendenciasUpload — a DECISÃO pura de "quais sessões do disco ainda faltam subir pra
// nuvem", sem tocar disco nem rede (Fase 4 do docs/PLANO_ENVIO_DADOS_NUVEM.md). É o
// cérebro da FILA RESILIENTE ancorada no disco: o .exe lista o que tem em
// ~/p1fast-sessoes e este seletor diz o que enfileirar pra upload.
//
// Regra de elegibilidade (uma sessão ENTRA na fila quando):
//   - está ENCERRADA (meta fechado) — sessão "gravando" ainda pode crescer, não sobe;
//   - tem amostras suficientes (acima do mínimo) — descarta lixo de 1-2 s;
//   - NÃO tem o marcador .uploaded (se tem, já está 100% na nuvem — o uploader confirmou).
//
// A verdade entre reinícios é o DISCO: .jsonl sem .uploaded = pendente. Cai a luz no meio
// do upload? Sem marcador → volta pra fila no próximo boot e o uploader retoma de onde
// parou (PlanejadorUpload). Mantém a lógica AQUI, pura e provada; o .exe só lê o disco e
// roda o p1fast-upload pra cada id que sai daqui.

using System;
using System.Collections.Generic;
using System.Linq;

namespace P1Fast.Cockpit.Domain;

/// <summary>Estado de uma sessão no disco, do ponto de vista da fila de upload.</summary>
/// <param name="Id">Id da sessão (nome do .jsonl sem extensão).</param>
/// <param name="Encerrada">meta fechado (Status=encerrada). Sessão ainda gravando = false.</param>
/// <param name="NAmostras">Total de amostras (gps+motor) gravadas.</param>
/// <param name="JaSubida">Tem o marcador .uploaded (confirmada 100% na nuvem).</param>
public sealed record SessaoNoDisco(string Id, bool Encerrada, int NAmostras, bool JaSubida);

public static class PendenciasUpload
{
    /// <summary>Mínimo de amostras pra valer um upload (descarta sessões-lixo de poucos segundos).</summary>
    public const int MinAmostrasDefault = 100;

    /// <summary>Seleciona, em ordem estável por Id, as sessões que ainda precisam subir.
    /// <paramref name="excluir"/> tira ids que não devem entrar agora (ex.: a sessão AO VIVO
    /// em andamento, que ainda está sendo gravada/fechada nesta mesma execução).</summary>
    public static IReadOnlyList<string> Selecionar(
        IEnumerable<SessaoNoDisco> sessoes,
        int minAmostras = MinAmostrasDefault,
        ISet<string>? excluir = null)
    {
        if (sessoes is null) return Array.Empty<string>();
        return sessoes
            .Where(s => s is not null)
            .Where(s => s.Encerrada)                              // só sessão fechada
            .Where(s => !s.JaSubida)                              // ainda não confirmada na nuvem
            .Where(s => s.NAmostras >= minAmostras)               // tem conteúdo de verdade
            .Where(s => excluir is null || !excluir.Contains(s.Id))
            .Select(s => s.Id)
            .Distinct(StringComparer.Ordinal)
            .OrderBy(id => id, StringComparer.Ordinal)            // determinístico (mais antiga 1º, por timestamp no nome)
            .ToList();
    }
}
