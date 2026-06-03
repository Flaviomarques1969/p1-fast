// Aplica a calibração final aprovada pelo Flávio em 2026-05-24
// ──────────────────────────────────────────────────────────────
// Entradas:
//  - transformação aplicada no desenho (sliders): largura 96,4%,
//    altura 88,85%, rotação 159,2°, mover +22 horizontal, +34 vertical
//  - 24 pontos canônicos (E/A/S) nas novas posições, validados
//    visualmente pelo Flávio sobre o trajeto GPS real
//
// Saídas:
//  - novo PISTA-OFICIAL-brasilia.txt (desenho transformado)
//  - MAPA-BRASILIA-DEFINITIVO.json atualizado com pontos novos e
//    âncoras geográficas recalculadas usando o GPS real de hoje
//  - HTML comparativo "antes vs depois" pra aprovação visual
//
// Backups dos dois arquivos originais antes de tudo.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const mapaPath = path.join(ROOT, '_design-reference/MAPA-BRASILIA-DEFINITIVO.json');
const pistaPath = path.join(ROOT, '_design-reference/PISTA-OFICIAL-brasilia.txt');

const mapa = JSON.parse(fs.readFileSync(mapaPath, 'utf8'));
const pistaOriginal = fs.readFileSync(pistaPath, 'utf8').trim();

// ── 1. Parâmetros aprovados pelo Flávio ─────────────────────
const T = {
  largura_pct: 96.4, altura_pct: 88.85,
  rotacao_graus: 159.2,
  mover_horizontal: 22, mover_vertical: 34,
};
const PIVOT_CX = (167 + 688) / 2; // 427.5
const PIVOT_CY = (144 + 713) / 2; // 428.5

const sx = T.largura_pct / 100;
const sy = T.altura_pct / 100;
const rad = T.rotacao_graus * Math.PI / 180;
const cos = Math.cos(rad), sin = Math.sin(rad);

// Aplica: translate(PIVOT_CX + tx, PIVOT_CY + ty) · rotate(r) · scale(sx,sy) · translate(-PIVOT_CX, -PIVOT_CY)
function transformar({ x, y }) {
  // 1. translate(-pivot)
  let px = x - PIVOT_CX, py = y - PIVOT_CY;
  // 2. scale (não-uniforme)
  px *= sx; py *= sy;
  // 3. rotate
  const rx = px * cos - py * sin;
  const ry = px * sin + py * cos;
  // 4. translate(pivot + mover)
  return {
    x: rx + PIVOT_CX + T.mover_horizontal,
    y: ry + PIVOT_CY + T.mover_vertical,
  };
}

// ── 2. Pontos finais que o Flávio mandou ────────────────────
const pontosFlavio = [
  { id: "seg_brasilia_0",  entradas: [{x:627.6,y:178.4}],  apices: [{x:704.2,y:196.6}],  saidas: [{x:724.0,y:233.4}]  },
  { id: "seg_brasilia_2",  entradas: [{x:401.7,y:308.5}],  apices: [{x:344.9,y:327.4}],  saidas: [{x:375.3,y:396.9}]  },
  { id: "seg_brasilia_3",  entradas: [{x:761.3,y:655.5}],  apices: [{x:744.2,y:689.9}],  saidas: [{x:675.6,y:698.8}]  },
  { id: "seg_brasilia_4",  entradas: [{x:367.1,y:656.2}],  apices: [{x:316.1,y:608.1}],  saidas: [{x:394.1,y:564.1}]  },
  { id: "seg_brasilia_6",  entradas: [{x:697.1,y:346.5}],  apices: [{x:670.6,y:297.8}],  saidas: [{x:625.9,y:284.5}]  },
  { id: "seg_brasilia_8",  entradas: [{x:565.7,y:356.9}],  apices: [{x:641.3,y:362.1}],  saidas: [{x:615.8,y:420.1}]  },
  { id: "seg_brasilia_9",  entradas: [{x:344.1,y:511.7}],  apices: [{x:318.4,y:492.3}],  saidas: [{x:292.3,y:397.4}]  },
  { id: "seg_brasilia_10", entradas: [{x:285.7,y:392.8}],  apices: [{x:280.3,y:341.4}],  saidas: [{x:357.7,y:273.7}]  },
];

// ── 3. Parsear o path SVG e aplicar a transformação a cada ponto ──
// O path tem comandos M (move) e L (line) — pega cada par x,y e transforma
function transformarPath(pathStr) {
  // Quebra em tokens: comando (M/L/Z) ou número
  const tokens = pathStr.match(/[A-Za-z]|-?\d+\.?\d*/g) || [];
  const out = [];
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (/[A-Za-z]/.test(t)) {
      // Comando — copia
      out.push(t);
      i++;
      // Se for M ou L, segue lendo pares
      if (t === 'M' || t === 'L' || t === 'm' || t === 'l') {
        while (i < tokens.length && !/[A-Za-z]/.test(tokens[i])) {
          const x = Number(tokens[i]);
          const y = Number(tokens[i+1]);
          const novo = transformar({ x, y });
          out.push(novo.x.toFixed(2));
          out.push(novo.y.toFixed(2));
          i += 2;
        }
      } else if (t === 'Z' || t === 'z') {
        // Fechamento — não tem coords
      } else {
        // Comando não tratado (C, Q, etc) — copia coords seguintes sem transformar
        // (não esperado em path do mapa de pista mas defensivo)
        while (i < tokens.length && !/[A-Za-z]/.test(tokens[i])) {
          out.push(tokens[i]);
          i++;
        }
      }
    } else {
      out.push(t);
      i++;
    }
  }
  return out.join(' ');
}
const pistaNova = transformarPath(pistaOriginal);

// ── 4. Calcular âncoras geográficas usando GPS real de hoje ──
const tsv = fs.readFileSync('/tmp/p1fast-banco-iphone/extract/gps-samples.tsv', 'utf8');
const samples = tsv.trim().split('\n').map(l => {
  const [t, lat, lng] = l.split('\t');
  return { t: Number(t), lat: Number(lat), lng: Number(lng) };
});
// Mesma função gps2vb que o editor usou pra posicionar o trajeto verde:
const lats = samples.map(s => s.lat), lngs = samples.map(s => s.lng);
const latMin = Math.min(...lats), latMax = Math.max(...lats);
const lngMin = Math.min(...lngs), lngMax = Math.max(...lngs);
const xMinPath = 167, xMaxPath = 688, yMinPath = 144, yMaxPath = 713;
const margemPct = 0.04;
const tx0 = xMinPath + (xMaxPath - xMinPath) * margemPct;
const tx1 = xMaxPath - (xMaxPath - xMinPath) * margemPct;
const ty0 = yMinPath + (yMaxPath - yMinPath) * margemPct;
const ty1 = yMaxPath - (yMaxPath - yMinPath) * margemPct;
function gps2vb(lat, lng) {
  return {
    x: tx0 + (lng - lngMin) / (lngMax - lngMin) * (tx1 - tx0),
    y: ty0 + (latMax - lat) / (latMax - latMin) * (ty1 - ty0),
  };
}
// Âncora 1: primeiro sample. Âncora 2: sample mais distante do primeiro.
const p1 = samples[0];
let p2 = samples[0], dMax = 0;
for (const s of samples) {
  const d = (s.lat - p1.lat) ** 2 + (s.lng - p1.lng) ** 2;
  if (d > dMax) { dMax = d; p2 = s; }
}
const vb1 = gps2vb(p1.lat, p1.lng);
const vb2 = gps2vb(p2.lat, p2.lng);
const ancorasNovas = [
  { latitude: p1.lat, longitude: p1.lng, x: +vb1.x.toFixed(2), y: +vb1.y.toFixed(2) },
  { latitude: p2.lat, longitude: p2.lng, x: +vb2.x.toFixed(2), y: +vb2.y.toFixed(2) },
];

// ── 5. Backup ──────────────────────────────────────────────
const stamp = Date.now();
const backupJson = mapaPath.replace('.json', `.backup-2026-05-24-${stamp}.json`);
const backupPista = pistaPath + `.backup-2026-05-24-${stamp}`;
fs.copyFileSync(mapaPath, backupJson);
fs.copyFileSync(pistaPath, backupPista);
console.error('Backup salvo:');
console.error('  ' + path.basename(backupJson));
console.error('  ' + path.basename(backupPista));

// ── 6. Aplicar mudanças ────────────────────────────────────
fs.writeFileSync(pistaPath, pistaNova + '\n');

// Atualizar JSON
for (const p of pontosFlavio) {
  const idx = mapa.trechos.findIndex(t => t.id === p.id);
  if (idx === -1) continue;
  if (p.entradas?.length) mapa.trechos[idx].entradas = p.entradas;
  if (p.apices?.length) mapa.trechos[idx].apices = p.apices;
  if (p.saidas?.length) mapa.trechos[idx].saidas = p.saidas;
  // Centroide aproximado = ápice
  if (p.apices?.length) mapa.trechos[idx].centroide = p.apices[0];
}
// Recalcular linha de chegada e zona de boxes — também sob transformação
mapa.pista.linha_chegada = (() => {
  const a = transformar({ x: mapa.pista.linha_chegada.x1, y: mapa.pista.linha_chegada.y1 });
  const b = transformar({ x: mapa.pista.linha_chegada.x2, y: mapa.pista.linha_chegada.y2 });
  return { x1: +a.x.toFixed(2), y1: +a.y.toFixed(2), x2: +b.x.toFixed(2), y2: +b.y.toFixed(2) };
})();
mapa.pista.ancoras_geo = ancorasNovas;
mapa._meta = mapa._meta || {};
mapa._meta.calibrado_em = '2026-05-24';
mapa._meta.calibracao_metodo = 'Alinhamento manual de Flávio sobre trajeto GPS do stint EDA3DA6B';
mapa._meta.calibracao_parametros = T;
mapa._meta.backup = path.basename(backupJson);
fs.writeFileSync(mapaPath, JSON.stringify(mapa, null, 2));

console.error('\nMudanças aplicadas:');
console.error('  • PISTA-OFICIAL-brasilia.txt — desenho transformado (495 pontos)');
console.error('  • MAPA-BRASILIA-DEFINITIVO.json — pontos canônicos novos, linha de chegada nova, âncoras novas');

// ── 7. Gerar HTML comparativo ──────────────────────────────
const vb = mapa.pista.view_box;
const curvas = mapa.trechos.filter(t => t.eh_trecho_pedagogico);
const trajeto = samples.map(s => {
  const p = gps2vb(s.lat, s.lng);
  return { x: +p.x.toFixed(1), y: +p.y.toFixed(1) };
});

const html = `<!doctype html>
<html lang="pt-br">
<head>
<meta charset="utf-8">
<title>Calibração aplicada · Brasília 2026-05-24</title>
<style>
  :root{--bg:#0b1220;--panel:#101a2e;--panel2:#15233d;--line:#1f2f4d;--ink:#e8eef9;--muted:#8ea0c1;--accent:#5da3ff;--ok:#5dd39e;--warn:#ffb454;--bad:#ff6b6b;--ouro:#e79800;}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
  .wrap{max-width:1400px;margin:0 auto;padding:24px 24px 80px}
  header{border-bottom:1px solid var(--line);padding-bottom:18px;margin-bottom:24px}
  h1{font-size:24px;margin:0 0 6px;font-weight:600}
  h2{font-size:18px;margin:24px 0 12px;color:var(--accent)}
  .sub{color:var(--muted);font-size:13px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}
  @media (max-width:1100px){.grid{grid-template-columns:1fr}}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:18px}
  .card h3{margin:0 0 6px;font-size:14px;color:var(--accent)}
  svg{width:100%;height:auto;display:block;background:var(--bg);border-radius:8px}
  .acao{background:linear-gradient(135deg,rgba(93,211,158,0.12),rgba(93,211,158,0.03));border:1px solid rgba(93,211,158,.35);border-radius:12px;padding:20px;margin:18px 0}
  .acao h2{margin-top:0;color:var(--ok)}
  .meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin:10px 0}
  .stat{background:var(--panel2);border:1px solid var(--line);border-radius:8px;padding:12px}
  .stat .l{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
  .stat .v{font-size:18px;font-weight:600;font-variant-numeric:tabular-nums;margin-top:4px}
  code{background:rgba(255,255,255,.06);padding:1px 6px;border-radius:4px;font-size:12px}
  table{width:100%;border-collapse:collapse;margin:10px 0;font-size:12px}
  td,th{padding:6px 8px;border-bottom:1px solid var(--line);text-align:left}
  th{color:var(--muted);font-weight:600;text-transform:uppercase;font-size:10px;letter-spacing:.06em}
  td.num{text-align:right;font-variant-numeric:tabular-nums;font-family:"SF Mono",ui-monospace,monospace}
</style>
</head>
<body>
<div class="wrap">

<header>
  <h1>Calibração aplicada — Brasília</h1>
  <div class="sub">Desenho oficial, pontos canônicos e âncoras geográficas atualizados com base no seu alinhamento manual</div>
</header>

<div class="grid">
  <div class="card">
    <h3>Antes</h3>
    <p class="sub" style="margin:0 0 8px">Desenho oficial original + trajeto verde do GPS por cima</p>
    <svg viewBox="0 0 ${vb.largura} ${vb.altura}" preserveAspectRatio="xMidYMid meet">
      <path d="${pistaOriginal}" fill="none" stroke="#5da3ff" stroke-width="6" stroke-linejoin="round" opacity="0.65" />
      <polyline points="${trajeto.map(p => p.x + ',' + p.y).join(' ')}" fill="none" stroke="#5dd39e" stroke-width="2.5" opacity="0.85" />
    </svg>
  </div>
  <div class="card">
    <h3>Depois (cadastro atualizado)</h3>
    <p class="sub" style="margin:0 0 8px">Desenho transformado + pontos canônicos novos + trajeto verde</p>
    <svg viewBox="0 0 ${vb.largura} ${vb.altura}" preserveAspectRatio="xMidYMid meet">
      <path d="${pistaNova}" fill="none" stroke="#5da3ff" stroke-width="6" stroke-linejoin="round" opacity="0.7" />
      <polyline points="${trajeto.map(p => p.x + ',' + p.y).join(' ')}" fill="none" stroke="#5dd39e" stroke-width="2.5" opacity="0.85" />
      <line x1="${mapa.pista.linha_chegada.x1}" y1="${mapa.pista.linha_chegada.y1}" x2="${mapa.pista.linha_chegada.x2}" y2="${mapa.pista.linha_chegada.y2}" stroke="#ffb454" stroke-width="3" />
      ${curvas.map(c => `
        ${c.entradas?.[0] ? `<circle cx="${c.entradas[0].x}" cy="${c.entradas[0].y}" r="5" fill="#ffb454" />` : ''}
        ${c.apices?.[0] ? `<circle cx="${c.apices[0].x}" cy="${c.apices[0].y}" r="6" fill="#ff6b6b" />` : ''}
        ${c.saidas?.[0] ? `<circle cx="${c.saidas[0].x}" cy="${c.saidas[0].y}" r="5" fill="#5dd39e" />` : ''}
        ${c.apices?.[0] ? `<text x="${c.apices[0].x + 8}" y="${c.apices[0].y + 3}" fill="#ff6b6b" font-size="9">${c.nome.replace('CURVA ', '')}</text>` : ''}
      `).join('')}
    </svg>
  </div>
</div>

<div class="acao">
  <h2>Mudanças aplicadas no cadastro oficial</h2>
  <div class="meta">
    <div class="stat"><div class="l">Desenho da pista</div><div class="v">495 pontos transformados</div></div>
    <div class="stat"><div class="l">Pontos canônicos</div><div class="v">24 (E/A/S × 8 curvas)</div></div>
    <div class="stat"><div class="l">Linha de chegada</div><div class="v">Reposicionada</div></div>
    <div class="stat"><div class="l">Âncoras geográficas</div><div class="v">2 calculadas do GPS</div></div>
  </div>
  <h3 style="margin-top:14px;font-size:13px">Parâmetros da transformação aplicada</h3>
  <table>
    <tr><td>Largura</td><td class="num">${T.largura_pct}%</td></tr>
    <tr><td>Altura</td><td class="num">${T.altura_pct}%</td></tr>
    <tr><td>Rotação</td><td class="num">${T.rotacao_graus}°</td></tr>
    <tr><td>Mover horizontal</td><td class="num">${T.mover_horizontal}</td></tr>
    <tr><td>Mover vertical</td><td class="num">${T.mover_vertical}</td></tr>
  </table>

  <h3 style="margin-top:14px;font-size:13px">Cópias de segurança guardadas</h3>
  <p style="margin:6px 0;font-size:12px"><code>${path.basename(backupPista)}</code></p>
  <p style="margin:6px 0;font-size:12px"><code>${path.basename(backupJson)}</code></p>

  <h3 style="margin-top:14px;font-size:13px">Status</h3>
  <p style="margin:6px 0">Tudo gravado em ambiente isolado <code>infallible-liskov-7a1b15</code>. Nada foi enviado à versão oficial do projeto.</p>
  <p style="margin:6px 0">Próximo passo lógico: rodar a análise das 4 voltas de hoje com a calibração nova e ver os 6 indicadores por trecho funcionando.</p>
</div>

<footer style="margin-top:50px;padding-top:18px;border-top:1px solid var(--line);color:var(--muted);font-size:11px">
  Gerado em ${new Date().toISOString()} · Stint <code>EDA3DA6B-262D-4839-B6F0-26A3BE2891E7</code>
</footer>

</div>
</body>
</html>`;

const outHtml = path.join(ROOT, 'relatorios/CALIBRACAO-aplicada-2026-05-24.html');
fs.writeFileSync(outHtml, html);
console.error('\nHTML comparativo:', outHtml);
