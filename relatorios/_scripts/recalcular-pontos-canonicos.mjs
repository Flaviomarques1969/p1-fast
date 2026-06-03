// Recalcula os pontos canônicos APLICANDO corretamente a transformação
// do Flávio aos pontos ORIGINAIS (que ele marcou antes da minha mexida).
// Os pontos atuais no JSON estão bugados (vieram com erro de pixel-de-tela
// do getCTM do navegador).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const mapaPath = path.join(ROOT, '_design-reference/MAPA-BRASILIA-DEFINITIVO.json');
const origPath = path.join(ROOT, '_design-reference/MAPA-BRASILIA-DEFINITIVO.backup-2026-05-24-1779730438997.json');

const mapa = JSON.parse(fs.readFileSync(mapaPath, 'utf8'));
const original = JSON.parse(fs.readFileSync(origPath, 'utf8'));
const T = mapa._meta.calibracao_parametros;

const PIVOT_CX = (167 + 688) / 2; // 427.5
const PIVOT_CY = (144 + 713) / 2; // 428.5
const sx = T.largura_pct / 100;
const sy = T.altura_pct / 100;
const rad = T.rotacao_graus * Math.PI / 180;
const cos = Math.cos(rad), sin = Math.sin(rad);

function transformar({ x, y }) {
  let px = x - PIVOT_CX, py = y - PIVOT_CY;
  px *= sx; py *= sy;
  const rx = px * cos - py * sin;
  const ry = px * sin + py * cos;
  return {
    x: +(rx + PIVOT_CX + T.mover_horizontal).toFixed(2),
    y: +(ry + PIVOT_CY + T.mover_vertical).toFixed(2),
  };
}

// Backup
const stamp = Date.now();
fs.copyFileSync(mapaPath, mapaPath.replace('.json', `.backup-recalc-${stamp}.json`));

// Substituir cada ponto canônico pela versão CORRETA da matriz aplicada
// aos originais
for (const t of original.trechos) {
  const idx = mapa.trechos.findIndex(x => x.id === t.id);
  if (idx === -1) continue;
  if (t.entradas?.length) {
    mapa.trechos[idx].entradas = t.entradas.map(transformar);
  }
  if (t.saidas?.length) {
    mapa.trechos[idx].saidas = t.saidas.map(transformar);
  }
  if (t.apices?.length) {
    mapa.trechos[idx].apices = t.apices.map(transformar);
    mapa.trechos[idx].centroide = mapa.trechos[idx].apices[0];
  }
}

// Linha de chegada também a partir da original
const a = transformar({ x: original.pista.linha_chegada.x1, y: original.pista.linha_chegada.y1 });
const b = transformar({ x: original.pista.linha_chegada.x2, y: original.pista.linha_chegada.y2 });
mapa.pista.linha_chegada = { x1: a.x, y1: a.y, x2: b.x, y2: b.y };

fs.writeFileSync(mapaPath, JSON.stringify(mapa, null, 2));
console.error('Pontos canônicos recalculados. Verificando se estão dentro do desenho atual:');

// Verifica
const pathSvg = fs.readFileSync(path.join(ROOT, '_design-reference/PISTA-OFICIAL-brasilia.txt'), 'utf8').trim();
const nums = pathSvg.match(/-?\d+\.?\d*/g).map(Number);
let xMin=Infinity,xMax=-Infinity,yMin=Infinity,yMax=-Infinity;
for(let i=0;i<nums.length;i+=2){xMin=Math.min(xMin,nums[i]);xMax=Math.max(xMax,nums[i]);yMin=Math.min(yMin,nums[i+1]);yMax=Math.max(yMax,nums[i+1]);}
console.error('Bounds do desenho atual: X', xMin.toFixed(0), 'a', xMax.toFixed(0), '| Y', yMin.toFixed(0), 'a', yMax.toFixed(0));
let dentro = 0, fora = 0;
for(const t of mapa.trechos.filter(x=>x.eh_trecho_pedagogico)){
  for (const [tipo, arr] of [['E', t.entradas], ['S', t.saidas]]) {
    const p = arr[0];
    const ok = p.x >= xMin && p.x <= xMax && p.y >= yMin && p.y <= yMax;
    if (ok) dentro++; else fora++;
    if (!ok) console.error('  FORA: '+tipo+' '+t.nome+' ('+p.x+','+p.y+')');
  }
}
console.error('Resultado: ' + dentro + ' dentro · ' + fora + ' fora');
