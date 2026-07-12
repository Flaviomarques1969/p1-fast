// Prova do CÉREBRO puro da barra de voltas (PlanoStintParser), sem rede. Fixture = o
// exemplo real do plano_stint do envelope (§4 do CONTINUAR-barra-voltas-plano-stint).
// A regra do dia usa `agoraIso` injetado, então os testes são determinísticos (não
// dependem do relógio nem do fuso da máquina de CI).

using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class PlanoStintTests
{
    // plano_stint de exemplo (§4): treino de frenagem, 10 voltas, 1 parada na volta 5.
    private const string PlanoExemplo = """
    { "proposito":"treinar", "foco":"frenagem", "ghost":false,
      "voltas":10, "paradas":[{"volta":5,"motivo":"verificar pneus"}],
      "carroId":"641a81e7-3192-4e68-8183-b8401f105574", "piloto":"Joao", "autodromo":"Brasilia",
      "tipoPneu":"Michelin", "vidaPneuFaixa":"50-75%", "modo":"agressivo",
      "aprovadoEm":"2026-07-03T14:30:00Z" }
    """;

    // "agora" = mesmo dia SP do created_at do exemplo (2026-07-03 no fuso Brasília).
    private const string HojeIso = "2026-07-03T23:00:00Z"; // SP 20:00 de 03/07
    private const string CriadoHoje = "2026-07-03T14:30:00Z";
    private const string CriadoOntem = "2026-07-02T14:30:00Z";

    private static string Corpo(string? createdAt, string planoJson)
    {
        var criado = createdAt is null ? "" : $"\"created_at\":\"{createdAt}\",";
        return $"[{{{criado}\"plano_stint\":{planoJson}}}]";
    }

    // ── Parse + regra do dia ────────────────────────────────────────────────

    [Fact]
    public void PlanoDoDia_ParseiaVoltasEParadas()
    {
        var plano = PlanoStintParser.DaRespostaNuvem(Corpo(CriadoHoje, PlanoExemplo), HojeIso);

        Assert.NotNull(plano);
        Assert.Equal(10, plano!.Voltas);
        Assert.Equal("nuvem", plano.Origem);
        Assert.Equal("frenagem", plano.Foco);
        var parada = Assert.Single(plano.Paradas);
        Assert.Equal(5, parada.Volta);
        Assert.Equal("verificar pneus", parada.Motivo);
    }

    [Fact]
    public void ForaDoDia_DevolveNull()
    {
        // Envelope aprovado ontem: o notebook do carro NÃO arma o plano de ontem no boot de hoje.
        var plano = PlanoStintParser.DaRespostaNuvem(Corpo(CriadoOntem, PlanoExemplo), HojeIso);
        Assert.Null(plano);
    }

    [Fact]
    public void SemCreatedAt_CaiNoAprovadoEm()
    {
        // aprovadoEm do plano é 2026-07-03 → vale hoje mesmo sem created_at no envelope.
        var plano = PlanoStintParser.DaRespostaNuvem(Corpo(null, PlanoExemplo), HojeIso);
        Assert.NotNull(plano);
        Assert.Equal(10, plano!.Voltas);
    }

    [Fact]
    public void SemPlanoStint_DevolveNull()
    {
        Assert.Null(PlanoStintParser.DaRespostaNuvem("""[{"created_at":"2026-07-03T14:30:00Z"}]""", HojeIso));
    }

    [Fact]
    public void ArrayVazio_DevolveNull()
    {
        Assert.Null(PlanoStintParser.DaRespostaNuvem("[]", HojeIso));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("nao é json")]
    [InlineData("{ }")]          // objeto sem plano_stint
    [InlineData("42")]           // json que não é array nem objeto-envelope
    public void CorpoInvalido_DevolveNull(string? corpo)
    {
        Assert.Null(PlanoStintParser.DaRespostaNuvem(corpo, HojeIso));
    }

    [Fact]
    public void TreinarSemFoco_DevolveNull()
    {
        var plano = """{ "proposito":"treinar", "voltas":8 }""";
        Assert.Null(PlanoStintParser.DaRespostaNuvem(Corpo(CriadoHoje, plano), HojeIso));
    }

    [Fact]
    public void TreinarComFocoDesconhecido_MasNaoVazio_EhValido()
    {
        // CONTRATO DELIBERADO do Domain (difere do JS de propósito): a BARRA só precisa da
        // ESTRUTURA (voltas/paradas). O catálogo de treinos (treinoPorFoco) é validado no
        // web, NÃO aqui — então um foco não-vazio porém fora do catálogo NÃO reprova o plano
        // da barra. (O JS validarPlanoStint reprovaria; ver comentário no PlanoStint.cs.)
        var plano = """{ "proposito":"treinar", "foco":"lua-de-queijo", "voltas":10 }""";
        var r = PlanoStintParser.DaRespostaNuvem(Corpo(CriadoHoje, plano), HojeIso);
        Assert.NotNull(r);
        Assert.Equal(10, r!.Voltas);
        Assert.Equal("lua-de-queijo", r.Foco);
    }

    [Fact]
    public void NaoTreinar_SemFoco_EhValido()
    {
        // proposito != 'treinar' não exige foco (ex.: só rodar / testar setup).
        var plano = """{ "proposito":"testar", "voltas":6 }""";
        var r = PlanoStintParser.DaRespostaNuvem(Corpo(CriadoHoje, plano), HojeIso);
        Assert.NotNull(r);
        Assert.Equal(6, r!.Voltas);
    }

    [Theory]
    [InlineData("""{ "proposito":"testar" }""")]                 // sem voltas
    [InlineData("""{ "proposito":"testar", "voltas":0 }""")]     // voltas zero
    [InlineData("""{ "proposito":"testar", "voltas":-3 }""")]    // voltas negativa
    public void VoltasInvalida_DevolveNull(string plano)
    {
        Assert.Null(PlanoStintParser.DaRespostaNuvem(Corpo(CriadoHoje, plano), HojeIso));
    }

    [Fact]
    public void VoltasComoTexto_EhTolerada()
    {
        // Um form pode gravar o número como string no JSONB.
        var plano = """{ "proposito":"testar", "voltas":"7" }""";
        var r = PlanoStintParser.DaRespostaNuvem(Corpo(CriadoHoje, plano), HojeIso);
        Assert.NotNull(r);
        Assert.Equal(7, r!.Voltas);
    }

    // ── Regra do dia (fuso Brasília) ────────────────────────────────────────

    [Fact]
    public void DiaBrasilia_ConverteParaFusoLocal()
    {
        // 02:00 UTC de 03/07 é 23:00 de 02/07 em Brasília (-03) → dia civil = 02/07.
        Assert.Equal("2026-07-02", PlanoStintParser.DiaBrasilia("2026-07-03T02:00:00Z"));
    }

    [Fact]
    public void DiaBrasilia_MeioDiaFicaNoMesmoDia()
    {
        Assert.Equal("2026-07-03", PlanoStintParser.DiaBrasilia("2026-07-03T14:30:00Z"));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("banana")]
    public void DiaBrasilia_Invalido_DevolveNull(string? iso)
    {
        Assert.Null(PlanoStintParser.DiaBrasilia(iso));
    }

    // ── Expansão do plano nos blocos da barra ───────────────────────────────

    private static PlanoStint Plano(int voltas, params int[] paradas)
        => new(voltas, System.Array.ConvertAll(paradas, v => new ParadaStint(v, null)),
               "treinar", "frenagem", "Joao", "Brasilia", null, "teste");

    // MARTELO (Flávio 2026-07-11, via canal): a barra NÃO tem mais cápsulas térmicas —
    // 1ª e última volta são Planejadas comuns; o térmico é da TELA DEDICADA (TelaTermica).
    // BOX (Flávio 2026-07-11/12): a parada INTERROMPE a volta, não a consome — UM marcador
    // BOX (entrada + saída) é inserido e a volta vem DEPOIS. Sem cápsula própria de out-lap.
    [Fact]
    public void Expande_ParadaInsereUmBox_SemConsumirVolta()
    {
        var barra = PlanoStintParser.ExpandirBarra(Plano(10, 5), slots: 12);

        Assert.NotNull(barra);
        Assert.Equal(12, barra!.Length);
        Assert.Equal(TipoVoltaStint.Planejada, barra[0]);     // volta 1
        Assert.Equal(TipoVoltaStint.Planejada, barra[3]);     // volta 4
        Assert.Equal(TipoVoltaStint.Box, barra[4]);           // desvio (interrompe a 5ª)
        Assert.Equal(TipoVoltaStint.Planejada, barra[5]);     // volta 5 — RETOMADA após o box
        Assert.Equal(TipoVoltaStint.Planejada, barra[10]);    // volta 10 = última (10 P + 1 BOX = 11 cápsulas)
        Assert.Equal(TipoVoltaStint.Vaga, barra[11]);         // slot além do stint
        // invariante: nº de Planejadas = nº de voltas do plano (nada engolido); 1 box só
        Assert.Equal(10, System.Linq.Enumerable.Count(barra, t => t == TipoVoltaStint.Planejada));
        Assert.Equal(1, System.Linq.Enumerable.Count(barra, t => t == TipoVoltaStint.Box));
    }

    // O cenário EXATO do Flávio: 11 voltas, parada na 6ª → a barra retoma na 6ª depois do
    // box (1..5, BOX, 6..11 = 12 cápsulas) — não pula pra 7ª. Revisão 12/07: sem SAÍDA.
    [Fact]
    public void Expande_CenarioDoFlavio_BoxNa6a_RetomaNa6a()
    {
        var barra = PlanoStintParser.ExpandirBarra(Plano(11, 6), slots: 40)!;

        for (var i = 0; i <= 4; i++) Assert.Equal(TipoVoltaStint.Planejada, barra[i]); // 1..5
        Assert.Equal(TipoVoltaStint.Box, barra[5]);
        for (var i = 6; i <= 11; i++) Assert.Equal(TipoVoltaStint.Planejada, barra[i]); // 6..11
        Assert.Equal(TipoVoltaStint.Vaga, barra[12]);
        Assert.Equal(11, System.Linq.Enumerable.Count(barra, t => t == TipoVoltaStint.Planejada));
    }

    [Fact]
    public void Expande_DuasParadas_CadaUmaUmBox()
    {
        var barra = PlanoStintParser.ExpandirBarra(Plano(8, 3, 6), slots: 40)!;

        // P1,P2, BOX, P3,P4,P5, BOX, P6,P7,P8
        Assert.Equal(TipoVoltaStint.Box, barra[2]);
        Assert.Equal(TipoVoltaStint.Planejada, barra[3]);   // volta 3 retomada
        Assert.Equal(TipoVoltaStint.Box, barra[6]);
        Assert.Equal(TipoVoltaStint.Planejada, barra[7]);   // volta 6 retomada
        Assert.Equal(8, System.Linq.Enumerable.Count(barra, t => t == TipoVoltaStint.Planejada));
        Assert.Equal(2, System.Linq.Enumerable.Count(barra, t => t == TipoVoltaStint.Box));
        Assert.Equal(TipoVoltaStint.Vaga, barra[10]);
    }

    [Fact]
    public void Expande_ParadaForaDoPlano_Ignorada()
    {
        var barra = PlanoStintParser.ExpandirBarra(Plano(5, 9), slots: 12)!;
        Assert.DoesNotContain(TipoVoltaStint.Box, barra);
        Assert.Equal(5, System.Linq.Enumerable.Count(barra, t => t == TipoVoltaStint.Planejada));
    }

    [Fact]
    public void Expande_VoltaUnica_EhPlanejada()
    {
        var barra = PlanoStintParser.ExpandirBarra(Plano(1), slots: 12);
        Assert.NotNull(barra);
        Assert.Equal(TipoVoltaStint.Planejada, barra![0]);
        Assert.Equal(TipoVoltaStint.Vaga, barra[1]);
    }

    [Fact]
    public void Expande_ParadaNaUltima_BoxAntesDaUltima()
    {
        var barra = PlanoStintParser.ExpandirBarra(Plano(5, 5), slots: 12);
        Assert.NotNull(barra);
        Assert.Equal(TipoVoltaStint.Box, barra![4]);          // interrompe a 5ª
        Assert.Equal(TipoVoltaStint.Planejada, barra[5]);     // a 5ª é rodada depois do box
        Assert.Equal(TipoVoltaStint.Vaga, barra[6]);
    }

    [Fact]
    public void Expande_VoltasMaiorQueSlots_TruncaSemEstourar()
    {
        var barra = PlanoStintParser.ExpandirBarra(Plano(15), slots: 12);
        Assert.NotNull(barra);
        Assert.Equal(12, barra!.Length);
        Assert.Equal(TipoVoltaStint.Planejada, barra[0]);
        Assert.Equal(TipoVoltaStint.Planejada, barra[11]); // volta 12; a cauda não cabe
        Assert.DoesNotContain(TipoVoltaStint.Vaga, barra);
    }

    [Fact]
    public void Expande_PlanoNull_DevolveNull()
    {
        Assert.Null(PlanoStintParser.ExpandirBarra(null, slots: 12));
    }

    [Fact]
    public void Expande_SlotsZero_DevolveNull()
    {
        Assert.Null(PlanoStintParser.ExpandirBarra(Plano(10), slots: 0));
    }

    // ── Atalho ponta-a-ponta (corpo REST → barra) ───────────────────────────

    [Fact]
    public void BarraDaRespostaNuvem_PontaAPonta()
    {
        var barra = PlanoStintParser.BarraDaRespostaNuvem(Corpo(CriadoHoje, PlanoExemplo), slots: 12, agoraIso: HojeIso);

        Assert.NotNull(barra);
        Assert.Equal(TipoVoltaStint.Planejada, barra![0]);
        Assert.Equal(TipoVoltaStint.Box, barra[4]);         // parada na 5ª → 1 marcador BOX
        Assert.Equal(TipoVoltaStint.Planejada, barra[5]);   // a 5ª retomada após o box
    }

    [Fact]
    public void BarraDaRespostaNuvem_ForaDoDia_DevolveNull()
    {
        Assert.Null(PlanoStintParser.BarraDaRespostaNuvem(Corpo(CriadoOntem, PlanoExemplo), slots: 12, agoraIso: HojeIso));
    }
}
