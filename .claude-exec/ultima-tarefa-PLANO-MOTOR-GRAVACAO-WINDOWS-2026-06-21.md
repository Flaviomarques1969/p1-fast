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
## EXECUÇÃO — Fase 1, passo 1 (21/06): tradutor USB portado pro C# + paridade provada
- Escopo travado por Flávio: mínimo viável = Fases 1-3 (motor USB + gravação local blindada + nuvem com fila).
- Ambiente: .NET 8 (alvo dos projetos) NÃO roda neste Mac (só .NET 10) -> testes do CI não rodam aqui;
  build (compilação) roda. Paridade validada aqui via harness net10 + node (JS).
- ADITIVO (nada existente alterado): 
  - windows/cockpit/P1Fast.Cockpit.Domain/T3000RIBlockParser.cs (port fiel de web/cockpit/t3000-usb-parser.js v2.0.0).
  - windows/cockpit/P1Fast.Cockpit.Domain.Tests/T3000RIBlockParserTests.cs (4 fatos; paridade + sanidade + bloco curto + ACK).
- PROVA: mesmo bloco RI de 410 bytes -> JS e C# deram NÚMEROS IDÊNTICOS em 21 campos (rpm, lambda, freio,
  accel, alarmes, sanidade). Domain e Domain.Tests compilam 0 erros/0 warnings com o código novo.
- PRÓXIMO (Fase 1 resto): ISerialBytePort real sobre System.IO.Ports.SerialPort + handshake ACK->RI + loop
  ~10Hz alimentando este parser (precisa do notebook Windows + carro pra prova final). Depois Fase 2 (gravação
  local) e Fase 3 (nuvem com fila), construíveis aqui.

## Ambiente alvo: desenvolvimento (análise/planejamento, sem alterar produção). Produção protegida: sim.
## Autorização para produção: não se aplica (sem alteração). Status inicial: análise iniciada.
