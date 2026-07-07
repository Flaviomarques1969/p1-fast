// RecordesStore — persistência à prova de queda do ArmazemRecordes (Flávio 2026-07-06).
//
// Um arquivo JSON por carro em ~/p1fast-sessoes/<carro>-recordes.json (mesma pasta das sessões).
// Ao contrário da telemetria (append-only .jsonl), recordes são POUCOS e ATUALIZADOS no lugar,
// então o documento inteiro é reescrito de forma ATÔMICA a cada superação: grava num .tmp,
// força o disco (fsync) e renomeia por cima (rename é atômico no NTFS) — uma queda no meio
// deixa OU o arquivo antigo intacto OU o novo completo, nunca um meio-arquivo corrompido.
//
// Tolerante: arquivo ausente/ilegível → armazém VAZIO (nunca derruba o cockpit por recorde ruim).

using System.Text.Json;

namespace P1Fast.Cockpit.Domain;

public interface IRecordesStore
{
    ArmazemRecordes Carregar(string carroId);
    void Salvar(ArmazemRecordes armazem);
}

public sealed class FileRecordesStore : IRecordesStore
{
    private static readonly JsonSerializerOptions JsonOpts = new() { WriteIndented = true };
    private readonly string _dir;

    public FileRecordesStore(string? dir = null)
    {
        _dir = dir ?? Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "p1fast-sessoes");
        Directory.CreateDirectory(_dir);
    }

    private string Caminho(string carroId) => Path.Combine(_dir, SanearCarro(carroId) + "-recordes.json");

    // carroId vem de config/CLI; evita que barra/dois-pontos virem subpasta ou caminho inválido.
    private static string SanearCarro(string carroId)
    {
        if (string.IsNullOrWhiteSpace(carroId)) return "carro";
        var limpo = new string(carroId.Select(c => char.IsLetterOrDigit(c) || c is '-' or '_' ? c : '_').ToArray());
        return limpo.Length == 0 ? "carro" : limpo;
    }

    public ArmazemRecordes Carregar(string carroId)
    {
        var caminho = Caminho(carroId);
        try
        {
            if (File.Exists(caminho))
            {
                var json = File.ReadAllText(caminho);
                var arm = JsonSerializer.Deserialize<ArmazemRecordes>(json, JsonOpts);
                if (arm is not null)
                {
                    arm.CarroId = carroId;              // a fonte da verdade do carro é quem pediu
                    arm.Itens ??= new Dictionary<string, ValorRecorde>();
                    return arm;
                }
            }
        }
        catch { /* ausente/corrompido → armazém vazio (nunca derruba o cockpit) */ }
        return new ArmazemRecordes { CarroId = carroId };
    }

    public void Salvar(ArmazemRecordes armazem)
    {
        ArgumentNullException.ThrowIfNull(armazem);
        var caminho = Caminho(armazem.CarroId);
        var tmp = caminho + ".tmp";
        var json = JsonSerializer.Serialize(armazem, JsonOpts);

        // .tmp com fsync → o conteúdo novo está inteiro no disco ANTES do rename.
        using (var fs = new FileStream(tmp, FileMode.Create, FileAccess.Write, FileShare.None))
        using (var w = new StreamWriter(fs))
        {
            w.Write(json);
            w.Flush();
            try { fs.Flush(flushToDisk: true); } catch { /* já no SO */ }
        }
        // rename atômico por cima (NTFS): nunca deixa meio-arquivo no lugar do bom.
        File.Move(tmp, caminho, overwrite: true);
    }
}
