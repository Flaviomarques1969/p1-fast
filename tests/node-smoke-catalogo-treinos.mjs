// Smoke do catálogo de treinos (Stint Revestido — decisão Flávio 11/06).
// Garante: chips do Planejamento, motor e mensagens bebem de uma fonte só,
// e o catálogo nunca vende treino que o sistema não mede.
import { TREINOS, MENSAGENS_SEMPRE, listarTreinos, treinoPorFoco } from '../web/cockpit/catalogo-treinos.js';
import { PEDAGOGICA } from '../web/cockpit/mensagens-pedagogicas.js';
import { SUB_TRECHOS } from '../web/cockpit/delta-calculator.js';

let ok = 0, fail = 0;
function t(nome, cond, extra) {
  if (cond) { ok++; console.log('✓ ' + nome); }
  else { fail++; console.log('✗ ' + nome + (extra ? ' — ' + extra : '')); }
}

// CT-01: os 7 focos selecionáveis batem com os chips fechados pelo Flávio (10/06)
const ESPERADOS = ['trail-braking', 'entrada', 'frenagem', 'vmin', 'apice', 'pace', 'saida'];
t('CT-01 7 treinos no catálogo', TREINOS.length === 7, String(TREINOS.length));
t('CT-02 ids batem com os focos do Planejamento',
  ESPERADOS.every(id => treinoPorFoco(id)),
  ESPERADOS.filter(id => !treinoPorFoco(id)).join(','));

// CT-03: todo treino declara componentes medíveis VÁLIDOS do delta
for (const tr of TREINOS) {
  t(`CT-03 ${tr.id}: subsFoco válidos`,
    Array.isArray(tr.subsFoco) && tr.subsFoco.length > 0 && tr.subsFoco.every(s => SUB_TRECHOS.includes(s)),
    JSON.stringify(tr.subsFoco));
}

// CT-04: mensagens permitidas existem no catálogo APROVADO (nada inventado)
for (const tr of TREINOS) {
  t(`CT-04 ${tr.id}: mensagens do catálogo aprovado`,
    tr.mensagens.every(k => PEDAGOGICA[k]),
    tr.mensagens.filter(k => !PEDAGOGICA[k]).join(','));
}
t('CT-05 mensagens-sempre existem no catálogo aprovado',
  MENSAGENS_SEMPRE.every(k => PEDAGOGICA[k]));

// CT-06: etiqueta de honestidade declarada (pleno|proxy); trail é PROXY até
// o sensor de pedal existir — com ressalva escrita no brief
for (const tr of TREINOS) {
  t(`CT-06 ${tr.id}: etiqueta declarada`, tr.etiqueta === 'pleno' || tr.etiqueta === 'proxy', tr.etiqueta);
}
const trail = treinoPorFoco('trail-braking');
t('CT-07 trail braking = proxy com ressalva no brief',
  trail.etiqueta === 'proxy' && typeof trail.brief.ressalva === 'string' && trail.brief.ressalva.length > 20);

// CT-08: brief completo pra TODO treino (o "como fazer" se ensina parado)
for (const tr of TREINOS) {
  const b = tr.brief;
  t(`CT-08 ${tr.id}: brief completo`,
    b && typeof b.oQueE === 'string' && b.oQueE.length > 40
      && Array.isArray(b.oQueMede) && b.oQueMede.length >= 1
      && typeof b.comoAparece === 'string' && b.comoAparece.length > 20);
}

// CT-09: selo curto (cabe na barra) e com o prefixo TREINO
for (const tr of TREINOS) {
  t(`CT-09 ${tr.id}: selo curto com prefixo`,
    tr.selo.startsWith('TREINO · ') && tr.selo.length <= 26, tr.selo);
}

// CT-10: sem emojis em nenhum texto (regra permanente do Flávio)
const tudo = JSON.stringify(TREINOS);
t('CT-10 zero emojis no catálogo', !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(tudo));

// CT-11: helpers
t('CT-11 listarTreinos devolve cópia', listarTreinos() !== TREINOS && listarTreinos().length === 7);
t('CT-12 foco desconhecido → null', treinoPorFoco('drift') === null);

console.log(`\ncatalogo-treinos: ${ok} ok / ${fail} fail`);
process.exit(fail ? 1 : 0);
