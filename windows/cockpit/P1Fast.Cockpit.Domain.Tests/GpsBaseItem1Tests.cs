// CATRACA do item 1 (BASE) da ordem do GPS aprovada pelo Flávio em 27/10/2026:
// zero no box automático + eixos do carro (AceleracaoCarro), velocidade do PRÓPRIO aparelho no
// filtro do cérebro (GpsFiltroAoVivo, ao vivo e replay pela mesma peça) e relógio dos fixes pelo
// iTOW do GPS (RelogioGps). Cada regra tem um controle que TEM de dar o resultado oposto.

using System.Text.Json;
using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class GpsBaseItem1Tests
{
    private const double Lat = -15.77, Lon = -47.90;   // dentro da caixa de Brasília
    // Zero medido parado na volta real de 27/10 (eixos.txt).
    private const double Z0x = -0.048, Z0y = 0.035;

    private static void Parar(AceleracaoCarro a, int n, double gx = Z0x, double gy = Z0y)
    {
        for (int i = 0; i < n; i++) a.Ler(0, gx, gy);
    }

    // ── AceleracaoCarro ─────────────────────────────────────────────────────────

    [Fact]
    public void B1_zero_no_box_desconta_e_orienta_eixos()
    {
        var a = new AceleracaoCarro();
        Parar(a, AceleracaoCarro.LeiturasMinZero);
        Assert.True(a.ZeroOk);
        Assert.Equal(Z0x, a.ZeroX, 6);
        Assert.Equal(Z0y, a.ZeroY, 6);

        // Andando: +0,30 g em gx = acelerando; +0,30 g em gy = lateral NEGATIVA (padrão −gy provado).
        var g = a.Ler(80, Z0x + 0.30, Z0y + 0.30)!.Value;
        Assert.Equal(0.30, g.Long, 6);
        Assert.Equal(-0.30, g.Lat, 6);
        Assert.True(g.ZeroOk);

        // Freando: gx abaixo do zero → Long negativo.
        Assert.Equal(-0.50, a.Ler(80, Z0x - 0.50, Z0y)!.Value.Long, 6);
    }

    [Fact]
    public void B2_menos_de_1s_parado_nao_vale_zero_controle()
    {
        var a = new AceleracaoCarro();
        Parar(a, AceleracaoCarro.LeiturasMinZero - 1);
        Assert.False(a.ZeroOk);
        // Sem zero: orientado mas NÃO descontado, marcado ZeroOk=false.
        var g = a.Ler(0, 0.10, 0.20)!.Value;   // esta é a 25ª parada → agora vale
        Assert.True(g.ZeroOk);

        var b = new AceleracaoCarro();
        var cru = b.Ler(80, 0.10, 0.20)!.Value;
        Assert.False(cru.ZeroOk);
        Assert.Equal(0.10, cru.Long, 6);
        Assert.Equal(-0.20, cru.Lat, 6);
    }

    [Fact]
    public void B3_parada_interrompida_recomeca_a_contagem()
    {
        var a = new AceleracaoCarro();
        Parar(a, 20);
        a.Ler(5, 0.4, 0.4);        // andou no meio
        Parar(a, 20);
        Assert.False(a.ZeroOk);    // 20 + 20 não somam: precisa de 1 s SEGUIDO
        Parar(a, 5);
        Assert.True(a.ZeroOk);
    }

    [Fact]
    public void B4_janela_movel_e_refeito_a_cada_parada()
    {
        var a = new AceleracaoCarro();
        Parar(a, AceleracaoCarro.JanelaMaxZero, 0.10, 0.10);
        Assert.Equal(0.10, a.ZeroX, 6);
        // Mesma parada, aparelho assentou: depois de uma janela inteira, o zero é o novo valor.
        Parar(a, AceleracaoCarro.JanelaMaxZero, 0.02, 0.03);
        Assert.Equal(0.02, a.ZeroX, 6);
        Assert.Equal(0.03, a.ZeroY, 6);

        // Andou e parou de novo em outro valor: o zero vale o da NOVA parada (refaz a cada parada).
        a.Ler(60, 0.5, 0.5);
        Assert.Equal(0.02, a.ZeroX, 6);   // andando, mantém o último zero
        Parar(a, AceleracaoCarro.LeiturasMinZero, -0.05, 0.04);
        Assert.Equal(-0.05, a.ZeroX, 6);
        Assert.Equal(0.04, a.ZeroY, 6);
    }

    [Fact]
    public void B5_sem_velocidade_do_aparelho_nao_aprende_zero_e_sem_g_devolve_null()
    {
        var a = new AceleracaoCarro();
        for (int i = 0; i < 200; i++) a.Ler(null, Z0x, Z0y);
        Assert.False(a.ZeroOk);
        Assert.Null(a.Ler(0, null, 0.1));
        Assert.Null(a.Ler(0, double.NaN, 0.1));
    }

    [Fact]
    public void B6_sinais_configuraveis()
    {
        var a = new AceleracaoCarro(sinalLong: -1, sinalLat: +1);
        var g = a.Ler(80, 0.2, 0.3)!.Value;
        Assert.Equal(-0.2, g.Long, 6);
        Assert.Equal(0.3, g.Lat, 6);
    }

    // ── GpsFiltroAoVivo: velocidade do aparelho + G do carro ─────────────────────

    [Fact]
    public void B7_filtro_usa_kmh_do_aparelho_e_sem_ele_cai_no_dist_dt_controle()
    {
        // ~10,7 m em 400 ms = ~96 km/h pela posição; o aparelho diz 90.
        var com = new GpsFiltroAoVivo();
        com.AceitarValido(new PontoGps(Lat, Lon), 1000, kmhAparelho: 88);
        var a = com.AceitarValido(new PontoGps(Lat, Lon + 0.0001), 1400, kmhAparelho: 90);
        Assert.Equal(90, a!.Kmh, 6);

        var sem = new GpsFiltroAoVivo();
        sem.AceitarValido(new PontoGps(Lat, Lon), 1000);
        var b = sem.AceitarValido(new PontoGps(Lat, Lon + 0.0001), 1400);
        Assert.InRange(b!.Kmh, 93, 99);   // dist/dt, como sempre

        // 1ª amostra: com aparelho já sai com a velocidade dele (antes saía 0).
        var p = new GpsFiltroAoVivo().AceitarValido(new PontoGps(Lat, Lon), 0, kmhAparelho: 42);
        Assert.Equal(42, p!.Kmh, 6);
    }

    [Fact]
    public void B8_salto_de_posicao_continua_descartado_mesmo_com_kmh_do_aparelho()
    {
        var f = new GpsFiltroAoVivo();
        f.AceitarValido(new PontoGps(Lat, Lon), 1000, kmhAparelho: 100);
        // ~107 m em 400 ms = ~960 km/h pela posição: glitch — o km/h bom do aparelho não salva o ponto.
        Assert.Null(f.AceitarValido(new PontoGps(Lat, Lon + 0.001), 1400, kmhAparelho: 100));
    }

    [Theory]
    [InlineData(double.NaN)]
    [InlineData(-1)]
    [InlineData(400)]
    public void B9_kmh_do_aparelho_impossivel_cai_no_dist_dt(double ruim)
    {
        var f = new GpsFiltroAoVivo();
        f.AceitarValido(new PontoGps(Lat, Lon), 1000, kmhAparelho: ruim);
        var a = f.AceitarValido(new PontoGps(Lat, Lon + 0.0001), 1400, kmhAparelho: ruim);
        Assert.InRange(a!.Kmh, 93, 99);
    }

    [Fact]
    public void B10_zero_aprende_com_o_carro_parado_mesmo_decimado()
    {
        var f = new GpsFiltroAoVivo();
        // 1ª amostra passa; as 30 seguintes no MESMO ponto são decimadas (null) — mas ensinam o zero.
        f.Aceitar(Lat, Lon, 3, 1, 0, null, Z0x, Z0y, 1.0, kmhAparelho: 0);
        for (int i = 1; i <= 30; i++)
            Assert.Null(f.Aceitar(Lat, Lon, 3, 1, i * 40, null, Z0x, Z0y, 1.0, kmhAparelho: 0.1));
        Assert.True(f.Acel.ZeroOk);

        var a = f.Aceitar(Lat, Lon + 0.0001, 3, 1, 1600, null, Z0x + 0.25, Z0y - 0.40, 1.0, kmhAparelho: 30);
        Assert.NotNull(a);
        Assert.True(a!.ZeroOk);
        Assert.Equal(0.25, a.AccelLongG!.Value, 6);
        Assert.Equal(0.40, a.AccelLatG!.Value, 6);
        // O cru continua atravessando intacto.
        Assert.Equal(Z0x + 0.25, a.AccelXg!.Value, 6);
    }

    [Fact]
    public void B11_sem_acelerometro_g_do_carro_fica_null()
    {
        var a = new GpsFiltroAoVivo().Aceitar(Lat, Lon, 3, 1, 0, kmhAparelho: 50);
        Assert.Null(a!.AccelLongG);
        Assert.Null(a.AccelLatG);
        Assert.False(a.ZeroOk);
    }

    // ── Replay passa pela MESMA peça (H3) ────────────────────────────────────────

    [Fact]
    public void B12_replay_usa_kmh_e_g_da_gravacao()
    {
        var linhas = new List<string>();
        void Gps(double lon, double t, double kmh, double gx, double gy) => linhas.Add(JsonSerializer.Serialize(new
        {
            Tipo = "gps", TWall = t,
            Dados = new { lat = Lat, lon, kmh, fix = 3, hacc = 1.0, gx, gy, gz = 1.0 },
        }));
        for (int i = 0; i < 30; i++) Gps(Lon, 1000 + i * 40, 0, Z0x, Z0y);       // parado no box
        Gps(Lon + 0.0001, 3000, 77, Z0x + 0.2, Z0y);                              // saiu andando
        var r = SessaoReplay.Carregar(string.Join("\n", linhas));
        var gps = r.Eventos.Where(e => e.Gps is not null).Select(e => e.Gps!).ToList();
        var andando = gps.Last();
        Assert.Equal(77, andando.Kmh, 6);
        Assert.True(andando.ZeroOk);
        Assert.Equal(0.2, andando.AccelLongG!.Value, 6);
    }

    // ── RelogioGps ──────────────────────────────────────────────────────────────

    [Fact]
    public void B13_relogio_continuo_entre_notifies_tira_o_atraso_do_bluetooth()
    {
        var r = new RelogioGps();
        Assert.Equal(new long[] { 4960, 5000 }, r.CarimbarRajada(new long[] { 1000, 1040 }, 5000));
        // O 2º notify chega 50 ms "atrasado" (5090 em vez de 5040+40=5080): o relógio GPS ignora.
        Assert.Equal(new long[] { 5040, 5080 }, r.CarimbarRajada(new long[] { 1080, 1120 }, 5090));
        Assert.Equal(0, r.Reancoragens);
        // Controle: o método antigo colava o último frame na chegada (o atraso entrava no dt).
        Assert.Equal(new long[] { 5050, 5090 }, RaceBoxUbxParser.EspacarTimestamps(new long[] { 1080, 1120 }, 5090));
    }

    [Fact]
    public void B14_virada_de_semana_reancora_na_chegada()
    {
        var r = new RelogioGps();
        r.CarimbarRajada(new long[] { 604_799_960 }, 5000);
        var t = r.CarimbarRajada(new long[] { 0, 40 }, 5045);   // iTOW voltou (semana nova)
        Assert.Equal(new long[] { 5005, 5045 }, t);
        Assert.Equal(1, r.Reancoragens);
    }

    [Fact]
    public void B15_salto_maior_que_1s_reancora_e_salto_pequeno_nao()
    {
        var r = new RelogioGps();
        r.CarimbarRajada(new long[] { 1000 }, 5000);
        Assert.Equal(new long[] { 5800 }, r.CarimbarRajada(new long[] { 1800 }, 5830));   // 800 ms: segue a régua
        Assert.Equal(0, r.Reancoragens);
        Assert.Equal(new long[] { 9000 }, r.CarimbarRajada(new long[] { 4000 }, 9000));   // 2,2 s: reancora
        Assert.Equal(1, r.Reancoragens);
    }

    [Fact]
    public void B16_deriva_maior_que_1s_da_chegada_reancora()
    {
        var r = new RelogioGps();
        r.CarimbarRajada(new long[] { 1000 }, 5000);
        // iTOW coerente (+40 ms), mas a chegada está 1,5 s à frente da régua: âncora ruim.
        Assert.Equal(new long[] { 6540 }, r.CarimbarRajada(new long[] { 1040 }, 6540));
        Assert.Equal(1, r.Reancoragens);
    }
}
