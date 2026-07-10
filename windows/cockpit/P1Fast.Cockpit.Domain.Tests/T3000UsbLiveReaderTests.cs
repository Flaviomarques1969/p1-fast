// Prova FORA DO CARRO do leitor ao vivo da USB (T3000UsbLiveReader): handshake,
// montagem do bloco em pedaços, entrega ao tradutor e as três travas de robustez
// (bloco curto, leitura fora de faixa, religação automática). O byte cru entra
// pelo canal-fake InMemoryT3000UsbChannel — a tomada física real é provada na
// bancada (notebook + carro), fora do CI.

using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class T3000UsbLiveReaderTests
{
    // Tempos curtos pra deixar o loop determinístico e rápido. Os LIMITES das
    // travas ficam nos valores canônicos (30 blocos curtos, 8 leituras ruins).
    private static readonly T3000UsbLiveReaderConfig Fast =
        new(ThrottleMs: 1, ReadTimeoutMs: 1000, ReconnectIntervalMs: 1);

    // Bloco RI bom de 410 bytes (mesmos offsets do T3000RIBlockParserTests).
    private static byte[] BlocoBom(int rpm = 5200)
    {
        var b = new byte[410];
        void U16(int o, int v) { b[o] = (byte)(v & 0xFF); b[o + 1] = (byte)((v >> 8) & 0xFF); }
        U16(0, rpm);     // rpm
        U16(2, 138);     // bateria -> 13.8 V
        U16(46, 7);      // tps1 -> 0.7%
        U16(52, 55);     // pedal acelerador -> 5.5%
        U16(56, 28);     // temp ar 28C
        U16(58, 52);     // temp motor 52C
        U16(62, 896);    // lambda WB -> 0.896
        U16(102, 1606);  // velocidade -> 160.6 km/h
        return b;
    }

    // Bloco com comprimento válido mas valor impossível (rpm 65535) → reprova na
    // sanidade física e NÃO deve ser entregue.
    private static byte[] BlocoForaDeFaixa()
    {
        var b = BlocoBom();
        b[0] = 0xFF; b[1] = 0xFF; // rpm = 65535
        return b;
    }

    private static byte[] BlocoCurto() => new byte[50];

    // Roda o reader coletando amostras; cancela sozinho ao atingir alvoAmostras,
    // com um teto de segurança pra nunca travar a bateria.
    private static async Task<(List<T3000Sample> Amostras, T3000UsbLiveReader Reader)> Rodar(
        InMemoryT3000UsbChannel canal,
        int alvoAmostras,
        T3000UsbLiveReaderConfig? cfg = null,
        int tetoMs = 5000)
    {
        var amostras = new List<T3000Sample>();
        var cts = new CancellationTokenSource();
        cts.CancelAfter(tetoMs);
        var reader = new T3000UsbLiveReader(
            canal,
            cfg ?? Fast,
            onSample: s => { amostras.Add(s); if (amostras.Count >= alvoAmostras) cts.Cancel(); });
        await reader.RunAsync(cts.Token);
        return (amostras, reader);
    }

    [Fact]
    public async Task Handshake_Ok_EntregaUmaAmostra()
    {
        var canal = new InMemoryT3000UsbChannel(); // "OK" por padrão
        canal.EnqueueBlock(BlocoBom(rpm: 5200));

        var (amostras, reader) = await Rodar(canal, alvoAmostras: 1);

        Assert.Single(amostras);
        Assert.Equal(5200, amostras[0].Rpm);
        Assert.True(amostras[0].LeituraPlausivel);
        Assert.Equal(1, canal.OpenCount);
        Assert.Equal(1, reader.GetStats().SamplesEmitted);
        Assert.Equal(0, reader.GetStats().HandshakeFailures);
    }

    [Fact]
    public async Task Handshake_Rejeitado_NaoEntregaNada_NemEntraNoLoop()
    {
        var canal = new InMemoryT3000UsbChannel(handshakeResponse: new byte[] { 0x4E, 0x4F }); // "NO"
        canal.EnqueueBlock(BlocoBom());

        var (amostras, reader) = await Rodar(canal, alvoAmostras: 1);

        Assert.Empty(amostras);
        var st = reader.GetStats();
        Assert.Equal(1, st.HandshakeFailures);
        Assert.Equal(0, st.BlocksParsed);
        Assert.Equal(0, st.SamplesEmitted);
    }

    [Fact]
    public async Task BlocoEmPedacos_MontaUmBlocoUnico()
    {
        // maxPerRead pequeno força MUITOS transferIn por bloco → prova a montagem.
        var canal = new InMemoryT3000UsbChannel(maxPerRead: 16);
        canal.EnqueueBlock(BlocoBom(rpm: 6050));

        var (amostras, reader) = await Rodar(canal, alvoAmostras: 1);

        Assert.Single(amostras);
        Assert.Equal(6050, amostras[0].Rpm);          // chegou inteiro mesmo picado
        Assert.Equal(160.6, amostras[0].SpeedKmh, 1e-9);
    }

    [Fact]
    public async Task BlocosCurtos_DisparamReligacaoNoLimite_DepoisVoltaAEntregar()
    {
        var canal = new InMemoryT3000UsbChannel();
        for (int i = 0; i < 30; i++) canal.EnqueueBlock(BlocoCurto()); // 30 curtos → religa
        canal.EnqueueBlock(BlocoBom());                                 // depois um bom

        var (amostras, reader) = await Rodar(canal, alvoAmostras: 1);

        Assert.Single(amostras);
        var st = reader.GetStats();
        Assert.Equal(30, st.ShortBlocks);
        Assert.Equal(1, st.Reconnects);
        Assert.Equal(2, canal.OpenCount);   // abertura inicial + religação
        Assert.True(canal.CloseCount >= 1);
        Assert.Equal(1, st.SamplesEmitted);
    }

    [Fact]
    public async Task LeiturasForaDeFaixa_DisparamReligacao_ESoEntregamOBlocoBom()
    {
        var canal = new InMemoryT3000UsbChannel();
        for (int i = 0; i < 8; i++) canal.EnqueueBlock(BlocoForaDeFaixa()); // 8 ruins → religa
        canal.EnqueueBlock(BlocoBom(rpm: 5200));

        var (amostras, reader) = await Rodar(canal, alvoAmostras: 1);

        Assert.Single(amostras);
        Assert.Equal(5200, amostras[0].Rpm);
        var st = reader.GetStats();
        Assert.Equal(8, st.BadReads);
        Assert.Equal(1, st.Reconnects);
        Assert.Equal(9, st.BlocksParsed);   // 8 ruins + 1 bom (todos decodificados)
        Assert.Equal(2, canal.OpenCount);
    }

    [Fact]
    public async Task ErroNaLeitura_ReligaSozinho_EContinua()
    {
        var canal = new InMemoryT3000UsbChannel();
        canal.FailNextReads = 1;            // 1ª leitura de dado RI explode (cabo solto)
        canal.EnqueueBlock(BlocoBom());     // este bloco se perde no tranco da queda
        canal.EnqueueBlock(BlocoBom(rpm: 4800)); // este chega depois da religação

        var (amostras, reader) = await Rodar(canal, alvoAmostras: 1);

        Assert.Single(amostras);
        Assert.Equal(4800, amostras[0].Rpm);
        var st = reader.GetStats();
        Assert.Equal(1, st.ReadErrors);
        Assert.Equal(1, st.Reconnects);
        Assert.Equal(2, canal.OpenCount);
    }

    [Fact]
    public async Task Religacao_TentaDeNovoAteOAparelhoVoltar()
    {
        var canal = new InMemoryT3000UsbChannel();
        canal.FailNextReads = 1;   // derruba a leitura
        canal.FailNextOpens = 1;   // e a 1ª tentativa de reabrir falha (aparelho ainda fora)
        canal.EnqueueBlock(BlocoBom());          // perdido na queda
        canal.EnqueueBlock(BlocoBom(rpm: 5300)); // chega quando a USB volta

        var (amostras, reader) = await Rodar(canal, alvoAmostras: 1);

        Assert.Single(amostras);
        Assert.Equal(5300, amostras[0].Rpm);
        var st = reader.GetStats();
        Assert.Equal(1, st.Reconnects);
        Assert.Equal(2, canal.OpenCount);  // inicial + a reabertura que deu certo (a falha não conta)
    }

    // 5.1: bloco de 92–109 bytes NÃO é "curto" (>= 92) mas é curto pro decodificador
    // (< 110 → Parse devolve null). Antes não contava em NENHUMA trava → leitura morta
    // silenciosa "conectado — lendo" pra sempre. Agora conta como leitura ruim e religa.
    [Fact]
    public async Task BlocoEntre92e109_ContaComoLeituraRuim_EReliga()
    {
        var canal = new InMemoryT3000UsbChannel();
        for (int i = 0; i < 8; i++) canal.EnqueueBlock(new byte[100]); // 92<=100<110 → Parse null
        canal.EnqueueBlock(BlocoBom(rpm: 4200));

        var (amostras, reader) = await Rodar(canal, alvoAmostras: 1);

        Assert.Single(amostras);
        Assert.Equal(4200, amostras[0].Rpm);
        var st = reader.GetStats();
        Assert.Equal(8, st.BadReads);            // os 8 blocos 92–109 alimentaram a trava
        Assert.Equal(1, st.Reconnects);          // 8 leituras ruins → religou
        Assert.Equal(2, canal.OpenCount);        // inicial + religação
        Assert.Equal(0, st.ShortBlocks);         // NÃO são "curtos" (>= 92)
        Assert.Equal(1, st.SamplesEmitted);
    }

    // 5.2(b): bloco MAIOR que o esperado (FIFO deslocado — resto atrasado colou no início)
    // NÃO pode ser parseado como se fosse bom (viraria rpm/temperatura errados na tela e no
    // disco). Deve ser descartado e resincronizado; o próximo bloco limpo entra correto.
    [Fact]
    public async Task BlocoGrandeDemais_EhDescartado_NaoParseia_EProximoBomEntra()
    {
        var canal = new InMemoryT3000UsbChannel();
        var gigante = BlocoBom(rpm: 7000);       // rpm PLAUSÍVEL: sem a correção seria emitido
        Array.Resize(ref gigante, 520);          // 520 > MaxBlockBytes (460) → desalinhado
        canal.EnqueueBlock(gigante);
        canal.EnqueueBlock(BlocoBom(rpm: 4200)); // o bloco limpo seguinte

        var (amostras, reader) = await Rodar(canal, alvoAmostras: 1);

        Assert.Single(amostras);
        Assert.Equal(4200, amostras[0].Rpm);     // o gigante NÃO virou amostra (seria 7000)
        var st = reader.GetStats();
        Assert.True(st.BadReads >= 1, $"o bloco gigante devia contar como leitura ruim (veio {st.BadReads})");
        Assert.Equal(1, st.SamplesEmitted);
    }

    // 5.5: uma exceção do CONSUMIDOR (gravador/publisher/tela) NÃO pode religar uma USB
    // saudável — isso custa ~2 s+ de perda física à toa. O erro do consumidor é isolado.
    [Fact]
    public async Task ConsumidorQueEstoura_NaoReligaUsbSaudavel()
    {
        var canal = new InMemoryT3000UsbChannel();
        canal.EnqueueBlock(BlocoBom());
        canal.EnqueueBlock(BlocoBom(rpm: 5100));

        int invocacoes = 0;
        var cts = new CancellationTokenSource();
        cts.CancelAfter(5000);
        var reader = new T3000UsbLiveReader(canal, Fast, onSample: _ =>
        {
            invocacoes++;
            if (invocacoes >= 2) cts.Cancel();
            throw new InvalidOperationException("gravador estourou");
        });
        await reader.RunAsync(cts.Token);

        Assert.True(invocacoes >= 2, "o consumidor devia ser chamado apesar de estourar");
        var st = reader.GetStats();
        Assert.Equal(0, st.Reconnects);   // NÃO religou por causa do erro do consumidor
        Assert.Equal(1, canal.OpenCount); // a USB física continuou aberta e saudável
    }

    // 5.6: o "OK" da saudação pode chegar FRAGMENTADO ("O" e depois "K", em transferIn
    // separados). Uma leitura só reprovava um handshake bom; agora acumula até a janela.
    [Fact]
    public async Task Handshake_OkFragmentado_EhAceito()
    {
        var canal = new InMemoryT3000UsbChannel(maxPerRead: 1); // 1 byte por ReadAsync
        canal.EnqueueBlock(BlocoBom(rpm: 3300));

        var (amostras, reader) = await Rodar(canal, alvoAmostras: 1);

        Assert.Single(amostras);
        Assert.Equal(3300, amostras[0].Rpm);
        Assert.Equal(0, reader.GetStats().HandshakeFailures);
    }

    // 5.6: saudação inicial com retry + backoff — a central pode não ter acordado na 1ª
    // tentativa (operador ligou o app antes da chave ON). Antes: 1 tentativa e desiste.
    [Fact]
    public async Task Handshake_Inicial_TentaDeNovoComBackoff()
    {
        var canal = new InMemoryT3000UsbChannel();
        canal.FailNextHandshakes = 1;        // a 1ª saudação responde "NO"
        canal.EnqueueBlock(BlocoBom(rpm: 4600));

        var cfg = new T3000UsbLiveReaderConfig(
            ThrottleMs: 1, ReadTimeoutMs: 1000, ReconnectIntervalMs: 1, InitialHandshakeAttempts: 3);
        var (amostras, reader) = await Rodar(canal, alvoAmostras: 1, cfg: cfg);

        Assert.Single(amostras);
        Assert.Equal(4600, amostras[0].Rpm);
        var st = reader.GetStats();
        Assert.Equal(1, st.HandshakeFailures); // a 1ª tentativa falhou
        Assert.Equal(2, canal.OpenCount);      // tentativa 1 (falhou) + tentativa 2 (ok)
    }

    [Fact]
    public async Task DoisBlocosBons_EntregamDuasAmostrasEmSequencia()
    {
        var canal = new InMemoryT3000UsbChannel();
        canal.EnqueueBlock(BlocoBom(rpm: 3000));
        canal.EnqueueBlock(BlocoBom(rpm: 6100));

        var (amostras, reader) = await Rodar(canal, alvoAmostras: 2);

        Assert.Equal(2, amostras.Count);
        Assert.Equal(3000, amostras[0].Rpm);
        Assert.Equal(6100, amostras[1].Rpm);
        Assert.Equal(2, reader.GetStats().SamplesEmitted);
        Assert.Equal(0, reader.GetStats().Reconnects);
    }
}
