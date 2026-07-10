// Onda 7 — persistência entre sessões da antecipação da luz de marcha (reação por marcha).
// O tempo de reação aprendido (≥10 trocas) tem de sobreviver ao fechamento do .exe: Exportar
// num carro "maduro" e Importar num agente novo tem de restaurar a antecipação imediatamente.

using System.Text.Json;
using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class LuzMarchaPersistenciaTests
{
    // Ensina o agente com N trocas de ~200 ms na 3ª marcha até amadurecer (≥MinSamples).
    private static PilotReaction Maduro()
    {
        var ag = new PilotReaction();
        for (var i = 0; i < PilotReaction.MinSamples; i++)
            // delta 50 rpm / 250 rpm/s * 1000 = 200 ms; gear 3; carro "bubi".
            ag.LearnFromEvent(new ReactionEvent(6100, 6050, RpmRiseRate: 250,
                GearConfidence: 1.0, CarroId: "bubi", GearAfter: 3), nowMs: i);
        return ag;
    }

    [Fact]
    public void LMP_01_Exportar_Importar_restaura_os_perfis()
    {
        var origem = Maduro();
        var snap = origem.ExportarEstado();

        var destino = new PilotReaction();
        // Antes de importar: agente novo → default 250 ms (não aprendeu nada).
        Assert.Equal("default", destino.ComputeCompensation(null, "bubi", 3, null, 250).Source);

        destino.ImportarEstado(snap);

        // Depois de importar: usa o perfil aprendido (200 ms). Com piloto/trecho nulos, o
        // candidato "exact" já é a chave aprendida (x:bubi:3:x) → fonte "exact".
        var c = destino.ComputeCompensation(null, "bubi", 3, null, rpmRiseRate: 250);
        Assert.Equal("exact", c.Source);
        Assert.Equal(200, c.RtMs, 1);
    }

    [Fact]
    public void LMP_02_Round_trip_via_JSON_sobrevive_a_serializacao()
    {
        var snap = Maduro().ExportarEstado();
        var json = JsonSerializer.Serialize(snap);
        var voltou = JsonSerializer.Deserialize<PilotReactionSnapshot>(json);

        Assert.NotNull(voltou);
        var destino = new PilotReaction();
        destino.ImportarEstado(voltou);
        Assert.Equal(200, destino.ComputeCompensation(null, "bubi", 3, null, 250).RtMs, 1);
    }

    [Fact]
    public void LMP_03_ImportarEstado_null_e_lixo_nao_quebram()
    {
        var ag = new PilotReaction();
        ag.ImportarEstado(null); // best-effort: nada acontece
        // perfil com valores inválidos é ignorado (não vira antecipação) — versão VIGENTE,
        // pra exercitar a validação por entrada (v1 seria descartado inteiro antes dela).
        ag.ImportarEstado(new PilotReactionSnapshot(PilotReaction.SnapshotVersao, new[]
        {
            new PerfilReacao("", 200, 10, 0),                       // key vazia
            new PerfilReacao("x:bubi:3:x", double.NaN, 10, 0),      // rt inválido
            new PerfilReacao("x:bubi:4:x", 200, -1, 0),             // amostras negativas
        }));
        Assert.Empty(ag.Profiles);
    }

    [Fact]
    public void LMP_05_snapshot_v1_regua_antiga_e_descartado_inteiro()
    {
        // A régua da reação mudou na v2 (2026-07-10: medida de onde a luz ACENDEU, não do alvo
        // fixo). Perfis v1 valem ≈ METADE da reação real — importar contaminaria o EMA novo por
        // dezenas de trocas. Snapshot de versão anterior é descartado: reaprende limpo.
        var ag = new PilotReaction();
        ag.ImportarEstado(new PilotReactionSnapshot(1, new[]
        {
            new PerfilReacao("x:bubi:3:x", 150, 20, 0),   // perfil "maduro" da régua antiga
        }));
        Assert.Empty(ag.Profiles);
        Assert.Equal("default", ag.ComputeCompensation(null, "bubi", 3, null, 250).Source);

        // E o snapshot exportado hoje declara a versão vigente (round-trip continua válido).
        Assert.Equal(PilotReaction.SnapshotVersao, ag.ExportarEstado().Versao);
    }

    [Fact]
    public void LMP_04_A_ponte_do_maestro_persiste_a_reacao_da_luz()
    {
        // Ensina o maestro observando trocas reais (queda forte do giro vinda da zona de troca),
        // exporta, e um maestro NOVO importa e passa a ter o mesmo perfil de reação.
        // kmh=0 → o detector de marcha não afirma marcha (confiança imatura rejeitaria o
        // aprendizado); assim cada troca ensina o perfil GENÉRICO (conf=1.0), determinístico.
        var luz = new LuzMarchaAntecipacao("bubi");
        var t = 0.0;
        for (var volta = 0; volta < PilotReaction.MinSamples + 2; volta++)
        {
            // sobe até a zona de troca…
            for (var rpm = 5200.0; rpm <= 6100; rpm += 300) { luz.Amostra(rpm, 0, t, 6050, null); t += 0.05; }
            // …e cai forte (subida de marcha) → evento de reação aprendido.
            luz.Amostra(5100, 0, t, 6050, null); t += 0.05;
        }
        var snap = luz.ExportarReacao();
        Assert.NotEmpty(snap.Perfis);

        var nova = new LuzMarchaAntecipacao("bubi");
        nova.ImportarReacao(snap);
        Assert.Equal(luz.Perfis.Count, nova.Perfis.Count);
    }
}
