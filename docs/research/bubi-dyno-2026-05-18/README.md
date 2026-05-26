# Dinamômetro do Celta Bubi — 2026-05-18

Curva oficial do motor do Bubi, rodada na Lenza Powerchips em 2026-05-18. Esta é a fonte de verdade pra qualquer cálculo de torque/potência do carro do Flávio.

## Quem é o Bubi

- **Modelo:** Celta 1.4 Chevrolet (Turismo)
- **Categoria:** Track day amador
- **Combustível:** etanol
- **ID na nuvem:** `641A81E7-3192-4E68-8183-B8401F105574`

## Picos da curva

| Métrica | Valor | Onde acontece |
|---|---|---|
| **Pico de torque (rodas)** | **119,53 ftlb = 162,06 Nm** | **5.200 rpm** |
| **Pico de torque (motor estimado SAE)** | 119,53 ftlb = 162,1 Nm | 5.200 rpm |
| Pico de potência (rodas) | 106,57 HP | 6.050 rpm |
| Pico de potência (motor estimado SAE) | 122,77 HP | 6.050 rpm |
| Redline operacional | **6.300 rpm** (não passar de 6.350) | — |
| Faixa coberta no teste | 2.500 – 6.400 rpm | — |
| Pontos coletados | 80 | resolução ~50 rpm |

## Como o motor se comporta (entender pra decidir shift light)

- **2.500–2.700 rpm:** motor ainda subindo (torque saltando de 0 pra 160 Nm).
- **2.800–5.200 rpm:** torque vive num platô entre **150-162 Nm** — zona de uso na pista.
- **5.200 rpm:** **PICO DE TORQUE — 162,06 Nm.** Ponto ideal pra trocar de marcha.
- **5.400–6.000 rpm:** torque cai (158 → 145 Nm) mas potência ainda sobe (porque RPM compensa).
- **6.050 rpm:** **pico de potência.**
- **Acima de 6.200 rpm:** queda abrupta — motor não responde mais. NÃO passar de 6.350.

## Implicações pro shift light no painel do piloto

- Acionamento progressivo: a partir de **~4.900 rpm** (200 rpm antes do pico).
- **Máximo (vermelho) em 5.200 rpm** = pico de torque atingido.
- Halo de aviso acima de 5.400 rpm = "passou do ponto ideal, está perdendo torque".
- Limite hard em 6.350 rpm — sirene visual + halo vermelho fixo.

## Arquivos nesta pasta

- `celta-bubi-3-puxadas.csv` — relatório bruto do dinamômetro Lenza, formato Dynojet.
  - Run #1 (linha 2 do arquivo) tem totais.
  - Pontos da curva a partir da linha 5, colunas RPM / Power / Torque (em ftlb).
- (futuro) `dyno_curve_seed.sql` — comandos para inserir os 80 pontos na tabela `dyno_curve` em produção.

## Onde mais essa curva existe

- **Banco da nuvem:** tabela `dyno_curve` (estrutura criada na migração 0022). Pontos inseridos em 2026-05-26 pra serem consumidos pelo painel.
- **Memória global:** `[[p1-fast-celta-bubi-dyno-2026-05-18]]` (resumo curto).

## Origem dos dados

- Rodada feita por Flávio em 2026-05-18 (sábado), 12h05.
- Dinamômetro Lenza Powerchips, modelo de rolos.
- Condições: temperatura 80°F (~26,5°C), pressão 48,7 (psi), umidade não-informada, DynoCF 1.16.
- Arquivo recebido em CSV via WhatsApp em 2026-05-26 18h.
