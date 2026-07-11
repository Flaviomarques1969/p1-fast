// Calcula a transformação SIMILAR (escala+rotação+translação, c/ reflexão) que leva
// o traçado oficial (PONTOS_DESENHO, 823x799) para as coordenadas do MEU traçado da
// tela (path SVG de track-brasilia.js). Roda 1x, fora do app. Imprime os 4+2+2 números.
import { PONTOS_DESENHO } from './pista-oficial-brasilia.js';
import { TRACK_PATH_D } from './track-brasilia.js';

// ---- amostrar o path SVG (M + vários C) em polilinha ----
function sampleSvgPath(d) {
  const nums = d.match(/-?\d+\.?\d*/g).map(Number);
  // formato: M x y ( C x1 y1 x2 y2 x3 y3 )* Z
  let i = 0;
  const out = [];
  let cx = nums[i++], cy = nums[i++];
  out.push([cx, cy]);
  while (i + 5 < nums.length) {
    const x1 = nums[i++], y1 = nums[i++], x2 = nums[i++], y2 = nums[i++], x3 = nums[i++], y3 = nums[i++];
    for (let s = 1; s <= 8; s++) {
      const t = s / 8, u = 1 - t;
      const x = u*u*u*cx + 3*u*u*t*x1 + 3*u*t*t*x2 + t*t*t*x3;
      const y = u*u*u*cy + 3*u*u*t*y1 + 3*u*t*t*y2 + t*t*t*y3;
      out.push([x, y]);
    }
    cx = x3; cy = y3;
  }
  return out;
}

// ---- reamostrar por comprimento de arco em N pontos (fecha o laço) ----
function resample(poly, N) {
  const P = poly.slice();
  if (P[0][0] !== P[P.length-1][0] || P[0][1] !== P[P.length-1][1]) P.push(P[0]); // fecha
  const cum = [0];
  for (let k = 1; k < P.length; k++) {
    const dx = P[k][0]-P[k-1][0], dy = P[k][1]-P[k-1][1];
    cum.push(cum[k-1] + Math.hypot(dx, dy));
  }
  const total = cum[cum.length-1];
  const out = [];
  let seg = 1;
  for (let n = 0; n < N; n++) {
    const target = total * n / N;
    while (seg < cum.length-1 && cum[seg] < target) seg++;
    const t = (target - cum[seg-1]) / ((cum[seg]-cum[seg-1]) || 1);
    out.push([P[seg-1][0] + (P[seg][0]-P[seg-1][0])*t,
              P[seg-1][1] + (P[seg][1]-P[seg-1][1])*t]);
  }
  return out;
}

const N = 600;
const S = resample(sampleSvgPath(TRACK_PATH_D), N);
const D = resample(PONTOS_DESENHO, N);

function centroid(P){ let x=0,y=0; for(const p of P){x+=p[0];y+=p[1];} return [x/P.length,y/P.length]; }
const cS = centroid(S), cD = centroid(D);
const Sc = S.map(p=>[p[0]-cS[0], p[1]-cS[1]]);
const Dc = D.map(p=>[p[0]-cD[0], p[1]-cD[1]]);

// Procrustes complexo: acha c (escala*rotação) que melhor leva A->B, com/sem reflexão.
function fit(A, B) {
  let denom = 0;
  for (const a of A) denom += a[0]*a[0]+a[1]*a[1];
  // sem reflexão: c = sum(conj(a)*b)/denom
  let nr=0, ni=0;   // sum conj(a)*b  ; conj(a)=(ax,-ay); (ax-iay)(bx+iby)= (ax*bx+ay*by) + i(ax*by-ay*bx)
  let rr=0, ri=0;   // sum a*b ; (ax+iay)(bx+iby)= (ax*bx-ay*by)+i(ax*by+ay*bx)
  for (let k=0;k<A.length;k++){
    const ax=A[k][0],ay=A[k][1],bx=B[k][0],by=B[k][1];
    nr += ax*bx+ay*by;  ni += ax*by-ay*bx;
    rr += ax*bx-ay*by;  ri += ax*by+ay*bx;
  }
  const cNoR=[nr/denom, ni/denom];
  const cRef=[rr/denom, ri/denom];
  // resíduos
  let resN=0, resR=0;
  for (let k=0;k<A.length;k++){
    const ax=A[k][0],ay=A[k][1],bx=B[k][0],by=B[k][1];
    // sem refl: c*a
    let px=cNoR[0]*ax-cNoR[1]*ay, py=cNoR[1]*ax+cNoR[0]*ay;
    resN += (px-bx)**2+(py-by)**2;
    // refl: c*conj(a)  conj(a)=(ax,-ay)
    let qx=cRef[0]*ax+cRef[1]*ay, qy=cRef[1]*ax-cRef[0]*ay;
    resR += (qx-bx)**2+(qy-by)**2;
  }
  if (resN<=resR) return {refl:false, c:cNoR, res:resN};
  return {refl:true, c:cRef, res:resR};
}

let best=null;
for (const dir of [1,-1]) {
  for (let k=0;k<N;k++){
    const Dk = Sc.map((_,i)=> Dc[(((dir*i)+k)%N+N)%N]);
    const f = fit(Dk, Sc);          // leva Dk(desenho) -> Sc(svg)
    if (!best || f.res<best.res) best={dir,k,...f};
  }
}

// Matriz M (2x2) tal que svg = M*(des-cD)+cS
const c=best.c;
let M;
if (!best.refl) M=[[c[0],-c[1]],[c[1],c[0]]];
else            M=[[c[0], c[1]],[c[1],-c[0]]];

const rms = Math.sqrt(best.res/N);
console.error('refl='+best.refl+' dir='+best.dir+' k='+best.k+' RMS(px svg)='+rms.toFixed(3));
console.log(JSON.stringify({ M, cD, cS }, null, 0));
