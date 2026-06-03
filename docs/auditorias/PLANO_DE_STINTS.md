# PLANO_DE_STINTS

## Regra desta fase

Este plano é apenas diagnóstico e governança. Não autoriza correção, merge, pull, push, troca de branch, deploy ou alteração de produção.

## Stint 1 — Plano de reconciliação sem merge

Objetivo: decidir a base segura antes de auditoria funcional.

Status: concluído em `docs/auditorias/PLANO_RECONCILIACAO_SEM_MERGE.md`.

Escopo:

- classificar os 5 commits locais exclusivos da branch `wip/20260513-165852`;
- agrupar os 33 commits de `origin/main` por tema;
- identificar o que precisa ser preservado dos worktrees;
- preservar explicitamente `vista-engenheiro` como fonte candidata de mockups Command Box;
- decidir estratégia provável de base, sem executar merge.

Critério de saída:

- tabela com `portar`, `arquivar`, `descartar` ou `investigar` para cada frente;
- lista de riscos de perda;
- autorização explícita solicitada antes de qualquer operação Git.

## Stint 2 — Inventário de ambientes isolados úteis

Objetivo: mapear conteúdo útil fora da pasta principal.

Status: **concluído em 2026-05-14**. Relatório principal em `docs/auditorias/INVENTARIO_WORKTREES_P1_FAST.md`.

Escopo coberto (todos inventariados):

- `vista-engenheiro`: Command Box piloto/engenheiro + pendência não registrada + backup original;
- `rodada1-s1`: telas iOS S1–S8, 6 migrações novas de banco, massa fictícia;
- `f4-triagem-video`: triagem de vídeo Daily.co (parte já absorvida pela versão oficial);
- `auditoria-estrutura`: ADR-025, regularização estrutural, único que incorporou a versão oficial;
- `tender-lalande-0f034a`: rotação 180° do cockpit Windows;
- `competent-volhard-b272c8`: sombra da linha principal + autosaves operacionais.

Critério de saída atendido:

- inventário registrado;
- preservações obrigatórias listadas;
- itens candidatos a virar histórico listados;
- código real separado de massa fictícia, autosaves e relatórios;
- nenhum arquivo funcional alterado.

## Stint 3 — Preservação formal do ambiente `vista-engenheiro`

Objetivo: registrar formalmente o que deve ser preservado no ambiente `vista-engenheiro` antes de qualquer operação Git futura.

Status: **concluído em 2026-05-14**. Relatório principal em `docs/auditorias/PRESERVACAO_VISTA_ENGENHEIRO.md`.

Escopo coberto:

- baseline registrada (linha de trabalho, status, registros locais, diferença pendente, conteúdo do backup, tamanhos);
- itens críticos listados e classificados por risco;
- decisão registrada sobre destino da pasta de backup: pasta de histórico permanente (`_design-reference/_history/2026-05-13-command-box-pre-simplificacao/`), **não** dentro das submissões #201/#205;
- operações proibidas listadas explicitamente;
- recomendação mais segura formalizada.

Critério de saída atendido:

- documento de plano em `docs/auditorias/PRESERVACAO_VISTA_ENGENHEIRO.md`;
- nenhum arquivo funcional alterado;
- nenhuma operação Git executada;
- autorização explícita do Flávio ainda exigida antes de qualquer comando que altere histórico.

## Stint 4 — Registro formal do backup e da alteração pendente do `vista-engenheiro`

Objetivo: tirar o ambiente `vista-engenheiro` do estado "trabalho não registrado", sem incorporar nada à versão oficial.

Status: **concluído em 2026-05-14** (parte de movimentação + criação de README). Relatório principal em `docs/auditorias/REGISTRO_FORMAL_VISTA_ENGENHEIRO.md`.

Escopo coberto:

- backup movido de `_design-reference/_backup-original-2026-05-13/` para `_design-reference/_history/2026-05-13-command-box-pre-simplificacao/`, preservando bit-a-bit os 2 arquivos (293 KB + 301 KB);
- README.md curto criado dentro da pasta histórica explicando origem, função e regras de uso;
- alteração pendente em `mockup-command-box-vista-piloto.html` **preservada intacta** (44 inserções, 158 deleções) — não revertida, não reescrita, sem mudança visual;
- nenhuma operação que incorpora, baixa, envia, troca linha de trabalho, retorna a estado anterior ou reescreve histórico foi executada;
- nenhuma submissão formal nova foi aberta automaticamente (conforme regra explícita).

Critério de saída atendido:

- backup vivo em pasta histórica permanente;
- alteração da Vista Piloto preservada;
- material pronto para validação externa do Flávio;
- nada incorporado à versão oficial;
- outros 5 ambientes isolados intocados.

Pendência residual: a pasta `_history/` e a alteração pendente do mockup **ainda não estão rastreadas** pelo repositório oficial — esta formalização é o objetivo do Stint 5.

## Stint 5A — Registro local do backup histórico do `vista-engenheiro`

Objetivo: registrar no histórico local da linha `claude/command-box-mockup-recovery` apenas a pasta `_design-reference/_history/2026-05-13-command-box-pre-simplificacao/`, sem enviar para o repositório oficial.

Status: **concluído em 2026-05-14**. Relatório principal em `docs/auditorias/REGISTRO_BACKUP_HISTORICO_VISTA_ENGENHEIRO.md`.

Escopo coberto:

- 3 arquivos (`README.md` + 2 mockups originais) gravados no histórico local sob o registro `20a19b9` com mensagem `docs(command-box): preserve pre-simplification mockup history`;
- alteração pendente em `mockup-command-box-vista-piloto.html` **permaneceu pendente** (intacta — 44 inserções, 158 deleções);
- nenhum envio para o repositório oficial; linha agora está `[ahead 1]` da cópia remota;
- nenhuma submissão formal nova foi aberta;
- nenhum dos outros 5 ambientes isolados foi tocado.

Critério de saída atendido:

- backup histórico passou de "não rastreado" para "registrado no histórico local";
- alteração da Vista Piloto continua disponível para o Stint 5B;
- nada incorporado à versão oficial;
- auditoria funcional profunda continua proibida.

## Stint 5B — Registro local da alteração pendente da Vista Piloto

Objetivo: gravar no histórico local da linha `claude/command-box-mockup-recovery` a diferença de 44 inserções / 158 deleções no `mockup-command-box-vista-piloto.html`.

Status: **concluído em 2026-05-14**. Relatório principal em `docs/auditorias/REGISTRO_ALTERACAO_VISTA_PILOTO.md`.

Escopo coberto:

- registro `1018cbd` com mensagem `design(command-box): preserve polished pilot view mockup`;
- diferença confirmada: 1 arquivo, 44 inserções, 158 deleções;
- ambiente `vista-engenheiro` agora com **0 pendências** (sem `M`, sem `??`);
- linha `claude/command-box-mockup-recovery` está `[ahead 2]` da cópia remota (5A + 5B);
- nada enviado, nenhuma submissão formal nova, outros 5 ambientes intocados, backup histórico do Stint 5A intacto.

Critério de saída atendido:

- ambiente sem pendências;
- material pronto para validação externa do Flávio;
- nada incorporado à versão oficial;
- auditoria funcional profunda continua proibida.

## Validação externa (não é stint — etapa do Flávio)

Antes de qualquer envio à cópia remota da linha ou criação de submissão formal nova, o Flávio precisa **validar visualmente** o resultado dos Stints 5A + 5B no ambiente `vista-engenheiro`:

- conferir que o `_design-reference/mockup-command-box-vista-piloto.html` renderiza como esperado;
- conferir que o `_design-reference/mockup-command-box-vista-engenheiro.html` continua íntegro;
- conferir que a pasta de histórico `_design-reference/_history/2026-05-13-command-box-pre-simplificacao/` existe e abriga os 2 originais + README.

## Stint 6 — Envio dos registros locais para a cópia remota e abertura de submissão própria

Objetivo: tirar o trabalho da gaveta local e levar para o repositório oficial em modo seguro (sem incorporar à versão oficial).

Status: aguardando autorização explícita do Flávio (não fazer ainda).

Escopo proposto (cada sub-passo precisa de autorização própria):

- **6A.** enviar os 2 registros locais (`20a19b9` + `1018cbd`) para a cópia remota da linha `claude/command-box-mockup-recovery` (apenas envio; sem incorporar à versão oficial). Esse envio é o que faz a submissão #205 enxergar o `1018cbd` e atualizar.
- **6B.** abrir submissão formal própria para o backup histórico, separada de #201 e #205 — só depois de 6A concluído.

Critério de saída:

- 2 registros locais visíveis na cópia remota da linha;
- submissão #205 atualizada;
- submissão própria para o histórico aberta;
- nada incorporado à versão oficial;
- nenhum outro ambiente isolado tocado;
- auditoria funcional profunda continua proibida.

## Stint 3 — Auditoria estrutural da base escolhida

Objetivo: auditar estrutura, docs, módulos e testes da base escolhida, ainda sem correção.

Escopo:

- README, docs, STATUS, ADRs;
- iOS;
- Windows/cockpit;
- telemetry;
- Command Box;
- engenharia/Health Map/Lambda/IAT/PAce;
- testes e mocks.

Critério de saída:

- relatório de lacunas;
- lista priorizada de problemas;
- nenhuma correção aplicada.

## Stint 4 — Plano de correções curtas

Objetivo: converter achados em stints curtos de correção, cada um com verificação clara.

Escopo:

- agrupar por risco e módulo;
- definir prova de pronto para cada correção;
- separar código, docs, testes e deploy.

Critério de saída:

- backlog de stints autorizáveis;
- nenhuma correção iniciada sem autorização.
