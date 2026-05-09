# P1 Fast — orientação para Claude

## Antes de fazer qualquer coisa, leia nesta ordem

1. **`STATUS.md`** (raiz) — onde o projeto está agora
2. **`docs/PLANO_FASE_1.md`** — DOC MESTRE, aprovado pelo Flávio 2026-05-03. Vence todos os outros. (O antigo `PLANO_FASE_1A_1B.md` foi arquivado em `docs/_archive/`.)
3. **`ARCHITECTURE_DECISIONS.md`** (raiz) — 22 ADRs vigentes, não reabrir sem ordem

## Em caso de contradição entre docs

`PLANO_FASE_1.md` vence. Sub-docs (`SPRINT_*.md`, `HANDOFF_*.md`, `READY_PROMPTS/*`, `IMPLEMENTATION_COVERAGE.md`, `STATUS.md`) são derivados e podem estar desatualizados. Se achar contradição, **alertar o Flávio**, não escolher silenciosamente.

## Tratamento — REGRA DURA

**Sempre "você". NUNCA "tu/te/ti/teu/tua/contigo".** Vale para mensagens no chat, prompts pro Cloud Code, comentários em PR, commits, qualquer texto. Esta regra é §9.2 de `PLANO_FASE_1.md` e o Flávio reforçou em 2026-05-09.

## Decisões já fechadas — NÃO reabrir

- **Não há mais Fase 2** — tudo entra em Fase 1 — `PLANO_FASE_1.md` §1 (decisão Flávio 2026-05-03)
- **Cockpit-display ao vivo migra pra Windows 10,5"** (web app, web=produto a partir do mockup canônico) — **ADR-023** (decisão Flávio 2026-05-09)
- **Driver T4000 fica no Windows** (USB CDC-ACM ou CAN, JS sobre Node/Electron) — **ADR-023**, substitui o plano original BLE iOS
- **Transporte iPhone↔Windows = Supabase Realtime** (publish 10 Hz IMU/GPS pelo iPhone, publish 10 Hz T4000 pelo Windows). Cabo USB iPhone↔notebook só pra carga. — **ADR-023**
- **Captura iOS Swift nativa preservada** (CoreMotion + CoreLocation + Daily.co), hub iOS preservado — ADR-018 com amendment 2026-05-09
- **Plataforma do hub e captura:** iOS Swift nativo, iPhone único. Sem CarPlay, Apple Watch, Android, PWA — ADR-018
- **Vídeo ao vivo:** Daily.co (câmera onboard frontal do iPhone) — `PLANO_FASE_1.md` §2
- **Box cockpit:** App iOS modo BOX → AirPlay → Apple TV → TV 32" — mesmo doc, §2
- **Pendências obrigatório × adicional, vivas, por carro+evento** — `PLANO_FASE_1.md` §6 MS-5
- **Detector ao vivo:** Port nativo Swift no iPhone + JS no Windows a partir do mesmo domínio — decidido 2026-05-03 / revisitado 2026-05-09
- **Cockpit landscape:** forçado no notebook Windows (kiosk fullscreen) — revisitado 2026-05-09 com ADR-023
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
