// cerebro-tv-blocos-gps.js — CASA ÚNICA dos blocos da TV do box que saem do GPS (E2b da obra "TV do box
// ao vivo", Flávio 27/10/2026: "trail braking, freio, aceleração, tempo de volta, quantidade de voltas,
// comparativos de gráfico de frenagem e aceleração, etc. tudo dá para ver no tv box a partir do gps").
//
// Entra: o snapshot do cerebro-gps-tv criado com { guardarVoltas: true } (voltas fechadas com perfil ponto a
// ponto {t,p,d,kmh,x,y,gl,ga,z}). Sai: um pacote pronto por bloco — a TV só pinta.
//   stint       volta atual, voltas feitas, tempo de cada uma, melhor, média, decorrido
//   deltaAcum   Δ de cada volta e Δ acumulado contra a MELHOR DA SESSÃO (recorde histórico não sai do GPS)
//   curva       a curva da vez (a atual; numa reta, a próxima) com:
//     passagem  entrada / mínima / saída em km/h da ÚLTIMA volta × a passagem mais rápida do trecho, Δ s
//     frenagem  G longitudinal MEDIDO pelo RaceBox: onde começou a frear (m antes da entrada), pico,
//               freio que sobra na mínima (trail braking), soltou progressivo ou de uma vez, retomada e pico
//               de aceleração na saída; série de G × distância (última × referência) para o gráfico
//     vmin      km/h × distância até a saída (última × referência) e a mínima
//   coach       onde a última volta mais perdeu e por quê (freada, mínima ou saída), só com o que foi medido
//   faixa       a volta INTEIRA numa linha (pedido Flávio 28/10: "gráfico em linha da volta inteira, acelera e
//               freia, volta atual × melhor volta, cursor andando no trecho"; refeita no mesmo dia — o G tirado da
//               velocidade saía serrilhado, "freando e acelerando ao mesmo tempo"): VELOCIDADE do GPS do RaceBox
//               por posição na volta (fração desde a chegada, FAIXA_BINS casas), da volta em curso até o carro e
//               da melhor volta válida inteira, com as FREADAS de cada uma (zonasDeFreada: só onde a velocidade
//               cai de verdade); Δ de tempo por posição (onde ganha ou perde para a melhor).
//   quadro      quadro de curvas (Flávio 28/10, a tela «comparativo por trecho» de 27/10 levada à TV): por curva, na
//               ordem da volta, MELHOR (passagem da melhor volta) × ÚLTIMA (a mais recente, já desta volta quando o
//               carro saiu da curva) — entrada, freada (só com G medido), mínima, saída, tempo — e a diferença; na
//               curva em curso, progresso e trilha acelera/freia (G da faixa); soma das diferenças e ideal pelos trechos
//   plano       o plano do stint aprovado no celular (envelopes_seguranca_stint, lido pela porta de
//               web/cockpit/treino-stint.js) × o que o carro fez: voltas planejadas, feitas, faltam, próxima
//               parada. Plano de outro dia não vale para o stint de hoje: sai só como "último plano, de <dia>".
// Referência de curva, coach, faixa e quadro = só voltas VÁLIDAS (sem v.descarte: aquecimento, resfriamento, parada —
// Flávio 28/10, item 6 de p1fast-mapa-tv-2045); sem volta válida fechada, não há referência nem diferença. A lista do
// stint e o Δ acumulado continuam com todas as voltas (é o histórico; cada volta leva o seu descarte).
// Sem o zero do box (zeroOk) o G não vale: a frenagem sai null com o motivo, o resto continua.
// Cada volta fechada é medida UMA vez (cache pelo número da volta).

const r1 = (x) => Math.round(x * 10) / 10;
const r2 = (x) => Math.round(x * 100) / 100;
const r3 = (x) => Math.round(x * 1000) / 1000;
const virg = (x) => String(x).replace('.', ',');   // número na frase da TV em pt-BR

export const FREIO_G = -0.25;          // abaixo disso (2 pontos seguidos) = freando
export const TRAIL_G = -0.08;          // freio que sobra na mínima: abaixo disso = entrou freando (trail)
export const RETOMADA_G = 0.08;        // acima disso depois da mínima = acelerando
export const ANTES_DA_ENTRADA_M = 150; // a freada da curva começa na reta antes da linha de entrada
export const PONTOS_SERIE = 24;
export const SOLTOU_PROGRESSIVO_S = 0.4;   // do pico até soltar (> −0,1 G) em mais que isso = progressivo
export const FAIXA_BINS = 200;             // casas da volta inteira na faixa
export const G_VEL_JANELA_S = 0.4;         // G pela velocidade: diferença centrada em ±0,4 s (alisa o ruído do km/h)
export const FAIXA_PONTA_M = 300;          // perto da chegada a fração "vira": ponto do outro lado da linha não conta
export const FREADA_VOLTA_KMH = 2;         // a queda só acaba quando a velocidade volta a subir isso (ruído do GPS não corta)
export const FREADA_QUEDA_KMH = 8;         // queda menor que isso é tirar o pé, não freada
export const FREADA_BORDA_G = -0.12;       // a freada vai do 1º ao último ponto da queda desacelerando mais que isso
const G0 = 9.80665;

/** Pontos do perfil de uma volta entre duas frações (com folga em metros antes do início). */
function recorte(perfil, de, ate, antesM) {
  if (!perfil || !perfil.length) return null;
  const iEnt = perfil.findIndex(q => q.p >= de);
  if (iEnt < 0) return null;
  const dEnt = perfil[iEnt].d;
  const pts = perfil.filter(q => q.d >= dEnt - antesM && (q.p < ate || q.d < dEnt) && q.d <= dEnt + 2000);
  // só os pontos até a saída (o filtro por p falha na volta da chegada; corta pelo 1º ponto depois de "ate")
  const iSai = pts.findIndex(q => q.d > dEnt && q.p >= ate);
  const fim = iSai < 0 ? pts : pts.slice(0, iSai + 1);
  return fim.length >= 3 ? { pts: fim, dEnt } : null;
}

/** Medidas de freada e aceleração de UMA passagem (G medido). null sem zero do box. */
export function medirFrenagem(pts, dEnt) {
  const comG = pts.filter(q => q.gl != null);
  if (comG.length < 3) return { ok: false, motivo: 'sem G do RaceBox' };
  if (!comG.every(q => q.z === true)) return { ok: false, motivo: 'sem o zero do box (G não vale)' };
  let iMin = 0;
  comG.forEach((q, i) => { if (q.kmh != null && (comG[iMin].kmh == null || q.kmh < comG[iMin].kmh)) iMin = i; });
  let iIni = -1;
  for (let i = 0; i < iMin; i++) if (comG[i].gl < FREIO_G && comG[i + 1] && comG[i + 1].gl < FREIO_G) { iIni = i; break; }
  let iPico = -1;
  for (let i = 0; i <= iMin; i++) if (iPico < 0 || comG[i].gl < comG[iPico].gl) iPico = i;
  const freou = iIni >= 0;
  let soltouS = null;
  if (freou) {
    // do FIM do patamar de pico (último ponto a 90% do pico) até soltar (> −0,1 G) ou chegar na mínima;
    // medir do 1º ponto do pico contaria a freada inteira e toda freada longa sairia "progressiva"
    let iFimPico = iPico;
    for (let i = iPico; i <= iMin; i++) if (comG[i].gl <= comG[iPico].gl * 0.9) iFimPico = i;
    let iSolta = iMin;
    for (let i = iFimPico; i <= iMin; i++) if (comG[i].gl > -0.1) { iSolta = i; break; }
    soltouS = r2(comG[iSolta].t - comG[iFimPico].t);
  }
  let iRet = -1;
  for (let i = iMin; i < comG.length; i++) if (comG[i].gl > RETOMADA_G) { iRet = i; break; }
  let pAcel = null;
  for (let i = iMin; i < comG.length; i++) if (pAcel == null || comG[i].gl > pAcel) pAcel = comG[i].gl;
  const gMin = comG[iMin].gl;
  return {
    ok: true,
    freou,
    inicioFreadaM: freou ? r1(comG[iIni].d - dEnt) : null,      // negativo = antes da linha de entrada
    picoFreioG: freou ? r2(comG[iPico].gl) : null,
    freioNaMinimaG: r2(gMin),
    trail: freou && gMin < TRAIL_G,
    soltou: soltouS == null ? null : (soltouS >= SOLTOU_PROGRESSIVO_S ? 'progressivo' : 'de uma vez'),
    soltouS,
    kmhMin: comG[iMin].kmh,
    minimaM: r1(comG[iMin].d - dEnt),
    retomadaM: iRet >= 0 ? r1(comG[iRet].d - dEnt) : null,      // onde voltou a acelerar
    picoAcelG: pAcel != null ? r2(pAcel) : null,
  };
}

/** Série reamostrada por distância (do começo do recorte até a saída), n pontos, valor de `campo`. */
export function serieDistancia(pts, dEnt, campo, n = PONTOS_SERIE) {
  const v = pts.filter(q => q[campo] != null);
  if (v.length < 2) return null;
  const d0 = v[0].d, d1 = v[v.length - 1].d;
  if (!(d1 > d0)) return null;
  const out = [];
  let j = 0;
  for (let k = 0; k < n; k++) {
    const d = d0 + (d1 - d0) * k / (n - 1);
    while (j < v.length - 2 && v[j + 1].d < d) j++;
    const a = v[j], b = v[j + 1];
    const f = b.d > a.d ? Math.min(1, Math.max(0, (d - a.d) / (b.d - a.d))) : 0;
    out.push({ m: r1(d - dEnt), v: r2(a[campo] + (b[campo] - a[campo]) * f) });
  }
  return out;
}

/** Medidas de uma volta fechada em todos os trechos de CURVA (cache por volta). */
function medirVolta(v, lista) {
  return lista.map((tr) => {
    if (tr.tipo !== 'curva' || !v.perfil) return null;
    const rc = recorte(v.perfil, tr.de, tr.ate, ANTES_DA_ENTRADA_M);
    if (!rc) return null;
    return {
      frenagem: medirFrenagem(rc.pts, rc.dEnt),
      serieG: serieDistancia(rc.pts, rc.dEnt, 'gl'),
      serieKmh: serieDistancia(rc.pts.filter(q => q.d >= rc.dEnt), rc.dEnt, 'kmh'),
    };
  });
}

/** G longitudinal de cada ponto pela variação da velocidade do GPS (diferença centrada). */
function gPelaVelocidade(perfil) {
  const out = new Array(perfil.length).fill(null);
  let a = 0, b = 0;
  for (let i = 0; i < perfil.length; i++) {
    if (perfil[i].kmh == null) continue;
    while (a < i && perfil[i].t - perfil[a + 1].t >= G_VEL_JANELA_S) a++;
    if (b < i) b = i;
    while (b < perfil.length - 1 && perfil[b].t - perfil[i].t < G_VEL_JANELA_S) b++;
    const pa = perfil[a], pb = perfil[b], dt = pb.t - pa.t;
    if (pa.kmh == null || pb.kmh == null || !(dt >= G_VEL_JANELA_S)) continue;
    out[i] = (pb.kmh - pa.kmh) / 3.6 / dt / G0;
  }
  return out;
}

/** Pontos do perfil que valem na faixa: com posição e do lado certo da linha de chegada. */
function naVolta(perfil, fechada) {
  const dFim = perfil.length ? perfil[perfil.length - 1].d : 0;
  return (q) => q.p != null && !(q.d < FAIXA_PONTA_M && q.p > 0.5)        // ainda antes da linha
    && !(fechada && q.d > dFim - FAIXA_PONTA_M && q.p < 0.5);             // já depois da linha
}

/** Freadas de uma volta, só pela velocidade do GPS: cada queda de pico a vale (a queda só acaba quando a velocidade
 *  volta a subir FREADA_VOLTA_KMH — o ruído não abre um "V") que perdeu ≥ FREADA_QUEDA_KMH e chegou a desacelerar
 *  mais que FREIO_G; a freada vai do 1º ao último ponto da queda abaixo de FREADA_BORDA_G (o tirar o pé antes fica de
 *  fora). Na volta em curso, a queda ainda aberta no carro sai com aberta: true. */
export function zonasDeFreada(perfil, fechada) {
  if (!perfil || !perfil.length) return [];
  const g = gPelaVelocidade(perfil), vale = naVolta(perfil, fechada), out = [];
  const fechar = (iMx, iMn, aberta) => {
    const queda = perfil[iMx].kmh - perfil[iMn].kmh;
    if (queda < FREADA_QUEDA_KMH) return;
    let a = -1, b = -1, pico = 0;
    for (let i = iMx; i <= iMn; i++) {
      if (g[i] == null || !vale(perfil[i]) || g[i] > FREADA_BORDA_G) continue;
      if (a < 0) a = i;
      b = i; pico = Math.min(pico, g[i]);
    }
    if (a < 0 || pico > FREIO_G) return;
    out.push({ de: r3(perfil[a].p), ate: r3(perfil[b].p), kmhDe: r1(perfil[a].kmh), kmhAte: r1(perfil[b].kmh),
      quedaKmh: r1(queda), aberta });
  };
  let iMx = -1, iMn = -1, caindo = false;
  for (let i = 0; i < perfil.length; i++) {
    const q = perfil[i];
    if (q.kmh == null || !vale(q)) continue;
    if (iMx < 0) { iMx = i; continue; }
    if (!caindo) {
      if (q.kmh >= perfil[iMx].kmh) iMx = i;
      else if (q.kmh < perfil[iMx].kmh - FREADA_VOLTA_KMH) { caindo = true; iMn = i; }
    } else if (q.kmh < perfil[iMn].kmh) iMn = i;
    else if (q.kmh > perfil[iMn].kmh + FREADA_VOLTA_KMH) { fechar(iMx, iMn, false); caindo = false; iMx = i; }
  }
  if (caindo) fechar(iMx, iMn, !fechada);
  return out;
}

/** Perfil da volta → casas por posição: km/h médio, o instante em que o carro chegou à casa e as freadas. */
function casasDaVolta(perfil, fechada) {
  const soma = new Array(FAIXA_BINS).fill(0), n = new Array(FAIXA_BINS).fill(0), tChegou = new Array(FAIXA_BINS).fill(null);
  const vale = naVolta(perfil, fechada);
  let ate = -1;
  for (const q of perfil) {
    if (!vale(q)) continue;
    const k = Math.min(FAIXA_BINS - 1, Math.floor(q.p * FAIXA_BINS));
    if (tChegou[k] == null) tChegou[k] = q.t;
    if (q.kmh != null) { soma[k] += q.kmh; n[k]++; }
    if (k > ate) ate = k;
  }
  return { kmh: soma.map((x, k) => (n[k] ? r1(x / n[k]) : null)), t: tChegou, ate, freadas: zonasDeFreada(perfil, fechada) };
}

function tom(difS) { return difS == null ? null : difS <= 0 ? 'ganhou' : difS < 0.1 ? 'perto' : 'perdeu'; }

/**
 * Plano do stint × o que o carro fez. `lido` = o que a porta de leitura devolveu:
 *   undefined → ainda não leu; null → nenhum plano gravado; { plano, dia, deHoje } → o último plano do carro.
 */
export function planoDoStint(lido, stint) {
  if (lido === undefined) return null;
  if (!lido || !lido.plano) return { tem: false };
  const pl = lido.plano;
  const paradas = (Array.isArray(pl.paradas) ? pl.paradas : []).filter(p => Number.isFinite(p && p.volta))
    .map(p => ({ volta: p.volta, motivo: p.motivo || 'box' })).sort((a, b) => a.volta - b.volta);
  const base = { tem: true, deHoje: !!lido.deHoje, dia: lido.dia || null, proposito: pl.proposito || null,
    foco: pl.foco || null, voltas: Number.isFinite(pl.voltas) ? pl.voltas : null, paradas,
    pneu: pl.tipoPneu && pl.tipoPneu !== 'desconhecido' ? pl.tipoPneu : null };
  if (!base.deHoje) return base;   // plano de outro dia: não se compara com o stint de hoje
  const feitas = stint ? stint.feitas : 0;
  const prox = paradas.find(p => p.volta > feitas) || null;
  return { ...base, feitas, faltam: base.voltas != null ? Math.max(0, base.voltas - feitas) : null,
    proximaParada: prox ? { ...prox, emVoltas: prox.volta - feitas } : null };
}

/** Criar a casa (guarda o cache das voltas medidas). */
export function criarCerebroTvBlocosGps() {
  const cache = new Map();   // n da volta → medidas por trecho
  const casasMelhor = new Map();   // n da volta → casas da faixa da melhor volta

  function medidas(v, lista) {
    if (!cache.has(v.n)) cache.set(v.n, medirVolta(v, lista));
    return cache.get(v.n);
  }

  /** s = snapshot do cerebro-gps-tv (guardarVoltas: true). */
  function pacote(s, opts = {}) {
    if (!s) return null;
    const voltas = s.voltas || [];
    const lista = (s.trechos && s.trechos.lista) || [];
    const melhor = s.melhorVolta;
    const tempos = voltas.map(v => v.tempoS);
    const stint = {
      voltaAtual: s.voltaAtual ? s.voltaAtual.n : null,
      decorridoVoltaS: s.voltaAtual ? s.voltaAtual.decorridoS : null,
      feitas: voltas.length,
      voltas: voltas.map((v, i) => ({ n: v.n, tempoS: v.tempoS, deltaS: melhor ? r3(v.tempoS - melhor.tempoS) : null,
        melhor: !!melhor && v.n === melhor.n, ultima: i === voltas.length - 1, descarte: v.descarte || null })),
      melhor: melhor ? { n: melhor.n, tempoS: melhor.tempoS } : null,
      ultimaS: voltas.length ? voltas[voltas.length - 1].tempoS : null,
      mediaS: tempos.length ? r3(tempos.reduce((a, b) => a + b, 0) / tempos.length) : null,
      totalS: tempos.length ? r3(tempos.reduce((a, b) => a + b, 0)) : null,
      consistencia: s.consistencia || null,   // repassa a conta do cérebro do GPS (a tela do stint só exibe)
      idealS: s.voltaIdealS != null ? s.voltaIdealS : null,   // soma dos melhores setores (mesma conta do mapa)
    };
    let acum = 0;
    const deltaAcum = {
      contra: 'melhor da sessão',
      voltas: stint.voltas.map(v => { acum += v.deltaS || 0; return { n: v.n, deltaS: v.deltaS, acumS: r3(acum) }; }),
      ultimaDeltaS: s.deltaUltimaS != null ? s.deltaUltimaS : null,
    };

    // a curva da vez: o trecho atual se for curva; numa reta, a curva seguinte
    let iCurva = -1;
    if (lista.length) {
      const atual = s.voltaAtual && s.voltaAtual.trechoAtual ? s.voltaAtual.trechoAtual - 1 : 0;
      for (let k = 0; k < lista.length; k++) {
        const i = (atual + k) % lista.length;
        if (lista[i].tipo === 'curva') { iCurva = i; break; }
      }
    }
    let curva = null;
    // referência e "última" só entre as voltas que VALEM (Flávio 28/10, item 6 do painel p1fast-mapa-tv-2045: descartar a
    // volta de aquecimento e a de resfriamento — o cérebro do GPS marca v.descarte; parada também não vale)
    const validas = voltas.filter(v => !v.descarte);
    const ultima = validas.length ? validas[validas.length - 1] : null;
    const melhorV = validas.reduce((m, v) => (m == null || v.tempoS < m.tempoS ? v : m), null);
    if (iCurva >= 0) {
      const tr = lista[iCurva];
      curva = { i: iCurva + 1, nome: tr.nome, tipoCurva: tr.tipoCurva || null, passagem: null, frenagem: null, vmin: null };
      // referência = a volta válida com a passagem MAIS RÁPIDA deste trecho
      let ref = null;
      for (const v of validas) if (v.trechos && v.trechos[iCurva] && (ref == null || v.trechos[iCurva].tempoS < ref.trechos[iCurva].tempoS)) ref = v;
      if (ultima && ultima.trechos && ref) {
        const u = ultima.trechos[iCurva], r = ref.trechos[iCurva];
        const dif = (a, b) => (a != null && b != null ? r1(a - b) : null);
        const difS = r3(u.tempoS - r.tempoS);
        curva.passagem = {
          volta: ultima.n, refVolta: ref.n, ehRef: ref.n === ultima.n,
          entrada: { kmh: u.kmhEntrada, ref: r.kmhEntrada, delta: dif(u.kmhEntrada, r.kmhEntrada) },
          minima: { kmh: u.kmhMin, ref: r.kmhMin, delta: dif(u.kmhMin, r.kmhMin) },
          saida: { kmh: u.kmhSaida, ref: r.kmhSaida, delta: dif(u.kmhSaida, r.kmhSaida) },
          tempoS: u.tempoS, refTempoS: r.tempoS, difS, tom: tom(difS),
        };
        const mu = medidas(ultima, lista)[iCurva], mr = medidas(ref, lista)[iCurva];
        if (mu) {
          const fu = mu.frenagem, fr = mr ? mr.frenagem : null;
          curva.frenagem = fu.ok ? {
            ...fu,
            ref: fr && fr.ok ? fr : null,
            freouAntesM: fr && fr.ok && fu.inicioFreadaM != null && fr.inicioFreadaM != null ? r1(fr.inicioFreadaM - fu.inicioFreadaM) : null,
            serie: mu.serieG, serieRef: mr ? mr.serieG : null,
          } : { ok: false, motivo: fu.motivo };
          curva.vmin = { kmh: u.kmhMin, ref: r.kmhMin, delta: dif(u.kmhMin, r.kmhMin),
            serie: mu.serieKmh, serieRef: mr ? mr.serieKmh : null };
        }
      }
    }

    // coach: a maior perda da última volta e o motivo medido
    let coach = null;
    const perdas = (s.trechos && s.trechos.validas && s.trechos.validas.perdasUltima) || [];
    const maior = perdas.find(p => lista[p.i - 1] && lista[p.i - 1].tipo === 'curva') || perdas[0] || null;
    if (maior && ultima && ultima.trechos) {
      const i = maior.i - 1;
      let ref = null;
      for (const v of validas) if (v.trechos && v.trechos[i] && (ref == null || v.trechos[i].tempoS < ref.trechos[i].tempoS)) ref = v;
      const u = ultima.trechos[i], r = ref ? ref.trechos[i] : null;
      const motivos = [];
      if (r) {
        if (u.kmhMin != null && r.kmhMin != null && u.kmhMin < r.kmhMin - 1) motivos.push({ tipo: 'minima', texto: `mínima ${virg(r1(r.kmhMin - u.kmhMin))} km/h abaixo da sua melhor` });
        if (u.kmhSaida != null && r.kmhSaida != null && u.kmhSaida < r.kmhSaida - 1) motivos.push({ tipo: 'saida', texto: `saída ${virg(r1(r.kmhSaida - u.kmhSaida))} km/h mais lenta` });
        const mu = lista[i].tipo === 'curva' ? medidas(ultima, lista)[i] : null;
        const mr = mu && ref ? medidas(ref, lista)[i] : null;
        if (mu && mr && mu.frenagem.ok && mr.frenagem.ok && mu.frenagem.inicioFreadaM != null && mr.frenagem.inicioFreadaM != null) {
          const cedo = r1(mr.frenagem.inicioFreadaM - mu.frenagem.inicioFreadaM);
          if (cedo > 5) motivos.push({ tipo: 'freada', texto: `freou ${virg(cedo)} m mais cedo` });
        }
      }
      coach = { trecho: maior.i, nome: maior.nome, perdeuS: maior.difS, volta: ultima.n, refVolta: ref ? ref.n : null,
        frase: `${maior.nome}: perdeu ${String(maior.difS.toFixed(2)).replace('.', ',')} s`, motivos };
    }

    // faixa: a volta inteira (atual × melhor)
    const vMelhor = melhorV;
    const perfilAtual = s.perfilAtual && s.perfilAtual.length ? s.perfilAtual : null;
    let faixa = null;
    if (perfilAtual || (vMelhor && vMelhor.perfil)) {
      let cm = null;
      if (vMelhor && vMelhor.perfil) {
        if (!casasMelhor.has(vMelhor.n)) casasMelhor.set(vMelhor.n, casasDaVolta(vMelhor.perfil, true));
        cm = casasMelhor.get(vMelhor.n);
      }
      const ca = perfilAtual && s.voltaAtual ? casasDaVolta(perfilAtual, false) : null;
      let delta = null, deltaAgoraS = null;
      if (ca && cm && ca.ate >= 0) {
        delta = new Array(FAIXA_BINS).fill(null);
        for (let k = 0; k <= ca.ate; k++) if (ca.t[k] != null && cm.t[k] != null) { delta[k] = r3(ca.t[k] - cm.t[k]); deltaAgoraS = delta[k]; }
      }
      const ultP = perfilAtual ? perfilAtual[perfilAtual.length - 1].p : null;
      faixa = {
        casas: FAIXA_BINS,
        fonte: 'gps',   // velocidade do GPS do RaceBox (Flávio 28/10: "só vamos usar o GPS do RaceBox")
        melhor: cm ? { n: vMelhor.n, tempoS: vMelhor.tempoS, kmh: cm.kmh, freadas: cm.freadas } : null,
        atual: ca ? { n: s.voltaAtual.n, kmh: ca.kmh, ate: ca.ate, freadas: ca.freadas } : null,
        cursor: ca && ca.ate >= 0 && ultP != null ? ultP : null,
        delta, deltaAgoraS,
        curvas: lista.filter(tr => tr.tipo === 'curva').map(tr => ({ nome: tr.nome, de: tr.de, ate: tr.ate })),
      };
    }

    return { stint, deltaAcum, curva, coach, faixa, quadro: montarQuadro(s, lista, ultima, vMelhor, faixa, stint),
      plano: planoDoStint(opts.plano, stint) };
  }

  // quadro: uma linha por CURVA, na ordem da volta — MELHOR (a passagem da melhor volta VÁLIDA) × ÚLTIMA (a mais
  // recente: desta volta se o carro já saiu da curva, senão da última volta válida) e a diferença; na curva em que o
  // carro está, o progresso e a trilha (onde freou e onde não, pelas freadas da faixa da volta em curso)
  function montarQuadro(s, lista, ultimaV, vMelhor, faixa, stint) {
    if (!lista.length) return null;
    const at = s.voltaAtual, feitos = (at && at.trechos) || [];
    const iAgora = at && at.trechoAtual ? at.trechoAtual - 1 : null;
    const ref = vMelhor && vMelhor.trechos ? vMelhor : null;
    const passagem = (m, fr) => (m ? { entrada: m.kmhEntrada, freadaM: fr && fr.ok && fr.inicioFreadaM != null ? fr.inicioFreadaM : null,
      vmin: m.kmhMin, saida: m.kmhSaida, tempoS: m.tempoS } : null);
    let somaDeltaS = null;
    const curvas = [];
    lista.forEach((tr, i) => {
      if (tr.tipo !== 'curva') return;
      let u = null, uN = null, uFr = null;
      if (feitos[i]) {
        u = feitos[i]; uN = at.n;
        const rc = s.perfilAtual ? recorte(s.perfilAtual, tr.de, tr.ate, ANTES_DA_ENTRADA_M) : null;
        uFr = rc ? medirFrenagem(rc.pts, rc.dEnt) : null;
      } else if (ultimaV && ultimaV.trechos) {
        u = ultimaV.trechos[i]; uN = ultimaV.n;
        const mu = medidas(ultimaV, lista)[i]; uFr = mu ? mu.frenagem : null;
      }
      const mr = ref ? medidas(ref, lista)[i] : null;
      const pu = passagem(u, uFr), pm = passagem(ref ? ref.trechos[i] : null, mr ? mr.frenagem : null);
      const ehRef = !!(pu && ref && uN === ref.n);
      let delta = null;
      if (pu && pm && !ehRef) {
        delta = {};
        for (const k of Object.keys(pu)) delta[k] = pu[k] != null && pm[k] != null ? (k === 'tempoS' ? r3 : r1)(pu[k] - pm[k]) : null;
        if (delta.tempoS != null) somaDeltaS = r3((somaDeltaS || 0) + delta.tempoS);
      }
      const agora = !!at && iAgora === i;
      let progresso = null, trilha = null;
      if (agora && faixa && faixa.cursor != null) {
        const vol = (a, b) => (b >= a ? b - a : b + 1 - a);   // curva que cruza a chegada
        const vao = vol(tr.de, tr.ate) || 1;
        progresso = Math.max(0, Math.min(1, vol(tr.de, faixa.cursor) / vao));
        // trilha: casas da faixa da volta em curso entre a entrada e o carro, juntando as seguidas de mesmo tom;
        // 'freia' = a casa está dentro de uma freada da volta em curso, senão 'acelera'
        if (faixa.atual) {
          const n = faixa.casas, kmh = faixa.atual.kmh, fr = faixa.atual.freadas;
          trilha = [];
          const k0 = Math.floor(tr.de * n), nk = Math.max(1, Math.round(progresso * vao * n));
          for (let j = 0; j < nk; j++) {
            const k = (k0 + j) % n;
            if (k > faixa.atual.ate || kmh[k] == null) continue;
            const freia = fr.some(z => k >= Math.floor(z.de * n) && k <= Math.floor(z.ate * n));
            const t = freia ? 'freia' : 'acelera', de = r3(Math.min(1, j / (vao * n)));   // fração da curva
            if (!trilha.length || trilha[trilha.length - 1].tom !== t) trilha.push({ de, tom: t });
          }
        }
      }
      curvas.push({ i: i + 1, nome: tr.nome, estado: agora ? 'agora' : u ? 'feita' : 'aguardando',
        ultimaVolta: uN, ehRef, melhor: pm, ultima: pu, delta, progresso, trilha });
    });
    return {
      volta: at ? { n: at.n, decorridoS: at.decorridoS, deltaAgoraS: faixa ? faixa.deltaAgoraS : null } : null,
      kmh: s.fresco && s.agora && typeof s.agora.kmh === 'number' ? r1(s.agora.kmh) : null,
      ultimaS: stint.ultimaS, melhor: vMelhor ? { n: vMelhor.n, tempoS: vMelhor.tempoS } : null, refVolta: ref ? ref.n : null,
      voltasFechadas: stint.feitas,   // > 0 sem referência = só voltas descartadas até agora (a tela diz "sem volta válida")
      idealTrechosS: s.trechos && s.trechos.validas ? s.trechos.validas.voltaIdealS : null,
      somaDeltaS, curvas,
    };
  }

  return { pacote };
}

export default { criarCerebroTvBlocosGps, medirFrenagem, serieDistancia, planoDoStint, zonasDeFreada };
