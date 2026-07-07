// MainWindow.LuzMarcha.cs — Onda 7: PERSISTÊNCIA em disco da antecipação da luz de
// marcha (o tempo de reação do piloto POR MARCHA — PilotReaction).
//
// O domínio (LuzMarchaAntecipacao) já aprende o tempo de reação a cada troca observada;
// o CockpitOrchestrator expõe Exportar/ImportarLuzMarcha. Falta só a CASA DO ARQUIVO —
// que mora aqui, na camada do app (o iMac não compila WinUI). Gêmeo do MainWindow.Aprendizado.cs.
//
// Por que persistir: a compensação só antecipa depois de ≥10 trocas daquela marcha
// (PilotReaction.MinSamples). Sem memória entre sessões, o piloto reensina do zero toda vez.
//
// Regra: a memória de reação é POR CARRO. Arquivo:
//   ~/p1fast-sessoes/luz-marcha-<carroId>.json
// (mesma pasta das sessões / do aprendizado de temperatura; carroId = --carro-id ou Bubi.)
//
// Quando grava: SÓ no modo AO VIVO (dado real do carro). O --replay é andaime de teste
// (roda a mesma sessão N vezes em 3-8×) — deixá-lo escrever CORROMPERIA a reação real do
// piloto. Por isso o replay não salva (e nem carrega — parte sempre do zero, determinístico).
//   • carregar: no IniciarLive, logo após criar o maestro.
//   • salvar:  no StopLive (fechamento da janela).

using System;
using System.IO;
using System.Text.Json;
using P1Fast.Cockpit.Domain;

namespace P1Fast.Cockpit.UI;

public sealed partial class MainWindow
{
    // Caminho do arquivo de reação da luz de marcha do carro ativo (memória entre sessões).
    private string LuzMarchaPath()
    {
        var pasta = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "p1fast-sessoes");
        var carroId = string.IsNullOrWhiteSpace(_options.CarroId)
            ? PlanoStintReader.CarroIdBubi
            : _options.CarroId!;
        // sanea o id pra virar nome de arquivo (evita separador de caminho no id).
        foreach (var c in Path.GetInvalidFileNameChars()) carroId = carroId.Replace(c, '_');
        return Path.Combine(pasta, $"luz-marcha-{carroId}.json");
    }

    // Restaura os perfis de reação aprendidos em sessões anteriores (best-effort TOTAL:
    // arquivo ausente/corrompido = começa do zero, nunca derruba a tela).
    private void CarregarLuzMarcha()
    {
        try
        {
            var caminho = LuzMarchaPath();
            if (!File.Exists(caminho)) return;
            var snap = JsonSerializer.Deserialize<PilotReactionSnapshot>(File.ReadAllText(caminho));
            if (snap is not null) _orquestrador?.ImportarLuzMarcha(snap);
        }
        catch { /* sem memória: parte do zero (reaprende ao longo da sessão) */ }
    }

    // Grava os perfis de reação aprendidos nesta sessão pra sobreviver ao fechamento.
    // Best-effort: falha de IO no fechamento nunca trava a janela.
    private void SalvarLuzMarcha()
    {
        try
        {
            if (_orquestrador is null) return;
            var caminho = LuzMarchaPath();
            Directory.CreateDirectory(Path.GetDirectoryName(caminho)!);
            var snap = _orquestrador.ExportarLuzMarcha();
            File.WriteAllText(caminho, JsonSerializer.Serialize(snap));
        }
        catch { /* best-effort */ }
    }
}
