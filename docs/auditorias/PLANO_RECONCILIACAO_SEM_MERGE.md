# Conclusão

A base provável para a próxima etapa deve ser `origin/main`, não a branch local atual `wip/20260513-165852`.

Deve ser preservado obrigatoriamente:

- os arquivos de governança criados na pasta principal: `AGENTS.md`, `AMBIENTES_P1_FAST.md`, `docs/auditorias/`;
- os 5 commits locais exclusivos até que sejam classificados definitivamente;
- a worktree `.claude/worktrees/vista-engenheiro`, incluindo a alteração pendente em `_design-reference/mockup-command-box-vista-piloto.html` e os backups não rastreados;
- as worktrees `rodada1-s1`, `f4-triagem-video`, `auditoria-estrutura` e `tender-lalande-0f034a` até comparação específica.

A primeira worktree a investigar deve ser `.claude/worktrees/vista-engenheiro`, porque contém Command Box piloto/engenheiro e trabalho não commitado.

Auditoria funcional profunda ainda está proibida. A branch atual está `5 ahead / 33 behind` em relação a `origin/main`, em linha paralela, e há trabalho útil fora da pasta principal.

# Commits locais exclusivos

| Commit | Arquivos | Conteúdo | Preservar? | Recomendação | Risco |
|---|---|---|---|---|---|
| `62dcfb4` | `_design-reference/mockup-cockpit-piloto-tela-10.5.html`; `_design-reference/mockup-command-box.html`; `_design-reference/selecao-command-box.html`; `docs/AUDIT_GAPS_2026-05-10.html` | Mockups cockpit/Command Box e relatório visual/auditoria gaps | Sim | Reaplicar seletivamente ou arquivar como referência visual se `origin/main` já tiver substituto melhor | Alto: pode perder referência visual de Command Box/seleção |
| `651fab0` | `docs/audit-2026-05-10/respostas-flavio.json` | Respostas de auditoria/decisão do usuário | Sim | Preservar como evidência histórica; reaplicar se ainda não existir em `origin/main` | Médio: pode perder decisão contextual |
| `511ad99` | `.claude-exec/ultima-tarefa.md`; `windows/cockpit/docs/DIAGNOSTICO_LOGO_EXE.md` | Diagnóstico operacional do logo do `.exe` e controle de execução Claude | Parcial | Preservar o diagnóstico Windows; arquivar `.claude-exec` se for só estado operacional | Médio: diagnóstico pode explicar estado do cockpit Windows |
| `e15f923` | `.claude-exec/ultima-tarefa.md`; `.claude-perguntas/pendentes/20260510-191131-p1-fast-pr166-fixes.html`; `.claude-perguntas/respostas/20260510-191131-p1-fast-pr166-fixes.json` | Perguntas/respostas sobre fixes da PR #166 rotação cockpit Windows | Sim, como histórico | Arquivar ou mover para docs de auditoria após decisão; não tratar como código funcional | Baixo/médio: perde trilha de decisão |
| `e441fa0` | `.claude-exec/ultima-tarefa.md`; `.claude-perguntas/respostas/20260511-213000-roteiros-ms4-ms11.json`; `.claude-perguntas/respostas/20260511-220000-detalhes-ms4-ms11.json`; `.claude-perguntas/respostas/20260513-125419-inventario-ambientes.html` | Respostas/decisões sobre MS-4, MS-11 e inventário de ambientes | Sim | Preservar como histórico de decisão; reaplicar em docs se não houver equivalente em `origin/main` | Alto: contém decisões de escopo/roteiro |

## Classificação geral dos 5 commits locais

| Tipo | Avaliação |
|---|---|
| Código funcional central | Não apareceu nos 5 commits locais exclusivos |
| Mockups/protótipos | Sim, principalmente Command Box e cockpit 10.5 |
| Decisões/respostas | Sim, vários arquivos `.claude-perguntas` |
| Diagnóstico operacional | Sim, logo `.exe` |
| Ação recomendada | Não descartar; comparar contra `origin/main` e reaplicar/arquivar seletivamente |

# Commits remotos ausentes

| Grupo | Commits/tema | Impacto | Risco de ignorar | Recomendação |
|---|---|---|---|---|
| T4000/cockpit | `19bb5a7`, `16d0cdb`, `0600161`, `f092a76`, `e2c106a`, `12f3213`, `d369bbd` | Logo no `.exe`, release/CI do capture, logging, aguardar T4000, limpeza de cópias, diagnóstico USB/WMI | Alto: cockpit/captura Windows pode ser auditado em versão antiga | Deve entrar na base principal via `origin/main` |
| MS-4 | `250c8eb`, `3e74f53`, `5f8439d`, `d5eb6cf`, `aca232a`, `285b3a1` | Schema de sessões, StintRepository, StintModal, paradas, lições, endurance, cancelamento, permissões | Alto: planejamento de stint fica incompleto/antigo | Deve virar base principal |
| MS-11 | `a80a295`, `601a3f4`, `3bb19e3`, `7b3dc21`, `d62eeda`, `c7cbd02`, `54d8898` | Vídeo ao vivo, Edge Functions stream, StreamCoordinator, AirPlayDetector, link público, Daily SDK, domínio C# do Command Box | Alto: vídeo/Command Box ficam fora da auditoria | Deve virar base principal |
| F1/F4 | `dcbd15f`, `36ef6f9`, `57c1446` | VoltaVideo, triagem de vídeo, pessoas e papéis | Alto: fluxo pós-stint e permissões ficam defasados | Deve virar base principal; comparar com `f4-triagem-video` |
| MS-16 | `0bdafd9`, `b84a2a9`, `639ec1e`, `57c552a`, `430d151`, `2ee12a3`, `43f7312` | Command Box Engenharia, TelemetryTimebase, VehicleContextAggregator, CalibrationEngine, advisor findings, EngControlModel, handoff | Muito alto: engenharia/Health Map/Lambda/IAT podem ser auditados sem o módulo atual | Deve virar base principal |
| Command Box Engenharia | `0bdafd9`, `2ee12a3`, `54d8898`, `43f7312` | Docs, StreamViewModel, HeartbeatPublisher, EngControlModel, EngineeringDecisionPolicy | Alto: conceitos de engenharia podem divergir dos mockups locais | Usar `origin/main` como base e comparar com `vista-engenheiro` |
| Migrations | `0014` a `0021` em commits MS-4/MS-11/F4/F1/MS-16 | Evolução de banco para sessões, video_streams, volta_video, pessoas, engineering_findings/recommendations | Muito alto: auditoria de schema seria falsa sem isso | Base principal deve incluir `origin/main` |
| Testes | `tests/node-smoke-schema-parity.mjs`, `tests/node-smoke-advisor-findings.mjs`, `tests/node-smoke-timebase-swift-parity.mjs`, smokes Swift em `P1FastSmoke` | Cobertura de paridade e módulos novos | Alto: regra anti-falso-pronto fica enfraquecida | Manter como parte da base |
| Docs/handoff | `16d0cdb`, `2ed3baf`, `e98652b`, `0bdafd9`, `43f7312` | STATUS, FRENTES_POS_MS4, COMMAND_BOX_ENGENHARIA, handoff MS-16, PLANO atualizado | Alto: decisões e sequência de trabalho ficam erradas | Deve orientar reconciliação |

# Worktrees

| Worktree | Conteúdo | Pendência | Prioridade | Recomendação |
|---|---|---|---:|---|
| `.claude/worktrees/vista-engenheiro` | Mockups Command Box vista piloto e vista engenheiro; ajustes de CLAUDE.md | Sim: `M _design-reference/mockup-command-box-vista-piloto.html` e backups não rastreados | 1 | Preservar obrigatoriamente; comparar primeiro; não descartar nem sobrescrever |
| `.claude/worktrees/rodada1-s1` | Telas iOS, stints clicáveis, mini-mapa, relatórios, massa fictícia `SeedMassaTestes`, migrations 0020-0025 | Não no status curto | 2 | Comparar depois de `vista-engenheiro`; separar massa fictícia de código real |
| `.claude/worktrees/f4-triagem-video` | Triagem de vídeo, VoltaVideo, permissões, indexador, migrations 0016/0017, `docs/F4_OPERACIONAL.md` | Não no status curto | 3 | Comparar contra `origin/main`, pois parte já parece ter entrado nos 33 commits remotos |
| `.claude/worktrees/auditoria-estrutura` | ADRs, STATUS, PLANO, detector JS/Swift, Supabase detector, schema parity | Não no status curto | 4 | Comparar para ver se é regularização complementar ou já superada por `origin/main` |
| `.claude/worktrees/tender-lalande-0f034a` | Rotação cockpit Windows, `RotationConfig`, testes, ADR-023 | Não no status curto | 5 | Comparar antes de mexer em cockpit Windows; pode ser decisão superada/parcial |
| `.claude/worktrees/competent-volhard-b272c8` | Autosave com mockups cockpit/Command Box, respostas e diagnóstico logo `.exe` | Não no status curto | 6 | Pode esperar; parece sobrepor os 5 commits locais, mas não descartar ainda |

# Estratégia recomendada

1. Tratar `origin/main` como base provável para a reconciliação, porque contém 33 commits com MS-4, MS-11, F1/F4, MS-16, migrations, testes e handoffs.
2. Não executar merge/rebase ainda. Primeiro produzir uma matriz de decisão para cada item local: `portar`, `arquivar`, `descartar`, `investigar`.
3. Preservar `vista-engenheiro` antes de qualquer operação Git, inclusive a alteração não commitada e os backups não rastreados.
4. Comparar `vista-engenheiro` contra `origin/main` e contra os mockups locais de Command Box para definir a referência visual correta.
5. Comparar `f4-triagem-video` com `origin/main`, porque F4 aparece parcialmente nos commits remotos.
6. Comparar `rodada1-s1` depois, separando código real de `SeedMassaTestes` e outros dados fictícios.
7. Comparar `auditoria-estrutura` e `tender-lalande-0f034a` por último, pois podem conter ajustes de docs/detector/cockpit já superados ou parcialmente incorporados.
8. Reaplicar seletivamente os 5 commits locais somente se o conteúdo ainda for útil e não existir em `origin/main`.
9. Transformar decisões/respostas `.claude-perguntas` em docs históricos se forem úteis; não tratá-las como código ou fonte funcional.
10. Só depois de uma base reconciliada iniciar auditoria funcional profunda.

## Respostas diretas

| Pergunta | Resposta |
|---|---|
| Devemos usar `origin/main` como nova base? | Sim, como base provável, após preservar conteúdo local/worktrees. |
| Devemos reaplicar seletivamente os 5 commits locais? | Sim, seletivamente. Eles parecem conter mockups, decisões e diagnósticos, não código central. |
| Quais worktrees precisam ser comparadas antes? | Primeiro `vista-engenheiro`; depois `f4-triagem-video`, `rodada1-s1`, `auditoria-estrutura`, `tender-lalande-0f034a`; `competent-volhard` pode esperar. |
| O que deve ser preservado obrigatoriamente? | Governança, `vista-engenheiro` com pendência, os 5 commits locais até triagem, e worktrees com trabalho funcional. |
| O que pode virar arquivo histórico? | `.claude-perguntas`, `.claude-exec`, diagnósticos de PR/execução e mockups superados após comparação. |
| Qual o risco se auditar agora sem reconciliar? | Auditoria falsa sobre base antiga/paralela, ignorando MS-4/MS-11/F4/MS-16 e Command Box mais recente. |

# Próximo stint recomendado

**Stint 2 — Inventário de worktrees úteis**, começando por `.claude/worktrees/vista-engenheiro`.

Objetivo: confirmar qual conteúdo de worktree deve ser preservado ou promovido antes de qualquer operação Git.
