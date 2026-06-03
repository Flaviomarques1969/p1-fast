# AMBIENTES_P1_FAST.md

## Fonte oficial candidata

A fonte oficial candidata do P1 Fast é:

`/Users/imac/Projetos/P1 Fast`

Esta pasta deve ser usada como base principal para auditoria, governança e desenvolvimento, salvo decisão explícita em contrário.

## Cautela obrigatória

Antes de qualquer trabalho de código ou correção, é obrigatório:

- confirmar branch atual;
- confirmar git status;
- verificar divergência com origin/main;
- verificar worktrees pendentes;
- registrar riscos de fonte errada.

Estado registrado em 2026-05-14:

- Diretório: `/Users/imac/Projetos/P1 Fast`
- Branch: `wip/20260513-165852`
- Git status: worktree principal limpo
- Remote: `origin https://github.com/Flaviomarques1969/p1-fast.git`
- Divergência com `origin/main`: `5 ahead / 33 behind`
- Worktrees: existem 6 worktrees Claude; `vista-engenheiro` tem alteração pendente e arquivo não rastreado

## Produção

Produção ainda não está autorizada para o P1 Fast, salvo evidência explícita e autorização do usuário.

Nenhum deploy é autorizado sem comando explícito.

## Desenvolvimento

Todo trabalho deve ocorrer primeiro em desenvolvimento.

Código editado não é sistema funcionando.

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

Esses locais podem conter histórico útil, mas não são fonte principal sem autorização explícita.

## Dados reais vs fictícios

Dados fictícios, mocks, exemplos e números de protótipo nunca podem ser tratados como dados reais.

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

## Regra anti-falso-pronto

Antes de dizer pronto, provar:

- build;
- testes;
- app abrindo;
- ausência de tela branca;
- fluxo principal;
- dados coerentes;
- separação entre mock e dado real.

## Ordem correta

1. Confirmar fonte oficial candidata.
2. Registrar branch/status/worktrees.
3. Criar governança.
4. Fazer auditoria geral profunda.
5. Dividir problemas em stints curtos.
6. Corrigir apenas com autorização.
7. Verificar.
8. Auditar novamente.
