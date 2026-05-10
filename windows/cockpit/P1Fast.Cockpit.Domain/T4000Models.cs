// Records de saída do T4000PacketParser. Imutáveis, value equality,
// 1:1 com os objetos retornados por src/telemetry/t4000-packet-parser.js.

namespace P1Fast.Cockpit.Domain;

/// <summary>Pacote 1: RPM, velocidade, óleo (pressão e temperatura).</summary>
public sealed record T4000Packet1(int Rpm, double SpeedKmh, double OilPressBar, double OilTempC);

/// <summary>Pacote 2: água, combustível (pressão), bateria, TPS.</summary>
public sealed record T4000Packet2(double WaterTempC, double FuelPressBar, double BatteryV, double TpsPct);

/// <summary>Pacote 3: MAP, ar, EGT (cru + flag out-of-range), lambda.</summary>
public sealed record T4000Packet3(double MapBar, double AirTempC, int EgtC, bool EgtOutOfRange, double Lambda);

/// <summary>Pacote 4: combustível (temperatura), marcha, bitfield de erro da ECU.</summary>
public sealed record T4000Packet4(double FuelTempC, int Marcha, int EcuErrorBits);

/// <summary>Pacote 5: 5 bytes reservados (zero-padding) + checksum modular 256.</summary>
public sealed record T4000Packet5(IReadOnlyList<byte> ReservedBytes, int Checksum);

/// <summary>Bloco de 5×8 bytes que chega do barramento — entrada de ParseCycle e ValidateChecksum.</summary>
public sealed record T4000CycleBytes(
    IReadOnlyList<byte> P1,
    IReadOnlyList<byte> P2,
    IReadOnlyList<byte> P3,
    IReadOnlyList<byte> P4,
    IReadOnlyList<byte> P5
);

/// <summary>Resultado da verificação de checksum: Ok = (Expected == Got).</summary>
public sealed record T4000ChecksumResult(bool Ok, int Expected, int Got);

/// <summary>Sample fundido dos pacotes 1..4 (16 grandezas físicas).</summary>
public sealed record T4000Sample(
    int Rpm,
    double SpeedKmh,
    double OilPressBar,
    double OilTempC,
    double WaterTempC,
    double FuelPressBar,
    double BatteryV,
    double TpsPct,
    double MapBar,
    double AirTempC,
    int EgtC,
    bool EgtOutOfRange,
    double Lambda,
    double FuelTempC,
    int Marcha,
    int EcuErrorBits
);

/// <summary>Resultado de ParseCycle: ok, checksum, sample fundido, bytes reservados do pacote 5.</summary>
public sealed record T4000CycleResult(
    bool Ok,
    T4000ChecksumResult Checksum,
    T4000Sample Sample,
    IReadOnlyList<byte> ReservedBytes
);

/// <summary>Erro emitido pelo feeder quando ressincroniza ou ParseCycle lança.</summary>
public sealed record T4000FeederError(string Stage, string Reason);
