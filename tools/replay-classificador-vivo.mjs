// replay-classificador-vivo.mjs — FASE 5: roda as 56 passagens REAIS pelo BRIDGE VIVO de verdade
// (criarClassificadorVivo), exatamente como o cockpit faria a cada 'passagem-fechada'. Prova que
// o agente vivo está ligado em DEV/replay: o estado acumula por trecho e, onde a evolução for
// consistente, NASCE proposta de mudar o tipo da curva.
//
// HONESTIDADE (já registrado na memória): o dado de maio é ~1 Hz. Espera-se que a observação
// CONFIRME o padrão definitivo do Flávio — ou seja, 0 propostas novas. Propostas reais só virão
// quando NOVAS voltas a 25 Hz (RaceBox) divergirem do padrão de forma consistente. Replay aqui
// serve pra provar a LIGAÇÃO e o acúmulo, não pra fabricar proposta.
//
// Lê SOMENTE LEITURA o backup canônico das passagens. Não grava nada (store em memória).

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { criarClassificadorVivo } from '../web/cockpit/classificador-vivo-bridge.js';

const HOME = process.env.HOME;
const RAIZ = dirname(dirname(fileURLToPath(import.meta.url)));
const PASS = join(HOME, 'Documents/p1fast-backup-voltas-reais/passagens-bubi-aplicadas.json');

// Padrão DEFINITIVO do Flávio (13/06) — fonte de verdade: relatorios/_decisao-flavio-padrao-
// curvas-2026-06-13.json + migration 0043. É o tipo APROVADO inicial de cada curva.
const PADRAO = {
  'CURVA 01': 'T5', 'CURVA DA RETA OPOSTA': 'T1', 'CURVA 2': 'T0', 'CURVA DA JUNÇÃO': 'T2',
  'CURVA DA BRUXA': 'T0', 'CURVA DO PLACAR': 'T2', 'CURVA "S"': 'T4', 'CURVA DA VITÓRIA': 'SF',
};

function chaveTempo(p) {
  // ordena cronologicamente (dia dd/mm + volta) pra simular a chegada ao vivo
  const [d, m] = String(p._dia || '').split('/').map(Number);
  return (m || 0) * 1e6 + (d || 0) * 1e4 + (p._volta || 0);
}

function main() {
  const passagens = JSON.parse(readFileSync(PASS, 'utf8'));

  // monta os segmentos observados (id real que chega no evento + nome + tipo aprovado).
  const segPorId = new Map();
  for (const p of passagens) {
    if (p.segment_id && !segPorId.has(p.segment_id)) {
      segPorId.set(p.segment_id, { id: p.segment_id, nome: p._curva, tipoAprovado: PADRAO[p._curva] || 'ND' });
    }
  }
  const segmentos = [...segPorId.values()];

  const propostas = [];
  const vivo = criarClassificadorVivo({
    segmentos,
    onProposta: (info) => propostas.push(info),
    store: null, // replay: só memória, NÃO grava
  });

  // simula o fluxo ao vivo: cada passagem fechada em ordem cronológica
  const ordenadas = passagens.slice().sort((a, b) => chaveTempo(a) - chaveTempo(b));
  let processadas = 0, ignoradas = 0;
  for (const p of ordenadas) {
    const r = vivo.aoFecharPassagem({
      segmentId: p.segment_id,
      pontos: p.pontos_json,
      contexto: { dia: p._dia, volta: p._volta, tipo_pneu: p.tipo_pneu },
      vminKmh: p._marcos ? p._marcos.vminKmh : null,
    });
    if (r) processadas++; else ignoradas++;
  }

  const snap = vivo.snapshot();
  console.log('=== REPLAY DO AGENTE VIVO — 56 passagens reais (bridge real) ===');
  console.log(`segmentos observados: ${segmentos.length}  | passagens processadas: ${processadas}  | ignoradas: ${ignoradas}`);
  console.log(`propostas nascidas: ${propostas.length}`);
  console.log('\n--- estado vivo por trecho (tipo aprovado / observado / tendência) ---');
  for (const s of snap) {
    const e = s.estado, tend = s.tendencia;
    const obs = (tend && tend.dominante) ? tend.dominante : '—';
    console.log(
      `${(s.nome || s.segmentId.slice(0, 8)).padEnd(22)} aprovado=${String(e.tipoAprovado).padEnd(3)} observado≈${String(obs).padEnd(3)} ` +
      `passagens=${e.historico ? e.historico.length : 0} proposta=${e.propostaPendente ? e.propostaPendente.tipo : '—'}`
    );
  }
  if (propostas.length) {
    console.log('\n--- propostas ---');
    for (const pr of propostas) console.log(`  ${pr.trecho}: → ${pr.proposta.tipo}`);
  } else {
    console.log('\n✓ 0 propostas — a observação de maio (~1 Hz) CONFIRMA o padrão do Flávio (esperado e honesto).');
  }
  // critério da FASE 5: o estado acumulou em todos os trechos observados
  const semHistorico = snap.filter(s => !s.estado.historico || s.estado.historico.length === 0);
  if (semHistorico.length) { console.log(`\n✗ ${semHistorico.length} trecho(s) sem acúmulo`); process.exit(1); }
  console.log('\n✓ estado vivo acumulou em todos os trechos observados');
}

main();
