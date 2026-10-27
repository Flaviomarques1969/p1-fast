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

export default { pontoGpsAceito, pontosDoGps };
