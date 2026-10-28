// Só leitura: roda o cérebro da TV na gravação de 21/06 (com a mesma correção de km/h da TV) e lista cada volta,
// o que acontece antes da 1ª e depois da última, e as perdas por trecho de cada volta contra o melhor de TODAS.
import fs from 'node:fs';
const W = '/Users/imac/Projetos/p1fast-worktrees/tv-box-aovivo';
const { criarCerebroGpsTv } = await import(W + '/web/command-box/cerebro/cerebro-gps-tv.js');
const j = JSON.parse(fs.readFileSync(W + '/web/command-box/fixtures/replay-hoje-2026-06-21.json', 'utf8'));
const pts = j.amostras.filter(a => a.tipo === 'gps').map(a => typeof a.kmh === 'number' ? { ...a, kmh: a.kmh / 3.6 } : a);
const c = criarCerebroGpsTv({ guardarVoltas: true }); for (const p of pts) c.feedGps(p);
const s = c.snapshot(pts.at(-1).tWall), t0 = pts[0].tWall;
const kmhMax = (a, b) => Math.max(...pts.filter(p => p.tWall >= a && p.tWall <= b && p.kmh != null).map(p => p.kmh));
console.log('pontos', pts.length, 'duração', ((pts.at(-1).tWall - t0) / 1000).toFixed(0), 's; trechos', s.trechos.lista.length, 'erro', s.trechos.erro || '-');
console.log('voltas fechadas', s.voltas.length);
for (const v of s.voltas) console.log(' volta', v.n, 'tempo', v.tempoS, 'setores', JSON.stringify(v.setoresS), 'trechos', v.trechos ? v.trechos.map(m => m.tempoS).join(' ') : '-', Object.keys(v).join(','));
console.log('volta em curso', JSON.stringify(s.voltaAtual));
