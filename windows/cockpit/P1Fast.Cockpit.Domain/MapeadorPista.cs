// MapeadorPista — Fase B do mapeamento de pista desconhecida: DESCOBRIR o fecho da volta.
//
// Numa pista nova (fora da caixa hardcoded de Brasília) o cockpit não sabe onde a volta fecha.
// Este cérebro puro recebe o GPS decimado e aprende SOZINHO a linha de chegada:
//   1. RASTREANDO   — guarda a trilha decimada (~3 m) e procura o RE-CRUZAMENTO da própria trilha
//                     (passar a < 15 m de um ponto já visitado, no MESMO rumo ±30°, longe o bastante
//                     na trilha pra não ser ruído nem uma curva colada) — o fecho do circuito.
//   2. LinhaCandidata — no fecho, ancora a linha no ponto mais RÁPIDO da volta (a reta principal,
//                     mesma semântica da linha real de Brasília), perpendicular ao rumo, ~40 m.
//   3. LinhaConfirmada — depois de 2 períodos de volta consistentes (±10%); daí cada cruzamento
//                     fecha uma VoltaMapeada (piso de plausibilidade: volta < 40 s NÃO conta — D3, Bubi).
//
// Robustez (lições da auditoria): GPS que emudece no meio (gap grande de tWall) DESCARTA a volta
// corrente — não costura o buraco; o ruído de ±3 m não gera fecho falso porque só comparamos com
// pontos "antigos" o suficiente na trilha (o carro anda > 15 m entre pontos decimados vizinhos).
//
// Domain PURO: sem relógio interno nem IO — o tempo (tWallMs) vem de fora. A fiação (UI, filtro,
// orquestrador) é a Fase 2, de outra janela; aqui nada de produção. Contratos em MapeamentoPista.cs.

namespace P1Fast.Cockpit.Domain;

/// <summary>
/// Aprende a linha de chegada de uma pista desconhecida a partir do GPS decimado. Alimente com
/// <see cref="Ingest"/> (um fix já aprovado por qualidade — a decimação por movimento é interna);
/// leia <see cref="Estado"/>, <see cref="Linha"/>, <see cref="VoltasFechadas"/>, <see cref="Voltas"/>
/// e <see cref="Caixa"/>. Uma instância por sessão/pista.
/// </summary>
public sealed class MapeadorPista
{
    /// <summary>Espaçamento mínimo entre pontos guardados (m) — mesma ideia do <see cref="GpsFiltroAoVivo.MovimentoMinM"/>.</summary>
    public const double DecimacaoMinM = 3;
    /// <summary>Raio (m) pra considerar que o carro RE-CRUZOU um ponto já visitado.</summary>
    public const double RecruzamentoRaioM = 15;
    /// <summary>Tolerância de rumo (graus) no re-cruzamento — mesmo sentido, não a mão contrária.</summary>
    public const double RecruzamentoHeadingTolDeg = 30;
    /// <summary>Distância mínima ao longo da trilha (m) entre o ponto atual e o "antigo" comparado.
    /// Garante que o fecho é uma VOLTA de verdade (não o vizinho da mesma passada nem uma curva
    /// colada), e que o jitter de ±3 m nunca dispara re-cruzamento falso.</summary>
    public const double LoopMinimoM = 200;
    /// <summary>Largura da linha de chegada aprendida (m) — mesma ordem da linha real de Brasília.</summary>
    public const double LarguraLinhaM = 40;
    /// <summary>Piso de plausibilidade da volta (s): abaixo disto NÃO conta (D3, calibrado pro Bubi).</summary>
    public const double VoltaMinimaPlausivelS = 40;
    /// <summary>Tolerância de consistência entre dois períodos pra CONFIRMAR a linha (±10%).</summary>
    public const double PeriodoTolFrac = 0.10;
    /// <summary>Acima disto (ms) o GPS emudeceu (dropout): descarta a volta corrente, não costura.</summary>
    public const double GapMaxMs = 2000;
    /// <summary>Margem (m) somada à caixa observada (min/max) pra virar a caixa aprendida da pista.</summary>
    public const double MargemCaixaM = 200;

    private const double MPerDegLat = 111_132.0;
    private const double MPerDegLonEq = 111_320.0;

    /// <summary>Um ponto decimado da trilha, com rumo e tempo (uso interno).</summary>
    private sealed record Ponto(PontoGps P, double Kmh, double DistM, double HeadingDeg, long TWallMs);

    private MapeamentoEstado _estado = MapeamentoEstado.Rastreando;
    private LinhaAprendida? _linha;
    private readonly List<VoltaMapeada> _voltas = new();
    private int _voltasFechadas;

    // Fase RASTREANDO: trilha corrida pra achar o fecho.
    private readonly List<Ponto> _trilha = new();
    private double _distTrilha;

    // Fase COM LINHA: volta corrente (entre dois cruzamentos) + cronometragem.
    private List<AmostraTrilha> _voltaAtual = new();
    private double _distVolta;
    private double? _ladoLinha;
    private long? _tUltimoCruzamento;
    private double? _periodoAnterior;
    private bool _voltaCorrenteValida = true;

    // Comum: último ponto decimado (decimação/rumo/segmento) + último tWall (gap).
    private Ponto? _ultimo;
    private long? _ultimoTWall;

    // Caixa geográfica observada (antes da margem).
    private double _latMin, _latMax, _lonMin, _lonMax;
    private bool _temCaixa;

    /// <summary>Estado atual do mapeamento (dirige o aviso honesto da tela).</summary>
    public MapeamentoEstado Estado => _estado;
    /// <summary>Linha de chegada aprendida (null enquanto não há candidata).</summary>
    public LinhaAprendida? Linha => _linha;
    /// <summary>Quantas voltas plausíveis já fecharam pela linha aprendida.</summary>
    public int VoltasFechadas => _voltasFechadas;
    /// <summary>As voltas fechadas (trilha + período) — entrada do CortadorTrechos.</summary>
    public IReadOnlyList<VoltaMapeada> Voltas => _voltas;

    /// <summary>Caixa geográfica aprendida = min/max observados + margem (~200 m). Antes do 1º
    /// fix devolve tudo zero.</summary>
    public (double LatMin, double LatMax, double LonMin, double LonMax) Caixa
    {
        get
        {
            if (!_temCaixa) return (0, 0, 0, 0);
            double mLat = MargemCaixaM / MPerDegLat;
            double latMed = (_latMin + _latMax) / 2.0;
            double mLon = MargemCaixaM / (MPerDegLonEq * Math.Cos(latMed * Math.PI / 180.0));
            return (_latMin - mLat, _latMax + mLat, _lonMin - mLon, _lonMax + mLon);
        }
    }

    /// <summary>
    /// Alimenta o mapeador com um fix (já aprovado por qualidade). A decimação por movimento é
    /// interna: fixes a menos de <see cref="DecimacaoMinM"/> do último guardado são ignorados.
    /// Devolve o estado resultante.
    /// </summary>
    public MapeamentoEstado Ingest(PontoGps p, double kmh, double? headingDeg, long tWallMs)
    {
        AtualizarCaixa(p);

        // Gap de GPS: os fixes pararam de chegar (não é carro parado — isso vem decimado).
        if (_ultimoTWall is { } ult && tWallMs - ult > GapMaxMs) AoDetectarGap();
        _ultimoTWall = tWallMs;

        // Decimação ~3 m.
        if (_ultimo is { } u && Ghost.DistMeters(u.P, p) < DecimacaoMinM) return _estado;

        // Rumo: usa o do pacote quando vem; senão o rumo por 2 posições (como o TrechoDetector).
        double heading = headingDeg is { } h && !double.IsNaN(h)
            ? ((h % 360) + 360) % 360
            : (_ultimo is { } upH ? Ghost.BearingDeg(upH.P, p) : 0);
        double passoM = _ultimo is { } upD ? Ghost.DistMeters(upD.P, p) : 0;

        if (_estado == MapeamentoEstado.Rastreando)
        {
            _distTrilha += passoM;
            ProcessarRastreando(new Ponto(p, kmh, _distTrilha, heading, tWallMs));
        }
        else
        {
            ProcessarComLinha(p, kmh, passoM, tWallMs);
        }

        _ultimo = new Ponto(p, kmh, 0, heading, tWallMs);
        return _estado;
    }

    // ── Fase RASTREANDO: achar o fecho da volta ─────────────────────

    private void ProcessarRastreando(Ponto novo)
    {
        // Procura o ponto "antigo" (longe o bastante na trilha) mais PRÓXIMO no espaço, no mesmo
        // rumo. Como a trilha está em DistM crescente, quando o vão cai abaixo de LoopMinimoM todos
        // os seguintes são ainda mais recentes → para de olhar.
        int idxFecho = -1;
        double melhor = RecruzamentoRaioM;
        for (int i = 0; i < _trilha.Count; i++)
        {
            var velho = _trilha[i];
            if (novo.DistM - velho.DistM < LoopMinimoM) break;
            double d = Ghost.DistMeters(velho.P, novo.P);
            if (d <= melhor && DiffAnguloDeg(velho.HeadingDeg, novo.HeadingDeg) <= RecruzamentoHeadingTolDeg)
            {
                melhor = d;
                idxFecho = i;
            }
        }

        _trilha.Add(novo);
        if (idxFecho >= 0) AprenderLinha(idxFecho);
    }

    private void AprenderLinha(int idxInicioLoop)
    {
        // Âncora = ponto mais RÁPIDO do laço (idxInicioLoop..fim) — a reta principal.
        int idxAncora = idxInicioLoop;
        for (int i = idxInicioLoop; i < _trilha.Count; i++)
            if (_trilha[i].Kmh > _trilha[idxAncora].Kmh) idxAncora = i;
        var ancora = _trilha[idxAncora];

        _linha = LinhaPerpendicular(ancora.P, ancora.HeadingDeg, LarguraLinhaM);
        _estado = MapeamentoEstado.LinhaCandidata;

        // Semeia o 1º "cruzamento": o carro passou pela âncora em ancora.TWallMs na volta 1.
        _tUltimoCruzamento = ancora.TWallMs;
        _periodoAnterior = null;
        _voltaCorrenteValida = true;

        // Semeia a volta corrente com o trecho âncora→fecho (o "F→fecho" da volta 1); assim a 1ª
        // volta fechada cobre a passada completa F→F.
        _voltaAtual = new List<AmostraTrilha>();
        double d0 = ancora.DistM;
        for (int i = idxAncora; i < _trilha.Count; i++)
            _voltaAtual.Add(new AmostraTrilha(_trilha[i].P, _trilha[i].Kmh, _trilha[i].DistM - d0));
        _distVolta = _voltaAtual.Count > 0 ? _voltaAtual[^1].DistM : 0;

        _ladoLinha = null;   // o próximo ponto define o lado; sem cruzamento fantasma no fecho.
        _trilha.Clear();     // fecho achado — a detecção de laço encerra.
        _distTrilha = 0;
    }

    // ── Fase COM LINHA: cronometrar e fechar voltas ─────────────────

    private void ProcessarComLinha(PontoGps p, double kmh, double passoM, long tWallMs)
    {
        bool cruzou = false;
        if (_linha is { } linha)
        {
            double lado = TrechoDetector.SideOfLine(p, linha.A, linha.B);
            if (_ladoLinha is { } ladoAnt
                && Math.Sign(lado) != Math.Sign(ladoAnt)
                && _ultimo is { } up
                && TrechoDetector.CaminhoCruzaLinha(up.P, p, linha.A, linha.B))
                cruzou = true;
            _ladoLinha = lado;
        }

        if (cruzou)
        {
            AoCruzarLinha(tWallMs);
            // O ponto do cruzamento inicia a nova volta.
            _distVolta = 0;
            _voltaAtual.Add(new AmostraTrilha(p, kmh, 0));
        }
        else
        {
            _distVolta += passoM;
            _voltaAtual.Add(new AmostraTrilha(p, kmh, _distVolta));
        }
    }

    private void AoCruzarLinha(long tWallMs)
    {
        if (_tUltimoCruzamento is { } tAnt && _voltaCorrenteValida)
        {
            double periodoS = (tWallMs - tAnt) / 1000.0;
            if (periodoS >= VoltaMinimaPlausivelS)
            {
                _voltas.Add(new VoltaMapeada(_voltaAtual, periodoS));
                _voltasFechadas++;

                // 2 períodos consistentes (±10%) confirmam a linha.
                if (_estado == MapeamentoEstado.LinhaCandidata
                    && _periodoAnterior is { } pAnt
                    && Math.Abs(periodoS - pAnt) <= PeriodoTolFrac * Math.Max(periodoS, pAnt))
                    _estado = MapeamentoEstado.LinhaConfirmada;

                _periodoAnterior = periodoS;
            }
            // periodoS < piso: volta implausível — descartada (não conta, não confirma); só avança
            // a referência de tempo (abaixo), pra não somar dois pedaços numa volta falsa.
        }

        _tUltimoCruzamento = tWallMs;
        _voltaCorrenteValida = true;
        _voltaAtual = new List<AmostraTrilha>();
        _distVolta = 0;
    }

    // ── Gap de GPS: não costurar o buraco ───────────────────────────

    private void AoDetectarGap()
    {
        _ultimo = null;   // recomeça limpo: sem passo/segmento atravessando o buraco.
        if (_estado == MapeamentoEstado.Rastreando)
        {
            _trilha.Clear();
            _distTrilha = 0;
        }
        else
        {
            // Descarta a volta corrente: o cruzamento após o gap NÃO fecha volta — só reinicia.
            _voltaCorrenteValida = false;
            _voltaAtual = new List<AmostraTrilha>();
            _distVolta = 0;
            _ladoLinha = null;
        }
    }

    // ── Geometria e utilidades ──────────────────────────────────────

    private void AtualizarCaixa(PontoGps p)
    {
        if (!_temCaixa)
        {
            _latMin = _latMax = p.Lat;
            _lonMin = _lonMax = p.Lng;
            _temCaixa = true;
            return;
        }
        _latMin = Math.Min(_latMin, p.Lat);
        _latMax = Math.Max(_latMax, p.Lat);
        _lonMin = Math.Min(_lonMin, p.Lng);
        _lonMax = Math.Max(_lonMax, p.Lng);
    }

    /// <summary>Diferença angular absoluta (0..180°) entre dois rumos.</summary>
    private static double DiffAnguloDeg(double a, double b)
    {
        double d = Math.Abs(a - b) % 360;
        return d > 180 ? 360 - d : d;
    }

    /// <summary>Segmento perpendicular ao rumo, de largura <paramref name="larguraM"/>, centrado
    /// em <paramref name="centro"/> (mesma semântica da linha real: cruzar A–B = fronteira de volta).</summary>
    private static LinhaAprendida LinhaPerpendicular(PontoGps centro, double headingDeg, double larguraM)
    {
        double meia = larguraM / 2.0;
        return new LinhaAprendida(
            OffsetMetros(centro, (headingDeg + 90) % 360, meia),
            OffsetMetros(centro, (headingDeg + 270) % 360, meia));
    }

    /// <summary>Desloca um ponto por <paramref name="distM"/> metros no rumo <paramref name="bearingDeg"/>.</summary>
    private static PontoGps OffsetMetros(PontoGps p, double bearingDeg, double distM)
    {
        double br = bearingDeg * Math.PI / 180.0;
        double dLat = (distM * Math.Cos(br)) / MPerDegLat;
        double dLng = (distM * Math.Sin(br)) / (MPerDegLonEq * Math.Cos(p.Lat * Math.PI / 180.0));
        return new PontoGps(p.Lat + dLat, p.Lng + dLng);
    }
}
