# TECHNICAL_DIRECTOR_DECISION_LOG — Log permanente de decisões

Memória de governança do produto. Toda decisão do Diretor Técnico fica aqui — aprovada, reprovada, aprovada com ajustes, e o motivo.

Append-only. Não editar entradas anteriores. Para revisar uma decisão antiga, criar entrada nova referenciando a anterior.

Formato de cada entrada:

```
## YYYY-MM-DD — <título curto>

### Entrega avaliada
### Ambiente
### Pergunta respondida
### Decisão
Aprovada / Reprovada / Aprovada com ajustes
### Motivo
### Riscos identificados
### Ajustes obrigatórios
### Observação técnica
### Apex considerado?
Sim / Não / Não aplicável
### Confiança da análise
Alta / Média / Baixa
### Sessão / commit / PR
```

---

## 2026-04-24 — Criação da camada RaceOps Technical Director Gate

### Entrega avaliada
Camada de governança técnica e de produto criada em `docs/raceops/`. 15 arquivos:
- TECHNICAL_DIRECTOR_GATE.md
- PRODUCT_FOCUS_RULES.md
- DELIVERY_REVIEW_CHECKLIST.md
- FEATURE_ACCEPTANCE_CRITERIA.md
- PILOT_QUESTIONS_MATRIX.md
- ENGINEER_QUESTIONS_MATRIX.md
- BOX_TO_PILOT_TRANSLATION_RULES.md
- APEX_ANALYSIS_RULES.md
- CORNER_ANALYSIS_RULES.md
- PRE_EVENT_CHECKLIST.md
- ALERT_HIERARCHY.md
- POST_STINT_REVIEW_TEMPLATE.md
- POST_EVENT_REVIEW_TEMPLATE.md
- TECHNICAL_DIRECTOR_DECISION_LOG.md (este arquivo)
- AUDITORIA_INICIAL_DIRETOR_TECNICO.md

### Ambiente
Governança — abrange piloto, box engenheiro, box piloto, pré-evento, pós-evento e administração.

### Pergunta respondida
"Como impedir que o sistema perca o foco enquanto evolui?" — pergunta meta, não de pista.

### Decisão
Aprovada.

### Motivo
Resposta a pedido explícito do Flavio (sessão 2026-04-24): criar camada permanente de governança que obrigue toda nova entrega a passar pelo Diretor Técnico. Princípio: "telemetria não é produto; o produto é a resposta de decisão".

### Riscos identificados
1. Camada de governança que não é aplicada vira papel morto. Mitigação: integrar com fluxo real de entrega (PR / commit / decision log).
2. Critérios podem virar obstáculo burocrático se aplicados ao pé da letra a entregas pequenas. Mitigação: o gate exige preencher os 14 campos do `FEATURE_ACCEPTANCE_CRITERIA.md` apenas para feature nova; ajustes pequenos seguem o `DELIVERY_REVIEW_CHECKLIST.md` que é mais leve.
3. Auditoria inicial pode reprovar muita coisa e gerar paralisia. Mitigação: distinguir "Aprovado com ajustes" de "Reprovado" com clareza, priorizar ajustes por impacto.

### Ajustes obrigatórios
Nenhum — primeira versão entregue como solicitada. Próximas iterações refinam conforme casos reais aparecem.

### Observação técnica
- Compatível com `ARCHITECTURE_DECISIONS.md` existente (em particular ADR-008 "IA não em segurança crítica" — reforçada pelo `ALERT_HIERARCHY.md`).
- Não conflita com SPECs travadas (`SPEC_BOX_VISUAL.md`, `SPEC_COCKPIT.md`, `SPEC_MENSAGENS.md`, `SPEC_FOCO_TRECHO.md`) — adiciona camada de governança acima delas.
- Memória do projeto atualizada com pointer para a camada.

### Apex considerado?
Sim — `APEX_ANALYSIS_RULES.md` e `CORNER_ANALYSIS_RULES.md` são pilares da camada e impõem que toda análise de curva trate apex como entidade central.

### Confiança da análise
Alta.

### Sessão / commit / PR
Sessão 2026-04-24 (continuação após "painel Box polido + operação máxima instalada"). Sem commit ainda — Flavio decide quando commitar.

---
## 2026-04-24 — 9 ajustes da auditoria aplicados

### Entrega avaliada

Aplicação dos 9 ajustes pontuais identificados na `AUDITORIA_INICIAL_DIRETOR_TECNICO.md` (seção "Aprovados com ajustes"):

1. [`src/domain/track-segment.js`](../../src/domain/track-segment.js) — adicionados campos opcionais `apexReference`, `apexStrategy`, `apexClassificationDefault`, `cornerType`, `nextStraightLength` + enums `ApexStrategy`, `CornerType`, `ApexClassification` (12 classificações canônicas) + helper `hasFullApexCadastro()`.
2. [`src/telemetry/fase-curva.js`](../../src/telemetry/fase-curva.js) — expostos `apexT`, `apexIdx`, `apexKmh` nos stats (timestamp do ponto de menor velocidade dentro da fase MEIO).
3. [`src/telemetry/detector.js`](../../src/telemetry/detector.js) — `SegmentExecution` agora carrega `apexT`, `apexOffset`, `apexActual: { x, y }` capturado durante `_updateSegment` (ponto de menor velocidade dentro do trecho).
4. [`src/domain/error-classifier.js`](../../src/domain/error-classifier.js) — taxonomia expandida com 5 novos rótulos: `apex-perdido-fora`, `apex-antecipado`, `apex-tardio`, `apex-interno-demais`, `apex-sacrificou-saida`. Helper `classifyApex()` + heurística `apexSacrificouSaida()` (apex bom + saída comprometida + reta seguinte longa).
5. [`api/advisor.js`](../../api/advisor.js) — prompt ampliado: seção GOVERNANÇA (setup só depois de excluir pilotagem; curva via sequência entrada→frenagem→turn-in→apex→retomada→saída→reta; "nao_mexer" obrigatório; confiança Alta/Média/Baixa). Output JSON estrito ganha campos `nao_mexer[]`, `como_validar`, `confianca_texto`, e `risco` por ajuste.
6. [`api/post-stint.js`](../../api/post-stint.js) — prompt ganha mesma seção GOVERNANÇA + `nao_mexer[]` OBRIGATÓRIO + `confianca_texto`. Falhas em curva devem indicar ponto da sequência.
7. [`src/box/post-stint.js`](../../src/box/post-stint.js) — modal agora renderiza 4ª coluna "O que NÃO mexer" (azul/info) + confiança em texto + grau %. CSS `pos-grid-4` adicionado em [`src/box/box.css`](../../src/box/box.css) (4 colunas desktop, 2 em ≤1100px).
8. [`src/box/compare-view.js`](../../src/box/compare-view.js) — tabela ganha bloco "Velocidades por trecho" (entrada/mínima/saída em km/h), com `diffRowKmh` invertendo semântica de cor (mais rápido = verde). Quando telemetria não disponível, mostra "Dados insuficientes — depende de telemetria live" (alinhado à Regra 8 do `PRODUCT_FOCUS_RULES.md`).
9. [`src/domain/attack-priority.js`](../../src/domain/attack-priority.js) — novo método `computeForTrechos()` espelha `compute()` mas opera por trecho, com fator de repetibilidade por trecho opcional e razão textual.

Side-fixes aplicados durante a validação visual (bugs pré-existentes):

- [`src/box/box.css`](../../src/box/box.css) — arquivo iniciava sem `/*` abrindo o comentário, o que estava engolindo o bloco `:root` no parse do navegador. Corrigido.
- [`src/box/compare-view.js`](../../src/box/compare-view.js) — chamadas a `escapeHtml()` que não estava importado (import é `esc`); substituídas por `esc()`. Sem isso, `openCompare()` quebrava com ReferenceError.

### Ambiente

- Captação/processamento: `track-segment`, `fase-curva`, `detector`, `error-classifier`.
- Nuvem: `/api/advisor`, `/api/post-stint`.
- Box engenheiro (TV 32"): `compare-view`, `post-stint` (cliente), `attack-priority`.
- Box → piloto: frases de apex entram na biblioteca (`BOX_TO_PILOT_TRANSLATION_RULES.md`).

### Pergunta respondida

"Como transformar a auditoria em código que realmente respeita o gate?" — aplicar os ajustes aprovados-com-ajustes na primeira passada, sem criar módulos novos ainda.

### Decisão

Aprovada.

### Motivo

Todos os 9 ajustes são incrementais sobre módulos já aprovados; nenhum introduz dependência nova; todos são retrocompatíveis (campos opcionais); análise de curva agora cobre a sequência completa com apex como entidade central — lacuna mais grave identificada na auditoria.

### Riscos identificados

1. `error-classifier.js` — heurística de apex usa distância euclidiana 2D no viewBox como aproximação de "delta lateral". Correto só para curvas aproximadamente perpendiculares ao eixo do viewBox. Substituir por projeção tangencial quando o cadastro do `TrackSegment` tiver tangente/normal. Risco baixo no curto prazo: é heurística, não critério crítico.
2. Prompt da IA ganhou campos obrigatórios (`nao_mexer`). Respostas antigas em `advisorSuggestions` não têm esses campos — o cliente `post-stint.js` já trata ausência com mensagem "advisor antigo". Sem regressão.
3. CSS `pos-grid-4` usa media query 1100px para colapsar em 2×2. Para TV 32" FHD (1920) isso é irrelevante; em tablets abaixo de 1100 o modal fica com 2 colunas — comportamento intencional. Validado via inspeção estrutural.
4. Correção do `/*` inicial em `box.css`: mudança em arquivo grande; validado via reload com cache busting + leitura de variáveis CSS (`--bom`, `--critico`, `--atencao`, `--neutro`) resolvendo corretamente em elementos reais.

### Ajustes obrigatórios

Nenhum. Próxima iteração sugerida: cadastrar `apexReference`/`apexStrategy`/`nextStraightLength` para os 8 trechos de Brasília em `seed-tracks.js` para ativar classificação de apex em modo pleno (hoje opera em modo degradado).

### Observação técnica

- Validação UI: modal post-stint com 4 colunas + cores semânticas corretas confirmado via `preview_eval` + `preview_screenshot` + inspeção de `getComputedStyle`. Modal compare exibindo 4 parciais + 8 trechos + bloco "Dados insuficientes — depende de telemetria live" confirmado via accessibility-tree textual. Console sem erros após os ajustes.
- Os 2 bugs pré-existentes (CSS inicio, compare-view escapeHtml) foram corrigidos por necessidade de validação — ambos eram invisíveis até esta sessão. Registrados aqui para rastro.
- Nenhum módulo novo foi criado. Features pendentes maiores (pré-evento módulo, `/api/post-event`, regras determinísticas de alerta, menu V2, migração V1) ficam para blocos futuros — ver `AUDITORIA_INICIAL_DIRETOR_TECNICO.md` §"Ajustes prioritários".

### Apex considerado?

Sim. 5 dos 9 ajustes tocam apex diretamente (track-segment, fase-curva, detector, error-classifier, prompts da IA). O cadastro completo de apex para Brasília fica pendente para próxima rodada.

### Confiança da análise

Alta para os ajustes de código (Edits precisos, validação por leitura e inspeção). Média para o comportamento de classificação de apex em produção — depende do cadastro e da qualidade dos dados do detector, que aguarda hardware (BLOCKERS.md E3/E4).

### Sessão / commit / PR

Sessão 2026-04-24 (continuação imediata da criação da camada `docs/raceops/`). Sem commit — Flavio decide quando.

---
## 2026-04-24 — Adição do Chief Telemetry Engineer Gate

### Entrega avaliada

Criação do segundo guardião da camada de governança em `docs/raceops/`. 12 documentos novos do gate de telemetria + atualizações de índices (este log + MEMORY + PENDENCIAS_GATE + TECHNICAL_DIRECTOR_GATE) + nova memória `fam-racing-chief-telemetry-engineer-gate.md`.

Lista completa em `TELEMETRY_ENGINEERING_DECISION_LOG.md` §primeira entrada.

### Ambiente

Governança — toda entrega que toca dado.

### Pergunta respondida

"Como impedir que o sistema pareça inteligente com dados ruins?" — pergunta meta, complementar à do Diretor Técnico ("como impedir dashboard bonito sem decisão?").

### Decisão

Aprovada.

### Motivo

Resposta a pedido explícito do Flavio (sessão 2026-04-24, prompt de RaceOps Technical Director + Chief Telemetry Engineer Gate). Os dois gates trabalham em paralelo: Diretor Técnico revisa "responde pergunta real?", Engenheiro-Chefe de Telemetria revisa "dado é confiável?". Toda entrega que toca dado precisa de ambos os carimbos.

A camada inclui specs hipotéticas para T4000 e RaceBox marcadas claramente como pendentes de validação (BLOCKERS.md E2 e E4) — explícitas para impedir cravar protocolo no código sem origem documental rastreável.

### Riscos identificados

1. Dois Decision Logs separados podem desincronizar. Mitigação: regra "toda entrega que toca dado tem entrada em ambos os logs com data idêntica e referência cruzada".
2. Specs hipotéticas (T4000, RaceBox) podem ser tratadas como verdade se alguém ler superficialmente. Mitigação: status "HIPÓTESE / VALIDAÇÃO PENDENTE" em destaque no topo de cada spec.
3. Aumenta carga cognitiva (dois checklists, dois logs). Mitigação: o gate de telemetria só se aplica a entregas que tocam dado — entregas puramente visuais ou de fluxo administrativo seguem só pelo Diretor Técnico.

### Ajustes obrigatórios

Nenhum — primeira versão entregue como solicitada.

### Observação técnica

- 10 dos 10 módulos de `src/telemetry/` foram lidos integralmente para a auditoria. 8 aprovados, 2 aprovados com ajustes, nenhum reprovado, nenhum não-avaliado.
- Lacunas reais são módulos que **não existem** (TelemetryTimebase, TelemetrySnapshotBuilder, CrossValidationEngine, TelemetryReplayEngine, TelemetryTestFixtures, T4000*, RaceBox*) — registrados em `PENDENCIAS_GATE.md` (P0/P1/P2/P3 conforme criticidade).
- ADRs do projeto compatíveis (ADR-004, 008, 014, 015) — gate reforça e amplia.

### Apex considerado?

Não aplicável — esta entrega é meta-governança. Apex permanece coberto pelo gate anterior.

### Confiança da análise

Alta para os documentos criados (specs internas e auditoria de código existente). Média para spec T4000 (hipótese) e parcial para RaceBox (hipótese parcial — depende de PDF oficial).

### Sessão / commit / PR

Sessão 2026-04-24, continuação da rodada anterior (Diretor Técnico Gate + 9 ajustes da auditoria). Sem commit — Flavio decide quando.

---

## 2026-04-24 — Cockpit do piloto: design system + delta/apex + lap time + catálogo de alertas

### Entrega avaliada

Primeira rodada do redesenho do cockpit aplicando design system completo antes de pixel (escolha do Flavio), cena âncora delta + apex, expansão de Contexto com lap time e voltas restantes, e esqueleto do catálogo determinístico de alertas.

Arquivos criados:
- [`docs/DESIGN_SYSTEM_COCKPIT.md`](../DESIGN_SYSTEM_COCKPIT.md) — spec travada (OKLCH, tipografia modular, ritmo 8px, motion).
- [`src/cockpit/design-tokens.css`](../../src/cockpit/design-tokens.css) — tokens + layout.
- [`.claude/agents/fam-cockpit-design-critic.md`](../../.claude/agents/fam-cockpit-design-critic.md) — critic ultra-especializado no cockpit (hardware IBW 10.5" FHD).
- [`src/cockpit/cockpit-display.js`](../../src/cockpit/cockpit-display.js) — renomeado de cockpit-view.js, ganhou `renderTempos` + regra do delta sem sinal.
- [`src/cockpit/deterministic-alerts.js`](../../src/cockpit/deterministic-alerts.js) — catálogo de 5 regras (pressão óleo, temp motor, pressão combustível, bateria, RPM) com limites placeholder marcados `status: 'placeholder'`.

Arquivos tocados:
- [`cockpit.html`](../../cockpit.html) — grid novo (contexto · apex · dominante · ação · especial) + bootstrap da cena âncora.
- [`src/cockpit/cockpit-state.js`](../../src/cockpit/cockpit-state.js) — slots `apex`, `tempos`, `alertas` + singleton global.
- [`src/cockpit/phrases.js`](../../src/cockpit/phrases.js) — `FrasesApex` canonizadas.

### Ambiente

Display do Piloto — monitor IBW 10.5" FHD 1920×1080 dentro do carro. Sem toque.

### Pergunta respondida

**1ª**: "Como fica o cockpit do piloto se tratarmos design system completo primeiro e cena âncora delta + apex?" — entrega visual funcional no preview.

**2ª** (após consulta ao Diretor Técnico pelo Flavio): "Tem alguma outra informação que o piloto precisa no cockpit?" — lacunas críticas (lap time, voltas restantes, alertas determinísticos) identificadas e 2 de 3 atendidas nesta rodada; alertas ficam em placeholder à espera de calibração da Injepro T4000.

**3ª** (decisão de Flavio durante a rodada): "Delta deve ser mostrado com sinal `−`/`+` ou só número + cor?" — decisão canônica: **número absoluto, cor obrigatória**. Verde se `delta ≤ 0` (igualou ou melhorou), vermelho se `delta > 0` (piorou). Documentada em `DESIGN_SYSTEM_COCKPIT.md §2.5`.

### Decisão

Aprovada com ajustes.

### Motivo

- Design system permanente criado (OKLCH, escala modular, tokens — 11 cores semânticas, 10 tamanhos tipográficos, ritmo 8px).
- Critic rodou 2 vezes (1ª com 2 críticos + 3 recomendados; 2ª com 2 recomendados e **VEREDICTO: APRESENTAR**).
- Diretor Técnico rodou 1 vez — aprovou com 3 lacunas críticas, 2 atendidas nesta rodada.
- Regra do delta sem sinal atende pedido explícito de Flavio (simplifica leitura periférica de 150ms).
- Cena âncora funcionando: CURVA DO PLACAR · V 08/12 · APEX · 1:16.842 · BEST 1:15.980 · 4 voltas · apex entrada 112 / apex 78 ativo / saída pendente · delta 0.18 verde · ação "APEX TARDE" amarelo.

### Riscos identificados

1. **Alertas determinísticos em placeholder.** 5 regras catalogadas com `limit: null`. Não disparam nada até calibração com Injepro T4000 do Celta do Flavio. Risco: falsa sensação de segurança se alguém ver "alertas existem" sem ler o status. Mitigação: `status: 'placeholder'` explícito em cada regra + helper `calibrationSummary()` pra painel do engenheiro listar pendências.
2. **Cache de módulo ES do browser** atrapalhou a iteração em dev — resolvido com cache-bust via query (`?v=X`) + singleton global (`globalThis.__FAM_COCKPIT_STATE__`). Risco residual em produção: nenhum (SW + ETag cuidam, e remover `?v=` é 1 edit).
3. **Rename `cockpit-view.js` → `cockpit-display.js`** forçou URL nova no browser pra quebrar cache. Arquivos dependentes (sw.js, testes) continuam apontando pro nome antigo — `cockpit-view.js` foi mantido no disco como resolução lazy pra não quebrar, mas deve ser limpo em rodada de cleanup.

### Ajustes obrigatórios

Pendentes (ficam pra próxima rodada, NÃO bloqueiam apresentação da cena âncora):

1. **Calibrar limites dos 5 alertas determinísticos** com T4000 do Celta — requer captura CAN real (BLOCKER E2 resolvido parcialmente com PDF oficial Injepro). Alterar `limit: null` → valor calibrado + `status: 'calibrado'`.
2. **Cadastrar `apexReference`/`apexStrategy`/`nextStraightLength`** nos 8 trechos de Brasília em `seed-tracks.js`. Enquanto ausente, classificação de apex opera em modo degradado.
3. **Limpar referências a `cockpit-view.js`** no `sw.js` (PRECACHE) e em testes, substituindo por `cockpit-display.js`. Deletar o arquivo antigo quando ninguém mais apontar.
4. **3ª lacuna do Diretor Técnico não atendida**: cadastrar os alertas com limites reais. Depende de (1).

### Observação técnica

- Critic final emitiu "APRESENTAR" sem bloqueadores. 2 RECOMENDADOS aplicados na sequência (chip de fase `--fw-bold`, halo de severidade removido em estado `corrida`).
- Severidade do dominante só ganha halo em estados fortes (`ultima-volta-forte`, `alerta-critico`), conforme `DESIGN_SYSTEM_COCKPIT §8`.
- Filosofia respeitada: pouca info (um número dominante por vez), silêncio default (especial oculta), cor semântica absoluta (sem gradiente, sem novos hues), sem projeção de volta.

### Apex considerado?

Sim — apex é o eixo mais bem coberto do cockpit hoje. Faixa de apex (entrada → apex → saída) com estados (pendente/ativo/feito/bom/erro), chip de fase no contexto, frases canônicas (`FrasesApex`: Apex cedo, Apex tarde, Mais/Menos interno, Priorize saída, Boa curva) — todas integradas à biblioteca do broker.

### Confiança da análise

Alta para cena âncora + design system + cobertura de apex. Média para alertas determinísticos (depende de calibração). Alta para regra do delta (decisão direta do Flavio, simplifica leitura).

### Sessão / commit / PR

Sessão 2026-04-24 (continuação de "painel Box polido + operação máxima instalada" → cockpit). Sem commit — Flavio decide quando.

---

## Próximas entradas

A partir daqui, toda entrega do projeto cria entrada nova neste log antes de ser declarada concluída.

Tipos de entrada esperados:
- Aprovação de feature nova
- Aprovação de ajuste em feature existente
- Reprovação com ajustes obrigatórios
- Reabertura de decisão anterior (referenciando entrada antiga)
- Decisão de "não fazer" (também é decisão de produto)

---

## 2026-04-28 — Card de evento (lista) reformulado

### Entrega avaliada
Refator do card de evento na lista do `/app`: botão REMOVER movido pro canto sup. direito (resolve bug de `<button>` aninhado), confirm com texto explícito de impacto, header limpo (nome + sublinha mono "DD/MM/AAAA · LOCAL" sem traço), tiles por dia (1/2/3 grid responsivo) com voltas e melhor tempo, tile vazio com border tracejada e label "SEM DADOS". Arquivos: `src/app/app.js:485-530`, `src/app/app.css:341-460`.

### Ambiente
Hub administrativo do piloto (`/app`). Tela de listagem de eventos.

### Pergunta respondida
Pergunta do piloto: "como vai esse evento?" — quantos dias rodei, quantas voltas, qual foi o melhor tempo, quanto da preparação está concluído (% checklist + pendências).

### Decisão
Aprovada com ajustes.

### Motivo
Refator atende UX: card vira sumário denso e informativo. Atende `feedback_fam_racing_sem_fases.md` (sem versionamento), `feedback_fam_sem_icones.md` (texto puro). Critic invocado e fixes aplicados (REMOVER 44px, tile vazio com dashed border, sub mono 12px tabular).

### Riscos identificados
1. Tile lê `dia.resumo.voltas` e `dia.resumo.melhorMs` mas NENHUM código escreve esse objeto — entidade `EventoResumo`/`DiaResumo` não existe. Tile ficará permanentemente "SEM DADOS" até populador ser criado. **Trata-se na entrega P0 #1 da auditoria 2026-04-28.**
2. Confirm usa `confirm()` nativo do browser — viola padrão visual FAM. Fica na pendência P1 #8 (modal customizado).

### Ajustes obrigatórios
- Criar `EventoResumo` + `DiaResumo` + populador (P0 #1).
- Substituir `confirm()` nativo por modal `.modal[data-mode="confirm"]` (P1 #8).

### Observação técnica
Bug original: `<button class="ev-card">` continha `<button class="ev-card__del">`; HTML5 não permite, parser extraía o filho. Solução: card virou `<div role="button" tabindex="0">` com `onkeydown` Enter/Espaço — preserva acessibilidade.

### Apex considerado?
Não aplicável — tela de gestão, não de pista.

### Confiança da análise
Alta.

### Sessão / commit / PR
Sessão 2026-04-28; sem commit ainda.

---

## 2026-04-28 — Modal stint redesign PARCIAL (lap-picker + placa + lock + config base)

### Entrega avaliada
Redesign parcial do modal de stint (`#modalStint`): (a) carro lock quando 1 carro cadastrado (label estático racing); (b) placa do número estilo pista (#48px display + número 56px mono + borda 2px FAM red, full-width); (c) config base pré-selecionada automaticamente (pré-existia bug de "— sem configuração —"); (d) lap-picker visual (30 segmentos clicáveis + display 40px mono + stepper `−5 −1 +1 +5`). Arquivos: `app.html:545-660`, `src/app/app.js:2080-2230`, `src/app/app.css:1796+`.

### Ambiente
Hub administrativo do piloto (`/app` → DIA → STINT). Modal de criação/edição de stint.

### Pergunta respondida
Pergunta do piloto: "como cadastro este stint sem fricção?" — fricção principal era input number/select genéricos onde o domínio pede componentes de identidade racing (placa de carro, escala visual de voltas).

### Decisão
Reprovada com ajustes — entrega declarada como "modal stint redesign" mas é PARCIAL. 3 de 7 controles foram premiumizados; 4 continuam em formato HTML genérico (config como `<select>`, objetivo como `<select>`, override-add como `<select>`, notas como `<textarea>`).

### Motivo
Os 3 controles que ficaram premium estão excelentes (critic aprovou após 4 fixes: SF Mono no display, carro lock 60px de altura, hash subido pra 48px, ticks com classe). Mas misturar premium com básico no MESMO modal viola `feedback_fam_proatividade.md` ("repensar a tela como um todo, não só substituir token"). O usuário enxerga inconsistência.

### Riscos identificados
1. Usuário pode interpretar a mistura como "Claude entrega fraco" — perda de confiança.
2. Pendências de migração viram dívida técnica em `fam-racing-modal-stint-pendencias.md` em vez de roadmap explícito.
3. Decisão Log não criado no momento da entrega — atendido retroativamente nesta entrada.

### Ajustes obrigatórios
- Renomear status interno: "modal stint redesign PARCIAL — 3 de 7 controles premiumizados".
- Atacar pendências (1) tiles de config, (2) IA sugerir objetivo, (3) trechos a melhorar, (4) overrides inline no SETUP, (5) salvar overrides como config.
- A partir desta sessão, design-critic invocado ANTES de codar (não DEPOIS).

### Observação técnica
Lap-picker default 10 voltas, range visual 1-30, stepper permite extrapolar (até 200) com indicador "+N" no display.

### Apex considerado?
Não aplicável — tela de gestão.

### Confiança da análise
Alta.

### Sessão / commit / PR
Sessão 2026-04-28; sem commit ainda.

---

## 2026-04-28 — Memória "5 pendências do modal stint"

### Entrega avaliada
Memória `fam-racing-modal-stint-pendencias.md` criada com 5 features pedidas pelo Flavio em 2026-04-28 que ficaram pra próximos turnos: tiles de config, IA sugerir objetivo, trechos a melhorar com destaque no cockpit, overrides inline no SETUP EFETIVO, salvar overrides como nova config nomeada. Sequência sugerida 4 → 5 → 1 → 2 → 3.

### Ambiente
Governança — registro de roadmap explícito.

### Pergunta respondida
"Como impedir que features pedidas viraram dívida técnica invisível?" — meta-pergunta de processo.

### Decisão
Aprovada.

### Motivo
Documentar pendências em memória do projeto (não em código TODO) é a forma certa: permite recuperação em qualquer conversa futura, traz why + how to apply de cada item, força confirmação antes de começar.

### Riscos identificados
1. Pendências podem virar arquivo morto se ninguém revisitar. Mitigação: `fam-compliance-controller` checa pendências como parte da auditoria.
2. Sequência sugerida (4→5→1→2→3) pode não ser a melhor — exige confirmação do Flavio antes de implementar.

### Ajustes obrigatórios
Nenhum — registro como solicitado.

### Observação técnica
Memória registrada em `/Users/imac/.claude/projects/-Users-imac-Projetos-FAM-Racing/memory/`. Indexada em MEMORY.md.

### Apex considerado?
Não aplicável.

### Confiança da análise
Alta.

### Sessão / commit / PR
Sessão 2026-04-28.

---

## 2026-04-28 — Camada de governança (hooks bloqueantes + subagent compliance)

### Entrega avaliada
Camada dupla de governança em `.claude/`: (1) hooks `pre-tool-guard.sh` (PreToolUse Edit|Write — bloqueia emoji em UI, edição em `cockpit.html` prod, rótulos versionados em código), `ui-check.sh` reforçado (cobre `app.html` + `src/app/*` + `src/components/*`), `stop-sanity.sh` reforçado (lembra TD/CTE/Decision Log). (2) subagent `fam-compliance-controller` em `.claude/agents/` (auditor de processo invocado manual). Settings.local.json com PreToolUse adicionado. Memória `fam-racing-controlador-conformidade.md` registrada.

### Ambiente
Governança — meta-camada do harness do Claude Code, sem efeito direto no produto.

### Pergunta respondida
"Por que Claude reincide em ignorar pre-flight, escolher componentes básicos, pular gates?" — diagnóstico honesto seguido de reforço estrutural mecânico (hooks bloqueantes, não dependentes da memória do agente).

### Decisão
Aprovada.

### Motivo
Hook bloqueante demonstrou eficácia imediata: bloqueou 2 Writes do próprio Claude na sessão (mensão "v2" e "placeholder depois" em texto descritivo) — provando que a rede funciona. Exceção pra paths de governança (`.claude/agents/*`, `docs/raceops/*`, memórias) refinada após primeiro falso positivo.

### Riscos identificados
1. Regex de emoji pode capturar caracteres semânticos (`●`, `→`) usados legitimamente em color picker e hints. Hoje não captura, mas se range expandir, pode haver false positives.
2. Stop-sanity hook só avisa, não bloqueia — Decision Logs podem continuar vazios se Claude ignorar lembrete.
3. Subagent compliance-controller depende de invocação manual — Claude pode esquecer.

### Ajustes obrigatórios
- Documentar whitelist semântico no próprio script.
- Avaliar mover gates obrigatórios de Stop pra PreToolUse condicional (bloquear se entrega declarada sem entry no Decision Log na mesma sessão).
- Próxima rodada deve INVOCAR fam-compliance-controller antes de declarar entrega.

### Observação técnica
4 hooks ativos: SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, Stop. Cobertura testada empiricamente com 3 cenários (emoji, cockpit prod, rótulo versionado) — todos bloquearam corretamente.

### Apex considerado?
Não aplicável.

### Confiança da análise
Alta.

### Sessão / commit / PR
Sessão 2026-04-28.

---

## 2026-04-28 — Auditoria de sistema (5 agentes paralelos, 141 achados)

### Entrega avaliada
Reavaliação completa do sistema FAM Racing solicitada pelo Flavio. 5 agentes paralelos auditaram App / Box / Cockpit Mobile / Backend / Compliance. Relatório consolidado em `docs/raceops/AUDITORIA_SISTEMA_2026-04-28.md` com 141 achados (50 críticos), top 12 bloqueadores transversais, 5 violações de processo, plano P0 + P1.

### Ambiente
Governança — auditoria geral.

### Pergunta respondida
"Onde o sistema está abaixo do padrão super premium?" — pergunta meta-produto do Flavio.

### Decisão
Aprovada.

### Motivo
Auditoria entrega lista acionável (cada item: arquivo:linha + descrição + fix). Top 12 bloqueadores agrupam padrões transversais ao sistema, evitando atacar item por item sem visão sistêmica. Plano P0 → P1 ordenado por impacto e dependência.

### Riscos identificados
1. 141 achados podem causar paralisia se atacados sem priorização. Mitigação: P0 com 5 itens transversais, P1 com 3 UX.
2. Pré-condição inflexível (Decision Logs retroativos antes de qualquer P0) declarada explicitamente.
3. Achado #1 (`dia.resumo` lido sem ser escrito) bloqueia entregas anteriores — só fica resolvido após criar `EventoResumo`/`DiaResumo`.

### Ajustes obrigatórios
- Atacar P0 #5 (Decision Logs retroativos — esta entrada é parte) antes de qualquer outro P0.
- Cada item P0 vira entrada própria no Decision Log ao concluir.

### Observação técnica
Agentes paralelos foram do tipo Explore (4) + general-purpose (1 compliance). Custo total ~470k tokens. Saída consolidada em arquivo único pra referência futura.

### Apex considerado?
Sim — APEX_ANALYSIS_RULES.md aplicado quando relevante (achados de cockpit/box). Não houve achado direto em apex como entidade.

### Confiança da análise
Alta.

### Sessão / commit / PR
Sessão 2026-04-28; sem commit ainda.

---

## 2026-04-28 — Execução P0 + P1 da auditoria sem parar

### Entrega avaliada
8 itens entregues em sequência: P0 #5 (Decision Logs retroativos), P0 #1 (`EventoResumo`/`DiaResumo` em `src/domain/evento-resumo.js` + populador integrado em `app.js` boot/save/delete), P0 #2 (badge "SIMULADO" persistente em `body[data-modo="demo"]` no Box e Cockpit Mobile), P0 #3 (validador Zod-light em `api/_lib/schemas.js` aplicado nos 5 endpoints `/api/*`), P0 #4 (`sample-bus` multi-listener + integração condicional `SessionRecorder` em cockpit-mobile.html), P1 #8 (modal `.modal--confirm` racing substitui 11 `confirm()` nativos), P1 #6 (tile selector `.tile-grid` aplicado em config do modal stint), P1 #7 (date picker `.fam-date` + time picker `.fam-time` modais racing aplicados nos 5 inputs nativos do app).

### Ambiente
Hub administrativo (`/app`), Box (`/box`), Cockpit Mobile, Backend Vercel.

### Pergunta respondida
"Quão rápido podemos destravar os 12 bloqueadores transversais identificados na auditoria sem perder qualidade racing?" — execução em rajada controlada por hooks bloqueantes + Decision Log obrigatório.

### Decisão
Aprovada com ajustes.

### Motivo
Cada P0 ataca um bloqueador estrutural (dado fantasma, demo enganando, payload tóxico, pipeline silencioso, governança vazia). Cada P1 destrava o caminho premium dos componentes ainda básicos. Validação: 11 testes de schema passam, modal/tiles/calendar/timepicker validados via screenshot, `dia.resumo` calculado corretamente (16 voltas + 1:29.540 melhor tempo no caso teste).

### Riscos identificados
1. SessionRecorder requer track configurado (svgPath + linhaChegada). Sem isso, samples ficam só em storage — comportamento honesto mas não fecha o pipeline.
2. Tile selector aplicado APENAS em config; objetivo + override-add ainda são `<select>`. Inconsistência interna no modal stint resolvida só parcialmente.
3. Date/time picker aplicados nos 5 lugares-alvo, mas há outros lugares no projeto (cadastro de pendência, pós-stint) que ainda usam input nativo.
4. Decision Log entries desta rodada feitas EM bloco no fim, não a cada item — pequena violação do "registrar ao concluir cada item".

### Ajustes obrigatórios
- Próxima rodada: aplicar tile-grid em objetivo + override-add (modal stint).
- Próxima rodada: rodar `fam-design-critic` formal nas 8 entregas (até agora só validação visual em screenshot).
- Cobertura de testes: criar `tests/node-smoke-evento-resumo.mjs` pro populador.

### Observação técnica
Hook bloqueante PreToolUse provou-se eficaz: capturou 2 violações próprias durante esta rodada (rótulos descritivos em arquivos de governança) — exceção pra paths governance documentada e funciona.

### Apex considerado?
Não aplicável diretamente — entregas são infraestruturais. Achado #1 (`dia.resumo`) abre caminho pra futuro `apex.snapshot` quando pipeline conectar.

### Confiança da análise
Alta.

### Sessão / commit / PR
Sessão 2026-04-28; sem commit ainda.

---

## 2026-04-28 — Modal stint COMPLETO + loop dado→tile fechado (F1+F2)

### Entrega avaliada
Duas frentes da tarde executadas em sequência:

**F1 — loop dado real (`/app` tile do evento):**
- `src/domain/evento-resumo.js` (novo) — entidades `EventoResumo`/`DiaResumo` + populador `enriquecerDiasComResumo()` que busca `db.laps` por `(carId, diaInicioMs, diaFimMs)` e calcula `voltas` + `melhorMs` + `quality: 'MEDIDO' | 'INFERIDO' | 'VAZIO'`.
- `src/cockpit/sample-bus.js` (novo) — bus multi-listener pra `MobileTelemetry` permitir HUD + SessionRecorder consumirem o mesmo stream simultaneamente.
- `cockpit-mobile.html` — `_maybeStartSessionRecorder()` em `enterCockpit()` quando o track tem `svgPath + linhaChegada` (precondição honesta).
- `src/app/app.js` `bootApp()` agora chama `enriquecerDiasComResumo()` após Dexie pronto, populando tiles na lista de eventos.
- **Validação:** smoke test gerou 8 laps reais → tile renderizou `8 VOLTAS · 0:00.050` com `quality=MEDIDO`. Pipeline ponta-a-ponta verde.

**F2 — modal stint 100% premium racing (resolve a reprovação parcial registrada acima neste log):**
- **Override picker inline** (5 grupos × 14 tipos via `OVERRIDE_SCHEMAS` declarativo, label de grupo mono caps vermelho).
- **Trechos a melhorar** — multi-select dos trechos do autódromo do evento, salva em `stint.trechosFoco[]` (futuro: cockpit destaca durante corrida).
- **Salvar overrides como nova config** — botão "atencao" aparece quando overrides ativos; abre modal nomear → cria config mesclada via `getEffectiveSetup()` → vincula stint à nova config (rastreável).
- Demais controles confirmados premium: place-num 48px display + 56px mono FAM red, lap-picker 30 segmentos, carro lock label 60px, config tiles, objetivo tiles, date/time pickers customizados aplicados em ev-data, dia-data, config-data, ev-hora-inicio, ev-hora-fim.

### Ambiente
- F1: Hub administrativo (`/app`), Cockpit Mobile (`?role=cockpit`), pipeline interno (`src/domain` + `src/cockpit`).
- F2: Hub administrativo (`/app` → DIA → STINT). Modal de criação/edição de stint.

### Pergunta respondida
- F1: "como impedir que o tile permaneça em 'SEM DADOS' eternamente após corrida real?" — populador chamado no boot lê `db.laps` por carro + janela do dia e materializa `dia.resumo`. Resolve achado #1 da auditoria.
- F2: "como entregar a reprovação anterior (modal stint PARCIAL — 3 de 7) com os 7 controles em padrão racing premium?" — quatro controles restantes (override-add, objetivo, config, trechos-foco) reformulados pra tile/picker visual + persistência rastreável.

### Decisão
Aprovada.

### Motivo
- F1 fecha o loop crítico dado→tile que abriu como achado P0 #1; smoke test confirmou `quality=MEDIDO` com 8 laps reais.
- F2 supera a entrega anterior reprovada: zero `<select>` HTML genérico no modal; override picker permite combinar PNEUS+ALINH+SUSP+FREIOS+MOTOR sem cair em formulário; trechos a melhorar entram no domain (`stint.trechosFoco[]`) com gancho explícito pra cockpit.
- Date/time pickers e tile selector aplicados em todas as 5 entradas do modal; confirm modal racing substitui 11 `confirm()` nativos (rastreável em git diff `app.html` e `app.js`).
- Decision Log entry F1 já parcialmente coberta na rodada consolidada P0+P1 acima; esta entry retroativa é o registro do F2 + reforço explícito do pipeline F1.

### Riscos identificados
1. **F1 — `enriquecerDiasComResumo()` busca `db.laps` por `carId` + janela `diaInicioMs..diaFimMs`.** Se `dia.dataISO` for inconsistente com `lap.tMono`/`lap.criadoEm`, laps reais ficam invisíveis. Mitigação: smoke test passou no caso "TESTE PIPELINE REAL" (15/05/2026) — caso geral exige assert no populador (criar `tests/node-smoke-evento-resumo.mjs`, listado como ajuste obrigatório).
2. **F1 — `quality: 'MEDIDO'` é binário hoje.** Não distingue `MEDIDO_HONESTO` vs `MEDIDO_DEGRADADO` quando volta tem flag `valida=false` (out-lap, in-lap, banner amarelo). Risco real só quando dataset crescer; para hoje é aceitável.
3. **F2 — `stint.trechosFoco[]` salva mas cockpit ainda não destaca.** Pendência declarada em `fam-racing-modal-stint-pendencias.md` (item #3, IA sugerir + cockpit highlight). Não bloqueia F2 mas precisa entry futura quando integrar.
4. **F2 — Salvar override como config promove a config sem versionamento.** Se piloto editar config-base depois, configs derivadas não notam. Aceitável pra MVP — domain documenta `derivadaDeConfigId` opcional (não usado ainda).
5. **F2 — Override picker carrega `OVERRIDE_SCHEMAS` declarativo.** Adicionar tipo novo exige só extender o schema; risco de drift baixo. Validar via Zod-light (já aplicado nos 5 endpoints, item P0 #3) quando override sair pro backend.

### Ajustes obrigatórios
- Criar `tests/node-smoke-evento-resumo.mjs` cobrindo `(populador idempotente)`, `(carId divergente)`, `(janela vazia)` — listado em "próxima sessão" do checkpoint.
- Próxima rodada: cockpit-mobile destacar `stint.trechosFoco[]` durante corrida (memória pendência #3).
- Próxima rodada: IA sugerir objetivo do stint a partir do contexto do evento + histórico (memória pendência #2).
- Aplicar tile/date/time pickers em pós-stint + pendência (telas restantes que ainda usam input nativo).

### Observação técnica
- F2 fechou com 5 fixes do design-critic da rodada anterior (modal evento limpo + autódromo Dexie + override picker inline + trechos a melhorar + salvar como config). Critic novo `fam-design-critic` foi disparado em background ao fim da sessão (agentId `a3ddf315561ff38f4`); resultado pode ser consultado ou re-rodado nesta sessão.
- Entries pareadas no `TELEMETRY_ENGINEERING_DECISION_LOG.md` (F1 toca dados, F2 não — só F1 vai no log de telemetria).
- Esta entry retroativa fecha a pré-condição inflexível de Decision Log obrigatório por rodada (achado #5 da auditoria de processo).

### Apex considerado?
Não diretamente. F2 abre caminho pra cockpit destacar `stint.trechosFoco[]` durante curva — ganchos pra apex específico do trecho ficam na rodada futura.

### Confiança da análise
Alta para F1 (smoke test ponta-a-ponta com `quality=MEDIDO`) e F2 (todos os 7 controles premium validados via `preview_screenshot` + critic prévio aplicado). Média para "futuro do trechos-foco" (depende de cockpit conectar — pendência declarada).

### Sessão / commit / PR
Sessão 2026-04-28; sem commit ainda. Esta entry é retroativa, registrada na sessão seguinte (também 2026-04-28).

---

## 2026-04-28 — F3 cleanup Box + Cockpit Mobile (11 fixes da auditoria 2026-04-28)

### Entrega avaliada
Rodada de cleanup que ataca os críticos restantes da auditoria. **Box (5):** dead code removido (`renderPirometroLegacy`, `renderSemafaroPneu`); cleanup do `setInterval` do clock (`_clockHandle` + `stopClock` exportado); 4 pastilhas de pneu ganharam labels DE/DD/TE/TD com hierarquia tipográfica (label 9px mono cinza + valor 11px colorido, padding 2/5px, min-width 30px); G lateral/longitudinal classifica por intensidade absoluta (`classeG()`: `<0.30` neutro / `<0.70` ok / `<1.10` warn / `≥1.10` bad); comentário em `renderDinamica` agora explicita ordem `pneuTempD = [DE_int, DE_ext, DD_int, DD_ext]`. **Cockpit Mobile (6):** `dom__value` ganhou text-shadow (4×stroke 1px hard + 1×glow 16px soft, todos OKLCH); `apex__label` mobile subido de 13px → 16px hardcoded com JSDoc; `iphoneStorage._preSessionBuffer` (cap 200) drena no `startSession`; `_closeCurrentChunk` agora persiste chunk vazio com flag `isEmpty=true`; `iphoneUploader` early-skip explícito de chunks vazios; `cockpit-mobile.html onStatus` GPS=erro dispara `cockpitState.setCritico('GPS sem sinal')` (slot crítico, não especial); `enterCockpit` guard duro pra evento incompleto + aviso `setEspecial('Vídeo offline','sistema')`.

### Ambiente
- Box `/box` (TV 32" 1920×1080).
- Cockpit Mobile (`cockpit-mobile.html` — iPhone 16 Pro Max landscape).
- Cleanup transversal em `src/box/box-view.js`, `src/box/box-layout.js`, `src/box/box.css`, `src/cockpit/cockpit-mobile.css`, `src/cockpit/iphone-storage.js`, `src/cockpit/iphone-uploader.js`, `cockpit-mobile.html`.

### Pergunta respondida
"Os 12 críticos restantes da auditoria 2026-04-28 (B2-B3 do Box + C1-C5 do Cockpit Mobile) destravam o sistema pra próxima rodada de telemetria real?" — sim, todos endereçados; pipeline está honesto, persistência tem flag pra distinguir lacuna de perda, alertas de sistema vão pro slot crítico.

### Decisão
Aprovada.

### Motivo
- **fam-design-critic** (Box) deu **APRESENTAR** com 1 ajuste obrigatório (validar `gLat=1.30 → bad`) e 1 recomendado (subir `tt-k` 8→9px). Ambos aplicados antes desta entry.
- **fam-cockpit-design-critic** primeira passada deu AJUSTAR com 2 críticos: (1) `setEspecial(...,'critico')` viola SPEC_MENSAGENS — GPS sem sinal é alerta CRITICAL e vai pra slot dedicado; (2) uploader não tinha cobertura explícita de `chunk.isEmpty`. Ambos aplicados.
- **fam-cockpit-design-critic** segunda passada deu **APRESENTAR** confirmando regressão zero (grep `setEspecial(..., 'critico')` retornou 0 ocorrências; text-shadow 100% OKLCH; coexistência crítico+especial sem overlap).
- Critic apontou achado falso ("`isEmpty` não gravado") — verificação direta em `iphone-storage.js:188-202` confirmou `this.currentChunk.isEmpty = true` ANTES do `db.telemetryChunks.put`. Critic errou contexto do grep. Comportamento em produção é correto.

### Riscos identificados
1. **`classeG()` faixa `bad ≥ 1.10g` não é alcançada pelo demo** (`liveFromDemo` cap em ~1.10g) — validei a regra em produção via `preview_eval` injetando 1.30g manualmente. Pneu de pista dedicado pode passar 1.30g normalmente; nesse caso painel ficaria vermelho "permanente" como dívida de calibração. Próxima rodada: tornar faixas dependentes do composto cadastrado (`STREET → 1.10`, `SEMI → 1.30`, `SLICK → 1.50`).
2. **`apex__label 16px hardcoded`** está fora da escala mobile (fs-2=13, fs-3=14). Decisão: NÃO subi `--fs-2` pra evitar inverter escala. Dívida cosmética — virar token `--fs-apex-label-mobile` em rodada futura ou repensar escala mobile inteira.
3. **Stroke escuro do `dom__value` reduz peso percebido em vermelho** (chroma 0.26 + L 68% + glow preto = "carimbo"). Critic admitiu "aceito sob luz solar; estética inferior fora dela". Avaliar em campo (iPhone real, sol direto).
4. **GPS+critico+dominante simultâneos**: quando GPS some, o piloto perde delta confiável, mas dominante continua mostrando o último valor verde. Crítico pré-existente da arquitetura, não desta rodada — abrir como pendência: `setCritico('GPS')` deveria suprimir `dominante.delta` (ou marcá-lo `data-stale=true`).
5. **Chunk vazio com `isEmpty=true`** muda contrato de `telemetryChunks` no Dexie sem migração — compatibilidade backward é OK (campo opcional), mas se um futuro consumer assumir esquema fixo, quebra. Documentar no schema de Dexie.
6. **`iphoneStorage._preSessionBuffer` cap 200** = 4s de IMU @50Hz ou 200s de GPS @1Hz (mix realista: ~3-5s de buffer). Suficiente pra cobrir Promise.allSettled do `enterCockpit` (~1-2s). Se o `startSession` demorar mais, drop silencioso (com stat).

### Ajustes obrigatórios
Nenhum dentro do escopo desta rodada. Roadmap aberto:
- Tornar faixas de `classeG` dependentes do composto cadastrado (futuro).
- `apex__label` virar token (futuro, junto com refator de escala mobile).
- Pendência `dominante.delta` stale quando GPS=erro (abrir item P3+).
- Smoke test `tests/node-smoke-evento-resumo.mjs` pendente desde F1 (continua aberto).

### Observação técnica
- Box screenshot validado em modo SIMULAR: 4 pastilhas DE/DD/TE/TD com cores, G LATERAL 1.04g em amarelo (warn), G LATERAL 1.30g em vermelho (bad — testado via injeção). Sem regressão visual.
- Cockpit Mobile screenshot validado em `?demo=1`: ENTRADA 112 verde / ÁPICE 78 amarelo / SAÍDA pendente; dominante 0.18s com text-shadow OKLCH; ÁPICE TARDE amarelo; **GPS SEM SINAL** vermelho na metade direita (slot crítico) quando setCritico ativado; "Vídeo offline" na especial quando guard de evento aborta.
- Sem erro no console em nenhuma das duas telas.
- Decision Log entry F1+F2 retroativa também registrada nesta sessão (acima neste log) — fecha a pré-condição inflexível de governança.

### Apex considerado?
Sim. `apex__label` agora 16px (era 13px) — informação crítica de orientação espacial (entrada / ápice / saída) ganhou leitura periférica estável. Hierarquia da faixa apex preservada (label 16px caps + valor 22px heavy + estado por cor).

### Confiança da análise
Alta. Cada fix validado via `preview_inspect` (specs concretas: font-size, color OKLCH, classes computadas) + `preview_screenshot` (regressão visual). Critics dispararam APRESENTAR após ajustes.

### Sessão / commit / PR
Sessão 2026-04-28 (continuação após F1+F2). Sem commit — Flavio decide quando.

---

## 2026-04-29 — Detector multi-fonte via snapshot (achado #4) + crossValidationEngine wired + frases canônicas T-011..T-013

### Entrega avaliada
Wiring completo do achado #4 da `AUDITORIA_SISTEMA_2026-04-28.md`. Pipeline single-source (`SessionRecorder.provider.onSample → detector.consume(sample)`) virou pipeline multi-source via snapshot. Mudanças:

1. **`src/telemetry/adaptive-tick.js` (NOVO)** — `createAdaptiveTick(timebase, opts)`. Heurística genérica percorre `timebase.sourceStatus()` procurando fonte com `expectedRateHz≥30 && quality===OK && ratePerSec≥0.7×expected`. Sobe pra 60Hz quando há fonte rápida saudável; cai pra 10Hz caso contrário. Re-avalia a cada 5s. Multi-consumer via subscribers internos (trocar de taxa NÃO afeta subscribers).
2. **`src/telemetry/timebase.js`** — patch leve: `Source.status()` agora expõe `expectedRateHz` (necessário pra heurística). Retrocompatível.
3. **`src/telemetry/session-recorder.js`** — adicionado `mode: 'sample' | 'snapshot'`. Default `'sample'` preserva legacy intacto. Em `'snapshot'`: AdaptiveTick → `detector.consumeSnapshot(snap)` + `extraConsumers[i](snap)`. ExtraConsumer com erro NÃO derruba detector (try/catch interno por consumer).
4. **`src/telemetry/cross-validation.js`** — `_emit` anota `confianca: 'Alta'` em todos os eventos por construção (regras determinísticas com janela mínima sustentada).
5. **`cockpit-mobile.html`** — `_maybeStartSessionRecorder` cria `SessionRecorder` em `mode='snapshot'` + `CrossValidationEngine` instância nova com `onEvent` mapeado por severidade pra `cockpitState`. Routing D2:
   - `severity='critico'` → `setCritico(_criticoFraseFromXv(ev))` mapeando V-005 → `Motor quente` (T-011), V-006 → `Pressão óleo` (T-012), V-007 → `Mistura pobre` (T-013), V-008 → `Bateria crítica` (canônica), default → `Verifique sistema` (defesa: `FrasesSistema.includes(frase) || fallback`).
   - `severity='atencao'` → `pushAlerta({id: 'xv-V-XXX', nivel, msg, canal, ts})`.
   - `severity='info'` → `console.info` only.
   - Guard endurecido: `if ((sev==='critico'||sev==='atencao') && ev.confianca !== 'Alta') return`.
   - `window.Cockpit.getCrossValidation = () => _crossValidation` (getter, referência viva). Idem `getSessionRecorder`.
   - `demoCritico` substituiu `'MOTOR 95°'` por `'Motor quente'` (frase canônica).
6. **`src/cockpit/phrases.js`** — `FrasesSistema` estendida 5→8: +`Motor quente` +`Pressão óleo` +`Mistura pobre` (T-011..T-013). Cache-bust `?v=3` em cockpit-mobile.html.
7. **`docs/SPEC_MENSAGENS.md` §6.4** — sincronizado com 3 frases novas + observação 2026-04-29 + ref cruzada T-011..T-013.
8. **`docs/raceops/BOX_TO_PILOT_TRANSLATION_RULES.md`** — adicionados T-011 (V-005 motor), T-012 (V-006 óleo), T-013 (V-007 lambda) com 4 campos canônicos cada. V-008 explicitamente reusa `Bateria crítica` canônica desde origem.
9. **`tests/node-smoke-detector-snapshot.mjs` (NOVO)** — 15 cases: AT-01..07 (AdaptiveTick: low/high/troca dinâmica/multi-consumer/stop/Quality.MISSING/ratePerSec abaixo do floor) + SR-01..08 (SessionRecorder mode=snapshot: tick→consumeSnapshot, extraConsumers, erros isolados, validação mode/timebase, mode=sample legacy preservado, stop fecha tick, integração real com Detector + CrossValidationEngine).
10. **`tests/node-smoke-overload-filter.mjs`** — assert `FrasesSistema.length === 5` atualizado pra `=== 8` + assertiva nova validando catálogo CONTÉM por nome `Motor quente`/`Pressão óleo`/`Mistura pobre`/`Bateria crítica`/`Verifique sistema`. Bump silencioso bloqueado.

### Ambiente
Cockpit Mobile (`cockpit-mobile.html` — iPhone 16 Pro Max landscape) + camada de telemetria (`src/telemetry/*` consumida em runtime). Sem efeito direto em Box ou App. Catálogo de mensagens (`docs/SPEC_MENSAGENS.md` + `BOX_TO_PILOT_TRANSLATION_RULES.md`) atualizado em governança.

### Pergunta respondida
"Detector e CrossValidationEngine recebem o estado consolidado do carro num só tick em vez de cada provider isolado?" — sim. iPhone single-source produz snapshot 10Hz hoje (V-002 IMU vs derivada já pode disparar; V-001/V-006/V-007/V-008 dormentes até T4000). Quando RaceBox + T4000 entrarem (Perna 2), fusão acontece transparente pelo timebase já existente e o tick adaptativo sobe pra 60Hz automaticamente sem refator.

Pergunta secundária: "O slot CRITICAL recebe frases canônicas validadas pelo TD?" — sim. Round 3 do `fam-cockpit-design-critic` deu APRESENTAR após estender FrasesSistema + sync §6.4 + ADR T-011..T-013 + cache-bust v=3 + remover string fora do catálogo do demo.

### Decisão
Aprovada.

### Motivo
- Pipeline multi-source via snapshot fecha gap arquitetural #4 da auditoria.
- ZERO regressão: 14 suites = 152 ok / 0 fail (incluindo `node-smoke-detector` legacy verde).
- Smoke novo cobre todos os ramos da heurística adaptativa (Quality.OK + ratePerSec saudável → high; LATE/MISSING → low; ratePerSec abaixo do floor → low; troca dinâmica forward+reverse).
- Frases curtas do slot CRITICAL agora 100% canônicas (FrasesSistema + SPEC_MENSAGENS §6.4 + BOX_TO_PILOT T-011..T-013). Guard de confiança rejeita eventos não-Alta. Defesa interna em `_criticoFraseFromXv` falha-segura pra `Verifique sistema` se algo escapar do catálogo.
- 3 rodadas de critics (`fam-cockpit-design-critic`): round 1 REPROVADO → fixes round 1 → round 2 REPROVADO (cache-bust v=2 + demo'MOTOR 95°') → fixes round 2 → round 3 APRESENTAR limpo.
- `fam-compliance-controller` APROVADO COM AJUSTES; todos endereçados (R5 AT-06+AT-07 com Quality.MISSING e ratePerSec abaixo do floor; R1+R2 são exatamente esta entry e a pareada CTE).

### Riscos identificados
1. **Adaptive-tick `setInterval(evaluateNow, 5000)`** segue rodando se caller esquecer stop. Custo trivial, mas em sessão muito longa caller que esquecer `tickController.stop()` deixa intervalo vazando. Hoje só `cockpit-mobile.html` triple-tap-exit faria isso, e ele recarrega via `location.href` (limpa tudo). Risco residual baixo.
2. **CrossValidationEngine instância nova por sessão** (não singleton) — onEvent fechado sobre escopo de `_maybeStartSessionRecorder`. Re-arranque na mesma página deixa instância anterior dangling. Hoje não acontece; risco residual baixo.
3. **V-001/V-006/V-007/V-008 dormentes até T4000** — comportamento honesto (regra retorna sem emitir se canal `null`). Mas piloto não tem feedback de que essas validações existem mas não rodam ainda. Roadmap: badge "Validações: X de Y ativas" no chip de telemetria.
4. **`AdaptiveTick.rateFloorPct = 0.7`** — escolha de design pra absorver jitter. Calibrar em campo real (Perna 1 ativa).
5. **`_routeXvEvent` rejeita info silenciosamente** — `console.info` em prod do iPhone não é visível. Eventos info ficam invisíveis. Aceitar (intencional — info por construção é diagnóstico de canal, não para piloto).
6. **Re-bump phrases.js?v=N** quando adicionar entrada futura é mandatório. Mitigado: smoke `node-smoke-overload-filter` valida que catálogo CONTÉM canônicas POR NOME — bump esquecido faz teste falhar imediatamente.

### Ajustes obrigatórios
Nenhum dentro do escopo. Roadmap aberto:
- Próxima rodada: F4 dinâmico via FocusMode + Detector eventos. Quando Detector emitir entrada/saída de trecho, slot `foco` em cockpit-state ativa naturalmente. Pendência #3 do `fam-racing-modal-stint-pendencias.md` agora destravada.
- Próxima rodada: visualização "validações ativas" no chip de telemetria.
- Próxima rodada: F5/F6 do modal stint (overrides inline + IA sugerir objetivo).
- Calibrar `rateFloorPct` em campo real.
- T4000 entrada (Perna 2) destrava V-001/V-006/V-007/V-008.

### Observação técnica
- F4 chip estático (rejeitado pelo critic na sessão 2026-04-28) foi descartado via `git reset --hard a0535f5` antes desta rodada — Flavio aprovou opção A (revert + atacar Detector) em pergunta fechada AskUserQuestion no início da sessão.
- AdaptiveTick verificado live no preview: `import('phrases.js?v=3').FrasesSistema.length === 8` E `['Motor quente','Pressão óleo','Mistura pobre'].every(includes)`.
- Eval real do CrossValidationEngine simulando V-006 (oil_pressure 1.0 bar @ rpm 4000, 2 ciclos com tMono ≥ janela mínima 2s) emitiu evento canônico com `severity='critico'` + `confianca='Alta'`.
- `Cockpit.demo.critico('on')` mostra `MOTOR QUENTE` em vermelho `--erro` 32px/900/ls 1.92px no slot CRITICAL canônico (boundingbox 277×32 sem clip).
- Decision Log entry CTE pareada nesta sessão (próxima entry no `TELEMETRY_ENGINEERING_DECISION_LOG.md`).

### Apex considerado?
Indireto. CornerAnalysis (V-009) é "derivada (corner-by-corner), não snapshot-by-snapshot" — não roda neste tick. Mas pipeline destrava o passo seguinte: quando `Detector.onSegmentEnd` emitir `apexT/apexOffset/apexActual`, próximo módulo (CornerAnalysis) consome essas execuções e pode produzir V-009. Construção sólida para esse passo.

### Confiança da análise
Alta. Cada módulo testado com fixtures (15 cases novos no smoke). Cada fix de critic validado live no preview com `preview_eval` + `preview_inspect` + `preview_screenshot`. Bateria 14 suites verde (152 ok / 0 fail). 3 rodadas de critics — última APRESENTAR.

### Sessão / commit / PR
Sessão 2026-04-29 (continuação direta de 2026-04-28). Working tree em main `a0535f5` antes desta rodada; commit nomeado consolidado escrito ao fim desta sessão substituindo os auto-saves intermediários.

