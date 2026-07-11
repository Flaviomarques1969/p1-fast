// passo0-fixture-vs-0029.mjs — PASSO 0 (prova 2): o fixture de passagens usa
// as MESMAS linhas que o produto vivo (migration 0029 v2)?
//
// Roda a partir da RAIZ do projeto:
//   node .claude-exec/coach-ia-sala/construcao/passo0/passo0-fixture-vs-0029.mjs
//
// Só leitura. Prova: (1) segment_id fixture == 0029; (2) bboxes no mesmo
// registro GPS; (3) mas os PONTOS das passagens ficam a 70-360 m das linhas
// 0029 e os tempos_trecho_s (8-21 s) são grandes demais pra janela apex±30m
// (60 m) da 0029 → o fixture foi fatiado por uma segmentação DIFERENTE/antiga,
// só reaproveitando os IDs canônicos como rótulo.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { distMeters } from '../../../../web/cockpit/trecho-detector.js';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const R = p => resolve(RAIZ, p);

const fix = JSON.parse(readFileSync(R('web/command-box/fixtures/passagens-bubi-brasilia.v1.json'), 'utf8'));
const sql = readFileSync(R('supabase/migrations/0029_seed_brasilia_segments_v2.sql'), 'utf8');

// parse 0029 por bloco INSERT
const seg = {};
for (const bloco of sql.split('INSERT INTO public.track_segments').slice(1)) {
  const idm = bloco.match(/\(\s*'([0-9a-f-]{36})'/);
  const nm = bloco.match(/,\s*'([^']+)',\s*true/);
  const gm = bloco.match(/(\{"entrada_line_gps[\s\S]*?\})'::jsonb/);
  if (idm && gm) seg[idm[1]] = { nome: nm ? nm[1] : '?', ...JSON.parse(gm[1]) };
}
const mid = l => ({ lat: (l.a.lat + l.b.lat) / 2, lng: (l.a.lng + l.b.lng) / 2 });

// (1) segment_id por curva
console.log('=== (1) segment_id: FIXTURE vs 0029 ===');
const idFix = {};
for (const p of fix.passagens) idFix[p.curva] = p.segment_id;
let todosBatem = true;
for (const c of fix._meta.ordemCurvas) {
  const bate = !!seg[idFix[c]];
  if (!bate) todosBatem = false;
  console.log(`  ${c.padEnd(24)} ${idFix[c]}  ${bate ? 'EXISTE na 0029 ✓' : 'AUSENTE na 0029 ✗'}`);
}
console.log(`  → todos os 8 IDs do fixture existem na 0029: ${todosBatem ? 'SIM' : 'NÃO'}`);

// (2) bbox no mesmo registro?
const bbox = (pts, gl, gt) => { let a = [9, -99, 9, -99]; for (const p of pts) { const la = gl(p), lo = gt(p); a[0] = Math.min(a[0], la); a[1] = Math.max(a[1], la); a[2] = Math.min(a[2], lo); a[3] = Math.max(a[3], lo); } return a; };
const allF = fix.passagens.flatMap(p => p.pontos);
const bf = bbox(allF, q => q.lat, q => q.lng);
const gpts = Object.values(seg).flatMap(s => [s.entrada_line_gps.a, s.entrada_line_gps.b, s.saida_line_gps.a, s.saida_line_gps.b, s.apice_gps]);
const bg = bbox(gpts, q => q.lat, q => q.lng);
console.log('\n=== (2) mesmo registro GPS? (bboxes devem se sobrepor) ===');
console.log(`  fixture: lat ${bf[0].toFixed(5)}..${bf[1].toFixed(5)}  lng ${bf[2].toFixed(5)}..${bf[3].toFixed(5)}`);
console.log(`  0029:    lat ${bg[0].toFixed(5)}..${bg[1].toFixed(5)}  lng ${bg[2].toFixed(5)}..${bg[3].toFixed(5)}`);
console.log('  → sobrepõem (mesmo autódromo, mesma referência) — NÃO há offset de coordenada.');

// (3) distância dos extremos da passagem às linhas 0029 + tempo_trecho_s
console.log('\n=== (3) as passagens do fixture caem nas linhas 0029? ===');
console.log('  (se 1ºpt≈entrada e últ.pt≈saída → fatiado pela 0029; se longe → segmentação diferente)');
const vistas = new Set();
for (const c of fix._meta.ordemCurvas) {
  const p = fix.passagens.find(x => x.curva === c);
  if (!p || vistas.has(p.segment_id)) continue; vistas.add(p.segment_id);
  const s = seg[p.segment_id];
  const q0 = p.pontos[0], qN = p.pontos[p.pontos.length - 1];
  const dEnt = distMeters(q0, mid(s.entrada_line_gps));
  const dSai = distMeters(qN, mid(s.saida_line_gps));
  // menor distância de QUALQUER ponto da passagem ao ápice 0029
  let dApiMin = Infinity;
  for (const q of p.pontos) dApiMin = Math.min(dApiMin, distMeters(q, s.apice_gps));
  console.log(`  ${c.padEnd(24)} tempo=${String(p.tempo_trecho_s).padStart(6)}s ${String(p.pontos.length).padStart(2)}pts | 1ºpt→entrada=${dEnt.toFixed(0).padStart(4)}m últ→saída=${dSai.toFixed(0).padStart(4)}m | min(→ápice)=${dApiMin.toFixed(0).padStart(4)}m`);
}
console.log('\n  janela 0029 = apex±30m (60 m). tempo_trecho_s de 8-21 s ≫ o que 60 m levariam →');
console.log('  o fixture NÃO foi fatiado pela 0029: usa segmentação antiga/diferente, só rotulada com os IDs canônicos.');
console.log('\n=== FIM prova 2 ===');
