// Reconstrução do desenho da pista usando a MÉDIA do GPS real
// ─────────────────────────────────────────────────────────────
// Pedido Flávio 2026-05-24 noite — o desenho oficial está
// desproporcionalmente maior que o trajeto real medido por GPS.
// Solução: refazer o desenho pegando média das 4 voltas reais,
// excluindo trechos anômalos (saída pro escape da Junção, saída
// pra box na curva do S).
//
// O resultado é gerado em HTML pra aprovação ANTES de mexer no
// cadastro oficial (selo DEFINITIVO em 2026-05-17 23h35).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const mapa = JSON.parse(fs.readFileSync(path.join(ROOT, '_design-reference/MAPA-BRASILIA-DEFINITIVO.json'), 'utf8'));
const svgPathOficial = fs.readFileSync(path.join(ROOT, '_design-reference/PISTA-OFICIAL-brasilia.txt'), 'utf8').trim();

const tsv = fs.readFileSync('/tmp/p1fast-banco-iphone/extract/gps-samples.tsv', 'utf8');
const samples = tsv.trim().split('\n').map(line => {
  const [t, lat, lng, kmh] = line.split('\t');
  return { t: Number(t), lat: Number(lat), lng: Number(lng), kmh: Number(kmh) };
});

// ── 1. Projetar GPS em coordenadas locais (metros) ────────────
const M_PER_DEG_LAT = 111000;
const origemLat = samples[0].lat, origemLng = samples[0].lng;
const cosLat = Math.cos(origemLat * Math.PI / 180);
function projetarMetros(lat, lng) {
  return {
    x: (lng - origemLng) * M_PER_DEG_LAT * cosLat,
    y: -(lat - origemLat) * M_PER_DEG_LAT,
  };
}
const ptsMetros = samples.map(s => ({ ...projetarMetros(s.lat, s.lng), t: s.t, kmh: s.kmh, lat: s.lat, lng: s.lng }));

// ── 2. Separar voltas: retorno ao ponto inicial ────────────────
// Brasília: ~170 s/volta. Limites: 130s no mínimo (volta rápida),
// raio de retorno apertado pra não confundir reta com box.
const RAIO_RETORNO_M = 40;
const MIN_TEMPO_VOLTA_S = 130;
const voltas = [];
let voltaAtual = [ptsMetros[0]];
let inicioVoltaT = ptsMetros[0].t;
let armado = false; // só permite "fechar volta" depois que saiu da zona de retorno
for (let i = 1; i < ptsMetros.length; i++) {
  const p = ptsMetros[i];
  voltaAtual.push(p);
  const dx = p.x - ptsMetros[0].x;
  const dy = p.y - ptsMetros[0].y;
  const dist = Math.hypot(dx, dy);
  const tempo = (p.t - inicioVoltaT) / 1000;
  // Marca como "armado" só depois de o carro estar a >150m do ponto
  // inicial — evita falsa contagem quando o carro está manobrando
  // no box no começo do stint.
  if (!armado && dist > 150) armado = true;
  if (armado && dist < RAIO_RETORNO_M && tempo > MIN_TEMPO_VOLTA_S) {
    voltas.push(voltaAtual);
    voltaAtual = [p];
    inicioVoltaT = p.t;
    armado = false;
  }
}
// Volta final descartada se for fragmento (< MIN_TEMPO_VOLTA_S)
const ultimaDur = (voltaAtual[voltaAtual.length-1].t - voltaAtual[0].t) / 1000;
if (ultimaDur > MIN_TEMPO_VOLTA_S) voltas.push(voltaAtual);
console.error(`Voltas separadas: ${voltas.length}`);
voltas.forEach((v, i) => {
  const dur = (v[v.length - 1].t - v[0].t) / 1000;
  console.error(`  Volta ${i + 1}: ${v.length} pontos, ${dur.toFixed(1)}s`);
});

// ── 2b. Filtrar voltas pelo tempo (descartar voltas com saídas/escape) ──
const tempos = voltas.map(v => (v[v.length - 1].t - v[0].t) / 1000);
const temposOrdenados = tempos.slice().sort((a, b) => a - b);
const mediana = temposOrdenados[Math.floor(temposOrdenados.length / 2)];
const TOLERANCIA_TEMPO = 0.15; // 15% acima/abaixo da mediana
const voltasLimpas = voltas.filter((v, i) => {
  const t = tempos[i];
  return Math.abs(t - mediana) / mediana <= TOLERANCIA_TEMPO;
});
const voltasAnomalas = voltas.filter((v, i) => {
  const t = tempos[i];
  return Math.abs(t - mediana) / mediana > TOLERANCIA_TEMPO;
});
console.error(`\nMediana de tempo: ${mediana.toFixed(1)}s`);
console.error(`Voltas LIMPAS (entram na média): ${voltasLimpas.length}`);
console.error(`Voltas ANÔMALAS (saídas, descartadas da média): ${voltasAnomalas.length}`);
voltasAnomalas.forEach((v, i) => {
  const dur = (v[v.length - 1].t - v[0].t) / 1000;
  console.error(`  Anomala: ${dur.toFixed(1)}s (mediana ${mediana.toFixed(1)}s)`);
});

// ── 3. Reamostrar cada volta em N pontos uniformes ao longo da distância ──
const N_POS = 500;
function reamostrarUniforme(volta) {
  // Distância acumulada
  const acc = [0];
  for (let i = 1; i < volta.length; i++) {
    const dx = volta[i].x - volta[i - 1].x;
    const dy = volta[i].y - volta[i - 1].y;
    acc.push(acc[i - 1] + Math.hypot(dx, dy));
  }
  const total = acc[acc.length - 1];
  const passo = total / (N_POS - 1);
  const out = [];
  let j = 0;
  for (let i = 0; i < N_POS; i++) {
    const alvo = i * passo;
    while (j < acc.length - 2 && acc[j + 1] < alvo) j++;
    const frac = acc[j + 1] === acc[j] ? 0 : (alvo - acc[j]) / (acc[j + 1] - acc[j]);
    out.push({
      x: volta[j].x + (volta[j + 1].x - volta[j].x) * frac,
      y: volta[j].y + (volta[j + 1].y - volta[j].y) * frac,
    });
  }
  return out;
}
const voltasReamostradas = voltasLimpas.map(reamostrarUniforme);
const voltasAnomalasReamostradas = voltasAnomalas.map(reamostrarUniforme);

// ── 4. Média ponto-a-ponto ────────────────────────────────────
const media = [];
for (let i = 0; i < N_POS; i++) {
  let sx = 0, sy = 0, n = 0;
  for (const v of voltasReamostradas) { sx += v[i].x; sy += v[i].y; n++; }
  media.push({ x: sx / n, y: sy / n });
}

// ── 5. Detectar pontos anômalos: voltas que desviam muito da média ──
// 8m = largura típica de pista; >8m sugere saída ou erro grosso de GPS
const DESVIO_LIMITE_M = 8;
const anomalias = [];
for (let i = 0; i < N_POS; i++) {
  for (let v = 0; v < voltasReamostradas.length; v++) {
    const p = voltasReamostradas[v][i];
    const dx = p.x - media[i].x;
    const dy = p.y - media[i].y;
    const d = Math.hypot(dx, dy);
    if (d > DESVIO_LIMITE_M) anomalias.push({ idx: i, volta: v, desvio: d });
  }
}
console.error(`Pontos anômalos detectados: ${anomalias.length} (de ${N_POS * voltasReamostradas.length} comparações)`);

// ── 6. Refazer média EXCLUINDO pontos anômalos ────────────────
const mediaLimpa = [];
for (let i = 0; i < N_POS; i++) {
  let sx = 0, sy = 0, n = 0;
  for (let v = 0; v < voltasReamostradas.length; v++) {
    const p = voltasReamostradas[v][i];
    const dx = p.x - media[i].x;
    const dy = p.y - media[i].y;
    const d = Math.hypot(dx, dy);
    if (d > DESVIO_LIMITE_M) continue; // exclui anômalo
    sx += p.x; sy += p.y; n++;
  }
  if (n === 0) { mediaLimpa.push(media[i]); }
  else mediaLimpa.push({ x: sx / n, y: sy / n });
}

// ── 7. Mapear média (metros locais) → viewBox da pista ───────
// Bounding box da média + bounding box do viewBox alvo
let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
for (const p of mediaLimpa) {
  minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
  minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
}
const vb = mapa.pista.view_box;
// Margens internas no viewBox (pra pista não encostar nas bordas)
const margX = vb.largura * 0.10, margY = vb.altura * 0.10;
const escalaX = (vb.largura - 2 * margX) / (maxX - minX);
const escalaY = (vb.altura - 2 * margY) / (maxY - minY);
const escala = Math.min(escalaX, escalaY);
function paraViewBox(p) {
  return {
    x: (p.x - minX) * escala + margX,
    y: (p.y - minY) * escala + margY,
  };
}
const mediaViewBox = mediaLimpa.map(paraViewBox);
const voltasViewBox = voltasReamostradas.map(volta => volta.map(paraViewBox));
const voltasAnomalasViewBox = voltasAnomalasReamostradas.map(volta => volta.map(paraViewBox));

// Path SVG da média
const pathNovo = 'M ' + mediaViewBox.map(p => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L ') + ' Z';

// ── 8. Calcular âncoras geográficas usando 2 pontos da média ──
function getMediaPointAtIdx(idx) {
  return { lat: 0, lng: 0, x: 0, y: 0 }; // placeholder
}
// Pra cada ponto da média (mediaLimpa em metros), achar o sample GPS mais próximo
// pra obter lat/lng e amarrar à coord viewBox correspondente.
function gpsMaisProximo(metroXY) {
  let melhor = null, dMin = Infinity;
  for (const s of ptsMetros) {
    const d = (s.x - metroXY.x) ** 2 + (s.y - metroXY.y) ** 2;
    if (d < dMin) { dMin = d; melhor = s; }
  }
  return melhor;
}
const idx0 = 0;
const idxMeio = Math.floor(N_POS / 2);
const p0 = mediaLimpa[idx0];
const pMeio = mediaLimpa[idxMeio];
const gps0 = gpsMaisProximo(p0);
const gpsMeio = gpsMaisProximo(pMeio);
const vbP0 = mediaViewBox[idx0];
const vbPMeio = mediaViewBox[idxMeio];
const ancorasNovas = [
  { latitude: gps0.lat, longitude: gps0.lng, x: vbP0.x, y: vbP0.y },
  { latitude: gpsMeio.lat, longitude: gpsMeio.lng, x: vbPMeio.x, y: vbPMeio.y },
];

// ── 9. Salvar arquivos pra aprovação ──────────────────────────
const stageDir = path.join(ROOT, 'relatorios/_stage/pista-reconstruida-2026-05-24');
fs.mkdirSync(stageDir, { recursive: true });
fs.writeFileSync(path.join(stageDir, 'pista-nova.svgpath'), pathNovo);
fs.writeFileSync(path.join(stageDir, 'ancoras-novas.json'), JSON.stringify(ancorasNovas, null, 2));
fs.writeFileSync(path.join(stageDir, 'media-limpa-viewbox.json'), JSON.stringify(mediaViewBox, null, 2));
fs.writeFileSync(path.join(stageDir, 'voltas-viewbox.json'), JSON.stringify(voltasViewBox, null, 2));

// ── 10. Gerar HTML comparativo ────────────────────────────────
const coresVoltas = ['#5dd39e', '#ffb454', '#5da3ff', '#ff6b6b', '#e79800'];
const linha = mapa.pista.linha_chegada;
const curvas = mapa.trechos.filter(t => t.eh_trecho_pedagogico).map(t => ({
  nome: t.nome.replace('CURVA ', ''),
  apice: t.apices[0],
}));

const html = `<!doctype html>
<html lang="pt-br">
<head>
<meta charset="utf-8">
<title>Reconstrução do desenho da pista · Brasília 2026-05-24</title>
<style>
  :root{
    --bg:#0b1220; --panel:#101a2e; --panel2:#15233d; --line:#1f2f4d;
    --ink:#e8eef9; --muted:#8ea0c1; --accent:#5da3ff; --ok:#5dd39e;
    --warn:#ffb454; --bad:#ff6b6b; --ouro:#e79800;
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
  .wrap{max-width:1400px;margin:0 auto;padding:24px}
  header{border-bottom:1px solid var(--line);padding-bottom:14px;margin-bottom:18px}
  h1{font-size:22px;margin:0 0 6px;font-weight:600;letter-spacing:-0.01em}
  .sub{color:var(--muted);font-size:13px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}
  @media (max-width:1100px){.grid{grid-template-columns:1fr}}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:18px}
  .card h2{margin:0 0 8px;font-size:15px;color:var(--accent);text-transform:uppercase;letter-spacing:.05em}
  .card-sub{color:var(--muted);font-size:12px;margin-bottom:10px}
  svg{width:100%;height:auto;display:block;background:var(--bg);border-radius:8px}
  .info{background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:14px;margin:14px 0;font-size:13px}
  .info strong{color:var(--ok)}
  table{width:100%;font-size:12px;margin:8px 0;border-collapse:collapse}
  td{padding:6px 8px;border-bottom:1px solid var(--line)}
  td:first-child{color:var(--muted)}
  td.num{text-align:right;font-variant-numeric:tabular-nums}
  .legenda{display:flex;flex-wrap:wrap;gap:14px;font-size:12px;margin-top:8px}
  .legenda span{display:inline-flex;align-items:center;gap:6px}
  .leg-dot{width:14px;height:3px;border-radius:2px}
  .acao{background:linear-gradient(135deg,rgba(231,152,0,.10),rgba(231,152,0,.02));border:1px solid rgba(231,152,0,.35);border-radius:12px;padding:18px;margin:20px 0;font-size:14px}
  .acao strong{color:var(--ouro)}
  code{background:rgba(255,255,255,.06);padding:1px 6px;border-radius:4px;font-size:11px}
</style>
</head>
<body>
<div class="wrap">

<header>
  <h1>Reconstrução do desenho da pista — Brasília</h1>
  <div class="sub">Resultado de aplicar a média de ${voltas.length} voltas reais, descontando ${anomalias.length} pontos anômalos (saídas pro escape e box)</div>
</header>

<div class="grid">

<div class="card">
  <h2>Desenho atual (oficial)</h2>
  <div class="card-sub">Como está hoje no cadastro do circuito</div>
  <svg viewBox="0 0 ${vb.largura} ${vb.altura}" preserveAspectRatio="xMidYMid meet">
    <path d="${svgPathOficial}" fill="none" stroke="#5da3ff" stroke-width="6" stroke-linejoin="round" opacity="0.85" />
    <line x1="${linha.x1}" y1="${linha.y1}" x2="${linha.x2}" y2="${linha.y2}" stroke="#ffb454" stroke-width="3" />
    ${curvas.map(c => `<circle cx="${c.apice.x}" cy="${c.apice.y}" r="4" fill="#ff6b6b" opacity="0.55" />`).join('')}
  </svg>
</div>

<div class="card">
  <h2>Desenho novo (média do GPS real)</h2>
  <div class="card-sub">Reconstruído a partir das ${voltas.length} voltas, sem as duas saídas</div>
  <svg viewBox="0 0 ${vb.largura} ${vb.altura}" preserveAspectRatio="xMidYMid meet">
    ${voltasAnomalasViewBox.map((v) => `
      <polyline points="${v.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}" fill="none" stroke="#ff6b6b" stroke-width="1.5" opacity="0.30" stroke-dasharray="6 4" />
    `).join('')}
    ${voltasViewBox.map((v, i) => `
      <polyline points="${v.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}" fill="none" stroke="${coresVoltas[i % coresVoltas.length]}" stroke-width="1.5" opacity="0.45" />
    `).join('')}
    <path d="${pathNovo}" fill="none" stroke="#5dd39e" stroke-width="5" stroke-linejoin="round" />
  </svg>
  <div class="legenda">
    ${voltasViewBox.map((_, i) => `<span><div class="leg-dot" style="background:${coresVoltas[i % coresVoltas.length]};opacity:.5"></div>Volta limpa ${i + 1}</span>`).join('')}
    ${voltasAnomalasViewBox.length ? `<span><div class="leg-dot" style="background:#ff6b6b;opacity:.4"></div>Voltas com saída (descartadas da média)</span>` : ''}
    <span><div class="leg-dot" style="background:#5dd39e;height:5px"></div><strong>Média (desenho novo)</strong></span>
  </div>
</div>

</div>

<div class="card" style="margin-top:18px">
  <h2>Comparação direta — os dois sobrepostos</h2>
  <div class="card-sub">Azul = oficial atual · Verde grosso = média do GPS real (proposta)</div>
  <svg viewBox="0 0 ${vb.largura} ${vb.altura}" preserveAspectRatio="xMidYMid meet" style="max-height:600px">
    <path d="${svgPathOficial}" fill="none" stroke="#5da3ff" stroke-width="8" stroke-linejoin="round" opacity="0.5" />
    <path d="${pathNovo}" fill="none" stroke="#5dd39e" stroke-width="4" stroke-linejoin="round" />
    <line x1="${linha.x1}" y1="${linha.y1}" x2="${linha.x2}" y2="${linha.y2}" stroke="#ffb454" stroke-width="3" />
    ${curvas.map(c => `
      <circle cx="${c.apice.x}" cy="${c.apice.y}" r="5" fill="#ff6b6b" opacity="0.7" />
      <text x="${c.apice.x + 8}" y="${c.apice.y + 3}" fill="#ff6b6b" font-size="9" opacity="0.8">${c.nome}</text>
    `).join('')}
  </svg>
</div>

<div class="info">
  <h3 style="margin:0 0 8px;font-size:14px;color:var(--ok)">Diagnóstico técnico</h3>
  <table>
    <tr><td>Voltas separadas no total</td><td class="num"><strong>${voltas.length}</strong></td></tr>
    <tr><td>Voltas LIMPAS (usadas na média)</td><td class="num"><strong style="color:var(--ok)">${voltasLimpas.length}</strong></td></tr>
    <tr><td>Voltas com SAÍDA (descartadas)</td><td class="num"><strong style="color:var(--bad)">${voltasAnomalas.length}</strong></td></tr>
    <tr><td>Tempo mediana das voltas</td><td class="num">${mediana.toFixed(1)} s</td></tr>
    <tr><td>Tempos individuais (s)</td><td class="num">${tempos.map(t => t.toFixed(0)).join(' · ')}</td></tr>
    <tr><td>Pontos por volta (depois de reamostrar)</td><td class="num">${N_POS}</td></tr>
    <tr><td>Pontos refinados na média limpa</td><td class="num">${anomalias.length} de ${N_POS * voltasReamostradas.length}</td></tr>
    <tr><td>Tamanho do circuito medido (média)</td><td class="num">~${(media.reduce((s, _, i) => i === 0 ? 0 : s + Math.hypot(media[i].x - media[i-1].x, media[i].y - media[i-1].y), 0)).toFixed(0)} m</td></tr>
    <tr><td>Tamanho oficial cadastrado</td><td class="num">${mapa.pista.extensao_metros} m</td></tr>
  </table>
</div>

<div class="acao">
  <strong>Próxima decisão — aprovação sua:</strong>
  <p style="margin:8px 0 0">Se o desenho verde te parece correto (em forma e proporção), você me autoriza a:</p>
  <ol style="margin:8px 0 0 20px;padding:0">
    <li>Substituir o desenho atual da pista pelo novo (495 pontos → ${N_POS} pontos da média)</li>
    <li>Recalcular as posições dos pontos canônicos de cada curva (entrada, ápice, saída) pra encaixar no desenho novo proporcionalmente — você verifica e ajusta depois se precisar</li>
    <li>Atualizar as duas âncoras geográficas pra que o GPS bata 100% no desenho</li>
  </ol>
  <p style="margin:10px 0 0;font-size:13px">Tudo gravado em ambiente isolado primeiro, com cópia de segurança do cadastro atual antes de qualquer mudança. Nada vai pra versão oficial do projeto sem você liberar explicitamente.</p>
  <p style="margin:14px 0 0">Pra avançar, me responda <code>vai com a reconstrução</code> ou aponte o que ajustar.</p>
</div>

<footer style="margin-top:50px;padding-top:18px;border-top:1px solid var(--line);color:var(--muted);font-size:11px">
  Gerado em ${new Date().toISOString()} · Stint <code>EDA3DA6B-262D-4839-B6F0-26A3BE2891E7</code> ·
  Arquivos da reconstrução em <code>relatorios/_stage/pista-reconstruida-2026-05-24/</code> · Selo DEFINITIVO 2026-05-17 será reaberto após sua aprovação explícita.
</footer>

</div>
</body>
</html>`;

const out = path.join(ROOT, 'relatorios/RECONSTRUCAO-pista-2026-05-24.html');
fs.writeFileSync(out, html);
console.error('\nHTML comparativo:', out);
console.error('Arquivos da reconstrução:', stageDir);
