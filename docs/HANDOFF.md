# Handoff — sessão 2026-05-03 noite

> Doc específico pra próxima sessão Claude após `/clear`. Lê este primeiro.
> Atualizado autonomamente sempre que o Flávio sinalizar pause/clear.

## Onde paramos

**Última ação:** prompt #16 (Sprint 1A.4 — schema v2) entregue ao Flávio
pronto pra colar no Cloud Code. Renumeração de migrations feita
(0003a→0004, 0003b→0005 — porque 0003 já está em main como RLS fix).

**Estado dos PRs:** zero abertos. Sprint 1A.3 fechado 100% em main.

**Cloud Code:** rodando #16 OU prestes a (depende se Flávio colou antes do clear).

## Pra próxima sessão fazer assim que abrir

### 1. Verificar onde Cloud Code está
```bash
cd /Users/imac/Projetos/P1\ Fast
gh pr list --state open --json number,title,headRefName
```

- Se aparece `feat/1A4-schema-v2` → #16 ainda em flight, aguardar/auditar
- Se aparece outro feat/ → algum prompt foi disparado, identificar qual
- Se vazio + Flávio diz "ainda não disparei" → colar prompt #16 abaixo

### 2. Prompt #16 ready-to-paste (se ainda não foi disparado)

Está em `docs/SPRINT_1A4_DESIGN.md` linhas ~30-180 (Prompt #16 — Schema migration v2 + StintRepository cleanup).

**Avisos importantes a adicionar antes de colar (não estão no prompt baked original):**
1. Migration GRDB precisa se chamar **`v2a_columns`** (não `v2`) — porque já existe `v3_fix_recursive_rls` em main.
2. Migration Postgres precisa ser **`0006_v2_schema_columns.sql`** — números 0003 (RLS), 0004 (lições futuras), 0005 (pendências futuras) já reservados.
3. Cloud Code NÃO deve rodar `supabase db push` — Supabase prod já existe (project ref `fvhwltzhytpnhlqbttmd`), Flávio aplica manualmente após merge.

### 3. Audit checklist do #16 quando voltar

Está em `docs/AUDIT_CHECKLISTS/16.md` (criado nesta sessão).

### 4. Após mergear #16

Próximos PRs (qualquer ordem, após renumeração feita):
- **#17** stint selectors → toca StintModalView, depende de #16 ✓
- **#18** pessoas v2 → forms altura/peso/idade, depende de #16 ✓
- **#19** trechos → independente de #16
- **#20** lições → independente de #16, cria migration 0004 (renomeada)
- **#21** pendências → independente de #16, cria migration 0005 (renomeada)
- **#22** setup avançado → independente de #16
- **#23** HTTP transport → independente de #16
- **#24** SyncView → depende de #23

Total: 8 PRs depois do #16. Phase 1A fecha quando #24 mergear.

## Ações autônomas em andamento (Claude faz sem Flávio)

- Audit de PRs novos quando aparecerem (checklist em `docs/AUDIT_CHECKLISTS/`)
- Rebase + merge automático após audit verde
- Updates de `STATUS.md`, `IMPLEMENTATION_COVERAGE.md`, `CONTROL_CENTER.md` a cada milestone
- Bug fixes de migration via PR (vide PR #43 RLS recursion)

## Decisão pendente AGORA

Q1 do `CONTROL_CENTER.md`: Cloud Code rodando #16. Próxima ação automática quando voltar = audit + merge + preparar #17 ou #18 ou outro independente pra dispatch.

Flávio decide ordem dos próximos disparos. Sugestão: ordem que tá em `CONTROL_CENTER.md`.

## Contexto fresco que pode estar perdido

- **Supabase prod:** project `fvhwltzhytpnhlqbttmd`, region São Paulo, Free. User `Flaviomarques@me.com` (id `04fef19d-d1f4-45b6-bd89-b50a6aec121f`), time "Flavio P1 Fast" (id `c027a716-dc05-4d3c-9b8f-59f288d5e12c`). Edge Functions deployadas (health/ingest/pull/sync). E2E testado.
- **Database password:** `BeBZzfPVtiNXKGUojTK8c8BnEx6G` (Flávio anotou).
- **Creds em:** `ios/p1fast-ios/.env.xcconfig` (gitignored).
- **Migration v3 fix:** RLS recursion resolvida via SECURITY DEFINER (PR #43).
- **Modelo de operação:** vide `docs/CONTROL_CENTER.md`.
