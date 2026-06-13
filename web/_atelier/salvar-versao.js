/* salvar-versao.js — botão "salvar última versão" do Atelier de mockups (P1 Fast).
 *
 * PADRÃO (regra Flávio 13/06/2026): todo mockup novo inclui este arquivo. Um clique salva a
 * versão atual do arranjo no disco (via o ajudante local atelier-server.mjs). Se o ajudante
 * estiver desligado, baixa o arquivo automático como reserva — nunca perde.
 *
 * Como incluir num mockup (1 linha, antes de </body>):
 *   <script>window.ATELIER_VISTA='piloto';</script>
 *   <script src="../web/_atelier/salvar-versao.js"></script>
 * (ajuste o caminho relativo conforme a pasta do mockup; ATELIER_VISTA = nome da vista)
 */
(function () {
  var SERVIDOR = 'http://localhost:8077/atelier/salvar-versao';

  function vistaDoArquivo() {
    if (window.ATELIER_VISTA) return String(window.ATELIER_VISTA);
    var p = (location.pathname || '').toLowerCase();
    if (p.indexOf('engenheiro') >= 0) return 'engenheiro';
    if (p.indexOf('piloto') >= 0) return 'piloto';
    return 'mockup';
  }

  function lerArranjo() {
    var els = Array.prototype.slice.call(document.querySelectorAll('[data-block-id]'));
    var blocks = els.map(function (el) {
      var x = parseFloat(el.style.left) || 0, y = parseFloat(el.style.top) || 0;
      var w = parseFloat(el.style.width) || 0, h = parseFloat(el.style.height) || 0;
      return {
        id: el.dataset.blockId, name: el.dataset.blockName || '', custom: el.dataset.custom === '1',
        pct: { x: +x.toFixed(2), y: +y.toFixed(2), w: +w.toFixed(2), h: +h.toFixed(2) },
        px: { x: Math.round(x * 1280 / 100), y: Math.round(y * 720 / 100), w: Math.round(w * 1280 / 100), h: Math.round(h * 720 / 100) }
      };
    });
    return { device: document.title || 'mockup', vista: vistaDoArquivo(), stage_px: { w: 1280, h: 720 }, ts: new Date().toISOString(), blocks: blocks };
  }

  function arranjoCheio(json) {
    var b = json.blocks || [];
    var comPos = b.filter(function (x) { return x.pct && (x.pct.x || x.pct.y || x.pct.w || x.pct.h); }).length;
    return b.length > 0 && comPos >= Math.ceil(b.length * 0.6);
  }

  function baixarReserva(json) {
    var blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'vista-' + json.vista + '-layout.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  function estado(txt, cor) {
    var s = document.getElementById('atelier-salvar-status');
    if (s) { s.textContent = txt; s.style.color = cor || '#9aa0a6'; }
  }

  function salvar() {
    var json = lerArranjo();
    if (!arranjoCheio(json)) {
      estado('arranjo vazio — abra o painel com o seu layout carregado', '#f59e0b');
      return;
    }
    estado('salvando…', '#9aa0a6');
    var url = SERVIDOR + '?vista=' + encodeURIComponent(json.vista) + '&nota=' + encodeURIComponent('salvo pelo botão');
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(json) })
      .then(function (r) { return r.json(); })
      .then(function (r) {
        if (r && r.ok) estado('salvo · ' + (r.arquivo || '').split('/').pop(), '#3fe08c');
        else { estado('recusado: ' + ((r && r.motivo) || 'erro'), '#ef4444'); }
      })
      .catch(function () {
        baixarReserva(json);
        estado('ajudante desligado — baixei o arquivo (reserva)', '#f59e0b');
      });
  }

  function montarBotao() {
    if (document.getElementById('atelier-salvar-btn')) return;
    var css = document.createElement('style');
    css.textContent = ''
      + '#atelier-salvar-wrap{position:fixed;left:14px;bottom:14px;z-index:99999;display:flex;align-items:center;gap:10px;'
      + 'font:600 12px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}'
      + '#atelier-salvar-btn{display:inline-flex;align-items:center;gap:8px;background:#1f6feb;color:#fff;border:none;'
      + 'border-radius:10px;padding:11px 16px;font:700 13px/1 inherit;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.45);}'
      + '#atelier-salvar-btn:hover{background:#388bfd;}'
      + '#atelier-salvar-btn svg{width:16px;height:16px;}'
      + '#atelier-salvar-status{color:#9aa0a6;background:rgba(10,12,16,.8);padding:6px 10px;border-radius:8px;border:1px solid #2a2f3a;backdrop-filter:blur(4px);}';
    document.head.appendChild(css);
    var wrap = document.createElement('div');
    wrap.id = 'atelier-salvar-wrap';
    wrap.innerHTML =
      '<button id="atelier-salvar-btn" type="button" title="Salva a versão atual do arranjo">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg>'
      + 'salvar última versão</button>'
      + '<span id="atelier-salvar-status"></span>';
    document.body.appendChild(wrap);
    document.getElementById('atelier-salvar-btn').addEventListener('click', salvar);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montarBotao);
  else montarBotao();
})();
