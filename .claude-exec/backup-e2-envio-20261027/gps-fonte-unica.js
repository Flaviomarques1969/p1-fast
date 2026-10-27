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

export default { pontoGpsAceito };
