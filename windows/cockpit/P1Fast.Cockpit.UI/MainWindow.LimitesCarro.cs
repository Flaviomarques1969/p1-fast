// MainWindow.LimitesCarro.cs — Fase 2 item 4 (tela Garagem), ETAPA 3 do lado do notebook.
//
// O Flávio decidiu ajustar TODOS os limites de alerta pelo app, na Garagem. O app grava os
// limites de CADA carro no JSON `configuracoes.overrides` (chaves `alerta_*`, sincroniza
// celular↔nuvem). O iMac fez o lado do cérebro: `LimitesDoCarro.De(overridesJson)` converte
// esse JSON em (AlertaLimites, AprendizadoLimites), e o CockpitOrchestrator aceita esses limites.
// Aqui fica a ponte que FALTAVA: ao abrir a sessão ao vivo, LER o overrides do carro na nuvem
// (mesmo Supabase e chave que a barra de voltas já usa) e alimentar o maestro.
//
// Best-effort TOTAL: sem chave/rede/override, ou JSON inválido → limites default do sistema
// (idêntico a hoje) — NUNCA derruba a tela nem atrasa demais o boot (timeout curto).
//
// Seleção: UMA linha "Setup base" por carro (contrato confirmado pelo iMac 2026-07-05, a mesma
// que o app grava em CarroRepository.saveOverrides). Basta filtrar por carro_id — sem ordenação.

using System;
using System.IO;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using P1Fast.Cockpit.Domain;

namespace P1Fast.Cockpit.UI;

public sealed partial class MainWindow
{
    /// <summary>Lê os limites DESTE carro do `configuracoes.overrides` na nuvem (best-effort).
    /// Devolve (null, null) se não há chave/override/rede — o chamador cai nos defaults do sistema.
    /// Roda FORA da thread da UI; usa timeout curto pra não atrasar o boot do cockpit.</summary>
    private async Task<(AlertaLimites? Alertas, AprendizadoLimites? Aprendizado)> BuscarLimitesDoCarroAsync(
        CancellationToken ct)
    {
        var anon = Environment.GetEnvironmentVariable("P1FAST_SUPABASE_ANON");
        if (string.IsNullOrWhiteSpace(anon)) return (null, null);   // sem chave → 100% local, defaults

        var carroId = string.IsNullOrWhiteSpace(_options.CarroId)
            ? PlanoStintReader.CarroIdBubi
            : _options.CarroId!;

        try
        {
            // Timeout curto: os limites são desejáveis, mas o cockpit não pode ficar preso no boot
            // esperando a rede. Falhou/demorou → defaults (seguro).
            using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(5) };
            var baseUrl = (Environment.GetEnvironmentVariable("P1FAST_SUPABASE_URL")?.TrimEnd('/'))
                          ?? LiveSupabaseUrl;
            // Uma linha "Setup base" por carro (contrato do iMac) — filtra por carro_id; limit=1
            // como defesa contra duplicata legada. `overrides` vem cru pra LimitesDoCarro.De.
            var url = $"{baseUrl}/rest/v1/configuracoes" +
                      $"?carro_id=eq.{Uri.EscapeDataString(carroId)}" +
                      $"&select=overrides&limit=1";
            using var req = new HttpRequestMessage(HttpMethod.Get, url);
            req.Headers.Add("apikey", anon);
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", anon);

            using var resp = await http.SendAsync(req, ct).ConfigureAwait(false);
            if (!resp.IsSuccessStatusCode)
            {
                System.Diagnostics.Debug.WriteLine($"[limites-carro] HTTP {(int)resp.StatusCode} — usando defaults.");
                return (null, null);
            }

            var corpo = await resp.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
            var overridesJson = ExtrairOverridesJson(corpo);
            if (string.IsNullOrWhiteSpace(overridesJson)) return (null, null);   // sem override → defaults

            var (al, ap) = LimitesDoCarro.De(overridesJson);
            System.Diagnostics.Debug.WriteLine(
                $"[limites-carro] carro={carroId} limites aplicados (água quente={al.WaterMaxC:0}°C).");
            return (al, ap);
        }
        catch (Exception e)
        {
            System.Diagnostics.Debug.WriteLine($"[limites-carro] falha ({e.GetType().Name}) — usando defaults.");
            return (null, null);   // best-effort: qualquer falha → defaults
        }
    }

    /// <summary>Extrai o JSON de overrides da resposta PostgREST (array de linhas). A coluna
    /// `overrides` pode vir como STRING (texto JSON) ou como OBJETO (jsonb) — trata os dois.
    /// null se a resposta é vazia/sem a coluna.</summary>
    private static string? ExtrairOverridesJson(string corpo)
    {
        try
        {
            using var doc = JsonDocument.Parse(corpo);
            if (doc.RootElement.ValueKind != JsonValueKind.Array || doc.RootElement.GetArrayLength() == 0)
                return null;
            var linha = doc.RootElement[0];
            if (!linha.TryGetProperty("overrides", out var ov)) return null;
            return ov.ValueKind switch
            {
                JsonValueKind.String => ov.GetString(),   // coluna texto: já é o JSON
                JsonValueKind.Object => ov.GetRawText(),  // coluna jsonb: reserializa o objeto
                _ => null,
            };
        }
        catch (JsonException) { return null; }
    }
}
