# PRE_EVENT_CHECKLIST — Checklist de pré-evento

Checklist obrigatório antes de qualquer evento (track day, treino, validação, sessão de testes). O objetivo operacional é declarado por **stint**, não por evento — ver Etapa 4.

Este checklist alimenta o módulo de planejamento e a tela de eventos da aplicação. Vale para todo evento, sem exceção.

> **Decisão Flavio 2026-04-27 + handoff 04-28 (Frente B):** estratégia/objetivo é por STINT, não por evento. Cada evento tem N stints; em cada stint o piloto/engenheiro escolhe o tipo (aquecimento / ataque / consistência / teste / livre — extensível). Esse tipo alimenta as sugestões da IA. O evento carrega só identidade (nome + data + local opcional). Ver `feedback_fam_objetivo_por_stint.md`.

## Etapa 1 — Identidade do evento

Sem identidade, o evento não pode ser criado.

```
Nome do evento: ____________________  (ex: "Copa Brasília — Etapa 1")
Data de início: __/__/____             (compõe chave única com o nome)
Local (opcional): __________________  (autódromo — Frente C move pra entidade Track)
```

Duplicata por { nome+data } é rejeitada pelo app.

## Etapa 2 — Plano do dia

```
Evento: ____________________________
Data: ______________________________
Pista: _____________________________
Piloto(s): _________________________
Carro: _____________________________
Configuração inicial: ______________
Combustível inicial: ___ L
Pneus instalados: ____ (composto, idade)
Pressão alvo D/T: ____ / ____ psi
Stints planejados: __ (número)
```

## Etapa 3 — Checklist de carro

```
[ ] Carro pronto mecanicamente
[ ] Pressões calibradas (frias)
[ ] Freios revisados (pastilhas, fluido, discos)
[ ] Combustível suficiente para o stint planejado + reserva
[ ] Câmeras ligadas e gravando (cockpit, onboard)
[ ] GNSS / GPS captando (RaceBox ou iPhone)
[ ] Sensores Injepro reportando todos canais críticos
[ ] Pirômetro disponível e calibrado
[ ] Tablet / Mini PC do box ligados, conectados à nuvem
[ ] Comunicação box ↔ piloto testada
[ ] Cinto, capacete, luvas, balaclava do piloto
[ ] HANS / colar
[ ] Extintor checado
[ ] Fluidos (água, refresco) para o piloto entre stints
```

## Etapa 4 — Plano de stints

Para cada stint planejado:

```
Stint #__
Hora prevista: ______
Voltas alvo: ______
Combustível: ____ L
Pressão alvo: D ___ T ___
Composto pneu: ______
Objetivo do stint: __________________________
Tipo de abordagem: aquecimento / ataque / consistência / teste / livre
Trechos-foco: _______________________________
FocusMode: auto / manual piloto / sugestão engenheiro
Critério de abortar: ________________________
Critério de chamar para box: ________________
```

Sem objetivo do stint, o stint não começa. O sistema bloqueia.

## Etapa 5 — Critério de abortar (geral)

Lista mínima — eventos críticos disparam abortar automático ou manual:

```
[ ] Bandeira vermelha na pista
[ ] Temperatura motor acima do limite seguro
[ ] Temperatura freio acima do limite seguro
[ ] Pressão óleo abaixo do limite
[ ] Falha de canal crítico de telemetria
[ ] Comportamento mecânico anormal (vibração, ruído, fumaça)
[ ] Piloto comunicar problema
[ ] Box decidir
```

Cada item tem regra associada quando há canal de telemetria. Sem canal, é decisão humana.

## Etapa 6 — Critério de chamar para o box

```
[ ] Stint completou voltas planejadas
[ ] Detecção de degradação que justifique parada
[ ] Janela ótima de pirômetro/pressão atingida
[ ] Decisão estratégica do engenheiro
[ ] Pedido do piloto
```

## Etapa 7 — Validação do plano

Antes do primeiro stint:

```
[ ] Plano escrito e visível no box
[ ] Piloto leu e confirmou objetivo do PRIMEIRO STINT (tipo + trechos-foco)
[ ] Engenheiro leu e confirmou critério de abortar do stint
[ ] Mecânico leu e confirmou estado do carro
[ ] Telemetria está chegando ao box (ou está documentado que não — ver BLOCKERS.md)
[ ] HUD do piloto está reportando o que deveria
```

## Exemplos de objetivo de stint

**Aquecimento (Stint 1, manhã)**
```
Objetivo: aquecer carro
- Aquecer motor, freios, pneus
- Validar canais de telemetria
- Coletar baseline
- NÃO buscar tempo
Critério de sucesso: temperaturas estabilizadas + telemetria gravando todos canais
```

**Teste de setup**
```
Objetivo: validar mudança de pressão (28 → 26 psi traseira)
- 5 voltas válidas com pressão nova
- Comparar tempo de saída de curvas longas vs stint anterior
Critério de sucesso: delta de saída ≥ +1 km/h em 60% das curvas longas
Critério de abortar: piloto sente perda de tração descontrolada
```

**Ataque de tempo**
```
Objetivo: melhor volta possível
- Pneus novos, combustível mínimo
- Pista limpa
- Trechos-foco: Curva 3 (apex tardio), Saída do S
Critério de sucesso: PB pessoal +0,5s ou menos
Critério de abortar: pista molhada, tráfego pesado
```

## Reprovação do checklist

Reprovar o evento se:

- nome ou data do evento ausentes (identidade quebra)
- carro com item bloqueador (freio, motor, segurança)
- telemetria sem fallback documentado

Reprovar STINT (bloqueia início do stint) se:

- tipo de objetivo não declarado (Aquecimento / Ataque / Consistência / Teste / Livre — ou tipo custom)
- critério de abortar do stint ausente

## Integração com a aplicação

O módulo de planejamento da aplicação implementa este checklist. A tela de eventos exige só identidade (nome + data) — Frente B 2026-04-28. A tela de stint exige tipo de objetivo (select com tipos canônicos extensíveis — Frente A 2026-04-28). Critério de abortar e critério de sucesso ficam por stint na operação real.

Hoje (estado atual após Frentes A+B 2026-04-28):
- `app.html` modal NOVO EVENTO: 3 campos (nome / local / data) — só nome + data obrigatórios.
- `app.html` modal NOVO STINT: select `stint-objetivo` populado de `db.dados.objetivoTipos` (default = SEED 5 tipos), com opção `+ NOVO TIPO` que estende a lista em runtime.
- `src/app/app.js` namespace `stint`: `_popularDropdownObjetivo` + `aoTrocarObjetivo` + `confirmarNovoObjetivo` + `cancelarNovoObjetivo`.
- Card de stint em `stint.renderLista()` mostra badge `[data-tipo="objetivo"]` com o tipo escolhido.
