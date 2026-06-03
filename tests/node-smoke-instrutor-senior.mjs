// Smoke do Instrutor Sênior — cenários conhecidos de pilotagem
//
// Testa que:
//  - estrategiaIdeal() decide certo nos 4 cenários canônicos
//  - analisarPassagem() classifica execução e produz frase coerente

import { estrategiaIdeal } from '../src/domain/apice-estrategia.js';
import { analisarPassagem } from '../src/domain/instrutor-senior.js';

let ok = 0, fail = 0;
function t(nome, fn) {
  try { fn(); console.log('✓', nome); ok++; }
  catch (e) { console.log('✗', nome, '—', e.message); fail++; }
}

// ── Estratégia ideal ────────────────────────────────────────
t('curva apertada + reta longa depois → TARDIO', () => {
  const e = estrategiaIdeal({
    raioM: 30, retaAntesM: 200, retaDepoisM: 280,
    temCurvaPropxAntes: false, temCurvaPropxDepois: false,
    classificacao: 'apertada', sentido: 'esquerda', comprimentoCurvaM: 70,
  });
  if (e.tipo !== 'tardio') throw new Error('esperava tardio, veio ' + e.tipo);
  if (!e.explicacao) throw new Error('sem explicacao');
});

t('curva apertada antes de outra curva apertada → ANTECIPADO', () => {
  const e = estrategiaIdeal({
    raioM: 28, retaAntesM: 200, retaDepoisM: 30,
    temCurvaPropxAntes: false, temCurvaPropxDepois: true,
    classificacao: 'apertada', sentido: 'esquerda', comprimentoCurvaM: 60,
  });
  if (e.tipo !== 'antecipado') throw new Error('esperava antecipado, veio ' + e.tipo);
});

t('curva rápida e aberta → GEOMÉTRICO', () => {
  const e = estrategiaIdeal({
    raioM: 150, retaAntesM: 80, retaDepoisM: 80,
    temCurvaPropxAntes: false, temCurvaPropxDepois: false,
    classificacao: 'rapida', sentido: 'esquerda', comprimentoCurvaM: 100,
  });
  if (e.tipo !== 'geometrico') throw new Error('esperava geometrico, veio ' + e.tipo);
});

t('curva apertada sem reta significativa depois → GEOMÉTRICO', () => {
  const e = estrategiaIdeal({
    raioM: 35, retaAntesM: 100, retaDepoisM: 50,
    temCurvaPropxAntes: false, temCurvaPropxDepois: false,
    classificacao: 'apertada', sentido: 'esquerda', comprimentoCurvaM: 80,
  });
  if (e.tipo !== 'geometrico') throw new Error('esperava geometrico, veio ' + e.tipo);
});

// ── Análise de passagem ─────────────────────────────────────
function fixtureTrecho() {
  return {
    id: 'seg_test', nome: 'CURVA TESTE',
    entradas: [{ x: 0, y: 0 }],
    saidas: [{ x: 100, y: 0 }],
  };
}
function fixtureGeometria() {
  return {
    raioM: 40, retaAntesM: 150, retaDepoisM: 250,
    temCurvaPropxAntes: false, temCurvaPropxDepois: false,
    classificacao: 'apertada', sentido: 'esquerda', comprimentoCurvaM: 100,
  };
}

t('execução BATEU estratégia tardia → severidade verde', () => {
  const trecho = fixtureTrecho();
  const geo = fixtureGeometria();
  const est = estrategiaIdeal(geo);
  const ana = analisarPassagem({
    trecho, geometria: geo, estrategia: est,
    apiceExecutado: { x: 70, y: 5 }, // depois do meio (50) = tardio
    indicadores: { vPaceKmh: 95 },
  });
  if (ana.severidade !== 'verde') throw new Error('esperava verde, veio ' + ana.severidade);
  if (!ana.bateuEstrategia) throw new Error('deveria bater estratégia');
});

t('execução ANTECIPADA quando estratégia pede TARDIO → severidade vermelha + conselho', () => {
  const trecho = fixtureTrecho();
  const geo = fixtureGeometria();
  const est = estrategiaIdeal(geo);
  const ana = analisarPassagem({
    trecho, geometria: geo, estrategia: est,
    apiceExecutado: { x: 25, y: 5 }, // antes do meio (50) = antecipado
    indicadores: { vPaceKmh: 80 },
  });
  if (ana.apiceExecutadoTipo !== 'antecipado') throw new Error('apice deveria ser antecipado');
  if (ana.bateuEstrategia) throw new Error('NÃO deveria bater estratégia');
  if (!/Freie .* mais tarde/i.test(ana.conselho)) throw new Error('conselho deveria mandar freiar mais tarde · veio: ' + ana.conselho);
});

t('execução TARDIA quando estratégia pede GEOMÉTRICO → indica antecipar', () => {
  const trecho = fixtureTrecho();
  const geo = { ...fixtureGeometria(), retaDepoisM: 40, raioM: 120, classificacao: 'rapida' };
  const est = estrategiaIdeal(geo);
  const ana = analisarPassagem({
    trecho, geometria: geo, estrategia: est,
    apiceExecutado: { x: 85, y: 5 }, // depois do meio = tardio
    indicadores: { vPaceKmh: 100 },
  });
  if (est.tipo !== 'geometrico') throw new Error('estrategia deveria ser geometrico');
  if (ana.apiceExecutadoTipo !== 'tardio') throw new Error('execução deveria ser tardia');
  if (!/antecipe a virada/i.test(ana.conselho) && !/no meio/i.test(ana.conselho)) {
    throw new Error('conselho deveria pedir antecipar · veio: ' + ana.conselho);
  }
});

t('conselho cita o nome da curva', () => {
  const trecho = { ...fixtureTrecho(), nome: 'CURVA DA BRUXA' };
  const geo = fixtureGeometria();
  const est = estrategiaIdeal(geo);
  const ana = analisarPassagem({
    trecho, geometria: geo, estrategia: est,
    apiceExecutado: { x: 50, y: 5 },
    indicadores: { vPaceKmh: 90 },
  });
  if (!/bruxa/i.test(ana.conselho)) throw new Error('faltou nome da curva · veio: ' + ana.conselho);
});

console.log(`\n${ok} ok / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
