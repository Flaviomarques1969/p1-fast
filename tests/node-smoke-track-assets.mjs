// ═══════════════════════════════════════════════════════════
// Smoke: assets/pistas/ — base estilizada + reference JSON
// ═══════════════════════════════════════════════════════════
// Garante que `node tools/generate-track-assets.mjs` continua
// reproduzindo bit-a-bit os artefatos tracked. Se o svgPath de
// Brasília mudar (ex: nova volta de referência), rodar o gerador
// e commitar os 3 arquivos atualizados.
//
// Pesos validados:
//   - SVG válido (root <svg>, viewBox 823×799)
//   - reference.json bate com extensão real (5476m ± erro de quantização)
//   - 2190 pontos a 2.5m de espaçamento (5476 / 2.5 ≈ 2190)
//   - heading e curvatura presentes em todos os pontos

import { readFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';

let ok = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log('✓', name); ok++; }
  catch (e) { console.log('✗', name, '—', e.message); fail++; }
}

const baseSvg = await readFile('assets/pistas/brasilia.svg', 'utf8');
const pointsSvg = await readFile('assets/pistas/brasilia-points.svg', 'utf8');
const ref = JSON.parse(await readFile('assets/pistas/brasilia-reference.json', 'utf8'));

t('brasilia.svg começa com <?xml e contém <svg root', () => {
  if (!baseSvg.startsWith('<?xml')) throw new Error('faltou XML decl');
  if (!/<svg[^>]+viewBox="0 0 823 799"/.test(baseSvg)) throw new Error('viewBox errado');
});

t('brasilia.svg tem 4 paths (runoff, kerb, asphalt, center)', () => {
  const m = baseSvg.match(/<path /g) || [];
  if (m.length !== 4) throw new Error(`esperava 4 paths, achei ${m.length}`);
});

t('brasilia.svg sem texto (pré-requisito de base layer)', () => {
  if (/<text[\s>]/.test(baseSvg)) throw new Error('SVG não pode conter <text>');
});

t('brasilia-points.svg tem ~2190 circles', () => {
  const m = pointsSvg.match(/<circle /g) || [];
  if (Math.abs(m.length - 2190) > 2) throw new Error(`circles=${m.length} (esperado 2190)`);
});

t('reference.json: viewBox e extensão batem com seed', () => {
  if (ref.viewBox.w !== 823 || ref.viewBox.h !== 799) throw new Error('viewBox divergente');
  if (ref.totalLengthMeters !== 5476) throw new Error('extensaoMetros divergente');
});

t('reference.json: 2190 pontos a 2.5m', () => {
  if (ref.spacingMeters !== 2.5) throw new Error('spacing != 2.5');
  if (ref.points.length !== 2190) throw new Error(`pontos=${ref.points.length}`);
});

t('reference.json: todos pontos têm x/y/sMeters/heading/curvature', () => {
  for (const p of ref.points) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) throw new Error(`ponto ${p.idx} xy inválido`);
    if (!Number.isFinite(p.heading)) throw new Error(`ponto ${p.idx} sem heading`);
    if (!Number.isFinite(p.curvature)) throw new Error(`ponto ${p.idx} sem curvature`);
    if (Math.abs(p.sMeters - p.idx * ref.spacingMeters) > 1e-9) throw new Error(`ponto ${p.idx} sMeters fora da grade`);
  }
});

t('reference.json: pontos cobrem extensão real ± 1 spacing', () => {
  const last = ref.points[ref.points.length - 1].sMeters;
  if (Math.abs(last - (ref.totalLengthMeters - ref.spacingMeters)) > ref.spacingMeters) {
    throw new Error(`último sMeters=${last} fora do esperado`);
  }
});

t('reference.json: pontos x/y dentro do viewBox', () => {
  for (const p of ref.points) {
    if (p.x < 0 || p.x > ref.viewBox.w || p.y < 0 || p.y > ref.viewBox.h) {
      throw new Error(`ponto ${p.idx} (${p.x}, ${p.y}) fora do viewBox`);
    }
  }
});

t('gerador é determinístico (re-run não muda outputs)', () => {
  const before = baseSvg + pointsSvg;
  execSync('node tools/generate-track-assets.mjs', { stdio: 'ignore' });
  const afterBase = execSync('cat assets/pistas/brasilia.svg', { encoding: 'utf8' });
  const afterPoints = execSync('cat assets/pistas/brasilia-points.svg', { encoding: 'utf8' });
  if (before !== afterBase + afterPoints) throw new Error('output mudou em re-run');
});

console.log(`\n${ok} ok / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
