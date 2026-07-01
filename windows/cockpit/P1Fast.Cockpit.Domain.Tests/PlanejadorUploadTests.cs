// Prova da DECISÃO de retomada do upload (PlanejadorUpload), sem rede. Modelo do destino
// permanente (mig 0050): UNIQUE(sessao_id, parte) → completude por PARTE distinta, envio
// irrelevante. Sessão nova sobe tudo; parcial reenvia só o que falta; completa não faz nada.

using System.Linq;
using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class PlanejadorUploadTests
{
    [Fact]
    public void DestinoVazio_SobeTudo()
    {
        var plano = PlanejadorUpload.Planejar(total: 5, partesPresentes: System.Array.Empty<int>());

        Assert.Equal(AcaoUpload.Subir, plano.Acao);
        Assert.Equal(new[] { 0, 1, 2, 3, 4 }, plano.PartesFaltantes);
    }

    [Fact]
    public void TodasPresentes_Completa_NaoFazNada()
    {
        var plano = PlanejadorUpload.Planejar(total: 4, partesPresentes: new[] { 0, 1, 2, 3 });

        Assert.Equal(AcaoUpload.Completa, plano.Acao);
        Assert.Empty(plano.PartesFaltantes);
    }

    [Fact]
    public void Parcial_ReenviaSoAsFaltantes_EmOrdem()
    {
        // Rede caiu: chegaram só 0,1,2 de 6 (faltam 3,4,5).
        var plano = PlanejadorUpload.Planejar(total: 6, partesPresentes: new[] { 0, 1, 2 });

        Assert.Equal(AcaoUpload.Subir, plano.Acao);
        Assert.Equal(new[] { 3, 4, 5 }, plano.PartesFaltantes);
    }

    [Fact]
    public void BuracoNoMeio_ReenviaSoOBuraco()
    {
        // Chegaram 0,1,3,5 — faltam 2 e 4 (ordem importa pro reenvio determinístico).
        var plano = PlanejadorUpload.Planejar(total: 6, partesPresentes: new[] { 0, 1, 3, 5 });

        Assert.Equal(AcaoUpload.Subir, plano.Acao);
        Assert.Equal(new[] { 2, 4 }, plano.PartesFaltantes);
    }

    [Fact]
    public void PartesRepetidas_NaoConfundem()
    {
        // Duplicatas (vindas de envios diferentes sob a mesma parte) contam uma vez só.
        var plano = PlanejadorUpload.Planejar(total: 4, partesPresentes: new[] { 0, 0, 1, 1 });

        Assert.Equal(new[] { 2, 3 }, plano.PartesFaltantes);
    }

    [Fact]
    public void RuidoForaDaFaixa_EIgnorado()
    {
        // Partes negativas ou >= total (corrupção/ruído) não entram na conta.
        var plano = PlanejadorUpload.Planejar(total: 3, partesPresentes: new[] { -1, 99, 0 });

        Assert.Equal(AcaoUpload.Subir, plano.Acao);
        Assert.Equal(new[] { 1, 2 }, plano.PartesFaltantes); // só a parte 0 contou
    }
}
