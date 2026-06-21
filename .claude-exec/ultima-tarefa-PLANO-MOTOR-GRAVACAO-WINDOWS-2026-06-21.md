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

## DECISÃO 1 RATIFICADA POR FLÁVIO (21/06): ler a injeção pela USB, não por CAN.
- Fato físico do Flávio: a ligação injeção<->notebook é SEMPRE USB-C com USB-C; NÃO existe cabo/rede CAN.
  Logo o caminho T4000-CAN (em que todo o C# foi construído, só testado em simulador) NÃO é opção.
- O aparelho no carro é Injepro T4000. "T3000" no código é só o NOME do protocolo USB (mesma família
  Injepro). Prova: o dado real recuperado hoje veio `tipo:t4000` / `source:t3000-usb` / parserVersion 2.0.0;
  main-t3000.js:1-7 ("lendo a Injepro T3000 via USB, roda em p1t4000", comando RI 10Hz) e :882 ("Religação
  automática da T4000") usam os dois nomes pro mesmo aparelho.
- Consequência no plano: Fase 1 = portar o leitor USB provado (web/cockpit/t3000-usb-parser.js +
  main-t3000.js) pra dentro do .exe; o decodificador CAN do C# (T4000PacketParser) sai do caminho crítico
  (vira contingência). Robustez do C# (reader loop, auto-recovery, UsbScanner, diagnóstico, CockpitState)
  segue reaproveitável. Bloqueio "depende do carro" da ratificação: removido (a captura real ainda ajuda a
  confirmar offsets exatos, mas o protocolo está decidido).

## Método: workflow multi-agente (6 especialistas em paralelo lendo código real + 1 arquiteto síntese).
## Ambiente alvo: desenvolvimento (análise/planejamento, sem alterar produção). Produção protegida: sim.
## Autorização para produção: não se aplica (sem alteração). Status inicial: análise iniciada.
