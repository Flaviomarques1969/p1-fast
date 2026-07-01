// Prova da seleção de pendentes da fila de upload (PendenciasUpload), sem disco/rede:
// só sobe sessão ENCERRADA, sem marcador, com amostras suficientes; ignora a sessão ao
// vivo em andamento; ordem estável (mais antiga primeiro).

using System.Collections.Generic;
using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class PendenciasUploadTests
{
    private static SessaoNoDisco S(string id, bool encerrada = true, int n = 1000, bool subida = false) =>
        new(id, encerrada, n, subida);

    [Fact]
    public void SoEntra_Encerrada_SemMarcador_ComAmostras()
    {
        var sessoes = new[]
        {
            S("sessao-A"),                               // ok → entra
            S("sessao-B", encerrada: false),             // gravando → fora
            S("sessao-C", subida: true),                 // já na nuvem → fora
            S("sessao-D", n: 10),                        // poucas amostras → fora
        };

        var pend = PendenciasUpload.Selecionar(sessoes);

        Assert.Equal(new[] { "sessao-A" }, pend);
    }

    [Fact]
    public void OrdemEstavel_MaisAntigaPrimeiro()
    {
        // Nome carrega o timestamp; ordinal crescente = cronológico.
        var sessoes = new[] { S("sessao-2026-06-28T16-00"), S("sessao-2026-06-26T22-00"), S("sessao-2026-06-27T18-00") };

        var pend = PendenciasUpload.Selecionar(sessoes);

        Assert.Equal(new[] { "sessao-2026-06-26T22-00", "sessao-2026-06-27T18-00", "sessao-2026-06-28T16-00" }, pend);
    }

    [Fact]
    public void ExcluiSessaoAoVivoEmAndamento()
    {
        var sessoes = new[] { S("ao-vivo-agora"), S("antiga") };
        var excluir = new HashSet<string> { "ao-vivo-agora" };

        var pend = PendenciasUpload.Selecionar(sessoes, excluir: excluir);

        Assert.Equal(new[] { "antiga" }, pend);
    }

    [Fact]
    public void MinAmostrasConfiguravel()
    {
        var sessoes = new[] { S("curta", n: 250) };

        Assert.Empty(PendenciasUpload.Selecionar(sessoes, minAmostras: 500));   // abaixo do mínimo
        Assert.Single(PendenciasUpload.Selecionar(sessoes, minAmostras: 100));  // acima
    }

    [Fact]
    public void ListaVazia_NaoQuebra()
    {
        Assert.Empty(PendenciasUpload.Selecionar(new SessaoNoDisco[0]));
    }
}
