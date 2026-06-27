// p1fast-motor-probe — veredicto do motor T4000 por WinUSB, na bancada/pista.
// Espera a injeção aparecer (energizada), abre pelo MESMO canal WinUSB do .exe,
// lê por 12 s e imprime as stats (handshake / blocos RI / amostras) + a 1ª amostra.
// É ferramenta de DIAGNÓSTICO — não toca o .exe/tela; roda separada.
//
//   uso: p1fast-motor-probe [--espera=SEGUNDOS] [--leitura=SEGUNDOS]
//   default: espera 600 s a T4000 plugar; lê 12 s.

using P1Fast.Cockpit.Domain;
using P1Fast.Cockpit.UI;

string? Arg(string k) => args.FirstOrDefault(a => a.StartsWith(k))?.Split('=', 2).ElementAtOrDefault(1);
int esperaS  = int.TryParse(Arg("--espera"), out var e) ? e : 600;
int leituraS = int.TryParse(Arg("--leitura"), out var l) ? l : 12;

Console.WriteLine($"== p1fast-motor-probe — espera a T4000 plugar (até {esperaS}s), lê {leituraS}s ==");

var deadline = DateTime.UtcNow.AddSeconds(esperaS);
int tick = 0;
while (!WinUsbT3000Channel.Present())
{
    if (DateTime.UtcNow > deadline) { Console.WriteLine($"[VIGIA] desisti: T4000 não apareceu em {esperaS}s."); return; }
    if (tick++ % 10 == 0) Console.WriteLine($"[VIGIA] esperando a T4000 plugar... ({tick}s)");
    await Task.Delay(1000);
}
Console.WriteLine($"[VIGIA] T4000 PRESENTE — abrindo por WinUSB e lendo por {leituraS}s...");

var channel = new WinUsbT3000Channel();
T3000Sample? primeira = null;
long amostras = 0;

var reader = new T3000UsbLiveReader(
    channel,
    onSample: s => { primeira ??= s; amostras++; },
    onStatus: (txt, nivel) => Console.WriteLine($"[STATUS {nivel}] {txt}"),
    onLog:    txt => Console.WriteLine($"[LOG] {txt}"));

using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(leituraS));
try { await reader.RunAsync(cts.Token); }
catch (Exception ex) { Console.WriteLine($"[EXCECAO] {ex.GetType().Name}: {ex.Message}"); }

var st = reader.GetStats();
Console.WriteLine($"== STATS ({leituraS}s) ==");
Console.WriteLine($"  SamplesEmitted    = {st.SamplesEmitted}");
Console.WriteLine($"  BlocksParsed      = {st.BlocksParsed}");
Console.WriteLine($"  ShortBlocks       = {st.ShortBlocks}");
Console.WriteLine($"  BadReads          = {st.BadReads}");
Console.WriteLine($"  Reconnects        = {st.Reconnects}");
Console.WriteLine($"  ReadErrors        = {st.ReadErrors}");
Console.WriteLine($"  HandshakeFailures = {st.HandshakeFailures}");

if (primeira is not null)
{
    var s = primeira;
    Console.WriteLine("== 1ª AMOSTRA ==");
    Console.WriteLine($"  Plausível = {s.LeituraPlausivel}");
    if (!s.LeituraPlausivel) Console.WriteLine($"  Motivos   = {string.Join(", ", s.SanidadeMotivos)}");
    Console.WriteLine($"  {s}");
    Console.WriteLine("\n>>> VEREDICTO: WinUSB ABRIU + handshake OK + bloco RI lido. Caminho do motor VALIDADO no hardware.");
}
else if (st.HandshakeFailures > 0)
    Console.WriteLine("\n>>> VEREDICTO: device presente mas handshake/abertura falhou (ver STATUS acima) — cabo/energia/firmware.");
else
    Console.WriteLine($"\n>>> VEREDICTO: abriu mas nenhum bloco válido em {leituraS}s (motor desligado pode dar implausível; veja blocos/short acima).");
