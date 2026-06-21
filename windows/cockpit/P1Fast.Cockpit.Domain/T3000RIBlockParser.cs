// T3000RIBlockParser.cs — port fiel do decodificador USB provado em campo
// (web/cockpit/t3000-usb-parser.js, VERSÃO 2.0.0, engenharia reversa do
// software oficial Injepro T LINE v3.3.7).
//
// DECISÃO RATIFICADA (Flávio 21/06/2026): o .exe lê a injeção Injepro T4000
// SEMPRE pela USB (USB-C↔USB-C). O "T3000" é só o nome do protocolo USB do
// mesmo aparelho. Este parser é o caminho PROVADO (leu o carro em campo),
// substituindo o T4000PacketParser (CAN, só simulado) no caminho crítico.
//
// Objetivo de paridade: dado o MESMO bloco RI, este parser produz os mesmos
// números que parseT3000RIBlock do JS — ver T3000RIBlockParserTests.

using System;
using System.Collections.Generic;

namespace P1Fast.Cockpit.Domain
{
    /// <summary>Faixas físicas plausíveis do Bubi (Celta 1.4). Limites FOLGADOS:
    /// pegam lixo grosseiro de leitura corrompida, NÃO recusam dado de pista no limite.</summary>
    public readonly record struct FaixaFisica(double Min, double Max);

    public sealed class T3000Sample
    {
        // metadados
        public string Source { get; init; } = "t3000-usb";
        public string ParserVersion { get; init; } = T3000RIBlockParser.ParserVersion;
        public double TMono { get; init; }
        public bool ChecksumOk { get; init; } = true;
        public int BytesLen { get; init; }

        // motor (diagnóstico)
        public int Rpm { get; init; }
        public double BatteryV { get; init; }
        public double MapBar { get; init; }
        public double TpsPct { get; init; }
        public double Tps2Pct { get; init; }
        public double TpsTargetPct { get; init; }
        public int? AirTempC { get; init; }
        public int? WaterTempC { get; init; }
        public double Lambda { get; init; }
        public int LambdaNB { get; init; }
        public int LambdaWBRaw { get; init; }
        public int MapaAtual { get; init; }
        public int AnguloInjecao { get; init; }
        public double ConsumoBorboleta { get; init; }
        public int AtuacaoCorteIgnicao { get; init; }

        // pilotagem
        public double PedalAceleradorPct { get; init; }
        public double PedalFreioPct { get; init; }
        public double? PressaoFreioBar { get; init; }
        public double SpeedKmh { get; init; }
        public double? AccelXg { get; init; }
        public double? AccelYg { get; init; }
        public double? AccelZg { get; init; }

        // saúde dos cilindros
        public int[] FuelInjectionRaw { get; init; } = Array.Empty<int>();
        public bool FuelInjectionBalanced { get; init; }
        public int FuelInjectionSpread { get; init; }
        public int[] FuelInjDutyA { get; init; } = Array.Empty<int>();
        public int[] FuelInjDutyB { get; init; } = Array.Empty<int>();
        public int[] FuelInjDutyC { get; init; } = Array.Empty<int>();
        public int[] FuelTimeA { get; init; } = Array.Empty<int>();

        // alarmes (bitfield → flags)
        public IReadOnlyDictionary<string, bool> Alarmes { get; init; } = new Dictionary<string, bool>();
        public IReadOnlyDictionary<string, bool> StatusSinais { get; init; } = new Dictionary<string, bool>();

        // cronômetros
        public double? CronometroParcialS { get; init; }
        public double? CronometroTotalS { get; init; }

        // compat com LiveDataBridge
        public int? Marcha { get; init; }              // T3000 não fornece direto
        public int? EgtC { get; init; }                // só via aparelho CAN externo
        public bool EgtOutOfRange { get; init; }
        public long EcuErrorBits { get; init; }

        public int[] SensoresExternos { get; init; } = Array.Empty<int>();

        // sanidade aditiva (não altera nenhum campo acima)
        public bool LeituraPlausivel { get; init; } = true;
        public IReadOnlyList<string> SanidadeMotivos { get; init; } = Array.Empty<string>();
    }

    public static class T3000RIBlockParser
    {
        public const string ParserVersion = "2.0.0";

        // Limite INCLUSIVO (reprova só com < min OU > max). Espelha FAIXAS_FISICAS do JS.
        public static readonly IReadOnlyDictionary<string, FaixaFisica> FaixasFisicas =
            new Dictionary<string, FaixaFisica>
            {
                ["rpm"] = new(0, 8000),
                ["batteryV"] = new(6, 16),
                ["waterTempC"] = new(-20, 130),
                ["airTempC"] = new(-20, 90),
                ["lambda"] = new(0.3, 1.6),
                ["tpsPct"] = new(0, 100),
                ["pedalAceleradorPct"] = new(0, 100),
                ["pedalFreioPct"] = new(0, 100),
                ["speedKmh"] = new(0, 400),
                ["mapBar"] = new(-1.1, 4),
            };

        private static int U16le(byte[] b, int o) => b[o] | (b[o + 1] << 8);
        private static int I16le(byte[] b, int o) { int v = U16le(b, o); return v > 0x7FFF ? v - 0x10000 : v; }
        private static long U32le(byte[] b, int o) =>
            ((long)(b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24))) & 0xFFFFFFFFL;
        private static bool Bit(int by, int n) => ((by >> n) & 1) == 1;
        private static bool Bit32(long num, int n) => ((num >> n) & 1) == 1;

        // Sensores de temperatura retornam valores especiais quando não há sonda física.
        private static int? TempC(int raw) =>
            (raw == -2 || raw == -20 || raw == 0x7FFF || raw == -32768) ? (int?)null : raw;

        /// <summary>Filtro de sanidade (função pura). Só SINALIZA, não derruba a amostra.
        /// Campos null são ignorados. Espelha leituraPlausivel() do JS.</summary>
        public static (bool Ok, List<string> Motivos) LeituraPlausivel(IReadOnlyDictionary<string, double?> valores)
        {
            var motivos = new List<string>();
            foreach (var campo in FaixasFisicas.Keys)
            {
                if (!valores.TryGetValue(campo, out var v) || v is null) continue; // ausente = não avalia
                double val = v.Value;
                if (double.IsNaN(val)) { motivos.Add(campo + ":NaN"); continue; }
                if (val < FaixasFisicas[campo].Min || val > FaixasFisicas[campo].Max)
                    motivos.Add(campo + ":" + Num(val));
            }
            return (motivos.Count == 0, motivos);
        }

        // Formata número como o JS (inteiro sem ".0", decimal com ponto).
        private static string Num(double v) =>
            v == Math.Floor(v) && !double.IsInfinity(v)
                ? ((long)v).ToString(System.Globalization.CultureInfo.InvariantCulture)
                : v.ToString(System.Globalization.CultureInfo.InvariantCulture);

        /// <summary>Decodifica o bloco RI da Injepro lido pela USB. Retorna null se o
        /// buffer for curto (espelha parseT3000RIBlock: precisa de ao menos 110 bytes).</summary>
        public static T3000Sample? Parse(byte[] buf, double? tMono = null)
        {
            if (buf is null || buf.Length < 110) return null;
            int len = buf.Length;

            int rpm = U16le(buf, 0);
            int bateriaRaw = U16le(buf, 2);
            int mapRaw = I16le(buf, 4);

            var sensoresExternos = new int[20];
            for (int i = 0; i < 20; i++) sensoresExternos[i] = I16le(buf, 6 + i * 2);

            int tps1Raw = U16le(buf, 46);
            int tps2Raw = U16le(buf, 48);
            int tpsAlvoRaw = U16le(buf, 50);
            int pedal1Raw = U16le(buf, 52);
            int pedal2Raw = U16le(buf, 54);
            int tempArRaw = I16le(buf, 56);
            int tempMotorRaw = I16le(buf, 58);
            int lambdaNBRaw = U16le(buf, 60);   // NB (estreita) — em mV no oficial
            int lambdaWBRaw = U16le(buf, 62);   // WB (banda larga) ÷1000 → λ (ativa no Bubi)

            var fuelInjDutyA = new int[8];
            for (int i = 0; i < 8; i++) fuelInjDutyA[i] = U16le(buf, 68 + i * 2);
            var fuelTimeA = new int[8];
            for (int i = 0; i < 8; i++) fuelTimeA[i] = U16le(buf, 84 + i * 2);

            int b18 = buf[100];
            int b19 = buf[101];
            int velocidadeRaw = U16le(buf, 102);
            int consumoRaw = I16le(buf, 104);
            int anguloInjecaoRaw = I16le(buf, 106);
            int mapaAtual = buf[108] + 1;
            int atuacaoCorteIgnicao = buf[109];

            int? pressaoFreioRaw = null, accelXRaw = null, accelYRaw = null, accelZRaw = null;
            long alarmesBits = 0; long? cronoParcial = null, cronoTotal = null;
            if (len >= 270) pressaoFreioRaw = I16le(buf, 268);
            if (len >= 276) { accelXRaw = I16le(buf, 270); accelYRaw = I16le(buf, 272); accelZRaw = I16le(buf, 274); }
            if (len >= 292) alarmesBits = U32le(buf, 288);
            if (len >= 296) cronoParcial = U32le(buf, 292);
            if (len >= 300) cronoTotal = U32le(buf, 296);

            var fuelInjDutyB = new List<int>();
            if (len >= 374) for (int i = 0; i < 8; i++) fuelInjDutyB.Add(U16le(buf, 358 + i * 2));
            var fuelInjDutyC = new List<int>();
            if (len >= 382) for (int i = 0; i < 4; i++) fuelInjDutyC.Add(U16le(buf, 374 + i * 2));

            // diagnóstico de cilindros (só primeiros 4 — Celta tem 4 cil)
            var time4 = new[] { fuelTimeA[0], fuelTimeA[1], fuelTimeA[2], fuelTimeA[3] };
            int time4Min = Math.Min(Math.Min(time4[0], time4[1]), Math.Min(time4[2], time4[3]));
            int time4Max = Math.Max(Math.Max(time4[0], time4[1]), Math.Max(time4[2], time4[3]));
            int time4Spread = time4Max - time4Min;
            bool time4Balanced = time4Spread <= 200;

            int? waterTempC = TempC(tempMotorRaw);
            int? airTempC = TempC(tempArRaw);

            double lambda = lambdaWBRaw / 1000.0;
            double batteryV = bateriaRaw / 10.0;
            double mapBar = mapRaw / 100.0;
            double tpsPct = tps1Raw / 10.0;
            double pedalAceleradorPct = pedal1Raw / 10.0;
            double pedalFreioPct = pedal2Raw / 10.0;
            double speedKmh = velocidadeRaw / 10.0;

            // sanidade aditiva (mesmos campos/limites do JS)
            var valores = new Dictionary<string, double?>
            {
                ["rpm"] = rpm,
                ["batteryV"] = batteryV,
                ["waterTempC"] = waterTempC,
                ["airTempC"] = airTempC,
                ["lambda"] = lambda,
                ["tpsPct"] = tpsPct,
                ["pedalAceleradorPct"] = pedalAceleradorPct,
                ["pedalFreioPct"] = pedalFreioPct,
                ["speedKmh"] = speedKmh,
                ["mapBar"] = mapBar,
            };
            var (ok, motivos) = LeituraPlausivel(valores);

            return new T3000Sample
            {
                TMono = tMono ?? 0,
                BytesLen = len,
                Rpm = rpm,
                BatteryV = batteryV,
                MapBar = mapBar,
                TpsPct = tpsPct,
                Tps2Pct = tps2Raw / 10.0,
                TpsTargetPct = tpsAlvoRaw / 10.0,
                AirTempC = airTempC,
                WaterTempC = waterTempC,
                Lambda = lambda,
                LambdaNB = lambdaNBRaw,
                LambdaWBRaw = lambdaWBRaw,
                MapaAtual = mapaAtual,
                AnguloInjecao = anguloInjecaoRaw,
                ConsumoBorboleta = consumoRaw / 100.0,
                AtuacaoCorteIgnicao = atuacaoCorteIgnicao,
                PedalAceleradorPct = pedalAceleradorPct,
                PedalFreioPct = pedalFreioPct,
                PressaoFreioBar = pressaoFreioRaw.HasValue ? pressaoFreioRaw.Value / 100.0 : (double?)null,
                SpeedKmh = speedKmh,
                AccelXg = accelXRaw.HasValue ? accelXRaw.Value / 1000.0 : (double?)null,
                AccelYg = accelYRaw.HasValue ? accelYRaw.Value / 1000.0 : (double?)null,
                AccelZg = accelZRaw.HasValue ? accelZRaw.Value / 1000.0 : (double?)null,
                FuelInjectionRaw = time4,
                FuelInjectionBalanced = time4Balanced,
                FuelInjectionSpread = time4Spread,
                FuelInjDutyA = fuelInjDutyA,
                FuelInjDutyB = fuelInjDutyB.ToArray(),
                FuelInjDutyC = fuelInjDutyC.ToArray(),
                FuelTimeA = fuelTimeA,
                Alarmes = new Dictionary<string, bool>
                {
                    ["excessoRotacao"] = Bit32(alarmesBits, 0),
                    ["excessoPressao"] = Bit32(alarmesBits, 1),
                    ["excessoTempMotor"] = Bit32(alarmesBits, 2),
                    ["excessoAberturaInjetor"] = Bit32(alarmesBits, 3),
                    ["baixaPressaoOleo"] = Bit32(alarmesBits, 4),
                    ["wbMinimo"] = Bit32(alarmesBits, 5),
                    ["wbMaximo"] = Bit32(alarmesBits, 6),
                    ["nbMinimo"] = Bit32(alarmesBits, 7),
                    ["nbMaximo"] = Bit32(alarmesBits, 8),
                    ["baixaPressaoCombustivel"] = Bit32(alarmesBits, 9),
                    ["alertaNivelCombustivel"] = Bit32(alarmesBits, 10),
                },
                StatusSinais = new Dictionary<string, bool>
                {
                    ["corteArrancada"] = Bit(b18, 0),
                    ["corteAquecimento"] = Bit(b18, 1),
                    ["sinalNitro"] = Bit(b18, 2),
                    ["arCondicionado"] = Bit(b18, 3),
                    ["sinalBooster"] = Bit(b18, 4),
                    ["boostPlus"] = Bit(b18, 5),
                    ["saidaTrocaMarcha"] = Bit(b18, 6),
                    ["alarme"] = Bit(b18, 7),
                },
                CronometroParcialS = cronoParcial.HasValue ? cronoParcial.Value / 1000.0 : (double?)null,
                CronometroTotalS = cronoTotal.HasValue ? cronoTotal.Value / 1000.0 : (double?)null,
                Marcha = null,
                EgtC = null,
                EgtOutOfRange = false,
                EcuErrorBits = alarmesBits,
                SensoresExternos = sensoresExternos,
                LeituraPlausivel = ok,
                SanidadeMotivos = motivos,
            };
        }

        public static readonly byte[] AckBytes = { 0x41, 0x43, 0x4B };
        public static readonly byte[] RiBytes = { 0x52, 0x49 };

        public static bool IsAckOk(byte[] buf) =>
            buf is { Length: >= 2 } && buf[0] == 0x4F && buf[1] == 0x4B;
    }
}
