// Smoke do voltas-persister — guardas de entrada (sem rede: as guardas
// devolvem antes do carregamento preguiçoso da biblioteca de nuvem).
import { acharSessaoAberta, gravarVoltaReal, criarContadorPersistencia } from '../web/cockpit/voltas-persister.js';

let ok = 0, fail = 0;
async function t(name, fn) {
  try { await fn(); console.log(`✓ ${name}`); ok++; }
  catch (e) { console.log(`✗ ${name} — ${e.message}`); fail++; }
}

await t('VP-01 sem carro → sessão null (sem tocar a rede)', async () => {
  const r = await acharSessaoAberta(null);
  if (r !== null) throw new Error(`r=${r}`);
});

await t('VP-02 gravar sem sessão → false (nunca inventa volta)', async () => {
  if (await gravarVoltaReal({ sessao: null, numero: 1, tempoMs: 90000 }) !== false) throw new Error('aceitou');
});

await t('VP-03 gravar com sessão sem time → false', async () => {
  if (await gravarVoltaReal({ sessao: { id: 'x' }, numero: 1, tempoMs: 90000 }) !== false) throw new Error('aceitou');
});

await t('VP-04 gravar sem número de volta → false', async () => {
  if (await gravarVoltaReal({ sessao: { id: 'x', time_id: 'y' }, numero: NaN, tempoMs: 90000 }) !== false) throw new Error('aceitou');
});

await t('VP-05 contador de persistência nasce zerado', async () => {
  const c = criarContadorPersistencia();
  if (c.gravadas !== 0 || c.recusadas !== 0 || c.semSessao !== 0) throw new Error(JSON.stringify(c));
});

console.log(`\nVoltas persister: ${ok} ok / ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
