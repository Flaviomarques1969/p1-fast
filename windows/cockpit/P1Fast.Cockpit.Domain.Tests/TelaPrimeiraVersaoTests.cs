// TelaPrimeiraVersaoTests — catraca da 1ª versão da tela do piloto (Flávio 2026-10-29: "somente os dois
// números do centro e não aparecerem mensagens escritas... todo o resto era para se manter" + "40% maiores
// e centralizados nas suas metades da tela"). A régua nasce da FONTE: lê o MainWindow.xaml e os
// MainWindow*.cs de verdade (sobe pastas a partir do bin até achar P1Fast.Cockpit.UI). Fail-closed: peça
// não achada = REPROVA. Cada régua tem o controle que DEVE reprovar (indicador escondido, número no canto,
// número por baixo do mapa, mensagem sem a chave).
// 29/10 ~23h ("o shift light do freio só que vai funcionar. põe ele na parte debaixo no shift light
// horizontal"): as 2 colunas de freio dos lados saem da lista do que fica (TPV_03/TPV_05) — a luz de freio
// passa para a barra de baixo, e o shift de giro sai dela (TPV_10 a TPV_12).
// 29/10 ~23h50 ("a função de wash sumiu quando chega o ponto da frenagem"): sem a varredura de marcha, a demo
// perdeu o wash; no ponto de freada ela lava a tela como o freio real (TPV_13). ~0h ("wash branco o mais forte
// que você puder onde for o wash"): com a chave, o lavado é a tela inteira em branco puro, opaco no pico (TPV_13).

using System.Globalization;
using System.Text.RegularExpressions;
using System.Xml.Linq;
using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class TelaPrimeiraVersaoTests
{
    private static readonly XNamespace Xx = "http://schemas.microsoft.com/winfx/2006/xaml";

    private static string PastaUi()
    {
        for (var d = new DirectoryInfo(AppContext.BaseDirectory); d is not null; d = d.Parent)
        {
            var p = Path.Combine(d.FullName, "P1Fast.Cockpit.UI", "MainWindow.xaml");
            if (File.Exists(p)) return Path.GetDirectoryName(p)!;
        }
        throw new FileNotFoundException("MainWindow.xaml não achado subindo de " + AppContext.BaseDirectory);
    }

    private static XDocument Xaml() => XDocument.Load(Path.Combine(PastaUi(), "MainWindow.xaml"));

    private static string? Nome(XElement e) => (string?)e.Attribute(Xx + "Name") ?? (string?)e.Attribute("Name");

    // O Grid de dentro do DeviceBorder: os filhos diretos dele são tudo o que o piloto pode ver.
    private static XElement GridDoDevice(XDocument doc)
    {
        var dev = doc.Descendants().Single(e => Nome(e) == "DeviceBorder");
        return dev.Elements().Single(e => e.Name.LocalName == "Grid");
    }

    private static XElement Peca(XDocument doc, string nome) => doc.Descendants().Single(e => Nome(e) == nome);

    private static IEnumerable<(string Arquivo, string Linha)> LinhasDaUi()
    {
        var arquivos = Directory.GetFiles(PastaUi(), "MainWindow*.cs");
        Assert.NotEmpty(arquivos);
        foreach (var f in arquivos)
            foreach (var l in File.ReadAllLines(f))
                yield return (Path.GetFileName(f), l);
    }

    private static string Codigo() => File.ReadAllText(Path.Combine(PastaUi(), "MainWindow.xaml.cs"));

    private static string CorpoDoMetodo(string src, string assinatura)
    {
        var ini = src.IndexOf(assinatura, StringComparison.Ordinal);
        Assert.True(ini >= 0, assinatura + " não achado no MainWindow.xaml.cs");
        var fim = src.IndexOf("\n    }", ini, StringComparison.Ordinal);
        Assert.True(fim > ini);
        return src[ini..fim];
    }

    private static readonly Regex EscondeAlgo = new(@"\b(\w+)\.Visibility\s*=\s*Visibility\.Collapsed");

    private static List<string> EscondidosPelaChave(string corpo) =>
        EscondeAlgo.Matches(corpo).Select(m => m.Groups[1].Value).ToList();

    [Fact]
    public void TPV_01_Chave_ligada_e_a_primeira_versao()
    {
        Assert.True(TelaPrimeiraVersao.Ligada, "a 1ª versão da tela (sem mensagem escrita) é a que vai para o notebook");
        Assert.False(TelaPrimeiraVersao.MostraTextos(ligada: true));
        Assert.True(TelaPrimeiraVersao.MostraTextos(ligada: false));
        Assert.False(TelaPrimeiraVersao.MensagensNaTela(ligada: true));
        Assert.True(TelaPrimeiraVersao.MensagensNaTela(ligada: false));
    }

    [Fact]
    public void TPV_02_Com_a_chave_ligada_so_os_textos_escritos_saem_da_tela()
    {
        var src = Codigo();
        var corpo = CorpoDoMetodo(src, "private void AplicarPrimeiraVersao()");
        Assert.Contains("if (TelaPrimeiraVersao.MostraTextos()) return;", corpo);
        Assert.Equal(TelaPrimeiraVersao.TextosEscondidos, EscondidosPelaChave(corpo));

        var ctor = CorpoDoMetodo(src, "public MainWindow(LaunchOptions options)");
        Assert.Contains("AplicarPrimeiraVersao();", ctor);

        // Cada texto escondido existe no XAML (a régua não pode estar olhando o vazio) e não sobrou
        // grupo "Escondido*" (a b9dfd3cd escondia a tela inteira assim).
        var doc = Xaml();
        foreach (var t in TelaPrimeiraVersao.TextosEscondidos) Peca(doc, t);
        Assert.DoesNotContain(doc.Descendants(), e => (Nome(e) ?? "").StartsWith("Escondido", StringComparison.Ordinal));

        // Controle: um indicador (o ápice) posto junto dos textos reprova.
        var comApice = corpo.Replace("CriticoOverlay.Visibility", "ApiceRow.Visibility = Visibility.Collapsed;\n        CriticoOverlay.Visibility");
        Assert.NotEqual(TelaPrimeiraVersao.TextosEscondidos, EscondidosPelaChave(comApice));
    }

    // O que ele disse que tinha sumido e devia continuar: a barra de luzes de baixo (agora a luz de freio),
    // sensores, barra de voltas, mapa, ápice (entrada/freio/vmin/ápice/saída), halo e o lavado da freada.
    private static readonly string[] ResteDaTela =
        new[] { "HaloRect", "SensorRpm", "SensorGps", "SensorPneus", "StintBar", "CoachZoomRoot", "ApiceRow",
                "ApexEntradaValor", "ApexFreioValor", "ApexVminValor", "ApexSaidaValor", "ApiceBolaNum",
                "BrakeWashRect" }
        .Concat(Enumerable.Range(1, 17).Select(i => $"Led{i:00}")).ToArray();

    /// <summary>Peças do resto que moram dentro de algo nascido escondido (ou de um texto escondido).</summary>
    private static List<string> RestoEscondido(XDocument doc)
    {
        var dev = Peca(doc, "DeviceBorder");
        var ruins = new List<string>();
        foreach (var nome in ResteDaTela)
        {
            var e = Peca(doc, nome);
            foreach (var a in e.Ancestors().TakeWhile(a => a != dev))
                if ((string?)a.Attribute("Visibility") == "Collapsed" || TelaPrimeiraVersao.TextosEscondidos.Contains(Nome(a) ?? ""))
                { ruins.Add(nome); break; }
        }
        return ruins;
    }

    [Fact]
    public void TPV_03_O_resto_da_tela_de_antes_continua()
    {
        var doc = Xaml();
        Assert.Empty(RestoEscondido(doc));
        foreach (var nome in ResteDaTela) Assert.DoesNotContain(nome, TelaPrimeiraVersao.TextosEscondidos);

        // Controle: o shift light embrulhado num Grid escondido reprova.
        var led = Peca(doc, "Led01");
        var pai = led.Parent!;
        led.Remove();
        pai.Add(new XElement(pai.Name.Namespace + "Grid", new XAttribute("Visibility", "Collapsed"), led));
        Assert.Contains("Led01", RestoEscondido(doc));
    }

    private static int Fonte(XDocument doc, string nome) =>
        int.Parse((string)Peca(doc, nome).Attribute("FontSize")!, CultureInfo.InvariantCulture);

    /// <summary>Os 2 números 40% maiores que na f251c0be (116 e 92), cada um no centro da sua metade.</summary>
    private static List<string> ForaDoLugar(XDocument doc)
    {
        var erros = new List<string>();
        var metade = double.Parse((string)Peca(doc, "DeviceBorder").Attribute("Width")!, CultureInfo.InvariantCulture) / 2;
        if (Fonte(doc, "FreadaNum") != (int)Math.Round(116 * TelaPrimeiraVersao.AumentoDosNumeros)) erros.Add("fonte da freada");
        if (Fonte(doc, "SaidaNum") != (int)Math.Round(92 * TelaPrimeiraVersao.AumentoDosNumeros)) erros.Add("fonte da saída");
        foreach (var (painel, num, lado) in new[] { ("FreadaPanel", "FreadaNum", "Left"), ("SaidaPanel", "SaidaNum", "Right") })
        {
            var p = Peca(doc, painel);
            if ((string?)p.Attribute("HorizontalAlignment") != lado) erros.Add(painel + " fora da sua metade");
            if ((string?)p.Attribute("Width") != metade.ToString(CultureInfo.InvariantCulture)) erros.Add(painel + " não ocupa a metade");
            if (p.Attribute("Margin") is not null) erros.Add(painel + " empurrado por margem");
            if ((string?)Peca(doc, num).Attribute("HorizontalAlignment") != "Center") erros.Add(num + " não centralizado");
        }
        return erros;
    }

    [Fact]
    public void TPV_04_Os_2_numeros_40_por_cento_maiores_no_centro_de_cada_metade()
    {
        Assert.Empty(ForaDoLugar(Xaml()));
        Assert.Equal(162, Fonte(Xaml(), "FreadaNum"));
        Assert.Equal(129, Fonte(Xaml(), "SaidaNum"));

        // Controles: a fonte de antes e o número encostado no canto (f251c0be) reprovam.
        var antiga = Xaml(); Peca(antiga, "FreadaNum").SetAttributeValue("FontSize", "116");
        Assert.Contains("fonte da freada", ForaDoLugar(antiga));
        var canto = Xaml(); Peca(canto, "SaidaPanel").SetAttributeValue("Margin", "0,0,72,0");
        Assert.Contains("SaidaPanel empurrado por margem", ForaDoLugar(canto));
    }

    // Quem pode tirar os números/lavado da freada da tela: só código guardado pela chave (mensagem e crítico).
    private static readonly Regex MexeNasPecasQueFicam =
        new(@"\b(FreadaPanel|SaidaPanel|BrakeWashRect)\.Visibility\s*=(?!=)");

    private static bool Guardada(string linha) => linha.Contains("TelaPrimeiraVersao.MensagensNaTela(");

    [Fact]
    public void TPV_05_Toda_linha_que_esconde_numero_ou_freio_respeita_a_chave()
    {
        var linhas = LinhasDaUi().Where(x => MexeNasPecasQueFicam.IsMatch(x.Linha)).ToList();
        Assert.NotEmpty(linhas);   // a régua acha as linhas de hoje (ApplyMessage/AplicarModoCritico)
        var soltas = linhas.Where(x => !Guardada(x.Linha)).Select(x => $"{x.Arquivo}: {x.Linha.Trim()}").ToList();
        Assert.True(soltas.Count == 0, "linha sem a chave pode tirar número/freio da tela:\n" + string.Join("\n", soltas));

        // Controle: a mesma régua pega a linha sem guarda.
        const string semGuarda = "        SaidaPanel.Visibility = Visibility.Collapsed;";
        Assert.Matches(MexeNasPecasQueFicam, semGuarda);
        Assert.False(Guardada(semGuarda));
    }

    /// <summary>Os 2 números estão DEPOIS do mapa (por cima dele) e ANTES da tela térmica e do crítico.</summary>
    private static bool NumerosNaCamadaCerta(XDocument doc)
    {
        var mapa = Peca(doc, "CoachZoomRoot");
        var termica = Peca(doc, "TermicaOverlay");
        var critico = Peca(doc, "CriticoOverlay");
        return new[] { "FreadaPanel", "SaidaPanel" }.Select(n => Peca(doc, n))
            .All(p => p.IsAfter(mapa) && p.IsBefore(termica) && p.IsBefore(critico));
    }

    [Fact]
    public void TPV_06_Numeros_por_cima_do_mapa_e_por_baixo_da_termica_e_do_critico()
    {
        Assert.True(NumerosNaCamadaCerta(Xaml()));

        // Controle: a freada de volta antes do mapa (como na f251c0be) reprova.
        var doc = Xaml();
        var freada = Peca(doc, "FreadaPanel");
        freada.Remove();
        Peca(doc, "CoachZoomRoot").AddBeforeSelf(freada);
        Assert.False(NumerosNaCamadaCerta(doc));
    }

    [Fact]
    public void TPV_07_Demo_passa_pelas_3_cores_da_freada_e_as_2_da_saida()
    {
        var casos = Enumerable.Range(0, 6).Select(TelaPrimeiraVersao.NumerosDemo).ToList();
        Assert.All(casos, n => { Assert.NotNull(n.FreadaM); Assert.NotNull(n.SaidaKmh); });
        Assert.Equal(new[] { FreioTom.Bom, FreioTom.Erro, FreioTom.Foco },
                     casos.Select(n => n.FreadaTom).Distinct().ToArray());
        Assert.Equal(new[] { Tone.Bom, Tone.Erro }, casos.Select(n => n.SaidaTom).Distinct().ToArray());
        Assert.Equal(TelaPrimeiraVersao.NumerosDemo(0), TelaPrimeiraVersao.NumerosDemo(6));    // cicla
        Assert.Equal(TelaPrimeiraVersao.NumerosDemo(5), TelaPrimeiraVersao.NumerosDemo(-1));   // índice negativo não quebra
    }

    // Curva: entrada no lng=0, saída no lng=0.001, ápice em (0, 0.0005) — a mesma do CockpitOrchestratorTests.
    private static TrechoSegmento Curva() =>
        new("c0", "Curva 0",
            new LinhaGps(new PontoGps(-0.001, 0), new PontoGps(0.001, 0)),
            new PontoGps(0, 0.0005),
            new LinhaGps(new PontoGps(-0.001, 0.001), new PontoGps(0.001, 0.001)));

    // Aproximação reta ao ápice a 100 km/h, de ~500 m até ~10 m (passos de ~11 m = 400 ms).
    private static List<AmostraGps> Aproximacao()
    {
        var path = new List<AmostraGps>();
        var t = 0.0;
        for (var lng = -0.0040; lng <= 0.0004; lng += 0.0001) { path.Add(new AmostraGps(0, lng, 100, t)); t += 400; }
        return path;
    }

    private static List<int> LuzesNaAproximacao(bool comGrave)
    {
        var c = new CockpitState();
        var orq = new CockpitOrchestrator(c, new[] { Curva() });
        if (comGrave) c.ShowMessage(MsgTipo.Grave, "Temperatura motor crítica");
        var lit = new List<int>();
        foreach (var g in Aproximacao()) { orq.IngestGps(g); lit.Add(c.Get().Freio.Lit); }
        if (comGrave) Assert.Equal(MsgTipo.Grave, c.Get().Message?.Tipo);   // o GRAVE ficou na tela o tempo todo
        return lit;
    }

    [Fact]
    public void TPV_08_Com_a_chave_ligada_o_GRAVE_nao_apaga_o_aviso_de_freio()
    {
        var sem = LuzesNaAproximacao(comGrave: false);
        var com = LuzesNaAproximacao(comGrave: true);
        Assert.Equal(LuzFreio.FreioN, sem.Max());   // a aproximação acende a luz inteira
        Assert.Equal(sem, com);                     // com o GRAVE no estado, a luz é a mesma

        // Controle: a luz em modo crítico apaga — é a chave que impede o orquestrador de pedir isso.
        var luz = new LuzFreio(new[] { Curva() });
        Assert.All(Aproximacao(), g => Assert.Equal(0, luz.Atualizar(g.Lat, g.Lng, g.Kmh, modoCritico: true).Lit));
    }

    /// <summary>O método começa saindo quando a chave está ligada (antes de qualquer outra linha).</summary>
    private static bool SaiPelaChaveAntes(string corpo, string primeiraAcao)
    {
        var guarda = corpo.IndexOf("if (!TelaPrimeiraVersao.MensagensNaTela())", StringComparison.Ordinal);
        var acao = corpo.IndexOf(primeiraAcao, StringComparison.Ordinal);
        return guarda >= 0 && acao > guarda;
    }

    [Fact]
    public void TPV_09_Mensagem_e_critico_escritos_nao_acendem_com_a_chave_ligada()
    {
        var src = Codigo();
        var msg = CorpoDoMetodo(src, "private void ApplyMessage(");
        var crit = CorpoDoMetodo(src, "private void AplicarModoCritico(");
        Assert.True(SaiPelaChaveAntes(msg, "AplicarModoCritico("), "ApplyMessage chama o crítico antes da chave");
        Assert.True(SaiPelaChaveAntes(msg, "AlertBlocoRoot.Visibility = Visibility.Visible"), "a mensagem acende antes da chave");
        Assert.True(SaiPelaChaveAntes(crit, "CriticoOverlay.Visibility"), "o crítico acende antes da chave");

        // Só esses 2 métodos (depois da chave) e o AplicarPrimeiraVersao mexem nos textos escondidos.
        var acende = new Regex(@"\b(AlertBlocoRoot|CriticoOverlay|CriticoBorda|StatusText)\.Visibility\s*=(?!=)");
        var fora = LinhasDaUi().Where(x => acende.IsMatch(x.Linha) && !msg.Contains(x.Linha) && !crit.Contains(x.Linha)
                                         && !CorpoDoMetodo(src, "private void AplicarPrimeiraVersao()").Contains(x.Linha))
                               .Select(x => $"{x.Arquivo}: {x.Linha.Trim()}").ToList();
        Assert.True(fora.Count == 0, "texto escondido ligado fora da chave:\n" + string.Join("\n", fora));

        // Controle: o ApplyMessage sem a guarda reprova.
        var semGuarda = msg.Replace("if (!TelaPrimeiraVersao.MensagensNaTela())", "if (false)");
        Assert.False(SaiPelaChaveAntes(semGuarda, "AplicarModoCritico("));
    }

    // ── Luz de freio na barra de baixo (29/10 ~23h) ─────────────────────────

    /// <summary>As luzes da barra de baixo que o nível 0..9 da luz de freio acende (o ApplyBrake acende os
    /// degraus 0..nível-1 dos dois lados).</summary>
    private static HashSet<int> AcesasNoNivel(Func<int, (int Esquerda, int Direita)> degrau, int nivel) =>
        Enumerable.Range(0, nivel).SelectMany(d => new[] { degrau(d).Esquerda, degrau(d).Direita }).ToHashSet();

    /// <summary>O enchimento da luz de freio na barra: nível 0 nada; nível n = as n luzes de cada PONTA
    /// (simétricas, só crescem); nível 9 = a barra inteira.</summary>
    private static List<string> ErrosDoEnchimento(Func<int, (int Esquerda, int Direita)> degrau)
    {
        var erros = new List<string>();
        var n = TelaPrimeiraVersao.LuzesDaBarra;
        var antes = new HashSet<int>();
        for (var nivel = 0; nivel <= LuzFreio.FreioN; nivel++)
        {
            var acesas = AcesasNoNivel(degrau, nivel);
            if (!acesas.SetEquals(Enumerable.Range(0, n).Where(i => i < nivel || i >= n - nivel)))
                erros.Add($"nível {nivel} não enche das pontas");
            if (acesas.Any(i => !acesas.Contains(n - 1 - i))) erros.Add($"nível {nivel} torto");
            if (!antes.IsSubsetOf(acesas)) erros.Add($"nível {nivel} apagou luz do nível de baixo");
            antes = acesas;
        }
        return erros;
    }

    [Fact]
    public void TPV_10_Luz_de_freio_enche_a_barra_de_baixo_das_pontas_para_o_centro()
    {
        Assert.Empty(ErrosDoEnchimento(TelaPrimeiraVersao.LuzesDoDegrau));
        Assert.Equal((0, 16), TelaPrimeiraVersao.LuzesDoDegrau(0));
        Assert.Equal((8, 8), TelaPrimeiraVersao.LuzesDoDegrau(LuzFreio.FreioN - 1));   // o último degrau é a luz do centro
        Assert.Equal(2 * LuzFreio.FreioN - 1, TelaPrimeiraVersao.LuzesDaBarra);
        Assert.Equal(LuzesDaBarra, AcesasNoNivel(TelaPrimeiraVersao.LuzesDoDegrau, LuzFreio.FreioN).Count);

        // A barra do XAML tem exatamente essas 17 luzes, cada uma com o seu halo.
        var nomes = Xaml().Descendants().Select(Nome).OfType<string>().ToList();
        Assert.Equal(LuzesDaBarra, nomes.Count(x => Regex.IsMatch(x, @"^Led\d\d$")));
        Assert.Equal(LuzesDaBarra, nomes.Count(x => Regex.IsMatch(x, @"^LedGlow\d\d$")));

        // Controle: encher do CENTRO para as pontas reprova.
        Assert.Contains("nível 1 não enche das pontas", ErrosDoEnchimento(d => (8 - d, 8 + d)));
    }

    private const int LuzesDaBarra = TelaPrimeiraVersao.LuzesDaBarra;

    /// <summary>A 1ª linha de código do corpo (depois da "{", sem comentário de fim de linha).</summary>
    private static string PrimeiraInstrucao(string corpo)
    {
        var l = corpo[(corpo.IndexOf('{') + 1)..].Split('\n').Select(x => x.Trim())
                     .First(x => x.Length > 0 && !x.StartsWith("//", StringComparison.Ordinal));
        var c = l.IndexOf("//", StringComparison.Ordinal);
        return (c >= 0 ? l[..c] : l).Trim();
    }

    /// <summary>De onde a onde vai o bloco { } que abre logo depois de <paramref name="de"/> (só espaço entre).</summary>
    private static (int Ini, int Fim) Bloco(string s, int de)
    {
        var ini = s.IndexOf('{', de);
        if (ini < 0 || s[de..ini].Trim().Length > 0) return (-1, -1);
        for (int i = ini, nivel = 0; i < s.Length; i++)
        {
            if (s[i] == '{') nivel++;
            else if (s[i] == '}' && --nivel == 0) return (ini, i);
        }
        return (-1, -1);
    }

    /// <summary>O que tem de estar fiado no MainWindow.xaml.cs para a barra de baixo ser a luz de freio e o
    /// giro não acender nela.</summary>
    private static List<string> FiacaoDoFreioEmbaixo(string src)
    {
        var erros = new List<string>();
        var freio = CorpoDoMetodo(src, "private void AplicarFreioNaBarraDeBaixo()");
        if (PrimeiraInstrucao(freio) != "if (!TelaPrimeiraVersao.FreioNaBarraDeBaixo()) return;") erros.Add("freio sem a chave no início");
        if (!EscondidosPelaChave(freio).SequenceEqual(TelaPrimeiraVersao.ColunasDeFreioEscondidas)) erros.Add("colunas escondidas erradas");
        if (!freio.Contains("Enumerable.Range(0, LuzFreio.FreioN).Select(TelaPrimeiraVersao.LuzesDoDegrau)")) erros.Add("degraus fora do domínio");
        foreach (var (arr, fonte, lado) in new[] { ("_brakeLeft", "_leds", "Esquerda"), ("_brakeRight", "_leds", "Direita"),
                                                    ("_brakeLeftGlow", "_ledGlows", "Esquerda"), ("_brakeRightGlow", "_ledGlows", "Direita") })
            if (!Regex.IsMatch(freio, $@"\b{arr}\s*=\s*degraus\.Select\(p => {fonte}\[p\.{lado}\]\)\.ToArray\(\);"))
                erros.Add(arr + " não aponta para a barra de baixo");

        // Chamado no construtor DEPOIS das luzes e halos existirem (e dos halos dos lados dimensionados).
        var ctor = CorpoDoMetodo(src, "public MainWindow(LaunchOptions options)");
        var chamada = ctor.IndexOf("AplicarFreioNaBarraDeBaixo();", StringComparison.Ordinal);
        var prontos = new[] { "_leds = new[]", "_ledGlows = new[]", "_brakeRightGlow = new[]", "foreach (var g in _brakeRightGlow)" }
            .Select(s => ctor.IndexOf(s, StringComparison.Ordinal));
        if (chamada < 0 || prontos.Any(i => i < 0 || i > chamada)) erros.Add("freio embaixo chamado antes das luzes existirem");

        if (PrimeiraInstrucao(CorpoDoMetodo(src, "private void ApplyShift(")) != "if (!TelaPrimeiraVersao.ShiftDeGiroNaTela()) return;")
            erros.Add("giro sem a chave no início");

        // A varredura demo de marcha só nasce (e só liga) dentro do if da chave.
        const string se = "if (TelaPrimeiraVersao.ShiftDeGiroNaTela())";
        var i0 = ctor.IndexOf(se, StringComparison.Ordinal);
        var (ini, fim) = i0 < 0 ? (-1, -1) : Bloco(ctor, i0 + se.Length);
        bool Dentro(string trecho) { var k = ctor.IndexOf(trecho, StringComparison.Ordinal); return k > ini && k < fim; }
        if (ini < 0 || !Dentro("_shiftSweepTimer = DispatcherQueue.CreateTimer();") || !Dentro("_shiftSweepTimer.Start();"))
            erros.Add("varredura de giro fora da chave");
        return erros;
    }

    [Fact]
    public void TPV_11_Com_a_chave_ligada_a_barra_de_baixo_e_do_freio_e_o_giro_nao_acende()
    {
        Assert.True(TelaPrimeiraVersao.FreioNaBarraDeBaixo(ligada: true));
        Assert.False(TelaPrimeiraVersao.FreioNaBarraDeBaixo(ligada: false));
        Assert.False(TelaPrimeiraVersao.ShiftDeGiroNaTela(ligada: true));
        Assert.True(TelaPrimeiraVersao.ShiftDeGiroNaTela(ligada: false));

        var src = Codigo();
        Assert.Empty(FiacaoDoFreioEmbaixo(src));
        var doc = Xaml();
        foreach (var c in TelaPrimeiraVersao.ColunasDeFreioEscondidas) Peca(doc, c);   // as colunas existem no XAML

        // Só o AplicarFreioNaBarraDeBaixo mexe nas colunas dos lados; a varredura de marcha nasce num lugar só.
        var freio = CorpoDoMetodo(src, "private void AplicarFreioNaBarraDeBaixo()");
        var colunas = new Regex(@"\b(BrakeLColuna|BrakeRColuna)\.Visibility\s*=(?!=)");
        var fora = LinhasDaUi().Where(x => colunas.IsMatch(x.Linha) && !freio.Contains(x.Linha))
                               .Select(x => $"{x.Arquivo}: {x.Linha.Trim()}").ToList();
        Assert.True(fora.Count == 0, "coluna de freio mexida fora da chave:\n" + string.Join("\n", fora));
        Assert.Equal(1, LinhasDaUi().Count(x => x.Linha.Contains("_shiftSweepTimer = ")));

        // Controles: cada fio solto reprova.
        Assert.Contains("freio sem a chave no início",
            FiacaoDoFreioEmbaixo(src.Replace("if (!TelaPrimeiraVersao.FreioNaBarraDeBaixo()) return;", "")));
        Assert.Contains("_brakeLeft não aponta para a barra de baixo",
            FiacaoDoFreioEmbaixo(src.Replace("_leds[p.Esquerda]", "_leds[p.Direita]")));
        Assert.Contains("giro sem a chave no início",
            FiacaoDoFreioEmbaixo(src.Replace("if (!TelaPrimeiraVersao.ShiftDeGiroNaTela()) return;", "")));
        var timerSolto = src.Replace("if (TelaPrimeiraVersao.ShiftDeGiroNaTela())\n            {\n",
                                     "if (TelaPrimeiraVersao.ShiftDeGiroNaTela())\n            { }\n            {\n");
        Assert.NotEqual(src, timerSolto);
        Assert.Contains("varredura de giro fora da chave", FiacaoDoFreioEmbaixo(timerSolto));
        var cedo = src.Replace("        AplicarFreioNaBarraDeBaixo();\n", "")
                      .Replace("AplicarPrimeiraVersao();\n", "AplicarPrimeiraVersao();\n        AplicarFreioNaBarraDeBaixo();\n");
        Assert.NotEqual(src, cedo);
        Assert.Contains("freio embaixo chamado antes das luzes existirem", FiacaoDoFreioEmbaixo(cedo));
    }

    // Quem pode acender a barra de baixo com o giro: os métodos do shift light — chamados só pelo ApplyShift
    // (que sai pela chave) e pela varredura demo (que só nasce com a chave desligada) — e quem reaponta a luz
    // de freio para ela. Lista à mão só pode reprovar a mais (método renomeado), nunca esconder: linha nova
    // fora dela reprova.
    private static readonly string[] DonosDaBarra =
        { "ApplyShift", "BeginShiftFlash", "EndShiftFlash", "StartShiftStrobe", "RenderShiftLeds", "DemoShiftRender",
          "RenderShiftFill", "RenderAllShift", "WashTroca", "AplicarFreioNaBarraDeBaixo" };

    // Lê _leds/_ledGlows (atribuir não conta) ou chama um método do shift light.
    private static readonly Regex MexeNaBarra =
        new(@"\b_(leds|ledGlows)\b(?!\s*=[^=])|\b(BeginShiftFlash|EndShiftFlash|StartShiftStrobe|RenderShiftLeds|DemoShiftRender|RenderShiftFill|RenderAllShift|WashTroca)\(");

    private static readonly Regex Assinatura = new(@"^    (private|public|internal)[^=;]*?\b(\w+)\(");

    /// <summary>Linhas que mexem na barra de baixo fora dos donos dela. Dono da linha = o último método
    /// declarado acima. Fora da conta: a varredura demo (guardada no TPV_11) e o tamanho dos halos.</summary>
    private static List<string> MexemNaBarraDeFora(string arquivo, IEnumerable<string> linhas, List<string>? donosVistos = null)
    {
        var fora = new List<string>();
        var dono = "";
        foreach (var l in linhas)
        {
            var m = Assinatura.Match(l);
            if (m.Success) dono = m.Groups[2].Value;
            if (!MexeNaBarra.IsMatch(l)) continue;
            donosVistos?.Add(dono);
            if (DonosDaBarra.Contains(dono) || l.Contains("_shiftSweepTimer.Tick +=") || l.Contains("InitGlow(")) continue;
            fora.Add($"{arquivo} ({dono}): {l.Trim()}");
        }
        return fora;
    }

    [Fact]
    public void TPV_12_So_o_shift_light_e_o_freio_embaixo_mexem_na_barra_de_baixo()
    {
        var vistos = new List<string>();
        var fora = Directory.GetFiles(PastaUi(), "MainWindow*.cs")
            .SelectMany(f => MexemNaBarraDeFora(Path.GetFileName(f), File.ReadAllLines(f), vistos)).ToList();
        Assert.True(fora.Count == 0, "barra de baixo mexida fora do shift light/freio embaixo:\n" + string.Join("\n", fora));

        // A régua enxerga o shift light e o freio embaixo de hoje (não está olhando o vazio).
        Assert.Contains("RenderShiftLeds", vistos);
        Assert.Contains("AplicarFreioNaBarraDeBaixo", vistos);

        // Controle: o shift light chamado de dentro do ApplyFreio reprova.
        var src = Codigo();
        var sabotado = src.Replace("        ApplyBrake(f.Lit);\n", "        ApplyBrake(f.Lit);\n        RenderAllShift(LedOff, on: false);\n");
        Assert.NotEqual(src, sabotado);
        Assert.Contains("MainWindow.xaml.cs (ApplyFreio): RenderAllShift(LedOff, on: false);",
                        MexemNaBarraDeFora("MainWindow.xaml.cs", sabotado.Split('\n')));
    }

    /// <summary>O lavado do ponto de freada: o freio real dispara no ApplyFreio e a demo, com a chave
    /// ligada, no 1º passo do pisca vermelho (lido da própria DemoBrakeRender, não digitado). A peça existe no
    /// XAML e nada a esconde.</summary>
    private static List<string> LavadoDoFreio(string src)
    {
        var erros = new List<string>();
        if (!CorpoDoMetodo(src, "private void ApplyFreio(FreioState f)").Contains("WashFreio();"))
            erros.Add("freio real sem o lavado");

        var demo = CorpoDoMetodo(src, "private void DemoBrakeRender(int step)");
        var pisca = Regex.Match(demo, @"else if \(step == (\d+)[^\n]*RenderAllBrake\(LedShiftRed");
        if (!pisca.Success) { erros.Add("pisca vermelho da demo não achado"); return erros; }
        var lavado = demo.Split('\n').Where(l => l.Contains("WashFreio(")).ToList();
        if (lavado.Count == 0) erros.Add("demo sem o lavado no ponto");
        foreach (var l in lavado)
        {
            if (!l.Contains($"step == {pisca.Groups[1].Value} ")) erros.Add("lavado da demo fora do ponto");
            if (!l.Contains("TelaPrimeiraVersao.FreioNaBarraDeBaixo()")) erros.Add("lavado da demo sem a chave");
        }
        if (LinhasDaUi().Any(x => x.Linha.Contains("BrakeWashRect.Visibility")))
            erros.Add("lavado escondido");

        // Branco puro, o mais forte (29/10 ~0h): a tela inteira em branco opaco, só com a chave (depois da guarda).
        var freio = CorpoDoMetodo(src, "private void AplicarFreioNaBarraDeBaixo()");
        var guarda = freio.IndexOf("if (!TelaPrimeiraVersao.FreioNaBarraDeBaixo()) return;", StringComparison.Ordinal);
        var branco = freio.IndexOf("BrakeWashRect.Fill = new SolidColorBrush(White);", StringComparison.Ordinal);
        if (branco < 0) erros.Add("lavado não é branco na 1ª versão");
        else if (guarda < 0 || branco < guarda) erros.Add("lavado branco sem a chave");
        if (!Regex.IsMatch(src, @"Color White\s*=\s*Color\.FromArgb\(0xFF, 0xFF, 0xFF, 0xFF\);"))
            erros.Add("White não é branco puro opaco");
        if (!Regex.IsMatch(CorpoDoMetodo(src, "private void WashFreio()"), @"WashPulseInto\(sb, BrakeWashRect, ""Opacity"", 1\.0\)"))
            erros.Add("lavado sem pico de 100%");
        if (src.Split('\n').Count(l => l.Contains("BrakeWashRect.Fill")) != 1)
            erros.Add("cor do lavado mexida fora da chave");
        return erros;
    }

    [Fact]
    public void TPV_13_No_ponto_de_freada_a_tela_lava_de_branco_no_real_e_na_demo()
    {
        var src = Codigo();
        Assert.Empty(LavadoDoFreio(src));
        Peca(Xaml(), "BrakeWashRect");
        Assert.DoesNotContain("BrakeWashRect", TelaPrimeiraVersao.TextosEscondidos);

        const string linhaBranco = "        BrakeWashRect.Fill = new SolidColorBrush(White);\n";
        Assert.Contains(linhaBranco, src);
        Assert.Contains("lavado não é branco na 1ª versão", LavadoDoFreio(src.Replace(linhaBranco, "")));
        Assert.Contains("lavado não é branco na 1ª versão",
            LavadoDoFreio(src.Replace("BrakeWashRect.Fill = new SolidColorBrush(White);", "BrakeWashRect.Fill = new SolidColorBrush(Erro);")));
        var semChave = src.Replace(linhaBranco, "")
                          .Replace("        if (!TelaPrimeiraVersao.FreioNaBarraDeBaixo()) return;", linhaBranco + "        if (!TelaPrimeiraVersao.FreioNaBarraDeBaixo()) return;");
        Assert.NotEqual(src, semChave);
        Assert.Contains("lavado branco sem a chave", LavadoDoFreio(semChave));
        Assert.Contains("White não é branco puro opaco",
            LavadoDoFreio(src.Replace("Color White       = Color.FromArgb(0xFF, 0xFF, 0xFF, 0xFF);", "Color White       = Color.FromArgb(0xC0, 0xFF, 0xFF, 0xFF);")));
        Assert.Contains("lavado sem pico de 100%",
            LavadoDoFreio(src.Replace("WashPulseInto(sb, BrakeWashRect, \"Opacity\", 1.0)", "WashPulseInto(sb, BrakeWashRect, \"Opacity\", 0.6)")));

        // Controles: cada fio solto reprova.
        const string linhaDemo = "        if (step == 10 && TelaPrimeiraVersao.FreioNaBarraDeBaixo()) WashFreio();\n";
        Assert.Contains(linhaDemo, src);
        Assert.Contains("demo sem o lavado no ponto", LavadoDoFreio(src.Replace(linhaDemo, "")));
        Assert.Contains("lavado da demo fora do ponto", LavadoDoFreio(src.Replace("step == 10 && Tela", "step == 11 && Tela")));
        Assert.Contains("lavado da demo sem a chave",
            LavadoDoFreio(src.Replace("step == 10 && TelaPrimeiraVersao.FreioNaBarraDeBaixo()", "step == 10 ")));
        var semReal = src.Replace("            WashFreio();             // + a tela LAVA", "            //WashFreio  // + a tela LAVA");
        Assert.NotEqual(src, semReal);
        Assert.Contains("freio real sem o lavado", LavadoDoFreio(semReal));
    }
}
