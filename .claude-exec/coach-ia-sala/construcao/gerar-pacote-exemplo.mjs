// gerar-pacote-exemplo.mjs — roda o fixture REAL pelo acumulador de stint e
// emite `coach-ia-sala/construcao/pacote-exemplo.json` nos 3 estados honestos.
// Publicação CEDO (mandato): a TELA consome este pacote real no M2 dela.
//
// Roda do worktree do CÉREBRO. Escreve na MESA (diretório principal, caminho absoluto).

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { criarCoachStint } from '../web/command-box/cerebro/cerebro-coach-stint.js';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MESA = '/Users/imac/Projetos/P1 Fast/.claude-exec/coach-ia-sala/construcao';
const fix = JSON.parse(readFileSync(resolve(RAIZ, 'web/command-box/fixtures/passagens-bubi-brasilia.v1.json'), 'utf8'));

// ── 1. numeração contínua das voltas (1..7) + detecção de out-lap (>5% acima da mediana) ──
const chavesLap = [...new Set(fix.passagens.map(p => `${p.dia}#${p.volta}`))]
  .sort((a, b) => a.localeCompare(b)); // 23/05 antes de 24/05, volta crescente
const lapNum = new Map(chavesLap.map((k, i) => [k, i + 1]));
const totalPorLap = {};
for (const p of fix.passagens) { const k = `${p.dia}#${p.volta}`; totalPorLap[k] = (totalPorLap[k] || 0) + p.tempo_trecho_s; }
const totais = Object.values(totalPorLap).sort((a, b) => a - b);
const mediana = totais[Math.floor(totais.length / 2)];
const outlapLap = new Set(Object.entries(totalPorLap).filter(([, t]) => t > mediana * 1.05).map(([k]) => lapNum.get(k)));

// ── 2. referência por curva = melhor histórica (min tempo_trecho_s) ──
const refPorCurva = {};
const passagemRefPorCurva = {};
for (const p of fix.passagens) {
  if (refPorCurva[p.curva] == null || p.tempo_trecho_s < refPorCurva[p.curva]) {
    refPorCurva[p.curva] = p.tempo_trecho_s;
    passagemRefPorCurva[p.curva] = p;
  }
}

// ── 3. alimenta o acumulador com TODAS as passagens (out-laps marcados) ──
function alimentar(coach, passagens) {
  // ordena por lap contínuo, depois por ordem de curva
  const ordem = fix._meta.ordemCurvas;
  const ordenadas = [...passagens].sort((a, b) => {
    const la = lapNum.get(`${a.dia}#${a.volta}`), lb = lapNum.get(`${b.dia}#${b.volta}`);
    if (la !== lb) return la - lb;
    return ordem.indexOf(a.curva) - ordem.indexOf(b.curva);
  });
  for (const p of ordenadas) {
    const lap = lapNum.get(`${p.dia}#${p.volta}`);
    const outlap = outlapLap.has(lap);
    const refP = passagemRefPorCurva[p.curva];
    coach.onDelta({
      volta: lap,
      segmentId: p.segment_id,
      curvaNome: p.curva,
      tipoPneu: p.tipo_pneu,
      tempoAtualS: p.tempo_trecho_s,
      tempoRefS: refPorCurva[p.curva],
      nPontos: p.pontos.length,
      distMediaM: 15,
      tracos: { atual: p.pontos, referencia: refP.pontos },
      outlap,
    });
  }
}

// (A) ESTADO 'oportunidade' — stint completo (7 voltas) → elege Curva "S"
const coachOp = criarCoachStint({ nVoltasAlvo: 14, trechosFoco: [] });
alimentar(coachOp, fix.passagens);
const pacoteOportunidade = coachOp.pacote();

// (B) ESTADO 'silencio' — só as 2 primeiras voltas voadoras (< MIN_VOLTAS_FLYING) → coletando-dados
const coachSil = criarCoachStint({ nVoltasAlvo: 14, trechosFoco: [] });
const ate2Voadoras = fix.passagens.filter(p => {
  const lap = lapNum.get(`${p.dia}#${p.volta}`);
  return !outlapLap.has(lap) && lap <= 3; // laps 2 e 3 (lap 1 é out-lap) = 2 voadoras
});
alimentar(coachSil, ate2Voadoras);
const pacoteSilencio = coachSil.pacote();

// (C) ESTADO null — onda não ligada (acumulador sem dado)
const coachNull = criarCoachStint({ nVoltasAlvo: 14 });
const pacoteNull = coachNull.pacote();

// ── 4. escreve o pacote-exemplo.json nos 3 estados ──
const saida = {
  _meta: {
    origem: 'gerado do fixture REAL passagens-bubi-brasilia.v1.json (Bubi 23-24/05) pelo cerebro-coach-stint.js',
    caminho: 'Fase 1 — subTrecho:null (curva inteira), passo 0 (linhas de trecho curtas p/ curvas rápidas)',
    decisoes: 'ganho=p25 (decisão 9 conservador) · SÓ âmbar/verde (decisão 3) · N1+N2 · gate SF',
    outlaps: [...outlapLap], mediana_lap_s: mediana,
  },
  oportunidade: pacoteOportunidade,
  silencio: pacoteSilencio,
  semOnda: pacoteNull, // null — onda não ligada
};
writeFileSync(resolve(MESA, 'pacote-exemplo.json'), JSON.stringify(saida, null, 2));

// ── 5. laudo no console ──
console.log('=== pacote-exemplo.json gerado (3 estados) ===');
console.log('OUT-LAPS (lap contínuo):', [...outlapLap].join(','), '| mediana volta:', mediana.toFixed(1) + 's');
console.log('\n(A) oportunidade:');
if (pacoteOportunidade?.tipo === 'oportunidade') {
  const o = pacoteOportunidade.oportunidade;
  console.log('  eleita:', o.curvaNome, '| tipoCurva:', o.tipoCurva, '| subTrecho:', o.subTrecho);
  console.log('  ganhoVoltaS:', o.ganhoVoltaS, '| ganhoStintS:', o.ganhoStintS, '| confiança:', o.confianca.nivel, o.confianca.valor);
  console.log('  gapMedidoS:', o.reconciliacao.gapMedidoS, '| deltaMedioS:', o.evidencia.deltaMedioS, '| voltas:', o.evidencia.voltasObservadas.join(','));
  console.log('  N1:', JSON.stringify(pacoteOportunidade.mensagem.n1.linhas), '| acento:', pacoteOportunidade.mensagem.n1.acento);
  console.log('  N2:', JSON.stringify(pacoteOportunidade.mensagem.n2.linhas));
  console.log('  grafico.acento:', pacoteOportunidade.grafico.acento, '| viewBox:', JSON.stringify(pacoteOportunidade.grafico.recorte.viewBox));
  console.log('  timing:', JSON.stringify(pacoteOportunidade.timing));
} else console.log('  !! esperado oportunidade, veio', pacoteOportunidade?.tipo);
console.log('\n(B) silencio:', pacoteSilencio?.tipo, '| status:', JSON.stringify(pacoteSilencio?.status), '| linha:', JSON.stringify(pacoteSilencio?.linha));
console.log('\n(C) semOnda:', pacoteNull === null ? 'null ✓ (onda não ligada)' : '!! esperado null');
