// ═══════════════════════════════════════════════════════════
// Trava de arquitetura do DADO — UMA entrada, UM cérebro, todos consomem
// ═══════════════════════════════════════════════════════════
// Por que existe (cobrança Flávio 2026-06-23, "já te pedi várias vezes"):
// garantir, de forma MECÂNICA (não promessa), que nenhuma TELA DE EXIBIÇÃO
// volte a:
//   1. abrir conexão própria com a nuvem  (deve usar a ponte única cloud-bridge.js)
//   2. usar dado inventado / de demonstração  (preview-local, FAKE_LAPS)
//
// Regra canônica: a NUVEM processa, a tela só EXIBE o pacote pronto.
// Ver docs/CONTRATO_DADOS.md (o registro) e docs/ARQUITETURA_DEFINITIVA.md.
//
// COMO FUNCIONA (catraca que só aperta):
//   - BASELINE = a dívida legada CONHECIDA hoje. SÓ PODE ENCOLHER.
//   - Qualquer violação NOVA (fora do baseline) REPROVA o teste.
//   - Telas novas com conexão/feed falso que não estejam registradas REPROVAM.
//   - Quando uma tela legada é limpa, o teste avisa pra encolher o baseline.
//
// Roda com: npm run smoke:arquitetura   (e dentro de npm run smoke)

import { readFile, readdir } from 'node:fs/promises';

// ── Telas de EXIBIÇÃO que devem obedecer (só exibem; não conectam, não calculam) ──
const TELAS = [
  '_design-reference/mockup-command-box-vista-piloto.html',
  '_design-reference/mockup-command-box-vista-engenheiro.html',
  '_design-reference/mockup-command-box-engenharia-lambda.html',
  '_design-reference/mockup-command-box-engenharia-pace.html',
  '_design-reference/mockup-command-box-engenharia-motor-saude.html',
  '_design-reference/mockup-command-box-engenharia-saude-carro.html',
  'ios/p1fast-ios/Resources/Cockpit/cockpit-app.html',
  'web/cockpit/checar-antes-de-rodar.html',
];

// ── As regras (cada uma = um jeito de "espalhar" que a arquitetura proíbe) ──
const REGRAS = {
  'conexao-propria': {
    descricao: 'abre conexão própria com a nuvem (deve usar a ponte única cloud-bridge.js)',
    contar: (txt) => (txt.match(/createClient\s*\(/g) || []).length,
  },
  'feed-falso': {
    descricao: 'usa dado inventado / de demonstração (preview-local, FAKE_LAPS)',
    contar: (txt) => (txt.match(/preview-local/g) || []).length + (txt.match(/FAKE_LAPS/g) || []).length,
  },
};

// ── BASELINE: dívida legada conhecida em 2026-06-23. SÓ PODE ENCOLHER. ──
// Cada item é uma tela a migrar pra arquitetura única. Limpou a tela? REMOVER daqui.
const BASELINE = {
  // Vista Piloto: conexão própria QUITADA em 23/06 (agora usa a ponte única cloud-bridge.js).
  // Resta a dívida do feed de demonstração (preview-local/FAKE_LAPS), a migrar.
  '_design-reference/mockup-command-box-vista-piloto.html': ['feed-falso'],
  '_design-reference/mockup-command-box-vista-engenheiro.html': ['feed-falso'],
};

let ok = 0, fail = 0, avisos = 0;
function t(name, fn) {
  try { fn(); console.log('✓', name); ok++; }
  catch (e) { console.log('✗', name, '—', e.message); fail++; }
}

async function ler(f) {
  try { return await readFile(f, 'utf8'); }
  catch { return null; }
}

// ── 1) Sanidade do baseline: não pode referenciar tela/regra inexistente ──
for (const tela of Object.keys(BASELINE)) {
  t(`baseline: tela conhecida — ${tela}`, () => {
    if (!TELAS.includes(tela)) throw new Error('tela do baseline não está na lista TELAS');
  });
  for (const regra of BASELINE[tela]) {
    t(`baseline: regra conhecida — ${tela} :: ${regra}`, () => {
      if (!REGRAS[regra]) throw new Error(`regra "${regra}" não existe`);
    });
  }
}

// ── 2) Cada tela de exibição: só pode violar o que está no baseline ──
for (const tela of TELAS) {
  const txt = await ler(tela);
  if (txt == null) { t(`tela existe — ${tela}`, () => { throw new Error('arquivo não encontrado'); }); continue; }
  const permitido = BASELINE[tela] || [];
  for (const [regra, def] of Object.entries(REGRAS)) {
    const n = def.contar(txt);
    const isLegado = permitido.includes(regra);
    t(`${tela} :: ${regra}`, () => {
      if (n > 0 && !isLegado) {
        throw new Error(`VIOLAÇÃO NOVA (${n}x): ${def.descricao}. Use a ponte/cérebro únicos — ver docs/CONTRATO_DADOS.md`);
      }
    });
    if (n === 0 && isLegado) {
      console.log('  ↳ aviso: baseline pode ENCOLHER — ' + tela + ' :: ' + regra + ' já está limpa. Remova do BASELINE.');
      avisos++;
    }
  }
}

// ── 3) Sem porta dos fundos: tela nova do Command Box com conexão/feed falso
//        que não esteja na lista TELAS também reprova ──
const dirDesign = '_design-reference';
let arquivosDesign = [];
try { arquivosDesign = await readdir(dirDesign); } catch {}
// Ignora cópias congeladas / arquivos / versões antigas (não são telas vivas):
const EH_ARQUIVO = /APROVADO|BACKUP|\.ORIG|-PRE-|-ANTES|versao|versoes|\d{4}-\d{2}-\d{2}/i;
const novasTelas = arquivosDesign
  .filter(f => /^mockup-command-box-.*\.html$/.test(f))
  .filter(f => !EH_ARQUIVO.test(f))
  .map(f => `${dirDesign}/${f}`)
  .filter(f => !TELAS.includes(f));
for (const tela of novasTelas) {
  const txt = await ler(tela);
  if (txt == null) continue;
  let total = 0;
  for (const def of Object.values(REGRAS)) total += def.contar(txt);
  t(`tela não-registrada sem conexão/feed falso — ${tela}`, () => {
    if (total > 0) throw new Error('tela do Command Box fora da lista TELAS com conexão própria ou dado falso — registre na trava e na arquitetura única');
  });
}

// ── 4) O registro (contrato) e o doc de arquitetura precisam existir ──
const contrato = await ler('docs/CONTRATO_DADOS.md');
t('docs/CONTRATO_DADOS.md existe e cita a fonte única', () => {
  if (contrato == null) throw new Error('registro ausente — crie docs/CONTRATO_DADOS.md');
  if (!/cockpit-bubi-live/.test(contrato)) throw new Error('registro não cita o canal único cockpit-bubi-live');
  if (!/cloud-bridge\.js/.test(contrato)) throw new Error('registro não cita a ponte única cloud-bridge.js');
});

// ── 5) As "casas únicas" das contas (cérebro) precisam existir de verdade ──
const CASAS = [
  'web/cockpit/cloud-bridge.js',
  'web/command-box/cerebro/cerebro-painel.js',
  'web/command-box/cerebro/cerebro-vivo.js',
  'web/command-box/cerebro/cerebro-coach-stint.js', // Coach de IA de stint (segundos) — casa própria, conta nova
  'web/command-box/frenagem-real.js',
  'web/command-box/passagem-real.js',
  'web/command-box/vmin-curvas-reais.js',
];
for (const casa of CASAS) {
  const c = await ler(casa);
  t(`casa única existe — ${casa}`, () => { if (c == null) throw new Error('módulo-casa ausente'); });
}

// ── 6) Conta de DISTÂNCIA/PROJEÇÃO de GPS só pode morar em geo.js ──
//      Cobrança Flávio 2026-06-23 ("uma conta, uma casa"). A fórmula da distância
//      entre pontos / projeção lat-lng→metros estava copiada em ~16 arquivos.
//      Agora a casa é src/domain/geo.js (web/cockpit/geo.js reexporta dela). Esta regra REPROVA qualquer arquivo NOVO
//      que volte a escrever a fórmula (raio da Terra ou metro-por-grau). O
//      GEO_BASELINE é a dívida legada conhecida hoje — SÓ PODE ENCOLHER.
const GEO_HOME = 'src/domain/geo.js';
const GEO_RE = /\b(6_?378_?137|6_?371_?000|6371e3|110_?540|111_?320|111_?000)\b/;
const GEO_EXCLUI = new Set([
  // constante de calibração do DESENHO (K_LNG é valor fixo ajustado), não é a fórmula de distância:
  'web/cockpit/pista-oficial-brasilia.js',
  // gêmeo do iPhone do arquivo acima — MESMA calibração do DESENHO (K_LAT=110540), não é a conta de distância:
  'ios/p1fast-ios/Resources/Cockpit/pista-oficial-brasilia.js',
  // gerador de dado de teste (graus a partir de metros, o INVERSO da distância) — não é a conta:
  'src/telemetry/mock-provider.js',
]);
const GEO_BASELINE = new Set([
  // iPhone = cópias do bundle (espelho mecânico do web/cockpit) — migrar na sincronia do app:
  'ios/p1fast-ios/Resources/Cockpit/apice-calculator.js',
  'ios/p1fast-ios/Resources/Cockpit/live-data-bridge.js',
  'ios/p1fast-ios/Resources/Cockpit/trecho-detector.js',
  // ferramenta de conferência (usa campo {lon}, não {lng}) — migrar com adaptação depois:
  'src/telemetry/cross-validation.js',
  // curvatura do ápice — projeção APROVADA e sensível (constante própria calibrada); não mexer sem necessidade:
  'web/cockpit/apice-calculator.js',
  // (QUITADOS 23/06, usam src/domain/geo.js: cerebro-velocidade, chegada-gps, trajectory-monitor, projector)
]);

async function listarJs(dir) {
  const out = [];
  let ents = [];
  try { ents = await readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of ents) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) {
      if (/node_modules|\.git|_design-reference|\.claude/.test(p)) continue;
      out.push(...await listarJs(p));
    } else if (e.name.endsWith('.js') && !/\.smoke\.|\.test\./.test(e.name) && !p.includes('/tests/')) {
      out.push(p);
    }
  }
  return out;
}

const jsTodos = [...await listarJs('web'), ...await listarJs('src'), ...await listarJs('ios')];
for (const f of jsTodos) {
  if (f === GEO_HOME || GEO_EXCLUI.has(f)) continue;
  const txt = await ler(f);
  if (txt == null) continue;
  if (GEO_RE.test(txt) && !GEO_BASELINE.has(f)) {
    t(`distância/projeção GPS só em geo.js — ${f}`, () => {
      throw new Error('fórmula de distância/projeção GPS fora de geo.js — importe de web/cockpit/geo.js (distanciaPontos / M_POR_GRAU_LAT / mPorGrauLng). Ver docs/CONTRATO_DADOS.md');
    });
  }
}
// baseline-geo pode ENCOLHER: avisa se um legado já não tem mais a fórmula
for (const f of GEO_BASELINE) {
  const txt = await ler(f);
  if (txt != null && !GEO_RE.test(txt)) {
    console.log('  ↳ aviso: baseline-geo pode ENCOLHER — ' + f + ' já está limpo. Remova de GEO_BASELINE.');
    avisos++;
  }
}
// a casa única existe e exporta a conta
const geoTxt = await ler(GEO_HOME);
t('casa única da distância existe e exporta a conta — src/domain/geo.js', () => {
  if (geoTxt == null) throw new Error('geo.js ausente');
  if (!/export function distanciaPontos/.test(geoTxt)) throw new Error('geo.js não exporta distanciaPontos');
  if (!/export const M_POR_GRAU_LAT/.test(geoTxt)) throw new Error('geo.js não exporta M_POR_GRAU_LAT');
});

// ── 7) Conversão de VELOCIDADE (m/s ↔ km/h, fator 3,6) só pode morar em velocidade.js ──
//      "Velocidade numa casa só" (Flávio 24/06). O fator 3,6 estava solto em ~15 arquivos.
//      Agora a casa é src/domain/velocidade.js (web/cockpit/velocidade.js e o cérebro reexportam).
//      Esta regra REPROVA qualquer arquivo que multiplique/divida por 3.6 fora da casa.
//      VEL_BASELINE = dívida do iPhone (espelhos do bundle em JS) — migra na sincronia do app, SÓ ENCOLHE.
const VEL_HOME = 'src/domain/velocidade.js';
const VEL_RE = /(\*|\/)\s*3\.6\b/;   // multiplicar/dividir por 3.6 = a conversão de velocidade
const VEL_BASELINE = new Set([
  'ios/p1fast-ios/Resources/Cockpit/live-data-bridge.js',
  'ios/p1fast-ios/Resources/Cockpit/trecho-detector.js',
]);
for (const f of jsTodos) {
  if (f === VEL_HOME) continue;
  const txt = await ler(f);
  if (txt == null) continue;
  if (VEL_RE.test(txt) && !VEL_BASELINE.has(f)) {
    t(`conversão de velocidade (3.6) só em velocidade.js — ${f}`, () => {
      throw new Error('multiplicação/divisão por 3.6 (m/s↔km/h) fora de velocidade.js — importe msParaKmh / kmhParaMs de web/cockpit/velocidade.js (ou src/domain/velocidade.js). Ver docs/CONTRATO_DADOS.md');
    });
  }
}
// baseline-velocidade pode ENCOLHER: avisa se um espelho do iPhone já não tem mais o fator
for (const f of VEL_BASELINE) {
  const txt = await ler(f);
  if (txt != null && !VEL_RE.test(txt)) {
    console.log('  ↳ aviso: baseline-velocidade pode ENCOLHER — ' + f + ' já está limpo. Remova de VEL_BASELINE.');
    avisos++;
  }
}
const velTxt = await ler(VEL_HOME);
t('casa única da velocidade existe e exporta a conta — src/domain/velocidade.js', () => {
  if (velTxt == null) throw new Error('velocidade.js ausente');
  if (!/export function msParaKmh/.test(velTxt)) throw new Error('velocidade.js não exporta msParaKmh');
  if (!/export function kmhParaMs/.test(velTxt)) throw new Error('velocidade.js não exporta kmhParaMs');
});

// ── 8) Conta de DELTA por trecho (tempo perdido) só pode morar em delta-calculator.js neutro ──
//      Condição da junta (24/06) + ADR-023 amendment 6: a conta do delta tem de morar na casa
//      NEUTRA (src/domain) pra o cockpit do piloto (notebook) E o cérebro da nuvem (Command Box)
//      consumirem a MESMA — sem o cérebro depender da pasta da tela. web/cockpit/delta-calculator.js
//      reexporta daqui. Esta regra garante que a casa neutra existe e exporta a conta.
const DELTA_HOME = 'src/domain/delta-calculator.js';
const deltaTxt = await ler(DELTA_HOME);
t('casa única do delta por trecho existe e exporta a conta — src/domain/delta-calculator.js', () => {
  if (deltaTxt == null) throw new Error('delta-calculator.js ausente');
  if (!/export function calcularDelta/.test(deltaTxt)) throw new Error('delta-calculator.js não exporta calcularDelta');
});
// a tela só reexporta (não recria a conta)
const deltaCockpitTxt = await ler('web/cockpit/delta-calculator.js');
t('cockpit só reexporta o delta da casa neutra — web/cockpit/delta-calculator.js', () => {
  if (deltaCockpitTxt == null) throw new Error('web/cockpit/delta-calculator.js ausente');
  if (!/export \* from '\.\.\/\.\.\/src\/domain\/delta-calculator\.js'/.test(deltaCockpitTxt)) {
    throw new Error('web/cockpit/delta-calculator.js deve reexportar de src/domain/delta-calculator.js (não recriar a conta)');
  }
});

console.log(`\n${ok} ok / ${fail} fail` + (avisos ? ` / ${avisos} aviso(s) de baseline a encolher` : ''));
process.exit(fail === 0 ? 0 : 1);
