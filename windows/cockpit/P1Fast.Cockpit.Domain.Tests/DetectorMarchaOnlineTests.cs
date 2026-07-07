// DetectorMarchaOnline (Flávio 2026-07-07): descobre a marcha pela razão giro÷velocidade
// (RaceBox 25 Hz), sem sensor de câmbio. Porte de gear-detector-online.js. Cobre: descoberta
// da 1ª/2ª marcha por razão, confiança crescente, e a rejeição de amostras instáveis (parado,
// giro baixo, aceleração brusca).

using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class DetectorMarchaOnlineTests
{
    [Fact]
    public void DMO_01_descobre_a_primeira_marcha_por_razao_estavel()
    {
        var d = new DetectorMarchaOnline();
        for (var i = 0; i < 5; i++) d.Ingest(4000, 100, i * 0.15); // razão 40, giro estável
        Assert.Equal(1, d.MarchaAtual);
        Assert.Equal(1, d.MarchasDescobertas);
    }

    [Fact]
    public void DMO_02_uma_razao_diferente_vira_a_segunda_marcha()
    {
        var d = new DetectorMarchaOnline();
        for (var i = 0; i < 5; i++) d.Ingest(4000, 100, i * 0.15);        // 1ª: razão 40
        for (var i = 0; i < 5; i++) d.Ingest(4000, 140, 1.0 + i * 0.15);  // 2ª: razão ~28,6
        Assert.Equal(2, d.MarchaAtual);
        Assert.Equal(2, d.MarchasDescobertas);
    }

    [Fact]
    public void DMO_03_parado_ou_giro_baixo_nao_estima_marcha()
    {
        var d = new DetectorMarchaOnline();
        d.Ingest(4000, 2, 0.0);   // km/h < 5 (parado/box) → ignora
        d.Ingest(800, 100, 0.1);  // rpm < 1000 → ignora
        Assert.Null(d.MarchaAtual);
    }

    [Fact]
    public void DMO_04_aceleracao_brusca_nao_conta_como_marcha_estavel()
    {
        var d = new DetectorMarchaOnline();
        for (var i = 0; i < 5; i++) d.Ingest(3000 + i * 500, 100, i * 0.1); // +5000 rpm/s → instável
        Assert.Null(d.MarchaAtual);
    }

    [Fact]
    public void DMO_05_confianca_cresce_com_as_amostras()
    {
        var d = new DetectorMarchaOnline();
        for (var i = 0; i < 20; i++) d.Ingest(4000, 100, i * 0.1);
        Assert.NotNull(d.MarchaAtual);
        Assert.True(d.Confianca > 0);
    }
}
