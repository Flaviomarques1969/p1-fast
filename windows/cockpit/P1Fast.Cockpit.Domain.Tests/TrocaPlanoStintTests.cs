// Prova do cérebro de troca do plano entre stints (TrocaPlanoStint). Vários stints no dia,
// um plano novo do celular antes de cada saída (Flávio 2026-10-29): o plano novo entra com o
// carro parado (zerando as voltas), entra na hora se for DESTA ida (leitura atrasada na saída),
// espera o carro parar se for do PRÓXIMO stint, e a rede caída nunca derruba o plano da barra.

using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class TrocaPlanoStintTests
{
    private static readonly DateTimeOffset Saida = DateTimeOffset.Parse("2026-10-30T13:00:00Z");

    private static PlanoStint Plano(int voltas, string? criadoEm, params int[] paradas)
        => new(voltas, paradas.Select(v => new ParadaStint(v, null)).ToList(),
               "treinar", "frenagem", null, null, criadoEm, "nuvem", EnvelopeCriadoEm: criadoEm);

    private static string Iso(DateTimeOffset t) => t.ToString("O");

    [Fact]
    public void PrimeiroPlano_CarroParado_AplicaEZera()
    {
        var troca = new TrocaPlanoStint();
        var p1 = Plano(10, Iso(Saida.AddMinutes(-5)));

        var d = troca.Avaliar(p1, carroNaPista: false);

        Assert.NotNull(d);
        Assert.Same(p1, d!.Plano);
        Assert.True(d.ZerarVoltas);
        Assert.Equal(p1.EnvelopeCriadoEm, troca.ChaveAtual);
    }

    [Fact]
    public void MesmaChave_NaoTrocaNemZera()
    {
        // controle: reler o MESMO envelope a cada 15 s não pode zerar as voltas do stint
        var troca = new TrocaPlanoStint();
        var p1 = Plano(10, Iso(Saida.AddMinutes(-5)));
        troca.Avaliar(p1, carroNaPista: false);

        Assert.Null(troca.Avaliar(p1, carroNaPista: false));
        Assert.Null(troca.Avaliar(p1 with { Voltas = 10 }, carroNaPista: true, Saida));
        Assert.Null(troca.Pendente);
    }

    [Fact]
    public void SegundoStint_CarroParadoNoBox_AplicaEZera()
    {
        var troca = new TrocaPlanoStint();
        troca.Avaliar(Plano(10, Iso(Saida.AddHours(-2))), carroNaPista: false);
        var p2 = Plano(8, Iso(Saida.AddMinutes(-3)), 4);

        var d = troca.Avaliar(p2, carroNaPista: false);

        Assert.NotNull(d);
        Assert.Same(p2, d!.Plano);
        Assert.True(d.ZerarVoltas);
    }

    [Fact]
    public void PlanoDoProximoStint_ComCarroNaPista_EsperaPararEDepoisZera()
    {
        // controle: plano feito com o carro rodando (o PRÓXIMO stint) não pode entrar na hora
        var troca = new TrocaPlanoStint();
        var p1 = Plano(10, Iso(Saida.AddMinutes(-2)));
        troca.Avaliar(p1, carroNaPista: false);
        var p2 = Plano(6, Iso(Saida.AddMinutes(20)));

        Assert.Null(troca.Avaliar(p2, carroNaPista: true, Saida));
        Assert.Equal(p1.EnvelopeCriadoEm, troca.ChaveAtual);
        Assert.Same(p2, troca.Pendente);

        var d = troca.Avaliar(p2, carroNaPista: false);   // entrou no box
        Assert.NotNull(d);
        Assert.Same(p2, d!.Plano);
        Assert.True(d.ZerarVoltas);
        Assert.Null(troca.Pendente);
    }

    [Theory]
    [InlineData(-60)]   // aprovado 1 min antes da saída, lido depois de o carro andar
    [InlineData(20)]    // "iniciar" apertado com o carro já saindo
    [InlineData(170)]   // ainda dentro da janela de 3 min
    public void PlanoDestaIda_LidoComCarroJaNaPista_AplicaNaHora(int segundosDepoisDaSaida)
    {
        var troca = new TrocaPlanoStint();
        troca.Avaliar(Plano(10, Iso(Saida.AddHours(-1))), carroNaPista: false);
        var p2 = Plano(8, Iso(Saida.AddSeconds(segundosDepoisDaSaida)));

        var d = troca.Avaliar(p2, carroNaPista: true, Saida);

        Assert.NotNull(d);
        Assert.Same(p2, d!.Plano);
        Assert.True(d.ZerarVoltas);
    }

    [Fact]
    public void NaPista_SemInicioDaIdaConhecido_Espera()
    {
        var troca = new TrocaPlanoStint();
        var p1 = Plano(10, Iso(Saida));

        Assert.Null(troca.Avaliar(p1, carroNaPista: true, inicioIdaUtc: null));
        Assert.Same(p1, troca.Pendente);
    }

    [Fact]
    public void RedeCaida_MantemOPlanoDaBarraEOPendente()
    {
        // controle: leitura vazia (rede caiu / sem plano do dia) não vira barra padrão
        var troca = new TrocaPlanoStint();
        var p1 = Plano(10, Iso(Saida.AddMinutes(-2)));
        troca.Avaliar(p1, carroNaPista: false);
        var p2 = Plano(6, Iso(Saida.AddMinutes(20)));
        troca.Avaliar(p2, carroNaPista: true, Saida);

        Assert.Null(troca.Avaliar(null, carroNaPista: true, Saida));
        Assert.Equal(p1.EnvelopeCriadoEm, troca.ChaveAtual);
        Assert.Same(p2, troca.Pendente);

        var d = troca.Avaliar(null, carroNaPista: false);   // parou no box com a rede ainda caída
        Assert.NotNull(d);
        Assert.Same(p2, d!.Plano);
    }

    [Fact]
    public void RedeCaidaSemPlanoNenhum_NadaAcontece()
    {
        var troca = new TrocaPlanoStint();
        Assert.Null(troca.Avaliar(null, carroNaPista: false));
        Assert.Null(troca.ChaveAtual);
    }

    [Fact]
    public void DoisPlanosNovosComCarroNaPista_OMaisNovoVence()
    {
        var troca = new TrocaPlanoStint();
        troca.Avaliar(Plano(10, Iso(Saida.AddMinutes(-2))), carroNaPista: false);
        var p2 = Plano(6, Iso(Saida.AddMinutes(20)));
        var p3 = Plano(7, Iso(Saida.AddMinutes(25)), 3);
        troca.Avaliar(p2, carroNaPista: true, Saida);
        troca.Avaliar(p3, carroNaPista: true, Saida);

        var d = troca.Avaliar(null, carroNaPista: false);

        Assert.NotNull(d);
        Assert.Same(p3, d!.Plano);
    }

    [Fact]
    public void PendenteApagadoNaNuvem_OUltimoVoltaASerODaBarra_NaoTroca()
    {
        var troca = new TrocaPlanoStint();
        var p1 = Plano(10, Iso(Saida.AddMinutes(-2)));
        troca.Avaliar(p1, carroNaPista: false);
        troca.Avaliar(Plano(6, Iso(Saida.AddMinutes(20))), carroNaPista: true, Saida);

        Assert.Null(troca.Avaliar(p1, carroNaPista: true, Saida));
        Assert.Null(troca.Pendente);
        Assert.Null(troca.Avaliar(p1, carroNaPista: false));
    }

    [Fact]
    public void Chave_SemCreatedAtNemAprovadoEm_UsaAFormaDoPlano()
    {
        var a = Plano(10, null, 5);
        var b = Plano(10, null, 5);
        var c = Plano(10, null, 6);

        Assert.Equal(TrocaPlanoStint.Chave(a), TrocaPlanoStint.Chave(b));
        Assert.NotEqual(TrocaPlanoStint.Chave(a), TrocaPlanoStint.Chave(c));
    }

    [Fact]
    public void PontaAPonta_DoisEnvelopesDaNuvemComOMesmoPlano_SaoStintsDiferentes()
    {
        // os stints do dia podem repetir o plano (10 voltas, sem parada): o que separa um do
        // outro é o created_at do envelope, que o parser agora carrega
        const string agora = "2026-10-30T18:00:00Z";
        const string plano = """{ "proposito":"treinar", "foco":"frenagem", "voltas":10, "paradas":[] }""";
        var e1 = PlanoStintParser.DaRespostaNuvem(
            $$"""[{ "created_at":"2026-10-30T13:00:00+00:00", "plano_stint": {{plano}} }]""", agora);
        var e2 = PlanoStintParser.DaRespostaNuvem(
            $$"""[{ "created_at":"2026-10-30T15:30:00+00:00", "plano_stint": {{plano}} }]""", agora);

        Assert.Equal("2026-10-30T13:00:00+00:00", e1!.EnvelopeCriadoEm);
        var troca = new TrocaPlanoStint();
        Assert.NotNull(troca.Avaliar(e1, carroNaPista: false));
        Assert.Null(troca.Avaliar(e1, carroNaPista: false));
        var d = troca.Avaliar(e2, carroNaPista: false);
        Assert.NotNull(d);
        Assert.True(d!.ZerarVoltas);
    }
}
