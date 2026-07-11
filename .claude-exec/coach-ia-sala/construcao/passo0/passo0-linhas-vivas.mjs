// passo0-linhas-vivas.mjs — PASSO 0 da Fase 1 (Construtora CÉREBRO)
// Pergunta (SOLUCAO-FINAL §7 passo 0 / janela-2.md §7.2):
//   As LINHAS AO VIVO do produto (migration 0029 v2, o que o segments-loader
//   carrega) colocam a FREADA DENTRO do segmento (defeito só do fixture) OU
//   COINCIDEM com o fixture (freada fora do trecho → defeito de registro no PRODUTO)?
//
// Método: roda o TrechoDetector REAL (web/cockpit/trecho-detector.js) sobre o
// traço GPS CRU contínuo (volta-real-gps-23-05-rodando.json, 1 Hz, ~5 voltas),
// usando os segmentos REAIS da 0029 v2. Conta, por curva, em quantas voltas o
// evento `freada-iniciou` disparou DENTRO do segmento. Também mede, por passagem,
// onde o Vmin cai (início/meio/fim) — o gabarito de perfil da J5 (§3).
//
// Nada de produção é tocado. Só leitura + execução determinística.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { TrechoDetector, distMeters } from '../web/cockpit/trecho-detector.js';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ── 1. Segmentos REAIS da migration viva 0029 v2 ──
function carregarSegmentos0029() {
  const sql = readFileSync(resolve(RAIZ, 'supabase/migrations/0029_seed_brasilia_segments_v2.sql'), 'utf8');
  const segs = [];
  // cada INSERT: id, layout_id, ordem, nome, eh_trecho, geometria(jsonb literal)
  const re = /INSERT INTO public\.track_segments[\s\S]*?VALUES\s*\(\s*'([0-9a-f-]{36})',\s*'[0-9a-f-]{36}',\s*(\d+),\s*'([^']+)',\s*true,\s*'(\{[\s\S]*?\})'::jsonb/g;
  let m;
  while ((m = re.exec(sql)) !== null) {
    const [, id, ordemStr, nome, geoStr] = m;
    const g = JSON.parse(geoStr);
    segs.push({
      id, nome, ordem: Number(ordemStr),
      entradaLine: { a: g.entrada_line_gps.a, b: g.entrada_line_gps.b },
      apicePoint: g.apice_gps ? { lat: g.apice_gps.lat, lng: g.apice_gps.lng } : null,
      saidaLine: { a: g.saida_line_gps.a, b: g.saida_line_gps.b },
    });
  }
  segs.sort((a, b) => a.ordem - b.ordem);
  return segs;
}

// ── 2. Traço GPS cru contínuo, kmh derivado das posições (declarado) ──
function carregarTraco(nomeArq) {
  const j = JSON.parse(readFileSync(resolve(RAIZ, 'web/command-box/fixtures/', nomeArq), 'utf8'));
  const a = j.amostras; // [tMs, lat, lng]
  const pts = [];
  for (let i = 0; i < a.length; i++) {
    const [t, lat, lng] = a[i];
    let kmh = 0;
    if (i > 0) {
      const dt = (t - a[i - 1][0]) / 1000;
      if (dt > 0) kmh = distMeters({ lat: a[i - 1][1], lng: a[i - 1][2] }, { lat, lng }) / dt * 3.6;
    }
    pts.push({ t, lat, lng, kmh });
  }
  // corrige o kmh[0] pra não ficar 0 (usa o do próximo)
  if (pts.length > 1) pts[0].kmh = pts[1].kmh;
  return pts;
}

const ARQ_TRACO = process.argv[2] || 'volta-real-gps-23-05-rodando.json';
const segs = carregarSegmentos0029();
const pts = carregarTraco(ARQ_TRACO);
console.log(`Segmentos 0029 v2: ${segs.length} | traço cru: ${ARQ_TRACO} = ${pts.length} pts @1Hz`);
console.log('Ordem detector:', segs.map(s => s.nome).join(' → '));

// ── 3. Roda o detector REAL e coleta eventos por passagem ──
const passagens = []; // uma por (curva, ocorrência): {segId, nome, entradaT, freadaEvt, saidaT, apiceEvt}
let atual = null;
const nomePorId = Object.fromEntries(segs.map(s => [s.id, s.nome]));

const det = new TrechoDetector({
  segments: segs,
  onEvent: (ev) => {
    if (ev.type === 'entrada-cruzou') {
      atual = { segId: ev.segmentId, nome: nomePorId[ev.segmentId], entradaT: ev.t, entradaKmh: ev.kmh, freada: null, apice: null, saidaT: null };
      passagens.push(atual);
    } else if (ev.type === 'freada-iniciou') {
      if (atual && atual.segId === ev.segmentId) atual.freada = { t: ev.t, kmh: ev.kmh, distFromEntradaM: ev.distFromEntradaM };
    } else if (ev.type === 'apice-cruzou') {
      if (atual && atual.segId === ev.segmentId) atual.apice = { t: ev.t, kmh: ev.kmh, distFromIdealM: ev.distFromIdealM };
    } else if (ev.type === 'saida-cruzou') {
      if (atual && atual.segId === ev.segmentId) atual.saidaT = ev.t;
    } else if (ev.type === 'resync') {
      // troca de trecho sem fechar — a passagem anterior fica incompleta (registrada)
    }
  },
});

for (const p of pts) det.ingestGps(p);

// ── 4. Consolida por curva ──
console.log('\n=== EVENTOS DO DETECTOR REAL (linhas vivas 0029) POR CURVA ===');
const porCurva = {};
for (const s of segs) porCurva[s.nome] = { entradas: 0, comFreada: 0, freadas: [] };
for (const pa of passagens) {
  const c = porCurva[pa.nome];
  if (!c) continue;
  c.entradas++;
  if (pa.freada) { c.comFreada++; c.freadas.push(pa.freada); }
}
for (const s of segs) {
  const c = porCurva[s.nome];
  const fr = c.freadas.length
    ? `freada@ ${c.freadas.map(f => `${f.distFromEntradaM.toFixed(0)}m/${f.kmh.toFixed(0)}kmh`).join(', ')}`
    : '(nenhuma freada-iniciou disparou dentro do segmento)';
  console.log(`${s.nome.padEnd(24)} entradas=${c.entradas}  com freada-iniciou=${c.comFreada}/${c.entradas}  ${fr}`);
}

// ── 5. Gabarito independente do detector: onde cai o Vmin DENTRO do segmento ──
// Reconstrói, por passagem completa (entradaT..saidaT), os pontos do traço e
// mede a posição fracionária do Vmin (0=entrada, 1=saída) e se ainda caía a
// velocidade no 1º ponto (freada em curso = veio de fora).
console.log('\n=== PERFIL: posição do Vmin dentro do segmento (linhas vivas 0029) ===');
console.log('(fracVmin ~0 = já entra no ponto lento → freada ANTES da entrada; ~0.5 = bem formado)');
const resumoVmin = {};
for (const s of segs) resumoVmin[s.nome] = [];
for (const pa of passagens) {
  if (pa.saidaT == null) continue;
  const dentro = pts.filter(p => p.t >= pa.entradaT && p.t <= pa.saidaT);
  if (dentro.length < 3) { resumoVmin[pa.nome].push({ n: dentro.length, fracVmin: null }); continue; }
  let iMin = 0;
  for (let i = 1; i < dentro.length; i++) if (dentro[i].kmh < dentro[iMin].kmh) iMin = i;
  const fracVmin = iMin / (dentro.length - 1);
  // velocidade caindo ainda no 1º ponto? compara kmh no ponto ANTES da entrada
  const idxEntrada = pts.findIndex(p => p.t === pa.entradaT);
  const kmhAntes = idxEntrada > 0 ? pts[idxEntrada - 1].kmh : null;
  const caindoNaEntrada = kmhAntes != null && dentro[0].kmh < kmhAntes;
  // Quanto freou ANTES (nos ~3 s antes da entrada) vs DEPOIS (entrada→vmin) da linha:
  const kmhPico3sAntes = idxEntrada >= 3
    ? Math.max(pts[idxEntrada - 1].kmh, pts[idxEntrada - 2].kmh, pts[idxEntrada - 3].kmh)
    : kmhAntes;
  const freouAntesKmh = kmhPico3sAntes != null ? Math.max(0, kmhPico3sAntes - dentro[0].kmh) : null; // pré-entrada
  const freouDepoisKmh = Math.max(0, dentro[0].kmh - dentro[iMin].kmh); // entrada→vmin
  resumoVmin[pa.nome].push({ n: dentro.length, fracVmin, vminKmh: dentro[iMin].kmh, entraKmh: dentro[0].kmh, caindoNaEntrada, freouAntesKmh, freouDepoisKmh });
}
for (const s of segs) {
  const rs = resumoVmin[s.nome].filter(r => r.fracVmin != null);
  if (!rs.length) { console.log(`${s.nome.padEnd(24)} (sem passagem completa)`); continue; }
  const med = rs.reduce((a, r) => a + r.fracVmin, 0) / rs.length;
  const nCaindo = rs.filter(r => r.caindoNaEntrada).length;
  const antesMed = rs.reduce((a, r) => a + (r.freouAntesKmh ?? 0), 0) / rs.length;
  const depoisMed = rs.reduce((a, r) => a + (r.freouDepoisKmh ?? 0), 0) / rs.length;
  const perfis = rs.map(r => `${(r.fracVmin).toFixed(2)}(${r.vminKmh.toFixed(0)})`).join(' ');
  console.log(`${s.nome.padEnd(24)} n=${rs.length} fracVmin=${med.toFixed(2)}  caindo=${nCaindo}/${rs.length}  freou_ANTES≈${antesMed.toFixed(0)}kmh vs DEPOIS≈${depoisMed.toFixed(0)}kmh  [${perfis}]`);
}

console.log('\n=== FIM PASSO 0 ===');
