// PilotReaction — agente de aprendizado do tempo de reação do piloto na TROCA DE MARCHA.
// Port fiel de web/cockpit/pilot-reaction.js.
//
// Modelo (do plano): a luz de marcha é ANTECIPADA pelo tempo de reação aprendido, pra o
// piloto (que reage com atraso) trocar no ponto ótimo:
//   shift_visual_rpm      = shift_optimal_rpm - reaction_compensation
//   reaction_compensation = reaction_time_ms * rpm_rise_rate / 1000
// Aprende reaction_time_ms por tupla (piloto, carro, marcha, trecho) via EMA, com fallback
// hierárquico e mínimo de amostras antes de antecipar. Em modo 'learning' não antecipa (comp=0).

using System.Globalization;

namespace P1Fast.Cockpit.Domain;

/// <summary>Evento de troca observado, base do aprendizado (campos mínimos do plano).</summary>
public sealed record ReactionEvent(
    double RpmAtShift,
    double TargetVisualRpm,
    double? RpmRiseRate = null,
    double? RpmBefore = null,
    double GearConfidence = 1.0,
    bool DataInconsistent = false,
    double? DeltaRpm = null,
    string? PilotoId = null,
    string? CarroId = null,
    int? GearAfter = null,
    string? TrechoId = null);

/// <summary>Perfil aprendido de uma tupla: tempo de reação (ms) + nº de amostras.</summary>
public sealed record PerfilReacao(string Key, double ReactionTimeMs, int SampleCount, long LastUpdated);

/// <summary>Estado persistível dos perfis de reação (a "história gravada" pra sobreviver entre sessões).</summary>
public sealed record PilotReactionSnapshot(int Versao, IReadOnlyList<PerfilReacao> Perfis);

/// <summary>Resultado da compensação: tempo de reação usado, compensação em RPM e a fonte.</summary>
public sealed record Compensacao(double RtMs, double CompensationRpm, string Source);

public sealed class PilotReaction
{
    public const double Alpha = 0.15;
    public const int MinSamples = 10;
    public const double RtMinMs = 50, RtMaxMs = 400, DefaultRtMs = 250, WindowBeforeS = 0.2;

    private readonly Dictionary<string, PerfilReacao> _profiles = new();
    public IReadOnlyDictionary<string, PerfilReacao> Profiles => _profiles;

    /// <summary>Exporta os perfis aprendidos (a "história gravada" pra persistir entre sessões).</summary>
    public PilotReactionSnapshot ExportarEstado() => new(1, _profiles.Values.ToList());

    /// <summary>Restaura perfis gravados (idempotente; ignora entradas inválidas). Chamar ao abrir a sessão.</summary>
    public void ImportarEstado(PilotReactionSnapshot? snap)
    {
        if (snap?.Perfis is null) return;
        foreach (var p in snap.Perfis)
        {
            if (p is null || string.IsNullOrEmpty(p.Key)) continue;
            if (!double.IsFinite(p.ReactionTimeMs) || p.SampleCount < 0) continue;
            _profiles[p.Key] = p;
        }
    }

    public static string TupleKey(string? pilotoId, string? carroId, int? gear, string? trechoId)
        => string.Join(':', new[]
        {
            pilotoId ?? "x",
            carroId ?? "x",
            gear is { } g ? g.ToString(CultureInfo.InvariantCulture) : "x",
            trechoId ?? "x",
        });

    /// <summary>Tempo de reação observado neste evento (ms), clampado, ou null se não dá pra inferir
    /// (dados incompletos, troca ANTES do sinal visual, ou taxa de subida inválida).</summary>
    public static double? ObservedReactionMs(ReactionEvent e)
    {
        if (e is null) return null;
        if (!double.IsFinite(e.RpmAtShift) || !double.IsFinite(e.TargetVisualRpm)) return null;
        var deltaRpm = e.RpmAtShift - e.TargetVisualRpm;
        if (deltaRpm < 0) return null; // trocou antes do sinal visual — não conta

        double? rate = e.RpmRiseRate is { } rr && double.IsFinite(rr) ? rr : null;
        if (rate is null && e.RpmBefore is { } rb && double.IsFinite(rb))
            rate = (e.RpmAtShift - rb) / WindowBeforeS;
        if (rate is not { } r || !double.IsFinite(r) || r <= 0) return null;

        var ms = deltaRpm / r * 1000.0;
        if (!double.IsFinite(ms) || ms <= 0) return null;
        return Math.Min(RtMaxMs, Math.Max(RtMinMs, ms));
    }

    /// <summary>Aprende com um evento (EMA), respeitando as regras de aceitação:
    /// gear_confidence >= 0.8, não-inconsistente, não-'early' (delta_rpm &lt; 0), rt válido.
    /// Devolve o perfil atualizado ou null se o evento foi rejeitado. Mudança de estado interna.</summary>
    public PerfilReacao? LearnFromEvent(ReactionEvent e, long? nowMs = null)
    {
        if (e is null) return null;
        if (!double.IsFinite(e.GearConfidence) || e.GearConfidence < 0.8) return null;
        if (e.DataInconsistent) return null;
        if (e.DeltaRpm is { } dr && double.IsFinite(dr) && dr < 0) return null; // early
        if (ObservedReactionMs(e) is not { } observed) return null;

        var key = TupleKey(e.PilotoId, e.CarroId, e.GearAfter, e.TrechoId);
        _profiles.TryGetValue(key, out var cur);
        var nextRt = (cur is null || cur.SampleCount == 0)
            ? observed
            : cur.ReactionTimeMs * (1 - Alpha) + observed * Alpha;
        nextRt = Math.Min(RtMaxMs, Math.Max(RtMinMs, nextRt));

        var next = new PerfilReacao(key, nextRt, (cur?.SampleCount ?? 0) + 1,
            nowMs ?? DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
        _profiles[key] = next;
        return next;
    }

    /// <summary>Compensação em RPM a aplicar no alvo visual da luz de marcha. Fallback hierárquico
    /// (exata → piloto-carro-marcha → piloto-carro → default 250 ms); só antecipa com sample_count
    /// >= MinSamples. Modo != 'assisted' → 0 (não antecipa). Taxa de subida inválida → 0.</summary>
    public Compensacao ComputeCompensation(
        string? pilotoId, string? carroId, int? gear, string? trechoId,
        double rpmRiseRate, string mode = "assisted")
    {
        if (mode != "assisted") return new Compensacao(0, 0, "learning_mode");
        if (!double.IsFinite(rpmRiseRate) || rpmRiseRate <= 0) return new Compensacao(0, 0, "invalid_rate");

        var candidates = new (string Key, string Source)[]
        {
            (TupleKey(pilotoId, carroId, gear, trechoId), "exact"),
            (TupleKey(pilotoId, carroId, gear, null),     "piloto-carro-gear"),
            (TupleKey(pilotoId, carroId, null, null),     "piloto-carro"),
        };

        double rt = DefaultRtMs;
        var source = "default";
        foreach (var (key, src) in candidates)
            if (_profiles.TryGetValue(key, out var p) && p.SampleCount >= MinSamples && double.IsFinite(p.ReactionTimeMs))
            { rt = p.ReactionTimeMs; source = src; break; }

        rt = Math.Min(RtMaxMs, Math.Max(RtMinMs, rt));
        return new Compensacao(rt, rt * rpmRiseRate / 1000.0, source);
    }
}
