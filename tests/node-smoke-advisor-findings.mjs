// ═══════════════════════════════════════════════════════════
// node-smoke-advisor-findings — MS-16.4
// ═══════════════════════════════════════════════════════════
// Testa que /api/advisor.js aceita findings[] no payload + que o
// buildUserPrompt inclui o bloco "FINDINGS CODIFICADOS" quando presente.
// NÃO chama a API Claude real — apenas exercita schema + payload builder.
//
// docs/COMMAND_BOX_ENGENHARIA.md §5.1 Camada 3 (Senior Advisor IA).
// docs/PLANO_FASE_1.md §6 MS-16 task 16.4.

import { advisorPayload } from '../api/_lib/schemas.js';
import { readFileSync } from 'node:fs';

let ok = 0;
let fail = 0;

function step(name, body) {
  try {
    body();
    console.log(`✓ ${name}`);
    ok++;
  } catch (err) {
    console.log(`✗ ${name} — ${err.message || err}`);
    fail++;
  }
}

function assertEq(a, b, msg = '') {
  if (a !== b) throw new Error(`${msg} — esperado ${JSON.stringify(b)}, recebeu ${JSON.stringify(a)}`);
}
function assertTrue(cond, msg = 'assert false') {
  if (!cond) throw new Error(msg);
}

// ── Schema validation ─────────────────────────────────────────

step('AF-01: schema aceita payload mínimo sem findings (compat retro)', () => {
  const r = advisorPayload.parse({
    stint: { laps: [{ tempoMs: 95000, valida: true }] }
  });
  assertEq(r.ok, true, 'parse deve passar');
});

step('AF-02: schema aceita findings[] válido com 1 finding', () => {
  const r = advisorPayload.parse({
    stint: { laps: [{ tempoMs: 95000, valida: true }] },
    findings: [{
      id: 'fin-abc123',
      ruleId: 'fuel-lean-sustained-load',
      titulo: 'Mistura pobre sustentada sob carga',
      severidade: 'atencao',
      confianca: 'Alta',
      escopo: 'stint',
    }]
  });
  assertEq(r.ok, true);
  assertEq(r.value.findings.length, 1);
  assertEq(r.value.findings[0].ruleId, 'fuel-lean-sustained-load');
});

step('AF-03: schema rejeita severidade inválida', () => {
  const r = advisorPayload.parse({
    stint: { laps: [{ tempoMs: 95000, valida: true }] },
    findings: [{
      id: 'fin-abc123',
      ruleId: 'fuel-lean-sustained-load',
      titulo: 'Mistura pobre',
      severidade: 'critico',   // não está no regex /^(info|atencao|alta)$/
      confianca: 'Alta',
    }]
  });
  assertEq(r.ok, false);
  assertTrue(r.errors.some(e => e.path.includes('severidade')), 'erro deve mencionar severidade');
});

step('AF-04: schema rejeita confianca inválida', () => {
  const r = advisorPayload.parse({
    stint: { laps: [{ tempoMs: 95000, valida: true }] },
    findings: [{
      id: 'fin-abc123',
      ruleId: 'fuel-lean-sustained-load',
      titulo: 'Mistura pobre',
      severidade: 'atencao',
      confianca: 'High',  // deve ser Alta/Média/Baixa
    }]
  });
  assertEq(r.ok, false);
});

step('AF-05: schema aceita até 50 findings; rejeita 51', () => {
  const mkFinding = (i) => ({
    id: `fin-${i}`,
    ruleId: 'rule-test',
    titulo: 'titulo',
    severidade: 'info',
    confianca: 'Média',
  });
  const r50 = advisorPayload.parse({
    stint: { laps: [{ tempoMs: 95000 }] },
    findings: Array.from({ length: 50 }, (_, i) => mkFinding(i)),
  });
  assertEq(r50.ok, true);

  const r51 = advisorPayload.parse({
    stint: { laps: [{ tempoMs: 95000 }] },
    findings: Array.from({ length: 51 }, (_, i) => mkFinding(i)),
  });
  assertEq(r51.ok, false);
});

// ── Build user prompt ─────────────────────────────────────────
// Re-impl mínimo do buildUserPrompt pra testá-lo offline (api/advisor.js
// é serverless e não exporta a função; replicamos o contrato esperado).
//
// Em vez disso, lemos o source da api/advisor.js e validamos que o
// bloco esperado existe — proteção contra regressão acidental.

const advisorSource = readFileSync('./api/advisor.js', 'utf8');

step('AF-06: api/advisor.js inclui menção "FINDINGS CODIFICADOS" no system prompt', () => {
  assertTrue(advisorSource.includes('FINDINGS CODIFICADOS'),
             'system prompt deve ter seção sobre findings');
});

step('AF-07: api/advisor.js documenta governanças sobre findings determinísticos', () => {
  assertTrue(advisorSource.includes('HIPÓTESES PRÉ-VALIDADAS') ||
             advisorSource.includes('pré-validadas'),
             'system prompt deve dizer que findings são hipóteses pré-validadas');
  assertTrue(advisorSource.includes('NÃO contradizer'),
             'system prompt deve proibir contradizer findings sem motivo');
});

step('AF-08: api/advisor.js recebe campo `findings` em buildUserPrompt', () => {
  assertTrue(advisorSource.includes('findings'),
             'buildUserPrompt deve referenciar findings');
  assertTrue(advisorSource.includes('FINDINGS CODIFICADOS') &&
             advisorSource.includes('Severidade:') &&
             advisorSource.includes('Confiança:'),
             'buildUserPrompt deve renderizar cada finding com Severidade + Confiança');
});

step('AF-09: api/advisor.js mantém compatibilidade retro quando findings ausente', () => {
  // O fluxo old ainda deve funcionar — texto "Analise os dados acima" preservado
  assertTrue(advisorSource.includes('Analise os dados acima'),
             'fluxo sem findings deve continuar pedindo "Analise os dados acima"');
});

// ── Relatório ─────────────────────────────────────────────────

console.log('');
console.log('═══ RESULTADO ═══');
console.log(`${ok} ok / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
