// Smoke do GRAVADOR DA NUVEM — a nuvem guarda o ao vivo sem perda + trava dura de produção.
// Lógica pura (sem rede, sem banco). Entra na catraca (npm run smoke).

import {
  criarGravador, PrateleiraMemoria, conferirSequencia,
  PrateleiraIngest, paraSampleIngest, EVENTOS_GUARDAVEIS,
} from '../tools/nuvem-gravador.mjs';

let ok = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log('✓', name); ok++; }
  catch (e) { console.log('✗', name, '—', e.message); fail++; }
}

// ── Guarda sem perda + sequência contígua ──────────────────
t('guarda tudo que entra, em lote, sem perder (recebidas == gravadas)', () => {
  const pr = PrateleiraMemoria();
  const g = criarGravador({ prateleira: pr, loteMax: 1000 });
  for (let i = 0; i < 250; i++) g.registrar('gps', { lat: -15.77, lng: -47.9, i });
  g.descarregar();
  const e = g.estado();
  if (e.recebidas !== 250) throw new Error('recebidas=' + e.recebidas);
  if (e.gravadas !== 250) throw new Error('gravadas=' + e.gravadas);
  if (e.pendentes !== 0) throw new Error('pendentes=' + e.pendentes);
  if (pr.linhas.length !== 250) throw new Error('na prateleira=' + pr.linhas.length);
});

t('numera em sequência contígua (releitura detecta buraco)', () => {
  const pr = PrateleiraMemoria();
  const g = criarGravador({ prateleira: pr, loteMax: 50 });
  for (let i = 0; i < 120; i++) g.registrar('gps', { i });
  g.descarregar();
  const r = conferirSequencia(pr.linhas);
  if (!r.contigua) throw new Error('deveria ser contígua');
  if (r.total !== 120) throw new Error('total=' + r.total);
  // injeta buraco e confirma que a conferência pega
  const comBuraco = pr.linhas.slice(0, 50).concat(pr.linhas.slice(51));
  if (conferirSequencia(comBuraco).contigua) throw new Error('deveria detectar buraco');
});

t('descarrega sozinho ao atingir o tamanho do lote', () => {
  const pr = PrateleiraMemoria();
  const g = criarGravador({ prateleira: pr, loteMax: 100 });
  for (let i = 0; i < 100; i++) g.registrar('gps', { i });
  // ao 100º, deve ter descarregado automaticamente
  if (pr.linhas.length !== 100) throw new Error('auto-flush falhou: ' + pr.linhas.length);
  if (g.estado().pendentes !== 0) throw new Error('pendentes após auto-flush=' + g.estado().pendentes);
});

t('só guarda eventos da lista (ignora ruído)', () => {
  const g = criarGravador({ prateleira: PrateleiraMemoria(), loteMax: 10 });
  if (g.registrar('lixo', {}) !== false) throw new Error('deveria ignorar evento desconhecido');
  if (g.registrar('gps', {}) !== true) throw new Error('deveria aceitar gps');
  for (const ev of EVENTOS_GUARDAVEIS) if (g.registrar(ev, {}) !== true) throw new Error('deveria aceitar ' + ev);
});

// ── Perda NUNCA silenciosa: prateleira falha → alarme + recupera ──
t('prateleira falhando: NÃO perde, acende alarme e recupera quando volta', () => {
  let falhar = true;
  const guardadas = [];
  const prateleira = { guardar(linhas) { if (falhar) throw new Error('disco cheio'); for (const l of linhas) guardadas.push(l); } };
  const g = criarGravador({ prateleira, loteMax: 1000 });
  for (let i = 0; i < 30; i++) g.registrar('gps', { i });
  g.descarregar();                                  // falha
  let e = g.estado();
  if (e.alarme !== 'falha-ao-guardar') throw new Error('alarme não acendeu: ' + e.alarme);
  if (e.gravadas !== 0) throw new Error('não deveria ter gravado: ' + e.gravadas);
  if (e.pendentes !== 30) throw new Error('deveria segurar as 30: ' + e.pendentes);
  falhar = false;                                   // prateleira volta
  g.descarregar();
  e = g.estado();
  if (e.alarme !== null) throw new Error('alarme deveria apagar');
  if (e.gravadas !== 30) throw new Error('deveria recuperar as 30: ' + e.gravadas);
  if (guardadas.length !== 30) throw new Error('na prateleira=' + guardadas.length);
});

// ── TRAVA DURA DE PRODUÇÃO ─────────────────────────────────
t('PrateleiraIngest RECUSA sem autorização explícita (não toca produção)', () => {
  let threw = false;
  try { PrateleiraIngest({ supabaseUrl: 'x', jwt: 'y', sessionId: 'z' }); } catch { threw = true; }
  if (!threw) throw new Error('deveria recusar sem permitirProducao=true');
});

t('PrateleiraIngest exige credencial/sessão mesmo com autorização', () => {
  let threw = false;
  try { PrateleiraIngest({ permitirProducao: true }); } catch { threw = true; }
  if (!threw) throw new Error('deveria exigir supabaseUrl/jwt/sessionId');
});

t('mapeia a amostra guardada pro formato do ingest (t/source/signalQuality)', () => {
  const s = paraSampleIngest({ seq: 7, evento: 'gps', payload: { lat: -15.77, lng: -47.9, tWall: 123456, signalQuality: 'ok' } });
  if (s.t !== 123456) throw new Error('t=' + s.t);
  if (s.source !== 'gps') throw new Error('source=' + s.source);
  if (typeof s.signalQuality !== 'string') throw new Error('signalQuality ausente');
  if (s.seq !== 7) throw new Error('seq=' + s.seq);
  if (s.lat !== -15.77) throw new Error('payload não preservado');
});

console.log('');
console.log(`nuvem-gravador: ${ok} ok / ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
