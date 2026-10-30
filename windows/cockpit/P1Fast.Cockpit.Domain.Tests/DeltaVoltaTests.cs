// DeltaVolta — cartão do centro do painel do notebook (Flávio 2026-10-30): "delta da volta em que ele está x
// a melhor passagem naquele carro naquela pista. Verde é igual ou menor o tempo da volta atual x a melhor
// volta, vermelho abaixo da melhor volta". Trava: as cores (o "0,00" igual é verde; o tom sai do número que
// a tela mostra), o texto sem sinal, a volta de saída do box sem delta, a curva comparada com a MESMA curva
// da melhor volta, a linha comparando a volta inteira, o tempo por curva só da volta que virou referência,
// a ida e volta no armazém (e o arquivo antigo, sem o tempo por curva) e a demonstração.

using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class DeltaVoltaTests
{
    private static MetadadosRecorde Meta() => new(1000, "s1", "Brasilia", "celta", "");

    // ── Cores, arredondamento e texto ────────────────────────────────

    [Fact]
    public void DV_01_Mais_rapido_ou_igual_verde_mais_lento_vermelho()
    {
        var rapido = DeltaVoltaInfo.Comparar(41_820, 42_000);
        Assert.Equal(18, rapido.Centesimos);
        Assert.Equal(Tone.Bom, rapido.Tom);

        var igual = DeltaVoltaInfo.Comparar(25_000, 25_000);
        Assert.Equal(0, igual.Centesimos);
        Assert.Equal(Tone.Bom, igual.Tom);                       // igual = verde

        var lento = DeltaVoltaInfo.Comparar(63_420, 63_000);
        Assert.Equal(42, lento.Centesimos);                      // número sem sinal
        Assert.Equal(Tone.Erro, lento.Tom);
    }

    [Fact]
    public void DV_02_O_tom_sai_do_numero_arredondado_que_a_tela_mostra()
    {
        // 4 ms mais lento aparece "0,00" → verde, nunca "0,00" vermelho.
        var quase = DeltaVoltaInfo.Comparar(10_004, 10_000);
        Assert.Equal(0, quase.Centesimos);
        Assert.Equal(Tone.Bom, quase.Tom);
        // 5 ms arredonda para 0,01 → vermelho.
        var um = DeltaVoltaInfo.Comparar(10_005, 10_000);
        Assert.Equal(1, um.Centesimos);
        Assert.Equal(Tone.Erro, um.Tom);
    }

    [Fact]
    public void DV_03_Sem_referencia_ou_valor_ruim_fica_em_branco()
    {
        Assert.Equal(DeltaVoltaInfo.Vazio(), DeltaVoltaInfo.Comparar(null, 42_000));
        Assert.Equal(DeltaVoltaInfo.Vazio(), DeltaVoltaInfo.Comparar(42_000, null));
        Assert.Equal(DeltaVoltaInfo.Vazio(), DeltaVoltaInfo.Comparar(double.NaN, 42_000));
        Assert.Equal(DeltaVoltaInfo.Vazio(), DeltaVoltaInfo.Comparar(0, 42_000));
        Assert.Equal("", DeltaVoltaInfo.Vazio().Texto());
    }

    [Fact]
    public void DV_04_Texto_com_virgula_sem_sinal_e_curto()
    {
        Assert.Equal("0,42", new DeltaVoltaInfo(42, Tone.Erro).Texto());
        Assert.Equal("0,00", new DeltaVoltaInfo(0, Tone.Bom).Texto());
        Assert.Equal("1,07", new DeltaVoltaInfo(107, Tone.Erro).Texto());
        Assert.Equal("12,3", new DeltaVoltaInfo(1234, Tone.Erro).Texto());   // de 10 s para cima, 1 casa
        Assert.Equal("99,9", new DeltaVoltaInfo(15000, Tone.Erro).Texto());  // teto: cabe no cartão
        Assert.DoesNotContain(new DeltaVoltaInfo(42, Tone.Bom).Texto(), "+-.");
    }

    // ── Referência: o tempo por curva é só da volta que virou referência ──

    [Fact]
    public void DV_05_Tempo_por_curva_vem_so_da_volta_nova()
    {
        var r = new ReferenciaMelhorVolta();
        r.Semear(80_000, new Dictionary<string, ReferenciaCurva>
        {
            ["c1"] = new(100, 90, 20_000),
            ["c2"] = new(60, 70, 40_000),
        });

        r.AnotarPassagem("c1", 105, null, 19_500);     // c2 não passou nesta volta (buraco de GPS)
        Assert.True(r.FecharVolta(79_000));

        Assert.Equal(new ReferenciaCurva(105, 90, 19_500), r.Obter("c1"));
        // c2 mantém freada e saída, mas perde o tempo: o de 40 s era de OUTRA volta (outra base de tempo).
        Assert.Equal(new ReferenciaCurva(60, 70, null), r.Obter("c2"));
    }

    [Fact]
    public void DV_06_So_o_tempo_tambem_e_anotado()
    {
        var r = new ReferenciaMelhorVolta();
        r.AnotarPassagem("c1", null, null, 12_000);
        Assert.True(r.FecharVolta(80_000));
        Assert.Equal(12_000, r.Obter("c1")?.TempoNaVoltaMs);
    }

    [Fact]
    public void DV_07_Armazem_ida_e_volta_com_o_tempo_por_curva()
    {
        var arm = new ArmazemRecordes { CarroId = "celta" };
        arm.GravarReferenciaMelhorVolta(80_000, new Dictionary<string, ReferenciaCurva>
        {
            ["c1"] = new(100, 90, 20_000),
            ["c2"] = new(null, 70, null),
        }, Meta());

        var (tempo, curvas) = arm.LerReferenciaMelhorVolta();
        Assert.Equal(80_000, tempo);
        Assert.Equal(new ReferenciaCurva(100, 90, 20_000), curvas["c1"]);
        Assert.Equal(new ReferenciaCurva(null, 70, null), curvas["c2"]);
        Assert.False(arm.Itens.ContainsKey("melhorvolta.c2.decorrido"));
    }

    [Fact]
    public void DV_08_Arquivo_antigo_sem_tempo_por_curva_le_sem_tempo()
    {
        var arm = new ArmazemRecordes { CarroId = "celta" };
        arm.Itens["melhorvolta.tempo"] = new ValorRecorde(80_000, Meta());
        arm.Itens["melhorvolta.c1.freada"] = new ValorRecorde(100, Meta());
        arm.Itens["melhorvolta.c1.saida"] = new ValorRecorde(90, Meta());

        var (_, curvas) = arm.LerReferenciaMelhorVolta();
        Assert.Equal(new ReferenciaCurva(100, 90, null), curvas["c1"]);
    }

    // ── Maestro: o cartão ao vivo ────────────────────────────────────

    // Mesma curva/volta do MelhorVoltaReferenciaTests: o 1º trecho cruza entrada, ápice e saída de c0.
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
    public void DV_09_Volta_de_saida_sem_cruzar_a_linha_nao_tem_delta()
    {
        var c = new CockpitState();
        var orq = new CockpitOrchestrator(c, new[] { Curva() });
        orq.SemearMelhorVolta(80_000, new Dictionary<string, ReferenciaCurva> { ["c0"] = new(null, 90, 1) });

        UmaVolta(orq, 100, 1000);                                    // saiu do box, ainda não cruzou a linha
        Assert.Null(c.Get().DeltaVolta.Centesimos);
    }

    [Fact]
    public void DV_10_Curva_compara_com_a_mesma_curva_da_melhor_volta_e_a_linha_com_a_volta_inteira()
    {
        var c = new CockpitState();
        var chaves = new List<string>();
        c.OnChange((_, _, keys) => chaves.AddRange(keys));
        var orq = new CockpitOrchestrator(c, new[] { Curva() });

        orq.IngestGps(new AmostraGps(-0.003, -0.0006, 100, 1000));  // na reta, antes da linha
        Assert.False(orq.FecharVolta(null));                         // 1º cruzamento: a volta começa aqui
        var t = UmaVolta(orq, 100, 1100);
        Assert.Null(c.Get().DeltaVolta.Centesimos);                  // sem melhor volta ainda: em branco
        Assert.True(orq.FecharVolta(80_000));                        // vira a referência (com o tempo por curva)
        Assert.Null(c.Get().DeltaVolta.Centesimos);                  // não havia melhor para comparar a volta
        var tempoC0 = orq.MelhorVolta.Obter("c0")?.TempoNaVoltaMs;
        Assert.NotNull(tempoC0);

        // Volta 2: mais lenta na curva → vermelho, pelo tempo de volta no fim da MESMA curva.
        t = UmaVolta(orq, 60, t);
        Assert.Contains("deltaVolta", chaves);
        var lenta = c.Get().DeltaVolta;
        Assert.Equal(Tone.Erro, lenta.Tom);
        Assert.True(lenta.Centesimos > 0);

        // Na linha: a volta inteira × a melhor (85 s × 80 s = 5,00 vermelho); a melhor não troca.
        Assert.False(orq.FecharVolta(85_000));
        Assert.Equal(new DeltaVoltaInfo(500, Tone.Erro), c.Get().DeltaVolta);

        // Volta 3: igual à melhor na curva → "0,00" verde.
        t = UmaVolta(orq, 100, t);
        Assert.Equal(new DeltaVoltaInfo(0, Tone.Bom), c.Get().DeltaVolta);

        // Na linha, 1 s mais rápida → 1,00 verde, e vira a referência nova.
        Assert.True(orq.FecharVolta(79_000));
        Assert.Equal(new DeltaVoltaInfo(100, Tone.Bom), c.Get().DeltaVolta);
    }

    [Fact]
    public void DV_11_Curva_sem_tempo_na_referencia_nao_mexe_no_cartao()
    {
        var c = new CockpitState();
        var orq = new CockpitOrchestrator(c, new[] { Curva() });
        // Referência gravada antes do cartão: tem freada e saída, não tem o tempo por curva.
        orq.SemearMelhorVolta(80_000, new Dictionary<string, ReferenciaCurva> { ["c0"] = new(null, 90) });

        orq.IngestGps(new AmostraGps(-0.003, -0.0006, 100, 1000));
        orq.FecharVolta(null);
        UmaVolta(orq, 100, 1100);
        Assert.Null(c.Get().DeltaVolta.Centesimos);                  // nada para comparar na curva

        orq.FecharVolta(81_000);                                     // mas a linha compara a volta inteira
        Assert.Equal(new DeltaVoltaInfo(100, Tone.Erro), c.Get().DeltaVolta);
    }

    [Fact]
    public void DV_12_Semear_de_novo_apaga_o_cartao_e_espera_a_linha()
    {
        var c = new CockpitState();
        var orq = new CockpitOrchestrator(c, new[] { Curva() });
        orq.SemearMelhorVolta(80_000, new Dictionary<string, ReferenciaCurva> { ["c0"] = new(null, 90) });
        orq.IngestGps(new AmostraGps(-0.003, -0.0006, 100, 1000));
        orq.FecharVolta(81_000);
        Assert.NotNull(c.Get().DeltaVolta.Centesimos);

        orq.SemearMelhorVolta(80_000, new Dictionary<string, ReferenciaCurva> { ["c0"] = new(null, 90, 500) });
        Assert.Null(c.Get().DeltaVolta.Centesimos);                  // sessão/pista nova: cartão em branco
        UmaVolta(orq, 100, 2000);                                    // e só conta depois de cruzar a linha
        Assert.Null(c.Get().DeltaVolta.Centesimos);
    }

    // ── Demonstração ─────────────────────────────────────────────────

    [Fact]
    public void DV_13_Demo_passa_pelo_verde_pelo_igual_e_pelo_vermelho()
    {
        var casos = Enumerable.Range(0, 6).Select(TelaPrimeiraVersao.DeltaVoltaDemo).ToList();
        Assert.All(casos, d => Assert.NotNull(d.Centesimos));
        Assert.Contains(casos, d => d.Tom == Tone.Bom && d.Centesimos > 0);
        Assert.Contains(casos, d => d.Tom == Tone.Bom && d.Centesimos == 0);
        Assert.Contains(casos, d => d.Tom == Tone.Erro);
        Assert.Equal(TelaPrimeiraVersao.DeltaVoltaDemo(0), TelaPrimeiraVersao.DeltaVoltaDemo(6));
        Assert.Equal(TelaPrimeiraVersao.DeltaVoltaDemo(5), TelaPrimeiraVersao.DeltaVoltaDemo(-1));

        // Linha de baixo: a melhor volta fica, a última muda, e nenhuma é mais rápida que a melhor.
        var voltas = Enumerable.Range(0, 6).Select(TelaPrimeiraVersao.VoltasDemo).ToList();
        Assert.Single(voltas.Select(v => v.MelhorMs).Distinct());
        Assert.True(voltas.Select(v => v.UltimaMs).Distinct().Count() > 1);
        Assert.All(voltas, v => Assert.True(v.UltimaMs >= v.MelhorMs));
        Assert.Equal(TelaPrimeiraVersao.VoltasDemo(0), TelaPrimeiraVersao.VoltasDemo(6));
        Assert.Equal(TelaPrimeiraVersao.VoltasDemo(5), TelaPrimeiraVersao.VoltasDemo(-1));
    }

    // ── Linha de baixo do cartão: melhor volta e última volta ────────

    [Fact]
    public void DV_14_Tempo_de_volta_m_ss_virgula_cc()
    {
        Assert.Equal("1:12,34", DeltaVoltaInfo.TempoDeVolta(72_340));
        Assert.Equal("1:21,70", DeltaVoltaInfo.TempoDeVolta(81_700));
        Assert.Equal("0:59,99", DeltaVoltaInfo.TempoDeVolta(59_999));
        Assert.Equal("1:00,00", DeltaVoltaInfo.TempoDeVolta(60_000));
        Assert.Equal("1:05,07", DeltaVoltaInfo.TempoDeVolta(65_070));   // segundos e centésimos com 2 casas
        Assert.Equal("10:00,00", DeltaVoltaInfo.TempoDeVolta(600_000));
        // A mesma conta da tela térmica: centésimos CORTADOS (72.349 ms = 1:12,34, não 1:12,35).
        Assert.Equal("1:12,34", DeltaVoltaInfo.TempoDeVolta(72_349));
        Assert.Equal("1:12,35", DeltaVoltaInfo.TempoDeVolta(72_349.6));  // o ms arredonda antes do corte
        Assert.DoesNotContain(".", DeltaVoltaInfo.TempoDeVolta(72_340));
    }

    [Fact]
    public void DV_15_Sem_tempo_de_volta_fica_em_branco()
    {
        Assert.Equal("", DeltaVoltaInfo.TempoDeVolta(null));
        Assert.Equal("", DeltaVoltaInfo.TempoDeVolta(0));
        Assert.Equal("", DeltaVoltaInfo.TempoDeVolta(-500));
        Assert.Equal("", DeltaVoltaInfo.TempoDeVolta(double.NaN));
        Assert.Equal("", DeltaVoltaInfo.TempoDeVolta(double.PositiveInfinity));
    }
}
