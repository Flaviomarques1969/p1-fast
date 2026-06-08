# Recuperação Mockup Vista Piloto — Fase 2

Data: 2026-05-14
Modo: somente leitura. Nenhum mockup foi alterado, nenhum arquivo do projeto foi tocado.

> Nota de linguagem: "ambiente isolado de trabalho" = cópia paralela do projeto numa pasta separada. "Linha de trabalho separada" = `branch`. "Registro" = `commit` (gravação no histórico). "Versão oficial" = `origin/main`. "Cópia remota da linha" = `origin/<branch>` (cópia da linha de trabalho separada no repositório oficial). "Blob órfão" = arquivo guardado no histórico do Git que ninguém mais aponta — sobra de versões antigas.

## 1. Resumo executivo

**Não foi encontrada nenhuma versão mais completa que o backup `2751b58` (292.994 B / 38 blocos).** Esse continua sendo a melhor base conhecida atualmente recuperável de forma direta.

**Porém** há fortes indícios de que **existiu** uma versão posterior — mais polida — que foi **perdida em ambientes isolados de trabalho removidos do disco sem registro formal no histórico do Git**:

- Quatro ambientes isolados foram apagados do disco (`strange-rhodes-db9740`, `kind-goldberg-1caba1`, `objective-black-9f7583`, `exciting-ardinghelli-572eec`).
- Os logs internos do Claude desses ambientes ainda vivem em `/Users/imac/.claude/projects/`.
- Esses logs registram **centenas de edições** no `mockup-command-box-vista-piloto.html` (133 + 121 + 44 + 69 = **367 edições combinadas** + várias gravações integrais nos 4 logs mais relevantes).
- A versão integral mais recente capturada nos logs é antiga (2026-05-08, 33 KB, 4 blocos — não é o estado final).
- Reconstruir o estado final exigiria **encadear centenas de edições parciais** a partir de um estado inicial — operação frágil que deve virar um Stint dedicado.

Atalho real disponível agora: continuar usando o `2751b58` como base e, em Stint próprio sob nova autorização, tentar reconstruir o estado final via cadeia de edições nos logs Claude.

## 2. Estado atual

- **Diretório atual:** `/Users/imac/Projetos/P1 Fast`
- **Linha de trabalho atual (pasta principal):** `wip/20260513-165852`
- **Git status (pasta principal):** `M .claude-exec/ultima-tarefa.md`; não rastreados `AGENTS.md`, `AMBIENTES_P1_FAST.md`, `docs/auditorias/`
- **Ambientes isolados ativos:** 7 (1 principal + 6 cópias de trabalho)
- **Ambientes isolados removidos do disco** (mas com log preservado em `~/.claude/projects/`):
  - `strange-rhodes-db9740`
  - `kind-goldberg-1caba1`
  - `objective-black-9f7583`
  - `exciting-ardinghelli-572eec` (o servidor antigo da porta 8765 ainda está rodando apontando pra essa pasta-fantasma)
- **Servidores HTTP locais encontrados:**

| Porta | PID | CWD atual | Estado |
|---|---|---|---|
| 8765 | 9237 | `.claude/worktrees/exciting-ardinghelli-572eec/_design-reference` | **a pasta NÃO EXISTE MAIS no disco** — o servidor está com `cwd` apontando pra inode apagado |
| 8866 | 69102 | `.claude/worktrees/vista-engenheiro/_design-reference` | em uso para a validação visual atual |

## 3. Candidatos encontrados

### 3.1 No histórico Git (em todas as linhas de trabalho, locais e remotas)

| # | Origem | Tamanho | Linhas | Blocos `id=` | Data | Observação |
|---|---|---:|---:|---:|---|---|
| A | `refs/remotes/origin/claude/command-box-mockup-recovery` (= registro `2751b58`) | **292.994 B** | **7.126** | **38** | 2026-05-13 16:42 | **Maior versão conhecida.** Bit-a-bit idêntico ao backup do `_history/`. |
| B | `refs/heads/claude/command-box-mockup-recovery` (= registro `1018cbd`, atual no disco) | 288.727 B | 7.012 | 32 | 2026-05-14 16:28 | Versão simplificada (Stint 5B). |
| C | `refs/heads/feat/mockups-command-box-piloto` (= registro `8b39562`) | 286.574 B | 6.960 | 32 | 2026-05-13 14:46 | "feat(mockups): Command Box vista piloto polido + páginas de dúvidas" — **anterior ao `2751b58`**, ainda no estado de 32 blocos. |
| D | `refs/remotes/origin/feat/mockups-command-box-piloto` | 286.574 B | 6.960 | 32 | 2026-05-13 14:48 | Cópia remota do C — mesma versão. |
| E | `refs/remotes/origin/claude/exciting-ardinghelli-572eec` | 99.171 B | 2.570 | 26 | — | **Versão muito anterior e bem menor.** Confirma que essa cópia de trabalho trabalhou com outro estado. |

### 3.2 Arquivos no disco (todos os ambientes isolados)

Únicos arquivos no disco do projeto que se chamam `mockup-command-box-vista-piloto*`:

| Caminho | Tamanho | Linhas | Modificado |
|---|---:|---:|---|
| `.claude/worktrees/vista-engenheiro/_design-reference/mockup-command-box-vista-piloto.html` | 288.727 B | 7.012 | 2026-05-13 16:50 |
| `.claude/worktrees/vista-engenheiro/_design-reference/_history/2026-05-13-command-box-pre-simplificacao/mockup-command-box-vista-piloto-ORIGINAL-2026-05-13.html` | 292.994 B | 7.126 | 2026-05-13 16:42 |

Nenhum outro ambiente isolado tem cópia desse arquivo.

### 3.3 Blobs órfãos do Git

`git fsck --full --no-reflogs --unreachable` retornou **muitos** blobs órfãos. Filtrados por:

- tamanho ≥ 100 KB **E**
- conteúdo contém `"Vista Piloto"` OU `"P1 Coach"`

**Resultado: zero blobs órfãos.** Nenhuma versão perdida do mockup Vista Piloto sobreviveu como blob desconectado do Git.

(Os blobs órfãos maiores que 280 KB do `git fsck` são outros arquivos do projeto — não contêm os termos do Command Box.)

### 3.4 Logs internos do Claude Code

| Log | Tamanho | Writes do mockup | Edits do mockup |
|---|---:|---:|---:|
| `strange-rhodes-db9740/012a0a85-…` | 19,4 MB | 2 | **133** |
| `strange-rhodes-db9740/8d8a14f4-…` | 17,0 MB | 1 | 121 |
| `strange-rhodes-db9740/22a41a8d-…` | 4,2 MB | 7 | 69 |
| `kind-goldberg-1caba1/b7144718-…` | 6,0 MB | 0 | 44 |
| `objective-black-9f7583/ec84bff3-…` | 5,0 MB | — | — |
| (outros menores) | … | … | … |

**Total de gravações integrais (Writes) detectadas que de fato contêm o arquivo:** **1** — datada de 2026-05-08, com 33 KB e 4 blocos (versão muito anterior, **NÃO É** a polida).

As outras "Writes" capturadas no `grep` referenciam o caminho do mockup mas não são gravação integral dele (são scripts/relatórios que apenas citam o caminho).

Conclusão prática dos logs Claude: o estado final do mockup nessas sessões removidas só pode ser reconstruído **encadeando dezenas a centenas de edições parciais** em ordem cronológica, a partir de um estado inicial conhecido. Operação possível, mas frágil e fora do escopo desta Fase 2.

### 3.5 Servidores locais

- **Porta 8866** (PID 69102, cwd `.claude/worktrees/vista-engenheiro/_design-reference`) — servindo as duas versões atuais.
- **Porta 8765** (PID 9237) — está com `cwd` apontando para `.claude/worktrees/exciting-ardinghelli-572eec/_design-reference`, mas **essa pasta foi apagada** quando o ambiente isolado foi removido. O servidor responde HTTP 200 mas o conteúdo servido é cache do que estava em memória/inode antes da remoção. **Não dá pra inspecionar como referência confiável** porque qualquer recarga pode falhar.

## 4. Comparação com o backup `2751b58`

| Candidato | Tamanho | Blocos `id=` | Δ vs `2751b58` | Status |
|---|---:|---:|---|---|
| **A — `2751b58` (backup `_history/`)** | **292.994 B** | **38** | — | Referência |
| B — `1018cbd` (atual no disco) | 288.727 B | 32 | **−4.267 B / −6 blocos** | Simplificação |
| C / D — `feat/mockups-command-box-piloto` | 286.574 B | 32 | **−6.420 B / −6 blocos** | Anterior |
| E — `origin/claude/exciting-ardinghelli-572eec` | 99.171 B | 26 | **−193.823 B / −12 blocos** | Muito anterior |
| Único Write integral nos logs (2026-05-08) | 33.172 B | 4 | **−259.822 B / −34 blocos** | Início do mockup |
| Blobs órfãos com Vista Piloto/P1 Coach | — | — | — | Nenhum encontrado |

**Nenhum candidato supera o `2751b58` em tamanho, número de linhas ou número de blocos.**

## 5. Melhor candidato encontrado na Fase 2

`2751b58` continua sendo a melhor base conhecida e diretamente recuperável.

Arquivo equivalente bit-a-bit no disco:
`.claude/worktrees/vista-engenheiro/_design-reference/_history/2026-05-13-command-box-pre-simplificacao/mockup-command-box-vista-piloto-ORIGINAL-2026-05-13.html`

## 6. Evidências

1. **Histórico Git completo varrido.** Todas as 5 linhas de trabalho (locais + cópias remotas) que tocam o arquivo foram conferidas. O maior valor de tamanho/linhas/blocos é o `2751b58`.
2. **`git fsck --unreachable` rodado e filtrado.** Zero blobs órfãos contêm "Vista Piloto" ou "P1 Coach".
3. **Logs Claude varridos.** Existem 367+ edições parciais nas 4 sessões removidas, mas só 1 Write integral capturada — e é antiga e mínima.
4. **Pasta-fantasma do servidor 8765 não tem conteúdo recuperável.** O ambiente isolado `exciting-ardinghelli-572eec` foi apagado; o servidor responde de cache inode mas qualquer leitura nova falha.
5. **Critério "não escolher por ser mais novo".** O `2751b58` é mais antigo que o atual `1018cbd` e ainda assim continua sendo o melhor — porque preserva 6 blocos custom que sumiram.

## 7. Riscos

| Risco | Existe? | Detalhe |
|---|---|---|
| **A versão "última correta" pode ter sido perdida de vez** | **Sim** | Se ela existiu apenas em RAM nos ambientes isolados `strange-rhodes-db9740` ou `kind-goldberg-1caba1` (que foram apagados sem registro formal no histórico do Git), o estado final exato só sobrevive como cadeia de edições parciais nos logs do Claude. Reconstruir é frágil. |
| Cadeia de edições nos logs Claude pode ser frágil | **Sim** | 367+ edições parciais combinadas. Qualquer edição que use `replace_all` ou que dependa de contexto perdido quebra a reconstrução. |
| Backup `2751b58` perder o status atual | Baixo | Já está gravado no histórico local (registro `20a19b9` do Stint 5A) e existe como cópia remota da linha `origin/claude/command-box-mockup-recovery`. Só some por `git reflog expire`+`git gc` ou destruição do repositório. |
| Versão `1018cbd` (atual no disco) ser tratada como "correta" | **Sim** | Se nada for feito, a base de trabalho do dia-a-dia continua sendo a simplificada de 32 blocos. |
| Servidor da porta 8765 confundir o gestor | Médio | Está servindo conteúdo de uma pasta apagada — listagem nova pode estourar erro a qualquer momento. |
| Outras cópias de trabalho terem o arquivo | Não | Confirmado: só o ambiente isolado `vista-engenheiro` tem `mockup-command-box-vista-piloto.html`. |
| Versão oficial corrompida | Não | A versão oficial **não tem** o arquivo. Nada a corromper. |

## 8. Próximo passo recomendado

**Um único próximo passo, ainda sem executá-lo:**

Em um Stint próprio sob nova autorização explícita do Flávio, fazer uma **reconstrução cronológica via logs Claude** das sessões removidas, **somente em modo de leitura/extração**:

1. Identificar a sessão Claude que tem a sequência mais longa de Edits da Vista Piloto **após** o `2751b58` (provavelmente `strange-rhodes-db9740/012a0a85-…` com 133 Edits, ou `kind-goldberg-1caba1/b7144718-…` com 44 Edits, ou `strange-rhodes-db9740/22a41a8d-…` com 69 Edits).
2. Reproduzir as Edits em ordem **sobre uma cópia separada** do `2751b58`, **sem tocar no arquivo ativo** nem nas demais cópias de trabalho.
3. Comparar o resultado com o `2751b58` e com o `1018cbd`, e apresentar ao Flávio para validação visual.
4. **Não executar nesse Stint** restauração, gravação no histórico oficial ou envio para o repositório oficial.

Critério de saída do próximo Stint:

- arquivo reconstruído gerado em pasta de trabalho de auditoria, não em mockup ativo;
- comparação visual no navegador local;
- decisão do Flávio sobre qual versão vira a base.

**Não fazer nada disso agora.** A Fase 2 só audita e relata.
