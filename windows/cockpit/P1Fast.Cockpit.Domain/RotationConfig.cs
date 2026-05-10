using System.Text.Json;

namespace P1Fast.Cockpit.Domain;

/// <summary>
/// Lógica pura de persistência da rotação 0°/180° por display do cockpit
/// (ADR-023 amendment 6). Separada do <c>MainWindow</c> pra ser testável
/// sem dependência WinUI/Win32. I/O fica nos wrappers que chamam estes
/// métodos.
///
/// Chave do dicionário JSON:
///   - índice 1-based do display (ex: "2") quando rodando fullscreen num display escolhido;
///   - "default" quando rodando janelado (sem --display-index OU fallback porque o display escolhido sumiu).
/// </summary>
public static class RotationConfig
{
    public const double RotationNone = 0.0;
    public const double Rotation180  = 180.0;
    public const string DefaultKey   = "default";

    /// <summary>Resolve a chave do JSON pro display informado.</summary>
    public static string KeyFor(int? displayIndex) =>
        displayIndex?.ToString() ?? DefaultKey;

    /// <summary>
    /// Lê o ângulo persistido pro display. JSON ausente/inválido ou chave
    /// inexistente → <see cref="RotationNone"/> (silencioso por design — a
    /// próxima persistência reescreve sem perder dado de outros displays).
    /// </summary>
    public static double LoadAngleFromJson(string? json, int? displayIndex)
    {
        var dict = TryParse(json);
        return dict.TryGetValue(KeyFor(displayIndex), out var angle) ? angle : RotationNone;
    }

    /// <summary>
    /// Atualiza só a chave do display alvo, preservando ângulos dos outros
    /// displays. JSON ausente/inválido vira dict vazio.
    /// </summary>
    public static string SaveAngleToJson(string? existingJson, int? displayIndex, double angle)
    {
        var dict = TryParse(existingJson);
        dict[KeyFor(displayIndex)] = (int)System.Math.Round(angle);
        return JsonSerializer.Serialize(dict);
    }

    private static Dictionary<string, int> TryParse(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new Dictionary<string, int>();
        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, int>>(json)
                   ?? new Dictionary<string, int>();
        }
        catch (JsonException)
        {
            return new Dictionary<string, int>();
        }
    }
}
