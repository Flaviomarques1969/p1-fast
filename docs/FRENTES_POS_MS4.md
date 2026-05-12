# Frentes pós-MS-4 — registro de pendências grandes

> **Data de registro:** 2026-05-12
> **Origem:** 27 perguntas (rodada 1) + 10 perguntas (rodada 2) sobre roteiros MS-4 (StintPlan) e MS-11 (Vídeo ao vivo) — respostas do Flávio em `.claude-perguntas/respostas/20260511-213000-*.json` e `20260511-220000-*.json`.
> **Motivo deste documento:** o Flávio descreveu 3 sistemas grandes (Pessoas multi-papel, IA orientando piloto, Checklist em tempo real) e a triagem volta-por-volta da gravação. Para manter o MS-4 fazível em 6 etapas, esses 4 temas foram retirados do MS-4 e registrados aqui como frentes próprias futuras.

---

## Frente F1 — Unificação de pessoas multi-papel

**O que é:** hoje o código tem tabelas separadas `pilotos` e `passageiros`. Os mockups da Onda 1 (PR #174) já aprovados pelo Flávio mostram **uma única entidade "Pessoa"** com múltiplos papéis selecionáveis ao mesmo tempo: Piloto, Engenheiro de pista, Mecânico, Coach, Passageiro, Convidado, Chefe da equipe (este último vai entrar no MS-4).

**Por que não cabe no MS-4:** migração de dados. Sessões antigas têm `piloto_id` ligado a `pilotos`. Mudar pra `pessoas` exige:
- Mover dados de `pilotos` e `passageiros` para `pessoas`
- Reescrever todas as referências
- Atualizar 10+ telas que mostram piloto/passageiro
- Atualizar sincronização Supabase

**Risco principal:** quebrar histórico de dados de pilotos em produção.

**Escopo proposto da frente F1:**
1. Schema novo `pessoas` (id, nome, altura, peso, nascimento, time_id, created_at, updated_at, synced_at)
2. Schema `pessoa_papeis` (pessoa_id, papel) — relação 1:N pra múltiplos papéis
3. Migração que copia `pilotos` e `passageiros` para `pessoas` + popula `pessoa_papeis`
4. Atualizar `sessoes.piloto_id` para apontar pra `pessoas.id`
5. Reescrever PilotoRepository e PassageiroRepository pra usar `pessoas`
6. Telas de cadastro e listagem unificadas (mockups da Onda 1 já estão prontos)
7. Validação de que nenhuma sessão histórica quebrou

**Dependências:** nenhuma — pode rodar em paralelo com MS-4.

**Tamanho estimado:** 7 etapas.

---

## Frente F2 — IA do piloto (P1 Coach)

**O que é:** Flávio descreveu (resposta 1.3 da rodada 2):
> "A IA vai observando o desempenho dele em função do desempenho em cada trecho, a partir da melhor passagem naquele trecho. Então, se ele freou antes, se ele freou depois, ela vai administrando isso. Além disso, tem uma outra forma de ele agir, que é quando ele escolhe ser treinado com determinada habilidade das lições que nós temos. A IA então entra também na tela direita e vai colocando as orientações para que ele possa seguir o desempenho antes da curva, antes de chegar no trecho. E imediatamente depois do trecho ela faz um resumo e já paga para poder se preparar para o próximo trecho."

**Base já existente no código:**
- `src/domain/p1-coach.js` — primeira versão rascunhada
- `src/domain/lesson-schema.js` — schema P1TrackLesson com categorias, níveis, sinais requeridos
- Tabela `licoes` no banco (já está em produção)
- Vocabulário em `src/data/coach-phrases.js`

**Por que não cabe no MS-4:** comportamento de IA orientando piloto exige integração com telemetria ao vivo + UI no cockpit + lógica de timing (antes da curva, durante, depois). É uma frente complexa.

**Escopo proposto da frente F2:**
1. Detector de trecho ativo (qual trecho da pista o piloto está agora)
2. Comparador de desempenho (Vmin, freio, acel) vs melhor passagem registrada
3. Mecanismo de seleção de habilidades (quando piloto escolhe ser treinado em "Frear mais tarde curva 3")
4. UI na tela direita do cockpit do piloto pra mostrar orientação antes do trecho
5. Resumo pós-trecho (1-2 frases curtas)
6. Persistir histórico de orientações + reação do piloto

**Dependências:** MS-4 precisa ter ficado pronto (campo "IA ligada" no stint serve de gatilho).

**Tamanho estimado:** 6-8 etapas.

---

## Frente F3 — Sistema de checklist em tempo real

**O que é:** Flávio descreveu (resposta 1.5 da rodada 2):
> "Existe um padrão de Checklist para saída do carro, durante a pista, pode ser que planejou uma parada no box, tem um Checklist para ser feito, e no encerramento do Stint. Os Checklists são montados com obrigatórios e adicionais... na hora de planejar o evento que são definidos os papéis, as pessoas recebem esse Checklist e elas vão cumprindo o Checklist, e esse Checklist vai sendo atualizado no sistema e no Command Box, por exemplo, o mecânico foi lá e checou a pressão dos pneus, quando ele termina de fazer a checa de cada pneu, ele informa, pneu traseiro esquerdo, checado qual foi a pressão que ele encontrou, e por aí vai..."

**Base já existente no código:**
- Tabelas `pendencias_template` (catálogo curado, GLOBAL) + `evento_pendencias` (instâncias por evento) — em produção
- Suporte a obrigatório vs adicional, grupo, observação
- Mockup `mockup-pendencias-cascata.html`

**Falta:**
- Atribuição de pendências por papel (mecânico recebe as do carro, engenheiro recebe as de pista, etc.)
- Estados intermediários (em andamento, valor parcial coletado — "pneu traseiro esquerdo OK, pressão 24 psi")
- Atualização ao vivo no Command Box
- Diferenciação 3 momentos: saída do carro, parada no box, encerramento

**Por que não cabe no MS-4:** mexe em 4 telas (cadastro de pendências, atribuição por papel, Command Box ao vivo, cockpit do piloto antes de sair).

**Escopo proposto da frente F3:**
1. Estender `pendencias_template` com campo `papel_responsavel` e `momento` (saida/box/encerramento)
2. Estender `evento_pendencias` com campos de progresso (status, valor_coletado, coletado_por, coletado_em)
3. Tela do mecânico pra cumprir checklist do carro (com input de valor — pressão, torque, etc.)
4. Tela do Command Box mostrando progresso em tempo real
5. Sinalização piscando antes do piloto sair (obrigatórios pendentes)
6. Notificação pra próxima parada no box (X voltas antes)

**Dependências:** MS-4 (paradas no box ficam no schema) e F1 (papéis das pessoas).

**Tamanho estimado:** 8-10 etapas.

---

## Frente F4 — Triagem volta-por-volta da gravação de vídeo

**O que é:** Flávio descreveu (resposta 2.5 da rodada 2):
> "O sistema exige automaticamente depois de iniciar o outro Stint, mas até lá, o chefe de equipe ou piloto também pode entrar no Stint e escolher quais voltas ele quer guardar. E aí tem que ter as informações da volta, o tempo de cada uma, para poder saber exatamente qual foi."

**Por que não cabe no MS-11 inicial:** MS-11 etapas 1-7 entregam o stream ao vivo + display no box + fallbacks. Triagem de gravação por volta exige:
- Daily.co configurado pra gravar (custo extra)
- Indexação por volta (tempo, número, tempo de início/fim do trecho no vídeo)
- Tela de triagem com lista de voltas (tempo, volta nº, manter/descartar)
- Lógica "ao iniciar próximo stint, força triagem do anterior"
- Storage permanente das voltas mantidas

**Escopo proposto da frente F4:**
1. Habilitar gravação no Daily.co (cobrança extra, decisão do teto US$ 50/mês cobre)
2. Tabela `volta_video` (volta_id, video_url, t_inicio_ms, t_fim_ms, mantida bool)
3. Indexador: durante o stream, marca o instante de cada cruzamento da linha
4. Tela de triagem ao encerrar stint (lista de voltas com play, tempo, manter/descartar)
5. Bloqueio "novo stint força triagem do anterior pendente"
6. Permissão de triagem: piloto + chefe da equipe

**Dependências:** MS-11 etapas 1-8 prontas.

**Tamanho estimado:** 5-6 etapas.

---

## Resumo executivo

| Frente | Tamanho | Depende de | Pode rodar paralelo a |
|---|---|---|---|
| F1 — Pessoas multi-papel | 7 etapas | nada | MS-4 |
| F2 — IA do piloto | 6-8 etapas | MS-4 | F3, F4 |
| F3 — Checklist em tempo real | 8-10 etapas | MS-4, F1 | F2, F4 |
| F4 — Triagem volta-por-volta | 5-6 etapas | MS-11.1-8 | F2, F3 |

**Total estimado:** 26-31 etapas adicionais após MS-4 e MS-11 ficarem prontos.

**Ordem sugerida:** F1 (paralela a MS-4) → MS-11 → F2/F3/F4 (a definir prioridade pelo Flávio).

---

## Histórico das decisões que geraram este documento

- Rodada 1 (27 perguntas): `.claude-perguntas/respostas/20260511-213000-roteiros-ms4-ms11.json`
- Rodada 2 (10 perguntas): `.claude-perguntas/respostas/20260511-220000-detalhes-ms4-ms11.json`
- Registrado também em `~/.claude-decisoes/respostas/p1-fast/` e indexado em `~/.claude-decisoes/index.jsonl`.
