// MainWindow.TelaTermica.cs — RENDER das telas dedicadas de AQUECIMENTO e RESFRIAMENTO
// (Flávio 2026-07-06). A DECISÃO é do cérebro (Domain/TelaTermica.cs); aqui é só desenho +
// comportamento de tempo (auto-retorno de 5 s no aquecimento — martelo 2026-07-11; permanência
// no resfriamento até desligar).
//
// Conceito duro: cor de indicador = VERMELHO(ruim) → VERDE(bom). O anel é PROGRESSO rumo ao
// ideal e é SEMPRE CRESCENTE (enche de 0 a 270° conforme a água se aproxima da janela 50–55).
// Desenho: dois arcos (trilho apagado 270° + preenchimento colorido 270°×progresso), número
// gigante da temperatura no centro e painel de dados à direita (alvo/melhor volta reais onde
// dá; alvo histórico / média / vs-alvo são PLACEHOLDER — vêm do cérebro/nuvem = iMac).
//
// Enquanto a tela está no ar, ela COBRE a telemetria normal — mas fica ABAIXO da chuva
// térmica e do modo crítico (z-order do device, Flávio 2026-07-10): a chuva cai também
// aqui (a mesma água guia as duas coisas) e o alerta crítico nunca é coberto.

using System;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Documents;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI.Xaml.Shapes;
using P1Fast.Cockpit.Domain;
using Windows.Foundation;
using Windows.UI;

namespace P1Fast.Cockpit.UI;

public sealed partial class MainWindow
{
    // Geometria fixa do anel (device canônico 956×440).
    private const double TermicaCx = 250, TermicaCy = 210, TermicaR = 140;
    private const double TermicaStartClock = 225, TermicaSweepTotal = 270;

    private static readonly Color TermVerde    = Color.FromArgb(0xFF, 0x37, 0xE3, 0xA4);
    private static readonly Color TermVermelho = Color.FromArgb(0xFF, 0xFF, 0x3B, 0x47);
    private static readonly Color TermMagenta  = Color.FromArgb(0xFF, 0xE0, 0x56, 0xA0);
    private static readonly Color TermOuro    = Color.FromArgb(0x80, 0xF0, 0xC0, 0x40);
    private static readonly Color TermSlate   = Color.FromArgb(0xFF, 0x7D, 0x8D, 0xA0);
    private static readonly Color TermBranco  = Color.FromArgb(0xFF, 0xF4, 0xF7, 0xFB);

    private bool _termicaVisivel;
    private bool _criticoAtivo;            // 2.1: modo crítico no ar → térmica não pode cobri-lo
    private bool _termicaBrushesProntos;
    private bool _aquecConcluido;          // latch: aquecimento fechou neste stint (não reabre)
    private long _aquecReadyTick;          // quando chegou no ideal (0 = ainda não)
    private int _termicaTempShown = int.MinValue;
    private string _termicaEstadoShown = "";
    private ModoTelaTermica _termicaModoShown = (ModoTelaTermica)(-1);

    private SolidColorBrush? _termFillBrush, _termTempBrush, _termEstadoBrush;
    private RadialGradientBrush? _termGlowBrush;

    // Chamado a cada quadro (replay e live) DEPOIS de atualizar sensores/volta atual.
    private void AtualizarTelaTermica()
    {
        // 2.2 — GUARDA DE RECÊNCIA (§9: nunca número velho). Se o motor emudeceu (T4000/USB
        // caiu), a última água ficaria congelada na tela ("45° AQUECENDO" pra sempre). Trata
        // como SEM DADO → a térmica sai honesta, igual aos sensores do topo que apagam em ~3 s
        // (mesma janela do AtualizarSensores). O andaime --tela-termica não passa por aqui.
        var motorVivo = Environment.TickCount64 - _ultimoMotorTick < 3000;
        var agua = motorVivo ? _ultimaAlerta?.WaterTempC : null;
        // "última volta" na régua de voltas RODADAS (o contador anda por cruzamentos): as
        // cápsulas de BOX não são voltas — comparar com índice de cápsula erraria o gatilho
        // do resfriamento quando o plano tem parada (bug do box, 2026-07-11).
        var est = TelaTermica.Avaliar(agua, _voltaAtualIdx, TotalVoltasRodaveis() - 1);
        var modo = est.Modo;

        // Latch: aquecimento já concluído não reaparece neste stint.
        if (modo == ModoTelaTermica.Aquecimento && _aquecConcluido) modo = ModoTelaTermica.Off;

        // Auto-retorno do aquecimento (MARTELO Flávio 2026-07-11, via canal): atingiu o
        // limite mínimo esperado → a tela fica +5 s e sai (era 10 s). O resfriamento NÃO
        // tem essa regra: o carro vai pro box e a tela fica até desligar (a guarda de
        // recência acima já a tira quando o motor cala).
        if (modo == ModoTelaTermica.Aquecimento)
        {
            if (est.Progresso >= 1.0)
            {
                if (_aquecReadyTick == 0) _aquecReadyTick = Environment.TickCount64;
                else if (Environment.TickCount64 - _aquecReadyTick >= 5_000)
                {
                    _aquecConcluido = true;
                    modo = ModoTelaTermica.Off;
                }
            }
            else _aquecReadyTick = 0;   // caiu abaixo do ideal de novo → reinicia a contagem
        }

        if (modo == ModoTelaTermica.Off) { EsconderTelaTermica(); return; }
        MostrarTelaTermica(modo, est);
    }

    // Andaime (--tela-termica): roda a animação sintética das duas telas em loop, sem
    // depender do replay cruzar os limiares. warmup 40→52 (vermelho→verde) segura no verde,
    // depois cooldown 78→54, repete. Espelha o mockup aprovado pelo Flávio 2026-07-06.
    private System.Diagnostics.Stopwatch? _termDemoClock;
    private Microsoft.UI.Dispatching.DispatcherQueueTimer? _termDemoTimer;   // FIELD: senão o GC coleta e congela
    private void StartTelaTermicaDemo()
    {
        // Recordes fictícios só pro andaime mostrar os campos preenchidos (alvo/melhor/média/vs-alvo).
        var metaDemo = new MetadadosRecorde(0, "demo", "Brasilia", "bubi", "");
        _recordes = new ArmazemRecordes { CarroId = "bubi" };
        _recordes.AplicarVolta(82100, metaDemo);                 // ALVO 1:22.10
        _sessaoLapsMs.Clear();
        _sessaoLapsMs.AddRange(new[] { 81700.0, 83400.0, 84300.0 }); // melhor 1:21.70, média ~1:23.1, bateu o alvo

        _termDemoClock = System.Diagnostics.Stopwatch.StartNew();
        _termDemoTimer = DispatcherQueue.CreateTimer();
        _termDemoTimer.Interval = TimeSpan.FromMilliseconds(33);
        _termDemoTimer.Tick += (_, _) =>
        {
            const double subir = 7000, segurar = 4000, fase = subir + segurar;
            var e = _termDemoClock.Elapsed.TotalMilliseconds % (fase * 2);
            ModoTelaTermica modo; double temp;
            if (e < fase)   // AQUECIMENTO 40 → 52
            {
                modo = ModoTelaTermica.Aquecimento;
                temp = e < subir ? 40 + (52 - 40) * (e / subir) : 52;
                _voltaAtualIdx = 0;
            }
            else            // RESFRIAMENTO 78 → 54
            {
                modo = ModoTelaTermica.Resfriamento;
                var e2 = e - fase;
                temp = e2 < subir ? 78 - (78 - 54) * (e2 / subir) : 54;
                _voltaAtualIdx = TotalVoltasRodaveis() - 1;
            }
            var prog = TelaTermica.Progresso(temp, CortesChuvaTermica.Bubi,
                TelaTermica.FrioTotalBubiC, TelaTermica.QuenteTotalBubiC);
            MostrarTelaTermica(modo, new EstadoTelaTermica(modo, prog, temp));
            // A chuva térmica também cai nesta tela (Flávio 2026-07-10). No caminho real a
            // fase vem do cérebro (CockpitState.Chuva → ApplyChuva); o andaime não passa por
            // lá, então deriva a fase da MESMA água sintética, pelo MESMO Avaliar do Domain.
            ApplyChuva(ChuvaTermica.Avaliar(temp, CortesChuvaTermica.Bubi));
        };
        _termDemoTimer.Start();
    }

    // Reinício de sessão/loop: some com a tela e destrava o aquecimento.
    private void ResetTelaTermica()
    {
        _aquecConcluido = false;
        _aquecReadyTick = 0;
        EsconderTelaTermica();
    }

    private void EsconderTelaTermica()
    {
        if (!_termicaVisivel) return;
        _termicaVisivel = false;
        TermicaOverlay.Visibility = Visibility.Collapsed;
        _termicaModoShown = (ModoTelaTermica)(-1);   // força repopular o painel na próxima abertura
    }

    private void MostrarTelaTermica(ModoTelaTermica modo, EstadoTelaTermica est)
    {
        // 2.1 — CRÍTICO SEMPRE VENCE: com o modo crítico no ar (super/grave "toma a tela"),
        // a térmica NÃO pode reaparecer por cima do alerta. Chokepoint único: nenhum caminho
        // (per-sample, ~1 Hz, andaime) abre a térmica enquanto o crítico está ligado.
        if (_criticoAtivo) return;
        EnsureTermicaBrushes();
        if (!_termicaVisivel)
        {
            _termicaVisivel = true;
            TermicaOverlay.Visibility = Visibility.Visible;
            TermicaTrack.Data = Arco(TermicaStartClock, TermicaSweepTotal);
        }

        var prog = Math.Max(0, Math.Min(1, est.Progresso));
        var cor = HslToColor(prog * 152.0, 0.82, 0.52 + prog * 0.06);

        // Anel de progresso (sempre crescente).
        if (prog < 0.02) TermicaFill.Visibility = Visibility.Collapsed;
        else { TermicaFill.Visibility = Visibility.Visible; TermicaFill.Data = Arco(TermicaStartClock, TermicaSweepTotal * prog); }
        _termFillBrush!.Color = cor;
        _termTempBrush!.Color = cor;
        _termEstadoBrush!.Color = cor;
        _termGlowBrush!.GradientStops[0].Color = Color.FromArgb(0x2E, cor.R, cor.G, cor.B);

        // Número da temperatura (só reescreve quando o inteiro muda).
        var ti = (int)Math.Round(est.TempC ?? 0);
        if (ti != _termicaTempShown)
        {
            _termicaTempShown = ti;
            TermicaTemp.Inlines.Clear();
            TermicaTemp.Inlines.Add(new Run { Text = ti.ToString(), FontSize = 138 });
            TermicaTemp.Inlines.Add(new Run { Text = "°", FontSize = 60 });
        }

        // Palavra de estado.
        var word = modo == ModoTelaTermica.Aquecimento
            ? (prog >= 1 ? "PRONTO" : "AQUECENDO")
            : (prog >= 1 ? "IDEAL" : "ESFRIANDO");
        if (word != _termicaEstadoShown) { _termicaEstadoShown = word; TermicaEstado.Text = word; }

        if (modo != _termicaModoShown) { _termicaModoShown = modo; PopularPainel(modo); }
    }

    // Painel de dados à direita. Real: nº de voltas do stint, parada no box, voltas completas.
    // Placeholder (tag "cérebro", borda dourada): alvo histórico, sua melhor do stint, média,
    // vs-alvo — vêm do cérebro/nuvem (iMac); NÃO inventar número na tela do piloto.
    private void PopularPainel(ModoTelaTermica modo)
    {
        // 2.6 — quando o plano REAL do dia ainda não veio da nuvem, o STINT/PARADA sai do
        // PlanoStintPlaceholder (11 voltas / box na v6 = número inventado). Marca esses tiles
        // com o mecanismo que já existe (tag "cérebro" + borda dourada) pra NÃO apresentar
        // placeholder como dado real na tela do piloto. Mesma decisão da barra fica como está.
        var placeholderPlano = _planoStintReal is null;
        var plano = _planoStintReal ?? PlanoStintPlaceholder;
        var total = 0; var boxIdx = -1;
        for (var i = 0; i < plano.Length; i++)
        {
            if (plano[i] == StintBlockState.Pending) continue;
            total++;
            if (boxIdx < 0 && plano[i] == StintBlockState.Box) boxIdx = i;
        }

        if (modo == ModoTelaTermica.Aquecimento)
        {
            // ALVO = melhor volta HISTÓRICA (armazém local; "—" se ainda não há recorde).
            TermicaHlbl.Text = "ALVO · MELHOR VOLTA";
            var (ab, asm) = FormatarTempo(MelhorVoltaMs());
            SetValor(TermicaHval, ab, asm, TermBranco, 118, 62);

            SetTile(1, "STINT", TotalInlines(total, "voltas"), TermBranco, placeholder: placeholderPlano, mostra: true);
            if (boxIdx >= 0)
                SetTile(2, "PARADA", TotalInlines("BOX", "v" + (boxIdx + 1)), TermMagenta, placeholder: placeholderPlano, mostra: true);
            else
                SetTile(2, "", null, TermBranco, placeholder: false, mostra: false);
            SetTile(3, "", null, TermBranco, placeholder: false, mostra: false);
        }
        else // Resfriamento
        {
            // SUA MELHOR DO STINT = melhor volta DESTA sessão; vs ALVO = quanto vs o recorde
            // histórico (cor = qualidade, SEM sinal); MÉDIA = média das voltas da sessão.
            TermicaHlbl.Text = "SUA MELHOR DO STINT";
            var (sb, ssm) = FormatarTempo(SessaoMelhorMs());
            SetValor(TermicaHval, sb, ssm, TermVerde, 118, 62);

            var sessao = SessaoMelhorMs(); var alvo = MelhorVoltaMs();
            if (sessao is { } s && alvo is { } a)
            {
                var diff = (Math.Abs(s - a) / 1000.0).ToString("0.0", System.Globalization.CultureInfo.InvariantCulture).Replace('.', ',');
                SetTile(1, "VS ALVO", TotalInlines(diff, "s"), s <= a + 1 ? TermVerde : TermVermelho, placeholder: false, mostra: true);
            }
            else SetTile(1, "VS ALVO", TotalInlines("—", ""), TermBranco, placeholder: false, mostra: true);

            SetTile(2, "MÉDIA", FormatarTempo(SessaoMediaMs()), TermBranco, placeholder: false, mostra: true);
            var feitas = Math.Max(0, _voltaAtualIdx);
            SetTile(3, "VOLTAS", TotalInlines(feitas.ToString(), "/" + total), TermBranco, placeholder: false, mostra: true);
        }
    }

    // ── helpers de texto / tiles ──────────────────────────────────────

    private void EnsureTermicaBrushes()
    {
        if (_termicaBrushesProntos) return;
        _termicaBrushesProntos = true;
        _termFillBrush   = new SolidColorBrush(TermVerde);
        _termTempBrush   = new SolidColorBrush(TermVerde);
        _termEstadoBrush = new SolidColorBrush(TermVerde);
        TermicaFill.Stroke      = _termFillBrush;
        TermicaTemp.Foreground  = _termTempBrush;
        TermicaEstado.Foreground = _termEstadoBrush;

        _termGlowBrush = new RadialGradientBrush
        {
            Center = new Point(0.28, 0.48), GradientOrigin = new Point(0.28, 0.48),
            RadiusX = 0.55, RadiusY = 0.7,
        };
        _termGlowBrush.GradientStops.Add(new GradientStop { Color = Color.FromArgb(0x2E, 0x37, 0xE3, 0xA4), Offset = 0.0 });
        _termGlowBrush.GradientStops.Add(new GradientStop { Color = Color.FromArgb(0x00, 0x37, 0xE3, 0xA4), Offset = 0.62 });
        TermicaGlow.Fill = _termGlowBrush;
    }

    // Valor grande com uma parte menor (ex.: "1:22" + ".10"), cor e tamanhos dados.
    private static void SetValor(TextBlock tb, string big, string small, Color cor, double szBig, double szSmall)
    {
        tb.Inlines.Clear();
        tb.Foreground = new SolidColorBrush(cor);
        tb.Inlines.Add(new Run { Text = big, FontSize = szBig });
        if (!string.IsNullOrEmpty(small))
            tb.Inlines.Add(new Run { Text = small, FontSize = szSmall, Foreground = new SolidColorBrush(TermSlate) });
    }

    // Constrói (texto grande, sufixo pequeno) pra um tile — devolve o par pra SetTile aplicar.
    private static (string big, string small) TotalInlines(int big, string small) => (big.ToString(), " " + small);
    private static (string big, string small) TotalInlines(string big, string small) => (big, " " + small);

    private void SetTile(int idx, string label, (string big, string small)? val, Color cor, bool placeholder, bool mostra)
    {
        var (tile, lbl, value, tag) = idx switch
        {
            1 => (Tile1, Lbl1, Val1, Tag1),
            2 => (Tile2, Lbl2, Val2, Tag2),
            _ => (Tile3, Lbl3, Val3, Tag3),
        };
        tile.Visibility = mostra ? Visibility.Visible : Visibility.Collapsed;
        if (!mostra) return;

        lbl.Text = label;
        value.Inlines.Clear();
        value.Foreground = new SolidColorBrush(cor);
        if (val is { } v)
        {
            value.Inlines.Add(new Run { Text = v.big, FontSize = 62 });
            value.Inlines.Add(new Run { Text = v.small, FontSize = 22, Foreground = new SolidColorBrush(TermSlate) });
        }
        tag.Visibility = placeholder ? Visibility.Visible : Visibility.Collapsed;
        tile.BorderBrush = new SolidColorBrush(placeholder ? TermOuro : Color.FromArgb(0x14, 0xFF, 0xFF, 0xFF));
    }

    // ── geometria + cor ───────────────────────────────────────────────

    private static Point PontoAnel(double clockDeg)
    {
        var a = clockDeg * Math.PI / 180.0;
        return new Point(TermicaCx + TermicaR * Math.Sin(a), TermicaCy - TermicaR * Math.Cos(a));
    }

    private static PathGeometry Arco(double startClock, double sweepDeg)
    {
        var p0 = PontoAnel(startClock);
        var p1 = PontoAnel(startClock + sweepDeg);
        var fig = new PathFigure { StartPoint = p0, IsClosed = false };
        fig.Segments.Add(new ArcSegment
        {
            Point = p1,
            Size = new Size(TermicaR, TermicaR),
            SweepDirection = SweepDirection.Clockwise,
            IsLargeArc = sweepDeg > 180,
        });
        var g = new PathGeometry();
        g.Figures.Add(fig);
        return g;
    }

    // HSL → Color (h em graus, s/l em 0..1). Vermelho(h=0) → verde(h≈152).
    private static Color HslToColor(double h, double s, double l)
    {
        h = ((h % 360) + 360) % 360;
        double c = (1 - Math.Abs(2 * l - 1)) * s;
        double x = c * (1 - Math.Abs((h / 60.0) % 2 - 1));
        double m = l - c / 2;
        double r = 0, g = 0, b = 0;
        if (h < 60)       { r = c; g = x; }
        else if (h < 120) { r = x; g = c; }
        else if (h < 180) { g = c; b = x; }
        else if (h < 240) { g = x; b = c; }
        else if (h < 300) { r = x; b = c; }
        else              { r = c; b = x; }
        return Color.FromArgb(0xFF,
            (byte)Math.Round((r + m) * 255),
            (byte)Math.Round((g + m) * 255),
            (byte)Math.Round((b + m) * 255));
    }
}
