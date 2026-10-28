// node-smoke-tv-faixa-volta.mjs — CATRACA do pedido de 28/10/2026 para a TV do box (Flávio: "a TV ainda está bem
// fraca"): (1) km da sessão no cérebro (o odômetro do velocímetro saiu da tela), (2) a faixa da volta inteira —
// VELOCIDADE do GPS por posição com as FREADAS, volta atual × melhor válida, Δ por posição (refeita 28/10: o G pela
// velocidade saía serrilhado, "frenagem em V") — e (3) o plano do stint aprovado no celular
// × o que o carro fez. Casas: web/command-box/cerebro/cerebro-gps-tv.js e cerebro-tv-blocos-gps.js; porta de
// leitura do plano: web/cockpit/treino-stint.js (lerUltimoPlanoStint). Gravação REAL de 21/06; offline.
import { readFileSync } from 'node:fs';
import { criarCerebroGpsTv } from '../web/command-box/cerebro/cerebro-gps-tv.js';
import { pathToFileURL } from 'node:url';
// Mutação: FAIXA_BLOCOS=<cópia do cerebro-tv-blocos-gps.js> roda a prova contra outra versão (a faixa antiga, de G, reprova)
const { criarCerebroTvBlocosGps, planoDoStint, FAIXA_BINS, zonasDeFreada } = await import(process.env.FAIXA_BLOCOS
  ? pathToFileURL(process.env.FAIXA_BLOCOS).href : '../web/command-box/cerebro/cerebro-tv-blocos-gps.js');
import { lerUltimoPlanoStint, buscarPlanoStintDaNuvem } from '../web/cockpit/treino-stint.js';

let ok = 0, fail = 0;
const t = (nome, cond, extra) => { if (cond) { ok++; console.log('  ok ', nome); } else { fail++; console.log('  FAIL', nome, extra !== undefined ? JSON.stringify(extra) : ''); } };

const fx = JSON.parse(readFileSync(new URL('../web/command-box/fixtures/replay-hoje-2026-06-21.json', import.meta.url), 'utf8'));
// a gravação de 21/06 tem o km/h 3,6× maior (leitor antigo do RaceBox) — mesma correção da TV
const pts = fx.amostras.filter(a => a.tipo === 'gps').map(a => ({ ...a, lng: a.lon, kmh: a.kmh / 3.6, source: 'racebox' }));

// ── 1) km da sessão: conta independente (haversine) com as mesmas regras ──
{
  const c = criarCerebroGpsTv({ guardarVoltas: true });
  let km = 0, ult = null;
  const R = 6371000, r = Math.PI / 180;
  for (const p of pts) {
    const entrou = c.feedGps(p);
    if (!entrou) continue;
    if (ult && p.tWall - ult.tWall < 2000 && (p.kmh || 0) >= 3 && !(p.hacc > 10)) {
      const dLa = (p.lat - ult.lat) * r, dLo = (p.lng - ult.lng) * r;
      const h = Math.sin(dLa / 2) ** 2 + Math.cos(ult.lat * r) * Math.cos(p.lat * r) * Math.sin(dLo / 2) ** 2;
      const d = 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
      if (d < 60) km += d / 1000;
    }
    ult = p;
  }
  const s = c.snapshot();
  t('km da sessão = soma independente dos trechos andados (±0,5%)', Math.abs(s.kmSessao - km) <= km * 0.005, [s.kmSessao, km]);
  t('km da sessão ≈ voltas × pista (2 voltas fechadas de 5,384 km e a 3ª em curso: entre 10,8 e 18 km)', s.kmSessao > 10.8 && s.kmSessao < 18, s.kmSessao);
  // controles: parado não soma; buraco de 5 s não soma
  const c2 = criarCerebroGpsTv();
  const base = { source: 'racebox', fix: 3, hacc: 0.3, lat: -15.773, lng: -47.900 };
  c2.feedGps({ ...base, tWall: 1000, kmh: 0 });
  c2.feedGps({ ...base, tWall: 1040, kmh: 0, lat: -15.7731 });
  c2.feedGps({ ...base, tWall: 6040, kmh: 80, lat: -15.7740 });
  t('controle: parado e buraco de 5 s não somam km', c2.snapshot().kmSessao === 0, c2.snapshot().kmSessao);
  c2.feedGps({ ...base, tWall: 6080, kmh: 80, lat: -15.77409 });
  t('controle: andando 10 m em 40 ms soma ~0,010 km', Math.abs(c2.snapshot().kmSessao - 0.010) <= 0.001, c2.snapshot().kmSessao);
}

// ── 2) faixa da volta inteira (21/06). A volta 1 é de aquecimento e NÃO é referência
// (Flávio 28/10, item 6 de p1fast-mapa-tv-2045): na volta 2 a faixa só desenha a volta em curso; a comparação começa na
// volta 3 contra a volta 2 (a primeira válida) ──
{
  const c = criarCerebroGpsTv({ guardarVoltas: true });
  const casa = criarCerebroTvBlocosGps();
  let ultimaDaVolta3 = null, meioVolta2 = null, saida = null;
  for (const p of pts) {
    c.feedGps(p);
    const s = c.snapshot();
    if (!s.voltaAtual && !saida && s.agora) saida = casa.pacote(s);
    if (s.voltaAtual && s.voltaAtual.n === 2 && !meioVolta2 && s.voltaAtual.decorridoS > 70) meioVolta2 = { s, b: casa.pacote(s) };
    if (s.voltaAtual && s.voltaAtual.n === 3) ultimaDaVolta3 = s;
  }
  const sF = c.snapshot();
  const fx3 = casa.pacote(ultimaDaVolta3).faixa;
  const m = meioVolta2.b.faixa;
  t('saída do box (ainda sem volta) → sem faixa', saida && saida.faixa === null, saida && saida.faixa);
  t('controle: a volta 1 de 21/06 é aquecimento', sF.voltas[0].descarte === 'aquecimento' && !sF.voltas[1].descarte, sF.voltas.map(v => v.descarte));
  t('volta 2: a faixa desenha a volta em curso, mas SEM referência (a volta 1 é aquecimento) e sem Δ',
    m && m.atual && m.atual.n === 2 && m.melhor === null && m.delta === null && m.deltaAgoraS === null, m && [m.melhor, m.deltaAgoraS]);
  t('faixa: fonte = GPS (velocidade do RaceBox)', fx3 && fx3.fonte === 'gps', fx3 && fx3.fonte);
  t('faixa: melhor = a primeira volta válida (2), atual = 3', fx3.melhor && fx3.melhor.n === 2 && fx3.atual.n === 3, fx3.melhor && [fx3.melhor.n, fx3.atual.n]);
  t('faixa: ' + FAIXA_BINS + ' casas de km/h e a melhor cobre ≥ 95% da volta', fx3.melhor.kmh && fx3.melhor.kmh.length === FAIXA_BINS
    && fx3.melhor.kmh.filter(x => x != null).length >= FAIXA_BINS * 0.95, fx3.melhor.kmh && fx3.melhor.kmh.filter(x => x != null).length);
  // Δ no ponto do carro, conta independente: tempo da volta 3 até aqui − tempo da volta 2 no mesmo ponto da volta
  const pa = ultimaDaVolta3.perfilAtual, pAgora = pa[pa.length - 1].p, pr = sF.voltas[1].perfil;
  const k = pr.findIndex(q => q.p >= pAgora), q0 = pr[k - 1], q1 = pr[k];
  const tRef = (q0.t + (q1.t - q0.t) * (pAgora - q0.p) / (q1.p - q0.p)) / (pr[pr.length - 1].t > 1000 ? 1000 : 1);
  const tAt = pa[pa.length - 1].t / (pr[pr.length - 1].t > 1000 ? 1000 : 1);
  t('Δ no carro (volta 3, ' + Math.round(pAgora * 100) + '% da volta) ≈ tempo da volta 3 − tempo da volta 2 no mesmo ponto (±0,3 s)',
    Math.abs(fx3.deltaAgoraS - (tAt - tRef)) <= 0.3, [fx3.deltaAgoraS, tAt - tRef]);
  t('meio da volta: atual só até o carro (casas depois do cursor vazias)', m.atual.ate < FAIXA_BINS - 20 && !!m.atual.kmh && m.atual.kmh.slice(m.atual.ate + 1).every(x => x == null), m.atual.ate);
  t('meio da volta: cursor na casa do carro', Math.floor(m.cursor * FAIXA_BINS) === m.atual.ate, [m.cursor, m.atual.ate]);
  // km/h de cada casa, conta independente: média do km/h dos pontos da volta 2 que caem na casa (longe da chegada)
  const perf = sF.voltas[1].perfil;
  let casasOk = 0, casasTot = 0;
  for (let k = 10; k < FAIXA_BINS - 10; k += 17) {
    const naCasa = perf.filter(q => q.p != null && Math.floor(q.p * FAIXA_BINS) === k && q.d > 300 && q.kmh != null);
    if (!naCasa.length) continue;
    casasTot++;
    if (Math.abs(fx3.melhor.kmh[k] - naCasa.reduce((a, q) => a + q.kmh, 0) / naCasa.length) <= 0.06) casasOk++;
  }
  t('km/h de cada casa = média dos pontos da volta naquela casa (conta independente, ' + casasTot + ' casas)', casasTot >= 10 && casasOk === casasTot, [casasOk, casasTot]);
  // freadas da melhor válida (volta 2): uma por curva, e a velocidade cai de verdade em cada uma
  const fr = fx3.melhor.freadas || [], curvas = fx3.curvas;
  t('freadas da melhor válida: uma por curva (' + curvas.length + '), sem freada a mais', fr.length === curvas.length, fr.map(z => [z.de, z.ate]));
  t('cada curva tem a sua freada terminando perto da entrada (até 3% da volta antes, 2% depois)',
    curvas.every(cv => fr.some(z => z.ate >= cv.de - 0.03 && z.ate <= cv.de + 0.02)), curvas.map(cv => cv.de));
  const quedaReal = (z) => { const pz = perf.filter(q => q.p >= z.de && q.p <= z.ate && !(q.d < 300 && q.p > 0.5) && q.kmh != null); return pz.length > 1 ? [pz[0].kmh - pz[pz.length - 1].kmh, Math.max(...pz.map(q => q.kmh)) - pz[0].kmh] : null; };
  t('em cada freada a velocidade do GPS cai ≥ 8 km/h do começo ao fim e não sobe no meio (≤ 2 km/h)',
    fr.length > 0 && fr.every(z => { const r = quedaReal(z); return r && r[0] >= 8 && r[1] <= 2; }), fr.map(quedaReal));
  // o tirar o pé da reta oposta (21/06, ~2,5 km: 151 → 141 km/h a 0,09 G) não é freada
  t('controle: tirar o pé (151 → 141 km/h, 47–50% da volta) NÃO vira freada', !fr.some(z => z.de > 0.465 && z.de < 0.5), fr.map(z => z.de));
  t('freadas da volta em curso só até o carro', !!m.atual.freadas && m.atual.freadas.every(z => Math.floor(z.ate * FAIXA_BINS) <= m.atual.ate), [m.atual.freadas, m.atual.ate]);
  t('curvas do cadastro vão junto (marcas da faixa)', fx3.curvas.length > 5 && fx3.curvas.every(cv => cv.de >= 0 && cv.de < 1), fx3.curvas.length);
}

// ── 2b) freadas: casos montados à mão (velocidade a 25 Hz em linha reta de 1 km); sinal de "V" não abre freada ──
{
  const perfil = (kmhDe) => { const out = []; let d = 400; for (let i = 0; i < 1000; i++) { const kmh = kmhDe(i * 0.04); d += kmh / 3.6 * 0.04; out.push({ t: i * 0.04, d, p: d / 5384, kmh }); } return out; };
  const reto = perfil(() => 120), ruido = perfil(t => 120 + 3 * Math.sin(t * 2.1)), lift = perfil(t => (t < 10 ? 120 : t < 13 ? 120 - 2 * (t - 10) : 114));
  const freada = perfil(t => (t < 10 ? 140 : t < 13 ? 140 - 20 * (t - 10) : 80));
  t('reto a 120 km/h: nenhuma freada', zonasDeFreada(reto, true).length === 0);
  t('ondulação de ±3 km/h a cada 3 s (o que fazia o "V"): nenhuma freada', zonasDeFreada(ruido, true).length === 0, zonasDeFreada(ruido, true));
  t('tirar o pé 120 → 114 km/h: nenhuma freada', zonasDeFreada(lift, true).length === 0, zonasDeFreada(lift, true));
  const z = zonasDeFreada(freada, true);
  t('freada 140 → 80 km/h em 3 s: UMA freada de ~60 km/h que começa e acaba onde a velocidade cai', z.length === 1 && Math.abs(z[0].quedaKmh - 60) <= 1
    && Math.abs(z[0].kmhDe - 140) <= 6 && Math.abs(z[0].kmhAte - 80) <= 6 && z[0].aberta === false, z);
  const aberta = zonasDeFreada(perfil(t => (t < 30 ? 140 : 140 - 20 * (t - 30))).slice(0, 875), false);
  t('volta em curso no meio da freada → a freada sai aberta', aberta.length === 1 && aberta[0].aberta === true, aberta);
}

// ── 3) plano do stint × o que o carro fez ──
{
  const plano = { proposito: 'livre', voltas: 10, paradas: [{ volta: 4, motivo: 'box' }], tipoPneu: 'radial 195 50 r 15' };
  const p2 = planoDoStint({ plano, dia: '2026-10-28', deHoje: true }, { feitas: 2 });
  t('plano de hoje: 10 voltas, feitas 2, faltam 8, box na 4 (daqui a 2)', p2.tem && p2.feitas === 2 && p2.faltam === 8 && p2.proximaParada.volta === 4 && p2.proximaParada.emVoltas === 2, p2);
  const p5 = planoDoStint({ plano, dia: '2026-10-28', deHoje: true }, { feitas: 5 });
  t('depois da parada planejada → sem próxima parada', p5.proximaParada === null && p5.faltam === 5, p5);
  const velho = planoDoStint({ plano, dia: '2026-07-10', deHoje: false }, { feitas: 2 });
  t('controle: plano de outro dia NÃO se compara com o stint de hoje (sem feitas/faltam)', velho.tem && !velho.deHoje && velho.dia === '2026-07-10' && !('faltam' in velho), velho);
  t('nenhum plano gravado → tem: false', planoDoStint({ plano: null }, { feitas: 0 }).tem === false);
  t('ainda não leu → null (a TV não afirma "sem plano")', planoDoStint(undefined, { feitas: 0 }) === null);
}

// ── 3b) porta de leitura (fetch falso) ──
{
  const resp = (status, rows) => async () => ({ ok: status === 200, json: async () => rows });
  const hojeIso = '2026-10-28T15:00:00Z';
  const env = (created_at) => [{ created_at, plano_stint: { proposito: 'livre', voltas: 10, paradas: [] } }];
  const a = await lerUltimoPlanoStint({ carroId: 'x', fetchFn: resp(200, env('2026-10-28T12:00:00Z')), agoraIso: hojeIso });
  t('porta: plano aprovado hoje → deHoje', a && a.deHoje === true && a.dia === '2026-10-28', a);
  const b = await lerUltimoPlanoStint({ carroId: 'x', fetchFn: resp(200, env('2026-07-10T23:37:36Z')), agoraIso: hojeIso });
  t('porta: plano de 10/07 → último plano com o dia, não é de hoje', b && b.deHoje === false && b.dia === '2026-07-10', b);
  t('porta: sem envelope → { plano: null }', (await lerUltimoPlanoStint({ carroId: 'x', fetchFn: resp(200, []), agoraIso: hojeIso })).plano === null);
  t('controle: erro HTTP → null (não lido, não "sem plano")', (await lerUltimoPlanoStint({ carroId: 'x', fetchFn: resp(500, null), agoraIso: hojeIso })) === null);
  t('painel da pista segue igual: plano de 10/07 não arma treino hoje', (await buscarPlanoStintDaNuvem({ carroId: 'x', fetchFn: resp(200, env('2026-07-10T23:37:36Z')), agoraIso: hojeIso })) === null);
}

// ── 4) painel de voltas ──
{
  const c = criarCerebroGpsTv({ guardarVoltas: true });
  for (const p of pts) c.feedGps(p);
  const s = c.snapshot(), st = criarCerebroTvBlocosGps().pacote(s).stint;
  t('voltas: só a última marcada como última', st.voltas.filter(v => v.ultima).length === 1 && st.voltas[st.voltas.length - 1].ultima, st.voltas);
  t('voltas: ideal = soma dos melhores setores do cérebro', st.idealS === s.voltaIdealS, [st.idealS, s.voltaIdealS]);
}

console.log(`\ntv-faixa-volta: ${ok} ok / ${fail} fail`);
process.exit(fail ? 1 : 0);
