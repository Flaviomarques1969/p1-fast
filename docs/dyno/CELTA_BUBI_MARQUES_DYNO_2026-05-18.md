# Celta "Bubi" — Curva oficial do motor (dinamômetro 2026-05-18)

**Carro:** Celta 1.4 com motor de Onix 1.4 (preparado) + câmbio do Celta 1.0
**Piloto:** Flávio Marques
**Preparação / dinamômetro:** Lenza Powerchips
**Dinamômetro:** Dynocom
**Padrão de correção:** SAE J1349 (% Loss)
**Data da medição:** 2026-05-18
**Arquivo bruto preservado:** `docs/dyno/CELTA_BUBI_MARQUES-3PUXADAS-2026-05-18.csv`

> ⚠️ **REGISTRO EM DEFINITIVO** — pedido do Flávio em 2026-05-18 14h55. Estes números são a referência oficial do motor desse carro e vão ser usados muitas vezes (análise de stints, cálculo de marcha, validação de upgrades futuros).

---

## 1. Resultados principais (a melhor das 3 puxadas)

| Métrica | Motor (corrigido SAE) | Roda (medido) | Observação |
|---|---|---|---|
| **Potência máxima** | **122.8 HP @ 6050 RPM** | 106.8 HP @ 6050 RPM | Perda de transmissão ~13% (normal) |
| **Torque máximo** | **162.1 N·m @ 5200 RPM** | 140.9 N·m @ 5200 RPM | 162.1 N·m = 119.5 lb·ft |
| **Potência média da puxada** | 102.0 HP | 92.96 HP | Média de 2500-6400 RPM |
| **Torque médio da puxada** | 149.1 N·m | 110.0 N·m | Média de 2500-6400 RPM |

> 💡 **Atenção à unidade do CSV:** o arquivo Dynocom registra **torque em lb·ft** (libra-pé). O gráfico de cima mostra em **N·m**. Conversão: 1 lb·ft = 1.35582 N·m. Por isso 119.5 lb·ft do CSV vira 162.1 N·m no gráfico. **Não é erro nem 2 motores diferentes — é a mesma medida em unidades diferentes.**

---

## 2. As 3 puxadas comparadas (do gráfico)

| Puxada | Cor no gráfico | HP pico | RPM HP pico | Torque pico | RPM torque pico |
|---|---|---|---|---|---|
| 1 (a melhor) | preta tracejada | **122.8 HP** | 6050 | **162.1 N·m** | 5200 |
| 2 (intermediária) | azul | 117.6 HP | 5400 | 156.4 N·m | 5200 |
| 3 (pior) | verde | 113.7 HP | 6000 | 150.7 N·m | 5200 |

**Conclusões da comparação:**
- O RPM do pico de torque é IDÊNTICO nas 3 (5200 RPM) — o motor "casa" sempre nesse ponto. Estável.
- O RPM do pico de potência varia (5400 / 6000 / 6050). A puxada melhor segura a potência mais alta até mais tarde.
- Variação de pico HP entre puxadas: ~8% (122.8 vs 113.7). Variação típica de medição.
- **Referência oficial = puxada 1 (preta).** As outras 2 entram só como faixa de variação esperada.

---

## 3. Condições atmosféricas da medição

| Fator | Valor | Equivalente |
|---|---|---|
| Temperatura | 79.99 °F | **26.7 °C** |
| Pressão atmosférica | 26.27 inHg | **890 mbar** |
| Umidade relativa | 48.73 % | (clima seco/médio) |
| Fator de correção SAE | **1.1620** | Motor entregou 106 HP medido, corrigido pra 122.8 HP padrão SAE J1349 |

**Análise das condições:**
- Pressão de 890 mbar bate com **altitude ~1.150 m** (Brasília tem 1.171 m). Medição foi feita na altitude do uso real.
- Temperatura 26.7 °C é morna mas dentro do esperado.
- O fator de correção 1.162 significa que o motor "perdeu" 16.2% por causa do ar rarefeito de altitude. **Na pista de Brasília, o motor entrega realmente os 106 HP**, não os 122.8 HP. O número corrigido só serve pra comparar com motores medidos em outros locais.

---

## 4. Faixas de uso (extraídas da curva)

Onde o motor entrega quanto:

| Métrica | Faixa de RPM | Largura | O que isso significa pra pilotagem |
|---|---|---|---|
| HP ≥ 100 | **4.550 a 6.350 RPM** | 1.800 RPM | Banda principal de aceleração |
| HP ≥ 110 | 4.950 a 6.300 RPM | 1.350 RPM | Onde a aceleração é mais forte |
| HP ≥ 120 (próximo do pico) | 5.700 a 6.100 RPM | 400 RPM | Janela curta — exige precisão de marcha |
| Torque ≥ 155 N·m (≥ 114 lb·ft) | **2.650 a 5.450 RPM** | **2.800 RPM** | Faixa enorme — empurra forte mesmo em baixa rotação |
| Torque ≥ 150 N·m (≥ 110 lb·ft) | 2.650 a 5.750 RPM | 3.100 RPM | Praticamente toda a faixa útil |

**Implicações práticas:**

1. **Cortar marcha em 6.100–6.200 RPM** — depois disso o HP cai rápido (122.8 → 70.8 em só 400 RPM). Limite mecânico: 6.350 (queda abrupta = motor morre, pode quebrar válvula se passar).
2. **Faixa de uso ideal em pista: 4.500–6.300 RPM** — mantém HP ≥ 100 e torque ainda forte.
3. **Torque "fácil" de 2.650 RPM** — o motor já empurra desde rotação baixa, não precisa "espremer". Bom pra saídas de curva.
4. **Ponto de máxima aceleração: ~5.200 RPM** (pico de torque). Curvas onde a saída cai nessa rotação são as mais rápidas.
5. **Não passar de 6.350 RPM** — queda abrupta de 102 HP pra 70.8 HP em 50 RPM. Sinal claro de que o motor está no limite mecânico.

---

## 5. Tabela completa RPM × HP × Torque

| RPM | HP (motor) | Torque (lb·ft) | Torque (N·m) |
|----:|-----------:|---------------:|-------------:|
| 2500 | -0.8 | -1.6 | -2.2 |
| 2550 | 40.3 | 82.9 | 112.5 |
| 2600 | 52.5 | 106.1 | 143.9 |
| 2650 | 58.2 | 115.3 | 156.3 |
| 2700 | 60.3 | 117.3 | 159.1 |
| 2750 | 61.5 | 117.4 | 159.1 |
| 2800 | 62.8 | 117.8 | 159.7 |
| 2850 | 64.2 | 118.2 | 160.3 |
| 2900 | 65.4 | 118.5 | 160.6 |
| 2950 | 66.4 | 118.2 | 160.3 |
| 3000 | 67.1 | 117.4 | 159.2 |
| 3050 | 67.9 | 116.9 | 158.5 |
| 3100 | 68.8 | 116.6 | 158.1 |
| 3150 | 70.0 | 116.7 | 158.2 |
| 3200 | 71.1 | 116.7 | 158.2 |
| 3250 | 72.4 | 117.1 | 158.7 |
| 3300 | 74.0 | 117.7 | 159.6 |
| 3350 | 75.4 | 118.2 | 160.2 |
| 3400 | 76.4 | 118.1 | 160.1 |
| 3450 | 77.0 | 117.2 | 159.0 |
| 3500 | 77.6 | 116.4 | 157.9 |
| 3550 | 78.5 | 116.1 | 157.4 |
| 3600 | 79.7 | 116.2 | 157.5 |
| 3650 | 81.0 | 116.5 | 157.9 |
| 3700 | 82.4 | 116.9 | 158.5 |
| 3750 | 83.7 | 117.2 | 158.9 |
| 3800 | 85.1 | 117.6 | 159.4 |
| 3850 | 86.4 | 117.8 | 159.7 |
| 3900 | 87.7 | 118.0 | 160.0 |
| 3950 | 88.9 | 118.1 | 160.2 |
| 4000 | 90.0 | 118.2 | 160.2 |
| 4050 | 91.2 | 118.3 | 160.3 |
| 4100 | 92.3 | 118.4 | 160.4 |
| 4150 | 93.4 | 118.4 | 160.5 |
| 4200 | 94.5 | 118.4 | 160.5 |
| 4250 | 95.5 | 118.3 | 160.4 |
| 4300 | 96.5 | 118.0 | 160.0 |
| 4350 | 97.4 | 117.8 | 159.7 |
| 4400 | 98.4 | 117.5 | 159.3 |
| 4450 | 99.2 | 117.2 | 158.9 |
| 4500 | 99.9 | 117.0 | 158.6 |
| 4550 | 100.7 | 116.7 | 158.2 |
| 4600 | 101.6 | 116.5 | 158.0 |
| 4650 | 102.7 | 116.5 | 158.0 |
| 4700 | 103.8 | 116.6 | 158.1 |
| 4750 | 104.8 | 116.6 | 158.1 |
| 4800 | 105.8 | 116.5 | 158.0 |
| 4850 | 106.9 | 116.6 | 158.1 |
| 4900 | 108.0 | 116.7 | 158.2 |
| 4950 | 110.0 | 117.8 | 159.7 |
| 5000 | 112.4 | 118.7 | 160.9 |
| 5050 | 114.1 | 118.9 | 161.2 |
| 5100 | 115.7 | 119.3 | 161.7 |
| 5150 | 116.5 | 119.0 | 161.3 |
| 5200 | **117.8** | **119.5** | **162.1** ← pico torque |
| 5250 | 118.0 | 118.4 | 160.5 |
| 5300 | 118.9 | 118.0 | 160.0 |
| 5350 | 119.4 | 117.3 | 159.0 |
| 5400 | 119.5 | 116.4 | 157.8 |
| 5450 | 120.0 | 115.8 | 157.0 |
| 5500 | 120.4 | 115.1 | 156.1 |
| 5550 | 120.5 | 114.2 | 154.8 |
| 5600 | 120.6 | 113.3 | 153.6 |
| 5650 | 121.2 | 112.8 | 152.9 |
| 5700 | 121.6 | 112.2 | 152.1 |
| 5750 | 121.6 | 111.2 | 150.8 |
| 5800 | 121.8 | 110.4 | 149.7 |
| 5850 | 122.0 | 109.6 | 148.6 |
| 5900 | 122.2 | 108.8 | 147.5 |
| 5950 | 122.3 | 108.0 | 146.4 |
| 6000 | 122.7 | 107.4 | 145.6 |
| 6050 | **122.8** ← pico HP | 106.6 | 144.5 |
| 6100 | 121.7 | 104.8 | 142.1 |
| 6150 | 119.7 | 102.2 | 138.5 |
| 6200 | 118.7 | 100.5 | 136.3 |
| 6250 | 118.7 | 99.7 | 135.2 |
| 6300 | 115.1 | 96.0 | 130.1 |
| 6350 | 102.0 | 84.4 | 114.4 |
| 6400 | 70.8 | 58.1 | 78.7 |

---

## 6. Como usar este registro no aplicativo P1 Fast

Estes números são a **referência oficial do motor desse carro**. Aplicações imediatas:

1. **Cálculo de marcha ideal** — quando trocar de marcha pra cair na faixa de melhor aceleração (5.200 RPM ideal).
2. **Validação de upgrades futuros** — toda nova preparação do motor compara contra esta linha base. Ganhou? Perdeu? Em qual faixa?
3. **Cálculo de potência efetiva em pista** — em Brasília o motor entrega 106 HP reais (não os 122.8 corrigidos). Outros autódromos com altitude diferente vão dar números diferentes.
4. **Validação de telemetria** — quando o aplicativo registrar aceleração em pista, pode comparar com a aceleração teórica baseada nestes números.
5. **Dimensionamento da função Ajuste do motor (futura)** — quanto cada item de manutenção impacta na curva (óleo novo, vela nova, filtro novo).

---

## 7. Limitações honestas

- **3 puxadas mostradas, mas só 1 puxada está no CSV** (a melhor). Se quisermos a curva das outras 2 com a mesma precisão da puxada principal, precisamos do CSV de cada uma.
- A pressão e umidade do dia foram capturadas no momento da medição. Se a pista do evento estiver com clima muito diferente, a entrega real vai variar. Use o fator de correção SAE pra extrapolar.
- **Não foi medida a banda de marcha lenta** (RPM &lt; 2500). A puxada começa exatamente em 2500. Abaixo disso o comportamento é desconhecido por esta medição.
- Os dados são do conjunto **motor + transmissão + diferencial** medidos na roda (e corrigidos pra motor). Mudanças no câmbio ou diferencial alteram a curva na roda mesmo sem mexer no motor.

---

## 8. Próximas medições recomendadas

Quando fizer nova medição de dinamômetro pra este carro, preserve:
1. Arquivo `.csv` original do Dynocom (ou similar).
2. Gráfico `.png` ou `.jpg` exportado.
3. Foto da pressão / temperatura / umidade do dia (ou anote no documento).
4. Notas sobre o que mudou no motor desde a última medição (filtro novo, óleo novo, mapa de injeção alterado, etc.).
5. Salvar em `docs/dyno/CELTA_BUBI_MARQUES_DYNO_AAAA-MM-DD.md` com a data correspondente.
