// ============================================================================
// DESTRAVAR OS DADOS DE HOJE — detecta VOLTAS pelo GPS na sessão de 21/06.
//
// Por que: a injeção entregou o cronômetro de volta ZERADO hoje, então o painel
// ficou em "aguardando" (0 voltas). Mas o GPS está cheio. Este script roda o
// GPS de hoje no MESMO detector de linha de chegada que o cockpit ao vivo usa
// (web/cockpit/chegada-detector.js) + a MESMA linha de chegada oficial de
// Brasília (lida da nuvem, tabela marcos), calcula o tempo de cada volta pelo
// intervalo entre cruzamentos, e alimenta o cérebro REAL do painel.
//
// Não toca rede, nuvem, nem o canal ao vivo. Só lê o arquivo da sessão.
//   Rodar: node .claude-exec/destravar-voltas-gps-hoje.mjs
// ============================================================================
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(here, '..');
const C = resolve(raiz, 'web/command-box/cerebro');

const { ChegadaDetector } = await import(resolve(raiz, 'web/cockpit/chegada-detector.js'));
const { criarOrquestradorVivo } = await import(resolve(C, 'cerebro-vivo.js'));
const { fmtTempo, fmtRelogio } = await import(resolve(C, 'cerebro-painel.js'));
const { avaliarPreditivo } = await import(resolve(C, 'cerebro-preditivo.js'));

const L = (...x) => console.log(...x);
const linha = () => L('-'.repeat(74));

// --- Linha de chegada OFICIAL de Brasília (lida da nuvem, tabela marcos, ----
//     layout "Principal", tipo=chegada — a MESMA do cockpit ao vivo) ---------
const MARCO_CHEGADA = {
  a_gps: { lat: -15.7728816, lng: -47.9000707 },
  b_gps: { lat: -15.7725493, lng: -47.9001926 },
  barra_largura_m: 30,
};

// --- Sessão real de hoje ----------------------------------------------------
const ARQ = resolve(raiz, '.claude-exec/dados-pista/sessao-2026-06-21-1140-brasilia-COMPLETA.json');
const sess = JSON.parse(readFileSync(ARQ, 'utf8'));
const am = sess.amostras;
const gps = am.filter(a => a.tipo === 'gps');
const t4 = am.filter(a => a.tipo === 't4000');

// mesmo filtro de GPS válido usado no teste de hoje (fix 3, janela Brasília, hacc<50)
const BR = { latMin: -16.1, latMax: -15.4, lonMin: -48.3, lonMax: -47.6 };
function gpsValido(d) {
  return d && d.fix === 3 && Number.isFinite(d.lat) && Number.isFinite(d.lon)
    && d.lat >= BR.latMin && d.lat <= BR.latMax
    && d.lon >= BR.lonMin && d.lon <= BR.lonMax
    && Number.isFinite(d.hacc) && d.hacc < 50;
}
const gpsBons = gps.filter(g => gpsValido(g.dados))
  .sort((a, b) => a.tWall - b.tWall);

L('\n==========================================================================');
L(' DESTRAVAR DADOS DE HOJE — VOLTAS PELO GPS (sessão 21/06)');
L('==========================================================================');
L(`Sessão: ${sess.sessao.id} · status=${sess.sessao.status} · duração ${sess.sessao.duracaoS}s`);
L(`GPS válidos pra detecção: ${gpsBons.length} (de ${gps.length})`);

// --- 1) Detectar cruzamentos da linha de chegada ----------------------------
linha(); L('1) DETECÇÃO DE VOLTA PELO CRUZAMENTO DA LINHA DE CHEGADA (GPS)');
const cruzamentos = []; // tWall de cada cruzamento
const det = new ChegadaDetector({
  marco: MARCO_CHEGADA,
  onChegada: ({ t }) => cruzamentos.push(t),
});
for (const g of gpsBons) {
  det.ingestGps({ lat: g.dados.lat, lng: g.dados.lon, t: g.tWall });
}
L(`   cruzamentos detectados: ${cruzamentos.length}`);

// tempo de cada volta = intervalo entre cruzamentos consecutivos
const voltas = []; // { n, tempoSec, t0, t1 }
for (let i = 1; i < cruzamentos.length; i++) {
  const tempoSec = (cruzamentos[i] - cruzamentos[i - 1]) / 1000;
  voltas.push({ n: i, tempoSec, t0: cruzamentos[i - 1], t1: cruzamentos[i] });
}
L(`   voltas completas (entre cruzamentos): ${voltas.length}`);
if (voltas.length) {
  L('   tempos de volta:');
  for (const v of voltas) {
    const flag = (v.tempoSec < 30 || v.tempoSec > 300) ? '  <- fora da faixa (box/anomalia?)' : '';
    L(`     volta ${v.n}: ${fmtTempo(v.tempoSec)} (${v.tempoSec.toFixed(1)}s)${flag}`);
  }
  const tempos = voltas.map(v => v.tempoSec);
  const plausiveis = tempos.filter(s => s >= 30 && s <= 300);
  if (plausiveis.length) {
    const best = Math.min(...plausiveis);
    L(`   melhor volta plausível: ${fmtTempo(best)} · ${plausiveis.length} voltas na faixa de pista`);
  }
}

// --- 2) Alimentar o CÉREBRO REAL do painel com essas voltas ------------------
linha(); L('2) PAINEL (cérebro real da nuvem) com as voltas detectadas pelo GPS');
const orq = criarOrquestradorVivo({
  plano: { voltas: 12, duracaoS: 28 * 60 },
  pbEverSec: 91.95, stintNumero: 3, stintTotal: 5,
});
// alimenta amostras (contexto) + as voltas detectadas (com tempo real do GPS)
for (const a of am) orq.feedSample({ ...a.dados, tWall: a.tWall, tipo: a.tipo });
for (const v of voltas) orq.feedVolta({ n: v.n, tempoSec: v.tempoSec });
const snap = orq.snapshot();
L(`   voltas no cérebro: ${snap._geradoComVoltas}`);
L(`   STINT: ${JSON.stringify(snap.stint)}`);
L(`   RITMO: ${JSON.stringify(snap.ritmo)}`);
L(`   META : ${JSON.stringify(snap.meta)}`);
L(`   PENDENTES (ondas ainda não construídas): ${snap._pendentes.join(', ')}`);

// --- 3) Preditivo: temperatura de água máx POR volta ------------------------
linha(); L('3) PREDITIVO — temperatura de água máx por volta (Bubi: crítico 80°C)');
function maxTempNaJanela(t0, t1) {
  let mx = null;
  for (const r of t4) {
    if (r.tWall >= t0 && r.tWall <= t1 && Number.isFinite(r.dados.waterTempC) && r.dados.waterTempC !== 0) {
      if (mx == null || r.dados.waterTempC > mx) mx = r.dados.waterTempC;
    }
  }
  return mx;
}
const voltasTemp = voltas
  .map(v => ({ volta: v.n, maxTempC: maxTempNaJanela(v.t0, v.t1) }))
  .filter(x => x.maxTempC != null);
L(`   voltas com temperatura de água: ${voltasTemp.length}`);
if (voltasTemp.length) {
  L('   máx de água por volta: ' + voltasTemp.map(x => `v${x.volta}=${x.maxTempC.toFixed(1)}°C`).join('  '));
}
const pred = avaliarPreditivo(voltasTemp, { limiteC: 80, baselineVoltas: 3, minVoltas: 4 });
L(`   avaliarPreditivo(...) = ${JSON.stringify(pred)}`);
L(`   => ${pred ? 'ALERTA preditivo: ' + pred.detalhe
      : 'sem alerta (temperatura não está subindo rumo a 80°C, ou < 4 voltas) — honesto'}`);

linha();
L(`RESUMO: ${voltas.length} voltas destravadas pelo GPS · painel ${snap.stint ? 'CALCULANDO' : 'sem stint'} · ` +
  `ritmo ${snap.ritmo ? 'OK' : 'aguardando'} · preditivo ${pred ? 'alerta' : 'sem risco/aguardando'}`);
L('==========================================================================\n');
