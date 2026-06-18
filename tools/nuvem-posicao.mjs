// nuvem-posicao.mjs — PROCESSADOR DA NUVEM (posição do carro na pista).
// Papel (arquitetura Flávio 16/06): a NUVEM centraliza o cálculo pras telas (Command Box + app
// do celular). Converte GPS CRU (lat/lng, como o notebook/iPhone publicam) -> posição na pista do
// Command Box (geoParaCommandBox) -> FRAÇÃO DE ARCO (fracDe). As telas só EXIBEM o que sai daqui.
//
// SEGURANÇA DE PRODUÇÃO (regra dura): este arquivo NÃO conecta em canal nenhum quando importado,
// e ao ser executado SÓ liga na rede se a variável CANAL for definida. Recusa o canal de produção
// `cockpit-bubi-live` a menos que PERMITIR_PROD_CANAL=1 (autorização explícita). O cálculo (a parte
// que importa) é PURO e testável offline, sem tocar em produção.
import { fileURLToPath } from 'node:url';
import { realpathSync } from 'node:fs';
import { geoParaCommandBox } from '../web/cockpit/pista-brasilia-commandbox.js';
import { fracDe } from '../web/command-box/pista-cb-polyline.js';

const CANAL_PRODUCAO = 'cockpit-bubi-live';

export function emFaixaBrasilia(lat, lng) { return lat < -15.7 && lat > -15.8 && lng < -47.8 && lng > -48.0; }

// CÁLCULO PURO: GPS cru -> posição pronta (ou null se inválido/fora da pista). Sem rede.
export function calcularPosicao(g) {
  if (!g || typeof g.lat !== 'number' || typeof g.lng !== 'number') return null;
  if (!emFaixaBrasilia(g.lat, g.lng)) return null;
  const p = geoParaCommandBox(g.lat, g.lng);
  const frac = fracDe(p.x, p.y);
  return { frac: +frac.toFixed(5), x: +p.x.toFixed(1), y: +p.y.toFixed(1), fonte: g.fonte || 'gps' };
}

// --- LIGAÇÃO NA REDE: só roda quando executado direto E com CANAL definido (nunca no import) ---
let executadoDireto = false;
try { executadoDireto = !!process.argv[1] && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]); } catch {}
if (executadoDireto) {
  const CANAL = process.env.CANAL;
  if (!CANAL) {
    console.log('[nuvem] cálculo pronto (modo seguro). Para LIGAR na rede, defina CANAL=<nome-do-canal>.');
    console.log('[nuvem] NUNCA aponte para produção ("' + CANAL_PRODUCAO + '") sem autorização explícita.');
    process.exit(0);
  }
  if (CANAL === CANAL_PRODUCAO && process.env.PERMITIR_PROD_CANAL !== '1') {
    console.error('[nuvem] RECUSADO: "' + CANAL_PRODUCAO + '" é PRODUÇÃO. Exige PERMITIR_PROD_CANAL=1 (autorização explícita).');
    process.exit(2);
  }
  const { createClient } = await import('@supabase/supabase-js');
  const URL  = 'https://fvhwltzhytpnhlqbttmd.supabase.co';
  const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2aHdsdHpoeXRwbmhscWJ0dG1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MTExNDAsImV4cCI6MjA5MzM4NzE0MH0._ZpxksUnuVFhLzCB5x7bBiZ_VLQQR5cH4A1T-0-mvrA';
  const client = createClient(URL, ANON, { realtime: { params: { eventsPerSecond: 20 } } });
  const ch = client.channel(CANAL, { config: { broadcast: { ack: false, self: false } } });
  let n = 0;
  ch.on('broadcast', { event: 'gps' }, (msg) => {
    try { const pos = calcularPosicao(msg && msg.payload); if (!pos) return;
      ch.send({ type: 'broadcast', event: 'posicao', payload: { ...pos, tWall: Date.now() } });
      if ((++n % 25) === 0) console.log(`[nuvem] ${n} posições · frac=${pos.frac}`);
    } catch (e) { /* não derruba o canal */ }
  });
  ch.subscribe((s) => { console.log('[nuvem] canal', CANAL, ':', s); });
  process.on('SIGINT', () => { try { ch.unsubscribe(); } catch {} process.exit(0); });
}
