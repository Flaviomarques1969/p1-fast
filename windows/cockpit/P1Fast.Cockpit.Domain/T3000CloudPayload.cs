// T3000CloudPayload — converte um T3000Sample no payload canônico que o app
// P1 Fast escuta no canal Supabase "cockpit-bubi-live" (evento "sample").
//
// Os NOMES dos campos têm que bater 1:1 com web/cockpit/cloud-bridge.js
// (stripSample) e com o parser JS (web/cockpit/t3000-usb-parser.js) — em
// especial o objeto `alarmes` em camelCase. Se divergir, o cloud renderiza
// vazio. Por isso fica no domínio, coberto por teste.

using System.Collections.Generic;

namespace P1Fast.Cockpit.Domain;

public static class T3000CloudPayload
{
    /// <summary>Monta o dicionário do payload (serializável como JSON) a partir do sample.</summary>
    public static Dictionary<string, object?> Build(T3000Sample s, long tWallMs)
    {
        ArgumentNullException.ThrowIfNull(s);
        return new Dictionary<string, object?>
        {
            ["source"] = T3000Sample.Source,
            ["parserVersion"] = T3000Sample.ParserVersion,
            ["tWall"] = tWallMs,
            ["bytesLen"] = s.BytesLen,
            // motor
            ["rpm"] = s.Rpm,
            ["batteryV"] = s.BatteryV,
            ["mapBar"] = s.MapBar,
            ["tpsPct"] = s.TpsPct,
            ["tpsTargetPct"] = s.TpsTargetPct,
            ["airTempC"] = s.AirTempC,
            ["waterTempC"] = s.WaterTempC,
            ["lambda"] = s.Lambda,
            ["mapaAtual"] = s.MapaAtual,
            // pilotagem
            ["pedalAceleradorPct"] = s.PedalAceleradorPct,
            ["pedalFreioPct"] = s.PedalFreioPct,
            ["pressaoFreioBar"] = s.PressaoFreioBar,
            ["speedKmh"] = s.SpeedKmh,
            ["accelXg"] = s.AccelXg,
            ["accelYg"] = s.AccelYg,
            ["accelZg"] = s.AccelZg,
            // cilindros
            ["fuelTimeA"] = s.FuelTimeA,
            // alarmes (camelCase — igual ao parser JS) + cronômetros
            ["alarmes"] = AlarmesDict(s.Alarmes),
            ["cronometroParcialS"] = s.CronometroParcialS,
            ["cronometroTotalS"] = s.CronometroTotalS,
        };
    }

    private static Dictionary<string, object?> AlarmesDict(T3000Alarmes a) => new()
    {
        ["excessoRotacao"] = a.ExcessoRotacao,
        ["excessoPressao"] = a.ExcessoPressao,
        ["excessoTempMotor"] = a.ExcessoTempMotor,
        ["excessoAberturaInjetor"] = a.ExcessoAberturaInjetor,
        ["baixaPressaoOleo"] = a.BaixaPressaoOleo,
        ["wbMinimo"] = a.WbMinimo,
        ["wbMaximo"] = a.WbMaximo,
        ["nbMinimo"] = a.NbMinimo,
        ["nbMaximo"] = a.NbMaximo,
        ["baixaPressaoCombustivel"] = a.BaixaPressaoCombustivel,
        ["alertaNivelCombustivel"] = a.AlertaNivelCombustivel,
    };
}
