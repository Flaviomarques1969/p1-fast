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

### Fato 1 — o software não acumula uso, MAS as duas fontes autoritativas existem no hardware

`carros` (migrations `0001_initial.sql:147` e `0022_carros_gears_dyno.sql`) tem `apelido, modelo, categoria, cor, redline, gear_ratios, dyno_curve`. **Nenhum acumulador de uso no banco.** O que existe de "uso" hoje no software:

- `stintsPorCarro` — contagem de sessões por carro (`CarroRepository.swift:57`).
- `Pneu.ciclos` + `tire-wear.js` — voltas no pneu por composto.
- `Volta` por sessão.

**Porém, as duas âncoras certas existem no hardware** (atualização Flávio 2026-05-31):

- **Horas de motor → a T4000 tem horímetro nativo.** A ECU mantém um contador de horas de motor autoritativo (inclusive horas de **antes** do sistema existir). Não preciso derivar integrando RPM. **Pendência conhecida:** o parser atual (`web/cockpit/t3000-usb-parser.js`) lê 30+ sensores mas **não extrai o horímetro** — ele tem `cronometroParcialS`/`cronometroTotalS` (cronômetro de volta), que **não é** horímetro de motor. Falta localizar o offset do horímetro no bloco de ~460 bytes (engenharia reversa, igual ao conserto da sonda lambda 2026-05-26) ou lê-lo via o software oficial INJEPRO. É o único trabalho de descoberta do item zero.
- **Km → RaceBox Mini S** (decisão Flávio 2026-05-31). GNSS 25 Hz (precisão até ~10 cm) + IMU, pareado com o notebook/Mini PC que fica no carro (`RACEBOX_INTEGRATION_SPEC.md`) — hardware dedicado, independente do iPhone estar em foreground, resolve o problema de o iOS matar a captura em background (STATUS.md). E como **o carro só anda na pista** (não roda em rua), todo km medido é km de pista: não há mais a distinção rua×pista. **Nota:** isto reverte o arquivamento do RaceBox de 2026-05-01 (`BLOCKERS.md §E4`, `PENDENCIAS_GATE.md` P2) — ver §10.

**Conclusão:** o "item zero" deixa de ser "construir um acumulador derivado do zero" e vira "**ler o horímetro autoritativo da T4000 + integrar a distância do GPS fixo**". Mais simples e mais confiável. Detalhe em §5.

### Fato 2 — o Celta real tem metade dos sensores que o protocolo T4000 prevê

`T4000_CAN_SPEC.md` cataloga pressão de óleo, pressão de combustível, temp do ar, EGT, etc. Mas `FONTE_DADOS_AO_VIVO.md` (validado em campo 2026-05-26 contra o software oficial INJEPRO T LINE) registra que **no Bubi NÃO estão instalados**: pressão de óleo, pressão de combustível, temp de ar, sonda NB. Pedal e freio são mecânicos.

**Chega de fato hoje** (stream USB ao vivo): `RPM, TPS, tensão de bateria, temp de água, lambda WB, MAP` + acelerômetro, velocidade, pedal/pressão de freio e bitfield de alarmes. O **horímetro de motor existe na ECU mas ainda não é extraído** pelo parser (ver Fato 1).

**Conclusão:** critérios baseados em pressão de óleo são teóricos no Bubi (sensor ausente). Ficam documentados como "se um dia instalar", nunca como gate ativo.

### Fato 3 — divisão de trabalho T4000 × GPS

A T4000 **nunca** dá GPS, posição, aceleração, pressão/temperatura real de pneu (anti-catálogo da spec). Esses vêm do **iPhone** (CoreLocation 1 Hz + CoreMotion 100 Hz, já no pipeline de telemetria, ADR-018).

- **Horas de motor** = **horímetro nativo da T4000** (autoritativo; só falta extrair o offset do stream). Não é mais derivado de RPM.
- **Km de pista** = ∫ velocidade · dt → **RaceBox Mini S** (GNSS 25 Hz, pareado com o Mini PC no carro, `source: 'racebox'`). Como o carro só anda na pista, é tudo km de pista. A velocidade da T4000 valida cruzado.
- **Ciclos térmicos** = stints em que a água cruzou o limiar quente → **T4000** (temp água).

---

## 3. Os relógios disponíveis (e qual dá pra automatizar)

| Relógio | Como se mede | Automação | Fonte |
|---|---|---|---|
| **Horas de motor** | horímetro nativo da ECU (autoritativo) | **Automático** (após extrair offset) | T4000 (horímetro) |
| **Km de pista** | Σ ∫velocidade·dt por stint | **Automático** | RaceBox Mini S (GNSS 25 Hz) |
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
| 1 | **Óleo de motor + filtro de óleo** | G1 Mecânica | Horas de motor | ~15 h | Calendário 6 meses | horímetro acumulado; tendência de temp de óleo *(se sensor)* | T4000 (horímetro) | **Alta** |
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

(O carro só anda na pista, então não há km de rua a perder — o GPS fixo cobre 100% do uso real.)

---

## 5. Item zero — as âncoras de uso por carro

Sem isto, o resto é só checklist manual com data. É a fundação. As duas âncoras principais vêm do hardware (não são mais derivadas):

| Âncora | Origem | Natureza |
|---|---|---|
| `horas_motor` | **horímetro nativo da T4000** | Valor absoluto lido da ECU (snapshot por stint). Cobre inclusive horas anteriores ao sistema. |
| `km_pista` | **RaceBox Mini S** (GNSS 25 Hz) — Σ ∫velocidade·dt | Acumulado por stint. Carro só anda na pista → 100% do uso. |
| `sessoes` | já existe (`stintsPorCarro`) | += 1 por stint |
| `ciclos_termicos` | T4000 (temp água) | += 1 se a água cruzou ~85 °C e esfriou |

Observações de projeto:

- **Horímetro é leitura, não cálculo.** O sistema guarda o valor do horímetro da ECU no momento de cada troca e compara com o valor atual. Isso é mais robusto que integrar RPM (não acumula erro, sobrevive a stints não capturados). **Bloqueio único:** extrair o offset do horímetro no stream da T4000 (engenharia reversa do bloco de bytes ou leitura via software oficial INJEPRO). É o item de pesquisa do F1.
- **Km é append-only friendly** — cada stint contribui um delta de distância GNSS; o total é soma, recomputável a partir dos stints (alinha ADR-004/014). O RaceBox, por ficar pareado com o Mini PC do carro, captura mesmo quando o app iOS está em background. Dependência: parser do protocolo BLE do RaceBox (módulos `racebox-ble-reader` / `racebox-packet-parser` / `racebox-provider` ainda não existem — `RACEBOX_INTEGRATION_SPEC.md` §Implementação; precisa do PDF do protocolo oficial).
- Reusa o gancho que o `tire-wear.js` já provou (`registrarStint`): a função roda no fim do stint, lê o horímetro/distância, atualiza os contadores.
- Edição manual permitida como fallback (corrigir leitura, carro novo). Igual hodômetro de banca.

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
| **F0.1** | **Extrair o horímetro da T4000** (offset no stream ou via software oficial) + **integrar o RaceBox Mini S** (reader/parser/provider BLE, `source: 'racebox'`) | hardware do Flávio + PDF do protocolo RaceBox |
| **F1** | Âncoras de uso por carro (horas/km/sessões/ciclos) + integração no fim do stint | F0.1 |
| **F2** | Catálogo `consumivel_tipo` + `consumivel_instalacao` + domínio puro de estado (com smokes) | F1 |
| **F3** | Painel "Consumíveis" na Garagem (SwiftUI) — fonte da verdade | F2 + Xcode |
| **F4** | Espelho em pendências obrigatórias (MS-5 + migration arquivada 0022) | F2 + MS-5 |

F0.1 é a única dependência de hardware: o horímetro precisa ser extraído do stream da T4000 e o RaceBox Mini S precisa ser integrado (reativado — ver §10). Mas o **calendário (fluido de freio, correia, arrefecimento) e sessões já funcionam sem nada disso** — então o domínio puro (F2), o painel (F3) e o espelho em pendências (F4) podem entregar valor com os relógios de calendário/sessões enquanto horas e km não chegam. Quando o horímetro e o GPS fixo entrarem, os itens mecânicos ganham seu relógio sem mudar a arquitetura.

---

## 10. Decisões abertas para o Flávio

1. **Calibrar os limites** da tabela §4 (horas/meses de cada item) — os valores são chute conservador de engenharia, não verdade.
2. **Horímetro da T4000:** o valor está no stream USB (precisa achar o offset, engenharia reversa) ou só no software oficial INJEPRO? Isso define se a leitura é ao vivo ou um snapshot manual por sessão. — *pesquisa de F0.1*
3. **Reativação do RaceBox (decisão de projeto, não só desta função):** usar o RaceBox Mini S reverte o arquivamento de 2026-05-01. Outros docs ainda o tratam como arquivado e precisam ser atualizados em conjunto: `BLOCKERS.md §E4`, `PENDENCIAS_GATE.md` P2, `RACEBOX_INTEGRATION_SPEC.md` (status no topo), `docs/RUNBOOK_RETOMAR.md`, e a memória `p1-fast-racebox-rebaixado-2026-05-01.md`. Confirma que quer que eu propague a reativação por esses docs? (Não toquei neles ainda — alerto em vez de escolher sozinho, conforme `CLAUDE.md`.) Definir também: o RaceBox publica no mesmo transporte/canal do cockpit (notebook → Realtime) ou é fonte separada no pipeline?
4. **Acumulador em `carros` ou tabela separada** `carro_uso` (recomendo separada, recomputável).
5. **Catálogo de consumíveis global curado vs por time** desde o início (sugiro nascer curado, virar editável como MS-5 fez com pendências).
6. **Itens que valem para outros carros** além do Celta (a tabela §4 é Celta-específica nos limites; a estrutura é genérica).

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
