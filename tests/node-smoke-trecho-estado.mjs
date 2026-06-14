// Smoke do trecho-estado — estado VIVO de classificação por trecho.
// Cobre: empilhar na janela rolante; propor só com consistência; ignorar ruído (isolado,
// baixa confiança, ND); aplicar decisão (aprovar/ajustar/recusar) + carência de recusa;
// imutabilidade (não muta o estado de entrada).
import {
  criarEstado, observar, avaliarProposta, aplicarDecisao, tendencia, PARAMS,
} from '../web/cockpit/trecho-estado.js';

let ok = 0, fail = 0;
function t(nome, cond, extra) {
  if (cond) { ok++; console.log('✓ ' + nome); }
  else { fail++; console.log('✗ ' + nome + (extra ? ' — ' + extra : '')); }
}

const obs = (tipo, confianca = 'media', contexto = {}) => ({ tipo, confianca, motivo: `motivo ${tipo}`, contexto });
// empilha uma lista de observações e reavalia a cada passo (como o ciclo real faz).
function rodar(estado, lista) {
  let e = estado;
  for (const o of lista) e = avaliarProposta(observar(e, o));
  return e;
}

// ── criação ──
t('criarEstado rejeita tipo inválido', (() => { try { criarEstado({ trecho: 'x', tipoAprovado: 'ZZ' }); return false; } catch { return true; } })());
const base = criarEstado({ trecho: 'CURVA TESTE', ordem: 1, tipoAprovado: 'T0' });
t('estado inicial: aprovado T0, sem proposta, histórico vazio', base.tipoAprovado === 'T0' && base.propostaPendente === null && base.historico.length === 0);

// ── empilhar + janela rolante ──
const e1 = observar(base, obs('T0'));
t('observar empilha 1 e não muta o original', e1.historico.length === 1 && base.historico.length === 0);
t('observar conta totalObservadas', e1.totalObservadas === 1 && base.totalObservadas === 0);
let eRol = base;
for (let i = 0; i < PARAMS.janela + 3; i++) eRol = observar(eRol, obs('T0'));
t('janela rolante limita o histórico a PARAMS.janela', eRol.historico.length === PARAMS.janela);
t('totalObservadas não é rolante (conta tudo)', eRol.totalObservadas === PARAMS.janela + 3);

// ── proposta só com consistência ──
const prop = rodar(base, [obs('T1'), obs('T1'), obs('T1')]);
t('propõe com 3 passagens iguais divergentes conf. média+', prop.propostaPendente && prop.propostaPendente.para === 'T1' && prop.propostaPendente.de === 'T0');
t('proposta nunca é para ND', prop.propostaPendente && prop.propostaPendente.para !== 'ND');

const dois = rodar(base, [obs('T1'), obs('T1')]);
t('2 iguais ainda NÃO propõe (precisa de 3)', dois.propostaPendente === null);

const isolada = rodar(base, [obs('T0'), obs('T1'), obs('T0'), obs('T0')]);
t('1 divergência isolada no meio = ruído, não propõe', isolada.propostaPendente === null);

const mistura = rodar(base, [obs('T1'), obs('T2'), obs('T1')]);
t('mistura de tipos divergentes (T1/T2/T1) não propõe', mistura.propostaPendente === null);

// ── confiança baixa e ND não contam ──
const baixa = rodar(base, [obs('T1', 'baixa'), obs('T1', 'baixa'), obs('T1', 'baixa')]);
t('3 divergentes de confiança BAIXA não propõem', baixa.propostaPendente === null);

const nds = rodar(base, [obs('ND', 'baixa'), obs('ND', 'baixa'), obs('ND', 'baixa')]);
t('3 ND não propõem (ND não conta e não vira alvo)', nds.propostaPendente === null);

// ND entre as confiáveis não atrapalha: as 3 últimas confiáveis ainda são T1
const ndNoMeio = rodar(base, [obs('T1'), obs('ND', 'baixa'), obs('T1'), obs('T1')]);
t('ND/baixa entre confiáveis não bloqueia (3 confiáveis T1 -> propõe)', ndNoMeio.propostaPendente && ndNoMeio.propostaPendente.para === 'T1');

// reversão: voltou pro aprovado nas últimas -> proposta some
const reverteu = rodar(base, [obs('T1'), obs('T1'), obs('T1'), obs('T0'), obs('T0'), obs('T0')]);
t('reversão pro tipo aprovado limpa a proposta (idempotente/honesto)', reverteu.propostaPendente === null);

// ── tendência ──
const td = tendencia(prop);
t('tendência reporta dominante T1', td.dominante === 'T1' && td.dominanteN >= PARAMS.minParaPropor);

// ── aplicar decisão ──
const aprovado = aplicarDecisao(prop, 'aprovar');
t('aprovar muda o tipoAprovado para a proposta', aprovado.tipoAprovado === 'T1' && aprovado.origem === 'proposta-aprovada');
t('aprovar limpa a proposta e registra no log', aprovado.propostaPendente === null && aprovado.log.some(l => l.acao === 'aprovar' && l.para === 'T1'));
t('aprovar não muta o estado de entrada', prop.tipoAprovado === 'T0' && prop.propostaPendente !== null);
t("aprovar sem proposta é no-op", aplicarDecisao(base, 'aprovar').tipoAprovado === 'T0');

const ajustado = aplicarDecisao(prop, 'ajustar', { tipoNovo: 'T2' });
t('ajustar usa o tipo escolhido pelo Flávio (T2), não o proposto (T1)', ajustado.tipoAprovado === 'T2' && ajustado.origem === 'ajuste-flavio');
t('ajustar exige tipoNovo válido', (() => { try { aplicarDecisao(prop, 'ajustar', { tipoNovo: 'ZZ' }); return false; } catch { return true; } })());

// ── recusar + carência ──
const recusado = aplicarDecisao(prop, 'recusar');
t('recusar mantém o aprovado e limpa a proposta', recusado.tipoAprovado === 'T0' && recusado.propostaPendente === null);
t('recusar registra a recusa (carência)', recusado.recusas.length === 1 && recusado.recusas[0].para === 'T1');
// logo após recusar, mais 1 passagem T1 NÃO deve re-propor de imediato (carência)
const logoApos = avaliarProposta(observar(recusado, obs('T1')));
t('após recusar, não re-propõe o mesmo alvo de imediato (carência)', logoApos.propostaPendente === null);
// com evidência NOVA suficiente (minParaPropor passagens novas), volta a propor
let depois = recusado;
for (let i = 0; i < PARAMS.minParaPropor; i++) depois = avaliarProposta(observar(depois, obs('T1')));
t('com evidência nova suficiente, re-propõe o alvo recusado', depois.propostaPendente && depois.propostaPendente.para === 'T1');

t('decisão inválida lança erro', (() => { try { aplicarDecisao(prop, 'foo'); return false; } catch { return true; } })());

// ── caso ND inicial pode evoluir para tipo real com dado bom ──
const ndBase = criarEstado({ trecho: 'CURVA ND', tipoAprovado: 'ND' });
const ndEvolui = rodar(ndBase, [obs('T1'), obs('T1'), obs('T1')]);
t('curva ND com 3 leituras confiáveis T1 propõe ND -> T1', ndEvolui.propostaPendente && ndEvolui.propostaPendente.de === 'ND' && ndEvolui.propostaPendente.para === 'T1');

// ── carência por EVIDÊNCIA CONFIÁVEL nova (não por passagens brutas) ──
// após recusar T1, chegando 1 confiável T1 + ND/baixa, NÃO pode re-propor (só 1 confiável nova).
let recBruto = recusado; // recusou T1 com 3 T1 confiáveis na janela
recBruto = avaliarProposta(observar(recBruto, obs('T1')));        // 1 confiável nova
recBruto = avaliarProposta(observar(recBruto, obs('ND', 'baixa'))); // não-confiável
recBruto = avaliarProposta(observar(recBruto, obs('T1', 'baixa'))); // não-confiável
t('carência conta evidência CONFIÁVEL, não passagens brutas (1 confiável nova -> sem re-proposta)', recBruto.propostaPendente === null);

// ── tendência: ND não conta duas vezes (baixaN exclui ND) ──
const mix = rodar(base, [obs('ND', 'baixa'), obs('T1', 'baixa'), obs('T0', 'media')]);
const tdMix = tendencia(mix);
t('tendência: ndN + baixaN + confiáveis somam a janela (sem dupla contagem)', tdMix.ndN === 1 && tdMix.baixaN === 1 && tdMix.totalQualif === 1 && (tdMix.ndN + tdMix.baixaN + tdMix.totalQualif) === mix.historico.length);

// ── tendência: empate no topo => sem dominante claro ──
const tdEmpate = tendencia(rodar(base, [obs('T1'), obs('T2'), obs('T1'), obs('T2')]));
t('tendência: empate no topo marca empate e zera dominante', tdEmpate.empate === true && tdEmpate.dominante === null && tdEmpate.topoEmpatados.length === 2);

console.log(`\n${ok} ok / ${fail} fail`);
process.exit(fail ? 1 : 0);
