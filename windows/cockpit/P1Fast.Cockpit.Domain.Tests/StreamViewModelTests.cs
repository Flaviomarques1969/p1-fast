// MS-11.5 — testes do StreamViewModel
// Espelham o comportamento documentado em StreamViewModel.cs.

using System;
using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class StreamViewModelTests
{
    [Fact]
    public void VM_01_default_status_eh_Parado()
    {
        var vm = new StreamViewModel();
        Assert.Equal(StreamStatus.Parado, vm.Status);
        Assert.Null(vm.DailyRoomUrl);
        Assert.Null(vm.VideoStreamId);
    }

    [Fact]
    public void VM_02_OnStreamStarted_vai_pra_AoVivo_e_guarda_url()
    {
        var vm = new StreamViewModel();
        vm.OnStreamStarted("vid-1", "https://p1fast.daily.co/abc");
        Assert.Equal(StreamStatus.AoVivo, vm.Status);
        Assert.Equal("vid-1", vm.VideoStreamId);
        Assert.Equal("https://p1fast.daily.co/abc", vm.DailyRoomUrl);
        Assert.NotNull(vm.UltimaHeartbeatRecebida);
    }

    [Fact]
    public void VM_03_Tick_apos_10s_sem_heartbeat_muda_pra_SemSinal()
    {
        var vm = new StreamViewModel();
        var t0 = new DateTimeOffset(2026, 5, 12, 12, 0, 0, TimeSpan.Zero);
        vm.OnStreamStarted("vid-2", "url");
        // Force timestamp inicial (já registrado por OnStreamStarted)
        // Avança 11 segundos
        var t1 = t0.AddSeconds(11);
        // Hack pra atualizar ultima_heartbeat: re-chama OnHeartbeat com t0
        // (testes mais fiéis usariam injecting de clock — simplificamos)
        // Re-cria com clock fixo
        var vm2 = new StreamViewModel();
        vm2.OnStreamStarted("vid-2", "url");
        // Como UltimaHeartbeatRecebida é DateTimeOffset.UtcNow, simulamos
        // passando um Tick com now muito à frente
        var futuro = DateTimeOffset.UtcNow.AddSeconds(11);
        vm2.Tick(futuro);
        Assert.Equal(StreamStatus.SemSinal, vm2.Status);
    }

    [Fact]
    public void VM_04_OnHeartbeat_recupera_de_SemSinal_pra_AoVivo()
    {
        var vm = new StreamViewModel();
        vm.OnStreamStarted("vid-3", "url");
        vm.Tick(DateTimeOffset.UtcNow.AddSeconds(11));
        Assert.Equal(StreamStatus.SemSinal, vm.Status);
        vm.OnHeartbeat();
        Assert.Equal(StreamStatus.AoVivo, vm.Status);
    }

    [Fact]
    public void VM_05_OnStreamEnded_guarda_motivo_e_vai_pra_Encerrado()
    {
        var vm = new StreamViewModel();
        vm.OnStreamStarted("vid-4", "url");
        vm.OnStreamEnded("bateria_baixa");
        Assert.Equal(StreamStatus.Encerrado, vm.Status);
        Assert.Equal("bateria_baixa", vm.UltimoMotivoEncerramento);
    }

    [Fact]
    public void VM_06_MensagemSemSinal_formata_segundos()
    {
        var vm = new StreamViewModel();
        vm.OnStreamStarted("vid-5", "url");
        var futuro = DateTimeOffset.UtcNow.AddSeconds(15);
        vm.Tick(futuro);
        Assert.Equal(StreamStatus.SemSinal, vm.Status);
        var msg = vm.MensagemSemSinal(futuro);
        Assert.Contains("Sem sinal há", msg);
    }

    [Fact]
    public void VM_07_Reset_volta_pra_Parado_e_limpa_tudo()
    {
        var vm = new StreamViewModel();
        vm.OnStreamStarted("vid-6", "url");
        vm.OnStreamEnded("manual");
        vm.Reset();
        Assert.Equal(StreamStatus.Parado, vm.Status);
        Assert.Null(vm.VideoStreamId);
        Assert.Null(vm.DailyRoomUrl);
        Assert.Null(vm.UltimoMotivoEncerramento);
        Assert.Null(vm.UltimaHeartbeatRecebida);
    }
}
