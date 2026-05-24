// LivePanel — formata em texto uma tabela ao vivo do estado da T4000.
//
// Objetivo: Flávio bate uma foto da tela com o celular e manda pro Cloud
// Code (ou pra mim aqui) pra diagnóstico. Por isso o painel:
//
//   - É largo (até 80 colunas) pra ficar legível na foto.
//   - Usa box-drawing chars + separadores claros.
//   - Mostra: cenário, estado da conexão, dados da central, contadores de
//     saúde, mensagem humana do diagnóstico, ação de recuperação.
//   - Função PURA (input → string) — testável sem Console.

using System.Globalization;
using P1Fast.Cockpit.Domain;

namespace P1Fast.Cockpit.T4000LiveDemo;

public sealed record TentativaLog(DateTime QuandoUtc, string Tipo, string Detalhe);

public sealed record PanelInput(
    DateTime AgoraUtc,
    string CenarioAtual,
    T4000Sample? UltimoSample,
    T4000HealthSample Health,
    T4000Diagnostic Diagnostico,
    T4000RecoveryAction? AcaoRecuperacao,
    long BytesRecebidosTotal,
    long PacotesProcessadosTotal,
    long PublicadoRealtime,
    long DescartadoThrottle,
    IReadOnlyList<TentativaLog> TentativasRecentes,
    string Versao,
    string Repositorio,
    string Branch);

public static class LivePanel
{
    private const int W = 80;
    private const string Top    = "╔══════════════════════════════════════════════════════════════════════════════╗";
    private const string Mid    = "╠══════════════════════════════════════════════════════════════════════════════╣";
    private const string Bot    = "╚══════════════════════════════════════════════════════════════════════════════╝";
    private const string SubTop = "  ┌──────────────────────────────────────────────────────────────────────────┐";
    private const string SubBot = "  └──────────────────────────────────────────────────────────────────────────┘";

    public static string Render(PanelInput input)
    {
        ArgumentNullException.ThrowIfNull(input);
        var sb = new System.Text.StringBuilder(2048);

        var titulo = "P1 FAST — PAINEL T4000 AO VIVO";
        var hora = input.AgoraUtc.ToLocalTime().ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture);

        sb.AppendLine(Top);
        sb.AppendLine(BorderedLine($" {titulo,-50}    {hora,18}"));
        sb.AppendLine(Mid);

        // ── Cenário & estado ────────────────────────────────────────
        sb.AppendLine(BorderedLine($"  CENÁRIO SIMULADO : {input.CenarioAtual}"));
        sb.AppendLine(BorderedLine($"  ESTADO DA CONEXÃO: {EstadoComMarcador(input.Diagnostico.State)}"));
        sb.AppendLine(EmptyLine());

        // ── Dados da central ─────────────────────────────────────────
        sb.AppendLine(SubTop.PadRight(W - 1) + "║");
        sb.AppendLine(SubLine($" DADOS DA CENTRAL T4000"));
        if (input.UltimoSample is { } t)
        {
            sb.AppendLine(SubLine($"   RPM         {t.Rpm,5}              Marcha       {t.Marcha,3}"));
            sb.AppendLine(SubLine($"   Temp Água   {t.WaterTempC,5:F1}°C            Temp Óleo    {t.OilTempC,5:F1}°C"));
            sb.AppendLine(SubLine($"   Press Óleo  {t.OilPressBar,5:F2} bar          Lambda       {t.Lambda,5:F2}"));
            sb.AppendLine(SubLine($"   MAP         {t.MapBar,5:F2} bar          TPS          {t.TpsPct,5:F1}%"));
            sb.AppendLine(SubLine($"   Bateria     {t.BatteryV,5:F1} V            EGT          {t.EgtC,5}°C"));
        }
        else
        {
            sb.AppendLine(SubLine($"   (sem dados — a central ainda não cospiu nada)"));
        }
        sb.AppendLine(SubBot.PadRight(W - 1) + "║");
        sb.AppendLine(EmptyLine());

        // ── Saúde da conexão ────────────────────────────────────────
        sb.AppendLine(SubTop.PadRight(W - 1) + "║");
        sb.AppendLine(SubLine($" SAÚDE DA CONEXÃO"));
        sb.AppendLine(SubLine($"   Bytes recebidos       {input.BytesRecebidosTotal,10:N0}"));
        sb.AppendLine(SubLine($"   Pacotes processados   {input.PacotesProcessadosTotal,10:N0}"));
        sb.AppendLine(SubLine($"   Ciclos OK             {input.Health.CyclesOkTotal,10:N0}    Com erro: {input.Health.CyclesBadTotal,6:N0}"));
        sb.AppendLine(SubLine($"   Sentinelas P4/P5      {input.Health.SentinelsP4Total,10:N0} / {input.Health.SentinelsP5Total:N0}"));
        sb.AppendLine(SubLine($"   Publicado ao vivo     {input.PublicadoRealtime,10:N0}    Descartado (throttle): {input.DescartadoThrottle,5:N0}"));
        sb.AppendLine(SubLine($"   ms desde último byte  {input.Health.MsSinceLastByte,10:N0}"));
        sb.AppendLine(SubLine($"   ms desde último OK    {input.Health.MsSinceLastCycleOk,10:N0}"));
        sb.AppendLine(SubBot.PadRight(W - 1) + "║");
        sb.AppendLine(EmptyLine());

        // ── Diagnóstico humano ──────────────────────────────────────
        sb.AppendLine(SubTop.PadRight(W - 1) + "║");
        sb.AppendLine(SubLine($" DIAGNÓSTICO"));
        foreach (var linha in QuebrarTexto(input.Diagnostico.MensagemHumana, 70))
            sb.AppendLine(SubLine($"   {linha}"));

        if (input.Diagnostico.State != T4000ConnectionState.Healthy)
        {
            sb.AppendLine(SubLine($""));
            sb.AppendLine(SubLine($"   AÇÃO SUGERIDA:"));
            foreach (var linha in QuebrarTexto(input.Diagnostico.SugestaoAcao, 70))
                sb.AppendLine(SubLine($"   {linha}"));
        }

        if (input.AcaoRecuperacao is { } acao && acao.Tipo != "none" && acao.Tipo != "wait")
        {
            sb.AppendLine(SubLine($""));
            sb.AppendLine(SubLine($"   RECUPERAÇÃO AUTOMÁTICA EM ANDAMENTO ({acao.Tipo}):"));
            foreach (var linha in QuebrarTexto(acao.Detalhe, 70))
                sb.AppendLine(SubLine($"   {linha}"));
        }
        sb.AppendLine(SubBot.PadRight(W - 1) + "║");

        sb.AppendLine(EmptyLine());

        // ── Tentativas recentes (histórico curto) ───────────────────
        sb.AppendLine(SubTop.PadRight(W - 1) + "║");
        sb.AppendLine(SubLine($" TENTATIVAS RECENTES (últimas {Math.Min(input.TentativasRecentes.Count, 8)})"));
        if (input.TentativasRecentes.Count == 0)
        {
            sb.AppendLine(SubLine($"   (nenhuma tentativa de recuperação ainda)"));
        }
        else
        {
            foreach (var tentativa in input.TentativasRecentes.TakeLast(8))
            {
                var horaT = tentativa.QuandoUtc.ToLocalTime().ToString("HH:mm:ss", CultureInfo.InvariantCulture);
                var resumo = $"{horaT}  {tentativa.Tipo,-22}  {tentativa.Detalhe}";
                foreach (var linha in QuebrarTexto(resumo, 72))
                    sb.AppendLine(SubLine($"   {linha}"));
            }
        }
        sb.AppendLine(SubBot.PadRight(W - 1) + "║");
        sb.AppendLine(EmptyLine());

        // ── Info pro Cloud Code (Flávio fotografa e manda) ─────────
        sb.AppendLine(SubTop.PadRight(W - 1) + "║");
        sb.AppendLine(SubLine($" INFO PRO CLAUDE CODE (use esses dados pra resolver)"));
        sb.AppendLine(SubLine($"   Aplicativo: {input.Versao}"));
        sb.AppendLine(SubLine($"   Repositório: {input.Repositorio}"));
        sb.AppendLine(SubLine($"   Linha de trabalho (branch): {input.Branch}"));
        sb.AppendLine(SubLine($"   Estado da falha: {input.Diagnostico.State}"));
        var arquivoChave = ArquivoSuspeitoParaEstado(input.Diagnostico.State);
        if (arquivoChave is not null)
        {
            sb.AppendLine(SubLine($"   Arquivo provável:"));
            foreach (var linha in QuebrarTexto(arquivoChave, 70))
                sb.AppendLine(SubLine($"     {linha}"));
        }
        sb.AppendLine(SubBot.PadRight(W - 1) + "║");

        sb.AppendLine(EmptyLine());
        sb.AppendLine(BorderedLine("  Pressione Q ou Esc pra sair.  Tire foto do painel pra mandar pro Claude."));
        sb.AppendLine(Bot);
        return sb.ToString();
    }

    /// <summary>Quando algo dá errado, qual arquivo do código provavelmente precisa ser mexido.</summary>
    private static string? ArquivoSuspeitoParaEstado(T4000ConnectionState state) => state switch
    {
        T4000ConnectionState.NoPortsDetected    => "P1Fast.Cockpit.T4000Capture/Program.cs (varredura de portas)",
        T4000ConnectionState.PortBusy           => "P1Fast.Cockpit.T4000Capture/Program.cs (abertura de porta)",
        T4000ConnectionState.PortOpenNoData     => "P1Fast.Cockpit.Domain/T4000AutoRecoveringReader.cs (reabertura)",
        T4000ConnectionState.ProtocolMismatch   => "P1Fast.Cockpit.Domain/T4000PacketParser.cs (formato do pacote)",
        T4000ConnectionState.ChecksumFlapping   => "P1Fast.Cockpit.Domain/T4000PacketFeeder.cs (ressincronização)",
        T4000ConnectionState.ConnectionFlapping => "P1Fast.Cockpit.Domain/T4000AutoRecoveringReader.cs (recuperação)",
        _ => null,
    };

    /// <summary>Linha "║ ... ║" preenchida até a largura.</summary>
    private static string BorderedLine(string conteudo)
    {
        // remove conteúdo extra além da largura útil (W - 2 caracteres "║")
        var maxInterior = W - 2;
        if (conteudo.Length > maxInterior) conteudo = conteudo[..maxInterior];
        return "║" + conteudo.PadRight(maxInterior) + "║";
    }

    private static string EmptyLine() => "║" + new string(' ', W - 2) + "║";

    /// <summary>Linha de sub-box ("║   │ ... │ ║" estilo).
    /// Pra simplicidade visual fazemos só "║   conteúdo                                ║".</summary>
    private static string SubLine(string conteudo)
    {
        var maxInterior = W - 2;
        if (conteudo.Length > maxInterior) conteudo = conteudo[..maxInterior];
        return "║" + conteudo.PadRight(maxInterior) + "║";
    }

    private static string EstadoComMarcador(T4000ConnectionState state) => state switch
    {
        T4000ConnectionState.Healthy            => "✓ OK — tudo certo",
        T4000ConnectionState.Unknown            => "? ainda conferindo",
        T4000ConnectionState.NoPortsDetected    => "✗ FALHA — nenhuma porta USB detectada",
        T4000ConnectionState.PortBusy           => "✗ FALHA — porta USB ocupada por outro programa",
        T4000ConnectionState.PortOpenNoData     => "✗ FALHA — porta aberta mas sem dados",
        T4000ConnectionState.ProtocolMismatch   => "✗ FALHA — protocolo diferente do esperado",
        T4000ConnectionState.ChecksumFlapping   => "! ALERTA — dados chegando corrompidos",
        T4000ConnectionState.ConnectionFlapping => "! ALERTA — conexão caiu depois de funcionar",
        _ => state.ToString(),
    };

    /// <summary>Quebra texto longo em linhas de até maxLen, sem cortar palavras.</summary>
    private static IEnumerable<string> QuebrarTexto(string texto, int maxLen)
    {
        if (string.IsNullOrEmpty(texto)) yield break;
        var palavras = texto.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var atual = new System.Text.StringBuilder();
        foreach (var p in palavras)
        {
            if (atual.Length == 0) { atual.Append(p); continue; }
            if (atual.Length + 1 + p.Length > maxLen)
            {
                yield return atual.ToString();
                atual.Clear();
                atual.Append(p);
            }
            else
            {
                atual.Append(' ').Append(p);
            }
        }
        if (atual.Length > 0) yield return atual.ToString();
    }
}
