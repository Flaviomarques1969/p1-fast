# Última tarefa — Reformulação do mapa do autódromo (2026-05-17 noite, pré-clear)

## Pedido original do Flávio
Resolver os problemas da tela de Brasília — pontos arrastáveis E/S/A, regras de ordem, mapa modal dividido em 2, e a "micro curva" da Bruxa que não existe no autódromo real.

## Status: PARCIALMENTE CONCLUÍDO — pré-clear pra continuar depois

Flávio deu CLEAR e vai voltar dizendo **"voltei"** ou **"continuar mapa"**.

## Onde paramos exatamente

Última cobrança do Flávio nesta sessão (antes do clear):
> "Mas antes [de fazer 1/2/3 das opções de suavização], crie um HTML pra a gente poder olhar o mapa e ir tomando as decisões em função das mudanças e faça um registro do mapa anterior — vamos ter esse elemento como base pra vários componentes do sistema. Esse mapa passa a ser o objeto que usamos no celular, monitores, cockpits, enfim."

## Próximos passos PRONTOS — fazer SEM PERGUNTAR ao retomar

1. **Preservar o desenho oficial de Brasília como artefato base**
   - Copiar dados de `ios/p1fast-core/Sources/P1FastCore/SeedBrasilia.swift` (svgPath linha 33, viewBox, lapTimeSec, linhaChegada, ancoras, parciais).
   - Criar arquivo `_design-reference/_history/brasilia-track-base/brasilia-track-v1-20260517.md`.
   - Declarar no topo: "ARTEFATO BASE — desenho oficial usado em iOS, monitor de cockpit, Vista Piloto, PAce Advisor, mapa do autódromo".

2. **Criar HTML de comparação visual**
   - Caminho: `_design-reference/mapa-brasilia-comparacao-suavizacao.html`.
   - 4 versões lado a lado: Atual sem filtro · Douglas-Peucker eps=1.5 (atual) · Douglas-Peucker eps=4 · Resample + Catmull-Rom.
   - Destaque da curva da Bruxa.
   - Botões pra alternar visualização (autódromo inteiro / só curva da Bruxa / só Curva 01).
   - Abrir automaticamente com `open`.

3. **Esperar decisão do Flávio** entre as 3 opções de suavização do parecer (B-spline / Resample / Refazer o desenho).

## Detalhe completo da sessão (longa)
Ler: `~/.claude/projects/-Users-imac-Projetos-P1-Fast/memory/p1-fast-checkpoint-pre-clear-mapa-autodromo-2026-05-17-noite.md`

## Ambiente
- Branch de trabalho: `rodada1-s1` (ambiente isolado).
- Aplicativo instalado e aberto no iPhone Pro Max do Flávio (versão de 20:37).
- Filtragem Douglas-Peucker eps=1.5 + Catmull-Rom JÁ ATIVA em todos os mapas.
- Produção (Supabase) NÃO foi tocada o dia inteiro.
- Empacotamento: BUILD SUCCEEDED na última versão.
