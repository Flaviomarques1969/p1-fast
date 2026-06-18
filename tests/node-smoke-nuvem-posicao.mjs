// node-smoke-nuvem-posicao.mjs — prova OFFLINE (sem rede) do cálculo da nuvem:
// GPS cru da volta real -> posição pronta (fração de arco + x,y). Não toca em produção.
import { calcularPosicao, emFaixaBrasilia } from '../tools/nuvem-posicao.mjs';
import { carregarVolta } from '../tools/nuvem-replay-gps.mjs';

let ok = 0, fail = 0;
const t = (nome, cond) => { if (cond) { ok++; console.log('  ok ', nome); } else { fail++; console.log('  FAIL', nome); } };

const a = carregarVolta('23-05');
t('fixture da volta real carrega (1013 pts)', a.length === 1013);

let fmin = 1, fmax = 0, validos = 0, dentroQuadro = 0;
for (const [, lat, lng] of a) {
  const pos = calcularPosicao({ lat, lng });
  if (!pos) continue;
  validos++;
  fmin = Math.min(fmin, pos.frac); fmax = Math.max(fmax, pos.frac);
  if (pos.x >= 120 && pos.x <= 720 && pos.y >= 100 && pos.y <= 780) dentroQuadro++;
}
t('todas as leituras viram posição (válidas = total)', validos === a.length);
t('posições caem dentro do quadro da pista', dentroQuadro === validos);
t('a volta cobre quase toda a pista (frac 0..1)', fmin < 0.05 && fmax > 0.95);

// rejeição de ruído / dado inválido (a nuvem não inventa)
t('rejeita ponto fora de Brasília', calcularPosicao({ lat: -23.5, lng: -46.6 }) === null);
t('rejeita lat/lng ausente', calcularPosicao({ lat: -15.77 }) === null);
t('emFaixaBrasilia confere', emFaixaBrasilia(-15.773, -47.90) === true && emFaixaBrasilia(0, 0) === false);

console.log(`\nnuvem-posicao (offline): ${ok} ok / ${fail} fail`);
process.exit(fail ? 1 : 0);
