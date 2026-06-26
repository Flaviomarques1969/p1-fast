# P1 Fast — orientação para Claude

## ⚡ Comando rápido do Flávio: "notebook p1 fast"

Quando o Flávio disser **"notebook p1 fast"** (ou variações: "publica o notebook", "roda o notebook p1 fast", "faz o que o notebook deixou pendente"), **execute o runbook `.claude-exec/RUNBOOK-NOTEBOOK-P1-FAST.md`** — ele é autossuficiente, diz o que já está pronto no git (vindo do notebook Windows) e qual o trabalho pendente que só o iMac faz (hoje: **publicar o site `p1tv` no Vercel**). Faça o pendente, verifique, e reporte. Mantenha o runbook + `.claude-exec/PLANO-MIGRACAO-PRODUCAO.md` atualizados ao concluir. Produção continua protegida: só o que o runbook autoriza.

## Antes de fazer qualquer coisa, leia nesta ordem

0. **`docs/COCKPIT_FONTE_DA_VERDADE.md`** — quando o trabalho for do **cockpit do piloto**, esta é a PRIMEIRA leitura: requisitos + estado real + decisões duras + estratégia (web primeiro, Windows por último). Fixada por Flávio em 2026-06-22 pra parar de perder requisitos entre sessões.
1. **`docs/ARQUITETURA_DEFINITIVA.md`** — arquitetura canônica (Flávio 2026-06-16). Vence as demais.
2. **`STATUS.md`** (raiz) — onde o projeto está agora
3. **`docs/PLANO_FASE_1.md`** — DOC MESTRE, aprovado pelo Flávio 2026-05-03. Vence todos os outros. (O antigo `PLANO_FASE_1A_1B.md` foi arquivado em `docs/_archive/`.)
4. **`ARCHITECTURE_DECISIONS.md`** (raiz) — 22 ADRs vigentes, não reabrir sem ordem

## Em caso de contradição entre docs

`docs/ARQUITETURA_DEFINITIVA.md` vence em arquitetura do sistema (Flávio 2026-06-16). Depois, `PLANO_FASE_1.md` vence no resto. Sub-docs (`SPRINT_*.md`, `HANDOFF_*.md`, `READY_PROMPTS/*`, `IMPLEMENTATION_COVERAGE.md`, `STATUS.md`) são derivados e podem estar desatualizados. Se achar contradição, **alertar o Flávio**, não escolher silenciosamente.

## Tratamento — REGRA DURA

**Sempre "você". NUNCA "tu/te/ti/teu/tua/contigo".** Vale para mensagens no chat, prompts pro Cloud Code, comentários em PR, commits, qualquer texto. Esta regra é §9.2 de `PLANO_FASE_1.md` e o Flávio reforçou em 2026-05-09.

## Decisões já fechadas — NÃO reabrir

- **★ ARQUITETURA DO DADO — UMA entrada, UM cérebro, todos consomem (Flávio 2026-06-23, regra dura):** o dado parte de um lugar só (canal `cockpit-bubi-live` pela ponte única `web/cockpit/cloud-bridge.js`), é processado num lugar só (o cérebro — `web/command-box/cerebro/*` e os módulos de conta), e as telas **só EXIBEM** o pacote pronto. **Proibido**: tela abrir conexão própria (`createClient`), tela refazer uma conta que já tem casa, tela usar dado fictício (`preview-local`, `FAKE_LAPS`). Registro único em **`docs/CONTRATO_DADOS.md`**. Garantia mecânica: **`npm run smoke:arquitetura`** (também dentro de `npm run smoke`) reprova quem furar — catraca que só aperta. Antes de tocar qualquer tela de dado: ler `docs/CONTRATO_DADOS.md`, achar a casa da conta, e rodar a trava. NÃO propor "processar no navegador" (a nuvem processa — `docs/ARQUITETURA_DEFINITIVA.md`).
- **★ PAINEL DO PILOTO — VERSÃO APROVADA 2026-06-22:** `web/cockpit/cockpit-volta-real.html` (backup congelado em `_design-reference/versions/cockpit-painel-APROVADO-2026-06-22.html`). É o visual/comportamento oficial do painel, para **dois usos**: (1) app P1 Fast no celular **na horizontal** (em "usuário", girou o celular → abre esta tela); (2) **cockpit do piloto** na tela 10,5" do notebook. Detalhe de cada decisão na memória do projeto `p1-fast-cockpit-volta-real-painel-2026-06-22.md` e em `docs/COCKPIT_FONTE_DA_VERDADE.md`. **NÃO refazer do zero nem perder essas decisões;** mudanças só somam por cima. O replay 8× e as teclas de teste C/U são andaime — na porta entram dados reais.
- **Não há mais Fase 2** — tudo entra em Fase 1 — `PLANO_FASE_1.md` §1 (decisão Flávio 2026-05-03)
- **Cockpit-display ao vivo migra pra Windows nativo (WinUI 3 + C# .NET 8)** rodando em notebook + **tela 10,5" externa invertida** no painel — **ADR-023 + amendments 4 e 5** (decisões Flávio 2026-05-09 e 2026-05-10). Notebook hospeda o app, tela 10,5" externa é o que o piloto vê (rotação 180° via Windows Display Settings, NÃO no código do app). O `web/cockpit/` em HTML/JS é referência executável + protótipo + spec dos smokes, NÃO produto final.
- **Driver T4000 fica no Windows** (USB CDC-ACM ou CAN, JS sobre Node/Electron) — **ADR-023**, substitui o plano original BLE iOS
- **Transporte iPhone↔Windows = redundante: cabo USB primário (TCP-over-USB via `iproxy`/`usbmuxd`, 5-15 ms) + Supabase Realtime fallback automático.** Notebook escolhe via `TransportSelector` (heartbeat 1 Hz, switch em 3 s, recovery com debounce 1 s). Cabo carrega **dado + carga** (não só carga). — **ADR-023 + amendment 2 de 2026-05-09**
- **Captura iOS Swift nativa preservada** (CoreMotion + CoreLocation + Daily.co), hub iOS preservado — ADR-018 com amendment 2026-05-09
- **Plataforma do hub e captura:** iOS Swift nativo, iPhone único. Sem CarPlay, Apple Watch, Android, PWA — ADR-018
- **Vídeo ao vivo:** Daily.co (câmera onboard frontal do iPhone) — `PLANO_FASE_1.md` §2
- **Box cockpit:** TV 32" via Fire TV Stick 4K Max rodando o navegador, que abre o app na nuvem. Sem Apple TV, sem AirPlay, sem espelhamento pelo celular. Processamento em dois lugares: notebook Windows (.exe) pro cockpit do piloto + app na nuvem pras demais funções. (atualizado 2026-06-16 — ver `docs/ARQUITETURA_DEFINITIVA.md`)
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
