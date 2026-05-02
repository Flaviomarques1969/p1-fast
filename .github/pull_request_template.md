<!--
Template padrão pra PRs do P1 Fast. Ajusta as seções conforme o tipo
(feat/chore/fix/docs). Apaga o que não se aplica.
-->

## O que muda

<!-- 1-3 frases. Foco no QUE, não em todos os detalhes. -->

## Por que

<!-- Link pra issue, prompt da fila, ADR, ou contexto. -->

## Smoke

```
npm run smoke              → ___ ok / 0 fail
swift run p1fast-smoke     → ___ ok / 0 fail   (se tocar ios/p1fast-core)
xcodebuild ... build       → BUILD SUCCEEDED   (se tocar ios/p1fast-ios)
```

## Diff

<!-- N arquivos. Resumir o shape: novas tabelas, novos tokens, etc. -->

## Aceitação

<!-- Bullets do prompt da fila (se aplicável). -->

- [ ] ...
- [ ] ...

## Princípios checados (CLOUD_CODE_QUEUE.md preâmbulo)

- [ ] Mockup canônico 1:1 (se tocar UI)
- [ ] Tratamento "você" (sem tu/te/teu)
- [ ] Sem ícones decorativos
- [ ] Sem `mkdir` antes de Write
- [ ] Smoke verde antes de abrir o PR
- [ ] Nenhum dado fabricado — estado vazio explícito quando faltar

## Notas / decisões abertas

<!-- O que ficou pendente, o que pode quebrar amanhã, o que merece review humano cuidadoso. -->
