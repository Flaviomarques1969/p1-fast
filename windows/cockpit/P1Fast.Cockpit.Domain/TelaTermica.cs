// TelaTermica — o cérebro das TELAS DEDICADAS de AQUECIMENTO e RESFRIAMENTO do cockpit
// (aprovado por Flávio 2026-07-06). Durante a 1ª volta (out-lap, motor frio) e a última
// (in-lap, motor quente) as demais funções da tela desativam e entra uma tela cheia com a
// TEMPERATURA como protagonista.
//
// Conceito duro (Flávio 2026-07-06): a cor de QUALQUER indicador segue o padrão do sistema
// — VERMELHO = ruim, VERDE = bom. Para a água do motor, "bom" = dentro da janela ideal
// (50–55 °C do Bubi, CortesChuvaTermica). O anel é PROGRESSO rumo ao ideal e é SEMPRE
// CRESCENTE: 0 (longe/vermelho) → 1 (no ideal/verde). Vale pra esquentar E pra esfriar.
//
// Gatilho "as duas juntas" (Flávio): AQUECIMENTO = 1ª volta E água abaixo do ideal;
// RESFRIAMENTO = última volta E água acima do ideal. Sem água (motor mudo) → Off: a tela
// nunca entra por dado velho/inventado (mesma regra §9 da chuva).
//
// Zero UI, zero I/O — só decisão pura (a UI mapeia Progresso→cor e desenha o anel).
// Comportamento de tempo (auto-retorno 5 s no aquecimento — martelo 2026-07-11; permanência
// no resfriamento até desligar) é da UI: aqui só se diz QUE tela e QUANTO falta pro ideal.

namespace P1Fast.Cockpit.Domain;

/// <summary>Qual tela dedicada está no ar (ou nenhuma = telemetria normal).</summary>
public enum ModoTelaTermica
{
    Off,
    Aquecimento,
    Resfriamento,
}

/// <summary>
/// Decisão da tela térmica num instante: o modo, o progresso rumo ao ideal (0..1) e a
/// temperatura crua (pra tela exibir o número). Progresso vale mesmo em Off (a UI usa
/// pra decidir "chegou no ideal" e disparar o auto-retorno do aquecimento).
/// </summary>
public readonly record struct EstadoTelaTermica(ModoTelaTermica Modo, double Progresso, double? TempC);

/// <summary>Água do motor + volta do stint → qual tela dedicada e o progresso. Puro.</summary>
public static class TelaTermica
{
    // Âncoras de "ruim total" (progresso 0), aprovadas no mockup do Flávio 2026-07-06.
    // Bubi: 40 °C = frio total (largada), 78 °C = quente total (fim de stint puxado).
    // Parametrizáveis por carro no futuro; a janela ideal vem de CortesChuvaTermica.
    public const double FrioTotalBubiC   = 40;
    public const double QuenteTotalBubiC = 78;

    /// <summary>
    /// Avalia a tela térmica. <paramref name="voltaAtualIdx"/> é 0-based (0 = 1ª volta);
    /// <paramref name="ultimaVoltaIdx"/> é o índice da última volta real do stint. null/NaN
    /// na água (motor mudo) → Off.
    /// </summary>
    public static EstadoTelaTermica Avaliar(
        double? waterTempC,
        int voltaAtualIdx,
        int ultimaVoltaIdx,
        CortesChuvaTermica? cortes = null,
        double frioTotalC = FrioTotalBubiC,
        double quenteTotalC = QuenteTotalBubiC)
    {
        if (waterTempC is not { } t || double.IsNaN(t))
            return new EstadoTelaTermica(ModoTelaTermica.Off, 0, null);

        var c = cortes ?? CortesChuvaTermica.Bubi;
        var prog = Progresso(t, c, frioTotalC, quenteTotalC);

        var primeira = voltaAtualIdx == 0;
        var ultima   = ultimaVoltaIdx >= 0 && voltaAtualIdx == ultimaVoltaIdx;

        // AQUECIMENTO: 1ª volta e ainda não passou do TOPO do ideal (mostra o verde ao
        // entrar na janela; a UI segura 10 s e volta à corrida). RESFRIAMENTO: última volta
        // e ainda acima do PISO do ideal (mostra o verde ao chegar na janela; a tela fica).
        if (primeira && t < c.IdealAteC)  return new EstadoTelaTermica(ModoTelaTermica.Aquecimento, prog, t);
        if (ultima   && t > c.IdealDeC)   return new EstadoTelaTermica(ModoTelaTermica.Resfriamento, prog, t);

        return new EstadoTelaTermica(ModoTelaTermica.Off, prog, t);
    }

    /// <summary>Progresso rumo ao ideal (0 = longe/ruim, 1 = dentro da janela/bom). Crescente
    /// pros dois lados: aquecendo sobe até o piso do ideal; esfriando sobe até o teto.</summary>
    public static double Progresso(double t, CortesChuvaTermica cortes, double frioTotalC, double quenteTotalC)
    {
        if (t >= cortes.IdealDeC && t <= cortes.IdealAteC) return 1;
        if (t < cortes.IdealDeC)
        {
            var span = cortes.IdealDeC - frioTotalC;
            return span <= 0 ? 1 : Clamp01(1 - (cortes.IdealDeC - t) / span);
        }
        var spanQ = quenteTotalC - cortes.IdealAteC;
        return spanQ <= 0 ? 1 : Clamp01(1 - (t - cortes.IdealAteC) / spanQ);
    }

    private static double Clamp01(double v) => Math.Max(0, Math.Min(1, v));
}
