// MainWindow.Recordes.cs — cola entre o cérebro/telas e o ARMAZÉM de recordes LOCAL do notebook
// (Flávio 2026-07-06). Tudo que é daqui é guardado aqui, 100% local, SEM nuvem — separado da
// função de publicar os dados pro app (essa segue intacta e paralela).
//
// A UI é quem conhece os metadados (sessão/pista/relógio) e faz o I/O (o Domain é puro):
//   - escuta CockpitOrchestrator.PassagemFechada → tenta bater cada recorde de trecho (um dado cada);
//   - calcula o tempo de VOLTA no cruzamento da linha (replay e live) → tenta bater a melhor volta;
//   - quando um recorde é superado, persiste na hora (arquivo atômico à prova de queda);
//   - alimenta a tela térmica (alvo/melhor do stint/vs-alvo/média) com dado REAL — nada de placeholder.

using System;
using System.Collections.Generic;
using System.Linq;
using P1Fast.Cockpit.Domain;

namespace P1Fast.Cockpit.UI;

public sealed partial class MainWindow
{
    private const string PistaRec = "Brasilia";
    private bool _modoReplay;   // item 3.1: true no --replay (armazém em memória, nada persiste)
    private IRecordesStore? _recordesStore;
    private ArmazemRecordes? _recordes;
    private readonly List<double> _sessaoLapsMs = new();
    private string _sessaoIdRec = "";

    private string CarroIdRec => string.IsNullOrWhiteSpace(_options.CarroId) ? "bubi" : _options.CarroId!;

    // Chamado em IniciarFeedReal (replay e live): carrega o armazém 1x, zera a sessão, assina o evento.
    // Item 3.1: no REPLAY o armazém é EM MEMÓRIA — não carrega os recordes reais do carro nem grava por
    // cima deles (o replay é andaime de teste; corromperia o armazém permanente). A tela ainda exibe os
    // recordes DA SESSÃO replayada (o ArmazemRecordes vive em memória durante o replay). Espelha os
    // gêmeos (MainWindow.Aprendizado.cs / MainWindow.LuzMarcha.cs): replay não salva nem carrega.
    private void InicializarRecordes()
    {
        if (_recordesStore is null)
        {
            _recordesStore = _modoReplay ? new MemoriaRecordesStore() : (IRecordesStore)new FileRecordesStore();
            try { _recordes = _recordesStore.Carregar(CarroIdRec); }
            catch { _recordes = new ArmazemRecordes { CarroId = CarroIdRec }; }
        }
        SemearRecordesNoCerebro();   // item 3.6: dá ao cérebro o recorde ABSOLUTO por trecho (Recorde x Melhor Stint)
        _sessaoLapsMs.Clear();
        _sessaoIdRec = "sessao-" + DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        _lapsRegistradosReplay = 0;
        _ultimoCruzTickLive = 0;
        if (_orquestrador is not null) _orquestrador.PassagemFechada += OnPassagemFechada;
    }

    // Semeia no cérebro o recorde ABSOLUTO (histórico) de cada trecho, em segundos, a partir do
    // armazém local. Sem isto o coach só conhecia o melhor da sessão e a frase "Melhor Stint" era
    // código morto (item 3.6). No replay o armazém vem vazio → nada a semear (comportamento de antes).
    private void SemearRecordesNoCerebro()
    {
        if (_recordes is null || _orquestrador is null) return;
        var sufixo = "." + ArmazemRecordes.MetTempo;   // ".tempo"
        foreach (var (chave, valor) in _recordes.Itens)
            if (chave.EndsWith(sufixo, StringComparison.Ordinal))
                _orquestrador.SemearRecordeTrecho(chave[..^sufixo.Length], valor.Valor);
    }

    private MetadadosRecorde MetaAgora()
        => new(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), _sessaoIdRec, PistaRec, CarroIdRec, ConfigPneus: "");

    // Cada passagem por um trecho: um dado cada (tempo/Vmin/entrada/ápice/saída), independentes.
    private void OnPassagemFechada(DadosPassagem d)
    {
        if (_recordes is null) return;
        if (_recordes.AplicarPassagem(d, MetaAgora())) SalvarRecordes();
    }

    // Uma VOLTA completa (ms): entra na média da sessão e tenta bater a melhor volta histórica.
    // Item 3.2: volta abaixo do piso de plausibilidade (trecho box→linha / ruído) NÃO é volta — não
    // entra na média da sessão NEM vira recorde (contaminaria o alvo da térmica pra sempre).
    private void RegistrarVoltaCompleta(double tempoMs)
    {
        if (_recordes is null || double.IsNaN(tempoMs) || double.IsInfinity(tempoMs)) return;
        if (tempoMs < ArmazemRecordes.VoltaMinimaPlausivelMs) return;   // implausível: descarta
        _sessaoLapsMs.Add(tempoMs);
        if (_recordes.AplicarVolta(tempoMs, MetaAgora())) SalvarRecordes();
    }

    private void SalvarRecordes()
    {
        if (_recordesStore is null || _recordes is null) return;
        try { _recordesStore.Salvar(_recordes); }
        catch { /* recorde nunca derruba o cockpit; próxima superação tenta de novo */ }
    }

    // ── leituras pra tela térmica (dado REAL local) ───────────────────
    private double? MelhorVoltaMs()   => _recordes?.Obter(ArmazemRecordes.ChaveVolta)?.Valor;
    private double? SessaoMelhorMs()  => _sessaoLapsMs.Count > 0 ? _sessaoLapsMs.Min() : null;
    private double? SessaoMediaMs()   => _sessaoLapsMs.Count > 0 ? _sessaoLapsMs.Average() : null;

    // m:ss.cc → (parte grande "m:ss", parte pequena ".cc"). null → ("—", "").
    private static (string big, string small) FormatarTempo(double? ms)
    {
        if (ms is not { } v || v <= 0) return ("—", "");
        var total = (long)Math.Round(v);
        var min = total / 60000; var rem = total % 60000;
        var seg = rem / 1000; var cs = (rem % 1000) / 10;
        return ($"{min}:{seg:00}", $".{cs:00}");
    }
}
