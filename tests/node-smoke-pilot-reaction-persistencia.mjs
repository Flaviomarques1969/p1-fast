// Smoke da persistência dos perfis de tempo de troca (Onda 7+).
//
// Cenários:
//   1. loadPerfis com carro inválido → {}
//   2. savePerfil → upsert que retorna true em sucesso
//   3. round-trip: salva, carrega, valor bate
//   4. Múltiplos perfis salvos em batch via savePerfis
//   5. Update via savePerfil sobre chave existente → reaction_time_ms atualizado

import { loadPerfis, savePerfil, savePerfis } from '../web/cockpit/pilot-reaction-persister.js';

const CARRO_BUBI = '641a81e7-3192-4e68-8183-b8401f105574';

let ok = 0, fail = 0;
function check(label, cond, extra = '') {
  if (cond) { console.log(`✓ ${label}`); ok++; }
  else { console.error(`✗ ${label} ${extra}`); fail++; }
}

// ── PRP-01: carro inválido → vazio ─────────────────────────────────────
{
  const r = await loadPerfis('not-a-uuid');
  check('PRP-01 loadPerfis com chave inválida → {}',
    typeof r === 'object' && Object.keys(r).length === 0);
}

// ── PRP-02: salva 1 perfil simples ─────────────────────────────────────
const VALOR_INICIAL = 215.5;
{
  const r = await savePerfil({
    pilotoId:       null,
    carroId:        CARRO_BUBI,
    marcha:         4,
    trechoId:       null,
    reactionTimeMs: VALOR_INICIAL,
    sampleCount:    12,
  });
  check('PRP-02 savePerfil retorna true', r === true);
}

// ── PRP-03: carrega e confere ──────────────────────────────────────────
{
  const perfis = await loadPerfis(CARRO_BUBI);
  const key = `x:${CARRO_BUBI}:4:x`;
  const p = perfis[key];
  check('PRP-03 perfil salvo aparece no load com mesmo valor',
    p && Math.abs(p.reaction_time_ms - VALOR_INICIAL) < 0.01,
    `key=${key} encontrado=${!!p} valor=${p ? p.reaction_time_ms : '-'}`);
}

// ── PRP-04: update via savePerfil sobre mesma chave ────────────────────
const VALOR_ATUALIZADO = 198.7;
{
  const r = await savePerfil({
    pilotoId:       null,
    carroId:        CARRO_BUBI,
    marcha:         4,
    trechoId:       null,
    reactionTimeMs: VALOR_ATUALIZADO,
    sampleCount:    20,
  });
  check('PRP-04 update sobre chave existente retorna true', r === true);
}

// ── PRP-05: re-carrega e vê o valor atualizado ────────────────────────
{
  const perfis = await loadPerfis(CARRO_BUBI);
  const key = `x:${CARRO_BUBI}:4:x`;
  const p = perfis[key];
  check('PRP-05 valor atualizado é persistido (round-trip)',
    p && Math.abs(p.reaction_time_ms - VALOR_ATUALIZADO) < 0.01,
    `valor=${p ? p.reaction_time_ms : '-'} esperado=${VALOR_ATUALIZADO}`);
}

// ── PRP-06: savePerfis batch com 3 perfis distintos ────────────────────
{
  const batch = {
    [`x:${CARRO_BUBI}:1:x`]: { key: `x:${CARRO_BUBI}:1:x`, reaction_time_ms: 240, sample_count: 10 },
    [`x:${CARRO_BUBI}:2:x`]: { key: `x:${CARRO_BUBI}:2:x`, reaction_time_ms: 260, sample_count: 15 },
    [`x:${CARRO_BUBI}:3:x`]: { key: `x:${CARRO_BUBI}:3:x`, reaction_time_ms: 280, sample_count: 8  },
  };
  const r = await savePerfis(batch, { carroId: CARRO_BUBI });
  check('PRP-06 savePerfis batch: 3 de 3 salvos',
    r.total === 3 && r.ok === 3,
    JSON.stringify(r));
}

// ── PRP-07: re-carrega e confirma os 3 perfis ──────────────────────────
{
  const perfis = await loadPerfis(CARRO_BUBI);
  const k1 = perfis[`x:${CARRO_BUBI}:1:x`];
  const k2 = perfis[`x:${CARRO_BUBI}:2:x`];
  const k3 = perfis[`x:${CARRO_BUBI}:3:x`];
  check('PRP-07 todos os 3 perfis do batch aparecem no load',
    k1 && k2 && k3 &&
    k1.reaction_time_ms === 240 &&
    k2.reaction_time_ms === 260 &&
    k3.reaction_time_ms === 280);
}

console.log(`\nPilot Reaction Persistência: ${ok} ok / ${fail} fail`);
if (fail > 0) process.exit(1);
