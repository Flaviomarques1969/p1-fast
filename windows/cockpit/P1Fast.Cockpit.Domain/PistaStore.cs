// PistaStore — persistência LOCAL da pista aprendida (Fase D do mapeamento de pista desconhecida,
// desenho .claude-exec/DESENHO-MAPEAMENTO-PISTA-2026-07-10.md; D2 = a pista PERSISTE entre dias).
//
// Uma pista aprendida (linha + caixa geográfica + trechos) por arquivo em
// ~/p1fast-sessoes/pista-<id>.json — mesma pasta e MESMO padrão à prova de queda dos recordes
// (EscritaAtomica: .tmp + fsync + rename atômico). Voltou à mesma pista noutro dia → AcharPorPosicao
// devolve a pista cuja caixa contém o fix atual, e o cockpit já começa com os trechos daquela pista.
//
// Tolerante: arquivo ausente/ilegível → null (nunca derruba o cockpit por pista ruim). Domain: o IO
// vive só aqui, isolado como o RecordesStore; a pasta é injetável pra teste.

using System.Globalization;
using System.Text.Json;

namespace P1Fast.Cockpit.Domain;

public interface IPistaStore
{
    void Salvar(PistaAprendida pista);
    PistaAprendida? Carregar(string pistaId);
    PistaAprendida? AcharPorPosicao(PontoGps p);
}

public sealed class PistaStore : IPistaStore
{
    private static readonly JsonSerializerOptions JsonOpts = new() { WriteIndented = true };
    private readonly string _dir;

    public PistaStore(string? dir = null)
    {
        _dir = dir ?? Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "p1fast-sessoes");
        Directory.CreateDirectory(_dir);
    }

    /// <summary>Id ESTÁVEL derivado da caixa geográfica: "pista-" + centro lat/lon com 3 casas
    /// (sinal incluído). Mesma caixa → mesmo id (independe de dia/ordem dos limites).</summary>
    public static string DerivarId(double latMin, double latMax, double lonMin, double lonMax)
    {
        var lat = (latMin + latMax) / 2.0;
        var lon = (lonMin + lonMax) / 2.0;
        var sLat = lat.ToString("F3", CultureInfo.InvariantCulture);
        var sLon = lon.ToString("F3", CultureInfo.InvariantCulture);
        return $"pista-{sLat}_{sLon}";
    }

    // id vem da caixa aprendida; evita que ponto/sinal virem caractere inválido de caminho.
    private static string SanearId(string pistaId)
    {
        if (string.IsNullOrWhiteSpace(pistaId)) return "pista-desconhecida";
        var limpo = new string(pistaId.Select(c => char.IsLetterOrDigit(c) || c is '-' or '_' ? c : '_').ToArray());
        return limpo.Length == 0 ? "pista-desconhecida" : limpo;
    }

    private string Caminho(string pistaId) => Path.Combine(_dir, SanearId(pistaId) + ".json");

    public void Salvar(PistaAprendida pista)
    {
        ArgumentNullException.ThrowIfNull(pista);
        var json = JsonSerializer.Serialize(pista, JsonOpts);
        EscritaAtomica.WriteAllText(Caminho(pista.PistaId), json);
    }

    public PistaAprendida? Carregar(string pistaId)
    {
        var caminho = Caminho(pistaId);
        try
        {
            if (File.Exists(caminho))
            {
                var json = File.ReadAllText(caminho);
                return JsonSerializer.Deserialize<PistaAprendida>(json, JsonOpts);
            }
        }
        catch { /* ausente/corrompido → null (nunca derruba o cockpit) */ }
        return null;
    }

    /// <summary>Varre as pistas salvas e devolve a primeira cuja caixa geográfica contém o ponto
    /// (o "voltei à mesma pista"). null se nenhuma contém.</summary>
    public PistaAprendida? AcharPorPosicao(PontoGps p)
    {
        if (p is null) return null;
        string[] arquivos;
        try { arquivos = Directory.GetFiles(_dir, "pista-*.json"); }
        catch { return null; }

        foreach (var arq in arquivos)
        {
            PistaAprendida? pista = null;
            try
            {
                var json = File.ReadAllText(arq);
                pista = JsonSerializer.Deserialize<PistaAprendida>(json, JsonOpts);
            }
            catch { /* arquivo ruim → ignora, segue */ }

            if (pista is not null
                && p.Lat >= pista.LatMin && p.Lat <= pista.LatMax
                && p.Lng >= pista.LonMin && p.Lng <= pista.LonMax)
                return pista;
        }
        return null;
    }
}
