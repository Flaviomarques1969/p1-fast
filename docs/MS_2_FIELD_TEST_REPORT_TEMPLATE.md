# Relato de field test MS-2 — `<PREENCHA>`

> Copie esse template, renomeie para `MS_2_FIELD_TEST_REPORT_<YYYY-MM-DD>.md`, preencha em campo, comite no fim do dia.

**Data:** 2026-MM-DD
**Local:** `<varanda / autódromo Brasília / outro>`
**Device:** `<iPhone 16 Pro Max / outro>`
**iOS:** `<17.x / 18.x>`
**Build:** `<commit SHA do main>`
**Tempo total do teste:** `<MM min>`

---

## Tela ao final da captura 30s parado

| Métrica            | Esperado          | Observado    | OK? |
|--------------------|-------------------|--------------|-----|
| Amostras raw       | ~3030             |              |     |
| Amostras enriched  | ~30 + ` · fix`    |              |     |
| Detector ok        | ~30               |              |     |
| Detector skip      | ~3000             |              |     |
| Voltas             | `—`               |              |     |
| IMU Hz             | 99.5–100.5        |              |     |
| IMU jitter ms      | < 1               |              |     |
| GPS Hz             | ~1                |              |     |
| GPS jitter ms      | < 100             |              |     |

---

## SQL pós-captura

### `telemetry_samples`

```
total       =
seq_min     =
seq_max     =
contíguo?   =
```

### `telemetry_samples_enriched`

```
total       =
seq_min     =
seq_max     =
com_fix     =
pre_fix     =
```

### Sample IMU (do JSON)

```
accX  =
accY  =
accZ  =          (≈ 0 OK; se ≈ ±9.81 = bug gravity vs userAcceleration)
gyroAlpha =
```

### Sample GPS

```
lat   =
lng   =
speed (m/s) =
kmh   =          (= speed × 3.6 ?)
acc (m) =        (< 10 em céu aberto?)
```

### Sample enriched (com `source_kalman=1`)

```
seq         =
x_m         =        (≈ 0 OK em iPhone parado)
y_m         =        (≈ 0 OK em iPhone parado)
vx_mps      =
vy_mps      =
heading_deg =
pos_sigma_m =        (< 10 OK após estabilizar)
```

---

## MS-2.2 wake lock + background

| Subteste                              | OK? | Observação |
|---------------------------------------|-----|------------|
| Tela não dorme em 1 min capturando    |     |            |
| Tela apaga normalmente após PARAR     |     |            |
| GPS background +60 raw em 1 min trancado |  |            |
| Enriched +60 em 1 min trancado        |     |            |
| Detector ok +60 em 1 min trancado     |     |            |
| Banner Low Power aparece imediatamente|     |            |
| Banner Low Power some ao desligar LPM |     |            |
| IMU cai em LPM (esperado, não é bug)  |     |            |

---

## MS-2.6 voltas (só se foi à pista)

```
Voltas observadas =
Tempo da volta 1  =
Tempo da volta 2  =
Tempo da volta 3  =
```

Coerente com velocidade real? `<sim/não — explicar>`

---

## Problemas observados / anomalias

```
1.
2.
3.
```

---

## Veredicto

- [ ] Bloco MS-2.1+2.2 (8 itens): __/8
- [ ] Bloco MS-2.6+2.7 (5 itens): __/5
- [ ] Bloco voltas (2 itens, opcional): __/2

**Resultado:** `<MS-2.5 desbloqueado / abrir issue X / abrir issue Y>`

---

## Próximo passo concreto

`<descrever — ex.: começar MS-2.5 com PR de StintRepository.finalize / corrigir bug X antes>`
