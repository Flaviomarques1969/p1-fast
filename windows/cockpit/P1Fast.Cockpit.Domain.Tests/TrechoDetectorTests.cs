// TrechoDetector: paridade com web/cockpit/trecho-detector.js — geometria pura
// (distância, lado da linha, cruzamento real, heading, ângulo de ápice) e a máquina
// de estado ao vivo (entrada→freada→ápice→saída, fechamento de emergência, ressync).

using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class TrechoDetectorTests
{
    // ── Geometria isolada ──

    [Fact]
    public void BearingDeg_aponta_norte_e_leste()
    {
        var origem = new GpsPonto(-15.0, -47.0);
        double norte = TrechoGeometria.BearingDeg(origem, new GpsPonto(-14.0, -47.0));
        double leste = TrechoGeometria.BearingDeg(origem, new GpsPonto(-15.0, -46.0));
        Assert.Equal(0, norte, 1);
        Assert.Equal(90, leste, 1);
    }

    [Fact]
    public void SideOfLine_troca_de_sinal_dos_dois_lados()
    {
        var a = new GpsPonto(-15.0, -47.0001);
        var b = new GpsPonto(-15.0, -46.9999);
        double sul = TrechoGeometria.SideOfLine(new GpsPonto(-15.0001, -47.0), a, b);
        double norte = TrechoGeometria.SideOfLine(new GpsPonto(-14.9999, -47.0), a, b);
        Assert.NotEqual(Math.Sign(sul), Math.Sign(norte));
    }

    [Fact]
    public void CaminhoCruzaLinha_distingue_cruzamento_real_de_longe()
    {
        var a = new GpsPonto(-15.0, -47.0001);
        var b = new GpsPonto(-15.0, -46.9999);
        // caminho sobre o meio da linha → cruza
        Assert.True(TrechoGeometria.CaminhoCruzaLinha(
            new GpsPonto(-15.0001, -47.0), new GpsPonto(-14.9999, -47.0), a, b));
        // mesma troca de lado, mas bem a leste das pontas → NÃO cruza o segmento
        Assert.False(TrechoGeometria.CaminhoCruzaLinha(
            new GpsPonto(-15.0001, -46.9000), new GpsPonto(-14.9999, -46.9000), a, b));
    }

    [Fact]
    public void ApexErrorAngleDeg_apice_a_frente_da_zero()
    {
        // carro em (-15,-47) apontando pro norte; ápice ao norte → ~0°
        var carPos = new GpsPonto(-15.0, -47.0);
        var apex = new GpsPonto(-14.999, -47.0);
        double ang = TrechoGeometria.ApexErrorAngleDeg(carPos, 0, apex);
        Assert.Equal(0, ang, 0);
    }

    // ── Máquina de estado ──

    // Trecho único, orientado sul→norte: entrada ao sul (lat -15.0020), ápice no meio
    // (lat -15.0010), saída ao norte (lat -15.0000). Linhas leste-oeste de ~21 m.
    private static TrechoSegmento SegUnico() => new(
        Id: "curva-1",
        Nome: "Curva 1",
        EntradaLine: new(new GpsPonto(-15.0020, -46.9999), new GpsPonto(-15.0020, -47.0001)),
        ApicePoint: new GpsPonto(-15.0010, -47.0000),
        SaidaLine: new(new GpsPonto(-15.0000, -46.9999), new GpsPonto(-15.0000, -47.0001)));

    private static (TrechoDetector det, List<TrechoEvento> ev) Novo(params TrechoSegmento[] segs)
    {
        var ev = new List<TrechoEvento>();
        var det = new TrechoDetector(segs, e => ev.Add(e));
        return (det, ev);
    }

    [Fact]
    public void Replay_emite_os_quatro_momentos_em_ordem()
    {
        var (det, ev) = Novo(SegUnico());
        // sul→norte, freando até o ápice e acelerando na saída (kmh em queda e subida)
        det.IngestGps(-15.0025, -47.0000, 120, 0);     // antes da entrada
        det.IngestGps(-15.0015, -47.0000, 90, 1000);   // cruzou entrada (+ freada forte)
        det.IngestGps(-15.0012, -47.0000, 65, 2000);   // freando, aproxima ápice
        det.IngestGps(-15.0010, -47.0000, 55, 3000);   // no ápice (mínima distância)
        det.IngestGps(-15.0008, -47.0000, 60, 4000);   // afasta do ápice → apice-cruzou
        det.IngestGps(-15.0005, -47.0000, 80, 5000);   // acelerando, antes da saída
        det.IngestGps(-14.9995, -47.0000, 100, 6000);  // cruzou saída → completa

        var tipos = ev.Select(e => e.Type).ToList();
        Assert.Contains("entrada-cruzou", tipos);
        Assert.Contains("freada-iniciou", tipos);
        Assert.Contains("apice-cruzou", tipos);
        Assert.Contains("saida-cruzou", tipos);

        // ordem canônica: entrada antes da freada antes do ápice antes da saída
        Assert.True(tipos.IndexOf("entrada-cruzou") < tipos.IndexOf("freada-iniciou"));
        Assert.True(tipos.IndexOf("freada-iniciou") < tipos.IndexOf("apice-cruzou"));
        Assert.True(tipos.IndexOf("apice-cruzou") < tipos.IndexOf("saida-cruzou"));

        var saida = ev.Single(e => e.Type == "saida-cruzou");
        Assert.True(saida.Completed);
        Assert.Equal("curva-1", saida.SegmentId);
        // depois de completar, o detector volta pro trecho 0 (única curva) em ANTES_ENTRADA
        Assert.Equal(TrechoFase.AntesEntrada, det.Phase);
    }

    [Fact]
    public void Sem_freada_nao_emite_freada_mas_fecha_o_trecho()
    {
        var (det, ev) = Novo(SegUnico());
        // velocidade quase constante (kink) — nenhuma desaceleração relevante
        det.IngestGps(-15.0025, -47.0000, 118, 0);
        det.IngestGps(-15.0015, -47.0000, 117, 1000);
        det.IngestGps(-15.0010, -47.0000, 117, 2000);
        det.IngestGps(-15.0008, -47.0000, 118, 3000);
        det.IngestGps(-14.9995, -47.0000, 119, 4000);

        var tipos = ev.Select(e => e.Type).ToList();
        Assert.Contains("entrada-cruzou", tipos);
        Assert.DoesNotContain("freada-iniciou", tipos);
        Assert.Contains("apice-cruzou", tipos);
        Assert.Contains("saida-cruzou", tipos);
    }

    [Fact]
    public void Apice_nunca_avaliado_fecha_por_emergencia_sem_inventar_valor()
    {
        // sem ponto de ápice (semente ausente): o bloco de ápice nunca roda, lastApiceDist
        // fica Infinity, então a saída fecha por emergência com distFromIdealM null —
        // NUNCA inventa um número (achado do replay 10/06).
        var seg = new TrechoSegmento(
            Id: "curva-x",
            Nome: null,
            EntradaLine: new(new GpsPonto(-15.0020, -46.9999), new GpsPonto(-15.0020, -47.0001)),
            ApicePoint: null,
            SaidaLine: new(new GpsPonto(-15.0000, -46.9999), new GpsPonto(-15.0000, -47.0001)));
        var (det, ev) = Novo(seg);

        det.IngestGps(-15.0025, -47.0000, 100, 0);
        det.IngestGps(-15.0015, -47.0000, 70, 1000);
        det.IngestGps(-15.0008, -47.0000, 70, 2000);
        det.IngestGps(-14.9995, -47.0000, 90, 3000);

        var apice = ev.Single(e => e.Type == "apice-cruzou");
        Assert.True(apice.FechamentoDeEmergencia);
        Assert.Null(apice.DistFromIdealM);   // nunca avaliou → não inventa número
        Assert.Contains(ev, e => e.Type == "saida-cruzou");
    }

    [Fact]
    public void Ressincroniza_quando_carro_cruza_a_entrada_de_outro_trecho()
    {
        // dois trechos. O detector começa no 0, mas o carro entra direto no trecho 1
        // (o 0 foi "perdido"). O vigia paralelo reengata no 1 e emite resync + entrada.
        var seg0 = new TrechoSegmento("c0", null,
            new(new GpsPonto(-15.0020, -46.9999), new GpsPonto(-15.0020, -47.0001)),
            new GpsPonto(-15.0010, -47.0000),
            new(new GpsPonto(-15.0000, -46.9999), new GpsPonto(-15.0000, -47.0001)));
        // trecho 1: entrada a LESTE, lat -16 (longe do 0), linha norte-sul cruzada indo a leste
        var seg1 = new TrechoSegmento("c1", null,
            new(new GpsPonto(-16.0001, -47.0000), new GpsPonto(-15.9999, -47.0000)),
            new GpsPonto(-16.0000, -46.9990),
            new(new GpsPonto(-16.0001, -46.9980), new GpsPonto(-15.9999, -46.9980)));
        var (det, ev) = Novo(seg0, seg1);

        // semeia os lados (sem cruzar nada) e depois cruza a entrada do trecho 1
        det.IngestGps(-16.0000, -47.0010, 80, 0);   // a oeste da entrada do c1
        det.IngestGps(-16.0000, -46.9990, 80, 1000); // a leste → cruzou entrada do c1

        Assert.Contains(ev, e => e.Type == "resync" && e.DeSegmentId == "c0" && e.ParaSegmentId == "c1");
        Assert.Equal(1, det.CurrentSegmentIdx);
        Assert.Equal("c1", det.CurrentSegmentId);
    }

    [Fact]
    public void Amostra_invalida_e_ignorada()
    {
        var (det, ev) = Novo(SegUnico());
        det.IngestGps(double.NaN, -47.0, 100, 0);
        det.IngestGps(-15.0, double.PositiveInfinity, 100, 1000);
        Assert.Empty(ev);
    }

    [Fact]
    public void Segments_vazio_lanca()
    {
        Assert.Throws<ArgumentException>(() => new TrechoDetector(Array.Empty<TrechoSegmento>()));
    }

    [Fact]
    public void SetSegment_fora_do_intervalo_lanca()
    {
        var (det, _) = Novo(SegUnico());
        Assert.Throws<ArgumentException>(() => det.SetSegment(5));
    }
}
