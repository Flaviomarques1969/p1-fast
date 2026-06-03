# INVENTÁRIO DE AMBIENTES ISOLADOS DE TRABALHO — P1 Fast

Data: 2026-05-14
Stint: 2 — Inventário de ambientes isolados úteis
Modo: somente leitura. Nenhum arquivo funcional foi alterado.

> Nota de linguagem: "ambiente isolado de trabalho" = cópia paralela do projeto numa pasta separada (no jargão técnico, *worktree*). O nome real da pasta usa `worktrees/` no caminho — isso é só o nome da pasta no disco, não uma operação.

# Conclusão

- **Ambiente mais crítico:** `.claude/worktrees/vista-engenheiro`. É o único com trabalho ainda não registrado no repositório oficial (1 arquivo alterado + uma pasta de backup nunca rastreada). Se for sobrescrito ou descartado agora, perdem-se 6 ajustes do Command Box piloto/engenheiro e o backup original do dia 2026-05-13.
- **Itens que não podem ser perdidos obrigatoriamente:**
  - alteração pendente em `_design-reference/mockup-command-box-vista-piloto.html` (158 linhas removidas e 44 acrescentadas);
  - pasta `_design-reference/_backup-original-2026-05-13/` com os dois arquivos `mockup-command-box-vista-{piloto,engenheiro}-ORIGINAL-2026-05-13.html` (293 KB + 301 KB);
  - os 13 registros locais exclusivos do ambiente `rodada1-s1` (telas iOS S1–S8 + 6 migrações de banco novas + massa fictícia de teste);
  - os 6 registros locais exclusivos do ambiente `f4-triagem-video` (triagem de vídeo Daily.co — apesar de F4.2 já ter sido absorvido pela versão oficial em outro caminho);
  - os 2 módulos exclusivos do ambiente `tender-lalande-0f034a` (rotação 180° do cockpit Windows: `RotationConfig.cs` + `RotationConfigTests.cs`).
- **Ambientes que precisam comparação posterior:** `rodada1-s1`, `f4-triagem-video`, `auditoria-estrutura`, `tender-lalande-0f034a`. Cada um já tem submissão formal aberta pendente de aprovação.
- **Auditoria funcional profunda:** continua proibida. Antes dela, é preciso decidir o que entra e o que vira histórico.
- **Próximo Stint recomendado:** **Stint 3 — Decisão de preservação do ambiente `vista-engenheiro`**: registrar formalmente a alteração pendente e a pasta de backup (transformar em submissão #205 ou equivalente), sem ainda incorporar à versão oficial.

# Baseline registrada

| Item | Resultado |
|---|---|
| `pwd` | `/Users/imac/Projetos/P1 Fast` |
| `git status --short --branch` (principal) | `## wip/20260513-165852`; modificado `.claude-exec/ultima-tarefa.md`; não rastreado `AGENTS.md`, `AMBIENTES_P1_FAST.md`, `docs/auditorias/` |
| `git worktree list` | 7 ambientes (1 principal + 6 ambientes Claude isolados + esta sessão `naughty-babbage-15967b` que é o ambiente desta investigação) |

# Ambiente crítico — `vista-engenheiro`

Caminho: `.claude/worktrees/vista-engenheiro`
Linha de trabalho separada: `claude/command-box-mockup-recovery`
Divergência com versão oficial (`origin/main`): **6 à frente / 0 atrás**.

| Item | Resultado | Risco | Recomendação |
|---|---|---|---|
| `git status --short --branch` | `## claude/command-box-mockup-recovery...origin/claude/command-box-mockup-recovery` | — | manter intocado até decisão |
| Arquivo modificado e ainda não registrado | `_design-reference/mockup-command-box-vista-piloto.html` (diferença: 158 linhas removidas, 44 acrescentadas) | **Alto.** Se for descartado, perde-se a simplificação da Vista Piloto feita após o backup | preservar; criar submissão formal antes de qualquer operação que troque linha de trabalho |
| Diretório não rastreado | `_design-reference/_backup-original-2026-05-13/` com 2 arquivos: `mockup-command-box-vista-engenheiro-ORIGINAL-2026-05-13.html` (301 KB) e `mockup-command-box-vista-piloto-ORIGINAL-2026-05-13.html` (293 KB) | **Alto.** Backup original do dia 2026-05-13. Se descartado, perde-se a referência de "antes da limpeza" | preservar obrigatoriamente; manter como referência histórica |
| Últimos registros locais | `2751b58` Vista Piloto: TODOS os blocos custom como fixos + correção de sobreposições; `8123658` restaura painel completo da Vista Piloto + auto-cura nas duas vistas; `147dfeb` regra dura "quem testa sou eu, não o Flávio"; `52204b9` meta no-cache + cache-bust dinâmico no toggle Piloto↔Engenheiro; `15c911f` vista Engenheiro + toggle navegável; `798be32` recovery: mockup-command-box-vista-piloto encontrado | — | usar como histórico do trabalho feito |
| Conteúdo dos mockups (atual) | Vista Piloto 288 KB, Vista Engenheiro 301 KB. Cabeçalho confirma título "Command Box · Vista Piloto / Vista Engenheiro (P1 Fast)" com auto-reset, anti-cache, toggle navegável | — | tratar como referência visual oficial até nova decisão |
| Quantidade de blocos identificados (`id="`) | Backup original Vista Piloto: 38 blocos. Vista Piloto atual: 32 blocos. Diferença = 6 blocos a menos no atual | Médio. A simplificação foi intencional (restauração do painel), mas o backup ainda é a referência completa | preservar os dois |
| Submissão formal vinculada | #205 (Mockups Command Box vista piloto polidos) e #201 (vista Engenheiro + restauração da vista Piloto), conforme TASK_DONE de 2026-05-13 | — | manter as duas submissões abertas até aprovação |

**O que deve ser preservado obrigatoriamente neste ambiente:**

1. A alteração pendente em `_design-reference/mockup-command-box-vista-piloto.html`.
2. A pasta `_design-reference/_backup-original-2026-05-13/` inteira.
3. Os 6 registros locais exclusivos da linha de trabalho `claude/command-box-mockup-recovery`.
4. A linha de trabalho em si — não excluir, não trocar, não reescrever histórico.

# Inventário dos demais ambientes

## 1) `.claude/worktrees/rodada1-s1` — Prioridade 2

| Campo | Resultado |
|---|---|
| Linha de trabalho | `claude/rodada1-s1` |
| Divergência vs versão oficial | 13 à frente / 7 atrás |
| Status | limpo (tudo registrado) |
| 13 registros locais exclusivos | telas iOS S1–S8: home com saudação, garagem, autódromos por cidade, evento passado, evento futuro, detalhe da volta, mini-mapa, card de carro adaptativo, replicação de configuração; massa fictícia `SeedMassaTestes`; 4 telas próprias pros cards Stints/Voltas/Autódromos/Recordes |
| 12 arquivos exclusivos | `_design-reference/proposta-carro-card-S2.html`; `ios/p1fast-ios/Sources/Persistence/EventoExtraRepositories.swift`; `ios/p1fast-ios/Sources/Persistence/SeedMassaTestes.swift`; `ios/p1fast-ios/Sources/Views/FotoCarroSection.swift`; `ios/p1fast-ios/Sources/Views/RelatoriosViews.swift`; `ios/p1fast-ios/Sources/Views/VoltaDetalheView.swift`; 6 migrações de banco novas (`0020_carros_foto_url`, `0021_tracks_cidade`, `0022_pendencias_consumiveis`, `0023_pneus_serie_evento`, `0024_acoes_a_fazer`, `0025_evento_setup_replicado`) |
| 26 arquivos modificados | telas existentes do iOS + docs (STATUS, PLANO, handoff) + módulo Swift de núcleo + projeto Xcode |
| Tipo de conteúdo | código real iOS + 6 migrações de banco + 1 arquivo de massa fictícia + 1 mockup HTML |
| Submissão formal vinculada | #193 — Rodada 1, 24 mudanças S1–S8 telas iPhone |
| Recomendação | preservar; separar `SeedMassaTestes.swift` (não é código de produção — só dados fictícios) das 6 migrações novas (que são código real e mexem em banco); comparar contra versão oficial antes de qualquer operação que reescreva histórico |

## 2) `.claude/worktrees/f4-triagem-video` — Prioridade 3

| Campo | Resultado |
|---|---|
| Linha de trabalho | `claude/f4-triagem-video` |
| Divergência vs versão oficial | 6 à frente / 11 atrás |
| Status | limpo |
| 6 registros locais exclusivos | F4.1 checklist Daily.co; F4.2 tabela `volta_video` + Model + Repository + 8 testes automáticos; F4.3 indexador de voltas dentro da gravação; F4.4 tela de triagem; F4.5 bloqueio do próximo stint até triar pendentes; F4.6 permissão piloto + chefe + admin |
| 0 arquivos exclusivos | todos os arquivos tocados também existem em versão oficial — só foram modificados |
| 39 arquivos modificados | documentação F4_OPERACIONAL, sprints, telas iOS, núcleo Swift, migrações, testes |
| Atenção importante | **parte deste trabalho JÁ FOI absorvida pela versão oficial** — `dcbd15f feat(F4.2): tabela volta_video` e `36ef6f9 feat(F4-glue)` estão entre os 33 registros remotos ausentes da linha principal `wip/...`. Pode haver duplicação |
| Submissão formal vinculada | #202 — F4 triagem vídeo 5 fases |
| Tipo de conteúdo | código real iOS + Edge Function de servidor + migrações de banco + docs |
| Recomendação | preservar; comparar contra versão oficial antes de qualquer operação — boa parte talvez já esteja na versão oficial por outra submissão; identificar o que sobra de exclusivo |

## 3) `.claude/worktrees/auditoria-estrutura` — Prioridade 4

| Campo | Resultado |
|---|---|
| Linha de trabalho | `claude/auditoria-estrutura` |
| Divergência vs versão oficial | 4 à frente / 10 atrás |
| Status | limpo |
| 4 registros locais exclusivos | ajuste do teste automático de paridade de banco (PG=26 com `volta_video`); incorporação da versão oficial dentro desta linha (já houve `merge` de `origin/main` para dentro deste ambiente — único caso assim entre os 6); ADR-025 promovida de proposta a decisão fechada; regularização estrutural pós-auditoria 2026-05-12 |
| 0 arquivos exclusivos | nenhum arquivo é puramente desta linha |
| 29 arquivos modificados | docs (STATUS, PLANO, COMMAND_BOX_ENGENHARIA, handoff), núcleo Swift, núcleo iOS, migrações 0018–0021, testes Node |
| Submissão formal vinculada | #203 — Auditoria estrutural + ADR-025 |
| Tipo de conteúdo | documentação de governança + regularização estrutural + um ajuste de teste |
| Recomendação | preservar; é o único ambiente que já incorporou a versão oficial recente — pode servir de base lateral para comparação; comparar antes de qualquer reconciliação |

## 4) `.claude/worktrees/tender-lalande-0f034a` — Prioridade 5

| Campo | Resultado |
|---|---|
| Linha de trabalho | `claude/develop-cockpit-app-rotation` |
| Divergência vs versão oficial | 8 à frente / 34 atrás (a mais atrasada de todas) |
| Status | limpo |
| 8 registros locais exclusivos | rotação 180° do cockpit Windows (PR-L): toggle Ctrl+R por display, mover acelerador para XAML, qualificação de namespace, fallback display, revert intermediário, ADR-023 amendment 5 superado pelo 6 |
| 2 arquivos exclusivos | `windows/cockpit/P1Fast.Cockpit.Domain/RotationConfig.cs` + `windows/cockpit/P1Fast.Cockpit.Domain.Tests/RotationConfigTests.cs` (módulos novos) |
| Submissão formal vinculada | #166 — Cockpit Windows rotação 180° (segundo memória interna do projeto, está bloqueada) |
| Tipo de conteúdo | código real C#/Windows do cockpit + ADR + testes automáticos |
| Atenção importante | 34 registros remotos ausentes — é a linha que mais ficou para trás. Reconciliação aqui é mais cara |
| Recomendação | preservar; comparar muito antes de qualquer operação; decidir caso a caso se o trabalho de rotação ainda vale dado que o amendment 5 foi superado pelo 6 |

## 5) `.claude/worktrees/competent-volhard-b272c8` — Prioridade 6

| Campo | Resultado |
|---|---|
| Linha de trabalho | `claude/competent-volhard-b272c8` |
| Divergência vs versão oficial | 5 à frente / 33 atrás (mesma da linha principal `wip/...`) |
| Status | limpo |
| 5 registros locais | são exatamente os mesmos 5 registros locais exclusivos da linha principal `wip/20260513-165852` + 1 auto-save mais novo (`bffed44 auto-save: 16:32:44`) |
| 89 arquivos diferentes | soma de tudo o que falta da versão oficial e do auto-save local |
| Conteúdo principal | autosaves operacionais (`.claude-exec`, `.claude-perguntas`), mockups (cockpit-piloto-tela-10.5, command-box, selecao-command-box, eventos, pessoas, tipo-evento), relatório HTML AUDIT_GAPS_2026-05-10, respostas-flavio do dia 2026-05-10 |
| Submissão formal vinculada | nenhuma diretamente — é uma sombra de trabalho do dia 10–13 |
| Tipo de conteúdo | espelho/sombra da linha principal + 1 auto-save adicional |
| Recomendação | preservar até confirmar que não tem nada exclusivo perdido; baixa prioridade; provavelmente pode virar histórico depois que os outros 5 ambientes forem decididos |

# Classificação final

| Ambiente | Classificação | Justificativa |
|---|---|---|
| `vista-engenheiro` | **Preservar obrigatoriamente** | Trabalho ainda não registrado no repositório + backup original único do dia 2026-05-13 |
| `rodada1-s1` | **Preservar obrigatoriamente / Comparar antes de reconciliar** | 13 registros únicos com código iOS real, 6 migrações de banco e massa fictícia (separar) |
| `f4-triagem-video` | **Comparar antes de reconciliar** | Parte já absorvida pela versão oficial — pode ter duplicação a resolver |
| `auditoria-estrutura` | **Comparar antes de reconciliar** | Único que já incorporou a versão oficial — pode ser base lateral útil |
| `tender-lalande-0f034a` | **Comparar antes de reconciliar / Não seguro descartar** | 8 registros únicos sobre rotação Windows; 34 atrás da versão oficial; amendment 5 superado pelo 6 |
| `competent-volhard-b272c8` | **Baixa prioridade / Arquivar como histórico após confirmação** | Sombra da linha principal + autosaves; provavelmente nada exclusivo perdido |

# Itens que não podem ser perdidos

| Item | Local | Motivo | Ação recomendada |
|---|---|---|---|
| Alteração pendente Vista Piloto | `.claude/worktrees/vista-engenheiro/_design-reference/mockup-command-box-vista-piloto.html` | 158 linhas removidas e 44 acrescentadas; simplificação do painel do piloto ainda não registrada formalmente | registrar formalmente antes de qualquer operação destrutiva |
| Pasta de backup original | `.claude/worktrees/vista-engenheiro/_design-reference/_backup-original-2026-05-13/` (2 arquivos, 594 KB) | Backup íntegro do estado original antes da limpeza; única fonte da Vista Engenheiro de 301 KB e da Vista Piloto de 293 KB | preservar; jamais excluir; mover para pasta de histórico se for sair do ambiente isolado |
| 6 migrações novas de banco | `.claude/worktrees/rodada1-s1/supabase/migrations/0020_*.sql` a `0025_*.sql` | Estrutura nova de banco (foto do carro, cidade dos autódromos, pendências consumíveis, número de série dos pneus, ações a fazer, replicação de setup) | preservar; analisar se conflita com `0018_pessoas` / `0019_pessoa_papeis` / `0020_engineering_findings` / `0021_engineering_recommendations` da versão oficial (há colisão de numeração — `0020` e `0021` aparecem em dois lados) |
| Telas iOS novas | `.claude/worktrees/rodada1-s1/ios/p1fast-ios/Sources/Views/{RelatoriosViews,VoltaDetalheView,FotoCarroSection}.swift` | Telas novas exclusivas da Rodada 1 | preservar |
| Módulos Windows novos | `.claude/worktrees/tender-lalande-0f034a/windows/cockpit/P1Fast.Cockpit.Domain/RotationConfig.cs` + `RotationConfigTests.cs` | Implementação da rotação 180° controlada pelo app | preservar; comparar contra a decisão atual da ADR-023 (amendment 6 superou o 5) |
| 5 registros locais da linha principal | linha `wip/20260513-165852` | Conforme classificação do Stint 1: mockups Command Box, respostas de auditoria, diagnóstico do logo no empacotamento Windows, decisões MS-4/MS-11/inventário de ambientes | já documentado em `PLANO_RECONCILIACAO_SEM_MERGE.md`; manter |
| Submissões formais abertas | #166, #193, #201, #202, #203, #204, #205 | 7 submissões aguardando aprovação | manter abertas até comparação contra versão oficial |

# O que pode virar histórico

| Item | Local | Motivo |
|---|---|---|
| Auto-saves operacionais | `.claude-exec/ultima-tarefa.md` em todos os ambientes; pasta `.claude/launch.json` | Estado operacional, não código funcional — pode virar arquivo de histórico após classificação |
| Respostas em HTML/JSON de cards de pergunta | `.claude-perguntas/pendentes/`, `.claude-perguntas/respostas/` (espelhados em `competent-volhard-b272c8`) | Decisões já tomadas; valem como prova histórica, não como fonte ativa |
| Relatório AUDIT_GAPS_2026-05-10.html | `competent-volhard-b272c8/docs/AUDIT_GAPS_2026-05-10.html` | Auditoria de gaps já consumida; pode virar pasta de histórico em `docs/_archive/` |
| Mockup `selecao-command-box.html` | `competent-volhard-b272c8/_design-reference/selecao-command-box.html` | Mockup intermediário de seleção; provavelmente superado pelos mockups Vista Piloto + Vista Engenheiro |
| Ambiente `competent-volhard-b272c8` inteiro (depois de confirmação) | `.claude/worktrees/competent-volhard-b272c8` | Sombra da linha principal sem nada novo de produto; pode ser removido após inventário cruzado completo, **somente sob comando explícito** |

# Próximo stint recomendado

**Stint 3 — Decisão de preservação do ambiente `vista-engenheiro`**

Objetivo: registrar formalmente a alteração pendente (`mockup-command-box-vista-piloto.html`) e a pasta de backup `_backup-original-2026-05-13/` antes de qualquer operação que toque linhas de trabalho, ainda sem incorporar à versão oficial.

Escopo proposto:

- gerar plano de registro formal das duas pendências do ambiente `vista-engenheiro`;
- decidir se o backup vira parte da submissão #201/#205 ou se mora em pasta separada de histórico;
- não incorporar nada à versão oficial;
- não tocar nos outros 5 ambientes neste Stint.

Critério de saída:

- documento de plano em `docs/auditorias/`;
- nenhum arquivo funcional alterado;
- autorização explícita pedida antes de qualquer comando que altere histórico do repositório.
