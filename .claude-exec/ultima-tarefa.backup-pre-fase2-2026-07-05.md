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

---

## TASK_INIT — 2026-06-30 ~18:05 (Brasília) — NOVA TAREFA: inconsistências do fim de semana

1. **Pedido de Flávio:** "agora identifiquem e resolvam as inconsistências do p1 fast por conta dos testes do final de semana no carro".
2. **Objetivo:** achar e corrigir, junto com o notebook, as inconsistências causadas pelos testes de 27-28/06.
3. **Ambiente alvo:** desenvolvimento (diagnóstico em produção é só leitura). Produção protegida: sim. Autorização para produção: não.
4. **Inconsistências achadas no banco (lido, read-only, `sessao_dumps`):**
   - **DUPLICAÇÃO 8×:** 5 sessões `sessao-2026-06-21T14-{07,25,33,37,40}...Z` enviadas 8× cada (parte0 ×8; ex.: `...14-40-01` = 248 linhas p/ 31 partes). Quem lê somando partes pega 8× dado inflado.
   - **Sessões de teste largadas:** `UPLOAD-TESTE-notebook-2026-06-27` (v1) + `...-v2-uuid`.
   - **Causa-raiz provável:** envio não-idempotente (sem chave única em (sessao_id,parte); re-rodar empilha cópias).
   - `BRASILIA-2026-06-21-REAL` está **intacta** (12/12), não afetada.
   - Tabela `sessao_dumps` **não tem `created_at`** → não dá pra datar o envio só pelo banco (o notebook tem o histórico).
5. **Divisão proposta:** (a) iMac DEV: blindar os leitores da nuvem pra deduplicar por `parte`; (b) notebook DEV: tornar o envio idempotente (upsert / chave única + ON CONFLICT); (c) Flávio PROD: autorizar limpeza de `sessao_dumps` (dedup + remover sessões de teste) — é escrita/DELETE em produção.
6. **Status:** iniciado (diagnóstico nuvem feito; aguardando notebook caracterizar o lado dele).
