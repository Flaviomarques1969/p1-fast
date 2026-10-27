// Item 4 da ordem do GPS (Flávio 27/10/2026): ápice pelo pico do G lateral + frear na curva.
// CATRACA: com G do carro (ZeroOk) o TrechoDetector emite "apice-pelo-g" no pico da média de 5 do G lateral
// (confirmado quando cai a 80%; pico < 0,3 G = sem ápice pelo G) e a "saida-cruzou" leva o resumo da curva
// (tempo/metros freando E virando, G combinado e lateral máximos, menor km/h). Sem G confiável: nada disso.
// Curva sintética: carro anda pro leste (lat 0), entrada em lng 0 (amostra ~10), ápice 0,002 (~77), saída 0,003 (~110).

using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class GpsCurvaItem4Tests
{
    private const double Passo = 0.00003;      // ~3,3 m por amostra
    private const double LngInicio = -0.000315; // nenhuma amostra cai em cima das linhas
    private static double Lng(int i) => LngInicio + i * Passo;

    private static TrechoSegmento Curva() =>
        new("c0", "c0",
            new LinhaGps(new PontoGps(-0.001, 0.0), new PontoGps(0.001, 0.0)),
            new PontoGps(0, 0.002),
            new LinhaGps(new PontoGps(-0.001, 0.003), new PontoGps(0.001, 0.003)));

    // Uma amostra a cada dtMs(i) (padrão 100 ms); gLong/gLat em g; kmh = velocidade.
    private static List<TrechoEvento> Rodar(int n, Func<int, double?> gLat, Func<int, double?>? gLong = null,
        Func<int, double>? kmh = null, bool zeroOk = true, Func<int, double>? tMs = null)
    {
        var eventos = new List<TrechoEvento>();
        var det = new TrechoDetector(new[] { Curva() }, eventos.Add);
        for (var i = 0; i < n; i++)
            det.IngestGps(new AmostraGps(Lat: 0, Lng: Lng(i), Kmh: kmh?.Invoke(i) ?? 100, T: tMs?.Invoke(i) ?? i * 100,
                AccelLongG: gLong?.Invoke(i) ?? 0, AccelLatG: gLat(i), ZeroOk: zeroOk));
        return eventos;
    }

    // triângulo: 0 até a amostra (pico − larg), sobe até `pico` na amostra `pico`, desce simétrico
    private static double Triangulo(int i, int centro, int larg, double pico)
        => Math.Max(0, pico * (1 - Math.Abs(i - centro) / (double)larg));

    private static TrechoEvento? ApiceG(List<TrechoEvento> ev) => ev.FirstOrDefault(e => e.Type == "apice-pelo-g");
    private static TrechoEvento Saida(List<TrechoEvento> ev) => ev.Single(e => e.Type == "saida-cruzou");

    [Fact]
    public void C4_01_Apice_no_pico_do_G_lateral_com_velocidade_minima()
    {
        // lateral sobe até 0,8 G na amostra 50 (bem antes do ápice desenhado, ~77); km/h mínimo 60 na 50.
        var ev = Rodar(120, i => Triangulo(i, 50, 20, 0.8), kmh: i => 60 + Math.Abs(i - 50));
        var a = ApiceG(ev);
        Assert.NotNull(a);
        Assert.Equal(5000, a!.T);          // instante da amostra 50 (o pico), não o da confirmação
        Assert.Equal(60, a.Kmh, 6);
        Assert.Equal(60, a.KmhMin!.Value, 6);
        Assert.InRange(a.GLatPico!.Value, 0.75, 0.8);
        Assert.False(a.FechamentoDeEmergencia);
        // distância ao ápice desenhado = da amostra 50 ao ponto (0, 0,002), pela régua do detector
        var dist = Ghost.DistMeters(new PontoGps(0, Lng(50)), new PontoGps(0, 0.002));
        Assert.InRange(a.DistFromIdealM!.Value, dist - 0.01, dist + 0.01);
        Assert.True(dist > 60, "cenário: ápice real bem antes do desenhado");
        // o ápice geométrico continua saindo (a bolinha não muda)
        Assert.Contains(ev, e => e.Type == "apice-cruzou");
    }

    [Fact]
    public void C4_12_Velocidade_minima_conta_so_ate_o_apice()
    {
        // km/h 70 → 50 no pico (amostra 50) → despenca a 20 logo depois (antes da confirmação): KmhMin = 50.
        var ev = Rodar(120, i => Triangulo(i, 50, 20, 0.8), kmh: i => i <= 50 ? 70 - (i - 30) : 20);
        var a = ApiceG(ev);
        Assert.NotNull(a);
        Assert.Equal(50, a!.KmhMin!.Value, 6);
    }

    [Fact]
    public void C4_02_Pico_abaixo_do_limiar_nao_inventa_apice()
    {
        var ev = Rodar(120, i => Triangulo(i, 50, 20, 0.25));
        Assert.Null(ApiceG(ev));
        Assert.Contains(ev, e => e.Type == "apice-cruzou");
    }

    [Fact]
    public void C4_03_Controle_sem_zero_nao_mede_nada()
    {
        // MESMO cenário do C4_01 com ZeroOk=false: sem ápice pelo G e saída sem resumo.
        var ev = Rodar(120, i => Triangulo(i, 50, 20, 0.8), kmh: i => 60 + Math.Abs(i - 50), zeroOk: false);
        Assert.Null(ApiceG(ev));
        var s = Saida(ev);
        Assert.Null(s.GLatPico);
        Assert.Null(s.FreioNaCurvaS);
    }

    [Fact]
    public void C4_04_Curva_para_o_outro_lado_vale_igual()
    {
        var ev = Rodar(120, i => -Triangulo(i, 50, 20, 0.8));
        var a = ApiceG(ev);
        Assert.NotNull(a);
        Assert.Equal(5000, a!.T);
    }

    [Fact]
    public void C4_05_Freando_e_virando_juntos_conta_tempo_e_metros()
    {
        // amostras 30..39: −0,3 G de freio com 0,5 G de curva → 10 intervalos de 0,1 s e ~3,3 m.
        var ev = Rodar(120, i => i is >= 30 and <= 39 ? 0.5 : 0.0, gLong: i => i is >= 30 and <= 39 ? -0.3 : 0.0);
        var s = Saida(ev);
        Assert.Equal(1.0, s.FreioNaCurvaS!.Value, 6);
        var m = Ghost.DistMeters(new PontoGps(0, Lng(29)), new PontoGps(0, Lng(39)));
        Assert.InRange(s.FreioNaCurvaM!.Value, m - 0.01, m + 0.01);
        Assert.Equal(Math.Sqrt(0.09 + 0.25), s.GCombinadoMax!.Value, 6);
        Assert.Equal(0.5, s.GLatPico!.Value, 6);
    }

    [Fact]
    public void C4_06_Controle_freio_em_reta_nao_e_frear_na_curva()
    {
        // mesmo freio do C4_05 com lateral 0,10 (< 0,15): não conta.
        var ev = Rodar(120, i => i is >= 30 and <= 39 ? 0.10 : 0.0, gLong: i => i is >= 30 and <= 39 ? -0.3 : 0.0);
        Assert.Equal(0, Saida(ev).FreioNaCurvaS!.Value, 6);
    }

    [Fact]
    public void C4_07_Buraco_no_dado_nao_infla_o_tempo()
    {
        // mesmo cenário do C4_05, mas a amostra 35 chega 2 s atrasada: esse intervalo (e só ele) não conta.
        var ev = Rodar(120, i => i is >= 30 and <= 39 ? 0.5 : 0.0, gLong: i => i is >= 30 and <= 39 ? -0.3 : 0.0,
            tMs: i => i * 100 + (i >= 35 ? 2000 : 0));
        Assert.Equal(0.9, Saida(ev).FreioNaCurvaS!.Value, 6);
    }

    [Fact]
    public void C4_08_Pico_ainda_subindo_na_saida_sai_como_emergencia()
    {
        // lateral sobe até a saída (~110) e não chega a cair 20%: ápice pelo G sai na saída, marcado.
        var ev = Rodar(120, i => Math.Min(0.9, i * 0.008));
        var a = ApiceG(ev);
        Assert.NotNull(a);
        Assert.True(a!.FechamentoDeEmergencia);
        var s = Saida(ev);
        Assert.True(ev.IndexOf(a) < ev.IndexOf(s));
    }

    [Fact]
    public void C4_09_Uma_passagem_um_apice_pelo_G()
    {
        // dois picos (chicane): só o 1º confirmado vale para a passagem.
        var ev = Rodar(120, i => Math.Max(Triangulo(i, 40, 12, 0.8), Triangulo(i, 80, 12, 0.9)));
        Assert.Single(ev, e => e.Type == "apice-pelo-g");
        Assert.Equal(4000, ApiceG(ev)!.T);
    }

    // ── Orquestrador: a passagem fechada usa o ápice pelo G nas fases (H4) e leva o resumo da curva ──

    private static DadosPassagem Passagem(bool zeroOk)
    {
        DadosPassagem? d = null;
        var orq = new CockpitOrchestrator(new CockpitState(), new[] { Curva() });
        orq.PassagemFechada += x => d = x;
        for (var i = 0; i < 120; i++)
            orq.IngestGps(new AmostraGps(Lat: 0, Lng: Lng(i), Kmh: 60 + Math.Abs(i - 50), T: i * 100,
                AccelLongG: i is >= 30 and <= 39 ? -0.3 : 0.0, AccelLatG: Triangulo(i, 50, 20, 0.8), ZeroOk: zeroOk));
        Assert.NotNull(d);
        return d!;
    }

    [Fact]
    public void C4_10_Orquestrador_usa_o_apice_pelo_G()
    {
        var d = Passagem(zeroOk: true);
        Assert.True(d.ApicePeloG);
        Assert.Equal(5000, d.ApiceT);       // pico do G lateral, não o cruzamento do ápice desenhado (~7700)
        Assert.Equal(0.8, d.GLatPico!.Value, 6);
        Assert.True(d.FreioNaCurvaS > 0);
        Assert.NotNull(d.GCombinadoMax);
    }

    [Fact]
    public void C4_11_Controle_orquestrador_sem_zero_fica_no_apice_geometrico()
    {
        var d = Passagem(zeroOk: false);
        Assert.False(d.ApicePeloG);
        Assert.InRange(d.ApiceT!.Value, 7000, 8500); // cruzamento geométrico (ápice desenhado na amostra ~77)
        Assert.Null(d.GLatPico);
        Assert.Null(d.FreioNaCurvaS);
    }
}
