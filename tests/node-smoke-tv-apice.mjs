// node-smoke-tv-apice.mjs — CATRACA do pedido de 28/10/2026 (Flávio: "distância do carro ao ápice no mapa da TV").
// O cérebro da TV (web/command-box/cerebro/cerebro-gps-tv.js) mede, por curva e por volta, a menor distância de um
// ponto do GPS ao ápice cadastrado (apice_gps de trechos-brasilia.js) → voltas[v].trechos[i].apiceM e, na curva em
// curso, voltaAtual.apiceAgoraM. Aqui a conta é refeita de outro jeito: cruzamento das LINHAS de entrada e saída do
// cadastro (segmento × segmento, não a posição projetada no traçado) e haversine (não a conta plana do carro).
// Gravação REAL de 21/06; offline. Controles: ápice deslocado 30 m muda o número; um cérebro que ignora o ápice
// (APICE_CEREBRO, abaixo) e um que mede no ponto mais LONGE reprovam.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
// Mutação: APICE_CEREBRO=<cópia do cerebro-gps-tv.js NA MESMA PASTA> roda a prova contra outra versão (sem o ápice, reprova)
const { criarCerebroGpsTv } = await import(process.env.APICE_CEREBRO
  ? pathToFileURL(process.env.APICE_CEREBRO).href : '../web/command-box/cerebro/cerebro-gps-tv.js');
import { TRECHOS_BRASILIA } from '../web/command-box/trechos-brasilia.js';
import { TIPO_POR_CURVA } from '../web/command-box/tipos-curva-brasilia.js';

let ok = 0, fail = 0;
const t = (nome, cond, extra) => { if (cond) { ok++; console.log('  ok ', nome); } else { fail++; console.log('  FAIL', nome, extra !== undefined ? JSON.stringify(extra) : ''); } };

const fx = JSON.parse(readFileSync(new URL('../web/command-box/fixtures/replay-hoje-2026-06-21.json', import.meta.url), 'utf8'));
// a gravação de 21/06 tem o km/h 3,6× maior (leitor antigo do RaceBox) — mesma correção da TV
const pts = fx.amostras.filter(a => a.tipo === 'gps').map(a => ({ ...a, lng: a.lon, kmh: a.kmh / 3.6, source: 'racebox' }));

// ── conta independente: passagens por curva (entrou pela linha de entrada, saiu pela de saída) e menor haversine ──
const hav = (a, b) => { const R = 6371000, r = Math.PI / 180, dLa = (b.lat - a.lat) * r, dLo = (b.lng - a.lng) * r;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const lado = (a, b, c) => Math.sign((b.lng - a.lng) * (c.lat - a.lat) - (b.lat - a.lat) * (c.lng - a.lng));
const cruza = (p, q, l) => lado(p, q, l.a) !== lado(p, q, l.b) && lado(l.a, l.b, p) !== lado(l.a, l.b, q);
function passagens(c) {
  const P = pts.filter(p => p.lat != null), feitas = []; let dentro = null;
  for (let i = 1; i < P.length; i++) {
    if (dentro == null && cruza(P[i - 1], P[i], c.entrada_line_gps)) dentro = Infinity;
    if (dentro != null) {
      dentro = Math.min(dentro, hav(P[i - 1], c.apice_gps), hav(P[i], c.apice_gps));
      if (cruza(P[i - 1], P[i], c.saida_line_gps)) { feitas.push(dentro); dentro = null; }
    }
  }
  return { feitas, emCurso: dentro };
}

const rodar = (opts) => {
  const c = criarCerebroGpsTv({ guardarVoltas: true, ...opts });
  const subiu = [];   // apiceAgoraM dentro da mesma curva em curso: só pode diminuir
  let ant = null;
  for (const p of pts) {
    c.feedGps(p);
    const a = c.snapshot().voltaAtual;
    const k = a ? a.n + ':' + a.trechoAtual : null;
    if (a && ant && ant.k === k && ant.m != null && (a.apiceAgoraM == null || a.apiceAgoraM > ant.m)) subiu.push([k, ant.m, a.apiceAgoraM]);
    ant = a ? { k, m: a.apiceAgoraM } : null;
  }
  return { s: c.snapshot(), subiu };
};

const TOL = 0.3;   // m: arredondamento a 0,1 m + o ponto da fronteira, que o cérebro conta nos dois trechos
const { s, subiu } = rodar({});
const lista = s.trechos.lista;
const v2 = s.voltas.find(v => v.n === 2), at = s.voltaAtual;
t('volta 2 fechada e volta 3 em curso na gravação', !!v2 && at && at.n === 3, [s.voltas.map(v => v.n), at && at.n]);
let conferidas = 0;
for (const c of TRECHOS_BRASILIA) {
  const i = lista.findIndex(x => x.tipo === 'curva' && x.nome === c.nome);
  if (i < 0) continue;   // pé embaixo (CURVA DA VITÓRIA) não é trecho da TV
  const ind = passagens(c), feitoV3 = at.trechos && at.trechos[i] ? at.trechos[i].apiceM : null;
  // a passagem da volta 2 é a penúltima feita quando a volta 3 já passou por esta curva, senão a última
  const idx = ind.feitas.length - 1 - (feitoV3 != null ? 1 : 0);
  const esperado = ind.feitas[idx];
  t(c.nome + ': volta 2 = ' + v2.trechos[i].apiceM + ' m (conta independente ' + (esperado != null ? esperado.toFixed(2) : '—') + ')',
    esperado != null && v2.trechos[i].apiceM != null && Math.abs(v2.trechos[i].apiceM - esperado) <= TOL);
  if (feitoV3 != null) t(c.nome + ': volta 3 já feita = ' + feitoV3 + ' m', Math.abs(feitoV3 - ind.feitas.at(-1)) <= TOL, ind.feitas.at(-1));
  if (ind.emCurso != null) t(c.nome + ': curva em curso no fim, agora = ' + at.apiceAgoraM + ' m', i === at.trechoAtual - 1 && Math.abs(at.apiceAgoraM - ind.emCurso) <= TOL, [at.trechoAtual, ind.emCurso]);
  conferidas++;
}
t('as 7 curvas da TV conferidas (régua não ficou cega)', conferidas === 7, conferidas);
t('retas não têm ápice', lista.every((x, i) => x.tipo === 'curva' || v2.trechos[i].apiceM == null));
t('volta 1 sai do box pela CURVA 01: longe do ápice (> 50 m) — o carro não fez a curva', s.voltas[0].trechos[lista.findIndex(x => x.nome === 'CURVA 01')].apiceM > 50, s.voltas[0].trechos.map(x => x.apiceM));
t('na curva em curso a distância ao ápice só diminui', subiu.length === 0, subiu.slice(0, 3));

// ── controles ──
{ // ápice deslocado ~30 m para o norte: o número da volta 2 tem de mudar
  const desl = TRECHOS_BRASILIA.map(c => ({ ...c, apice_gps: { lat: c.apice_gps.lat + 30 / 111320, lng: c.apice_gps.lng } }));
  const r = rodar({ trechos: desl, tipoPorCurva: TIPO_POR_CURVA }), v = r.s.voltas.find(x => x.n === 2);
  const mudou = lista.filter((x, i) => x.tipo === 'curva' && Math.abs(v.trechos[i].apiceM - v2.trechos[i].apiceM) > 3).length;
  t('controle: ápice deslocado 30 m muda a distância nas 7 curvas', mudou === 7, mudou);
}
console.log(`\nnode-smoke-tv-apice: ${ok} ok, ${fail} falha`);
process.exit(fail ? 1 : 0);
