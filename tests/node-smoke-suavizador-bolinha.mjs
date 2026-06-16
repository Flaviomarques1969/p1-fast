// Smoke do suavizador da bolinha (item 2). Roda: node tests/node-smoke-suavizador-bolinha.mjs
import { criarSuavizador } from '../web/cockpit/suavizador-bolinha.js';

let ok = 0, fail = 0;
function check(nome, cond) { if (cond) { ok++; } else { fail++; console.log('FALHOU:', nome); } }
const aprox = (x, y, tol = 1e-6) => Math.abs(x - y) <= tol;

// 1. sem leitura ainda -> null
{ const s = criarSuavizador(); check('vazio devolve null', s.fracAt(0) === null); }

// 2. uma leitura só -> segura nela, sem perdido
{ const s = criarSuavizador(); s.push({ t: 1000, frac: 0.2 });
  const r = s.fracAt(1000); check('1 leitura: frac', r && aprox(r.frac, 0.2)); check('1 leitura: não perdido', r && !r.perdido); }

// 3. entre duas leituras -> desliza no meio
{ const s = criarSuavizador(); s.push({ t: 1000, frac: 0.20 }); s.push({ t: 2000, frac: 0.30 });
  const r = s.fracAt(1500); check('meio do caminho = 0.25', r && aprox(r.frac, 0.25));
  const q = s.fracAt(2000); check('fim do caminho = 0.30', q && aprox(q.frac, 0.30)); }

// 4. virada de volta (frac 0.95 -> 0.05) interpola sem dar ré (passa por 1.0/0.0)
{ const s = criarSuavizador(); s.push({ t: 1000, frac: 0.95 }); s.push({ t: 2000, frac: 0.05 });
  const r = s.fracAt(1500); // 0.95 + (1.05-0.95)*0.5 = 1.0 -> %1 = 0.0
  check('virada de volta no meio ~ 0.0', r && (aprox(r.frac, 0.0) || aprox(r.frac, 1.0, 1e-6)));
  const a = s.fracAt(1250); check('virada antes do ponto: ~0.975', a && aprox(a.frac, 0.975)); }

// 5. sinal velho (> janela) -> segura na última e marca perdido
{ const s = criarSuavizador({ janelaMaxMs: 2500 }); s.push({ t: 1000, frac: 0.4 }); s.push({ t: 2000, frac: 0.5 });
  const r = s.fracAt(5000); check('sinal velho: perdido=true', r && r.perdido === true);
  check('sinal velho: segura na última', r && aprox(r.frac, 0.5)); }

// 6. dedup por timestamp não cria salto
{ const s = criarSuavizador(); s.push({ t: 1000, frac: 0.4 }); s.push({ t: 1000, frac: 0.42 });
  const e = s._estado(); check('dedup: sem ponto anterior espúrio', e.a === null && aprox(e.b.frac, 0.42)); }

console.log(`\nsuavizador-bolinha: ${ok} passaram, ${fail} falharam`);
process.exit(fail ? 1 : 0);
