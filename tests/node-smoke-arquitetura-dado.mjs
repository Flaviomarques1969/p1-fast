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
  'web/command-box/frenagem-real.js',
  'web/command-box/passagem-real.js',
  'web/command-box/vmin-curvas-reais.js',
];
for (const casa of CASAS) {
  const c = await ler(casa);
  t(`casa única existe — ${casa}`, () => { if (c == null) throw new Error('módulo-casa ausente'); });
}

console.log(`\n${ok} ok / ${fail} fail` + (avisos ? ` / ${avisos} aviso(s) de baseline a encolher` : ''));
process.exit(fail === 0 ? 0 : 1);
