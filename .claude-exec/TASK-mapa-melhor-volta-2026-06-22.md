# TASK — Mapa da pista na tela Melhor volta — 22/06/2026

## Pedido de Flávio
"por que que quando eu clico em melhor volta, não aparece o mapa do autódromo." → decisão: "Construir o mapa agora".

## Objetivo (1 frase)
Desenhar o traçado real de Brasília (aprovado) na tela MelhorVoltaView, no lugar do texto reservado.

## Critérios de conclusão
- A tela Melhor volta mostra o desenho do traçado de Brasília (não texto vazio).
- Geometria vem do dado canônico aprovado, não inventada.
- App compila e instala no iPhone físico do Flávio.
- Tempos por trecho sobre o mapa: acendem com volta real; sem volta, mostra só o traçado (honesto).

## Leitura obrigatória: CLAUDE.md, padroes.md, EXECUTION/DONE/ENVIRONMENT/COMMUNICATION = sim
## Ambiente: desenvolvimento | Produção protegida: sim | Autorização prod: não (não recebida)
## Riscos: novo componente de desenho; cuidar de não inventar pontos de trecho sem dado real.
## Status: iniciado

## TASK_DONE (22/06/2026)
- Reuso do traçado JÁ medido/aprovado (PistaBrasilia.desenho, 495 pts, Flávio 17/05) — não criei geometria nova.
- Novo desenho reutilizável: PistaBrasiliaMapa (em PistaBrasilia.swift), mesma matemática de escala/centralização da tela Assistir.
- MelhorVoltaView (HomeView.swift): trocado o texto reservado pelo desenho do traçado. Tempos por trecho seguem honestos (acendem com volta real).
- Prova: BUILD SUCCEEDED (simulador e iPhone físico) + screenshot .claude-exec/melhor-volta-mapa-2026-06-22.png mostrando o mapa.
- Instalado no iPhone físico do Flávio (iPhone 16 Pro Max).
- Andaime de teste (mockFilled, --p1-melhor/--p1-home-nu, stintRepo no HubMockLauncher) revertido — grep sem TEMP-PROVA.
- INCIDENTE foto resolvido: foto local do carro (Documents/carros-fotos/641A81E7...jpg) NÃO foi perdida; confirmada intacta após 2 instalações; backup salvo em _design-reference/_backups/carro-foto-bolinha-641A81E7/.
- Ambiente: desenvolvimento. Produção: não alterada. Resultado: concluído.
