// node-smoke-tv-quadro-curvas.mjs — CATRACA do quadro de curvas da TV do box (Flávio 28/10/2026: a tela «comparativo
// por trecho» de 27/10 — "melhor volta, volta atual, delta, em LINHAS, uma linha por trecho; em cada trecho uma
// linhazinha que passa a partir do ponto de entrada, AZUL acelerando, VERMELHO freando"). Casas: voltaAtual.trechos em
// web/command-box/cerebro/cerebro-gps-tv.js e pacote().quadro em cerebro-tv-blocos-gps.js. Gravação REAL de 21/06; offline.
// Prova de IDA E VOLTA: a passagem que o quadro mostra durante a volta tem de ser a MESMA que o cérebro guarda quando a
// volta fecha. Volta descartada (aquecimento) nunca é referência (seção 3b). Seções 5 e 6 (painel p1fast-tv-quadro-melhorias-1425
// itens 3 e 2): curva em curso AO VIVO e ONDE MAIS PERDEU (sessão sintética montada da volta 2 real, só nesta prova). Mutação: QUADRO_BLOCOS=<cópia do cerebro-tv-blocos-gps.js> roda a prova contra outra versão.
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
const vivoPorCurva = new Map();  // "volta:i" → [passagem ÚLTIMA ao vivo] enquanto o carro estava nela
let meio2 = null, meio3 = null, nAgoraErrado = 0, nQuadros = 0, nVivoErrado = 0;
for (const p of pts) {
  c.feedGps(p);
  const s = c.snapshot();
  if (!s.voltaAtual) continue;
  const q = casa.pacote(s).quadro;
  nQuadros++;
  if (!antes && s.voltaAtual.n === 1 && s.voltaAtual.decorridoS > 120) antes = { s, q };
  if (s.voltaAtual.n === 2 && !meio2 && s.voltaAtual.decorridoS > 60) meio2 = { s, p: casa.pacote(s), q };
  if (s.voltaAtual.n === 3 && !meio3 && s.voltaAtual.decorridoS > 40) meio3 = { s, q };
  const ag = q.curvas.filter(x => x.estado === 'agora');
  const lista = s.trechos.lista, iAg = s.voltaAtual.trechoAtual - 1;
  if (ag.length !== (lista[iAg] && lista[iAg].tipo === 'curva' ? 1 : 0)) nAgoraErrado++;
  for (const x of q.curvas) {
    if (x.estado !== 'agora' && x.aoVivo) nVivoErrado++;
    if (x.ultimaVolta === s.voltaAtual.n && !x.aoVivo) vistos.set(x.ultimaVolta + ':' + x.i, x.ultima);
    if (x.estado === 'agora') {
      const k = s.voltaAtual.n + ':' + x.i;
      const ta = s.voltaAtual.trechoAgora;
      if (x.aoVivo !== !!ta || (x.aoVivo && x.ultimaVolta !== s.voltaAtual.n)) nVivoErrado++;
      if (x.aoVivo) { if (!vivoPorCurva.has(k)) vivoPorCurva.set(k, []); vivoPorCurva.get(k).push({ u: x.ultima, d: x.delta, ta }); }
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
const feitas3 = q3.curvas.filter(x => x.ultimaVolta === 3 && !x.aoVivo), daRef = q3.curvas.filter(x => x.ultimaVolta === 2);
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

// ── 3b) volta de aquecimento NÃO é referência (Flávio 28/10, item 6 de p1fast-mapa-tv-2045: "descartar a primeira volta
// que é de aquecimento e a última ... de resfriamento"). 21/06: a volta 1 é aquecimento; durante a volta 2 não há volta
// válida fechada → sem referência, sem MELHOR, sem diferença, em todos os blocos que comparam ──
const d2 = meio2 && meio2.s.trechos.validas.descartadas;
t('controle: na volta 2 o cérebro do GPS já marcou a volta 1 como aquecimento', d2 && d2.length === 1 && d2[0].n === 1 && d2[0].motivo === 'aquecimento', d2);
t('volta 2: quadro sem referência e sem MELHOR no topo (só a volta 1 fechada, e ela é aquecimento)',
  meio2.q.refVolta === null && meio2.q.melhor === null && meio2.q.voltasFechadas === 1, [meio2.q.refVolta, meio2.q.melhor, meio2.q.voltasFechadas]);
t('volta 2: nenhuma curva com MELHOR nem diferença; soma e Δ do topo vazios',
  meio2.q.curvas.every(x => x.melhor === null && x.delta === null && !x.ehRef) && meio2.q.somaDeltaS === null && meio2.q.volta.deltaAgoraS === null,
  meio2.q.curvas.map(x => [x.melhor && x.melhor.tempoS, x.delta && x.delta.tempoS]));
t('volta 2: curva já feita mostra a passagem DESTA volta; à frente = aguardando (a volta 1 não aparece como "última")',
  meio2.q.curvas.every(x => x.ultimaVolta !== 1) && meio2.q.curvas.some(x => x.ultimaVolta === 2), meio2.q.curvas.map(x => x.ultimaVolta));
t('volta 2: faixa sem volta de referência, curva da vez e coach sem referência na volta de aquecimento',
  meio2.p.faixa && meio2.p.faixa.melhor === null && (meio2.p.curva == null || meio2.p.curva.passagem === null) && meio2.p.coach === null,
  [meio2.p.faixa && meio2.p.faixa.melhor, meio2.p.curva && meio2.p.curva.passagem, meio2.p.coach]);

// ── 4) linhazinha da curva em curso: progresso anda com o carro, trilha tem o tom das FREADAS da faixa (Flávio 28/10:
// o G pela velocidade fazia "frenagem em V", "freando e acelerando ao mesmo tempo" — agora freia só dentro de uma freada) ──
let curvasComTrilha = 0, progOk = 0, tomOk = 0, tomTot = 0, bicolor = 0, serrilhadas = 0;
for (const [, fotos] of agoraPorCurva) {
  const pr = fotos.map(f => f.progresso).filter(x => x != null);
  if (pr.length > 3 && pr.every((x, k) => k === 0 || x >= pr[k - 1] - 1e-9) && pr[pr.length - 1] > 0.6) progOk++;
  const ult = fotos[fotos.length - 1];
  if (ult.trilha && ult.trilha.length) {
    curvasComTrilha++;
    if (new Set(ult.trilha.map(x => x.tom)).size === 2) bicolor++;
    if (ult.trilha.length > 3) serrilhadas++;   // freia → acelera → freia → acelera numa curva só = o "V" de antes
    // cada pedaço da trilha: 'freia' se a casa onde ele começa está dentro de uma freada da volta em curso
    const n = ult.faixa.casas, vao = ult.ate >= ult.de ? ult.ate - ult.de : ult.ate + 1 - ult.de;
    const fr = (ult.faixa.atual && ult.faixa.atual.freadas) || [];
    for (const pd of ult.trilha) {
      const k = (Math.floor(ult.de * n) + Math.round(pd.de * vao * n)) % n;
      const dentro = fr.some(z => k >= Math.floor(z.de * n) && k <= Math.floor(z.ate * n));
      tomTot++; if ((dentro ? 'freia' : 'acelera') === pd.tom) tomOk++;
    }
  }
}
t('progresso da curva em curso só cresce e passa de 60% antes de sair (≥ 80% das passagens)', progOk >= agoraPorCurva.size * 0.8, [progOk, agoraPorCurva.size]);
t('trilha existe nas curvas em curso e tem os DOIS tons (freia e acelera) na maioria', curvasComTrilha >= agoraPorCurva.size * 0.8 && bicolor >= curvasComTrilha * 0.6, [curvasComTrilha, bicolor, agoraPorCurva.size]);
t('tom de cada pedaço = dentro de uma freada da faixa (freia) ou fora (acelera)', tomTot > 10 && tomOk === tomTot, [tomOk, tomTot]);
t('sem "V": nenhuma curva com a trilha trocando de tom mais de 2 vezes', curvasComTrilha > 0 && serrilhadas === 0, [serrilhadas, curvasComTrilha]);

// ── 5) curva em curso AO VIVO (Flávio 28/10, item 3 de p1fast-tv-quadro-melhorias-1425: "a linha ÚLTIMA da curva em que o
// carro está mostra a passagem atual — entrada assim que entra, mínima baixando em tempo real, marcada «ao vivo»") ──
t('ao vivo: só a curva em que o carro está, sempre desta volta (e toda curva "agora" com medida é ao vivo)',
  nVivoErrado === 0 && vivoPorCurva.size >= 10, [nVivoErrado, vivoPorCurva.size]);
let entOk = 0, entTot = 0, minDesce = 0, minNuncaSobe = 0, idaMin = 0, fechadas = 0, semFuturo = 0, deltaOk = 0;
for (const [k, fotos] of vivoPorCurva) {
  const [vn, ci] = k.split(':').map(Number);
  const g = (sF.voltas.find(v => v.n === vn) || {}).trechos;
  const mins = fotos.map(f => f.u.vmin).filter(x => x != null);
  if (mins.every((x, j) => j === 0 || x <= mins[j - 1])) minNuncaSobe++;
  if (mins.length && mins[mins.length - 1] < mins[0]) minDesce++;
  if (fotos.every(f => f.u.saida === null && f.u.tempoS === null)) semFuturo++;
  if (fotos.every(f => !f.d || (f.d.vmin === null && f.d.saida === null && f.d.tempoS === null))) deltaOk++;
  if (fotos.every(f => f.u.entrada === f.ta.kmhEntrada && f.u.vmin === f.ta.kmhMin)) entOk++;
  if (g && g[ci - 1]) {   // a volta fechou: ida e volta com o que o cérebro guardou
    fechadas++; entTot += fotos.every(f => f.u.entrada === g[ci - 1].kmhEntrada) ? 1 : 0;
    if (mins.length && mins[mins.length - 1] >= g[ci - 1].kmhMin) idaMin++;
  }
}
t('ao vivo: a linha mostra exatamente a medida do cérebro (entrada e mínima até agora)', entOk === vivoPorCurva.size, [entOk, vivoPorCurva.size]);
t('ao vivo: a mínima nunca sobe durante a curva e baixa de verdade na maioria', minNuncaSobe === vivoPorCurva.size && minDesce >= vivoPorCurva.size * 0.6,
  [minNuncaSobe, minDesce, vivoPorCurva.size]);
t('ida e volta: a entrada ao vivo = a entrada guardada quando a volta fecha; a mínima ao vivo nunca abaixo da guardada',
  fechadas >= 10 && entTot === fechadas && idaMin === fechadas, [fechadas, entTot, idaMin]);
t('ao vivo: saída e tempo vazios e sem diferença de mínima/saída/tempo (número que ainda muda não compara)',
  semFuturo === vivoPorCurva.size && deltaOk === vivoPorCurva.size, [semFuturo, deltaOk, vivoPorCurva.size]);

// ── 6) onde mais perdeu (item 2 do mesmo painel): «<curva>: perdeu X s — mínima N km/h abaixo da sua melhor». A gravação
// de 21/06 só fecha UMA volta válida (a 2), então a prova monta uma sessão SINTÉTICA a partir dela: a volta 2 real
// repetida duas vezes — a 1ª cópia com UMA curva 0,6 s mais lenta e a mínima 3 km/h menor, a 2ª cópia idêntica (controle).
// Só nesta prova; a tela nunca recebe dado inventado. ──
const n2 = [], ta2 = [];
{
  const cc = criarCerebroGpsTv({ guardarVoltas: true });
  let antesN = null;
  pts.forEach((p, k) => { cc.feedGps(p); const a = cc.snapshot().voltaAtual; if (a && a.n === 2) { n2.push(k); ta2.push(a.trechoAtual); } antesN = a && a.n; });
}
const iAlvo = curvasLista[Math.floor(curvasLista.length / 2)].i;   // uma curva do meio da volta
const kAlvo = ta2.map((x, j) => (x === iAlvo + 1 ? j : -1)).filter(j => j >= 0);
const ATRASO_MS = 600, MENOS_KMH = 3;   // os pontos desta prova já estão em km/h (o ÷ 3,6 acima só corrige a gravação de 21/06)
function copiaDaVolta2(desloc, lenta) {
  const t0 = pts[n2[0]].tWall, out = [];
  n2.forEach((k, j) => {
    let atraso = 0;
    if (lenta && kAlvo.length) atraso = j < kAlvo[0] ? 0 : j > kAlvo[kAlvo.length - 1] ? ATRASO_MS : ATRASO_MS * (j - kAlvo[0] + 1) / kAlvo.length;
    const p = pts[k];
    out.push({ ...p, tWall: p.tWall - t0 + desloc + atraso, kmh: lenta && kAlvo.includes(j) && typeof p.kmh === 'number' ? Math.max(0, p.kmh - MENOS_KMH) : p.kmh });
  });
  return out;
}
const fimReal = pts[n2[n2.length - 1]].tWall, durV2 = fimReal - pts[n2[0]].tWall;
const sint = [...pts.slice(0, n2[n2.length - 1] + 1),
  ...copiaDaVolta2(fimReal + 100, true), ...copiaDaVolta2(fimReal + 100 + durV2 + ATRASO_MS + 100, false)];
const cs = criarCerebroGpsTv({ guardarVoltas: true }), casaS = criarCerebroTvBlocosGps();
let qPerda = null, qAntes = null;
for (const p of sint) {
  cs.feedGps(p);
  const s = cs.snapshot();
  if (!s.voltaAtual) continue;
  if (s.voltaAtual.n === 3 && s.voltaAtual.decorridoS > 30 && !qAntes) qAntes = casaS.pacote(s).quadro;
  if (s.voltaAtual.n === 4 && s.voltaAtual.decorridoS > 30 && !qPerda) qPerda = { s, q: casaS.pacote(s).quadro };
}
const vS = cs.snapshot().voltas.map(v => ({ n: v.n, tempoS: v.tempoS, descarte: v.descarte || null }));
t('sessão sintética: volta 3 = cópia da 2 com a curva atrasada (mais lenta), válida; volta 4 em curso',
  vS.length >= 3 && vS[2].n === 3 && !vS[2].descarte && vS[2].tempoS > vS[1].tempoS && qPerda && kAlvo.length > 3, [vS, kAlvo.length]);
const pd = qPerda && qPerda.q.perda, v3 = cs.snapshot().voltas[2], v2 = cs.snapshot().voltas[1];
t('onde mais perdeu: a curva atrasada, na volta 3, contra a melhor (volta 2)', pd && pd.i === iAlvo + 1 && pd.volta === 3 && pd.refVolta === 2, pd);
t('perdeu X s = o tempo da curva na volta 3 − na volta 2 (o mesmo número da coluna MELHOR do quadro)',
  pd && Math.abs(pd.perdeuS - (v3.trechos[iAlvo].tempoS - v2.trechos[iAlvo].tempoS)) < 0.0015 && pd.perdeuS > 0.3, pd && [pd.perdeuS, v3.trechos[iAlvo].tempoS, v2.trechos[iAlvo].tempoS]);
const difMin = v2.trechos[iAlvo].kmhMin - v3.trechos[iAlvo].kmhMin;
const fraseEsperada = `${pd && pd.nome}: perdeu ${pd && pd.perdeuS.toFixed(2).replace('.', ',')} s — mínima ${String(Math.round(difMin * 10) / 10).replace('.', ',')} km/h abaixo da sua melhor`;
t('frase no formato dele, com a mínima medida', pd && pd.frase.startsWith(fraseEsperada) && pd.motivos[0].tipo === 'minima', [pd && pd.frase, fraseEsperada]);
t('só essa linha marcada "mais perdeu" no quadro', qPerda && qPerda.q.curvas.filter(x => x.maisPerdeu).map(x => x.i).join() === String(iAlvo + 1),
  qPerda && qPerda.q.curvas.filter(x => x.maisPerdeu).map(x => x.i));
t('controle: enquanto a última válida é a melhor (volta 3 em curso), nada marcado e sem frase',
  qAntes && qAntes.perda === null && qAntes.curvas.every(x => !x.maisPerdeu), qAntes && qAntes.perda);
t('controle: no 21/06 real (última válida = melhor), sem perda', meio3.q.perda === null, meio3.q.perda);

console.log(`\ntv-quadro-curvas: ${ok} ok / ${fail} fail`);
process.exit(fail ? 1 : 0);
