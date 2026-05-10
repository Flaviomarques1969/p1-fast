// 23 facts xUnit equivalentes 1:1 aos smokes T4K-01..T4K-23 do
// tests/node-smoke-t4000.mjs (parser + feeder).

using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class T4000PacketParserTests
{
    private const double Eps = 1e-6;

    private static T4000CycleBytes Fx() => T4000PacketParser.PdfFixture();
    private static T4000Sample Expected() => T4000PacketParser.PdfExpected();

    private static byte[] Copy(IReadOnlyList<byte> src)
    {
        var dst = new byte[src.Count];
        for (var i = 0; i < src.Count; i++) dst[i] = src[i];
        return dst;
    }

    private static T4000CycleBytes WithMutation(Action<byte[], byte[], byte[], byte[], byte[]> mutate)
    {
        var fx = Fx();
        var p1 = Copy(fx.P1);
        var p2 = Copy(fx.P2);
        var p3 = Copy(fx.P3);
        var p4 = Copy(fx.P4);
        var p5 = Copy(fx.P5);
        mutate(p1, p2, p3, p4, p5);
        return new T4000CycleBytes(p1, p2, p3, p4, p5);
    }

    // ── Constantes da spec ────────────────────────────────────

    [Fact]
    public void T4K_01_CAN_ID_0x7FB()
    {
        Assert.Equal(0x7FB, T4000PacketParser.CanId);
    }

    [Fact]
    public void T4K_02_5_pacotes_por_ciclo_8_bytes_cada()
    {
        Assert.Equal(5, T4000PacketParser.PacketsPerCycle);
        Assert.Equal(8, T4000PacketParser.BytesPerPacket);
    }

    // ── Decodificação por pacote (fixture do PDF) ────────────

    [Fact]
    public void T4K_03_pacote1_RPM_velocidade_oleo_pressao_e_temperatura()
    {
        var f = T4000PacketParser.ParsePacket1(Fx().P1);
        var e = Expected();
        Assert.Equal(e.Rpm, f.Rpm);
        Assert.Equal(e.SpeedKmh,    f.SpeedKmh,    Eps);
        Assert.Equal(e.OilPressBar, f.OilPressBar, Eps);
        Assert.Equal(e.OilTempC,    f.OilTempC,    Eps);
    }

    [Fact]
    public void T4K_04_pacote2_agua_combustivel_bateria_TPS()
    {
        var f = T4000PacketParser.ParsePacket2(Fx().P2);
        var e = Expected();
        Assert.Equal(e.WaterTempC,   f.WaterTempC,   Eps);
        Assert.Equal(e.FuelPressBar, f.FuelPressBar, Eps);
        Assert.Equal(e.BatteryV,     f.BatteryV,     Eps);
        Assert.Equal(e.TpsPct,       f.TpsPct,       Eps);
    }

    [Fact]
    public void T4K_05_pacote3_MAP_ar_EGT_lambda()
    {
        var f = T4000PacketParser.ParsePacket3(Fx().P3);
        var e = Expected();
        Assert.Equal(e.MapBar,   f.MapBar,   Eps);
        Assert.Equal(e.AirTempC, f.AirTempC, Eps);
        Assert.Equal(e.EgtC,     f.EgtC);
        Assert.Equal(e.Lambda,   f.Lambda,   Eps);
        Assert.False(f.EgtOutOfRange);
    }

    [Fact]
    public void T4K_06_pacote4_combustivel_marcha_sem_erro_ECU_fixed_tail()
    {
        var f = T4000PacketParser.ParsePacket4(Fx().P4);
        var e = Expected();
        Assert.Equal(e.FuelTempC,    f.FuelTempC,    Eps);
        Assert.Equal(e.Marcha,       f.Marcha);
        Assert.Equal(e.EcuErrorBits, f.EcuErrorBits);
    }

    [Fact]
    public void T4K_07_pacote5_head_FB_FA_e_checksum_0x91()
    {
        var f = T4000PacketParser.ParsePacket5(Fx().P5);
        Assert.Equal(0x91, f.Checksum);
        Assert.Equal(5, f.ReservedBytes.Count);
        Assert.All(f.ReservedBytes, b => Assert.Equal(0, b));
    }

    // ── Identificação heurística ─────────────────────────────

    [Fact]
    public void T4K_08_identify_pacote4_pela_cauda_1E_FC()
    {
        Assert.Equal(4, T4000PacketParser.IdentifyPacketType(Fx().P4));
    }

    [Fact]
    public void T4K_09_identify_pacote5_pela_cabeca_FB_FA()
    {
        Assert.Equal(5, T4000PacketParser.IdentifyPacketType(Fx().P5));
    }

    [Fact]
    public void T4K_10_identify_pacotes_1_2_3_retornam_null()
    {
        Assert.Null(T4000PacketParser.IdentifyPacketType(Fx().P1));
        Assert.Null(T4000PacketParser.IdentifyPacketType(Fx().P2));
        Assert.Null(T4000PacketParser.IdentifyPacketType(Fx().P3));
    }

    // ── Checksum ──────────────────────────────────────────────

    [Fact]
    public void T4K_11_compute_checksum_bate_matematicamente_1937_mod_256_0x91()
    {
        Assert.Equal(0x91, T4000PacketParser.ComputeChecksum(Fx()));
    }

    [Fact]
    public void T4K_12_validate_checksum_ok_true_na_fixture_do_PDF()
    {
        var v = T4000PacketParser.ValidateChecksum(Fx());
        Assert.True(v.Ok);
    }

    [Fact]
    public void T4K_13_validate_checksum_ok_false_se_byte_alterado()
    {
        var corrupted = WithMutation((p1, _, _, _, _) => p1[0] = 0xFF);
        var v = T4000PacketParser.ValidateChecksum(corrupted);
        Assert.False(v.Ok);
    }

    // ── parseCycle ────────────────────────────────────────────

    [Fact]
    public void T4K_14_parse_cycle_retorna_sample_completo_e_ok_true_na_fixture()
    {
        var r = T4000PacketParser.ParseCycle(Fx());
        Assert.True(r.Ok);
        Assert.Equal(Expected(), r.Sample);
    }

    [Fact]
    public void T4K_15_parse_cycle_rejeita_pacote4_sem_cauda_fixa()
    {
        var bad = WithMutation((_, _, _, p4, _) => { p4[6] = 0x00; p4[7] = 0x00; });
        Assert.Throws<InvalidDataException>(() => T4000PacketParser.ParseCycle(bad));
    }

    [Fact]
    public void T4K_16_parse_cycle_rejeita_pacote5_sem_cabeca_fixa()
    {
        var bad = WithMutation((_, _, _, _, p5) => { p5[0] = 0x00; p5[1] = 0x00; });
        Assert.Throws<InvalidDataException>(() => T4000PacketParser.ParseCycle(bad));
    }

    // ── EGT out of range ─────────────────────────────────────

    [Fact]
    public void T4K_17_EGT_acima_de_1500C_dispara_egt_out_of_range_true()
    {
        var p3hot = new byte[] { 0x00, 0x64, 0x03, 0x20, 0x06, 0x40, 0x00, 0x64 }; // EGT=0x0640=1600
        var f = T4000PacketParser.ParsePacket3(p3hot);
        Assert.True(f.EgtOutOfRange);
        Assert.Equal(1600, f.EgtC);
    }

    // ── MAP turbo (uint16, decodifica vácuo/pressão pelo fator ÷100) ──

    [Fact]
    public void T4K_18_MAP_em_2bar_decodifica_correto_pra_range_turbo()
    {
        var p3 = new byte[] { 0x00, 0xC8, 0x03, 0x20, 0x03, 0x20, 0x00, 0x64 }; // MAP=0x00C8=200
        var f = T4000PacketParser.ParsePacket3(p3);
        Assert.Equal(2.00, f.MapBar, Eps);
    }

    // ── Erro ECU bitfield ────────────────────────────────────

    [Fact]
    public void T4K_19_erro_ECU_diferente_de_zero_propaga_raw_bits()
    {
        var p4err = new byte[] { 0x03, 0x20, 0x00, 0x04, 0x00, 0x05, 0x1E, 0xFC }; // 0x0005 = bit 0 + bit 2
        var f = T4000PacketParser.ParsePacket4(p4err);
        Assert.Equal(0x0005, f.EcuErrorBits);
    }

    // ── Stateful feeder: ciclo válido completo ───────────────

    [Fact]
    public void T4K_20_feeder_emite_onCycle_quando_5_pacotes_chegam_em_ordem()
    {
        var cycles = new List<T4000CycleResult>();
        var errs   = new List<T4000FeederError>();
        var feeder = new T4000PacketFeeder(onCycle: c => cycles.Add(c), onError: e => errs.Add(e));
        var fx = Fx();
        feeder.Feed(fx.P1);
        feeder.Feed(fx.P2);
        feeder.Feed(fx.P3);
        feeder.Feed(fx.P4);
        feeder.Feed(fx.P5);
        Assert.Single(cycles);
        Assert.Empty(errs);
        Assert.True(cycles[0].Ok);
    }

    // ── Stateful feeder: ressincroniza ao perder pacote ─────

    [Fact]
    public void T4K_21_feeder_ressincroniza_se_p4_chegar_fora_de_ordem()
    {
        var cycles = new List<T4000CycleResult>();
        var errs   = new List<T4000FeederError>();
        var feeder = new T4000PacketFeeder(onCycle: c => cycles.Add(c), onError: e => errs.Add(e));
        var fx = Fx();
        feeder.Feed(fx.P1);
        feeder.Feed(fx.P4); // chegou cedo → reset
        feeder.Feed(fx.P1);
        feeder.Feed(fx.P2);
        feeder.Feed(fx.P3);
        feeder.Feed(fx.P4);
        feeder.Feed(fx.P5);
        Assert.Single(cycles);
        Assert.NotEmpty(errs);
    }

    [Fact]
    public void T4K_22_feeder_ressincroniza_se_p5_chegar_antes_da_hora()
    {
        var cycles = new List<T4000CycleResult>();
        var errs   = new List<T4000FeederError>();
        var feeder = new T4000PacketFeeder(onCycle: c => cycles.Add(c), onError: e => errs.Add(e));
        var fx = Fx();
        feeder.Feed(fx.P1);
        feeder.Feed(fx.P2);
        feeder.Feed(fx.P5); // chegou cedo
        Assert.Empty(cycles);
        Assert.NotEmpty(errs);
    }

    // ── Validação de input ───────────────────────────────────

    [Fact]
    public void T4K_23_parse_pacote1_rejeita_tamanho_errado()
    {
        Assert.Throws<ArgumentException>(() => T4000PacketParser.ParsePacket1(new byte[] { 0, 0, 0 }));
    }
}
