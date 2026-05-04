# Dinamômetro — o que pedir ao técnico

> Documento pra Flávio levar antes da sessão de dinamômetro do Celta 1.4 turismo.
> Cada linha tem **o que pedir**, **formato preferido**, e **pra que serve no app**.
> Quanto mais bem pedido na hora, menos retrabalho depois.

## Contexto pro técnico (o que dizer pra ele)

> "Estou desenvolvendo um app de telemetria pessoal pra track day. Vou usar
> os dados do dyno em 3 frentes: (1) Shift Light que calcula RPM ótimo de
> troca por marcha em vez de fixo no pico de torque, (2) cockpit do
> engenheiro que mostra alertas quando o motor sai da janela útil em pista,
> (3) calibração de tolerância (% da janela útil) por carro.
>
> Não preciso de relatório bonito — preciso dos **dados crus em CSV** com 1
> linha por amostra (~200 RPM de granularidade) pra carregar no app."

---

## 🔴 Mínimo absoluto (sem isto, Bloco 6 do Shift Light não roda)

### 1. Curva de torque + potência (run wide-open throttle)

**Formato esperado** (formato canônico do `dyno-csv-parser.js`):

```csv
rpm,torque_nm,power_kw
2000,82.4,17.3
2200,85.1,19.6
2400,88.7,22.3
...
6800,71.2,50.7
```

- **Granularidade**: 200 RPM ou menos (quanto mais fino melhor — 100 RPM ideal)
- **Range**: do RPM mínimo confiável (~1500-2000) até **redline real** (não nominal)
- **Unidade**: torque em N·m, potência em **kW** (não cv/HP — converter na entrada do app)
- **Condição**: WOT (wide open throttle) — pé chapado do começo ao fim do run

**Pra que serve:**
- `dyno-target-calculator.js` calcula RPM ótimo de troca por marcha usando essa curva + gear ratios
- `tolerance-from-dyno.js` define janela útil (default ±5% da banda de torque ≥ 95% do pico)
- Cockpit pode mostrar "você está fora da banda útil" ao vivo quando ECU estiver pareada (Fase 2)

---

## 🟡 Importante (destrava cálculo de shift light otimizado)

### 2. Tempo de troca de marcha estimado

**Como obter:** o técnico **não mede isso no dyno**. Mas pode dar referência observada (3 valores ok):
- Tempo médio de troca **subindo** marcha (1→2, 2→3, 3→4, 4→5) — driver competitivo, ~150-300ms
- Tempo médio de troca **descendo** (5→4, 4→3) — geralmente mais rápido

Se ele não tiver, anotar: "Flávio mede em pista com vídeo + análise frame-a-frame"

**Pra que serve:**
- O cálculo de shift point ótimo precisa saber QUANTO o motor cai de RPM durante a troca (gap entre soltar embreagem da marcha N e engatar a N+1)
- Sem isso, o algoritmo assume troca instantânea → sugere RPM de troca tarde demais → motor cai pra abaixo da banda útil na próxima marcha

### 3. Curva de **engine drag** / desaceleração com pé fora

**Como obter:** "motoring run" no dyno — dyno gira o motor sem combustão e mede torque negativo (perdas internas).

**Formato:**
```csv
rpm,drag_torque_nm
2000,-8.2
3000,-11.4
4000,-15.7
...
```

**Pra que serve:**
- Combinar com #2 (tempo de troca) pra estimar com precisão a queda de RPM no intervalo entre marchas
- Sem isto, usar default ~10% de queda (mais conservador, sugere troca mais cedo)

### 4. Relações finais (gear ratios + final drive)

**Como obter:** o técnico geralmente tem isso ou consegue achar na ficha do carro. Não é dyno data, mas anota junto.

```
1ª:    3.18:1
2ª:    1.78:1
3ª:    1.18:1
4ª:    0.85:1
5ª:    0.69:1
ré:    3.31:1
final: 4.93:1
diâmetro pneu (cm): 56.5  (175/65 R14)
```

**Pra que serve:**
- `dyno-target-calculator.js` precisa pra projetar "se eu trocar agora a X RPM em N, que RPM cai na N+1?"
- Cockpit pode estimar marcha sem leitura direta do ECU (`gear-estimator` no plano)
- Cálculo de velocidade real a partir de RPM (pra cross-check com GPS)

---

## 🟢 Útil pra Fase 2 (ECU Injepro live)

Se o dyno tiver datalogger conectado à ECU Injepro durante o run, **pedir export bruto de tudo**. Cada um é canal extra pro cockpit do engenheiro quando a ECU estiver pareada via BLE/CAN.

### 5. AFR / Lambda × RPM

```csv
rpm,afr,lambda
2000,13.8,0.94
3000,13.2,0.90
...
```

**Uso:** alerta de mistura pobre/rica fora de banda no cockpit do engenheiro. Já listado em `PENDENCIAS_GATE.md` P0 (regras críticas).

### 6. EGT (temperatura do escapamento) × RPM

```csv
rpm,egt_c
2000,520
3000,680
4000,820
...
```

**Uso:** alerta crítico de superaquecimento (>900°C tipicamente em motor aspirado). Já mencionado em `T4000_CAN_SPEC.md`.

### 7. Pressão de óleo × RPM (com motor a temperatura)

```csv
rpm,oil_pressure_bar,oil_temp_c
2000,2.8,90
4000,4.5,95
6000,5.2,98
...
```

**Uso:** alerta crítico no cockpit. P0 do gate.

### 8. Mapas da ECU exportados

- Mapa de **avanço de ignição** (graus × RPM × carga)
- Mapa de **tempo de injeção** (ms × RPM × carga)
- Mapa de **lambda alvo** (λ × RPM × carga)

**Formato:** o que a interface da Injepro exportar — geralmente CSV ou XML proprietário. Salvar tudo, app converte depois.

**Uso:** cockpit do engenheiro pode mostrar overlay "você está na célula X do mapa de ignição com Y graus de avanço". Útil pra validar se a tunagem segura no carro real coincide com o que tá no banco. Sprint 2+, mas o dado nasce no dyno e morre se não for capturado.

### 9. Tabela "knock detection" / pontos de detonação

Se o dyno tiver sensor de detonação ativo no run, pedir log dos eventos:

```
rpm  ignition_advance  knock_count
3500 28°               0
4000 30°               2  ← knock detectado
4200 30°               5  ← knock crítico
```

**Uso:** define ceiling absoluto pra avanço de ignição que o app deve respeitar como hard limit. Diferente do shift point — é guard rail.

---

## ⚪ Bom ter (zero custo se já tiver, baixa prioridade)

### 10. Pressão de turbo (não aplica — Celta NA)
Skip.

### 11. Temperaturas de líquido refrigerante × RPM
Anotar o range observado durante run (ex: começou 78°C, terminou 92°C).

### 12. Foto da bancada com carro fixado + ângulo do dyno
Pra documentar setup. Útil se a gente quiser comparar com sessão futura.

---

## 📋 Checklist final (imprime e leva)

Pré-sessão:
- [ ] Confirmar com técnico: pode exportar CSV bruto (não só relatório PDF)?
- [ ] Confirmar: faz motoring run pra engine drag?
- [ ] Levar pen drive vazio
- [ ] Anotar: gear ratios + final drive + diâmetro de pneu

Durante:
- [ ] Tirar foto do display do dyno em cada marcha rodada (backup)
- [ ] Anotar temperatura do óleo no início e no fim de cada run

Pós:
- [ ] Salvar **TODOS** os arquivos exportados em pasta `2026-MM-DD-celta-dyno/`
- [ ] Anotar nome/contato do técnico (pra dúvidas posteriores)
- [ ] Anotar bancada usada (modelo do dyno: Bosch FLA, Mustang, etc.)

---

## ❌ NÃO precisa pedir

- Relatório formatado/PDF "bonito" — só atrapalha (use o tempo dele em mais runs ou granularidade fina)
- Conversão pra cv/HP — kW é o canônico do app
- Análise comparativa com outros carros — não tem valor pra nós
- "Mapa" otimizado pelo dyno — tunagem é decisão tua, não dele

---

## Como o app vai consumir isso

Resumo do que cada arquivo CSV destrava no código:

| Arquivo CSV | Destrava |
|---|---|
| `power_torque.csv` (item 1) | `dyno-csv-parser.js`, `dyno-target-calculator.js`, `tolerance-from-dyno.js` (Bloco 6 do Shift Light) |
| `engine_drag.csv` (item 3) | `shift-time-rpm-drop.js` (a criar — calcula queda de RPM no intervalo de troca) |
| `gear_ratios.txt` (item 4) | `cars.js` campo `gear_ratios` + `final_drive` (já existe no schema, só popular) |
| `afr_egt_oil.csv` (itens 5-7) | `CriticalRules.swift` calibrar limites por canal (P0 do PENDENCIAS_GATE) |
| `ecu_maps_*` (item 8) | Sprint 2+ — cockpit engenheiro com overlay de célula do mapa |
| `knock_log.csv` (item 9) | Hard limit pra avanço de ignição (cockpit engenheiro Fase 2) |

Quando voltar do dyno, os arquivos entram em `_dyno_data/` (gitignored — pesado e privado), o app importa via UI de cadastro do carro (já planejada — `mockup-carro.html` ganha aba dyno no Bloco 6).
