// ═══════════════════════════════════════════════════════════
// Geometry2D — utilitários de geometria 2D pura (cross-platform)
// ═══════════════════════════════════════════════════════════
// Sem dep de CoreGraphics/SwiftUI: opera em Double puro pra rodar
// no smoke harness e ser exercitável fora do app iOS.

import Foundation

public enum Geometry2D {
    /// Distância 2D de `(px, py)` até o segmento `[(ax,ay), (bx,by)]`.
    /// Projeta o ponto na reta infinita, clampa o parâmetro `t` em [0,1]
    /// pra ficar dentro do segmento e devolve a euclidiana até a projeção.
    /// Se o segmento degenera num ponto (`|ab|² < epsilon`), cai pra
    /// distância euclidiana até `a`.
    public static func pointToSegmentDistance(
        px: Double, py: Double,
        ax: Double, ay: Double,
        bx: Double, by: Double
    ) -> Double {
        let abx = bx - ax
        let aby = by - ay
        let apx = px - ax
        let apy = py - ay
        let lenSq = abx * abx + aby * aby
        if lenSq < 1e-9 {
            return (apx * apx + apy * apy).squareRoot()
        }
        let t = max(0, min(1, (apx * abx + apy * aby) / lenSq))
        let projX = ax + t * abx
        let projY = ay + t * aby
        let dx = px - projX
        let dy = py - projY
        return (dx * dx + dy * dy).squareRoot()
    }
}
