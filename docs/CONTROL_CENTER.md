# P1 Fast — Centro de Controle

> **Modelo de operação acordado (Flávio 2026-05-03):**
> Claude opera autonomamente em tudo que pode. Flávio só intervém em
> decisões que são fisicamente impossíveis pra Claude (clicks no Cloud
> Code, decisões de arquitetura/escopo, autorizações de deploy novo).
>
> Quando precisar de decisão, Claude abre o doc/página apropriada,
> coloca em posição, e pergunta. Sem perguntas que sejam pesquisáveis.

---

## ✅ Sob controle de Claude (autônomo, sem precisar de Flávio)

### Auditoria + qualidade
- Audit de cada PR novo do Cloud Code (checklist baked + comparação com diff real)
- Comentários de pré-review no GitHub com findings
- Verificação de CI verde antes de merge
- Confirmação de Package.resolved intacto, repos no path certo, sem TODO/FIXME novos

### Git operations
- Rebase em main quando PRs antigos precisam (com resolução manual de conflitos triviais)
- Force push pós-rebase (com `--force-with-lease`)
- Merge via `gh pr merge --squash --delete-branch`
- Worktrees pra evitar autosave race
- Sync local de main após merges

### Supabase operations
- Deploy de Edge Functions (`supabase functions deploy`)
- Aplicar migrations novas (`supabase db push`)
- Smoke tests E2E (auth signin → REST CRUD via JWT)
- Verificação de RLS funcionando
- Bug fixes de migration via PR (vide PR #43 — RLS recursion)

### Docs + memória
- STATUS.md, BLOCKERS.md, IMPLEMENTATION_COVERAGE.md, CLOUD_CODE_QUEUE.md atualizados a cada milestone
- ADRs novos quando descobre padrão reusável
- Memória `~/.claude/projects/-Users-imac/memory/*.md` salva lessons learned
- Bake de prompts da próxima Sprint (quando todas as decisões já estão fechadas)

### Erro recovery
- Branch deletada por engano → recovery via `git reflog` (PR #38 fez isso)
- PR fechado por bug de base → recreate via cherry-pick (PR #34 → PR #37)
- Migration corrupta no DB → fix migration + redeploy

---

## 🔵 Ações que SÓ Flávio pode fazer (impossíveis pra Claude)

### Cloud Code dispatch
**Único bloqueio recorrente.** Cada prompt baked precisa de copy-paste manual no Cloud Code interface — Claude não tem acesso a ela.

Fluxo: Claude prepara prompt + cola na conversa → Flávio copia → cola no Cloud Code → confirma execução.

### Decisões arquiteturais não-baked
Quando design doc tem "Decisões abertas" que afetam o produto, Claude para e pergunta. Hoje só Sprint 1B tem 5 decisões abertas (vide `docs/SPRINT_1B_COCKPIT_DESIGN.md`).

### Autorização de novo deploy/spend
- Criar projeto Supabase (já feito 2026-05-03)
- Pagar plano superior (atualmente Free, ok)
- Apple Developer / TestFlight upload (não chegou ainda)
- DNS / domínio próprio (não chegou ainda)

### Decisões de escopo
- "Isso entra no projeto?" — vide ADR-018 (sem PWA), `feedback_p1fast_fora_escopo.md` (sem CarPlay/Watch/Android)
- "Isso vai pro V1 ou V2?"

### Aprovação humana de PR
Default: Claude faz audit, posta comentário com findings, propõe merge. Flávio pode merger via GitHub UI **ou** autorizar Claude via mensagem ("merga"). Atualmente Claude está autorizado a merger PRs próprios (auditados) por delegação contínua.

---

## 🟡 Decisões pendentes AGORA

| # | Pergunta | Bloqueia | Quando |
|---|---|---|---|
| Q1 | Disparar #16 Sprint 1A.4 agora? Ou pausar Sprint 1A.3 fechado e voltar amanhã? | Próximo PR | Quando Flávio quiser |

**Nada urgente.** Sprint 1A.3 está fechado, próxima ação é dispatch de #16.

---

## 🔮 Decisões futuras inevitáveis (fora do horizonte agora)

### Sprint 1B (Cockpit ao vivo) — 5 decisões abertas
Quando Phase 1A fechar (~6-8 PRs), pra começar 1B preciso destravar:

1. **Modal landscape forçado vs respeita orientação** — sugestão default: forçar landscape via `supportedInterfaceOrientations` na CockpitView.
2. **Detector ao vivo vs replay** — cockpit precisa de detector streaming, hoje é batch.
3. **Pipeline JS via JavaScriptCore vs port Swift** — ADR-018 deixou aberto. P1FastCore tem partes portadas; decidir se continua ou embarca JS.
4. **Buffer de samples** — 10Hz cada sample dispara re-render. Buffer N=5 reduz pressure (custo: 500ms latência delta).
5. **Modo offline puro** — cockpit sem internet (sugestão: zero-network, sync antes/depois do stint).

Doc: `docs/SPRINT_1B_COCKPIT_DESIGN.md`. Posso preparar recomendações pra cada uma quando chegar a hora.

### Apple Developer + TestFlight
Quando o app estiver pronto pra teste fora do simulator (provavelmente entre 1A.6 e 1B). Custa $99/ano. Decisão: investir agora ou esperar 1B funcionando?

### Track day real
Quando o app rodar uma sessão real na pista (Brasília). Decisão de quando ir, com quem, o que medir.

---

## 📊 Estado geral

| Phase | Status | PRs restantes |
|---|---|---|
| 1A.1 Fundação | ✅ Done | 0 |
| 1A.2 Hub iOS base | ✅ Done | 0 |
| 1A.3 Cadastros (Pessoas/Combust/Pneus + delete) | ✅ Done | 0 |
| 1A.4 Schema v2 + Stint selectors + Pessoas v2 | 🟡 Baked | 3 (#16/#17/#18) |
| 1A.5 Trechos/Lições/Pendências/Setup avançado | 🟡 Baked | 4 (#19-#22) |
| 1A.6 Sync transports + UI | 🟡 Baked, Supabase pronto | 2 (#23/#24) |
| **Phase 1A total restante** | | **9 PRs** |
| 1B Cockpit ao vivo | ⏳ Design pronto, 5 decisões pendentes | ~5-7 (não baked) |

**Velocidade observada:** ~3-5 PRs por turn de trabalho (visto hoje: 7 PRs em 1 turn — Sprint 1A.3 done).
**Estimativa Phase 1A done:** 2-3 turns de trabalho.

---

## 🔄 Como manter este doc

Atualizar SEMPRE que:
- Um PR mergea (mover sprint pra Done)
- Surge nova decisão pendente
- Resolvo decisão pendente
- Mudo o modelo de operação (caso o Flávio queira ajustar)

Atualizado autonomamente por Claude.
