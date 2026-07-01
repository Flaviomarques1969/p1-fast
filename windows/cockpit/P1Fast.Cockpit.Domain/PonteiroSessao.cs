// PonteiroSessao — o "onde está a sessão AGORA" que a página de campo lê pra ligar o
// vídeo ao stint (peça 2/3 da captura auto de vídeo). O .exe escreve, ATÔMICO, o
// arquivo ~/p1fast-sessoes/sessao-corrente.json a cada abertura/fechamento de stint.
//
// Contrato (docs/CONTRATO_VIDEO_GRAVACAO.md, formato 1) — chaves EXATAS, camelCase:
//   { "sessaoId":"<uuid>", "startedAt":<epoch ms=TWall>, "eventId":"<uuid>",
//     "timeId":"<uuid>", "status":"gravando"|"encerrada" }
//
// DESENHO PARA TESTE: a decisão de O QUE escrever vive no SessionRecorder (dispara o
// hook aoStint em Abrir/Encerrar); a escrita física vive num IPonteiroSink injetável.
// Em disco = ArquivoPonteiroSink (System.IO puro, escrita atômica temp+rename, sem
// dependência de Windows — provado aqui fora do carro). Nos testes, um sink de memória.
//
// Por que atômico: a página pode ler o ponteiro a qualquer instante; nunca pode pegar
// um JSON pela metade. Escreve num .tmp no MESMO diretório e faz rename por cima —
// o leitor sempre vê ou o conteúdo antigo inteiro, ou o novo inteiro.

using System;
using System.IO;
using System.Text.Json;

namespace P1Fast.Cockpit.Domain;

/// <summary>Conteúdo do ponteiro da sessão corrente (formato 1 do contrato de vídeo).
/// StartedAt = epoch ms no relógio comum (TWall/InicioWall). Status = "gravando"|"encerrada".</summary>
public sealed record PonteiroDados(
    string SessaoId,
    long StartedAt,
    string EventId,
    string TimeId,
    string Status);

/// <summary>Onde o ponteiro é gravado. Escrever() substitui o conteúdo inteiro (atômico).</summary>
public interface IPonteiroSink
{
    void Escrever(PonteiroDados p);
}

/// <summary>Serializa o ponteiro no JSON EXATO do contrato (chaves camelCase). Uma só
/// fonte de verdade do formato — o sink de disco e os testes usam este método.</summary>
public static class PonteiroJson
{
    private static readonly JsonSerializerOptions Opts = new() { WriteIndented = false };

    public static string Serializar(PonteiroDados p) => JsonSerializer.Serialize(new
    {
        sessaoId = p.SessaoId,
        startedAt = p.StartedAt,
        eventId = p.EventId,
        timeId = p.TimeId,
        status = p.Status,
    }, Opts);
}

/// <summary>Escreve o ponteiro em disco de forma ATÔMICA: grava um .tmp no mesmo
/// diretório e renomeia por cima do alvo. A página nunca lê um JSON pela metade.
/// Best-effort no chamador: falha de I/O LANÇA aqui (o recorder engole — não derruba
/// a tela do piloto).</summary>
public sealed class ArquivoPonteiroSink : IPonteiroSink
{
    private readonly string _caminho;

    /// <summary>Caminho completo do ponteiro (ex.: ~/p1fast-sessoes/sessao-corrente.json).
    /// O diretório é criado se faltar.</summary>
    public ArquivoPonteiroSink(string caminho)
    {
        _caminho = caminho ?? throw new ArgumentNullException(nameof(caminho));
        var dir = Path.GetDirectoryName(_caminho);
        if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);
    }

    public void Escrever(PonteiroDados p)
    {
        var json = PonteiroJson.Serializar(p);
        // .tmp no MESMO diretório (rename atômico só vale no mesmo volume).
        var tmp = _caminho + ".tmp";
        File.WriteAllText(tmp, json);
        // rename por cima: o leitor vê o antigo inteiro OU o novo inteiro, nunca metade.
        File.Move(tmp, _caminho, overwrite: true);
    }
}
