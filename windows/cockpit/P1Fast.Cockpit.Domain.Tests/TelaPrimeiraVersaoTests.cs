// TelaPrimeiraVersaoTests — catraca da 1ª versão da tela do piloto (Flávio 2026-10-29: "somente os dois
// números do centro e não aparecerem mensagens escritas... todo o resto era para se manter" + "40% maiores
// e centralizados nas suas metades da tela"). A régua nasce da FONTE: lê o MainWindow.xaml e os
// MainWindow*.cs de verdade (sobe pastas a partir do bin até achar P1Fast.Cockpit.UI). Fail-closed: peça
// não achada = REPROVA. Cada régua tem o controle que DEVE reprovar (indicador escondido, número no canto,
// número por baixo do mapa, mensagem sem a chave).

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

    // O que ele disse que tinha sumido e devia continuar: shift light, sensores, barra de voltas, mapa,
    // ápice (entrada/freio/vmin/ápice/saída), halo, e o aviso de freio.
    private static readonly string[] ResteDaTela =
        new[] { "HaloRect", "SensorRpm", "SensorGps", "SensorPneus", "StintBar", "CoachZoomRoot", "ApiceRow",
                "ApexEntradaValor", "ApexFreioValor", "ApexVminValor", "ApexSaidaValor", "ApiceBolaNum",
                "BrakeLColuna", "BrakeRColuna", "BrakeWashRect" }
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

    // Quem pode tirar os números/freio da tela: só código guardado pela chave (mensagem e crítico).
    private static readonly Regex MexeNasPecasQueFicam =
        new(@"\b(FreadaPanel|SaidaPanel|BrakeLColuna|BrakeRColuna|BrakeWashRect)\.Visibility\s*=(?!=)");

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
}
