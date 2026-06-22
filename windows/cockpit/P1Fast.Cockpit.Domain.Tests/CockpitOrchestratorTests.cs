// CockpitOrchestrator — o maestro que junta as 5 peças e comanda o CockpitState.
// Incremento 6 da Fase 4. Prova: motor liga luz+alerta; 2 voltas numa curva geram
// a referência (1ª) e a diferença de tempo + frase do coach (2ª).

using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class CockpitOrchestratorTests
{
    [Fact]
    public void ORC_01_Motor_liga_luz_de_marcha_e_alerta()
    {
        var c = new CockpitState();
        var orq = new CockpitOrchestrator(c); // sem curvas: só motor

        orq.IngestMotor(6100, new AmostraAlerta { WaterTempC = 85, Rpm = 6100 });
        Assert.Equal(ShiftMode.Fire, c.Get().Shift.Mode);      // ~pico de potência do Bubi
        Assert.Equal("MOTOR QUENTE", c.Get().Message!.Texto);  // água 85 >= 80

        orq.IngestMotor(3000, new AmostraAlerta { WaterTempC = 55, Rpm = 3000 });
        Assert.Equal(ShiftMode.Off, c.Get().Shift.Mode);       // abaixo do início da luz
        Assert.Null(c.Get().Message);                          // motor esfriou: alerta sumiu
    }

    // Curva: entrada no lng=0, saída no lng=0.001, ápice em (0, 0.0005).
    private static TrechoSegmento Curva() =>
        new("c0", "Curva 0",
            new LinhaGps(new PontoGps(-0.001, 0), new PontoGps(0.001, 0)),
            new PontoGps(0, 0.0005),
            new LinhaGps(new PontoGps(-0.001, 0.001), new PontoGps(0.001, 0.001)));

    // Uma volta num retângulo: leg de baixo (lat 0) cruza entrada e saída; volta
    // por cima (lat alto, fora da barra) sem disparar nada.
    private static void UmaVolta(List<AmostraGps> path, double kmhBaixo, ref double t)
    {
        void Add(double lat, double lng, double kmh) { path.Add(new AmostraGps(lat, lng, kmh, t)); t += 100; }
        foreach (var lng in new[] { -0.0006, -0.0002, 0.0002, 0.0004, 0.0006, 0.0010, 0.0014, 0.0018 })
            Add(0, lng, kmhBaixo);                 // leg de baixo (cruza entrada/ápice/saída)
        foreach (var lat in new[] { 0.002, 0.004, 0.005 }) Add(lat, 0.0018, 100); // sobe
        foreach (var lng in new[] { 0.0010, 0.0002, -0.0006 }) Add(0.005, lng, 100); // volta por cima
        foreach (var lat in new[] { 0.004, 0.002, 0.0 }) Add(lat, -0.0006, 100);   // desce
    }

    [Fact]
    public void ORC_02_Duas_voltas_dao_referencia_e_diferenca_de_tempo_real()
    {
        var c = new CockpitState();
        var orq = new CockpitOrchestrator(c, new[] { Curva() });

        var t = 0.0;
        var volta1 = new List<AmostraGps>();
        UmaVolta(volta1, kmhBaixo: 100, ref t);
        foreach (var s in volta1) orq.IngestGps(s);

        // 1ª passagem pela curva vira referência e mostra REGISTRANDO.
        Assert.Equal(1, orq.CurvasComReferencia);
        Assert.Equal("REGISTRANDO", c.Get().Acao.Texto);

        var volta2 = new List<AmostraGps>();
        UmaVolta(volta2, kmhBaixo: 60, ref t); // mais devagar na curva
        foreach (var s in volta2) orq.IngestGps(s);

        // 2ª passagem: comparou com a 1ª e trocou pra uma frase do coach (perdeu tempo).
        Assert.NotEqual("REGISTRANDO", c.Get().Acao.Texto);
        Assert.False(string.IsNullOrEmpty(c.Get().Acao.Texto));
        Assert.Equal(Tone.Erro, c.Get().Acao.Tone); // perdeu tempo
    }
}
