// PistaStore — persistência local da pista aprendida (Fase D, D2 = persiste entre dias). Trava o
// round-trip salvar/carregar, a tolerância a arquivo corrompido, o "achar por posição" entre pistas
// salvas, e o PistaId ESTÁVEL derivado da caixa geográfica.

using System.IO;
using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class PistaStoreTests
{
    private static PistaAprendida Pista(
        string id, double latMin, double latMax, double lonMin, double lonMax)
    {
        var linha = new LinhaAprendida(new PontoGps(latMin, lonMin), new PontoGps(latMin, lonMax));
        var trechos = new List<TrechoSegmento>
        {
            new("t01", "T1",
                new LinhaGps(new PontoGps(latMin, lonMin), new PontoGps(latMax, lonMin)),
                new PontoGps((latMin + latMax) / 2, (lonMin + lonMax) / 2),
                new LinhaGps(new PontoGps(latMin, lonMax), new PontoGps(latMax, lonMax))),
        };
        return new PistaAprendida(1, id, linha, latMin, latMax, lonMin, lonMax, trechos);
    }

    private static string TempDir()
        => Path.Combine(Path.GetTempPath(), "p1fast-pista-" + Path.GetRandomFileName());

    [Fact]
    public void PS_06_Roundtrip_salva_e_carrega()
    {
        var dir = TempDir();
        try
        {
            var store = new PistaStore(dir);
            var id = PistaStore.DerivarId(-20.1, -20.0, -50.2, -50.0);
            var pista = Pista(id, -20.1, -20.0, -50.2, -50.0);
            store.Salvar(pista);

            var lido = store.Carregar(id);
            Assert.NotNull(lido);
            Assert.Equal(1, lido!.Versao);
            Assert.Equal(id, lido.PistaId);
            Assert.Equal(-20.1, lido.LatMin);
            Assert.Equal(-50.0, lido.LonMax);
            Assert.Single(lido.Segmentos);
            Assert.Equal("t01", lido.Segmentos[0].Id);
            Assert.Equal(pista.Segmentos[0].ApicePoint, lido.Segmentos[0].ApicePoint);
        }
        finally { try { Directory.Delete(dir, true); } catch { } }
    }

    [Fact]
    public void PS_07_Arquivo_corrompido_da_null_sem_lancar()
    {
        var dir = TempDir();
        try
        {
            var store = new PistaStore(dir);
            var id = PistaStore.DerivarId(-10.0, -9.9, -40.0, -39.9);
            var pista = Pista(id, -10.0, -9.9, -40.0, -39.9);
            store.Salvar(pista);

            // corrompe o arquivo salvo no lugar.
            var arquivo = Directory.GetFiles(dir, "pista-*.json")[0];
            File.WriteAllText(arquivo, "{ isto não é json válido ]]");

            Assert.Null(store.Carregar(id));                 // tolerante: null, não lança
            Assert.Null(store.Carregar("pista-inexistente")); // ausente também → null
        }
        finally { try { Directory.Delete(dir, true); } catch { } }
    }

    [Fact]
    public void PS_08_AcharPorPosicao_encontra_a_pista_certa_entre_duas()
    {
        var dir = TempDir();
        try
        {
            var store = new PistaStore(dir);
            var idA = PistaStore.DerivarId(-20.1, -20.0, -50.2, -50.0);
            var idB = PistaStore.DerivarId(-3.1, -3.0, -60.2, -60.0);
            store.Salvar(Pista(idA, -20.1, -20.0, -50.2, -50.0));
            store.Salvar(Pista(idB, -3.1, -3.0, -60.2, -60.0));

            var achada = store.AcharPorPosicao(new PontoGps(-3.05, -60.1));  // dentro da B
            Assert.NotNull(achada);
            Assert.Equal(idB, achada!.PistaId);

            Assert.Null(store.AcharPorPosicao(new PontoGps(0, 0)));           // fora das duas
        }
        finally { try { Directory.Delete(dir, true); } catch { } }
    }

    [Fact]
    public void PS_09_PistaId_estavel_para_a_mesma_caixa()
    {
        // Mesma caixa → mesmo id, independente da ordem dos limites; sinal e 3 casas.
        var id1 = PistaStore.DerivarId(-20.1, -20.0, -50.2, -50.0);
        var id2 = PistaStore.DerivarId(-20.1, -20.0, -50.2, -50.0);
        Assert.Equal(id1, id2);
        Assert.Equal("pista--20.050_-50.100", id1);

        // Caixa diferente → id diferente.
        var id3 = PistaStore.DerivarId(-3.1, -3.0, -60.2, -60.0);
        Assert.NotEqual(id1, id3);
    }
}
