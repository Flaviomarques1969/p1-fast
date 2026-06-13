// atelier-server.mjs — ajudante local do Atelier de mockups.
// Função: receber o arranjo do botão "salvar última versão" e GRAVAR no disco
// (versão nova datada + ponteiro ATUAL + histórico). Nada é apagado.
//
// Rodar:  node tools/atelier-server.mjs       (deixa rodando num terminal)
// Porta:  8077  ·  Salva em: _design-reference/command-box-versoes/
//
// Sem dependências externas (usa só o que vem com o Node).

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dir, '..');
const VERSOES = path.join(ROOT, '_design-reference', 'command-box-versoes');
const HIST = path.join(VERSOES, 'HISTORICO.md');
const PORT = 8077;

fs.mkdirSync(VERSOES, { recursive: true });

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function carimbo() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return {
    arq: `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`,
    humano: `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`,
  };
}

function salvarVersao(vista, nota, json) {
  // validação: precisa ter blocos com alguma posição real
  const blocks = (json && json.blocks) || [];
  const comPos = blocks.filter((b) => b && b.pct && (b.pct.x || b.pct.y || b.pct.w || b.pct.h)).length;
  if (!blocks.length || comPos < Math.ceil(blocks.length * 0.6)) {
    return { ok: false, motivo: `arranjo vazio (${comPos}/${blocks.length} blocos com posição) — não salvei` };
  }
  const v = (vista || 'piloto').replace(/[^a-z0-9-]/gi, '');
  const ts = carimbo();
  const arquivo = path.join(VERSOES, `vista-${v}-layout-${ts.arq}.json`);
  const atual = path.join(VERSOES, `vista-${v}-ATUAL.json`);
  const texto = JSON.stringify(json, null, 2);
  fs.writeFileSync(arquivo, texto);
  fs.writeFileSync(atual, texto);
  if (!fs.existsSync(HIST)) {
    fs.writeFileSync(HIST, '# Histórico de versões — Command Box (layout)\n\nCada linha é uma versão salva do arranjo dos blocos. Nada é apagado.\n\n| Quando | Vista | Arquivo | Nota |\n|---|---|---|---|\n');
  }
  fs.appendFileSync(HIST, `| ${ts.humano} | ${v} | ${path.basename(arquivo)} | ${nota || '—'} |\n`);
  return { ok: true, arquivo: path.relative(ROOT, arquivo), blocos: blocks.length };
}

const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml' };

// Identifica a vista pelo nome do arquivo e a chave que o painel usa na memória do navegador.
function vistaKey(alvo) {
  const n = path.basename(alvo).toLowerCase();
  if (n.indexOf('engenheiro') >= 0) return { vista: 'engenheiro', key: 'p1fast-vista-engenheiro-layout-v1' };
  if (n.indexOf('piloto') >= 0) return { vista: 'piloto', key: 'p1fast-vista-piloto-layout-v1' };
  return null;
}

// Monta um <script> que semeia a ÚLTIMA versão salva na memória do navegador, SÓ se estiver vazia.
// Assim, abrir o painel pelo ajudante já mostra o último arranjo salvo — sem editar o arquivo do painel.
function seedScript(alvo) {
  const vk = vistaKey(alvo);
  if (!vk) return '';
  const atual = path.join(VERSOES, `vista-${vk.vista}-ATUAL.json`);
  if (!fs.existsSync(atual)) return '';
  try {
    const j = JSON.parse(fs.readFileSync(atual, 'utf8'));
    const positions = {}; const customs = [];
    (j.blocks || []).forEach((b) => { positions[b.id] = { x: b.pct.x, y: b.pct.y, w: b.pct.w, h: b.pct.h }; if (b.custom) customs.push({ id: b.id, name: b.name }); });
    if (!Object.keys(positions).length) return '';
    const seed = JSON.stringify({ positions, customs });
    return '<script>(function(){try{var k=' + JSON.stringify(vk.key) + ';if(!localStorage.getItem(k))localStorage.setItem(k,' + JSON.stringify(seed) + ');}catch(e){}})();</script>';
  } catch (e) { return ''; }
}

const server = http.createServer((req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  const u = new URL(req.url, `http://localhost:${PORT}`);

  // ---- gravar versão ----
  if (req.method === 'POST' && u.pathname === '/atelier/salvar-versao') {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 5e6) req.destroy(); });
    req.on('end', () => {
      try {
        const json = JSON.parse(body);
        const r = salvarVersao(u.searchParams.get('vista'), u.searchParams.get('nota'), json);
        res.writeHead(r.ok ? 200 : 422, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(r));
        if (r.ok) console.log(`[atelier] salvo: ${r.arquivo} (${r.blocos} blocos)`);
        else console.log(`[atelier] recusado: ${r.motivo}`);
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, motivo: 'JSON inválido' }));
      }
    });
    return;
  }

  // ---- servir arquivos do projeto (conveniência: abrir o mockup por http) ----
  if (req.method === 'GET') {
    let rel = decodeURIComponent(u.pathname);
    if (rel === '/') rel = '/_design-reference/mockup-command-box-vista-piloto.html';
    const alvo = path.join(ROOT, rel);
    if (!alvo.startsWith(ROOT)) { res.writeHead(403); return res.end('proibido'); }
    fs.readFile(alvo, (err, data) => {
      if (err) { res.writeHead(404); return res.end('não encontrado'); }
      const ext = path.extname(alvo);
      if (ext === '.html') {
        let html = data.toString('utf8');
        const seed = seedScript(alvo);   // injeta a última versão salva (só se a memória do navegador estiver vazia)
        if (seed) html = html.replace(/<body([^>]*)>/i, '<body$1>\n' + seed);
        res.writeHead(200, { 'Content-Type': TIPOS['.html'] });
        return res.end(html);
      }
      res.writeHead(200, { 'Content-Type': TIPOS[ext] || 'application/octet-stream' });
      res.end(data);
    });
    return;
  }

  res.writeHead(404); res.end('não encontrado');
});

server.listen(PORT, () => {
  console.log(`Atelier ajudante no ar: http://localhost:${PORT}`);
  console.log(`Salva versões em: ${path.relative(ROOT, VERSOES)}/`);
  console.log('Deixe este terminal aberto enquanto trabalha nos mockups.');
});
