// ============================================================================
// CÉREBRO GPS DA TV — item 5 da ordem do GPS aprovada pelo Flávio em 27/10/2026
// (painel p1fast-gps-funcoes-0850): "TV do box: mapa ao vivo com velocidade e G,
// círculo de G e tempos de volta e setores".
//
// Casa ÚNICA destas contas (docs/CONTRATO_DADOS.md §2). Módulo PURO: ponto de GPS do
// canal entra (feedGps), PacoteTv sai (snapshot). Não fala com Supabase, não toca DOM —
// a TV só desenha o pacote. Roda igual no navegador (hoje) e na nuvem (definitivo).
//
// De onde vem cada coisa:
//  - posição, km/h e carimbo: evento 'gps' do RaceBox (fonte única, item 2);
//  - G do carro: chaves gLong/gLat/zeroOk que o NOTEBOOK publica (item 5), calculadas pela
//    peça AceleracaoCarro (zero do box + eixos provados) — aqui NÃO se recalcula G;
//  - volta: cruzamento da linha de chegada pela MESMA geometria do chegada-gps.js;
//  - setores: frações do traçado do Command Box a partir da chegada (geoParaCommandBox +
//    fracDe, as peças do nuvem-posicao.mjs). Padrão = 3 setores de 1/3 da volta cada
//    (ADR-006: "3 setores macro"); a posição exata das linhas é configurável (setoresFrac).
//  - trechos (metodologia P1, painel p1fast-gps-setores-1228): cada curva de freada do cadastro aprovado
//    (o MESMO BARRAS do carro) e a reta entre elas, cortados pela casa trechos-volta.js. Por volta: tempo,
//    km/h ao cruzar a entrada, menor km/h (com o lugar) e km/h ao cruzar a saída. Freada e ápice medidos
//    ficam no carro (TrechoDetector) — aqui não se refaz essa conta.
//  - pancadas (item 7): chave gVert que o notebook publica (gz − zero de gz da parada, mesma
//    peça AceleracaoCarro). Pancada = |gVert| passa de PANCADA_G (borda de subida); o grupo
//    acaba quando volta abaixo; vale o pico do grupo, no lugar e na volta do pico.
//  - consistência (item 7): só números das voltas fechadas (média, desvio, amplitude, desvio
//    por setor, volta mais longe da média). Sem regra de corte (nada de "107%"): quem julga é a equipe.
//  - troca de marcha (item 8): buraco curto no G longitudinal durante aceleração, pela casa
//    troca-marcha-g.js (só com o zero do box valendo). Tudo "provável" até a régua da pista; a troca
//    sai ~1 s depois (o critério olha à frente) e conta na volta onde o G caiu.
//  - traseira saiu (item 9): chave giroZ que o notebook publica (giro cru do RaceBox, °/s) contra
//    o giro que a curva explica (gLat ÷ velocidade), pela casa traseira-giro.js. Só com zero do box;
//    "provável" e "a conferir" (offset do giro ainda não conferido em gravação). Saída de frente NÃO.
//  - voltas descartadas da linha do trecho e de "a última perdeu" (Flávio 28/10, painel p1fast-mapa-tv-2045:
//    "descartar a primeira volta que é de aquecimento e a última volta que é de resfriamento"). Quem marca é a
//    PARADA (box), não o tempo — continua sem regra de corte: parada = km/h abaixo de PARADO_KMH por PARADA_S
//    seguidos. 'aquecimento' = 1ª volta fechada depois de uma parada; 'parada' = volta que tem a parada dentro
//    (entrada + box + saída); 'resfriamento' = volta fechada logo antes de uma parada que começou antes de
//    RESFRIA_FRAC da volta seguinte (box depois da linha). Nas outras contas a volta continua valendo.
// ============================================================================

import { criarDetectorChegada } from './chegada-gps.js';
import { geoParaCommandBox } from '../../cockpit/pista-brasilia-commandbox.js';
import { fracDe } from '../pista-cb-polyline.js';
import { pontoGpsAceito } from '../../cockpit/gps-fonte-unica.js';
import { criarDetectorTrocaMarcha } from './troca-marcha-g.js';
import { criarDetectorTraseira } from './traseira-giro.js';
import { montarTrechosDaVolta } from './trechos-volta.js';
import { TRECHOS_BRASILIA } from '../trechos-brasilia.js';
import { TIPO_POR_CURVA } from '../tipos-curva-brasilia.js';

/** Linha de chegada oficial de Brasília (tabela marcos, migração 0031 — a mesma da Vista Piloto). */
export const MARCO_CHEGADA_BRASILIA = {
  a_gps: { lat: -15.7728816, lng: -47.9000707 },
  b_gps: { lat: -15.7725493, lng: -47.9001926 },
};
/** Linhas de setor em fração da volta, contada da chegada ao longo do traçado (3 setores iguais). */
export const SETORES_FRAC_PADRAO = [1 / 3, 2 / 3];
/** Sentido do traçado na pista: a fração CRESCE andando (medido na sessão real 21/06: +2,39 em 2,4 voltas). */
export const SENTIDO_BRASILIA = +1;

/** Faixas de G longitudinal que colorem o rastro (mesmo −0,10 G do "freio firme" dos itens 3 e 4). */
export const G_FREIO = -0.10;
export const G_ACEL = +0.10;
/** Rastro do mapa: um ponto a cada 4 m (o RaceBox manda ~1 m entre leituras a 100 km/h). */
export const PASSO_RASTRO_M = 4;
/** Círculo de G: rastro curto ao vivo (s) e nuvem da volta (um ponto a cada 100 ms). */
export const RASTRO_G_S = 3;
export const PASSO_G_MS = 100;
/** Sem ponto novo há mais que isto (ms) = TV mostra "aguardando o carro". */
export const SEM_DADO_MS = 2500;
/** Pancada vertical (zebra, buraco): |gVert| acima disto. Mesmo 0,15 G da análise de 27/10 (capacidade.py: 19 na gravação). */
export const PANCADA_G = 0.15;
/** Duas pancadas de voltas diferentes a até esta fração da volta = mesmo lugar (±0,006 ≈ ±13 m em 2,1 km). */
export const LUGAR_FRAC = 0.006;

export const PARADO_KMH = 5;      // abaixo disto o carro está parado
export const PARADA_S = 20;
// km rodados na sessão (o odômetro do velocímetro da TV; a conta morava na tela até 28/10): só com o carro
// andando, sem buraco grande entre pontos, precisão boa e sem salto de posição
export const KM_KMH_MIN = 3, KM_BURACO_MS = 2000, KM_PRECISAO_M = 10, KM_SALTO_M = 60;       // parado tanto tempo seguido = parada (box)
export const RESFRIA_FRAC = 0.25; // parou antes de andar 1/4 da volta seguinte = a volta que acabou de fechar foi a de entrada
const PRECISAO_MAX_M = 50;     // mesmo gate do cerebro-vivo / filtro do notebook (hacc < 50)
const SALTO_FRAC_MAX = 0.05;   // passo maior que isto entre 2 pontos = projeção pulou: não vale como cruzamento
const TETO_PONTOS_VOLTA = 6000;
const TETO_PERFIL_VOLTA = 20000;   // perfil da volta (opção guardarVoltas): 25 Hz × 13 min

function emFaixaBrasilia(lat, lng) { return lat < -15.7 && lat > -15.8 && lng < -47.8 && lng > -48.0; }
function distM(a, b) {
  const kLat = 110540, kLng = 111320 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot((b.lat - a.lat) * kLat, (b.lng - a.lng) * kLng);
}
function mod1(v) { return ((v % 1) + 1) % 1; }
function faseDe(gLong) {
  if (typeof gLong !== 'number') return null;
  return gLong <= G_FREIO ? 'freio' : (gLong >= G_ACEL ? 'acel' : 'embalo');
}
function r1(v) { return Math.round(v * 10) / 10; }
function r3(v) { return Math.round(v * 1000) / 1000; }
function media(xs) { return xs.reduce((s, v) => s + v, 0) / xs.length; }
function desvio(xs) { const m = media(xs); return Math.sqrt(media(xs.map(v => (v - m) * (v - m)))); }

/** Lugares onde há pancada em 2+ voltas diferentes (fração da volta a até LUGAR_FRAC, com a volta da chegada). */
function lugaresRepetidos(pancadas) {
  const ps = pancadas.filter(p => p.n >= 1 && p.p != null).slice().sort((a, b) => a.p - b.p);
  const grupos = [];
  for (const p of ps) {
    const g = grupos.find(gr => Math.min(Math.abs(p.p - gr.p), 1 - Math.abs(p.p - gr.p)) <= LUGAR_FRAC);
    if (g) { g.itens.push(p); g.p = media(g.itens.map(i => i.p)); } else grupos.push({ p: p.p, itens: [p] });
  }
  return grupos
    .map(g => {
      const voltasN = [...new Set(g.itens.map(i => i.n))].sort((a, b) => a - b);
      const pico = g.itens.reduce((m, i) => (Math.abs(i.g) > Math.abs(m.g) ? i : m));
      return { frac: Math.round(g.p * 1e4) / 1e4, x: pico.x, y: pico.y, voltas: voltasN, n: g.itens.length, maxG: pico.g };
    })
    .filter(l => l.voltas.length >= 2)
    .sort((a, b) => b.voltas.length - a.voltas.length || a.frac - b.frac);
}

/** Consistência das voltas fechadas: só números, sem regra de corte. null com menos de 2 voltas. */
function consistenciaDe(voltas, nSetores) {
  if (voltas.length < 2) return null;
  const ts = voltas.map(v => v.tempoS);
  const m = media(ts);
  const fora = voltas.reduce((a, v) => (Math.abs(v.tempoS - m) > Math.abs(a.tempoS - m) ? v : a));
  const desvioSetoresS = [];
  for (let i = 0; i < nSetores; i++) {
    const xs = voltas.filter(v => v.setoresS).map(v => v.setoresS[i]);
    desvioSetoresS.push(xs.length >= 2 ? r3(desvio(xs)) : null);
  }
  return { nVoltas: voltas.length, mediaS: r3(m), desvioS: r3(desvio(ts)),
    amplitudeS: r3(Math.max(...ts) - Math.min(...ts)), desvioSetoresS,
    voltaMaisFora: { n: fora.n, difS: r3(fora.tempoS - m) } };
}

function novosPicos() { return { freioMax: null, acelMax: null, latMax: null, combinadoMax: null, n: 0 }; }
function somarPico(p, gl, gt) {
  p.n++;
  if (gl < 0 && (p.freioMax == null || gl < p.freioMax)) p.freioMax = gl;
  if (gl > 0 && (p.acelMax == null || gl > p.acelMax)) p.acelMax = gl;
  if (p.latMax == null || Math.abs(gt) > Math.abs(p.latMax)) p.latMax = gt;
  const c = Math.hypot(gl, gt);
  if (p.combinadoMax == null || c > p.combinadoMax) p.combinadoMax = c;
}

/**
 * @param {object} [opts]
 * @param {{a_gps,b_gps}} [opts.marcoChegada]  linha de chegada (padrão: Brasília)
 * @param {number[]} [opts.setoresFrac]         linhas de setor (fração da volta desde a chegada)
 * @param {number} [opts.sentido]               +1 se a fração do traçado cresce andando
 * @param {(lat:number,lng:number)=>{x:number,y:number,frac:number}|null} [opts.projetar]
 * @param {boolean} [opts.guardarVoltas]       item 6 (página da volta): cada volta fechada leva o
 *   perfil ponto a ponto {t s desde a chegada, p fração da volta, d m andados, kmh, x, y, gl, ga, z}
 *   e o rastro do mapa. Desligado na TV (pacote leve); a conta de volta/setor é a MESMA.
 * @param {object[]|null} [opts.trechos]        cadastro de trechos da pista (formato BARRAS). Padrão: os de
 *   Brasília quando a projeção é a de Brasília; com projeção própria, nenhum (até a pista ter cadastro).
 * @param {Object<string,string>} [opts.tipoPorCurva]  nome da curva → tipo (SF = pé embaixo = reta)
 */
export function criarCerebroGpsTv(opts = {}) {
  const marco = opts.marcoChegada || MARCO_CHEGADA_BRASILIA;
  const setoresFrac = (opts.setoresFrac || SETORES_FRAC_PADRAO).slice().sort((a, b) => a - b);
  const nSetores = setoresFrac.length + 1;
  const sentido = opts.sentido === -1 ? -1 : SENTIDO_BRASILIA;
  const guardarVoltas = opts.guardarVoltas === true;
  const projetar = opts.projetar || ((lat, lng) => {
    if (!emFaixaBrasilia(lat, lng)) return null;
    const p = geoParaCommandBox(lat, lng);
    return { x: p.x, y: p.y, frac: fracDe(p.x, p.y) };
  });
  const meio = { lat: (marco.a_gps.lat + marco.b_gps.lat) / 2, lng: (marco.a_gps.lng + marco.b_gps.lng) / 2 };
  const pChegada = projetar(meio.lat, meio.lng);
  const fracChegada = pChegada ? pChegada.frac : 0;
  const cadastroTrechos = opts.trechos !== undefined ? opts.trechos : (opts.projetar ? null : TRECHOS_BRASILIA);
  const cortes = montarTrechosDaVolta(cadastroTrechos, {
    tipoPorCurva: opts.tipoPorCurva || (cadastroTrechos === TRECHOS_BRASILIA ? TIPO_POR_CURVA : {}),
    ondeNaVolta: (lat, lng) => {
      const p = projetar(lat, lng);
      return p ? { x: p.x, y: p.y, p: mod1(sentido * (p.frac - fracChegada)) } : null;
    },
  });
  const trechos = cortes.lista;
  const linhasTrecho = trechos.slice(1).map(tr => tr.de);   // fronteiras dentro da volta (a 1ª é a chegada)

  // ── estado ──
  let agora = null;               // último ponto aceito
  let ultimoT = null;
  let voltaN = 0;                 // 0 = ainda não cruzou a chegada (volta de saída do box)
  let inicioVoltaT = null;
  let cruzSetorT = [];            // carimbos dos cruzamentos de setor da volta corrente
  let progAnterior = null;
  const voltas = [];              // voltas fechadas
  let rastroVolta = [];           // mapa: pontos da volta corrente
  let rastroUltima = [];          // mapa: pontos da última volta fechada
  let ultimoRastroGeo = null;
  let gRastro = [];               // círculo: últimos RASTRO_G_S segundos
  let gVolta = [];                // círculo: nuvem da volta corrente
  let gUltima = [];               // círculo: nuvem da última volta fechada
  let ultimoGT = null;
  let picosVolta = novosPicos();
  let picosUltima = null;
  let perfilVolta = [];           // opção guardarVoltas: pontos da volta corrente
  let distVolta = 0, ultimoGeoVolta = null;
  let kmSessaoM = 0, ultimoGeoKm = null;   // odômetro da sessão
  const pancadas = [];            // item 7: {n volta da borda de subida, p fração, x, y, g pico (com sinal), t}
  let grupoPancada = null;        // pancada em curso (|gVert| ainda acima do limite)
  const trocas = [];              // item 8: {n volta da queda, x, y, t, kmh, gAntes, buracoS, provavel}
  const detTroca = criarDetectorTrocaMarcha();
  const traseiras = [];           // item 9: {n volta do início, x, y, t, duracaoMs, excessoDps, provavel}
  const detTraseira = criarDetectorTraseira();
  let viuGiro = false;
  let cruzTrechoT = [];           // carimbos dos cruzamentos das fronteiras de trecho da volta corrente
  let trechoMedidas = [];         // por trecho da volta corrente: {kmhEntrada, kmhMin, minX, minY, kmhSaida}
  let kmhPonto = null;            // km/h do ponto em curso (a chegada fecha a volta antes de o ponto somar)
  let paradoDesdeT = null, paradoProg = null, paradoVoltaN = null, paradaContada = false;   // parada em curso
  let aquecerProxima = false;     // a próxima volta a fechar é a 1ª depois de uma parada
  let voltaTeveParada = false;    // a volta corrente tem uma parada dentro

  function novaMedida(kmhEntrada) { return { kmhEntrada, kmhMin: null, minX: null, minY: null, kmhSaida: null }; }

  function contarTrocas(v) {
    const da = trocas.filter(tr => tr.n === v.n);
    v.trocas = da.length;
    v.trocaBuracoMedioS = da.length ? r3(media(da.map(tr => tr.buracoS))) : null;
  }
  function contarTraseiras(v) {
    const da = traseiras.filter(e => e.n === v.n);
    v.traseira = da.length;
    v.traseiraMaxDps = da.length ? Math.max(...da.map(e => e.excessoDps)) : null;
  }

  function fecharVolta(t) {
    const tempoS = (t - inicioVoltaT) / 1000;
    let setoresS = null;
    if (cruzSetorT.length === nSetores - 1) {
      setoresS = [];
      let antes = inicioVoltaT;
      for (const c of cruzSetorT) { setoresS.push((c - antes) / 1000); antes = c; }
      // último setor fecha na soma exata da volta (mesmo carimbo da chegada)
      setoresS.push(tempoS - setoresS.reduce((s, v) => s + v, 0));
      setoresS = setoresS.map(r3);
    }
    const daVolta = pancadas.filter(p => p.n === voltaN);
    const v = { n: voltaN, tempoS: r3(tempoS), setoresS, picosG: picosVolta.n ? picosVolta : null,
      pancadas: daVolta.length,
      pancadaMaxG: daVolta.length ? daVolta.reduce((m, p) => (Math.abs(p.g) > Math.abs(m) ? p.g : m), 0) : null };
    v.descarte = voltaTeveParada ? 'parada' : (aquecerProxima ? 'aquecimento' : null);
    if (!voltaTeveParada) aquecerProxima = false;
    v.trechos = null;
    if (trechos.length && cruzTrechoT.length === linhasTrecho.length && trechoMedidas.length === trechos.length) {
      const fim = trechoMedidas[trechoMedidas.length - 1];
      if (fim.kmhSaida == null) fim.kmhSaida = kmhPonto;
      let antes = inicioVoltaT;
      const tempos = cruzTrechoT.map(c => { const d = (c - antes) / 1000; antes = c; return d; });
      tempos.push(tempoS - tempos.reduce((s, x) => s + x, 0));   // o último fecha na soma exata da volta
      v.trechos = tempos.map((d, i) => {
        const m = trechoMedidas[i];
        return { tempoS: r3(d), kmhEntrada: m.kmhEntrada != null ? r1(m.kmhEntrada) : null,
          kmhMin: m.kmhMin != null ? r1(m.kmhMin) : null, minX: m.minX, minY: m.minY,
          kmhSaida: m.kmhSaida != null ? r1(m.kmhSaida) : null };
      });
    }
    contarTrocas(v);
    contarTraseiras(v);
    if (guardarVoltas) { v.perfil = perfilVolta; v.rastro = rastroVolta; v.distM = Math.round(distVolta); }
    voltas.push(v);
    rastroUltima = rastroVolta; gUltima = gVolta; picosUltima = picosVolta.n ? picosVolta : null;
  }

  const detector = criarDetectorChegada(marco, ({ t }) => {
    if (t == null) return;
    if (inicioVoltaT != null) fecharVolta(t);
    voltaN++;
    inicioVoltaT = t;
    cruzSetorT = [];
    cruzTrechoT = [];
    trechoMedidas = trechos.length ? [novaMedida(kmhPonto)] : [];
    rastroVolta = []; gVolta = []; picosVolta = novosPicos();
    perfilVolta = []; distVolta = 0; ultimoGeoVolta = null;
    voltaTeveParada = false;
  });

  // parada (box): marca as voltas que saem da linha do trecho e de "a última perdeu"
  function verParada(t, kmh, prog) {
    if (kmh == null) return;
    if (kmh >= PARADO_KMH) { paradoDesdeT = null; paradaContada = false; return; }
    if (paradoDesdeT == null) { paradoDesdeT = t; paradoProg = prog; paradoVoltaN = voltaN; }
    if (paradaContada || t - paradoDesdeT < PARADA_S * 1000) return;
    paradaContada = true;
    aquecerProxima = true;
    if (inicioVoltaT == null || paradoVoltaN !== voltaN) return;
    voltaTeveParada = true;
    const ant = voltas[voltas.length - 1];
    if (ant && ant.n === voltaN - 1 && !ant.descarte && paradoProg != null && paradoProg < RESFRIA_FRAC) ant.descarte = 'resfriamento';
  }

  /** Ponto do evento 'gps' do canal (RaceBox). Devolve true se entrou. */
  function feedGps(g) {
    if (!g || typeof g.lat !== 'number') return false;
    const lng = typeof g.lng === 'number' ? g.lng : g.lon;
    if (typeof lng !== 'number') return false;
    if (!pontoGpsAceito(g)) return false;   // fonte única = RaceBox (item 2)
    if (g.fix != null && g.fix < 3) return false;
    const prec = g.accM != null ? g.accM : g.hacc;
    if (prec != null && !(prec < PRECISAO_MAX_M)) return false;
    const t = typeof g.tWall === 'number' ? g.tWall : (typeof g.t === 'number' ? g.t : null);
    if (t == null) return false;
    if (ultimoT != null && t <= ultimoT) return false;   // fora de ordem/repetido (fila reenviada)
    ultimoT = t;
    const kmh = typeof g.kmh === 'number' ? g.kmh : null;
    kmhPonto = kmh;

    // 1) chegada — pode fechar a volta e zerar o estado da volta ANTES de somar este ponto
    detector.ingestGps({ lat: g.lat, lng, t });

    const pos = projetar(g.lat, lng);
    const temG = typeof g.gLong === 'number' && typeof g.gLat === 'number';
    const gLong = temG ? g.gLong : null, gLat = temG ? g.gLat : null;
    const zeroOk = temG && g.zeroOk === true;

    const gVert = typeof g.gVert === 'number' && Number.isFinite(g.gVert) ? g.gVert : null;
    const progAqui = pos ? mod1(sentido * (pos.frac - fracChegada)) : null;
    verParada(t, kmh, progAqui);

    // 1b) km rodados na sessão
    const aquiKm = { lat: g.lat, lng, t };
    if (ultimoGeoKm && t - ultimoGeoKm.t < KM_BURACO_MS && (kmh || 0) >= KM_KMH_MIN && !(prec > KM_PRECISAO_M)) {
      const d = distM(ultimoGeoKm, aquiKm);
      if (d < KM_SALTO_M) kmSessaoM += d;
    }
    ultimoGeoKm = aquiKm;

    // 2) setores — pela fração do traçado contada da chegada
    if (pos) {
      const prog = progAqui;
      if (inicioVoltaT != null && progAnterior != null && cruzSetorT.length < nSetores - 1) {
        const linha = setoresFrac[cruzSetorT.length];
        const passo = prog - progAnterior;
        if (progAnterior < linha && prog >= linha && passo > 0 && passo < SALTO_FRAC_MAX) cruzSetorT.push(t);
      }
      // 2a) trechos da metodologia — mesma regra de cruzamento dos setores; o ponto que cruza é a saída de um
      // trecho e a entrada do seguinte
      if (inicioVoltaT != null && trechoMedidas.length) {
        const passo = progAnterior != null ? prog - progAnterior : null;
        while (passo != null && cruzTrechoT.length < linhasTrecho.length) {
          const linha = linhasTrecho[cruzTrechoT.length];
          if (!(progAnterior < linha && prog >= linha && passo > 0 && passo < SALTO_FRAC_MAX)) break;
          cruzTrechoT.push(t);
          const sai = trechoMedidas[trechoMedidas.length - 1];
          sai.kmhSaida = kmh;   // o ponto da fronteira vale para os dois trechos (inclusive no menor km/h)
          if (kmh != null && (sai.kmhMin == null || kmh < sai.kmhMin)) { sai.kmhMin = kmh; sai.minX = r1(pos.x); sai.minY = r1(pos.y); }
          trechoMedidas.push(novaMedida(kmh));
        }
        const m = trechoMedidas[trechoMedidas.length - 1];
        if (kmh != null && (m.kmhMin == null || kmh < m.kmhMin)) { m.kmhMin = kmh; m.minX = r1(pos.x); m.minY = r1(pos.y); }
      }
      progAnterior = prog;
      if (guardarVoltas && inicioVoltaT != null && perfilVolta.length < TETO_PERFIL_VOLTA) {
        const aqui = { lat: g.lat, lng };
        if (ultimoGeoVolta) distVolta += distM(ultimoGeoVolta, aqui);
        ultimoGeoVolta = aqui;
        perfilVolta.push({ t: r3((t - inicioVoltaT) / 1000), p: Math.round(prog * 1e5) / 1e5, d: r1(distVolta),
          kmh: kmh != null ? r1(kmh) : null, x: r1(pos.x), y: r1(pos.y),
          gl: temG ? r3(gLong) : null, ga: temG ? r3(gLat) : null, z: zeroOk });
      }
    }

    // 2b) pancadas (item 7): borda de subida de |gVert| > PANCADA_G abre o grupo; vale o pico.
    // A volta do grupo é a da borda de subida (uma pancada nunca conta em duas voltas).
    if (gVert != null) {
      if (Math.abs(gVert) > PANCADA_G) {
        if (!grupoPancada) {
          grupoPancada = { n: voltaN, p: null, x: null, y: null, g: 0, t };
          pancadas.push(grupoPancada);
        }
        if (Math.abs(gVert) > Math.abs(grupoPancada.g)) {
          grupoPancada.g = r3(gVert); grupoPancada.t = t;
          grupoPancada.p = progAqui != null ? Math.round(progAqui * 1e5) / 1e5 : null;
          grupoPancada.x = pos ? r1(pos.x) : null; grupoPancada.y = pos ? r1(pos.y) : null;
        }
      } else grupoPancada = null;
    }

    // 2c) troca de marcha (item 8): só G com zero do box; sem ele o detector zera (não se inventa troca)
    const achadas = detTroca.ler(zeroOk
      ? { t, gLong, kmh: kmh != null ? kmh : 0, n: voltaN, x: pos ? r1(pos.x) : null, y: pos ? r1(pos.y) : null }
      : { t, gLong: null });
    for (const tr of achadas) {
      trocas.push(tr);
      const fechada = voltas.find(v => v.n === tr.n);   // chegou depois de a volta da queda fechar
      if (fechada) contarTrocas(fechada);
    }

    // 2d) traseira saiu (item 9): giro do carro × giro que a curva explica (só com zero do box)
    const giroZ = typeof g.giroZ === 'number' && Number.isFinite(g.giroZ) ? g.giroZ : null;
    if (giroZ != null) viuGiro = true;
    const saidas = detTraseira.ler(zeroOk && giroZ != null
      ? { t, giroZ, gLat, kmh: kmh != null ? kmh : 0, n: voltaN, x: pos ? r1(pos.x) : null, y: pos ? r1(pos.y) : null }
      : { t });
    for (const e of saidas) {
      traseiras.push(e);
      const fechada = voltas.find(v => v.n === e.n);
      if (fechada) contarTraseiras(fechada);
    }

    // 3) mapa: rastro da volta com velocidade e fase do G
    if (pos && (!ultimoRastroGeo || distM(ultimoRastroGeo, { lat: g.lat, lng }) >= PASSO_RASTRO_M)) {
      ultimoRastroGeo = { lat: g.lat, lng };
      if (rastroVolta.length < TETO_PONTOS_VOLTA) {
        rastroVolta.push({ x: r1(pos.x), y: r1(pos.y), kmh: kmh != null ? Math.round(kmh) : null,
          fase: zeroOk ? faseDe(gLong) : null });
      }
    }

    // 4) círculo de G (só com G que o notebook mandou; picos só com zero do box valendo)
    if (temG) {
      gRastro.push({ t, l: gLong, a: gLat });
      while (gRastro.length && t - gRastro[0].t > RASTRO_G_S * 1000) gRastro.shift();
      if (zeroOk) {
        somarPico(picosVolta, gLong, gLat);
        if ((ultimoGT == null || t - ultimoGT >= PASSO_G_MS) && gVolta.length < TETO_PONTOS_VOLTA) {
          gVolta.push({ l: r3(gLong), a: r3(gLat) });
          // cadência ancorada (10 Hz de verdade a 25 Hz de entrada, não "a cada 3 leituras")
          ultimoGT = ultimoGT == null || t - ultimoGT >= 2 * PASSO_G_MS ? t : ultimoGT + PASSO_G_MS;
        }
      }
    }

    agora = { t, lat: g.lat, lng, kmh, gLong, gLat, zeroOk, gVert,
      gTotal: temG ? r3(Math.hypot(gLong, gLat)) : null,
      x: pos ? r1(pos.x) : null, y: pos ? r1(pos.y) : null, frac: pos ? pos.frac : null };
    return true;
  }

  function melhor(lista, f) {
    let m = null;
    for (const v of lista) { const x = f(v); if (x != null && (m == null || x < m)) m = x; }
    return m;
  }

  /** PacoteTv pronto para a tela (só exibir). nowMs = relógio do mesmo tipo do tWall. */
  function snapshot(nowMs) {
    const fresco = agora != null && (nowMs == null || nowMs - agora.t <= SEM_DADO_MS);
    const melhorVolta = voltas.length
      ? voltas.reduce((m, v) => (m == null || v.tempoS < m.tempoS ? v : m), null) : null;
    const melhoresSetores = [];
    for (let i = 0; i < nSetores; i++) melhoresSetores.push(melhor(voltas, v => v.setoresS ? v.setoresS[i] : null));
    const ideal = melhoresSetores.every(s => s != null) ? r3(melhoresSetores.reduce((s, v) => s + v, 0)) : null;
    const ultima = voltas.length ? voltas[voltas.length - 1] : null;
    let atual = null;
    if (inicioVoltaT != null && agora) {
      const parciais = [];
      let antes = inicioVoltaT;
      for (const c of cruzSetorT) { parciais.push(r3((c - antes) / 1000)); antes = c; }
      atual = { n: voltaN, decorridoS: r3((agora.t - inicioVoltaT) / 1000), setoresS: parciais,
        setorAtual: parciais.length + 1, trechoAtual: trechos.length ? cruzTrechoT.length + 1 : null };
    }
    const melhoresTrechos = trechos.map((_, i) => melhor(voltas, v => (v.trechos ? v.trechos[i].tempoS : null)));
    const idealTrechos = trechos.length && melhoresTrechos.every(s => s != null)
      ? r3(melhoresTrechos.reduce((s, v) => s + v, 0)) : null;
    // onde a última volta perdeu para o melhor de cada trecho (os 3 maiores), para a TV ler de relance
    const perdasUltima = ultima && ultima.trechos
      ? ultima.trechos.map((m, i) => ({ i: i + 1, nome: trechos[i].nome, difS: r3(m.tempoS - melhoresTrechos[i]) }))
        .filter(x => x.difS > 0).sort((a, b) => b.difS - a.difS).slice(0, 3)
      : [];
    // o mesmo, só com as voltas que valem para a linha do trecho e "a última perdeu" (sem aquecimento/resfriamento/parada)
    const validas = voltas.filter(v => !v.descarte), ultimaValida = validas.length ? validas[validas.length - 1] : null;
    const melhoresValidos = trechos.map((_, i) => melhor(validas, v => (v.trechos ? v.trechos[i].tempoS : null)));
    const perdasValida = ultimaValida && ultimaValida.trechos
      ? ultimaValida.trechos.map((m, i) => ({ i: i + 1, nome: trechos[i].nome, difS: r3(m.tempoS - melhoresValidos[i]) }))
        .filter(x => x.difS > 0).sort((a, b) => b.difS - a.difS).slice(0, 3)
      : [];
    // "ideal pelos trechos" (rodapé do quadro de curvas): soma do melhor de cada trecho entre as voltas que valem
    const idealValidas = trechos.length && melhoresValidos.every(s => s != null)
      ? r3(melhoresValidos.reduce((s, v) => s + v, 0)) : null;
    return {
      fresco,
      agora,
      kmSessao: r3(kmSessaoM / 1000),
      nSetores,
      // opção guardarVoltas: o perfil da volta em curso (a faixa da volta inteira na TV compara com a melhor)
      perfilAtual: guardarVoltas && inicioVoltaT != null ? perfilVolta : null,
      voltas: voltas.slice(),
      ultimaVolta: ultima,
      melhorVolta: melhorVolta ? { n: melhorVolta.n, tempoS: melhorVolta.tempoS } : null,
      deltaUltimaS: ultima && melhorVolta ? r3(ultima.tempoS - melhorVolta.tempoS) : null,
      melhoresSetores,
      voltaIdealS: ideal,
      voltaAtual: atual,
      trechos: { lista: trechos, erro: cortes.erro, melhoresS: melhoresTrechos, voltaIdealS: idealTrechos, perdasUltima,
        validas: { melhoresS: melhoresValidos, voltaIdealS: idealValidas, ultimaN: ultimaValida ? ultimaValida.n : null,
          ultimaTrechos: ultimaValida ? ultimaValida.trechos : null, perdasUltima: perdasValida,
          descartadas: voltas.filter(v => v.descarte).map(v => ({ n: v.n, motivo: v.descarte })) } },
      mapa: { volta: rastroVolta, ultima: rastroUltima },
      circuloG: {
        vivo: agora && agora.gLong != null ? { l: agora.gLong, a: agora.gLat, zeroOk: agora.zeroOk } : null,
        rastro: gRastro.map(p => ({ l: p.l, a: p.a })),
        volta: gVolta, ultima: gUltima,
        picosVolta: picosVolta.n ? { ...picosVolta } : null, picosUltima,
      },
      pancadas: {
        total: pancadas.length,
        volta: pancadas.filter(p => p.n === voltaN && p.x != null).map(p => ({ x: p.x, y: p.y, g: p.g })),
        ultima: ultima ? pancadas.filter(p => p.n === ultima.n && p.x != null).map(p => ({ x: p.x, y: p.y, g: p.g })) : [],
        lugaresRepetidos: lugaresRepetidos(pancadas),
      },
      consistencia: consistenciaDe(voltas, nSetores),
      trocas: {
        provavel: true,
        total: trocas.length,
        volta: trocas.filter(tr => tr.n === voltaN && tr.x != null).map(tr => ({ x: tr.x, y: tr.y, kmh: tr.kmh, buracoS: tr.buracoS })),
        ultima: ultima ? trocas.filter(tr => tr.n === ultima.n && tr.x != null).map(tr => ({ x: tr.x, y: tr.y, kmh: tr.kmh, buracoS: tr.buracoS })) : [],
      },
      traseira: {
        provavel: true,
        aConferir: true,          // offset do giro no pacote ainda não conferido em gravação
        temGiro: viuGiro,
        sinalAprendido: detTraseira.sinal() !== 0,
        total: traseiras.length,
        volta: traseiras.filter(e => e.n === voltaN && e.x != null).map(e => ({ x: e.x, y: e.y, excessoDps: e.excessoDps })),
        ultima: ultima ? traseiras.filter(e => e.n === ultima.n && e.x != null).map(e => ({ x: e.x, y: e.y, excessoDps: e.excessoDps })) : [],
      },
    };
  }

  return { feedGps, snapshot, _fracChegada: fracChegada };
}

export default { criarCerebroGpsTv };
