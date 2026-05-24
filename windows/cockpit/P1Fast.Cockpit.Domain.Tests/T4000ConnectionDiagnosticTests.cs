// Cobertura T4000ConnectionDiagnostic: 7 cenários de falha + caminho feliz +
// transições entre estados.

using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class T4000ConnectionDiagnosticTests
{
    private static T4000HealthSample Sample(
        int portsDetected = 1,
        bool portOpenAttempted = true,
        bool portOpenSucceeded = true,
        bool portBusyError = false,
        long bytesReceivedTotal = 0,
        long msSinceLastByte = 0,
        long sentinelsP4Total = 0,
        long sentinelsP5Total = 0,
        long cyclesOkTotal = 0,
        long cyclesBadTotal = 0,
        long msSinceLastCycleOk = 0)
        => new(portsDetected, portOpenAttempted, portOpenSucceeded, portBusyError,
            bytesReceivedTotal, msSinceLastByte, sentinelsP4Total, sentinelsP5Total,
            cyclesOkTotal, cyclesBadTotal, msSinceLastCycleOk);

    [Fact]
    public void DIAG_01_sem_portas_detectadas_retorna_NoPortsDetected_com_mensagem_humana()
    {
        var diag = new T4000ConnectionDiagnostic();
        var result = diag.Evaluate(Sample(portsDetected: 0, portOpenAttempted: false, portOpenSucceeded: false));

        Assert.Equal(T4000ConnectionState.NoPortsDetected, result.State);
        Assert.Contains("Plugue o cabo", result.SugestaoAcao);
        Assert.True(result.AutoRecoveryRecomendada);
    }

    [Fact]
    public void DIAG_02_porta_ocupada_retorna_PortBusy()
    {
        var diag = new T4000ConnectionDiagnostic();
        var result = diag.Evaluate(Sample(
            portOpenAttempted: true, portOpenSucceeded: false, portBusyError: true));

        Assert.Equal(T4000ConnectionState.PortBusy, result.State);
        Assert.Contains("outro programa", result.MensagemHumana);
        Assert.Contains("Injepro", result.SugestaoAcao);
    }

    [Fact]
    public void DIAG_03_porta_aberta_sem_dados_apos_3s_retorna_PortOpenNoData()
    {
        var diag = new T4000ConnectionDiagnostic();
        var result = diag.Evaluate(Sample(
            portOpenSucceeded: true, bytesReceivedTotal: 0, msSinceLastByte: 3500));

        Assert.Equal(T4000ConnectionState.PortOpenNoData, result.State);
        Assert.Contains("não está cospindo dados", result.MensagemHumana);
    }

    [Fact]
    public void DIAG_04_bytes_chegando_sem_sentinelas_retorna_ProtocolMismatch()
    {
        var diag = new T4000ConnectionDiagnostic();
        var result = diag.Evaluate(Sample(
            portOpenSucceeded: true,
            bytesReceivedTotal: 500,
            sentinelsP4Total: 0,
            sentinelsP5Total: 0));

        Assert.Equal(T4000ConnectionState.ProtocolMismatch, result.State);
        Assert.Contains("padrão da T4000", result.MensagemHumana);
    }

    [Fact]
    public void DIAG_05_maioria_dos_ciclos_com_checksum_ruim_retorna_ChecksumFlapping()
    {
        var diag = new T4000ConnectionDiagnostic();
        // 12 ciclos: 4 OK + 8 ruins → 66% ruim, acima do 50% threshold
        var result = diag.Evaluate(Sample(
            portOpenSucceeded: true,
            bytesReceivedTotal: 1000,
            sentinelsP4Total: 12,
            sentinelsP5Total: 12,
            cyclesOkTotal: 4,
            cyclesBadTotal: 8));

        Assert.Equal(T4000ConnectionState.ChecksumFlapping, result.State);
        Assert.Contains("corrompida", result.MensagemHumana);
    }

    [Fact]
    public void DIAG_06_funcionava_e_caiu_retorna_ConnectionFlapping()
    {
        var diag = new T4000ConnectionDiagnostic();
        // 1º: healthy
        var healthy = diag.Evaluate(Sample(
            portOpenSucceeded: true,
            bytesReceivedTotal: 1000,
            sentinelsP4Total: 30,
            sentinelsP5Total: 30,
            cyclesOkTotal: 30,
            msSinceLastCycleOk: 100));
        Assert.Equal(T4000ConnectionState.Healthy, healthy.State);

        // 2º: cycles ainda existem mas última OK foi há 5,5s → ConnectionFlapping
        var dropped = diag.Evaluate(Sample(
            portOpenSucceeded: true,
            bytesReceivedTotal: 1100,
            sentinelsP4Total: 30,
            sentinelsP5Total: 30,
            cyclesOkTotal: 30,
            msSinceLastCycleOk: 5_500));

        Assert.Equal(T4000ConnectionState.ConnectionFlapping, dropped.State);
        Assert.Contains("parou", dropped.MensagemHumana);
    }

    [Fact]
    public void DIAG_07_tudo_certo_retorna_Healthy_sem_auto_recuperacao()
    {
        var diag = new T4000ConnectionDiagnostic();
        var result = diag.Evaluate(Sample(
            portOpenSucceeded: true,
            bytesReceivedTotal: 2000,
            sentinelsP4Total: 50,
            sentinelsP5Total: 50,
            cyclesOkTotal: 50,
            msSinceLastCycleOk: 50));

        Assert.Equal(T4000ConnectionState.Healthy, result.State);
        Assert.Contains("Tudo certo", result.MensagemHumana);
        Assert.False(result.AutoRecoveryRecomendada);
    }

    [Fact]
    public void DIAG_08_onStateChanged_dispara_apenas_em_transicao()
    {
        var changes = new List<T4000Diagnostic>();
        var diag = new T4000ConnectionDiagnostic(onStateChanged: changes.Add);

        diag.Evaluate(Sample(portsDetected: 0, portOpenAttempted: false, portOpenSucceeded: false));
        diag.Evaluate(Sample(portsDetected: 0, portOpenAttempted: false, portOpenSucceeded: false)); // mesmo estado
        diag.Evaluate(Sample(portsDetected: 0, portOpenAttempted: false, portOpenSucceeded: false)); // mesmo estado
        diag.Evaluate(Sample(portOpenSucceeded: true, bytesReceivedTotal: 0, msSinceLastByte: 4000));

        Assert.Equal(2, changes.Count);
        Assert.Equal(T4000ConnectionState.NoPortsDetected, changes[0].State);
        Assert.Equal(T4000ConnectionState.PortOpenNoData, changes[1].State);
    }

    [Fact]
    public void DIAG_09_checksum_ruim_so_acusa_depois_de_10_ciclos_minimos()
    {
        var diag = new T4000ConnectionDiagnostic();
        // 5 ciclos só, todos ruins → ainda assim não acusa flapping
        var result = diag.Evaluate(Sample(
            portOpenSucceeded: true,
            bytesReceivedTotal: 500,
            sentinelsP4Total: 5,
            sentinelsP5Total: 5,
            cyclesOkTotal: 0,
            cyclesBadTotal: 5));

        Assert.NotEqual(T4000ConnectionState.ChecksumFlapping, result.State);
    }

    [Fact]
    public void DIAG_10_ProtocolMismatch_so_acusa_depois_de_minimo_de_bytes()
    {
        var diag = new T4000ConnectionDiagnostic();
        // 50 bytes só, sem sentinelas → ainda pouco pra acusar
        var result = diag.Evaluate(Sample(
            portOpenSucceeded: true,
            bytesReceivedTotal: 50));

        Assert.NotEqual(T4000ConnectionState.ProtocolMismatch, result.State);
    }
}
