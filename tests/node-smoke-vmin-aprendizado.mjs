// node-smoke-vmin-aprendizado.mjs — prova a função de APRENDIZADO do Vmin de
// referência por trecho (web/command-box/vmin-aprendizado.js): mantém, por
// (carro, tipo_pneu, curva), o Vmin da MELHOR passagem (menor tempo); separa por
// configuração de pneu; e só marca como CONFIÁVEL quando a mínima é um vale (abaixo
// da entrada E da saída). Roda: node tests/node-smoke-vmin-aprendizado.mjs

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { criarAprendizadoVmin, vminDaPassagem } from '../web/command-box/vmin-aprendizado.js';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dir, '..', 'web', 'command-box', 'fixtures', 'passagens-bubi-brasilia.v1.json');

let ok = 0, fail = 0;
function check(nome, cond) {
  if (cond) { ok++; console.log('  ok  ' + nome); }
  else { fail++; console.log('  XX  ' + nome); }
}

// passagem sintética: lista de kmh; vira pontos {kmh}.
const pts = (kmhs) => kmhs.map((kmh) => ({ kmh, lat: 0, lng: 0, t: 0 }));

// ── vminDaPassagem ──────────────────────────────────────────────
const vale = vminDaPassagem(pts([150, 120, 95, 92, 110, 140])); // vale no meio
check('vale: vmin é o mínimo (92)', vale.vminKmh === 92);
check('vale: confiável (abaixo de entrada E saída)', vale.confiavel === true);

const aindaFreando = vminDaPassagem(pts([150, 130, 110, 95, 90])); // cai até o fim
check('borda: mínima na saída → NÃO confiável', aindaFreando.confiavel === false);

const jaSlento = vminDaPassagem(pts([90, 95, 110, 130])); // mínima na entrada
check('borda: mínima na entrada → NÃO confiável', jaSlento.confiavel === false);

check('pontos insuficientes → null', vminDaPassagem(pts([100])) === null);

// ── aprendizado: melhor por (carro, pneu, curva) ────────────────
const ap = criarAprendizadoVmin();
ap.observar({ carro: 'Bolinha', tipo_pneu: 'radial-185-14', curva: 'C1', tempo_trecho_s: 10.0, pontos: pts([150, 100, 96, 120]) });
ap.observar({ carro: 'Bolinha', tipo_pneu: 'radial-185-14', curva: 'C1', tempo_trecho_s: 9.2,  pontos: pts([150, 98, 94, 122]) }); // mais rápida → vira referência
ap.observar({ carro: 'Bolinha', tipo_pneu: 'radial-185-14', curva: 'C1', tempo_trecho_s: 11.0, pontos: pts([150, 90, 88, 118]) }); // mais lenta → NÃO troca

const refC1 = ap.referencia('Bolinha', 'radial-185-14', 'C1');
check('referência = Vmin da melhor passagem (menor tempo)', refC1 && refC1.vminKmh === 94);
check('passagem mais lenta NÃO sobrescreve a referência', refC1 && refC1.tempoS === 9.2);

// ── separação por configuração de pneu ──────────────────────────
ap.observar({ carro: 'Bolinha', tipo_pneu: 'semi slick', curva: 'C1', tempo_trecho_s: 8.5, pontos: pts([150, 92, 88, 124]) });
const refSemi = ap.referencia('Bolinha', 'semi-slick', 'C1'); // sinônimo normalizado
check('semi-slick é base SEPARADA do radial', refSemi && refSemi.vminKmh === 88 && refC1.vminKmh === 94);
check('config sem dado → referência null', ap.referencia('Bolinha', 'slick', 'C1') === null);
check('configuracoes() lista as duas aprendidas', ap.configuracoes().sort().join(',') === 'radial-185-14,semi-slick');

// ── massa real do Bubi ──────────────────────────────────────────
const fix = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
const apReal = criarAprendizadoVmin().aprenderDeMassa(fix.passagens, 'Bolinha');
check('massa real: só radial-185-14 aprendido', apReal.configuracoes().join(',') === 'radial-185-14');
check('massa real: semi-slick ainda SEM dado (null)', apReal.referencia('Bolinha', 'semi-slick', 'CURVA 01') === null);
const curva01 = apReal.referencia('Bolinha', 'radial-185-14', 'CURVA 01');
check('massa real: Curva 01 tem referência de Vmin', !!curva01 && typeof curva01.vminKmh === 'number');

console.log('\n' + (fail === 0 ? 'OK' : 'FALHOU') + ' — ' + ok + ' passaram, ' + fail + ' falharam');
process.exit(fail === 0 ? 0 : 1);
