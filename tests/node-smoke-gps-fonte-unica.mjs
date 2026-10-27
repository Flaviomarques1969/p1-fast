// node-smoke-gps-fonte-unica.mjs — CATRACA do item 2 do GPS (Flávio 27/10/2026, painel
// p1fast-gps-fonte-unica-0911 = C): a posição no canal vem SÓ do RaceBox; o iPhone não
// publica mais e ponto 'iphone…' que chegar é descartado. Offline, sem rede.
import { readFileSync } from 'node:fs';
import { pontoGpsAceito, pontosDoGps, criarFiltroRepetidos } from '../web/cockpit/gps-fonte-unica.js';
import { calcularPosicao } from '../tools/nuvem-posicao.mjs';

let ok = 0, fail = 0;
const t = (nome, cond) => { if (cond) { ok++; console.log('  ok ', nome); } else { fail++; console.log('  FAIL', nome); } };
const ler = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

// 1) A regra (peça pura)
const PISTA = { lat: -15.7735, lng: -47.9000 };
t('descarta o ponto do iPhone (source iphone-gps, formato do app)',
  pontoGpsAceito({ ...PISTA, speedKmh: 80, tWall: 1, source: 'iphone-gps' }) === false);
t('descarta variação de caixa/espaço (" iPhone-GPS")', pontoGpsAceito({ ...PISTA, source: ' iPhone-GPS' }) === false);
t('controle: RaceBox do Cockpit novo (source racebox) passa', pontoGpsAceito({ ...PISTA, kmh: 80, accM: 1.2, source: 'racebox' }) === true);
t('controle: RaceBox de Cockpit antigo (sem source) passa', pontoGpsAceito({ ...PISTA, kmh: 80, accM: 1.2 }) === true);
t('controle: simulador de bancada (sim:true) passa', pontoGpsAceito({ ...PISTA, kmh: 90, sim: true }) === true);
t('payload vazio não passa', pontoGpsAceito(null) === false);

// 2) O processador da nuvem usa a MESMA regra
t('nuvem: ponto do iPhone não vira posição', calcularPosicao({ ...PISTA, source: 'iphone-gps' }) === null);
t('nuvem (controle): ponto do RaceBox vira posição', calcularPosicao({ ...PISTA, source: 'racebox' }) !== null);

// 1b) LOTE do Cockpit (E2 da TV ao vivo, 27/10): 1 mensagem com vários fixes vira pontos soltos, em ordem
const f = (tw, extra) => ({ ...PISTA, kmh: 80, fix: 3, tWall: tw, source: 'racebox', ...(extra || {}) });
const lote = pontosDoGps({ ...f(1000), lote: [f(800), f(840), f(880), f(920), f(960)] });
t('lote: 6 pontos (5 do lote + o topo)', lote.length === 6);
t('lote: em ordem de tempo, o do topo por último', lote.map(p => p.tWall).join(',') === '800,840,880,920,960,1000');
t('lote: o ponto do topo sai SEM a chave lote (não carrega o pacote duas vezes)', !('lote' in lote[5]));
t('lote: não altera a mensagem original', Array.isArray(({ ...f(1), lote: [f(0)] }).lote));
t('lote: ponto do iPhone dentro do lote é descartado, o resto passa',
  pontosDoGps({ ...f(1000), lote: [f(900, { source: 'iphone-gps' }), f(950)] }).map(p => p.tWall).join(',') === '950,1000');
t('controle: mensagem SEM lote (Cockpit antigo) = 1 ponto, o mesmo objeto', (() => { const m = f(5); const r = pontosDoGps(m); return r.length === 1 && r[0] === m; })());
t('controle: mensagem do iPhone sem lote = nenhum ponto', pontosDoGps(f(5, { source: 'iphone-gps' })).length === 0);
t('lote vazio = só o topo', pontosDoGps({ ...f(7), lote: [] }).length === 1);
t('payload nulo = nenhum ponto', pontosDoGps(null).length === 0);
// 1c) Reenvio depois de queda: a TV descarta o que já tinha, aceita o que faltou
{
  const novo = criarFiltroRepetidos();
  const entregues = [];
  for (const tw of [1000, 1040, 1080]) if (novo(f(tw))) entregues.push(tw);            // chegaram antes da queda
  for (const tw of [960, 1000, 1040, 1080, 1120, 1160]) if (novo(f(tw))) entregues.push(tw); // reenvio na religação
  t('reenvio: repetidos descartados, os que faltavam entram, em ordem', entregues.join(',') === '1000,1040,1080,1120,1160');
  t('controle: ponto sem tWall nunca é descartado', novo({ ...PISTA }) === true && novo({ ...PISTA }) === true);
  t('relógio do notebook voltou > 15 s: o ponto passa (não trava a TV)', novo(f(1160 - 20000)) === true);
  const novo2 = criarFiltroRepetidos();
  novo2(f(5000));
  t('fontes diferentes não se atrapalham (simulador × RaceBox)', novo2({ ...PISTA, tWall: 4000, fonte: 'sim' }) === true);
}
const proc = ler('tools/nuvem-posicao.mjs');
t('nuvem-posicao: desmonta o lote e calcula só o ponto MAIS NOVO (5 Hz)', /calcularPosicao\(pts\[pts\.length - 1\]\)/.test(proc));

// 3) Ligações na fonte (quem mexer e desligar a regra reprova aqui)
const bridge = ler('web/cockpit/cloud-bridge.js');
const ouvinteGps = (bridge.match(/event: 'gps'[\s\S]{0,700}?\}\);/) || [''])[0];
t('cloud-bridge: ouvinte do evento gps desmonta o lote por pontosDoGps (que aplica a regra)', /pontosDoGps\(msg\.payload\)/.test(ouvinteGps)
  && /for \(const p of pontos\) \{ if \(_gpsNovo\(p\)\) _fan\(_onGpsPoint, p\)/.test(ouvinteGps));
t('cloud-bridge: cópia do app do iPhone é idêntica', bridge === ler('ios/p1fast-ios/Resources/Cockpit/cloud-bridge.js'));
t('gps-fonte-unica: cópia do app do iPhone é idêntica',
  ler('web/cockpit/gps-fonte-unica.js') === ler('ios/p1fast-ios/Resources/Cockpit/gps-fonte-unica.js'));
const rec = ler('ios/p1fast-ios/Sources/Telemetry/LiveTelemetryRecorder.swift');
t('iPhone: publicador GPS do canal desligado (= nil)', /private let cockpitGpsPublisher: CockpitGpsPublisher\? = nil\s*$/m.test(rec));
t('iPhone: nenhum CockpitGpsPublisher(client:) criado no gravador', !/CockpitGpsPublisher\(client:/.test(rec));
const live = ler('windows/cockpit/P1Fast.Cockpit.UI/MainWindow.Live.cs');
const dic = (live.match(/_liveCloudGps\.Enqueue\(new Dictionary[\s\S]{0,1800}?\}\);/) || [''])[0];
t('Cockpit: fix do RaceBox vai ao canal com source = "racebox"', /\["source"\]\s*=\s*"racebox"/.test(dic));

console.log(`\ngps-fonte-unica: ${ok} ok / ${fail} fail`);
process.exit(fail ? 1 : 0);
