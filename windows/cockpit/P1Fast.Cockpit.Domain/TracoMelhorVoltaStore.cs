// TracoMelhorVoltaStore — o traço da melhor volta (a régua do delta ao vivo do cartão do centro,
// Flávio 2026-10-30) gravado À PARTE do armazém de recordes: ~2.000 pontos por volta não cabem bem no
// recordes.json, que é reescrito a cada recorde de curva. Um arquivo por chave do armazém (o carro em
// Brasília, carro@pista na pista nova): ~/p1fast-sessoes/<chave>-melhorvolta-traco.json, gravação
// atômica (EscritaAtomica). Ao abrir, o maestro só usa o traço se o tempo bate com melhorvolta.tempo —
// um arquivo de volta antiga (a melhor nova veio sem traço válido) fica no disco e é recusado.
//
// Tolerante: ausente/ilegível = sem traço (o cartão cai no delta por fim de curva). Replay = em memória.

using System.Text.Json;

namespace P1Fast.Cockpit.Domain;

public interface ITracoMelhorVoltaStore
{
    TracoVolta? Carregar(string chave);
    void Salvar(string chave, TracoVolta traco);
}

/// <summary>Replay: não lê o traço do carro nem grava por cima dele (mesma regra do MemoriaRecordesStore).</summary>
public sealed class MemoriaTracoMelhorVoltaStore : ITracoMelhorVoltaStore
{
    public TracoVolta? Carregar(string chave) => null;
    public void Salvar(string chave, TracoVolta traco) { /* replay não persiste — de propósito */ }
}

public sealed class FileTracoMelhorVoltaStore : ITracoMelhorVoltaStore
{
    private readonly string _dir;
    private readonly object _trava = new();   // a UI grava fora da thread da tela

    public FileTracoMelhorVoltaStore(string? dir = null)
    {
        _dir = dir ?? Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "p1fast-sessoes");
        Directory.CreateDirectory(_dir);
    }

    public string Caminho(string chave) => Path.Combine(_dir, FileRecordesStore.SanearCarro(chave) + "-melhorvolta-traco.json");

    // Pontos como [lat, lng, ms, m] — 4 números por ponto, sem nome de campo repetido 2.000 vezes.
    private sealed class Arquivo
    {
        public double TempoMs { get; set; }
        public double[][]? Pontos { get; set; }
    }

    public TracoVolta? Carregar(string chave)
    {
        try
        {
            var caminho = Caminho(chave);
            if (!File.Exists(caminho)) return null;
            var arq = JsonSerializer.Deserialize<Arquivo>(File.ReadAllText(caminho));
            if (arq?.Pontos is null || arq.Pontos.Any(p => p is null || p.Length != 4)) return null;
            return new TracoVolta(arq.TempoMs, arq.Pontos.Select(p => new PontoTraco(p[0], p[1], p[2], p[3])).ToList());
        }
        catch { return null; /* ausente/corrompido → sem traço (nunca derruba o cockpit) */ }
    }

    public void Salvar(string chave, TracoVolta traco)
    {
        ArgumentNullException.ThrowIfNull(traco);
        var arq = new Arquivo
        {
            TempoMs = traco.TempoMs,
            Pontos = traco.Pontos.Select(p => new[]
                { Math.Round(p.Lat, 7), Math.Round(p.Lng, 7), Math.Round(p.Ms, 1), Math.Round(p.M, 2) }).ToArray(),
        };
        var json = JsonSerializer.Serialize(arq);
        lock (_trava) EscritaAtomica.WriteAllText(Caminho(chave), json);
    }
}
