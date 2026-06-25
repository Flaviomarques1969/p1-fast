# CONTINUAR — Ligar o dado REAL no cockpit .exe (Windows)

> **Para o Claude da próxima sessão:** leia este arquivo inteiro ANTES de fazer qualquer coisa.
> Ele é autossuficiente. Tratamento: sempre **"você"**, nunca "tu/te" (regra §9.2 do PLANO_FASE_1).
> Data deste handoff: 2026-06-25. Autor: sessão anterior (notebook do Flávio).

---

## 1. Ambiente (notebook Windows do Flávio)

- Repo: `C:\Users\flavi\P1fast` — branch **`sync/notebook-dia-de-pista-2026-06-23`**.
- Shell: PowerShell. `.NET 8 SDK` instalado (`C:\Program Files\dotnet\dotnet.exe`, 8.0.422).
  Windows App Runtime 1.6 instalado (necessário pro WinUI 3 rodar).
- **NÃO há node nem python** (só stubs da Store). Para servir páginas web localmente use
  `_serve_local.ps1` (servidor HttpListener em PowerShell, porta 8765) na raiz do repo.
- **Pegadinhas do Git nesta máquina** (já configuradas, não desfazer):
  - O repo tem uma entrada de caminho INVÁLIDA na raiz: `\n_design-reference` (nome com
    quebra de linha) que o Windows não consegue criar. Por isso:
    `core.protectNTFS=false`, `core.longpaths=true`, e **sparse-checkout** ativo (não-cone).
  - Para adicionar arquivo fora da área esparsa: `git add --sparse <arquivo>`.
  - Identidade git local já setada: Flavio Marques / Flaviomarques@me.com.

### Build e run do cockpit
```
cd C:\Users\flavi\P1fast
& "C:\Program Files\dotnet\dotnet.exe" build "windows\cockpit\P1Fast.Cockpit.UI\P1Fast.Cockpit.UI.csproj" -c Debug -p:Platform=x64
# exe gerado em:
# windows\cockpit\P1Fast.Cockpit.UI\bin\x64\Debug\net8.0-windows10.0.19041.0\P1Fast.Cockpit.UI.exe
# rodar a demo animada:
Start-Process <exe> -ArgumentList "--demo"
```
Para ver a tela: computer-use (`request_access` no nome do processo `P1Fast.Cockpit.UI.exe`,
`open_application "P1fast.cockpit.ui"`, depois `screenshot`).

---

## 2. O que JÁ foi feito (commit 45c4ec42)

A tela nativa `MainWindow.xaml` + `MainWindow.xaml.cs` foi **reescrita** pro layout aprovado
22/06 (porta fiel de `web/cockpit/cockpit-volta-real.html`):
- delta à ESQUERDA (sem sinal +/-, a COR diz bom=verde/ruim=vermelho), resultado da freada
  à DIREITA, luzes de freio verticais nas DUAS laterais, shift light embaixo, cluster de 14
  sensores e barra de stint no topo, ápice (Entrada/Freio/Ápice/Saída) na base.
- LEDs premium: domo 3D + halo que transborda (efeito **wash**) + ignição ao acender.
- Shift light: varredura sequencial das pontas pro centro + pisca vermelho e **wash** ao
  atingir o corte de giro.
- Mensagem do delta sem prefixo de curva ("C1/C2…") — só a mensagem.
- FREADA some quando há mensagem à direita (evita sobreposição).

Tudo isso compila com 0 erros e **só roda no modo `--demo`** (timers sintéticos).

**Commit:** `45c4ec42` na branch `sync/notebook-dia-de-pista-2026-06-23`
(3 arquivos: MainWindow.xaml, MainWindow.xaml.cs, _auditoria-cockpit.html).

### ⚠️ PENDÊNCIA: push
O `git push origin sync/notebook-dia-de-pista-2026-06-23` ficou **travado esperando login
do GitHub** (janela do Git Credential Manager). O commit está LOCAL, ainda **não subiu**.
→ Próxima sessão: peça o Flávio completar o login na janela do GCM, OU rode `git push` de novo
   (mate processos git pendurados antes: `Get-Process git | Stop-Process -Force`). Conta GitHub:
   dono `Flaviomarques1969`.

---

## 3. A AUDITORIA e a DECISÃO do Flávio

Uma comissão de 7 agentes auditou o cockpit. Relatório em **`_auditoria-cockpit.html`** (raiz;
renderiza via JS — abra servindo por `_serve_local.ps1` em `http://localhost:8765/_auditoria-cockpit.html`,
porque o Edge do Flávio às vezes mostra branco em arquivo local).

**Veredito (unânime, severidade alta):** o `.exe` NÃO lê nenhum sensor real. TODOS os
componentes (shift, freio, delta, apex, sensores, stint) só funcionam em `--demo` com dados
sintéticos. O "cérebro" real existe e está testado no Domain, mas a UI **nunca o liga**.

**DECISÃO DO FLÁVIO (2026-06-25): "Ligar o dado real (Aprovar)".**
→ Ou seja: a próxima tarefa é **fiar o pipeline real na interface** (abaixo).

---

## 4. TAREFA: ligar o dado real (o que fazer agora)

> Line numbers abaixo são aproximados (mudaram com as edições). **Procure por nome** (Grep),
> não confie na linha exata.

### Causa-raiz (confirmada no código)
- `App.xaml.cs` → `OnLaunched` só faz `new MainWindow(options)` + `Activate()`. Nunca instancia
  T4000Provider/reader, LiveDataBridge nem CockpitOrchestrator, nunca chama `IniciarFeedReal`.
- `MainWindow.xaml.cs` → `IniciarFeedReal` / `AlimentarMotor` / `AlimentarGps` e o campo
  `_orquestrador` existem mas são **código órfão** (zero chamadores no repo inteiro). Logo
  `_orquestrador` fica null e os Alimentar* são no-op.
- O "cérebro" real vive em `CockpitOrchestrator` (Domain): `IngestMotor` → `LiveDataBridge.RpmToShift`;
  `IngestGps` → TrechoDetector/Ghost; `FecharPassagem` → `DeltaCalculator.Calcular` + grava
  `_estadoTrecho` (exposto por `EstadoDoTrecho(segId)`, que **ninguém consome**).

### Abordagem recomendada — EM 2 ETAPAS

**ETAPA 1 — verificável AGORA, sem hardware (faça primeiro):**
Ligue a UI ao `CockpitOrchestrator` REAL e alimente com um **REPLAY de dado real gravado**,
em vez dos timers de demo. A referência aprovada (`web/cockpit/cockpit-volta-real.html`) já faz
exatamente isso: replay da fixture `web/cockpit/fixtures/volta-real-pista-24-05.json` (GPS real,
712KB) + sessão de motor real pelo MESMO CockpitState. Espelhe isso em C#:
  1. Em `App.OnLaunched` (ou no MainWindow quando NÃO for `--demo`), instancie o orquestrador via
     `MainWindow.IniciarFeedReal(curvas das 8 de Brasília)` e crie um **driver de replay** que lê a
     fixture e bombeia `AlimentarGps`/`AlimentarMotor` no tempo certo (veja `P1Fast.Cockpit.SessaoReplay`
     e `T4000Simulator` — já existem). Considere uma flag `--replay`.
  2. Substitua/condicione os timers de demo (`_demoTimer`, `_brakeTimer`, `_shiftSweepTimer` no
     MainWindow) para NÃO rodarem quando o feed real estiver ligado (já há `_brakeTimer?.Stop()` etc.
     em `IniciarFeedReal`).
  3. **Conecte os componentes que hoje não têm ponte:**
     - **Stint:** leia `CockpitOrchestrator.EstadoDoTrecho(segId)` e pinte os 12 `_stintBlocks`
       (mapear faster→Faster, slower→Slower, reference→Neutral, atual→Current). Idealmente emita via
       um novo campo observável no `CockpitState` (padrão reativo, igual aos outros).
     - **Sensores (cluster 14):** porte `aplicarMotorStatus` de `cockpit-volta-real.html:310-319`
       pro C# (água>110 → warn; alarmes lambda wb/nb → warn; bitfield de alarme do motor → warn).
       Troque a assinatura `ApplySensors(bool falhaMotor)` por estado por-sensor real. Hoje é cosmético.
  4. **Porte o modo TORQUE** pro C# `LiveDataBridge.RpmToShift` (hoje só tem o modo legado por
     %-de-redline). Espelhe `web/cockpit/live-data-bridge.js:69-77` (peakTorqueRpm/torqueLitOffsetRpm,
     FIRE no pico). Adicione `peakTorqueRpm`/`torqueLitOffsetRpm` em `LiveLimits.Bubi`
     (`LiveDataBridge.cs:41-48`). A referência usa peakTorqueRpm:6050, torqueLitOffsetRpm:700,
     redlineRpm:6300, waterTempMaxC:110. SENÃO, mesmo ligado, o shift acende diferente do aprovado.
  5. **Delta:** confirme com o Flávio qual fórmula é a aprovada — `web` usa **diferença de tempo
     total de volta** (cockpit-volta-real.html:442-448, sem sinal, limiar binário d<=0), enquanto o
     C# `DeltaCoach`/`DeltaCalculator` usa **integração ghost por sub-trecho** com banda morta ±0.05s
     e mantém o sinal. PADRONIZE (sinal já foi removido na UI; falta alinhar fórmula e limiar de cor).
  6. **Luz de freio:** porte o cálculo real de ponto de freada de `cockpit-volta-real.html:343`
     (`atualizarFreio`: v do GPS, distância ao ápice, ponto ideal da melhor passagem, antecipação
     FREIO_LEAD, detecção de início de freada pelo pico de velocidade). Hoje é só sweep 0→9.

**ETAPA 2 — no dia de pista, com hardware:**
Troque o driver de replay pela captura ao vivo: `T4000SerialReader`/`T4000Provider` (USB CDC-ACM
real) + transporte de GPS (iPhone↔Windows, ADR-023). Os consoles `P1Fast.Cockpit.T4000Capture` e
`T4000LiveDemo` já têm a leitura USB (mas sem UI) — reaproveite. Mantenha `--demo` só como vitrine.

### Arquivos-chave para ler primeiro
- `windows/cockpit/P1Fast.Cockpit.UI/App.xaml.cs` (LaunchOptions, OnLaunched)
- `windows/cockpit/P1Fast.Cockpit.UI/MainWindow.xaml.cs` (IniciarFeedReal/AlimentarMotor/AlimentarGps,
  os timers de demo, ApplyShift/ApplyBrake/ApplyApex/ApplySensors/ApplyStintPattern)
- `windows/cockpit/P1Fast.Cockpit.Domain/CockpitOrchestrator.cs` (IngestMotor/IngestGps/FecharPassagem/EstadoDoTrecho)
- `windows/cockpit/P1Fast.Cockpit.Domain/LiveDataBridge.cs` (RpmToShift, LiveLimits.Bubi)
- `windows/cockpit/P1Fast.Cockpit.Domain/` (DeltaCalculator/DeltaCoach, T4000Simulator, T4000Provider, TrechoDetector, Ghost)
- `windows/cockpit/P1Fast.Cockpit.SessaoReplay/` (replay)
- Referência de comportamento (gabarito): `web/cockpit/cockpit-volta-real.html`,
  `web/cockpit/cockpit-state.js`, `web/cockpit/cockpit-renderer.js`, `web/cockpit/live-data-bridge.js`
- Fixtures: `web/cockpit/fixtures/volta-real-pista-24-05.json`,
  `_design-reference/BARRAS-BRASILIA-FLAVIO-APROVADO-2026-05-27.json`

### Como verificar
- Buildar (0 erros) e rodar com a nova flag (ex.: `--replay`); a tela deve animar com a VOLTA REAL
  gravada, e os valores (delta, apex, shift por RPM, freio, sensores, stint) devem bater com o que
  `cockpit-volta-real.html` mostra no mesmo instante (use `?pose=SEGUNDOS` no web pra congelar e comparar).
- Rodar os testes do Domain: `dotnet test windows\cockpit\P1Fast.Cockpit.Domain.Tests` (estavam 261/262;
  1 falha conhecida: `PAN_04_dados_da_central_aparecem_quando_ha_sample`).

---

## 5. Regras do projeto a respeitar
- Decisões de arquitetura/escopo são do Flávio — você PROPÕE, ele decide.
- `docs/PLANO_FASE_1.md` vence outros docs. ADR-023 = cockpit migra pra Windows nativo (WinUI3/.NET8).
- Worktree mandatório pra Cloud Code (ADR-021). `Package.resolved` é tracked (ADR-022).
- O **command box** (painel de TV) é OUTRO produto, FORA do escopo do notebook.

---

## 6. Estado das pendências (resumo rápido)
- [ ] **Push do commit 45c4ec42** (travado em login GitHub).
- [ ] **Ligar dado real** — Etapa 1 (replay pela pipeline real) → depois Etapa 2 (USB/GPS ao vivo).
- [ ] Confirmar com o Flávio a fórmula de Delta aprovada (web vs C#).
- [ ] (Opcional) teste `PAN_04` falhando.
