# Tarefa — "Deixar tudo pronto pro dia de pista" (notebook Windows) — 23/06/2026 (tarde)

## Pedido original de Flávio
"foque em deixar tudo pronto. qual o plano?" + "para de pedir aprovação para tudo. está
aprovado. vá até o fim." → mirar o dia de pista (carro de verdade), executar sem parar a
cada passo; só parar no que é físico (carro/bancada) ou exige a frase de produção.

## TASK_INIT
- Protocolo carregado: sim (CLAUDE.md global + projeto + docs/COCKPIT_FONTE_DA_VERDADE.md)
- Padrões carregados: parcial — não reli os FLAVIO_*.md um a um
- Ambiente alvo: desenvolvimento · Produção protegida: sim · Autorização produção: não
- Pedido entendido: fechar os buracos de software do dia de pista que não dependem de carro/Windows
- Critério: gaps fechados e PROVADOS por teste, sem quebrar o existente

## Mapa real (7 leitores em paralelo no código, 23/06)
- PRONTOS: USB (tomada real), gravação à prova de queda, nuvem com fila, cérebro do painel.
- BURACO 1: captura automática (liga/desliga por movimento) só existia no NAVEGADOR, não no .exe.
- BURACO 2: peças soltas — gravar+nuvem é um programa, a tela é outro; nada costura ao vivo.

## FEITO e PROVADO (só acréscimo)
1. Captura automática portada pro gravador do notebook (SessionRecorder.cs): gatilho AutoCaptura
   (liga > 15 km/h, fecha após 12 s parado < 6 km/h). Antigo intacto. + MotivoUltimoFim, VelKmh,
   Auto, GpsHaMs no estado. Testes: SessionRecorderAutoTests.cs (5).
2. Costura — CapturaDiaDePista.cs: UM feed (motor+GPS) que GRAVA (com auto) + ACENDE o painel +
   MANDA pra nuvem, junto. Conversor motor→alerta (sensor inexistente = null, sem alerta falso).
   Teste: CapturaDiaDePistaTests.cs (1 ponta a ponta).
3. Program.cs (console captura): 1 linha de segurança (gravador pode não gravar em espera).

## Validação executada (real)
- Bateria COMPLETA do domínio: 261 aprovados / 1 falha / 262 total. A falha = PAN_04 (locale
  vírgula "90,0" vs "90.0"), PRÉ-EXISTENTE, arquivo não tocado. Confirmado pela mensagem real.
- SessionRecorder: 11/11 (6 antigos + 5 novos). CapturaDiaDePista: 1/1.
- Build do console de captura: 0 erro.

## TASK_DONE
- Pedido conferido: sim · Ambiente: desenvolvimento · Produção alterada: não
- Arquivos inspecionados: sim · Alterações: sim · Testes: sim (262 + build)
- Resultado: concluído no provável fora do carro/Windows; resto bloqueado em físico/decisão
- Pendências reais (não são minhas de fazer agora):
  1. Tela do piloto (WinUI) só compila no Windows — a costura está pronta no domínio; falta a
     tela criar a CapturaDiaDePista e o leitor alimentá-la (poucas linhas, exigem Windows).
  2. GPS pro notebook: doc canônico decide iPhone (1 Hz) primeiro; falta ligar o transporte do
     GPS do iPhone no notebook (rede iPhone↔Windows) — não dá pra provar no Mac.
  3. Físico (Flávio): plugar notebook+carro na bancada; rodar na pista; calibrar 15/6 km/h e 12 s.

## Arquivos
- ALTERADO: windows/cockpit/P1Fast.Cockpit.Domain/SessionRecorder.cs (gatilho auto, acréscimo)
- ALTERADO: windows/cockpit/P1Fast.Cockpit.T4000Capture/Program.cs (1 linha)
- NOVO: windows/cockpit/P1Fast.Cockpit.Domain/CapturaDiaDePista.cs
- NOVO: windows/cockpit/P1Fast.Cockpit.Domain.Tests/SessionRecorderAutoTests.cs
- NOVO: windows/cockpit/P1Fast.Cockpit.Domain.Tests/CapturaDiaDePistaTests.cs

## Preservado
- Comportamento antigo do gravador + 6 testes antigos + caminho do console. Nada em produção. Nada removido.
