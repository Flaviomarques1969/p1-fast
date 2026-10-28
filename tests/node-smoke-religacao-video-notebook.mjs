// ═══════════════════════════════════════════════════════════
// CATRACA — religação do vídeo da Central de Pista (notebook), 27/10/2026
// ═══════════════════════════════════════════════════════════
// Episódio: "a câmera não entrou no TV box" — sala de vídeo LOTADA ("Meeting is full") e
// /api/room respondendo 429 (pedidos demais). Causa no código da página do notebook
// (web/teste-aparelhos/index.html): a daily-js 0.93.0 dispara 'left-meeting' quando a PRÓPRIA
// página destrói a chamada velha (destroy → leave → left-meeting), e a página tratava isso como
// queda nova → agendava outra religação, que destruía a chamada boa → laço sem fim de entra/sai
// (cada volta pede sala de novo). E um erro de entrada ('error' + join rejeitado) agendava DUAS
// religações por queda → as tentativas dobravam a cada rodada.
// O conserto (mesmo desenho da TV, web/command-box/video-tv.js): número de geração por chamada
// (aviso de chamada velha é ignorado) + UMA religação agendada por vez.
// Esta catraca roda o trecho de vídeo REAL da página contra uma Daily falsa que imita a 0.93.0
// e conta entradas na sala e pedidos de sala em 10 min de relógio simulado.
// CONTROLE: a versão de antes do conserto (commit 1b9857db6) TEM de reprovar.
// Roda com: node tests/node-smoke-religacao-video-notebook.mjs   (e dentro de npm run smoke)
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';

let ok = 0, fail = 0;
function t(nome, cond, det = '') { if (cond) { ok++; console.log('  ok ', nome); } else { fail++; console.log('  FAIL', nome, det ? '— ' + det : ''); } }
const raiz = new URL('../', import.meta.url);
const PAGINA = 'web/teste-aparelhos/index.html';
const ANTES_DO_CONSERTO = '1b9857db6';

// Trecho de vídeo da página: do cabeçalho VÍDEO até TELA ACESA (startVideo, onVideoDown, qualidade, renovar sala).
function trechoVideo(html) {
  const ini = html.indexOf('// ════════════════ VÍDEO (Daily.co)');
  const fim = html.indexOf('// TELA ACESA');
  if (ini < 0 || fim < 0 || fim < ini) throw new Error('marcadores VÍDEO/TELA ACESA não achados em ' + PAGINA);
  return html.slice(ini, fim);
}
// Líder único entre abas: abdicar() também mexe na chamada.
function trechoAbdicar(html) {
  const m = html.match(/function abdicar\(\)\{[\s\S]*?\n\}/);
  if (!m) throw new Error('abdicar() não achada em ' + PAGINA);
  return m[0];
}

const respirar = async () => { for (let i = 0; i < 8; i++) await new Promise((r) => setImmediate(r)); };

// Monta a página num contexto isolado com relógio simulado e Daily falsa.
function montar(html, cenario) {
  let agora = 0, prox = 1;
  const timers = new Map();
  const sim = { entradas: 0, pedidosSala: 0, vivas: 0, maxVivas: 0, chamadas: [], sala: 'sala-do-dia', lotadaAte: cenario.lotadaAte || 0 };
  const emitir = (c, ev, arg) => { for (const fn of c.h[ev] || []) fn(arg || {}); };
  class ChamadaFalsa {
    constructor() { this.h = {}; this.estado = 'new'; this.destruida = false; sim.vivas++; sim.maxVivas = Math.max(sim.maxVivas, sim.vivas); sim.chamadas.push(this); }
    on(ev, fn) { (this.h[ev] ||= []).push(fn); }
    async join() {
      sim.entradas++;
      this.estado = 'joining';
      await null;
      if (this.destruida) throw new Error('chamada destruída');
      if (sim.entradas <= sim.lotadaAte) {
        // como a 0.93.0: erro fatal → estado 'error' (leave/destroy depois NÃO emite left-meeting) + join rejeita
        this.estado = 'error';
        emitir(this, 'error', { errorMsg: 'Meeting is full' });
        throw new Error('Meeting is full');
      }
      this.estado = 'joined';
      emitir(this, 'joined-meeting');
    }
    // como a 0.93.0: destroy() chama leave(); em sala (ou entrando) emite 'left-meeting' para quem ainda ouve
    async destroy() {
      if (this.destruida) return;
      this.destruida = true;
      const estava = this.estado;
      this.estado = 'left-meeting';
      await null;
      if (estava === 'joined' || estava === 'joining') emitir(this, 'left-meeting');
      sim.vivas--;
    }
    quedaDeRede() { if (this.estado !== 'joined') return; this.estado = 'left-meeting'; emitir(this, 'left-meeting'); }
    async setLocalVideo() {} async setLocalAudio() {} async updateInputSettings() {} async updateSendSettings() {}
    async setInputDevicesAsync() {} async enumerateDevices() { return { devices: [] }; }
    participants() { return { local: { tracks: { video: { state: 'playable' } } } }; }
    sendAppMessage() {}
  }
  const el = () => ({ disabled: false, textContent: '', srcObject: null, value: '', style: {}, classList: { add() {}, remove() {} } });
  const els = {};
  const ctx = {
    console, Math, Date, Promise, Error, JSON,
    window: { DailyIframe: { createCallObject: () => new ChamadaFalsa() } },
    $: (id) => (els[id] ||= el()),
    pill() {}, boardPill() {}, log() {},
    listCams: async () => {}, renderLocal() {}, repicarCamera() {},
    camCuraTimer: null, camAtualId: null, videoNaSala: false,
    fetch: async (url, op) => {
      if (url === '/api/room' && op && op.method === 'POST') {
        sim.pedidosSala++;
        return { ok: true, status: 200, json: async () => ({ roomName: sim.sala, roomUrl: 'https://falsa.daily.co/' + sim.sala, tokenPiloto: 'tk' }) };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    },
    setTimeout: (fn, ms) => { const id = prox++; timers.set(id, { em: agora + (ms || 0), fn }); return id; },
    clearTimeout: (id) => { timers.delete(id); },
    setInterval: (fn, ms) => { const id = prox++; const rodar = () => { fn(); timers.set(id, { em: agora + ms, fn: rodar }); }; timers.set(id, { em: agora + ms, fn: rodar }); return id; },
    clearInterval: (id) => { timers.delete(id); },
  };
  vm.createContext(ctx);
  vm.runInContext(trechoVideo(html) + '\n' + trechoAbdicar(html) +
    '\nvar souLider = true, vigiarReserva = function(){};' +
    '\nthis.__startVideo = startVideo; this.__abdicar = abdicar;', ctx);
  async function correrAte(ms) {
    for (;;) {
      await respirar();
      let id = null, alvo = null;
      for (const [k, v] of timers) if (v.em <= ms && (!alvo || v.em < alvo.em)) { id = k; alvo = v; }
      if (!alvo) break;
      timers.delete(id); agora = alvo.em; alvo.fn();
    }
    agora = ms; await respirar();
  }
  const viva = () => sim.chamadas.filter((c) => !c.destruida && c.estado === 'joined');
  return { sim, ctx, correrAte, viva, agoraMs: () => agora };
}

const MIN = 60 * 1000;

async function rodarCenarios(html, rotulo) {
  const r = {};
  // 1. Liga e fica parado 10 min: entra UMA vez.
  {
    const p = montar(html, {});
    p.ctx.__startVideo(); await p.correrAte(10 * MIN);
    r.parado = { entradas: p.sim.entradas, vivas: p.viva().length };
  }
  // 2. Uma queda de rede: religa UMA vez e assenta. (A versão antiga também passa aqui: a chamada que
  //    caiu já está fora da sala e o destroy não avisa — o laço nascia na sala lotada e na troca de sala.)
  {
    const p = montar(html, {});
    p.ctx.__startVideo(); await p.correrAte(20 * 1000);
    p.viva()[0] && p.viva()[0].quedaDeRede();
    await p.correrAte(10 * MIN);
    r.queda = { entradas: p.sim.entradas, pedidos: p.sim.pedidosSala, vivas: p.viva().length, maxVivas: p.sim.maxVivas };
  }
  // 3. Sala lotada nas 3 primeiras tentativas: UMA religação por falha (antes: dobrava).
  {
    const p = montar(html, { lotadaAte: 3 });
    p.ctx.__startVideo(); await p.correrAte(10 * MIN);
    r.lotada = { entradas: p.sim.entradas, pedidos: p.sim.pedidosSala, vivas: p.viva().length };
  }
  // 4. Virou o dia (sala nova na renovação dos 30 min): troca de sala UMA vez e assenta.
  {
    const p = montar(html, {});
    p.ctx.__startVideo(); await p.correrAte(29 * MIN);
    p.sim.sala = 'sala-do-dia-seguinte';
    await p.correrAte(40 * MIN);
    const v = p.viva();
    r.virouDia = { entradas: p.sim.entradas, vivas: v.length, maxVivas: p.sim.maxVivas };
  }
  // 5. Aba vira reserva (abdicar): sai da sala e NÃO volta sozinha.
  {
    const p = montar(html, {});
    p.ctx.__startVideo(); await p.correrAte(20 * 1000);
    p.ctx.__abdicar(); await p.correrAte(10 * MIN);
    r.abdicou = { entradas: p.sim.entradas, vivas: p.viva().length };
  }
  console.log(`  [${rotulo}]`, JSON.stringify(r));
  return r;
}

function julgar(r) {
  return {
    parado: r.parado.entradas === 1 && r.parado.vivas === 1,
    queda: r.queda.entradas === 2 && r.queda.pedidos === 2 && r.queda.vivas === 1 && r.queda.maxVivas <= 1,
    lotada: r.lotada.entradas === 4 && r.lotada.pedidos === 4 && r.lotada.vivas === 1,
    virouDia: r.virouDia.entradas === 2 && r.virouDia.vivas === 1 && r.virouDia.maxVivas <= 1,
    abdicou: r.abdicou.entradas === 1 && r.abdicou.vivas === 0,
  };
}

console.log('Religação do vídeo da Central de Pista (notebook)');
try {
  const atual = julgar(await rodarCenarios(readFileSync(new URL(PAGINA, raiz), 'utf8'), 'página atual'));
  t('parado 10 min: entra na sala 1 vez', atual.parado);
  t('1 queda de rede: religa 1 vez e assenta (sem laço entra/sai)', atual.queda);
  t('sala lotada 3x: 1 religação por falha (4 pedidos de sala, não dobra)', atual.lotada);
  t('virou o dia: troca de sala 1 vez e assenta', atual.virouDia);
  t('aba vira reserva: sai e não volta sozinha', atual.abdicou);
} catch (e) { t('seção inteira: página atual', false, String(e.message).split('\n')[0]); }

// CONTROLE: a página de antes do conserto TEM de reprovar (régua que só passa é régua desligada).
try {
  const velho = execFileSync('git', ['show', `${ANTES_DO_CONSERTO}:${PAGINA}`], { cwd: new URL('.', raiz).pathname, encoding: 'utf8', maxBuffer: 8 << 20 });
  const ant = julgar(await rodarCenarios(velho, 'controle ' + ANTES_DO_CONSERTO));
  t('CONTROLE: versão sem guarda reprova a sala lotada', !ant.lotada);
  t('CONTROLE: versão sem guarda reprova a virada de dia', !ant.virouDia);
  t('CONTROLE: versão sem guarda passa o caso parado (régua não reprova tudo)', ant.parado);
} catch (e) { t('seção inteira: controle', false, String(e.message).split('\n')[0]); }

console.log(`\n${ok} ok, ${fail} falha`);
process.exit(fail ? 1 : 0);
