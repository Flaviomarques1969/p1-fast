# GPS — trechos da metodologia na TV e na página da volta (27/10/2026)

## RETOMADA 1027-1230b
Passe: ~/.claude/retomadas/20261027-1230b-p1fast.md. Itens 1–9 do GPS prontos (último commit 4d76abf8e).

## Pedido (resposta do painel p1fast-gps-setores-1228, ALTERAR)
"nós usamos uma metodologia totalmente própria [...] ponto de entrada, ponto de frenagem, velocidade mínima,
ápice, ponto de saída [...] você está considerando todos eles? na nossa metodologia a gente controla os trechos
por todo lugar da pista que normalmente você freia, se é uma curva longa [...] flat com o pé embaixo, não é um
trecho, aí é uma reta"

## Achado (conferido no código)
- Carro (TrechoDetector.cs, itens 3/4): entrada, freada (G), Vmin, ápice (G), saída — nos 8 trechos de
  _design-reference/BARRAS-BRASILIA-FLAVIO-APROVADO-2026-05-27.json. PAce = estratégia TPS×GPS (sensor do acelerador).
- TV (cerebro-gps-tv.js) = 3 setores de 1/3; página da volta = "onde ganhou/perdeu" em 20 fatias iguais. Fora da metodologia.
- Eventos de trecho do carro NÃO vão ao canal.

## O que faço (DEV, worktree gps-base-g)
1. Fonte: BARRAS aprovado (o mesmo do carro) → módulo gerado + smoke que compara com a fonte.
2. SF (pé embaixo, CURVA DA VITÓRIA) = reta, pela regra dele (tipos-curva-brasilia.js).
3. TV: tempo por trecho (curvas + retas), km/h de entrada, mínima (com lugar) e saída; melhor por trecho.
   3 setores macro (ADR-006) ficam.
4. Página da volta: "onde ganhou e onde perdeu" por trecho em vez de 20 fatias.
5. Catraca + mutação + prova de tela.
