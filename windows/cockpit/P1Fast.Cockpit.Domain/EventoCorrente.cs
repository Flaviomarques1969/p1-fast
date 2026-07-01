// EventoCorrente — peça a2 (Flávio/iMac 2026-07-01): a "sala do DIA", separada do "stint
// corrente" (o ponteiro sessao-corrente.json). O .exe escreve este arquivo companheiro no
// LAUNCH (antes de qualquer stint), pra o servidor-video-local e a página derivarem a MESMA
// sala determinística `evento-<eventId>-<dateISO>` desde o load — sem o hardcode
// `p1-teste-aparelhos` e sem fallback que esconde bug (a página caía na sala errada antes
// do 1º stint). Não mexe no enum do ponteiro (que segue só `gravando|encerrada`).
//
// Contrato (docs/CONTRATO_VIDEO_GRAVACAO.md) — chaves EXATAS, camelCase:
//   ~/p1fast-sessoes/evento-corrente.json = { "eventId":"<uuid>", "timeId":"<uuid>", "dateISO":"YYYY-MM-DD" }
//
// Escrita ATÔMICA (temp+rename): o servidor local pode ler a qualquer instante e nunca
// pega um JSON pela metade.

using System;
using System.IO;
using System.Text.Json;

namespace P1Fast.Cockpit.Domain;

/// <summary>Config do dia de corrida pra sala de vídeo (escrita no launch do .exe).</summary>
public sealed record EventoCorrenteDados(string EventId, string TimeId, string DateISO);

/// <summary>Serializa a config do dia no JSON EXATO do contrato (chaves camelCase).</summary>
public static class EventoCorrenteJson
{
    private static readonly JsonSerializerOptions Opts = new() { WriteIndented = false };

    public static string Serializar(EventoCorrenteDados e) => JsonSerializer.Serialize(new
    {
        eventId = e.EventId,
        timeId = e.TimeId,
        dateISO = e.DateISO,
    }, Opts);
}

/// <summary>Onde a config do dia é gravada. Escrever() substitui o conteúdo inteiro (atômico).</summary>
public interface IEventoCorrenteSink
{
    void Escrever(EventoCorrenteDados e);
}

/// <summary>Escreve o evento-corrente.json em disco de forma ATÔMICA (.tmp no mesmo diretório
/// + rename por cima). Best-effort no chamador: falha de I/O LANÇA aqui (o launch engole —
/// sem config do dia, o servidor local cai no fallback, não quebra).</summary>
public sealed class ArquivoEventoCorrenteSink : IEventoCorrenteSink
{
    private readonly string _caminho;

    /// <summary>Caminho completo (ex.: ~/p1fast-sessoes/evento-corrente.json). Cria o diretório.</summary>
    public ArquivoEventoCorrenteSink(string caminho)
    {
        _caminho = caminho ?? throw new ArgumentNullException(nameof(caminho));
        var dir = Path.GetDirectoryName(_caminho);
        if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);
    }

    public void Escrever(EventoCorrenteDados e)
    {
        var json = EventoCorrenteJson.Serializar(e);
        var tmp = _caminho + ".tmp";
        File.WriteAllText(tmp, json);
        File.Move(tmp, _caminho, overwrite: true);
    }
}
