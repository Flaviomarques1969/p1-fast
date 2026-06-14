// Smoke do perfil-trail-por-tipo — perfil-ALVO de trail-braking por tipo de curva.
// Cobre: T1=100%+gradativa; T2=parcial+residual até Vmin; T3=toque/alívio; T4=residual até a
// troca; SF=sem freio; ND=indeterminado; honestidade (medivel=false em todos); fonte única do
// rotulo/formato (classificador-trecho.js); resumoTrail; tipo desconhecido cai em ND.
import {
  PERFIL_POR_TIPO, perfilDeTrail, resumoTrail,
} from '../web/cockpit/perfil-trail-por-tipo.js';
import { TIPOS } from '../web/cockpit/classificador-trecho.js';

let ok = 0, fail = 0;
function t(nome, cond, extra) {
  if (cond) { ok++; console.log('✓ ' + nome); }
  else { fail++; console.log('✗ ' + nome + (extra ? ' — ' + extra : '')); }
}

// ── T1: 100% na pancada + soltura gradativa até o ápice ──
const t1 = perfilDeTrail('T1');
t('T1 = 100% na pancada', t1.cargaPicoPct === 100, JSON.stringify(t1.cargaPicoPct));
t('T1 solta gradativa', t1.soltura === 'gradual-profunda');
t('T1 vai até o ápice', t1.referencia === 'apice');
t('T1 sem residual numérico', t1.residualPct === null);

// ── T2: parcial (60–75%) + residual constante (35–50%) até o Vmin ──
const t2 = perfilDeTrail('T2');
t('T2 carga parcial 60–75%', t2.cargaPicoPct && t2.cargaPicoPct.min === 60 && t2.cargaPicoPct.max === 75);
t('T2 tem residual 35–50%', t2.residualPct && t2.residualPct.min === 35 && t2.residualPct.max === 50);
t('T2 residual ancora no Vmin', t2.referencia === 'vmin');
t('T2 usa a curva-exemplo residual', t2.curvaExemplo === 'residual');

// ── T3: toque curto OU só alívio do acelerador (até 40%), sem residual ──
const t3 = perfilDeTrail('T3');
t('T3 carga até 40%', t3.cargaPicoPct && t3.cargaPicoPct.min === 0 && t3.cargaPicoPct.max === 40);
t('T3 é toque', t3.soltura === 'toque' && t3.residualPct === null);

// ── T4: residual mantido até a troca de direção (prioriza a próxima) ──
const t4 = perfilDeTrail('T4');
t('T4 mantém residual até a troca', t4.referencia === 'troca' && t4.residualMantido === true);

// ── T0 / T5: formato qualitativo → carga numérica null (NÃO inventar %) ──
t('T0 não crava % (carga null + texto)', perfilDeTrail('T0').cargaPicoPct === null && !!perfilDeTrail('T0').cargaTexto);
t('T5 não crava % (trail curto)', perfilDeTrail('T5').cargaPicoPct === null && perfilDeTrail('T5').soltura === 'curta');

// ── SF: sem freada ──
const sf = perfilDeTrail('SF');
t('SF não tem freio', sf.temFreio === false && sf.cargaPicoPct === 0);
t('SF resumo = "Sem freada"', resumoTrail('SF') === 'Sem freada');

// ── ND: indeterminado ──
const nd = perfilDeTrail('ND');
t('ND é indeterminado (temFreio null)', nd.temFreio === null && nd.soltura === 'indeterminado');
t('ND resumo = "Indeterminado"', resumoTrail('ND') === 'Indeterminado');

// ── Honestidade: NADA é medível (sem sensor de pedal) ──
t('todos os perfis têm medivel=false', Object.values(PERFIL_POR_TIPO).every(p => p.medivel === false));

// ── Fonte única: rotulo/formato vêm do classificador (não duplicados aqui) ──
t('rotulo de T1 vem do classificador', t1.rotulo === TIPOS.T1.rotulo);
t('formato de T2 vem do classificador', t2.formato === TIPOS.T2.formato);

// ── Robustez: tipo desconhecido cai em ND, não estoura ──
const xx = perfilDeTrail('ZZZ');
t('tipo desconhecido cai em ND', xx.tipo === 'ND' && xx.soltura === 'indeterminado');

// ── resumoTrail compõe carga + residual + ancoragem ──
t('resumo T2 traz carga, residual e Vmin',
  /60–75%/.test(resumoTrail('T2')) && /residual 35–50%/.test(resumoTrail('T2')) && /Vmin/.test(resumoTrail('T2')),
  resumoTrail('T2'));
t('resumo T1 traz 100% e ápice', /100%/.test(resumoTrail('T1')) && /ápice/.test(resumoTrail('T1')), resumoTrail('T1'));

console.log(`\n${ok} ok / ${fail} fail`);
if (fail > 0) process.exit(1);
