// vmin-aprendizado.js — APRENDIZADO do Vmin de referência por trecho.
//
// Regra (Flávio): a referência de Vmin de um trecho é o Vmin da MELHOR passagem
// daquele trecho, DAQUELE carro, NAQUELA configuração de pneu. "Vai aprendendo":
// cada passagem nova só vira referência se for melhor (menor tempo de trecho) que
// a atual. As configurações são bases SEPARADAS — Celta 1.4 com pneu radial e
// Celta 1.4 com pneu semi-slick acumulam históricos distintos.
//
// Espelha a tabela canônica `melhores_passagens_trecho` (carro + track + tipo_pneu
// + segment, ranking por tempo_trecho_s) — decisão Flávio 27/05/2026, doc
// project_p1fast_logica_central_comparacao_por_trecho. Aqui é a versão pura/em
// memória: alimenta o painel com o dado gravado e, ao vivo, vai atualizando
// passagem a passagem. Quando houver banco, esta lógica e a do melhores-loader
// devolvem a mesma referência.
//
// HONESTIDADE (igual ao resto do bloco a ~1 Hz): um Vmin só é CONFIÁVEL se o ponto
// mais lento da passagem é um VALE de verdade — mais baixo que a entrada E que a
// saída (a freada foi capturada DENTRO do recorte). Se a mínima cair na borda
// (ainda freando no fim do trecho), a freada continua fora do recorte do GPS de
// 1 Hz (a 100 km/h cada leitura é ~28 m) e o número não vale — entra de verdade
// com 25 Hz (RaceBox).
//
// Função pura: não acessa rede nem DOM. Roda em Node e no navegador igual.

import { normalizarTipoPneu } from '../cockpit/tipo-pneu-normalizer.js';

function chave(carro, tipoPneu, curva) {
  return String(carro) + '|' + normalizarTipoPneu(tipoPneu) + '|' + String(curva);
}

// Vmin de uma passagem: velocidade mínima medida (km/h), onde caiu e se é confiável.
export function vminDaPassagem(pontos) {
  if (!Array.isArray(pontos) || pontos.length < 2) return null;
  let mi = 0;
  for (let i = 1; i < pontos.length; i++) if (pontos[i].kmh < pontos[mi].kmh) mi = i;
  const vmin = pontos[mi].kmh;
  const entrada = pontos[0].kmh;
  // interior + abaixo da entrada = a freada/valley foi capturada no recorte
  const confiavel = mi > 0 && mi < pontos.length - 1 && vmin < entrada;
  return { vminKmh: Math.round(vmin), idx: mi, entradaKmh: Math.round(entrada), confiavel };
}

/**
 * Cria um acumulador de aprendizado. Mantém, por (carro, tipo_pneu, curva), a
 * referência = Vmin da melhor passagem (menor tempo de trecho).
 */
export function criarAprendizadoVmin() {
  const melhores = new Map(); // chave -> { tempoS, vminKmh, confiavel, idx, entradaKmh, volta, dia, carro, tipoPneu, curva }

  // Observa UMA passagem. Vira referência só se for melhor (menor tempo).
  // Aceita os campos da massa real (tipo_pneu, tempo_trecho_s, curva, pontos, ...).
  function observar(p) {
    if (!p) return api;
    const carro = p.carro || 'Bolinha';
    const tipoPneu = p.tipo_pneu || p.tipoPneu;
    const curva = p.curva;
    const tempoS = typeof p.tempo_trecho_s === 'number' ? p.tempo_trecho_s
                 : (typeof p.tempoS === 'number' ? p.tempoS : null);
    const v = vminDaPassagem(p.pontos);
    if (tempoS == null || !v || curva == null || tipoPneu == null) return api;
    const k = chave(carro, tipoPneu, curva);
    const atual = melhores.get(k);
    if (!atual || tempoS < atual.tempoS) {
      melhores.set(k, {
        tempoS, vminKmh: v.vminKmh, confiavel: v.confiavel, idx: v.idx, entradaKmh: v.entradaKmh,
        volta: p.volta ?? null, dia: p.dia ?? null,
        carro, tipoPneu: normalizarTipoPneu(tipoPneu), curva,
      });
    }
    return api;
  }

  // Aprende de uma massa inteira (array de passagens). carro opcional sobrepõe.
  function aprenderDeMassa(passagens, carro) {
    (passagens || []).forEach((p) => observar(carro ? { ...p, carro } : p));
    return api;
  }

  // Referência aprendida pra (carro, pneu, curva). null quando ainda não há dado
  // nessa configuração (ex.: semi-slick antes de rodar com ele) → painel mostra "—".
  function referencia(carro, tipoPneu, curva) {
    return melhores.get(chave(carro, tipoPneu, curva)) || null;
  }

  // Configurações de pneu que já têm pelo menos uma passagem aprendida.
  function configuracoes() {
    const set = new Set();
    for (const m of melhores.values()) set.add(m.tipoPneu);
    return [...set];
  }

  const api = { observar, aprenderDeMassa, referencia, configuracoes, _melhores: melhores };
  return api;
}

export const _internos = { chave, vminDaPassagem };
