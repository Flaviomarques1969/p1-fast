// ═══════════════════════════════════════════════════════════
// HeartbeatPublisher — Command Box anuncia que está displaying
// ═══════════════════════════════════════════════════════════
// MS-11.4. Enquanto o Command Box mostra um vídeo ao vivo, publica
// um heartbeat a cada 5s no canal Supabase Realtime
// `team:{teamId}:stream-display`. Permite ao servidor saber que pelo
// menos 1 display está acompanhando o stream.
//
// Não bloqueia o servidor — heartbeat é informativo (analytics futuro).
// Pode ser usado pelo iPhone pra detectar que o box não está mais
// olhando e desligar o stream (frente futura).

using System;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading;
using System.Threading.Tasks;

namespace P1Fast.Cockpit.Domain;

public sealed class HeartbeatPublisher : IAsyncDisposable
{
    private readonly HttpClient _http;
    private readonly Func<string?> _accessTokenProvider;
    private readonly string _supabaseUrl;
    private readonly string _anonKey;
    private CancellationTokenSource? _cts;
    private Task? _loopTask;

    public HeartbeatPublisher(
        HttpClient http,
        string supabaseUrl,
        string anonKey,
        Func<string?> accessTokenProvider)
    {
        _http = http;
        _supabaseUrl = supabaseUrl.TrimEnd('/');
        _anonKey = anonKey;
        _accessTokenProvider = accessTokenProvider;
    }

    public void Start(string videoStreamId, string teamId)
    {
        Stop();
        _cts = new CancellationTokenSource();
        _loopTask = LoopAsync(videoStreamId, teamId, _cts.Token);
    }

    public void Stop()
    {
        _cts?.Cancel();
        _cts = null;
    }

    private async Task LoopAsync(string videoStreamId, string teamId, CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            try
            {
                await PublishOneAsync(videoStreamId, teamId, ct);
            }
            catch
            {
                // Heartbeat não-fatal — ignora erro e tenta de novo
            }

            try
            {
                await Task.Delay(TimeSpan.FromSeconds(5), ct);
            }
            catch (TaskCanceledException)
            {
                break;
            }
        }
    }

    private async Task PublishOneAsync(string videoStreamId, string teamId, CancellationToken ct)
    {
        // Endpoint Supabase Realtime broadcast via REST.
        // Channel: team:{teamId}:stream-display
        // Event: heartbeat
        var url = $"{_supabaseUrl}/realtime/v1/api/broadcast";

        var req = new HttpRequestMessage(HttpMethod.Post, url);
        req.Headers.Add("apikey", _anonKey);
        var token = _accessTokenProvider();
        req.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue(
            "Bearer", token ?? _anonKey);

        var body = new
        {
            messages = new[]
            {
                new
                {
                    topic = $"team:{teamId}:stream-display",
                    @event = "heartbeat",
                    payload = new
                    {
                        video_stream_id = videoStreamId,
                        timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                    },
                    @private = true,
                }
            }
        };
        req.Content = JsonContent.Create(body);

        using var resp = await _http.SendAsync(req, ct);
        // Não trato resposta — heartbeat é fire-and-forget
        _ = resp;
    }

    public async ValueTask DisposeAsync()
    {
        Stop();
        if (_loopTask != null)
        {
            try { await _loopTask.ConfigureAwait(false); } catch { }
        }
    }
}
