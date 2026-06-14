// re-etiquetar-passagens-offline.js — preenche o `sub` (entrada/freio/apice/saida) de cada
// ponto das 56 passagens REAIS do Bubi (maio/2026, ~1 Hz), que hoje vêm com sub:null.
//
// PEDIDO Flávio 13/06: "nessa passagem da curva, incluir o ponto de frenagem e o Vmin".
// Esta etapa marca, por passagem, FREADA (início), ÁPICE e VMIN — e re-etiqueta os pontos.
//
// REUSA a MESMA lógica do detector ao vivo (não reinventa):
//   • freada (início)  → primeira desaceleração média >= FREADA_LIMIAR_G (0,5 g), como o
//                        trecho-detector. O ponto-pico anterior ao tombo vira a marca freadaT.
//   • ápice            → ponto de APROXIMAÇÃO MÍNIMA ao apice_gps ideal (<= APICE_DIST_MAX_M),
//                        igual ao trecho-detector ("distância parou de cair → cruzou o ápice").
//   • Vmin             → acharVminBuffer (menor velocidade), idêntico ao ao vivo.
//   • re-etiqueta       → retagSubsPorEventos (a MESMA função do bridge ao vivo).
//
// HONESTIDADE: a 1 Hz, com ~9-10 pontos por curva, a freada nem sempre cruza 0,5 g num único
// intervalo — quando não cruza, freadaT = null (não inventa) e o ponto fica 'entrada' até o
// ápice. O ápice geométrico garante que TODO ponto recebe um sub (0 nulos), porque toda curva
// de Brasília tem apice_gps cadastrado.
//
// SEGURANÇA DO DADO (referência canônica, NÃO apagar): lê o backup em ~/Documents SOMENTE
// LEITURA e GRAVA num arquivo NOVO no repositório. Recusa-se a escrever sobre o backup.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acharVminBuffer, retagSubsPorEventos } from '../web/cockpit/live-data-bridge.js';
import { distM } from '../web/cockpit/classificador-trecho.js';

const FREADA_LIMIAR_G = 0.5;      // mesmo valor do trecho-detector
const APICE_DIST_MAX_M = 60;      // mesmo valor do trecho-detector
const G = 9.80665;                // m/s²

const HOME = process.env.HOME;
const RAIZ = dirname(dirname(fileURLToPath(import.meta.url)));
const ENTRADA = join(HOME, 'Documents/p1fast-backup-voltas-reais/passagens-bubi-aplicadas.json');
const GEO = join(RAIZ, '_design-reference/PONTOS-TRECHOS-BRASILIA-2026-05-28.json');
const SAIDA = join(RAIZ, 'relatorios/passagens-bubi-reetiquetadas-2026-06-14.json');

// converte t pra segundos (o dado vem em ms; se já vier pequeno, assume s)
function segundos(t) { return t > 1000 ? t / 1000 : t; }

// freadaT: t do ponto-pico imediatamente ANTES da 1ª desaceleração média >= 0,5 g (até o Vmin).
// Espelha o trecho-detector (avgDecel <= -FREADA_LIMIAR_G), mas sobre os pontos já recortados.
function acharFreadaT(pts, vminIdx) {
  for (let i = 1; i <= vminIdx && i < pts.length; i++) {
    const v0 = pts[i - 1].kmh, v1 = pts[i].kmh;
    if (!Number.isFinite(v0) || !Number.isFinite(v1)) continue;
    const dt = segundos(pts[i].t) - segundos(pts[i - 1].t);
    if (!(dt > 0)) continue;
    const decel = ((v0 - v1) / 3.6) / dt;   // m/s²
    if (decel >= FREADA_LIMIAR_G * G) return pts[i - 1].t;  // pico antes do tombo
  }
  return null;  // sem freada nítida a 1 Hz — não inventa
}

// ápice geométrico: ponto de aproximação mínima ao apice_gps. Retorna {t, idx, dist} ou null.
// Igual ao detector (menor distância ao ponto ideal).
function acharApiceGeo(pts, apiceGps) {
  if (!apiceGps) return null;
  let melhor = Infinity, melhorT = null, melhorIdx = -1;
  pts.forEach((p, i) => { const d = distM(p, apiceGps); if (d < melhor) { melhor = d; melhorT = p.t; melhorIdx = i; } });
  return { t: melhorT, idx: melhorIdx, dist: melhor };
}

// Âncora do ápice + confiança. Hierarquia HONESTA:
//   • 'alta'       → ápice geométrico casa (<= 60 m do ponto ideal cadastrado).
//   • 'baixa'      → ápice geométrico longe/ausente, mas o Vmin está no MEIO da passagem
//                    (não na borda) → ancora no Vmin (slowest point ≈ apex do recorte).
//   • 'borda'      → Vmin na 1ª/última amostra → recorte parcial (entrada-só ou saída-só);
//                    sem ápice nítido. Ainda etiqueta (0 nulos), mas declara o limite.
function ancorarApice(pts, apiceGps, vminIdx) {
  const geo = acharApiceGeo(pts, apiceGps);
  if (geo && geo.dist <= APICE_DIST_MAX_M) return { apiceT: geo.t, confianca: 'alta', distApiceM: Math.round(geo.dist) };
  if (vminIdx == null) return { apiceT: null, confianca: 'borda', distApiceM: geo ? Math.round(geo.dist) : null };
  const naBorda = (vminIdx === 0 || vminIdx === pts.length - 1);
  if (!naBorda) return { apiceT: pts[vminIdx - 1].t, confianca: 'baixa', distApiceM: geo ? Math.round(geo.dist) : null };
  return { apiceT: pts[vminIdx].t, confianca: 'borda', distApiceM: geo ? Math.round(geo.dist) : null };
}

function main() {
  if (SAIDA.includes('p1fast-backup-voltas-reais') || ENTRADA === SAIDA) {
    throw new Error('RECUSADO: não escrever sobre o backup canônico.');
  }
  const passagens = JSON.parse(readFileSync(ENTRADA, 'utf8'));
  const geoDoc = JSON.parse(readFileSync(GEO, 'utf8'));
  const geoPorNome = {};
  for (const tr of geoDoc.trechos) geoPorNome[tr.nome] = tr;

  let totalPts = 0, nullAntes = 0, nullDepois = 0;
  let comFreada = 0, comApice = 0, comVmin = 0;
  const conf = { alta: 0, baixa: 0, borda: 0 };
  const dist = { entrada: 0, freio: 0, apice: 0, saida: 0, outro: 0 };
  const spot = [];

  const saida = passagens.map(p => {
    const pts = Array.isArray(p.pontos_json) ? p.pontos_json : [];
    totalPts += pts.length;
    nullAntes += pts.filter(x => x.sub == null).length;

    const geo = geoPorNome[p._curva] || null;
    const vmin = acharVminBuffer(pts);
    const vminIdx = vmin ? vmin.idx : null;
    const freadaT = (vminIdx != null) ? acharFreadaT(pts, vminIdx) : null;
    const anc = ancorarApice(pts, geo && geo.apice_gps, vminIdx);
    const apiceT = anc.apiceT;

    if (freadaT != null) comFreada++;
    if (apiceT != null) comApice++;
    if (vminIdx != null) comVmin++;
    conf[anc.confianca] = (conf[anc.confianca] || 0) + 1;

    const novosPts = retagSubsPorEventos(pts, { freadaT, apiceT, vminIdx });
    for (const x of novosPts) {
      if (x.sub == null) { nullDepois++; dist.outro++; }
      else if (dist[x.sub] != null) dist[x.sub]++;
      else dist.outro++;
    }

    // marcos calculados, anexados pra a tela (FASE 6) e auditoria
    const marcos = {
      freadaT, apiceT, confiancaApice: anc.confianca, distApiceM: anc.distApiceM,
      vminIdx, vminKmh: vmin ? vmin.kmh : null, vminT: (vminIdx != null) ? pts[vminIdx].t : null,
    };

    if (spot.length < 4) {
      spot.push({
        curva: p._curva, dia: p._dia, volta: p._volta,
        kmh: pts.map(x => Math.round(x.kmh)),
        sub: novosPts.map(x => x.sub),
        marcos,
      });
    }
    return { ...p, pontos_json: novosPts, _marcos: marcos };
  });

  writeFileSync(SAIDA, JSON.stringify(saida, null, 1));

  console.log('=== RE-ETIQUETAGEM OFFLINE — 56 passagens reais ===');
  console.log(`passagens: ${saida.length}`);
  console.log(`pontos: ${totalPts}  | sub:null ANTES = ${nullAntes}  | sub:null DEPOIS = ${nullDepois}`);
  console.log(`com freada=${comFreada}  com ápice=${comApice}  com Vmin=${comVmin}  (de ${saida.length})`);
  console.log(`distribuição de sub:`, JSON.stringify(dist));
  console.log(`gravado em: ${SAIDA.replace(RAIZ, '')}`);
  console.log('\n--- amostras (conferência) ---');
  for (const s of spot) {
    console.log(`\n${s.curva} (${s.dia} v${s.volta})  Vmin=${s.marcos.vminKmh}km/h @idx${s.marcos.vminIdx}  freadaT=${s.marcos.freadaT}  apiceT=${s.marcos.apiceT}`);
    console.log('  kmh:', s.kmh.join(' '));
    console.log('  sub:', s.sub.join(' '));
  }

  // critério da FASE 3: 0 pontos com sub:null
  if (nullDepois > 0) { console.log(`\n✗ FALHA: ${nullDepois} pontos ainda com sub:null`); process.exit(1); }
  console.log('\n✓ 0 pontos com sub:null');
}

main();
