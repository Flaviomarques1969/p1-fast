// node-smoke-tv-quadro-curvas.mjs — CATRACA do quadro de curvas da TV do box (Flávio 28/10/2026: a tela «comparativo
// por trecho» de 27/10 — "melhor volta, volta atual, delta, em LINHAS, uma linha por trecho; em cada trecho uma
// linhazinha que passa a partir do ponto de entrada, AZUL acelerando, VERMELHO freando"). Casas: voltaAtual.trechos em
// web/command-box/cerebro/cerebro-gps-tv.js e pacote().quadro em cerebro-tv-blocos-gps.js. Gravação REAL de 21/06; offline.
// Prova de IDA E VOLTA: a passagem que o quadro mostra durante a volta tem de ser a MESMA que o cérebro guarda quando a
// volta fecha. Mutação: QUADRO_BLOCOS=<cópia do cerebro-tv-blocos-gps.js> roda a prova contra outra versão.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { criarCerebroGpsTv } from '../web/command-box/cerebro/cerebro-gps-tv.js';
const { criarCerebroTvBlocosGps } = await import(process.env.QUADRO_BLOCOS
  ? pathToFileURL(process.env.QUADRO_BLOCOS).href : '../web/command-box/cerebro/cerebro-tv-blocos-gps.js');

let ok = 0, fail = 0;
const t = (nome, cond, extra) => { if (cond) { ok++; console.log('  ok ', nome); } else { fail++; console.log('  FAIL', nome, extra !== undefined ? JSON.stringify(extra) : ''); } };

const fx = JSON.parse(readFileSync(new URL('../web/command-box/fixtures/replay-hoje-2026-06-21.json', import.meta.url), 'utf8'));
const pts = fx.amostras.filter(a => a.tipo === 'gps').map(a => ({ ...a, lng: a.lon, kmh: a.kmh / 3.6, source: 'racebox' }));

const c = criarCerebroGpsTv({ guardarVoltas: true });
const casa = criarCerebroTvBlocosGps();
let antes = null;                 // primeiro quadro com a volta 1 em curso (nenhuma volta fechada)
const vistos = new Map();         // "volta:i" → passagem ÚLTIMA mostrada durante a volta (a última vez que apareceu)
const agoraPorCurva = new Map();  // "volta:i" → [{progresso, trilha, g da faixa}] enquanto o carro estava nela
let meio3 = null, nAgoraErrado = 0, nQuadros = 0;
for (const p of pts) {
  c.feedGps(p);
  const s = c.snapshot();
  if (!s.voltaAtual) continue;
  const q = casa.pacote(s).quadro;
  nQuadros++;
  if (!antes && s.voltaAtual.n === 1 && s.voltaAtual.decorridoS > 120) antes = { s, q };
  if (s.voltaAtual.n === 3 && !meio3 && s.voltaAtual.decorridoS > 40) meio3 = { s, q };
  const ag = q.curvas.filter(x => x.estado === 'agora');
  const lista = s.trechos.lista, iAg = s.voltaAtual.trechoAtual - 1;
  if (ag.length !== (lista[iAg] && lista[iAg].tipo === 'curva' ? 1 : 0)) nAgoraErrado++;
  for (const x of q.curvas) {
    if (x.ultimaVolta === s.voltaAtual.n) vistos.set(x.ultimaVolta + ':' + x.i, x.ultima);
    if (x.estado === 'agora') {
      const k = s.voltaAtual.n + ':' + x.i;
      if (!agoraPorCurva.has(k)) agoraPorCurva.set(k, []);
      agoraPorCurva.get(k).push({ progresso: x.progresso, trilha: x.trilha, faixa: casa.pacote(s).faixa, de: lista[x.i - 1].de, ate: lista[x.i - 1].ate });
    }
  }
}
const sF = c.snapshot();
const lista = sF.trechos.lista, curvasLista = lista.map((tr, i) => ({ tr, i })).filter(x => x.tr.tipo === 'curva');

// ── 1) forma ──
t('quadro: uma linha por CURVA da metodologia (retas não entram), na ordem da volta',
  meio3.q.curvas.length === curvasLista.length && meio3.q.curvas.every((x, k) => x.i === curvasLista[k].i + 1),
  [meio3.q.curvas.map(x => x.i), curvasLista.map(x => x.i + 1)]);
t('controle: nenhuma reta no quadro', meio3.q.curvas.every(x => lista[x.i - 1].tipo === 'curva'));
t('volta 1 em curso (nada fechado): nenhuma linha tem MELHOR nem diferença', antes && antes.q.curvas.every(x => x.melhor === null && x.delta === null),
  antes && antes.q.curvas.map(x => x.melhor));
t('volta 1 em curso: curva já passada mostra a passagem DESTA volta; à frente = aguardando',
  antes.q.curvas.some(x => x.ultimaVolta === 1 && x.ultima) && antes.q.curvas.some(x => x.estado === 'aguardando' && x.ultima === null),
  antes.q.curvas.map(x => x.estado));
t('em todo quadro há exatamente 1 curva "agora" quando o carro está numa curva (0 numa reta)', nAgoraErrado === 0, { nAgoraErrado, nQuadros });

// ── 2) ida e volta: o que o quadro mostrou durante a volta = o que o cérebro guardou ao fechar ──
let iguais = 0, difs = [];
for (const v of sF.voltas) for (const { i } of curvasLista) {
  const m = vistos.get(v.n + ':' + (i + 1)), g = v.trechos && v.trechos[i];
  if (!m || !g) continue;
  if (m.tempoS === g.tempoS && m.entrada === g.kmhEntrada && m.vmin === g.kmhMin && m.saida === g.kmhSaida) iguais++;
  else difs.push({ v: v.n, i: i + 1, m, g });
}
t('ida e volta: passagem mostrada na volta em curso = passagem guardada no fecho (todas as curvas das voltas fechadas)',
  difs.length === 0 && iguais >= curvasLista.length * sF.voltas.length - 1, { iguais, difs: difs.slice(0, 2) });

// ── 3) volta 3 no meio: referência = melhor volta (2); antes do carro = volta 3, depois = volta 2 (é a referência) ──
const q3 = meio3.q, ref = sF.voltas.find(v => v.n === q3.refVolta);
t('referência = melhor volta fechada (volta 2, 2:39,597)', q3.refVolta === 2 && q3.melhor.n === 2, [q3.refVolta, q3.melhor]);
t('MELHOR de cada curva = passagem da volta 2', q3.curvas.every(x => x.melhor && x.melhor.tempoS === ref.trechos[x.i - 1].tempoS && x.melhor.vmin === ref.trechos[x.i - 1].kmhMin));
const feitas3 = q3.curvas.filter(x => x.ultimaVolta === 3), daRef = q3.curvas.filter(x => x.ultimaVolta === 2);
t('curvas já passadas na volta 3 mostram a volta 3; as à frente mostram a volta 2 marcada como referência',
  feitas3.length > 0 && daRef.length > 0 && daRef.every(x => x.ehRef && x.delta === null), [feitas3.length, daRef.length]);
t('diferença = ÚLTIMA − MELHOR em cada campo (sinal certo: + perdeu tempo / + mais rápido)',
  feitas3.every(x => x.delta && Math.abs(x.delta.tempoS - (x.ultima.tempoS - x.melhor.tempoS)) < 0.0015
    && (x.delta.vmin == null || Math.abs(x.delta.vmin - (x.ultima.vmin - x.melhor.vmin)) < 0.051)),
  feitas3.map(x => [x.delta && x.delta.tempoS, x.ultima.tempoS, x.melhor.tempoS]));
const soma = feitas3.reduce((a, x) => a + x.delta.tempoS, 0);
t('soma das diferenças = soma das curvas com diferença', Math.abs(q3.somaDeltaS - soma) < 0.002, [q3.somaDeltaS, soma]);
t('ideal pelos trechos = o do cérebro (voltas que valem)', q3.idealTrechosS === meio3.s.trechos.validas.voltaIdealS, [q3.idealTrechosS]);
t('freada = "—" na gravação de 21/06 (sem G do RaceBox; nunca inventada)', q3.curvas.every(x => (!x.melhor || x.melhor.freadaM === null) && (!x.ultima || x.ultima.freadaM === null)));
t('cabeçalho: volta 3, tempo decorrido e Δ da faixa', q3.volta.n === 3 && q3.volta.decorridoS === meio3.s.voltaAtual.decorridoS && q3.volta.deltaAgoraS != null, q3.volta);

// ── 4) linhazinha da curva em curso: progresso anda com o carro, trilha tem o tom do G da faixa ──
let curvasComTrilha = 0, progOk = 0, tomOk = 0, tomTot = 0, bicolor = 0;
for (const [, fotos] of agoraPorCurva) {
  const pr = fotos.map(f => f.progresso).filter(x => x != null);
  if (pr.length > 3 && pr.every((x, k) => k === 0 || x >= pr[k - 1] - 1e-9) && pr[pr.length - 1] > 0.6) progOk++;
  const ult = fotos[fotos.length - 1];
  if (ult.trilha && ult.trilha.length) {
    curvasComTrilha++;
    if (new Set(ult.trilha.map(x => x.tom)).size === 2) bicolor++;
    // cada pedaço da trilha: o tom é o sinal do G da faixa na casa onde ele começa
    const n = ult.faixa.casas, vao = ult.ate >= ult.de ? ult.ate - ult.de : ult.ate + 1 - ult.de;
    for (const pd of ult.trilha) {
      const k = (Math.floor(ult.de * n) + Math.round(pd.de * vao * n)) % n, g = ult.faixa.atual.g[k];
      if (g == null) continue;
      tomTot++; if ((g < 0 ? 'freia' : 'acelera') === pd.tom) tomOk++;
    }
  }
}
t('progresso da curva em curso só cresce e passa de 60% antes de sair (≥ 80% das passagens)', progOk >= agoraPorCurva.size * 0.8, [progOk, agoraPorCurva.size]);
t('trilha existe nas curvas em curso e tem os DOIS tons (freia e acelera) na maioria', curvasComTrilha >= agoraPorCurva.size * 0.8 && bicolor >= curvasComTrilha * 0.6, [curvasComTrilha, bicolor, agoraPorCurva.size]);
t('tom de cada pedaço = sinal do G da faixa (G < 0 freia, senão acelera)', tomTot > 20 && tomOk >= tomTot * 0.95, [tomOk, tomTot]);

console.log(`\ntv-quadro-curvas: ${ok} ok / ${fail} fail`);
process.exit(fail ? 1 : 0);
