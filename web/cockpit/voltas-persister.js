// voltas-persister.js — grava as voltas REAIS detectadas pelo painel na nuvem.
//
// Autorização Flávio 10/06/2026 ("eu já te disse que quero"): vida útil das
// peças conta voltas e quilômetros DE VERDADE. Hoje a tabela `voltas` só
// recebia voltas provisórias do app; a detecção real (linha de chegada) vivia
// só na tela e morria com a sessão.
//
// Regras:
//   - A volta entra na SESSÃO ABERTA do carro (criada pelo app no plano do
//     stint). Sem sessão aberta → não grava (log honesto), nada de inventar.
//   - Teste de escritório (replay) NUNCA grava — par da blindagem
//     __P1_ORIGEM_SIM__ (detalhe interno; decisão 10/06).
//   - Banco pode recusar por permissão (postura em decisão no card
//     20260610-191605) → devolve false e o chamador loga honesto.

const SUPABASE_URL  = 'https://fvhwltzhytpnhlqbttmd.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2aHdsdHpoeXRwbmhscWJ0dG1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MTExNDAsImV4cCI6MjA5MzM4NzE0MH0._ZpxksUnuVFhLzCB5x7bBiZ_VLQQR5cH4A1T-0-mvrA';

let _client = null;
async function client() {
  if (!_client) {
    // carregamento preguiçoso (igual box/chegada-detector): permite importar o
    // módulo em teste sem rede — as guardas devolvem antes de chegar aqui.
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.45.0');
    _client = createClient(SUPABASE_URL, SUPABASE_ANON);
  }
  return _client;
}

/**
 * Sessão ABERTA mais recente do carro (data_fim ainda vazia).
 * Devolve { id, time_id } ou null.
 */
export async function acharSessaoAberta(carroId) {
  if (!carroId) return null;
  try {
    const sb = await client();
    const { data, error } = await sb
      .from('sessoes')
      .select('id, time_id, data_inicio')
      .eq('carro_id', carroId)
      .is('data_fim', null)
      .order('data_inicio', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.warn('[voltas-persister] busca de sessão falhou:', error.message);
      return null;
    }
    return data || null;
  } catch (e) {
    console.warn('[voltas-persister] falha geral na busca:', e.message);
    return null;
  }
}

/**
 * Grava uma volta real. Devolve true/false (false = banco recusou ou sem dados).
 * O chamador decide o log — aqui não se finge sucesso.
 */
export async function gravarVoltaReal({ sessao, numero, tempoMs, inicioAt }) {
  if (!sessao || !sessao.id || !sessao.time_id || !Number.isFinite(numero)) return false;
  try {
    const sb = await client();
    const { error } = await sb
      .from('voltas')
      .insert({
        time_id:   sessao.time_id,
        sessao_id: sessao.id,
        numero,
        tempo_ms:  Number.isFinite(tempoMs) ? Math.round(tempoMs) : null,
        inicio_at: inicioAt ? new Date(inicioAt).toISOString() : null,
      });
    if (error) {
      console.warn('[voltas-persister] banco recusou a volta:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('[voltas-persister] falha geral ao gravar:', e.message);
    return false;
  }
}

/**
 * Acumulador de uso do persister — pro painel reportar no fim do stint.
 */
export function criarContadorPersistencia() {
  return { gravadas: 0, recusadas: 0, semSessao: 0 };
}
