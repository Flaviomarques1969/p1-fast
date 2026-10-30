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
// 30/10 (painel p1fast-cartao-delta-mapa-0013): os 2 números vão para as bordas de fora e o centro é do cartão do
// delta da volta, SEM mapa — o vidro do mapa sai da lista do que fica (TPV_03), o cartão entra na posição (TPV_04)
// e na camada (TPV_06), o mapa só liga pela chave (TPV_14) e o cartão é fiado ao cérebro (TPV_15).
// 30/10 ~11h: os 2 números dos lados 20% menores e cada um no CENTRO do espaço de 2 algarismos ("o 8 no centro do
// 12") — caixa na borda de fora com um molde "88" invisível na mesma fonte (TPV_04); a demo do cartão anda 10×/s
// (TPV_15).

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
    // sensores, barra de voltas, ápice (entrada/freio/vmin/ápice/saída), halo e o lavado da freada. O mapa saiu
    // em 30/10 ("sem mapa", TPV_14) e o centro passou a ser o cartão do delta, que também não pode nascer escondido.
    private static readonly string[] ResteDaTela =
        new[] { "HaloRect", "SensorRpm", "SensorGps", "SensorPneus", "StintBar", "ApiceRow",
                "ApexEntradaValor", "ApexFreioValor", "ApexVminValor", "ApexSaidaValor", "ApiceBolaNum",
                "BrakeWashRect", "DeltaVoltaCard", "DvNum", "DvMelhor", "DvUltima" }
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

    // Largura de um algarismo e da vírgula, em fração da fonte (ESTIMATIVA para o ExtraBold, com folga): dá o pior
    // caso da conta de espaço — 2 algarismos em cada número dos lados (a caixa do molde "88"), "1,07"/"12,3" (3
    // algarismos e a vírgula) no cartão. O vão do vidro é o raio do canto do corpo do cartão (CornerRadius 28).
    private const double LarguraDoAlgarismo = 0.6, LarguraDaVirgula = 0.3, VaoDoVidro = 28;
    private const double BordaDeFora = 40;

    private static double Num(XElement e, string atributo) =>
        double.Parse((string)e.Attribute(atributo)!, CultureInfo.InvariantCulture);

    /// <summary>Margin do XAML ("l,t,r,b", "h,v" ou um número só) em esquerda, cima, direita, baixo.</summary>
    private static double[] Margem(XElement e)
    {
        if ((string?)e.Attribute("Margin") is not { } m) return new double[4];
        var p = m.Split(',').Select(x => double.Parse(x, CultureInfo.InvariantCulture)).ToArray();
        return p.Length switch { 1 => new[] { p[0], p[0], p[0], p[0] }, 2 => new[] { p[0], p[1], p[0], p[1] }, _ => p };
    }

    /// <summary>Quanto as camadas do cartão (aura, sombra de contato) passam da caixa dele, por lado.</summary>
    private static double[] Sobra(XElement cartao) =>
        Enumerable.Range(0, 4).Select(i => cartao.Elements().Select(f => Math.Max(0, -Margem(f)[i])).DefaultIfEmpty(0).Max()).ToArray();

    /// <summary>O Y do TranslateTransform do RenderTransform da peça (0 = sem deslocamento).</summary>
    private static double DeslocamentoY(XElement e) =>
        e.Elements().Where(x => x.Name.LocalName.EndsWith(".RenderTransform", StringComparison.Ordinal))
         .Descendants().Where(x => x.Name.LocalName == "TranslateTransform")
         .Select(x => x.Attribute("Y") is null ? 0 : Num(x, "Y")).DefaultIfEmpty(0).Single();

    /// <summary>Onde termina a barra de voltas: o topo dela no XAML + a altura das cápsulas, lida do código que as
    /// monta (MainWindow.BarraVoltas.cs).</summary>
    private static double FimDaBarraDeVoltas(XDocument doc)
    {
        var m = Regex.Match(File.ReadAllText(Path.Combine(PastaUi(), "MainWindow.BarraVoltas.cs")), @"\bBarBlockH\s*=\s*(\d+)");
        Assert.True(m.Success, "altura das cápsulas da barra de voltas não achada");
        return Margem(Peca(doc, "StintBar"))[1] + double.Parse(m.Groups[1].Value, CultureInfo.InvariantCulture);
    }

    /// <summary>Onde começa a fileira do ápice (presa embaixo: altura da tela − margem de baixo − altura).</summary>
    private static double InicioDoApice(XDocument doc, double alturaDaTela)
    {
        var a = Peca(doc, "ApiceRow");
        Assert.Equal("Bottom", (string?)a.Attribute("VerticalAlignment"));
        return alturaDaTela - Margem(a)[3] - Num(a, "Height");
    }

    /// <summary>Os 2 números 40% maiores que na f251c0be (116 e 92) e depois 20% menores (30/10 ~11h), cada um no
    /// centro de uma caixa de 2 algarismos (molde "88" invisível, mesma fonte) encostada na borda de FORA da sua
    /// metade, e o cartão do delta no centro, com o número maior que os dois, sem encostar neles, na barra de voltas
    /// ou no ápice.</summary>
    private static List<string> ForaDoLugar(XDocument doc)
    {
        var erros = new List<string>();
        var dev = Peca(doc, "DeviceBorder");
        var (largura, altura) = (Num(dev, "Width"), Num(dev, "Height"));
        var metade = largura / 2;
        var (freada, saida) = (Fonte(doc, "FreadaNum"), Fonte(doc, "SaidaNum"));
        var escala = TelaPrimeiraVersao.AumentoDosNumeros * TelaPrimeiraVersao.ReducaoDosLados;
        if (freada != (int)Math.Round(116 * escala)) erros.Add("fonte da freada");
        if (saida != (int)Math.Round(92 * escala)) erros.Add("fonte da saída");
        var borda = BordaDeFora.ToString(CultureInfo.InvariantCulture);
        foreach (var (painel, num, lado, margem) in new[] { ("FreadaPanel", "FreadaNum", "Left", $"{borda},0,0,0"),
                                                            ("SaidaPanel", "SaidaNum", "Right", $"0,0,{borda},0") })
        {
            var p = Peca(doc, painel);
            if ((string?)p.Attribute("HorizontalAlignment") != lado) erros.Add(painel + " fora da sua metade");
            if ((string?)p.Attribute("Width") != metade.ToString(CultureInfo.InvariantCulture)) erros.Add(painel + " não ocupa a metade");
            if (p.Attribute("Margin") is not null) erros.Add(painel + " empurrado por margem");
            var n = Peca(doc, num);
            var caixa = n.Parent!;
            if (caixa.Parent != p || caixa.Name.LocalName != "Grid") { erros.Add(num + " fora da caixa de 2 algarismos"); continue; }
            if ((string?)caixa.Attribute("HorizontalAlignment") != lado || (string?)caixa.Attribute("Margin") != margem) erros.Add(num + " fora da borda de fora");
            if ((string?)n.Attribute("HorizontalAlignment") != "Center" || n.Attribute("Margin") is not null) erros.Add(num + " fora do centro dos 2 algarismos");
            // A largura da caixa é a do molde: um "88" invisível na MESMA fonte do número, e nada mais na caixa.
            var molde = caixa.Elements().Where(e => e != n).ToList();
            if (caixa.Attribute("Width") is not null || molde.Count != 1 || molde[0].Name.LocalName != "TextBlock"
                || (string?)molde[0].Attribute("Text") != "88" || (string?)molde[0].Attribute("Opacity") != "0"
                || new[] { "FontSize", "FontWeight", "FontFamily", "CharacterSpacing" }
                       .Any(a => (string?)molde[0].Attribute(a) != (string?)n.Attribute(a)))
                erros.Add(num + " sem o molde de 2 algarismos");
        }

        var cartao = Peca(doc, "DeltaVoltaCard");
        var dvNum = Peca(doc, "DvNum");
        var delta = Fonte(doc, "DvNum");
        if (delta <= Math.Max(freada, saida)) erros.Add("delta não é o maior número da tela");
        if (dvNum.Parent!.Elements().Where(e => e.Name.LocalName == "TextBlock").Any(e => Num(e, "FontSize") != delta))
            erros.Add("relevo do delta com fonte diferente");
        if ((string?)cartao.Attribute("HorizontalAlignment") != "Center" || (string?)cartao.Attribute("VerticalAlignment") != "Center"
            || cartao.Attribute("Margin") is not null)
            erros.Add("cartão fora do centro");
        var (w, h) = (Num(cartao, "Width"), Num(cartao, "Height"));
        var s = Sobra(cartao);
        var fimDaFreada = BordaDeFora + 2 * LarguraDoAlgarismo * freada;
        var inicioDaSaida = largura - BordaDeFora - 2 * LarguraDoAlgarismo * saida;
        if (metade - w / 2 - s[0] < fimDaFreada || metade + w / 2 + s[2] > inicioDaSaida) erros.Add("cartão encosta nos números");
        var y = DeslocamentoY(cartao);
        if (y != DeslocamentoY(Peca(doc, "FreadaPanel")) || y != DeslocamentoY(Peca(doc, "SaidaPanel")))
            erros.Add("cartão fora da altura dos números");
        if ((altura - h) / 2 + y - s[1] < FimDaBarraDeVoltas(doc) || (altura + h) / 2 + y + s[3] > InicioDoApice(doc, altura))
            erros.Add("cartão encosta na barra de voltas ou no ápice");
        if ((3 * LarguraDoAlgarismo + LarguraDaVirgula) * delta > w - 2 * VaoDoVidro) erros.Add("delta não cabe no cartão");
        return erros;
    }

    [Fact]
    public void TPV_04_Os_2_numeros_nas_bordas_de_fora_centrados_em_2_algarismos_e_o_delta_maior_no_centro()
    {
        Assert.Empty(ForaDoLugar(Xaml()));
        Assert.Equal(130, Fonte(Xaml(), "FreadaNum"));   // 162 × 0,8 (Flávio 30/10 ~11h: "20% menores")
        Assert.Equal(103, Fonte(Xaml(), "SaidaNum"));    // 129 × 0,8
        Assert.True(Fonte(Xaml(), "DvNum") > 162, "o delta tem de ser maior que 162 (painel p1fast-cartao-delta-mapa-0013)");
        // A régua enxerga o que mede (não está olhando o vazio): a aura/sombra passam da caixa nos 4 lados, a
        // altura das cápsulas entra no fim da barra de voltas e o ápice começa dentro da tela.
        var doc = Xaml();
        Assert.All(Sobra(Peca(doc, "DeltaVoltaCard")), v => Assert.True(v > 0));
        Assert.True(FimDaBarraDeVoltas(doc) > Margem(Peca(doc, "StintBar"))[1]);
        var altura = Num(Peca(doc, "DeviceBorder"), "Height");
        Assert.InRange(InicioDoApice(doc, altura), altura / 2, altura - 1);

        // Controles: cada coisa fora do lugar reprova.
        var antiga = Xaml(); Peca(antiga, "FreadaNum").SetAttributeValue("FontSize", "116");
        Assert.Contains("fonte da freada", ForaDoLugar(antiga));
        var canto = Xaml(); Peca(canto, "SaidaPanel").SetAttributeValue("Margin", "0,0,72,0");
        Assert.Contains("SaidaPanel empurrado por margem", ForaDoLugar(canto));
        var semReducao = Xaml();
        foreach (var t in new[] { "FreadaNum", "FreadaMolde" }) Peca(semReducao, t).SetAttributeValue("FontSize", "162");
        Assert.Contains("fonte da freada", ForaDoLugar(semReducao));
        var noMeio = Xaml(); Peca(noMeio, "FreadaCaixa").SetAttributeValue("HorizontalAlignment", "Center");
        Peca(noMeio, "FreadaCaixa").SetAttributeValue("Margin", null);
        Assert.Contains("FreadaNum fora da borda de fora", ForaDoLugar(noMeio));
        // O pedido de 30/10 ~11h: o número no CANTO da caixa (o "8" onde começaria o "12") reprova.
        var noCanto = Xaml(); Peca(noCanto, "SaidaNum").SetAttributeValue("HorizontalAlignment", "Right");
        Assert.Contains("SaidaNum fora do centro dos 2 algarismos", ForaDoLugar(noCanto));
        var umAlgarismo = Xaml(); Peca(umAlgarismo, "FreadaMolde").SetAttributeValue("Text", "8");
        Assert.Contains("FreadaNum sem o molde de 2 algarismos", ForaDoLugar(umAlgarismo));
        var visivel = Xaml(); Peca(visivel, "SaidaMolde").SetAttributeValue("Opacity", "1");
        Assert.Contains("SaidaNum sem o molde de 2 algarismos", ForaDoLugar(visivel));
        var outraFonte = Xaml(); Peca(outraFonte, "FreadaMolde").SetAttributeValue("FontSize", "162");
        Assert.Contains("FreadaNum sem o molde de 2 algarismos", ForaDoLugar(outraFonte));
        var larguraFixa = Xaml(); Peca(larguraFixa, "SaidaCaixa").SetAttributeValue("Width", "124");
        Assert.Contains("SaidaNum sem o molde de 2 algarismos", ForaDoLugar(larguraFixa));
        // O jeito antigo (número solto no painel, encostado na borda): sem caixa reprova.
        var solto = Xaml(); var fn = Peca(solto, "FreadaNum"); var cx = fn.Parent!;
        fn.Remove(); cx.AddAfterSelf(fn); cx.Remove();
        fn.SetAttributeValue("HorizontalAlignment", "Left"); fn.SetAttributeValue("Margin", "40,0,0,0");
        Assert.Contains("FreadaNum fora da caixa de 2 algarismos", ForaDoLugar(solto));
        // Delta do tamanho do maior número dos lados (lido do XAML, não digitado: os lados mudam de tamanho).
        var menor = Xaml();
        Peca(menor, "DvNum").SetAttributeValue("FontSize", Math.Max(Fonte(menor, "FreadaNum"), Fonte(menor, "SaidaNum")).ToString(CultureInfo.InvariantCulture));
        Assert.Contains("delta não é o maior número da tela", ForaDoLugar(menor));
        Assert.Contains("relevo do delta com fonte diferente", ForaDoLugar(menor));
        var largo = Xaml(); Peca(largo, "DeltaVoltaCard").SetAttributeValue("Width", "560");
        Assert.Contains("cartão encosta nos números", ForaDoLugar(largo));
        var alto = Xaml(); Peca(alto, "DeltaVoltaCard").SetAttributeValue("Height", "260");
        Assert.Contains("cartão encosta na barra de voltas ou no ápice", ForaDoLugar(alto));
        var deLado = Xaml(); Peca(deLado, "DeltaVoltaCard").SetAttributeValue("HorizontalAlignment", "Left");
        Assert.Contains("cartão fora do centro", ForaDoLugar(deLado));
        var gigante = Xaml();
        foreach (var t in Peca(gigante, "DvNum").Parent!.Elements().Where(e => e.Name.LocalName == "TextBlock"))
            t.SetAttributeValue("FontSize", "220");
        Assert.Contains("delta não cabe no cartão", ForaDoLugar(gigante));
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

    /// <summary>Os 2 números e o cartão do delta estão DEPOIS do mapa (por cima dele, se a chave o religar) e ANTES
    /// da tela térmica e do crítico.</summary>
    private static bool NumerosNaCamadaCerta(XDocument doc)
    {
        var mapa = Peca(doc, "CoachZoomRoot");
        var termica = Peca(doc, "TermicaOverlay");
        var critico = Peca(doc, "CriticoOverlay");
        return new[] { "FreadaPanel", "SaidaPanel", "DeltaVoltaCard" }.Select(n => Peca(doc, n))
            .All(p => p.IsAfter(mapa) && p.IsBefore(termica) && p.IsBefore(critico));
    }

    [Fact]
    public void TPV_06_Numeros_e_cartao_por_cima_do_mapa_e_por_baixo_da_termica_e_do_critico()
    {
        Assert.True(NumerosNaCamadaCerta(Xaml()));

        // Controles: a freada de volta antes do mapa (como na f251c0be) e o cartão por cima da térmica reprovam.
        var doc = Xaml();
        var freada = Peca(doc, "FreadaPanel");
        freada.Remove();
        Peca(doc, "CoachZoomRoot").AddBeforeSelf(freada);
        Assert.False(NumerosNaCamadaCerta(doc));
        var porCima = Xaml();
        var cartao = Peca(porCima, "DeltaVoltaCard");
        cartao.Remove();
        Peca(porCima, "TermicaOverlay").AddAfterSelf(cartao);
        Assert.False(NumerosNaCamadaCerta(porCima));
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

    // ── Cartão do delta no centro, sem mapa (30/10, painel p1fast-cartao-delta-mapa-0013) ─────────────

    private static string ArquivoDaUi(string nome) => File.ReadAllText(Path.Combine(PastaUi(), nome));

    private const string MapaPelaChave = "if (TelaPrimeiraVersao.MapaNaTela()) InicializarCoachZoom();";

    /// <summary>Chamadas que ligam o vidro do mapa sem passar pela chave (a declaração do método não conta).</summary>
    private static List<string> MapaSemChave(IEnumerable<(string Arquivo, string Linha)> linhas, List<string>? vistas = null)
    {
        var soltas = new List<string>();
        foreach (var (arquivo, l) in linhas)
        {
            if (!l.Contains("InicializarCoachZoom(") || l.Contains("void InicializarCoachZoom(")) continue;
            vistas?.Add(arquivo);
            if (!l.Contains(MapaPelaChave)) soltas.Add($"{arquivo}: {l.Trim()}");
        }
        return soltas;
    }

    [Fact]
    public void TPV_14_Com_a_chave_ligada_o_mapa_do_centro_nao_liga()
    {
        Assert.False(TelaPrimeiraVersao.MapaNaTela(ligada: true));
        Assert.True(TelaPrimeiraVersao.MapaNaTela(ligada: false));

        var linhas = LinhasDaUi().ToList();
        var vistas = new List<string>();
        var soltas = MapaSemChave(linhas, vistas);
        Assert.True(soltas.Count == 0, "mapa ligado sem a chave:\n" + string.Join("\n", soltas));
        Assert.Contains("MainWindow.xaml.cs", vistas);   // a régua acha a chamada de hoje (IniciarFeedReal)
        Assert.Contains(MapaPelaChave, CorpoDoMetodo(Codigo(), "public void IniciarFeedReal("));

        // O vidro nasce apagado e só o InicializarCoachZoom o acende.
        Assert.Equal("0", (string?)Peca(Xaml(), "CoachZoomRoot").Attribute("Opacity"));
        var acende = linhas.Where(x => Regex.IsMatch(x.Linha, @"\bCoachZoomRoot\.Opacity\s*=(?!=)")).ToList();
        Assert.Single(acende);
        Assert.Contains(acende[0].Linha, CorpoDoMetodo(ArquivoDaUi("MainWindow.CoachZoom.cs"), "private void InicializarCoachZoom()"));

        // Controles: a chamada de hoje sem a guarda e uma chamada nova solta em outro arquivo reprovam.
        var semGuarda = linhas.Select(x => (x.Arquivo, x.Linha.Replace(MapaPelaChave, "InicializarCoachZoom();"))).ToList();
        Assert.Contains("MainWindow.xaml.cs: InicializarCoachZoom();", MapaSemChave(semGuarda));
        Assert.Contains("MainWindow.Live.cs: InicializarCoachZoom();",
            MapaSemChave(linhas.Append(("MainWindow.Live.cs", "        InicializarCoachZoom();"))));
    }

    /// <summary>O que tem de estar fiado para o cartão mostrar o delta do cérebro e a linha de baixo (melhor volta
    /// = a referência do delta; última = a última volta plausível da sessão).</summary>
    private static List<string> FiacaoDoCartao(string chave, string src, string cartao, string recordes, XDocument doc)
    {
        var erros = new List<string>();
        var ctor = CorpoDoMetodo(src, "public MainWindow(LaunchOptions options)");
        if (!Regex.IsMatch(ctor, $@"if \(keys\.Contains\(""{Regex.Escape(chave)}""\)\)\s*ApplyDeltaVolta\(cur\.DeltaVolta\);"))
            erros.Add("cartão não ouve o cérebro");
        if (!ctor.Contains("ApplyDeltaVolta(initial.DeltaVolta);")) erros.Add("cartão sem o estado inicial");

        // As camadas do relevo (lidas do XAML) recebem todas o mesmo número.
        var relevo = Peca(doc, "DvNum").Parent!.Elements().Where(e => e.Name.LocalName == "TextBlock").Select(Nome).OfType<string>().ToHashSet();
        var apply = CorpoDoMetodo(cartao, "private void ApplyDeltaVolta(DeltaVoltaInfo d)");
        var arr = Regex.Match(apply, @"foreach \(var t in new\[\] \{ ([^}]*) \}\) t\.Text = texto;");
        if (!arr.Success || !arr.Groups[1].Value.Split(',').Select(x => x.Trim()).ToHashSet().SetEquals(relevo))
            erros.Add("camada do relevo sem o número");

        // Demo (chave ligada): a cena põe a linha de baixo; o delta é só do relógio de 100 ms (um dono).
        string DentroDe(string s, string se)
        {
            var i0 = s.IndexOf(se, StringComparison.Ordinal);
            var (ini, fim) = i0 < 0 ? (-1, -1) : Bloco(s, i0 + se.Length);
            return ini < 0 ? "" : s[ini..fim];
        }
        var bloco = DentroDe(CorpoDoMetodo(src, "private void ApplyScene(int index)"), "if (TelaPrimeiraVersao.Ligada)");
        if (!bloco.Contains("ApplyVoltasDoCartao(")) erros.Add("demo sem o cartão");
        if (bloco.Contains("SetDeltaVolta(")) erros.Add("delta da demo com dois donos");

        // Delta da demo ANDANDO (Flávio 2026-10-30): relógio de até 100 ms dentro do --demo, que a cada tique anda
        // um passo da fração da cena (Domain DV_16 confere a conta), e que para quando entra o dado real.
        var demo = DentroDe(DentroDe(ctor, "if (_options.Demo)"), "if (TelaPrimeiraVersao.Ligada)");
        var tique = Regex.Match(demo, @"_deltaDemoTimer\.Interval = TimeSpan\.FromMilliseconds\((\d+)\);");
        var anda = DentroDe(demo, "_deltaDemoTimer.Tick += (_, _) =>");
        if (!tique.Success || int.Parse(tique.Groups[1].Value) > 100 || !demo.Contains("_deltaDemoTimer.Start();")
            || !anda.Contains("passo++;")
            || !anda.Contains("_cockpitState.SetDeltaVolta(TelaPrimeiraVersao.DeltaVoltaDemoAndando(\n                        passo / passosPorCena, (double)(passo % passosPorCena) / passosPorCena));")
            || !demo.Contains("var passosPorCena = (int)Math.Round(_demoTimer.Interval.TotalMilliseconds / 100);"))
            erros.Add("demo do delta parada");
        if (!CorpoDoMetodo(src, "public void IniciarFeedReal(").Contains("_deltaDemoTimer?.Stop();"))
            erros.Add("demo do delta por cima do dado real");

        // Linha de baixo: atualiza quando a volta entra na sessão e quando a melhor é semeada, e lê a referência do delta.
        var volta = CorpoDoMetodo(recordes, "private void RegistrarVoltaCompleta(double tempoMs)");
        var add = volta.IndexOf("_sessaoLapsMs.Add(tempoMs);", StringComparison.Ordinal);
        if (add < 0 || volta.IndexOf("AtualizarVoltasDoCartao();", add, StringComparison.Ordinal) < 0)
            erros.Add("última volta não chega ao cartão");
        var semear = CorpoDoMetodo(recordes, "private void SemearRecordesNoCerebro()");
        var sm = semear.IndexOf("_orquestrador.SemearMelhorVolta(", StringComparison.Ordinal);
        if (sm < 0 || semear.IndexOf("AtualizarVoltasDoCartao();", sm, StringComparison.Ordinal) < 0)
            erros.Add("melhor volta semeada não chega ao cartão");
        var a0 = cartao.IndexOf("private void AtualizarVoltasDoCartao()", StringComparison.Ordinal);
        var atualizar = a0 < 0 ? "" : cartao[a0..cartao.IndexOf(';', a0)];
        if (!atualizar.Contains("_orquestrador?.MelhorVolta.TempoMs") || !atualizar.Contains("_sessaoLapsMs[^1]"))
            erros.Add("linha de baixo fora da referência do delta");
        return erros;
    }

    [Fact]
    public void TPV_15_Cartao_do_delta_fiado_ao_cerebro_a_demo_e_a_linha_de_baixo()
    {
        // A chave que o estado emite, lida do próprio estado (não digitada).
        var estado = new CockpitState();
        var chaves = new List<string>();
        estado.OnChange((_, _, keys) => chaves.AddRange(keys));
        estado.SetDeltaVolta(DeltaVoltaInfo.Comparar(1000, 900));
        var chave = Assert.Single(chaves);

        var (src, cartao, recordes, doc) = (Codigo(), ArquivoDaUi("MainWindow.DeltaVolta.cs"), ArquivoDaUi("MainWindow.Recordes.cs"), Xaml());
        Assert.Empty(FiacaoDoCartao(chave, src, cartao, recordes, doc));

        // Controles: cada fio solto reprova.
        const string despacho = "if (keys.Contains(\"deltaVolta\"))   ApplyDeltaVolta(cur.DeltaVolta);";
        Assert.Contains(despacho, src);
        Assert.Contains("cartão não ouve o cérebro", FiacaoDoCartao(chave, src.Replace(despacho, ""), cartao, recordes, doc));
        Assert.Contains("cartão não ouve o cérebro", FiacaoDoCartao("outraChave", src, cartao, recordes, doc));
        Assert.Contains("cartão sem o estado inicial",
            FiacaoDoCartao(chave, src.Replace("ApplyDeltaVolta(initial.DeltaVolta);", ""), cartao, recordes, doc));
        Assert.Contains("camada do relevo sem o número",
            FiacaoDoCartao(chave, src, cartao.Replace(", DvNum }", " }"), recordes, doc));
        const string linhaDeBaixo = "ApplyVoltasDoCartao(melhorMs, ultimaMs);";
        Assert.Contains(linhaDeBaixo, src);
        Assert.Contains("demo sem o cartão", FiacaoDoCartao(chave, src.Replace(linhaDeBaixo, ""), cartao, recordes, doc));
        Assert.Contains("delta da demo com dois donos", FiacaoDoCartao(chave,
            src.Replace(linhaDeBaixo, linhaDeBaixo + "\n            _cockpitState.SetDeltaVolta(TelaPrimeiraVersao.DeltaVoltaDemo(index));"),
            cartao, recordes, doc));

        // Controles do delta andando: o delta parado na cena (o que ele viu em 30/10 10:53), o relógio que não liga,
        // lento demais, e o relógio que segue por cima do dado real reprovam.
        const string passoDaCena = "passo / passosPorCena, (double)(passo % passosPorCena) / passosPorCena));";
        Assert.Contains(passoDaCena, src);
        foreach (var (de, para) in new[]
                 {
                     (passoDaCena, "passo / passosPorCena, 0));"),
                     ("_deltaDemoTimer.Start();", ""),
                     ("_deltaDemoTimer.Interval = TimeSpan.FromMilliseconds(100);", "_deltaDemoTimer.Interval = TimeSpan.FromMilliseconds(2000);"),
                     ("passo++;", ""),
                 })
        {
            Assert.Contains(de, src);
            Assert.Contains("demo do delta parada", FiacaoDoCartao(chave, src.Replace(de, para), cartao, recordes, doc));
        }
        Assert.Contains("demo do delta por cima do dado real",
            FiacaoDoCartao(chave, src.Replace("_deltaDemoTimer?.Stop();", ""), cartao, recordes, doc));
        const string ultima = "_sessaoLapsMs.Add(tempoMs);\n        AtualizarVoltasDoCartao();";
        Assert.Contains(ultima, recordes);
        Assert.Contains("última volta não chega ao cartão",
            FiacaoDoCartao(chave, src, cartao, recordes.Replace(ultima, "_sessaoLapsMs.Add(tempoMs);"), doc));
        Assert.Contains("linha de baixo fora da referência do delta",
            FiacaoDoCartao(chave, src, cartao.Replace("_orquestrador?.MelhorVolta.TempoMs", "SessaoMelhorMs()"), recordes, doc));
    }
}
