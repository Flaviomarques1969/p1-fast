// Prova da COSTURA do dia de pista: um ÚNICO feed de dado (motor pela USB + GPS)
// que, ao mesmo tempo, GRAVA (com liga/desliga automático por movimento), ACENDE o
// painel do piloto e MANDA pra nuvem o que gravou. Antes essas três coisas viviam
// soltas em programas diferentes; aqui é uma peça só (CapturaDiaDePista). Provado
// sem Windows — só a tela final (WinUI) e a tomada física ficam pro notebook.

using System.Linq;
using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class CapturaDiaDePistaTests
{
    private sealed class Relogio
    {
        public double Mono;
        public long Wall = 1_700_000_000_000;
        public void Av(int ms) { Mono += ms; Wall += ms; }
    }

    // Motor saudável (sem alerta falso): água fria, bateria boa, mistura ok, sob carga.
    private static T3000Sample Motor(int rpm) => new()
    {
        Rpm = rpm, Source = "real", WaterTempC = 60, BatteryV = 13.0,
        Lambda = 0.95, PedalAceleradorPct = 80,
    };
    private static AmostraGps Gps(double kmh) => new(-15.77, -47.89, kmh);

    [Fact]
    public void UmFeedSo_GravaComAuto_AcendePainel_EPublicaNaNuvem()
    {
        var r = new Relogio();
        var store = new InMemorySessionStore();
        var rec = new SessionRecorder(store, now: () => r.Mono, wall: () => r.Wall,
                                      gerarId: () => "S1",
                                      auto: new AutoCaptura(VOn: 15, VOff: 6, ParadoMs: 12000));
        var cockpit = new CockpitState();
        var painel = new CockpitOrchestrator(cockpit);    // sem curvas: prova motor → luz de marcha
        int publicados = 0;
        var captura = new CapturaDiaDePista(rec, painel, publicarNuvem: (s, tw) => publicados++);

        // 1) EM ESPERA (box): motor em marcha lenta ACENDE o painel, mas NÃO grava nem publica.
        captura.Motor(Motor(1000));
        Assert.False(captura.Estado.Gravando);                 // não gravou (espera no box)
        Assert.Equal(0, publicados);                           // não publicou em espera
        Assert.Equal(ShiftMode.Off, cockpit.Get().Shift.Mode); // painel reagiu (motor baixo = luz apagada)

        // 2) Carro ANDOU: o MESMO feed começa a gravar, acende a luz e publica.
        captura.Gps(Gps(40));                                  // entrou na pista => abre a gravação
        Assert.True(captura.Estado.Gravando);
        for (int i = 0; i < 8; i++) { r.Av(200); captura.Gps(Gps(60)); captura.Motor(Motor(6050)); }
        var est = captura.Estado;
        Assert.True(est.Gravando);                             // segue gravando na pista
        Assert.True(est.NGps >= 8 && est.NMotor >= 8);         // motor e GPS gravados JUNTOS
        Assert.NotEqual(ShiftMode.Off, cockpit.Get().Shift.Mode); // painel ACESO com o motor real (pico de potência)
        Assert.True(publicados >= 8);                          // a nuvem recebeu o que foi gravado

        // 3) PAROU no box: o mesmo feed FECHA a sessão sozinho (preservada).
        for (int i = 0; i < 70; i++) { r.Av(200); captura.Gps(Gps(0)); }
        Assert.False(captura.Estado.Gravando);                 // fechou sozinho
        Assert.Equal("parado", rec.MotivoUltimoFim);           // motivo = entrou no box
        Assert.Equal("encerrada", store.ListarSessoes().Single().Status); // sessão guardada e encerrada
    }

    // ── AlertaDeSample = a ponte CANÔNICA (L6) — o ao vivo delega pra cá ─────────

    [Fact]
    public void PONTE_01_Tps_vem_do_TPS_nao_do_pedal()
    {
        // L6: a cópia antiga usava PedalAceleradorPct; o canônico (replay provado) é tpsPct.
        var a = CapturaDiaDePista.AlertaDeSample(new T3000Sample
        {
            Rpm = 4000, TpsPct = 42, PedalAceleradorPct = 80,
        });
        Assert.Equal(42, a.TpsPct);
    }

    [Fact]
    public void PONTE_02_Guarda_M3_da_sonda_lambda()
    {
        // Sonda WB ausente lê raw 0 → lambda null (nunca MISTURA RICA falsa).
        var semSonda = CapturaDiaDePista.AlertaDeSample(new T3000Sample { Rpm = 4000, Lambda = 0.0, LambdaWBRaw = 0 });
        Assert.Null(semSonda.Lambda);

        // Fora do físico (0.3–1.6) → null mesmo com raw presente.
        var foraFisico = CapturaDiaDePista.AlertaDeSample(new T3000Sample { Rpm = 4000, Lambda = 2.5, LambdaWBRaw = 500 });
        Assert.Null(foraFisico.Lambda);

        // Sonda viva e valor físico → atravessa.
        var ok = CapturaDiaDePista.AlertaDeSample(new T3000Sample { Rpm = 4000, Lambda = 0.95, LambdaWBRaw = 500 });
        Assert.Equal(0.95, ok.Lambda);
    }

    [Fact]
    public void PONTE_03_Alarmes_de_combustivel_atravessam_e_ausentes_ficam_null()
    {
        var com = CapturaDiaDePista.AlertaDeSample(new T3000Sample
        {
            Rpm = 4000,
            Alarmes = new Dictionary<string, bool> { ["baixaPressaoOleo"] = true, ["alertaNivelCombustivel"] = false, ["baixaPressaoCombustivel"] = true },
        });
        Assert.True(com.BaixaPressaoOleo);
        Assert.False(com.AlertaNivelCombustivel);
        Assert.True(com.BaixaPressaoCombustivel);

        var sem = CapturaDiaDePista.AlertaDeSample(new T3000Sample { Rpm = 4000 });
        Assert.Null(sem.BaixaPressaoOleo);            // bit ausente = sem dado = sem alerta falso
        Assert.Null(sem.AlertaNivelCombustivel);
        Assert.Null(sem.BaixaPressaoCombustivel);
    }
}
