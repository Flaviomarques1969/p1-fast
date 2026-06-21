# TASK_INIT — Plano do motor de gravação do Windows (.exe) ligando T4000 + GPS + Osmo 6

## Pedido original (Flávio) — 2026-06-21
"Construir o motor de gravação do Windows na pista: a ligação entre o .exe no Windows e as fontes
(T4000, GPS, Osmo 6). Analisar o código que já existe e o que precisamos gerar de informação pra
tela do cockpit do piloto e os dados detalhados pro app na nuvem. Análise profunda com vários
agentes sêniores pra montar o plano de trabalho."

## Objetivo (1 frase)
Produzir, só com evidência do código real, um diagnóstico do que existe/falta e um plano de
trabalho faseado pro .exe Windows capturar as 3 fontes ponto-a-ponto e alimentar (a) o cockpit do
piloto (local, baixa latência) e (b) o app na nuvem (detalhado).

## Critério objetivo de conclusão
(1) Diagnóstico por área (Windows/.NET, protocolo motor, GPS/RaceBox, vídeo Osmo6, transporte nuvem,
contrato do cockpit) com evidência arquivo:linha e maturidade real; (2) arquitetura-alvo; (3) plano
faseado com dependências, definição de pronto e riscos; (4) decisões pendentes do Flávio. Sem inferência.

## Leitura confirmada
- ~/.claude/CLAUDE.md + memórias global e P1 Fast: sim. CLAUDE.md do projeto + ARQUITETURA_DEFINITIVA: sim.

## Método: workflow multi-agente (6 especialistas em paralelo lendo código real + 1 arquiteto síntese).
## Ambiente alvo: desenvolvimento (análise/planejamento, sem alterar produção). Produção protegida: sim.
## Autorização para produção: não se aplica (sem alteração). Status inicial: análise iniciada.
