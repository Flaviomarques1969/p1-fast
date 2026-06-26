# PROBLEMA: o cockpit NÃO está preenchendo a tela de 10,5" (tarja em volta)

Para a sessão do Claude no notebook. Veja as **duas fotos nesta pasta** (`IMG_2673.jpeg`,
`IMG_2674.jpeg`) — são a tela 10,5" rodando o cockpit AGORA, com o RaceBox ligado.

## O que está errado (visível nas fotos)
O cockpit aparece **encolhido no meio da tela**, com uma **tarja/borda cinza grossa em
volta** (em cima, embaixo e nas laterais). Não é isso que o Flávio quer.

## Causa provável (no código)
`windows/cockpit/P1Fast.Cockpit.UI/MainWindow.xaml` (e o code-behind `OnRootSizeChanged`)
escala o device canônico **956×440** pelo **MENOR** fator `min(w/956, h/440)` → o device
cabe inteiro mas sobra margem (letterbox) porque o aspect ratio 956:440 (~2,17:1) não bate
com o da tela 10,5".

## O padrão exigido (regra dura do projeto)
Tela **10,5" deitada, LARGURA TODA, sem moldura de celular, preenchendo a tela** (CLAUDE.md
e briefing do cockpit). Ou seja: o cockpit tem que **ocupar a tela inteira**, edge-to-edge,
sem as tarjas cinzas.

## Pedido
Ajustar o layout/escala pra o cockpit **PREENCHER a tela 10,5" inteira**. Caminhos possíveis
(você decide o mais fiel ao aprovado, sem redesenhar os widgets):
- preencher por largura e aceitar leve corte vertical controlado, OU
- esticar o device pro aspect ratio real da tela 10,5", OU
- recompor o canônico pra proporção da 10,5".

Confirme a resolução real da tela 10,5" antes (deitada). O Flávio não é dev — faça por ele,
mostre o antes/depois na tela, e não mexa nos widgets nem no gatilho da troca.
