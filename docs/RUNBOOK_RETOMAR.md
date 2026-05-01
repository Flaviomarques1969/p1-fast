# RUNBOOK — retomar trabalho no P1 Fast em 60 segundos

Para Claude (ou humano) que está retomando depois de `/clear` ou nova sessão.

## Passo 1 — leitura obrigatória (em ordem, ~2 min)

1. `~/.claude/projects/-Users-imac-Projetos-P1-Fast/memory/MEMORY.md` — índice
2. `memory/p1-fast-frente3-concluida-2026-05-01.md` — último estado consolidado
3. `memory/p1-fast-status.md` — visão geral do projeto
4. Este arquivo (`docs/RUNBOOK_RETOMAR.md`)

**NÃO ler:** `~/Projetos/FAM Racing/` (projeto descontinuado), `_design-reference/historico-evento/` (rascunhos), nem documentos antigos do FAM Racing herdados (vão estar marcados "Arquivado FAM Racing 2026-05-01").

## Passo 2 — health check (1 comando, ~30 s)

```bash
cd "/Users/imac/Projetos/P1 Fast" \
  && echo "── Swift ──" \
  && (cd ios/p1fast-core && swift run p1fast-smoke 2>&1 | grep "ok /" | tail -1) \
  && echo "── Node smoke (12 suites) ──" \
  && npm run smoke 2>&1 | grep -E "ok / 0 fail|TOTAL" \
  && echo "── Harness funcional ──" \
  && node tests/node-harness-funcional.mjs 2>&1 | grep "ok /" \
  && echo "── Harness API ──" \
  && node tests/node-harness-api.mjs 2>&1 | grep "ok /"
```

**Esperado (baseline 2026-05-01 fim da sessão, 227/0 total):**

| Suite | Resultado |
|---|---|
| `swift run p1fast-smoke` | **97 ok / 0 fail** |
| `npm run smoke` (12 suites somam) | **81 ok / 0 fail** |
| `node-harness-funcional.mjs` | **23 ok / 0 fail** |
| `node-harness-api.mjs` | **26 ok / 0 fail** |

Se algum cair → REGRESSÃO. Investigar antes de fazer qualquer outra coisa.

## Passo 3 — descobrir o que fazer

| Pergunta do Flavio | Onde achar a resposta |
|---|---|
| "qual estado atual?" | `memory/p1-fast-frente3-concluida-2026-05-01.md` |
| "o que falta fazer?" | `docs/PENDENCIAS_GATE.md` seção "Ativas" |
| "tem bloqueio?" | `BLOCKERS.md` seção "Ativos" |
| "iPhone aguenta X?" | `docs/hardware/IPHONE_SENSORS_BASELINE.md` |
| "como combinar com T4000?" | `docs/hardware/T4000_CAN_SPEC.md` + `IPHONE_SENSORS_BASELINE.md` §"Como combina com T4000" |
| "RaceBox?" | `memory/p1-fast-racebox-rebaixado-2026-05-01.md` (resposta: arquivado, não comprar) |
| "padrão visual?" | `_design-reference/README.md` + `memory/p1-fast-padrao-b.md` |
| "PWA no celular?" | `memory/feedback_sem_pwa_no_celular.md` (resposta: não, ADR-018) |
| "deploy?" | `memory/feedback_dev_sem_prod.md` (resposta: não até autorização) |

## Passo 4 — antes de prometer feature nova

Cheque a memória relevante:

- **Sensor / hardware:** `IPHONE_SENSORS_BASELINE.md` tem o que cabe e o que não cabe
- **Port Swift:** `memory/feedback_padroes_port_swift.md` tem as 10 regras
- **Tone / forma:** `memory/feedback_tratamento_voce.md`, `feedback_sem_icones.md`, `feedback_canonico_eh_contrato.md`

## Passo 5 — antes de fechar a sessão

Se mexeu em algo não-trivial:

1. Resultado das suites no fim deve continuar verde (rodar Passo 2 de novo).
2. Se entregou frente nova → criar memória `project` curta documentando.
3. Se descobriu padrão novo durável → criar memória `feedback`.
4. Atualizar `MEMORY.md` se memória nova merece ficar no índice.

## Pendências críticas em aberto (snapshot 2026-05-01)

Em ordem de prioridade, sem nada combinado pra atacar agora:

1. **P0** Apex Brasília completo (`docs/PENDENCIAS_GATE.md` §P0 — depende de marcação visual humana)
2. **P0** Hierarquia de alertas com limites calibrados (depende calibração com Flavio)
3. **P1** Captura real CAN T4000 (`BLOCKERS.md` §E2 — depende de adaptador CAN/USB)
4. **P1** App iOS publicando live no `/api/ingest/iphone` (endpoint pronto, app só captura CSV hoje)
5. **P1** V-003 a V-011 cross-validation
6. **P1** TelemetryTimebase Swift (existe só em JS)

## Comandos úteis

```bash
# Servir mockups _design-reference (Flavio costuma checar em http://localhost:8765)
cd "/Users/imac/Projetos/P1 Fast/_design-reference" && python3 -m http.server 8765

# Listar módulos Swift portados
ls "/Users/imac/Projetos/P1 Fast/ios/p1fast-core/Sources/P1FastCore/"

# Smoke específico
cd "/Users/imac/Projetos/P1 Fast" && node tests/node-smoke-p1-coach.mjs

# Ver últimos commits auto-save (auto-commit periódico)
git log --oneline -10
```

## Quando ATUALIZAR este runbook

- Após cada frente concluída (ajustar baseline numérica do Passo 2 e snapshot de pendências)
- Quando criar memória nova relevante (adicionar à tabela do Passo 3)
- Quando padrão de trabalho mudar (ex: novo comando de validação)

Não duplicar conteúdo — apontar para `memory/` e `docs/`. Este arquivo é índice, não fonte.
