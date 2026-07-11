// ============================================================================
// CÉREBRO — COACH DE STINT (o lado do DADO do Coach de IA)   [Fase 1]
//
// Conta NOVA, casa própria (caminho A — Fable 19:48Z): NÃO toca a v0
// `cerebro-coach.js` (seleção por km/h do Command Box). Aqui a conta é em
// SEGUNDOS, sobre o motor de delta, para o cockpit 10,5".
//
// Papel (J4 §3.1): o "acumulador de stint" — a memória que o motor de delta não
// tem. Recebe o delta de cada curva por volta, junta no stint, e a inteligência
// da J2 elege a ÚNICA maior oportunidade (em segundos). Emite o PACOTE COACH v1
// de 3 estados honestos (J4 §2): null | 'silencio' | 'oportunidade'. A tela só EXIBE.
//
// Contratos (lidos do REAL, não do v0 provisório):
//   objeto oportunidade v1 ....... entregas/janela-2.md §1
//   método do ganho / eleição .... janela-2.md §3-5
//   mensagem N1/N2 (decisão 3) ... janela-1.md §2 (SÓ âmbar/verde — sem vermelho)
//   GraficoSpec .................. janela-3.md §1.2
//   envelope 3 estados ........... janela-4.md §2
//
// Decisões do Flávio em vigor (SOLUCAO-FINAL §1):
//   #9 conservador → ganhoVoltaS = quantil BAIXO (p25) dos gaps por volta.
//   #3 SÓ âmbar/verde no coach (vermelho reservado a crítico — não existe aqui).
//   #2 calibração como CONSTANTES NOMEADAS configuráveis (CALIBRACAO abaixo).
//   #6 insistência contínua guiada pelo PLANO DO STINT (trechosFoco / nVoltasAlvo).
//
// Régua dura: número SEM sinal (cor dá direção) · ganho em segundos · só dado real
// (subTrecho:null quando o "onde" não é confiável — passo 0) · não inventa km/h.
// ============================================================================

import { geoParaDesenho, PONTOS_DESENHO } from '../../cockpit/pista-oficial-brasilia.js';
import { TIPO_POR_CURVA, semFreadaPorTipo } from '../tipos-curva-brasilia.js';
import { distanciaPontos as distMeters } from '../../cockpit/geo.js';

// ── Calibração (decisão 2 — constantes NOMEADAS, configuráveis via opts.calibracao) ──
export const CALIBRACAO = Object.freeze({
  PISO_ELEICAO_S: 0.10,   // piso de anúncio no ganho agregado (RecordeGanhoMinS)
  PISO_MEDICAO_S: 0.05,   // abaixo disso a volta não conta (SubTrechoMinS / jitter GPS)
  ADESAO: 0.6,            // fração do teto que se repete no stint (decisão 2: 0,6)
  SPREAD_TECNICA: 3,      // nº de curvas distintas p/ virar 'tecnica-recorrente'
  STICKINESS_S: 0.10,     // só troca o foco se o desafiante bater por >= isto
  QUANTIL_GANHO: 0.25,    // decisão 9: quantil BAIXO (p25) — conservador
  MIN_VOLTAS_FLYING: 3,   // < isto → status 'coletando-dados' (silêncio honesto)
  GUARD_DIST_M: 8,        // dist média por ponto < isto → sem suporte (descarta)
  MARGEM_ZOOM: 0.14,      // margem do recorte do gráfico (J3 §4)
});

// ── util numérica ──
function quantil(ordenado, q) {
  if (!ordenado.length) return null;
  const pos = (ordenado.length - 1) * q;
  const base = Math.floor(pos);
  const resto = pos - base;
  return ordenado[base + 1] != null
    ? ordenado[base] + resto * (ordenado[base + 1] - ordenado[base])
    : ordenado[base];
}
function media(xs) { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0; }
function desvio(xs) {
  if (xs.length < 2) return 0;
  const m = media(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) * (b - m), 0) / xs.length);
}
function clip(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
function fmtGanho(s) { return `${(Math.max(0, s)).toFixed(1).replace('.', ',')} s`; }
function nomeCurto(nome) {
  // 'CURVA DA BRUXA'→'Bruxa' · 'CURVA 01'→'Curva 01' · 'CURVA "S"'→'Curva "S"' (janela-1 §2.2)
  const m = nome.match(/^CURVA (?:DA |DO |D'|DE )?(.+)$/i);
  if (!m) return nome;
  const resto = m[1];
  if (/^["0-9]/.test(resto)) return `Curva ${resto}`;                 // numeradas / "S" mantêm "Curva"
  return resto.split(' ').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' '); // Bruxa, Junção, Reta Oposta
}

// Distância GPS: conta mora na casa neutra (src/domain/geo.js) — regra do CONTRATO_DADOS.
/** Anota fracao (0..1 por distância cumulativa) nos pontos crus — sub fica null (Fase 1). */
function anotarFracao(pontos) {
  if (!Array.isArray(pontos) || pontos.length < 2) return (pontos || []).map(p => ({ ...p, fracao: 0, sub: null }));
  const acum = [0];
  for (let i = 1; i < pontos.length; i++) acum.push(acum[i - 1] + distMeters(pontos[i - 1], pontos[i]));
  const total = acum[acum.length - 1] || 1;
  return pontos.map((p, i) => ({ lat: p.lat, lng: p.lng, kmh: p.kmh, t: p.t, fracao: clip(acum[i] / total, 0, 1), sub: null }));
}

// ── confiança (derivada-J2 · janela-2.md §4.3, janela FIXA = agregado no stint) ──
function confiancaAgregada({ nAmostras, distMediaM, hitRate, gaps, deltaMedioS }) {
  if (distMediaM < CALIBRACAO.GUARD_DIST_M || nAmostras < 2) {
    return { nivel: 'baixa', valor: 0, origem: 'derivada-J2' };
  }
  const fAmostras = clip((nAmostras - 2) / 6, 0, 1);           // <=2→0 ; ~8→1
  const cv = deltaMedioS > 0 ? desvio(gaps) / deltaMedioS : 1;
  const fConsistencia = clip(hitRate, 0, 1) * clip(1 - cv, 0, 1); // repetir volta-a-volta = prova
  const fMagnitude = clip((deltaMedioS - 0.10) / 0.10, 0, 1);   // 0.10→0 ; >=0.20→1
  const valor = clip(fAmostras * fConsistencia * fMagnitude, 0, 1);
  const nivel = valor >= 0.66 ? 'alta' : (valor >= 0.33 ? 'media' : 'baixa');
  return { nivel, valor, origem: 'derivada-J2' };
}

/**
 * Cria o acumulador de stint do coach.
 * @param {object} opts
 * @param {number} opts.nVoltasAlvo   plano do stint (StintPlan.nVoltasAlvo) — p/ voltasRestantes. null → projeção null.
 * @param {string[]} opts.trechosFoco [segmentId] de foco do stint (decisão 6 — insistência guiada pelo plano).
 * @param {object}  opts.calibracao   override das constantes (decisão 2).
 */
export function criarCoachStint(opts = {}) {
  const CAL = { ...CALIBRACAO, ...(opts.calibracao || {}) };
  const nVoltasAlvo = opts.nVoltasAlvo != null ? Number(opts.nVoltasAlvo) : null;
  const trechosFoco = Array.isArray(opts.trechosFoco) ? opts.trechosFoco : [];

  // memória do stint: por curva, as ocorrências por volta
  const porCurva = new Map();   // segmentId -> { curvaNome, tipoCurva, ocorrencias:[...] }
  const voltasVistas = new Set();   // voltas VOADORAS (out-laps fora) — confiança/observação
  const voltasRodadas = new Set();  // TODAS as voltas rodadas (out-laps incluídas) — projeção do stint
  let ultimaEleitaId = null;    // stickiness (histerese do foco)

  function registrarCurva(segmentId, curvaNome) {
    if (!porCurva.has(segmentId)) {
      const tipoCurva = TIPO_POR_CURVA[curvaNome] || null;
      porCurva.set(segmentId, { segmentId, curvaNome, tipoCurva, ocorrencias: [] });
    }
    return porCurva.get(segmentId);
  }

  /**
   * Recebe o delta de UMA curva numa volta.
   * @param {object} ev
   *   volta, segmentId, curvaNome
   *   tempoAtualS  — relógio da passagem atual (do calcularDelta, campo aditivo)
   *   tempoRefS    — relógio da melhor histórica (referência; pneu separa histórico)
   *   nPontos      — nº de pontos da curva nesta passagem (fAmostras do fallback curva-inteira)
   *   distMediaM   — dist média por ponto (guard de suporte); opcional (default estimado)
   *   tracos       — {atual:[{lat,lng,kmh,t}], referencia:[...]} (matéria do gráfico); opcional
   *   apice        — {distFromIdealM, angleFromIdealDeg} | null; opcional
   *   outlap       — boolean: o harness/regra já marcou como out-lap → não conta
   */
  function onDelta(ev) {
    if (!ev || ev.segmentId == null || ev.curvaNome == null) return;
    if (ev.volta != null) voltasRodadas.add(ev.volta); // toda volta conta como rodada (projeção)
    if (ev.outlap) return; // out-lap não entra na recorrência nem conta como voadora (janela-2 §4.5)
    const gap = (Number.isFinite(ev.tempoAtualS) && Number.isFinite(ev.tempoRefS))
      ? ev.tempoAtualS - ev.tempoRefS : null;
    if (gap == null) return;              // sem relógio confiável → não conta (sem-referencia trata no pacote)
    if (ev.volta != null) voltasVistas.add(ev.volta); // só voadoras entram
    const c = registrarCurva(ev.segmentId, ev.curvaNome);
    c.ocorrencias.push({
      volta: ev.volta ?? null,
      gap,
      tempoAtualS: ev.tempoAtualS,
      tempoRefS: ev.tempoRefS,
      tipoPneu: ev.tipoPneu || null,
      nPontos: Number.isFinite(ev.nPontos) ? ev.nPontos : (ev.tracos?.atual?.length || 0),
      distMediaM: Number.isFinite(ev.distMediaM) ? ev.distMediaM : 15, // ~1 Hz espaça ~11-22 m
      tracos: ev.tracos || null,
      apice: ev.apice || null,
    });
  }

  /** Marca uma volta fechada (voadora ou out-lap) — p/ voltasObservadas e voltasRestantes. */
  function onVolta(n, { outlap = false } = {}) { if (n != null) { voltasRodadas.add(n); if (!outlap) voltasVistas.add(n); } }

  // ── ELEIÇÃO (janela-2 §5) — caminho comum da Fase 1 = curva inteira (subTrecho:null) ──
  function montarCandidato(c) {
    const oc = c.ocorrencias;             // TODAS as voltas voadoras da curva
    if (oc.length < 1) return null;
    // ganhoVoltaS = quantil BAIXO (p25) sobre TODAS as voltas, gap negativo/zero contando 0
    // (janela-2 §3.3/§3.5/§3.6). É o CONSERVADOR (decisão 9): se o piloto às vezes iguala a
    // referência (gap~0), o p25 cai e a curva CALA — bimodal não vira lição fabricada (C4/Vitória).
    const gapsClamp = oc.map(o => Math.max(0, o.gap)).sort((a, b) => a - b);
    const ganhoVoltaS = Math.max(0, quantil(gapsClamp, CAL.QUANTIL_GANHO));
    // recorrência/consistência: só as voltas em que REALMENTE perdeu (acima do piso de medição)
    const positivos = oc.filter(o => o.gap > CAL.PISO_MEDICAO_S);
    const gapsPerda = positivos.map(o => o.gap);
    const deltaMedioS = gapsPerda.length ? media(gapsPerda) : 0; // contexto (média das perdas)
    const nAmostras = oc.reduce((s, o) => s + (o.nPontos || 0), 0); // fAmostras: pontos da curva no stint
    const distMediaM = media(oc.map(o => o.distMediaM));
    const hitRate = oc.length ? positivos.length / oc.length : 0;
    const confianca = confiancaAgregada({ nAmostras, distMediaM, hitRate, gaps: gapsPerda, deltaMedioS });
    // representante = a ocorrência de PERDA com gap mais perto do ganhoVoltaS (reconciliação/tracos)
    const base = positivos.length ? positivos : oc;
    let rep = base[0];
    for (const o of base) if (Math.abs(o.gap - ganhoVoltaS) < Math.abs(rep.gap - ganhoVoltaS)) rep = o;
    return {
      c, ganhoVoltaS, deltaMedioS, nAmostras, hitRate, confianca,
      rep, voltasComOcorrencia: positivos.length,
      score: ganhoVoltaS * confianca.valor,
    };
  }

  function eleger() {
    const flying = voltasVistas.size;
    if (flying < CAL.MIN_VOLTAS_FLYING) {
      return { eleito: null, status: { estado: 'coletando-dados', voltasObservadas: flying, motivo: `${flying} volta${flying === 1 ? '' : 's'} — junto mais dado antes de apontar` } };
    }
    let candidatos = [];
    for (const c of porCurva.values()) {
      const cand = montarCandidato(c);
      if (cand) candidatos.push(cand);
    }
    if (!candidatos.length) {
      return { eleito: null, status: { estado: 'sem-referencia', voltasObservadas: flying, motivo: 'Sem volta de comparação ainda' } };
    }
    // filtra piso de ELEIÇÃO + amostrasMin (via confiança>0) + gates
    candidatos = candidatos.filter(k => k.ganhoVoltaS >= CAL.PISO_ELEICAO_S && k.confianca.valor > 0);
    if (!candidatos.length) {
      return { eleito: null, status: { estado: 'no-teto', voltasObservadas: flying, motivo: 'No seu ritmo' } };
    }
    // argmax(score) com STICKINESS (só troca se o desafiante bate por >= STICKINESS_S de ganho)
    candidatos.sort((a, b) => b.score - a.score);
    let eleito = candidatos[0];
    if (ultimaEleitaId && ultimaEleitaId !== eleito.c.segmentId) {
      const atual = candidatos.find(k => k.c.segmentId === ultimaEleitaId);
      if (atual && (eleito.ganhoVoltaS - atual.ganhoVoltaS) < CAL.STICKINESS_S) eleito = atual;
    }
    ultimaEleitaId = eleito.c.segmentId;
    return { eleito, status: null, flying };
  }

  // ── monta o objeto oportunidade v1 (janela-2 §1) — caminho subTrecho:null ──
  function montarObjeto(k, flying) {
    const { c, rep } = k;
    const voltasRestantes = nVoltasAlvo != null ? Math.max(0, nVoltasAlvo - voltasRodadas.size) : 0;
    const podeProjetar = voltasRestantes > 0 && k.voltasComOcorrencia >= CAL.MIN_VOLTAS_FLYING && k.ganhoVoltaS >= CAL.PISO_ELEICAO_S;
    const ganhoStintS = podeProjetar ? Number((k.ganhoVoltaS * voltasRestantes * CAL.ADESAO).toFixed(3)) : null;
    const noFoco = trechosFoco.includes(c.segmentId); // decisão 6 (insistência guiada pelo plano)
    const tracos = rep.tracos
      ? { atual: anotarFracao(rep.tracos.atual), referencia: anotarFracao(rep.tracos.referencia) }
      : null;
    return {
      id: `v${rep.volta ?? flying}-${c.segmentId.slice(0, 4)}-curva`,
      geradaNaVolta: rep.volta ?? flying,
      tipo: 'curva-pontual',
      tecnica: null,                 // subTrecho:null → sem verbo de sub (Fase 1)
      tipoCurva: c.tipoCurva,
      segmentId: c.segmentId,
      curvaNome: c.curvaNome,
      subTrecho: null,               // caminho honesto da Fase 1 (passo 0)
      ganhoVoltaS: Number(k.ganhoVoltaS.toFixed(3)),
      ganhoStintS,
      confianca: { nivel: k.confianca.nivel, valor: Number(k.confianca.valor.toFixed(3)), origem: 'derivada-J2' },
      reconciliacao: {
        tempoTrechoAtualS: Number.isFinite(rep.tempoAtualS) ? Number(rep.tempoAtualS.toFixed(3)) : null,
        tempoTrechoRefS: Number.isFinite(rep.tempoRefS) ? Number(rep.tempoRefS.toFixed(3)) : null,
        gapMedidoS: Number(rep.gap.toFixed(3)),
        deltaTotalIntegradoS: null,  // subTrecho:null → sem integração por sub
        escala: 1,
      },
      projecao: { voltasRestantes, adesao: CAL.ADESAO, base: 'projetada' },
      evidencia: {
        voltasObservadas: [...voltasVistas].filter(v => v != null).sort((a, b) => a - b),
        ocorrencias: [{ segmentId: c.segmentId, curvaNome: c.curvaNome, subTrecho: null, deltaS: Number(k.ganhoVoltaS.toFixed(3)) }],
        deltaMedioS: Number(k.deltaMedioS.toFixed(3)),
      },
      referencia: { tipoPneu: rep.tipoPneu || null, tempoTrechoS: Number.isFinite(rep.tempoRefS) ? Number(rep.tempoRefS.toFixed(3)) : null },
      apice: null,                   // subTrecho != 'apice' → sem bolinha
      tracos,
      _foco: noFoco,                 // decisão 6: interno (insistência); não vai à tela como texto
    };
  }

  // ── mensagem N1/N2 (janela-1 §2) — decisão 3: SÓ âmbar/verde (nunca vermelho) ──
  function renderMensagem(op) {
    const ganhoTxt = fmtGanho(op.ganhoVoltaS);
    const acento = 'ambar'; // decisão 3: oportunidade/perda = âmbar; verde só p/ recuperação confirmada
    // SF (Vitória, pé embaixo) e subTrecho:null → NÃO fala de freio; ação = "carregue mais"
    const acao = semFreadaPorTipo(op.tipoCurva) || op.subTrecho == null ? 'carregue mais' : 'carregue mais';
    return {
      n1: { linhas: [`${nomeCurto(op.curvaNome)} · ${ganhoTxt}`], acento },       // relance (decisão 4: <=5 palavras)
      n2: { linhas: [op.curvaNome, 'você perde tempo aqui', `${acao}   ${ganhoTxt}`], acento }, // ensino (3 linhas; ação sozinha por último)
      n3: null,                                                                    // N3 (box) = Fase 2
      estado: null,
    };
  }

  // ── linha honesta do silêncio (janela-1 §2.5) — texto keyed por status.estado ──
  function linhaSilencio(estado) {
    switch (estado) {
      case 'coletando-dados': return { texto: 'Juntando dado', cor: 'neutra' };
      case 'no-teto':         return { texto: 'No seu ritmo', cor: 'verde' };
      case 'sem-referencia':  return { texto: 'Sem volta de comparação ainda', cor: 'neutra' };
      case 'stint-curto':     return { texto: 'Stint curto — sem base', cor: 'neutra' };
      default:                return { texto: 'Juntando dado', cor: 'neutra' };
    }
  }

  // ── GraficoSpec (janela-3 §1.2) ──
  function montarGrafico(op) {
    const tracos = op.tracos;
    let recorte = { espaco: 'desenho-823x799', viewBox: null, contextoIdx: null };
    if (tracos) {
      const pts = [...tracos.atual, ...tracos.referencia].map(p => geoParaDesenho(p.lat, p.lng));
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const q of pts) { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); }
      const mx = (x1 - x0) * CAL.MARGEM_ZOOM || 20, my = (y1 - y0) * CAL.MARGEM_ZOOM || 20;
      recorte.viewBox = { x: Number((x0 - mx).toFixed(1)), y: Number((y0 - my).toFixed(1)), w: Number((x1 - x0 + 2 * mx).toFixed(1)), h: Number((y1 - y0 + 2 * my).toFixed(1)) };
      // contextoIdx: fatia de PONTOS_DESENHO dentro do bbox ampliado (traço da pista de fundo)
      let de = null, ate = null;
      for (let i = 0; i < PONTOS_DESENHO.length; i++) {
        const [px, py] = PONTOS_DESENHO[i];
        if (px >= recorte.viewBox.x && px <= recorte.viewBox.x + recorte.viewBox.w &&
            py >= recorte.viewBox.y && py <= recorte.viewBox.y + recorte.viewBox.h) {
          if (de == null) de = i; ate = i;
        }
      }
      recorte.contextoIdx = { de: de ?? 0, ate: ate ?? PONTOS_DESENHO.length - 1 };
    }
    return {
      versao: 1,
      segmentId: op.segmentId,
      rotulo: op.curvaNome,
      acento: 'ambar', // decisão 3 — mesma cor da mensagem (uma fonte só)
      recorte,
      camadas: {
        pistaContexto: true,
        linhaReferencia: tracos != null,
        linhaPiloto: tracos != null,
        apice: op.subTrecho === 'apice' && op.apice != null,
        destaqueSub: op.subTrecho != null,
        fitaMetrica: null, // Fase 2 opt-in
      },
      recorrencia: op.tipo === 'tecnica-recorrente'
        ? { nCurvas: op.evidencia.ocorrencias.length, curvas: op.evidencia.ocorrencias.map(o => o.curvaNome) }
        : null,
      degradado: tracos == null ? { motivo: 'sem-tracos', mostra: 'pista-contexto + status' } : null,
    };
  }

  // ── timing (janela-1 §3.4) ──
  function montarTiming(op) {
    return { portao: 'fim-de-volta', nivel: 'N2', podeMostrar: true, duracaoMs: 3000, prioridade: 'critica-vence' };
  }

  /** Devolve o PACOTE COACH v1 (envelope 3 estados — janela-4 §2), ou null. */
  function pacote() {
    if (porCurva.size === 0 && voltasVistas.size === 0) return null; // onda não ligada (sem dado)
    const { eleito, status, flying } = eleger();
    if (!eleito) {
      const est = status.estado;
      return { versao: 1, tipo: 'silencio', status, linha: linhaSilencio(est) };
    }
    const op = montarObjeto(eleito, flying);
    return {
      versao: 1, tipo: 'oportunidade',
      id: op.id,
      oportunidade: op,
      mensagem: renderMensagem(op),
      grafico: montarGrafico(op),
      timing: montarTiming(op),
      geradoEmVoltaN: op.geradaNaVolta,
    };
  }

  return {
    onDelta, onVolta, pacote,
    _estado: () => ({ curvas: [...porCurva.values()], voltas: [...voltasVistas], voltasRodadas: [...voltasRodadas], ultimaEleitaId }),
  };
}

export default { criarCoachStint, CALIBRACAO };
