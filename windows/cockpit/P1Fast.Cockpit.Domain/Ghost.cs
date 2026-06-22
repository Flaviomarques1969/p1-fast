// Ghost — geometria do cockpit que compara a passagem do carro com a referência:
// acha o ÁPICE (ponto mais fechado da curva) e calcula a BOLINHA (distância +
// direção até o ápice ideal). Port fiel de:
//   web/cockpit/apice-calculator.js  (acharApice)
//   web/cockpit/trecho-detector.js   (distMeters / bearingDeg / apexErrorAngleDeg)
//   web/cockpit/live-data-bridge.js  (_atualizarBolinhaApiceAoVivo)
//
// Decisão Flávio 27/05: ápice = lugar mais dentro da curva (máxima curvatura)
// na melhor passagem daquela configuração de carro+pneu. A bolinha mostra a
// CORREÇÃO ("siga a bolinha"), não o erro.

namespace P1Fast.Cockpit.Domain;

/// <summary>Ponto GPS (lat/lng).</summary>
public sealed record PontoGps(double Lat, double Lng);

/// <summary>Resultado do cálculo de ápice: ponto mais fechado, índice e raio de curvatura (m).</summary>
public sealed record ApiceResultado(PontoGps Ponto, int Idx, double RaioM);

/// <summary>A bolinha do ápice ao vivo: distância (m), direção (0..360°, 0=frente) e estado.</summary>
public sealed record BolinhaApice(double DistM, double? AngleDeg, ApexEstado Estado);

public static class Ghost
{
    private const double Deg2Rad    = Math.PI / 180.0;
    private const double Rad2Deg    = 180.0 / Math.PI;
    private const double EarthRM    = 6_378_137;   // WGS84 (igual ao JS)
    private const double MPerDegLat = 111_132.0;

    // ── Geometria (port de trecho-detector.js) ──────────────────────

    /// <summary>Distância aproximada (m) entre dois pontos GPS — equirectangular (boa pra &lt;2 km).</summary>
    public static double DistMeters(PontoGps a, PontoGps b)
    {
        var lat1 = a.Lat * Deg2Rad;
        var lat2 = b.Lat * Deg2Rad;
        var dLat = lat2 - lat1;
        var dLng = (b.Lng - a.Lng) * Deg2Rad;
        var x = dLng * Math.Cos((lat1 + lat2) / 2);
        var y = dLat;
        return Math.Sqrt(x * x + y * y) * EarthRM;
    }

    /// <summary>Rumo em graus (0=norte, 90=leste) de "from" pra "to".</summary>
    public static double BearingDeg(PontoGps from, PontoGps to)
    {
        var lat1 = from.Lat * Deg2Rad;
        var lat2 = to.Lat * Deg2Rad;
        var dLng = (to.Lng - from.Lng) * Deg2Rad;
        var y = Math.Sin(dLng) * Math.Cos(lat2);
        var x = Math.Cos(lat1) * Math.Sin(lat2) -
                Math.Sin(lat1) * Math.Cos(lat2) * Math.Cos(dLng);
        return (Math.Atan2(y, x) * Rad2Deg + 360) % 360;
    }

    /// <summary>
    /// Direção do ápice no referencial do CARRO (heading = 0° = "pra cima").
    /// 0=frente (antecipou), 90=direita, 180=atrás (atrasou), 270=esquerda.
    /// </summary>
    public static double ApexErrorAngleDeg(PontoGps carPos, double carHeadingDeg, PontoGps apexIdeal)
        => (BearingDeg(carPos, apexIdeal) - carHeadingDeg + 360) % 360;

    // ── Ápice (port de apice-calculator.js) ─────────────────────────

    private static double MetrosPorGrauLng(double latMedia) => 111_320.0 * Math.Cos(latMedia * Deg2Rad);

    private static (double X, double Y)[] ParaMetrosLocais(IReadOnlyList<PontoGps> pontos)
    {
        double latMedia = 0, lngMedia = 0;
        foreach (var p in pontos) { latMedia += p.Lat; lngMedia += p.Lng; }
        latMedia /= pontos.Count; lngMedia /= pontos.Count;
        var mLng = MetrosPorGrauLng(latMedia);
        var outp = new (double X, double Y)[pontos.Count];
        for (var i = 0; i < pontos.Count; i++)
            outp[i] = ((pontos[i].Lng - lngMedia) * mLng, (pontos[i].Lat - latMedia) * MPerDegLat);
        return outp;
    }

    /// <summary>Raio do círculo por 3 pontos (Infinity se colineares).</summary>
    private static double RaioCirculo3Pontos((double X, double Y) p1, (double X, double Y) p2, (double X, double Y) p3)
    {
        var ax = p2.X - p1.X; var ay = p2.Y - p1.Y;
        var bx = p3.X - p1.X; var by = p3.Y - p1.Y;
        var d = 2 * (ax * by - ay * bx);
        if (Math.Abs(d) < 1e-9) return double.PositiveInfinity;
        var a2 = ax * ax + ay * ay;
        var b2 = bx * bx + by * by;
        var cx = (by * a2 - ay * b2) / d;
        var cy = (ax * b2 - bx * a2) / d;
        return Math.Sqrt(cx * cx + cy * cy);
    }

    /// <summary>
    /// Acha o ponto de máxima curvatura (menor raio) numa passagem GPS.
    /// Retorna null se a passagem é curta demais ou não há ponto válido.
    /// </summary>
    public static ApiceResultado? AcharApice(IReadOnlyList<PontoGps> pontos, int janela = 4, double raioMinM = 2, double raioMaxM = 200)
    {
        if (pontos is null || pontos.Count < 2 * janela + 1) return null;

        var m = ParaMetrosLocais(pontos);
        var melhorIdx = -1;
        var melhorRaio = double.PositiveInfinity;

        for (var i = janela; i < pontos.Count - janela; i++)
        {
            var r = RaioCirculo3Pontos(m[i - janela], m[i], m[i + janela]);
            if (double.IsNaN(r) || double.IsInfinity(r) || r < raioMinM || r > raioMaxM) continue;
            if (r < melhorRaio) { melhorRaio = r; melhorIdx = i; }
        }

        if (melhorIdx < 0) return null;
        return new ApiceResultado(pontos[melhorIdx], melhorIdx, melhorRaio);
    }

    // ── Bolinha ao vivo (port de _atualizarBolinhaApiceAoVivo) ──────

    /// <summary>
    /// Calcula a bolinha do ápice ao vivo: distância + direção do carro até o
    /// ápice de referência. heading nulo → direção nula (sem rumo confiável).
    /// Estado: dentro de 2 m = mira certa (OkMelhor), fora = OkPior.
    /// </summary>
    public static BolinhaApice CalcularBolinha(PontoGps carPos, double? headingDeg, PontoGps apiceRef)
    {
        var distM = DistMeters(carPos, apiceRef);
        double? angle = headingDeg is { } h && !double.IsNaN(h) ? ApexErrorAngleDeg(carPos, h, apiceRef) : null;
        var estado = distM <= 2 ? ApexEstado.OkMelhor : ApexEstado.OkPior;
        return new BolinhaApice(distM, angle, estado);
    }
}
