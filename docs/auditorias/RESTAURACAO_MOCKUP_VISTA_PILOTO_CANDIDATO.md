# Restauração Mockup Vista Piloto — Candidato Reconstruído

Data: 2026-05-14
Modo: troca do arquivo ativo do mockup dentro do ambiente isolado `vista-engenheiro`. Sem registro no histórico (sem commit), sem envio ao repositório oficial (sem push), sem submissão formal (sem PR), sem incorporação à versão oficial (sem merge), sem produção.

> Nota de linguagem: "ambiente isolado de trabalho" = cópia paralela do projeto numa pasta separada. "Linha de trabalho separada" = `branch`. "Registro" = `commit` (gravação no histórico). "Versão oficial" = `origin/main`. "Cópia remota da linha" = `origin/<branch>`.

## 1. Resumo executivo

O candidato reconstruído (`8095f968…`) foi **promovido para arquivo ativo** da Vista Piloto em:

`.claude/worktrees/vista-engenheiro/_design-reference/mockup-command-box-vista-piloto.html`

A operação foi puramente de cópia de arquivos no disco. **Nenhuma operação Git foi executada** — sem `commit`, `push`, `pull`, `merge`, `rebase`, `reset`. **Nenhuma submissão formal foi aberta**. **Nada foi incorporado à versão oficial**. **Produção não foi tocada**.

A versão simplificada antiga (`139d7afc…`) e o backup `2751b58` (`d2abc6ac…`) continuam preservados em pastas de histórico distintas dentro do mesmo ambiente isolado, intactos bit-a-bit.

## 2. Arquivos preservados

| Arquivo | Caminho | Função |
|---|---|---|
| Versão simplificada antiga | `.claude/worktrees/vista-engenheiro/_design-reference/_history/2026-05-14-restauracao-candidato-reconstruido/mockup-command-box-vista-piloto-SIMPLIFICADO-1018cbd-2026-05-14.html` | Preservação do estado anterior à promoção, para histórico e eventual reversão. |
| Backup `2751b58` | `.claude/worktrees/vista-engenheiro/_design-reference/_history/2026-05-13-command-box-pre-simplificacao/mockup-command-box-vista-piloto-ORIGINAL-2026-05-13.html` | Ponto-âncora histórico, intacto desde o Stint 5A. |
| Cópia de referência do candidato reconstruído | `.claude/worktrees/vista-engenheiro/_design-reference/_history/2026-05-14-restauracao-candidato-reconstruido/mockup-command-box-vista-piloto-CANDIDATO-RECONSTRUIDO-2026-05-14.html` | Cópia idêntica do que virou o arquivo ativo, na pasta histórica desta restauração. |
| **Arquivo ativo (novo)** | `.claude/worktrees/vista-engenheiro/_design-reference/mockup-command-box-vista-piloto.html` | **Versão agora vigente da Vista Piloto.** |
| Material de auditoria | `docs/auditorias/reconstrucao_vista_piloto/` (base, candidato, timeline, falhas, log_stats) | Cadeia auditável da reconstrução. |

Pasta histórica nova criada:
`.claude/worktrees/vista-engenheiro/_design-reference/_history/2026-05-14-restauracao-candidato-reconstruido/`

## 3. Validações técnicas

| Arquivo | Bytes | Linhas | Blocos `id=` | SHA-256 | vmin | pneus | motor | câmbio | óleo | Stint |
|---|---:|---:|---:|---|---:|---:|---:|---:|---:|---:|
| **Ativo NOVO** (`mockup-command-box-vista-piloto.html`) | **295.371** | **7.194** | **38** | `8095f968936de45084066c49a9932160be280ab88fdd7a1c0430f6d56ae94a30` | **49** | **42** | **18** | **9** | **9** | **42** |
| Candidato reconstruído (pasta de auditoria) | 295.371 | 7.194 | 38 | `8095f968936de45084066c49a9932160be280ab88fdd7a1c0430f6d56ae94a30` | 49 | 42 | 18 | 9 | 9 | 42 |
| Simplificado antigo (preservado em `_history/2026-05-14-…`) | 288.727 | 7.012 | 32 | `139d7afc9d7fd73200cc72d4854e25da2dfbc08d38a32d5644588def3c990eaa` | 44 | 36 | 15 | 6 | 6 | 39 |
| Backup `2751b58` (preservado em `_history/2026-05-13-…`) | 292.994 | 7.126 | 38 | `d2abc6ac4bb0b53b3f8c91f7945eb8b918c8649f9d57390d937e62a69f84076c` | 47 | 40 | 17 | 8 | 8 | 41 |

## 4. Confirmação de integridade

| Verificação | Resultado |
|---|---|
| Ativo é idêntico ao candidato reconstruído | **Sim** — mesmo hash SHA-256 (`8095f968…`) |
| Ativo é diferente da versão simplificada antiga | **Sim** — hashes diferentes (`8095f968…` ≠ `139d7afc…`) |
| Ativo é diferente do backup `2751b58` | **Sim** — hashes diferentes (`8095f968…` ≠ `d2abc6ac…`) |
| Backup `2751b58` continua intacto | **Sim** — hash bate com o esperado (`d2abc6ac…`) |
| Versão simplificada antiga foi preservada antes da troca | **Sim** — cópia salva em `_history/2026-05-14-restauracao-candidato-reconstruido/` com hash `139d7afc…` |
| Cópia de referência do candidato dentro da pasta histórica | **Sim** — hash idêntico ao ativo (`8095f968…`) |
| Material de auditoria em `docs/auditorias/reconstrucao_vista_piloto/` | Intacto, com `timeline.tsv`, `failures.tsv`, `log_stats.tsv`, `base_2751b58.html`, `candidato_reconstruido.html` |

## 5. Estado do Git

- **Linha de trabalho do ambiente isolado:** `claude/command-box-mockup-recovery`
- **Linha de trabalho da pasta principal:** `wip/20260513-165852` (não tocada por esta restauração)
- **Status do ambiente `vista-engenheiro`:**
  - `## claude/command-box-mockup-recovery...origin/claude/command-box-mockup-recovery [ahead 2]`
  - `M _design-reference/mockup-command-box-vista-piloto.html` (arquivo ativo recém-substituído)
  - `?? _design-reference/_history/2026-05-14-restauracao-candidato-reconstruido/` (pasta histórica nova, não rastreada)
- **Nenhum registro novo foi criado** (`git commit` não foi executado).
- **Nada foi enviado ao repositório oficial** (`git push` não foi executado).
- **Nenhuma submissão formal foi aberta** (pull request não foi criada).
- **Nada foi incorporado à versão oficial** (`git merge` não foi executado).
- **Outras 5 cópias de trabalho** (`auditoria-estrutura`, `competent-volhard-b272c8`, `f4-triagem-video`, `rodada1-s1`, `tender-lalande-0f034a`) não foram tocadas.

## 6. Link de validação visual

Servidor local na porta 8866 já estava ativo, servindo a pasta `_design-reference` do ambiente `vista-engenheiro`. Ele agora serve **o novo arquivo ativo**:

**Vista Piloto (versão promovida — candidato reconstruído):**
`http://127.0.0.1:8866/mockup-command-box-vista-piloto.html`

Versões anteriores continuam acessíveis pelo mesmo servidor:

- Backup `2751b58`: `http://127.0.0.1:8866/_history/2026-05-13-command-box-pre-simplificacao/mockup-command-box-vista-piloto-ORIGINAL-2026-05-13.html`
- Simplificado antigo: `http://127.0.0.1:8866/_history/2026-05-14-restauracao-candidato-reconstruido/mockup-command-box-vista-piloto-SIMPLIFICADO-1018cbd-2026-05-14.html`
- Cópia de referência do candidato promovido: `http://127.0.0.1:8866/_history/2026-05-14-restauracao-candidato-reconstruido/mockup-command-box-vista-piloto-CANDIDATO-RECONSTRUIDO-2026-05-14.html`

A página de auditoria com a base lado a lado do candidato continua na porta 8877:

- Base `2751b58`: `http://127.0.0.1:8877/base_2751b58.html`
- Candidato reconstruído: `http://127.0.0.1:8877/candidato_reconstruido.html`

## 7. Próximo passo recomendado

**Validação visual final pelo Flávio.** Abrir no navegador:

`http://127.0.0.1:8866/mockup-command-box-vista-piloto.html`

e confirmar que renderiza como esperado. Comparar, se quiser, com as versões preservadas listadas acima.

**Não recomendado neste momento:**

- abrir submissão formal (pull request);
- enviar para o repositório oficial (push);
- incorporar à versão oficial (merge);
- registrar no histórico (commit) — só fazer depois que o Flávio confirmar a validação final;
- tocar nos outros 5 ambientes isolados.

Quando o Flávio aprovar a validação visual final, em **Stint próprio sob nova autorização explícita**, planejar registrar este estado no histórico do ambiente isolado `vista-engenheiro` (sem ainda enviar para o repositório oficial).
