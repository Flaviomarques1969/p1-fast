// GpsCloudPayload — converte uma amostra do RaceBox no payload do evento "gps"
// que o app P1 Fast / página /painel escutam no canal Supabase "cockpit-bubi-live".
//
// Os NOMES dos campos têm que bater 1:1 com o cloudSend('gps', …) da página web
// (web/teste-aparelhos/index.html, linha ~500):
//   { lat, lng, kmh, numSV, fix, accM, tWall }
// Repare: longitude vai em "lng" (não "lon") e velocidade em "kmh". Se divergir,
// quem assiste renderiza o GPS vazio. Por isso fica no domínio, coberto por teste.
//
// Com o ADR-024 amendment 6, é o .exe (não mais a página web) quem emite este
// evento — o RaceBox passa a ser lido nativamente no notebook (RaceBoxBleReader).

using System.Collections.Generic;

namespace P1Fast.Cockpit.Domain;

public static class GpsCloudPayload
{
    /// <summary>Evento de broadcast do GPS (mesmo canal do "sample").</summary>
    public const string Event = "gps";

    /// <summary>Monta o dicionário (serializável como JSON) a partir da amostra do RaceBox.</summary>
    public static Dictionary<string, object?> Build(RaceBoxGpsSample s, long tWallMs)
    {
        ArgumentNullException.ThrowIfNull(s);
        return new Dictionary<string, object?>
        {
            ["lat"] = s.Lat,
            ["lng"] = s.Lon,     // página web usa "lng" pra longitude
            ["kmh"] = s.SpeedKmh,
            ["numSV"] = s.NumSV,
            ["fix"] = s.Fix,
            ["accM"] = s.HAccM,
            ["tWall"] = tWallMs,
        };
    }
}
