// Smoke das Ondas 8 + 9 — tipos de trecho + persistência de pontos.

import { carregarTiposPorTrecho, ehReta } from '../web/cockpit/tipo-trecho-loader.js';
import { loadPontos, savePonto, savePontos } from '../web/cockpit/pontos-troca-persister.js';

const CARRO_BUBI = '641a81e7-3192-4e68-8183-b8401f105574';
const LAYOUT_BRASILIA = '0dc85cfb-6236-567e-814c-eddf610b301f';

let ok = 0, fail = 0;
function check(label, cond, extra = '') {
  if (cond) { console.log(`✓ ${label}`); ok++; }
  else { console.error(`✗ ${label} ${extra}`); fail++; }
}

// ── ONDA 8: TIPOS DE TRECHO ─────────────────────────────────────────────

// TT-01: ehReta classifica corretamente
check('TT-01 ehReta("reta_longa") = true',  ehReta('reta_longa'));
check('TT-02 ehReta("reta_curta") = true',  ehReta('reta_curta'));
check('TT-03 ehReta("curva") = false',      !ehReta('curva'));
check('TT-04 ehReta("pit_lane") = false',   !ehReta('pit_lane'));
check('TT-05 ehReta(undefined) = false',    !ehReta(undefined));

// TT-06: carregar tipos do banco — 8 trechos curva
{
  const tipos = await carregarTiposPorTrecho(LAYOUT_BRASILIA);
  const trechos = Object.values(tipos);
  check('TT-06 carrega 8 trechos de Brasília',
    trechos.length === 8,
    `total=${trechos.length}`);
  check('TT-07 todos os 8 são curvas',
    trechos.length === 8 && trechos.every(t => t === 'curva'));
}

// ── ONDA 9: PONSTOS APRENDIDOS — PERSISTÊNCIA ──────────────────────────

// Pega um trecho real pra usar como FK
const tiposMap = await carregarTiposPorTrecho(LAYOUT_BRASILIA);
const TRECHO_TESTE = Object.keys(tiposMap)[0];
const TRACK_ID = 'e8335412-3312-54fe-b634-db2d02c7fa81'; // tracks.id (não layout)

// PT-01: load com filtros inválidos → vazio
{
  const r = await loadPontos({ carroId: 'not-a-uuid', trackId: TRACK_ID, tipoPneu: 'westlake', modoStint: 'normal' });
  check('PT-01 loadPontos com chave inválida → []',
    Array.isArray(r) && r.length === 0);
}

// PT-02: salva 1 ponto
const VALOR_INICIAL = 6175;
{
  const r = await savePonto({
    carroId:        CARRO_BUBI,
    trackId:        TRACK_ID,
    tipoPneu:       'westlake-z108-185-60-r14',
    vidaPneuFaixa:  '0-30',
    configCambio:   'padrao',
    modoStint:      'normal',
    trechoId:       TRECHO_TESTE,
    marchaOrigem:   3,
    rpmAlvo:        VALOR_INICIAL,
    rpmAlvoBaixo:   6100,
    rpmAlvoAlto:    6250,
    amostrasEstaveis: 12,
    voltasObservadas: 4,
    confiancaPct:   55,
    origem:         'aprendido',
  });
  check('PT-02 savePonto retorna true', r === true);
}

// PT-03: carrega de volta e bate
{
  const pontos = await loadPontos({
    carroId:   CARRO_BUBI,
    trackId:   TRACK_ID,
    tipoPneu:  'westlake-z108-185-60-r14',
    modoStint: 'normal',
  });
  const meu = pontos.find(p => p.trecho_id === TRECHO_TESTE && p.marcha_origem === 3);
  check('PT-03 ponto salvo aparece no load com rpm_alvo certo',
    meu && meu.rpm_alvo === VALOR_INICIAL,
    `rpm=${meu ? meu.rpm_alvo : '-'}`);
}

// PT-04: update via savePonto sobre mesma chave
const VALOR_ATUALIZADO = 6225;
{
  const r = await savePonto({
    carroId:        CARRO_BUBI,
    trackId:        TRACK_ID,
    tipoPneu:       'westlake-z108-185-60-r14',
    vidaPneuFaixa:  '0-30',
    configCambio:   'padrao',
    modoStint:      'normal',
    trechoId:       TRECHO_TESTE,
    marchaOrigem:   3,
    rpmAlvo:        VALOR_ATUALIZADO,
    amostrasEstaveis: 25,
    voltasObservadas: 8,
    confiancaPct:   78,
    origem:         'aprendido',
  });
  check('PT-04 update sobre chave existente retorna true', r === true);
}

// PT-05: load mostra valor atualizado
{
  const pontos = await loadPontos({
    carroId:   CARRO_BUBI,
    trackId:   TRACK_ID,
    tipoPneu:  'westlake-z108-185-60-r14',
    modoStint: 'normal',
  });
  const meu = pontos.find(p => p.trecho_id === TRECHO_TESTE && p.marcha_origem === 3);
  check('PT-05 valor atualizado é persistido (round-trip)',
    meu && meu.rpm_alvo === VALOR_ATUALIZADO);
}

// PT-06: savePontos batch
{
  const batch = [
    { trechoId: TRECHO_TESTE, marchaOrigem: 4, rpmAlvo: 6200, amostrasEstaveis: 10, voltasObservadas: 3, confiancaPct: 45, origem: 'aprendido' },
    { trechoId: TRECHO_TESTE, marchaOrigem: 5, rpmAlvo: 6280, amostrasEstaveis: 8,  voltasObservadas: 3, confiancaPct: 35, origem: 'aprendido' },
  ];
  const r = await savePontos(batch, {
    carroId: CARRO_BUBI, trackId: TRACK_ID,
    tipoPneu: 'westlake-z108-185-60-r14',
    vidaPneuFaixa: '0-30', configCambio: 'padrao', modoStint: 'normal',
  });
  check('PT-06 savePontos batch 2/2',
    r.total === 2 && r.ok === 2, JSON.stringify(r));
}

console.log(`\nTipos + Pontos (Ondas 8+9): ${ok} ok / ${fail} fail`);
if (fail > 0) process.exit(1);
