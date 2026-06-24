// Porte do RaceBox (GPS): round-trip build→parse, enquadramento (streaming),
// checksum, e o GPS dirigindo a troca de tela (parado→sensores / andando→cockpit).

using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class RaceBoxParserTests
{
    [Fact]
    public void Round_trip_decodifica_velocidade_e_posicao()
    {
        var f = RaceBoxFrameBuilder.Build(fix: 3, numSV: 9, speedKmh: 142.7, lat: -15.7795, lon: -47.9297);
        var (amostras, consumido) = RaceBoxParser.Parse(f);

        Assert.Single(amostras);
        Assert.Equal(f.Length, consumido);
        var s = amostras[0];
        Assert.Equal(3, s.Fix);
        Assert.Equal(9, s.NumSV);
        Assert.Equal(142.7, s.SpeedKmh, 1);
        Assert.Equal(-15.7795, s.Lat, 4);
        Assert.Equal(-47.9297, s.Lon, 4);
        Assert.True(s.TemSinal);
    }

    [Fact]
    public void Checksum_ruim_eh_descartado_mas_consumido()
    {
        var f = RaceBoxFrameBuilder.Build(speedKmh: 50);
        f[^1] ^= 0xFF; // corrompe o checksum
        var (amostras, consumido) = RaceBoxParser.Parse(f);
        Assert.Empty(amostras);
        Assert.Equal(f.Length, consumido); // avança mesmo assim (espelha o JS)
    }

    [Fact]
    public void Frame_incompleto_nao_consome_e_espera()
    {
        var f = RaceBoxFrameBuilder.Build();
        var parcial = f.AsSpan(0, f.Length - 5).ToArray(); // faltam bytes do fim
        var (amostras, consumido) = RaceBoxParser.Parse(parcial);
        Assert.Empty(amostras);
        Assert.Equal(0, consumido); // segura o buffer pro próximo notify
    }

    [Fact]
    public void Sincroniza_apos_lixo_antes_do_header()
    {
        var f = RaceBoxFrameBuilder.Build(speedKmh: 33);
        var comLixo = new byte[] { 0x00, 0x11, 0x22 }.Concat(f).ToArray();
        var (amostras, _) = RaceBoxParser.Parse(comLixo);
        Assert.Single(amostras);
        Assert.Equal(33, amostras[0].SpeedKmh, 1);
    }

    [Fact]
    public void Dois_frames_concatenados_dao_duas_amostras()
    {
        var a = RaceBoxFrameBuilder.Build(speedKmh: 10);
        var b = RaceBoxFrameBuilder.Build(speedKmh: 80);
        var (amostras, consumido) = RaceBoxParser.Parse(a.Concat(b).ToArray());
        Assert.Equal(2, amostras.Count);
        Assert.Equal(10, amostras[0].SpeedKmh, 1);
        Assert.Equal(80, amostras[1].SpeedKmh, 1);
        Assert.Equal(a.Length + b.Length, consumido);
    }

    [Fact]
    public void Sobra_parcial_apos_um_frame_completo_fica_pro_proximo()
    {
        var a = RaceBoxFrameBuilder.Build(speedKmh: 60);
        var b = RaceBoxFrameBuilder.Build(speedKmh: 90);
        var buf = a.Concat(b.AsSpan(0, 4).ToArray()).ToArray(); // 2º frame só começou
        var (amostras, consumido) = RaceBoxParser.Parse(buf);
        Assert.Single(amostras);
        Assert.Equal(a.Length, consumido); // sobra os 4 bytes do 2º frame
    }

    [Fact]
    public void Sem_sinal_quando_fix_zero()
    {
        var f = RaceBoxFrameBuilder.Build(fix: 0, numSV: 0);
        var (amostras, _) = RaceBoxParser.Parse(f);
        Assert.False(amostras[0].TemSinal);
    }

    // ── GPS dirigindo a troca de tela (parado→sensores / andando→cockpit) ──

    [Fact]
    public void Gps_do_racebox_alterna_as_telas_por_movimento()
    {
        var det = new ModoTelaDetector(entraAndandoKmh: 6, voltaParadoKmh: 2);

        var parado = RaceBoxParser.Parse(RaceBoxFrameBuilder.Build(speedKmh: 0.4)).amostras[0];
        det.Atualizar(parado.SpeedKmh);
        Assert.Equal(ModoTela.Parado, det.Modo);

        var saindo = RaceBoxParser.Parse(RaceBoxFrameBuilder.Build(speedKmh: 25)).amostras[0];
        det.Atualizar(saindo.SpeedKmh);
        Assert.Equal(ModoTela.Andando, det.Modo); // carro saiu → cockpit
    }
}
