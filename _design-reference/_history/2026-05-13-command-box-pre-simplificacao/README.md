# Histórico — Command Box antes da simplificação da Vista Piloto

Data do backup: 2026-05-13
Origem: pasta `_backup-original-2026-05-13/` (não rastreada), criada durante o trabalho da linha `claude/command-box-mockup-recovery` no ambiente isolado `.claude/worktrees/vista-engenheiro`.

## O que está aqui

Dois arquivos de mockup do Command Box, no estado **anterior** à simplificação do painel do piloto:

- `mockup-command-box-vista-piloto-ORIGINAL-2026-05-13.html` (293 KB, 38 blocos identificados)
- `mockup-command-box-vista-engenheiro-ORIGINAL-2026-05-13.html` (301 KB, 30 blocos identificados)

## Para que servem

São **referência histórica**. Não são mockups ativos do projeto.

## Por que existem

Em 2026-05-13 a Vista Piloto do Command Box foi simplificada (passou de 38 blocos para 32 blocos, com correção de sobreposições e blocos custom convertidos em fixos). Antes da simplificação, este backup foi feito para garantir que o estado original pudesse ser consultado e comparado depois.

Resumo da diferença identificada no Stint 3 (relatório `docs/auditorias/PRESERVACAO_VISTA_ENGENHEIRO.md`):

- Vista Piloto: **antes** 38 blocos / **depois** 32 blocos (6 blocos a menos).
- Vista Engenheiro: **antes** 30 blocos / **depois** 30 blocos (sem mudança observada por contagem de blocos).

## Por que está nessa pasta `_history/`

Esses arquivos não fazem parte das submissões formais abertas #201 (Command Box vista Engenheiro + restauração da vista Piloto) nem #205 (Mockups Command Box vista piloto polidos). As submissões representam o **estado final** dos mockups; misturar arquivos `*-ORIGINAL-*.html` na submissão poluiria a revisão.

Esta pasta `_history/` é o lugar permanente do projeto para esse tipo de referência: backups com data, fora do fluxo ativo de mockups, preservados para comparação futura.

## Regras de uso

- **Não editar** estes arquivos. São congelados no estado de 2026-05-13.
- **Não substituir** os mockups ativos por eles. Os mockups ativos vivem em `_design-reference/mockup-command-box-vista-{piloto,engenheiro}.html`.
- **Pode comparar** com qualquer versão futura. Servem como linha de base "antes da simplificação".

## Origem do trabalho

Linha de trabalho: `claude/command-box-mockup-recovery`
Registros locais relacionados:

- `798be32` recovery: mockup-command-box-vista-piloto encontrado
- `15c911f` feat: vista Engenheiro do Command Box + toggle navegável
- `52204b9` fix: meta no-cache + cache-bust dinâmico no toggle Piloto↔Engenheiro
- `147dfeb` docs: regra dura "quem testa sou eu, não o Flávio"
- `8123658` fix: restaura painel completo da Vista Piloto + auto-cura nas duas vistas
- `2751b58` fix: TODOS os blocos custom como fixos + correção de sobreposições

Stint que registrou esta movimentação: Stint 4, em 2026-05-14.
