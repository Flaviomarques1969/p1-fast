# Última tarefa

> Tarefa ANTERIOR (Vista Piloto / Command Box) preservada em
> `ultima-tarefa-backup-vista-piloto-2026-06-14.md`.
> A tarefa de menu (Garagem/Pendências) abaixo está TASK_DONE; preservada na íntegra.

## TASK_INIT — 2026-06-14 (madrugada) — "siga": reconciliar painel (sem modos / alvo 6.050) + ligar módulos novos no orquestrador

1. **Pedido original de Flávio:** "siga" — após eu reapresentar os 2 passos pendentes do shift light:
   (a) reconciliar o painel vivo (`web/cockpit`) tirando os 3 modos e mirando na potência máxima 6.050;
   (b) ligar no orquestrador os módulos novos (aprendizado tempo de passagem + persistência + LED com
   antecipação `getRpmVisualLuz`). A 3ª parte (fonte RPM real T3000 + GPS ao vivo) só o dia de pista 15-16 fecha.
2. **Objetivo:** Trocar o alvo da luz de marcha do painel vivo de "janela do modo" para "potência máxima
   6.050 + refino por tempo de passagem", removendo os 3 modos, e ligar os módulos prontos — em DEV, sem publicar.
3. **Critérios:** alvo-semente 6.050; módulos novos ligados; 3 modos preservados (backup) sem efeito no alvo;
   test:shift-light + smokes verdes; navegador sem publicar; mudança de fluxo da tela Configuração de Stint NÃO escondida.
4. **Leitura confirmada:** CLAUDE.md · padroes.md (zerado) · FLAVIO_EXECUTION/DONE/ENVIRONMENT/COMMUNICATION · P1 Fast/CLAUDE.md + memórias (global+P1 Fast) — sim.
5. **Plano:** (1) mapa verificado das superfícies [FEITO]; (2) apresentar bifurcação de escopo ao Flávio [decisão dele];
   (3) backup + reconciliar cérebro preservando modos/forca-integrada/tela; (4) testes + navegador; (5) registro. Prod só com "MIGRAR PARA PRODUÇÃO".
6. **Superfícies mapeadas:** shift-light-orquestrador.js(487) · shift-light-modos.js(136) · aprendizado-tempo-passagem.js(165, novo, NÃO ligado) ·
   main.js:272(demo) · main-t3000.js:421(LED usa getRpmOtimoTroca)/:836(instancia)/:69,283(resolveModo) ·
   configuracao-stint.js(443, TELA EM USO que existe só pra escolher os 3 modos e salva modo_stint no banco) ·
   testes: node-smoke-shift-light-e2e/pilot-reaction-integracao/shift-light-inteligente; test:shift-light (specs de src/, não do orquestrador web).
7. **Ambiente alvo:** desenvolvimento (web/cockpit está publicado em p1t4000 — editar é dev, publicar é prod).
8. **Produção protegida:** sim. 9. **Autorização produção:** não. 10. **Evidência:** "não recebida" — "siga" autoriza DEV, não publicação.
11. **Riscos:** (a) "6.050" aposenta o cálculo por torque na roda como fonte do alvo — regra dura cobrada 2x; registros 14/06 resolvem a favor de 6.050, mas é o carro dele.
   (b) "sem modos" desmonta a base da tela Configuração de Stint — mudança de fluxo de tela em uso (pedir OK). (c) a barra de aprendizado % hoje é alimentada pelo cálculo por torque. (d) painel publicado: não publicar.
   (e) ALERTA: ultima-tarefa.md foi reescrito por auto-save/sessão concorrente entre leituras — checar concorrência antes de editar código.
12. **Status inicial:** iniciado — diagnóstico verificado concluído; aguardando decisão de escopo do Flávio.

## TASK_INIT — 2026-06-14 (noite) — Estoque geral + Editor unificado + Pendências (contador/quadradinho/Gerenciar) + ligação Pendência↔Estoque

1. **Pedido original de Flávio (pós /clear, "execute"):**
   "O que vem agora (construir no app, em desenvolvimento):
   1. Estoque geral na Garagem + modelo do item (onde fica, item/ferramenta, quantidade, especificação).
   2. Editor único em botões + câmera que lê o rótulo (o app já tem essa leitura, vou reaproveitar).
   3. Pendências: contador 'peguei', concluir só pelo quadradinho, item sai da lista, 'concluídas', e o menu Gerenciar (Adicionar/Editar/Excluir).
   4. Ligar a Pendência ao estoque (a quantidade vem do estoque)."
   (Esclareceu: é no P1 Fast.)

2. **Objetivo (1 frase):**
   Construir no app iOS (DEV) a parte 2 do design já APROVADO por Flávio em 14/06 — Estoque geral na Garagem,
   editor unificado de item em botões com câmera/OCR reaproveitada, Pendências redesenhadas e ligadas ao estoque.

3. **Critérios objetivos de conclusão:**
   - Garagem ganha sub-aba "Estoque geral" (itens + ferramentas que não são de 1 carro).
   - Editor unificado em botões (Onde fica/escopo, Item/Ferramenta, Bloco, Categoria, Especificação, Como conta) + botão câmera "Tirar foto e ler o item" reusando EtiquetaOCR.
   - Pendências: contador inline −/+ ("peguei N/alvo"); concluir SÓ pelo quadradinho; item concluído sai da lista; rodapé "✓ N concluídas"; topo "Gerenciar itens" → Adicionar/Editar/Excluir.
   - Quantidade mora no estoque; Pendência puxa dela; "peguei" é por evento.
   - Riqueza nova fica em camada LOCAL (não toca schema sincronizado de Peca). Build simulador SUCCEEDED + screenshots.

4. **Leitura confirmada:** `~/.claude/CLAUDE.md` sim · `~/.claude-decisoes/padroes.md` sim (zerado) ·
   FLAVIO_EXECUTION_PROTOCOL sim · FLAVIO_DONE_CHECKLIST sim · FLAVIO_ENVIRONMENT_RULES sim ·
   FLAVIO_COMMUNICATION_RULES sim · `P1 Fast/CLAUDE.md` + memórias (global e P1 Fast) sim ·
   CONTINUAR-pendencias-estoque-2026-06-14.md + mockup APROVADO (mockup-pendencias-estoque-APROVADO-2026-06-14.html) sim.

5. **Plano (≤5 passos):**
   1. Estoque geral na Garagem (sub-aba) + modelo de item (escopo geral/carro, item/ferramenta, qtd, espec) — LOCAL-safe ou Peca carroId nulo (VERIFICAR no mapa).
   2. Editor unificado (botões + câmera OCR reusando EtiquetaOCR).
   3. Pendências: contador "peguei" + concluir-só-no-quadradinho + sai-da-lista + "concluídas" + menu Gerenciar.
   4. Ligar Pendência ↔ estoque (puxa quantidade do estoque).
   5. Build simulador + screenshots + chamar Flávio. Produção só com "MIGRAR PARA PRODUÇÃO".

6. **Áreas/arquivos a inspecionar (mapeamento em workflow paralelo de 5 agentes — em curso):**
   PendenciasView/PendenciaRepository; PecaModels/PecaRepository/PecaViews; GaragemView/CarroHubView;
   EtiquetaOCR/BarcodeScannerView/CameraPicker/BuscaPrecoMLView; Models/Migrations/schema-parity.

7. **Ambiente alvo:** desenvolvimento (app iOS DEV + simulador).
8. **Produção protegida:** sim.
9. **Autorização para produção:** não.
10. **Evidência da autorização para produção:** não recebida.
11. **Riscos:** `Peca` (estoque do carro) SINCRONIZA com a nuvem — mexer no schema dela = produção; a riqueza nova
    (pegou/escopo/embalagem/conjunto/espec) DEVE ficar em camada LOCAL (igual `evento_pendencias_extra`);
    mexer no menu/sub-abas toca várias telas; não quebrar roteamento da tab-bar fixa.
12. **Status inicial:** iniciado — mapa do código em curso, depois build em estágios.

## TASK_DONE — 2026-06-14 (noite) — Estoque geral + Editor unificado + Pendências + ligação ao estoque

```
TASK_DONE:
- Pedido original conferido: sim (4 itens, item por item)
- Ambiente trabalhado: desenvolvimento (app iOS + simulador iPhone 17 Pro)
- Produção foi alterada: não
- Se produção foi alterada, autorização explícita registrada: n/a
- Arquivos reais inspecionados: sim (mapa de 5 áreas + leitura direta antes de editar)
- Alterações feitas: sim
- Testes/validação executados: sim (BUILD SUCCEEDED; schema-parity 15/0; migration 3/0; migration-port 8/0; 3 screenshots reais)
- Resultado: concluído em DEV (os 4 itens)
- Pendências reais: reconciliar futuramente estoque local novo × estoque do carro sincronizado (Peca) = decisão+autorização separada. Interações por toque (concluir/sai-da-lista/Gerenciar) validadas por código+build, não por toque simulado.
```

### Arquivos alterados/criados (app iOS, DEV — produção intocada)
- `ios/p1fast-core/.../Persistence/Migrations.swift` — migration v30 LOCAL-ONLY (`estoque_item` + `evento_pendencia_pegou`).
- `ios/p1fast-core/.../Persistence/Models.swift` — structs `EstoqueItem` (+Parte/alvo) e `EventoPendenciaPegou` (local-only).
- `ios/p1fast-ios/.../Persistence/EstoqueRepository.swift` — NOVO: CRUD do estoque + "peguei" por evento (sem SyncQueue).
- `ios/p1fast-ios/.../Views/EstoqueViews.swift` — NOVO: EstoqueGeralView (lista) + EstoqueItemEditorView (editor único botões+câmera/OCR) + SegPicker/Stepper2.
- `ios/p1fast-ios/.../Views/GaragemView.swift` — sub-aba "Estoque geral" entre Carros e Pilotos + initialSubTab.
- `ios/p1fast-ios/.../Views/PendenciasView.swift` — redesenho: contador "peguei" (alvo do estoque) + concluir-só-no-quadradinho + sai-da-lista + "N concluídas" + "Gerenciar itens" (Adicionar/Editar/Excluir); nota preservada (toque longo).
- `ios/p1fast-ios/.../Views/ContentView.swift` + `HubMockLauncher.swift` + `EventoDetalheView.swift` — injeção do EstoqueRepository + caminhos de screenshot (`--p1-estoque`, `--p1-estoque-editar`).
- `tests/node-smoke-schema-parity.mjs` — 2 tabelas locais novas em GRDB_LOCAL_ONLY (35→37).
- `ios/p1fast-ios/p1fast-ios.xcodeproj/project.pbxproj` — registra os 2 arquivos novos.

### O que foi preservado
Catálogo de pendências sincronizado (PendenciaTemplate/EventoPendencia), itens extras locais, estoque do carro (`Peca`, que sobe pra nuvem), edição de nota (toque longo). Nada removido da nuvem/produção.

### Validação executada
- `xcodebuild ... -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build` → BUILD SUCCEEDED (várias vezes).
- `node tests/node-smoke-schema-parity.mjs` 15/0 · `node tests/node-smoke-migration.mjs` 3/0 · `node tests/node-smoke-migration-port.mjs` 8/0.
- Screenshots reais no simulador: `relatorios/estoque-2026-06-14/01-estoque-geral.png`, `02-editor-item.png`, `03-pendencias.png`.

### Checagem contra o pedido (item por item)
1. Estoque geral na Garagem + modelo do item → FEITO (sub-aba + EstoqueItem com onde-fica/item-ferramenta/qtd/espec). Tela 01.
2. Editor único em botões + câmera que lê o rótulo → FEITO (EstoqueItemEditorView reaproveita EtiquetaOCR/CameraPicker). Tela 02.
3. Pendências (contador "peguei", concluir só no quadradinho, sai da lista, "concluídas", Gerenciar Adicionar/Editar/Excluir) → FEITO. Tela 03 (contador 0/4 no Óleo motor).
4. Ligar Pendência ao estoque (quantidade vem do estoque) → FEITO (alvo do contador = quantidade do item de mesmo nome no Estoque geral; Adicionar/Editar gravam no estoque).

### Pendências ou riscos
Reconciliar o estoque local novo com o estoque do carro sincronizado (`Peca`) é decisão futura com autorização própria. Produção não foi tocada.

---


## TASK_INIT — 2026-06-14 (noite) — Shift Light Inteligente: cérebro dos 3 aprendizados + ligação ao dado real

1. **Pedido original de Flávio:**
   "O que falta (próxima fase — o cérebro que aprende): os 3 aprendizados (o câmbio, o tempo de
   passagem, a sua reação) e ligar na rotação real. É aí que também se resolve a marcha real no ao
   vivo. Esse cérebro só ganha vida de verdade com o dado do dia de pista (15–16). continue"

2. **Objetivo (1 frase):**
   Levar o cérebro do shift light (3 aprendizados) do estado atual até estar LIGADO ao RPM real e
   resolvendo a marcha ao vivo — construindo agora tudo que não depende do dado de pista, com testes.

3. **Critérios objetivos de conclusão:**
   - Mapa VERIFICADO do que já existe vs a visão de 14/06 (sem inventar).
   - Câmbio: relação por marcha REAPRENDE sozinha quando a regulagem muda (online), não só em lote.
   - Tempo de passagem: alvo na POTÊNCIA MÁXIMA (6.050 Bubi) + refino por passagem (o que der sem pista).
   - Reação: confirmada completa (mede delta luz→troca e antecipa).
   - Ligação ao vivo: no modo REAL para a animação demo, consome RPM real e mostra marcha "—" até inferir.
   - test:shift-light + smoke verdes; validação no navegador SEM publicar.

4. **Leitura confirmada:** `~/.claude/CLAUDE.md` sim · `~/.claude-decisoes/padroes.md` sim (zerado, 0 decisões) ·
   FLAVIO_EXECUTION_PROTOCOL sim · FLAVIO_DONE_CHECKLIST sim · FLAVIO_ENVIRONMENT_RULES sim ·
   FLAVIO_COMMUNICATION_RULES sim · `P1 Fast/CLAUDE.md` + memórias (global e P1 Fast) sim.

5. **Plano (≤5 passos):**
   1. Mapear estado real verificado (3 aprendizados + detecção + ligação ao vivo + alvo) vs visão 14/06 — leitura paralela com verificação adversarial. [só leitura]
   2. Apresentar o buraco real ao Flávio (existe / falta / só o dia de pista fecha).
   3. Construir o construível agora, com testes (relearning online do câmbio; refino do ponto por passagem; alvo na potência máxima; bug da animação demo no modo real).
   4. Rodar test:shift-light + smoke; validar no navegador sem publicar.
   5. Atualizar registro e relatar. Produção só com "MIGRAR PARA PRODUÇÃO".

6. **Áreas/arquivos a inspecionar:**
   - `src/domain/{gear-estimation,gear-signatures,gear-shift-detector,pilot-reaction,dyno-target-calculator,shift-target}.js`
   - `src/pipeline/{rpm-source,shift-light-bridge,shift-event-detector}.js`
   - `web/cockpit/{shift-light-orquestrador,pilot-reaction}.js`
   - `_design-reference/mockup-command-box-vista-piloto.html` (startShiftLightAnimation/liveGear/SHIFT_LIGHT_*)
   - `tests/{domain,pipeline,ui}/*shift*` · `relatorios/shift-light-*-2026-06-14.html`
   - Dados reais p/ teste: `~/Documents/p1fast-backup-voltas-reais/` (GPS 23-24/05 — tem velocidade, NÃO tem RPM).

7. **Ambiente alvo:** desenvolvimento (domínio/pipeline JS + mockup + painel local).
8. **Produção protegida:** sim.
9. **Autorização para produção:** não.
10. **Evidência da autorização para produção:** não recebida.
11. **Riscos:** `web/cockpit` ESTÁ publicado (p1t4000) — editar local é dev, publicar é prod (proibido sem ordem); o fix da animação NÃO pode mexer nas posições aprovadas (ATUAL.json) nem na calibração Bubi aplicada 14/06; validação real do câmbio só no dia de pista 15-16 (precisa RPM+aceleração reais juntos, que o GPS não dá).
12. **Status inicial:** iniciado — fase de mapeamento verificado.

## PROGRESSO — 2026-06-14 (noite)

### Mapa VERIFICADO (leitura direta + workflow de 14 agentes, conferência adversarial)
Achado central: o "cérebro" NÃO está pendente como a nota das 18:17 dizia — está ~90% construído, mas
SPLIT em dois lugares + um mockup, todos ANTERIORES à visão de 14/06:
- `src/domain` + `src/pipeline` (Bloco 5/6, 01/05): funções puras + 153 testes verdes (`test:shift-light`).
  `gear_signatures` aqui é praticamente CÓDIGO MORTO (só testes; `car.gear_signatures` sempre null).
- `web/cockpit` (Onda 7/8, 29/05): cérebro VIVO que alimenta o painel publicado (p1t4000). TEM os 3
  aprendizados: câmbio online (`gear-detector-online.js`, reaprende via média móvel 5%), refino por
  passagem (`aprendizado-confianca.js` registra rpm por trecho+marcha), reação completa+persistida.
  PORÉM gira em torno dos 3 MODOS (revogados 14/06) e mira na janela do modo, não na potência máxima.
- `_design-reference/mockup-command-box-vista-piloto.html`: Vista Piloto (calibração Bubi 6050 aplicada 14/06).

### FEITO nesta sessão (DEV, produção intocada):
- **Bug da marcha falsa ao vivo CORRIGIDO** no mockup Command Box. No modo real a animação demo
  (`startShiftLightAnimation`) continuava rodando por baixo e mostrava marcha 3/4/5 e RPM varrendo FALSOS.
  Agora: extraí `renderShiftLightFromValues(rpm,gear)`; criei `stopShiftLightAnimation()`; no modo real
  paro a demo, desenho o shift light com RPM REAL e marcha "—" até o cérebro inferir; trava
  `window.__shiftLightRealMode` impede a demo religar (ordem init×ligação). Calibração 6050/6300 e
  posições (ATUAL.json) INTACTAS. Backup: `.claude-exec/backup-shiftlight-aovivo-2026-06-14/`.
- Validação: `test:shift-light` 153/0; sintaxe JS do mockup 0 erros (vm.Script nos 3 blocos);
  servido pela 8078 (ajudante injeta arranjo) e aberto no navegador com `?preview` (simulador local).

### LACUNAS REAIS verificadas (construíveis AGORA, sem dado de pista):
1. Persistir assinaturas do câmbio (ratioMedia/marcha) e learned_targets entre sessões (hoje se perdem).
2. SEM MODOS: remover Durabilidade/Normal/Agressivo → comportamento único (máximo desempenho).
3. Alvo na POTÊNCIA MÁXIMA 6050 (conferir o que o cruzamento/força-integrada devolve p/ o Bubi vs 6050).
4. Aprendizado #2 por TEMPO DE PASSAGEM (lapTime vs melhor histórica → afinar ponto pelo melhor tempo).
5. Aceleração (força-G) entrar no GATILHO da detecção (hoje só registrada pós-fato).
6. Ligar `getRpmVisualLuz` (antecipação da reação) no LED ao vivo (hoje só `getRpmOtimoTroca` é usado).
7. Testes: re-aprendizado online do câmbio; marcha sem RPM (iPhone); freio só por aceleração.

### SÓ O DIA DE PISTA 15-16 FECHA:
- Fonte de RPM real plugada (adaptador T3000) + GPS ao vivo → marcha real inferida ao vivo.
- Fixture histórica com RPM+aceleração COMBINADOS (hoje só GPS de 23-24/05, sem RPM).

### TENSÃO a decidir com Flávio (não decido sozinho — é o carro dele):
Visão 14/06 = trocar na potência máxima 6050. Auditor 29/05 (no código `forca-integrada-calculator.js`)
= com câmbio Wide Ratio amador, o ótimo "estica" pra perto do redline. Os dois conflitam.

**Status (1ª etapa): bug ao vivo corrigido e validado.**

## DECISÃO Flávio (card) — "Fundações pra pista (recomendado)"
Construir agora o que faz o dia de pista ENSINAR o cérebro, SEM mexer no painel publicado.
Reconciliação do painel (tirar modos / alvo 6050) fica pra depois.

## TASK_DONE — 2026-06-14 (noite) — Fundações pra pista (escopo escolhido)

Arquivos ACRESCENTADOS (DEV, nada publicado):
- `web/cockpit/aprendizado-tempo-passagem.js` — NOVO. Aprendizado #2: escolhe o ponto de troca por
  (trecho×marcha) pelo MENOR TEMPO medido. É o que resolve 6.050-vs-redline com dado, não opinião.
  Tem export/import (persistência). Teste `tests/node-smoke-aprendizado-tempo-passagem.mjs` (15/0).
- `tests/node-smoke-aprendizado-persistencia.mjs` — NOVO (9/0).
- `tests/node-smoke-deteccao-acel-gate.mjs` — NOVO (6/0).

Arquivos ALTERADOS (aditivo, sem mudar comportamento atual):
- `web/cockpit/gear-detector-online.js` — +`exportarEstado()/importarEstado()` (persistir assinaturas do câmbio).
- `web/cockpit/aprendizado-confianca.js` — +`exportarEstado()/importarEstado()` (persistir marchas+pontos+voltas).
  (Blindei import contra estado corrompido — bug que MEU teste pegou: número no lugar de lista quebrava.)
- `src/pipeline/shift-event-detector.js` — +trava OPCIONAL `accelCorroboraUpshift` (default FALSE):
  exige queda de força-G pra confirmar o upshift (cruzar sinais). Default off = 13 testes existentes intactos.
- `package.json` — +3 testes no `smoke` + atalhos `smoke:tempo-passagem|aprendizado-persistencia|deteccao-acel-gate`.

NÃO fiz (de propósito, conforme a decisão "painel fica como está"): NÃO liguei esses módulos no
orquestrador do painel publicado (isso muda comportamento de função em uso). Ficam prontos e testados
pra ligar quando reconciliarmos o painel.

Validação executada:
- `npm run test:shift-light` → 12 specs, 153/0.
- `node tests/node-smoke-shift-light-inteligente.mjs` → 24/0.
- 3 testes novos → 15/0, 9/0, 6/0. Detector existente sem regressão (`node-smoke-detector` 3/0, spec 13/0).

Resultado: **CONCLUÍDO o escopo escolhido (fundações)**. Pendente por decisão/dado: reconciliar painel
(sem modos / alvo 6050) e ligar a fonte de RPM real + GPS ao vivo (dia de pista 15-16).

## TASK_INIT — 2026-06-14 — Reorganizar menu de baixo (Cadastros → Garagem, Pendências no lugar)

1. **Pedido original de Flávio:**
   "Em P1 Fast, no menu principal de baixo, mudar: pegar a parte de Cadastro e colocar dentro
   de Garagem (lá no cadastro a gente cadastra piloto, passageiro, combustível e lições — isso
   não faz mais sentido como aba própria). Colocar isso dentro de Garagem, como já tem novo
   carro / novo piloto. E onde está Cadastro, colocar a função Pendências — que NÃO é o
   checklist do carro, são as pendências para um determinado evento que a gente vai participar
   (sempre o próximo). Lista de pendências acessada direto: ver o que falta, incluir, excluir, ticar."

2. **Objetivo (1 frase):**
   Tirar a aba "Cadastros" do menu de baixo, mover seu conteúdo (pilotos/passageiros/combustível/
   lições) para dentro de Garagem, e pôr "Pendências do próximo evento" no lugar da aba liberada.

3. **Critérios objetivos de conclusão:**
   - Menu de baixo passa a ser: Home · Eventos · **Pendências** · Garagem.
   - Garagem passa a hospedar Carros + Pilotos + Passageiros + Combustível + Lições (cada um com seu "+ Cadastrar").
   - Pendências abre direto no próximo evento, com incluir / excluir / ticar item.
   - Nada do que existe é perdido (PessoasView, PendenciasView, repos preservados).
   - Mockup aprovado por Flávio no navegador ANTES de portar pro Swift.

4. **Leitura confirmada:**
   - `~/.claude/CLAUDE.md`: sim
   - `~/.claude-decisoes/padroes.md`: sim (zerado, 0 decisões)
   - `~/.claude/FLAVIO_EXECUTION_PROTOCOL.md`: sim
   - `~/.claude/FLAVIO_DONE_CHECKLIST.md`: sim
   - `~/.claude/FLAVIO_ENVIRONMENT_RULES.md`: sim
   - `~/.claude/FLAVIO_COMMUNICATION_RULES.md`: sim
   - `P1 Fast/CLAUDE.md` + memórias (global e P1 Fast): sim

5. **Plano (≤5 passos):**
   1. Mapear estado real do menu e telas (FEITO — ver "evidência").
   2. Construir mockup interativo da reorganização (Garagem com sub-abas + Pendências do próximo evento) e abrir no navegador.
   3. Flávio decide a estrutura da Garagem (sub-abas x lista de atalhos) e aprova o visual.
   4. Portar pro Swift em DEV: trocar label/rota da 3ª aba; mover conteúdo de PessoasView pra Garagem; criar tela Pendências-próximo-evento com incluir/excluir/ticar.
   5. Validar no simulador + abrir pro Flávio. Só depois cogitar produção.

6. **Áreas/arquivos inspecionados (evidência real):**
   - `ios/.../Components/BottomNav.swift` — componente do menu (4 vagas).
   - `ios/.../Views/HomeView.swift:118-123` — menu REAL do app vivo = Home · Eventos · **Cadastros** · Garagem (NÃO Pendências ainda). Roteamento em `handleNavSelect`/`navigateFromSubView`.
   - `ios/.../Views/PessoasView.swift` — a aba "Cadastros": sub-abas Pilotos/Passageiros/Combustível/Lições.
   - `ios/.../Views/GaragemView.swift` — hoje só lista de carros + FAB "Novo carro" + link "Trechos da pista".
   - `ios/.../Views/PendenciasView.swift` — JÁ EXISTE, mas por evento (eventoId), 6 grupos, só ticar/nota; NÃO inclui/exclui item; aberta dentro do detalhe do evento.
   - `_design-reference/mockup-garagem.html` + nav dos mockups: já mostram "Pendências" no slot (o desenho já anteviu, mas o app vivo ainda não).

7. **Ambiente alvo:** desenvolvimento (mockup + iOS DEV).
8. **Produção protegida:** sim.
9. **Autorização para produção:** não.
10. **Evidência da autorização para produção:** não recebida.
11. **Riscos:** mexer no menu toca todas as telas (cada sub-view replica `navItems`); PendenciasView é por-evento e precisa de "próximo evento" + incluir/excluir (capacidade nova); não quebrar roteamento da tab-bar fixa.
12. **Status inicial:** iniciado — fase de mockup.

## Decisão 1 — estrutura da Garagem (2026-06-14)
Flávio escolheu **Sub-abas no topo** (Carros · Pilotos · Passageiros · Combustível · Lições).
Mockup: `_design-reference/mockup-menu-reorg.html`. Flávio: "pode seguir" → portado pro app (DEV).

## TASK_DONE — 2026-06-14

Arquivos alterados (app iOS, DEV — produção intocada):
- `ios/p1fast-core/.../Migrations.swift` — migration v29: tabela LOCAL-ONLY `evento_pendencias_extra` (não sincroniza).
- `ios/p1fast-core/.../Models.swift` — struct `EventoPendenciaExtra`.
- `ios/p1fast-ios/.../PendenciaRepository.swift` — addExtra/removeExtra/toggleExtra/reloadExtras + grupos() mescla extras + PendenciaItemView vira catálogo OU extra.
- `ios/p1fast-ios/.../PendenciasView.swift` — incluir (botão por grupo) / excluir (lixeira) / ticar; eyebrow + showFootBar configuráveis.
- `ios/p1fast-ios/.../PessoasView.swift` — modo embutido (esconde header/sub-abas próprias) pra viver dentro da Garagem.
- `ios/p1fast-ios/.../GaragemView.swift` — sub-abas Carros·Pilotos·Passageiros·Combustível·Lições.
- `ios/p1fast-ios/.../HomeView.swift` — menu 3ª aba Cadastros→Pendências (abre no próximo evento via novo launcher).
- `ios/p1fast-ios/.../HubMockLauncher.swift` — injeta os repos novos (corrige crash latente no mock) + NavRouter estável + args `--p1-menu`/`--p1-pend`.
- `tests/node-smoke-schema-parity.mjs` — reconhece `evento_pendencias_extra` como local-only.

Validação executada:
- Empacotamento simulador: `xcodebuild ... build` → **BUILD SUCCEEDED** (3x).
- Testes: schema-parity 15/0, migration 3/0, migration-port 8/0.
- App real no simulador: `real-garagem-reorg.png` (Garagem com sub-abas + menu "Pendências") e `real-pendencias-proximo.png` (Pendências no próximo evento, 45 itens reais nos 6 grupos).

Status: concluído em DEV. Produção NÃO alterada (sem "MIGRAR PARA PRODUÇÃO").
Pendência real: nenhuma técnica. Observação: incluir/excluir é LOCAL-ONLY de propósito (não sobe pra nuvem) — se Flávio quiser sincronizar entre aparelhos, é decisão+autorização de produção separada.
