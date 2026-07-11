// nuvem-gravador.mjs — GRAVADOR DA NUVEM (a nuvem GUARDA o ao vivo pra replay/análise depois).
//
// Papel (decisão Flávio 25/06, B1): no ao vivo o NOTEBOOK faz a conta e manda pronto; a NUVEM
// passa a GUARDAR o dado que passa, pra rever a volta / comparar voltas / análise depois.
// Hoje o ao vivo é só "rádio" (broadcast): quem não está conectado, perde. Este gravador ESCUTA
// o que passa no canal e GUARDA tudo numa PRATELEIRA durável, append-only, sem perda silenciosa.
//
// PRATELEIRA INTERCAMBIÁVEL (mesmo padrão do ISessionStore/FileSessionStore do .exe):
//   - PrateleiraArquivo  -> arquivo .jsonl local (teste/desenvolvimento; prova ponta a ponta AQUI).
//   - PrateleiraIngest   -> destino de PRODUÇÃO: função `ingest` -> tabela public.telemetry_samples
//                           (a MESMA prateleira que o iPhone já usa). TRAVADA: só liga com
//                           credencial + autorização explícita; recusa por padrão.
//
// SEGURANÇA DE PRODUÇÃO (regra dura, igual aos outros tools da nuvem): este arquivo NÃO conecta em
// canal nenhum quando importado; ao rodar, SÓ liga na rede se CANAL estiver definido; RECUSA o canal
// de produção `cockpit-bubi-live` sem PERMITIR_PROD_CANAL=1. A lógica que importa (agrupar/guardar
// sem perda) é PURA e testável offline.
import { realpathSync, appendFileSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CANAL_PRODUCAO = 'cockpit-bubi-live';

// Eventos do ao vivo que vale a pena guardar pra reconstruir/analisar a volta depois.
export const EVENTOS_GUARDAVEIS = ['gps', 'sample', 'posicao', 'painel', 'evento'];

// ─────────────────────────────────────────────────────────────────────────────
// LÓGICA PURA — agrupa o que chega e descarrega na prateleira em LOTE, sem perda.
// Conta amostras, numera em sequência contígua (seq) e marca o que ainda não foi gravado.
// ─────────────────────────────────────────────────────────────────────────────
export function criarGravador({ prateleira, loteMax = 500 } = {}) {
  if (!prateleira || typeof prateleira.guardar !== 'function') {
    throw new Error('criarGravador: precisa de uma prateleira com .guardar(linhas)');
  }
  let seq = 0;            // sequência contígua e crescente (detecta buraco na releitura)
  let recebidas = 0;      // total que entrou
  let gravadas = 0;       // total que já foi pra prateleira (durável)
  let pendentes = [];     // ainda não descarregadas
  let alarme = null;      // 'falha-ao-guardar' se a prateleira recusar — perda NUNCA silenciosa

  function registrar(evento, payload, tWall = 0) {
    if (!EVENTOS_GUARDAVEIS.includes(evento)) return false;
    recebidas++;
    pendentes.push({ seq: seq++, tWall, evento, payload });
    if (pendentes.length >= loteMax) descarregar();
    return true;
  }

  function descarregar() {
    if (pendentes.length === 0) return { gravadas: 0 };
    const lote = pendentes;
    pendentes = [];
    try {
      prateleira.guardar(lote);
      gravadas += lote.length;
      alarme = null;
      return { gravadas: lote.length };
    } catch (e) {
      // Não perde: devolve pra fila e acende alarme (igual ADR-003/004 do .exe).
      pendentes = lote.concat(pendentes);
      alarme = 'falha-ao-guardar';
      return { gravadas: 0, erro: String(e && e.message || e) };
    }
  }

  function estado() { return { recebidas, gravadas, pendentes: pendentes.length, alarme }; }

  return { registrar, descarregar, estado };
}

// ─────────────────────────────────────────────────────────────────────────────
// PRATELEIRA: ARQUIVO LOCAL (teste/desenvolvimento). .jsonl append-only, 1 linha por amostra.
// ─────────────────────────────────────────────────────────────────────────────
export function PrateleiraArquivo(caminho) {
  return {
    nome: 'arquivo:' + caminho,
    guardar(linhas) {
      const txt = linhas.map((l) => JSON.stringify(l)).join('\n') + '\n';
      appendFileSync(caminho, txt);
    },
  };
}

// PRATELEIRA EM MEMÓRIA (testes automáticos). Guarda numa lista.
export function PrateleiraMemoria() {
  const linhas = [];
  return { nome: 'memoria', linhas, guardar(ls) { for (const l of ls) linhas.push(l); } };
}

// RELEITURA: lê de volta o que foi guardado (pra replay/análise). Confere sequência contígua.
export function lerPrateleiraArquivo(caminho) {
  if (!existsSync(caminho)) return { linhas: [], contigua: true, total: 0 };
  const linhas = readFileSync(caminho, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  return conferirSequencia(linhas);
}
export function conferirSequencia(linhas) {
  let contigua = true;
  for (let i = 0; i < linhas.length; i++) if (linhas[i].seq !== i) { contigua = false; break; }
  return { linhas, contigua, total: linhas.length };
}

// ─────────────────────────────────────────────────────────────────────────────
// PRATELEIRA: INGEST (PRODUÇÃO) — destino real public.telemetry_samples, a MESMA que o iPhone usa.
// TRAVA DURA: só funciona com credencial + autorização explícita. Sem isso, recusa (não toca produção).
// Mapeia cada amostra guardada pro formato que a função `ingest` espera.
// ─────────────────────────────────────────────────────────────────────────────
export function PrateleiraIngest({ supabaseUrl, jwt, sessionId, permitirProducao = false, fetchImpl } = {}) {
  if (!permitirProducao) {
    throw new Error('PrateleiraIngest RECUSADA: destino de PRODUÇÃO exige permitirProducao=true (autorização explícita). Não vou tocar produção.');
  }
  if (!supabaseUrl || !jwt || !sessionId) {
    throw new Error('PrateleiraIngest: faltam credencial/sessão (supabaseUrl, jwt, sessionId).');
  }
  const doFetch = fetchImpl || globalThis.fetch;
  return {
    nome: 'ingest:' + sessionId,
    async guardarAsync(linhas) {
      const samples = linhas.map((l) => paraSampleIngest(l));
      const resp = await doFetch(`${supabaseUrl}/functions/v1/ingest`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ sessionId, samples }),
      });
      if (!resp.ok) throw new Error(`ingest HTTP ${resp.status}`);
      return resp.json();
    },
    guardar() { throw new Error('PrateleiraIngest é assíncrona: use guardarAsync.'); },
  };
}

// Converte a linha guardada (evento/payload do ao vivo) pro Sample canônico do ingest.
export function paraSampleIngest(l) {
  const p = (l && l.payload) || {};
  return {
    t: typeof p.tWall === 'number' ? p.tWall : (l.tWall || 0),
    tMono: typeof p.tMono === 'number' ? p.tMono : 0,
    source: l.evento || 'gps',
    signalQuality: p.signalQuality || 'ok',
    seq: l.seq,
    ...p,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// LIGAÇÃO NA REDE: só roda quando executado direto E com CANAL definido (nunca no import).
// ─────────────────────────────────────────────────────────────────────────────
let executadoDireto = false;
try { executadoDireto = !!process.argv[1] && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]); } catch {}
if (executadoDireto) {
  const CANAL = process.env.CANAL;
  const ARQUIVO = process.env.ARQUIVO || 'web/command-box/fixtures/gravacao-nuvem.jsonl';
  if (!CANAL) {
    console.log('[gravador] modo seguro: defina CANAL=<canal-de-dev> e ARQUIVO=<.jsonl> para guardar.');
    console.log('[gravador] NUNCA aponte para produção ("' + CANAL_PRODUCAO + '") sem autorização explícita.');
    process.exit(0);
  }
  if (CANAL === CANAL_PRODUCAO && process.env.PERMITIR_PROD_CANAL !== '1') {
    console.error('[gravador] RECUSADO: "' + CANAL_PRODUCAO + '" é PRODUÇÃO. Exige PERMITIR_PROD_CANAL=1.');
    process.exit(2);
  }
  // Zera o arquivo da sessão de gravação (começa volta limpa).
  writeFileSync(ARQUIVO, '');
  const grav = criarGravador({ prateleira: PrateleiraArquivo(ARQUIVO), loteMax: 200 });
  const { createClient } = await import('@supabase/supabase-js');
  const URL  = 'https://fvhwltzhytpnhlqbttmd.supabase.co';
  const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2aHdsdHpoeXRwbmhscWJ0dG1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MTExNDAsImV4cCI6MjA5MzM4NzE0MH0._ZpxksUnuVFhLzCB5x7bBiZ_VLQQR5cH4A1T-0-mvrA';
  const client = createClient(URL, ANON, { realtime: { params: { eventsPerSecond: 20 } } });
  const ch = client.channel(CANAL, { config: { broadcast: { ack: false, self: false } } });
  for (const ev of EVENTOS_GUARDAVEIS) {
    ch.on('broadcast', { event: ev }, (msg) => {
      grav.registrar(ev, msg && msg.payload, (msg && msg.payload && msg.payload.tWall) || Date.now());
    });
  }
  const tick = setInterval(() => {
    grav.descarregar();
    const e = grav.estado();
    console.log(`[gravador] recebidas=${e.recebidas} guardadas=${e.gravadas} pendentes=${e.pendentes}${e.alarme ? ' ALARME=' + e.alarme : ''}`);
  }, 2000);
  ch.subscribe((s) => { console.log('[gravador] canal', CANAL, ':', s, '→ guardando em', ARQUIVO); });
  process.on('SIGINT', () => { clearInterval(tick); grav.descarregar(); const e = grav.estado();
    console.log(`[gravador] encerrado. guardadas=${e.gravadas} pendentes=${e.pendentes}`); try { ch.unsubscribe(); } catch {} process.exit(0); });
}
