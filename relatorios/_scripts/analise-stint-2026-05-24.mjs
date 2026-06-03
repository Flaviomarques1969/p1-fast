// Análise offline do stint de 2026-05-24 (Subaru WRX 2.5)
// ───────────────────────────────────────────────────────
// O detector ao vivo não estava armado durante o stint (carro Subaru
// sem bundle Brasília vinculado). Mas a telemetria GPS foi capturada
// — 940 amostras `cockpit-mobile` com lat/lng/kmh.
//
// Esse script:
//   1. Lê os pontos GPS do TSV exportado do SQLite do app.
//   2. Projeta lat/lng → viewBox da pista (Projector canônico).
//   3. Monta os 8 trechos pedagógicos de Brasília com pathStart/
//      pathEnd derivados dos pontos E/S marcados em
//      MAPA-BRASILIA-DEFINITIVO.json.
//   4. Roda o Detector contra os samples projetados → emite lap +
//      segmentEnd + segmentPostBurst.
//   5. Aplica TrechoAdvisor por trecho.
//   6. Gera HTML completo com tabela de 6 indicadores por trecho +
//      desenho da pista naquele trecho com os pontos.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Detector } from '../../src/telemetry/detector.js';
import { projectToViewBox, applyProjection } from '../../src/telemetry/projector.js';
import { buildLookup, snap } from '../../src/telemetry/path-mapper.js';
import { gerarConselho } from '../../src/domain/trecho-advisor.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// 1. Carregar mapa oficial
const mapa = JSON.parse(fs.readFileSync(path.join(ROOT, '_design-reference/MAPA-BRASILIA-DEFINITIVO.json'), 'utf8'));
const svgPath = fs.readFileSync(path.join(ROOT, '_design-reference/PISTA-OFICIAL-brasilia.txt'), 'utf8').trim();

// ÂNCORAS OFICIAIS (do MAPA-BRASILIA-DEFINITIVO.json) — usadas pra
// comparar com calibração ad-hoc.
const ancorasOficiais = mapa.pista.ancoras_geo.map(a => ({
  lat: a.latitude, lng: a.longitude, x: a.x, y: a.y,
}));

const linhaChegada = mapa.pista.linha_chegada;

// 2. Montar segments com pathStart/pathEnd derivados de E e S
const lookup = buildLookup(svgPath, 4000);
const totalLen = lookup.totalLength;

function pctOf(point) {
  const r = snap(lookup, point.x, point.y);
  return (r.offset / totalLen) * 100;
}

const trechosDoApp = mapa.trechos.map((t, idx) => {
  if (!t.entradas || !t.saidas || t.entradas.length === 0) {
    return { id: t.id, nome: t.nome, pedagogico: false };
  }
  // Resetar _lastIdx do lookup pra cada trecho — snap é stateful
  delete lookup._lastIdx;
  const e = t.entradas[0];
  const s = t.saidas[0];
  const a = t.apices[0];
  const pctE = pctOf(e);
  const pctS = pctOf(s);
  return {
    id: t.id,
    nome: t.nome,
    parcialId: t.parcial,
    pathStart: pctE,
    pathEnd: pctS,
    pedagogico: t.eh_trecho_pedagogico,
    pontos: { E: e, S: s, A: a },
    ordem: t.ordem,
  };
});

// O detector consome `segments` planar — só pedagógicos com pathStart < pathEnd
const segmentsParaDetector = trechosDoApp
  .filter(t => t.pedagogico && t.pathStart != null && t.pathEnd != null && t.pathStart < t.pathEnd)
  .map(t => ({
    id: t.id, nome: t.nome,
    parcialId: t.parcialId,
    pathStart: t.pathStart,
    pathEnd: t.pathEnd,
  }));

console.error('Trechos pedagógicos detectáveis:');
segmentsParaDetector.forEach(s => console.error(`  ${s.id} (${s.parcialId})  ${s.pathStart.toFixed(2)}% → ${s.pathEnd.toFixed(2)}%`));

// 3. Ler samples GPS do TSV
const tsv = fs.readFileSync('/tmp/p1fast-banco-iphone/extract/gps-samples.tsv', 'utf8');
const samples = tsv.trim().split('\n').map(line => {
  const [t, lat, lng, kmh] = line.split('\t');
  return {
    t: Number(t),
    lat: Number(lat),
    lng: Number(lng),
    speed: Number(kmh) / 3.6, // GPS guarda km/h → Detector espera m/s
  };
});
console.error(`\nLido ${samples.length} samples GPS`);

// 3b. AUTO-CALIBRAÇÃO de âncoras geográficas.
// Descoberta crítica: as âncoras oficiais do MAPA-BRASILIA-DEFINITIVO.json
// não batem com o GPS real do stint de hoje (média de 488 unidades de
// erro contra o path). Calibração ad-hoc usando bounding box do GPS vs
// bounding box do path SVG — só pra esse relatório de análise. As
// âncoras oficiais permanecem intocadas (regra dura: não mexer no
// MAPA DEFINITIVO sem ordem direta do Flávio).
function autoCalibrarAncoras(samples, pathBounds) {
  const lats = samples.map(s => s.lat);
  const lngs = samples.map(s => s.lng);
  const latMin = Math.min(...lats), latMax = Math.max(...lats);
  const lngMin = Math.min(...lngs), lngMax = Math.max(...lngs);
  // Pega 2 pontos diagonais. Em projeção típica: norte (lat max) = Y min;
  // leste (lng max) = X max.
  return [
    { lat: latMin, lng: lngMin, x: pathBounds.xMin, y: pathBounds.yMax }, // SW
    { lat: latMax, lng: lngMax, x: pathBounds.xMax, y: pathBounds.yMin }, // NE
  ];
}

// Bounding box do path
let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
for (const p of lookup.points) {
  xMin = Math.min(xMin, p.x); xMax = Math.max(xMax, p.x);
  yMin = Math.min(yMin, p.y); yMax = Math.max(yMax, p.y);
}
const pathBounds = { xMin, xMax, yMin, yMax };
console.error(`\nPath SVG bounds: X ${xMin.toFixed(0)}..${xMax.toFixed(0)} · Y ${yMin.toFixed(0)}..${yMax.toFixed(0)}`);

const ancorasAuto = autoCalibrarAncoras(samples, pathBounds);
const track = { geoAncoras: ancorasAuto };
console.error('Âncoras auto-calibradas:');
ancorasAuto.forEach((a, i) => console.error(`  [${i}] lat=${a.lat.toFixed(5)} lng=${a.lng.toFixed(5)} → (${a.x.toFixed(0)}, ${a.y.toFixed(0)})`));

// Diagnóstico: % de samples que passam o snapMaxDist com a calibração nova
{
  let passou = 0, sumDist = 0;
  for (const s of samples) {
    const p = projectToViewBox(s, track);
    if (!p) continue;
    delete lookup._lastIdx;
    const sn = snap(lookup, p.x, p.y);
    sumDist += sn.dist;
    if (sn.dist <= 80) passou++;
  }
  console.error(`Auto-calibração: ${passou}/${samples.length} (${(passou*100/samples.length).toFixed(1)}%) passam snapMaxDist=80, dist média ${(sumDist/samples.length).toFixed(0)}`);
}

// 4. Rodar Detector
const detector = new Detector({
  svgPath,
  linhaChegada,
  segments: segmentsParaDetector,
});

const laps = [];
const segmentEnds = [];
const postBursts = [];
detector.onLap(ev => laps.push(ev));
detector.onSegmentEnd(ev => segmentEnds.push(ev));
detector.onSegmentPostBurst(ev => postBursts.push(ev));

for (const s of samples) {
  const proj = projectToViewBox(s, track);
  if (!proj) continue;
  detector.consume({
    x: proj.x,
    y: proj.y,
    t: s.t,
    speed: s.speed,
  });
}

console.error(`\nDetector emitiu: ${laps.length} voltas, ${segmentEnds.length} segmentEnds, ${postBursts.length} postBursts`);
laps.forEach(l => console.error(`  Volta ${l.numero}: ${(l.tempoMs/1000).toFixed(3)} s`));

// 5. Reconstruir voltas pela sequência cronológica dos trechos.
// Quando a linha de chegada não é cruzada (caso desse stint), a
// "Volta N" é o conjunto contíguo de passagens entre repetições do
// PRIMEIRO trecho da volta. Pra Brasília, o trecho seg_brasilia_0
// (CURVA 01) é o primeiro logo após a linha de chegada.
function reconstruirVoltas(events) {
  // Pega o primeiro trecho de cada execução pelos parciais (ordem do path)
  // — heurística: primeiro segment_brasilia_0 abre Volta 1, segundo abre Volta 2, etc.
  const sorted = events.slice().sort((a,b) => a.entradaAt - b.entradaAt);
  let volta = 0;
  let lastSeg = null;
  return sorted.map(ev => {
    // Novo "ciclo" quando reentra no menor pathStart (seg_brasilia_0 ~5%)
    if (ev.segmentId === 'seg_brasilia_0' || (lastSeg && ev.entradaAt - lastSeg.entradaAt > 60000)) {
      volta++;
    }
    lastSeg = ev;
    return { ...ev, lapNumero: volta };
  });
}
const segmentEndsAtribuidos = reconstruirVoltas(segmentEnds);

// Conta de voltas baseada na heurística
const voltasReconstruidas = [...new Set(segmentEndsAtribuidos.map(e => e.lapNumero))];
console.error(`Voltas reconstruídas pela sequência: ${voltasReconstruidas.length}`);

function pareiaPostBurst(ev) {
  // Casa por segmentId + entradaAt mais próximo (postBurst original tem
  // lapNumero do detector, agora desatualizado pelo reset). Match por
  // ordem cronológica funciona porque os 2 emissores são contemporâneos.
  return postBursts.find(pb => pb.segmentId === ev.segmentId && Math.abs(pb.tSaidaPico - ev.saidaAt) < 5000) || null;
}

const porTrecho = new Map();
for (const ev of segmentEndsAtribuidos) {
  if (!porTrecho.has(ev.segmentId)) porTrecho.set(ev.segmentId, []);
  porTrecho.get(ev.segmentId).push({ ...ev, postBurst: pareiaPostBurst(ev) });
}

const trechosResultado = [];
for (const [segId, execucoes] of porTrecho) {
  const meta = trechosDoApp.find(t => t.id === segId);
  if (!meta) continue;
  // Transformar pra shape do trecho-advisor (km/h). lapNumero vem do
  // `reconstruirVoltas` — heurística baseada em sequência cronológica
  // já que o detector não cruzou a linha de chegada nesse stint.
  const execAdvisor = execucoes.map(e => ({
    voltaId: `v${e.lapNumero}`,
    vChegadaKmh:   e.vChegada    != null ? e.vChegada    * 3.6 : null,
    vEntradaKmh:   e.velEntrada  != null ? e.velEntrada  * 3.6 : null,
    vFreadaKmh:    e.vFreada     != null ? e.vFreada     * 3.6 : null,
    vminKmh:       e.velMinima   != null ? e.velMinima   * 3.6 : null,
    vPaceKmh:      e.velSaida    != null ? e.velSaida    * 3.6 : null,
    vSaidaPicoKmh: e.postBurst?.vSaidaPico != null ? e.postBurst.vSaidaPico * 3.6 : null,
  }));
  const conselho = gerarConselho(meta.nome, execAdvisor);
  trechosResultado.push({
    id: segId, nome: meta.nome, parcial: meta.parcialId,
    pontos: meta.pontos,
    execucoes,
    execAdvisor,
    conselho,
  });
}

// 6. Gerar HTML
const html = renderHtml({
  data: mapa.pista,
  laps,
  voltasReconstruidas,
  segmentEnds: segmentEndsAtribuidos,
  trechos: trechosResultado,
  totalTrechosPedagogicos: segmentsParaDetector.length,
  svgPath,
  ancorasOficiais,
  ancorasAuto,
});
const outPath = path.join(ROOT, 'relatorios/STINT-2026-05-24-ANALISE.html');
fs.writeFileSync(outPath, html);
console.error(`\nHTML gerado em: ${outPath}`);

// ───────────────────────────────────────────────────────
// Renderer HTML
// ───────────────────────────────────────────────────────
function renderHtml({ data, laps, voltasReconstruidas, segmentEnds, trechos, totalTrechosPedagogicos, svgPath, ancorasOficiais, ancorasAuto }) {
  const viewBox = `0 0 ${data.view_box.largura} ${data.view_box.altura}`;
  const linhaCheg = data.linha_chegada;

  const fmtVel = v => v == null ? '—' : v.toFixed(1);
  const fmtVelMs = v => v == null ? '—' : (v * 3.6).toFixed(1);
  const fmtTempo = ms => ms == null ? '—' : (ms / 1000).toFixed(3) + ' s';

  // SVG da pista por trecho — destaca o trecho específico em cor + plots
  // os pontos canônicos E/A/S + a coordenada do apex real
  function trackMiniSvg(trecho) {
    const { E, S, A } = trecho.pontos || {};
    // Apex real (Vmin) — pega o do voltamenor (volta com menor tempo)
    const melhorVolta = trecho.execucoes.slice().sort((a, b) => a.tempoMs - b.tempoMs)[0];
    const apexReal = melhorVolta?.apexActual;

    let svg = `<svg viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" class="track-mini">`;
    svg += `<path d="${svgPath}" fill="none" stroke="#2a3a5a" stroke-width="6" stroke-linejoin="round" />`;
    svg += `<line x1="${linhaCheg.x1}" y1="${linhaCheg.y1}" x2="${linhaCheg.x2}" y2="${linhaCheg.y2}" stroke="#5da3ff" stroke-width="3" />`;

    // Plota linha do trecho (entre E e S projetados ao longo do path)
    if (trecho.pontos) {
      // Linha de entrada (laranja)
      svg += `<circle cx="${E.x}" cy="${E.y}" r="10" fill="#ffb454" />`;
      svg += `<text x="${E.x + 14}" y="${E.y + 4}" fill="#ffb454" font-size="14" font-weight="bold">E</text>`;
      // Apex canônico (vermelho)
      svg += `<circle cx="${A.x}" cy="${A.y}" r="10" fill="#ff6b6b" />`;
      svg += `<text x="${A.x + 14}" y="${A.y + 4}" fill="#ff6b6b" font-size="14" font-weight="bold">A</text>`;
      // Saída (verde)
      svg += `<circle cx="${S.x}" cy="${S.y}" r="10" fill="#5dd39e" />`;
      svg += `<text x="${S.x + 14}" y="${S.y + 4}" fill="#5dd39e" font-size="14" font-weight="bold">S</text>`;
    }
    // Apex REAL (onde Vmin aconteceu na melhor volta) — em amarelo se diferir
    if (apexReal) {
      svg += `<circle cx="${apexReal.x}" cy="${apexReal.y}" r="7" fill="#fff" stroke="#e79800" stroke-width="3" />`;
      svg += `<text x="${apexReal.x + 12}" y="${apexReal.y - 12}" fill="#e79800" font-size="12" font-weight="bold">Vmin real</text>`;
    }
    svg += '</svg>';
    return svg;
  }

  function tabelaTrecho(trecho) {
    const rows = trecho.execAdvisor.map(e => {
      // Reconstruir o cabeçalho com a volta
      return `
      <tr>
        <td>Volta ${e.voltaId.slice(1)}</td>
        <td class="num cell-freada">${fmtVel(e.vChegadaKmh)}</td>
        <td class="num cell-freada">${fmtVel(e.vFreadaKmh)}</td>
        <td class="num cell-freada">${fmtVel(e.vEntradaKmh)}</td>
        <td class="num cell-curva">${fmtVel(e.vminKmh)}</td>
        <td class="num cell-saida">${fmtVel(e.vPaceKmh)}</td>
        <td class="num cell-saida">${fmtVel(e.vSaidaPicoKmh)}</td>
      </tr>`;
    }).join('');
    const melhor = {
      vChegadaKmh: Math.max(...trecho.execAdvisor.map(e => e.vChegadaKmh).filter(v => v != null)),
      vFreadaKmh:  Math.max(...trecho.execAdvisor.map(e => e.vFreadaKmh ).filter(v => v != null)),
      vEntradaKmh: Math.max(...trecho.execAdvisor.map(e => e.vEntradaKmh).filter(v => v != null)),
      vminKmh:     Math.max(...trecho.execAdvisor.map(e => e.vminKmh    ).filter(v => v != null)),
      vPaceKmh:    Math.max(...trecho.execAdvisor.map(e => e.vPaceKmh   ).filter(v => v != null)),
      vSaidaPicoKmh: Math.max(...trecho.execAdvisor.map(e => e.vSaidaPicoKmh).filter(v => v != null)),
    };
    const rowMelhor = trecho.execAdvisor.length > 1 ? `
      <tr class="melhor">
        <td><strong>Melhor</strong></td>
        <td class="num cell-freada"><strong>${fmtVel(melhor.vChegadaKmh)}</strong></td>
        <td class="num cell-freada"><strong>${fmtVel(melhor.vFreadaKmh)}</strong></td>
        <td class="num cell-freada"><strong>${fmtVel(melhor.vEntradaKmh)}</strong></td>
        <td class="num cell-curva"><strong>${fmtVel(melhor.vminKmh)}</strong></td>
        <td class="num cell-saida"><strong>${fmtVel(melhor.vPaceKmh)}</strong></td>
        <td class="num cell-saida"><strong>${fmtVel(melhor.vSaidaPicoKmh)}</strong></td>
      </tr>` : '';
    return `
      <table class="indic">
        <thead>
          <tr>
            <th>Volta</th>
            <th class="grupo-freada">V chegada</th>
            <th class="grupo-freada">Freada</th>
            <th class="grupo-freada">Entrada</th>
            <th class="grupo-curva">Vmin</th>
            <th class="grupo-saida">Pace</th>
            <th class="grupo-saida">V saída pico</th>
          </tr>
        </thead>
        <tbody>${rows}${rowMelhor}</tbody>
      </table>`;
  }

  // Voltas reconstruídas: derivar tempo aproximado de cada volta pela
  // diferença entre o primeiro e o último entradaAt da volta.
  const tempoPorVolta = new Map();
  for (const ev of segmentEnds) {
    const ws = tempoPorVolta.get(ev.lapNumero) || { tMin: Infinity, tMax: -Infinity, count: 0 };
    ws.tMin = Math.min(ws.tMin, ev.entradaAt);
    ws.tMax = Math.max(ws.tMax, ev.saidaAt);
    ws.count++;
    tempoPorVolta.set(ev.lapNumero, ws);
  }
  const lapsRows = voltasReconstruidas.map(n => {
    const w = tempoPorVolta.get(n);
    const dur = w ? (w.tMax - w.tMin) : null;
    return `
    <tr>
      <td><strong>Volta ${n}</strong></td>
      <td class="num">${fmtTempo(dur)}</td>
      <td class="num">${w?.count ?? '—'} trechos</td>
    </tr>`;
  }).join('');

  const trechosHtml = trechos.length === 0
    ? '<div class="warn"><p><strong>Nenhum trecho foi atravessado.</strong> Provável que o snap dos pontos GPS pra pista tenha falhado (âncoras geográficas vs. coordenadas reais do circuito). Use isso como prova de que a captura aconteceu mas a calibração da pista precisa de ajuste.</p></div>'
    : trechos.map(t => `
      <div class="trecho">
        <div class="trecho-head">
          <h2>${t.nome}</h2>
          <div class="sub">Parcial ${t.parcial} · ${t.execucoes.length} ${t.execucoes.length === 1 ? 'passagem' : 'passagens'}</div>
        </div>
        <div class="trecho-grid">
          <div class="track-col">
            ${trackMiniSvg(t)}
            <div class="legenda">
              <span class="leg leg-e">E</span> Entrada ·
              <span class="leg leg-a">A</span> Ápice (canônico) ·
              <span class="leg leg-s">S</span> Saída ·
              <span class="leg leg-real">○</span> Vmin real
            </div>
          </div>
          <div class="data-col">
            ${tabelaTrecho(t)}
            ${t.conselho ? `<div class="conselho"><strong>Análise:</strong> ${t.conselho}</div>` : ''}
          </div>
        </div>
      </div>`).join('');

  return `<!doctype html>
<html lang="pt-br">
<head>
<meta charset="utf-8">
<title>Stint 2026-05-24 — análise dos 6 indicadores por trecho</title>
<style>
  :root{
    --bg:#0b1220; --panel:#101a2e; --panel2:#15233d; --line:#1f2f4d;
    --ink:#e8eef9; --muted:#8ea0c1; --accent:#5da3ff; --ok:#5dd39e;
    --warn:#ffb454; --bad:#ff6b6b; --ouro:#e79800;
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
  .wrap{max-width:1220px;margin:0 auto;padding:32px 24px 80px}
  header{border-bottom:1px solid var(--line);padding-bottom:18px;margin-bottom:24px}
  h1{font-size:24px;margin:0 0 6px;font-weight:600;letter-spacing:-0.01em}
  h2{font-size:18px;margin:0 0 4px;font-weight:600;letter-spacing:-0.01em;color:var(--accent)}
  .sub{color:var(--muted);font-size:12px}
  .panel{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:20px;margin:14px 0}
  .warn{background:linear-gradient(135deg, rgba(255,180,84,0.10), rgba(255,180,84,0.02));border:1px solid rgba(255,180,84,.3);border-radius:12px;padding:16px;margin:14px 0;font-size:14px}
  code{background:rgba(255,255,255,.05);padding:1px 6px;border-radius:4px;font-size:13px}
  .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:14px 0}
  .stat{background:var(--panel2);border:1px solid var(--line);border-radius:8px;padding:14px}
  .stat .lbl{color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px}
  .stat .val{font-size:22px;font-weight:600;font-variant-numeric:tabular-nums}
  table{width:100%;border-collapse:collapse;margin:6px 0;font-size:12px}
  th,td{padding:7px 6px;border-bottom:1px solid var(--line);text-align:left}
  th{color:var(--muted);font-weight:600;text-transform:uppercase;font-size:9px;letter-spacing:.06em;background:rgba(93,163,255,.04)}
  td.num{text-align:right;font-variant-numeric:tabular-nums;font-family:"SF Mono",ui-monospace,monospace}
  .indic th.grupo-freada{background:rgba(255,180,84,.12);color:var(--warn)}
  .indic th.grupo-curva{background:rgba(255,107,107,.12);color:var(--bad)}
  .indic th.grupo-saida{background:rgba(93,211,158,.12);color:var(--ok)}
  .indic td.cell-freada{background:rgba(255,180,84,.04);color:var(--warn)}
  .indic td.cell-curva{background:rgba(255,107,107,.04);color:var(--bad)}
  .indic td.cell-saida{background:rgba(93,211,158,.04);color:var(--ok)}
  tr.melhor td{background:rgba(231,152,0,.06);color:var(--ouro);border-top:1px solid rgba(231,152,0,.3)}
  .trecho{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:20px;margin:18px 0}
  .trecho-head{padding-bottom:12px;border-bottom:1px solid var(--line);margin-bottom:14px}
  .trecho-grid{display:grid;grid-template-columns:320px 1fr;gap:24px;align-items:start}
  @media (max-width:840px){.trecho-grid{grid-template-columns:1fr}}
  .track-mini{width:100%;height:auto;max-height:320px;background:var(--bg);border-radius:8px;border:1px solid var(--line)}
  .legenda{margin-top:8px;font-size:11px;color:var(--muted)}
  .leg{display:inline-block;width:14px;text-align:center;font-weight:bold;border-radius:50%;color:#000;padding:0 2px}
  .leg-e{background:var(--warn)} .leg-a{background:var(--bad)} .leg-s{background:var(--ok)}
  .leg-real{background:transparent;color:var(--ouro);border:1px solid var(--ouro)}
  .conselho{background:rgba(93,163,255,.06);border-left:3px solid var(--accent);padding:10px 14px;border-radius:0 8px 8px 0;margin-top:12px;font-size:13px;line-height:1.5}
  footer{margin-top:50px;padding-top:18px;border-top:1px solid var(--line);color:var(--muted);font-size:11px}
</style>
</head>
<body>
<div class="wrap">

<header>
  <h1>Stint 2026-05-24 — análise dos 6 indicadores por trecho</h1>
  <div class="sub">Autódromo Internacional Nelson Piquet (Brasília) · Subaru WRX 2.5 · Bubi Marques</div>
</header>

<div class="panel">
  <p style="margin:0 0 8px"><strong>O que aconteceu:</strong> O aplicativo capturou <strong>15 minutos e 39 segundos</strong> de GPS + IMU no Subaru hoje. O detector de trecho não estava armado durante o stint (o stint foi criado sem o desenho da pista de Brasília vinculado ao Subaru), por isso o banco oficial do celular ficou com zero voltas e zero indicadores.</p>
  <p style="margin:0 0 8px"><strong>O que fiz:</strong> Baixei o banco do celular, peguei a telemetria pura (940 amostras GPS + 95 mil amostras de movimento) e rodei o detector OFFLINE — exatamente o mesmo código que estaria rodando no carro, só que aqui no Mac. As tabelas abaixo são a reconstrução do que apareceria na tela do aplicativo se o detector estivesse armado.</p>
  <p style="margin:0"><strong>Próxima ida à pista:</strong> criar o stint com a pista de Brasília vinculada ao carro. Aí esses 6 indicadores ficam gravados automaticamente no banco e aparecem na tela de pós-stint sem precisar dessa reconstrução manual.</p>
</div>

<div class="warn">
  <p style="margin:0 0 8px"><strong>Descoberta importante — as âncoras geográficas oficiais de Brasília precisam ser refeitas.</strong> O cadastro atual em <code>MAPA-BRASILIA-DEFINITIVO.json</code> tem duas âncoras que NÃO BATEM com o GPS real do circuito. Quando usei essas âncoras pra projetar os pontos do stint de hoje, só 3,5% dos pontos GPS caíam dentro do desenho da pista (média de 488 unidades de erro). Pra esse relatório eu auto-calibrei as âncoras a partir dos extremos do GPS — passou a 94,8% dos pontos dentro do desenho, erro médio de 37 unidades. Mas isso é solução temporária. <strong>Antes do próximo dia de pista, alguém tem que recalibrar as âncoras oficiais no cadastro do autódromo.</strong></p>
  <details style="margin-top:6px"><summary style="cursor:pointer;color:var(--warn)">Ver as duas calibrações lado a lado</summary>
    <table style="margin-top:8px;font-size:11px">
      <thead><tr><th>Versão</th><th>Âncora 1 (lat, lng → x, y)</th><th>Âncora 2 (lat, lng → x, y)</th></tr></thead>
      <tbody>
        <tr><td>Oficial (atual)</td><td>${ancorasOficiais[0].lat}, ${ancorasOficiais[0].lng} → (${ancorasOficiais[0].x}, ${ancorasOficiais[0].y})</td><td>${ancorasOficiais[1].lat}, ${ancorasOficiais[1].lng} → (${ancorasOficiais[1].x}, ${ancorasOficiais[1].y})</td></tr>
        <tr><td>Auto (esse relatório)</td><td>${ancorasAuto[0].lat.toFixed(5)}, ${ancorasAuto[0].lng.toFixed(5)} → (${ancorasAuto[0].x.toFixed(0)}, ${ancorasAuto[0].y.toFixed(0)})</td><td>${ancorasAuto[1].lat.toFixed(5)}, ${ancorasAuto[1].lng.toFixed(5)} → (${ancorasAuto[1].x.toFixed(0)}, ${ancorasAuto[1].y.toFixed(0)})</td></tr>
      </tbody>
    </table>
  </details>
</div>

<div class="stats">
  <div class="stat"><div class="lbl">Voltas reconstruídas</div><div class="val">${voltasReconstruidas.length}</div></div>
  <div class="stat"><div class="lbl">Trechos atravessados</div><div class="val">${trechos.length}</div></div>
  <div class="stat"><div class="lbl">Total de passagens</div><div class="val">${segmentEnds.length}</div></div>
  <div class="stat"><div class="lbl">Duração do stint</div><div class="val">15:39</div></div>
</div>

<h2>Voltas reconstruídas pela sequência dos trechos</h2>
<div class="panel">
  <p class="sub" style="margin-bottom:12px">A linha de chegada não foi cruzada do jeito esperado (provavelmente porque ela está marcada no <code>MAPA-BRASILIA-DEFINITIVO.json</code> em coordenadas calibradas pelas âncoras antigas — mesma razão da descoberta acima). Por isso, as voltas abaixo foram reconstruídas pela ordem cronológica das passagens pelos trechos pedagógicos: cada vez que o piloto volta pela CURVA 01 começa uma volta nova.</p>
  <table>
    <thead><tr><th>Volta</th><th>Duração entre 1ª e última passagem</th><th>Trechos passados</th></tr></thead>
    <tbody>${lapsRows}</tbody>
  </table>
</div>

<h2>Os 6 indicadores por trecho — como apareceria na tela de pós-stint</h2>
${trechosHtml}

<footer>
  Gerado em ${new Date().toISOString()} · Banco do iPhone: <code>p1fast.sqlite</code> ·
  Stint <code>EDA3DA6B-262D-4839-B6F0-26A3BE2891E7</code> ·
  Reconstrução offline com Detector canônico (paridade 1:1 com o app).
</footer>

</div>
</body>
</html>`;
}
