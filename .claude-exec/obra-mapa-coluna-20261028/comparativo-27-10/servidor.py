# Servidor SÓ DE LEITURA da TV do box no Mac: serve a pasta da TV (worktree tv-box-aovivo, sem escrever nada nela)
# e, em /_tocar/, a página que toca a gravação da rua de 27/10. A única diferença para o ar: na resposta de
# cloud-bridge.js acrescenta __tocarGps, que entrega o ponto pelo MESMO caminho do canal (pontosDoGps + filtro + todos os ouvintes).
import http.server, os, sys
RAIZ = '/Users/imac/Projetos/p1fast-worktrees/tv-box-aovivo'
AQUI = os.path.dirname(os.path.abspath(__file__))
EXTRA = """
// ---- acrescentado SÓ pelo servidor de demonstração do Mac (não existe no arquivo) ----
export function __tocarGps(payload) {
  for (const p of pontosDoGps(payload)) { if (_gpsNovo(p)) _fan(_onGpsPoint, p); else _stats.gpsRepetidos += 1; }
}
""".encode("utf-8")
class H(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        p = path.split('?')[0].split('#')[0]
        if p.startswith('/_tocar/'):
            return os.path.join(AQUI, p[len('/_tocar/'):])
        return os.path.join(RAIZ, p.lstrip('/'))
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store'); super().end_headers()
    def do_GET(self):
        if self.path.split('?')[0] == '/web/cockpit/cloud-bridge.js':
            corpo = open(os.path.join(RAIZ, 'web/cockpit/cloud-bridge.js'), 'rb').read() + EXTRA
            self.send_response(200); self.send_header('Content-Type', 'text/javascript; charset=utf-8')
            self.send_header('Content-Length', str(len(corpo))); self.end_headers(); self.wfile.write(corpo); return
        super().do_GET()
    def do_POST(self):
        # /api/room: a mesma porta do servidor-video-local.ps1 do notebook (sala do dia, data de BRASÍLIA UTC-3)
        if self.path.split('?')[0] != '/api/room':
            self.send_error(404); return
        import json, urllib.request, datetime
        self.rfile.read(int(self.headers.get('Content-Length') or 0))
        data = (datetime.datetime.utcnow() - datetime.timedelta(hours=3)).strftime('%Y-%m-%d')
        corpo = json.dumps({'eventId': 'p1-teste-aparelhos', 'dateISO': data}).encode()
        codigo, texto = 502, b'{"error":"backend de video inacessivel"}'
        try:
            r = urllib.request.urlopen(urllib.request.Request('https://fam-racing.vercel.app/api/video/room', data=corpo,
                headers={'Content-Type': 'application/json'}, method='POST'), timeout=15)
            codigo, texto = r.status, r.read()
        except urllib.error.HTTPError as e:
            codigo, texto = e.code, e.read()
        except Exception:
            pass
        self.send_response(codigo); self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(texto))); self.end_headers(); self.wfile.write(texto)
    def log_message(self, *a): pass
http.server.ThreadingHTTPServer(('127.0.0.1', int(sys.argv[1])), H).serve_forever()
