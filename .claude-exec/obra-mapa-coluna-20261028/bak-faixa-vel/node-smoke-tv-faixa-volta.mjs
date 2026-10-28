// node-smoke-tv-faixa-volta.mjs — CATRACA do pedido de 28/10/2026 para a TV do box (Flávio: "a TV ainda está bem
// fraca"): (1) km da sessão no cérebro (o odômetro do velocímetro saiu da tela), (2) a faixa da volta inteira —
// G longitudinal por posição, volta atual × melhor, Δ por posição — e (3) o plano do stint aprovado no celular
// × o que o carro fez. Casas: web/command-box/cerebro/cerebro-gps-tv.js e cerebro-tv-blocos-gps.js; porta de
// leitura do plano: web/cockpit/treino-stint.js (lerUltimoPlanoStint). Gravação REAL de 21/06; offline.
import { readFileSync } from 'node:fs';
import { criarCerebroGpsTv } from '../web/command-box/cerebro/cerebro-gps-tv.js';
import { criarCerebroTvBlocosGps, planoDoStint, FAIXA_BINS } from '../web/command-box/cerebro/cerebro-tv-blocos-gps.js';
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

// ── 2) faixa da volta inteira (21/06, sem G medido → G pela velocidade). A volta 1 é de aquecimento e NÃO é referência
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
  t('faixa: fonte = velocidade (a gravação não tem G medido)', fx3 && fx3.fonte === 'velocidade', fx3 && fx3.fonte);
  t('faixa: melhor = a primeira volta válida (2), atual = 3', fx3.melhor && fx3.melhor.n === 2 && fx3.atual.n === 3, fx3.melhor && [fx3.melhor.n, fx3.atual.n]);
  t('faixa: ' + FAIXA_BINS + ' casas e a melhor cobre ≥ 95% da volta', fx3.melhor.g.length === FAIXA_BINS && fx3.melhor.g.filter(x => x != null).length >= FAIXA_BINS * 0.95,
    fx3.melhor.g.filter(x => x != null).length);
  // Δ no ponto do carro, conta independente: tempo da volta 3 até aqui − tempo da volta 2 no mesmo ponto da volta
  const pa = ultimaDaVolta3.perfilAtual, pAgora = pa[pa.length - 1].p, pr = sF.voltas[1].perfil;
  const k = pr.findIndex(q => q.p >= pAgora), q0 = pr[k - 1], q1 = pr[k];
  const tRef = (q0.t + (q1.t - q0.t) * (pAgora - q0.p) / (q1.p - q0.p)) / (pr[pr.length - 1].t > 1000 ? 1000 : 1);
  const tAt = pa[pa.length - 1].t / (pr[pr.length - 1].t > 1000 ? 1000 : 1);
  t('Δ no carro (volta 3, ' + Math.round(pAgora * 100) + '% da volta) ≈ tempo da volta 3 − tempo da volta 2 no mesmo ponto (±0,3 s)',
    Math.abs(fx3.deltaAgoraS - (tAt - tRef)) <= 0.3, [fx3.deltaAgoraS, tAt - tRef]);
  t('meio da volta: atual só até o carro (casas depois do cursor vazias)', m.atual.ate < FAIXA_BINS - 20 && m.atual.g.slice(m.atual.ate + 1).every(x => x == null), m.atual.ate);
  t('meio da volta: cursor na casa do carro', Math.floor(m.cursor * FAIXA_BINS) === m.atual.ate, [m.cursor, m.atual.ate]);
  // o G pela velocidade tem o sinal da velocidade: onde a melhor volta mais perde km/h numa casa, freia
  const perf = sF.voltas[1].perfil;
  const g = fx3.melhor.g;
  const minG = Math.min(...g.filter(x => x != null)), maxG = Math.max(...g.filter(x => x != null));
  t('G pela velocidade em faixa física (freia −0,3…−1,6 G; acelera +0,1…+0,8 G)', minG < -0.3 && minG > -1.6 && maxG > 0.1 && maxG < 0.8, [minG, maxG]);
  const kFreia = g.indexOf(minG);
  const naCasa = perf.filter(q => Math.floor(q.p * FAIXA_BINS) === kFreia && q.d > 300);
  t('na casa de maior freada a velocidade cai de verdade', naCasa.length > 1 && naCasa[naCasa.length - 1].kmh < naCasa[0].kmh, naCasa.map(q => q.kmh));
  t('curvas do cadastro vão junto (marcas da faixa)', fx3.curvas.length > 5 && fx3.curvas.every(cv => cv.de >= 0 && cv.de < 1), fx3.curvas.length);
}

// ── 2b) G MEDIDO: a melhor válida (2) e a atual (3) com zero do box → fonte medido; a atual sem → as duas pela velocidade ──
{
  function rodar(zeroNaVolta3) {
    const c = criarCerebroGpsTv({ guardarVoltas: true }), casa = criarCerebroTvBlocosGps();
    let ult = null;
    for (const p of pts) {
      const naVolta3 = !!(ult && ult.voltaAtual && ult.voltaAtual.n === 3);
      c.feedGps({ ...p, gLong: 0.2, gLat: 0, zeroOk: zeroNaVolta3 || !naVolta3 });
      const s = c.snapshot();
      if (s.voltaAtual && s.voltaAtual.n === 3) ult = s;
    }
    return casa.pacote(ult).faixa;
  }
  const med = rodar(true);
  t('as duas voltas com G medido → fonte medido e o G é o do RaceBox (+0,20)', med.fonte === 'medido' && med.melhor.n === 2 && med.melhor.g.filter(x => x != null).every(x => x === 0.2), [med.fonte, med.melhor && med.melhor.g.slice(0, 3)]);
  const mis = rodar(false);
  t('controle: volta atual sem o zero do box → as DUAS pela velocidade (nunca uma de cada)', mis.fonte === 'velocidade' && mis.melhor.g.some(x => x != null && x !== 0.2), mis.fonte);
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
