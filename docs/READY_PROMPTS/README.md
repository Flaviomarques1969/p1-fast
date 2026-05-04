# Ready-to-paste prompts pro Cloud Code

Cada arquivo aqui tem 1 prompt 100% baked: caveats embutidos (nome de migration,
"não rodar supabase db push", path do worktree, gitignored .env.xcconfig, etc).
Abre o arquivo, copia o bloco dentro de ` ``` `, cola numa task NOVA do Cloud Code.

## Sequência

| # | Arquivo | Sprint | Depende de | Paralelizável com |
|---|---|---|---|---|
| 17 | `17_stint_selectors.md` | 1A.4 | #16 (já mergeado #47) | #18 |
| 18 | `18_pessoas_v2.md` | 1A.4 | #16 | #17 |
| 19 | `19_trechos.md` | 1A.5 | Sprint 1A.4 fechado | #20, #21, #22 |
| 20 | `20_licoes.md` | 1A.5 | Sprint 1A.4 fechado | #19, #21, #22 |
| 21 | `21_pendencias.md` | 1A.5 | Sprint 1A.4 fechado | #19, #20, #22 |
| 22 | `22_setup_avancado.md` | 1A.5 | Sprint 1A.4 fechado | #19, #20, #21 |
| 23 | `23_http_transport.md` | 1A.6 | Sprint 1A.5 fechado + creds Supabase em .env.xcconfig | — |
| 24 | `24_sync_ui.md` | 1A.6 | #23 | — |

**Quando #24 mergeia → Phase 1A 100% completa → Sprint 1B (cockpit ao vivo).**

## Templates SQL pré-baked

- `docs/_templates/0004_licoes.sql` — copiar literal pra `supabase/migrations/0004_licoes.sql` no #20
- `docs/_templates/0005_pendencias.sql` — idem pra #21

Cloud Code é instruído a copiar esses templates sem alteração estrutural.

## Audit checklists

Cada PR tem checklist em `docs/AUDIT_CHECKLISTS/{N}.md`. Rodar após o Cloud Code abrir o PR.
