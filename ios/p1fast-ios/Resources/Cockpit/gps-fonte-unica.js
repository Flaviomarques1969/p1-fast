// gps-fonte-unica.js — quem pode alimentar a POSIÇÃO do carro no canal ao vivo.
//
// Decisão do Flávio 27/10/2026 (painel p1fast-gps-fonte-unica-0911 = C): só o RaceBox
// (publicado pelo Cockpit do notebook, source 'racebox') vale como posição. O iPhone
// parou de publicar; ponto com source 'iphone…' que ainda chegar (app antigo instalado)
// é descartado aqui, sem reserva. Ponto sem source (RaceBox de Cockpit antigo, replay,
// simulador de bancada) continua passando.
//
// Peça pura (sem rede): usada pela ponte cloud-bridge.js e pelo processador
// tools/nuvem-posicao.mjs — a MESMA regra nos dois lugares.

export function pontoGpsAceito(p) {
  if (!p || typeof p !== 'object') return false;
  const src = typeof p.source === 'string' ? p.source.trim().toLowerCase() : '';
  return !src.startsWith('iphone');
}

// LOTE (E2 da obra "TV do box ao vivo", 27/10/2026): o Cockpit do notebook manda 1 mensagem
// 'gps' a cada ~200 ms em vez de 25 por segundo. O TOPO do payload continua sendo o fix mais
// novo, com as mesmas chaves (consumidor antigo vê o ponto mais novo a 5 Hz e não quebra);
// a chave aditiva `lote` traz os fixes ANTERIORES do intervalo, em ordem de tempo.
// Esta peça desmonta a mensagem em pontos soltos, do mais velho ao mais novo (o do topo por
// último, sem a chave `lote`), já passando cada um pela regra da fonte única. Mensagem sem
// `lote` (Cockpit antigo, simulador, replay) = um ponto só, como sempre foi.
export function pontosDoGps(payload) {
  if (!payload || typeof payload !== 'object') return [];
  const out = [];
  if (Array.isArray(payload.lote)) {
    for (const p of payload.lote) if (pontoGpsAceito(p)) out.push(p);
  }
  let topo = payload;
  if ('lote' in payload) { topo = { ...payload }; delete topo.lote; }
  if (pontoGpsAceito(topo)) out.push(topo);
  return out;
}

// REPETIDOS (E2, 27/10): quando o canal cai, o Cockpit devolve à fila os fixes dos últimos 10 s
// (podem ter ido para um socket já morto) e os reenvia na religação. Os que a TV já tinha recebido
// chegam de novo: este filtro descarta o ponto com tWall menor ou igual ao último já entregue da
// MESMA fonte. Ponto muito mais velho (> 15 s antes do último) passa: é relógio do notebook
// corrigido ou Cockpit reiniciado, não reenvio — melhor mostrar do que travar a TV.
export const REPETIDO_JANELA_MS = 15000;
export function criarFiltroRepetidos({ janelaMs = REPETIDO_JANELA_MS } = {}) {
  const ultimo = new Map();
  return function novo(p) {
    const tw = p && typeof p.tWall === 'number' && isFinite(p.tWall) ? p.tWall : null;
    if (tw == null) return true;
    const chave = String(p.source || p.fonte || '');
    const u = ultimo.get(chave);
    if (u != null && tw <= u && u - tw <= janelaMs) return false;
    ultimo.set(chave, tw);
    return true;
  };
}

export default { pontoGpsAceito, pontosDoGps, criarFiltroRepetidos };
