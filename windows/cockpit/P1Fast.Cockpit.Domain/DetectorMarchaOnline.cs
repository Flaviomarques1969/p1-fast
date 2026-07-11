// DetectorMarchaOnline — identifica a marcha atual pela razão rpm/velocidade, sem sensor de
// câmbio (o USB/T3000 não fornece a marcha). Porte fiel de web/cockpit/gear-detector-online.js
// (decisão Flávio + auditor 2026-05-29: o sistema descobre as marchas sozinho — a razão
// rpm÷km/h é CONSTANTE por marcha; 1ª tem razão grande, 5ª pequena).
//
// A entrada é o par (giro do motor, velocidade do RaceBox a 25 Hz). Só agrupa amostras
// ESTÁVEIS (giro quase constante, carro andando) — descarta patinação, freada e troca em curso.
// Puro: sem I/O, sem relógio (o instante monotônico vem de fora, em segundos).

namespace P1Fast.Cockpit.Domain;

/// <summary>Assinatura observada de uma marcha: razão média rpm/kmh + faixa de giro.</summary>
public sealed class MarchaAssinatura
{
    public double RatioMedia;
    public int Amostras;
    public double RpmMin;
    public double RpmMax;
    /// <summary>Identidade ABSOLUTA da marcha (bucket log da razão na descoberta) — ver
    /// <see cref="DetectorMarchaOnline.AncoraDaRazao"/>. Não muda com a ordem de descoberta.</summary>
    public int Ancora;
}

public sealed class DetectorMarchaOnline
{
    private const int MinAmostrasValida  = 3;    // pares consecutivos estáveis
    private const double VariacaoRpmMaxS = 50;   // rpm/s — acima disso é aceleração brusca (não estável)
    private const double VariacaoKmhMin  = 5;    // km/h — abaixo é parado/box
    private const double EstabilidadeJanelaS = 0.3;
    // Passo do bucket da ÂNCORA (12% em escala log). Marchas vizinhas de um câmbio distam
    // ≥15% na razão (ln 1,15 ÷ ln 1,12 ≈ 1,23 bucket) — duas marchas NUNCA dividem o mesmo
    // bucket; e a deriva do EMA da razão (tolerância de classificação = 8%) cabe dentro dele.
    private const double PassoAncora = 1.12;

    private readonly int _numMarchas;
    private readonly List<MarchaAssinatura> _marchas = new();
    private readonly List<(double Rpm, double Kmh, double Ts)> _buffer = new();
    private int? _marchaAtual;
    private double _confianca;

    public DetectorMarchaOnline(int numMarchas = 5) { _numMarchas = numMarchas; }

    /// <summary>Marcha atual estimada (1..N) ou null se ainda não dá pra afirmar.
    /// ATENÇÃO: rótulo POSICIONAL, relativo ao que foi descoberto — pode migrar de marcha
    /// física entre (e até dentro de) sessões. Serve pra exibição/telemetria; pra KEAR
    /// aprendizado use <see cref="MarchaAncoraAtual"/> (decisão Flávio 2026-07-11).</summary>
    public int? MarchaAtual => _marchaAtual;

    /// <summary>Identidade ABSOLUTA da marcha atual (bucket log da razão giro÷km/h), ou null.
    /// Invariante à ordem de descoberta: a mesma marcha física dá a mesma âncora em qualquer
    /// sessão — é a chave certa pra perfis persistidos (reação por marcha, Onda 7).</summary>
    public int? MarchaAncoraAtual => _marchaAtual is { } m ? _marchas[m - 1].Ancora : null;

    /// <summary>Bucket log da razão giro÷km/h (grade de 12%): a identidade física da marcha.</summary>
    public static int AncoraDaRazao(double razao)
        => (int)Math.Round(Math.Log(razao) / Math.Log(PassoAncora));
    /// <summary>Confiança 0..1 da detecção atual (amostras da marcha / 30).</summary>
    public double Confianca => _confianca;
    /// <summary>Quantas assinaturas de marcha já foram descobertas.</summary>
    public int MarchasDescobertas => _marchas.Count;

    private bool Estavel()
    {
        if (_buffer.Count < MinAmostrasValida) return false;
        var last = _buffer[^1]; var first = _buffer[0];
        var dt = last.Ts - first.Ts;
        if (dt < EstabilidadeJanelaS) return false;
        if (last.Kmh < VariacaoKmhMin) return false;
        var dRpm = Math.Abs(last.Rpm - first.Rpm) / Math.Max(0.1, dt);
        return dRpm <= VariacaoRpmMaxS;
    }

    // Marcha cuja razão média mais casa (dentro de 8%) com a observada, ou null.
    private int? Classificar(double razao)
    {
        int? melhor = null; var menorDist = double.PositiveInfinity;
        for (var i = 0; i < _marchas.Count; i++)
        {
            var m = _marchas[i];
            var dist = Math.Abs(m.RatioMedia - razao);
            var tol = m.RatioMedia * 0.08;
            if (dist < tol && dist < menorDist) { menorDist = dist; melhor = i + 1; }
        }
        return melhor;
    }

    /// <summary>Ingere um par (giro, velocidade) no instante ts (s). Atualiza a marcha atual.</summary>
    public void Ingest(double rpm, double kmh, double ts)
    {
        if (!double.IsFinite(rpm) || !double.IsFinite(kmh) || !double.IsFinite(ts)) return;
        if (rpm < 1000 || kmh < VariacaoKmhMin) { _buffer.Clear(); return; } // parado/box: zera a janela
        _buffer.Add((rpm, kmh, ts));
        if (_buffer.Count > 20) _buffer.RemoveAt(0);
        if (!Estavel()) return;

        var razao = rpm / kmh;
        var idx = Classificar(razao);
        if (idx is null)
        {
            if (_marchas.Count < _numMarchas)
            {
                _marchas.Add(new MarchaAssinatura { RatioMedia = razao, Amostras = 1, RpmMin = rpm, RpmMax = rpm,
                                                    Ancora = AncoraDaRazao(razao) });
                _marchas.Sort((a, b) => b.RatioMedia.CompareTo(a.RatioMedia)); // 1ª razão maior → Nª menor
            }
            idx = Classificar(razao);
        }
        else
        {
            var m = _marchas[idx.Value - 1];
            m.RatioMedia = m.RatioMedia * 0.95 + razao * 0.05; // média móvel — estável mas adapta
            m.Amostras += 1;
            if (rpm < m.RpmMin) m.RpmMin = rpm;
            if (rpm > m.RpmMax) m.RpmMax = rpm;
        }

        if (idx is { } gi)
        {
            _marchaAtual = gi;
            _confianca = Math.Min(1, _marchas[gi - 1].Amostras / 30.0);
        }
    }

    /// <summary>Zera o detector (reinício de sessão / troca de configuração do câmbio).</summary>
    public void Reset()
    {
        _marchas.Clear();
        _buffer.Clear();
        _marchaAtual = null;
        _confianca = 0;
    }
}
