# ÚLTIMA TAREFA — Canal notebook↔iMac (responder + vigiar)

> Backup da tarefa anterior: `.claude-exec/ultima-tarefa-backup-pre-canal-notebook-2026-06-30.md`

## TASK_INIT — 2026-06-30 17:08 (Brasília)

1. **Pedido original de Flávio:** "em p1 fast atualize o git, vá na branch `sync/notebook-dia-de-pista-2026-06-23`, leia o arquivo do canal (`conversa-notebook-imac-dados-novem.md`), responda o notebook e fique vigiando para continuar a conversa".
2. **Objetivo (1 frase):** ler o canal git notebook↔iMac, responder com evidência real (lado iMac/nuvem) e ficar vigiando a branch pra continuar a conversa.
3. **Critérios objetivos de conclusão:**
   - Git atualizado e branch `sync/notebook-dia-de-pista-2026-06-23` lida na versão mais recente do notebook.
   - Arquivo do canal lido inteiro (`.claude-exec/CONVERSA-NOTEBOOK-IMAC-DADOS-NUVEM.md`).
   - Bloco de resposta `[iMac]` acrescentado ao FIM, com prova real (não inventada), commit + push na branch.
   - Vigia ativo pra pegar o próximo bloco do notebook.
4. **Leitura confirmada de:** `~/.claude/CLAUDE.md` ✅ · `~/.claude-decisoes/padroes.md` ✅ (zerado) · `~/.claude/FLAVIO_EXECUTION_PROTOCOL.md` ✅ · `~/.claude/FLAVIO_DONE_CHECKLIST.md` ✅ · `~/.claude/FLAVIO_ENVIRONMENT_RULES.md` ✅ · `~/.claude/FLAVIO_COMMUNICATION_RULES.md` ✅. Mais: `CLAUDE.md` do projeto (raiz + worktree) ✅.
5. **Plano (≤5 passos):**
   1. `git fetch` + pull da branch do canal (worktree `canal-conversa`). ✅
   2. Ler o arquivo do canal inteiro. ✅
   3. Verificar leitura real da nuvem (auditor em `BRASILIA-2026-06-21-REAL`) e procurar caminho de Vmin por curva do lado iMac. ✅
   4. Acrescentar bloco `[iMac]` com evidência + travar o que é produção; commit + push.
   5. Iniciar vigia (git fetch periódico) e reportar ao Flávio.
6. **Arquivos/áreas inspecionados:** `.claude-exec/CONVERSA-NOTEBOOK-IMAC-DADOS-NUVEM.md`, `tools/auditor-sessao-dumps.mjs` (main), `web/command-box/cerebro/cerebro-coach.js`, `tools/replay-classificador-vivo.mjs`, busca por segmentador por curva.
7. **Ambiente alvo:** desenvolvimento (canal git + leitura do Supabase). Persistência/exibição cairia em produção.
8. **Produção protegida:** sim.
9. **Autorização para produção:** não.
10. **Evidência da autorização:** não recebida.
11. **Riscos:** push é só na branch do canal (protocolo do próprio canal, não toca a main nem dispara deploy). Persistir em `segment_executions` seria produção → travado.
12. **Status inicial:** iniciado.

## Evidência coletada
- Auditor (leitura da nuvem, só leitura): `BRASILIA-2026-06-21-REAL` → 12 partes, 5441 amostras = meta, 3499 GPS, UUIDs carro/track/time certos, remontagem confere ✅.
- Vmin **global** do auditor = ruído (0 km/h parado / Vmax 14110 km/h spike). Por curva exige segmentação (lado `p1fast-vmin` no Windows). Não há ferramenta do lado iMac que leia `sessao_dumps` e segmente por trecho.
