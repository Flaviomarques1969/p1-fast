// ============================================================================
// CÉREBRO DO SINAL DA TV — E1 da obra "TV do box ao vivo" (Flávio 27/10/2026:
// "esta tela não está funcionando corretamente").
//
// Casa ÚNICA da pergunta "o que a TV está mostrando é AO VIVO?" (docs/CONTRATO_DADOS.md §2).
// Módulo PURO: ponto de GPS do canal entra (chegou), estado do selo sai (estado). Não fala
// com Supabase, não toca DOM — a TV só desenha o estado.
//
// Regras (auditoria 27/10, achados T2/T5/T9):
//  - ponto BOM = posição de verdade (lat/lng, lat ≠ 0) e, quando o RaceBox manda o fix, fix ≥ 3;
//  - ORDEM: só é "mais novo" o ponto bom com tWall maior que o último bom — ponto velho (fila do
//    notebook despejada fora de ordem) nunca volta o HUD nem o carro no mapa;
//  - IDADE pelo carimbo do RaceBox (tWall), não pela chegada: os relógios do notebook e da TV podem
//    divergir, então o atraso é (chegada − tWall) − o MENOR (chegada − tWall) visto nos últimos
//    10 min (o ponto mais rápido da janela vale como "atraso zero"). Limite honesto: se a TV abrir
//    no meio de uma fila e todos os pontos chegarem atrasados, o atraso aparece menor do que é;
//  - AO VIVO = ponto bom chegou há ≤ 3 s e tem ≤ 3 s de atraso; ATRASADO X s = chegou agora mas é
//    velho (fila/rajada); GPS SEM POSIÇÃO = chegam pacotes, mas sem fix bom; SEM SINAL HÁ X s =
//    nada chega há mais de 3 s; AGUARDANDO O CARRO = ponte no ar e nenhum ponto ainda;
//    SEM CONEXÃO COM A NUVEM = a ponte caiu ou nem carregou.
// ============================================================================

export const AO_VIVO_MS = 3000;
export const JANELA_RELOGIO_MS = 10 * 60 * 1000;

export function pontoBom(p) {
  if (!p || typeof p.lat !== 'number' || typeof p.lng !== 'number' || !isFinite(p.lat) || !isFinite(p.lng)) return false;
  if (p.lat === 0) return false;
  if (p.fix != null && !(p.fix >= 3)) return false;
  return true;
}

function haQuanto(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return s + ' s';
  const m = Math.floor(s / 60);
  return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + (m % 60) + ' min';
}

export function criarSinalTv({ aoVivoMs = AO_VIVO_MS, janelaRelogioMs = JANELA_RELOGIO_MS } = {}) {
  // menor (chegada − tWall) da janela: fila monótona (chegada crescente, dif crescente) → O(1) por ponto
  const fila = [];
  let conexao = 'off';
  let chegadaQualquer = null, satsQualquer = null;
  let bom = null;   // { p, chegada, atrasoMs }
  let velho = null; // último ponto bom que chegou FORA DE ORDEM (mais velho que o exibido): { chegada, atrasoMs }

  function offset(chegada) {
    while (fila.length && fila[0].chegada < chegada - janelaRelogioMs) fila.shift();
    return fila.length ? fila[0].dif : null;
  }

  return {
    /** Ponto do canal chegou na TV em `agora` (ms, relógio da TV). Devolve { bom, maisNovo }. */
    chegou(p, agora) {
      if (!p) return { bom: false, maisNovo: false };
      chegadaQualquer = agora;
      if (typeof p.numSV === 'number') satsQualquer = p.numSV;
      if (!pontoBom(p)) return { bom: false, maisNovo: false };
      const tw = typeof p.tWall === 'number' && isFinite(p.tWall) ? p.tWall : null;
      let atrasoMs = 0;
      if (tw != null) {
        const dif = agora - tw;
        while (fila.length && fila[fila.length - 1].dif >= dif) fila.pop();
        fila.push({ chegada: agora, dif });
        atrasoMs = Math.max(0, dif - offset(agora));
      }
      const twBom = bom ? (typeof bom.p.tWall === 'number' ? bom.p.tWall : null) : null;
      const maisNovo = !bom || tw == null || twBom == null || tw > twBom;
      if (maisNovo) bom = { p, chegada: agora, atrasoMs };
      else velho = { chegada: agora, atrasoMs };
      return { bom: true, maisNovo };
    },
    /** Estado da ponte: 'off' | 'connecting' | 'online' | 'error' | 'sem-ponte' (o módulo nem carregou). */
    conexao(s) { if (typeof s === 'string') conexao = s; },
    ultimoBom() { return bom ? bom.p : null; },
    estado(agora) {
      const desdeBom = bom ? agora - bom.chegada : null;
      const desdeQualquer = chegadaQualquer != null ? agora - chegadaQualquer : null;
      const sats = bom && typeof bom.p.numSV === 'number' ? bom.p.numSV : satsQualquer;
      const r = (codigo, texto, classe, extra) => Object.assign({ codigo, texto, classe, temDado: false, sats: null,
        atrasoS: null, semSinalS: desdeQualquer != null ? Math.round(desdeQualquer / 1000) : null }, extra || {});
      if (conexao === 'sem-ponte' || conexao === 'error') {
        return r('sem-conexao', 'SEM CONEXÃO COM A NUVEM' + (desdeBom != null ? ' · último dado há ' + haQuanto(desdeBom) : ''), 'cb-err');
      }
      if (desdeQualquer == null) {
        return conexao === 'online' ? r('aguardando', 'AGUARDANDO O CARRO', 'cb-wait') : r('conectando', 'CONECTANDO À NUVEM…', 'cb-wait');
      }
      if (desdeBom != null && desdeBom <= aoVivoMs) {
        if (bom.atrasoMs <= aoVivoMs) return r('ao-vivo', 'AO VIVO', 'cb-on', { temDado: true, sats, atrasoS: 0 });
        const s = Math.round(bom.atrasoMs / 1000);
        return r('atrasado', 'ATRASADO ' + haQuanto(bom.atrasoMs), 'cb-wait', { temDado: true, sats, atrasoS: s });
      }
      if (velho && agora - velho.chegada <= aoVivoMs && desdeQualquer <= aoVivoMs) {
        // só chega dado mais velho do que o já mostrado (fila do notebook): a TV segura o último e avisa
        return r('atrasado', 'ATRASADO ' + haQuanto(velho.atrasoMs) + ' · fila do notebook', 'cb-wait',
          { sats, atrasoS: Math.round(velho.atrasoMs / 1000) });
      }
      if (desdeQualquer <= aoVivoMs) {
        return r('sem-posicao', 'GPS SEM POSIÇÃO' + (satsQualquer != null ? ' · ' + satsQualquer + ' satélites' : ''), 'cb-wait');
      }
      return r('sem-sinal', 'SEM SINAL HÁ ' + haQuanto(desdeQualquer), 'cb-err');
    },
  };
}

export default { criarSinalTv, pontoBom, AO_VIVO_MS, JANELA_RELOGIO_MS };
