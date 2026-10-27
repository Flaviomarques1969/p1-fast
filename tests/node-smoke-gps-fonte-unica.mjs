// node-smoke-gps-fonte-unica.mjs — CATRACA do item 2 do GPS (Flávio 27/10/2026, painel
// p1fast-gps-fonte-unica-0911 = C): a posição no canal vem SÓ do RaceBox; o iPhone não
// publica mais e ponto 'iphone…' que chegar é descartado. Offline, sem rede.
import { readFileSync } from 'node:fs';
import { pontoGpsAceito } from '../web/cockpit/gps-fonte-unica.js';
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

// 3) Ligações na fonte (quem mexer e desligar a regra reprova aqui)
const bridge = ler('web/cockpit/cloud-bridge.js');
const ouvinteGps = (bridge.match(/event: 'gps'[\s\S]{0,300}?\}\);/) || [''])[0];
t('cloud-bridge: ouvinte do evento gps passa por pontoGpsAceito', /pontoGpsAceito\(msg\.payload\)/.test(ouvinteGps));
t('cloud-bridge: cópia do app do iPhone é idêntica', bridge === ler('ios/p1fast-ios/Resources/Cockpit/cloud-bridge.js'));
t('gps-fonte-unica: cópia do app do iPhone é idêntica',
  ler('web/cockpit/gps-fonte-unica.js') === ler('ios/p1fast-ios/Resources/Cockpit/gps-fonte-unica.js'));
const rec = ler('ios/p1fast-ios/Sources/Telemetry/LiveTelemetryRecorder.swift');
t('iPhone: publicador GPS do canal desligado (= nil)', /private let cockpitGpsPublisher: CockpitGpsPublisher\? = nil\s*$/m.test(rec));
t('iPhone: nenhum CockpitGpsPublisher(client:) criado no gravador', !/CockpitGpsPublisher\(client:/.test(rec));
const live = ler('windows/cockpit/P1Fast.Cockpit.UI/MainWindow.Live.cs');
const dic = (live.match(/_liveCloudGps\.Enqueue\(new Dictionary[\s\S]{0,1200}?\}\);/) || [''])[0];
t('Cockpit: fix do RaceBox vai ao canal com source = "racebox"', /\["source"\]\s*=\s*"racebox"/.test(dic));

console.log(`\ngps-fonte-unica: ${ok} ok / ${fail} fail`);
process.exit(fail ? 1 : 0);
