# BARRA DO STINT = reflete o PLANEJAMENTO do stint (regra Flávio 27/06)

> Registro próprio pra não atropelar o `ultima-tarefa.md` (que está com a tarefa do menu/go-live).

## Regra dada pelo Flávio (27/06)
A barra de voltas da Vista Piloto deve refletir o PLANEJAMENTO do stint:
- A QUANTIDADE de voltas = a que ele definiu no planejamento ("Voltas do stint").
- A 1ª volta é sempre AQUECE (aquecimento).
- A última volta é sempre RESFRIA (esfriamento).
- Onde ele marcar parada no box (configuracao-stint → "Paradas no box: volta + motivo"),
  aquela volta vira "BOX".
"É isso e conclui."

## O que estava errado antes
A barra usava número fixo (8/12 fictício) e não lia o plano; aquece/resfria/box não vinham do planejamento.

## O que foi feito (DEV, nada em produção)
1. `web/command-box/cerebro/cerebro-painel.js` — `calcStintBar()` agora devolve
   `{ voltas, paradas, lapHistory, current, pbEver }`: total e paradas saem do PLANO
   (`plano.voltas` + `plano.paradas:[{volta,motivo}]`, o mesmo modelo do `configuracao-stint.js`).
2. `web/command-box/cerebro/cerebro-painel.smoke.mjs` — testes: total=plano, paradas mapeadas
   (plano 8 voltas, box na 6 → paradas=[6]).
3. `_design-reference/mockup-command-box-vista-piloto.html` — `__aplicarStintBarReal` reescrito:
   desenha N slots (N=voltas do plano), slot 1=AQUECE, slot N=RESFRIA, voltas do meio numeradas
   e coloridas (verde/vermelho/★ recorde/◆ melhor do stint/atual/futura), e "BOX" na volta marcada.
   Cores/estilo aprovados intocados — mudou só a LÓGICA de colocação. Carregador de DEV passa
   um exemplo de plano com parada na volta 6 pra mostrar a regra.

## Prova
- `node web/command-box/cerebro/cerebro-painel.smoke.mjs` → TUDO VERDE (inclui total=plano e box→volta 6).
- `node tests/node-smoke-arquitetura-dado.mjs` → 32 ok / 0 fail.
- Na tela (8078): AQUECE · 2·3·4·5 (verdes) · BOX(6) · 7(vermelha) · 8★(recorde) · 9(atual) · 10·11(futuras) · RESFRIA.
  Captura /tmp/barra-plano2x.png.

## Limite honesto
O plano de teste é um exemplo em DEV (12 voltas, box na 6). Quando o planejamento real do app
(configuracao-stint, gravado no banco como `plano_stint`) estiver ligado ao Command Box, a barra
puxa as voltas e paradas REAIS de lá — a lógica já está pronta pra isso.
