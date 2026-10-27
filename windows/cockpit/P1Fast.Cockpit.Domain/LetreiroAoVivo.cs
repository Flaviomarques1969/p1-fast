// LetreiroAoVivo — a saúde do AO VIVO escrita pra quem está no notebook (E2 da obra "TV do box ao
// vivo", 27/10/2026, achado N4: "ninguém no carro vê que o ao vivo caiu"). Antes o status só dizia
// o canal na partida; erro de envio era engolido e a religação era muda. Agora, ~1 vez por segundo,
// o laço da nuvem pergunta aqui e o texto vai pra região do canal no status (AvisosCockpit).
//
// Peça PURA (sem UI, sem rede): recebe o estado do canal e as contas do publicador de GPS, devolve o
// texto. Guarda só desde quando o canal está fora, pra dizer "caiu há X s".

using System;

namespace P1Fast.Cockpit.Domain;

public sealed class LetreiroAoVivo
{
    /// <summary>Último envio há mais que isto (com o canal no ar) = o GPS parou de chegar no notebook.</summary>
    public const long SemGpsMs = 3_000;
    /// <summary>Fila acima disto (≈2 s de RaceBox) = o box está vendo com atraso.</summary>
    public const int FilaAtrasoPontos = 50;

    private long? _foraDesdeMs;
    private bool _jaEsteveOnline;

    /// <param name="agoraMs">Relógio monotônico (ms), o mesmo do publicador.</param>
    /// <param name="online">Canal confirmado (entrou no canal).</param>
    /// <param name="gps">Contas do GpsLivePublisher neste instante.</param>
    public string Atualizar(long agoraMs, bool online, GpsLivePublisherStats gps)
    {
        if (!online)
        {
            _foraDesdeMs ??= agoraMs;
            var fila = gps.NaFila > 0 ? $" · {gps.NaFila} pontos esperando (o disco grava tudo)" : "";
            if (!_jaEsteveOnline) return "AO VIVO: conectando à nuvem…" + fila;
            return $"AO VIVO CAIU há {HaQuanto(agoraMs - _foraDesdeMs.Value)} · religando{fila}";
        }

        _foraDesdeMs = null;
        _jaEsteveOnline = true;
        if (gps.NaFila >= FilaAtrasoPontos)
            return $"AO VIVO ATRASADO · reenviando {gps.NaFila} pontos";
        if (gps.MsDesdeUltimoEnvio is not { } desde)
            return "AO VIVO: nuvem OK · esperando o GPS";
        if (desde > SemGpsMs)
            return $"AO VIVO: nuvem OK · sem GPS para enviar há {HaQuanto(desde)}";
        return "AO VIVO OK";
    }

    private static string HaQuanto(long ms)
    {
        var s = Math.Max(0, ms / 1000);
        if (s < 60) return $"{s} s";
        var m = s / 60;
        return m < 60 ? $"{m} min" : $"{m / 60} h {m % 60} min";
    }
}
