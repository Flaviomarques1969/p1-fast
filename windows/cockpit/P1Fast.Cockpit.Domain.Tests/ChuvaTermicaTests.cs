// ChuvaTermica — cérebro da chuva térmica (spec do canal 2026-07-04, cortes Flávio
// 27/05/2026 pro Bubi). Trava TODAS as bordas da tabela de água (§5 da spec): cada
// limite pertence à faixa de cima. E prova a costura no maestro: amostra de motor
// com água → fase no estado; motor mudo → chuva Off (nunca água velha).

using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class ChuvaTermicaTests
{
    [Theory]
    // sem dado → sem chuva (nunca inventa)
    [InlineData(null,   FaseChuva.Off)]
    [InlineData(double.NaN, FaseChuva.Off)]
    // aquecendo (azul): forte longe do ideal, sumindo perto
    [InlineData(20.0,   FaseChuva.WarmupAlto)]
    [InlineData(44.9,   FaseChuva.WarmupAlto)]
    [InlineData(45.0,   FaseChuva.WarmupMedio)]
    [InlineData(47.9,   FaseChuva.WarmupMedio)]
    [InlineData(48.0,   FaseChuva.WarmupLeve)]
    [InlineData(49.9,   FaseChuva.WarmupLeve)]
    // janela ideal (50–55): carro pronto, sem chuva
    [InlineData(50.0,   FaseChuva.Off)]
    [InlineData(52.5,   FaseChuva.Off)]
    [InlineData(54.9,   FaseChuva.Off)]
    // esquentando demais (vermelho): sobe com a temperatura
    [InlineData(55.0,   FaseChuva.CooldownLeve)]
    [InlineData(64.9,   FaseChuva.CooldownLeve)]
    [InlineData(65.0,   FaseChuva.CooldownMedio)]
    [InlineData(69.9,   FaseChuva.CooldownMedio)]
    [InlineData(70.0,   FaseChuva.CooldownAlto)]   // escandaloso é do AlertasCriticos
    [InlineData(80.0,   FaseChuva.CooldownAlto)]
    [InlineData(120.0,  FaseChuva.CooldownAlto)]
    public void CHU_01_Tabela_de_agua_do_Bubi(double? aguaC, FaseChuva esperada)
        => Assert.Equal(esperada, ChuvaTermica.Avaliar(aguaC));

    [Fact]
    public void CHU_02_Cortes_parametrizaveis_por_carro()
    {
        // Carro fictício com janela ideal 80–90 (motor que opera quente).
        var cortes = new CortesChuvaTermica(
            WarmupAltoAteC: 70, WarmupMedioAteC: 75, IdealDeC: 80,
            IdealAteC: 90, CooldownLeveAteC: 100, CooldownMedioAteC: 110);

        Assert.Equal(FaseChuva.WarmupAlto,    ChuvaTermica.Avaliar(60,  cortes));
        Assert.Equal(FaseChuva.WarmupLeve,    ChuvaTermica.Avaliar(78,  cortes));
        Assert.Equal(FaseChuva.Off,           ChuvaTermica.Avaliar(85,  cortes));
        Assert.Equal(FaseChuva.CooldownMedio, ChuvaTermica.Avaliar(105, cortes));
        Assert.Equal(FaseChuva.CooldownAlto,  ChuvaTermica.Avaliar(115, cortes));
    }

    [Fact]
    public void CHU_03_Maestro_liga_agua_na_fase_e_so_emite_na_transicao()
    {
        var cockpit = new CockpitState();
        var maestro = new CockpitOrchestrator(cockpit);
        var emissoes = 0;
        cockpit.OnChange((_, _, keys) => { if (keys.Contains("chuva")) emissoes++; });

        maestro.IngestMotor(3000, new AmostraAlerta { Rpm = 3000, WaterTempC = 40 }); // aquecendo forte
        Assert.Equal(FaseChuva.WarmupAlto, cockpit.Get().Chuva);
        Assert.Equal(1, emissoes);

        maestro.IngestMotor(3000, new AmostraAlerta { Rpm = 3000, WaterTempC = 41 }); // mesma fase → não emite
        Assert.Equal(1, emissoes);

        maestro.IngestMotor(3000, new AmostraAlerta { Rpm = 3000, WaterTempC = 52 }); // janela ideal
        Assert.Equal(FaseChuva.Off, cockpit.Get().Chuva);
        Assert.Equal(2, emissoes);

        maestro.IngestMotor(3000, new AmostraAlerta { Rpm = 3000, WaterTempC = 66 }); // esquentando
        Assert.Equal(FaseChuva.CooldownMedio, cockpit.Get().Chuva);
    }

    [Fact]
    public void CHU_04_Motor_mudo_desliga_a_chuva()
    {
        var cockpit = new CockpitState();
        var maestro = new CockpitOrchestrator(cockpit);

        maestro.IngestMotor(3000, new AmostraAlerta { Rpm = 3000, WaterTempC = 40 });
        Assert.Equal(FaseChuva.WarmupAlto, cockpit.Get().Chuva);

        maestro.VigiarFontes(motorSilencioso: true, gpsSilencioso: false); // H2: motor emudeceu
        Assert.Equal(FaseChuva.Off, cockpit.Get().Chuva);                  // água velha não chove
    }

    [Fact]
    public void CHU_05_Sem_sensor_de_agua_nao_chove()
    {
        var cockpit = new CockpitState();
        var maestro = new CockpitOrchestrator(cockpit);
        maestro.IngestMotor(3000, new AmostraAlerta { Rpm = 3000 }); // WaterTempC null
        Assert.Equal(FaseChuva.Off, cockpit.Get().Chuva);
    }
}
