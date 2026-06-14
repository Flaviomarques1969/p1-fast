# STATUS_ATUAL

## Contexto registrado

Data: 2026-05-14

Fonte oficial candidata:

`/Users/imac/Projetos/P1 Fast`

## Comandos registrados

```bash
pwd
git status --short --branch
git branch --show-current
git remote -v
ls
git worktree list
git rev-list --left-right --count HEAD...origin/main
git log --oneline --decorate -10
```

## Resultado

| Item | Estado |
|---|---|
| Diretório atual | `/Users/imac/Projetos/P1 Fast` |
| É Git | Sim |
| Branch atual | `wip/20260513-165852` |
| Git status atual | `?? AGENTS.md`, `?? AMBIENTES_P1_FAST.md`, `?? docs/auditorias/` |
| Git status antes da governança | Limpo no worktree principal |
| Remote | `origin https://github.com/Flaviomarques1969/p1-fast.git` |
| Divergência com `origin/main` | `5 ahead / 33 behind` |
| Relação com `origin/main` | Branch paralela; nenhum lado é ancestral direto do outro |
| Merge-base | `3121feff96cc6be06f48a86b5b456795bd9e089c` |
| Worktrees | Sim, 6 worktrees Claude |
| Worktree com pendência observada | `.claude/worktrees/vista-engenheiro` |
| Base provável para reconciliação | `origin/main` |
| Auditoria funcional profunda | Proibida até reconciliação |

## Últimos commits da branch atual

| Commit | Mensagem |
|---|---|
| `e441fa0` | `20260513-165740` |
| `e15f923` | `20260511-200121` |
| `511ad99` | `20260510-185834` |
| `651fab0` | `auto-save: 12:56:28` |
| `62dcfb4` | `auto-save: 00:23:26` |
| `3121fef` | `feat(ui-publish): job diagnóstico com binlog + log completo (#158)` |
| `79a0501` | `feat(MS-13.2 PR-K): pulso da mensagem de alerta GRAVE (#165)` |
| `7b4825b` | `feat(MS-13.2 PR-J): flash branco do shift light na troca de marcha (#164)` |
| `6fce1ff` | `feat(MS-13.2 PR-I): halo radial gradiente + pulso nos estados de glória (#163)` |
| `3ac0918` | `feat(MS-13.2 PR-H): demo loop completo de 4 voltas (V5+V6+V7+V8) da fixture (#162)` |

## Estrutura principal encontrada

| Área | Encontrado? | Evidência |
|---|---:|---|
| README | Sim | `README.md` |
| Docs | Sim | `docs/`, `STATUS.md`, `ARCHITECTURE_DECISIONS.md` |
| iOS | Sim | `ios/`, `ios/p1fast-core`, `ios/p1fast-ios` |
| Windows/cockpit | Sim | `windows/cockpit` |
| Telemetry | Sim | `src/telemetry`, `docs/telemetry` |
| Cockpit | Sim | `web/cockpit`, `_design-reference/mockup-cockpit-*`, `windows/cockpit` |
| Box/Command Box | Parcial | `_design-reference/mockup-command-box.html`, `web/cockpit/fixtures`; mockups mais específicos aparecem em `vista-engenheiro` |
| Testes | Sim | `tests/`, `windows/cockpit/P1Fast.Cockpit.Domain.Tests` |
| Supabase | Sim | `supabase/` |

## Worktrees registrados

| Worktree | Branch | Divergência vs `origin/main` | Status | Observação |
|---|---|---:|---|---|
| `/Users/imac/Projetos/P1 Fast` | `wip/20260513-165852` | `5 ahead / 33 behind` | Governança não rastreada | Principal, mas paralela/atrás |
| `.claude/worktrees/auditoria-estrutura` | `claude/auditoria-estrutura` | `4 ahead / 10 behind` | Limpo | Ajustes ADR/STATUS/PLANO/detector |
| `.claude/worktrees/competent-volhard-b272c8` | `claude/competent-volhard-b272c8` | `5 ahead / 33 behind` | Limpo | Autosave/local paralelo |
| `.claude/worktrees/f4-triagem-video` | `claude/f4-triagem-video` | `6 ahead / 11 behind` | Limpo | Triagem de vídeo e migrations |
| `.claude/worktrees/rodada1-s1` | `claude/rodada1-s1` | `13 ahead / 7 behind` | Limpo | Telas iOS, stints, voltas, massa fictícia |
| `.claude/worktrees/tender-lalande-0f034a` | `claude/develop-cockpit-app-rotation` | `8 ahead / 34 behind` | Limpo | Rotação cockpit Windows |
| `.claude/worktrees/vista-engenheiro` | `claude/command-box-mockup-recovery` | `6 ahead / 0 behind` | Sujo | Mockups Command Box piloto/engenheiro; alteração pendente e backups não rastreados |

## Cautelas

- Não iniciar auditoria funcional antes de reconciliar branch atual com `origin/main`.
- Não apagar nem ignorar worktrees até classificar o conteúdo útil.
- Preservar especialmente `.claude/worktrees/vista-engenheiro`.
- Tratar os 5 commits locais como conteúdo a classificar/reaplicar seletivamente, não como base funcional.
- Tratar os 33 commits de `origin/main` como base provável por incluírem MS-4, MS-11, F1/F4, MS-16, migrations, testes e handoffs.
- Não tratar caches do Claude, `.claude-decisoes`, DerivedData, `.tar.gz`, backups ou mockups como fonte oficial.
- Não tratar dados fictícios, fixtures ou números de protótipo como telemetria real.
- Não fazer deploy, merge, pull, push, reset ou troca de branch sem autorização explícita.

## Revalidação 2026-05-14 (segunda passada do Stint 1)

Conferência integral da baseline. Todos os números registrados acima foram remedidos nesta sessão e bateram 100%.

| Item revalidado | Esperado | Medido agora | Bate? |
|---|---|---|---|
| Branch atual | `wip/20260513-165852` | `wip/20260513-165852` | sim |
| Divergência principal vs `origin/main` | `5 ahead / 33 behind` | `5 / 33` | sim |
| Lista dos 5 registros locais exclusivos | `e441fa0`, `e15f923`, `511ad99`, `651fab0`, `62dcfb4` | idêntica | sim |
| Contagem de registros remotos ausentes | 33 | 33 | sim |
| `vista-engenheiro` vs `origin/main` | `6 / 0` | `6 / 0` | sim |
| `vista-engenheiro` — pendência | `M mockup-command-box-vista-piloto.html` + diretório de backup não rastreado | idem | sim |
| `rodada1-s1` vs `origin/main` | `13 / 7` | `13 / 7` | sim |
| `f4-triagem-video` vs `origin/main` | `6 / 11` | `6 / 11` | sim |
| `auditoria-estrutura` vs `origin/main` | `4 / 10` | `4 / 10` | sim |
| `tender-lalande-0f034a` vs `origin/main` | `8 / 34` | `8 / 34` | sim |
| `competent-volhard-b272c8` vs `origin/main` | `5 / 33` | `5 / 33` | sim |

Conclusão da revalidação: o Stint 1 permanece válido. Nenhuma alteração funcional foi feita. Próxima ação recomendada continua sendo o **Stint 2 — Inventário de ambientes isolados úteis**, começando pelo ambiente `vista-engenheiro`.

## Stint 2 — Inventário concluído (2026-05-14)

Relatório principal: `docs/auditorias/INVENTARIO_WORKTREES_P1_FAST.md`.

Resumo:

- **Ambiente mais crítico:** `.claude/worktrees/vista-engenheiro` — 1 arquivo alterado pendente + 1 pasta de backup nunca rastreada.
- **Alteração pendente:** `_design-reference/mockup-command-box-vista-piloto.html` (158 linhas removidas, 44 acrescentadas).
- **Pasta de backup pendente:** `_design-reference/_backup-original-2026-05-13/` (594 KB; backup íntegro de Vista Piloto e Vista Engenheiro).
- **Códigos novos preservados em outros ambientes:**
  - `rodada1-s1` → 13 registros locais únicos com telas iOS S1–S8 + 6 migrações de banco novas (`0020`–`0025`) + 1 arquivo de massa fictícia.
  - `f4-triagem-video` → 6 registros locais (parte já absorvida pela versão oficial — comparar).
  - `tender-lalande-0f034a` → módulos C# novos `RotationConfig.cs` + `RotationConfigTests.cs` (rotação 180° Windows).
  - `auditoria-estrutura` → único ambiente que já incorporou a versão oficial; serve de base lateral.
  - `competent-volhard-b272c8` → sombra da linha principal; baixa prioridade.
- **Colisão de numeração de migrações:** ambiente `rodada1-s1` tem `0020_carros_foto_url` e `0021_tracks_cidade`; versão oficial tem `0020_engineering_findings` e `0021_engineering_recommendations`. Precisa resolver renumeração antes de incorporar.
- **7 submissões formais abertas** vinculadas: #166, #193, #201, #202, #203, #204, #205.

Próximo Stint recomendado: **Stint 3 — Decisão de preservação do ambiente `vista-engenheiro`** (registro formal da alteração pendente + decisão sobre destino da pasta de backup). Auditoria funcional profunda continua proibida.

## Stint 3 — Preservação formal concluída (2026-05-14)

Relatório principal: `docs/auditorias/PRESERVACAO_VISTA_ENGENHEIRO.md`.

Resumo do que foi documentado:

- **Itens que não podem ser perdidos** (4):
  1. alteração pendente em `mockup-command-box-vista-piloto.html` (288 KB, 32 blocos) — 158 linhas removidas e 44 acrescentadas;
  2. backup `mockup-command-box-vista-piloto-ORIGINAL-2026-05-13.html` (293 KB, 38 blocos) — única fonte do estado anterior;
  3. backup `mockup-command-box-vista-engenheiro-ORIGINAL-2026-05-13.html` (301 KB, 30 blocos) — mesmo tamanho e mesmo número de blocos do arquivo atual; rede de segurança;
  4. os 6 registros locais da linha de trabalho `claude/command-box-mockup-recovery`.
- **Decisão registrada sobre o backup:** ir para pasta de histórico permanente (`_design-reference/_history/2026-05-13-command-box-pre-simplificacao/`), **não** entrar nas submissões #201/#205.
- **Operações proibidas** listadas explicitamente (incorporar à versão oficial, baixar, enviar, trocar linha, voltar atrás, reescrever histórico, limpar arquivos não rastreados, encerrar o ambiente isolado).
- **Submissões formais abertas afetadas:** #201 e #205, ambas devem ficar abertas e intocadas até decisão de incorporação.

Próximo Stint recomendado: **Stint 4 — Registro formal do backup e da alteração pendente do `vista-engenheiro`** (mover backup para pasta de histórico + registrar diferença pendente na submissão #205, sob autorização explícita do Flávio). Auditoria funcional profunda continua proibida.

## Stint 4 — Registro formal local concluído (2026-05-14)

Relatório principal: `docs/auditorias/REGISTRO_FORMAL_VISTA_ENGENHEIRO.md`.

Resumo do que foi feito:

- **Backup movido** de `_design-reference/_backup-original-2026-05-13/` para `_design-reference/_history/2026-05-13-command-box-pre-simplificacao/` no ambiente `vista-engenheiro`. Os 2 arquivos originais (293 KB + 301 KB) foram preservados bit-a-bit. Conteúdo: `mockup-command-box-vista-piloto-ORIGINAL-2026-05-13.html` + `mockup-command-box-vista-engenheiro-ORIGINAL-2026-05-13.html`.
- **README.md criado** dentro da pasta histórica (2.835 bytes) explicando o que são esses arquivos, por que existem, por que estão fora dos mockups ativos e as regras de uso (não editar, não substituir os ativos, podem ser usados pra comparação).
- **Alteração pendente preservada**: `mockup-command-box-vista-piloto.html` continua com a mesma diferença (44 inserções, 158 deleções). Nada foi revertido, nada foi reescrito, nada visual foi alterado.
- **Outros 5 ambientes isolados intocados** — confirmado por verificação direta após a movimentação.
- **Nenhuma submissão formal nova** foi aberta automaticamente. Material pronto para validação externa do Flávio.

Status final do ambiente `vista-engenheiro`:

- `M _design-reference/mockup-command-box-vista-piloto.html` (alteração pendente intacta)
- `?? _design-reference/_history/` (nova pasta de histórico, ainda não rastreada — registro próprio pendente de autorização)

Risco residual: backup e alteração ainda não estão rastreados pelo repositório oficial; um comando que limpa arquivos não rastreados (`git clean -fd`) ou a remoção do ambiente isolado (`git worktree remove`) ainda os apaga. Sem esses comandos, sem risco operacional.

Próximo Stint recomendado: **Stint 5 — Registro formal das duas pendências do `vista-engenheiro` no repositório oficial** (submissão própria para a pasta histórica + atualização da submissão #205 com a alteração da Vista Piloto). Cada sub-passo sob autorização explícita do Flávio. Auditoria funcional profunda continua proibida.

## Stint 5A — Registro local do backup histórico concluído (2026-05-14)

Relatório principal: `docs/auditorias/REGISTRO_BACKUP_HISTORICO_VISTA_ENGENHEIRO.md`.

Resumo do que foi feito:

- A pasta `_design-reference/_history/2026-05-13-command-box-pre-simplificacao/` foi gravada no histórico local da linha `claude/command-box-mockup-recovery` no registro **`20a19b9`** com mensagem `docs(command-box): preserve pre-simplification mockup history`.
- 3 arquivos rastreados a partir de agora: `README.md` (2.835 bytes) + `mockup-command-box-vista-piloto-ORIGINAL-2026-05-13.html` (292.994 bytes) + `mockup-command-box-vista-engenheiro-ORIGINAL-2026-05-13.html` (301.198 bytes).
- Alteração pendente do `mockup-command-box-vista-piloto.html` **permanece pendente, intacta** (44 inserções, 158 deleções).
- **Nada foi enviado para o repositório oficial.** Linha `claude/command-box-mockup-recovery` está agora `[ahead 1]` da cópia remota dela.
- **Nenhuma submissão formal nova** foi aberta (nem para a pasta histórica, nem em #205, nem em #201).
- **Outros 5 ambientes isolados** continuam com 0 pendências, intocados.

Status final do ambiente `vista-engenheiro`:

- `## claude/command-box-mockup-recovery...origin/claude/command-box-mockup-recovery [ahead 1]`
- `M _design-reference/mockup-command-box-vista-piloto.html` (alteração pendente, aguardando o Stint 5B)

Risco residual: a pasta histórica está protegida contra limpeza de arquivos não rastreados (`git clean`); a alteração pendente do mockup continua exposta a `git checkout` ou `git reset`. Eliminação do risco no Stint 5B.

Próximo Stint recomendado: **Stint 5B — Registro local da alteração pendente da Vista Piloto** (somente o arquivo `mockup-command-box-vista-piloto.html`, sem envio para repositório oficial, sem submissão formal automática). Auditoria funcional profunda continua proibida.

## Stint 5B — Registro local da alteração da Vista Piloto concluído (2026-05-14)

Relatório principal: `docs/auditorias/REGISTRO_ALTERACAO_VISTA_PILOTO.md`.

Resumo do que foi feito:

- A alteração pendente em `_design-reference/mockup-command-box-vista-piloto.html` foi gravada no histórico local da linha `claude/command-box-mockup-recovery` no registro **`1018cbd`** com mensagem `design(command-box): preserve polished pilot view mockup`.
- Diferença gravada bate exatamente com o que estava pendente: 44 inserções, 158 deleções, 1 arquivo só.
- **Ambiente `vista-engenheiro` agora com 0 pendências** (sem `M`, sem `??`).
- Linha `claude/command-box-mockup-recovery` está **`[ahead 2]`** da cópia remota (5A + 5B).
- **Backup histórico do Stint 5A intacto** — 3 arquivos confirmados em `_design-reference/_history/2026-05-13-command-box-pre-simplificacao/`.
- **Nada foi enviado para o repositório oficial.** `git rev-list --left-right --count origin/...HEAD` = `0 2`.
- **Nenhuma submissão formal nova** foi aberta.
- **Outros 5 ambientes isolados** continuam com 0 pendências, intocados.

Status final do ambiente `vista-engenheiro`:

- `## claude/command-box-mockup-recovery...origin/claude/command-box-mockup-recovery [ahead 2]`
- Sem nenhum `M`, nenhum `??`. Linha limpa.

Risco residual: os 2 registros locais (5A + 5B) ainda não foram enviados para a cópia remota da linha; estão protegidos contra `git clean`, mas vulneráveis a `git reset --hard` antes do `20a19b9` ou a `git worktree remove` no ambiente. Eliminação completa do risco no Stint 6A (envio para a cópia remota), sob nova autorização.

Próximo passo: **validação externa do Flávio** dos resultados dos Stints 5A + 5B. Só depois disso, abrir o Stint 6 (envio para a cópia remota + submissão própria para o histórico). Auditoria funcional profunda continua proibida.
