# Última tarefa — Continuidade no celular: ligar T4000 no notebook

## TASK_INIT — 2026-05-25

- **Pedido original:** "Eu gostaria que você criasse, fizesse de uma forma, que no celular, no Claude Code do celular, eu conseguisse continuar, porque o carro vai estar longe, e com o notebook, eu conseguisse continuar essa tarefa aqui."
- **Objetivo resumido:** deixar o estado da tarefa "ligar a T4000 no notebook" registrado no repositório oficial, em documento que o Claude Code do celular consiga ler e continuar de onde paramos.
- **Critérios de conclusão:** existir um documento `docs/HANDOFF_T4000_NOTEBOOK_2026-05-25.md` na versão oficial (origin/main) que (a) explique o que já foi feito; (b) explique o gap real (um adaptador C# de ~50 linhas); (c) dê um plano de 5 passos; (d) contenha o prompt copia-e-cola pro Claude Code do celular; (e) explique como o Flávio testa no notebook.
- **Confirmação de leitura:**
  - `~/.claude/CLAUDE.md`: sim
  - `~/.claude/projects/-Users-imac/memory/MEMORY.md`: sim
  - `CLAUDE.md` do projeto: sim
  - `STATUS.md` (sessão 2026-05-24): sim
  - `docs/hardware/T4000_CAN_SPEC.md`: sim
  - `docs/HANDOFF.md` (referência de padrão): sim
- **Ambiente alvo:** desenvolvimento — alterações na linha de trabalho separada `handoff-t4000-mobile-2026-05-25`, partindo de `origin/main`.
- **Produção protegida:** sim
- **Autorização para produção:** N/A (alteração só de documento; não toca código de produto, banco, edge function, variável de ambiente, autenticação, domínio nem storage).
- **Plano (≤ 5 passos):**
  1. Conferir estado da versão oficial e diferenças locais.
  2. Criar ambiente isolado de trabalho (worktree) a partir de `origin/main`.
  3. Escrever `docs/HANDOFF_T4000_NOTEBOOK_2026-05-25.md` com plano completo + prompt pro celular.
  4. Atualizar `.claude-exec/ultima-tarefa.md` neste ambiente isolado.
  5. Registrar + enviar pra versão oficial. Submeter pra aprovação formal (PR) com auto-merge se autorizado.
- **Riscos:** push direto na versão oficial sem aprovação formal — mitigado abrindo submissão (PR). Mistura com alterações antigas do iMac (9 alterações locais sem enviar) — mitigado trabalhando em ambiente isolado partindo de `origin/main`, sem tocar no `main` local.
- **Status inicial:** iniciado.
