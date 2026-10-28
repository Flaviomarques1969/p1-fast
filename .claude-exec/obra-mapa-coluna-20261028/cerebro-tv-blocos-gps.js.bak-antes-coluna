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

function tom(difS) { return difS == null ? null : difS <= 0 ? 'ganhou' : difS < 0.1 ? 'perto' : 'perdeu'; }

/** Criar a casa (guarda o cache das voltas medidas). */
export function criarCerebroTvBlocosGps() {
  const cache = new Map();   // n da volta → medidas por trecho

  function medidas(v, lista) {
    if (!cache.has(v.n)) cache.set(v.n, medirVolta(v, lista));
    return cache.get(v.n);
  }

  /** s = snapshot do cerebro-gps-tv (guardarVoltas: true). */
  function pacote(s) {
    if (!s) return null;
    const voltas = s.voltas || [];
    const lista = (s.trechos && s.trechos.lista) || [];
    const melhor = s.melhorVolta;
    const tempos = voltas.map(v => v.tempoS);
    const stint = {
      voltaAtual: s.voltaAtual ? s.voltaAtual.n : null,
      decorridoVoltaS: s.voltaAtual ? s.voltaAtual.decorridoS : null,
      feitas: voltas.length,
      voltas: voltas.map(v => ({ n: v.n, tempoS: v.tempoS, deltaS: melhor ? r3(v.tempoS - melhor.tempoS) : null,
        melhor: !!melhor && v.n === melhor.n })),
      melhor: melhor ? { n: melhor.n, tempoS: melhor.tempoS } : null,
      ultimaS: voltas.length ? voltas[voltas.length - 1].tempoS : null,
      mediaS: tempos.length ? r3(tempos.reduce((a, b) => a + b, 0) / tempos.length) : null,
      totalS: tempos.length ? r3(tempos.reduce((a, b) => a + b, 0)) : null,
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
    const ultima = voltas.length ? voltas[voltas.length - 1] : null;
    if (iCurva >= 0) {
      const tr = lista[iCurva];
      curva = { i: iCurva + 1, nome: tr.nome, tipoCurva: tr.tipoCurva || null, passagem: null, frenagem: null, vmin: null };
      // referência = a volta com a passagem MAIS RÁPIDA deste trecho
      let ref = null;
      for (const v of voltas) if (v.trechos && v.trechos[iCurva] && (ref == null || v.trechos[iCurva].tempoS < ref.trechos[iCurva].tempoS)) ref = v;
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
    const perdas = (s.trechos && s.trechos.perdasUltima) || [];
    const maior = perdas.find(p => lista[p.i - 1] && lista[p.i - 1].tipo === 'curva') || perdas[0] || null;
    if (maior && ultima && ultima.trechos) {
      const i = maior.i - 1;
      let ref = null;
      for (const v of voltas) if (v.trechos && v.trechos[i] && (ref == null || v.trechos[i].tempoS < ref.trechos[i].tempoS)) ref = v;
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

    return { stint, deltaAcum, curva, coach };
  }

  return { pacote };
}

export default { criarCerebroTvBlocosGps, medirFrenagem, serieDistancia };
