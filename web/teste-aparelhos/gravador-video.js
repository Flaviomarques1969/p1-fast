// ════════ GRAVADOR DO VÍDEO TRANSMITIDO (28/10/2026, pedido do Flávio: "você precisa gravar a imagem transmitida") ════════
// A sala de vídeo (Daily) só TRANSMITE: nada ficava guardado depois do teste. Este gravador guarda, no disco do
// PRÓPRIO notebook, a mesma imagem que vai para a sala:
//   • fonte 'transmissao' = cópia (clone) da trilha que a página manda para a sala — é exatamente a imagem
//     transmitida, e a cópia continua viva quando a página derruba a chamada para religar (internet caiu);
//   • fonte 'camera' = só quando ainda não há trilha transmitida (página abriu sem internet): abre a MESMA câmera
//     que a transmissão escolhe (escolherOsmo), para a pista sem sinal não ficar sem vídeo.
// Um arquivo .webm a cada 10 min (arquivo fechado = arquivo inteiro, mesmo se o notebook desligar depois); o nome
// leva a hora do notebook e o relógio em ms do início — o mesmo relógio do GPS gravado (tWall), para casar vídeo e volta.
// Os pedaços vão em ordem para o servidor local (POST /api/gravar/<arquivo>), que grava em
// %USERPROFILE%\p1fast-sessoes\video\. Sem servidor local (página aberta na nuvem) o gravador não liga.
// Nada aqui mexe na transmissão: erro do gravador fica no gravador.

export const ROTACAO_MS = 10 * 60 * 1000;   // um arquivo a cada 10 min
export const PEDACO_MS = 4000;              // o navegador entrega um pedaço a cada 4 s
export const TAXA_BPS = 2500000;            // ~2,5 Mbps ≈ 1,1 GB/h (estimativa pela taxa) — melhor que o 1 Mbps transmitido
export const TETO_PENDENTE = 300 * 1024 * 1024; // memória máxima esperando o servidor local
const TIPOS = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];

function dois(n) { return String(n).padStart(2, '0'); }
export function nomeDoArquivo(ms) {
  const d = new Date(ms);
  return 'video-' + d.getFullYear() + '-' + dois(d.getMonth() + 1) + '-' + dois(d.getDate()) + '_' +
    dois(d.getHours()) + '-' + dois(d.getMinutes()) + '-' + dois(d.getSeconds()) + '-t' + ms + '.webm';
}

function idDaCamera(track) {
  try { return (track && track.getSettings && track.getSettings().deviceId) || null; } catch (e) { return null; }
}

export function criarGravador(o) {
  const deps = o.deps || {};
  const MR = deps.MediaRecorder || globalThis.MediaRecorder;
  const MS = deps.MediaStream || globalThis.MediaStream;
  const agora = deps.agora || (() => Date.now());
  const pedirCamera = deps.getUserMedia || (c => navigator.mediaDevices.getUserMedia(c));
  const log = o.log || (() => {});
  const aoMudar = o.aoMudar || (() => {});
  const rotacaoMs = o.rotacaoMs || ROTACAO_MS;

  let ligado = false, vigia = null, abrindo = false, parado = null;
  let atual = null;            // { nome, rec, track, fonte, camera, inicio, seq }
  let fila = [];               // pedaços esperando o servidor local, em ordem
  let pendenteBytes = 0, enviando = false;
  const est = { gravando: false, fonte: null, arquivo: null, inicio: null, bytes: 0, arquivos: 0, pendentes: 0, erro: null };
  const avisar = () => { est.pendentes = fila.length; try { aoMudar({ ...est }); } catch (e) {} };

  function tipo() {
    for (const t of TIPOS) { try { if (!MR.isTypeSupported || MR.isTypeSupported(t)) return t; } catch (e) {} }
    return '';
  }

  async function esvaziar() {
    if (enviando) return;
    enviando = true;
    try {
      while (fila.length) {
        const p = fila[0];
        let r;
        try { r = await o.enviarPedaco(p.nome, p.blob, p.seq); } catch (e) { r = { ok: false, status: 0 }; }
        if (r && r.ok) {
          fila.shift(); pendenteBytes -= p.blob.size; est.bytes += p.blob.size; est.erro = null;
        } else if (r && r.status === 507) {
          // disco do notebook quase cheio: para de gravar (a transmissão segue)
          est.erro = 'disco do notebook cheio — gravação parada';
          log('GRAVAÇÃO PARADA: disco do notebook quase cheio. A transmissão continua.');
          fila = []; pendenteBytes = 0; parado = 'disco';
          await fechar('disco cheio');
          break;
        } else {
          est.erro = 'servidor local não respondeu (' + ((r && r.status) || 'sem resposta') + ') — guardando na memória';
          break;   // tenta de novo na próxima volta da vigia; a ordem dos pedaços é mantida
        }
      }
    } finally { enviando = false; avisar(); }
  }

  function guardarPedaco(nome, blob, seq) {
    if (!blob || !blob.size || parado) return;   // disco cheio: o resto do arquivo não vai mais
    fila.push({ nome, blob, seq }); pendenteBytes += blob.size;
    while (pendenteBytes > TETO_PENDENTE && fila.length > 1) {
      const velho = fila.shift(); pendenteBytes -= velho.blob.size;
      est.erro = 'servidor local fora há muito tempo — pedaços antigos descartados';
    }
    esvaziar();
  }

  async function abrir() {
    if (abrindo || atual || !ligado || parado) return;
    abrindo = true;
    try {
      let track = null, fonte = null;
      const t = o.obterTrilhaTransmitida && o.obterTrilhaTransmitida();
      if (t && t.readyState === 'live') { track = t.clone(); fonte = 'transmissao'; }
      else {
        const id = o.escolherCamera ? await o.escolherCamera() : null;
        const video = { width: { ideal: 1280, max: 1280 }, height: { ideal: 720, max: 720 }, frameRate: { ideal: 24, max: 24 } };
        if (id) video.deviceId = { exact: id };
        const s = await pedirCamera({ video, audio: false });
        track = s.getVideoTracks()[0]; fonte = 'camera';
      }
      if (!ligado || !track) { try { track && track.stop(); } catch (e) {} return; }
      const inicio = agora();
      const nome = nomeDoArquivo(inicio);
      const rec = new MR(new MS([track]), { mimeType: tipo(), videoBitsPerSecond: TAXA_BPS });
      const meu = { nome, rec, track, fonte, camera: idDaCamera(track), inicio, seq: 0 };
      rec.ondataavailable = e => guardarPedaco(nome, e.data, meu.seq++);
      rec.onstop = () => { try { track.stop(); } catch (e) {} };
      rec.onerror = e => { log('Gravação deu erro (' + ((e && e.error && e.error.name) || 'desconhecido') + ') — abro outro arquivo.'); fechar('erro do gravador'); };
      rec.start(PEDACO_MS);
      atual = meu;
      Object.assign(est, { gravando: true, fonte, arquivo: nome, inicio, erro: null }); est.arquivos++;
      log('GRAVANDO o vídeo ' + (fonte === 'transmissao' ? 'transmitido' : 'da câmera (ainda sem transmissão)') + ' em ' + nome);
    } catch (e) {
      est.erro = 'não consegui gravar: ' + (e && (e.message || e.name) || e);
      log('Gravação não começou (' + est.erro + ') — tento de novo em instantes.');
    } finally { abrindo = false; avisar(); }
  }

  async function fechar(motivo) {
    const a = atual; if (!a) return;
    atual = null;
    est.gravando = false; est.fonte = null;
    try { if (a.rec.state !== 'inactive') a.rec.stop(); else a.track.stop(); } catch (e) { try { a.track.stop(); } catch (e2) {} }
    log('Arquivo de vídeo fechado (' + motivo + '): ' + a.nome);
    avisar();
  }

  async function vigiar() {
    if (!ligado) return;
    if (fila.length) esvaziar();
    const a = atual;
    if (a) {
      const t = o.obterTrilhaTransmitida && o.obterTrilhaTransmitida();
      if (a.track.readyState === 'ended') await fechar('a câmera parou');
      else if (a.fonte === 'transmissao' && t && t.readyState === 'live' && idDaCamera(t) && a.camera && idDaCamera(t) !== a.camera) await fechar('a transmissão trocou de câmera');
      else if (agora() - a.inicio >= rotacaoMs) await fechar('arquivo novo a cada ' + Math.round(rotacaoMs / 60000) + ' min');
    }
    if (!atual) await abrir();
  }

  return {
    ligar() {
      if (ligado) return; ligado = true; parado = null;
      vigia = (deps.setInterval || setInterval)(vigiar, o.vigiaMs || 3000);
      return vigiar();
    },
    async desligar(motivo) {
      if (!ligado) return; ligado = false;
      (deps.clearInterval || clearInterval)(vigia); vigia = null;
      await fechar(motivo || 'gravador desligado');
    },
    vigiar,
    estado: () => ({ ...est, pendentes: fila.length }),
  };
}
