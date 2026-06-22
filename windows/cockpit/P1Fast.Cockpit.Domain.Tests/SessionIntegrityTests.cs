// Prova da CONFERÊNCIA de sessão (SessionIntegrity): contagem por tipo, detecção
// de quebra de sequência (registro sumido) e de lacuna de tempo (buraco).

using System.Collections.Generic;
using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class SessionIntegrityTests
{
    private static SessionRecord Reg(long seq, string tipo, long tWall) =>
        new() { SessaoId = "s", Seq = seq, Tipo = tipo, TWall = tWall };

    [Fact]
    public void Contigua_ContaPorTipo_SemLacuna()
    {
        var regs = new List<SessionRecord>
        {
            Reg(1, "t4000", 1000),
            Reg(2, "t4000", 1100),
            Reg(3, "gps",   1150),
            Reg(4, "evento",1200),
        };

        var c = SessionIntegrity.Conferir("s", regs);

        Assert.True(c.SeqContigua);
        Assert.Null(c.PrimeiraQuebraSeq);
        Assert.Equal(4, c.Total);
        Assert.Equal(2, c.Motor);
        Assert.Equal(1, c.Gps);
        Assert.Equal(1, c.Eventos);
        Assert.Equal(0, c.Lacunas);
        Assert.Equal(0.2, c.DuracaoS, 1e-9); // 200 ms
    }

    [Fact]
    public void QuebraDeSequencia_Detectada_NaPrimeiraFalta()
    {
        var regs = new List<SessionRecord>
        {
            Reg(1, "t4000", 1000),
            Reg(3, "t4000", 1100), // pulou a 2 (registro sumiu)
            Reg(4, "t4000", 1200),
        };

        var c = SessionIntegrity.Conferir("s", regs);

        Assert.False(c.SeqContigua);
        Assert.Equal(3, c.PrimeiraQuebraSeq);
    }

    [Fact]
    public void LacunaDeTempo_AcimaDoLimite_Contada()
    {
        var regs = new List<SessionRecord>
        {
            Reg(1, "t4000", 1000),
            Reg(2, "t4000", 5000), // 4000 ms de buraco (> 2000) = 1 lacuna
            Reg(3, "t4000", 5100),
        };

        var c = SessionIntegrity.Conferir("s", regs);

        Assert.True(c.SeqContigua);
        Assert.Equal(1, c.Lacunas);
        Assert.Equal(4000, c.MaiorLacunaMs);
    }

    [Fact]
    public void ListaVazia_NaoQuebra()
    {
        var c = SessionIntegrity.Conferir("s", new List<SessionRecord>());
        Assert.Equal(0, c.Total);
        Assert.True(c.SeqContigua);
        Assert.Equal(0, c.MaiorLacunaMs);
    }
}
