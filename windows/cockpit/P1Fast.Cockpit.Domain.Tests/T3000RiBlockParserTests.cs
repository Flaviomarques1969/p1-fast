// Round-trip do bloco RI: T3000RiBlockBuilder (encode) → T3000RiBlockParser
// (decode). Trava os offsets e as escalas do protocolo USB da T3000/T4000.

using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class T3000RiBlockParserTests
{
    [Fact]
    public void Buffer_curto_demais_retorna_null()
    {
        Assert.Null(T3000RiBlockParser.Parse(new byte[109]));
    }

    [Fact]
    public void Buffer_no_limite_minimo_decodifica()
    {
        var s = T3000RiBlockParser.Parse(new byte[110]);
        Assert.NotNull(s);
        Assert.Equal(110, s!.BytesLen);
    }

    [Fact]
    public void Campos_principais_fazem_round_trip()
    {
        var bloco = T3000RiBlockBuilder.Build(
            rpm: 6800, batteryV: 13.4, mapBar: 1.25, tpsPct: 87.5,
            waterTempC: 96, airTempC: 41, lambda: 0.882, speedKmh: 172.3,
            mapaAtual: 4);

        var s = T3000RiBlockParser.Parse(bloco);

        Assert.NotNull(s);
        Assert.Equal(6800, s!.Rpm);
        Assert.Equal(13.4, s.BatteryV, 3);
        Assert.Equal(1.25, s.MapBar, 3);
        Assert.Equal(87.5, s.TpsPct, 3);
        Assert.Equal(96, s.WaterTempC);
        Assert.Equal(41, s.AirTempC);
        Assert.Equal(0.882, s.Lambda, 3);
        Assert.Equal(172.3, s.SpeedKmh, 3);
        Assert.Equal(4, s.MapaAtual);
    }

    [Fact]
    public void Map_negativo_vacuo_faz_round_trip()
    {
        var bloco = T3000RiBlockBuilder.Build(mapBar: -0.45);
        var s = T3000RiBlockParser.Parse(bloco);
        Assert.NotNull(s);
        Assert.Equal(-0.45, s!.MapBar, 3);
    }

    [Fact]
    public void Sonda_de_temperatura_ausente_vira_null()
    {
        var bloco = T3000RiBlockBuilder.Build(waterTempC: null, airTempC: null);
        var s = T3000RiBlockParser.Parse(bloco);
        Assert.NotNull(s);
        Assert.Null(s!.WaterTempC);
        Assert.Null(s.AirTempC);
    }

    [Fact]
    public void Alarmes_fazem_round_trip_bit_a_bit()
    {
        var alarmes = new T3000Alarmes(
            ExcessoRotacao: true,
            ExcessoPressao: false,
            ExcessoTempMotor: true,
            ExcessoAberturaInjetor: false,
            BaixaPressaoOleo: true,
            WbMinimo: false,
            WbMaximo: true,
            NbMinimo: false,
            NbMaximo: false,
            BaixaPressaoCombustivel: true,
            AlertaNivelCombustivel: false);

        var bloco = T3000RiBlockBuilder.Build(alarmes: alarmes);
        var s = T3000RiBlockParser.Parse(bloco);

        Assert.NotNull(s);
        Assert.True(s!.Alarmes.ExcessoRotacao);
        Assert.False(s.Alarmes.ExcessoPressao);
        Assert.True(s.Alarmes.ExcessoTempMotor);
        Assert.True(s.Alarmes.BaixaPressaoOleo);
        Assert.True(s.Alarmes.WbMaximo);
        Assert.True(s.Alarmes.BaixaPressaoCombustivel);
        Assert.False(s.Alarmes.AlertaNivelCombustivel);
    }

    [Fact]
    public void Sem_alarmes_QualquerAtivo_falso()
    {
        var s = T3000RiBlockParser.Parse(T3000RiBlockBuilder.Build());
        Assert.NotNull(s);
        Assert.False(s!.Alarmes.QualquerAtivo);
    }

    [Fact]
    public void Cronometros_fazem_round_trip()
    {
        var bloco = T3000RiBlockBuilder.Build(cronoParcialS: 12.345, cronoTotalS: 87.654);
        var s = T3000RiBlockParser.Parse(bloco);
        Assert.NotNull(s);
        Assert.Equal(12.345, s!.CronometroParcialS!.Value, 3);
        Assert.Equal(87.654, s.CronometroTotalS!.Value, 3);
    }

    // ── Gate de aceitação do leitor USB (EhLeituraPlausivel) ───────

    [Fact]
    public void Leitura_normal_eh_plausivel()
    {
        var s = T3000RiBlockParser.Parse(T3000RiBlockBuilder.Build(rpm: 5000, batteryV: 13.5));
        Assert.True(T3000RiBlockParser.EhLeituraPlausivel(s));
    }

    [Fact]
    public void Null_nao_eh_plausivel()
    {
        Assert.False(T3000RiBlockParser.EhLeituraPlausivel(null));
    }

    [Fact]
    public void Bateria_impossivel_rejeita()
    {
        // Bloco zerado → bateria 0 V → fora da faixa [3,20] → lixo de endpoint.
        var s = T3000RiBlockParser.Parse(new byte[200]);
        Assert.False(T3000RiBlockParser.EhLeituraPlausivel(s));
    }

    [Fact]
    public void Rpm_absurdo_rejeita()
    {
        var s = T3000RiBlockParser.Parse(T3000RiBlockBuilder.Build(rpm: 60000, batteryV: 13.0));
        Assert.False(T3000RiBlockParser.EhLeituraPlausivel(s));
    }
}
