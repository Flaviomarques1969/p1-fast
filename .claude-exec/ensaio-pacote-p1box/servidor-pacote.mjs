// Servidor local que imita o Vercel para o PACOTE montado (dist/p1box-tv): estático + pasta → index.html +
// /api/room pela função do próprio pacote. O fam-racing é FALSO (nenhuma sala de vídeo de verdade é criada).
// Usado pelo ensaio-pacote.mjs; sozinho: node servidor-pacote.mjs <pasta-do-pacote> <porta>
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const famRacingFalso = async () => ({ ok: true, status: 200,
  text: async () => JSON.stringify({ ok: true, roomName: 'ensaio', roomUrl: 'https://exemplo.invalid/ensaio', tokenPiloto: 'TP', tokenBox: 'TB' }) });

const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.css': 'text/css' };

export async function servirPacote(pasta, porta = 0) {
  const PACOTE = resolve(pasta);
  const { default: room } = await import(pathToFileURL(join(PACOTE, 'api/room.js')).href);
  const servidor = createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/api/room') {
      let corpo = ''; for await (const c of req) corpo += c;
      let body = corpo; try { body = JSON.parse(corpo); } catch {}
      const r = { setHeader: (k, v) => res.setHeader(k, v), status(c) { res.statusCode = c; return this; },
        send(x) { res.end(x); }, json(x) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(x)); } };
      return room({ method: req.method, body }, r, { fetchFn: famRacingFalso });
    }
    let p = join(PACOTE, decodeURIComponent(u.pathname));
    if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html');
    if (!p.startsWith(PACOTE) || !existsSync(p)) { res.statusCode = 404; return res.end('404'); }
    res.setHeader('Content-Type', tipos[extname(p)] || 'application/octet-stream');
    res.end(readFileSync(p));
  });
  await new Promise((r) => servidor.listen(porta, '127.0.0.1', r));
  return { servidor, base: `http://127.0.0.1:${servidor.address().port}` };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { base } = await servirPacote(process.argv[2], Number(process.argv[3] || 0));
  console.log('pacote servido em ' + base);
}
