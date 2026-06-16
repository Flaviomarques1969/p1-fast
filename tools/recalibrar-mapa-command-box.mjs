// recalibrar-mapa-command-box.mjs
// RECALIBRAÇÃO (item 1 do plano da bolinha, Flávio 2026-06-16):
// Acha a transformação de semelhança (escala + rotação + posição + espelho) que faz o
// trajeto GPS de Brasília encaixar no traço DESENHADO da pista do Command Box
// (SVG próprio, viewBox "130 110 580 660"), que é um espaço diferente do desenho oficial
// usado no cockpit (823×799, pista-oficial-brasilia.js).
//
// Estratégia: reusar a amarração JÁ PROVADA GPS→desenho-oficial (geoParaDesenho, 823×799,
// erro mediano 5,7 px) e só acrescentar a transformação 823×799 → espaço do Command Box,
// estimada casando os 495 pontos do desenho oficial (PONTOS_DESENHO) com o traço do CB.
// Composição final: geoParaCommandBox(lat,lng) = T( geoParaDesenho(lat,lng) ).
//
// Valida projetando uma VOLTA REAL gravada do Bubi e medindo a distância de cada ponto
// projetado ao traço do CB (em pixels e em larguras de pista).
//
// SÓ LEITURA + escreve artefatos novos (não toca no mockup). Rodar:
//   node tools/recalibrar-mapa-command-box.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { geoParaDesenho, PONTOS_DESENHO } from '../web/cockpit/pista-oficial-brasilia.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TRACK_D = readFileSync('/tmp/recal-cb/track-d.txt', 'utf8').trim();
const N = 360;                 // amostras por volta para o casamento
const STROKE_W = 22;           // largura do asfalto desenhado no CB (raio 11 px, ver mockup off-track)

// ---------- 1. parse do traço SVG (M + cúbicas C ... Z) -> pontos no espaço do CB ----------
function parseTrackPath(d) {
  const toks = d.replace(/,/g, ' ').trim().split(/\s+/);
  const pts = [];
  let i = 0, cx = 0, cy = 0, sx = 0, sy = 0;
  function cubic(p0, p1, p2, p3, k) {
    for (let s = 1; s <= k; s++) {
      const t = s / k, u = 1 - t;
      const x = u*u*u*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t*t*t*p3[0];
      const y = u*u*u*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t*t*t*p3[1];
      pts.push([x, y]);
    }
  }
  while (i < toks.length) {
    const c = toks[i];
    if (c === 'M') { cx = +toks[i+1]; cy = +toks[i+2]; sx = cx; sy = cy; pts.push([cx, cy]); i += 3; }
    else if (c === 'C') {
      const p1 = [+toks[i+1], +toks[i+2]], p2 = [+toks[i+3], +toks[i+4]], p3 = [+toks[i+5], +toks[i+6]];
      cubic([cx, cy], p1, p2, p3, 8); cx = p3[0]; cy = p3[1]; i += 7;
    } else if (c === 'Z' || c === 'z') { if (cx !== sx || cy !== sy) pts.push([sx, sy]); i += 1; }
    else i += 1;
  }
  return pts;
}

// ---------- utilitário: reamostra uma poligonal FECHADA em N pontos por comprimento de arco ----------
function resampleClosed(poly, n) {
  const p = poly.slice();
  if (p[0][0] !== p[p.length-1][0] || p[0][1] !== p[p.length-1][1]) p.push([p[0][0], p[0][1]]);
  const seg = [], cum = [0];
  let total = 0;
  for (let i = 1; i < p.length; i++) {
    const dx = p[i][0]-p[i-1][0], dy = p[i][1]-p[i-1][1];
    const L = Math.hypot(dx, dy); seg.push(L); total += L; cum.push(total);
  }
  const out = [];
  for (let k = 0; k < n; k++) {
    const target = (k / n) * total;
    let lo = 0, hi = cum.length - 1;
    while (lo < hi - 1) { const mid = (lo+hi)>>1; if (cum[mid] <= target) lo = mid; else hi = mid; }
    const segLen = seg[lo] || 1, f = (target - cum[lo]) / segLen;
    out.push([ p[lo][0] + (p[lo+1][0]-p[lo][0])*f, p[lo][1] + (p[lo+1][1]-p[lo][1])*f ]);
  }
  return out;
}

// ---------- Umeyama: similaridade ótima (escala+rotação+translação) src->dst, mesma ordem ----------
function umeyama(src, dst) {
  const n = src.length;
  let msx=0,msy=0,mdx=0,mdy=0;
  for (let i=0;i<n;i++){ msx+=src[i][0]; msy+=src[i][1]; mdx+=dst[i][0]; mdy+=dst[i][1]; }
  msx/=n; msy/=n; mdx/=n; mdy/=n;
  let Sxx=0,Sxy=0,Syx=0,Syy=0,varS=0;
  for (let i=0;i<n;i++){
    const ax=src[i][0]-msx, ay=src[i][1]-msy, bx=dst[i][0]-mdx, by=dst[i][1]-mdy;
    Sxx+=bx*ax; Sxy+=bx*ay; Syx+=by*ax; Syy+=by*ay; varS+=ax*ax+ay*ay;
  }
  // SVD 2x2 de H=[[Sxx,Sxy],[Syx,Syy]]
  const E=(Sxx+Syy)/2, F=(Sxx-Syy)/2, G=(Syx+Sxy)/2, H2=(Syx-Sxy)/2;
  const Q=Math.hypot(E,H2), Rr=Math.hypot(F,G);
  const s1=Q+Rr, s2=Q-Rr;
  const a1=Math.atan2(H2,E), a2=Math.atan2(G,F);
  const theta=(a2-a1)/2, phi=(a2+a1)/2;
  // R = U diag V^T ; U=rot(phi)?? usamos: rotação ótima = phi - ... montamos R direto
  const U=[[Math.cos(phi),-Math.sin(phi)],[Math.sin(phi),Math.cos(phi)]];
  const V=[[Math.cos(theta),-Math.sin(theta)],[Math.sin(theta),Math.cos(theta)]];
  // R = U * diag(1, sign) * V^T  (sign garante det>0)
  const detH = Sxx*Syy - Sxy*Syx;
  const sgn = detH < 0 ? -1 : 1;
  const D=[[1,0],[0,sgn]];
  // R = U D V^T
  const VT=[[V[0][0],V[1][0]],[V[0][1],V[1][1]]];
  const UD=[[U[0][0]*D[0][0],U[0][1]*D[1][1]],[U[1][0]*D[0][0],U[1][1]*D[1][1]]];
  const R=[[UD[0][0]*VT[0][0]+UD[0][1]*VT[1][0], UD[0][0]*VT[0][1]+UD[0][1]*VT[1][1]],
           [UD[1][0]*VT[0][0]+UD[1][1]*VT[1][0], UD[1][0]*VT[0][1]+UD[1][1]*VT[1][1]]];
  const scale=(s1+sgn*s2)/ (varS/n) / 1; // (s1+sgn*s2)/varS_total ... ajustamos abaixo
  const sc=(s1 + sgn*s2)/varS;
  const tx=mdx - sc*(R[0][0]*msx + R[0][1]*msy);
  const ty=mdy - sc*(R[1][0]*msx + R[1][1]*msy);
  return { R, scale: sc, tx, ty };
}
function applyT(T,p){ return [ T.scale*(T.R[0][0]*p[0]+T.R[0][1]*p[1])+T.tx, T.scale*(T.R[1][0]*p[0]+T.R[1][1]*p[1])+T.ty ]; }
function rms(src,dst,T){ let s=0; for(let i=0;i<src.length;i++){ const q=applyT(T,src[i]); s+=(q[0]-dst[i][0])**2+(q[1]-dst[i][1])**2; } return Math.sqrt(s/src.length); }

// ---------- 2. monta as duas voltas e procura o melhor alinhamento ----------
const cbPts = parseTrackPath(TRACK_D);
const cbLoop = resampleClosed(cbPts, N);                 // alvo: espaço do CB
const ofLoop = resampleClosed(PONTOS_DESENHO, N);        // origem: 823×799 (desenho oficial)

function rotated(arr,off,dir){ const o=[]; for(let i=0;i<arr.length;i++){ const idx=((dir>0? off+i : off-i)%arr.length+arr.length)%arr.length; o.push(arr[idx]); } return o; }

let best=null;
for (const dir of [1,-1]) {
  for (let off=0; off<N; off++) {
    const src = rotated(ofLoop, off, dir);
    const T = umeyama(src, cbLoop);
    const e = rms(src, cbLoop, T);
    if (!best || e < best.e) best = { e, T, off, dir };
  }
}
const { T } = best;

// resíduos do casamento desenho-oficial -> CB
const srcBest = rotated(ofLoop, best.off, best.dir);
const resid = srcBest.map((p,i)=>{ const q=applyT(T,p); return Math.hypot(q[0]-cbLoop[i][0], q[1]-cbLoop[i][1]); }).sort((a,b)=>a-b);
const med = resid[Math.floor(resid.length*0.5)], p95 = resid[Math.floor(resid.length*0.95)];

// ---------- 3. projeção composta GPS -> Command Box ----------
function geoParaCommandBox(lat,lng){ const d=geoParaDesenho(lat,lng); return applyT(T,[d.x,d.y]); }

// distância de um ponto ao traço do CB (poligonal densa)
const cbDense = parseTrackPath(TRACK_D);
function distToTrack(p){ let m=Infinity; for(let i=1;i<cbDense.length;i++){ const a=cbDense[i-1],b=cbDense[i];
  const vx=b[0]-a[0],vy=b[1]-a[1], wx=p[0]-a[0],wy=p[1]-a[1]; const L=vx*vx+vy*vy||1; let t=(wx*vx+wy*vy)/L; t=Math.max(0,Math.min(1,t));
  const dx=a[0]+t*vx-p[0], dy=a[1]+t*vy-p[1]; const d=Math.hypot(dx,dy); if(d<m)m=d; } return m; }

// ---------- 4. validação com VOLTA REAL do Bubi ----------
const tsv = readFileSync(process.env.HOME+'/Documents/p1fast-backup-voltas-reais/gps-23-05.tsv','utf8').trim().split('\n');
const realGps=[];
for (const ln of tsv){ const c=ln.split('|'); const lat=+c[1], lng=+c[2]; if(isFinite(lat)&&isFinite(lng)&&lat<-15.7&&lat>-15.8) realGps.push({lat,lng}); }
const realErr = realGps.map(g=>distToTrack(geoParaCommandBox(g.lat,g.lng))).sort((a,b)=>a-b);
const rMed=realErr[Math.floor(realErr.length*0.5)], rP95=realErr[Math.floor(realErr.length*0.95)], rMax=realErr[realErr.length-1];

// ---------- 5. escreve o módulo de projeção + JSON de prova ----------
const mod = `// pista-brasilia-commandbox.js — GERADO por tools/recalibrar-mapa-command-box.mjs (${new Date().toISOString().slice(0,10).replace(/^/, '').replace(/.*/, 'recalibração 2026-06-16')})
// Projeta GPS (lat,lng) -> espaço do SVG da pista do Command Box (viewBox "130 110 580 660").
// Reusa a amarração provada GPS->desenho-oficial (pista-oficial-brasilia.js) e acrescenta a
// transformação desenho-oficial(823x799) -> traço do Command Box, estimada por semelhança.
// Erro do casamento ao traço: mediana ${med.toFixed(1)} px · p95 ${p95.toFixed(1)} px.
// Erro de uma VOLTA REAL do Bubi projetada: mediana ${rMed.toFixed(1)} px · p95 ${rP95.toFixed(1)} px (largura da pista ~${STROKE_W} px).
import { geoParaDesenho } from './pista-oficial-brasilia.js';
const SCALE = ${T.scale};
const R = [[${T.R[0][0]}, ${T.R[0][1]}], [${T.R[1][0]}, ${T.R[1][1]}]];
const TX = ${T.tx}, TY = ${T.ty};
export function geoParaCommandBox(lat, lng) {
  const d = geoParaDesenho(lat, lng);
  return { x: SCALE*(R[0][0]*d.x + R[0][1]*d.y) + TX, y: SCALE*(R[1][0]*d.x + R[1][1]*d.y) + TY };
}
`;
writeFileSync(ROOT+'web/cockpit/pista-brasilia-commandbox.js', mod);

const prova = {
  gerado_em: '2026-06-16',
  casamento_desenho_oficial_para_cb: { mediana_px: +med.toFixed(2), p95_px: +p95.toFixed(2), rms_px: +best.e.toFixed(2) },
  volta_real_bubi_projetada: { n_pontos: realGps.length, mediana_px: +rMed.toFixed(2), p95_px: +rP95.toFixed(2), max_px: +rMax.toFixed(2), largura_pista_px: STROKE_W,
    mediana_em_larguras_de_pista: +(rMed/STROKE_W).toFixed(2), p95_em_larguras_de_pista: +(rP95/STROKE_W).toFixed(2) },
  transformacao: { scale: T.scale, R: T.R, tx: T.tx, ty: T.ty, offset: best.off, dir: best.dir },
  cb_loop_amostra: cbLoop.filter((_,i)=>i%30===0),
  volta_real_projetada_amostra: realGps.filter((_,i)=>i%Math.ceil(realGps.length/120)===0).map(g=>{ const q=geoParaCommandBox(g.lat,g.lng); return [ +q[0].toFixed(1), +q[1].toFixed(1) ]; }),
  volta_real_projetada_full: realGps.map(g=>{ const q=geoParaCommandBox(g.lat,g.lng); return [ +q[0].toFixed(1), +q[1].toFixed(1) ]; }),
  cb_track_d: TRACK_D,
};
writeFileSync('/tmp/recal-cb/prova.json', JSON.stringify(prova,null,1));

console.log('=== RECALIBRAÇÃO MAPA COMMAND BOX ===');
console.log('Pontos do traço CB:', cbPts.length, '| viewBox 130 110 580 660');
console.log('Melhor alinhamento: offset', best.off, 'dir', best.dir);
console.log('Casamento desenho-oficial -> CB:  mediana', med.toFixed(2),'px | p95', p95.toFixed(2),'px | rms', best.e.toFixed(2),'px');
console.log('VOLTA REAL Bubi projetada ('+realGps.length+' pts): mediana', rMed.toFixed(2),'px | p95', rP95.toFixed(2),'px | max', rMax.toFixed(2),'px');
console.log('  em larguras de pista (~'+STROKE_W+'px): mediana', (rMed/STROKE_W).toFixed(2),'| p95', (rP95/STROKE_W).toFixed(2));
console.log('Escrito: web/cockpit/pista-brasilia-commandbox.js  +  /tmp/recal-cb/prova.json');
