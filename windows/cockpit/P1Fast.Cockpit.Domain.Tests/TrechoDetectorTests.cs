// TrechoDetector — "em qual curva o carro está". Port de trecho-detector.js.
// Incremento 5 da Fase 4. Curvas sintéticas: o carro anda pro leste cruzando
// entrada → ápice → saída; e a ressincronização quando pula uma curva.

using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class TrechoDetectorTests
{
    // Curva com linhas verticais (no eixo lng) em entrada/saída e ápice no meio.
    private static TrechoSegmento Seg(string id, double entradaLng, double apiceLng, double saidaLng) =>
        new(id, id,
            new LinhaGps(new PontoGps(-0.001, entradaLng), new PontoGps(0.001, entradaLng)),
            new PontoGps(0, apiceLng),
            new LinhaGps(new PontoGps(-0.001, saidaLng), new PontoGps(0.001, saidaLng)));

    private static List<TrechoEvento> Rodar(IReadOnlyList<TrechoSegmento> segs, IEnumerable<double> lngs)
    {
        var eventos = new List<TrechoEvento>();
        var det = new TrechoDetector(segs, eventos.Add);
        double t = 0;
        foreach (var lng in lngs)
        {
            det.IngestGps(new AmostraGps(Lat: 0, Lng: lng, Kmh: 100, T: t));
            t += 100;
        }
        return eventos;
    }

    [Fact]
    public void TD_01_Uma_curva_dispara_entrada_apice_saida_em_ordem()
    {
        var eventos = Rodar(
            new[] { Seg("c0", 0.0, 0.0005, 0.001) },
            new[] { -0.0006, -0.0003, -0.0001, 0.0001, 0.0003, 0.0005, 0.0007, 0.0009, 0.0011 });

        var tipos = eventos.Select(e => e.Type).ToList();
        Assert.Contains("entrada-cruzou", tipos);
        Assert.Contains("apice-cruzou", tipos);
        Assert.Contains("saida-cruzou", tipos);
        // ordem: entrada antes do ápice antes da saída
        Assert.True(tipos.IndexOf("entrada-cruzou") < tipos.IndexOf("apice-cruzou"));
        Assert.True(tipos.IndexOf("apice-cruzou") < tipos.IndexOf("saida-cruzou"));
        Assert.All(eventos.Where(e => e.Type.EndsWith("-cruzou")), e => Assert.Equal("c0", e.SegmentId));
    }

    [Fact]
    public void TD_02_Apos_sair_engata_na_proxima_curva()
    {
        var eventos = Rodar(
            new[] { Seg("c0", 0.0, 0.0005, 0.001), Seg("c1", 0.002, 0.0025, 0.003) },
            new[] { -0.0006, -0.0003, -0.0001, 0.0001, 0.0003, 0.0005, 0.0007, 0.0009, 0.0011,
                     0.0013, 0.0015, 0.0017, 0.0019, 0.0021, 0.0023, 0.0025, 0.0027, 0.0029, 0.0031 });

        var saidaC0 = eventos.FindIndex(e => e.Type == "saida-cruzou" && e.SegmentId == "c0");
        var entradaC1 = eventos.FindIndex(e => e.Type == "entrada-cruzou" && e.SegmentId == "c1");
        Assert.True(saidaC0 >= 0, "faltou saída de c0");
        Assert.True(entradaC1 > saidaC0, "c1 devia ser detectada depois de sair de c0");
        Assert.Contains(eventos, e => e.Type == "saida-cruzou" && e.SegmentId == "c1");
    }

    [Fact]
    public void TD_03_Resync_engata_na_curva_onde_o_carro_realmente_esta()
    {
        // Carro nunca cruza a entrada de c0 (já está a leste dela) e cruza a de c1.
        var eventos = Rodar(
            new[] { Seg("c0", 0.0, 0.0005, 0.001), Seg("c1", 0.002, 0.0025, 0.003) },
            new[] { 0.0015, 0.0019, 0.0021 });

        Assert.Contains(eventos, e => e.Type == "resync" && e.ParaSegmentId == "c1");
        Assert.Contains(eventos, e => e.Type == "entrada-cruzou" && e.SegmentId == "c1");
        Assert.DoesNotContain(eventos, e => e.Type == "entrada-cruzou" && e.SegmentId == "c0");
    }

    [Fact]
    public void TD_04_Sem_curvas_lanca()
        => Assert.Throws<ArgumentException>(() => new TrechoDetector(Array.Empty<TrechoSegmento>()));
}
