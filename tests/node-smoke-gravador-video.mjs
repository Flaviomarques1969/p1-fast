// ═══════════════════════════════════════════════════════════
// CATRACA da gravação do vídeo transmitido (28/10/2026, pedido do Flávio: "você precisa gravar a imagem transmitida")
// ═══════════════════════════════════════════════════════════
// Trava o que web/teste-aparelhos/gravador-video.js promete, com navegador FALSO (relógio, câmera e gravador de mentira):
//  - grava a CÓPIA da trilha transmitida (nunca a original: a transmissão segue dona dela);
//  - sem transmissão (página abriu sem internet) grava a MESMA câmera que a transmissão escolhe;
//  - pedaços chegam ao servidor local EM ORDEM, mesmo com o servidor fora por um tempo;
//  - arquivo novo a cada 10 min, quando a câmera para e quando a transmissão troca de câmera;
//  - disco cheio (507) para a gravação e não insiste;
//  - a página só liga o gravador sendo a aba líder e com o servidor local; o servidor grava só nome .webm seguro.
// Cada regra tem controle (o caso que TEM de dar o oposto).
// Roda com: node tests/node-smoke-gravador-video.mjs
import { readFileSync } from 'node:fs';
import { criarGravador, nomeDoArquivo, ROTACAO_MS } from '../web/teste-aparelhos/gravador-video.js';

let ok = 0, fail = 0;
function t(nome, cond, det = '') { if (cond) { ok++; console.log('  ok ', nome); } else { fail++; console.log('  FAIL', nome, det ? '— ' + det : ''); } }
async function secao(nome, fn) { try { await fn(); } catch (e) { t(`seção inteira: ${nome}`, false, String(e.stack || e.message).split('\n')[0]); } }
const raiz = new URL('../', import.meta.url);
const ler = (f) => readFileSync(new URL(f, raiz), 'utf8');
const espera = () => new Promise((r) => setTimeout(r, 0));
async function drenar() { for (let i = 0; i < 20; i++) await espera(); }

// ---- navegador falso ----
function mundo() {
  const m = { agora: 1782918000000, gravadores: [], enviados: [], servidor: 'ok', camerasAbertas: [] };
  class Trilha {
    constructor(dev) { this.dev = dev; this.readyState = 'live'; this.clones = 0; this.ehClone = false; }
    clone() { const c = new Trilha(this.dev); c.ehClone = true; this.clones++; return c; }
    stop() { this.readyState = 'ended'; }
    getSettings() { return { deviceId: this.dev }; }
  }
  class FakeMR {
    static isTypeSupported(t) { return t === 'video/webm;codecs=vp8' || t === 'video/webm'; }
    constructor(stream, opc) { this.stream = stream; this.opc = opc; this.state = 'inactive'; m.gravadores.push(this); }
    start(ms) { this.state = 'recording'; this.pedacoMs = ms; }
    stop() { this.state = 'inactive'; this.ondataavailable && this.ondataavailable({ data: { size: 7, tag: 'fim' } }); this.onstop && this.onstop(); }
    pedaco(n) { this.ondataavailable({ data: { size: n } }); }
  }
  class FakeMS { constructor(trilhas) { this.trilhas = trilhas; } }
  m.Trilha = Trilha;
  m.deps = {
    MediaRecorder: FakeMR, MediaStream: FakeMS, agora: () => m.agora,
    getUserMedia: async (c) => { const tr = new Trilha(c.video.deviceId ? c.video.deviceId.exact : 'padrao'); m.camerasAbertas.push(c); return { getVideoTracks: () => [tr] }; },
    setInterval: () => 1, clearInterval: () => {},
  };
  m.enviar = async (nome, blob, seq) => {
    if (m.servidor === 'fora') return { ok: false, status: 0 };
    if (m.servidor === 'cheio') return { ok: false, status: 507 };
    m.enviados.push({ nome, seq, size: blob.size }); return { ok: true, status: 200 };
  };
  return m;
}

await secao('grava a cópia da trilha transmitida', async () => {
  const m = mundo();
  const transmitida = new m.Trilha('osmo');
  const g = criarGravador({ obterTrilhaTransmitida: () => transmitida, escolherCamera: async () => 'osmo', enviarPedaco: m.enviar, deps: m.deps });
  await g.ligar();
  const rec = m.gravadores[0];
  t('abriu 1 gravador', m.gravadores.length === 1);
  t('gravou a CÓPIA (clone), não a trilha da transmissão', rec && rec.stream.trilhas[0].ehClone && rec.stream.trilhas[0] !== transmitida);
  t('não abriu a câmera de novo', m.camerasAbertas.length === 0);
  t('formato que o navegador aceita (vp8 no falso) e pedaço de 4 s', rec.opc.mimeType === 'video/webm;codecs=vp8' && rec.pedacoMs === 4000);
  t('estado diz fonte transmissão', g.estado().fonte === 'transmissao' && g.estado().gravando);
  // a página derruba a chamada para religar: a trilha original acaba, a cópia não
  transmitida.stop();
  await g.vigiar();
  t('religação da transmissão NÃO fecha o arquivo (cópia segue viva)', m.gravadores.length === 1 && rec.state === 'recording');
  await g.desligar('fim');
  t('desligar fecha e solta a câmera da cópia', rec.state === 'inactive' && rec.stream.trilhas[0].readyState === 'ended');
});

await secao('sem transmissão grava a câmera escolhida', async () => {
  const m = mundo();
  const g = criarGravador({ obterTrilhaTransmitida: () => null, escolherCamera: async () => 'osmo-123', enviarPedaco: m.enviar, deps: m.deps });
  await g.ligar();
  t('abriu a câmera escolhida pela transmissão (deviceId exato)', m.camerasAbertas.length === 1 && m.camerasAbertas[0].video.deviceId.exact === 'osmo-123');
  t('sem áudio', m.camerasAbertas[0].audio === false);
  t('fonte câmera', g.estado().fonte === 'camera');
  // controle: com transmissão viva NÃO abre câmera própria
  const m2 = mundo();
  const g2 = criarGravador({ obterTrilhaTransmitida: () => new m2.Trilha('x'), escolherCamera: async () => 'x', enviarPedaco: m2.enviar, deps: m2.deps });
  await g2.ligar();
  t('controle: com transmissão viva não abre câmera', m2.camerasAbertas.length === 0);
});

await secao('pedaços em ordem, inclusive com o servidor local fora', async () => {
  const m = mundo();
  const g = criarGravador({ obterTrilhaTransmitida: () => new m.Trilha('osmo'), enviarPedaco: m.enviar, deps: m.deps });
  await g.ligar();
  const rec = m.gravadores[0];
  rec.pedaco(100); rec.pedaco(200); await drenar();
  m.servidor = 'fora';
  rec.pedaco(300); rec.pedaco(400); await drenar();
  t('com servidor fora, 2 pedaços esperam na memória', g.estado().pendentes === 2, 'pendentes=' + g.estado().pendentes);
  t('erro aparece no estado', /servidor local/.test(g.estado().erro || ''));
  m.servidor = 'ok';
  await g.vigiar(); await drenar();
  const seqs = m.enviados.map((e) => e.seq).join(',');
  t('servidor voltou: tudo enviado na ordem 0,1,2,3', seqs === '0,1,2,3', seqs);
  t('nada pendente e erro limpo', g.estado().pendentes === 0 && g.estado().erro === null);
  t('bytes somados', g.estado().bytes === 1000, String(g.estado().bytes));
  t('todos no mesmo arquivo', new Set(m.enviados.map((e) => e.nome)).size === 1);
});

await secao('arquivo novo: 10 min, câmera parou, câmera trocada', async () => {
  const m = mundo();
  let transmitida = new m.Trilha('osmo');
  const g = criarGravador({ obterTrilhaTransmitida: () => transmitida, enviarPedaco: m.enviar, deps: m.deps });
  await g.ligar();
  const n1 = g.estado().arquivo;
  m.agora += ROTACAO_MS - 1000; await g.vigiar();
  t('controle: aos 9 min 59 s continua o mesmo arquivo', g.estado().arquivo === n1 && m.gravadores.length === 1);
  m.agora += 1000; await g.vigiar();
  t('aos 10 min abre arquivo novo', m.gravadores.length === 2 && g.estado().arquivo !== n1);
  t('o arquivo velho foi fechado', m.gravadores[0].state === 'inactive');
  // câmera parou (cópia acabou: Osmo desplugada)
  m.gravadores[1].stream.trilhas[0].stop(); await g.vigiar();
  t('câmera parou: fecha e abre outro arquivo', m.gravadores.length === 3);
  // transmissão trocou de câmera
  transmitida = new m.Trilha('outra-camera'); await g.vigiar();
  t('transmissão trocou de câmera: arquivo novo com a câmera nova', m.gravadores.length === 4 && m.gravadores[3].stream.trilhas[0].dev === 'outra-camera');
  await g.vigiar();
  t('controle: mesma câmera não abre outro', m.gravadores.length === 4);
  t('contador de arquivos', g.estado().arquivos === 4);
});

await secao('disco cheio para a gravação', async () => {
  const m = mundo();
  const g = criarGravador({ obterTrilhaTransmitida: () => new m.Trilha('osmo'), enviarPedaco: m.enviar, deps: m.deps });
  await g.ligar();
  m.servidor = 'cheio';
  m.gravadores[0].pedaco(50); await drenar();
  t('507: gravação parou', !g.estado().gravando && /disco/.test(g.estado().erro || ''));
  await g.vigiar(); await g.vigiar();
  t('não insiste em abrir arquivo novo', m.gravadores.length === 1);
});

await secao('nome do arquivo casa com o relógio do GPS', async () => {
  const n = nomeDoArquivo(1782918000123);
  t('nome .webm com o relógio em ms', /^video-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}-t1782918000123\.webm$/.test(n), n);
  t('nome passa na regra do servidor local', /^[A-Za-z0-9_.-]{1,120}\.webm$/.test(n));
});

await secao('página e servidor local', async () => {
  const p = ler('web/teste-aparelhos/index.html');
  // import fixo no topo derrubava a página INTEIRA (transmissão junto) aberta por http://localhost:8765/ — achado 28/10
  t('página NÃO importa o gravador no topo (falta do arquivo não derruba a transmissão)', !/^\s*import [^\n]*gravador-video/m.test(p));
  t('gravador carregado depois do servidor local, pela raiz', /if \(!r\.ok\) throw[\s\S]{0,300}await import\('\/web\/teste-aparelhos\/gravador-video\.js'\)/.test(p));
  const lider = p.slice(p.indexOf('function assumirLider'), p.indexOf('function assumirLider') + 400);
  t('a aba LÍDER liga a gravação junto com a transmissão', /startVideo\(\);\s*\n\s*ligarGravacao\(\);/.test(lider));
  const abd = p.slice(p.indexOf('function abdicar'), p.indexOf('function abdicar') + 400);
  t('aba que vira reserva desliga a gravação', /gravador\) gravador\.desligar\('outra aba assumiu'\)/.test(abd));
  t('só liga com o servidor local respondendo', /async function ligarGravacao[\s\S]{0,200}fetch\('\/api\/gravar'\)[\s\S]{0,120}if \(!r\.ok\) throw/.test(p));
  t('quadro de status da gravação existe', p.includes('id="bGrav"') && p.includes('id="gStatus"'));
  const s = ler('windows/cockpit/servidor-video-local.ps1');
  t('servidor local: versão subiu (substitui o velho no notebook)', /\$VERSAO = 4\b/.test(s));
  t('servidor local: rota /api/gravar acrescenta no arquivo', /\/api\/gravar/.test(s) && /FileMode\]::Append/.test(s));
  t('servidor local: nome seguro só .webm', s.includes("'^[A-Za-z0-9_.-]{1,120}\\.webm$'"));
  t('servidor local: recusa com disco quase cheio (507)', /\$livre -lt \$LIVRE_MINIMO/.test(s) && /\$code = 507/.test(s));
  t('servidor local: grava em p1fast-sessoes\\video', /p1fast-sessoes\\video/.test(s));
});

console.log(`\nnode-smoke-gravador-video: ${ok} ok, ${fail} falha`);
process.exit(fail ? 1 : 0);
