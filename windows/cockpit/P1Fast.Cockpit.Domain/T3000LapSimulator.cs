// T3000LapSimulator — gera uma "volta" sintética determinística como sequência
// de T3000Sample, pra exercitar o MESMO caminho de produção (LiveDataBridge.
// IngestT3000 → shift light + alarmes → CockpitState) sem a central física.
//
// É o que roda na tela quando o app não acha a T4000: em vez de cenas de demo
// "de mentira", o painel é dirigido pelo processamento real, com dados que se
// movem como num giro de pista (RPM subindo por marcha, troca, e janelas de
// alerta de água e de óleo). Determinístico: mesmo t → mesma amostra.

namespace P1Fast.Cockpit.Domain;

public sealed class T3000LapSimulator
{
    private const double SegPorMarcha = 6.0;   // duração de cada "pull" até a troca
    private const double CicloTotal = SegPorMarcha * 6; // 6 marchas = 36 s

    /// <summary>Amostra correspondente a t segundos desde o início (looping a cada 36 s).</summary>
    public T3000Sample Next(double tSegundos)
    {
        if (tSegundos < 0) tSegundos = 0;
        double T = tSegundos % CicloTotal;

        int pull = (int)(T / SegPorMarcha);
        double frac = (T / SegPorMarcha) - pull;     // 0..1 dentro da marcha
        int marcha = (pull % 6) + 1;                  // 1..6

        // RPM varre 2800..7700 (passa do redline 7500 no topo → FIRE depois OVERREV).
        int rpm = (int)Math.Round(2800 + frac * 4900);
        double tps = Math.Clamp(35 + frac * 65, 0, 100);
        double speed = marcha * 28 + frac * 26;
        double lambda = 0.86 + frac * 0.04;           // levemente rico sob carga
        double map = 0.4 + frac * 1.1;

        // Janelas de alerta dentro do ciclo (pra ver a mensagem aparecer/sumir).
        bool oleoBaixo = T >= 30 && T < 33;           // → "ÓLEO BAIXO"
        bool aguaQuente = T >= 20 && T < 22;          // → "Temperatura água crítica"
        int waterTemp = aguaQuente ? 113 : 92;

        var alarmes = new T3000Alarmes(
            ExcessoRotacao:          rpm > 7500,
            ExcessoPressao:          false,
            ExcessoTempMotor:        false,
            ExcessoAberturaInjetor:  false,
            BaixaPressaoOleo:        oleoBaixo,
            WbMinimo:                false,
            WbMaximo:                false,
            NbMinimo:                false,
            NbMaximo:                false,
            BaixaPressaoCombustivel: false,
            AlertaNivelCombustivel:  false);

        return new T3000Sample
        {
            Rpm = rpm,
            BatteryV = 13.9,
            MapBar = Math.Round(map, 2),
            TpsPct = Math.Round(tps, 1),
            TpsTargetPct = Math.Round(tps, 1),
            PedalAceleradorPct = Math.Round(tps, 1),
            PedalFreioPct = 0,
            AirTempC = 38,
            WaterTempC = waterTemp,
            Lambda = Math.Round(lambda, 3),
            LambdaNbRaw = 500,
            MapaAtual = marcha,
            SpeedKmh = Math.Round(speed, 1),
            PressaoFreioBar = 0,
            AccelXg = 0,
            AccelYg = 0,
            AccelZg = 0,
            CronometroParcialS = Math.Round(T, 2),
            CronometroTotalS = Math.Round(tSegundos, 2),
            Alarmes = alarmes,
            FuelTimeA = new int[8],
            EcuErrorBits = T3000RiBlockBuilder.EncodeAlarmes(alarmes),
            BytesLen = 320,
            ChecksumOk = true,
        };
    }
}
