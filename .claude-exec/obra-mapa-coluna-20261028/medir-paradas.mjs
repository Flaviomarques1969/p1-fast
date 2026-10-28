// Só leitura: linha do tempo da gravação de 21/06 (a cada 10 s: km/h médio, volta, fração da volta) para achar box e paradas
import fs from 'node:fs';
const W = '/Users/imac/Projetos/p1fast-worktrees/tv-box-aovivo', arq = process.argv[2] || 'replay-hoje-2026-06-21.json', fator = +(process.argv[3] || 3.6);
const { criarCerebroGpsTv } = await import(W + '/web/command-box/cerebro/cerebro-gps-tv.js');
const j = JSON.parse(fs.readFileSync(W + '/web/command-box/fixtures/' + arq, 'utf8'));
const pts = (j.amostras || j).filter(a => a.tipo === 'gps').map(a => typeof a.kmh === 'number' ? { ...a, kmh: a.kmh / fator } : a);
const c = criarCerebroGpsTv({ guardarVoltas: true }), t0 = pts[0].tWall; let prox = t0, acc = [];
const linhas = [];
for (const p of pts) { c.feedGps(p); if (p.kmh != null) acc.push(p.kmh);
  if (p.tWall >= prox) { const s = c.snapshot(p.tWall); linhas.push(`${String(Math.round((p.tWall - t0) / 1000)).padStart(5)}s km/h ${acc.length ? (acc.reduce((a, b) => a + b, 0) / acc.length).toFixed(0).padStart(3) : '  -'} volta ${s.voltaAtual ? s.voltaAtual.n : 0} frac ${s.agora && s.agora.frac != null ? s.agora.frac.toFixed(3) : '-'} fechadas ${s.voltas.length}`); acc = []; prox += 10000; } }
console.log(linhas.join('\n'));
