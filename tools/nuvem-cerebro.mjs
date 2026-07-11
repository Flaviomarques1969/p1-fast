// nuvem-cerebro.mjs — PROCESSADOR DA NUVEM (o "cérebro" do Command Box, hospedado).
//
// Papel (arquitetura Flávio 16/06 + 23/06): a NUVEM processa UMA vez e as telas só EXIBEM.
// Este serviço ESCUTA o fluxo ao vivo (amostras 'sample' + avisos de volta 'evento' + 'gps')
// vindo do canal de entrada, alimenta o cérebro (web/command-box/cerebro/cerebro-vivo.js) e
// PUBLICA o pacote pronto ('painel' = PainelPronto) num canal de SAÍDA separado. A TV e o
// celular assinam o canal de saída e só desenham — não recalculam nada.
//
// SEGURANÇA DE PRODUÇÃO (regra dura, igual ao nuvem-posicao.mjs):
//   - NÃO conecta em canal nenhum quando importado (só o cálculo puro é exportado).
//   - Ao ser executado direto, SÓ liga na rede se a variável CANAL estiver definida.
//   - Recusa o canal de produção 'cockpit-bubi-live' como ENTRADA a menos que
//     PERMITIR_PROD_CANAL=1 (autorização explícita) — e mesmo aí, só ESCUTA (nunca publica nele).
//   - A SAÍDA nunca é o canal de produção de entrada: por padrão é "<CANAL>-pronto"; se alguém
//     apontar a saída para 'cockpit-bubi-live', é recusado sempre (publicar lá precisa de ordem).
//   - O processamento (a parte que importa) é PURO e testável offline, sem tocar em produção.
import { fileURLToPath } from 'node:url';
import { realpathSync } from 'node:fs';
import { criarOrquestradorVivo } from '../web/command-box/cerebro/cerebro-vivo.js';
import { calcularCombustivel } from '../src/domain/fuel-calc.js';

const CANAL_PRODUCAO = 'cockpit-bubi-live';

// Config padrão do stint (linha de base real de Brasília). Na operação, o app/notebook injeta a
// config do stint da sessão via env P1FAST_CEREBRO_OPTS (JSON). Sem ela, usa esta base honesta.
// COMBUSTÍVEL (decisão Flávio 24/06): é SEMPRE conta = quanto tinha no tanque − consumo × voltas.
//   - tanqueLitros / combustivelInicialL: quanto há no tanque no início do stint (entrada da equipe;
//     padrão = tanque cheio, fixture Brasília tankMaxL=40).
//   - consumoMedioLVolta: do dado real medido por volta; sem ele, a casa devolve "parcial" (honesto).
//     Base de referência de Brasília = 0.82 L/volta (fixture fallbackConsumptionLPerLap).
//   A conta mora na casa única src/domain/fuel-calc.js (NÃO é conta nova) e usa as voltas que o
//   próprio cérebro já conta. As demais grandezas sem sensor instalado ficam INATIVAS (não falsas)
//   e são ativadas aos poucos conforme o sensor entra no carro (decisão Flávio 24/06).
const OPTS_PADRAO = { plano: { voltas: 12, duracaoS: 1680 }, pbEverSec: 91.95, stintNumero: 1, stintTotal: 1 };
const FUEL_PADRAO = { tanqueLitros: 40, combustivelInicialL: 40, consumoMedioLVolta: 0.82 };

function lerOptsDoAmbiente() {
  const raw = process.env.P1FAST_CEREBRO_OPTS;
  if (!raw) return { ...OPTS_PADRAO };
  try { return { ...OPTS_PADRAO, ...JSON.parse(raw) }; }
  catch { console.error('[cerebro] P1FAST_CEREBRO_OPTS inválido (JSON) — usando base padrão.'); return { ...OPTS_PADRAO }; }
}

// PROCESSADOR PURO: recebe o fluxo do canal e devolve o PainelPronto. Sem rede, testável offline.
// ingestSample/ingestEvento/ingestGps espelham exatamente os eventos do canal; snapshotPainel()
// devolve o pacote pronto pra tela exibir.
export function criarProcessadorCerebro(opts = {}) {
  const orq = criarOrquestradorVivo({ ...OPTS_PADRAO, ...opts });
  const fuelEnv = { ...FUEL_PADRAO, ...(opts.fuel || {}) };
  return {
    ingestSample(s) { if (s) orq.feedSample(s); },
    // 'gps' vem em evento separado; entrega ao cérebro como amostra com lat/lng pro detector de
    // chegada (a mesma porta feedSample já lê lat/lng/t). Não recalcula posição aqui — isso é o
    // nuvem-posicao.mjs; o cérebro só usa o GPS pra fechar volta quando não há injeção.
    ingestGps(g) { if (g && typeof g.lat === 'number') orq.feedSample({ lat: g.lat, lng: (typeof g.lng === 'number' ? g.lng : g.lon), t: g.tWall || g.t, fix: g.fix, hacc: g.hacc }); },
    ingestEvento(ev) { if (ev && (ev.tipo === 'volta' || ev.n != null || ev.tempoSec != null || ev.tempoMs != null)) orq.feedVolta(ev); },
    snapshotPainel() {
      const painel = orq.snapshot();
      // COMBUSTÍVEL pela casa única (conta = tanque − consumo × voltas), usando as voltas que o
      // cérebro já contou. Sem consumo informado, a casa devolve "parcial" honesto (não inventa).
      const voltasAndadas = (painel && painel.stint && painel.stint.voltaAtual) || 0;
      return { ...painel, combustivel: calcularCombustivel(fuelEnv, voltasAndadas) };
    },
  };
}

// --- LIGAÇÃO NA REDE: só roda quando executado direto E com CANAL definido (nunca no import) ---
let executadoDireto = false;
try { executadoDireto = !!process.argv[1] && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]); } catch {}
if (executadoDireto) {
  const CANAL = process.env.CANAL;
  const CANAL_SAIDA = process.env.CANAL_SAIDA || (CANAL ? CANAL + '-pronto' : null);
  const HZ = Math.max(0.5, Math.min(10, +(process.env.PAINEL_HZ || 2)));
  if (!CANAL) {
    console.log('[cerebro] cálculo pronto (modo seguro). Para HOSPEDAR/LIGAR na rede, defina:');
    console.log('[cerebro]   CANAL=<canal-de-entrada>  (de onde vem o ao vivo)');
    console.log('[cerebro]   CANAL_SAIDA=<canal-de-saida>  (onde a TV ouve; padrão "<CANAL>-pronto")');
    console.log('[cerebro] NUNCA aponte a ENTRADA para produção ("' + CANAL_PRODUCAO + '") sem PERMITIR_PROD_CANAL=1.');
    console.log('[cerebro] A SAÍDA NUNCA pode ser o canal de produção.');
    process.exit(0);
  }
  if (CANAL === CANAL_PRODUCAO && process.env.PERMITIR_PROD_CANAL !== '1') {
    console.error('[cerebro] RECUSADO: entrada "' + CANAL_PRODUCAO + '" é PRODUÇÃO. Exige PERMITIR_PROD_CANAL=1 (só ESCUTA, autorização explícita).');
    process.exit(2);
  }
  if (CANAL_SAIDA === CANAL_PRODUCAO) {
    console.error('[cerebro] RECUSADO: a SAÍDA não pode ser o canal de produção "' + CANAL_PRODUCAO + '". Publicar lá precisa de ordem explícita do Flávio.');
    process.exit(2);
  }
  const proc = criarProcessadorCerebro(lerOptsDoAmbiente());
  const { createClient } = await import('@supabase/supabase-js');
  const URL  = 'https://fvhwltzhytpnhlqbttmd.supabase.co';
  const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2aHdsdHpoeXRwbmhscWJ0dG1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MTExNDAsImV4cCI6MjA5MzM4NzE0MH0._ZpxksUnuVFhLzCB5x7bBiZ_VLQQR5cH4A1T-0-mvrA';
  const client = createClient(URL, ANON, { realtime: { params: { eventsPerSecond: 20 } } });
  const chIn  = client.channel(CANAL, { config: { broadcast: { ack: false, self: false } } });
  const chOut = (CANAL_SAIDA === CANAL) ? chIn : client.channel(CANAL_SAIDA, { config: { broadcast: { ack: false, self: false } } });
  let nIn = 0, nOut = 0;
  chIn.on('broadcast', { event: 'sample' }, (msg) => { try { proc.ingestSample(msg && msg.payload); nIn++; } catch {} });
  chIn.on('broadcast', { event: 'gps' },    (msg) => { try { proc.ingestGps(msg && msg.payload); } catch {} });
  chIn.on('broadcast', { event: 'evento' }, (msg) => { try { proc.ingestEvento(msg && msg.payload); } catch {} });
  chIn.subscribe((s) => { console.log('[cerebro] entrada', CANAL, ':', s); });
  if (chOut !== chIn) chOut.subscribe((s) => { console.log('[cerebro] saída', CANAL_SAIDA, ':', s); });
  // Publica o pacote pronto numa cadência fixa (a tela só exibe o último).
  const timer = setInterval(() => {
    try {
      const painel = proc.snapshotPainel();
      chOut.send({ type: 'broadcast', event: 'painel', payload: { ...painel, tWall: Date.now() } });
      if ((++nOut % 20) === 0) console.log(`[cerebro] ${nOut} pacotes publicados em "${CANAL_SAIDA}" · ${nIn} amostras recebidas · volta=${painel && painel.stint && painel.stint.voltaAtual}`);
    } catch (e) { /* não derruba o serviço */ }
  }, Math.round(1000 / HZ));
  process.on('SIGINT', () => { clearInterval(timer); try { chIn.unsubscribe(); chOut.unsubscribe(); } catch {} process.exit(0); });
}
