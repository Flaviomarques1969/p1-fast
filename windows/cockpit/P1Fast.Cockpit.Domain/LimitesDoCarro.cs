// ═══════════════════════════════════════════════════════════
// LimitesDoCarro — ponte entre o "Setup do Carro" (app) e o cérebro
// ═══════════════════════════════════════════════════════════
// Etapa 3 da tela Garagem (Flávio 05/07, item 4 da Fase 2). O app salva os limites de alerta
// de CADA carro no JSON `configuracoes.overrides` (chaves `alerta_*`, ver CarroSetupOverrides.swift),
// que já sincroniza celular↔nuvem. Aqui o cockpit (notebook) converte esse JSON nos limites que
// a inteligência usa — AlertaLimites + AprendizadoLimites — aplicando o valor do carro sobre o
// DEFAULT do sistema quando a chave vem ausente/nula/vazia. Best-effort total: JSON inválido ou
// ausente → tudo default, nunca derruba a tela.

using System.Collections.Generic;
using System.Text.Json;

namespace P1Fast.Cockpit.Domain;

public static class LimitesDoCarro
{
    /// <summary>
    /// Monta (AlertaLimites, AprendizadoLimites) a partir do JSON `configuracoes.overrides` do carro.
    /// Chave ausente = usa o default do sistema. As chaves espelham CarroSetupOverrides.swift (app iOS).
    /// </summary>
    public static (AlertaLimites Alertas, AprendizadoLimites Aprendizado) De(string? overridesJson)
    {
        var v = ParseNumeros(overridesJson);
        double? G(string chave) => v.TryGetValue(chave, out var x) ? x : (double?)null;

        // --- Limites diretos (motor quente, mistura, bateria) ---
        var defAl = AlertaLimites.Default;
        var alertas = defAl with
        {
            WaterMaxC   = G("alerta_motor_quente_c") ?? defAl.WaterMaxC,
            LambdaPobre = G("alerta_lambda_pobre")   ?? defAl.LambdaPobre,
            LambdaRica  = G("alerta_lambda_rica")    ?? defAl.LambdaRica,
            BatteryMinV = G("alerta_bateria_min_v")  ?? defAl.BatteryMinV,
        };

        // --- Aprendizado (motor referência/delta) + limiares de pneu por tipo ---
        var defAp = AprendizadoLimites.Default;
        var motor = defAp.Motor with
        {
            ReferenciaMaximaNormalC = G("alerta_motor_referencia_c") ?? defAp.Motor.ReferenciaMaximaNormalC,
            DeltaSubindoC           = G("alerta_motor_delta_c")      ?? defAp.Motor.DeltaSubindoC,
        };
        var aprendizado = defAp with
        {
            Motor = motor,
            PneuRadial185AtencaoC    = G("alerta_pneu_radial_atencao_c") ?? defAp.PneuRadial185AtencaoC,
            PneuRadial185CriticoC    = G("alerta_pneu_radial_critico_c") ?? defAp.PneuRadial185CriticoC,
            PneuSemiSlick195AtencaoC = G("alerta_pneu_slick_atencao_c")  ?? defAp.PneuSemiSlick195AtencaoC,
            PneuSemiSlick195CriticoC = G("alerta_pneu_slick_critico_c")  ?? defAp.PneuSemiSlick195CriticoC,
        };

        // Nota: o TetoAprendidoC do Motor acompanha WaterMaxC no construtor do AlertasCriticos
        // (apr.Motor with { TetoAprendidoC = _limits.WaterMaxC }) — não precisa setar aqui.
        return (alertas, aprendizado);
    }

    /// <summary>Extrai só os campos NUMÉRICOS do JSON de overrides (ignora texto/nulo). Best-effort:
    /// JSON ausente/inválido → dicionário vazio (o chamador cai nos defaults).</summary>
    private static Dictionary<string, double> ParseNumeros(string? json)
    {
        var dict = new Dictionary<string, double>();
        if (string.IsNullOrWhiteSpace(json)) return dict;
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.ValueKind != JsonValueKind.Object) return dict;
            foreach (var prop in doc.RootElement.EnumerateObject())
                if (prop.Value.ValueKind == JsonValueKind.Number && prop.Value.TryGetDouble(out var num))
                    dict[prop.Name] = num;
        }
        catch (JsonException) { /* JSON malformado → defaults */ }
        return dict;
    }
}
