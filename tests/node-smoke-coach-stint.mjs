// node-smoke-coach-stint.mjs — testes do Coach de IA de stint (o lado do DADO).
// Cobre os critérios do mandato (PROMPT-CONSTRUTORA-CEREBRO passo 5):
//   eleição real = Curva "S" 0,996 s (5/5) com Bruxa atrás · determinismo ·
//   silêncio honesto · gate SF (freio jamais na Vitória) · idempotência do id ·
//   as curvas tortas caem em subTrecho:null (passo 0) · anotador nomeado (fracao/sub).
//
// Roda determinístico sobre o fixture REAL, sem tocar banco/canal/produção.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { criarCoachStint } from '../web/command-box/cerebro/cerebro-coach-stint.js';
import { calcularDelta, pontoCanonico } from '../web/cockpit/delta-calculator.js';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fix = JSON.parse(readFileSync(resolve(RAIZ, 'web/command-box/fixtures/passagens-bubi-brasilia.v1.json'), 'utf8'));

let ok = 0, fail = 0;
function t(nome, fn) { try { fn(); console.log('✓', nome); ok++; } catch (e) { console.log('✗', nome, '→', e.message); fail++; } }
function assert(c, m) { if (!c) throw new Error(m || 'falhou'); }
function perto(a, b, tol = 0.005) { return Math.abs(a - b) <= tol; }

// ── harness de replay: numera voltas contínuas, detecta out-laps, ref = melhor histórica ──
function montarFeed() {
  const chaves = [...new Set(fix.passagens.map(p => `${p.dia}#${p.volta}`))].sort((a, b) => a.localeCompare(b));
  const lapNum = new Map(chaves.map((k, i) => [k, i + 1]));
  const totalPorLap = {};
  for (const p of fix.passagens) { const k = `${p.dia}#${p.volta}`; totalPorLap[k] = (totalPorLap[k] || 0) + p.tempo_trecho_s; }
  const totais = Object.values(totalPorLap).sort((a, b) => a - b);
  const mediana = totais[Math.floor(totais.length / 2)];
  const outlap = new Set(Object.entries(totalPorLap).filter(([, v]) => v > mediana * 1.05).map(([k]) => lapNum.get(k)));
  const ref = {}, refP = {};
  for (const p of fix.passagens) if (ref[p.curva] == null || p.tempo_trecho_s < ref[p.curva]) { ref[p.curva] = p.tempo_trecho_s; refP[p.curva] = p; }
  const ordem = fix._meta.ordemCurvas;
  const evs = [...fix.passagens].sort((a, b) => {
    const la = lapNum.get(`${a.dia}#${a.volta}`), lb = lapNum.get(`${b.dia}#${b.volta}`);
    return la !== lb ? la - lb : ordem.indexOf(a.curva) - ordem.indexOf(b.curva);
  }).map(p => ({
    volta: lapNum.get(`${p.dia}#${p.volta}`), segmentId: p.segment_id, curvaNome: p.curva,
    tipoPneu: p.tipo_pneu, tempoAtualS: p.tempo_trecho_s, tempoRefS: ref[p.curva],
    nPontos: p.pontos.length, tracos: { atual: p.pontos, referencia: refP[p.curva].pontos },
    outlap: outlap.has(lapNum.get(`${p.dia}#${p.volta}`)),
  }));
  return { evs, outlap };
}
function rodarStintCompleto(opts = {}) {
  const coach = criarCoachStint({ nVoltasAlvo: 14, ...opts });
  for (const ev of montarFeed().evs) coach.onDelta(ev);
  return coach;
}

// ── CS-01: eleição real = Curva "S", 0,996 s (p25), 5/5 voltas, subTrecho:null ──
t('CS-01 elege CURVA "S" em curva-inteira (subTrecho:null), p25=0,996, deltaMedio=1,394, voltas 2,3,4,6,7', () => {
  const pac = rodarStintCompleto().pacote();
  assert(pac && pac.tipo === 'oportunidade', 'esperava oportunidade');
  const o = pac.oportunidade;
  assert(o.curvaNome === 'CURVA "S"', 'esperava Curva "S", veio ' + o.curvaNome);
  assert(o.subTrecho === null, 'esperava subTrecho:null (passo 0)');
  assert(o.tipoCurva === 'T4', 'tipoCurva T4');
  assert(perto(o.ganhoVoltaS, 0.996), 'ganhoVoltaS ~0,996, veio ' + o.ganhoVoltaS);
  assert(perto(o.evidencia.deltaMedioS, 1.394), 'deltaMedioS ~1,394, veio ' + o.evidencia.deltaMedioS);
  assert(o.evidencia.voltasObservadas.join(',') === '2,3,4,6,7', 'voltas ' + o.evidencia.voltasObservadas.join(','));
});

// ── CS-02: Bruxa fica ATRÁS (S vence; Bruxa é candidata com gap menor ~0,49) ──
t('CS-02 Bruxa fica atrás da "S" (S vence o argmax)', () => {
  const coach = rodarStintCompleto();
  const est = coach._estado();
  const bruxa = est.curvas.find(c => c.curvaNome === 'CURVA DA BRUXA');
  assert(bruxa, 'Bruxa deveria ter ocorrências');
  const gapsBruxa = bruxa.ocorrencias.map(o => o.gap).filter(g => g > 0.05).sort((a, b) => a - b);
  const p25Bruxa = gapsBruxa[Math.floor((gapsBruxa.length - 1) * 0.25)];
  assert(p25Bruxa < 0.996, 'Bruxa p25 (' + p25Bruxa.toFixed(3) + ') deve ser < S (0,996)');
  assert(coach.pacote().oportunidade.curvaNome === 'CURVA "S"', 'S deve vencer');
});

// ── CS-03: determinismo — mesmo fixture → mesmo pacote (byte-igual) ──
t('CS-03 determinismo: mesmo fixture → pacote idêntico', () => {
  const a = JSON.stringify(rodarStintCompleto().pacote());
  const b = JSON.stringify(rodarStintCompleto().pacote());
  assert(a === b, 'pacotes divergiram entre execuções');
});

// ── CS-04: silêncio honesto — 2 voltas voadoras → 'silencio' coletando-dados ──
t('CS-04 silêncio honesto: 2 voadoras → tipo silencio, status coletando-dados', () => {
  const coach = criarCoachStint({ nVoltasAlvo: 14 });
  for (const ev of montarFeed().evs) if (!ev.outlap && ev.volta <= 3) coach.onDelta(ev); // voltas 2 e 3
  const pac = coach.pacote();
  assert(pac.tipo === 'silencio', 'esperava silencio, veio ' + pac.tipo);
  assert(pac.status.estado === 'coletando-dados', 'estado ' + pac.status.estado);
  assert(pac.status.voltasObservadas === 2, 'voltasObservadas ' + pac.status.voltasObservadas);
  assert(pac.linha && pac.linha.texto === 'Juntando dado', 'linha honesta pré-computada (J1 §2.5)');
});

// ── CS-05: gate SF — Vitória (SF) NUNCA recebe verbo de freio; ação = "carregue mais" ──
t('CS-05 gate SF: Vitória com perda consistente → ensina curva inteira, SEM verbo de freio', () => {
  const coach = criarCoachStint({ nVoltasAlvo: 14 });
  const vit = fix.passagens.find(p => p.curva === 'CURVA DA VITÓRIA');
  // 5 voltas voadoras com perda consistente ~1,0 s (força a Vitória a eleger, testando o gate)
  for (let v = 2; v <= 6; v++) coach.onDelta({
    volta: v, segmentId: vit.segment_id, curvaNome: 'CURVA DA VITÓRIA', tipoPneu: 'radial-185-14',
    tempoAtualS: 5.0, tempoRefS: 4.0, nPontos: 6, tracos: { atual: vit.pontos, referencia: vit.pontos }, outlap: false,
  });
  const pac = coach.pacote();
  assert(pac.tipo === 'oportunidade' && pac.oportunidade.curvaNome === 'CURVA DA VITÓRIA', 'Vitória deveria eleger aqui');
  assert(pac.oportunidade.tipoCurva === 'SF', 'tipoCurva SF');
  assert(pac.oportunidade.subTrecho === null && pac.oportunidade.tecnica === null, 'sem sub/técnica de freio');
  const txt = pac.mensagem.n2.linhas.join(' ').toLowerCase();
  assert(!/frei|freio|freada/.test(txt), 'mensagem NÃO pode falar de freio na SF: ' + txt);
  assert(/carregue mais/.test(txt), 'ação deve ser "carregue mais"');
});

// ── CS-06: Vitória no fixture (bimodal) → conservador p25 silencia (decisão 9, C4 da J5) ──
t('CS-06 conservador: Vitória bimodal no fixture não elege sozinha (p25 abaixo do piso)', () => {
  const coach = criarCoachStint({ nVoltasAlvo: 14 });
  for (const ev of montarFeed().evs) if (ev.curvaNome === 'CURVA DA VITÓRIA') coach.onDelta(ev);
  // só Vitória alimentada, mas com voltas insuficientes/perda bimodal → não vira oportunidade de Vitória
  const pac = coach.pacote();
  assert(pac == null || pac.tipo !== 'oportunidade' || pac.oportunidade.curvaNome !== 'CURVA DA VITÓRIA'
    || pac.oportunidade.ganhoVoltaS < 0.10, 'Vitória não deveria eleger com p25 conservador');
});

// ── CS-07: idempotência do id — mesma entrada → mesmo id estável ──
t('CS-07 idempotência: id do cartão é estável entre chamadas e execuções', () => {
  const id1 = rodarStintCompleto().pacote().id;
  const coach = rodarStintCompleto();
  const id2 = coach.pacote().id, id3 = coach.pacote().id;
  assert(id1 === id2 && id2 === id3, `id instável: ${id1} / ${id2} / ${id3}`);
});

// ── CS-08: null honesto — sem dado → pacote null (onda não ligada) ──
t('CS-08 null honesto: sem dado → pacote() === null', () => {
  assert(criarCoachStint({ nVoltasAlvo: 14 }).pacote() === null, 'esperava null');
});

// ── CS-09: passo 1 — calcularDelta emite tempoAtualS (aditivo) + 5 campos antigos intactos ──
t('CS-09 passo 1: calcularDelta emite tempoAtualS sem quebrar os 5 campos antigos', () => {
  const s = fix.passagens.find(p => p.curva === 'CURVA "S"');
  const anot = s.pontos.map((p, i) => pontoCanonico(p, null, i, s.pontos.length - 1));
  const r = calcularDelta({ atual: { segmentId: s.segment_id, pontos: anot }, referencia: { segmentId: s.segment_id, pontos: anot } });
  for (const campo of ['segmentId', 'deltaTotalS', 'porSubTrecho', 'piorSubTrecho', 'piorDeltaS'])
    assert(campo in r, 'campo antigo sumiu: ' + campo);
  assert('tempoAtualS' in r, 'tempoAtualS não foi emitido');
  const esperado = (s.pontos[s.pontos.length - 1].t - s.pontos[0].t) / 1000;
  assert(perto(r.tempoAtualS, esperado, 0.01), 'tempoAtualS = relógio da passagem');
});

// ── CS-10: anotador nomeado — tracos vêm com fracao 0..1 e sub null (curvas tortas → null) ──
t('CS-10 anotador nomeado: tracos com fracao monotônica 0..1 e sub null (curva-inteira honesta)', () => {
  const o = rodarStintCompleto().pacote().oportunidade;
  assert(o.tracos && Array.isArray(o.tracos.atual) && o.tracos.atual.length > 1, 'tracos.atual presente');
  const fr = o.tracos.atual.map(p => p.fracao);
  assert(fr[0] === 0 && Math.abs(fr[fr.length - 1] - 1) < 1e-9, 'fracao vai de 0 a 1');
  for (let i = 1; i < fr.length; i++) assert(fr[i] >= fr[i - 1], 'fracao monotônica');
  assert(o.tracos.atual.every(p => p.sub === null), 'sub null (Fase 1, passo 0)');
});

// ── CS-11: envelope 3 estados — campos obrigatórios do pacote 'oportunidade' (J4 §2) ──
t('CS-11 envelope oportunidade tem id/oportunidade/mensagem/grafico/timing e acento âmbar (decisão 3)', () => {
  const pac = rodarStintCompleto().pacote();
  for (const campo of ['id', 'oportunidade', 'mensagem', 'grafico', 'timing', 'geradoEmVoltaN'])
    assert(campo in pac, 'campo do envelope ausente: ' + campo);
  assert(pac.mensagem.n1 && pac.mensagem.n2, 'N1 e N2 presentes (Fase 1)');
  assert(pac.mensagem.n3 === null, 'N3 é Fase 2');
  assert(pac.mensagem.n1.acento === 'ambar' && pac.grafico.acento === 'ambar', 'decisão 3: âmbar (nunca vermelho)');
  assert(pac.timing.prioridade === 'critica-vence', 'crítico sempre vence');
});

console.log(`\nCoach de stint: ${ok} ok / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
