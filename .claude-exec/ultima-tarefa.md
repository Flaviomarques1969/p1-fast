# Última tarefa

> Tarefa ANTERIOR (Vista Piloto / Command Box) preservada em
> `ultima-tarefa-backup-vista-piloto-2026-06-14.md`.

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
Mockup: `_design-reference/mockup-menu-reorg.html`. Aguardando aprovação visual pra portar pro app (DEV).
