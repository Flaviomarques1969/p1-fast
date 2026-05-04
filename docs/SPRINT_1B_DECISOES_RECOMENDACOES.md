# Sprint 1B — Recomendações pras 5 decisões abertas

> Doc preparado autonomamente em 2026-05-03. Quando Phase 1A fechar
> (#24 mergear), Flávio destrava 1B aprovando/rejeitando cada decisão
> abaixo. Cada uma vem com prós, contras, recomendação default e
> impacto se for adiada.
>
> Spec original em `SPRINT_1B_COCKPIT_DESIGN.md` linhas 151-176.

---

## Decisão #1 — Modal landscape forçado vs respeitar orientação

**Pergunta:** Cockpit força landscape via `supportedInterfaceOrientations` override só na CockpitView, ou respeita o rotation lock global do iOS?

### Forçar landscape (recomendado)
- **Prós**
  - Mockup é fixo 956×440 — portrait quebra layout
  - Piloto monta o iPhone no berço sempre em landscape — esse é o uso real
  - UX simpler: sem decisão pro usuário
- **Contras**
  - Quebra o esperado iOS (apps respeitam rotation lock)
  - Se piloto reabre o app fora do carro pra olhar resultado, cockpit vai abrir torto
  - Apple Review pode reclamar (raro, mas conhecido)

### Respeitar orientação
- **Prós**
  - Comportamento iOS-native esperado
  - Funciona em qualquer postura do device
- **Contras**
  - Se o piloto esquecer o rotation lock OFF, cockpit em portrait fica inutilizável
  - Layout tem que se adaptar ou colapsar — trabalho extra que mockup não cobre

### 🎯 Recomendação default: **Forçar landscape**

Implementação: `UIViewController` extension `supportedInterfaceOrientations = .landscape` apenas para `CockpitPilotoView`/`CockpitGhostView`/`CockpitComparacaoView`. Resto do app continua respeitando rotation lock.

**Impacto se adiar:** baixo — pode trocar depois sem refactor. Mas atrasa o primeiro screenshot real do cockpit.

---

## Decisão #2 — Detector ao vivo vs replay

**Pergunta:** O detector (`src/telemetry/detector.js`) hoje roda em batch (após sessão). Cockpit precisa de versão streaming. Como portar?

### Port nativo Swift streaming-first (recomendado)
- **Prós**
  - Performance previsível, sem ponte JS↔Swift
  - Tipos garantidos em compile-time (Swift → SwiftUI direto)
  - Já temos parte portada (P1Coach, TrajectoryMonitor)
  - Streaming-first é o caso real (batch vira "rodar streaming até o fim")
- **Contras**
  - Esforço de manter 2 versões (JS legacy + Swift) até retirar o JS
  - Risco de divergência subtil entre as 2 implementações

### Reutilizar JS via JavaScriptCore
- **Prós**
  - Zero divergência (1 fonte de verdade)
  - Mudanças no detector valem pros 2 lados imediatamente
- **Contras**
  - Latência JS↔Swift por sample — pode somar @ 10Hz em sessão de 30min
  - Memory leak risk com JSContext mal gerenciado
  - Debug Swift do JS é doloroso
  - ADR-018 já encostou nessa decisão e recuou

### 🎯 Recomendação default: **Port nativo Swift streaming-first**

Acompanha decisão #3 (que reforça port nativo). JS legacy fica intacto pra testes batch e regressão. Detector novo em `p1fast-core/Cockpit/LapDetector.swift` recebe samples via `AsyncStream<Sample>` e emite `AsyncStream<DetectorEvent>`.

**Impacto se adiar:** alto — bloqueia 1B-3 (detector) que bloqueia 1B-4/5/6/7/8 inteiro. Precisa decidir cedo.

---

## Decisão #3 — Pipeline JS reutilizado via JavaScriptCore?

**Pergunta:** ADR-018 deixou aberta. Cockpit pode rodar parte do pipeline JS via JavaScriptCore, ou tudo em Swift?

### Tudo em Swift (recomendado)
- **Prós**
  - Coerente com decisão #2
  - Zero ponte JS↔Swift = previsibilidade de performance e debug
  - Long-term: P1FastCore vira a fonte de verdade pra mobile, JS legacy congela como referência
- **Contras**
  - Precisa portar mais código (parte feita: P1Coach, TrajectoryMonitor)
  - Custo de manter parity entre JS reference e Swift implementation

### Embarcar JS via JavaScriptCore
- **Prós**
  - Reaproveita 100% do código JS
  - Decisões de pipeline em 1 lugar só
- **Contras**
  - Performance imprevisível em pista
  - Stack trace ruim, debug ruim
  - Memory shape complexo (JSContext entre threads)

### 🎯 Recomendação default: **Tudo em Swift**

Mesma direção da #2. Acelera primeiros frames do cockpit funcional. JS continua em `src/` como referência de algoritmo (validação cruzada via smoke tests que rodam o JS contra fixtures e comparam com output Swift).

**Impacto se adiar:** alto — entrelaçada com #2. Decidir junto.

---

## Decisão #4 — Buffer de samples antes de render?

**Pergunta:** A 10Hz, cada sample disparar re-render do SwiftUI = pressure alto. Buffer N=5 reduz, com custo de 500ms latência no delta.

### Buffer N=5 (500ms) — moderado, recomendado
- **Prós**
  - Reduz pressure do SwiftUI runtime → menos jank
  - Permite agregação leve antes de publicar (ex: smooth do delta)
  - 500ms ainda é dentro do "tempo de reação humana" (~250ms reflexo + ~250ms ação)
- **Contras**
  - Delta mostra dados de 500ms atrás → piloto reage tarde em curva rápida
  - Pode mascarar spikes interessantes em volta de qualificação

### Sem buffer (10Hz raw)
- **Prós**
  - Latência mínima, dado mais "vivo"
  - Spikes aparecem na hora
- **Contras**
  - SwiftUI re-render @ 10Hz = pressure alto, possível jank em iPhone mais antigo
  - Ruído visual: delta oscila a cada 100ms

### Buffer adaptativo (smart)
- **Prós**
  - Buffer N=5 em situação normal, N=1 em momentos críticos (curva, freio)
- **Contras**
  - Complexidade extra
  - Condição de "momento crítico" precisa ser detectada

### 🎯 Recomendação default: **Buffer N=5 fixo (500ms)**

Smart buffer é optimization prematura. Começar com N=5; medir jank em iPhone 13 Pro Max físico em pista. Se piloto reclamar de latência, baixa pra N=3 (300ms). Se jank, sobe pra N=10. Tornar `cockpitBufferSize` config flag em `Configuration.swift` pra tunar sem rebuild.

**Impacto se adiar:** baixo — pode mudar sem refactor. Decidir antes de #5 (CockpitPilotoView).

---

## Decisão #5 — Modo offline puro?

**Pergunta:** Cockpit precisa de internet? GPS funciona offline; voltas de referência (PB, ghosts) podem estar 100% locais.

### Offline puro (recomendado)
- **Prós**
  - Pista sem 4G/wifi → app funciona igual
  - Zero bateria gasta com rádio
  - Sem dependência de Edge Functions/Supabase em runtime crítico
  - Sync acontece antes (pull) e depois (drainer + uploader) — nunca durante stint
- **Contras**
  - Ghost de outro piloto da mesma sessão precisa de sync prévia
  - Atualização de PB do dia em tempo real (pra outros pilotos verem) não rola

### Online opcional
- **Prós**
  - Ghost ao vivo de outros pilotos no time (caso multi-piloto futuro)
  - Mensagens box→piloto em tempo real
- **Contras**
  - Latência de rede no caminho crítico de render
  - Bateria, falhas de rede, lock/unlock do GPS quando troca de torre

### 🎯 Recomendação default: **Offline puro**

Box→piloto e multi-piloto ao vivo entram em Sprint 2+, NÃO em 1B. Cockpit 1B = solo offline, dados de referência todos pré-carregados via pull antes do stint.

**Impacto se adiar:** médio — afeta arquitetura (camada de network ou não no caminho de render). Decidir antes de #4 (CockpitState).

---

## Resumo executivo

| # | Decisão | Recomendação | Bloqueio |
|---|---|---|---|
| 1 | Landscape forçado? | **SIM** (override só no cockpit) | Baixo, pode adiar |
| 2 | Detector ao vivo? | **Port nativo Swift streaming-first** | Alto, decidir cedo |
| 3 | JavaScriptCore? | **Não, tudo em Swift** (acompanha #2) | Alto, decidir junto com #2 |
| 4 | Buffer de samples? | **N=5 fixo** (config flag) | Baixo, ajusta depois |
| 5 | Offline puro? | **SIM** (sync antes/depois) | Médio, define arquitetura |

**5 ✅ → posso bakear os 8 prompts do Sprint 1B (1B-1 a 1B-8) em modo autônomo igual à Phase 1A.**

Quando você quiser revisar, lê este doc + `SPRINT_1B_COCKPIT_DESIGN.md`. Pra cada decisão me diga: **"#1 sim"**, **"#2 outro: <descrição>"**, **"#3 ok"**, etc. — daí bakeio.
