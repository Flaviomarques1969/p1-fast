// Servidor local FALSO do notebook (mesmas rotas do servidor-video-local.ps1: /api/vivo, /api/room, /api/gravar),
// para provar a página no Chrome do Mac. /api/room responde 502 (sem internet da pista) — a gravação tem de seguir.
// PECA-DE-PROVA: chamado por provar-gravador-video.mjs
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const [raiz, pasta, porta] = [process.argv[2], process.argv[3], +process.argv[4]];
fs.mkdirSync(pasta, { recursive: true });
const tipos = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json' };
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'); let p = decodeURIComponent(u.pathname);
  if (p === '/api/vivo') { res.end('{"ageMs":0,"ver":4}'); return; }
  if (p === '/api/room') { res.writeHead(502, { 'content-type': 'application/json' }); res.end('{"error":"sem internet (prova)"}'); return; }
  if (p.startsWith('/api/gravar')) {
    if (req.method === 'POST') {
      const nome = p.slice('/api/gravar/'.length);
      if (!/^[A-Za-z0-9_.-]{1,120}\.webm$/.test(nome)) { res.writeHead(400); res.end('{}'); return; }
      const ws = fs.createWriteStream(path.join(pasta, nome), { flags: 'a' }); req.pipe(ws);
      ws.on('finish', () => res.end(JSON.stringify({ ok: true, bytes: fs.statSync(path.join(pasta, nome)).size })));
      return;
    }
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ pasta, livreBytes: 50e9, arquivos: fs.readdirSync(pasta).map((n) => ({ nome: n, bytes: fs.statSync(path.join(pasta, n)).size })) }));
    return;
  }
  if (p === '/') p = '/web/teste-aparelhos/index.html';
  const f = path.join(raiz, p);
  if (!f.startsWith(raiz) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': tipos[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); fs.createReadStream(f).pipe(res);
}).listen(porta, '127.0.0.1', () => console.log('servidor falso em', porta));
