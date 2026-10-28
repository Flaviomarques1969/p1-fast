// prova de tela da FAIXA FIXA (Flávio 28/10: "tem que ficar absolutamente fixo — marcou, fica naquele lugar"):
// gravação real 21/06 inteira na TV (1920×1080), foto a cada 150 ms, e em TODAS as fotos:
//  1) caixa do bloco e caixa do gráfico iguais (o cabeçalho não empurra o gráfico);
//  2) rótulo da escala e linhas de grade iguais (escala única da sessão);
//  3) linha DOURADA (melhor) com os mesmos pontos enquanto a melhor for a mesma volta;
//  4) linha AZUL (atual): dentro da mesma volta, todo ponto já desenhado (menos o da casa em curso) fica no mesmo x,y;
//  5) todo ponto dentro da área da velocidade (y entre 2 e 54 do desenho).
// Controle: argv[2] = outra página (a TV antes do conserto) tem de REPROVAR.
import { createRequire } from 'node:module';
const require = createRequire('/Users/imac/Documents/Sistemas/cdai/frontend/package.json');
const { chromium } = require('playwright');
const base = process.argv[2] || 'http://127.0.0.1:5201/_design-reference/mockup-command-box-vista-piloto.html';
const erros = [], errosPg = [];
const nav = await chromium.launch({ headless: true });
const pg = await nav.newPage({ viewport: { width: 1920, height: 1080 } });
await pg.route('**/api/room', r => r.abort());
pg.on('pageerror', e => errosPg.push(e.message));
await pg.goto(base + '?tv=1&replay-gps=21-06&speed=10&fim=parar');
const am = []; let parado = 0, ultimo = null;
for(let k = 0; k < 1500 && parado < 15; k++){
  await pg.waitForTimeout(150);
  const a = await pg.evaluate(() => {
    const f = document.querySelector('[data-tv-faixa]'); if(!f || !f.querySelector('svg')) return null;
    const r = f.getBoundingClientRect(), gr = f.querySelector('.fx-g').getBoundingClientRect();
    const pts = (sel) => [...f.querySelectorAll(sel)].flatMap(p => p.getAttribute('points').split(' '));
    const sub = f.querySelector('.fx-s'), m = sub && /melhor válida v(\d+)/.exec(sub.textContent), va = sub && /^v(\d+)/.exec(sub.textContent);
    return { caixa: [r.x, r.y, r.width, r.height].map(Math.round).join(','), graf: [gr.x, gr.y, gr.width, gr.height].map(Math.round).join(','),
      escala: (f.querySelector('[data-fx-escala]') || {}).textContent, grade: [...f.querySelectorAll('.fx-grade')].map(l => l.getAttribute('y1')).join(','),
      melhorN: m ? +m[1] : null, melhor: pts('.fx-melhor polyline'), atualN: va ? +va[1] : null,
      atual: pts('.fx-atual polyline[stroke="#38BCFF"]'), cursor: (f.querySelector('.fx-cursor') || { getAttribute: () => null }).getAttribute('x1') };
  });
  if(!a) continue;
  const chave = a.cursor + '|' + a.atual.length; parado = chave === ultimo ? parado + 1 : 0; ultimo = chave;
  am.push(a);
}
await nav.close();
console.log(am.length + ' fotos com a faixa desenhada; voltas atuais vistas ' + [...new Set(am.map(a => a.atualN))].join(',') + '; melhor ' + [...new Set(am.map(a => a.melhorN))].join(','));
if(am.length < 200) erros.push('poucas fotos (' + am.length + ') — régua cega');
const um = (k) => { const v = [...new Set(am.map(a => a[k]))]; if(v.length !== 1) erros.push(k + ' mudou ' + v.length + ' vezes: ' + v.slice(0, 5).join(' / ')); else console.log(k + ': fixo «' + v[0] + '»'); };
['caixa', 'graf', 'escala', 'grade'].forEach(um);
let compMelhor = 0, compAtual = 0, foraY = 0;
for(let i = 1; i < am.length; i++){
  const p = am[i - 1], a = am[i];
  if(p.melhorN != null && p.melhorN === a.melhorN){ compMelhor++; if(p.melhor.join() !== a.melhor.join()) erros.length < 12 && erros.push('melhor v' + a.melhorN + ' mudou de pontos entre fotos ' + (i - 1) + ' e ' + i); }
  if(p.atualN != null && p.atualN === a.atualN && p.atual.length > 1){
    compAtual++;
    const fixos = p.atual.slice(0, -1), agora = a.atual.slice(0, fixos.length);
    if(fixos.join() !== agora.join()){ const j = fixos.findIndex((x, q) => x !== agora[q]);
      erros.length < 12 && erros.push('atual v' + a.atualN + ': ponto já desenhado mudou (foto ' + i + ', ponto ' + j + ': ' + fixos[j] + ' → ' + agora[j] + ')'); }
  }
}
for(const a of am) for(const q of a.atual.concat(a.melhor)){ const y = +q.split(',')[1]; if(!(y >= 2 && y <= 54)) foraY++; }
if(foraY) erros.push(foraY + ' pontos fora da área da velocidade');
console.log('comparações: melhor ' + compMelhor + ' · atual ' + compAtual);
if(compMelhor < 50 || compAtual < 150) erros.push('poucas comparações (melhor ' + compMelhor + ', atual ' + compAtual + ') — régua cega');
if(errosPg.length) erros.push('erro na página: ' + errosPg.slice(0, 2).join(' | '));
console.log(erros.length ? 'REPROVADO\n - ' + erros.join('\n - ') : 'APROVADO');
process.exit(erros.length ? 1 : 0);
