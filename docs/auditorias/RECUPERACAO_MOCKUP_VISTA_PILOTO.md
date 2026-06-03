# Recuperação Mockup Vista Piloto — P1 Fast

Data: 2026-05-14
Modo: somente leitura. Nenhum mockup foi alterado, nenhum arquivo do projeto foi tocado. Apenas auditoria forense.

> Nota de linguagem: "ambiente isolado de trabalho" = cópia paralela do projeto numa pasta separada. "Linha de trabalho separada" = `branch` (linha de evolução nomeada). "Registro" = `commit` (gravação no histórico). "Versão oficial" = `origin/main`.

## 1. Estado atual do Git

- **Diretório atual:** `/Users/imac/Projetos/P1 Fast`
- **Linha de trabalho atual (pasta principal):** `wip/20260513-165852`
- **Git status (pasta principal):**
  - `M .claude-exec/ultima-tarefa.md`
  - `?? AGENTS.md`
  - `?? AMBIENTES_P1_FAST.md`
  - `?? docs/auditorias/`
- **Últimos 5 registros da linha principal:** `e441fa0`, `e15f923`, `511ad99`, `651fab0`, `62dcfb4`
- **Cópias de trabalho ativas:** 7 (1 principal + 6 ambientes isolados Claude)
- **Ambiente que abriga os mockups Command Box:** `.claude/worktrees/vista-engenheiro`, linha `claude/command-box-mockup-recovery`, último registro `1018cbd`

## 2. Arquivos candidatos encontrados

Resultado de `find` por padrões `*command*box*`, `*vista*piloto*`, `*command*vista*` em todos os ambientes:

| # | Caminho | Tamanho | Linhas | Modificado | Observação |
|---|---|---:|---:|---|---|
| 1 | `.claude/worktrees/vista-engenheiro/_design-reference/mockup-command-box-vista-piloto.html` | 288.727 B | 7.012 | 2026-05-13 16:50 | **ATUAL** — versão simplificada após o Stint 5B (`1018cbd`) |
| 2 | `.claude/worktrees/vista-engenheiro/_design-reference/_history/2026-05-13-command-box-pre-simplificacao/mockup-command-box-vista-piloto-ORIGINAL-2026-05-13.html` | 292.994 B | 7.126 | 2026-05-13 16:42 | **BACKUP** — versão antes da simplificação (idêntica ao registro `2751b58`) |
| 3 | `.claude/worktrees/vista-engenheiro/_design-reference/mockup-command-box-vista-engenheiro.html` | 301.198 B | 7.435 | 2026-05-13 16:09 | Vista Engenheiro atual (igual ao backup — não foi simplificada) |
| 4 | `.claude/worktrees/vista-engenheiro/_design-reference/_history/2026-05-13-command-box-pre-simplificacao/mockup-command-box-vista-engenheiro-ORIGINAL-2026-05-13.html` | 301.198 B | 7.435 | 2026-05-13 16:23 | Backup precaucional da Vista Engenheiro |
| 5 | `_design-reference/mockup-command-box.html` (pasta principal) | 42.939 B | — | 2026-05-10 12:53 | Mockup ANTIGO do Command Box (antes da separação em Piloto/Engenheiro). **Não é o mockup polido.** |
| 6 | `_design-reference/selecao-command-box.html` (pasta principal) | 26.239 B | — | 2026-05-10 12:53 | Tela de seleção. **Não é o painel.** |
| 7 | `.claude/worktrees/competent-volhard-b272c8/_design-reference/mockup-command-box.html` | 42.939 B | — | 2026-05-13 12:16 | Cópia do antigo (#5) |
| 8 | `.claude/worktrees/naughty-babbage-15967b/_design-reference/mockup-command-box.html` | 42.939 B | — | 2026-05-14 15:03 | Cópia do antigo (#5) |

**Achado crítico:** o arquivo `mockup-command-box-vista-piloto.html` **NÃO existe na versão oficial** (`origin/main`) — confirmado por `git cat-file -e origin/main:...` retornando `exists on disk, but not in 'origin/main'`. Toda a vida desse arquivo está dentro do ambiente isolado `vista-engenheiro`.

### Histórico do arquivo via Git (linha `claude/command-box-mockup-recovery`)

| Registro | Bytes | Linhas | Blocos `id=` | Mensagem do registro |
|---|---:|---:|---:|---|
| `798be32` | 286.574 | 6.960 | 32 | recovery: mockup encontrado |
| `15c911f` | 286.709 | 6.962 | 32 | feat: vista Engenheiro do Command Box + toggle navegável |
| `52204b9` | 287.537 | 6.986 | 32 | fix: meta no-cache + cache-bust dinâmico no toggle |
| `8123658` | 290.226 | 7.051 | **34** | fix: **restaura painel completo da Vista Piloto** + auto-cura |
| `2751b58` | **292.994** | **7.126** | **38** | fix: **adiciona TODOS os blocos custom como fixos** + corrige sobreposições |
| `1018cbd` | 288.727 | 7.012 | **32** | design: preserve polished pilot view mockup (Stint 5B — versão atual) |

**Padrão claro:** entre `798be32` e `2751b58` o painel **cresceu** (de 32 para 38 blocos, +13.000 caracteres). Entre `2751b58` e `1018cbd` o painel **diminuiu** de novo (de 38 para 32 blocos, −4.267 bytes, −114 linhas, −6 blocos custom).

## 3. Evidências por arquivo

### Candidato A — `2751b58` (= backup ORIGINAL no `_history/`)

- **Hash SHA-256:** `d2abc6ac4bb0b53b3f8c91f7945eb8b918c8649f9d57390d937e62a69f84076c`
- **Equivalência bit-a-bit:** confirmada — o backup `_history/.../mockup-command-box-vista-piloto-ORIGINAL-2026-05-13.html` **é idêntico** ao registro `2751b58` (mesmo hash SHA-256).
- **Tamanho:** 292.994 bytes, 7.126 linhas, **38 blocos com identificador `id=`**.
- **Termos encontrados:**

| Termo | Ocorrências |
|---|---:|
| marcha | 11 |
| RPM | 56 |
| delta | 170 |
| Δ | 5 |
| Vista Piloto | 3 |
| Command Box | 2 |
| P1 Coach | 13 |
| P1 Fast | 4 |
| shift | 50 |
| gear | 37 |
| lap | 235 |
| vmin | **83** |
| apex | 128 |
| shift light | 4 |
| combustível | 16 |
| pneus | **60** |
| motor | **46** |
| câmbio | **10** |
| óleo | **8** |
| telemetria | 4 |
| Stint | **191** |

- **Sinais de painel completo:** vmin com 83 ocorrências, pneus com 60, motor com 46, Stint com 191 — todos os indicadores de telemetria/operação em valor máximo entre todas as versões.
- **Sinais de simplificação:** nenhum. É a versão MÁXIMA registrada.
- **Sinais de versão correta:** consistente com a mensagem do registro: "TODOS os blocos custom como fixos + corrige sobreposições". O termo "TODOS" é literal.

### Candidato B — `1018cbd` (versão ATUAL no disco, registrada no Stint 5B)

- **Tamanho:** 288.727 bytes, 7.012 linhas, **32 blocos `id=`** (6 a menos que o Candidato A).
- **Termos encontrados:**

| Termo | Ocorrências | vs 2751b58 |
|---|---:|---|
| marcha | 11 | igual |
| RPM | 56 | igual |
| delta | 171 | +1 |
| Δ | 5 | igual |
| Vista Piloto | 3 | igual |
| Command Box | 2 | igual |
| P1 Coach | 13 | igual |
| P1 Fast | 4 | igual |
| shift | 50 | igual |
| gear | 37 | igual |
| lap | 235 | igual |
| vmin | **75** | **−8** |
| apex | 128 | igual |
| shift light | 4 | igual |
| combustível | 16 | igual |
| pneus | **57** | **−3** |
| motor | **44** | **−2** |
| câmbio | **8** | **−2** |
| óleo | **6** | **−2** |
| telemetria | 4 | igual |
| Stint | **189** | **−2** |

- **Sinais de simplificação:** 6 blocos custom a menos; redução visível em todos os termos de **telemetria mecânica** (vmin, pneus, motor, câmbio, óleo). A identidade do produto (P1 Coach, Vista Piloto, Command Box, gear, shift, lap, apex) permaneceu.
- **Sinais de painel completo:** parcial. Mantém quase todo o vocabulário, mas perdeu blocos de detalhe.

### Candidato C — `8123658` (passo intermediário)

- Tamanho: 290.226 bytes, 7.051 linhas, 34 blocos.
- Mensagem: "restaura painel completo da Vista Piloto + auto-cura nas duas vistas".
- Posição: já mais completo que o estado atual, mas menos que o Candidato A.

### Candidato D — `mockup-command-box.html` da pasta principal (42.939 bytes)

- **NÃO é o mockup Vista Piloto.** É a versão antiga do Command Box anterior à separação Piloto/Engenheiro. Volume 1/7 do tamanho dos candidatos A/B/C. Confirmado como tela diferente.

## 4. Comparação das versões

| Aspecto | Atual `1018cbd` | Backup `_history/...-ORIGINAL` (= `2751b58`) | Diferença |
|---|---|---|---|
| Tamanho | 288.727 bytes | 292.994 bytes | **−4.267 bytes (−1,5%)** |
| Linhas | 7.012 | 7.126 | **−114 linhas (−1,6%)** |
| Blocos `id=` | 32 | **38** | **−6 blocos custom** |
| Termo `vmin` | 75 | **83** | **−8** |
| Termo `pneus` | 57 | **60** | **−3** |
| Termo `motor` | 44 | **46** | **−2** |
| Termo `câmbio` | 8 | **10** | **−2** |
| Termo `óleo` | 6 | **8** | **−2** |
| Termo `Stint` | 189 | **191** | **−2** |
| Diferença textual | — | — | `1 file changed, 44 insertions(+), 158 deletions(-)` |

- Atual vs Backup: bit-a-bit DIFERENTES (confirmado por `diff -q`).
- Backup vs registro `2751b58`: bit-a-bit IDÊNTICOS (mesmo hash SHA-256).
- Versão oficial (`origin/main`): **não tem** o arquivo — toda a história vive na linha `claude/command-box-mockup-recovery`.

## 5. Melhor candidato para a versão correta

**Arquivo:** `.claude/worktrees/vista-engenheiro/_design-reference/_history/2026-05-13-command-box-pre-simplificacao/mockup-command-box-vista-piloto-ORIGINAL-2026-05-13.html`

Equivalente em registro do histórico: `2751b58` — `fix(vista-piloto): adiciona TODOS os blocos custom como fixos + corrige sobreposições`.

(Os dois são bit-a-bit idênticos. Pode-se recuperar via arquivo do `_history/` ou via `git show 2751b58:_design-reference/mockup-command-box-vista-piloto.html`.)

## 6. Justificativa

1. **Painel mais rico, não simplificado.** É a única versão com **38 blocos custom** (todas as outras têm 32 ou 34).
2. **Telemetria mecânica em valor máximo.** Tem o maior número de ocorrências de `vmin`, `pneus`, `motor`, `câmbio`, `óleo`, `Stint` entre todas as versões — exatamente os termos do painel detalhado do piloto que aparecem desaparecer na versão atual.
3. **Mensagem do registro é explícita.** "TODOS os blocos custom como fixos + corrige sobreposições" indica intenção de fixar TUDO. A versão posterior (`1018cbd`) reduziu de novo a 32 blocos — incompatível com "TODOS".
4. **Equivalência bit-a-bit com o backup deliberadamente criado.** Quando alguém em 2026-05-13 às 16:42 fez o backup `*-ORIGINAL-2026-05-13.html`, copiou exatamente este estado. O ato de criar o backup é um forte sinal de que essa era a versão que se queria preservar como referência.
5. **Critério de "não escolher por ser mais novo" atendido.** A versão `2751b58` é **mais antiga** que a atual (`1018cbd`) e ainda assim é a recomendada — por preservar melhor o painel visual.
6. **Cabe nos 4 grupos de termos do produto** (marcha, P1 Coach, gear, shift, lap, apex, shift light, Command Box, Vista Piloto, P1 Fast) com **iguais ou mais** ocorrências que a versão atual.

## 7. Riscos encontrados

| Risco | Existe? | Detalhe |
|---|---|---|
| **A versão atual no disco parece estar errada** | **Sim** | A simplificação removeu 6 blocos custom e detalhes de telemetria que existiam no backup. Esses 6 blocos não são reconstruíveis sem regressão visual a olho. |
| Sobrescrita por engano da versão correta | **Médio** | O backup `_history/...-ORIGINAL-2026-05-13.html` está no disco mas só protegido contra `git clean` (foi gravado no histórico local pelo Stint 5A `20a19b9`). Pode ser perdido por `git reset --hard` antes do `20a19b9` ou por encerramento do ambiente isolado. |
| Perda do registro `2751b58` | Baixo | É registro do histórico Git; só some por `git reflog expire --expire=0 --all` ou destruição do `.git`. |
| Divergência entre cópias de trabalho | **Sim, mas controlada** | Só o ambiente `vista-engenheiro` tem este arquivo. As outras 5 cópias não. Não há conflito de versão; há ausência. |
| Versões conflitantes | Não | Não há duas versões "correta" disputando — só a `2751b58` é claramente mais completa. |
| Versão oficial corrompida | Não | A versão oficial **não tem** o arquivo; nada para corromper. |
| Risco se essa auditoria sair errada | Baixo | O ato de recuperar a `2751b58` é reversível enquanto o backup `_history/...-ORIGINAL-2026-05-13.html` e o registro `2751b58` estiverem preservados. |

## 8. Próximo passo recomendado

**UM ÚNICO próximo passo, ainda sem executá-lo:**

Apresentar ao Flávio, **no navegador**, lado a lado, duas abas:

- **Atual (1018cbd):** `http://127.0.0.1:8866/mockup-command-box-vista-piloto.html`
- **Backup correto (2751b58):** `http://127.0.0.1:8866/_history/2026-05-13-command-box-pre-simplificacao/mockup-command-box-vista-piloto-ORIGINAL-2026-05-13.html`

Para o Flávio decidir visualmente se confirma a versão `2751b58` como correta. Só depois dessa confirmação visual, em **um próximo Stint sob nova autorização explícita**, planejar a recuperação:

- mover (não copiar, não sobrescrever sem cópia de segurança) a versão `2751b58` de volta como `mockup-command-box-vista-piloto.html` ativo;
- preservar o atual `1018cbd` em outra pasta de histórico (para não perder o trabalho da simplificação);
- registrar o novo estado em uma linha de trabalho separada;
- **sem incorporar à versão oficial nesse stint**.

**Não fazer nada disso agora.** A auditoria forense não autoriza recuperação. Só apresentação visual ao Flávio.
