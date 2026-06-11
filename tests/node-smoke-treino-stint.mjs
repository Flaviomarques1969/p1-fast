// Smoke do motor pedagógico do treino (Stint Revestido — decisões Flávio 11/06:
// válvula LIGADA + degrau ~30% teto 4 m) e do leitor do plano do stint.
import {
  TreinoStint, resolvePlanoStint, buscarPlanoStintDaNuvem, validarPlanoStint,
  VALVULA_FORA_FOCO_S, CALIBRACAO_PASSAGENS,
} from '../web/cockpit/treino-stint.js';
import { PEDAGOGICA } from '../web/cockpit/mensagens-pedagogicas.js';
import { OportunidadeTrecho } from '../web/cockpit/oportunidade-trecho.js';

let ok = 0, fail = 0;
function t(nome, cond, extra) {
  if (cond) { ok++; console.log('✓ ' + nome); }
  else { fail++; console.log('✗ ' + nome + (extra ? ' — ' + extra : '')); }
}

const msg = (chave) => ({ ...PEDAGOGICA[chave], tipo: 'comunicacao' });
function delta(seg, por, totalS = null) {
  const porSub = { entrada: { deltaS: 0 }, freio: { deltaS: 0 }, apice: { deltaS: 0 }, saida: { deltaS: 0 } };
  for (const k of Object.keys(por)) porSub[k] = { deltaS: por[k] };
  let pior = 'entrada', piorV = -Infinity;
  for (const k of Object.keys(porSub)) if (porSub[k].deltaS > piorV) { piorV = porSub[k].deltaS; pior = k; }
  const total = totalS ?? Object.values(porSub).reduce((s, v) => s + v.deltaS, 0);
  return { segmentId: seg, deltaTotalS: total, porSubTrecho: porSub, piorSubTrecho: pior, piorDeltaS: piorV };
}

// ── resolvePlanoStint ─────────────────────────────────────────
{
  const ls = (obj) => ({ getItem: (k) => k === 'p1fast-plano-stint-v1' && obj ? JSON.stringify(obj) : null });
  t('RP-01 sem plano → null', resolvePlanoStint({ storage: ls(null), search: '' }) === null);
  const p = resolvePlanoStint({ storage: ls({ proposito: 'treinar', foco: 'frenagem', voltas: 12, paradas: [] }), search: '' });
  t('RP-02 plano de treino válido', p && p.proposito === 'treinar' && p.foco === 'frenagem' && p.origem === 'planejamento');
  t('RP-03 treino com foco inválido → null',
    resolvePlanoStint({ storage: ls({ proposito: 'treinar', foco: 'drift' }), search: '' }) === null);
  const livre = resolvePlanoStint({ storage: ls({ proposito: 'livre', foco: null }), search: '' });
  t('RP-04 plano livre passa (painel decide não armar)', livre && livre.proposito === 'livre');
  const q = resolvePlanoStint({ storage: ls(null), search: '?treino=apice' });
  t('RP-05 atalho ?treino= arma sem Planejamento', q && q.proposito === 'treinar' && q.foco === 'apice' && q.origem === 'query');
  t('RP-06 ?treino= inválido não arma', resolvePlanoStint({ storage: ls(null), search: '?treino=drift' }) === null);
}

// ── Filtro de mensagens + válvula (decisão 1: LIGADA) ─────────
{
  const tr = new TreinoStint({ foco: 'frenagem' });
  t('FM-01 mensagem do foco passa', tr.filtroMensagem(msg('FREOU_TARDE')) !== null);
  t('FM-02 mensagem de outro grupo é segurada',
    tr.filtroMensagem(msg('VIROU_POUCO'), delta('s1', { apice: 0.2 })) === null);
  t('FM-03 Resultado passa sempre', tr.filtroMensagem(msg('RECORDE')) !== null);
  t('FM-04 Sistema passa sempre', tr.filtroMensagem(msg('REGISTRANDO')) !== null);
  // válvula: erro GRAVE fora do foco fura 1 vez
  const grave = delta('s1', { apice: VALVULA_FORA_FOCO_S + 0.1 });
  t('FM-05 válvula fura com erro grave fora do foco', tr.filtroMensagem(msg('VIROU_POUCO'), grave) !== null);
  t('FM-06 válvula NÃO fura duas vezes', tr.filtroMensagem(msg('VIROU_POUCO'), grave) === null);
  // re-arma quando o componente fora do foco melhora
  tr.registrarDelta(delta('s1', { apice: 0.1 }));
  t('FM-07 válvula re-arma após melhora', tr.filtroMensagem(msg('VIROU_POUCO'), grave) !== null);
}

// ── Calibração + consistência 3-de-4 + silêncio ───────────────
{
  const tr = new TreinoStint({ foco: 'frenagem' });
  t('CA-01 sem passagem → não orienta (calibrando)', tr.deveOrientar('s1') === false);
  tr.registrarDelta(delta('s1', { freio: 0.4 }));
  t('CA-02 1 passagem → ainda calibrando', tr.deveOrientar('s1') === false, String(CALIBRACAO_PASSAGENS));
  tr.registrarDelta(delta('s1', { freio: 0.35 }));
  t('CA-03 2 passagens → orienta', tr.deveOrientar('s1') === true);
  // 3 de 4 na banda → consolidado → cala
  tr.registrarDelta(delta('s1', { freio: 0.01 }));
  tr.registrarDelta(delta('s1', { freio: 0.02 }));
  tr.registrarDelta(delta('s1', { freio: 0.0 }));
  t('CA-04 3 de 4 na banda → consolidado (silêncio)', tr.deveOrientar('s1') === false
    && tr.estado('s1').consolidado === true, JSON.stringify(tr.estado('s1')));
  // pico isolado não teria consolidado: histórico precisa de 3 dentro
  const tr2 = new TreinoStint({ foco: 'frenagem' });
  tr2.registrarDelta(delta('s2', { freio: 0.4 }));
  tr2.registrarDelta(delta('s2', { freio: 0.01 })); // pico isolado
  tr2.registrarDelta(delta('s2', { freio: 0.4 }));
  tr2.registrarDelta(delta('s2', { freio: 0.38 }));
  t('CA-05 pico isolado NÃO consolida', tr2.estado('s2').consolidado === false);
  // consolidado reabre com 2 regressões seguidas
  tr.registrarDelta(delta('s1', { freio: 0.3 }));
  t('CA-06 1 regressão ainda calado', tr.deveOrientar('s1') === false);
  tr.registrarDelta(delta('s1', { freio: 0.3 }));
  t('CA-07 2 regressões seguidas → reabre', tr.deveOrientar('s1') === true, JSON.stringify(tr.estado('s1')));
}

// ── Guarda do círculo de tração ───────────────────────────────
{
  const tr = new TreinoStint({ foco: 'frenagem' });
  // duas passagens-base com total ~0.4
  tr.registrarDelta(delta('g1', { freio: 0.4 }, 0.4));
  tr.registrarDelta(delta('g1', { freio: 0.4 }, 0.4));
  // foco "melhorou" mas o trecho INTEIRO piorou (freada funda matou a saída)
  tr.registrarDelta(delta('g1', { freio: 0.01, saida: 0.9 }, 0.91));
  tr.registrarDelta(delta('g1', { freio: 0.0, saida: 0.9 }, 0.9));
  tr.registrarDelta(delta('g1', { freio: 0.02, saida: 0.9 }, 0.92));
  t('GC-01 melhora no foco com trecho piorando NÃO consolida',
    tr.estado('g1').consolidado === false, JSON.stringify(tr.estado('g1')));
}

// ── Anti-saturação: 2 falhas piorando → reduz; 3 → cala ───────
{
  const tr = new TreinoStint({ foco: 'frenagem' });
  tr.registrarDelta(delta('a1', { freio: 0.2 }));
  tr.registrarDelta(delta('a1', { freio: 0.3 }));  // piorou 1
  tr.registrarDelta(delta('a1', { freio: 0.45 })); // piorou 2 → reduzido
  t('AS-01 2 falhas piorando → exigência recua', tr.estado('a1').nivel === 'reduzido', tr.estado('a1').nivel);
  t('AS-02 degrau no nível reduzido tem teto 2 m', tr.aplicarDegrau(12, 'a1') === 2);
  tr.registrarDelta(delta('a1', { freio: 0.6 }));  // piorou 3 → calado
  t('AS-03 3 falhas piorando → cala no trecho', tr.estado('a1').nivel === 'calado' && tr.deveOrientar('a1') === false);
}

// ── Degrau digerível (decisão 2: ~30%, teto 4 m, piso 2 m) ────
{
  const tr = new TreinoStint({ foco: 'frenagem' });
  t('DG-01 caminho curto vai inteiro', tr.aplicarDegrau(3) === 3);
  t('DG-02 12 m → pede 4 (30% com teto)', tr.aplicarDegrau(12) === 4);
  t('DG-03 30 m → teto 4', tr.aplicarDegrau(30) === 4);
  t('DG-04 6 m → piso 2', tr.aplicarDegrau(6) === 2, String(tr.aplicarDegrau(6)));
  t('DG-05 sinal preservado', tr.aplicarDegrau(-12) === -4);
}

// ── Consolidação pré-box (2 últimas voltas antes de parada) ───
{
  const tr = new TreinoStint({ foco: 'frenagem', plano: { paradas: [{ volta: 5, motivo: 'pneus' }] } });
  tr.registrarDelta(delta('p1', { freio: 0.3 }));
  tr.registrarDelta(delta('p1', { freio: 0.3 }));
  tr.setVoltaAtual(3);
  t('PB-01 longe da parada → orienta', tr.deveOrientar('p1') === true);
  tr.setVoltaAtual(4);
  t('PB-02 volta anterior à parada → consolida (sem meta nova)', tr.deveOrientar('p1') === false);
  tr.setVoltaAtual(5);
  t('PB-03 volta da parada → consolida', tr.deveOrientar('p1') === false);
  tr.setVoltaAtual(6);
  t('PB-04 depois da parada → volta a orientar', tr.deveOrientar('p1') === true);
}

// ── Foco no motor de orientação (oportunidade-trecho) ─────────
function refPontos(fracFreio = 0.25, kmhMin = 80) {
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const frac = i / 10;
    pts.push({ lat: 0, lng: frac * 0.0009, kmh: frac === 0.5 ? kmhMin : 120, fracao: frac,
               sub: frac < fracFreio ? 'entrada' : (frac < 0.5 ? 'freio' : (frac < 0.7 ? 'apice' : 'saida')) });
  }
  return pts;
}
{
  const m = new OportunidadeTrecho();
  m.setFoco({ subs: ['freio'], usaVmin: false });
  m.setReferencia('s1', { pontos: refPontos(0.25) });
  m.registrarPassagem({ segmentId: 's1', pontos: refPontos(0.10) });
  // saída MUITO pior que o freio — sem foco, a orientação iria pra ACELERA
  m.registrarDelta(delta('s1', { freio: 0.2, saida: 0.9 }));
  const o = m.getOrientacao('s1');
  t('FO-01 foco vence o pior global', o && o.disciplina === 'FREIO', o && o.disciplina);
  // foco em dia → null (silêncio é consolidação), mesmo com saída perdendo
  const m2 = new OportunidadeTrecho();
  m2.setFoco({ subs: ['freio'], usaVmin: false });
  m2.setReferencia('s1', { pontos: refPontos(0.25) });
  m2.registrarPassagem({ segmentId: 's1', pontos: refPontos(0.25) });
  m2.registrarDelta(delta('s1', { freio: 0.01, saida: 0.9 }));
  t('FO-02 foco em dia → silêncio (null)', m2.getOrientacao('s1') === null);
  // sem foco: comportamento original preservado
  const m3 = new OportunidadeTrecho();
  m3.setReferencia('s1', { pontos: refPontos(0.25) });
  m3.registrarPassagem({ segmentId: 's1', pontos: refPontos(0.25) });
  m3.registrarDelta(delta('s1', { freio: 0.01, saida: 0.9 }));
  const o3 = m3.getOrientacao('s1');
  t('FO-03 sem foco → pior global (ACELERA)', o3 && o3.verbo === 'ACELERA', o3 && o3.verbo);
}

// ── Degrau aplicado no número da prescrição (marcas continuam reais) ──
{
  const tr = new TreinoStint({ foco: 'frenagem' });
  const m = new OportunidadeTrecho();
  m.setFoco({ subs: ['freio'], usaVmin: false, degrauFn: (d, s) => tr.aplicarDegrau(d, s) });
  m.setReferencia('s1', { pontos: refPontos(0.25) });
  m.registrarPassagem({ segmentId: 's1', pontos: refPontos(0.10) }); // ~15 m antes da referência
  m.registrarDelta(delta('s1', { freio: 0.4 }));
  const o = m.getOrientacao('s1');
  t('DP-01 número pedido é o degrau (≤4 m)', o && o.quanto === '+4', o && o.quanto);
  t('DP-02 marcas continuam nas posições reais', o && o.voceFrac !== o.ouroFrac && o.ouroFrac != null);
}

// ── Vmin (treino de velocidade mínima / trail braking) ────────
{
  const m = new OportunidadeTrecho();
  m.setFoco({ subs: ['freio', 'apice'], usaVmin: true });
  m.setReferencia('s1', { pontos: refPontos(0.25, 96) });          // Vmin da melhor: 96
  m.registrarPassagem({ segmentId: 's1', pontos: refPontos(0.25), vminKmh: 88 }); // a dele: 88
  m.registrarDelta(delta('s1', { freio: 0.01 }));                  // delta em dia…
  const o = m.getOrientacao('s1');
  t('VM-01 Vmin abaixo da melhor → FREIA MENOS', o && o.destaque === 'MENOS', JSON.stringify(o));
  t('VM-02 sem gráfico de pedal (sem sensor — só o verbo)', o && !o.grafico && o.quanto === null);
  // Vmin em dia → silêncio
  const m2 = new OportunidadeTrecho();
  m2.setFoco({ subs: ['freio', 'apice'], usaVmin: true });
  m2.setReferencia('s1', { pontos: refPontos(0.25, 96) });
  m2.registrarPassagem({ segmentId: 's1', pontos: refPontos(0.25), vminKmh: 95.5 });
  m2.registrarDelta(delta('s1', { freio: 0.01 }));
  t('VM-03 Vmin na banda → silêncio', m2.getOrientacao('s1') === null);
}

// ── buscarPlanoStintDaNuvem (plano viaja com o envelope, 11/06) ──
{
  const resposta = (status, json) => ({ ok: status >= 200 && status < 300, status, json: async () => json, text: async () => JSON.stringify(json) });
  const fetchCom = (status, json, capt) => async (url, opts) => { if (capt) { capt.url = url; capt.opts = opts; } return resposta(status, json); };

  // relógio fixo dos testes: 11/06/2026 17h Brasília
  const AGORA = '2026-06-11T17:00:00-03:00';
  const HOJE_CEDO = '2026-06-11T08:00:00-03:00';
  const ONTEM = '2026-06-10T17:00:00-03:00';
  const busca = (json, capt) => buscarPlanoStintDaNuvem({ carroId: 'carro-1', fetchFn: fetchCom(200, json, capt), agoraIso: AGORA });

  const planoTreino = { proposito: 'treinar', foco: 'frenagem', ghost: false, voltas: 12, paradas: [{ volta: 6, motivo: 'pneus' }] };

  const capt = {};
  const p1 = await busca([{ id: 'e1', created_at: HOJE_CEDO, plano_stint: planoTreino }], capt);
  t('BN-01 plano de treino aprovado HOJE → arma com origem nuvem',
    p1 && p1.proposito === 'treinar' && p1.foco === 'frenagem' && p1.origem === 'nuvem' && p1.paradas.length === 1);
  t('BN-02 consulta pede o último envelope do carro',
    capt.url.includes('envelopes_seguranca_stint') && capt.url.includes('carro_id=eq.carro-1')
    && capt.url.includes('order=created_at.desc') && capt.url.includes('limit=1'), capt.url);
  t('BN-03 consulta NÃO pede coluna específica (banco sem a 0042 não falha)', !capt.url.includes('select='), capt.url);
  t('BN-04 consulta vai autenticada (apikey)', !!(capt.opts && capt.opts.headers && capt.opts.headers.apikey));

  t('BN-05 envelope sem plano (banco antigo) → null',
    await busca([{ id: 'e1', created_at: HOJE_CEDO }]) === null);
  t('BN-06 nenhum envelope → null', await busca([]) === null);
  t('BN-07 erro HTTP → null (painel roda padrão)',
    await buscarPlanoStintDaNuvem({ carroId: 'c', fetchFn: fetchCom(500, { erro: 'x' }), agoraIso: AGORA }) === null);
  t('BN-08 sem rede (fetch lança) → null',
    await buscarPlanoStintDaNuvem({ carroId: 'c', fetchFn: async () => { throw new Error('offline'); }, agoraIso: AGORA }) === null);
  t('BN-09 sem carroId → null sem consultar',
    await buscarPlanoStintDaNuvem({ carroId: null, fetchFn: async () => { throw new Error('não era pra chamar'); }, agoraIso: AGORA }) === null);

  const livre = await busca([{ created_at: HOJE_CEDO, plano_stint: { proposito: 'livre', foco: null } }]);
  t('BN-10 plano livre passa (painel decide não armar)', livre && livre.proposito === 'livre' && livre.origem === 'nuvem');
  t('BN-11 treino com foco inválido na nuvem → null',
    await busca([{ created_at: HOJE_CEDO, plano_stint: { proposito: 'treinar', foco: 'drift' } }]) === null);
  t('BN-12 plano corrompido (não-objeto) → null',
    await busca([{ created_at: HOJE_CEDO, plano_stint: 'lixo' }]) === null);

  // validação compartilhada: localStorage e nuvem julgam o plano pela MESMA régua
  t('BN-13 validarPlanoStint é a mesma régua dos dois caminhos',
    validarPlanoStint(planoTreino, 'nuvem')?.foco === 'frenagem' && validarPlanoStint({ proposito: 'treinar', foco: 'drift' }, 'nuvem') === null);

  // VALIDADE (achado da revisão adversarial 11/06): plano só vale no DIA da
  // aprovação (fuso Brasília) — sem isso o notebook do carro armaria pra
  // sempre o treino da semana passada em todo boot.
  t('BN-14 plano de ONTEM → null (não arma treino velho)',
    await busca([{ created_at: ONTEM, plano_stint: planoTreino }]) === null);
  t('BN-15 sem created_at usa aprovadoEm do plano (hoje → arma)',
    (await busca([{ plano_stint: { ...planoTreino, aprovadoEm: HOJE_CEDO } }]))?.foco === 'frenagem');
  t('BN-16 sem created_at e aprovadoEm de ontem → null',
    await busca([{ plano_stint: { ...planoTreino, aprovadoEm: ONTEM } }]) === null);
  t('BN-17 sem nenhuma data → null (recusa validade desconhecida)',
    await busca([{ plano_stint: planoTreino }]) === null);
  t('BN-18 virada de dia: aprovado 23h59 de ontem não vale hoje',
    await busca([{ created_at: '2026-06-10T23:59:00-03:00', plano_stint: planoTreino }]) === null);
}

console.log(`\ntreino-stint: ${ok} ok / ${fail} fail`);
process.exit(fail ? 1 : 0);
