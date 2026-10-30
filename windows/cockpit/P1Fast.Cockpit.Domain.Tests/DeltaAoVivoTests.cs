// DeltaAoVivo — o número do cartão do centro MOMENTO A MOMENTO (Flávio 2026-10-30, painel
// p1fast-cartao-delta-mapa-0013): tempo da volta corrente × tempo da melhor volta no MESMO PONTO do
// traçado. Trava: volta igual = "00" verde no meio da volta; mais lenta num trecho = vermelho com o
// tamanho certo; o cruzamento da linha interpolado (e os fixes que entram depois da linha, no replay,
// vão para a volta nova); reancoragem depois de buraco de GPS; buraco curto e ré nunca mostram número
// falso (o carro fora da janela de busca não casa com a ponta dela); traço ruim nunca vira régua (nem fica o
// antigo); traço de outra volta é recusado ao abrir; sem traço o número só muda no fim da curva;
// no máximo 10 números por segundo; o arquivo do traço (ida e volta, corrompido, replay).
// 30/10 ~11h ("tem de andar com o GPS o tempo todo"): melhor volta gravada SEM traço → a volta mais rápida da
// sessão empresta o traço esticado para o tempo da melhor volta e o número anda a cada fix (DA_15); a melhor
// volta e a linha de baixo não mudam; volta mais rápida que a melhor tira a régua provisória; volta lenta demais
// não empresta (DA_16); a conta do esticar sozinha (DA_17).

using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class DeltaAoVivoTests
{
    // ── Pista de teste ───────────────────────────────────────────────
    // Um círculo de 300 m de raio que cruza a linha de chegada de Brasília no meio dela, em ângulo reto
    // (o centro fica na direção da própria linha). 1 fix a cada 40 ms (25 Hz, o RaceBox).

    private const double R = 300;
    private static readonly double Volta = 2 * Math.PI * R;
    private static readonly double Ky = 6_378_137 * Math.PI / 180;
    private static readonly double LatM = (PistaBrasilia.ChegadaA.Lat + PistaBrasilia.ChegadaB.Lat) / 2;
    private static readonly double LngM = (PistaBrasilia.ChegadaA.Lng + PistaBrasilia.ChegadaB.Lng) / 2;
    private static readonly double Kx = Ky * Math.Cos(LatM * Math.PI / 180);
    private static readonly (double X, double Y) U = Unit(
        (PistaBrasilia.ChegadaB.Lng - PistaBrasilia.ChegadaA.Lng) * Kx, (PistaBrasilia.ChegadaB.Lat - PistaBrasilia.ChegadaA.Lat) * Ky);
    private static readonly LinhaGps Linha = new(PistaBrasilia.ChegadaA, PistaBrasilia.ChegadaB);

    private static (double X, double Y) Unit(double x, double y) { var n = Math.Sqrt(x * x + y * y); return (x / n, y / n); }

    // Ponto da pista a s metros da linha (raio r: R = na pista; R±20 = as pontas de uma linha radial).
    private static PontoGps Ponto(double s, double r = R)
    {
        var phi = s / R;
        // centro = M + R·U; e1 = −U (do centro para a linha); e2 = perpendicular (sentido da corrida)
        var x = R * U.X + r * (Math.Cos(phi) * -U.X + Math.Sin(phi) * -U.Y);
        var y = R * U.Y + r * (Math.Cos(phi) * -U.Y + Math.Sin(phi) * U.X);
        return new PontoGps(LatM + y / Ky, LngM + x / Kx);
    }

    private static LinhaGps Radial(double s) => new(Ponto(s, R - 20), Ponto(s, R + 20));

    // Uma curva no começo da volta (entrada a 100 m, ápice a 150 m, saída a 200 m): sem curva anotada
    // nenhuma volta vira a melhor (ReferenciaMelhorVolta exige as curvas).
    private static TrechoSegmento Curva() => new("c1", "Curva 1", Radial(100), Ponto(150), Radial(200));

    private sealed class Carro
    {
        public double T = 1_000_000, S = -60;              // sai do box 60 m antes da linha
        public readonly List<double> Cruzamentos = new();   // hora exata de cada passagem pela linha
        public double NaVolta => ((S % Volta) + Volta) % Volta;

        public AmostraGps Passo(Func<double, double> v)
        {
            var vel = v(NaVolta);
            var s1 = S + vel * 0.040;
            if (Math.Floor(s1 / Volta) > Math.Floor(S / Volta))
                Cruzamentos.Add(T + (Math.Floor(s1 / Volta) * Volta - S) / (s1 - S) * 40);
            S = s1; T += 40;
            var p = Ponto(S);
            return new AmostraGps(p.Lat, p.Lng, vel * 3.6, T);
        }
    }

    private static double V30(double s) => 30;

    // Anda até cruzar a linha, mais 'depois' fixes (no replay o fechamento vem atrasado), e fecha a volta
    // com o tempo exato entre as duas últimas passagens (null na 1ª passagem).
    private static bool AteALinha(CockpitOrchestrator orq, Carro c, Func<double, double> v, int depois = 0)
    {
        var n = c.Cruzamentos.Count;
        while (c.Cruzamentos.Count == n) orq.IngestGps(c.Passo(v));
        for (var i = 0; i < depois; i++) orq.IngestGps(c.Passo(v));
        double? tempo = c.Cruzamentos.Count >= 2 ? c.Cruzamentos[^1] - c.Cruzamentos[^2] : null;
        return orq.FecharVolta(tempo);
    }

    private static void AteS(CockpitOrchestrator orq, Carro c, Func<double, double> v, double sNaVolta)
    {
        while (c.NaVolta < sNaVolta) orq.IngestGps(c.Passo(v));
    }

    // Maestro com a curva, já com a 1ª volta cronometrada (30 m/s) virando a melhor.
    private static (CockpitState Estado, CockpitOrchestrator Orq, Carro Carro) ComMelhorVolta()
    {
        var c = new CockpitState();
        var orq = new CockpitOrchestrator(c, new[] { Curva() });
        var carro = new Carro();
        Assert.False(AteALinha(orq, carro, V30));          // saída do box: só arma a volta
        Assert.True(AteALinha(orq, carro, V30));           // 1ª volta inteira: vira a melhor
        return (c, orq, carro);
    }

    // ── Maestro: o número contínuo ───────────────────────────────────

    [Fact]
    public void DA_01_Volta_que_vira_a_melhor_deixa_o_traco_inteiro_ate_a_linha()
    {
        var (_, orq, carro) = ComMelhorVolta();
        var traco = orq.TracoMelhorVolta;
        Assert.NotNull(traco);
        var tempo = carro.Cruzamentos[1] - carro.Cruzamentos[0];
        Assert.Equal(tempo, traco!.TempoMs);
        Assert.True(traco.Pontos.Count > 1000);
        Assert.Equal(0, traco.Pontos[0].Ms, 3);
        Assert.Equal(tempo, traco.Pontos[^1].Ms, 0);       // termina NA linha (interpolada), não no último fix
        Assert.Equal(Volta, traco.Pontos[^1].M, 0);
    }

    [Fact]
    public void DA_02_Volta_igual_mostra_zero_verde_no_meio_da_volta()
    {
        var (c, orq, carro) = ComMelhorVolta();
        AteS(orq, carro, V30, Volta * 0.5);
        Assert.Equal(new DeltaVoltaInfo(0, Tone.Bom), c.Get().DeltaVolta);
        AteS(orq, carro, V30, Volta * 0.9);
        Assert.Equal(new DeltaVoltaInfo(0, Tone.Bom), c.Get().DeltaVolta);
    }

    [Fact]
    public void DA_03_Mais_lenta_num_trecho_fica_vermelha_com_o_tamanho_certo_e_mais_rapida_verde()
    {
        var (c, orq, carro) = ComMelhorVolta();
        // 25 m/s no 2º quarto da volta: perde (Volta/4)·(1/25 − 1/30) = 3,14 s até ali, e não recupera.
        Func<double, double> lenta = s => s >= Volta / 4 && s < Volta / 2 ? 25 : 30;
        AteS(orq, carro, lenta, Volta * 0.20);
        Assert.Equal(new DeltaVoltaInfo(0, Tone.Bom), c.Get().DeltaVolta);
        AteS(orq, carro, lenta, Volta * 0.75);
        var d = c.Get().DeltaVolta;
        Assert.Equal(Tone.Erro, d.Tom);
        Assert.InRange(d.Centesimos!.Value, 312, 316);
        Assert.False(AteALinha(orq, carro, lenta));        // não virou a melhor

        // 36 m/s no 1º quarto: ganha (Volta/4)·(1/30 − 1/36) = 2,62 s.
        Func<double, double> rapida = s => s < Volta / 4 ? 36 : 30;
        AteS(orq, carro, rapida, Volta * 0.6);
        d = c.Get().DeltaVolta;
        Assert.Equal(Tone.Bom, d.Tom);
        Assert.InRange(d.Centesimos!.Value, 260, 264);
    }

    [Fact]
    public void DA_04_Fixes_depois_da_linha_passam_para_a_volta_nova()
    {
        // Replay: 6 fixes (240 ms) já entraram depois da linha quando a volta fecha.
        var c = new CockpitState();
        var orq = new CockpitOrchestrator(c, new[] { Curva() });
        var carro = new Carro();
        AteALinha(orq, carro, V30, depois: 6);
        Assert.True(AteALinha(orq, carro, V30, depois: 6));
        var tempo = carro.Cruzamentos[1] - carro.Cruzamentos[0];
        Assert.Equal(tempo, orq.TracoMelhorVolta!.Pontos[^1].Ms, 0);   // a volta acaba na linha, não 240 ms depois

        // A volta seguinte conta do cruzamento: igual = "00" verde (com 240 ms de erro daria "24").
        AteS(orq, carro, V30, Volta * 0.5);
        Assert.Equal(new DeltaVoltaInfo(0, Tone.Bom), c.Get().DeltaVolta);
    }

    [Fact]
    public void DA_05_Buraco_de_GPS_reancora_pela_distancia_e_volta_a_contar()
    {
        var (c, orq, carro) = ComMelhorVolta();
        AteS(orq, carro, V30, Volta * 0.25);
        Assert.Equal(new DeltaVoltaInfo(0, Tone.Bom), c.Get().DeltaVolta);

        // 4 s sem GPS (120 m: além da janela de busca), depois 20 m/s até 3/4 da volta.
        var fimDoBuraco = carro.NaVolta + 120;
        while (carro.NaVolta < fimDoBuraco) carro.Passo(V30);
        Func<double, double> devagar = _ => 20;
        AteS(orq, carro, devagar, Volta * 0.75);
        var esperadoCs = (Volta * 0.75 - fimDoBuraco) * (1.0 / 20 - 1.0 / 30) * 100;
        var d = c.Get().DeltaVolta;
        Assert.Equal(Tone.Erro, d.Tom);
        // o número cresce 1/3 s por segundo: até 80 ms desde o último número = 3 centésimos a mais de folga
        Assert.InRange(d.Centesimos!.Value, esperadoCs - 6, esperadoCs + 6);
    }

    [Fact]
    public void DA_06_Traco_com_buraco_nao_vira_regua_nem_fica_o_antigo()
    {
        var (c, orq, carro) = ComMelhorVolta();
        Assert.NotNull(orq.TracoMelhorVolta);

        // Volta 2: mais rápida (31 m/s), mas com 4 s sem GPS na 2ª metade → vira a melhor SEM traço.
        Func<double, double> v31 = _ => 31;
        AteS(orq, carro, v31, Volta * 0.6);
        var fim = carro.NaVolta + 124;
        while (carro.NaVolta < fim) carro.Passo(v31);
        Assert.True(AteALinha(orq, carro, v31));
        Assert.Null(orq.TracoMelhorVolta);                  // nunca o traço da volta 1 (outro tempo)

        // Volta 3 sem régua: o número só muda no fim da curva (e na linha), não a cada fix.
        var mudancas = 0;
        c.OnChange((_, _, keys) => { if (keys.Contains("deltaVolta")) mudancas++; });
        AteS(orq, carro, v31, Volta * 0.9);
        Assert.InRange(mudancas, 0, 1);
    }

    [Fact]
    public void DA_07_Semear_com_traco_de_outra_volta_recusa_e_com_o_da_mesma_volta_conta_desde_a_linha()
    {
        var (_, orq1, _) = ComMelhorVolta();
        var traco = orq1.TracoMelhorVolta!;
        var curvas = orq1.MelhorVolta.Curvas.ToDictionary(k => k.Key, k => k.Value);

        var c = new CockpitState();
        var orq = new CockpitOrchestrator(c, new[] { Curva() });
        orq.SemearMelhorVolta(traco.TempoMs + 500, curvas, traco);   // o arquivo é de outra volta
        Assert.Null(orq.TracoMelhorVolta);

        orq.SemearMelhorVolta(traco.TempoMs, curvas, traco);
        Assert.Same(traco, orq.TracoMelhorVolta);
        var carro = new Carro();
        for (var i = 0; i < 40; i++) orq.IngestGps(carro.Passo(V30));   // saída do box, antes da linha: em branco
        Assert.Null(c.Get().DeltaVolta.Centesimos);
        AteALinha(orq, carro, V30);
        AteS(orq, carro, V30, Volta * 0.3);
        Assert.Equal(new DeltaVoltaInfo(0, Tone.Bom), c.Get().DeltaVolta);
    }

    // Confere CADA número que o cartão mostra contra a verdade da pista de teste: a melhor volta foi a
    // vRef m/s do começo ao fim (no ponto s ela tinha s/vRef segundos); a volta corrente tem T − cruzamento.
    private static List<string> ConferirCadaNumero(CockpitState c, Carro carro, double vRef = 30)
    {
        var erros = new List<string>();
        c.OnChange((_, _, keys) =>
        {
            if (!keys.Contains("deltaVolta") || c.Get().DeltaVolta is not { Centesimos: { } cs } d) return;
            var verdade = ((carro.T - carro.Cruzamentos[^1]) - carro.NaVolta / vRef * 1000) / 10;
            var mostrado = d.Tom == Tone.Erro ? cs : -cs;
            if (Math.Abs(mostrado - verdade) > 2) erros.Add($"s={carro.NaVolta:0.0} mostrou {mostrado} cs, verdade {verdade:0.0}");
        });
        return erros;
    }

    [Fact]
    public void DA_13_Buraco_curto_de_GPS_nao_mostra_numero_falso_na_volta_do_sinal()
    {
        var (c, orq, carro) = ComMelhorVolta();
        AteS(orq, carro, V30, Volta * 0.25);
        var erros = ConferirCadaNumero(c, carro);
        // 2 s sem GPS (60 m): o carro volta logo além da janela de busca (~49 m à frente) e a menos de 25 m
        // da ponta dela — a ponta NÃO é o mesmo ponto (nem o vizinho de dentro): daria ~0,40 vermelho.
        var fim = carro.NaVolta + 60;
        while (carro.NaVolta < fim) carro.Passo(V30);
        AteS(orq, carro, V30, Volta * 0.35);
        Assert.Empty(erros);
        Assert.Equal(new DeltaVoltaInfo(0, Tone.Bom), c.Get().DeltaVolta);
    }

    [Fact]
    public void DA_14_Carro_de_re_o_numero_segue_o_mesmo_ponto_da_pista()
    {
        var (c, orq, carro) = ComMelhorVolta();
        AteS(orq, carro, V30, Volta * 0.5);
        var erros = ConferirCadaNumero(c, carro);
        // Rodou e voltou 10 m de ré (10 m/s por 1 s): atrás da janela de busca, a ponta de trás não é o
        // mesmo ponto (daria até ~0,25 s a menos).
        for (var i = 0; i < 25; i++)
        {
            carro.S -= 0.4; carro.T += 40;
            var p = Ponto(carro.S);
            orq.IngestGps(new AmostraGps(p.Lat, p.Lng, 36, carro.T));
        }
        AteS(orq, carro, V30, Volta * 0.6);
        Assert.Empty(erros);
        Assert.Equal(Tone.Erro, c.Get().DeltaVolta.Tom);    // perdeu ~1,7 s de verdade
    }

    // ── Régua provisória: a melhor volta gravada sem traço ───────────

    // Maestro semeado como no notebook hoje: a melhor volta gravada ANTES do traço (tempo de uma volta a vMelhor
    // m/s, curvas sem tempo de volta, sem traço).
    private static (CockpitState Estado, CockpitOrchestrator Orq, Carro Carro, double MelhorMs) MelhorAntigaSemTraco(double vMelhor)
    {
        var (_, orq1, _) = ComMelhorVolta();
        var curvas = orq1.MelhorVolta.Curvas.ToDictionary(k => k.Key, k => k.Value with { TempoNaVoltaMs = null });
        var c = new CockpitState();
        var orq = new CockpitOrchestrator(c, new[] { Curva() });
        var melhorMs = Volta / vMelhor * 1000;
        orq.SemearMelhorVolta(melhorMs, curvas);
        Assert.Null(orq.TracoMelhorVolta);
        return (c, orq, new Carro(), melhorMs);
    }

    [Fact]
    public void DA_15_Melhor_volta_sem_traco_o_numero_anda_com_o_GPS_pela_volta_da_sessao()
    {
        var (c, orq, carro, melhorMs) = MelhorAntigaSemTraco(31);
        Assert.False(AteALinha(orq, carro, V30));          // saída do box
        Assert.False(AteALinha(orq, carro, V30));          // 1ª volta (30 m/s): mais lenta, não vira a melhor…
        var volta1 = carro.Cruzamentos[1] - carro.Cruzamentos[0];
        Assert.Equal(volta1, orq.ReguaProvisoriaMs);       // …mas empresta o traço
        Assert.Null(orq.TracoMelhorVolta);                 // que nunca é gravado como o da melhor volta
        Assert.Equal(melhorMs, orq.MelhorVolta.TempoMs);   // a referência (e a linha de baixo) não muda

        // Volta 2: CADA número contra a verdade (melhor volta = 31 m/s), e muda o tempo todo, não só no fim da curva.
        var erros = ConferirCadaNumero(c, carro, vRef: 31);
        var mudancas = 0;
        c.OnChange((_, _, keys) => { if (keys.Contains("deltaVolta")) mudancas++; });
        AteS(orq, carro, V30, Volta * 0.5);
        Assert.Empty(erros);
        Assert.True(mudancas > 50, $"o número mudou só {mudancas} vezes em meia volta");
        var d = c.Get().DeltaVolta;
        Assert.Equal(Tone.Erro, d.Tom);
        Assert.InRange(d.Centesimos!.Value, 99, 103);       // (Volta/2)·(1/30 − 1/31) = 1,01 s

        // Na linha: o tempo da volta inteira × a melhor volta, exato.
        Assert.False(AteALinha(orq, carro, V30));
        var volta2 = carro.Cruzamentos[^1] - carro.Cruzamentos[^2];
        Assert.Equal(DeltaVoltaInfo.Comparar(volta2, melhorMs), c.Get().DeltaVolta);
        Assert.Equal(volta1, orq.ReguaProvisoriaMs);       // volta igual não troca a régua

        // Volta mais rápida da sessão (30,5 m/s), ainda mais lenta que a melhor: passa a ser a régua provisória.
        Func<double, double> v305 = _ => 30.5;
        Assert.False(AteALinha(orq, carro, v305));
        Assert.Equal(carro.Cruzamentos[^1] - carro.Cruzamentos[^2], orq.ReguaProvisoriaMs);

        // Volta mais rápida que a melhor (32 m/s): vira a melhor COM traço e a régua provisória sai.
        Func<double, double> v32 = _ => 32;
        Assert.True(AteALinha(orq, carro, v32));
        Assert.NotNull(orq.TracoMelhorVolta);
        Assert.Null(orq.ReguaProvisoriaMs);

        // Sessão nova: a régua provisória não atravessa.
        var (_, orq2, carro2, _) = MelhorAntigaSemTraco(31);
        AteALinha(orq2, carro2, V30);
        AteALinha(orq2, carro2, V30);
        Assert.NotNull(orq2.ReguaProvisoriaMs);
        orq2.SemearMelhorVolta(Volta / 31 * 1000, orq2.MelhorVolta.Curvas.ToDictionary(k => k.Key, k => k.Value));
        Assert.Null(orq2.ReguaProvisoriaMs);
    }

    [Fact]
    public void DA_16_Volta_lenta_demais_nao_empresta_o_traco()
    {
        // Melhor volta a 40 m/s; a sessão anda a 30 (33% mais lenta: box, bandeira) → sem régua provisória.
        var (c, orq, carro, _) = MelhorAntigaSemTraco(40);
        AteALinha(orq, carro, V30);
        Assert.False(AteALinha(orq, carro, V30));
        Assert.Null(orq.ReguaProvisoriaMs);
        var mudancas = 0;
        c.OnChange((_, _, keys) => { if (keys.Contains("deltaVolta")) mudancas++; });
        AteS(orq, carro, V30, Volta * 0.9);
        Assert.InRange(mudancas, 0, 1);                     // o número não anda com régua nenhuma

        // Controle: a mesma sessão com a melhor volta a 37 m/s (23% mais lenta) empresta.
        var (_, orq37, carro37, _) = MelhorAntigaSemTraco(37);
        AteALinha(orq37, carro37, V30);
        AteALinha(orq37, carro37, V30);
        Assert.NotNull(orq37.ReguaProvisoriaMs);
    }

    // ── A peça sozinha ───────────────────────────────────────────────

    [Fact]
    public void DA_17_Esticar_o_traco_para_o_tempo_da_melhor_volta()
    {
        var pts = TracoReto(200);
        var dur = pts[^1].Ms;
        var e = DeltaAoVivo.Escalado(new TracoVolta(dur, pts), dur * 0.9)!;
        Assert.Equal(dur * 0.9, e.TempoMs);
        Assert.Equal(dur * 0.9, e.Pontos[^1].Ms, 6);
        Assert.Equal(pts[100].Ms * 0.9, e.Pontos[100].Ms, 6);   // o tempo encolhe na mesma proporção em todo ponto
        Assert.Equal(pts.Select(p => (p.Lat, p.Lng, p.M)), e.Pontos.Select(p => (p.Lat, p.Lng, p.M)));   // o desenho não muda

        Assert.NotNull(DeltaAoVivo.Escalado(new TracoVolta(dur, pts), dur / 1.24));
        Assert.Null(DeltaAoVivo.Escalado(new TracoVolta(dur, pts), dur / 1.26));   // mais de 25% mais lenta
        Assert.Null(DeltaAoVivo.Escalado(new TracoVolta(TracoReto(99)[^1].Ms, TracoReto(99)), dur));   // traço ruim
        Assert.Null(DeltaAoVivo.Escalado(new TracoVolta(dur, pts), double.NaN));
        Assert.Null(DeltaAoVivo.Escalado(new TracoVolta(dur, pts), 0));
        Assert.Null(DeltaAoVivo.Escalado(null, dur));
    }

    private static List<PontoTraco> TracoReto(int n, double passoMs = 40)
        => Enumerable.Range(0, n).Select(i => new PontoTraco(-15.77, -47.9 + i * 1e-5, i * passoMs, i * 1.07)).ToList();

    [Fact]
    public void DA_08_Traco_valido_so_inteiro_sem_buraco_e_com_a_duracao_da_volta()
    {
        var ok = TracoReto(200);
        var dur = ok[^1].Ms;
        Assert.True(DeltaAoVivo.TracoValido(ok, dur));
        Assert.True(DeltaAoVivo.TracoValido(ok, dur + 1900));                      // relógios diferentes: ±2 s
        Assert.False(DeltaAoVivo.TracoValido(ok, dur + 2100));
        Assert.False(DeltaAoVivo.TracoValido(TracoReto(99), TracoReto(99)[^1].Ms)); // poucos pontos
        Assert.False(DeltaAoVivo.TracoValido(null, dur));

        var buraco = TracoReto(200).Select((p, i) => i >= 100 ? p with { Ms = p.Ms + 3100 } : p).ToList();
        Assert.False(DeltaAoVivo.TracoValido(buraco, buraco[^1].Ms));
        var naoComecaNaLinha = TracoReto(200).Select(p => p with { Ms = p.Ms + 40 }).ToList();
        Assert.False(DeltaAoVivo.TracoValido(naoComecaNaLinha, naoComecaNaLinha[^1].Ms));
        var volta = TracoReto(200).Select((p, i) => i == 150 ? p with { M = 0 } : p).ToList();
        Assert.False(DeltaAoVivo.TracoValido(volta, dur));
        var nan = TracoReto(200).Select((p, i) => i == 7 ? p with { Lat = double.NaN } : p).ToList();
        Assert.False(DeltaAoVivo.TracoValido(nan, dur));
    }

    [Fact]
    public void DA_09_Cruzamento_interpolado_e_primeira_linha_sem_traco()
    {
        var d = new DeltaAoVivo();
        var carro = new Carro();
        while (carro.Cruzamentos.Count == 0) d.Ingerir(carro.Passo(V30));
        for (var i = 0; i < 3; i++) d.Ingerir(carro.Passo(V30));
        Assert.Null(d.FecharVolta(Linha));                 // saída do box: não havia volta
        Assert.Equal(carro.Cruzamentos[0], d.InicioVoltaT!.Value, 1);

        // Sem a linha (pista nova) a volta começa no último fix.
        var semLinha = new DeltaAoVivo();
        var outro = new Carro();
        while (outro.Cruzamentos.Count == 0) semLinha.Ingerir(outro.Passo(V30));
        semLinha.FecharVolta(null);
        Assert.Equal(outro.T, semLinha.InicioVoltaT);
    }

    [Fact]
    public void DA_10_No_maximo_dez_numeros_por_segundo_e_nada_depois_do_fim_do_traco()
    {
        var (_, orq, carro) = ComMelhorVolta();
        var d = new DeltaAoVivo();
        Assert.True(d.Semear(orq.TracoMelhorVolta));
        while (carro.Cruzamentos.Count < 3) d.Ingerir(carro.Passo(V30));
        d.FecharVolta(Linha);

        var numeros = 0;
        for (var i = 0; i < 25 * 10; i++) if (d.Ingerir(carro.Passo(V30)) is not null) numeros++;   // 10 s de GPS
        Assert.InRange(numeros, 80, 100);                   // a 25 Hz: 1 número a cada 3 fixes (120 ms)

        // Até a linha e além dela, antes do fechamento: perto do fim conta, depois da linha não.
        while (carro.Cruzamentos.Count < 4) d.Ingerir(carro.Passo(V30));
        var depois = Enumerable.Range(0, 6).Select(_ => d.Ingerir(carro.Passo(V30))).ToList();
        Assert.All(depois, Assert.Null);
    }

    [Fact]
    public void DA_11_Relogio_que_volta_e_volta_sem_linha_por_10_minutos_perdem_o_inicio()
    {
        var d = new DeltaAoVivo();
        var carro = new Carro();
        while (carro.Cruzamentos.Count == 0) d.Ingerir(carro.Passo(V30));
        d.FecharVolta(Linha);
        Assert.NotNull(d.InicioVoltaT);

        var p = carro.Passo(V30);
        d.Ingerir(p with { T = p.T - 60_000 });            // replay recomeçou
        Assert.Null(d.InicioVoltaT);

        while (carro.Cruzamentos.Count == 1) d.Ingerir(carro.Passo(V30));
        d.FecharVolta(Linha);
        Assert.NotNull(d.InicioVoltaT);
        for (var i = 0; i <= DeltaAoVivo.PontosMaximosVolta; i++) { carro.T += 40; d.Ingerir(new AmostraGps(LatM + i * 1e-7, LngM, 0, carro.T)); }
        Assert.Null(d.InicioVoltaT);                       // box/bandeira: não é volta
        Assert.False(d.Ativo);
    }

    // ── O arquivo do traço ───────────────────────────────────────────

    [Fact]
    public void DA_12_Arquivo_do_traco_ida_e_volta_corrompido_e_replay()
    {
        var dir = Path.Combine(Path.GetTempPath(), "p1fast-traco-" + Guid.NewGuid().ToString("N"));
        try
        {
            var store = new FileTracoMelhorVoltaStore(dir);
            var pts = TracoReto(150);
            var traco = new TracoVolta(pts[^1].Ms, pts);
            store.Salvar("celta@pista/nova", traco);
            Assert.Single(Directory.GetFiles(dir));        // barra no nome não vira subpasta
            Assert.EndsWith("-melhorvolta-traco.json", Directory.GetFiles(dir)[0]);

            var lido = store.Carregar("celta@pista/nova");
            Assert.NotNull(lido);
            Assert.Equal(traco.TempoMs, lido!.TempoMs);
            Assert.Equal(150, lido.Pontos.Count);
            Assert.Equal(pts[77].Lng, lido.Pontos[77].Lng, 7);
            Assert.True(DeltaAoVivo.TracoValido(lido.Pontos, lido.TempoMs));

            Assert.Null(store.Carregar("outro-carro"));     // ausente
            File.WriteAllText(store.Caminho("celta@pista/nova"), "{ \"TempoMs\": 1, \"Pontos\": [[1,2]");
            Assert.Null(store.Carregar("celta@pista/nova")); // corrompido
        }
        finally { try { Directory.Delete(dir, true); } catch { } }

        var mem = new MemoriaTracoMelhorVoltaStore();
        mem.Salvar("celta", new TracoVolta(1, TracoReto(150)));
        Assert.Null(mem.Carregar("celta"));                // replay não lê nem grava
    }
}
