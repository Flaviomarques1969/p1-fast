// SementeBrasilia — geometria SEMENTE da pista de Brasília embarcada no .exe
// (offline, ADR-024 amendment 6: notebook dedicado liga e já funciona, sem
// depender de rede pra saber onde é a linha de chegada).
//
// Linha de chegada: "no meio da reta dos boxes, após a Curva da Vitória e antes da
// Curva 1" (Flávio 2026-06-24). As coordenadas foram derivadas do TRAÇADO REAL
// (gravação RaceBox de 27/05, web/teste-aparelhos/sim-gps.json): ponto mais próximo
// do meio da reta + perpendicular ao rumo local, ±18 m. Sanidade: o traçado cruza
// essa linha exatamente 4 vezes — as 4 voltas canônicas da gravação.
//
// Quando o marco oficial vier do banco (tabela `marcos`), é só substituir aqui.

namespace P1Fast.Cockpit.Domain;

public static class SementeBrasilia
{
    /// <summary>Ponta A da linha de chegada (meio da reta dos boxes).</summary>
    public static readonly GpsPonto ChegadaA = new(-15.7726876, -47.8999808);

    /// <summary>Ponta B da linha de chegada.</summary>
    public static readonly GpsPonto ChegadaB = new(-15.7729964, -47.8998742);

    /// <summary>Cria um detector de chegada já com a linha de Brasília.</summary>
    public static ChegadaDetector NovoDetectorChegada() => new(ChegadaA, ChegadaB);
}
