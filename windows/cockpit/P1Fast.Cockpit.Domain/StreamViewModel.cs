// ═══════════════════════════════════════════════════════════
// StreamViewModel — estado do vídeo ao vivo no Command Box
// ═══════════════════════════════════════════════════════════
// MS-11.5 (camada de domínio). Consumido pela UI (MainWindow.xaml.cs)
// pra decidir o que mostrar:
//   - StreamStatus.Parado: tela normal do cockpit
//   - StreamStatus.Carregando: spinner com "Iniciando vídeo..."
//   - StreamStatus.AoVivo: WebView2 carregando DailyRoomUrl
//   - StreamStatus.SemSinal: última imagem congelada + "Sem sinal há Xs"
//   - StreamStatus.Encerrado: volta pra tela normal

using System;

namespace P1Fast.Cockpit.Domain;

public enum StreamStatus
{
    Parado,
    Carregando,
    AoVivo,
    SemSinal,
    Encerrado,
}

public sealed class StreamViewModel
{
    public StreamStatus Status { get; private set; } = StreamStatus.Parado;
    public string? VideoStreamId { get; private set; }
    public string? DailyRoomUrl { get; private set; }
    public string? UltimoMotivoEncerramento { get; private set; }
    public DateTimeOffset? UltimaHeartbeatRecebida { get; private set; }
    /// <summary>Threshold pra considerar "sem sinal" — default 10s (Q16).</summary>
    public TimeSpan SemSinalApos { get; init; } = TimeSpan.FromSeconds(10);

    /// <summary>Notificado pelo PullingService ou Supabase Realtime
    /// quando recebe stream-started pro stint corrente.</summary>
    public void OnStreamStarted(string videoStreamId, string dailyRoomUrl)
    {
        VideoStreamId = videoStreamId;
        DailyRoomUrl = dailyRoomUrl;
        Status = StreamStatus.AoVivo;
        UltimaHeartbeatRecebida = DateTimeOffset.UtcNow;
        UltimoMotivoEncerramento = null;
    }

    /// <summary>Atualiza timestamp do último heartbeat recebido.</summary>
    public void OnHeartbeat()
    {
        UltimaHeartbeatRecebida = DateTimeOffset.UtcNow;
        if (Status == StreamStatus.SemSinal)
        {
            Status = StreamStatus.AoVivo;
        }
    }

    /// <summary>Chamado periodicamente (timer 1s) pra verificar se está sem sinal.</summary>
    public void Tick(DateTimeOffset now)
    {
        if (Status != StreamStatus.AoVivo) return;
        if (UltimaHeartbeatRecebida == null) return;
        var idade = now - UltimaHeartbeatRecebida.Value;
        if (idade > SemSinalApos)
        {
            Status = StreamStatus.SemSinal;
        }
    }

    public void OnStreamEnded(string motivo)
    {
        Status = StreamStatus.Encerrado;
        UltimoMotivoEncerramento = motivo;
    }

    public void Reset()
    {
        Status = StreamStatus.Parado;
        VideoStreamId = null;
        DailyRoomUrl = null;
        UltimoMotivoEncerramento = null;
        UltimaHeartbeatRecebida = null;
    }

    /// <summary>Texto pra UI mostrar como aviso quando sem sinal (Q16).</summary>
    public string MensagemSemSinal(DateTimeOffset now)
    {
        if (Status != StreamStatus.SemSinal || UltimaHeartbeatRecebida == null)
            return string.Empty;
        var segs = (int)(now - UltimaHeartbeatRecebida.Value).TotalSeconds;
        return $"Sem sinal há {segs}s";
    }
}
