// ============================================================================
// TRECHOS DA VOLTA — a volta dividida pela METODOLOGIA P1 (Flávio, painel p1fast-gps-setores-1228, 27/10/2026:
// "na nossa metodologia a gente controla os trechos por todo lugar da pista que normalmente você freia, se é uma
// curva longa [...] flat com o pé embaixo, não é um trecho, aí é uma reta"; docs/CONCEITOS_TRECHO_PRODUTO.md:
// "Trecho é sempre um local onde o piloto precisa pisar no freio").
//
// Casa ÚNICA deste corte (docs/CONTRATO_DADOS.md §2). Módulo PURO: cadastro de trechos da pista (linha de entrada,
// ápice, linha de saída — formato do BARRAS aprovado, o mesmo que o cockpit do carro lê) entra; sai a volta inteira
// em intervalos da fração do traçado contada da chegada: cada curva de freada (entrada → saída) e a reta entre elas.
//  - curva de tipo SF (pé embaixo, tipos-curva-brasilia.js) NÃO é trecho: fica dentro da reta, citada pelo nome;
//  - a ordem é a da VOLTA (posição no traçado), não o campo "ordem" do cadastro;
//  - cadastro que não fecha (linha fora do traçado, saída antes da entrada, curva sobre a chegada ou sobre outra
//    curva) = SEM trechos e o motivo em "erro" — nunca um corte pela metade.
// ============================================================================

/** Tipo da curva que NÃO é trecho (sem freada, pé embaixo). */
export const TIPO_PE_EMBAIXO = 'SF';

function meio(l) { return { lat: (l.a.lat + l.b.lat) / 2, lng: (l.a.lng + l.b.lng) / 2 }; }
function r1(v) { return Math.round(v * 10) / 10; }
function r5(v) { return Math.round(v * 1e5) / 1e5; }

/**
 * @param {object[]|null} cadastro  trechos {nome, entrada_line_gps, apice_gps, saida_line_gps}
 * @param {object} o
 * @param {(lat:number,lng:number)=>{x:number,y:number,p:number}|null} o.ondeNaVolta  p = fração da volta desde a chegada
 * @param {Object<string,string>} [o.tipoPorCurva]  nome → tipo (T0…T5/SF/ND)
 * @returns {{lista: object[], erro: string|null}}  lista vazia = pista sem trechos (quem usa cai no corte antigo)
 */
export function montarTrechosDaVolta(cadastro, o) {
  if (!Array.isArray(cadastro) || !cadastro.length) return { lista: [], erro: null };
  const tipoPorCurva = (o && o.tipoPorCurva) || {};
  const curvas = [], peEmbaixo = [];
  for (const c of cadastro) {
    const e = o.ondeNaVolta(meio(c.entrada_line_gps).lat, meio(c.entrada_line_gps).lng);
    const s = o.ondeNaVolta(meio(c.saida_line_gps).lat, meio(c.saida_line_gps).lng);
    const a = o.ondeNaVolta(c.apice_gps.lat, c.apice_gps.lng);
    if (!e || !s || !a) return { lista: [], erro: `${c.nome}: linha fora do traçado` };
    if (!(s.p > e.p)) return { lista: [], erro: `${c.nome}: saída não vem depois da entrada (ou a curva passa pela chegada)` };
    const tipo = tipoPorCurva[c.nome] || null;
    const item = { nome: c.nome, tipoCurva: tipo, de: e.p, ate: s.p, apiceP: a.p,
      entrada: { x: r1(e.x), y: r1(e.y) }, apice: { x: r1(a.x), y: r1(a.y) }, saida: { x: r1(s.x), y: r1(s.y) } };
    (tipo === TIPO_PE_EMBAIXO ? peEmbaixo : curvas).push(item);
  }
  curvas.sort((x, y) => x.de - y.de);
  for (let i = 1; i < curvas.length; i++) {
    if (curvas[i].de < curvas[i - 1].ate) return { lista: [], erro: `${curvas[i - 1].nome} e ${curvas[i].nome} se sobrepõem` };
  }
  const lista = [];
  let cursor = 0;
  const reta = (de, ate, para) => {
    const dentro = peEmbaixo.filter(c => c.apiceP >= de && c.apiceP < ate).map(c => c.nome);
    lista.push({ tipo: 'reta', nome: 'Reta → ' + para, tipoCurva: null, de, ate, peEmbaixo: dentro });
  };
  for (const c of curvas) {
    if (c.de > cursor) reta(cursor, c.de, c.nome);
    lista.push({ tipo: 'curva', nome: c.nome, tipoCurva: c.tipoCurva, de: c.de, ate: c.ate,
      entrada: c.entrada, apice: c.apice, saida: c.saida });
    cursor = c.ate;
  }
  if (cursor < 1) reta(cursor, 1, 'chegada');
  return { lista: lista.map((t, i) => ({ i: i + 1, ...t, de: r5(t.de), ate: r5(t.ate) })), erro: null };
}

export default { montarTrechosDaVolta, TIPO_PE_EMBAIXO };
