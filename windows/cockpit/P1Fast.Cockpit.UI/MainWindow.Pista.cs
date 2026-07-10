// MainWindow.Pista.cs — FIAÇÃO do mapeamento automático de PISTA DESCONHECIDA (JANELA PISTA-C).
//
// Fora da caixa de Brasília o GpsFiltroAoVivo reprova todo fix e o cérebro fica cego em silêncio.
// Aqui os fixes BONS (fix 3D, hacc<50) mas FORA de Brasília passam a alimentar o PistaCoordenador,
// que compõe MapeadorPista + CortadorTrechos + PistaStore e aprende a pista sozinho, volta a volta.
//
// Fronteira dura (Brasília hardcoded VENCE): o coordenador é INERTE dentro da caixa de Brasília
// (ele mesmo checa) e a fiação SÓ o alimenta com fixes fora dela. O detector de Brasília, carregado
// no boot, nunca é substituído lá — o AplicarSegmentosAprendidos só é acionado FORA de Brasília,
// quando o coordenador CONGELA os trechos (ou reconhece uma pista já aprendida, D2).
//
// Honestidade: enquanto mapeia, a tela diz "PISTA NOVA — reconhecendo/mapeando" na região de status
// (_statusPista); NENHUM delta/ápice é inventado — sem segmentos injetados, o orquestrador não recebe
// GPS nesta pista (o filtro de Brasília reprova), então não emite nada. Só depois de congelar/
// carregar, os fixes passam a alimentar o orquestrador (pelo filtro da pista) e delta/bolinha ligam.

using P1Fast.Cockpit.Domain;

namespace P1Fast.Cockpit.UI;

public sealed partial class MainWindow
{
    private IPistaStore? _pistaStore;
    private PistaCoordenador? _pistaCoordenador;
    private bool _pistaSegmentosAplicados;      // trechos aprendidos já injetados no orquestrador?
    private int _voltasRegistradasPista;        // voltas da pista nova já enviadas aos recordes

    // Filtro de GPS DEDICADO à pista aprendida: reusa a decimação/kmh provados do GpsFiltroAoVivo
    // (AceitarValido, que NÃO checa a caixa de Brasília — a qualidade já foi conferida aqui). Instância
    // à parte pra não misturar estado com o filtro de Brasília (_gpsFiltro).
    private readonly GpsFiltroAoVivo _gpsFiltroPista = new();

    private Microsoft.UI.Dispatching.DispatcherQueueTimer? _pistaLimparTimer;

    // Liga o coordenador de pista nova (só no --live; o replay é Brasília e nem chega aqui). Best-effort:
    // sem store, segue sem mapeamento (o cockpit de Brasília não é afetado).
    private void InicializarPistaCoordenador()
    {
        try
        {
            _pistaStore ??= new PistaStore();
            _pistaCoordenador = new PistaCoordenador(_pistaStore);
            _pistaSegmentosAplicados = false;
            _voltasRegistradasPista = 0;
            // SegmentosProntos: congelou ou reconheceu uma pista conhecida — entrega os trechos ao
            // orquestrador NA THREAD DA UI (TryEnqueue garante isso mesmo se o evento vier de outra).
            _pistaCoordenador.SegmentosProntos += segs =>
                DispatcherQueue.TryEnqueue(() => AplicarSegmentosAprendidosNaUI(segs));
        }
        catch { _pistaCoordenador = null; /* sem mapeamento; Brasília intocada */ }
    }

    // Chamado no OnLiveGps (thread da UI) pra CADA fix bom fora da caixa de Brasília. Alimenta o
    // coordenador, atualiza o aviso honesto da tela, keia os recordes pela pista e, quando os trechos
    // já entraram, alimenta o orquestrador pelo filtro da pista (delta/bolinha ligam sozinhos).
    private void ProcessarFixPistaNova(double lat, double lng, double kmh, double? heading, long tWall,
        double? ax, double? ay, double? az)
    {
        if (_pistaCoordenador is null) return;

        var prog = _pistaCoordenador.Ingest(new PontoGps(lat, lng), kmh, heading, tWall);
        AplicarStatusPista(prog);

        // Assim que a linha confirma, o coordenador fixa o PistaId → passa a keiar os recordes por
        // essa pista (Brasília fica intacta, arquivo à parte). Só troca uma vez.
        if (_pistaCoordenador.PistaId is { } pid) TrocarPistaRecordes(pid);

        // Melhor VOLTA da pista nova: só depois da linha confirmada (item 4). O mapeador já aplicou o
        // piso de plausibilidade (>40 s, D3); registra os períodos das voltas recém-fechadas.
        if (prog.Estado is EstadoTelaPista.Mapeando or EstadoTelaPista.Mapeada)
        {
            var fechadas = _pistaCoordenador.VoltasFechadas;
            for (var i = _voltasRegistradasPista; i < fechadas && i < _pistaCoordenador.Voltas.Count; i++)
                RegistrarVoltaCompleta(_pistaCoordenador.Voltas[i].PeriodoS * 1000.0);
            _voltasRegistradasPista = Math.Max(_voltasRegistradasPista, fechadas);
        }

        // Trechos já injetados → alimenta o orquestrador com este fix (decimação/kmh reusados do
        // filtro provado, SEM a caixa de Brasília — a qualidade já foi conferida no OnLiveGps).
        if (_pistaSegmentosAplicados)
        {
            var amostra = _gpsFiltroPista.AceitarValido(new PontoGps(lat, lng), tWall, heading, ax, ay, az);
            if (amostra is not null)
            {
                _orquestrador?.IngestGps(amostra);
                AtualizarStint();
            }
        }
    }

    // Entrega os trechos aprendidos/carregados ao orquestrador (recria o detector interno). SÓ fora de
    // Brasília (garantido pela inércia do coordenador lá) e uma vez (idempotente no orquestrador).
    private void AplicarSegmentosAprendidosNaUI(IReadOnlyList<TrechoSegmento> segs)
    {
        if (_orquestrador is null || _pistaSegmentosAplicados) return;
        if (_orquestrador.AplicarSegmentosAprendidos(segs))
        {
            _pistaSegmentosAplicados = true;
            _segsAtivos = segs;                                   // ponte do stint conhece os trechos aprendidos
            if (_pistaCoordenador?.PistaId is { } pid) TrocarPistaRecordes(pid);
        }
    }

    // Aviso HONESTO na região de status (nenhum redesenho do visual aprovado). Congelada limpa após
    // ~10 s pra não poluir; os outros estados escrevem direto (e cancelam a limpeza pendente).
    private void AplicarStatusPista(ProgressoPista prog)
    {
        var txt = prog.Estado switch
        {
            EstadoTelaPista.Reconhecendo   => "PISTA NOVA — reconhecendo o circuito",
            EstadoTelaPista.Mapeando       => $"PISTA NOVA — mapeando, volta {prog.Volta}",
            EstadoTelaPista.Mapeada        => $"PISTA NOVA — mapeada: {prog.Trechos} trechos",
            EstadoTelaPista.PistaConhecida => $"PISTA: {prog.PistaId} (aprendida)",
            _                              => "",   // Inerte (Brasília) — nunca escreve PISTA NOVA
        };

        if (txt != _statusPista)
        {
            _statusPista = txt;
            RenderStatus();
        }

        // Mapeada: agenda a limpeza (~10 s) uma vez; qualquer outro estado cancela.
        if (prog.Estado == EstadoTelaPista.Mapeada) AgendarLimpezaPista();
        else CancelarLimpezaPista();
    }

    private void AgendarLimpezaPista()
    {
        if (_pistaLimparTimer is not null) return;   // já agendado
        _pistaLimparTimer = DispatcherQueue.CreateTimer();
        _pistaLimparTimer.Interval = TimeSpan.FromSeconds(10);
        _pistaLimparTimer.IsRepeating = false;
        _pistaLimparTimer.Tick += (t, _) =>
        {
            if (_statusPista.StartsWith("PISTA NOVA — mapeada", StringComparison.Ordinal))
            {
                _statusPista = "";
                RenderStatus();
            }
            t.Stop();
            _pistaLimparTimer = null;
        };
        _pistaLimparTimer.Start();
    }

    private void CancelarLimpezaPista()
    {
        _pistaLimparTimer?.Stop();
        _pistaLimparTimer = null;
    }
}
