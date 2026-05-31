# Garagem — Controle de Consumíveis (Celta 1.4)

> **STATUS: PROPOSTA DE DESIGN — aguardando aprovação do Flávio.**
> Documento de domínio. Nada de migration nem código foi escrito ainda. Este doc é o passo 1 que o Flávio aprovou em 2026-05-31 ("Doc de design + catálogo"). Decisões de escopo/arquitetura são do Flávio (`docs/CONTROL_CENTER.md`); aqui eu proponho.
>
> Não reabre nenhuma ADR. Respeita ADR-008 (IA nunca em segurança crítica), ADR-003/004/014 (telemetria), ADR-018 (hub iOS nativo), MS-5 (pendências vivas).

---

## 1. O que é

Uma função dentro do módulo **Garagem** que controla a **troca dos consumíveis de cada carro** (foco inicial: Celta 1.4 VHC-E flex, o "Bubi"). Para cada item consumível o sistema sabe:

1. **Qual o critério de troca** (o "relógio" certo daquele item).
2. **Onde o item está nesse relógio** (verde / amarelo / vermelho).
3. **Quando virar pendência obrigatória** no próximo evento do carro.

Decisão do Flávio (2026-05-31): **cada item usa o melhor relógio para ele** (não um relógio único pro carro todo), e o indicador aparece nos **dois lugares** — painel próprio na Garagem **e** espelhado como pendência obrigatória do evento (MS-5).

---

## 2. Leitura sóbria da base — o que dá e o que NÃO dá pra automatizar

Antes do catálogo, três fatos do repositório que limitam a automação. São honestos, não pessimistas.

### Fato 1 — não existe hodômetro nem horímetro hoje

`carros` (migrations `0001_initial.sql:147` e `0022_carros_gears_dyno.sql`) tem `apelido, modelo, categoria, cor, redline, gear_ratios, dyno_curve`. **Nenhum acumulador de uso.** O que existe de "uso":

- `stintsPorCarro` — contagem de sessões por carro (`CarroRepository.swift:57`).
- `Pneu.ciclos` + `tire-wear.js` — voltas no pneu por composto.
- `Volta` por sessão.

**Conclusão:** sem um acumulador de **horas de motor** e **km de pista** por carro, qualquer critério "trocar a cada X" não tem âncora. Esse acumulador é o **item zero** desta função (§5).

### Fato 2 — o Celta real tem metade dos sensores que o protocolo T4000 prevê

`T4000_CAN_SPEC.md` cataloga pressão de óleo, pressão de combustível, temp do ar, EGT, etc. Mas `FONTE_DADOS_AO_VIVO.md` (validado em campo 2026-05-26 contra o software oficial INJEPRO T LINE) registra que **no Bubi NÃO estão instalados**: pressão de óleo, pressão de combustível, temp de ar, sonda NB. Pedal e freio são mecânicos.

**Chega de fato hoje:** `RPM, TPS, tensão de bateria, temp de água, lambda WB, MAP`.

**Conclusão:** critérios baseados em pressão de óleo são teóricos no Bubi (sensor ausente). Ficam documentados como "se um dia instalar", nunca como gate ativo.

### Fato 3 — divisão de trabalho T4000 × GPS

A T4000 **nunca** dá GPS, posição, aceleração, pressão/temperatura real de pneu (anti-catálogo da spec). Esses vêm do **iPhone** (CoreLocation 1 Hz + CoreMotion 100 Hz, já no pipeline de telemetria, ADR-018).

- **Horas de motor** = tempo de stint com `RPM > limiar` → **T4000**.
- **Km de pista** = ∫ velocidade · dt por stint → **GPS iPhone** (a velocidade da T4000 valida cruzado, mas distância é GPS).
- **Ciclos térmicos** = stints em que a água cruzou o limiar quente → **T4000** (temp água).

---

## 3. Os relógios disponíveis (e qual dá pra automatizar)

| Relógio | Como se mede | Automação | Fonte |
|---|---|---|---|
| **Horas de motor** | Σ tempo de stint com RPM > ~500 | **Automático** | T4000 (RPM) |
| **Km de pista** | Σ ∫velocidade·dt por stint | **Automático** | GPS iPhone |
| **Sessões / voltas** | contagem (já existe) | **Automático** | GPS / `sessoes` |
| **Ciclos térmicos** | nº stints em que água passou ~85 °C e esfriou | **Automático** | T4000 (água) |
| **Calendário** | hoje − data da última troca | **Automático** (só data) | relógio |
| **Condição medida** | tendência de λ, água, bateria | **Semi** (gera amarelo, nunca troca sozinho) | T4000 |
| **Inspeção visual** | espessura, folga, nível | **Manual** | pessoa |

Regra: **cada item escolhe um relógio primário e, quando faz sentido, um gatilho secundário** (calendário de segurança ou condição medida). O estado do item é o **pior** dos relógios aplicáveis.

---

## 4. Catálogo canônico de consumíveis — Celta 1.4 VHC-E (uso de pista)

Valores de limite abaixo são **ponto de partida de engenharia para track car** (mais conservador que manual de rua). **Todos pendentes de calibração com o Flávio** — entram como default editável, não como dogma. Coluna "Grupo" mapeia pro grupo de pendências já existente (`0005_pendencias.sql`).

| # | Item | Grupo | Relógio primário | Limite inicial (a calibrar) | Gatilho secundário | Indicador automatizável | Fonte | Automação |
|---|---|---|---|---|---|---|---|---|
| 1 | **Óleo de motor + filtro de óleo** | G1 Mecânica | Horas de motor | ~15 h | Calendário 6 meses | horas acumuladas; tendência de temp de óleo *(se sensor)* | T4000 (RPM) | **Alta** |
| 2 | **Filtro de ar** | G1 | Horas de motor | ~20 h | nº sessões (poeira) | horas / sessões | T4000 | Alta |
| 3 | **Filtro de combustível** | G2 Combustível | Calendário | 12 meses | Horas ~40 h | data + horas | relógio + T4000 | Alta |
| 4 | **Velas de ignição** | G1 | Horas de motor | ~30 h | λ errático sob carga | horas; lambda WB fora de faixa sustentada | T4000 (RPM, λ) | **Média-alta** |
| 5 | **Fluido de freio (DOT4)** ⚠️ | G3 | **Calendário** | 12 meses | nº sessões pesadas | data desde a troca (higroscópico) | relógio | **Alta** |
| 6 | **Pastilhas de freio (D/T)** | G3 | Sessões / voltas | a aprender por histórico | inspeção visual | voltas/sessões desde a troca (proxy) | GPS / `sessoes` | **Média** (proxy) |
| 7 | **Discos de freio** | G3 | Inspeção (ciclos de pastilha) | manual | empenamento/sintoma | proxy por nº de jogos de pastilha | — | Baixa (manual) |
| 8 | **Líquido de arrefecimento / aditivo** | G1 | Calendário | 24 meses | tendência térmica | data; água subindo entre sessões iguais | relógio + T4000 (água) | Média-alta |
| 9 | **Correia dentada + tensor** ⚠️⚠️ | G1 | **Horas OU calendário, o que vier antes** | ~150 h **ou** 48 meses | — | alerta duro antecipado | T4000 + relógio | Alta (alerta), troca manual |
| 10 | **Correia de acessórios (alternador)** | G1 | Inspeção | manual | tensão de bateria | bateria caindo / correia frouxa | T4000 (bateria) | Média (sintoma) |
| 11 | **Pneus** | G3 | Voltas (composto) | já existe | nível visual (0..3) | `tire-wear.js` — voltas vs vida aprendida | GPS / voltas | **Já implementado** |
| 12 | **Óleo de câmbio** | G1 | Horas de motor | ~60 h | Calendário 24 meses | horas + data | T4000 + relógio | Alta |
| 13 | **Embreagem (disco/platô/rolamento)** | G1 | Horas de motor | a aprender | inspeção | proxy por horas | T4000 | Baixa (manual) |
| 14 | **Bateria** | G4 Elétrica | Calendário | 24 meses | tensão de carga | tensão sob RPM (Bubi ~13,2 V já é sintoma) | T4000 (bateria) | Média (sintoma) |
| 15 | **Combustível** | G2 | Por sessão (consumo) | n/a | — | `fuel-calc.js` — voltas restantes | cálculo | **Já existe** |

⚠️ **Itens de segurança crítica** (fluido de freio, correia dentada): por **ADR-008**, o gatilho é **sempre determinístico** (data/horas), **nunca** IA. A correia dentada do Celta é o item de maior consequência — motor de interferência; se romper, dobra válvula. Merece alerta vermelho antecipado e ruidoso.

### Itens explicitamente NÃO automatizáveis (honestidade)

- Espessura de pastilha/disco, folga de válvula, estado de coxim/rolamento, nível visual de fluido → **inspeção manual**. O sistema lembra *quando olhar*, não mede.
- Pressão de óleo como gatilho → **sensor ausente no Bubi**. Documentado, inativo.
- Km de **rua** (deslocamento fora de pista) → não capturado. Só km de **pista** (GPS durante stint).

---

## 5. Item zero — o acumulador de uso por carro

Sem isto, o resto é só checklist manual com data. É a fundação.

Por **stint encerrado**, o sistema acumula, por carro:

| Acumulador | Fórmula | Origem |
|---|---|---|
| `horas_motor` | += duração do stint com `RPM > 500` / 3600 | T4000 (RPM) — ADR-025 / timebase |
| `km_pista` | += ∫ velocidade GPS · dt | GPS iPhone (telemetry_samples_enriched) |
| `sessoes` | += 1 | já existe (`stintsPorCarro`) |
| `ciclos_termicos` | += 1 se água cruzou ~85 °C e esfriou | T4000 (temp água) |

Observações de projeto:

- **Append-only friendly** — cada stint contribui um delta; o total é soma. Alinha com a filosofia de telemetria append-only (ADR-004/014) sem violar nada: estes são **agregados derivados**, recomputáveis a partir dos stints.
- Reusa o gancho que o `tire-wear.js` já provou (`registrarStint`): a função roda no fim do stint, lê voltas/telemetria, incrementa contadores.
- Edição manual permitida (carro chega com horas de antes do sistema; mecânico corrige). Igual hodômetro de banca.

---

## 6. Estado do item (verde / amarelo / vermelho)

Para cada item × carro:

```
consumido = acumulador_agora − acumulador_no_momento_da_ultima_troca   (por relógio aplicável)
fracao    = consumido / limite
estado    = pior(fracao_de_cada_relogio_aplicavel)
```

- **Verde** — fracao < 0,8 em todos os relógios e sem sintoma medido.
- **Amarelo** — fracao 0,8–1,0 **ou** sintoma medido (λ errático, água subindo, bateria baixa).
- **Vermelho** — fracao ≥ 1,0 em qualquer relógio **ou** calendário de segurança vencido (freio, correia).

"Pior relógio vence" cobre o item 9 (correia: o que estourar primeiro entre horas e calendário).

---

## 7. Os dois indicadores (decisão "os dois")

### 7.1 Painel próprio na Garagem (fonte da verdade)

Sub-tela nova por carro: **Consumíveis**. Reaproveita o stat **"Manutenção"** que a `GaragemView.swift` já exibe no card-resumo (hoje sem fonte). Cada linha:

```
[badge ●] Óleo de motor      12,3 / 15 h        82%   [Registrar troca]
[badge ●] Correia dentada    138 h · 41 meses    VENCE EM BREVE
[badge ●] Fluido de freio    troca há 13 meses   VENCIDO
```

`[Registrar troca]` fecha a instalação atual (grava data + horas/km do momento) e abre uma nova, zerando o relógio daquele item. Mesmo padrão de `TireWear.trocar` / `instalar`.

### 7.2 Espelho em Pendências (MS-5)

Quando um item está **amarelo ou vermelho** e o carro entra num evento, o item vira/garante uma linha **obrigatória** em `evento_pendencias`, vinculada ao `pendencias_template` correspondente (G1 Mecânica já tem "Óleo motor", "Óleo câmbio", "Graxa").

Reusa a migration **já desenhada e arquivada** `_archive/propostas-2026-05-13/migrations-banco/0022_pendencias_consumiveis.sql` (`pendencias_template.eh_consumivel`, `unidade`; `evento_pendencias.quantidade`). Ou seja: a função de consumíveis é a **fonte** que pré-marca as pendências obrigatórias do MS-5 — não duplica o conceito de checklist, alimenta ele.

---

## 8. Esboço de schema (a detalhar só depois da aprovação)

Três peças. **Nada disto vira migration antes do Flávio aprovar este doc.**

1. **Acumulador de uso por carro** (§5) — colunas em `carros` (`horas_motor`, `km_pista`, `ciclos_termicos`) ou tabela `carro_uso` separada. Preferência: tabela separada, recomputável.
2. **Catálogo de tipos de consumível** — `consumivel_tipo`: `titulo, grupo, relogio_primario (enum), limite_primario, relogio_secundario, limite_secundario, eh_critico, unidade, pendencia_template_id`. Curado global + editável por time (igual MS-5 tornou pendências vivas).
3. **Instalações** — `consumivel_instalacao`: `carro_id, tipo_id, instalado_em, horas_no_install, km_no_install, sessoes_no_install, observacao, ativo`. Troca = fecha a ativa + abre nova. Espelha o modelo de `tire-wear.js`.

Camada de domínio pura (cálculo de estado verde/amarelo/vermelho) portável JS↔Swift, com smokes, igual ao resto do projeto.

---

## 9. Faseamento proposto

| Fase | Entrega | Depende de |
|---|---|---|
| **F0** | **Este doc aprovado + limites calibrados com o Flávio** | — |
| **F1** | Acumulador de uso por carro (horas/km/sessões/ciclos) + integração no fim do stint | F0 + captura T4000 real (MS-9.1) |
| **F2** | Catálogo `consumivel_tipo` + `consumivel_instalacao` + domínio puro de estado (com smokes) | F1 |
| **F3** | Painel "Consumíveis" na Garagem (SwiftUI) — fonte da verdade | F2 + Xcode |
| **F4** | Espelho em pendências obrigatórias (MS-5 + migration arquivada 0022) | F2 + MS-5 |

F1 tem dependência real de hardware: o acumulador de **horas de motor** precisa do stream T4000 chegando (pendência aberta do Flávio — captura real do barramento, STATUS.md). Até lá, **km de pista (GPS) e sessões já funcionam** e o calendário (freio, correia) **funciona desde já** — então F2→F4 podem entregar valor mesmo antes da T4000 fechar.

---

## 10. Decisões abertas para o Flávio

1. **Calibrar os limites** da tabela §4 (horas/meses de cada item) — os valores são chute conservador de engenharia, não verdade.
2. **Limiar de "motor ligado"** para horas de motor: RPM > 500? > 800 (acima da marcha lenta)?
3. **Acumulador em `carros` ou tabela separada** `carro_uso` (recomendo separada).
4. **Catálogo de consumíveis global curado vs por time** desde o início (sugiro nascer curado, virar editável como MS-5 fez com pendências).
5. **Itens que valem para outros carros** além do Celta (a tabela §4 é Celta-específica nos limites; a estrutura é genérica).

---

## 11. Referências

- `docs/PLANO_FASE_1.md` §6 MS-5 (pendências vivas) — doc mestre
- `docs/hardware/T4000_CAN_SPEC.md` — canais da ECU
- `docs/FONTE_DADOS_AO_VIVO.md` — sensores realmente instalados no Bubi
- `ARCHITECTURE_DECISIONS.md` — ADR-008 (IA fora de segurança crítica), ADR-004/014 (telemetria), ADR-018 (hub iOS), ADR-025 (Detector)
- `src/domain/tire-wear.js` — padrão de instalação/troca/estimativa a reusar
- `src/domain/fuel-calc.js` — consumível já calculado por sessão
- `_archive/propostas-2026-05-13/migrations-banco/0022_pendencias_consumiveis.sql` — migration de pendências-consumíveis já desenhada
- `supabase/migrations/0005_pendencias.sql`, `0022_carros_gears_dyno.sql` — schema vigente
