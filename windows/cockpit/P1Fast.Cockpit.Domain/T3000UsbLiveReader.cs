// T3000UsbLiveReader — leitura AO VIVO da Injepro T4000 pela USB.
//
// É o "cérebro" da conversa com o aparelho, portado FIEL do leitor provado em
// campo (web/cockpit/main-t3000.js: abrirEHandshake + runReadLoop +
// reconectarT3000). Aqui mora a lógica de protocolo; o byte cru entra/sai por
// um IT3000UsbChannel (a "tomada"), abstrato — exatamente como T4000SerialReader
// abstrai a porta serial via ISerialBytePort.
//
// DECISÃO RATIFICADA (Flávio 21/06/2026): o .exe lê a injeção SEMPRE pela USB
// (USB-C↔USB-C). O caminho CAN (T4000PacketParser) vira contingência.
//
// Fluxo (igual ao do navegador, que já leu o carro de verdade):
//   1. Abre o canal e faz a saudação: manda "ACK", espera "OK".
//   2. Loop a ~10 Hz: manda "RI" → recebe o bloco em vários pedaços → junta →
//      decodifica com T3000RIBlockParser → entrega a amostra.
//   3. Travas de robustez: bloco curto demais, leitura fora de faixa física e
//      religação automática quando o cabo/energia cai.
//
// O QUE FICA PRA BANCADA (Fase 1, no notebook + carro): a implementação REAL do
// IT3000UsbChannel (porta USB física). Ela é fina — só abrir/escrever/ler/fechar
// — e mora no projeto de aplicação, igual o ISerialBytePort real. Tudo o que é
// LÓGICA (handshake, montagem do bloco, 10 Hz, travas, religação) é provado aqui
// fora do carro com o canal-fake InMemoryT3000UsbChannel.

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Threading;
using System.Threading.Tasks;

namespace P1Fast.Cockpit.Domain;

/// <summary>A "tomada" física da USB. Só transporte de bytes — nenhuma lógica de
/// protocolo. Implementação real (porta serial CDC-ACM ou USB bulk) vive no
/// projeto de aplicação e é provada na bancada; o fake roda os testes aqui.</summary>
public interface IT3000UsbChannel
{
    /// <summary>Abre/recupera o aparelho e reivindica o canal de leitura/escrita.
    /// Lança se não conseguir abrir (a religação trata).</summary>
    Task OpenAsync(CancellationToken cancellationToken);

    /// <summary>Manda bytes pro aparelho (ex.: "ACK", "RI").</summary>
    Task WriteAsync(byte[] data, CancellationToken cancellationToken);

    /// <summary>Lê até buffer.Length bytes. Retorna quantos vieram; 0 = nada agora.</summary>
    Task<int> ReadAsync(byte[] buffer, CancellationToken cancellationToken);

    /// <summary>Fecha o canal (usado antes de religar).</summary>
    Task CloseAsync();
}

/// <summary>Ajustes do leitor. Os limites espelham as constantes provadas no
/// main-t3000.js; os tempos são injetáveis pra deixar os testes determinísticos.</summary>
public sealed record T3000UsbLiveReaderConfig(
    int ThrottleMs          = 50,    // ~10 Hz total (intervalo + transferência)
    int ReadTimeoutMs       = 200,   // janela pra juntar os pedaços de um bloco
    int ReconnectIntervalMs = 2000,  // espera entre tentativas de religar
    int MaxShortBlocks      = 30,    // 30 blocos curtos seguidos (~3 s) → religa
    int MaxBadReads         = 8,     // 8 leituras fora de faixa seguidas → religa
    int MinBlockBytes       = 92,    // abaixo disso o bloco é "curto" (lixo)
    int MaxBlockBytes       = 460,   // teto pra parar de acumular um bloco
    int ReadChunkBytes      = 256)   // tamanho de cada transferIn
{
    public static T3000UsbLiveReaderConfig Default { get; } = new();
}

/// <summary>Contadores observáveis — pro painel de diagnóstico e pros testes.</summary>
public sealed record T3000UsbLiveReaderStats(
    long SamplesEmitted,
    long BlocksParsed,
    long ShortBlocks,
    long BadReads,
    long Reconnects,
    long ReadErrors,
    long HandshakeFailures);

public sealed class T3000UsbLiveReader
{
    private readonly IT3000UsbChannel _channel;
    private readonly T3000UsbLiveReaderConfig _cfg;
    private readonly Action<T3000Sample>? _onSample;
    private readonly Action<string, string>? _onStatus; // (texto, nível: ok|warn|bad)
    private readonly Action<string>? _onLog;
    private readonly Func<double> _clock;

    private int _shortBlocks;
    private int _badReads;
    private bool _religando;

    private long _samplesEmitted;
    private long _blocksParsed;
    private long _shortBlocksTotal;
    private long _badReadsTotal;
    private long _reconnects;
    private long _readErrors;
    private long _handshakeFailures;

    public T3000UsbLiveReader(
        IT3000UsbChannel channel,
        T3000UsbLiveReaderConfig? config = null,
        Action<T3000Sample>? onSample = null,
        Action<string, string>? onStatus = null,
        Action<string>? onLog = null,
        Func<double>? clock = null)
    {
        ArgumentNullException.ThrowIfNull(channel);
        _channel  = channel;
        _cfg      = config ?? T3000UsbLiveReaderConfig.Default;
        _onSample = onSample;
        _onStatus = onStatus;
        _onLog    = onLog;

        if (clock is not null) { _clock = clock; }
        else { var sw = Stopwatch.StartNew(); _clock = () => sw.Elapsed.TotalMilliseconds; }
    }

    public T3000UsbLiveReaderStats GetStats() => new(
        SamplesEmitted:    _samplesEmitted,
        BlocksParsed:      _blocksParsed,
        ShortBlocks:       _shortBlocksTotal,
        BadReads:          _badReadsTotal,
        Reconnects:        _reconnects,
        ReadErrors:        _readErrors,
        HandshakeFailures: _handshakeFailures);

    private void Status(string txt, string nivel) => _onStatus?.Invoke(txt, nivel);
    private void Log(string txt) => _onLog?.Invoke(txt);

    /// <summary>Saudação: manda "ACK" e confirma "OK". Espelha abrirEHandshake.</summary>
    private async Task<bool> HandshakeAsync(CancellationToken ct)
    {
        await _channel.WriteAsync(T3000RIBlockParser.AckBytes, ct).ConfigureAwait(false);
        var buf = new byte[64];
        int n = await _channel.ReadAsync(buf, ct).ConfigureAwait(false);
        if (n < 2) return false;
        return T3000RIBlockParser.IsAckOk(buf);
    }

    /// <summary>Religação automática: fecha, reabre e refaz a saudação, tentando a
    /// cada ReconnectIntervalMs enquanto o token não for cancelado. Espelha
    /// reconectarT3000 (aparelho já autorizado reaparece sozinho).</summary>
    private async Task<bool> ReconnectAsync(CancellationToken ct)
    {
        if (_religando) return false;
        _religando = true;
        Status("T3000 caiu — religando sozinho…", "bad");
        Log("⚠ leitura caiu. Tentando religar automaticamente…");
        int tent = 0;
        try
        {
            while (!ct.IsCancellationRequested)
            {
                tent++;
                try
                {
                    try { await _channel.CloseAsync().ConfigureAwait(false); } catch { /* já caiu */ }
                    await _channel.OpenAsync(ct).ConfigureAwait(false);
                    if (!await HandshakeAsync(ct).ConfigureAwait(false))
                        throw new InvalidOperationException("saudação recusada na religação");
                    _reconnects++;
                    Status("conectado — lendo a T3000", "ok");
                    Log($"✓ T3000 religada sozinha (tentativa {tent})");
                    return true;
                }
                catch (OperationCanceledException) { return false; }
                catch (Exception e)
                {
                    if (tent == 1 || tent % 15 == 0) Log($"religando T3000… tentativa {tent} ({e.Message})");
                    try { await Task.Delay(_cfg.ReconnectIntervalMs, ct).ConfigureAwait(false); }
                    catch (OperationCanceledException) { return false; }
                }
            }
            return false;
        }
        finally { _religando = false; }
    }

    /// <summary>Abre, faz a saudação e roda o loop até o token ser cancelado.
    /// Se a saudação inicial falhar, NÃO entra no loop (igual ao navegador).</summary>
    public async Task RunAsync(CancellationToken cancellationToken)
    {
        try
        {
            Status("abrindo a USB…", "warn");
            await _channel.OpenAsync(cancellationToken).ConfigureAwait(false);
            if (!await HandshakeAsync(cancellationToken).ConfigureAwait(false))
            {
                _handshakeFailures++;
                Status("saudação rejeitada — não consegui falar com a T3000", "bad");
                Log("erro: handshake recusado (não veio 'OK')");
                return;
            }
            Status("conectado — lendo a T3000", "ok");
            Log("central respondeu OK — handshake confirmado");
        }
        catch (OperationCanceledException) { return; }
        catch (Exception e)
        {
            _handshakeFailures++;
            Status("falha ao abrir a USB: " + e.Message, "bad");
            Log("erro: " + e.Message);
            return;
        }

        await ReadLoopAsync(cancellationToken).ConfigureAwait(false);
    }

    /// <summary>Loop principal: RI → junta o bloco → tradutor → amostra, com as
    /// travas de bloco curto / leitura ruim / religação. Espelha runReadLoop.</summary>
    private async Task ReadLoopAsync(CancellationToken ct)
    {
        var merged = new List<byte>(_cfg.MaxBlockBytes);
        var chunk  = new byte[_cfg.ReadChunkBytes];

        while (!ct.IsCancellationRequested)
        {
            try
            {
                await _channel.WriteAsync(T3000RIBlockParser.RiBytes, ct).ConfigureAwait(false);

                // a central manda os bytes em vários pacotes → acumula até o teto,
                // até secar (n<=0) ou até estourar a janela de tempo.
                merged.Clear();
                var sw = Stopwatch.StartNew();
                while (sw.ElapsedMilliseconds < _cfg.ReadTimeoutMs)
                {
                    int n = await _channel.ReadAsync(chunk, ct).ConfigureAwait(false);
                    if (n <= 0) break;
                    for (int i = 0; i < n; i++) merged.Add(chunk[i]);
                    if (merged.Count >= _cfg.MaxBlockBytes) break;
                }

                if (merged.Count < _cfg.MinBlockBytes)
                {
                    // Bloco curto — trava silenciosa: conta e, após N seguidos, religa.
                    _shortBlocks++; _shortBlocksTotal++;
                    if (_shortBlocks >= _cfg.MaxShortBlocks)
                    {
                        Log($"{_cfg.MaxShortBlocks} blocos curtos seguidos — religando leitura…");
                        _shortBlocks = 0;
                        bool back = await ReconnectAsync(ct).ConfigureAwait(false);
                        if (!back) { Status("leitura encerrada", "bad"); break; }
                    }
                }
                else
                {
                    var sample = T3000RIBlockParser.Parse(merged.ToArray(), _clock());
                    if (sample is not null) _blocksParsed++;

                    if (sample is not null && sample.LeituraPlausivel)
                    {
                        // Caminho feliz — dado bom.
                        _samplesEmitted++;
                        _shortBlocks = 0;
                        _badReads = 0;
                        _onSample?.Invoke(sample);
                    }
                    else if (sample is not null)
                    {
                        // Amostra chegou mas reprovou na sanidade (fora de faixa física):
                        // NÃO entrega (segura o último valor bom). Após N seguidas, religa.
                        _badReads++; _badReadsTotal++;
                        if (_badReads == 1)
                        {
                            string motivos = string.Join(", ", sample.SanidadeMotivos);
                            Status("leitura instável — segurando último valor", "warn");
                            Log($"leitura inválida descartada (fora de faixa: {motivos}) — não entregue");
                        }
                        if (_badReads >= _cfg.MaxBadReads)
                        {
                            Log($"{_cfg.MaxBadReads} leituras inválidas seguidas — religando leitura…");
                            _badReads = 0;
                            bool back = await ReconnectAsync(ct).ConfigureAwait(false);
                            if (!back) { Status("leitura encerrada", "bad"); break; }
                        }
                    }
                }
            }
            catch (OperationCanceledException) { break; }
            catch (Exception e)
            {
                // NÃO desiste: religa sozinho (cabo solto, queda de energia, USB resetada).
                _readErrors++;
                Log("leitura interrompida: " + e.Message);
                bool back = await ReconnectAsync(ct).ConfigureAwait(false);
                if (!back) { Status("leitura encerrada", "bad"); break; }
                _shortBlocks = 0; _badReads = 0; // religou: zera contadores de trava
            }

            // Throttle pra ~10 Hz. Diferente do JS (que pula o throttle no bloco
            // curto porque a USB real já bloqueia ~200 ms por ciclo), aqui o
            // throttle vale pra TODO ciclo: como o canal pode não bloquear, isso
            // evita girar a CPU à toa. Não muda a detecção das travas.
            try { await Task.Delay(_cfg.ThrottleMs, ct).ConfigureAwait(false); }
            catch (OperationCanceledException) { break; }
        }
    }
}

/// <summary>Canal-fake em memória pra testes: o teste roteira a resposta da
/// saudação e a fila de blocos RI; o reader conversa com ele como se fosse o
/// aparelho. Distingue ACK de RI pelo conteúdo do Write.</summary>
public sealed class InMemoryT3000UsbChannel : IT3000UsbChannel
{
    private readonly object _lock = new();
    private readonly Queue<byte[]> _riBlocks = new();
    private readonly Queue<byte> _pending = new();
    private byte[] _handshakeResponse;
    private readonly int _maxPerRead;
    private bool _lastWriteWasRi; // a falha simulada de leitura só vale pra dado RI, não pra saudação

    /// <summary>Quantas vezes OpenAsync foi chamado (1ª conexão + religações).</summary>
    public int OpenCount { get; private set; }
    public int CloseCount { get; private set; }

    /// <summary>Se setado, o próximo OpenAsync lança (simula aparelho ausente).
    /// É consumido em uma chamada (decrementa).</summary>
    public int FailNextOpens { get; set; }

    /// <summary>Se setado, o próximo ReadAsync do loop lança (simula queda no fio).
    /// Consumido em uma chamada.</summary>
    public int FailNextReads { get; set; }

    /// <param name="handshakeResponse">Resposta à saudação. "OK" = aceita.</param>
    /// <param name="maxPerRead">Limita bytes por ReadAsync pra exercitar a
    /// montagem multi-pacote (a central manda em pedaços de ~64).</param>
    public InMemoryT3000UsbChannel(byte[]? handshakeResponse = null, int maxPerRead = 64)
    {
        _handshakeResponse = handshakeResponse ?? new byte[] { 0x4F, 0x4B }; // "OK"
        _maxPerRead = maxPerRead;
    }

    public void SetHandshakeResponse(byte[] resp) { lock (_lock) _handshakeResponse = resp; }

    /// <summary>Enfileira um bloco RI a ser entregue na próxima conversa "RI".</summary>
    public void EnqueueBlock(byte[] block) { lock (_lock) _riBlocks.Enqueue(block); }

    public Task OpenAsync(CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        lock (_lock)
        {
            if (FailNextOpens > 0) { FailNextOpens--; throw new InvalidOperationException("aparelho ainda não voltou na USB"); }
            OpenCount++;
            _pending.Clear();
        }
        return Task.CompletedTask;
    }

    public Task WriteAsync(byte[] data, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        lock (_lock)
        {
            if (IsEqual(data, T3000RIBlockParser.AckBytes))
            {
                _lastWriteWasRi = false;
                foreach (var b in _handshakeResponse) _pending.Enqueue(b);
            }
            else if (IsEqual(data, T3000RIBlockParser.RiBytes))
            {
                _lastWriteWasRi = true;
                if (_riBlocks.Count > 0)
                    foreach (var b in _riBlocks.Dequeue()) _pending.Enqueue(b);
                // sem bloco roteirado: nada a entregar → o reader verá bloco curto/vazio.
            }
        }
        return Task.CompletedTask;
    }

    public Task<int> ReadAsync(byte[] buffer, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        lock (_lock)
        {
            if (_lastWriteWasRi && FailNextReads > 0) { FailNextReads--; throw new System.IO.IOException("queda na leitura USB (simulada)"); }
            if (_pending.Count == 0) return Task.FromResult(0);
            int n = Math.Min(Math.Min(buffer.Length, _maxPerRead), _pending.Count);
            for (int i = 0; i < n; i++) buffer[i] = _pending.Dequeue();
            return Task.FromResult(n);
        }
    }

    public Task CloseAsync()
    {
        lock (_lock) { CloseCount++; _pending.Clear(); }
        return Task.CompletedTask;
    }

    private static bool IsEqual(byte[] a, byte[] b)
    {
        if (a is null || a.Length != b.Length) return false;
        for (int i = 0; i < a.Length; i++) if (a[i] != b[i]) return false;
        return true;
    }
}
