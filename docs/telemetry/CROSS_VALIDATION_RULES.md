# CROSS_VALIDATION_RULES — Validações cruzadas obrigatórias

Catálogo de comparações redundantes entre canais. Quando dois canais podem se validar fisicamente, o `CrossValidationEngine` (a implementar) compara e marca divergências como `SUSPECT`.

Princípio: divergência gera **hipótese**, não certeza. Mensagens correspondentes ao box explicam o que foi observado, não decretam conclusão.

## Catálogo

### V-001 · Velocidade CAN vs Velocidade GNSS

**Canais:** `vehicle.speed_can` (T4000) vs `vehicle.speed_gnss` (RaceBox)

**Regra:** divergência > 5 km/h por > 2s consecutivos com ambos `OK`.

**Hipótese:** sensor de velocidade da T4000 calibrado errado, pneu de circunferência diferente do esperado, perda momentânea de tração (slip), ou erro de GNSS (multipath, reflexão).

**Mensagem box:** "Velocidade CAN diverge da GNSS em X km/h por Y voltas. Verificar calibração de pneu / sensor de roda."

**Ação:** marcar ambos `SUSPECT`, alimentar diagnóstico mecânico.

### V-002 · Aceleração longitudinal vs derivada da velocidade

**Canais:** `dynamics.accel_longitudinal` (RaceBox IMU) vs `derivada(speed_fused)` (calculado)

**Regra:** divergência > 2 m/s² persistente por > 1s.

**Hipótese:** drift de IMU, calibração ruim, vibração mecânica anômala (zebra, buraco, batida).

**Mensagem box:** se vibração: "Possível impacto em [trecho]". Se drift: "IMU possivelmente descalibrado."

**Ação:** marcar `dynamics.accel_longitudinal` como `SUSPECT` na janela.

### V-003 · TPS vs MAP vs Aceleração

**Canais:** `engine.tps`, `engine.map`, `dynamics.accel_longitudinal`

**Regra:** TPS > 80% e MAP < 0.6 bar (NA) ou < 1.0 bar (turbo) e accel_long < 1 m/s² por > 0.5s.

**Hipótese:** perda de tração, perda de combustível, falha de bicos, restrição admissão, problema de sensor MAP, marcha errada.

**Mensagem box:** "TPS alto sem ganho de aceleração ou MAP. Verificar tração, combustível, admissão ou sensor."

**Ação:** marcar grupo como `SUSPECT`, registrar evento.

### V-004 · RPM vs Marcha vs Velocidade

**Canais:** `engine.rpm`, `engine.gear`, `vehicle.speed_fused`

**Regra:** relação RPM × marcha × velocidade fora da janela esperada (depende de relação de transmissão do carro). Para Celta 1.4 (relações de exemplo, calibrar):

- 1ª: ~10 km/h por 1000 rpm
- 2ª: ~20 km/h por 1000 rpm
- 3ª: ~28 km/h por 1000 rpm
- 4ª: ~35 km/h por 1000 rpm
- 5ª: ~42 km/h por 1000 rpm

Divergência > 15% sustentada por > 1s.

**Hipótese:** patinação de embreagem, marcha incorreta da T4000 (sensor falho), patinação de rodas (slip), troca de marcha em curso (transitório aceitável).

**Mensagem box:** "Relação RPM × velocidade × marcha fora do esperado. Verificar embreagem, slip ou sensor de marcha."

**Ação:** marcar `engine.gear` como `SUSPECT`.

### V-005 · Temperatura água vs tempo de pista

**Canais:** `engine.water_temp` em janela móvel + duração do stint

**Regra:** tendência de subida > 0.5°C por minuto sustentada após primeiros 5 min.

**Hipótese:** falha de arrefecimento, ventoinha desligada, vazamento, radiador sujo.

**Mensagem box:** "Temperatura da água subindo continuamente. Verificar arrefecimento."

**Ação:** ATENÇÃO no Box. Se passar limiar absoluto → CRÍTICO ou BOX AGORA.

### V-006 · Pressão óleo vs RPM

**Canais:** `engine.oil_pressure`, `engine.rpm`, `engine.oil_temp`

**Regra:** pressão óleo abaixo de janela esperada para o RPM atual + temp óleo.

**Hipótese:** baixo nível, bomba falhando, óleo diluído (combustível), filtro entupido.

**Mensagem box:** "Pressão de óleo baixa para RPM atual e temperatura. Risco mecânico."

**Ação:** ATENÇÃO. Se passar limiar inferior absoluto → BOX AGORA (regra determinística no `ALERT_HIERARCHY.md`).

### V-007 · Lambda vs TPS vs MAP vs RPM

**Canais:** `engine.lambda`, `engine.tps`, `engine.map`, `engine.rpm`

**Regra:** sob alta carga (TPS > 70% + MAP > 0.8 + RPM > 4000), λ > 1.0 (pobre) por > 1s.

**Hipótese:** mapa de combustível inadequado, pressão de combustível caindo, bicos sujos, restrição de admissão, sensor λ velho.

**Mensagem box:** "Mistura pobre sob carga. Verificar mapa, pressão e bicos."

**Ação:** ATENÇÃO. Se persistir > 5s consecutivos → CRÍTICO (risco de detonação).

### V-008 · Tensão bateria vs comportamento ECU

**Canais:** `engine.battery_voltage`, `engine.ecu_error`

**Regra:** tensão < 11.5V com motor em RPM > 2000 (alternador deveria estar carregando).

**Hipótese:** alternador falhando, correia, terminal solto.

**Mensagem box:** "Tensão de bateria baixa com motor acelerando. Verificar alternador."

**Ação:** ATENÇÃO. < 10.5V → CRÍTICO.

### V-009 · Velocidade saída de curva vs aceleração na reta seguinte

**Canais:** análise derivada a partir de `vehicle.speed_fused` + segment de curva + segment de reta seguinte (`Detector` + `CornerAnalysis`)

**Regra:** se velocidade saída < referência E aceleração na reta seguinte < esperado por marcha + RPM → confirma "saída comprometida".

**Hipótese:** apex tardio mas retomada atrasada, problema de tração, marcha errada.

**Mensagem box:** "Saída comprometida em [curva] confirmada por baixa aceleração na reta seguinte."

**Ação:** alimentar `error-classifier` com `apex-sacrificou-saida` ou `matou-saida`.

### V-010 · Yaw rate vs trajetória vs aceleração lateral

**Canais:** `dynamics.yaw_rate`, derivada da `position`, `dynamics.accel_lateral`

**Regra:** yaw rate alto com baixa aceleração lateral (carro girando sem aderência) ou aceleração lateral alta com yaw rate baixo (subesterço inferido).

**Hipótese:** subesterço, sobresterço, perda de aderência, contra-volante.

**Mensagem box:** "Possível subesterço inferido em [trecho]" ou "Possível sobresterço inferido".

**Ação:** alimentar análise de pilotagem, marcar como inferência (não fato).

### V-011 · Aceleração lateral vs raio de trajetória

**Canais:** `dynamics.accel_lateral`, raio derivado da trajetória GNSS

**Regra:** `accel_lateral` consistente com `v² / r` (física: força centrípeta).

**Divergência:** sensor descalibrado ou trajetória mal-medida.

**Mensagem box:** "IMU lateral diverge da trajetória — verificar calibração."

**Ação:** marcar canal como `SUSPECT`.

## Regras gerais

### Regra A — Divergência ≠ certeza

Divergência detectada gera **hipótese**, não conclusão. Mensagem ao box é "verificar X", não "X está errado".

### Regra B — Cooldown

Cada validação tem cooldown configurável (default 30s). Após disparar, não dispara novamente para o mesmo grupo de canais antes do cooldown — evita spam.

### Regra C — Severidade

Cada validação declara severidade default:

- `info` (V-001 com divergência pequena)
- `atencao` (V-002 a V-005)
- `critico` (V-006 com pressão muito baixa, V-007 prolongado)

Severidade entra no `ALERT_HIERARCHY.md`.

### Regra D — Categoria de qualidade

Quando validação falha, atualizar categoria de qualidade dos canais envolvidos para `SUSPECT` na janela de tempo correspondente. Análises consumindo essa janela ficam cientes.

### Regra E — Teste obrigatório

Cada validação tem teste com fixtures de:

- caso normal (ambos OK e dentro do limite)
- divergência verdadeira
- divergência transitória (< janela mínima → não dispara)
- ambos com qualidade ruim (não dispara — não há base)
- recovery após divergência

### Regra F — Catálogo extensível

Quando sensor novo entrar (pressão de freio, ângulo de volante, suspensão, etc.), adicionar validações relacionadas ao catálogo. Cada nova entrada vira PR separado, com teste, alinhado a `TELEMETRY_REVIEW_CHECKLIST.md`.

## Validação contra implementação atual

**Estado em 2026-04-24:** zero código de validação cruzada existe. Cada análise consome um canal independentemente. Não há detecção automática de divergência.

Quando `CrossValidationEngine` for criado (após `TelemetryTimebase`):

- consume snapshots
- aplica catálogo de validações
- emite eventos quando dispara
- alimenta `MessageBroker` (no Box) ou store auditável
- atualiza `quality` dos canais conforme Regra D
