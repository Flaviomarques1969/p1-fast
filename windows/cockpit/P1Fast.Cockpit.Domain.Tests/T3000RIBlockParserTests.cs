// Paridade do port C# (T3000RIBlockParser) com o leitor USB provado em campo
// (web/cockpit/t3000-usb-parser.js v2.0.0). Mesmo bloco RI -> mesmos números.
// Conferido fora do CI contra o JS via node (21 campos idênticos, 21/06/2026).

using System;
using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class T3000RIBlockParserTests
{
    private const double Eps = 1e-9;

    // Monta um bloco RI de 410 bytes com valores conhecidos nos offsets do spec.
    private static byte[] BlocoExemplo()
    {
        var b = new byte[410];
        void U16(int o, int v) { b[o] = (byte)(v & 0xFF); b[o + 1] = (byte)((v >> 8) & 0xFF); }
        void I16(int o, int v) { U16(o, v & 0xFFFF); }
        void U32(int o, long v) { b[o] = (byte)(v & 0xFF); b[o + 1] = (byte)((v >> 8) & 0xFF); b[o + 2] = (byte)((v >> 16) & 0xFF); b[o + 3] = (byte)((v >> 24) & 0xFF); }

        U16(0, 5200);    // rpm
        U16(2, 138);     // bateria -> 13.8 V
        I16(4, -3);      // map -> -0.03 bar
        U16(46, 7);      // tps1 -> 0.7%
        U16(48, 12);     // tps2 -> 1.2%
        U16(52, 55);     // pedal acelerador -> 5.5%
        U16(54, 33);     // pedal2/freio -> 3.3%
        I16(56, 28);     // temp ar 28C
        I16(58, 52);     // temp motor 52C
        U16(62, 896);    // lambda WB -> 0.896
        U16(102, 1606);  // velocidade -> 160.6 km/h
        U16(84, 1000); U16(86, 1010); U16(88, 1005); U16(90, 1008); // tempos inj cil 1-4
        I16(268, 50);    // pressao freio -> 0.50 bar
        I16(270, 250);   // accelX -> 0.25 g
        I16(272, -1000); // accelY -> -1.0 g
        I16(274, 0);     // accelZ -> 0
        U32(288, 0x5);   // alarmes: bit0 (excessoRotacao) + bit2 (excessoTempMotor)
        U32(292, 12345); // crono parcial -> 12.345 s
        return b;
    }

    [Fact]
    public void Parse_BlocoConhecido_ProduzNumerosEsperados()
    {
        var s = T3000RIBlockParser.Parse(BlocoExemplo(), tMono: 0);
        Assert.NotNull(s);

        Assert.Equal(5200, s!.Rpm);
        Assert.Equal(13.8, s.BatteryV, Eps);
        Assert.Equal(-0.03, s.MapBar, Eps);
        Assert.Equal(0.7, s.TpsPct, Eps);
        Assert.Equal(1.2, s.Tps2Pct, Eps);
        Assert.Equal(5.5, s.PedalAceleradorPct, Eps);
        Assert.Equal(3.3, s.PedalFreioPct, Eps);
        Assert.Equal(28, s.AirTempC);
        Assert.Equal(52, s.WaterTempC);
        Assert.Equal(0.896, s.Lambda, Eps);
        Assert.Equal(160.6, s.SpeedKmh, Eps);
        Assert.Equal(0.50, s.PressaoFreioBar!.Value, Eps);
        Assert.Equal(0.25, s.AccelXg!.Value, Eps);
        Assert.Equal(-1.0, s.AccelYg!.Value, Eps);
        Assert.Equal(0.0, s.AccelZg!.Value, Eps);
        Assert.Equal(12.345, s.CronometroParcialS!.Value, Eps);
        Assert.Equal(10, s.FuelInjectionSpread);
        Assert.True(s.Alarmes["excessoRotacao"]);
        Assert.True(s.Alarmes["excessoTempMotor"]);
        Assert.False(s.Alarmes["baixaPressaoOleo"]);
        Assert.True(s.LeituraPlausivel);
        Assert.Equal("t3000-usb", s.Source);
        Assert.Equal("2.0.0", s.ParserVersion);
    }

    [Fact]
    public void Parse_BlocoCurto_RetornaNull()
    {
        Assert.Null(T3000RIBlockParser.Parse(new byte[50]));
    }

    [Fact]
    public void LeituraPlausivel_SinalizaForaDeFaixa_SemDerrubar()
    {
        // rpm impossível (u16 0xFFFF) deve ser sinalizado, mas a amostra ainda volta.
        var b = new byte[410];
        b[0] = 0xFF; b[1] = 0xFF; // rpm = 65535
        var s = T3000RIBlockParser.Parse(b);
        Assert.NotNull(s);
        Assert.False(s!.LeituraPlausivel);
        Assert.Contains(s.SanidadeMotivos, m => m.StartsWith("rpm:"));
    }

    [Fact]
    public void IsAckOk_ReconheceOK()
    {
        Assert.True(T3000RIBlockParser.IsAckOk(new byte[] { 0x4F, 0x4B })); // "OK"
        Assert.False(T3000RIBlockParser.IsAckOk(new byte[] { 0x4E, 0x4F }));
    }
}
