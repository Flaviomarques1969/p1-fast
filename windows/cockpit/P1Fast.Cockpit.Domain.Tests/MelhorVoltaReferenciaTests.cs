// MelhorVoltaReferencia — os 2 números grandes do painel do notebook comparam com a MESMA curva
// na MELHOR VOLTA (Flávio 2026-10-28). Trava: as cores (freada amarelo/verde 10%/vermelho; saída
// verde ≥ / vermelho <), a troca de referência só por volta válida e mais rápida, curva sem medida
// mantendo a referência antiga, a gravação no armazém (ida e volta, sem vazar para os recordes de
// trecho), a luz de freio mirando o ponto da melhor volta e o maestro emitindo "numeros".

using System.IO;
using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class MelhorVoltaReferenciaTests
{
    private static MetadadosRecorde Meta() => new(1000, "s1", "Brasilia", "celta", "");

    private static Dictionary<string, ReferenciaCurva> Curvas(params (string Seg, double? F, double? S)[] cs)
        => cs.ToDictionary(c => c.Seg, c => new ReferenciaCurva(c.F, c.S));

    // ── Cores e números ──────────────────────────────────────────────

    [Fact]
    public void MVR_01_Freada_dentro_de_10_por_cento_e_verde()
    {
        var n = NumerosInfo.Comparar(108, null, new ReferenciaCurva(100, null));
        Assert.Equal(8, n.FreadaM);
        Assert.Equal(FreioTom.Bom, n.FreadaTom);
        // limite exato (10 m de 100 m) ainda é verde
        Assert.Equal(FreioTom.Bom, NumerosInfo.Comparar(90, null, new ReferenciaCurva(100, null)).FreadaTom);
    }

    [Fact]
    public void MVR_02_Freada_fora_da_faixa_antes_amarelo_depois_vermelho()
    {
        var antes = NumerosInfo.Comparar(125, null, new ReferenciaCurva(100, null));
        Assert.Equal(25, antes.FreadaM);
        Assert.Equal(FreioTom.Foco, antes.FreadaTom);    // freou mais longe do ápice = ANTES

        var depois = NumerosInfo.Comparar(80, null, new ReferenciaCurva(100, null));
        Assert.Equal(20, depois.FreadaM);                 // número sem sinal
        Assert.Equal(FreioTom.Erro, depois.FreadaTom);    // freou mais perto do ápice = DEPOIS
    }

    [Fact]
    public void MVR_03_Saida_igual_ou_mais_rapida_verde_mais_lenta_vermelho()
    {
        var igual = NumerosInfo.Comparar(null, 92, new ReferenciaCurva(null, 92));
        Assert.Equal(0, igual.SaidaKmh);
        Assert.Equal(Tone.Bom, igual.SaidaTom);

        Assert.Equal(Tone.Bom, NumerosInfo.Comparar(null, 95, new ReferenciaCurva(null, 92)).SaidaTom);

        var lenta = NumerosInfo.Comparar(null, 88, new ReferenciaCurva(null, 92));
        Assert.Equal(4, lenta.SaidaKmh);
        Assert.Equal(Tone.Erro, lenta.SaidaTom);
    }

    [Fact]
    public void MVR_04_Sem_referencia_numeros_em_branco()
    {
        Assert.Equal(NumerosInfo.Vazio(), NumerosInfo.Comparar(120, 90, null));
        var soFreada = NumerosInfo.Comparar(120, 90, new ReferenciaCurva(100, null));
        Assert.NotNull(soFreada.FreadaM);
        Assert.Null(soFreada.SaidaKmh);                   // sem saída na referência = direita em branco
        Assert.Equal(Tone.Neutro, soFreada.SaidaTom);
    }

    // ── Troca de referência ──────────────────────────────────────────

    [Fact]
    public void MVR_05_Volta_mais_rapida_troca_volta_pior_nao_troca()
    {
        var r = new ReferenciaMelhorVolta();
        r.AnotarPassagem("c1", 100, 90);
        Assert.True(r.FecharVolta(80_000));               // 1ª volta válida vira referência
        Assert.Equal(80_000, r.TempoMs);

        r.AnotarPassagem("c1", 70, 80);
        Assert.False(r.FecharVolta(81_000));              // mais lenta: NÃO troca (controle)
        Assert.Equal(new ReferenciaCurva(100, 90), r.Obter("c1"));

        r.AnotarPassagem("c1", 110, 95);
        Assert.True(r.FecharVolta(79_000));               // mais rápida: troca
        Assert.Equal(79_000, r.TempoMs);
        Assert.Equal(new ReferenciaCurva(110, 95), r.Obter("c1"));
    }

    [Fact]
    public void MVR_06_Volta_implausivel_ou_cruzamento_sem_volta_nao_vira_e_zera_anotacoes()
    {
        var r = new ReferenciaMelhorVolta();
        r.AnotarPassagem("c1", 100, 90);
        Assert.False(r.FecharVolta(39_000));              // < 40 s (box→linha / ruído)
        Assert.Null(r.TempoMs);

        r.AnotarPassagem("c1", 100, 90);
        Assert.False(r.FecharVolta(null));                // 1º cruzamento da sessão
        Assert.Null(r.Obter("c1"));

        // as anotações zeraram: volta válida SEM passagem nova não herda as curvas descartadas
        Assert.False(r.FecharVolta(80_000));
        Assert.Null(r.TempoMs);
    }

    [Fact]
    public void MVR_07_Curva_sem_medida_na_volta_nova_mantem_a_referencia_antiga()
    {
        var r = new ReferenciaMelhorVolta();
        r.Semear(80_000, Curvas(("c1", 100, 90), ("c2", 60, 70)));

        r.AnotarPassagem("c1", 105, null);                // c1 sem saída medida; c2 nem passou (buraco de GPS)
        Assert.True(r.FecharVolta(79_000));

        Assert.Equal(new ReferenciaCurva(105, 90), r.Obter("c1")); // saída antiga mantida
        Assert.Equal(new ReferenciaCurva(60, 70), r.Obter("c2"));  // curva inteira mantida
    }

    [Fact]
    public void MVR_08_Semear_sem_tempo_valido_fica_sem_referencia()
    {
        var r = new ReferenciaMelhorVolta();
        r.Semear(null, Curvas(("c1", 100, 90)));
        Assert.Null(r.TempoMs);
        Assert.Null(r.Obter("c1"));

        r.Semear(80_000, Curvas(("c1", 100, 90)));
        Assert.NotNull(r.Obter("c1"));                    // controle: com tempo válido carrega
    }

    // ── Armazém: ida e volta ─────────────────────────────────────────

    [Fact]
    public void MVR_09_Gravar_e_ler_no_armazem_ida_e_volta_substitui_o_conjunto()
    {
        var a = new ArmazemRecordes { CarroId = "celta" };
        a.GravarReferenciaMelhorVolta(80_000, Curvas(("c1", 100, 90), ("t.2", 60, null)), Meta());

        var (tempo, curvas) = a.LerReferenciaMelhorVolta();
        Assert.Equal(80_000, tempo);
        Assert.Equal(new ReferenciaCurva(100, 90), curvas["c1"]);
        Assert.Equal(new ReferenciaCurva(60, null), curvas["t.2"]); // segId com ponto também volta inteiro

        // gravar de novo substitui o conjunto inteiro (c1 some — é outra volta)
        a.GravarReferenciaMelhorVolta(79_000, Curvas(("t.2", 61, 72)), Meta());
        var (tempo2, curvas2) = a.LerReferenciaMelhorVolta();
        Assert.Equal(79_000, tempo2);
        Assert.False(curvas2.ContainsKey("c1"));
        Assert.Equal(new ReferenciaCurva(61, 72), curvas2["t.2"]);
    }

    [Fact]
    public void MVR_10_Referencia_nao_mexe_nos_recordes_e_sobrevive_ao_arquivo()
    {
        var dir = Path.Combine(Path.GetTempPath(), "p1fast-mvr-" + Path.GetRandomFileName());
        try
        {
            var store = new FileRecordesStore(dir);
            var a = store.Carregar("celta");
            a.Tentar(ArmazemRecordes.ChaveVolta, 81_000, SentidoRecorde.Menor, Meta());
            a.GravarReferenciaMelhorVolta(80_000, Curvas(("c1", 100, 90)), Meta());
            Assert.Equal(81_000, a.Obter(ArmazemRecordes.ChaveVolta)!.Valor); // recorde de volta intacto

            // a chave "melhorvolta.tempo" termina em ".tempo" como os recordes de trecho — o filtro
            // da UI (SemearRecordesNoCerebro) precisa do prefixo para não semeá-la como trecho.
            Assert.EndsWith("." + ArmazemRecordes.MetTempo, ArmazemRecordes.ChaveMelhorVoltaTempo);
            Assert.StartsWith(ArmazemRecordes.PrefixoMelhorVolta, ArmazemRecordes.ChaveMelhorVoltaTempo);

            store.Salvar(a);
            var (tempo, curvas) = store.Carregar("celta").LerReferenciaMelhorVolta();
            Assert.Equal(80_000, tempo);
            Assert.Equal(new ReferenciaCurva(100, 90), curvas["c1"]);
        }
        finally { if (Directory.Exists(dir)) Directory.Delete(dir, recursive: true); }
    }

    [Fact]
    public void MVR_11_Armazem_sem_referencia_le_vazio()
    {
        var (tempo, curvas) = new ArmazemRecordes().LerReferenciaMelhorVolta();
        Assert.Null(tempo);
        Assert.Empty(curvas);
    }

    // ── Luz de freio: mira a melhor volta ────────────────────────────

    [Fact]
    public void MVR_12_Luz_mira_melhor_volta_depois_melhor_passagem_depois_partida()
    {
        var seg = new TrechoSegmento("c0", "Curva 0",
            new LinhaGps(new PontoGps(-0.001, 0), new PontoGps(0.001, 0)),
            new PontoGps(0, 0.0005),
            new LinhaGps(new PontoGps(-0.001, 0.001), new PontoGps(0.001, 0.001)));
        var luz = new LuzFreio(new[] { seg });

        Assert.Equal(LuzFreio.FreioFallbackM, luz.PontoMirado("c0"));   // sem nada: ponto de partida

        luz.DefinirPontoMelhorVolta("c0", 140);
        Assert.Equal(140, luz.PontoMirado("c0"));                        // melhor volta manda
        luz.DefinirPontoMelhorVolta("c0", double.NaN);                   // lixo não sobrescreve
        Assert.Equal(140, luz.PontoMirado("c0"));
    }

    // ── Maestro: emite "numeros" ─────────────────────────────────────

    // Mesma curva/volta do CockpitOrchestratorTests: leg de baixo cruza entrada, ápice e saída.
    private static TrechoSegmento Curva() =>
        new("c0", "Curva 0",
            new LinhaGps(new PontoGps(-0.001, 0), new PontoGps(0.001, 0)),
            new PontoGps(0, 0.0005),
            new LinhaGps(new PontoGps(-0.001, 0.001), new PontoGps(0.001, 0.001)));

    private static double UmaVolta(CockpitOrchestrator orq, double kmh, double t)
    {
        var dt = 100.0 * (100.0 / kmh);
        foreach (var lng in new[] { -0.0006, -0.0002, 0.0002, 0.0004, 0.0006, 0.0010, 0.0014, 0.0018 })
        { orq.IngestGps(new AmostraGps(0, lng, kmh, t)); t += dt; }
        foreach (var lat in new[] { 0.002, 0.004, 0.005 })
        { orq.IngestGps(new AmostraGps(lat, 0.0018, 100, t)); t += 100; }
        foreach (var lng in new[] { 0.0010, 0.0002, -0.0006 })
        { orq.IngestGps(new AmostraGps(0.005, lng, 100, t)); t += 100; }
        foreach (var lat in new[] { 0.004, 0.002, 0.0 })
        { orq.IngestGps(new AmostraGps(lat, -0.0006, 100, t)); t += 100; }
        return t;
    }

    [Fact]
    public void MVR_13_Maestro_compara_saida_com_a_melhor_volta_e_emite_numeros()
    {
        var c = new CockpitState();
        var chaves = new List<string>();
        c.OnChange((_, _, keys) => chaves.AddRange(keys));
        var orq = new CockpitOrchestrator(c, new[] { Curva() });
        orq.SemearMelhorVolta(80_000, Curvas(("c0", null, 200)));   // referência de saída inalcançável

        UmaVolta(orq, 100, 0);

        Assert.Contains("numeros", chaves);
        var n = c.Get().Numeros;
        Assert.NotNull(n.SaidaKmh);
        Assert.Equal(Tone.Erro, n.SaidaTom);                         // saiu mais lento que a melhor volta
    }

    [Fact]
    public void MVR_14_Maestro_sem_referencia_deixa_numeros_em_branco_e_volta_vira_referencia()
    {
        var c = new CockpitState();
        var orq = new CockpitOrchestrator(c, new[] { Curva() });

        var t = UmaVolta(orq, 100, 0);
        Assert.Null(c.Get().Numeros.SaidaKmh);                       // sem melhor volta: em branco

        Assert.True(orq.FecharVolta(80_000));                        // a volta fecha e vira referência
        Assert.NotNull(orq.MelhorVolta.Obter("c0")?.SaidaKmh);

        UmaVolta(orq, 60, t);                                        // mais lenta na curva
        Assert.NotNull(c.Get().Numeros.SaidaKmh);
        Assert.Equal(Tone.Erro, c.Get().Numeros.SaidaTom);
    }
}
