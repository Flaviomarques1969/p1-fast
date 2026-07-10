// PistaCoordenador — a COMPOSIÇÃO do mapeamento automático de pista desconhecida (Fases A e D do
// desenho .claude-exec/DESENHO-MAPEAMENTO-PISTA-2026-07-10.md, aprovado Flávio 2026-07-10).
//
// Junta as três peças já prontas e auditadas:
//   MapeadorPista  — acha o fecho da volta (linha de chegada aprendida) e fecha VoltaMapeada.
//   CortadorTrechos — a partir das voltas fechadas, corta a pista em TrechoSegmento e CONGELA.
//   PistaStore     — persiste a pista aprendida (linha + caixa + trechos) local, entre dias (D2).
//
// A única saída pra fora é um ESTADO pra tela (ProgressoPista) + os TrechoSegmento aprendidos,
// entregues por um evento (SegmentosProntos) quando a pista CONGELA (aprendida agora) ou quando
// AcharPorPosicao reconhece uma pista já aprendida noutro dia (carrega direto — D2).
//
// REGRA DURA (contrato da obra): dentro da caixa geográfica de Brasília (PistaBrasilia) o
// coordenador fica INERTE — Brasília é hardcoded e VENCE, zero mudança de comportamento. Fora
// dela, e só fora dela, o coordenador aprende.
//
// Domain PURO exceto o uso do IPistaStore injetado (o IO vive só no store, como o RecordesStore).
// Sem relógio interno: o tempo (tWallMs) vem de fora, como no MapeadorPista.

namespace P1Fast.Cockpit.Domain;

/// <summary>Estado do mapeamento pra dirigir o aviso HONESTO da tela (região de status).</summary>
public enum EstadoTelaPista
{
    /// <summary>Dentro da caixa de Brasília — o coordenador não age (Brasília hardcoded vence).</summary>
    Inerte,
    /// <summary>Fora de Brasília, ainda reconhecendo o circuito (linha não confirmada).</summary>
    Reconhecendo,
    /// <summary>Linha confirmada, mapeando volta a volta (ainda sem trechos congelados).</summary>
    Mapeando,
    /// <summary>Trechos congelados — a pista foi mapeada nesta sessão.</summary>
    Mapeada,
    /// <summary>Pista já aprendida noutro dia, carregada direto do disco (D2).</summary>
    PistaConhecida,
}

/// <summary>O que a tela precisa saber a cada fix: estado + volta atual + nº de trechos + id da pista.</summary>
public sealed record ProgressoPista(EstadoTelaPista Estado, int Volta, int Trechos, string? PistaId);

/// <summary>
/// Compõe MapeadorPista + CortadorTrechos + IPistaStore no caminho vivo. Alimente com
/// <see cref="Ingest"/> (um fix já aprovado por qualidade e JÁ FORA da caixa de Brasília — o
/// coordenador ainda checa a caixa por segurança). Ouça <see cref="SegmentosProntos"/> pra
/// receber os trechos aprendidos (congelou) ou reconhecidos (pista conhecida). Uma instância
/// por sessão.
/// </summary>
public sealed class PistaCoordenador
{
    private readonly IPistaStore _store;
    private readonly MapeadorPista _mapeador = new();
    private readonly CortadorTrechos _cortador = new();

    private bool _boot;                    // já checou o disco no 1º fix bom?
    private bool _conhecidaDoDisco;        // pista carregada por AcharPorPosicao (D2)
    private bool _congelou;                // trechos aprendidos e congelados nesta sessão
    private bool _salvou;                  // pista já persistida no store
    private int _voltasProcessadas;        // quantas VoltaMapeada já foram ao cortador
    private PistaAprendida? _pistaCongelada;

    /// <summary>Trechos aprendidos/carregados (null enquanto não há). MESMO tipo que o
    /// TrechoDetector já consome — muda a ORIGEM dos segmentos, não o detector.</summary>
    public IReadOnlyList<TrechoSegmento>? Segmentos { get; private set; }

    /// <summary>Id ESTÁVEL da pista (derivado da caixa aprendida, ou o id da pista conhecida).
    /// Setado assim que a linha confirma (a caixa já cobriu o circuito) e reusado no congelamento
    /// — não recalcula, pra o id da persistência e dos recordes ficar estável.</summary>
    public string? PistaId { get; private set; }

    /// <summary>Trechos já congelados/carregados?</summary>
    public bool Congelada => Segmentos is not null;

    /// <summary>Voltas plausíveis fechadas pelo mapeador (passthrough, pra recordes de volta).</summary>
    public int VoltasFechadas => _mapeador.VoltasFechadas;

    /// <summary>As voltas fechadas (trilha + período) — passthrough do mapeador.</summary>
    public IReadOnlyList<VoltaMapeada> Voltas => _mapeador.Voltas;

    /// <summary>Disparado quando os TrechoSegmento ficam PRONTOS: ao CONGELAR (aprendida agora) ou
    /// ao reconhecer uma pista já aprendida (D2). Dispara no thread que chama <see cref="Ingest"/>
    /// — a fiação re-enfileira na thread da UI antes de tocar o orquestrador.</summary>
    public event Action<IReadOnlyList<TrechoSegmento>>? SegmentosProntos;

    public PistaCoordenador(IPistaStore store)
        => _store = store ?? throw new ArgumentNullException(nameof(store));

    /// <summary>Ingere um fix. Dentro da caixa de Brasília não faz nada (Inerte). Fora dela,
    /// no 1º fix bom tenta reconhecer uma pista já salva (D2); senão mapeia — alimenta o mapeador
    /// e, a cada volta fechada, o cortador, congelando quando o cortador estabiliza.</summary>
    public ProgressoPista Ingest(PontoGps p, double kmh, double? headingDeg, long tWallMs)
    {
        // REGRA DURA: dentro de Brasília o coordenador é INERTE (Brasília hardcoded vence).
        if (DentroDeBrasilia(p)) return new ProgressoPista(EstadoTelaPista.Inerte, 0, 0, null);

        // 1º fix bom fora de Brasília: a pista já foi aprendida noutro dia? (D2)
        if (!_boot)
        {
            _boot = true;
            var conhecida = _store.AcharPorPosicao(p);
            if (conhecida is { Segmentos.Count: > 0 })
            {
                _conhecidaDoDisco = true;
                _congelou = true;
                _salvou = true;                 // veio do disco: nada a re-salvar
                Segmentos = conhecida.Segmentos;
                PistaId = conhecida.PistaId;
                SegmentosProntos?.Invoke(conhecida.Segmentos);
                return Progresso();
            }
        }

        if (_conhecidaDoDisco) return Progresso();   // pista conhecida: só exibe, nada a mapear

        // Mapeia: alimenta o mapeador com o fix (a decimação por movimento é interna a ele).
        _mapeador.Ingest(p, kmh, headingDeg, tWallMs);

        // Assim que a linha confirma, fixa o id da pista (a caixa já cobriu o circuito). Só uma vez.
        if (PistaId is null && _mapeador.Estado == MapeamentoEstado.LinhaConfirmada)
            PistaId = DerivarIdDaCaixa();

        // Alimenta o cortador com as voltas recém-fechadas; congela quando ele estabiliza (D1).
        if (!_congelou)
        {
            var voltas = _mapeador.Voltas;
            while (_voltasProcessadas < voltas.Count)
            {
                var segs = _cortador.Ingest(voltas[_voltasProcessadas]);
                _voltasProcessadas++;
                if (segs is { Count: > 0 }) { Congelar(segs); break; }
            }
        }

        return Progresso();
    }

    /// <summary>StopLive (item 5): se congelou mas ainda não salvou (queda/corrida entre congelar e
    /// fechar), salva agora — best-effort, nunca lança.</summary>
    public void TentarSalvarPendente()
    {
        if (_congelou && !_salvou) Salvar();
    }

    // ── internos ────────────────────────────────────────────────────

    private void Congelar(IReadOnlyList<TrechoSegmento> segs)
    {
        _congelou = true;
        Segmentos = segs;
        PistaId ??= DerivarIdDaCaixa();

        // Monta a pista aprendida (linha + caixa + trechos) e persiste (D2). A linha existe:
        // congelar exige 2 voltas fechadas, que exigem a linha confirmada.
        if (_mapeador.Linha is { } linha)
        {
            var (latMin, latMax, lonMin, lonMax) = _mapeador.Caixa;
            _pistaCongelada = new PistaAprendida(
                Versao: 1, PistaId!, linha, latMin, latMax, lonMin, lonMax, segs);
            Salvar();
        }

        SegmentosProntos?.Invoke(segs);
    }

    private void Salvar()
    {
        if (_pistaCongelada is null || _salvou) return;
        try { _store.Salvar(_pistaCongelada); _salvou = true; }
        catch { /* best-effort: TentarSalvarPendente/StopLive tenta de novo */ }
    }

    private string DerivarIdDaCaixa()
    {
        var (latMin, latMax, lonMin, lonMax) = _mapeador.Caixa;
        return PistaStore.DerivarId(latMin, latMax, lonMin, lonMax);
    }

    private ProgressoPista Progresso()
    {
        if (_conhecidaDoDisco)
            return new ProgressoPista(EstadoTelaPista.PistaConhecida, 0, Segmentos?.Count ?? 0, PistaId);
        if (_congelou)
            return new ProgressoPista(EstadoTelaPista.Mapeada, _mapeador.VoltasFechadas, Segmentos?.Count ?? 0, PistaId);
        if (_mapeador.Estado == MapeamentoEstado.LinhaConfirmada)
            return new ProgressoPista(EstadoTelaPista.Mapeando, _mapeador.VoltasFechadas, 0, PistaId);
        return new ProgressoPista(EstadoTelaPista.Reconhecendo, 0, 0, null);
    }

    private static bool DentroDeBrasilia(PontoGps p)
        => p.Lat >= PistaBrasilia.LatMin && p.Lat <= PistaBrasilia.LatMax
        && p.Lng >= PistaBrasilia.LonMin && p.Lng <= PistaBrasilia.LonMax;
}
