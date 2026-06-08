# AGENTS.md

## Fonte oficial candidata

A fonte oficial candidata do P1 Fast é `/Users/imac/Projetos/P1 Fast`.

Use esta pasta como base principal para auditoria, governança e desenvolvimento, salvo decisão explícita do usuário em contrário.

## Checklist obrigatório antes de qualquer tarefa

Antes de iniciar qualquer tarefa no projeto, registre:

- `pwd`;
- branch atual;
- `git status`;
- `git remote -v`;
- `git worktree list`;
- divergência com `origin/main`.

Também registre riscos de fonte errada quando houver caches, backups, worktrees, `.tar.gz`, DerivedData ou pastas temporárias relacionados ao assunto.

## Produção e deploy

Produção e deploy são protegidos.

Não fazer deploy, push, merge, alteração de produção ou operação destrutiva sem comando explícito do usuário.

Produção ainda não está autorizada para o P1 Fast sem evidência explícita e autorização do usuário.

## Auditoria antes de correção

Antes de corrigir código, audite e descreva o problema.

Não corrigir por suposição. Separar diagnóstico, decisão e execução.

## Trabalho em stints curtos

Divida correções e auditorias em stints curtos, com escopo claro, verificação objetiva e resultado registrável.

Evite misturar governança, auditoria profunda, correção, deploy e limpeza na mesma etapa.

## Regra anti-falso-pronto

Não dizer pronto sem prova.

Antes de concluir que algo funciona, provar conforme o risco da tarefa:

- build;
- testes;
- app abrindo;
- ausência de tela branca;
- fluxo principal;
- dados coerentes;
- separação entre mock e dado real.

Código editado não é sistema funcionando.

## Dados fictícios

Dados fictícios, mocks, exemplos, fixtures e números de protótipo nunca são dados reais.

Não usar cache, fixture, mockup ou exemplo como evidência de telemetria real.

## Fontes não oficiais

Não tratar como fonte oficial:

- caches do Claude;
- `/Users/imac/.claude/projects`;
- `/Users/imac/.claude-decisoes`;
- DerivedData do Xcode;
- arquivos `.tar.gz`;
- backups;
- mockups;
- pastas temporárias.

Esses locais podem conter histórico útil, mas só viram fonte principal com autorização explícita.

## Conceitos fixos do P1 Fast

- O sistema chama P1 Fast.
- Fast Coach é função de apoio/treinamento.
- Command Box tem visão piloto e visão engenharia/box.
- Não inventar Command Box Race.
- Não tratar Command Box Lab como módulo separado se o conceito correto for engenharia.
- Vmin não é ápice.
- Ápice é referência de linha/tangência.
- PAce é o ponto de retomada/aceleração pós-curva.
- Lambda e IAT são módulos próprios.
- Saúde do Carro não deve virar ajuste fino de Lambda/IAT.
- Combustível no Health Map diagnostica integridade física da alimentação.
- IA não aplica ajuste sozinha.
- Fluxo de ajuste: IA sugere -> engenheiro propõe -> chefe aprova -> confirmação final -> aplicação.
- Health Map deve funcionar com qualquer autódromo usando pista/traçado carregado e segmentado.
- Dados de protótipo não podem ser tratados como telemetria real.
