# TASK — Canal de comunicação entre as duas sessões Claude (iMac ↔ notebook) via GitHub

> Registro anterior (17 luzes / produto web) preservado em
> `.claude-exec/ultima-tarefa.backup-2026-06-27-pre-canal-claude.md`.

## 1. Pedido original de Flávio
"em p1 fast nós estamos fazendo um módulo de comunicação seu com a seção do claude no
notebook via github. por gentileza verifique a situação atual e viabilize."

## 2. Objetivo (1 frase)
Criar um canal confiável pelo GitHub onde a sessão Claude do iMac e a sessão Claude do
notebook deixam mensagens uma pra outra, isolado do código do app (sem tocar a main nem
produção).

## 3. Critérios objetivos de conclusão
- Existe um canal dedicado no GitHub que carrega SÓ mensagens (zero código do app).
- O iMac consegue ENVIAR uma mensagem e ela aparece no GitHub.
- O iMac consegue RECEBER (puxar e ler) o que o outro lado escreveu.
- Round-trip provado de verdade do lado do Mac (escrever → enviar → puxar de volta → ler).
- Existe protocolo escrito (PT) e um comando único pra ativar o lado do notebook.
- main não é enviada; nada de produção é tocado.

## 4. Leitura confirmada
- `~/.claude/CLAUDE.md` — sim
- `~/.claude-decisoes/padroes.md` — sim (0 decisões registradas)
- `~/.claude/FLAVIO_EXECUTION_PROTOCOL.md` — sim
- `~/.claude/FLAVIO_DONE_CHECKLIST.md` — sim
- `~/.claude/FLAVIO_ENVIRONMENT_RULES.md` — sim
- `~/.claude/FLAVIO_COMMUNICATION_RULES.md` — sim
- Projeto: `CLAUDE.md`, `.claude-exec/ultima-tarefa.md`, doc de integração notebook 16/06 — sim

## 5. Plano (≤5 passos)
1. Verificar o que já existe (feito: NÃO existe canal Claude↔Claude; existe a linha de
   sincronização de CÓDIGO `sync/notebook-dia-de-pista-2026-06-23`; main local 1891 commits
   à frente do GitHub e 10 atrás — divergida; enviar a main é operação grande/auditada).
2. Criar branch ISOLADO `claude-comms` (órfão, sem histórico do app) só com mensagens + protocolo + ajudante.
3. Operar por uma worktree dedicada fora do diretório principal (não tocar a main nem o auto-save).
4. Provar o round-trip do Mac (enviar → push → fetch → ler) e publicar SÓ o branch de mensagens.
5. Entregar protocolo PT + comando único de ativação do notebook. Reportar TASK_DONE.

## 6. Áreas inspecionadas
- `.git` (remoto, branches, divergência local×origin), `.claude-exec/`, `docs/HANDOFF_*`,
  `.github/`, `.claude/settings*.json`, `.gitignore`.

## 7. Ambiente alvo
desenvolvimento (canal isolado; main e produção intocadas)

## 8. Produção protegida
sim

## 9. Autorização para produção
não (não se aplica — branch de mensagens não é produção, não dispara deploy)

## 10. Evidência da autorização para produção
não recebida — não necessária (o pedido "via github" autoriza publicar o branch de mensagens isolado)

## 11. Riscos
- Enviar sem querer a main (1891 commits) → mitigado: branch órfão + worktree separada; nunca toco main.
- Notebook é Windows → o protocolo usa git puro (igual nos dois SOs); script .sh é só conveniência do Mac.
- Corrida de escrita simultânea → canal de 2 partes, baixo tráfego; resolvido por fetch+reset antes de enviar.

## 12. Status inicial
iniciado

---

## TASK_DONE (27/06)
```
TASK_DONE:
- Pedido original conferido: sim
- Ambiente trabalhado: desenvolvimento (branch isolado claude-comms + worktree dedicada)
- Produção foi alterada: não
- Se produção foi alterada, autorização explícita registrada: n/a
- Arquivos reais inspecionados: sim
- Alterações feitas: sim (canal criado e publicado; pointer no projeto)
- Testes/validação executados: sim (round-trip real iMac→GitHub→notebook(simulado)→GitHub→iMac)
- Resultado: concluído (lado iMac pronto e provado; falta só ativar o notebook — 1 comando)
- Pendências reais: ativar o canal no notebook (comando único em CANAL-CLAUDE-IMAC-NOTEBOOK.md)
```

### O que foi feito
- Branch órfão `claude-comms` no GitHub (só mensagens; zero código do app; main intocada).
- Worktree dedicada `~/Projetos/p1fast-worktrees/comms` ligada ao canal.
- Protocolo `LEIA-PRIMEIRO.md` (PT) + ajudante `p1-comms.sh` (ler/enviar/historico/quem).
- Round-trip provado de verdade (clone do GitHub simulando o notebook, ida e volta).
- Pointer `.claude-exec/CANAL-CLAUDE-IMAC-NOTEBOOK.md` pra sessões futuras acharem o canal.

### Prova
- `git ls-tree -r origin/claude-comms` → só .gitignore, LEIA-PRIMEIRO.md, mensagens/, p1-comms.sh.
- `git rev-list --count origin/main...main` = 10/1892 → main NÃO foi empurrada.
- `./p1-comms.sh ler` no iMac exibiu a resposta vinda do GitHub.

### Pendência
- Notebook entra no canal com 1 comando (ver CANAL-CLAUDE-IMAC-NOTEBOOK.md). Lado Flávio/notebook.
