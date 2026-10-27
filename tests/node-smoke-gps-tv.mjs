// node-smoke-gps-tv.mjs — CATRACA do item 5 do GPS (Flávio 27/10/2026, painel p1fast-gps-funcoes-0850):
// TV do box com mapa ao vivo (velocidade + G), círculo de G e tempos de volta e setores.
// Casa da conta: web/command-box/cerebro/cerebro-gps-tv.js. Offline, sem rede.
// Cada regra tem um CONTROLE que tem de dar o resultado oposto.
import { readFileSync } from 'node:fs';
import { criarCerebroGpsTv, SEM_DADO_MS } from '../web/command-box/cerebro/cerebro-gps-tv.js';

let ok = 0, fail = 0;
const t = (nome, cond, extra) => { if (cond) { ok++; console.log('  ok ', nome); } else { fail++; console.log('  FAIL', nome, extra ?? ''); } };
const ler = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const perto = (a, b, tol) => a != null && b != null && Math.abs(a - b) <= tol;

// ── Pista de teste: círculo em volta de um centro em Brasília; fração = ângulo/2π ──
const C = { lat: -15.77, lng: -47.90 }, RAIO = 0.002;
const projetar = (lat, lng) => {
  const ang = Math.atan2(lat - C.lat, lng - C.lng);
  return { x: (lng - C.lng) * 1e5, y: (lat - C.lat) * 1e5, frac: ((ang / (2 * Math.PI)) % 1 + 1) % 1 };
};
const MARCO = { a_gps: { lat: C.lat, lng: C.lng + RAIO * 0.75 }, b_gps: { lat: C.lat, lng: C.lng + RAIO * 1.25 } };
function ponto(fr, tWall, extra = {}) {
  const ang = 2 * Math.PI * fr;
  return { lat: C.lat + RAIO * Math.sin(ang), lng: C.lng + RAIO * Math.cos(ang), kmh: 80, fix: 3, accM: 0.4,
    tWall, source: 'racebox', ...extra };
}
/** Anda `voltas` voltas a 25 Hz; cada volta dura tempos[i] s; setor k anda uniformemente na fração. */
function rodar(cerebro, tempos, { inicioFrac = 0.9, extra = () => ({}), pularEm = null } = {}) {
  let tw = 1_000_000;
  // volta de saída: de inicioFrac até a chegada (fração 1)
  for (let fr = inicioFrac; fr < 1; fr += 0.002) { tw += 40; cerebro.feedGps(ponto(fr, tw, extra(tw))); }
  for (let v = 0; v < tempos.length; v++) {
    const n = Math.round(tempos[v] * 25);
    for (let i = 1; i <= n; i++) {
      const fr = (i / n) % 1;
      tw += 40;
      if (pularEm != null && v === pularEm.volta && fr > pularEm.de && fr < pularEm.ate) continue;
      cerebro.feedGps(ponto(fr + 1e-6, tw, extra(tw)));
    }
  }
  // um pouco além da chegada
  for (let i = 1; i <= 25; i++) { tw += 40; cerebro.feedGps(ponto(i / 2000, tw, extra(tw))); }
  return tw;
}

// 1) Voltas e setores
{
  const c = criarCerebroGpsTv({ marcoChegada: MARCO, projetar });
  rodar(c, [60, 58, 61]);
  const s = c.snapshot();
  t('3 voltas fechadas (volta de saída não conta)', s.voltas.length === 3, s.voltas.length);
  t('tempo da volta bate (±0,08 s)', s.voltas.every((v, i) => perto(v.tempoS, [60, 58, 61][i], 0.08)), JSON.stringify(s.voltas.map(v => v.tempoS)));
  t('3 setores por volta, cada ~1/3 (±0,1 s)', s.voltas.every((v, i) => v.setoresS && v.setoresS.length === 3
    && v.setoresS.every(x => perto(x, [60, 58, 61][i] / 3, 0.1))), JSON.stringify(s.voltas.map(v => v.setoresS)));
  t('soma dos setores = tempo da volta (exato)', s.voltas.every(v => v.setoresS && perto(v.setoresS.reduce((a, b) => a + b, 0), v.tempoS, 0.002)));
  t('melhor volta = a 2ª (58 s)', s.melhorVolta && s.melhorVolta.n === 2);
  t('delta da última contra a melhor = +3 s', perto(s.deltaUltimaS, 3, 0.1), s.deltaUltimaS);
  t('volta ideal = soma dos melhores setores (≈58 s)', perto(s.voltaIdealS, 58, 0.15), s.voltaIdealS);
  t('volta em curso: nº 4, setor 1', s.voltaAtual && s.voltaAtual.n === 4 && s.voltaAtual.setorAtual === 1);
  t('mapa: rastro da última volta tem pontos com x/y/kmh', s.mapa.ultima.length > 50 && s.mapa.ultima.every(p => p.x != null && p.kmh === 80));
}
// controle: sentido trocado → voltas contam, setores NÃO (linha nunca é cruzada "para a frente")
{
  const c = criarCerebroGpsTv({ marcoChegada: MARCO, projetar, sentido: -1 });
  rodar(c, [60, 58]);
  const s = c.snapshot();
  t('controle: sentido trocado → voltas contam e setores ficam vazios', s.voltas.length === 2 && s.voltas.every(v => v.setoresS === null));
}
// buraco no GPS que pula a linha do setor 2 → a volta fica sem setores (não inventa)
{
  const c = criarCerebroGpsTv({ marcoChegada: MARCO, projetar });
  rodar(c, [60, 60], { pularEm: { volta: 0, de: 0.62, ate: 0.72 } });
  const s = c.snapshot();
  t('salto de projeção sobre a linha do setor → setores null só naquela volta',
    s.voltas[0].setoresS === null && Array.isArray(s.voltas[1].setoresS), JSON.stringify(s.voltas.map(v => v.setoresS)));
}
// portas de qualidade
{
  const c = criarCerebroGpsTv({ marcoChegada: MARCO, projetar });
  t('iPhone descartado', c.feedGps(ponto(0.5, 10, { source: 'iphone-gps' })) === false);
  t('fix 2D descartado', c.feedGps(ponto(0.5, 11, { fix: 2 })) === false);
  t('precisão ≥ 50 m descartada', c.feedGps(ponto(0.5, 12, { accM: 50 })) === false);
  t('controle: ponto bom entra', c.feedGps(ponto(0.5, 13)) === true);
  t('repetido/fora de ordem descartado (fila reenviada)', c.feedGps(ponto(0.5, 13)) === false && c.feedGps(ponto(0.5, 5)) === false);
  t('aceita "lon" (formato da gravação)', (() => { const p = ponto(0.5, 20); p.lon = p.lng; delete p.lng; return c.feedGps(p); })());
  t('fresco até 2,5 s sem ponto; depois não', c.snapshot(20 + SEM_DADO_MS).fresco === true && c.snapshot(21 + SEM_DADO_MS).fresco === false);
}

// 2) Círculo de G e cor do mapa
{
  const c = criarCerebroGpsTv({ marcoChegada: MARCO, projetar });
  // G do notebook: freando forte na 1ª metade de cada volta, curva à esquerda na 2ª
  const extra = (tw) => {
    const fase = Math.floor((tw - 1_000_000) / 40) % 1500;
    return fase < 400 ? { gLong: -0.8, gLat: 0.1, zeroOk: true }
      : fase < 800 ? { gLong: 0.3, gLat: 0.0, zeroOk: true }
      : { gLong: 0.0, gLat: -1.1, zeroOk: true };
  };
  rodar(c, [60, 60], { extra });
  const s = c.snapshot();
  const p = s.voltas[0].picosG;
  t('picos da volta: freio −0,8 / aceleração +0,3 / lateral −1,1', p && perto(p.freioMax, -0.8, 1e-9) && perto(p.acelMax, 0.3, 1e-9) && perto(p.latMax, -1.1, 1e-9), JSON.stringify(p));
  t('G combinado máximo = 1,1 (curva) e não 0,81 (freio)', perto(p.combinadoMax, 1.1, 1e-9), p.combinadoMax);
  t('rastro do círculo = só os últimos 3 s (≤ 76 pontos a 25 Hz)', s.circuloG.rastro.length > 60 && s.circuloG.rastro.length <= 76, s.circuloG.rastro.length);
  t('nuvem da volta a 10 Hz (~600 pontos numa volta de 60 s)', s.circuloG.ultima.length >= 590 && s.circuloG.ultima.length <= 610, s.circuloG.ultima.length);
  const fases = new Set(s.mapa.ultima.map(q => q.fase));
  t('mapa colore freio / aceleração / embalo pelo G do carro', fases.has('freio') && fases.has('acel') && fases.has('embalo'), [...fases].join(','));
}
// controle: G sem zero do box → mostra o ponto vivo, mas não soma pico nem colore o mapa
{
  const c = criarCerebroGpsTv({ marcoChegada: MARCO, projetar });
  rodar(c, [60], { extra: () => ({ gLong: -0.9, gLat: 0.2, zeroOk: false }) });
  const s = c.snapshot();
  t('controle: sem zero do box → sem picos e sem cor de fase', s.voltas[0].picosG === null && s.mapa.ultima.every(q => q.fase === null));
  t('controle: sem zero do box → ponto vivo aparece marcado zeroOk=false', s.circuloG.vivo && s.circuloG.vivo.zeroOk === false);
}
// controle: gravação sem G (Cockpit antigo) → círculo vazio, voltas continuam
{
  const c = criarCerebroGpsTv({ marcoChegada: MARCO, projetar });
  rodar(c, [60]);
  const s = c.snapshot();
  t('controle: sem gLong/gLat → círculo vazio e volta contada', s.circuloG.vivo === null && s.circuloG.rastro.length === 0 && s.voltas.length === 1);
}

// 3) Sessão REAL de pista (21/06, RaceBox 25 Hz, sem G) com a geometria real de Brasília
{
  const j = JSON.parse(ler('web/command-box/fixtures/replay-hoje-2026-06-21.json'));
  const m = JSON.parse(ler('web/command-box/fixtures/replay-hoje-mapa.json'));
  const c = criarCerebroGpsTv();
  for (const a of j.amostras) if (a.tipo === 'gps') c.feedGps(a);
  const s = c.snapshot();
  t('real 21/06: 2 voltas, como o recorte gravado do mapa', s.voltas.length === m.voltas.length, s.voltas.length);
  t('real 21/06: tempos batem com o recorte (±0,1 s)', s.voltas.every((v, i) => perto(v.tempoS, m.voltas[i].lapSec, 0.1)),
    JSON.stringify(s.voltas.map(v => v.tempoS)) + ' × ' + JSON.stringify(m.voltas.map(v => v.lapSec)));
  t('real 21/06: as 2 voltas têm os 3 setores e somam a volta', s.voltas.every(v => v.setoresS && v.setoresS.length === 3
    && perto(v.setoresS.reduce((a, b) => a + b, 0), v.tempoS, 0.002)), JSON.stringify(s.voltas.map(v => v.setoresS)));
  t('real 21/06: rastro do mapa no espaço do desenho (viewBox 130..710 × 110..770)',
    s.mapa.ultima.length > 300 && s.mapa.ultima.every(p => p.x > 100 && p.x < 740 && p.y > 80 && p.y < 800), s.mapa.ultima.length);
}

// 4) Ligações na fonte (quem desligar reprova aqui)
const live = ler('windows/cockpit/P1Fast.Cockpit.UI/MainWindow.Live.cs');
const dic = (live.match(/_liveCloudGps\.Enqueue\(new Dictionary[\s\S]{0,1800}?\}\);/) || [''])[0];
t('Cockpit: canal leva gLong/gLat/zeroOk', /\["gLong"\]/.test(dic) && /\["gLat"\]/.test(dic) && /\["zeroOk"\]/.test(dic));
t('Cockpit: G do canal sai da MESMA peça do cérebro (Acel.Converter), sem aprender de novo',
  /_gpsFiltro\.Acel\.Converter\(f\.GX, f\.GY(, f\.GZ)?\)/.test(live) && !/_gpsFiltro\.Acel\.Ler\(/.test(live));
const contrato = ler('docs/CONTRATO_DADOS.md');
t('contrato: gLong/gLat/zeroOk registrados e casa do cérebro da TV listada',
  /gLong/.test(contrato) && /zeroOk/.test(contrato) && /cerebro-gps-tv\.js/.test(contrato));
const tela = ler('_design-reference/mockup-command-box-vista-piloto.html');
const camada = (tela.match(/<!-- TV-GPS item 5[\s\S]*?<\/script>/) || [''])[0];
t('TV: Vista Piloto carrega o cérebro da TV pela ponte única', /cerebro-gps-tv\.js/.test(camada) && /cloud-bridge\.js/.test(camada));
t('TV: a camada só exibe (não projeta GPS nem refaz G/volta)',
  camada.length > 0 && !/geoParaCommandBox|fracDe\(|criarDetectorChegada|Math\.hypot|createClient/.test(camada));

console.log(`\ngps-tv: ${ok} ok / ${fail} fail`);
process.exit(fail ? 1 : 0);
