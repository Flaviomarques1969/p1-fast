// TrocaPlanoStint — o CÉREBRO puro de "QUANDO o plano novo entra na barra de voltas".
// Sem rede, sem UI, sem relógio próprio: a UI relê a nuvem a cada ~15 s e pergunta aqui.
//
// O dia de pista tem VÁRIOS stints e o chefe planeja cada um no celular ANTES de sair
// (Flávio 2026-10-29). Até aqui o .exe lia o plano UMA vez (ao abrir o ao vivo) e o contador
// de voltas nunca zerava — do 2º stint em diante a barra mostrava o plano velho e a volta
// atual passava do fim. Regras:
//   • Cada envelope novo da nuvem é um stint novo (chave = created_at do envelope).
//   • Mesma chave = nada muda. Leitura vazia (rede caiu, sem plano do dia) = mantém o que está.
//   • Carro PARADO (gravador fora de uma ida à pista) → aplica o plano e zera as voltas.
//   • Carro NA PISTA e o plano é DESTA ida (criado até JanelaSaida depois de ela começar — o
//     celular aprova na saída e a leitura chega uns segundos depois) → aplica e zera já.
//   • Carro na pista e o plano é de DEPOIS (o próximo stint, planejado com o carro rodando) →
//     fica PENDENTE e entra quando o carro parar. Chegou outro mais novo antes? O mais novo vence.
// Limite conhecido: se o carro parar no box no MEIO do stint com um plano pendente, ele entra
// nessa parada. Zerar no meio da ida (leitura atrasada) recomeça na volta 1, como na abertura.

using System.Globalization;

namespace P1Fast.Cockpit.Domain;

/// <summary>O que a UI faz agora: trocar a barra pelo Plano e, se ZerarVoltas, recomeçar a
/// contagem de voltas na 1ª (stint novo).</summary>
public sealed record DecisaoTroca(PlanoStint Plano, bool ZerarVoltas);

public sealed class TrocaPlanoStint
{
    /// <summary>Até quanto tempo depois do início da ida um plano ainda é "desta ida" (cobre a
    /// leitura de 15 s atrasada e o relógio do notebook alguns minutos fora do da nuvem).</summary>
    public static readonly TimeSpan JanelaSaida = TimeSpan.FromMinutes(3);

    private string? _chaveAtual;
    private PlanoStint? _pendente;

    /// <summary>Chave do plano que está na barra (null = nenhum ainda, barra padrão).</summary>
    public string? ChaveAtual => _chaveAtual;

    /// <summary>Plano novo esperando o carro parar (null = nenhum).</summary>
    public PlanoStint? Pendente => _pendente;

    /// <summary>Identidade do stint: created_at do envelope; sem ele, aprovadoEm; sem os dois,
    /// a forma do plano (voltas + paradas).</summary>
    public static string Chave(PlanoStint p)
        => p.EnvelopeCriadoEm
           ?? p.AprovadoEm
           ?? $"v{p.Voltas}|p{string.Join(",", p.Paradas.Select(x => x.Volta))}";

    /// <summary>Uma leitura. `lido` = o que a nuvem devolveu agora (null = nada utilizável);
    /// `carroNaPista` = o gravador está numa ida à pista; `inicioIdaUtc` = quando essa ida
    /// começou (null se parado). Devolve o que fazer, ou null = nada muda. Nunca lança.</summary>
    public DecisaoTroca? Avaliar(PlanoStint? lido, bool carroNaPista, DateTimeOffset? inicioIdaUtc = null)
    {
        if (lido is not null)
        {
            var chave = Chave(lido);
            if (chave == _chaveAtual) _pendente = null;   // o da barra voltou a ser o último: nada pendente
            else if (_pendente is null || Chave(_pendente) != chave) _pendente = lido;   // o mais novo vence
        }

        if (_pendente is null) return null;
        if (carroNaPista && !DestaIda(_pendente, inicioIdaUtc)) return null;   // espera o carro parar

        var plano = _pendente;
        _pendente = null;
        _chaveAtual = Chave(plano);
        return new DecisaoTroca(plano, ZerarVoltas: true);
    }

    private static bool DestaIda(PlanoStint plano, DateTimeOffset? inicioIdaUtc)
    {
        if (inicioIdaUtc is not { } inicio) return false;
        var criado = Instante(plano.EnvelopeCriadoEm) ?? Instante(plano.AprovadoEm);
        return criado is { } c && c <= inicio + JanelaSaida;
    }

    private static DateTimeOffset? Instante(string? iso)
        => !string.IsNullOrWhiteSpace(iso)
           && DateTimeOffset.TryParse(iso, CultureInfo.InvariantCulture,
                  DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out var t)
            ? t
            : null;
}
