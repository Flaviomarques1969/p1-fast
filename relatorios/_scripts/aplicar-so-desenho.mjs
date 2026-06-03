// Aplica a transformação SÓ no desenho do path SVG.
// Pontos canônicos no JSON já estão transformados, não tocar.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const pistaPath = path.join(ROOT, '_design-reference/PISTA-OFICIAL-brasilia.txt');
const mapaPath = path.join(ROOT, '_design-reference/MAPA-BRASILIA-DEFINITIVO.json');

const mapa = JSON.parse(fs.readFileSync(mapaPath, 'utf8'));
const T = mapa._meta.calibracao_parametros;
console.error('Aplicando ao desenho:', T);

const PIVOT_CX = (167 + 688) / 2;
const PIVOT_CY = (144 + 713) / 2;
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
    x: rx + PIVOT_CX + T.mover_horizontal,
    y: ry + PIVOT_CY + T.mover_vertical,
  };
}

function transformarPath(pathStr) {
  const tokens = pathStr.match(/[A-Za-z]|-?\d+\.?\d*/g) || [];
  const out = [];
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (/[A-Za-z]/.test(t)) {
      out.push(t); i++;
      if (t === 'M' || t === 'L' || t === 'm' || t === 'l') {
        while (i < tokens.length && !/[A-Za-z]/.test(tokens[i])) {
          const x = Number(tokens[i]), y = Number(tokens[i+1]);
          const novo = transformar({ x, y });
          out.push(novo.x.toFixed(2));
          out.push(novo.y.toFixed(2));
          i += 2;
        }
      }
    } else {
      out.push(t); i++;
    }
  }
  return out.join(' ');
}

const original = fs.readFileSync(pistaPath, 'utf8').trim();
// Backup adicional
const stamp = Date.now();
fs.copyFileSync(pistaPath, pistaPath + `.backup-so-desenho-${stamp}`);
const novo = transformarPath(original);
fs.writeFileSync(pistaPath, novo + '\n');

const nums = novo.match(/-?\d+\.?\d*/g).map(Number);
let xMin=Infinity,xMax=-Infinity,yMin=Infinity,yMax=-Infinity;
for(let i=0;i<nums.length;i+=2){xMin=Math.min(xMin,nums[i]);xMax=Math.max(xMax,nums[i]);yMin=Math.min(yMin,nums[i+1]);yMax=Math.max(yMax,nums[i+1]);}
console.error('Bounds novo do desenho:');
console.error('  X:', xMin.toFixed(0), 'a', xMax.toFixed(0));
console.error('  Y:', yMin.toFixed(0), 'a', yMax.toFixed(0));
