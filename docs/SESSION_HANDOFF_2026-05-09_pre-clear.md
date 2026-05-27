<!-- TODO [CLAUDE 2026-05-26 noite] obsoleto — confirmar com Flávio -->
# SESSION HANDOFF — 2026-05-09 (pre-/clear)

> **Pra quem está lendo isto na próxima sessão:** o Flávio pediu um `/clear` no meio do port C#/WinUI 3. Este doc te dá o ponto exato pra retomar sem repetir o que já foi feito.
>
> **Leia primeiro nesta ordem:** `STATUS.md` → `ARCHITECTURE_DECISIONS.md` (ADR-023 + 4 amendments) → `docs/PLANO_FASE_1.md` § 6 (mini-sprints MS-9 e MS-13 reescritos) → este HANDOFF.

## O que foi decidido nesta sessão

1. **ADR-023 nova:** cockpit-display ao vivo migra de SwiftUI iPhone pra notebook Windows 10,5". iPhone preserva captura IMU/GPS + câmera + uploader. Box Cockpit inalterado.
2. **ADR-023 amendment 2:** transporte iPhone↔Windows é redundante — cabo USB primário (TCP-over-USB via `iproxy`/`usbmuxd`, latência 5-15 ms) + Supabase Realtime fallback automático. `TransportSelector` com heartbeat 1 Hz, switch em 3 s, recovery debounce 1 s.
3. **ADR-023 amendment 3:** produto final do cockpit Windows e do hub iPhone é **NATIVO** (não web/PWA). `web/cockpit/` é referência executável + protótipo de validação + spec dos checks. Será portado pro nativo Windows.
4. **ADR-023 amendment 4:** stack Windows nativa = **WinUI 3 + C# (.NET 8)**. Decisão final do Flávio depois de comparar WinUI 3 vs WPF vs Qt 6 vs Avalonia.
5. **Mockup canônico congelado byte-for-byte** (regra dura Flávio 2026-05-09): DOM, classes, tokens OKlch, 8 keyframes, blend modes, perspective 3D, blur, etc. — nada redesenha. Port C# tem que reproduzir o mesmo visual.

## O que está entregue na PR #148 (branch `claude/develop-pilot-cockpit-ZxMLY`)

**Docs:**
- `ARCHITECTURE_DECISIONS.md` — ADR-023 + amendments 2, 3, 4
- `docs/PLANO_FASE_1.md` — §2 stack table (WinUI 3 + C# como produto final), §6 (MS-2.8 dual-publish + MS-9 reescrito + MS-13 reescrito), §10 decisões
- `STATUS.md` — sessão 2026-05-09 documentada
- `CLAUDE.md` — decisões fechadas atualizadas

**Lógica JS funcional (134 smokes verdes — viram spec dos checks C#):**
- `src/telemetry/t4000-packet-parser.js` (27 smokes) — parser CAN canônico, fixture do PDF (`0x91`)
- `src/telemetry/t4000-provider.js` (subset dos 27) — adapter standalone
- `web/cockpit/cockpit-state.js` (24 smokes) — modelo puro do estado do cockpit
- `web/cockpit/transport.js` (17 smokes) — TransportSelector cabo+Realtime com failover
- `web/cockpit/live-data-bridge.js` (26 smokes) — T4000 → CockpitState (RPM→shift, alertas críticos)
- `web/cockpit/cockpit-renderer.js` (17 smokes) — observer DOM (este NÃO é portado pra C#; XAML faz o equivalente)
- `web/cockpit/main.js` + `web/cockpit/index-live.html` (7 smokes) — bootstrap protótipo

**Estrutura WinUI 3 (esqueleto criado, port em andamento):**
- `windows/cockpit/README.md` — explicação em linguagem de negócios
- `windows/cockpit/P1Fast.Cockpit.sln` — solution file
- `windows/cockpit/P1Fast.Cockpit.Domain/P1Fast.Cockpit.Domain.csproj` — projeto domain (.NET 8 puro)
- `windows/cockpit/P1Fast.Cockpit.Domain/Enums.cs` — TrechoStatus, ShiftMode, ShiftFire, MsgState, MsgTipo, Tone, ApexEstado + extension methods de mapeamento string ↔ enum (espelha vocabulário do mockup)

## O que parou no meio (próximo passo exato)

**Estávamos no port do `CockpitState` JS → C#.** `Enums.cs` está commitado. Falta:

1. **`P1Fast.Cockpit.Domain/CockpitStateModel.cs`** — records imutáveis (CockpitStateModel, ShiftState, Message, DeltaInfo, AcaoInfo, ApexState, ApexPonto). Use `record` C# 12 com init-only + `with` expressions.
2. **`P1Fast.Cockpit.Domain/CockpitState.cs`** — classe ativa com event-based observer. Métodos: `Get()`, `OnChange(...)`, `SetTrechoStatus`, `SetShift`, `ApplyShift`, `ShowMessage`, `HideMessage`, `SetDelta`, `SetAcao`, `SetApexPonto`, `ApplyHaloPreset`. Constantes: `SHIFT_LEVEL_MIN=0`, `SHIFT_LEVEL_MAX=6`, `SHIFT_DOTS_TOTAL=12`. Helper estático: `ShiftDotsForLevel(int)`, `ClassifyFreio(double atual, double ref, double tol = 0.10)`.
3. **`P1Fast.Cockpit.Domain.Tests/P1Fast.Cockpit.Domain.Tests.csproj`** — projeto xUnit com refs ao Domain.
4. **`P1Fast.Cockpit.Domain.Tests/CockpitStateTests.cs`** — 24 facts xUnit equivalentes 1:1 aos 24 smokes em `tests/node-smoke-cockpit-state.mjs` (CST-01..CST-24). Cada smoke JS é um Fact xUnit com mesmo nome (CST_01_..., CST_02_...).

Use `web/cockpit/cockpit-state.js` (368 linhas) como referência de comportamento, e `tests/node-smoke-cockpit-state.mjs` (~245 linhas) como referência de testes. Cada Fact xUnit deve passar com a mesma assertion lógica do smoke JS correspondente.

## Sequência completa do port (depois de fechar CockpitState)

| # | Módulo C# | Equivalente JS | Smokes | Pasta |
|---|---|---|---|---|
| 1 | CockpitState + records | `web/cockpit/cockpit-state.js` | 24 | Domain |
| 2 | T4000PacketParser | `src/telemetry/t4000-packet-parser.js` | 23 | Domain |
| 3 | T4000Provider | `src/telemetry/t4000-provider.js` | 4 | Domain |
| 4 | TransportSelector + ITransport + MockTransport | `web/cockpit/transport.js` | 17 | Domain |
| 5 | LiveDataBridge + helpers (RpmToShift, CheckCriticalAlerts) | `web/cockpit/live-data-bridge.js` | 26 | Domain |
| 6 | **CI workflow** `.github/workflows/windows-cockpit.yml` | n/a | n/a | repo root |

Roda CI no `ubuntu-latest` runner (Domain é multi-OS, usa só .NET 8 puro). Quando UI WinUI 3 entrar (próxima fase), aí sim precisa `windows-latest`.

## Restrições importantes pra próxima sessão

- **REGRA DURA:** mockup canônico (`_design-reference/mockup-cockpit-piloto.html`) é congelado byte-for-byte. Não mexer. (Flávio reforçou múltiplas vezes nesta sessão.)
- **Linguagem com Flávio:** SEMPRE negócios e funções, NUNCA termos de dev. Ele não é técnico. Trate como CEO que delega tudo de tech pra você.
- **Tratamento:** sempre "você", NUNCA "tu/te/teu/tua/contigo" (§9.2 PLANO_FASE_1).
- **Você (Claude) é o único dev.** Flávio não compila, não roda testes, não abre IDE. Você tem que automatizar tudo via GitHub Actions e gerar `.msix` empacotado quando chegar a hora.
- **Sandbox não tem .NET / Visual Studio / Windows.** Você escreve código C#, mas só GitHub Actions roda os testes. Não vai conseguir rodar `dotnet build` localmente.

## Pendências externas (aguardando Flávio)

- **MS-9.1:** Flávio mencionou que ia fazer captura real do barramento T4000 hoje. Quando entregar o log binário/CSV, fechar as 3 dúvidas residuais do `docs/hardware/T4000_CAN_SPEC.md` (diferenciação dos 5 pacotes, bytes 2-6 do pacote 5, range max EGT) e melhorar o parser.
- **Base de 3 voltas:** mencionada por Flávio mas o path enviado (`/Users/imac/.../strange-rhodes-db9740/.claude/worktrees/exciting-ardinghelli-572eec/`) é local da worktree dele. Não está em branch remoto. Aguardando push ou outro caminho de entrega.

## Como retomar nesta ordem

1. Ler este HANDOFF + `STATUS.md` + `ARCHITECTURE_DECISIONS.md` (ADR-023 inteiro).
2. Continuar do "próximo passo exato" acima — começar pelo `CockpitStateModel.cs` records.
3. NÃO recapitular decisões já fechadas com Flávio (estão todas nos docs). Pular direto pra execução.
4. Reportar progresso a Flávio em linguagem de negócios a cada módulo concluído + check verde.
