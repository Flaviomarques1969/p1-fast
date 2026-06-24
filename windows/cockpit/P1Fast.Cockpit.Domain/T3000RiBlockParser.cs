// T3000RiBlockParser.cs — porte C# do decodificador do bloco RI da Injepro
// T3000/T4000, a partir de web/cockpit/t3000-usb-parser.js (VERSÃO 2,
// engenharia reversa do software oficial T LINE v3.3.7).
//
// Este é o parser do caminho USB REAL (bloco ~410-490 bytes, little-endian),
// distinto do T4000PacketParser (que decodifica o frame CAN de 40 bytes / 5
// pacotes vindo de um adaptador CAN-USB). A central plugada direto na USB
// fala o protocolo RI; é este parser que vale para o .exe nativo.
//
// Protocolo de aquisição (ver T3000UsbReader): handshake "ACK"→"OK", depois
// "RI" (Read Instruments) por iteração, recebendo o bloco binário aqui
// decodificado.
//
// Layout little-endian (offsets confirmados contra o oficial):
//   0   u16  RPM            direto          46  u16  TPS1            ÷10 → %
//   2   u16  Bateria        ÷10 → V         50  u16  TPS alvo        ÷10 → %
//   4   i16  MAP            ÷100 → bar      52  u16  Pedal acel.     ÷10 → %
//   58  i16  Temp. motor    °C (água)       54  u16  Pedal 2/freio   ÷10 → %
//   62  u16  Lambda WB      ÷1000 → λ       56  i16  Temp. ar        °C
//   84  u16×8 tempo inj. A                  102 u16  Velocidade      ÷10 → km/h
//   268 i16  Pressão freio  ÷100 → bar      270 i16  AccelX/Y/Z      ÷1000 → g
//   288 u32  ALARMES (11 bits)              292/296 u32 cronômetros  ÷1000 → s

namespace P1Fast.Cockpit.Domain;

/// <summary>Alarmes do bitfield da central (11 bits em u32 no offset 288).</summary>
public sealed record T3000Alarmes(
    bool ExcessoRotacao,
    bool ExcessoPressao,
    bool ExcessoTempMotor,
    bool ExcessoAberturaInjetor,
    bool BaixaPressaoOleo,
    bool WbMinimo,
    bool WbMaximo,
    bool NbMinimo,
    bool NbMaximo,
    bool BaixaPressaoCombustivel,
    bool AlertaNivelCombustivel)
{
    /// <summary>True se qualquer alarme está ativo.</summary>
    public bool QualquerAtivo =>
        ExcessoRotacao || ExcessoPressao || ExcessoTempMotor || ExcessoAberturaInjetor
        || BaixaPressaoOleo || WbMinimo || WbMaximo || NbMinimo || NbMaximo
        || BaixaPressaoCombustivel || AlertaNivelCombustivel;
}

/// <summary>
/// Amostra decodificada do bloco RI. Campos opcionais (null) quando o bloco
/// é curto demais para contê-los ou quando o sensor físico não existe — pra
/// não disparar alerta falso a jusante.
/// </summary>
public sealed record T3000Sample
{
    public const string Source = "t3000-usb";
    public const string ParserVersion = "2.0.0";

    public required int Rpm { get; init; }
    public required double BatteryV { get; init; }
    public required double MapBar { get; init; }
    public required double TpsPct { get; init; }
    public required double TpsTargetPct { get; init; }
    public required double PedalAceleradorPct { get; init; }
    public required double PedalFreioPct { get; init; }
    public int? AirTempC { get; init; }
    public int? WaterTempC { get; init; }
    public required double Lambda { get; init; }
    public required int LambdaNbRaw { get; init; }
    public required int MapaAtual { get; init; }
    public required double SpeedKmh { get; init; }
    public double? PressaoFreioBar { get; init; }
    public double? AccelXg { get; init; }
    public double? AccelYg { get; init; }
    public double? AccelZg { get; init; }
    public double? CronometroParcialS { get; init; }
    public double? CronometroTotalS { get; init; }
    public required T3000Alarmes Alarmes { get; init; }
    public required int[] FuelTimeA { get; init; }
    public required uint EcuErrorBits { get; init; }
    public required int BytesLen { get; init; }
    public bool ChecksumOk { get; init; } = true;
}

/// <summary>Decodificador puro do bloco RI (sem IO). Espelha parseT3000RIBlock.</summary>
public static class T3000RiBlockParser
{
    // Handshake/comando do protocolo (ASCII).
    public static readonly byte[] AckBytes = { 0x41, 0x43, 0x4B }; // "ACK"
    public static readonly byte[] RiBytes  = { 0x52, 0x49 };       // "RI"

    /// <summary>True se a resposta do handshake começa com "OK".</summary>
    public static bool IsAckOk(ReadOnlySpan<byte> buf) =>
        buf.Length >= 2 && buf[0] == 0x4F && buf[1] == 0x4B;

    /// <summary>
    /// Critério de aceitação de uma leitura "de verdade" da central: descarta
    /// blocos com valores impossíveis (lixo de endpoint/handshake errado). É o
    /// gate que o leitor USB usa pra confirmar que achou a central certa.
    /// </summary>
    public static bool EhLeituraPlausivel(T3000Sample? s) =>
        s is not null
        && s.Rpm >= 0 && s.Rpm <= 20000
        && s.BatteryV >= 3 && s.BatteryV <= 20;

    private static int U16(ReadOnlySpan<byte> b, int o) => b[o] | (b[o + 1] << 8);

    private static int I16(ReadOnlySpan<byte> b, int o)
    {
        int v = U16(b, o);
        return v > 0x7FFF ? v - 0x10000 : v;
    }

    private static uint U32(ReadOnlySpan<byte> b, int o) =>
        (uint)(b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24));

    private static bool Bit32(uint num, int n) => ((num >> n) & 1) == 1;

    // Sensores de temperatura retornam valores especiais quando não há sonda.
    private static int? TempC(int raw) =>
        raw is -2 or -20 or 0x7FFF or -32768 ? null : raw;

    /// <summary>
    /// Decodifica um bloco RI. Retorna null se o buffer é curto demais
    /// (&lt;110 bytes) — mesmo contrato do JS.
    /// </summary>
    public static T3000Sample? Parse(ReadOnlySpan<byte> buf)
    {
        if (buf.Length < 110) return null;
        int len = buf.Length;

        var fuelTimeA = new int[8];
        for (int i = 0; i < 8; i++) fuelTimeA[i] = U16(buf, 84 + i * 2);

        int? pressaoFreioRaw = len >= 270 ? I16(buf, 268) : null;
        int? accelXRaw = len >= 276 ? I16(buf, 270) : null;
        int? accelYRaw = len >= 276 ? I16(buf, 272) : null;
        int? accelZRaw = len >= 276 ? I16(buf, 274) : null;
        uint alarmesBits = len >= 292 ? U32(buf, 288) : 0u;
        uint? cronoParcial = len >= 296 ? U32(buf, 292) : null;
        uint? cronoTotal = len >= 300 ? U32(buf, 296) : null;

        var alarmes = new T3000Alarmes(
            ExcessoRotacao:          Bit32(alarmesBits, 0),
            ExcessoPressao:          Bit32(alarmesBits, 1),
            ExcessoTempMotor:        Bit32(alarmesBits, 2),
            ExcessoAberturaInjetor:  Bit32(alarmesBits, 3),
            BaixaPressaoOleo:        Bit32(alarmesBits, 4),
            WbMinimo:                Bit32(alarmesBits, 5),
            WbMaximo:                Bit32(alarmesBits, 6),
            NbMinimo:                Bit32(alarmesBits, 7),
            NbMaximo:                Bit32(alarmesBits, 8),
            BaixaPressaoCombustivel: Bit32(alarmesBits, 9),
            AlertaNivelCombustivel:  Bit32(alarmesBits, 10));

        return new T3000Sample
        {
            Rpm = U16(buf, 0),
            BatteryV = U16(buf, 2) / 10.0,
            MapBar = I16(buf, 4) / 100.0,
            TpsPct = U16(buf, 46) / 10.0,
            TpsTargetPct = U16(buf, 50) / 10.0,
            PedalAceleradorPct = U16(buf, 52) / 10.0,
            PedalFreioPct = U16(buf, 54) / 10.0,
            AirTempC = TempC(I16(buf, 56)),
            WaterTempC = TempC(I16(buf, 58)),
            Lambda = U16(buf, 62) / 1000.0,   // banda larga (sensor ativo no Bubi)
            LambdaNbRaw = U16(buf, 60),
            MapaAtual = buf[108] + 1,
            SpeedKmh = U16(buf, 102) / 10.0,
            PressaoFreioBar = pressaoFreioRaw.HasValue ? pressaoFreioRaw.Value / 100.0 : null,
            AccelXg = accelXRaw.HasValue ? accelXRaw.Value / 1000.0 : null,
            AccelYg = accelYRaw.HasValue ? accelYRaw.Value / 1000.0 : null,
            AccelZg = accelZRaw.HasValue ? accelZRaw.Value / 1000.0 : null,
            CronometroParcialS = cronoParcial.HasValue ? cronoParcial.Value / 1000.0 : null,
            CronometroTotalS = cronoTotal.HasValue ? cronoTotal.Value / 1000.0 : null,
            Alarmes = alarmes,
            FuelTimeA = fuelTimeA,
            EcuErrorBits = alarmesBits,
            BytesLen = len,
            ChecksumOk = true,
        };
    }
}
