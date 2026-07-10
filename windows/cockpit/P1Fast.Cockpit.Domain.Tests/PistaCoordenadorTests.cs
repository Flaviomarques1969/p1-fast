// PistaCoordenador — a COMPOSIÇÃO do mapeamento de pista desconhecida (Fases A e D, desenho 2026-07-10):
// MapeadorPista (fecho da volta) + CortadorTrechos (segmenta e congela) + PistaStore (persiste local).
// Trilha SINTÉTICA: um circuito retangular percorrido N voltas, FORA da caixa de Brasília, com a reta
// de baixo como a mais RÁPIDA (âncora da linha) e mergulhos gaussianos nos 4 cantos (as 4 curvas que o
// cortador tem que achar). Trava: mapeia→congela→SegmentosProntos; inércia em Brasília; carrega uma
// pista salva noutra sessão (D2); e a evolução HONESTA do estado da tela (reconhecendo→mapeando→mapeada).

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class PistaCoordenadorTests
{
    // Centro geográfico da pista sintética (fora da caixa de Brasília: lat -16.1..-15.4).
    private const double CentroLat = -23.70;
    private const double CentroLon = -46.70;
    private const double MPerDegLat = 111_132.0;
    private static double MPerDegLon => 111_320.0 * Math.Cos(CentroLat * Math.PI / 180.0);

    private static double Sq(double v) => v * v;
    private static double Gauss(double d, double prof, double sig) => prof * Math.Exp(-(d * d) / (sig * sig));

    private static PontoGps DeMetros(double xEast, double yNorth)
        => new(CentroLat + yNorth / MPerDegLat, CentroLon + xEast / MPerDegLon);

    // Circuito retangular 2*hw × 2*hh, N voltas, sentido horário a partir do meio da borda esquerda.
    // Cantos = mergulhos gaussianos (as 4 curvas); reta de baixo com pico no centro (a reta principal).
    private static List<(PontoGps P, double Kmh, long T)> GerarCircuito(
        double hw = 250, double hh = 150, int voltas = 6, double stepM = 8,
        double vBase = 100, double prof = 55, double sigma = 25, double bottomBoost = 45)
    {
        (double x, double y)[] wps =
        {
            (-hw, 0), (-hw, hh), (hw, hh), (hw, -hh), (-hw, -hh), (-hw, 0),
        };
        (double x, double y)[] cantos = { (-hw, hh), (hw, hh), (hw, -hh), (-hw, -hh) };

        double DistCanto(double x, double y)
        {
            double melhor = double.MaxValue;
            foreach (var c in cantos) melhor = Math.Min(melhor, Math.Sqrt(Sq(x - c.x) + Sq(y - c.y)));
            return melhor;
        }

        var xy = new List<(double x, double y)> { wps[0] };
        for (var v = 0; v < voltas; v++)
            for (var s = 0; s < 5; s++)
            {
                var a = wps[s]; var b = wps[s + 1];
                var len = Math.Sqrt(Sq(b.x - a.x) + Sq(b.y - a.y));
                var steps = Math.Max(1, (int)Math.Round(len / stepM));
                for (var k = 1; k <= steps; k++)
                {
                    var t = (double)k / steps;
                    xy.Add((a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t));
                }
            }

        var outp = new List<(PontoGps, double, long)>();
        double tMs = 0;
        (double x, double y)? prev = null;
        foreach (var (x, y) in xy)
        {
            var v = vBase - Gauss(DistCanto(x, y), prof, sigma);
            if (Math.Abs(y - (-hh)) < 0.5) v += bottomBoost * (1 - Math.Abs(x) / hw);   // reta de baixo = mais rápida
            if (prev is { } pr) tMs += Math.Sqrt(Sq(x - pr.x) + Sq(y - pr.y)) / (v / 3.6) * 1000.0;
            outp.Add((DeMetros(x, y), v, (long)tMs));
            prev = (x, y);
        }
        return outp;
    }

    // Circuito com velocidade EXATAMENTE constante, exceto uma "corcova" compacta (tenda linear que
    // volta a zero num raio R) na reta de baixo — a âncora da linha. Fora do raio a velocidade é a
    // MESMA (double idêntico) → nenhum mínimo local estrito → o cortador NUNCA acha ápice, NUNCA
    // congela. O mapeador ainda acha o fecho e CONFIRMA a linha (a corcova é o ponto mais rápido).
    // Isola o estado "Mapeando" (linha confirmada, ainda sem trechos), pra provar reconhecendo → mapeando.
    private static List<(PontoGps P, double Kmh, long T)> GerarPlano(
        double hw = 250, double hh = 150, int voltas = 4, double stepM = 8,
        double baseKmh = 90, double corcova = 60, double raioM = 120)
    {
        (double x, double y)[] wps = { (-hw, 0), (-hw, hh), (hw, hh), (hw, -hh), (-hw, -hh), (-hw, 0) };
        var xy = new List<(double x, double y)> { wps[0] };
        for (var v = 0; v < voltas; v++)
            for (var s = 0; s < 5; s++)
            {
                var a = wps[s]; var b = wps[s + 1];
                var len = Math.Sqrt(Sq(b.x - a.x) + Sq(b.y - a.y));
                var steps = Math.Max(1, (int)Math.Round(len / stepM));
                for (var k = 1; k <= steps; k++)
                {
                    var t = (double)k / steps;
                    xy.Add((a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t));
                }
            }

        var outp = new List<(PontoGps, double, long)>();
        double tMs = 0;
        (double x, double y)? prev = null;
        foreach (var (x, y) in xy)
        {
            // distância ao centro da reta de baixo (0,-hh); tenda compacta só dentro do raio.
            var d = Math.Sqrt(Sq(x - 0) + Sq(y - (-hh)));
            var kmh = baseKmh + (d < raioM ? corcova * (1 - d / raioM) : 0);   // fora do raio: baseKmh EXATO
            if (prev is { } pr) tMs += Math.Sqrt(Sq(x - pr.x) + Sq(y - pr.y)) / (kmh / 3.6) * 1000.0;
            outp.Add((DeMetros(x, y), kmh, (long)tMs));
            prev = (x, y);
        }
        return outp;
    }

    private static string TempDir()
        => Path.Combine(Path.GetTempPath(), "p1fast-pista-coord-" + Path.GetRandomFileName());

    // ── (1) Fora de Brasília: mapeia → CONGELA → SegmentosProntos com os trechos ────────────
    [Fact]
    public void PC_01_Fora_de_brasilia_mapeia_congela_e_entrega_os_trechos()
    {
        var dir = TempDir();
        try
        {
            var coord = new PistaCoordenador(new PistaStore(dir));
            IReadOnlyList<TrechoSegmento>? entregues = null;
            var vezes = 0;
            coord.SegmentosProntos += segs => { entregues = segs; vezes++; };

            foreach (var (p, kmh, t) in GerarCircuito())
                coord.Ingest(p, kmh, headingDeg: null, tWallMs: t);

            Assert.True(coord.Congelada, "a pista deveria ter congelado");
            Assert.NotNull(entregues);
            Assert.Equal(1, vezes);                                   // entrega UMA vez (ao congelar)
            Assert.Equal(4, entregues!.Count);                       // 4 cantos = 4 trechos
            Assert.Same(coord.Segmentos, entregues);                 // o que a tela lê == o entregue
            Assert.Equal(new[] { "t01", "t02", "t03", "t04" }, entregues.Select(s => s.Id).ToArray());
            Assert.NotNull(coord.PistaId);
        }
        finally { try { Directory.Delete(dir, true); } catch { } }
    }

    // ── (2) Dentro da caixa de Brasília o coordenador fica INERTE (Brasília hardcoded vence) ──
    [Fact]
    public void PC_02_Dentro_de_brasilia_fica_inerte()
    {
        var dir = TempDir();
        try
        {
            var coord = new PistaCoordenador(new PistaStore(dir));
            var disparou = false;
            coord.SegmentosProntos += _ => disparou = true;

            // Um "circuito" dentro da caixa de Brasília (linha de chegada real por perto).
            var latc = (PistaBrasilia.LatMin + PistaBrasilia.LatMax) / 2;   // ≈ -15.75
            var lonc = (PistaBrasilia.LonMin + PistaBrasilia.LonMax) / 2;
            long t = 0;
            for (var i = 0; i < 500; i++)
            {
                var ang = i * 0.05;
                var p = new PontoGps(latc + 0.005 * Math.Sin(ang), lonc + 0.005 * Math.Cos(ang));
                var prog = coord.Ingest(p, 120, headingDeg: null, tWallMs: t);
                Assert.Equal(EstadoTelaPista.Inerte, prog.Estado);
                t += 300;
            }

            Assert.False(coord.Congelada);
            Assert.False(disparou);
            Assert.Null(coord.PistaId);
            Assert.Equal(0, coord.VoltasFechadas);
        }
        finally { try { Directory.Delete(dir, true); } catch { } }
    }

    // ── (3) Pista salva numa sessão → a próxima sessão RECONHECE e carrega direto (D2) ──────
    [Fact]
    public void PC_03_Segunda_sessao_carrega_a_pista_salva_direto()
    {
        var dir = TempDir();
        try
        {
            var trilha = GerarCircuito();

            // Sessão 1: aprende e persiste (PistaStore aponta pra mesma pasta temp).
            var store = new PistaStore(dir);
            var s1 = new PistaCoordenador(store);
            foreach (var (p, kmh, t) in trilha) s1.Ingest(p, kmh, null, t);
            Assert.True(s1.Congelada);
            var idAprendido = s1.PistaId;
            var nTrechos = s1.Segmentos!.Count;

            // Sessão 2: NOVO coordenador, mesma pasta. O 1º fix (na pista) reconhece pela posição.
            var s2 = new PistaCoordenador(new PistaStore(dir));
            IReadOnlyList<TrechoSegmento>? entregues = null;
            s2.SegmentosProntos += segs => entregues = segs;

            var (p0, kmh0, t0) = trilha[0];
            var prog = s2.Ingest(p0, kmh0, null, t0);

            Assert.Equal(EstadoTelaPista.PistaConhecida, prog.Estado);
            Assert.Equal(idAprendido, prog.PistaId);
            Assert.Equal(idAprendido, s2.PistaId);
            Assert.True(s2.Congelada);
            Assert.NotNull(entregues);                       // entrega os trechos no 1º fix (sem re-mapear)
            Assert.Equal(nTrechos, entregues!.Count);
        }
        finally { try { Directory.Delete(dir, true); } catch { } }
    }

    // ── (4) O estado da tela evolui na ordem HONESTA: reconhecendo → mapeando → mapeada ──────
    // Duas trilhas complementares provam a progressão inteira sem número inventado:
    //   A) lados PLANOS: confirma a linha mas não congela → reconhecendo → MAPEANDO (nunca Mapeada).
    //   B) 4 cantos: mapeia e congela → reconhecendo → MAPEADA (o congelar coincide com a confirmação
    //      da linha numa trilha limpa, então Mapeando não aparece — a parte A cobre esse estado).
    [Fact]
    public void PC_04_Estado_da_tela_evolui_na_ordem_certa()
    {
        // A) confirma a linha, nunca congela → o estado Mapeando aparece e PERSISTE.
        var dirA = TempDir();
        try
        {
            var coordA = new PistaCoordenador(new PistaStore(dirA));
            var seqA = new List<EstadoTelaPista>();
            // corcova=0 → velocidade EXATAMENTE constante: sem mínimo local, o cortador nunca acha
            // ápice e nunca congela — mas a linha confirma (períodos iguais). Isola o "Mapeando".
            foreach (var (p, kmh, t) in GerarPlano(corcova: 0))
                seqA.Add(coordA.Ingest(p, kmh, null, t).Estado);

            var iRecA = seqA.IndexOf(EstadoTelaPista.Reconhecendo);
            var iMapA = seqA.IndexOf(EstadoTelaPista.Mapeando);
            Assert.True(iRecA >= 0, "faltou Reconhecendo");
            Assert.True(iMapA > iRecA, "Mapeando deveria vir DEPOIS de Reconhecendo");
            Assert.DoesNotContain(EstadoTelaPista.Mapeada, seqA);      // sem ápice claro: nunca congela
            Assert.DoesNotContain(EstadoTelaPista.Inerte, seqA);      // fora de Brasília: nunca inerte
            Assert.False(coordA.Congelada);
            Assert.Equal(EstadoTelaPista.Mapeando, seqA[^1]);         // termina mapeando (linha confirmada)
        }
        finally { try { Directory.Delete(dirA, true); } catch { } }

        // B) mapeia e CONGELA → reconhecendo antes de mapeada; nenhum estado inventado antes.
        var dirB = TempDir();
        try
        {
            var coordB = new PistaCoordenador(new PistaStore(dirB));
            var seqB = new List<EstadoTelaPista>();
            foreach (var (p, kmh, t) in GerarCircuito())
                seqB.Add(coordB.Ingest(p, kmh, null, t).Estado);

            var iRecB = seqB.IndexOf(EstadoTelaPista.Reconhecendo);
            var iOkB  = seqB.IndexOf(EstadoTelaPista.Mapeada);
            Assert.True(iRecB >= 0, "faltou Reconhecendo");
            Assert.True(iOkB > iRecB, "Mapeada deveria vir DEPOIS de Reconhecendo");
            Assert.DoesNotContain(EstadoTelaPista.Inerte, seqB);
            Assert.Equal(EstadoTelaPista.Mapeada, seqB[^1]);          // termina mapeada (trechos congelados)
        }
        finally { try { Directory.Delete(dirB, true); } catch { } }
    }
}
