# RESULTADO — Teste do Command Box + handshake notebook↔nuvem (27/06/2026)

Pedido do Flávio: "testar o funcionamento do command box" (com o .exe do cockpit do piloto pronto no notebook).

## Provado (DEV, produção intocada)
1. **Command box / mapa ao vivo**: a tela (`mockup-command-box-vista-piloto.html`, servida em http://localhost:8078/
   pelo `tools/atelier-server.mjs`) recebe GPS real e a bolinha anda. Provas objetivas:
   - `node tools/prova-cadeia-command-box.mjs` → VERDE (60 GPS → 56 posições distintas, arco 0.004..0.997).
   - `node tools/prova-cadeia-painel-command-box.mjs` → VERDE (8 voltas → painel: ritmo -0.06/volta, combust 33.44L/84%).
   - Torneira ao vivo na tela (canal cb-dev, replay da volta real do Bubi): bolinha avançando em tempo real.
2. **Elo notebook → nuvem → iMac AO VIVO**: o .exe do notebook (`P1Fast.Cockpit.T4000Capture --nuvem-teste`)
   transmitiu no canal `cockpit-bubi-dev-teste` (URL fvhwltzhytpnhlqbttmd) e o iMac capturou **300 amostras 'sample'**
   (rpm 3000→4450, source=sim-replay). Handshake fechado pelo canal Claude↔Claude (claude-comms).

## Causa do "não chegava" = TIMING, não endereço
- Os 3 itens batem entre iMac e notebook: mesma URL, mesma chave (ref fvhwltzhytpnhlqbttmd), mesma sala cockpit-bubi-dev-teste.
- Broadcast Supabase Realtime é **efêmero**: quem não está inscrito no instante da publicação, perde. O teste curto (15s)
  sumia. Solução usada: notebook fez **broadcast sustentado** (~5 min) e o iMac, já inscrito, recebeu.
- **Lição**: pra provar ao vivo entre máquinas, o ouvinte tem que estar inscrito ANTES e a publicação tem que durar.

## Estado técnico do .exe (verificado no código, 27/06)
- O publicador da nuvem (`LivePublisher`) manda evento **"sample" (motor: rpm/speedKmh)**. **NÃO publica GPS** ainda
  ("Fase 6" no `Program.cs`; leitura do RaceBox/GPS "em construção" no STATUS-EXE). O GPS que move o mapa vem da Central/iPhone.
- `--nuvem-teste` publica 30 amostras sintéticas em canal de teste (padrão cockpit-bubi-dev-teste); produção travada (recusa cockpit-bubi-live).

## Próximo teste (proposto pelo notebook, pelo canal)
- Volta real subida em `sessao_dumps`: **sessao_id = BRASILIA-2026-06-21-REAL** (3499 GPS + 1942 motor, 12 partes).
- Vmin por trecho do notebook (1ª volta): CURVA 2=75.3, JUNCAO=78.6, BRUXA=87.2, RETA OPOSTA=78.5, PLACAR=76.1,
  "S"=73.7, VITORIA=34.3, CURVA 01=102.9 km/h.
- Tarefa: rodar o Vmin por trecho do nosso lado e cruzar com esses números (valida que as duas pontas fazem a mesma conta).

## Limpeza feita
- Escutadores de teste parados; `tools/_tmp-listen-nuvem-teste.mjs` (efêmero) removido.
- Servidor atelier 8078 pode seguir no ar (referência da tela). Serviços nuvem de demonstração parados.
