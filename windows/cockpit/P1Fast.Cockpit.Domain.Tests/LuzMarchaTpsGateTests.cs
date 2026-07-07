// Gate de TPS (acelerador) na detecção de troca de marcha (Flávio 2026-07-07): a queda do giro
// na zona só vira aprendizado se o acelerador estiver/voltar ALTO logo após — assim distingue
// TROCA de LIFT/FREADA. Cobre os dois estilos: flat-shift (pé no fundo) e troca com alívio
// (pisca e volta). Sem TPS → comportamento antigo (só a queda do giro).

using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class LuzMarchaTpsGateTests
{
    private const double Alvo = 6050;

    [Fact]
    public void TPS_01_flat_shift_pe_no_fundo_aprende()
    {
        var a = new LuzMarchaAntecipacao();
        a.Amostra(5200, 0, 0.0, Alvo, "c1", tpsPct: 100);
        a.Amostra(6100, 0, 0.2, Alvo, "c1", tpsPct: 100); // pico 6100, sob potência
        a.Amostra(5300, 0, 0.3, Alvo, "c1", tpsPct: 100); // queda 800 + TPS alto AGORA → confirma já
        Assert.NotEmpty(a.Perfis);
    }

    [Fact]
    public void TPS_02_troca_com_alivio_confirma_quando_o_acelerador_volta()
    {
        var a = new LuzMarchaAntecipacao();
        a.Amostra(5200, 0, 0.0, Alvo, "c1", tpsPct: 100);
        a.Amostra(6100, 0, 0.2, Alvo, "c1", tpsPct: 100); // pico, pé no fundo
        a.Amostra(5300, 0, 0.3, Alvo, "c1", tpsPct: 0);   // aliviou na troca → pendente, ainda não aprende
        Assert.Empty(a.Perfis);
        a.Amostra(5600, 0, 0.5, Alvo, "c1", tpsPct: 90);  // acelerador voltou (< 0,6 s) → confirma a troca
        Assert.NotEmpty(a.Perfis);
    }

    [Fact]
    public void TPS_03_lift_pra_freada_NAO_aprende()
    {
        var a = new LuzMarchaAntecipacao();
        a.Amostra(5200, 0, 0.0, Alvo, "c1", tpsPct: 100);
        a.Amostra(6100, 0, 0.2, Alvo, "c1", tpsPct: 100); // fim de reta, pé no fundo
        a.Amostra(5300, 0, 0.3, Alvo, "c1", tpsPct: 0);   // tirou o pé pra frear → pendente
        a.Amostra(4500, 0, 0.7, Alvo, "c1", tpsPct: 0);   // segue fora do acelerador, giro caindo
        a.Amostra(3500, 0, 1.0, Alvo, "c1", tpsPct: 0);   // passou a janela sem voltar → descarta (foi freada)
        Assert.Empty(a.Perfis);
    }

    [Fact]
    public void TPS_04_sem_sensor_mantem_o_comportamento_antigo()
    {
        var a = new LuzMarchaAntecipacao();
        a.Amostra(5200, 0, 0.0, Alvo, "c1");             // sem TPS (null)
        a.Amostra(6100, 0, 0.2, Alvo, "c1");
        a.Amostra(5300, 0, 0.3, Alvo, "c1");             // queda → aprende na hora (fallback, gate desligado)
        Assert.NotEmpty(a.Perfis);
    }

    [Fact]
    public void TPS_05_o_maestro_repassa_o_TPS_da_amostra()
    {
        // Pela ponte real (IngestMotor → alerta.TpsPct): uma troca com o acelerador no fundo aprende;
        // a mesma queda sem acelerador (freada) não. Prova que o TPS chega até o gate pelo maestro.
        AmostraAlerta Tps(double v) => new() { TpsPct = v };

        var comGas = new CockpitOrchestrator(new CockpitState());
        comGas.IngestMotor(5200, Tps(100), tSeg: 0.0);
        comGas.IngestMotor(6100, Tps(100), tSeg: 0.2);
        comGas.IngestMotor(5300, Tps(100), tSeg: 0.3); // troca sob potência
        Assert.NotEmpty(comGas.LuzMarchaPerfis);

        var freada = new CockpitOrchestrator(new CockpitState());
        freada.IngestMotor(5200, Tps(100), tSeg: 0.0);
        freada.IngestMotor(6100, Tps(100), tSeg: 0.2);
        freada.IngestMotor(5300, Tps(0),   tSeg: 0.3); // tirou o pé
        freada.IngestMotor(4500, Tps(0),   tSeg: 0.7);
        freada.IngestMotor(3500, Tps(0),   tSeg: 1.0); // expira → não foi troca
        Assert.Empty(freada.LuzMarchaPerfis);
    }
}
