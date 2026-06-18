// gerar-polilinha-cb.mjs — extrai o traço (#track) do Command Box e gera uma POLILINHA densa
// no espaço do CB (viewBox 130 110 580 660), pra que a NUVEM (node, sem navegador) consiga
// converter posição (x,y) -> fração de arco 0..1 sem depender de getPointAtLength do SVG.
// Reusa o MESMO leitor de traço (cúbicas) provado no recalibrador. Saída: web/command-box/pista-cb-polyline.js
import { readFileSync, writeFileSync } from 'node:fs';

const HTML = readFileSync('_design-reference/mockup-command-box-vista-piloto.html', 'utf8');
const m = /<path[^>]*id="track"[^>]*\sd="([^"]+)"/.exec(HTML);
if (!m) { console.error('NAO achei o #track no mockup'); process.exit(1); }
const D = m[1];

// mesmo parser do tools/recalibrar-mapa-command-box.mjs (M + cúbicas C ... Z)
function parseTrackPath(d) {
  const toks = d.replace(/,/g, ' ').trim().split(/\s+/);
  const pts = []; let i = 0, cx = 0, cy = 0, sx = 0, sy = 0;
  function cubic(p0, p1, p2, p3, k) {
    for (let s = 1; s <= k; s++) { const t = s/k, u = 1-t;
      pts.push([ u*u*u*p0[0]+3*u*u*t*p1[0]+3*u*t*t*p2[0]+t*t*t*p3[0],
                 u*u*u*p0[1]+3*u*u*t*p1[1]+3*u*t*t*p2[1]+t*t*t*p3[1] ]); }
  }
  while (i < toks.length) { const c = toks[i];
    if (c === 'M') { cx=+toks[i+1]; cy=+toks[i+2]; sx=cx; sy=cy; pts.push([cx,cy]); i+=3; }
    else if (c === 'C') { const p1=[+toks[i+1],+toks[i+2]], p2=[+toks[i+3],+toks[i+4]], p3=[+toks[i+5],+toks[i+6]];
      cubic([cx,cy],p1,p2,p3,8); cx=p3[0]; cy=p3[1]; i+=7; }
    else if (c === 'Z' || c === 'z') { if (cx!==sx||cy!==sy) pts.push([sx,sy]); i+=1; }
    else i+=1;
  }
  return pts;
}

const pts = parseTrackPath(D).map(p => [ +p[0].toFixed(2), +p[1].toFixed(2) ]);
const out = `// pista-cb-polyline.js — GERADO por tools/gerar-polilinha-cb.mjs.
// Polilinha densa do traço do Command Box (#track, viewBox 130 110 580 660).
// Mesma geometria que o navegador desenha — aqui em forma de pontos pra a NUVEM (node) e
// qualquer cliente converter (x,y) -> FRAÇÃO DE ARCO 0..1 sem precisar do SVG.
export const POLILINHA = ${JSON.stringify(pts)};
const _cum = [0];
for (let i = 1; i < POLILINHA.length; i++) {
  _cum.push(_cum[i-1] + Math.hypot(POLILINHA[i][0]-POLILINHA[i-1][0], POLILINHA[i][1]-POLILINHA[i-1][1]));
}
export const COMPRIMENTO = _cum[_cum.length-1] || 1;
// (x,y) -> fração de arco 0..1: projeta no segmento mais próximo (mesma conta do recalibrador, sFracOf).
export function fracDe(x, y) {
  let m = Infinity, best = 0;
  for (let i = 1; i < POLILINHA.length; i++) {
    const a = POLILINHA[i-1], b = POLILINHA[i];
    const vx=b[0]-a[0], vy=b[1]-a[1], wx=x-a[0], wy=y-a[1];
    const sq=vx*vx+vy*vy||1; let t=(wx*vx+wy*vy)/sq; t=t<0?0:(t>1?1:t);
    const dx=a[0]+t*vx-x, dy=a[1]+t*vy-y, d=dx*dx+dy*dy;
    if (d<m){ m=d; best=_cum[i-1]+t*Math.hypot(vx,vy); }
  }
  return best / COMPRIMENTO;
}
`;
writeFileSync('web/command-box/pista-cb-polyline.js', out);
console.log('GERADO web/command-box/pista-cb-polyline.js · pontos =', pts.length);
