// Cobertura LivePanel.Render: presença das seções esperadas, mensagem
// humana do diagnóstico aparecendo, histórico de tentativas, info técnica
// pro Claude Code, e arquivo suspeito por estado de falha.
//
// Vive em Domain.Tests pra reutilizar a infra do xunit; mas referencia
// o projeto do demo. (Adicionado via ProjectReference no .csproj.)

using P1Fast.Cockpit.Domain;
using P1Fast.Cockpit.T4000LiveDemo;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class LivePanelTests
{
    private static T4000HealthSample HealthOk() =>
        new(1, true, true, false, 5_000, 50, 50, 50, 50, 0, 100);

    private static T4000Diagnostic DiagOk() => new(
        T4000ConnectionState.Healthy,
        "Tudo certo. T4000 conectada e mandando dados.",
        "Nada a fazer.",
        false);

    private static T4000Sample SampleCruise() => new(
        Rpm: 3500, SpeedKmh: 100, OilPressBar: 4, OilTempC: 90,
        WaterTempC: 90, FuelPressBar: 3.5, BatteryV: 14, TpsPct: 25,
        MapBar: 0.7, AirTempC: 38, EgtC: 600, EgtOutOfRange: false, Lambda: 0.98,
        FuelTempC: 40, Marcha: 4, EcuErrorBits: 0);

    private static PanelInput MakeInput(
        T4000Diagnostic? diag = null,
        IReadOnlyList<TentativaLog>? tentativas = null) =>
        new(
            AgoraUtc: new DateTime(2026, 5, 24, 4, 30, 0, DateTimeKind.Utc),
            CenarioAtual: "Cruise",
            UltimoSample: SampleCruise(),
            Health: HealthOk(),
            Diagnostico: diag ?? DiagOk(),
            AcaoRecuperacao: null,
            BytesRecebidosTotal: 12_400,
            PacotesProcessadosTotal: 1_550,
            PublicadoRealtime: 31,
            DescartadoThrottle: 279,
            TentativasRecentes: tentativas ?? Array.Empty<TentativaLog>(),
            Versao: "demo 2026-05-24",
            Repositorio: "github.com/Flaviomarques1969/p1-fast",
            Branch: "main");

    [Fact]
    public void PAN_01_render_contem_titulo_data_e_secoes_principais()
    {
        var output = LivePanel.Render(MakeInput());
        Assert.Contains("P1 FAST — PAINEL T4000 AO VIVO", output);
        Assert.Contains("CENÁRIO SIMULADO : Cruise", output);
        Assert.Contains("ESTADO DA CONEXÃO:", output);
        Assert.Contains("DADOS DA CENTRAL T4000", output);
        Assert.Contains("SAÚDE DA CONEXÃO", output);
        Assert.Contains("DIAGNÓSTICO", output);
        Assert.Contains("TENTATIVAS RECENTES", output);
        Assert.Contains("INFO PRO CLAUDE CODE", output);
    }

    [Fact]
    public void PAN_02_estado_healthy_mostra_marcador_OK_e_nao_pede_acao()
    {
        var output = LivePanel.Render(MakeInput(diag: DiagOk()));
        Assert.Contains("OK", output);
        Assert.Contains("tudo certo", output);
        Assert.DoesNotContain("AÇÃO SUGERIDA", output);
    }

    [Fact]
    public void PAN_03_estado_falha_mostra_marcador_e_acao_sugerida()
    {
        var diag = new T4000Diagnostic(
            T4000ConnectionState.PortOpenNoData,
            "Conectei na porta USB mas a T4000 não está cospindo dados.",
            "Confira chave em ON e cabo firme.",
            true);
        var output = LivePanel.Render(MakeInput(diag: diag));
        Assert.Contains("FALHA", output);
        Assert.Contains("não está cospindo dados", output);
        Assert.Contains("AÇÃO SUGERIDA", output);
        Assert.Contains("chave em ON", output);
    }

    [Fact]
    public void PAN_04_dados_da_central_aparecem_quando_ha_sample()
    {
        var output = LivePanel.Render(MakeInput());
        Assert.Contains("3500", output);  // RPM
        Assert.Contains("90.0", output);  // temperatura
        Assert.Contains("0.98", output);  // lambda
    }

    [Fact]
    public void PAN_05_historico_de_tentativas_aparece_com_horario_tipo_e_detalhe()
    {
        var t = new List<TentativaLog>
        {
            new(new DateTime(2026, 5, 24, 4, 25, 0, DateTimeKind.Utc), "rescan-ports", "Re-listando portas USB."),
            new(new DateTime(2026, 5, 24, 4, 26, 0, DateTimeKind.Utc), "change-baud",  "Trocando pra 921600."),
        };
        var output = LivePanel.Render(MakeInput(tentativas: t));
        Assert.Contains("rescan-ports", output);
        Assert.Contains("change-baud", output);
        Assert.Contains("921600", output);
    }

    [Fact]
    public void PAN_06_info_tecnica_inclui_versao_repo_branch_e_arquivo_suspeito()
    {
        var diag = new T4000Diagnostic(
            T4000ConnectionState.ProtocolMismatch,
            "Recebi dados, mas eles não parecem ser do padrão da T4000.",
            "Vou tentar velocidades alternativas.",
            true);
        var output = LivePanel.Render(MakeInput(diag: diag));
        Assert.Contains("demo 2026-05-24", output);
        Assert.Contains("Flaviomarques1969/p1-fast", output);
        Assert.Contains("main", output);
        Assert.Contains("ProtocolMismatch", output);
        Assert.Contains("T4000PacketParser.cs", output); // arquivo suspeito pra esse estado
    }
}
