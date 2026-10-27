// ═══════════════════════════════════════════════════════════
// video-tv.js — CASA ÚNICA do vídeo da TV do box (E3 da obra "TV do box ao vivo", 27/10/2026)
// ═══════════════════════════════════════════════════════════
// A TV só ASSISTE. Pede a sala do dia na ponte do PRÓPRIO site (/api/room com papel 'tv' — a
// ponte devolve só o acesso de espectador, sem dono e sem permissão de transmitir), entra sem
// câmera nem microfone, mostra a câmera do carro (a que o notebook transmite pela USB) e se
// religa sozinha. Nenhum botão, nenhum som.
//
// Honestidade (mesma regra do selo da TV, E1): o bloco diz o que está acontecendo de verdade —
//   CÂMERA AO VIVO            quadro novo há no máx. 3 s
//   SEM VÍDEO HÁ X s          já teve imagem e ela parou (o último quadro fica apagado atrás)
//   AGUARDANDO A CÂMERA       na sala, carro ainda não transmitiu
//   SEM CONEXÃO COM A SALA    ponte/internet fora — tenta de novo sozinha (3 s → 60 s)
// "Ao vivo" se mede pelo QUADRO NOVO que chegou, não pela conexão. Atenção: em vídeo ao vivo o
// currentTime anda com o relógio mesmo com a câmera travada (prova E3, item A9) — não serve de régua.
//
// Sala: vence 2 h depois do último pedido e expulsa todo mundo (api/video/room.js). A TV pede de
// novo a cada 30 min (estende o prazo); se a sala do dia mudou (virou o dia em Brasília), religa.

export const DAILY_JS = {
  src: 'https://unpkg.com/@daily-co/daily-js@0.93.0/dist/daily.js',
  integrity: 'sha384-DUI8LbxjuFzuplRn2yxGnk1uHo/rsLGFGzzyQbEvvzCgHmyvLq/dkkWEmtvAW8Kj',
};
export const SALA_URL = '/api/room';
export const RENOVAR_SALA_MS = 30 * 60 * 1000;
export const SEM_QUADRO_MS = 3000;
export const ESPERA_MIN_MS = 3000;
export const ESPERA_MAX_MS = 60000;

function idadeTexto(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return s < 60 ? s + ' s' : Math.floor(s / 60) + ' min';
}

// Estado do bloco (puro). fase: 'conectando' | 'sem-ponte' | 'sala'; ultimoQuadroEm = relógio da
// TV no último quadro novo (null = nunca teve imagem).
export function estadoVideo({ fase, ultimoQuadroEm, agora }) {
  const idade = ultimoQuadroEm == null ? null : agora - ultimoQuadroEm;
  if (fase === 'sala' && idade != null && idade <= SEM_QUADRO_MS) return { codigo: 'ao-vivo', texto: 'CÂMERA AO VIVO' };
  const extra = fase === 'sem-ponte' ? ' · religando' : fase === 'conectando' ? ' · conectando' : '';
  if (idade != null) return { codigo: 'sem-video', texto: 'SEM VÍDEO HÁ ' + idadeTexto(idade) + extra };
  if (fase === 'sala') return { codigo: 'aguardando', texto: 'AGUARDANDO A CÂMERA DO CARRO' };
  if (fase === 'sem-ponte') return { codigo: 'sem-ponte', texto: 'SEM CONEXÃO COM A SALA DE VÍDEO · tentando de novo' };
  return { codigo: 'conectando', texto: 'CONECTANDO AO VÍDEO…' };
}

// Trilha de vídeo do carro (pura): prefere quem entrou como 'Piloto'; senão qualquer participante
// REMOTO com vídeo. Nunca a própria TV.
export function trilhaDoCarro(participantes) {
  let outra = null;
  for (const [id, p] of Object.entries(participantes || {})) {
    if (id === 'local' || !p || p.local) continue;
    const v = p.tracks && p.tracks.video;
    if (!v || !v.persistentTrack || v.state === 'off' || v.state === 'blocked') continue;
    if (p.user_name === 'Piloto') return v.persistentTrack;
    if (!outra) outra = v.persistentTrack;
  }
  return outra;
}

// Próxima espera da religação (pura): dobra até o teto.
export function proximaEspera(ms) { return Math.min(Math.max(ms, ESPERA_MIN_MS) * 2, ESPERA_MAX_MS); }

function carregarDailyPadrao(win) {
  if (win.DailyIframe) return Promise.resolve(win.DailyIframe);
  return new Promise((ok, falha) => {
    const doc = win.document;
    const velho = doc.querySelector('script[data-tvv-daily]');
    if (velho) velho.remove();   // tentativa anterior falhou: começa limpa
    const s = doc.createElement('script');
    s.src = DAILY_JS.src; s.integrity = DAILY_JS.integrity; s.crossOrigin = 'anonymous';
    s.setAttribute('data-tvv-daily', '1');
    s.onload = () => win.DailyIframe ? ok(win.DailyIframe) : falha(new Error('biblioteca de vídeo sem DailyIframe'));
    s.onerror = () => falha(new Error('biblioteca de vídeo não carregou'));
    doc.head.appendChild(s);
  });
}

const ESTILO = `
.tvv{position:absolute;inset:0;z-index:2;background:#000;}
.tvv video{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000;transition:opacity .3s;}
.tvv[data-video]:not([data-video="ao-vivo"]) video{opacity:.25;}
.tvv-selo{position:absolute;left:10px;bottom:10px;z-index:3;display:flex;align-items:center;gap:7px;max-width:calc(100% - 20px);
  padding:5px 10px;border-radius:999px;background:rgba(8,10,14,.82);border:1px solid #262a33;color:#c9ced6;
  font:700 11px/1.3 'JetBrains Mono','SF Mono',Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;}
.tvv-selo::before{content:"";flex:none;width:7px;height:7px;border-radius:50%;background:#7d828c;}
.tvv[data-video="ao-vivo"] .tvv-selo::before{background:#3ddc84;}
.tvv[data-video="sem-video"] .tvv-selo::before,.tvv[data-video="sem-ponte"] .tvv-selo::before{background:#ff5a4f;}
.tvv[data-video="aguardando"] .tvv-selo::before,.tvv[data-video="conectando"] .tvv-selo::before{background:#e8b04a;}
`;

// Liga o vídeo dentro do bloco. Dependências injetáveis (a prova troca a ponte e a biblioteca).
export function ligarVideoTv({ bloco, win = globalThis.window, fetchFn, carregarDaily, agoraFn = () => Date.now() } = {}) {
  if (!bloco) throw new Error('ligarVideoTv: bloco de vídeo ausente');
  const doc = win.document;
  const buscar = fetchFn || ((u, o) => win.fetch(u, o));
  const carregar = carregarDaily || (() => carregarDailyPadrao(win));

  if (!doc.getElementById('tvv-estilo')) {
    const st = doc.createElement('style'); st.id = 'tvv-estilo'; st.textContent = ESTILO; doc.head.appendChild(st);
  }
  // o desenho de exemplo ("REC · CAM ONBOARD 02:48.215", PiP) sai de cena: na TV ele mentia
  const falso = bloco.querySelector('.video-frame');
  if (falso) falso.style.display = 'none';
  const caixa = doc.createElement('div'); caixa.className = 'tvv';
  const video = doc.createElement('video');
  video.muted = true; video.autoplay = true; video.playsInline = true;
  video.setAttribute('muted', ''); video.setAttribute('playsinline', '');
  const selo = doc.createElement('div'); selo.className = 'tvv-selo';
  caixa.appendChild(video); caixa.appendChild(selo); bloco.appendChild(caixa);
  bloco.classList.remove('tv-nao-racebox');   // a tarja "câmera ainda não ligada" sai já, sem esperar a volta de 1 s

  const est = { fase: 'conectando', sala: null, ultimoQuadroEm: null, entradas: 0, quedas: 0, codigo: null };
  let call = null, geracao = 0, esperaMs = ESPERA_MIN_MS, religarT = null, trilha = null, ultQuadros = -1;

  function pintar() {
    const e = estadoVideo({ fase: est.fase, ultimoQuadroEm: est.ultimoQuadroEm, agora: agoraFn() });
    est.codigo = e.codigo;
    if (caixa.getAttribute('data-video') !== e.codigo) caixa.setAttribute('data-video', e.codigo);
    if (selo.textContent !== e.texto) selo.textContent = e.texto;
  }

  function prender() {
    if (!call) return;
    let t = null;
    try { t = trilhaDoCarro(call.participants()); } catch (e) { t = null; }
    if (t && t !== trilha) {
      trilha = t;
      video.srcObject = new win.MediaStream([t]);
      const p = video.play(); if (p && p.catch) p.catch(() => {});
    }
  }

  function destruir() {
    geracao++;
    trilha = null;
    if (call) { const c = call; call = null; try { const p = c.destroy(); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
  }

  function caiu(minha) {
    if (minha !== geracao) return;          // aviso da chamada velha (que eu mesmo destruí)
    destruir();
    est.fase = 'sem-ponte'; est.quedas++;
    pintar();
    clearTimeout(religarT);
    const espera = esperaMs; esperaMs = proximaEspera(esperaMs);
    religarT = win.setTimeout(conectar, espera);
  }

  async function pedirSala() {
    const r = await buscar(SALA_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ papel: 'tv' }) });
    if (!r.ok) throw new Error('sala respondeu ' + r.status);
    const sala = await r.json();
    if (!sala || !sala.roomUrl || !sala.tokenBox) throw new Error('sala sem acesso de espectador');
    return sala;
  }

  async function conectar() {
    clearTimeout(religarT);
    destruir();
    const minha = geracao;
    if (est.fase !== 'sem-ponte') est.fase = 'conectando';
    pintar();
    try {
      const sala = await pedirSala();
      const Daily = await carregar();
      if (minha !== geracao) return;
      call = Daily.createCallObject({ videoSource: false, audioSource: false, startVideoOff: true, startAudioOff: true, subscribeToTracksAutomatically: true });
      for (const ev of ['participant-joined', 'participant-updated', 'participant-left', 'track-started', 'track-stopped']) {
        call.on(ev, () => { if (minha === geracao) prender(); });
      }
      call.on('left-meeting', () => caiu(minha));
      call.on('error', () => caiu(minha));
      est.sala = sala.roomName || null;
      await call.join({ url: sala.roomUrl, token: sala.tokenBox });
      if (minha !== geracao) return;
      est.fase = 'sala'; est.entradas++; esperaMs = ESPERA_MIN_MS;
      prender(); pintar();
    } catch (e) {
      if (win.console) win.console.warn('[TV-VIDEO]', e && e.message || e);
      caiu(minha);
    }
  }

  // quadro novo = o navegador pintou um quadro NOVO (câmera travada não pinta: imagem parada não é "ao vivo").
  // requestVideoFrameCallback só dispara com quadro novo; sem ele, a contagem de quadros decodificados.
  const quadroNovo = () => { if (est.fase === 'sala' && trilha) est.ultimoQuadroEm = agoraFn(); };
  if (typeof video.requestVideoFrameCallback === 'function') {
    const aCada = () => { quadroNovo(); video.requestVideoFrameCallback(aCada); };
    video.requestVideoFrameCallback(aCada);
  }
  win.setInterval(() => {
    if (typeof video.requestVideoFrameCallback !== 'function' && typeof video.getVideoPlaybackQuality === 'function') {
      const n = video.getVideoPlaybackQuality().totalVideoFrames;
      if (n !== ultQuadros) { ultQuadros = n; if (n > 0) quadroNovo(); }
    }
    pintar();
  }, 500);

  win.setInterval(async () => {
    if (est.fase !== 'sala') return;
    try {
      const sala = await pedirSala();
      if (sala.roomName && sala.roomName !== est.sala) conectar();   // sala do dia mudou
    } catch (e) { /* a sala atual vale até 2 h; tenta de novo na próxima volta */ }
  }, RENOVAR_SALA_MS);

  win.__tvVideo = est;
  conectar();
  return { estado: est, caixa, video, conectar };
}
