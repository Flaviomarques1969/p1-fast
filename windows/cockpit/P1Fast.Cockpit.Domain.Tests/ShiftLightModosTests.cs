// ShiftLightModos (gap 4, port de shift-light-modos.js): 3 modos derivados do perfil
// do motor. Paridade com o JS de referência.

using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class ShiftLightModosTests
{
    [Fact]
    public void MOD_01_Janelas_do_Bubi_batem_com_a_referencia()
    {
        var dur = ShiftLightModos.JanelaParaModo(ModoStint.Durabilidade);
        var nrm = ShiftLightModos.JanelaParaModo(ModoStint.Normal);
        var agr = ShiftLightModos.JanelaParaModo(ModoStint.Agressivo);

        Assert.Equal(5800, dur.RpmMin); Assert.Equal(6050, dur.RpmMax);   // pico-250 .. pico
        Assert.Equal(6100, nrm.RpmMin); Assert.Equal(6250, nrm.RpmMax);   // pico+50 .. redline-50
        Assert.Equal(6250, agr.RpmMin); Assert.Equal(6350, agr.RpmMax);   // redline-50 .. limite
        Assert.Equal("DUR", dur.NomeBreve);
        Assert.Equal("verde", nrm.Cor);
    }

    [Fact]
    public void MOD_02_RpmDentroDaJanela()
    {
        Assert.True(ShiftLightModos.RpmDentroDaJanela(5900, ModoStint.Durabilidade));
        Assert.True(ShiftLightModos.RpmDentroDaJanela(6200, ModoStint.Normal));
        Assert.True(ShiftLightModos.RpmDentroDaJanela(6300, ModoStint.Agressivo));
        Assert.True(ShiftLightModos.RpmDentroDaJanela(6050, ModoStint.Durabilidade));  // limite superior
        Assert.False(ShiftLightModos.RpmDentroDaJanela(6075, ModoStint.Durabilidade)); // entre Dur e Normal
        Assert.False(ShiftLightModos.RpmDentroDaJanela(6200, ModoStint.Durabilidade));
    }

    [Fact]
    public void MOD_03_Listar_da_os_3_em_ordem()
    {
        var l = ShiftLightModos.Listar();
        Assert.Equal(3, l.Count);
        Assert.Equal(ModoStint.Durabilidade, l[0].Modo);
        Assert.Equal(ModoStint.Normal, l[1].Modo);
        Assert.Equal(ModoStint.Agressivo, l[2].Modo);
    }

    [Fact]
    public void MOD_04_Deriva_janelas_de_outro_motor()
    {
        // Motor com pico HP 7000, redline 7500, limite 7550.
        var civic = new PerfilMotor("Civic 1.6", 5800, 7000, 7500, 7550);
        var dur = ShiftLightModos.JanelaParaModo(ModoStint.Durabilidade, civic);
        var nrm = ShiftLightModos.JanelaParaModo(ModoStint.Normal, civic);
        var agr = ShiftLightModos.JanelaParaModo(ModoStint.Agressivo, civic);

        Assert.Equal(6750, dur.RpmMin); Assert.Equal(7000, dur.RpmMax);
        Assert.Equal(7050, nrm.RpmMin); Assert.Equal(7450, nrm.RpmMax);
        Assert.Equal(7450, agr.RpmMin); Assert.Equal(7550, agr.RpmMax);
    }
}
