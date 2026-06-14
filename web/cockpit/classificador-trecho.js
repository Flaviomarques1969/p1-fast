// classificador-trecho.js — classifica o TIPO de uma curva e propõe o formato de trail
// braking. Módulo PURO (sem DOM, sem rede), no padrão do freio-trecho.js.
//
// PRINCÍPIO INEGOCIÁVEL (proposta v2, não reabrir): o ALVO do treino continua sendo a
// curva real da MELHOR PASSAGEM (régua canônica). Este classificador NÃO substitui a
// régua. Serve pra (a) bootstrap teórico na calibração, (b) nomear o erro com o
// vocabulário do tipo da curva, (c) alertar coerência. Nunca julga, nunca vai pro
// cockpit ao vivo, e NÃO sobrescreve a coluna `tipo` de track_segments (usa tipo_curva).
//
// HONESTIDADE DO DADO: a telemetria preservada (maio/2026) é ~1 Hz — os pontos de cada
// passagem cobrem a APROXIMAÇÃO + a curva (arco de centenas de metros, não uma janela
// curta), com 25-45 m entre pontos. Disso, RAIO e PERFIL DO RAIO não saem confiáveis
// (confianca:'baixa') e o g lateral derivado deles também não. A classificação PRIMÁRIA
// apoia em VELOCIDADE: a velocidade de ENTRADA da curva é o PICO antes da mínima (de
// onde a freada começou — robusto a onde o arco começa), e a razão é esse pico ÷ mínima.
// Os LIMIARES são chute educado declarado, a calibrar com as voltas reais do Bubi.

export const LIMIARES = {
  freadaMinRazao: 1.10,   // pico/Vmin acima disso = houve freada visível na passagem
  razaoLenta: 1.55,       // >= = lenta pós-reta (grampo)
  razaoRapida: 1.20,      // <= (com Vmin alto) = rápida; faixa larga p/ não virar ruído a 1 Hz
  vminLentaKmh: 105,      // Vmin abaixo disso reforça "lenta"
  vminRapidaKmh: 130,     // Vmin acima disso reforça "rápida"
  aceleraSaidaKmh: 12,    // Vs - Vmin acima disso = acelera a partir da mínima (despeja em reta)
  encadeadaMaxM: 60,      // saída -> próxima entrada abaixo disso = encadeada
  ptsMinGeometria: 14,    // abaixo disso, geometria fina é inviável (confiança dura baixa)
  espacamentoMaxM: 12,    // acima disso entre pontos, raio fino não é confiável
  vminSuspeitoKmh: 5,     // Vmin abaixo disso = provável falha de leitura GPS
  gLateralMaxPlausivel: 1.5, // acima disso o raio é fisicamente implausível (Celta ~1,0-1,3 g)
  anguloMinCurvaDeg: 25,  // abaixo disso o recorte está quase reto: raio não representa curva
};

export const TIPOS = {
  T0: { rotulo: 'MÉDIA CLÁSSICA', formato: 'Trail progressivo: pancada inicial e soltura gradual e constante até o ápice.' },
  T1: { rotulo: 'LENTA PÓS-RETA', formato: '100% na pancada inicial, soltura profunda e gradativa até o ápice (o freio ajuda a girar o carro).' },
  T2: { rotulo: 'RAIO DECRESCENTE', formato: 'Pancada parcial (60-75%) + residual constante (35-50%) até o raio mínimo, soltura curta no fim.' },
  T3: { rotulo: 'RÁPIDA', formato: 'Toque curto (até 40%) ou só alívio do acelerador — assenta a dianteira, não reduz a velocidade.' },
  T4: { rotulo: 'ENCADEADA', formato: 'Residual mantido até a troca de direção — a prioridade é a entrada da próxima curva, não a saída desta.' },
  T5: { rotulo: 'RAIO CRESCENTE', formato: 'Ápice cedo, trail curto, acelera cedo — ouro de saída em tração dianteira.' },
  SF: { rotulo: 'SEM FREADA', formato: 'Curva de pé embaixo (kink): sem prescrição de freio.' },
  ND: { rotulo: 'INDETERMINADO', formato: 'O dado atual não permite afirmar o tipo com segurança — ver ressalvas.' },
};

const R_TERRA = 6378137, D2R = Math.PI / 180;

// distância em metros entre dois pontos {lat,lng} (equirretangular local — exato o
// bastante na escala de uma curva; mesmo método do replay e do freio-trecho).
export function distM(a, b) {
  const x = (b.lng - a.lng) * D2R * Math.cos(((a.lat + b.lat) / 2) * D2R);
  const y = (b.lat - a.lat) * D2R;
  return Math.hypot(x, y) * R_TERRA;
}

// projeta os pontos {lat,lng} para um plano local x,y (metros) relativo ao 1º ponto.
export function paraXY(pts) {
  if (!pts.length) return [];
  const lat0 = pts[0].lat, lng0 = pts[0].lng, cos0 = Math.cos(lat0 * D2R);
  return pts.map(p => ({
    x: (p.lng - lng0) * D2R * cos0 * R_TERRA,
    y: (p.lat - lat0) * D2R * R_TERRA,
    kmh: p.kmh, t: p.t,
  }));
}

// velocidades amostradas (km/h), tolerante a dropout de GPS nas bordas (usa só kmh
// finito). A velocidade de ENTRADA da curva é o PICO até a mínima (de onde freou), não
// o 1º ponto (que pode estar em plena reta ainda acelerando).
export function velocidades(pts) {
  const fin = [];
  for (let i = 0; i < pts.length; i++) if (Number.isFinite(pts[i].kmh)) fin.push(i);
  if (!fin.length) return null;
  const first = fin[0], last = fin[fin.length - 1];
  let vmin = Infinity, idxMin = first;
  for (const i of fin) if (pts[i].kmh < vmin) { vmin = pts[i].kmh; idxMin = i; }
  let vEntrada = -Infinity;
  for (const i of fin) { if (i > idxMin) break; if (pts[i].kmh > vEntrada) vEntrada = pts[i].kmh; }
  return {
    veInicio: pts[first].kmh,        // velocidade no 1º ponto gravado (pode ser na reta)
    vEntrada,                        // PICO até a mínima = entrada da zona de freada
    vmin, vs: pts[last].kmh, idxMin,
    semAproximacao: idxMin === first, // mínima no 1º ponto: freada começou antes da passagem
    minimaNaSaida: idxMin === last,   // mínima no último ponto: ápice/saída fora da janela
    dadoSuspeito: vmin <= LIMIARES.vminSuspeitoKmh, // GPS zerado/parado
  };
}

export function comprimentoM(pts) {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += distM(pts[i - 1], pts[i]);
  return s;
}

// desaceleração de pico (m/s²) pela física do GPS — grosseira a 1 Hz, declarada.
export function desacelPicoMs2(pts) {
  let pico = 0;
  for (let i = 1; i < pts.length; i++) {
    if (!Number.isFinite(pts[i].kmh) || !Number.isFinite(pts[i - 1].kmh)) continue;
    const dt = (pts[i].t - pts[i - 1].t) / 1000;
    if (!(dt > 0)) continue;
    const a = ((pts[i - 1].kmh - pts[i].kmh) / 3.6) / dt;
    if (a > pico) pico = a;
  }
  return pico;
}

// ângulo total varrido (graus) e sentido ('esq'/'dir') pela soma das mudanças de rumo.
export function curvaturaTotal(xy) {
  if (xy.length < 3) return { anguloDeg: 0, sentido: 'reta' };
  let soma = 0;
  for (let i = 2; i < xy.length; i++) {
    const a1 = Math.atan2(xy[i - 1].y - xy[i - 2].y, xy[i - 1].x - xy[i - 2].x);
    const a2 = Math.atan2(xy[i].y - xy[i - 1].y, xy[i].x - xy[i - 1].x);
    let d = a2 - a1;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    soma += d;
  }
  return { anguloDeg: Math.abs(soma) * 180 / Math.PI, sentido: soma > 0 ? 'esq' : 'dir' };
}

// raio por círculo de 3 pontos (m). Colinear = Infinity (reta).
export function raioPorTresPontos(a, b, c) {
  const A = Math.hypot(b.x - a.x, b.y - a.y);
  const B = Math.hypot(c.x - b.x, c.y - b.y);
  const C = Math.hypot(c.x - a.x, c.y - a.y);
  const area2 = Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y));
  if (area2 < 1e-6) return Infinity;
  return (A * B * C) / (2 * area2);
}

// perfil do raio: usa MEDIANA das metades (robusto a outlier) pra tendência; rminM é a
// MEDIANA do terço mais fechado (não o mínimo cru, que captura ruído a 1 Hz).
export function perfilRaio(xy, npts, comprimento) {
  const espac = comprimento / Math.max(1, xy.length - 1);
  const confianca = (npts >= LIMIARES.ptsMinGeometria && espac <= LIMIARES.espacamentoMaxM) ? 'media' : 'baixa';
  if (xy.length < 5) return { rminM: null, perfil: 'indeterminado', confianca: 'baixa', espacM: espac };
  const raios = [];
  for (let i = 1; i < xy.length - 1; i++) {
    const r = raioPorTresPontos(xy[i - 1], xy[i], xy[i + 1]);
    if (Number.isFinite(r)) raios.push(r);
  }
  if (!raios.length) return { rminM: null, perfil: 'indeterminado', confianca: 'baixa', espacM: espac };
  const med = arr => { const s = arr.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  const ord = raios.slice().sort((x, y) => x - y);
  const rminM = med(ord.slice(0, Math.max(1, Math.ceil(ord.length / 3)))); // mediana do terço mais fechado
  const meio = Math.floor(raios.length / 2);
  const r1 = med(raios.slice(0, meio || 1)), r2 = med(raios.slice(meio));
  let perfil = 'constante';
  if (r2 < r1 * 0.7) perfil = 'decrescente';
  else if (r2 > r1 * 1.4) perfil = 'crescente';
  return { rminM, perfil, confianca, espacM: espac };
}

// classifica um trecho. geo = {nome, id}; pts = pontos da melhor passagem (lat,lng,kmh,t);
// distProximaM = distância (m) da saída deste trecho até a entrada do próximo (ou null).
export function classificarTrecho({ geo, pts, distProximaM = null, limiares = LIMIARES }) {
  const L = limiares;
  if (!pts || pts.length < 3) {
    return nd('passagem sem pontos suficientes', ['Sem dados de passagem para este trecho.']);
  }
  const v = velocidades(pts);
  if (!v) return nd('passagem sem velocidade válida', ['Nenhum ponto da passagem tem velocidade legível.']);

  const xy = paraXY(pts);
  const comprimento = comprimentoM(pts);
  const npts = pts.length;
  const razao = v.vmin > 0 ? v.vEntrada / v.vmin : Infinity;
  const desacel = desacelPicoMs2(pts);
  const { anguloDeg, sentido } = curvaturaTotal(xy);
  const geom = perfilRaio(xy, npts, comprimento);
  const espacM = comprimento / Math.max(1, npts - 1);

  const freou = !v.semAproximacao && !v.dadoSuspeito && razao >= L.freadaMinRazao;
  const aceleraSaida = (v.vs - v.vmin) >= L.aceleraSaidaKmh;
  const encadeada = distProximaM != null && distProximaM <= L.encadeadaMaxM;

  // g lateral no Vmin (Vmin²/R_min) — só se o raio for plausível; senão o raio a 1 Hz mente.
  let gLateral = null, rminPlausivel = geom.rminM, raioMotivo = null;
  if (Number.isFinite(geom.rminM) && geom.rminM > 0) {
    const g = Math.pow(v.vmin / 3.6, 2) / geom.rminM / 9.81;
    if (g <= L.gLateralMaxPlausivel) gLateral = g; else { rminPlausivel = null; raioMotivo = 'implausivel'; }
  }
  // recorte quase reto: o "raio" mínimo não representa uma curva (ângulo varrido pequeno)
  if (anguloDeg < L.anguloMinCurvaDeg) { rminPlausivel = null; gLateral = null; raioMotivo = 'reto'; }

  const ressalvas = [];
  if (espacM > L.espacamentoMaxM) ressalvas.push(`Pontos a ~${espacM.toFixed(0)} m (telemetria ~1 Hz): raio, perfil do raio e g lateral são aproximações grossas (não confiáveis). Para o formato fino do trail, regravar a 25 Hz (RaceBox Mini S).`);
  if (raioMotivo === 'implausivel') ressalvas.push('O raio estimado deu fisicamente implausível (ruído do GPS a 1 Hz) — omitido em vez de mostrar número falso.');
  if (raioMotivo === 'reto') ressalvas.push(`Ângulo varrido pequeno neste recorte (~${r1(anguloDeg)}°): o trecho está quase reto aqui — o raio não representa a curva (omitido).`);

  const acel = aceleraSaida ? ` Acelera da mínima pra saída (Vs ${r1(v.vs)} km/h): despeja em reta.` : '';
  let tipo, confianca, motivo;

  if (v.dadoSuspeito) {
    tipo = 'ND'; confianca = 'baixa';
    motivo = `Velocidade mínima amostrada ~0 (Vmin ${r1(v.vmin)} km/h): provável falha de leitura do GPS — dado não confiável neste trecho.`;
  } else if (v.vmin >= L.vminRapidaKmh && razao < L.razaoLenta) {
    // rápida: vmin alto e pouca/nenhuma queda
    tipo = freou ? 'T3' : 'SF'; confianca = 'media';
    motivo = freou
      ? `Freada leve (razão ${r2(razao)}) com Vmin alto (${r1(v.vmin)} km/h): rápida.${acel}`
      : `Velocidade alta e quase constante (Vmin ${r1(v.vmin)} km/h, razão ${r2(razao)}): curva de pé embaixo / toque mínimo.${acel}`;
  } else if (!freou) {
    // vmin baixo/médio sem freada visível DENTRO da passagem
    tipo = 'ND'; confianca = 'baixa';
    motivo = v.semAproximacao
      ? `Vmin ${r1(v.vmin)} km/h logo no início do recorte: a freada começou ANTES do início desta passagem (cobre a curva/saída, não a frenagem). Não dá pra avaliar o trail aqui.${acel}`
      : `A velocidade quase não cai no recorte (entrada ${r1(v.vEntrada)} -> mínima ${r1(v.vmin)} km/h, razão ${r2(razao)}): sem freada significativa registrada neste trecho. Pode ser trecho de saída/aceleração ou freada fora do recorte.${acel}`;
    ressalvas.push('Para avaliar esta curva, a passagem precisa cobrir a frenagem (recorte/posicionamento da barra de entrada) ou usar captura a 25 Hz.');
  } else if (encadeada) {
    tipo = 'T4'; confianca = 'media';
    motivo = `Saída a ${r1(distProximaM)} m da próxima entrada: trecho encadeado — trail orientado ao posicionamento da curva seguinte.`;
  } else if (razao >= L.razaoLenta || v.vmin <= L.vminLentaKmh) {
    tipo = 'T1'; confianca = razao >= L.razaoLenta ? 'media' : 'baixa';
    motivo = `Freada forte (entrada ${r1(v.vEntrada)} -> mínima ${r1(v.vmin)} km/h, razão ${r2(razao)}): lenta pós-reta.${acel}`;
  } else {
    tipo = 'T0'; confianca = 'media';
    motivo = `Freada média (entrada ${r1(v.vEntrada)} -> mínima ${r1(v.vmin)} km/h, razão ${r2(razao)}): média clássica (default).${acel}`;
  }
  if (v.minimaNaSaida && tipo !== 'ND' && tipo !== 'SF') ressalvas.push('A velocidade mínima caiu no último ponto: o ápice pode estar fora do recorte — confirmar.');

  // perfil do raio (T2/T5) só como SUGESTÃO e só com geometria confiável (cadeia sem dangling-else)
  if (freou && geom.confianca === 'media' && geom.perfil === 'decrescente') ressalvas.push('Geometria sugere raio decrescente — avaliar T2 (residual) ao validar.');
  else if (freou && geom.confianca === 'media' && geom.perfil === 'crescente') ressalvas.push('Geometria sugere raio crescente — avaliar T5 (ápice cedo) ao validar.');
  else if (freou) ressalvas.push('Perfil do raio (T2 decrescente / T5 crescente) não determinável com este dado — precisa de 25 Hz.');
  if (freou && encadeada === false && distProximaM != null && distProximaM < L.encadeadaMaxM * 1.6) ressalvas.push(`Próxima entrada a ${r1(distProximaM)} m — limítrofe de encadeada (T4); validar.`);

  return {
    tipo, rotulo: TIPOS[tipo].rotulo, formato: TIPOS[tipo].formato, confianca, motivo,
    variaveis: {
      vEntradaKmh: { valor: r1(v.vEntrada), fonte: 'telemetria: pico de velocidade até a mínima', confianca: 'media' },
      vminKmh: { valor: r1(v.vmin), fonte: 'telemetria: mínima amostrada (~1 Hz)', confianca: 'media' },
      vsKmh: { valor: r1(v.vs), fonte: 'telemetria: último ponto', confianca: 'media' },
      veInicioKmh: { valor: r1(v.veInicio), fonte: 'telemetria: 1º ponto gravado (pode ser na reta)', confianca: 'media' },
      razaoEntradaVmin: { valor: razao === Infinity ? null : r2(razao), fonte: 'calculado: pico / mínima', confianca: freou ? 'media' : 'baixa' },
      desacelPicoMs2: { valor: r2(desacel), fonte: 'física do GPS (estimativa, não sensor)', confianca: 'baixa' },
      gLateralVmin: { valor: gLateral == null ? null : r2(gLateral), fonte: 'Vmin²/raio (depende do raio)', confianca: 'baixa' },
      comprimentoM: { valor: r1(comprimento), fonte: 'soma dos pontos da passagem (cobre aproximação + curva)', confianca: 'media' },
      espacamentoM: { valor: r1(espacM), fonte: 'comprimento / nº de pontos', confianca: 'alta' },
      nPontos: { valor: npts, fonte: 'pontos_json da melhor passagem', confianca: 'alta' },
      anguloDeg: { valor: r1(anguloDeg), fonte: 'soma das mudanças de rumo (XY)', confianca: espacM > L.espacamentoMaxM ? 'baixa' : 'media' },
      sentido: { valor: sentido, fonte: 'sinal da curvatura', confianca: 'media' },
      rminM: { valor: rminPlausivel == null ? null : r1(rminPlausivel), fonte: 'mediana do terço mais fechado (3 pontos)', confianca: geom.confianca },
      perfilRaio: { valor: geom.perfil, fonte: 'tendência das medianas', confianca: geom.confianca },
      distProximaEntradaM: { valor: distProximaM == null ? null : r1(distProximaM), fonte: 'saída -> entrada da próxima curva', confianca: 'media' },
    },
    flags: { houveFreada: freou, aceleraSaida, encadeada, semAproximacao: v.semAproximacao, dadoSuspeito: v.dadoSuspeito },
    ressalvas,
  };
}

function nd(motivo, ressalvas) {
  return { tipo: 'ND', rotulo: TIPOS.ND.rotulo, formato: TIPOS.ND.formato, confianca: 'baixa', motivo, variaveis: {}, flags: {}, ressalvas };
}
function r1(x) { return Number.isFinite(x) ? Math.round(x * 10) / 10 : x; }
function r2(x) { return Number.isFinite(x) ? Math.round(x * 100) / 100 : x; }
