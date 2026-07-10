// RelogioFiacaoTests — captura o CONTRATO do relógio da fiação ao vivo (JANELA 1 da auditoria
// 2026-07-09). O leitor T3000 entrega TMono em MILISSEGUNDOS (Stopwatch); o maestro (Domain) fala
// SEGUNDOS (histerese 2b do óleo/rica + Onda 7). A conversão mora na FIAÇÃO (CapturaDiaDePista /
// MainWindow.Live), não no Domain. Estes testes falhariam se o TMono voltasse a ser passado cru.
//
// Cobre:
//   1.1 — supressão do óleo segura 2 s REAIS e a Onda 7 aprende, alimentando o caminho vivo
//         (CapturaDiaDePista) com TMono em ms.
//   1.3 — religada pós-stall rearma a supressão da partida (gap de tSeg) — sem ÓLEO BAIXO falso.
//   1.4 — LastUpdated do perfil de reação é epoch-ms (comparável entre sessões), não o relógio
//         de sessão (que reinicia do zero).

using System.Collections.Generic;
using System.Linq;
using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class RelogioFiacaoTests
{
    private static CapturaDiaDePista NovaCaptura(out CockpitState cockpit, out CockpitOrchestrator painel)
    {
        var store = new InMemorySessionStore();
        var rec = new SessionRecorder(store);
        cockpit = new CockpitState();
        painel = new CockpitOrchestrator(cockpit);
        return new CapturaDiaDePista(rec, painel);
    }

    // ── 1.1 — TMono (ms) convertido pra segundos na fiação ───────────────────────

    [Fact]
    public void FIO_01_TMono_ms_supressao_do_oleo_segura_2s_reais_pela_fiacao()
    {
        var captura = NovaCaptura(out var cockpit, out _);

        // Motor rodando com o BIT de óleo ligado; TMono em MILISSEGUNDOS (como o leitor entrega).
        // Água fria e bateria boa pra o óleo ser o ÚNICO alerta possível.
        T3000Sample Oleo(double tmonoMs) => new()
        {
            Rpm = 3000, TMono = tmonoMs, WaterTempC = 60, BatteryV = 13.0, FuelInjectionBalanced = true,
            Alarmes = new Dictionary<string, bool> { ["baixaPressaoOleo"] = true },
        };

        // Nos primeiros ~2 s de motor rodando o pico da partida é SUPRIMIDO (nenhum alerta).
        captura.Motor(Oleo(0));
        Assert.Null(cockpit.Get().Message);
        captura.Motor(Oleo(1000));
        Assert.Null(cockpit.Get().Message);
        captura.Motor(Oleo(1900));   // 1,9 s reais: ainda dentro da janela de 2 s
        Assert.Null(cockpit.Get().Message);

        // 2,0 s REAIS (2000 ms): passou a partida → ÓLEO BAIXO aparece. Se o TMono fosse passado
        // cru (ms lido como "segundos"), a janela de 2 s teria estourado na 1ª amostra e o óleo
        // NUNCA chegaria aqui como novidade — este assert quebra sem a conversão.
        captura.Motor(Oleo(2000));
        Assert.Equal("Óleo Baixo", cockpit.Get().Message?.Texto);
    }

    [Fact]
    public void FIO_02_TMono_ms_a_Onda7_aprende_a_reacao_pela_fiacao()
    {
        var captura = NovaCaptura(out _, out var painel);

        // Uma subida de marcha: o giro sobe além do ponto (6100 > 6050) e CAI forte (>700),
        // com o acelerador no fundo (flat-shift). TMono em MILISSEGUNDOS, ~200 ms entre amostras
        // (0,2 s reais → dentro da janela de ritmo de 0,8 s, então o ritmo de subida é > 0).
        T3000Sample M(int rpm, double tmonoMs) => new()
        {
            Rpm = rpm, TMono = tmonoMs, WaterTempC = 60, BatteryV = 13.0, TpsPct = 80,
        };
        captura.Motor(M(5000, 0));
        captura.Motor(M(5400, 200));
        captura.Motor(M(5800, 400));
        captura.Motor(M(6100, 600));   // pico acima do alvo → trocou DEPOIS do ponto (delta ≥ 0)
        captura.Motor(M(5300, 800));   // queda de 800 rpm → subida de marcha → aprende

        // Com a conversão ms→s a janela de ritmo funciona e o perfil é aprendido. Sem ela o ritmo
        // some (janela de 0,8 ms), o ritmo vira 0 e nada é aprendido — este assert quebra.
        Assert.NotEmpty(painel.LuzMarchaPerfis);
    }

    // ── 1.3 — religada pós-stall rearma a supressão da partida ───────────────────

    [Fact]
    public void FIO_03_religada_pos_stall_rearma_a_supressao_do_oleo()
    {
        var ac = new AlertasCriticos();
        var oleo = new AmostraAlerta { BaixaPressaoOleo = true, Rpm = 3000 };

        // Motor rodando: passou a partida e o óleo ALARMA normalmente.
        ac.IngestT4000(oleo, 0.0);
        ac.IngestT4000(oleo, 2.0);
        Assert.Equal("OLEO_BAIXO", ac.GetMensagemPrincipal()!.Id);

        // Motor emudeceu (USB/motor caíram juntos): as amostras PARARAM ~30 s. A volta do motor
        // traz um tSeg bem à frente do último — o gap rearma a supressão da partida.
        ac.IngestT4000(oleo, 32.0);            // 1ª amostra pós-religada: pico da partida → SUPRIMIDO
        Assert.Null(ac.GetMensagemPrincipal());
        ac.IngestT4000(oleo, 33.5);            // 1,5 s reais depois: ainda dentro da janela de 2 s
        Assert.Null(ac.GetMensagemPrincipal());

        // 2 s após a religada: alarma de novo (honesto). Sem o rearme, o óleo dispararia FALSO já
        // na 1ª amostra pós-stall (o _ligadoDesdeT antigo faria passouDaPartida verdadeiro).
        ac.IngestT4000(oleo, 34.0);
        Assert.Equal("OLEO_BAIXO", ac.GetMensagemPrincipal()!.Id);
    }

    // ── 1.4 — LastUpdated do perfil é epoch, não relógio de sessão ───────────────

    [Fact]
    public void FIO_04_LastUpdated_do_perfil_e_epoch_nao_relogio_de_sessao()
    {
        var a = new LuzMarchaAntecipacao();
        // Uma troca simples (sem TPS → aprende direto). tSeg em SEGUNDOS de sessão (valores pequenos).
        a.Amostra(5000, 0, 0.0, 6050, null);
        a.Amostra(6100, 0, 0.2, 6050, null);   // pico acima do alvo
        a.Amostra(5300, 0, 0.4, 6050, null);   // queda → aprende
        Assert.NotEmpty(a.Perfis);

        // LastUpdated tem que ser epoch-ms (comparável ENTRE sessões), não o relógio de sessão (que
        // começaria do zero — aqui 0,4 s → 400 ms). Piso: 1º jan 2020 em epoch-ms.
        var perfil = a.Perfis.Values.First();
        Assert.True(perfil.LastUpdated > 1_577_836_800_000L,
            $"LastUpdated deveria ser epoch-ms; veio {perfil.LastUpdated} (relógio de sessão?)");
    }
}
