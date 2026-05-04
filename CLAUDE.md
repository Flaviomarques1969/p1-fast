# P1 Fast — orientação para Claude

## Antes de fazer qualquer coisa, leia nesta ordem

1. **`STATUS.md`** (raiz) — onde o projeto está agora
2. **`docs/PLANO_FASE_1.md`** — DOC MESTRE, aprovado pelo Flávio 2026-05-03. Vence todos os outros. (O antigo `PLANO_FASE_1A_1B.md` foi arquivado em `docs/_archive/`.)
3. **`ARCHITECTURE_DECISIONS.md`** (raiz) — 22 ADRs vigentes, não reabrir sem ordem

## Em caso de contradição entre docs

`PLANO_FASE_1.md` vence. Sub-docs (`SPRINT_*.md`, `HANDOFF_*.md`, `READY_PROMPTS/*`, `IMPLEMENTATION_COVERAGE.md`, `STATUS.md`) são derivados e podem estar desatualizados. Se achar contradição, **alertar o Flávio**, não escolher silenciosamente.

## Decisões já fechadas — NÃO reabrir

- **Não há mais Fase 2** — tudo entra em Fase 1 — `PLANO_FASE_1.md` §1 (decisão Flávio 2026-05-03)
- **Vídeo ao vivo:** Daily.co (2 câmeras simultâneas iPhone) — `PLANO_FASE_1.md` §2
- **Box cockpit:** App iOS modo BOX → AirPlay → Apple TV → TV 32" — mesmo doc, §2
- **Tier 1 = Injepro T4000 via BLE** — `PLANO_FASE_1.md` §4
- **Pendências obrigatório × adicional, vivas, por carro+evento** — `PLANO_FASE_1.md` §6 MS-5
- **Plataforma:** iOS Swift nativo, iPhone único. Sem CarPlay, Apple Watch, Android, PWA — ADR-018
- **Detector ao vivo:** Port nativo Swift, JS aposentado — decidido 2026-05-03
- **Cockpit landscape:** forçado via override só na CockpitView — decidido 2026-05-03
- **SQLite local = source of truth durante sessão** — ADR-003
- **Telemetria append-only, NÃO passa por syncQueue** — ADR-004 e ADR-014
- **Worktree mandatório pra Cloud Code** — ADR-021
- **Package.resolved é tracked, não deletar** — ADR-022

## Memória do Claude — DOIS caminhos

Sempre verificar **os dois**:
- `~/.claude/projects/-Users-imac/memory/` — global (lista pessoal)
- `~/.claude/projects/-Users-imac-Projetos-P1-Fast/memory/` — específica deste projeto

## Pastas a inventariar antes de propor escopo

- `docs/decision-logs/` — logs estruturados de decisões por papel
- `docs/AUDIT_CHECKLISTS/` — checklist por PR
- `docs/domain/` — design de domínio (matrizes piloto/engenheiro/mecânico)
- `docs/telemetry/` — specs de telemetria

## Meu escopo (do `docs/CONTROL_CENTER.md`)

- **Posso fazer:** auditoria, git ops, Supabase ops, escrita de docs
- **Decisões de arquitetura/escopo:** só Flávio. Eu posso propor; ele decide.
- **Princípio:** nunca perguntar o que é pesquisável. Abrir o doc, ler, aí questionar.
