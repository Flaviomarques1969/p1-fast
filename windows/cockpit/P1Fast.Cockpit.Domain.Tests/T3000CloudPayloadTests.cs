// Trava o payload que o .exe manda pra nuvem contra o que o app P1 Fast escuta
// (web/cockpit/cloud-bridge.js stripSample). Nomes de campo errados = cloud vazio.

using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class T3000CloudPayloadTests
{
    private static T3000Sample Amostra(T3000Alarmes? alarmes = null)
    {
        var bloco = T3000RiBlockBuilder.Build(
            rpm: 6200, batteryV: 13.2, mapBar: 1.1, tpsPct: 80, waterTempC: 95,
            lambda: 0.9, speedKmh: 150, mapaAtual: 5, alarmes: alarmes);
        return T3000RiBlockParser.Parse(bloco)!;
    }

    [Fact]
    public void Tem_todos_os_campos_canonicos_do_motor_e_pilotagem()
    {
        var p = T3000CloudPayload.Build(Amostra(), tWallMs: 1234);
        foreach (var chave in new[]
        {
            "source", "parserVersion", "tWall", "bytesLen",
            "rpm", "batteryV", "mapBar", "tpsPct", "tpsTargetPct",
            "airTempC", "waterTempC", "lambda", "mapaAtual",
            "pedalAceleradorPct", "pedalFreioPct", "pressaoFreioBar", "speedKmh",
            "accelXg", "accelYg", "accelZg", "fuelTimeA",
            "alarmes", "cronometroParcialS", "cronometroTotalS",
        })
        {
            Assert.True(p.ContainsKey(chave), $"falta o campo '{chave}' no payload");
        }
    }

    [Fact]
    public void Valores_e_source_batem_com_o_sample()
    {
        var p = T3000CloudPayload.Build(Amostra(), tWallMs: 999);
        Assert.Equal("t3000-usb", p["source"]);
        Assert.Equal(6200, p["rpm"]);
        Assert.Equal(5, p["mapaAtual"]);          // marcha
        Assert.Equal(999L, p["tWall"]);
    }

    [Fact]
    public void Alarmes_saem_em_camelCase_como_o_parser_JS()
    {
        var alarmes = new T3000Alarmes(
            false, false, false, false, true, false, false, false, false, false, false); // baixaPressaoOleo
        var p = T3000CloudPayload.Build(Amostra(alarmes), tWallMs: 1);

        var dict = Assert.IsType<Dictionary<string, object?>>(p["alarmes"]);
        Assert.True((bool)dict["baixaPressaoOleo"]!);
        Assert.False((bool)dict["excessoRotacao"]!);
        // chaves canônicas presentes
        foreach (var k in new[] { "excessoRotacao", "excessoTempMotor", "baixaPressaoOleo",
                                  "wbMaximo", "baixaPressaoCombustivel", "alertaNivelCombustivel" })
            Assert.True(dict.ContainsKey(k), $"falta alarme '{k}'");
    }
}
