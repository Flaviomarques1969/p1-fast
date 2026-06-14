// dyno-loader.js — carrega a curva do dinamômetro de um carro da nuvem
// e calcula o ponto de pico de torque. Usado pelo painel pra acionar o
// shift light baseado em torque (não só RPM).
//
// Curva mora em public.dyno_curve no Supabase do P1 Fast. Inserida pela
// primeira vez em 2026-05-26 com 79 pontos do Celta Bubi (Lenza 2026-05-18).
// Detalhes em docs/research/bubi-dyno-2026-05-18/.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

const SUPABASE_ANON = SUPABASE_ANON_KEY;

// Carro Bolinha (Bubi) — hardcoded no MVP. Futuro: vem do usuário logado.
export const BUBI_CARRO_ID = '641A81E7-3192-4E68-8183-B8401F105574';

let _client = null;
function client() {
  if (!_client) _client = createClient(SUPABASE_URL, SUPABASE_ANON);
  return _client;
}

/**
 * Carrega a curva do dinamômetro de um carro e calcula o pico de torque.
 * Retorna {
 *   peakTorqueRpm,  // RPM onde o torque é máximo
 *   peakTorqueNm,   // valor do torque no pico
 *   redlineRpm,     // do registro do carro
 *   pointsCount,    // quantos pontos
 * } ou null se algo falhar.
 *
 * NÃO joga exceção — chamador trata null como "fonte de verdade indisponível,
 * cai pro padrão fixo no código".
 */
export async function loadDynoCurve(carroId) {
  try {
    const sb = client();
    // 1. busca curva
    const { data: curva, error: e1 } = await sb
      .from('dyno_curve')
      .select('rpm, torque_nm, potencia_cv')
      .eq('carro_id', carroId)
      .order('rpm', { ascending: true });
    if (e1) { console.warn('[dyno] erro curva:', e1.message); return null; }
    if (!curva || curva.length === 0) { console.warn('[dyno] sem pontos pra carro', carroId); return null; }

    // 2. busca redline do carro
    const { data: carro, error: e2 } = await sb
      .from('carros')
      .select('redline_rpm, apelido')
      .eq('id', carroId)
      .single();
    if (e2) { console.warn('[dyno] erro carro:', e2.message); return null; }
    const redlineRpm = carro?.redline_rpm ?? null;

    // 3. acha o ponto de torque máximo
    let pico = curva[0];
    for (const p of curva) {
      if (Number(p.torque_nm) > Number(pico.torque_nm)) pico = p;
    }

    return {
      peakTorqueRpm: pico.rpm,
      peakTorqueNm: Number(pico.torque_nm),
      redlineRpm,
      pointsCount: curva.length,
      apelido: carro?.apelido,
      // Pontos brutos da curva (rpm crescente). Necessário pro orquestrador
      // shift light v2 calcular o cruzamento de força integrada por marcha.
      pontos: curva.map(p => ({
        rpm: Number(p.rpm),
        torque_nm: Number(p.torque_nm),
        potencia_cv: Number(p.potencia_cv),
      })),
    };
  } catch (e) {
    console.warn('[dyno] falha geral:', e.message);
    return null;
  }
}

/**
 * Carrega as relações de marcha do carro (1ª a Nª + diferencial).
 * Retorna lista crescente por número de marcha, ou [] se nada cadastrado.
 */
export async function loadGearRatios(carroId) {
  try {
    const sb = client();
    const { data, error } = await sb
      .from('gear_ratios')
      .select('marcha, ratio, final_drive')
      .eq('carro_id', carroId)
      .order('marcha', { ascending: true });
    if (error) { console.warn('[gear_ratios] erro:', error.message); return []; }
    if (!data || data.length === 0) return [];
    return data.map(r => ({
      marcha: Number(r.marcha),
      ratio: Number(r.ratio),
      finalDrive: Number(r.final_drive),
    }));
  } catch (e) {
    console.warn('[gear_ratios] falha:', e.message);
    return [];
  }
}
