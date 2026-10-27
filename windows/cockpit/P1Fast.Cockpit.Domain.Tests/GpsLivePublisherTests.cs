// Prova do ENVIO AO VIVO do GPS (GpsLivePublisher), fora de rede real, com relógio simulado:
// LOTE (1 mensagem a cada ~200 ms, topo = fix mais novo, "lote" = os anteriores), fila ao vivo só
// dos últimos ~10 s, queda de internet com reenvio em ordem, conexão meio-morta (o "enviado" dos
// últimos 10 s volta à fila quando o canal cai) e a trava dura do canal de produção.
// E2 da obra "TV do box ao vivo" (27/10/2026). Canal-fake = InMemoryLiveChannel, igual ao do motor.

using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class GpsLivePublisherTests
{
    // Fix no formato EXATO do contrato (cloud-bridge.js evento 'gps').
    private static IDictionary<string, object?> Fix(double lat = -15.77, double lng = -47.90, double kmh = 120, long tWall = 0) =>
        new Dictionary<string, object?>
        {
            ["lat"] = lat, ["lng"] = lng, ["kmh"] = kmh,
            ["numSV"] = 12, ["fix"] = 3, ["accM"] = 1.0, ["tWall"] = tWall, ["source"] = "racebox",
        };

    private sealed class Relogio { public long Ms; public long Agora() => Ms; }

    // Desmonta as mensagens como a TV faz (gps-fonte-unica.js pontosDoGps): lote em ordem, topo por último.
    private static List<long> TWallsEntregues(InMemoryLiveChannel canal)
    {
        var r = new List<long>();
        foreach (var (_, p) in canal.Publicadas)
        {
            if (p.TryGetValue("lote", out var l) && l is IEnumerable<IDictionary<string, object?>> lote)
                r.AddRange(lote.Select(x => (long)x["tWall"]!));
            r.Add((long)p["tWall"]!);
        }
        return r;
    }

    // 25 Hz por `ms` milissegundos: oferece 1 fix e drena a cada 40 ms (o giro do laço da nuvem).
    private static async Task Rodar(GpsLivePublisher pub, Relogio rel, long ms, long tWallInicial = -1)
    {
        long fim = rel.Ms + ms;
        while (rel.Ms < fim)
        {
            pub.Oferecer(Fix(tWall: tWallInicial < 0 ? rel.Ms : tWallInicial + rel.Ms));
            await pub.DrenarAsync(CancellationToken.None);
            rel.Ms += 40;
        }
    }

    [Fact]
    public async Task Lote_CincoMensagensPorSegundo_TodoFixEntregue_EmOrdem()
    {
        var canal = new InMemoryLiveChannel();
        var rel = new Relogio();
        var pub = new GpsLivePublisher(canal, "teste", relogioMs: rel.Agora);

        await Rodar(pub, rel, 2000);              // 2 s a 25 Hz = 50 fixes
        rel.Ms += 200; await pub.DrenarAsync(CancellationToken.None);   // fecha o último lote

        var tw = TWallsEntregues(canal);
        Assert.Equal(50, tw.Count);                                   // nenhum fix perdido (25 Hz de fidelidade)
        Assert.Equal(Enumerable.Range(0, 50).Select(i => (long)i * 40), tw);   // em ordem
        Assert.InRange(canal.Publicadas.Count, 10, 11);               // ~5 mensagens/s, não 25
        Assert.All(canal.Publicadas, m => Assert.Equal("gps", m.Evento));
        Assert.Equal(50, pub.GetStats().Enviadas);
        Assert.Equal(canal.Publicadas.Count, pub.GetStats().Mensagens);
    }

    [Fact]
    public async Task Lote_TopoEhOFixMaisNovo_ComAsChavesDoContrato_LoteSemAninhar()
    {
        var canal = new InMemoryLiveChannel();
        var rel = new Relogio();
        var pub = new GpsLivePublisher(canal, "teste", relogioMs: rel.Agora);
        await pub.DrenarAsync(CancellationToken.None);   // 1º envio "na hora"
        rel.Ms = 1000;
        for (int i = 0; i < 5; i++) pub.Oferecer(Fix(kmh: 100 + i, tWall: 1000 + i * 40));
        await pub.DrenarAsync(CancellationToken.None);

        var m = Assert.Single(canal.Publicadas).Payload;
        Assert.Equal(1160L, m["tWall"]);                              // topo = o MAIS NOVO
        Assert.Equal(104.0, m["kmh"]);
        foreach (var k in new[] { "lat", "lng", "kmh", "numSV", "fix", "accM", "tWall", "source" }) Assert.True(m.ContainsKey(k), k);
        var lote = Assert.IsAssignableFrom<IEnumerable<IDictionary<string, object?>>>(m["lote"]).ToList();
        Assert.Equal(new long[] { 1000, 1040, 1080, 1120 }, lote.Select(x => (long)x["tWall"]!));
        Assert.All(lote, x => Assert.False(x.ContainsKey("lote")));   // sem lote dentro de lote
    }

    [Fact]
    public async Task UmFixSo_SaiSemChaveLote()
    {
        var canal = new InMemoryLiveChannel();
        var pub = new GpsLivePublisher(canal, "teste", relogioMs: () => 0);
        pub.Oferecer(Fix(tWall: 7));
        await pub.DrenarAsync(CancellationToken.None);
        var m = Assert.Single(canal.Publicadas).Payload;
        Assert.False(m.ContainsKey("lote"));
        Assert.Equal(7L, m["tWall"]);
    }

    [Fact]
    public async Task QuedaCurta_NaoPerde_EReenviaEmOrdem_EmLotesCheios()
    {
        var canal = new InMemoryLiveChannel { Online = false }; // internet caída
        var rel = new Relogio();
        var pub = new GpsLivePublisher(canal, "teste", relogioMs: rel.Agora);

        await Rodar(pub, rel, 3000);                       // 3 s sem internet = 75 fixes
        Assert.Empty(canal.Publicadas);
        Assert.Equal(75, pub.GetStats().NaFila);
        Assert.Equal("offline-enfileirando", pub.Saude());

        canal.Online = true;                                // volta
        await pub.DrenarAsync(CancellationToken.None);

        Assert.Equal(Enumerable.Range(0, 75).Select(i => (long)i * 40), TWallsEntregues(canal));
        Assert.Equal(3, canal.Publicadas.Count);            // 25 + 25 + 25: alcança o presente de uma vez
        Assert.Equal(0, pub.GetStats().NaFila);
        Assert.Equal(0, pub.GetStats().ForaDoAoVivo);
    }

    [Fact]
    public async Task QuedaLonga_AoVivoSoLevaOsUltimos10s_ORestoFicaNoDisco()
    {
        var canal = new InMemoryLiveChannel { Online = false };
        var rel = new Relogio();
        var pub = new GpsLivePublisher(canal, "teste", relogioMs: rel.Agora);

        await Rodar(pub, rel, 60_000);                      // 1 min sem internet = 1500 fixes
        var st = pub.GetStats();
        Assert.InRange(st.NaFila, 250, 252);               // ~10 s a 25 Hz
        Assert.Equal(1500 - st.NaFila, st.ForaDoAoVivo);   // perda do AO VIVO contada (disco tem tudo)

        canal.Online = true;
        await pub.DrenarAsync(CancellationToken.None);
        var tw = TWallsEntregues(canal);
        Assert.Equal(59_960, tw[^1]);                       // chega até o mais novo
        Assert.True(tw[0] >= 49_920, $"mais velho enviado = {tw[0]} (passado de > 10 s não vai pra TV)");
        Assert.Equal(tw.OrderBy(x => x), tw);               // ordem
        Assert.InRange(canal.Publicadas.Count, 10, 11);     // 250 fixes em lotes de 25
    }

    [Fact]
    public async Task ConexaoMeioMorta_OEnviadoDosUltimos10s_VoltaAFila_QuandoOCanalCai()
    {
        var canal = new InMemoryLiveChannel();
        var rel = new Relogio();
        var pub = new GpsLivePublisher(canal, "teste", relogioMs: rel.Agora);

        await Rodar(pub, rel, 20_000);                      // 20 s "entregando" (socket já morto nos últimos)
        var enviados = TWallsEntregues(canal).Count;
        canal.Online = false;                               // o canal finalmente percebe a queda
        await Rodar(pub, rel, 2_000);                       // religando
        Assert.True(pub.GetStats().Reenviados > 0);
        canal.Online = true;
        await pub.DrenarAsync(CancellationToken.None);

        var tw = TWallsEntregues(canal).Skip(enviados).ToList();
        // O reenvio começa ~10 s antes da queda (o que pode ter caído no buffer do socket morto)...
        Assert.InRange(tw[0], 11_960, 12_100);
        // ...vai em ordem, sem buraco, até o fix mais novo da religação.
        Assert.Equal(tw.OrderBy(x => x), tw);
        Assert.Equal(21_960, tw[^1]);
        Assert.True(tw.Zip(tw.Skip(1), (a, b) => b - a).All(d => d == 40), "sem buraco");
    }

    [Fact]
    public async Task Controle_SemQueda_NadaEhReenviado()
    {
        var canal = new InMemoryLiveChannel();
        var rel = new Relogio();
        var pub = new GpsLivePublisher(canal, "teste", relogioMs: rel.Agora);
        await Rodar(pub, rel, 20_000);
        Assert.Equal(0, pub.GetStats().Reenviados);
        var tw = TWallsEntregues(canal);
        Assert.Equal(tw.Distinct().Count(), tw.Count);      // nenhum repetido
    }

    [Fact]
    public void FilaCheia_DescartaOMaisVelho_EConta()
    {
        var canal = new InMemoryLiveChannel { Online = false };
        var pub = new GpsLivePublisher(canal, "teste", filaMax: 3, relogioMs: () => 0);

        for (int i = 0; i < 5; i++) pub.Oferecer(Fix(tWall: i * 40)); // 5 numa fila de 3

        Assert.Equal(3, pub.GetStats().NaFila);
        Assert.Equal(2, pub.GetStats().Descartadas);
    }

    [Fact]
    public async Task FalhaNoEnvio_SeguraOLote_EReenvia()
    {
        var canal = new InMemoryLiveChannel();
        var pub = new GpsLivePublisher(canal, "teste", relogioMs: () => 0);

        for (int i = 0; i < 5; i++) pub.Oferecer(Fix(tWall: i * 40));
        canal.FalharProximosEnvios = 1;          // 1 soluço de envio, depois recupera
        await pub.DrenarAsync(CancellationToken.None);

        Assert.Empty(canal.Publicadas);          // parou no envio que falhou
        Assert.Equal(5, pub.GetStats().NaFila);  // nada perdido
        Assert.Equal(1, pub.GetStats().Erros);

        await pub.DrenarAsync(CancellationToken.None); // 2ª passada: nuvem ok
        Assert.Equal(new long[] { 0, 40, 80, 120, 160 }, TWallsEntregues(canal));
        Assert.Equal(0, pub.GetStats().NaFila);
    }

    [Fact]
    public void CanalProducao_SemAutorizacao_NaoConstroi()
    {
        var canal = new InMemoryLiveChannel();
        Assert.Throws<System.InvalidOperationException>(
            () => new GpsLivePublisher(canal, GpsLivePublisher.CanalProducao, permitirProducao: false));
    }

    [Fact]
    public async Task CanalProducao_ComAutorizacao_Publica()
    {
        var canal = new InMemoryLiveChannel();
        var pub = new GpsLivePublisher(canal, GpsLivePublisher.CanalProducao, permitirProducao: true);

        pub.Oferecer(Fix(tWall: 0));
        await pub.DrenarAsync(CancellationToken.None);

        Assert.Single(canal.Publicadas);
        Assert.Equal("gps", canal.Publicadas[0].Evento);
    }
}
