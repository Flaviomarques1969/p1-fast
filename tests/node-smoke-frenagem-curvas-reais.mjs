// node-smoke-frenagem-curvas-reais.mjs — prova que o Command Box produz a
// frenagem por curva a partir das voltas reais do Bubi (fixture local), com a
// LINHA-IDEAL = trail clássico PRESCRITO do tipo (porrada+escadinha / residual),
// volta real sobreposta quando há dado, e NENHUMA curva de freada em branco.
// Roda: node tests/node-smoke-frenagem-curvas-reais.mjs

import fs from 'node:fs';
import { construirFrenagemRealPorCurva } from '../web/command-box/frenagem-curvas-reais.js';
import { TIPO_POR_CURVA } from '../web/command-box/tipos-curva-brasilia.js';

const fixture = JSON.parse(
  fs.readFileSync(new URL('../web/command-box/fixtures/passagens-bubi-brasilia.v1.json', import.meta.url), 'utf8')
);

let ok = 0, fail = 0;
function check(name, cond) {
  if (cond) { ok++; console.log('✓ ' + name); }
  else { fail++; console.log('✗ ' + name); }
}

const curvas = construirFrenagemRealPorCurva(fixture);

check('CR-01 devolve 8 curvas (ordem da pista)', curvas.length === 8);
check('CR-02 toda curva tem índice + nome', curvas.every(c => Number.isInteger(c.curveIdx) && typeof c.curva === 'string'));

const comFreada = curvas.filter(c => Array.isArray(c.live));
check('CR-03 a maioria das curvas tem volta real medida (>=4 de 8)', comFreada.length >= 4);
console.log(`   (curvas com volta real: ${comFreada.length}/8 — ${comFreada.map(c => 'C' + (c.curveIdx + 1)).join(' ')})`);

check('CR-04 toda curva com volta real tem live de 18 pontos, 0..100',
  comFreada.every(c => c.live.length === 18 && c.live.every(v => v >= 0 && v <= 100)));
check('CR-05 toda curva com volta real tem pico de freio (>=30%)',
  comFreada.every(c => Math.max(...c.live) >= 30));
check('CR-06 soltou e freioMin válidos',
  comFreada.every(c => (c.soltou === 'progressivo' || c.soltou === 'de uma vez') && /^\d+%$/.test(c.freioMin)));
check('CR-07 fonte = física do GPS (sem sensor ainda)',
  comFreada.every(c => c.fonteFreio === 'simulado-fisica'));
check('CR-08 mostra a melhor volta por padrão (deltaM = 0 vs a própria referência)',
  comFreada.every(c => c.deltaM === 0));

// CR-09: pedir uma volta específica troca a passagem mostrada (e pode dar delta ≠ 0)
const curvasV1 = construirFrenagemRealPorCurva(fixture, { volta: 1 });
const algumaComV1 = curvasV1.find(c => Array.isArray(c.live) && c.voltasDisponiveis.includes(1));
check('CR-09 pedir uma volta específica mostra aquela volta', !!algumaComV1 && algumaComV1.voltaMostrada === 1);

// CR-10: curva de freada sem volta real utilizável é declarada honestamente (semDadoReal + motivo),
//        NUNCA fica em branco — carrega o ideal do tipo pra desenhar.
const soIdeal = curvas.filter(c => c.semDadoReal);
check('CR-10 curva sem volta real é declarada (semDadoReal + motivo), nunca inventada',
  soIdeal.every(c => c.semDadoReal === true && typeof c.motivo === 'string' && !c.live));
if (soIdeal.length) console.log(`   (só ideal do tipo: ${soIdeal.map(c => 'C' + (c.curveIdx + 1) + ' ' + c.curva).join(' · ')})`);

// CR-11: toda curva carrega o TIPO definitivo + o trail próprio do tipo
check('CR-11 toda curva tem tipo + rótulo + formato + texto fácil do tipo',
  curvas.every(c => c.tipo && c.rotuloTipo && c.formatoTipo && c.textoFacilTipo));

// CR-12: os tipos batem com a decisão definitiva do Flávio (cada curva, seu tipo)
check('CR-12 tipo de cada curva = padrão definitivo (decisão Flávio 13/06)',
  curvas.every(c => c.tipo === TIPO_POR_CURVA[c.curva]));
console.log(`   (${curvas.map(c => 'C' + (c.curveIdx + 1) + '=' + c.tipo).join(' ')})`);

// CR-13: SF (Vitória) = sem freada POR TIPO (pé embaixo) — sem ideal, sem live, não confunde com dado ralo
const vit = curvas.find(c => c.curva === 'CURVA DA VITÓRIA');
check('CR-13 curva SF é "sem freada por tipo" (sem ideal nem live)',
  vit && vit.tipo === 'SF' && vit.semFreadaPorTipo === true && !vit.ideal && !vit.live && !vit.semDadoReal);

// CR-14: curva com volta real traz a referência (melhor) e o live SOBE e DESCE (zona real, não cortada)
check('CR-14 curva com volta real tem ref[18] e o live desce após o pico (zona real)',
  comFreada.every(c => Array.isArray(c.ref) && c.ref.length === 18
    && c.live.indexOf(Math.max(...c.live)) < 16 && c.live[17] < Math.max(...c.live) * 0.85));

// ── NOVO (Etapa 2a-bis): a linha-IDEAL é o trail PRESCRITO do tipo, sempre presente ──
const deFreada = curvas.filter(c => !c.semFreadaPorTipo); // todas menos a SF
check('CR-15 toda curva de freada tem ideal[18] em 0..100 — NUNCA em branco',
  deFreada.length === 7 && deFreada.every(c => Array.isArray(c.ideal) && c.ideal.length === 18
    && c.ideal.every(v => v >= 0 && v <= 100)));

const classicos = deFreada.filter(c => ['T0', 'T1', 'T5'].includes(c.tipo));
check('CR-16 tipos clássicos (T0/T1/T5): ideal dá a PORRADA (pico ~100) e DESCE em escadinha',
  classicos.length > 0 && classicos.every(c => Math.max(...c.ideal) >= 95 && c.ideal[17] < Math.max(...c.ideal)));

const residuais = deFreada.filter(c => ['T2', 'T4'].includes(c.tipo));
check('CR-17 tipos residuais (T2/T4): ideal é parcial (pico ~60–70) com PATAMAR (≥3 pontos iguais)',
  residuais.length > 0 && residuais.every(c => {
    const mx = Math.max(...c.ideal);
    const moda = c.ideal.reduce((m, v) => (c.ideal.filter(x => x === v).length > (c.ideal.filter(x => x === m).length) ? v : m), c.ideal[0]);
    const repete = c.ideal.filter(x => x === moda).length;
    return mx >= 60 && mx <= 70 && repete >= 3;
  }));

// CR-18: Bruxa, Placar e "S" (as que ficavam em branco) agora mostram o trail do tipo
const reabilitadas = ['CURVA DA BRUXA', 'CURVA DO PLACAR', 'CURVA "S"'];
check('CR-18 Bruxa/Placar/"S" deixam de ficar em branco (têm ideal mesmo sem volta real)',
  reabilitadas.every(nome => {
    const c = curvas.find(x => x.curva === nome);
    return c && Array.isArray(c.ideal) && c.ideal.length === 18 && Math.max(...c.ideal) > 0;
  }));

console.log(`\nfrenagem-curvas-reais: ${ok} ok / ${fail} fail`);
process.exit(fail ? 1 : 0);
