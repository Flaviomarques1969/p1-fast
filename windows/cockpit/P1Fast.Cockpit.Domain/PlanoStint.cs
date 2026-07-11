// PlanoStint — o CÉREBRO puro da barra de voltas do cockpit: lê o plano do stint
// aprovado pelo chefe (que viaja no envelope da nuvem, coluna plano_stint) e o traduz
// nos TIPOS de volta que a barra do topo do painel exibe. Sem rede, sem UI, sem
// produção — só decisão pura e testável (a rede vive no PlanoStintReader).
//
// Porta 1:1 de web/cockpit/treino-stint.js (buscarPlanoStintDaNuvem 102-131 +
// validarPlanoStint 76-82), MENOS a parte de rede. A REGRA DO DIA (achado da revisão
// 11/06): o plano da nuvem só vale no DIA da aprovação, no fuso de Brasília — senão o
// notebook do carro armaria pra sempre o plano de ontem em todo boot, violando a regra
// "sem plano = barra padrão (placeholder)".
//
// Layering (docs/CONTRATO_DADOS.md): StintBlockState vive na UI (P1Fast.Cockpit.UI); o
// Domain não pode referenciá-la. Então o cérebro fala em TipoVoltaStint (vocabulário do
// Domain) e a UI faz o mapa trivial TipoVoltaStint → StintBlockState. Telas só EXIBEM.

using System.Globalization;
using System.Text.Json;

namespace P1Fast.Cockpit.Domain;

/// <summary>Tipo de cada bloco da barra de VOLTAS. MARTELO do Flávio 2026-07-11 (via canal
/// com o iMac): aquecimento e resfriamento NÃO existem mais como cápsulas — quem mostra o
/// térmico é a TELA DEDICADA (TelaTermica). A barra é SÓ voltas planejadas + paradas (box).
/// (A regra antiga de 2026-07-03 — 1ª=Aquecimento, última=CoolDown — foi revogada.)</summary>
public enum TipoVoltaStint
{
    Vaga,         // slot além do stint — não há volta planejada aqui
    Planejada,    // volta de ritmo planejada pelo piloto (inclui a 1ª e a última)
    Box,          // parada no box planejada
}

/// <summary>Parada planejada no box: em que volta e por quê.</summary>
public sealed record ParadaStint(int Volta, string? Motivo);

/// <summary>Plano do stint aprovado pelo chefe (o subconjunto que a barra usa). Espelha o
/// objeto plano_stint do envelope; campos ausentes ficam nulos/vazios.</summary>
public sealed record PlanoStint(
    int Voltas,
    IReadOnlyList<ParadaStint> Paradas,
    string? Proposito,
    string? Foco,
    string? Piloto,
    string? Autodromo,
    string? AprovadoEm,
    string Origem);

/// <summary>Traduz o plano_stint do envelope (nuvem) nos tipos de volta da barra. Puro,
/// sem rede, NUNCA lança — na dúvida devolve null e a UI cai no placeholder.</summary>
public static class PlanoStintParser
{
    /// <summary>Fuso de Brasília. .NET 8 resolve o id IANA no Windows (ICU); se por acaso
    /// não resolver, cai no id Windows equivalente e, no pior caso, num offset fixo -3
    /// (Brasília não tem mais horário de verão desde 2019).</summary>
    private static readonly TimeZoneInfo FusoBrasilia = ResolverFusoBrasilia();

    private static TimeZoneInfo ResolverFusoBrasilia()
    {
        foreach (var id in new[] { "America/Sao_Paulo", "E. South America Standard Time" })
        {
            try { return TimeZoneInfo.FindSystemTimeZoneById(id); }
            catch { /* tenta o próximo */ }
        }
        return TimeZoneInfo.CreateCustomTimeZone(
            "P1Fast-BRT-3", TimeSpan.FromHours(-3), "Brasilia (-03)", "Brasilia (-03)");
    }

    /// <summary>Dia civil (yyyy-MM-dd) de um instante ISO no fuso de Brasília, ou null se a
    /// data não fizer sentido. Espelha o diaSP() do treino-stint.js (toLocaleDateString
    /// 'en-CA' com timeZone 'America/Sao_Paulo').</summary>
    public static string? DiaBrasilia(string? iso)
    {
        if (string.IsNullOrWhiteSpace(iso)) return null;
        if (!DateTimeOffset.TryParse(iso, CultureInfo.InvariantCulture,
                DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out var instante))
            return null;
        try
        {
            var local = TimeZoneInfo.ConvertTime(instante, FusoBrasilia);
            return local.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        }
        catch { return null; }
    }

    /// <summary>Recebe o corpo BRUTO da resposta REST (array de envelopes, order desc limit
    /// 1) + o instante "agora" ISO (injeta pra teste; null = UtcNow) e devolve o plano
    /// VÁLIDO e DO DIA (fuso Brasília), ou null (→ placeholder). Porta pura de
    /// buscarPlanoStintDaNuvem (treino-stint.js 106-131): nunca lança.</summary>
    public static PlanoStint? DaRespostaNuvem(string? corpoJson, string? agoraIso = null)
    {
        if (string.IsNullOrWhiteSpace(corpoJson)) return null;
        try
        {
            using var doc = JsonDocument.Parse(corpoJson);
            var raiz = doc.RootElement;

            // A query devolve um array; pega o primeiro (order desc, limit 1). Tolera
            // também um objeto único, por robustez.
            JsonElement envelope;
            if (raiz.ValueKind == JsonValueKind.Array)
            {
                if (raiz.GetArrayLength() == 0) return null;
                envelope = raiz[0];
            }
            else if (raiz.ValueKind == JsonValueKind.Object)
            {
                envelope = raiz;
            }
            else return null;

            if (!envelope.TryGetProperty("plano_stint", out var planoEl)
                || planoEl.ValueKind != JsonValueKind.Object)
                return null; // envelope sem plano (coluna ausente/nula) → placeholder

            // REGRA DO DIA: created_at do envelope OU plano_stint.aprovadoEm.
            var createdAt = TextoOuNull(envelope, "created_at");
            var aprovadoEm = TextoOuNull(planoEl, "aprovadoEm");
            var aprovadoDia = DiaBrasilia(createdAt ?? aprovadoEm);
            var hoje = DiaBrasilia(agoraIso ?? DateTimeOffset.UtcNow.ToString("O", CultureInfo.InvariantCulture));
            if (aprovadoDia is null || aprovadoDia != hoje) return null;

            return Validar(planoEl, "nuvem");
        }
        catch
        {
            return null; // JSON malformado / qualquer surpresa → placeholder
        }
    }

    /// <summary>Valida + extrai o objeto plano_stint (JSONB). Espelha validarPlanoStint
    /// (treino-stint.js 76-82). Devolve null se não é objeto utilizável pela barra:
    /// proposito 'treinar' exige um foco presente (o catálogo de treinos é validado no web,
    /// não aqui — a barra só precisa da ESTRUTURA); e voltas precisa ser inteiro &gt; 0 (sem
    /// isso a barra não sabe qual é a 1ª/última volta).</summary>
    public static PlanoStint? Validar(JsonElement plano, string origem)
    {
        if (plano.ValueKind != JsonValueKind.Object) return null;

        var proposito = TextoOuNull(plano, "proposito");
        var foco = TextoOuNull(plano, "foco");
        if (proposito == "treinar" && string.IsNullOrWhiteSpace(foco)) return null;

        if (!plano.TryGetProperty("voltas", out var voltasEl)
            || !TentarInteiro(voltasEl, out var voltas) || voltas <= 0)
            return null;

        var paradas = new List<ParadaStint>();
        if (plano.TryGetProperty("paradas", out var paradasEl) && paradasEl.ValueKind == JsonValueKind.Array)
        {
            foreach (var p in paradasEl.EnumerateArray())
            {
                if (p.ValueKind != JsonValueKind.Object) continue;
                if (p.TryGetProperty("volta", out var vEl) && TentarInteiro(vEl, out var v) && v > 0)
                    paradas.Add(new ParadaStint(v, TextoOuNull(p, "motivo")));
            }
        }

        return new PlanoStint(
            Voltas: voltas,
            Paradas: paradas,
            Proposito: proposito,
            Foco: foco,
            Piloto: TextoOuNull(plano, "piloto"),
            Autodromo: TextoOuNull(plano, "autodromo"),
            AprovadoEm: TextoOuNull(plano, "aprovadoEm"),
            Origem: origem);
    }

    /// <summary>Expande o plano nos TIPOS de volta de cada um dos `slots` blocos da barra.
    /// MARTELO (Flávio 2026-07-11): a barra é SÓ voltas planejadas + paradas — cada parada =
    /// Box; toda outra volta (incl. a 1ª e a última) = Planejada; slots além de Voltas = Vaga.
    /// O térmico (aquecimento/resfriamento) é obra da TELA DEDICADA, não da barra. Devolve
    /// null se o plano não dá pra montar (Voltas &lt;= 0) — a UI então usa o placeholder.
    /// Nota: stint com mais voltas que `slots` mostra só as primeiras `slots` voltas; os
    /// planos reais têm ~10 voltas e a barra expande até 40, então isso não ocorre na prática.</summary>
    public static TipoVoltaStint[]? ExpandirBarra(PlanoStint? plano, int slots)
    {
        if (plano is null || plano.Voltas <= 0 || slots <= 0) return null;

        var paradaEm = new HashSet<int>();
        foreach (var p in plano.Paradas) paradaEm.Add(p.Volta);

        var barra = new TipoVoltaStint[slots];
        for (var i = 0; i < slots; i++)
        {
            var volta = i + 1; // slot 0 = volta 1
            if (volta > plano.Voltas)
                barra[i] = TipoVoltaStint.Vaga;
            else if (paradaEm.Contains(volta))
                barra[i] = TipoVoltaStint.Box;
            else
                barra[i] = TipoVoltaStint.Planejada;
        }
        return barra;
    }

    /// <summary>Atalho ponta-a-ponta pra UI: do corpo REST direto pros `slots` tipos de
    /// volta, ou null (→ placeholder). Junta DaRespostaNuvem + ExpandirBarra.</summary>
    public static TipoVoltaStint[]? BarraDaRespostaNuvem(string? corpoJson, int slots, string? agoraIso = null)
        => ExpandirBarra(DaRespostaNuvem(corpoJson, agoraIso), slots);

    private static string? TextoOuNull(JsonElement obj, string prop)
        => obj.TryGetProperty(prop, out var el) && el.ValueKind == JsonValueKind.String
            ? el.GetString()
            : null;

    private static bool TentarInteiro(JsonElement el, out int valor)
    {
        valor = 0;
        if (el.ValueKind == JsonValueKind.Number && el.TryGetInt32(out valor)) return true;
        // tolera "10" como string (um form pode gravar número como texto no JSONB)
        return el.ValueKind == JsonValueKind.String
            && int.TryParse(el.GetString(), NumberStyles.Integer, CultureInfo.InvariantCulture, out valor);
    }
}
