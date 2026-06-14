# Conclusão

A branch atual `wip/20260513-165852` não deve ser usada ainda como base final para auditoria funcional profunda.

Ela pode ser auditada apenas de forma estrutural e diagnóstica, mas antes de auditar produto, fluxo, iOS, cockpit, Command Box ou engenharia, é necessário reconciliar a base com `origin/main`. O checkout atual está em uma linha paralela: `5 ahead / 33 behind` contra `origin/main`, e nem `HEAD` é ancestral de `origin/main`, nem `origin/main` é ancestral de `HEAD`.

Algumas worktrees precisam ser preservadas para investigação, principalmente:

- `.claude/worktrees/vista-engenheiro`: contém Command Box vista piloto/engenheiro e ainda tem alteração pendente não commitada.
- `.claude/worktrees/rodada1-s1`: contém trabalho amplo de telas iOS, massa fictícia, stints, voltas e migrations.
- `.claude/worktrees/f4-triagem-video`: contém fluxo de triagem de vídeo, migrations e integração iOS/Supabase.
- `.claude/worktrees/auditoria-estrutura`: contém ajustes de auditoria/ADR/detector e está parcialmente à frente de `origin/main`.

Nenhuma worktree deve ser apagada ou ignorada por enquanto. `competent-volhard-b272c8` parece mais próximo de um autosave da linha local atual e pode ser menos prioritária, mas ainda não é seguro descartá-la sem comparar seu conteúdo específico. `tender-lalande-0f034a` contém rotação do cockpit Windows e ADRs relacionados; também deve ser preservada.

O maior risco é auditar ou corrigir a pasta principal atual como se ela fosse a base mais recente, quando `origin/main` local contém 33 commits posteriores relevantes e uma worktree contém Command Box com alterações não commitadas.

# Baseline Git

| Item | Estado |
|---|---|
| Diretório | `/Users/imac/Projetos/P1 Fast` |
| É repositório Git | Sim |
| Branch atual | `wip/20260513-165852` |
| Status atual | `?? AGENTS.md`, `?? AMBIENTES_P1_FAST.md`, `?? docs/auditorias/` |
| Status antes da governança | Worktree principal limpo |
| Remote | `origin https://github.com/Flaviomarques1969/p1-fast.git` |
| Divergência com `origin/main` | `5 ahead / 33 behind` |
| Merge-base | `3121feff96cc6be06f48a86b5b456795bd9e089c` |
| Último commit local | `e441fa0 20260513-165740` |
| Último commit `origin/main` local | `43f7312 docs: handoff MS-16 (STATUS + PLANO + session handoff pós-/clear) (#200)` |
| Worktrees | 6 worktrees Claude além do principal |

# Branch atual vs origin/main

| Item | Resultado | Risco | Recomendação |
|---|---|---|---|
| Commits locais à frente | `e441fa0`, `e15f923`, `511ad99`, `651fab0`, `62dcfb4` | São autosaves/commits locais que não estão em `origin/main` | Preservar e revisar antes de qualquer reset/rebase/merge |
| Commits remotos ausentes | 33 commits, incluindo PRs #167 a #200 | Base atual não contém MS-4, MS-11, F1, F4, MS-16 e handoffs recentes | Reconciliar antes de auditoria funcional |
| Relação de ancestralidade | Paralela: `HEAD` não é ancestral de `origin/main`; `origin/main` não é ancestral de `HEAD` | Não é simples "só atualizar" sem decidir o destino dos 5 commits locais | Planejar reconciliação |
| Sobreposição direta de arquivos alterados | Nenhuma sobreposição direta entre `git diff origin/main...HEAD` e `git diff HEAD...origin/main` | Baixo risco de conflito textual imediato | Ainda assim comparar semanticamente |
| Branch local `main` | Aponta para o mesmo commit de `wip/20260513-165852` (`e441fa0`) | Nome `main` local está atrás/paralelo ao `origin/main` | Não assumir que `main` local é atual |
| Conteúdo local exclusivo | Mockups Command Box base, auditoria gaps, respostas Claude, diagnóstico logo `.exe` | Pode conter material útil não promovido | Inventariar antes de reconciliar |
| Conteúdo remoto exclusivo | MS-4, MS-11, F4/F1, MS-16, Command Box Engenharia, migrations e testes | Produto mais recente parece estar em `origin/main` | Usar `origin/main` como referência de atualização |

## Commits locais à frente de origin/main

| Commit | Mensagem |
|---|---|
| `e441fa0` | `20260513-165740` |
| `e15f923` | `20260511-200121` |
| `511ad99` | `20260510-185834` |
| `651fab0` | `auto-save: 12:56:28` |
| `62dcfb4` | `auto-save: 00:23:26` |

## Principais commits de origin/main ausentes nesta branch

| Commit | Mensagem |
|---|---|
| `43f7312` | `docs: handoff MS-16 (STATUS + PLANO + session handoff pós-/clear) (#200)` |
| `2ee12a3` | `feat(MS-16.5a): EngControlModel + EngineeringDecisionPolicy (#199)` |
| `430d151` | `feat(MS-16.4): /api/advisor.js aceita findings[] da Camada 2 (#198)` |
| `57c552a` | `feat(MS-16.3): CalibrationEngine + 3 rules MVP + migrations Supabase (#197)` |
| `639ec1e` | `feat(MS-16.2): VehicleContextAggregator Swift (#196)` |
| `b84a2a9` | `feat(MS-16.1): TelemetryTimebase Swift port (#195)` |
| `0bdafd9` | `docs(MS-16): auditoria + arquitetura aprovada do Command Box Engenharia (#194)` |
| `57c1446` | `feat(F1-A): tabelas pessoas + pessoa_papeis (Fase A — preparação sem risco) (#192)` |
| `36ef6f9` | `feat(F4-glue): plugar TriagemVideoView no fluxo natural pós-stint (#191)` |
| `dcbd15f` | `feat(F4.2): tabela volta_video + Model + Repository + 8 smokes (#190)` |
| `e98652b` | `docs+chore(auditoria): regularização estrutural pós-auditoria 2026-05-12 (#189)` |
| `54d8898` | `feat(MS-11.4+11.5): camada de domínio C# pro Command Box (#188)` |
| `a80a295` a `285b3a1` | MS-11 e MS-4 completos/parciais |
| `19bb5a7` a `d369bbd` | Cockpit/T4000 capture e diagnóstico USB |

# Worktrees

| Worktree | Branch | Status | Evidência | Risco | Recomendação |
|---|---|---|---|---|---|
| `/Users/imac/Projetos/P1 Fast` | `wip/20260513-165852` | Tem novos arquivos de governança não rastreados | `5 ahead / 33 behind`; contém `AGENTS.md`, `AMBIENTES_P1_FAST.md`, `docs/auditorias/` | Base paralela e atrasada frente a `origin/main` | Não auditar funcionalmente antes de reconciliar |
| `.claude/worktrees/auditoria-estrutura` | `claude/auditoria-estrutura` | Limpo; tracking com `origin/claude/auditoria-estrutura` | `4 ahead / 10 behind` vs `origin/main`; altera ADRs, STATUS, PLANO, detector, schema parity | Pode conter ajustes de auditoria/detector ainda úteis | Preservar e investigar |
| `.claude/worktrees/competent-volhard-b272c8` | `claude/competent-volhard-b272c8` | Limpo; sem tracking remoto no status | `5 ahead / 33 behind`; adiciona itens similares à branch atual | Parece autosave/local paralelo | Preservar por enquanto; baixa prioridade |
| `.claude/worktrees/f4-triagem-video` | `claude/f4-triagem-video` | Limpo; tracking com `origin/claude/f4-triagem-video` | `6 ahead / 11 behind`; contém TriagemVideo, VoltaVideo, migrations 0016/0017, docs F4 | Trabalho funcional importante de vídeo/triagem pode não estar todo consolidado | Preservar e comparar antes de auditoria MS-11/F4 |
| `.claude/worktrees/rodada1-s1` | `claude/rodada1-s1` | Limpo; tracking com `origin/claude/rodada1-s1` | `13 ahead / 7 behind`; telas iOS, stints, voltas, massa fictícia, migrations 0020-0025 | Grande volume de UI/dados pode divergir da base atual | Preservar e investigar antes de auditar app iOS |
| `.claude/worktrees/tender-lalande-0f034a` | `claude/develop-cockpit-app-rotation` | Limpo; tracking com origin | `8 ahead / 34 behind`; rotação cockpit Windows, `RotationConfig`, ADR-023 | Pode conter decisão/implementação superada ou parcial | Preservar; investigar antes de mexer em cockpit Windows |
| `.claude/worktrees/vista-engenheiro` | `claude/command-box-mockup-recovery` | Tem alteração pendente e arquivos não rastreados | `6 ahead / 0 behind`; adiciona `mockup-command-box-vista-piloto.html`, `mockup-command-box-vista-engenheiro.html`; pendente em `mockup-command-box-vista-piloto.html`; backups originais não rastreados | Maior risco de perder mockup importante e trabalho não commitado | Preservar obrigatoriamente; investigar antes de auditoria Command Box |

# Achados importantes fora da pasta principal

| Local | Conteúdo | Deve considerar? | Motivo |
|---|---|---:|---|
| `.claude/worktrees/vista-engenheiro` | Mockups Command Box piloto/engenheiro e edição pendente | Sim | Pode conter fonte visual mais recente do Command Box |
| `.claude/worktrees/rodada1-s1` | Telas iOS, stints, voltas, relatórios, massa fictícia, migrations | Sim | Afeta app iOS e dados de protótipo |
| `.claude/worktrees/f4-triagem-video` | Triagem de vídeo, VoltaVideo, permissions e migrations | Sim | Afeta vídeo, Daily.co, pós-stint e fluxo de triagem |
| `.claude/worktrees/auditoria-estrutura` | Ajustes de auditoria, ADR-025, detector e schema parity | Sim | Pode conter regularização estrutural necessária |
| `.claude/worktrees/tender-lalande-0f034a` | Rotação do cockpit Windows e ADRs | Sim | Pode afetar cockpit Windows/tela externa |
| `origin/main` local | MS-4, MS-11, F1, F4, MS-16, Command Box Engenharia, migrations e testes | Sim | Parece mais atualizado que a branch atual |
| `.claude/worktrees/competent-volhard-b272c8` | Autosave com mockups e documentos de auditoria | Talvez | Menor prioridade, mas não seguro descartar ainda |
| Arquivos de governança no principal | `AGENTS.md`, `AMBIENTES_P1_FAST.md`, `docs/auditorias/` | Sim | Devem ser preservados na reconciliação |

# Riscos de fonte errada

| Sinal | Resultado | Risco |
|---|---|---|
| Código importante só em worktree | Sim, F4, rodada iOS, cockpit rotation e Command Box aparecem em worktrees | Alto |
| Mockup importante só em worktree | Sim, `vista-engenheiro` contém mockups Command Box piloto/engenheiro | Alto |
| Docs importantes só em worktree | Sim, ADR/STATUS/PLANO/F4/handoffs aparecem em worktrees e `origin/main` | Médio/alto |
| Branch local antiga/paralela | Sim, `5 ahead / 33 behind` e sem ancestralidade direta | Alto |
| Branch local experimental | Parcialmente; contém autosaves e governança recente | Médio |
| `origin/main` mais atualizado | Sim, 33 commits ausentes | Alto |
| Dados fictícios tratados como reais | Risco presente em `rodada1-s1` por `SeedMassaTestes` e mockups/fixtures | Médio |
| Command Box/cockpit/engenharia divergentes | Sim, distribuídos entre `origin/main`, `vista-engenheiro`, `tender-lalande` e pasta principal | Alto |
| Saúde do Carro, Lambda/IAT, PAce divergentes | Não foi feita auditoria funcional; há MS-16/engineering em `origin/main` que a branch atual não contém | Médio |

# Recomendação final

2. reconciliar branch antes.

# Próximo passo

Próximo stint: **Stint 1 — Plano de reconciliação sem merge**.

Escopo exato:

1. Listar os 5 commits locais exclusivos e classificar se devem ser portados, descartados ou arquivados.
2. Listar os 33 commits de `origin/main` por tema: MS-4, MS-11, F1/F4, MS-16, T4000/cockpit.
3. Preservar explicitamente a worktree `vista-engenheiro` como fonte candidata de mockups Command Box antes de qualquer operação Git.
4. Definir a estratégia de base: `origin/main` como base provável, com reaplicação seletiva dos 5 commits locais e dos worktrees úteis.
5. Não executar merge, pull, push, reset ou troca de branch nesse stint.
