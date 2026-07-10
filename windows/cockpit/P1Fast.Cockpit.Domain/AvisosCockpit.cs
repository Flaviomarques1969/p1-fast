// AvisosCockpit — lógica PURA da linha de status do cockpit (rodapé pequeno, dev/operador).
// Extraída do code-behind pra ter teste de regressão (JANELA 2 — honestidade da tela).
//
// Duas responsabilidades, ambas sem UI/IO:
//  1) ComporStatus: junta as REGIÕES persistentes (alarme de gravação, aviso de flags,
//     rótulo do canal de nuvem) com as efêmeras (status vivo do motor/GPS, diagnóstico
//     trecho/shift/Δ) numa string só — pra que o diagnóstico a 10-25 Hz NUNCA apague o
//     rótulo do canal nem o alarme de gravação (bug 2.3). Ordem = prioridade decrescente.
//  2) AvisoFlags: detecta combinação conflitante de flags de lançamento (precedência
//     Demo > Replay > Live > TelaTermica) e --producao sem efeito (bug 2.7). NÃO muda a
//     precedência — só descreve o que foi engolido, pra virar aviso persistente na tela.

using System.Collections.Generic;

namespace P1Fast.Cockpit.Domain;

/// <summary>Composição pura da linha de status + diagnóstico de flags (zero UI).</summary>
public static class AvisosCockpit
{
    /// <summary>Separador visual entre as regiões da linha de status.</summary>
    public const string Sep = "  ·  ";

    /// <summary>
    /// Junta as regiões numa linha só, na ordem de prioridade (mais importante primeiro):
    /// alarme de gravação → aviso de flags → PISTA (mapeamento honesto) → rótulo do canal →
    /// status vivo → diagnóstico. Vazias/nulas são puladas; tudo vazio → "—". Assim o diagnóstico
    /// rápido não clobbera o canal/alarme (eles são compostos SEMPRE, não sobrescritos).
    /// <paramref name="pista"/> é opcional (nova região da honestidade do mapeamento de pista nova)
    /// e vem por último na assinatura pra não quebrar quem já chama com 5 argumentos; a ORDEM de
    /// exibição é controlada aqui, não pela posição do parâmetro.
    /// </summary>
    public static string ComporStatus(
        string? alarme, string? aviso, string? canal, string? vivo, string? diag, string? pista = null)
    {
        var partes = new List<string>(6);
        void Add(string? s) { if (!string.IsNullOrWhiteSpace(s)) partes.Add(s!); }
        Add(alarme);
        Add(aviso);
        Add(pista);   // honestidade do mapeamento de pista nova — logo após os avisos de flags
        Add(canal);
        Add(vivo);
        Add(diag);
        return partes.Count == 0 ? "—" : string.Join(Sep, partes);
    }

    /// <summary>
    /// Aviso persistente sobre flags conflitantes de lançamento, ou null se não há conflito.
    /// Precedência real (App.OnLaunched): Demo &gt; Replay &gt; Live &gt; TelaTermica. Se mais de
    /// um modo primário vier, os demais são ignorados em silêncio — aqui viramos texto. E
    /// --producao só tem efeito com --live; em qualquer outro modo é ignorado.
    /// </summary>
    public static string? AvisoFlags(bool demo, bool replay, bool live, bool telaTermica, bool producao)
    {
        var modos = (demo ? 1 : 0) + (replay ? 1 : 0) + (live ? 1 : 0) + (telaTermica ? 1 : 0);
        string? vencedor =
            demo ? "--demo" :
            replay ? "--replay" :
            live ? "--live" :
            telaTermica ? "--tela-termica" : null;

        var avisos = new List<string>(2);
        if (modos > 1)
            avisos.Add($"FLAGS EM CONFLITO — vale {vencedor}; as demais foram ignoradas");
        if (producao && vencedor != "--live")
            avisos.Add("--producao IGNORADO (só tem efeito com --live)");

        return avisos.Count == 0 ? null : string.Join("; ", avisos);
    }
}
