// TelaPrimeiraVersaoTests — catraca da 1ª versão da tela do piloto (Flávio 2026-10-29: só os 2
// números + o aviso de freio, nenhuma mensagem). A régua nasce da FONTE: lê o MainWindow.xaml e os
// MainWindow*.cs de verdade (sobe pastas a partir do bin até achar P1Fast.Cockpit.UI). Fail-closed:
// peça nova fora dos grupos escondidos, peça sem nome ou arquivo não achado = REPROVA. Cada régua
// tem o controle que DEVE reprovar (chave desligada, peça movida para fora do grupo, linha sem guarda).

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

    /// <summary>Nomes dos filhos diretos do device que aparecem com a chave <paramref name="ligada"/>.
    /// Grupo escondido aparece só se MostraGrupos. Fora dos grupos TUDO conta como na tela, mesmo o
    /// que nasce Visibility="Collapsed" no XAML (o código liga depois — é assim que a mensagem aparece).
    /// Peça sem nome aparece como "(sem nome: Tag)" — e por isso reprova a comparação.</summary>
    private static List<string> VisiveisNaTela(XDocument doc, bool ligada)
    {
        var visiveis = new List<string>();
        foreach (var filho in GridDoDevice(doc).Elements())
        {
            var nome = Nome(filho);
            if (nome is not null && TelaPrimeiraVersao.GruposEscondidos.Contains(nome))
            {
                if (TelaPrimeiraVersao.MostraGrupos(ligada)) visiveis.Add(nome);
                continue;
            }
            visiveis.Add(nome ?? $"(sem nome: {filho.Name.LocalName})");
        }
        return visiveis;
    }

    private static IEnumerable<(string Arquivo, string Linha)> LinhasDaUi()
    {
        var arquivos = Directory.GetFiles(PastaUi(), "MainWindow*.cs");
        Assert.NotEmpty(arquivos);
        foreach (var f in arquivos)
            foreach (var l in File.ReadAllLines(f))
                yield return (Path.GetFileName(f), l);
    }

    [Fact]
    public void TPV_01_Chave_ligada_e_a_primeira_versao()
    {
        Assert.True(TelaPrimeiraVersao.Ligada, "a 1ª versão da tela (só 2 números + freio) é a que vai para o notebook");
        Assert.False(TelaPrimeiraVersao.MostraGrupos(ligada: true));
        Assert.True(TelaPrimeiraVersao.MostraGrupos(ligada: false));
        Assert.False(TelaPrimeiraVersao.MensagensNaTela(ligada: true));
        Assert.True(TelaPrimeiraVersao.MensagensNaTela(ligada: false));
    }

    [Fact]
    public void TPV_02_Com_a_chave_ligada_so_os_2_numeros_e_o_freio_ficam_na_tela()
    {
        var doc = Xaml();

        // Na janela só existe o device (nada solto ao lado dele).
        var root = doc.Descendants().Single(e => Nome(e) == "RootGrid");
        Assert.Equal(new[] { "DeviceBorder" }, root.Elements().Select(e => Nome(e) ?? $"(sem nome: {e.Name.LocalName})"));

        // Os 4 grupos existem como filhos diretos do device (régua não pode estar olhando o vazio).
        var filhos = GridDoDevice(doc).Elements().Select(Nome).ToList();
        foreach (var g in TelaPrimeiraVersao.GruposEscondidos) Assert.Contains(g, filhos);

        Assert.Equal(TelaPrimeiraVersao.Ficam, VisiveisNaTela(doc, ligada: true));
    }

    [Fact]
    public void TPV_03_Controle_chave_desligada_devolve_a_tela_de_antes()
    {
        var visiveis = VisiveisNaTela(Xaml(), ligada: false);
        Assert.NotEqual(TelaPrimeiraVersao.Ficam, visiveis);
        foreach (var g in TelaPrimeiraVersao.GruposEscondidos) Assert.Contains(g, visiveis);
        foreach (var f in TelaPrimeiraVersao.Ficam) Assert.Contains(f, visiveis);
    }

    [Fact]
    public void TPV_04_Controle_peca_fora_dos_grupos_ou_sem_nome_reprova()
    {
        // Mensagem (AlertBlocoRoot) tirada do grupo e posta solta no device → apareceria → reprova.
        var doc = Xaml();
        var alerta = doc.Descendants().Single(e => Nome(e) == "AlertBlocoRoot");
        alerta.Remove();
        GridDoDevice(doc).Add(alerta);
        var comAlerta = VisiveisNaTela(doc, ligada: true);
        Assert.Contains("AlertBlocoRoot", comAlerta);
        Assert.NotEqual(TelaPrimeiraVersao.Ficam, comAlerta);

        // Peça nova sem nome posta no device → reprova também.
        var doc2 = Xaml();
        GridDoDevice(doc2).Add(new XElement(GridDoDevice(doc2).Name.Namespace + "TextBlock", new XAttribute("Text", "x")));
        Assert.NotEqual(TelaPrimeiraVersao.Ficam, VisiveisNaTela(doc2, ligada: true));
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

    [Fact]
    public void TPV_06_Grupos_escondidos_so_mudam_em_AplicarPrimeiraVersao_chamada_no_construtor()
    {
        var src = File.ReadAllText(Path.Combine(PastaUi(), "MainWindow.xaml.cs"));
        var ini = src.IndexOf("private void AplicarPrimeiraVersao()", StringComparison.Ordinal);
        Assert.True(ini >= 0, "AplicarPrimeiraVersao() não achado no MainWindow.xaml.cs");
        var fim = src.IndexOf("\n    }", ini, StringComparison.Ordinal);
        Assert.True(fim > ini);
        var corpo = src[ini..fim];

        var mexeGrupo = new Regex(@"\bEscondido\w+\.Visibility\s*=(?!=)");
        foreach (var g in TelaPrimeiraVersao.GruposEscondidos)
            Assert.Contains($"{g}.Visibility = grupos;", corpo);
        Assert.Equal(TelaPrimeiraVersao.GruposEscondidos.Count, mexeGrupo.Matches(corpo).Count);

        var noTotal = LinhasDaUi().Count(x => mexeGrupo.IsMatch(x.Linha));
        Assert.Equal(TelaPrimeiraVersao.GruposEscondidos.Count, noTotal);   // ninguém fora dela

        var ctor = src.IndexOf("public MainWindow(LaunchOptions options)", StringComparison.Ordinal);
        Assert.True(ctor >= 0);
        var fimCtor = src.IndexOf("\n    }", ctor, StringComparison.Ordinal);
        Assert.Contains("AplicarPrimeiraVersao();", src[ctor..fimCtor]);
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
}
