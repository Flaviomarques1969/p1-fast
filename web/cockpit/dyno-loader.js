// dyno-loader.js — carrega a curva do dinamômetro de um carro da nuvem
// e calcula o ponto de pico de torque. Usado pelo painel pra acionar o
// shift light baseado em torque (não só RPM).
//
// Curva mora em public.dyno_curve no Supabase do P1 Fast. Inserida pela
// primeira vez em 2026-05-26 com 79 pontos do Celta Bubi (Lenza 2026-05-18).
// Detalhes em docs/research/bubi-dyno-2026-05-18/.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SUPABASE_URL  = 'https://fvhwltzhytpnhlqbttmd.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2aHdsdHpoeXRwbmhscWJ0dG1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MTExNDAsImV4cCI6MjA5MzM4NzE0MH0._ZpxksUnuVFhLzCB5x7bBiZ_VLQQR5cH4A1T-0-mvrA';

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
    };
  } catch (e) {
    console.warn('[dyno] falha geral:', e.message);
    return null;
  }
}
