// MainWindow.Aprendizado.cs — Fase 2: PERSISTÊNCIA em disco do aprendizado de
// temperatura (a "história gravada" — princípio 2 da spec, doc docs/FASE2_IA_TEMPERATURA.md).
//
// O domínio (AprendizadoTemperatura) já aprende a máxima normal do carro a cada
// amostra viva; o CockpitOrchestrator expõe Exportar/ImportarAprendizado. Falta só
// a CASA DO ARQUIVO — que mora aqui, na camada do app (o iMac não compila WinUI).
//
// Regra: a "memória do que é normal" é POR CARRO. Arquivo:
//   ~/p1fast-sessoes/aprendizado-<carroId>.json
// (mesma pasta das sessões; carroId = --carro-id ou Bubi, igual à barra de voltas.)
//
// Quando grava: SÓ no modo AO VIVO (dado real do carro). O --replay é andaime de
// teste (roda a mesma sessão N vezes em 3-8×) — deixá-lo escrever CORROMPERIA a
// máxima normal real do carro. Por isso o replay não salva (e nem carrega — parte
// sempre da semente, pra a prova visual ser determinística).
//   • carregar: no IniciarLive, logo após criar o maestro.
//   • salvar:  no StopLive (fechamento da janela).

using System;
using System.IO;
using System.Text.Json;
using P1Fast.Cockpit.Domain;

namespace P1Fast.Cockpit.UI;

public sealed partial class MainWindow
{
    // Caminho do arquivo de aprendizado do carro ativo (memória entre sessões).
    private string AprendizadoPath()
    {
        var pasta = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "p1fast-sessoes");
        var carroId = string.IsNullOrWhiteSpace(_options.CarroId)
            ? PlanoStintReader.CarroIdBubi
            : _options.CarroId!;
        // sanea o id pra virar nome de arquivo (evita separador de caminho no id).
        foreach (var c in Path.GetInvalidFileNameChars()) carroId = carroId.Replace(c, '_');
        return Path.Combine(pasta, $"aprendizado-{carroId}.json");
    }

    // Restaura a máxima normal aprendida em sessões anteriores (best-effort TOTAL:
    // arquivo ausente/corrompido = começa da semente, nunca derruba a tela).
    private void CarregarAprendizado()
    {
        try
        {
            var caminho = AprendizadoPath();
            if (!File.Exists(caminho)) return;
            var snap = JsonSerializer.Deserialize<AprendizadoSnapshot>(File.ReadAllText(caminho));
            if (snap is not null)
            {
                _orquestrador?.ImportarAprendizado(snap);
                StatusText.Text = $"aprendizado restaurado: normal ≈ {_orquestrador?.MotorMaximaNormalC:0.#}°C";
            }
        }
        catch { /* sem memória: parte da semente (62°C do Bubi) */ }
    }

    // Grava a máxima normal aprendida nesta sessão pra sobreviver ao fechamento.
    // Best-effort: falha de IO no fechamento nunca trava a janela.
    private void SalvarAprendizado()
    {
        try
        {
            if (_orquestrador is null) return;
            var caminho = AprendizadoPath();
            Directory.CreateDirectory(Path.GetDirectoryName(caminho)!);
            var snap = _orquestrador.ExportarAprendizado();
            // Atômico (tmp+fsync+rename): queda de energia no fechamento não trunca o snapshot
            // — o carro não "esquece" a máxima normal aprendida por um meio-arquivo corrompido.
            EscritaAtomica.WriteAllText(caminho, JsonSerializer.Serialize(snap));
        }
        catch { /* best-effort */ }
    }
}
