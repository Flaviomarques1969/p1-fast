// Smoke do modo silencioso. Verifica: silêncio bloqueia COMUNICAÇÃO e
// NUNCA bloqueia GRAVE (alertas críticos = segurança).

import { CockpitState, MsgTipo } from '../web/cockpit/cockpit-state.js';

let ok = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log(`✓ ${name}`); ok++; }
  catch (e) { console.log(`✗ ${name} — ${e.message}`); fail++; }
}

t('SI-01 silencioso default = false', () => {
  const cs = new CockpitState();
  if (cs.isSilencioso() !== false) throw new Error('default não é false');
});

t('SI-02 setSilencioso(true) bloqueia mensagem de comunicação', () => {
  const cs = new CockpitState();
  cs.setSilencioso(true);
  cs.showMessage({ tipo: MsgTipo.COMUNICACAO, texto: 'FREOU CEDO' });
  if (cs.get().message !== null) throw new Error('comunicação não foi silenciada');
});

t('SI-03 modo silencioso NÃO bloqueia GRAVE (segurança)', () => {
  const cs = new CockpitState();
  cs.setSilencioso(true);
  cs.showMessage({ tipo: MsgTipo.GRAVE, texto: 'MOTOR QUENTE' });
  const m = cs.get().message;
  if (!m || m.texto !== 'MOTOR QUENTE') throw new Error('alerta crítico foi silenciado por engano!');
});

t('SI-04 ativar silêncio remove COMUNICAÇÃO ativa', () => {
  const cs = new CockpitState();
  cs.showMessage({ tipo: MsgTipo.COMUNICACAO, texto: 'ÁPICE TARDE' });
  cs.setSilencioso(true);
  if (cs.get().message !== null) throw new Error('comunicação ativa não foi limpa');
});

t('SI-05 ativar silêncio NÃO remove GRAVE ativo', () => {
  const cs = new CockpitState();
  cs.showMessage({ tipo: MsgTipo.GRAVE, texto: 'ÓLEO BAIXO' });
  cs.setSilencioso(true);
  const m = cs.get().message;
  if (!m || m.texto !== 'ÓLEO BAIXO') throw new Error('alerta crítico foi limpo por engano!');
});

t('SI-06 desativar silêncio permite nova COMUNICAÇÃO', () => {
  const cs = new CockpitState();
  cs.setSilencioso(true);
  cs.setSilencioso(false);
  cs.showMessage({ tipo: MsgTipo.COMUNICACAO, texto: 'VIROU TARDE' });
  if (cs.get().message?.texto !== 'VIROU TARDE') throw new Error('comunicação não voltou');
});

console.log(`\nSilencioso: ${ok} ok / ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
