// suavizador-bolinha.js — ITEM 2 do plano da bolinha (Flávio 2026-06-16).
// Faz a bolinha DESLIZAR pela pista entre as leituras de GPS (~1 por segundo), em vez de
// teleportar ~28 m a cada leitura. Trabalha na FRAÇÃO DE ARCO do traço (0..1): assim a
// bolinha fica sempre EM CIMA da pista desenhada e segue as curvas.
//
// Puro (sem tela): recebe leituras { t (ms), frac (0..1) } e devolve a fração suavizada
// no instante pedido. Quem desenha converte frac -> ponto com path.getPointAtLength(frac*L).
//
// Regras honestas:
//  - Entre duas leituras: interpola pela fração de tempo (desliza).
//  - Virada de volta (frac cai de ~1 pra ~0): trata sem dar ré.
//  - Sinal velho (> janelaMaxMs sem leitura nova): NÃO inventa trajeto — segura na última e
//    marca perdido=true (o painel pode acender "sinal perdido").

export function criarSuavizador({ janelaMaxMs = 2500 } = {}) {
  let a = null, b = null; // duas leituras mais recentes: a (anterior) e b (atual)
  return {
    push(leitura) {
      if (!leitura || typeof leitura.t !== 'number' || typeof leitura.frac !== 'number') return;
      if (b && leitura.t === b.t) { b = leitura; return; } // dedup por timestamp
      a = b; b = leitura;
    },
    // fração suavizada em tNow. Retorna { frac, perdido } ou null se ainda não há leitura.
    fracAt(tNow) {
      if (!b) return null;
      if (tNow - b.t > janelaMaxMs) return { frac: b.frac, perdido: true };
      if (!a || tNow <= a.t) return { frac: b.frac, perdido: false };
      const dt = (b.t - a.t) || 1;
      const f = Math.min(1, Math.max(0, (tNow - a.t) / dt));
      let s0 = a.frac, s1 = b.frac;
      if (s1 < s0) s1 += 1;                 // virada de volta (cruzou o ponto inicial do traço)
      const s = (s0 + (s1 - s0) * f) % 1;
      return { frac: s, perdido: false };
    },
    _estado() { return { a, b }; },
  };
}
