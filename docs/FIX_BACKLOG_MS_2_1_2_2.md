# Fix backlog — MS-2.1 + MS-2.2

**Origem:** auto-review pré-teste em campo (2026-05-05).
**Estado:** PRs #93 e #95 abertas, ainda não testadas em iPhone real.
**Função:** registro de bugs/risks achados na revisão de código pra Flávio decidir se mergeia com fix antes ou depois.

Cada item tem severidade, arquivo:linha, descrição e correção sugerida. Itens marcados 🔴 valem fixar antes de mergear; 🟡 valem PR de follow-up; 🟢 são polish.

---

## 🔴 ALTA

### FB-01 — `deinit` do `LiveTelemetryRecorder` não para captura

**Arquivo:** `ios/p1fast-ios/Sources/Telemetry/LiveTelemetryRecorder.swift` (não tem deinit).

**Problema:** se a `TelemetriaView` for destruída com captura ativa (ex: usuário troca de view, app é encerrado abruptamente), o recorder some mas:
- `UIApplication.shared.isIdleTimerDisabled` permanece `true` → tela do iPhone fica acesa pra sempre até reboot ou outro caller setar `false`.
- `location.allowsBackgroundLocationUpdates = true` permanece → continua drenando bateria.
- `flushTimer` invalida no GC eventualmente, mas até lá pode disparar com `weak self == nil`.

Em uso real (MS-2.3 amarrando ao stint), se o app crashar durante captura, próxima abertura pode ter wake lock vazado.

**Correção:**
```swift
deinit {
    motion.stopDeviceMotionUpdates()
    location.stopUpdatingLocation()
    flushTimer?.invalidate()
    Task { @MainActor in
        UIApplication.shared.isIdleTimerDisabled = false
    }
    // Buffer in-memory perdido — aceitável em deinit;
    // amostras não-flushed nesse caso são ~100 amostras
    // do último 1s, perda mínima.
}
```

**Risco:** baixo (deinit em @MainActor class é seguro pra essas chamadas).

---

### FB-02 — `ensureSessao` em `TelemetriaView` silencia erros

**Arquivo:** `ios/p1fast-ios/Sources/Views/TelemetriaView.swift:181-184`.

**Problema:**
```swift
} catch {
    recorder.objectWillChange.send()
}
```

Se a inserção da Sessao falhar (ex: time `local-default-team` não existe ainda no boot, FK violation), o erro é engolido. UI mostra "Sessão: telemetria-demo-X" como se tudo OK, mas o primeiro `flush()` vai dar FK violation. Resultado: `lastError` aparece em vermelho com mensagem confusa, sem indicar a raiz.

**Correção:**
```swift
@State private var sessaoErro: String?
// ...
} catch {
    sessaoErro = "Não consegui criar a sessão demo: \(error.localizedDescription)"
}
```
E mostrar `sessaoErro` no header se `!= nil`. Ou bloquear `actionButton` quando `sessaoErro != nil`.

**Risco:** baixo.

---

## 🟡 MÉDIA

### FB-03 — `permissionStatus` mostra "GPS negado" pra `.restricted`

**Arquivo:** `LiveTelemetryRecorder.swift:165-176`.

**Problema:**
```swift
private func startGps() {
    let st = location.authorizationStatus
    permissionStatus = describe(st)  // "GPS — restrito"
    switch st {
    case .notDetermined: ...
    case .authorizedWhenInUse, .authorizedAlways: ...
    default:
        permissionStatus = "GPS negado"  // sobrescreve com "negado"
    }
}
```

Usuário com restrição (controle parental, MDM corporativo) vê "GPS negado" — diagnóstico errado.

**Correção:** remover a linha `permissionStatus = "GPS negado"` no `default:`. O `describe(st)` já cobriu.

**Risco:** zero.

---

### FB-04 — Buffer pode crescer infinitamente em retry loop

**Arquivo:** `LiveTelemetryRecorder.swift:229-256`.

**Problema:** quando `flush()` falha, batch volta pro buffer. Se o erro for permanente (ex: disk full), cada novo flush rouba TODO o buffer e devolve. Próximas captures vão acumulando até OOM.

**Correção:** cap de buffer (ex: 50.000 amostras = 8min de IMU 100Hz). Quando atingir, dropar amostras mais antigas e reportar erro persistente. Ou parar a captura.

```swift
private let bufferCap = 50_000
private func append(_ s: Sample) {
    if buffer.count >= bufferCap {
        lastError = "Buffer cheio — pare e investigue erro de disco."
        // Opcional: stop() automaticamente.
        return
    }
    buffer.append(s)
    // ...
}
```

**Risco:** baixo. Cenário improvável em prática (GRDB local raramente falha).

---

### FB-05 — `running = true` mesmo com permissões negadas

**Arquivo:** `LiveTelemetryRecorder.swift:90-107`.

**Problema:** `start()` seta `running = true` antes de checar permissões. Se ambas (Motion + Location) negadas, UI mostra "● REC X.Xs" com 0 amostras pra sempre. Botão fica em "PARAR" sem ter o que parar.

**Correção:** depois do `startGps() + startImu()`, verificar se ao menos um canal startou. Se nenhum, `running = false` + `lastError = "Permissões negadas — abra Ajustes pra liberar Motion e GPS."`.

**Risco:** baixo (uso real geralmente concede permissão).

---

### FB-06 — `lastStopCount` é contador in-memory, não SQL

**Arquivo:** `TelemetriaView.swift:146`.

**Problema:** `lastStopCount = recorder.sampleCount` mostra quantas amostras foram **appended** ao buffer, não quantas foram **persistidas**. Em retry loop, podem divergir.

**Correção:**
```swift
Task {
    await recorder.stop()
    lastStopCount = (try? TelemetryWriter.sampleCount(queue: queue, sessaoId: sessaoId)) ?? recorder.sampleCount
    // ...
}
```

**Risco:** zero. Trade-off: query custa I/O, mas roda 1 vez por stop.

---

## 🟢 BAIXA / POLISH

### FB-07 — `Clock.nowMono` em ms vs `CACurrentMediaTime()` em segundos

**Arquivo:** `LiveTelemetryRecorder.swift:132, 136, 298, 301`.

`Clock.nowMono` retorna **ms** (multiplica por 1000 internamente). `trackRate` espera **segundos** então divide por 1000 (`tMono / 1000.0`). Funciona, mas confuso pra leitor.

**Correção:** ou `trackRate` aceita ms diretamente, ou expor `Clock.nowMonoSec` que retorna segundos. Polish.

---

### FB-08 — Threading: `Task { @MainActor }` vs `DispatchQueue.main.async`

**Arquivo:** `LiveTelemetryRecorder.swift:134-137, 295-303`.

Baseline `imu-test` usa `DispatchQueue.main.async`. Port usa `Task { @MainActor in ... }`. Equivalente funcionalmente, mas Tasks podem ser batched pelo runtime do Swift Concurrency, agrupando múltiplas IMU samples numa única tick do MainActor.

**Diagnóstico:** se o teste em campo mostrar jitter > 1ms (baseline tinha 0.2ms), pode ser causa.

**Correção (se necessário):** voltar pra `DispatchQueue.main.async` no callback do `startDeviceMotionUpdates`.

**Risco:** observação só. Baseline já tinha 0.2ms; mesmo com 5× overhead (1ms) ainda está dentro do aceitável.

---

### FB-09 — `Timer.publish(every: 0.5)` força rerender da view a cada 500ms

**Arquivo:** `TelemetriaView.swift:52-57`.

Timer dispara rerender mesmo quando não há captura. Pode usar `.onAppear` + `.onDisappear` pra parar quando não estiver capturando.

**Risco:** zero. Polish de bateria/CPU.

---

### FB-10 — `JSONEncoder.outputFormatting = [.sortedKeys]`

**Arquivo:** `TelemetryWriter.swift:35`.

`.sortedKeys` adiciona overhead de ordenação por sample. Útil pra teste determinístico (smoke testa `json.contains(...)` em ordem específica), mas em produção é overhead desnecessário.

**Correção (se quiser):** `[]` em produção, `[.sortedKeys]` só no smoke. Ou aceitar o overhead — é micro (μs por sample).

**Risco:** zero. Aceitável manter como está.

---

### FB-11 — `ensureSessao` chamado 2× (em `.task` e em `toggle`)

**Arquivo:** `TelemetriaView.swift:51, 152`.

Idempotente, mas redundante. Aceitável.

---

## Diff comparativo `imu-test` × `LiveTelemetryRecorder`

Side-by-side dos parâmetros que importam pra fidelidade do sensor:

| Aspecto | imu-test (baseline 100.3 Hz / 0.2 ms) | LiveTelemetryRecorder | Status |
|---|---|---|---|
| `deviceMotionUpdateInterval` | `1.0 / 100.0` | `1.0 / 100.0` | ✅ idêntico |
| `using:` | `.xArbitraryZVertical` | `.xArbitraryZVertical` | ✅ idêntico |
| `opQueue.qualityOfService` | `.userInteractive` | `.userInteractive` | ✅ idêntico |
| `opQueue.maxConcurrentOperationCount` | 1 | 1 | ✅ idêntico |
| `userAcceleration × 9.80665` | sim | sim | ✅ idêntico |
| `desiredAccuracy` | `BestForNavigation` | `BestForNavigation` | ✅ idêntico |
| `distanceFilter` | `None` | `None` | ✅ idêntico |
| `activityType` | `.automotiveNavigation` | `.automotiveNavigation` | ✅ idêntico |
| `pausesLocationUpdatesAutomatically` | `false` | `false` | ✅ idêntico |
| `allowsBackgroundLocationUpdates` | `false` | `false` no init, `true` no start (MS-2.2) | ✅ correto pro escopo |
| Threading IMU callback | `DispatchQueue.main.async` | `Task { @MainActor }` | ⚠️ DIFF-08 — observar |
| Threading GPS delegate | direto no thread do delegate | nonisolated → `Task { @MainActor }` | ⚠️ DIFF-08 — observar |
| `tMono` unidade | segundos (`CACurrentMediaTime`) | ms (`Clock.nowMono`) | ⚠️ FB-07 — convertido OK |
| Janela métricas Hz/jitter | 60 amostras | 60 amostras | ✅ idêntico |
| `gyroAlpha/Beta/Gamma` | (não captura) | sim, em graus de attitude | NEW (esperado, Sample canônico) |
| Persistência | Array<Sample> in-memory | flush batch GRDB | NEW (esperado, MS-2.1) |

**Conclusão do diff:** todos os parâmetros que afetam Hz/jitter da IMU são idênticos ao baseline. Threading mudou mas tem margem (baseline 0.2 ms × algum overhead < 1 ms). Se o teste em campo achar jitter > 1ms, FB-08 vira a primeira hipótese.

---

## Resumo

| ID | Severidade | Arquivo | Resumo |
|---|---|---|---|
| FB-01 | 🔴 alta | LiveTelemetryRecorder | deinit não para captura → wake lock leak |
| FB-02 | 🔴 alta | TelemetriaView | ensureSessao silencia erros |
| FB-03 | 🟡 média | LiveTelemetryRecorder | "GPS negado" sobrescreve "restrito" |
| FB-04 | 🟡 média | LiveTelemetryRecorder | buffer sem cap em retry loop |
| FB-05 | 🟡 média | LiveTelemetryRecorder | running=true com permissões negadas |
| FB-06 | 🟡 média | TelemetriaView | lastStopCount in-memory ≠ SQL |
| FB-07 | 🟢 polish | LiveTelemetryRecorder | unidade tMono ms vs s |
| FB-08 | 🟢 polish/observ | LiveTelemetryRecorder | Task vs DispatchQueue |
| FB-09 | 🟢 polish | TelemetriaView | Timer rerender contínuo |
| FB-10 | 🟢 polish | TelemetryWriter | .sortedKeys overhead |
| FB-11 | 🟢 polish | TelemetriaView | ensureSessao 2× |

## Recomendação

**Antes de mergear #93 + #95**, dois fixes valem (10 min):
- FB-01 (deinit) — risco real de wake lock vazado em produção.
- FB-02 (ensureSessao silencia) — debugging vai ficar muito mais difícil sem isso quando algo falhar no teste em campo.

Os 🟡 ficam pra um PR de hardening pós-merge. Os 🟢 podem nunca ser corrigidos.

**Alternativa:** mergea #93 + #95 como estão, faz teste em campo, e se o teste passar, abre 1 PR de hardening cobrindo FB-01..06.
