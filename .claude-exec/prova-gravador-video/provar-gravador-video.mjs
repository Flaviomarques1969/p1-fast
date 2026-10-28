// PROVA no Chrome de verdade (sem janela, câmera simulada) da gravação do vídeo transmitido — 28/10/2026.
// A) módulo: grava a CÓPIA da trilha; a trilha original para aos 5 s (a página derruba a chamada para religar) e a
//    gravação segue; arquivo novo a cada 12 s → 3 arquivos em 27 s, cada um abre no ffprobe com vídeo 1280x720.
// B) página real do notebook (web/teste-aparelhos/index.html) sem internet (/api/room = 502): a aba líder grava a
//    câmera sozinha, o quadro GRAVAÇÃO aparece e o arquivo cresce e abre no ffprobe.
// Controle: a página de ANTES (backup) roda igual e NÃO pode gravar nada.
// Uso: node provar-gravador-video.mjs <raiz-do-repo> [pasta-saida]
import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
const require = createRequire('/Users/imac/Documents/Sistemas/cdai/frontend/package.json');
const { chromium } = require('playwright');
const aqui = path.dirname(new URL(import.meta.url).pathname);
const raiz = process.argv[2]; const saida = process.argv[3] || path.join(aqui, 'saida');
let ok = 0, falha = 0;
const t = (n, c, d = '') => { c ? ok++ : falha++; console.log((c ? '  ok  ' : '  FAIL ') + n + (d ? ' — ' + d : '')); };
const sonda = (f) => { try { return JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name,width,height,nb_read_frames', '-of', 'json', f])).streams[0] || null; } catch (e) { return null; } };

async function comServidor(nome, raizServida, porta, fn) {
  const pasta = path.join(saida, nome); fs.rmSync(pasta, { recursive: true, force: true });
  const sv = spawn('node', [path.join(aqui, 'servidor-falso.mjs'), raizServida, pasta, String(porta)], { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 600));
  const nav = await chromium.launch({ headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
  try { return await fn(nav, pasta); } finally { await nav.close(); sv.kill(); }
}
const arquivos = (pasta) => fs.existsSync(pasta) ? fs.readdirSync(pasta).filter((n) => n.endsWith('.webm')).sort() : [];

// ---------- A) módulo ----------
await comServidor('A-modulo', raiz, 5233, async (nav, pasta) => {
  const pg = await nav.newPage(); const erros = []; pg.on('pageerror', (e) => erros.push(String(e)));
  // a página de prova mora fora do repo servido? não: está em .claude-exec dentro da raiz
  await pg.goto('http://127.0.0.1:5233/.claude-exec/prova-gravador-video/modulo.html');
  await pg.waitForFunction(() => window.__res && window.__res.fim, null, { timeout: 60000 });
  const R = await pg.evaluate(() => window.__res);
  const L = arquivos(pasta);
  console.log('A) arquivos:', L.map((n) => n + ' ' + fs.statSync(path.join(pasta, n)).size + ' B').join(' | '));
  t('A: gravou a cópia da trilha transmitida', R.fonte === 'transmissao', R.fonte);
  t('A: trilha original parou e a gravação SEGUIU', R.estadoAposParar && R.estadoAposParar.gravando === true);
  t('A: 3 arquivos em 27 s (um a cada 12 s)', L.length === 3, String(L.length));
  // quadros esperados = taxa real da câmera simulada × tempo gravado (27 s): o último arquivo é só a sobra até o fim.
  let total = 0;
  for (const n of L) {
    const s = sonda(path.join(pasta, n)); total += s ? +s.nb_read_frames : 0;
    t('A: ' + n + ' abre no ffprobe com vídeo 1280x720', s && s.width === 1280 && s.height === 720 && +s.nb_read_frames > 0, JSON.stringify(s));
  }
  const taxa = R.taxaCamera || 0, esperado = taxa * 27;
  t('A: quadros somados ≈ taxa da câmera × 27 s (sem buraco na troca de arquivo)', taxa > 0 && Math.abs(total - esperado) <= esperado * 0.15, `total ${total}, taxa ${taxa} q/s → esperado ${esperado.toFixed(0)}`);
  t('A: nada pendente no fim e sem erro', R.estadoFinal && R.estadoFinal.pendentes === 0 && !R.estadoFinal.erro, JSON.stringify(R.estadoFinal));
  t('A: 0 erro de página', erros.length === 0, erros.join(' | ').slice(0, 200));
});

// ---------- B) página real (e controle com a página de antes) ----------
async function paginaReal(nome, raizServida, porta) {
  return comServidor(nome, raizServida, porta, async (nav, pasta) => {
    const pg = await nav.newPage(); const erros = []; pg.on('pageerror', (e) => erros.push(String(e)));
    await pg.goto('http://127.0.0.1:' + porta + '/');
    await pg.waitForTimeout(22000);
    const tela = await pg.evaluate(() => ({ bGrav: document.getElementById('bGrav') && document.getElementById('bGrav').textContent, gStatus: document.getElementById('gStatus') && document.getElementById('gStatus').textContent, log: document.getElementById('log').textContent.slice(0, 1500) }));
    const L = arquivos(pasta);
    return { tela, L, pasta, erros };
  });
}
const B = await paginaReal('B-pagina', raiz, 5234);
console.log('B) quadro:', JSON.stringify(B.tela.bGrav), '| linha:', JSON.stringify(B.tela.gStatus));
console.log('B) arquivos:', B.L.map((n) => n + ' ' + fs.statSync(path.join(B.pasta, n)).size + ' B').join(' | '));
t('B: sem internet a página grava sozinha (1 arquivo)', B.L.length === 1, String(B.L.length));
const sB = B.L[0] && sonda(path.join(B.pasta, B.L[0]));
t('B: arquivo abre no ffprobe com vídeo e quadros', sB && sB.width > 0 && +sB.nb_read_frames > 100, JSON.stringify(sB));
t('B: quadro GRAVAÇÃO mostra gravando', /GRAVAÇÃO · gravando/.test(B.tela.bGrav || ''), B.tela.bGrav);
t('B: registro avisa a pasta da gravação', /Gravação do vídeo ligada/.test(B.tela.log));
t('B: 0 erro de página', B.erros.length === 0, B.erros.join(' | ').slice(0, 300));

// controle: raiz montada com a página de ANTES
const ctl = path.join(saida, 'raiz-controle');
fs.rmSync(ctl, { recursive: true, force: true }); fs.mkdirSync(path.join(ctl, 'web/teste-aparelhos'), { recursive: true });
fs.copyFileSync(path.join(raiz, '.claude-exec/backup-gravar-video-1757/web/teste-aparelhos/index.html'), path.join(ctl, 'web/teste-aparelhos/index.html'));
const C = await paginaReal('C-controle', ctl, 5235);
t('CONTROLE: a página de antes NÃO grava nada', C.L.length === 0 && !C.tela.bGrav, String(C.L.length));

// D) raiz SEM o arquivo do gravador (site antigo/na nuvem): a página tem de seguir viva, só sem gravar
const semG = path.join(saida, 'raiz-sem-gravador');
fs.rmSync(semG, { recursive: true, force: true }); fs.mkdirSync(path.join(semG, 'web/teste-aparelhos'), { recursive: true });
fs.copyFileSync(path.join(raiz, 'web/teste-aparelhos/index.html'), path.join(semG, 'web/teste-aparelhos/index.html'));
const D = await paginaReal('D-sem-gravador', semG, 5237);
t('D: sem o arquivo do gravador a página segue viva (registro da central de pista)', /Central de pista: ligando sozinha/.test(D.tela.log), D.tela.log.slice(0, 120));
t('D: e avisa que não gravou', /Gravação NÃO ligada/.test(D.tela.log) && D.L.length === 0);
t('B (controle positivo do D): com o arquivo a página também está viva', /Central de pista: ligando sozinha/.test(B.tela.log));

console.log(`\nprovar-gravador-video: ${ok} ok, ${falha} falha → ${falha ? 'REPROVADO' : 'APROVADO'}`);
process.exit(falha ? 1 : 0);
