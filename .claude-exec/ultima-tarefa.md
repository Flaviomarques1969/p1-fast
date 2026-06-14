# Última tarefa

> Tarefa ANTERIOR (Vista Piloto / Command Box) preservada em
> `ultima-tarefa-backup-vista-piloto-2026-06-14.md`.
> A tarefa de menu (Garagem/Pendências) abaixo está TASK_DONE; preservada na íntegra.

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
