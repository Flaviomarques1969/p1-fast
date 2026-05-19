# P1 Fast — orientação para Claude

## Antes de fazer qualquer coisa, leia nesta ordem

1. **`STATUS.md`** (raiz) — onde o projeto está agora
2. **`docs/PLANO_FASE_1.md`** — DOC MESTRE, aprovado pelo Flávio 2026-05-03. Vence todos os outros. (O antigo `PLANO_FASE_1A_1B.md` foi arquivado em `docs/_archive/`.)
3. **`ARCHITECTURE_DECISIONS.md`** (raiz) — 22 ADRs vigentes, não reabrir sem ordem
4. **`docs/SESSION_HANDOFF_*.md`** mais recente (`ls -1 docs/SESSION_HANDOFF_*.md | sort -r | head -1`) — ponto de retomada da última sessão. O SessionStart hook (`.claude/hooks/session-start.sh`) já imprime esse caminho automaticamente.

## Em caso de contradição entre docs

`PLANO_FASE_1.md` vence. Sub-docs (`SPRINT_*.md`, `HANDOFF_*.md`, `READY_PROMPTS/*`, `IMPLEMENTATION_COVERAGE.md`, `STATUS.md`) são derivados e podem estar desatualizados. Se achar contradição, **alertar o Flávio**, não escolher silenciosamente.

## Tratamento — REGRA DURA

**Sempre "você". NUNCA "tu/te/ti/teu/tua/contigo".** Vale para mensagens no chat, prompts pro Cloud Code, comentários em PR, commits, qualquer texto. Esta regra é §9.2 de `PLANO_FASE_1.md` e o Flávio reforçou em 2026-05-09.

## Decisões já fechadas — NÃO reabrir

- **Não há mais Fase 2** — tudo entra em Fase 1 — `PLANO_FASE_1.md` §1 (decisão Flávio 2026-05-03)
- **Cockpit-display ao vivo migra pra Windows nativo (WinUI 3 + C# .NET 8)** rodando em notebook + **tela 10,5" externa invertida** no painel — **ADR-023 + amendments 4 e 5** (decisões Flávio 2026-05-09 e 2026-05-10). Notebook hospeda o app, tela 10,5" externa é o que o piloto vê (rotação 180° via Windows Display Settings, NÃO no código do app). O `web/cockpit/` em HTML/JS é referência executável + protótipo + spec dos smokes, NÃO produto final.
- **Driver T4000 fica no Windows** (USB CDC-ACM ou CAN, JS sobre Node/Electron) — **ADR-023**, substitui o plano original BLE iOS
- **Transporte iPhone↔Windows = redundante: cabo USB primário (TCP-over-USB via `iproxy`/`usbmuxd`, 5-15 ms) + Supabase Realtime fallback automático.** Notebook escolhe via `TransportSelector` (heartbeat 1 Hz, switch em 3 s, recovery com debounce 1 s). Cabo carrega **dado + carga** (não só carga). — **ADR-023 + amendment 2 de 2026-05-09**
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

## Memória do Claude — DOIS caminhos (sessões locais macOS)

Sempre verificar **os dois**:
- `~/.claude/projects/-Users-imac/memory/` — global (lista pessoal)
- `~/.claude/projects/-Users-imac-Projetos-P1-Fast/memory/` — específica deste projeto

**Em sessão cloud (Claude Code on the web / container Linux):** esses caminhos NÃO existem. Use só docs in-repo (`docs/`, `STATUS.md`, `BLOCKERS.md`) + o handoff mais recente impresso pelo SessionStart hook.

## Automação local (`.claude/`)

- **`.claude/settings.json`** — allowlist read-only (git/npm/swift/dotnet/gh) + hooks
- **`.claude/hooks/session-start.sh`** — imprime branch, status, último handoff, leitura canônica
- **`.claude/hooks/pre-commit-pronoun-check.sh`** — bloqueia `git commit` com mensagem em tu/te/ti/teu/tua/contigo (regra dura acima)
- **`.claude/agents/`** — `shift-light-auditor`, `pr-auditor`, `smoke-runner`, `handoff-writer`, `doc-contradiction-checker`

## Pastas a inventariar antes de propor escopo

- `docs/decision-logs/` — logs estruturados de decisões por papel
- `docs/AUDIT_CHECKLISTS/` — checklist por PR
- `docs/domain/` — design de domínio (matrizes piloto/engenheiro/mecânico)
- `docs/telemetry/` — specs de telemetria

## Meu escopo (do `docs/CONTROL_CENTER.md`)

- **Posso fazer:** auditoria, git ops, Supabase ops, escrita de docs
- **Decisões de arquitetura/escopo:** só Flávio. Eu posso propor; ele decide.
- **Princípio:** nunca perguntar o que é pesquisável. Abrir o doc, ler, aí questionar.
