// GhostVoltaLoader — acha a MELHOR VOLTA COMPLETA real no fixture de passagens.
// Port fiel do carregarGhost() de web/cockpit/coach-zoom-live.js (estado c840e129):
//   · agrupa passagens por dia|volta; só voltas com TODAS as curvas presentes;
//   · melhor = menor soma de tempo_trecho_s;
//   · pontos da volta ordenados por t; tRel em segundos a partir do 1º.
// Fixture canônico: web/command-box/fixtures/passagens-bubi-brasilia.v1.json
// (real Bubi 23-24/05). Sem fixture: mapa sem ghost — HONESTO, nada inventado.

using System.Text.Json;

namespace P1Fast.Cockpit.Domain;

public static class GhostVoltaLoader
{
    /// <summary>Lê o fixture do disco. Null = sem arquivo/ilegível (mapa segue sem ghost).</summary>
    public static GhostVolta? CarregarDeArquivo(string caminho)
    {
        try { return CarregarDeJson(File.ReadAllText(caminho)); }
        catch { return null; }
    }

    /// <summary>Monta a volta-ghost a partir do JSON do fixture. Null = sem volta completa.</summary>
    public static GhostVolta? CarregarDeJson(string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (!doc.RootElement.TryGetProperty("passagens", out var passagens) ||
                passagens.ValueKind != JsonValueKind.Array) return null;

            static string Norm(string? s) => (s ?? "").ToUpperInvariant().Trim();

            var porVolta = new Dictionary<string, List<JsonElement>>();
            var curvas = new HashSet<string>();
            foreach (var p in passagens.EnumerateArray())
            {
                var k = $"{p.GetProperty("dia").GetString()}|{p.GetProperty("volta").GetRawText()}";
                if (!porVolta.TryGetValue(k, out var lista)) porVolta[k] = lista = new();
                lista.Add(p);
                curvas.Add(Norm(p.GetProperty("curva").GetString()));
            }
            var nCurvas = curvas.Count;

            List<JsonElement>? melhor = null;
            var melhorT = double.PositiveInfinity;
            foreach (var segs in porVolta.Values)
            {
                if (segs.Count < nCurvas) continue;      // volta furada não vira ghost
                double total = 0;
                foreach (var s in segs) total += s.GetProperty("tempo_trecho_s").GetDouble();
                if (total < melhorT) { melhorT = total; melhor = segs; }
            }
            if (melhor is null) return null;

            var pontos = new List<(double Lat, double Lng, double T)>();
            foreach (var seg in melhor)
                foreach (var pt in seg.GetProperty("pontos").EnumerateArray())
                    pontos.Add((pt.GetProperty("lat").GetDouble(),
                                pt.GetProperty("lng").GetDouble(),
                                pt.GetProperty("t").GetDouble()));
            if (pontos.Count < 2) return null;
            pontos.Sort((a, b) => a.T.CompareTo(b.T));

            var t0 = pontos[0].T;
            var pts = new GhostPonto[pontos.Count];
            for (var i = 0; i < pontos.Count; i++)
            {
                var (x, y) = PistaDesenhoBrasilia.GeoParaDesenho(pontos[i].Lat, pontos[i].Lng);
                pts[i] = new GhostPonto(x, y, (pontos[i].T - t0) / 1000.0);
            }
            return new GhostVolta(pts, (pontos[^1].T - t0) / 1000.0);
        }
        catch { return null; }
    }
}
