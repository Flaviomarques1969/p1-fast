# PRESERVAÇÃO FORMAL DO AMBIENTE `vista-engenheiro`

Data: 2026-05-14
Stint: 3 — Preservação formal do ambiente `vista-engenheiro`
Modo: somente leitura. Nenhum arquivo funcional foi alterado. Nenhuma operação Git foi executada.

> Nota de linguagem: "ambiente isolado" = cópia paralela do projeto numa pasta separada. O nome real da pasta usa `worktrees/` no caminho — é só o nome da pasta no disco, não uma operação Git.
> "Linha de trabalho separada" = `branch` (linha de evolução nomeada do projeto).
> "Incorporar à versão oficial" = `merge` para `origin/main`.
> "Submissão formal" = pull request aberto no repositório oficial.

# Conclusão

- **Sim**, o ambiente `.claude/worktrees/vista-engenheiro` deve ser preservado obrigatoriamente. É o único dos 6 ambientes com trabalho ainda não registrado no repositório oficial.
- **Arquivos que não podem ser perdidos:**
  1. `_design-reference/mockup-command-box-vista-piloto.html` (estado atual, 288 KB, 32 blocos) — contém a simplificação do painel do piloto;
  2. `_design-reference/_backup-original-2026-05-13/mockup-command-box-vista-piloto-ORIGINAL-2026-05-13.html` (293 KB, 38 blocos) — única fonte do painel piloto antes da simplificação;
  3. `_design-reference/_backup-original-2026-05-13/mockup-command-box-vista-engenheiro-ORIGINAL-2026-05-13.html` (301 KB, 30 blocos) — backup precaucional da Vista Engenheiro (mesmo tamanho e mesmo número de blocos do arquivo atual; pode ser idêntico, mas funciona como garantia);
  4. os 6 registros locais da linha de trabalho `claude/command-box-mockup-recovery`.
- **Sim**, continua proibido incorporar qualquer coisa à versão oficial. Esta tarefa é só de preservação documental.
- **Próximo Stint recomendado:** **Stint 4 — Registro formal do backup e da alteração pendente do ambiente `vista-engenheiro`**, sob autorização explícita do Flávio, executando dois passos isolados: (a) registrar a pasta de backup numa pasta de histórico permanente do projeto; (b) registrar a alteração pendente do `mockup-command-box-vista-piloto.html` na linha de trabalho atual `claude/command-box-mockup-recovery`, mantendo a submissão #205 aberta.

# Baseline registrada

| Item | Resultado |
|---|---|
| `pwd` na pasta principal | `/Users/imac/Projetos/P1 Fast` |
| `git status --short --branch` (principal) | `## wip/20260513-165852`; modificado `.claude-exec/ultima-tarefa.md`; não rastreado `AGENTS.md`, `AMBIENTES_P1_FAST.md`, `docs/auditorias/` |
| `git worktree list` | 7 entradas (1 principal + 6 ambientes Claude isolados + a sessão `naughty-babbage-15967b` desta auditoria) |
| Linha de trabalho do ambiente `vista-engenheiro` | `claude/command-box-mockup-recovery` |
| Status do ambiente `vista-engenheiro` | `M _design-reference/mockup-command-box-vista-piloto.html`; `?? _design-reference/_backup-original-2026-05-13/` |
| Diferença pendente | 44 linhas acrescentadas, 158 linhas removidas no `mockup-command-box-vista-piloto.html` |
| Últimos 6 registros locais | `2751b58` Vista Piloto: TODOS os blocos custom como fixos + correção de sobreposições; `8123658` restaura painel completo da Vista Piloto + auto-cura; `147dfeb` regra dura "quem testa sou eu, não o Flávio"; `52204b9` meta no-cache + cache-bust dinâmico no toggle Piloto↔Engenheiro; `15c911f` vista Engenheiro + toggle navegável; `798be32` recovery: mockup-command-box-vista-piloto encontrado |

# Itens críticos

| Item | Local | Estado | Risco | Recomendação |
|---|---|---|---|---|
| Alteração pendente da Vista Piloto | `.claude/worktrees/vista-engenheiro/_design-reference/mockup-command-box-vista-piloto.html` | modificado, não registrado | **Alto.** Se a linha de trabalho for trocada, descartada ou se um `git checkout` for executado, a simplificação de 158 linhas é perdida | preservar; planejar registro formal na submissão #205 |
| Pasta de backup original | `.claude/worktrees/vista-engenheiro/_design-reference/_backup-original-2026-05-13/` (2 arquivos, 594 KB) | não rastreada, fora do controle do repositório | **Alto.** Não está protegida por nenhum registro do repositório oficial; basta um `git clean` para sumir | preservar; decidir destino definitivo (sugestão abaixo) |
| Linha de trabalho `claude/command-box-mockup-recovery` (6 registros locais) | ambiente `vista-engenheiro` | em produção interna; já sincronizada com cópia remota da própria linha | Médio. Não é a versão oficial, mas é a base das submissões #201 e #205 | preservar; manter intocada até as submissões serem aprovadas |
| Arquivo `mockup-command-box-vista-engenheiro.html` atual | `_design-reference/mockup-command-box-vista-engenheiro.html` (301 KB, 30 blocos) | já registrado num dos 6 registros locais | Baixo (já está no repositório) | manter |
| Submissões formais abertas vinculadas | #201 (Command Box vista Engenheiro + restauração da vista Piloto) e #205 (Mockups Command Box vista piloto polidos) | abertas, aguardando aprovação | Médio. Se a linha de trabalho ou os arquivos forem alterados antes de aprovar, a submissão fica inconsistente | manter as duas abertas; não tocar até decisão sobre incorporação |

# Backup original

| Arquivo | Local | Tamanho | Função | Recomendação |
|---|---|---|---|---|
| `mockup-command-box-vista-piloto-ORIGINAL-2026-05-13.html` | `.claude/worktrees/vista-engenheiro/_design-reference/_backup-original-2026-05-13/` | 292.994 bytes (293 KB), 38 blocos identificados | Estado da Vista Piloto **antes** da simplificação (atual tem 32 blocos — 6 a menos) | preservar permanentemente; mover para pasta de histórico permanente do projeto (ver "Plano de preservação" abaixo) |
| `mockup-command-box-vista-engenheiro-ORIGINAL-2026-05-13.html` | mesmo local | 301.198 bytes (301 KB), 30 blocos identificados | Backup precaucional da Vista Engenheiro. Tem **exatamente o mesmo tamanho e número de blocos do arquivo atual** — provavelmente idêntico, mas funciona como rede de segurança | preservar permanentemente; mesma pasta de histórico |

# Diferença pendente

| Arquivo | Mudança | Interpretação | Recomendação |
|---|---|---|---|
| `_design-reference/mockup-command-box-vista-piloto.html` | 44 linhas acrescentadas, 158 linhas removidas; saiu de 38 blocos para 32 blocos (6 blocos a menos) | Simplificação do painel do piloto: 6 blocos saíram, novas regras de auto-cura/anti-cache/correção de sobreposição entraram. Coerente com os títulos dos registros locais ("TODOS os blocos custom como fixos", "restaura painel completo", "auto-cura nas duas vistas") | registrar formalmente na submissão #205 antes de qualquer operação Git que altere a árvore de trabalho |

# Relação com submissões

| Submissão | Relação | Ação recomendada |
|---|---|---|
| #201 (Command Box vista Engenheiro + restauração da vista Piloto) | Comporta os 6 registros locais da linha `claude/command-box-mockup-recovery`. Pode estar parcialmente coberta pela alteração pendente em `mockup-command-box-vista-piloto.html` (a "restauração da vista Piloto" foi continuada depois) | manter aberta; **não** incorporar à versão oficial sem antes confirmar com Flávio que o estado da Vista Piloto a entregar é o atual (32 blocos) e não o original (38 blocos) |
| #205 (Mockups Command Box vista piloto polidos) | Provavelmente é onde a alteração pendente do `mockup-command-box-vista-piloto.html` deveria ser registrada | manter aberta; o Stint 4 (próximo) deve registrar formalmente a diferença pendente nesta submissão |
| Demais submissões abertas (#166, #193, #202, #203, #204) | Não tocam diretamente o `vista-engenheiro` | fora do escopo deste Stint |

# Plano de preservação

## 1) O que deve ser preservado obrigatoriamente?

- a alteração pendente em `mockup-command-box-vista-piloto.html`;
- a pasta `_backup-original-2026-05-13/` inteira (2 arquivos, 594 KB);
- os 6 registros locais da linha de trabalho `claude/command-box-mockup-recovery`;
- a própria linha de trabalho (não excluir, não trocar, não reescrever histórico);
- as submissões formais abertas #201 e #205.

## 2) O que deve virar histórico?

- a pasta `_backup-original-2026-05-13/` é, por natureza, histórico. Recomendação: mover para uma pasta de histórico permanente do projeto, sugestão `_design-reference/_history/2026-05-13-command-box-pre-simplificacao/`, **com um arquivo `README.md` curto** explicando que esses dois arquivos são o estado anterior à simplificação do painel do piloto, e por isso ficam fora dos mockups ativos.
- esta movimentação **NÃO** é executada neste Stint; vira tarefa do Stint 4 sob autorização do Flávio.

## 3) O que deve ser comparado depois contra versão oficial?

- o estado dos mockups Command Box na versão oficial (se houver mockup equivalente em `_design-reference/` da `origin/main`) contra o estado atual em `vista-engenheiro`;
- a relação entre a Vista Engenheiro do ambiente isolado e o que MS-16 (Command Box Engenharia) registrou na versão oficial — pode haver sobreposição de conceito;
- a relação entre a alteração pendente da Vista Piloto e qualquer outro mockup de cockpit/Command Box já incorporado.

## 4) O backup deve ficar ligado à submissão #201/#205 ou ir para pasta de histórico?

**Ir para pasta de histórico**, e **não** entrar nas submissões #201/#205. Justificativa:

- as submissões #201 e #205 são sobre o **estado final** dos mockups, não sobre o estado anterior; misturar arquivos `*-ORIGINAL-*.html` na submissão polui a revisão e cria confusão na hora de aprovar;
- o backup tem valor histórico permanente (referência para qualquer revisão futura de design), por isso deve viver numa pasta declaradamente histórica, registrada no repositório oficial em momento separado;
- pasta sugerida: `_design-reference/_history/2026-05-13-command-box-pre-simplificacao/`, com `README.md` explicando o propósito.

## 5) Operações proibidas antes da preservação

- **incorporar à versão oficial** (`merge` para `main`/`master`) — o trabalho ainda não está pronto;
- **baixar atualizações** sobre a linha de trabalho `claude/command-box-mockup-recovery` (`git pull`) — pode trazer conflito no arquivo modificado;
- **enviar para o repositório oficial** (`git push`) — sem registrar primeiro a alteração pendente, ela é descartada;
- **trocar a linha de trabalho ativa** (`git checkout`) — perde a alteração pendente se não tiver sido registrada;
- **voltar atrás** (`git reset`) — pode apagar os 6 registros locais ou o arquivo modificado;
- **reescrever histórico** (`rebase`/`squash`) — pode descartar registros locais;
- **limpar arquivos não rastreados** (`git clean -f` / `-fd` / `-fdx`) — apaga a pasta `_backup-original-2026-05-13/` definitivamente, sem recuperação;
- **apagar a pasta `_design-reference/_backup-original-2026-05-13/`** por qualquer comando (`rm -rf`, mover pra Lixeira, etc.);
- **encerrar (`git worktree remove`) o ambiente `.claude/worktrees/vista-engenheiro`** — remove tudo o que não foi registrado.

## 6) Recomendação mais segura

1. **Não executar nenhuma operação Git no ambiente `vista-engenheiro` agora.**
2. Manter este relatório como contrato de preservação.
3. Abrir o Stint 4 sob autorização explícita do Flávio com duas tarefas mínimas:
   - 4a. mover a pasta `_backup-original-2026-05-13/` para `_design-reference/_history/2026-05-13-command-box-pre-simplificacao/` e registrar como submissão própria, separada das #201/#205;
   - 4b. registrar formalmente a alteração pendente em `mockup-command-box-vista-piloto.html` na submissão #205.
4. Só depois disso decidir o que faz `git pull` / `git fetch` / outras operações sobre `claude/command-box-mockup-recovery`.

# Próximo stint recomendado

**Stint 4 — Registro formal do backup e da alteração pendente do `vista-engenheiro`**

Objetivo: tirar o ambiente `vista-engenheiro` do estado "trabalho não registrado", sem incorporar nada à versão oficial.

Escopo:

- 4a. mover `_backup-original-2026-05-13/` para `_design-reference/_history/2026-05-13-command-box-pre-simplificacao/`, adicionar `README.md` curto explicando o propósito e registrar como submissão própria;
- 4b. registrar formalmente a diferença pendente no `mockup-command-box-vista-piloto.html` na linha de trabalho atual e atualizar a submissão #205;
- não tocar outras 5 áreas isoladas;
- não incorporar nada à versão oficial;
- pedir autorização explícita do Flávio antes de cada um dos dois sub-passos.

Critério de saída:

- backup originário oficialmente registrado em pasta de histórico do repositório;
- alteração da Vista Piloto registrada e submissão #205 atualizada;
- ambiente `vista-engenheiro` deixa de ter pendência não rastreada;
- nenhuma operação destrutiva foi executada;
- auditoria funcional profunda continua proibida.
