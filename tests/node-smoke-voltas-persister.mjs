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

// ── Caminho de SUCESSO com dublê de banco (auditoria 10/06: as guardas não
// estavam presas — mutante sobrevivia — e o contrato do payload não era testado) ──
import { _injetarClienteParaTeste } from '../web/cockpit/voltas-persister.js';

function dubleBanco({ erroInsert = null, sessaoDevolvida = undefined } = {}) {
  const registro = { inserts: [], selects: [] };
  const cadeiaSelect = (resultado) => {
    const c = {};
    for (const m of ['select', 'eq', 'is', 'gte', 'order', 'limit']) {
      c[m] = (...args) => { registro.selects.push([m, ...args]); return c; };
    }
    c.maybeSingle = async () => ({ data: resultado, error: null });
    return c;
  };
  return {
    registro,
    from(tabela) {
      registro.tabela = tabela;
      return {
        ...cadeiaSelect(sessaoDevolvida),
        insert: async (payload) => { registro.inserts.push(payload); return { error: erroInsert }; },
      };
    },
  };
}

await t('VP-06 SUCESSO: payload completo com origem painel-ao-vivo (a volta real nunca entra como provisória)', async () => {
  const banco = dubleBanco();
  _injetarClienteParaTeste(banco);
  const r = await gravarVoltaReal({
    sessao: { id: 'sess-1', time_id: 'time-1' },
    numero: 3, tempoMs: 91234.7, inicioAt: 1780000000000,
  });
  if (r !== true) throw new Error('não gravou');
  const p = banco.registro.inserts[0];
  if (!p) throw new Error('insert não chamado');
  if (p.origem !== 'painel-ao-vivo') throw new Error(`origem=${p.origem} (entraria como provisória)`);
  if (p.sessao_id !== 'sess-1' || p.time_id !== 'time-1') throw new Error('sessão/time errados');
  if (p.numero !== 3) throw new Error('número errado');
  if (p.tempo_ms !== 91235) throw new Error(`tempo_ms=${p.tempo_ms} (esperava arredondado 91235)`);
  if (!String(p.inicio_at).includes('T')) throw new Error('inicio_at não é data');
});

await t('VP-07 banco recusa → false (sem fingir sucesso)', async () => {
  _injetarClienteParaTeste(dubleBanco({ erroInsert: { message: 'RLS' } }));
  const r = await gravarVoltaReal({ sessao: { id: 's', time_id: 't' }, numero: 1, tempoMs: 90000 });
  if (r !== false) throw new Error('fingiu sucesso');
});

await t('VP-08 busca de sessão exige recência (filtro de 12 h contra stints zumbis)', async () => {
  const banco = dubleBanco({ sessaoDevolvida: { id: 's1', time_id: 't1' } });
  _injetarClienteParaTeste(banco);
  const r = await acharSessaoAberta('carro-1');
  if (!r || r.id !== 's1') throw new Error('não achou');
  const chamadas = banco.registro.selects.map(c => c[0]);
  if (!chamadas.includes('gte')) throw new Error('SEM filtro de recência — stint zumbi de maio receberia voltas');
  const gte = banco.registro.selects.find(c => c[0] === 'gte');
  if (gte[1] !== 'data_inicio') throw new Error('recência não é por data_inicio');
});

console.log(`\nVoltas persister: ${ok} ok / ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
