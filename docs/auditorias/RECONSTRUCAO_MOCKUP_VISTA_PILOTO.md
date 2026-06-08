# Reconstrução Mockup Vista Piloto

Data: 2026-05-14
Modo: somente leitura no projeto. Toda a reconstrução vive isolada em `docs/auditorias/reconstrucao_vista_piloto/`. Nenhum mockup ativo do projeto foi tocado.

> Nota de linguagem: "ambiente isolado de trabalho" = cópia paralela do projeto numa pasta separada. "Linha de trabalho separada" = `branch`. "Registro" = `commit` (gravação no histórico). "Versão oficial" = `origin/main`. "Edit/Write" são nomes técnicos das ferramentas internas do Claude — Edit = substituir um pedaço de texto; Write = sobrescrever o arquivo inteiro.

## 1. Resumo executivo

**Sim — a reconstrução cronológica gerou um candidato MELHOR que o backup `2751b58`.**

| Métrica | Base `2751b58` | **Candidato reconstruído** | Atual simplificado (`1018cbd`) |
|---|---:|---:|---:|
| Bytes | 292.994 | **295.371 (+2.377)** | 288.727 (−4.267) |
| Linhas | 7.126 | **7.194 (+68)** | 7.012 (−114) |
| Blocos `id=` | 38 | **38 (=)** | 32 (−6) |
| Termo `vmin` | 47 | **49 (+2)** | 44 (−3) |
| Termo `pneus` | 40 | **42 (+2)** | 36 (−4) |
| Termo `motor` | 17 | **18 (+1)** | 15 (−2) |
| Termo `câmbio` | 8 | **9 (+1)** | 6 (−2) |
| Termo `óleo` | 8 | **9 (+1)** | 6 (−2) |
| Termo `Stint` | 41 | **42 (+1)** | 39 (−2) |

O candidato manteve os 38 blocos do `2751b58` **e** ganhou conteúdo de telemetria mecânica em todos os termos que o atual simplificado havia perdido. É um enriquecimento, não uma simplificação.

Importante: a reconstrução é **parcial** — só 4 das 31 edições da janela puderam ser aplicadas sobre o `2751b58`. As outras 27 não encaixaram porque dependem de um estado intermediário diferente do `2751b58`. O candidato é um intermediário entre `2751b58` e a "última versão final" hipotética, não a final exata.

## 2. Base usada

| Campo | Valor |
|---|---|
| Caminho de origem | `.claude/worktrees/vista-engenheiro/_design-reference/_history/2026-05-13-command-box-pre-simplificacao/mockup-command-box-vista-piloto-ORIGINAL-2026-05-13.html` |
| Cópia para reconstrução | `docs/auditorias/reconstrucao_vista_piloto/base_2751b58.html` |
| Tamanho | 292.994 bytes |
| Linhas | 7.126 |
| Hash SHA-256 | `d2abc6ac4bb0b53b3f8c91f7945eb8b918c8649f9d57390d937e62a69f84076c` |
| Equivalência | bit-a-bit idêntica ao registro `2751b58` do histórico Git |

## 3. Logs processados

Apenas operações com timestamp **igual ou posterior a 2026-05-13 16:42** (momento do backup `2751b58`) foram consideradas.

| Log | Tamanho | Operações encontradas | Aplicadas | Rejeitadas |
|---|---:|---:|---:|---:|
| `competent-volhard-b272c8/e908e732-…` | 4,7 MB | **31** | **4** | **27** |
| (outros 11 logs) | — | 0 na janela posterior ao backup | 0 | 0 |

Total considerado: **31 operações** (de 581 candidatas ao todo no projeto — 550 foram anteriores ao backup, fora da janela).

Distribuição dos logs **anteriores** ao backup (não usados nesta reconstrução, mas mapeados):

| Log | Ops do mockup antes do `2751b58` |
|---|---:|
| `strange-rhodes-db9740/012a0a85-…` | 132 |
| `strange-rhodes-db9740/8d8a14f4-…` | 120 |
| `strange-rhodes-db9740/22a41a8d-…` | 67 |
| `exciting-ardinghelli-572eec/c7f3dcd0-…` | 63 |
| `kind-goldberg-1caba1/7a5d5229-…` | 50 |
| `kind-goldberg-1caba1/b7144718-…` | 44 |
| `strange-rhodes-db9740/498246b4-…` | 22 |
| `kind-goldberg-1caba1/41a1b7b3-…` | 22 |
| `exciting-ardinghelli-572eec/8736b516-…` | 17 |
| `kind-goldberg-1caba1/e8c21baf-…` | 12 |
| `strange-rhodes-db9740/a4e57165-…` | 1 |

Esses 550 registros descrevem a construção que levou ao `2751b58` — já estão consolidados nele. **Não foram reaplicados** para não desfazer a base.

## 4. Linha do tempo das edições aplicadas

Janela ativa: 2026-05-13 **18:53 → 19:50** (uma sessão de trabalho de ≈1 hora dentro do ambiente isolado `competent-volhard-b272c8`).

Edições com sucesso, em ordem:

| # | Timestamp | Tipo | Resultado |
|---|---|---|---|
| 13 | 2026-05-13 19:20:23 | Edit | aplicado (1 ocorrência, sem `replace_all`) |
| 18 | 2026-05-13 19:38:52 | Edit | aplicado (1 ocorrência, sem `replace_all`) |
| 19 | 2026-05-13 19:40:01 | Edit | aplicado (1 ocorrência, sem `replace_all`) |
| 27 | 2026-05-13 19:42:00 | Edit | aplicado (1 ocorrência, sem `replace_all`) |

Detalhamento completo no arquivo `docs/auditorias/reconstrucao_vista_piloto/timeline.tsv`.

## 5. Falhas de aplicação

27 edições não encaixaram. Em todas o motivo foi o mesmo: **`old_string` não encontrado** no estado corrente da reconstrução. Tamanhos dos `old_string` rejeitados variando entre 64 e 1.056 caracteres.

| Faixa de tamanho do trecho-alvo | Quantidade | Impacto provável |
|---|---:|---|
| 60–100 caracteres | 9 | edições pequenas/cosméticas — perda mínima de polimento |
| 100–250 caracteres | 10 | edições médias — possíveis ajustes de bloco/seção |
| 250–500 caracteres | 4 | edições maiores — possível adição/remoção de subbloco |
| 500–1.100 caracteres | 4 | reescritas grandes — possíveis ganhos importantes não capturados |

Detalhamento completo em `docs/auditorias/reconstrucao_vista_piloto/failures.tsv`.

**Interpretação:** essas 27 rejeições não significam que o trabalho original foi perdido — significam que a sessão `competent-volhard-b272c8/e908e732-…` partiu de um **estado intermediário diferente do `2751b58`** (provavelmente herdado das sessões anteriores em `strange-rhodes` ou `kind-goldberg` que ficaram em memória das sessões já apagadas). Como o estado real **dessa hora** não foi preservado em arquivo no disco e nem no histórico Git, a cadeia quebra.

## 6. Comparativo técnico

Termos por arquivo (extraído por `grep` literal):

| Termo | Base `2751b58` | Candidato reconstruído | Atual simplificado |
|---|---:|---:|---:|
| bytes | 292.994 | **295.371** | 288.727 |
| linhas | 7.126 | **7.194** | 7.012 |
| blocos `id=` | 38 | **38** | 32 |
| marcha | 13 | 13 | 13 |
| RPM | 4 | 4 | 4 |
| delta | 153 | 153 | 154 |
| Δ | 5 | 5 | 5 |
| Vista Piloto | 3 | 3 | 3 |
| Command Box | 2 | 2 | 2 |
| P1 Coach | 8 | 8 | 8 |
| P1 Fast | 1 | 1 | 1 |
| shift | 46 | 46 | 46 |
| gear | 39 | 39 | 39 |
| lap | 176 | 176 | 176 |
| **vmin** | 47 | **49** | 44 |
| apex | 127 | 127 | 127 |
| shift light | 2 | 2 | 2 |
| combustível | 4 | 4 | 4 |
| **pneus** | 40 | **42** | 36 |
| **motor** | 17 | **18** | 15 |
| **câmbio** | 8 | **9** | 6 |
| **óleo** | 8 | **9** | 6 |
| telemetria | 1 | 1 | 1 |
| **Stint** | 41 | **42** | 39 |
| cockpit | 2 | 2 | 2 |

Diferença textual: o candidato é monotonicamente **maior ou igual** ao `2751b58` em todos os termos. **Enriquecimento, nunca simplificação.**

Hashes:

| Arquivo | SHA-256 |
|---|---|
| `base_2751b58.html` | `d2abc6ac4bb0b53b3f8c91f7945eb8b918c8649f9d57390d937e62a69f84076c` |
| `candidato_reconstruido.html` | `8095f968936de45084066c49a9932160be280ab88fdd7a1c0430f6d56ae94a30` |

## 7. Melhor candidato

**Candidato reconstruído (`8095f968…`) é melhor que o `2751b58`.**

Razões objetivas:

1. Maior em bytes (+2.377) e linhas (+68).
2. Mantém os 38 blocos `id=` do `2751b58` (zero regressão estrutural).
3. Cresce em todos os termos de telemetria mecânica (vmin, pneus, motor, câmbio, óleo, Stint) — exatamente os termos que o atual simplificado havia perdido.
4. Nenhuma das 4 edições aplicadas removeu blocos ou reduziu o painel; só acrescentou ou ajustou conteúdo.
5. Cadeia cronológica documentada em `timeline.tsv` — não há fabricação de conteúdo.

Caveat: ainda **não é** a "última versão final" exata. É um intermediário **superior ao `2751b58`** porém **incompleto**, porque 27 edições da mesma sessão dependiam de um estado intermediário não recuperável.

## 8. Riscos

| Risco | Existe? | Detalhe |
|---|---|---|
| Reconstrução incompleta | **Sim, confirmado** | 27 de 31 edições da janela não encaixaram. O candidato é melhor que o `2751b58`, mas pode estar abaixo da "última versão final" real. |
| Edição perdida (uma das 27 rejeitadas era crítica) | **Médio** | As 4 rejeições maiores (500–1.100 chars) podem ter sido reescritas estruturais. Sem o estado intermediário, não dá pra confirmar. |
| Ordem incorreta | Baixo | A ordenação foi por timestamp ISO. Empate dentro do mesmo timestamp foi resolvido por `(log, linha)`. As 4 aplicadas vieram da mesma sessão e o estado pós-edição é coerente. |
| `replace_all` perigoso | Não aplicável | Todas as 4 edições aplicadas foram `replace_all=False` com 1 ocorrência. Nenhuma substituição massiva foi feita. |
| Logs incompletos | **Sim** | 4 ambientes isolados foram apagados sem registro formal no histórico Git. Seus logs JSONL ficaram, mas o **estado do arquivo entre operações** não. |
| HTML quebrado | A confirmar | Hashes batem, tamanho razoável, blocos íntegros — mas só inspeção visual no navegador confirma se renderiza. |
| Confundir o candidato com a "versão definitiva" | **Sim** | O candidato é melhor que o `2751b58`, mas **não é** o estado final exato. Não deve ser tratado como verdade absoluta até validação visual do Flávio. |

## 9. Próximo passo recomendado

**Um único próximo passo, ainda sem executá-lo:**

**Validação visual lado-a-lado pelo Flávio**, no navegador, das três versões servidas pelo servidor local:

- Base `2751b58`: `http://127.0.0.1:8877/base_2751b58.html`
- Candidato reconstruído: `http://127.0.0.1:8877/candidato_reconstruido.html`
- Atual simplificado: `http://127.0.0.1:8866/mockup-command-box-vista-piloto.html` (porta 8866 já estava no ar)

Se o candidato reconstruído renderizar bem e o Flávio reconhecer como mais próximo da "última versão correta" do que o `2751b58`, abrir um próximo Stint sob nova autorização para:

- gravar o candidato como base de trabalho em uma linha de trabalho separada própria;
- ainda **sem incorporar à versão oficial**;
- mantendo as 4 versões (atual, base `2751b58`, candidato reconstruído, eventual final aprovado) em pastas separadas até decisão definitiva.

Se o candidato quebrar visualmente ou parecer pior, **manter o `2751b58` como melhor base**, e fazer Stint separado para tentar reconstrução a partir de outro log inicial (por exemplo, `strange-rhodes-db9740/012a0a85-…` que tem 132 operações — todas anteriores ao `2751b58`, mas talvez juntas representem outro caminho de evolução).

**Não fazer nada disso agora.** Esta reconstrução só audita e prepara.
