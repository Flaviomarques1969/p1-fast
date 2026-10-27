// node-smoke-trechos-volta.mjs — CATRACA dos trechos da METODOLOGIA P1 na TV e na página da volta
// (Flávio 27/10/2026, painel p1fast-gps-setores-1228: "a gente controla os trechos por todo lugar da pista que
// normalmente você freia [...] flat com o pé embaixo, não é um trecho, aí é uma reta").
// Casa do corte: web/command-box/cerebro/trechos-volta.js. Medida por volta: cerebro-gps-tv.js.
// Fonte: _design-reference/BARRAS-BRASILIA-FLAVIO-APROVADO-2026-05-27.json (o mesmo que o carro lê).
// Offline. Cada regra tem um CONTROLE que tem de dar o resultado oposto.
import { readFileSync } from 'node:fs';
import { criarCerebroGpsTv } from '../web/command-box/cerebro/cerebro-gps-tv.js';
import { TRECHOS_BRASILIA, FONTE_TRECHOS_BRASILIA } from '../web/command-box/trechos-brasilia.js';
import { TIPO_POR_CURVA } from '../web/command-box/tipos-curva-brasilia.js';

let ok = 0, fail = 0;
const t = (nome, cond, extra) => { if (cond) { ok++; console.log('  ok ', nome); } else { fail++; console.log('  FAIL', nome, extra ?? ''); } };
const ler = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const perto = (a, b, tol) => a != null && b != null && Math.abs(a - b) <= tol;
const soma = (xs) => xs.reduce((a, b) => a + b, 0);
const copia = (o) => JSON.parse(JSON.stringify(o));
const trechosDe = (cadastro, extra = {}) => criarCerebroGpsTv({ trechos: cadastro, ...extra }).snapshot(null).trechos;

// 1) A cópia gerada é a fonte aprovada (régua nasce da fonte: a lista sai do JSON, não de nomes digitados aqui)
const fonte = JSON.parse(ler(FONTE_TRECHOS_BRASILIA)).trechos;
const CAMPOS = ['id', 'ordem', 'nome', 'entrada_line_gps', 'saida_line_gps', 'apice_gps'];
const difDaFonte = (copiaMod) => fonte.length !== copiaMod.length ? ['quantidade ' + copiaMod.length + ' × ' + fonte.length]
  : fonte.flatMap((f, i) => CAMPOS.filter(k => JSON.stringify(f[k]) !== JSON.stringify(copiaMod[i][k])).map(k => f.nome + '.' + k));
t('cópia: trechos-brasilia.js = chave "trechos" do BARRAS aprovado (todos os campos)', fonte.length > 0 && difDaFonte(TRECHOS_BRASILIA).length === 0,
  difDaFonte(TRECHOS_BRASILIA).join(', '));
const mexida = copia(TRECHOS_BRASILIA); mexida[3].apice_gps.lat += 0.0001;
t('controle: cópia com um ápice mexido → a régua acusa o campo', difDaFonte(mexida).join() === fonte[3].nome + '.apice_gps', difDaFonte(mexida).join());
t('cópia: todo nome do cadastro tem tipo definido (SF = pé embaixo)', fonte.every(f => TIPO_POR_CURVA[f.nome]),
  fonte.filter(f => !TIPO_POR_CURVA[f.nome]).map(f => f.nome).join(', '));

// 2) O corte de Brasília: curva SF vira reta, ordem pela volta, sem buraco
const br = criarCerebroGpsTv().snapshot(null).trechos;
const curvas = br.lista.filter(x => x.tipo === 'curva');
const sf = fonte.filter(f => TIPO_POR_CURVA[f.nome] === 'SF').map(f => f.nome);
t('Brasília: sem erro, curvas = cadastro menos as de pé embaixo, uma reta antes de cada curva e a reta da chegada',
  br.erro === null && curvas.length === fonte.length - sf.length && br.lista.length === curvas.length * 2 + 1,
  br.erro + ' ' + br.lista.length);
t('SF: curva de pé embaixo não é trecho — fica dentro de uma reta, citada pelo nome', sf.length > 0
  && sf.every(n => !curvas.some(c => c.nome === n) && br.lista.some(x => x.tipo === 'reta' && x.peEmbaixo.includes(n))), sf.join());
const semSf = trechosDe(TRECHOS_BRASILIA, { tipoPorCurva: {} });
t('controle: sem o tipo SF → a mesma curva vira trecho (um pedaço a mais de curva)', semSf.lista.filter(x => x.tipo === 'curva').length === fonte.length);
t('ordem: trechos contíguos da chegada (0) à chegada (1), na ordem do traçado',
  br.lista[0].de === 0 && br.lista[br.lista.length - 1].ate === 1
  && br.lista.every((x, i) => x.i === i + 1 && x.ate > x.de && (i === 0 || x.de === br.lista[i - 1].ate)));
t('ordem: a da volta (C01, C2, JUNÇÃO, BRUXA, RETA OPOSTA, PLACAR, "S"), não o campo "ordem" do cadastro',
  curvas.map(c => c.nome).join('|') === ['CURVA 01', 'CURVA 2', 'CURVA DA JUNÇÃO', 'CURVA DA BRUXA', 'CURVA DA RETA OPOSTA', 'CURVA DO PLACAR', 'CURVA "S"'].join('|'),
  curvas.map(c => c.nome).join('|'));
const embaralhado = trechosDe(copia(TRECHOS_BRASILIA).reverse(), { tipoPorCurva: TIPO_POR_CURVA });
t('controle: cadastro em outra ordem → o mesmo corte', JSON.stringify(embaralhado.lista) === JSON.stringify(br.lista));
t('curva: entrada, ápice e saída com lugar no desenho da pista', curvas.every(c => c.entrada.x != null && c.apice.y != null && c.saida.x != null));

// 3) Cadastro que não fecha = sem trechos e o motivo (nunca corte pela metade)
const invertida = copia(TRECHOS_BRASILIA);
const c2 = invertida.find(x => x.nome === 'CURVA 2');
[c2.entrada_line_gps, c2.saida_line_gps] = [c2.saida_line_gps, c2.entrada_line_gps];
const rInv = trechosDe(invertida, { tipoPorCurva: TIPO_POR_CURVA });
t('controle: saída antes da entrada → lista vazia + erro com o nome da curva', rInv.lista.length === 0 && /CURVA 2/.test(rInv.erro || ''), rInv.erro);
const longe = copia(TRECHOS_BRASILIA);
longe[0].apice_gps = { lat: -23.5, lng: -46.6 };
const rLonge = trechosDe(longe, { tipoPorCurva: TIPO_POR_CURVA });
t('controle: linha fora do traçado → lista vazia + erro', rLonge.lista.length === 0 && /fora do traçado/.test(rLonge.erro || ''), rLonge.erro);
const sobre = copia(TRECHOS_BRASILIA);
const bruxa = sobre.find(x => x.nome === 'CURVA DA BRUXA'), junc = sobre.find(x => x.nome === 'CURVA DA JUNÇÃO');
bruxa.entrada_line_gps = copia(junc.saida_line_gps); junc.saida_line_gps = copia(sobre.find(x => x.nome === 'CURVA DA RETA OPOSTA').entrada_line_gps);
const rSobre = trechosDe(sobre, { tipoPorCurva: TIPO_POR_CURVA });
t('controle: duas curvas se sobrepondo → lista vazia + erro', rSobre.lista.length === 0 && /sobrepõem/.test(rSobre.erro || ''), rSobre.erro);
t('pista sem cadastro → sem trechos e sem erro', JSON.stringify(trechosDe([]).lista) === '[]' && trechosDe([]).erro === null
  && trechosDe(null).lista.length === 0);

// 4) Medida por volta na gravação REAL de 21/06 (km/h da gravação veio 3,6× — corrigido pela distância, como na página)
const pts = JSON.parse(ler('web/command-box/fixtures/replay-hoje-2026-06-21.json')).amostras
  .filter(a => a.tipo === 'gps').map(a => (typeof a.kmh === 'number' ? { ...a, kmh: a.kmh / 3.6 } : a));
const cer = criarCerebroGpsTv();
for (const p of pts) cer.feedGps(p);
const s = cer.snapshot(null);
const fechadas = s.voltas;
t('real 21/06: 2 voltas fechadas, cada uma com um tempo por trecho', fechadas.length === 2
  && fechadas.every(v => v.trechos && v.trechos.length === s.trechos.lista.length), fechadas.length);
t('real 21/06: a soma dos trechos = tempo da volta (±0,002)', fechadas.every(v => perto(soma(v.trechos.map(x => x.tempoS)), v.tempoS, 0.002)),
  fechadas.map(v => soma(v.trechos.map(x => x.tempoS)) + ' × ' + v.tempoS).join('; '));
t('real 21/06: tempos 194,953 e 159,597; ideal pelos trechos 158,172 (≤ melhor volta)',
  perto(fechadas[0].tempoS, 194.953, 0.002) && perto(fechadas[1].tempoS, 159.597, 0.002)
  && perto(s.trechos.voltaIdealS, 158.172, 0.002) && s.trechos.voltaIdealS <= fechadas[1].tempoS, s.trechos.voltaIdealS);
t('real 21/06: mínima do trecho ≤ entrada e ≤ saída, com o lugar', fechadas.every(v => v.trechos.every(x =>
  x.kmhMin != null && x.kmhMin <= x.kmhEntrada + 1e-9 && x.kmhMin <= x.kmhSaida + 1e-9 && x.minX != null)));
t('real 21/06: a saída de um trecho é a entrada do seguinte (mesmo ponto da fronteira)',
  fechadas.every(v => v.trechos.every((x, i) => i === 0 || x.kmhEntrada === v.trechos[i - 1].kmhSaida)));
t('real 21/06: volta em curso sabe o trecho atual (3ª volta para no 6º, a gravação acaba ali)',
  s.voltaAtual && s.voltaAtual.n === 3 && s.voltaAtual.trechoAtual === 6, JSON.stringify(s.voltaAtual));
const pu = s.trechos.perdasUltima;
t('"a última perdeu": só trecho pior que o melhor, do maior para o menor, até 3, com a conta certa',
  pu.length > 0 && pu.length <= 3 && pu.every((x, i) => x.difS > 0 && (i === 0 || pu[i - 1].difS >= x.difS)
    && perto(x.difS, fechadas[1].trechos[x.i - 1].tempoS - s.trechos.melhoresS[x.i - 1], 0.001)), JSON.stringify(pu));
// controle: cadastro quebrado não derruba volta nem setor — só some o trecho
const cerQ = criarCerebroGpsTv({ trechos: invertida, tipoPorCurva: TIPO_POR_CURVA });
for (const p of pts) cerQ.feedGps(p);
const sQ = cerQ.snapshot(null);
t('controle: cadastro quebrado → voltas e setores iguais, trechos nulos, nada perdido inventado',
  sQ.voltas.length === 2 && sQ.voltas.every((v, i) => v.tempoS === fechadas[i].tempoS && JSON.stringify(v.setoresS) === JSON.stringify(fechadas[i].setoresS)
    && v.trechos === null) && sQ.trechos.perdasUltima.length === 0 && sQ.voltaAtual.trechoAtual === null);

// 5) A TV só desenha (a conta mora no cérebro)
const tv = ler('_design-reference/mockup-command-box-vista-piloto.html');
const blocoTv = tv.slice(tv.indexOf('<!-- TV-GPS item 5'));
t('TV: desenha marcas e linhas de trecho a partir de s.trechos', /desenharTrechosMapa\(ui\.trechosMapa, s\)/.test(blocoTv)
  && /data-tv-trechos/.test(blocoTv) && /perdasUltima/.test(blocoTv) && /trechoAtual/.test(blocoTv));
t('TV: não corta trecho nem subtrai tempo de trecho', !/montarTrechosDaVolta|trechos-volta\.js|tempoS\s*-\s*|melhoresS\[[^\]]+\]\s*-/.test(blocoTv));

console.log(`\ntrechos-volta: ${ok} ok / ${fail} fail`);
process.exit(fail ? 1 : 0);
