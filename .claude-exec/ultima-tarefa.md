# Última tarefa — P1 Fast (21/06/2026, noite) — DESTRAVAR OS DADOS DE HOJE (voltas pelo GPS)

## 1. Pedido original do Flávio
Escolheu, em card de decisão, "Destravar dados de hoje" — resolver os canais que vieram zerados
(principalmente a detecção de volta) pra painel/coach/preditivo funcionarem com o dado JÁ colhido
hoje (sessão 2026-06-21).

## 2. Objetivo (1 frase)
Fazer a sessão real de hoje produzir VOLTAS (que vieram zeradas pela injeção) detectando o
cruzamento da linha de chegada pelo GPS, e com isso destravar painel (stint/ritmo/meta) e preditivo.

## 3. Critérios objetivos de conclusão
- Voltas detectadas pelo GPS na sessão de hoje, com tempo por volta plausível (Brasília ~85-110s).
- Painel (cérebro da nuvem) produz stint/ritmo/meta com essas voltas (deixa de ficar "aguardando").
- Preditivo recebe temperatura de água máx POR volta (mesmo que conclua "sem risco" — honesto).
- Relatório honesto do que destravou e do que NÃO dá pra destravar (canal não capturado = sensor
  não instalado; coach exige segmentação por curva). Nada inventado.

## 4. Confirmação de leitura
- ~/.claude/CLAUDE.md: sim · ~/.claude-decisoes/padroes.md: sim (0 decisões)
- FLAVIO_EXECUTION_PROTOCOL / DONE_CHECKLIST / ENVIRONMENT_RULES / COMMUNICATION_RULES: sim
- Projeto: CLAUDE.md, cerebro-painel.js, cerebro-vivo.js, cerebro-preditivo.js, chegada-detector.js,
  teste-cockpit-dados-hoje.mjs, MAPA-BRASILIA-DEFINITIVO.json

## 5. Plano (<=5 passos)
1. [FEITO] Mapear por que veio 0 volta: painel só conta volta por evento da injeção (zerado hoje);
   já existe ChegadaDetector (GPS) no cockpit. Ler a linha de chegada GPS oficial da nuvem (read-only).
2. Tool fora do ar: rodar o GPS de hoje no ChegadaDetector real → voltas + tempo por volta.
3. Alimentar essas voltas no orquestrador/cérebro REAL do painel → snapshot (stint/ritmo/meta).
4. Calcular temp de água máx por volta e rodar o preditivo real.
5. Rodar, conferir números, reportar honesto. (Fixar isso no cérebro vivo = próximo passo proposto.)

## 6. Arquivos/áreas
- web/cockpit/chegada-detector.js (detector real) · web/command-box/cerebro/* (painel/preditivo)
- .claude-exec/dados-pista/sessao-2026-06-21-1140-brasilia-COMPLETA.json (dado real)
- Linha de chegada GPS lida da nuvem (tabela marcos, tipo=chegada, layout "Principal" Brasília)

## 7. Ambiente: desenvolvimento | 8. Produção protegida: sim | 9. Autorização produção: não
## 10. Evidência: não recebida
## 11. Riscos: nenhum em DEV (só leitura do dado + tool fora do ar; produção foi SÓ LIDA pra pegar
##     a linha de chegada). Não escrevo nada na nuvem.
## 12. Status: iniciado

---

# Última tarefa — P1 Fast (21/06/2026, noite) — FASE 2: GRAVAÇÃO LOCAL BLINDADA

## 1. Pedido original do Flávio
"execute o próximo passo." (após a Fase 1 — leitura ao vivo da USB — ficar pronta e provada.)

## 2. Objetivo (1 frase)
Construir no programa do notebook (.exe) a gravação local append-only que salva cada amostra
decodificada em disco ANTES e INDEPENDENTE da nuvem, sobrevive a queda de internet/energia,
relê sem buraco, e dispara alarme se a gravação falhar (disco cheio/erro). Espelha o gravador
provado `web/cockpit/session-recorder.js` (43 testes).

## 3. Critérios de conclusão (= "pronto quando" da Fase 2 do plano)
- Cada amostra persistida append-only com carimbo de tempo da CAPTURA (tWall/tCapture).
- Rodar sessão, "derrubar a internet" no meio → TODA a telemetria do período no arquivo, íntegra,
  e relê sem buraco (sequência contínua).
- Alarme dispara em disco cheio/erro de I/O simulado (perda nunca silenciosa).
- Ferramenta de leitura/replay da gravação + recuperação de sessão órfã (queda sem fechar).

## 4. Confirmação de leitura: CLAUDE.md, padroes.md, FLAVIO_* (sim); plano da Fase 2
   (relatorios/plano-motor-gravacao-windows-2026-06-21.html), session-recorder.js, ADR-003/004.

## 5. Plano (<=5 passos)
1. Mapear o gravador provado (session-recorder.js). [FEITO]
2. SessionRecorder.cs no Domain (lógica pura + store injetável), paridade com o JS.
3. FileSessionStore real (append-only em disco, flush por registro) — provável na bancada E aqui.
4. Testes: round-trip íntegro, alarme de disco cheio, recuperação de órfã, integração leitor→gravador.
5. Rodar a bateria e reportar honesto.

## 6. Arquivos/áreas
- web/cockpit/session-recorder.js (referência), windows/cockpit/P1Fast.Cockpit.Domain/*

## 7. Ambiente: desenvolvimento | 8. Produção protegida: sim | 9. Autorização produção: não
## 10. Evidência: não recebida | 11. Riscos: nenhum em DEV (arquivo local + testes; não toca
##     nuvem/canal). ADR-003/004: append-only e fora da fila de sync — respeitados.
## 12. Status: concluído

## Resultado
- Criado `windows/cockpit/P1Fast.Cockpit.Domain/SessionRecorder.cs`:
  - `SessionRecorder` (lógica pura, port fiel do session-recorder.js): abre sessão no 1º dado,
    grava append-only motor/GPS/evento com tWall (tCapture), conta amostras, marca lacunas,
    encerra por silêncio (8 s), recupera sessão órfã, e expõe ALARME de saúde
    ('perdendo-amostras' / 'parada-armazenamento') — perda nunca silenciosa.
  - `FileSessionStore` (disco real, append-only, flush por registro; System.IO puro, sem
    dependência de Windows → provado aqui) + `InMemorySessionStore` (testes).
  - Contrato `ISessionStore` (store injetável), tipos SessionRecord/Meta/Resumo/Estado.
- Criado `...Domain.Tests/SessionRecorderTests.cs` (6 testes), incluindo ponta a ponta
  leitor da USB (Fase 1) → tradutor → gravação no disco (Fase 1+2 juntas).
- Validação: `DOTNET_ROLL_FORWARD=Major dotnet test P1Fast.Cockpit.sln`
  → bateria nova 6/6 verde; suíte completa 182 aprovados / 1 falha (a mesma PAN_04 de localidade
  do Mac, PRÉ-EXISTENTE, sem relação com este trabalho).
- "Pronto quando" do plano atendido: grava e relê SEM buraco (sequência contígua 1..100);
  alarme dispara em disco cheio simulado; recupera sessão órfã sem perder dado; o caminho não
  toca rede (queda de internet não afeta a gravação local).

## Pendências reais
- Ligar o gravador no programa do notebook de verdade (composição: onSample do leitor →
  SessionRecorder com FileSessionStore numa pasta do notebook) + escolher a pasta/rotação de
  arquivo pra sessões de horas (risco de volume citado no plano). Decisão de pasta/rotação e a
  ferramenta visual de replay ficam pra quando ligar no .exe real.
- Fase 3 (nuvem com fila que não perde dado) é o próximo passo do plano.

---
# Última tarefa ANTERIOR — P1 Fast (21/06/2026, noite) — LEITURA AO VIVO DA USB (Fase 1)

## 1. Pedido original do Flávio
"p1 fast. continue." (em resposta ao fim da tarefa anterior, que perguntou se eu seguia
montando a LEITURA AO VIVO DA USB — a conversa ACK→RI a 10x/s que entrega os blocos pro
tradutor — ou se adiantava a Fase 2. "continue" = seguir na sequência: montar a leitura ao vivo.)

## 2. Objetivo (1 frase)
Construir e provar (fora do carro) o leitor ao vivo da USB no .exe: handshake ACK→OK, loop a
~10 Hz mandando RI, juntando os pedaços num bloco e entregando ao tradutor (T3000RIBlockParser),
com as travas de segurança (bloco curto, leitura ruim, religação automática).

## 3. Critérios objetivos de conclusão
- Reader em C# que faz handshake, lê em loop, acumula multi-pacote e produz T3000Sample.
- Travas portadas do leitor provado em campo: bloco curto (30), leitura ruim (8), religação.
- Bateria de testes nova cobrindo cada trava, rodando verde.
- Bench real (porta USB de verdade no notebook + carro) declarado como pendência da Fase 1.

## 4. Confirmação de leitura
- ~/.claude/CLAUDE.md: sim
- ~/.claude-decisoes/padroes.md: sim
- ~/.claude/FLAVIO_EXECUTION_PROTOCOL.md: sim
- ~/.claude/FLAVIO_DONE_CHECKLIST.md: sim
- ~/.claude/FLAVIO_ENVIRONMENT_RULES.md: sim
- ~/.claude/FLAVIO_COMMUNICATION_RULES.md: sim
- Projeto: CLAUDE.md, docs/ARQUITETURA_DEFINITIVA.md (canônico), memórias 21/06 (USB-não-CAN, plano motor)

## 5. Plano (<=5 passos)
1. Mapear o leitor provado em campo (web/cockpit/main-t3000.js runReadLoop + handshake). [FEITO]
2. Criar T3000UsbLiveReader.cs (interface de transporte + reader + canal-fake) no Domain.
3. Portar travas: bloco curto, leitura ruim/fora de faixa, religação automática.
4. Escrever T3000UsbLiveReaderTests.cs e rodar a bateria.
5. Reportar honesto + apontar a tomada real (bancada) como pendência.

## 6. Arquivos/áreas a inspecionar
- web/cockpit/main-t3000.js (referência: handshake + runReadLoop + reconectar)
- windows/cockpit/P1Fast.Cockpit.Domain/T3000RIBlockParser.cs (o tradutor, já pronto)
- windows/cockpit/P1Fast.Cockpit.Domain/T4000SerialReader.cs (padrão de interface/fake já usado)

## 7. Ambiente alvo: desenvolvimento
## 8. Produção protegida: sim
## 9. Autorização para produção: não
## 10. Evidência da autorização para produção: não recebida
## 11. Riscos: nenhum em DEV (só código + testes fora do ar). A prova física da porta USB só no
##     notebook Windows com o carro — declarada como pendência, não simulada como pronta.
## 12. Status: concluído (cérebro da leitura ao vivo pronto e provado; tomada física = bancada)

## Resultado
- Criado `windows/cockpit/P1Fast.Cockpit.Domain/T3000UsbLiveReader.cs`:
  - `IT3000UsbChannel` (a tomada física, abstrata) + `T3000UsbLiveReader` (o cérebro) +
    `InMemoryT3000UsbChannel` (canal-fake pros testes) + config + contadores (stats).
  - Handshake ACK→OK; loop ~10 Hz mandando RI; montagem do bloco multi-pacote; entrega a
    amostra ao tradutor (T3000RIBlockParser); travas: 30 blocos curtos / 8 leituras fora de
    faixa → religação automática; religa sozinho em erro de leitura. Portado fiel do
    web/cockpit/main-t3000.js (leitor que JÁ leu o carro em campo).
- Criado `...Domain.Tests/T3000UsbLiveReaderTests.cs` (8 testes).
- Validação: `DOTNET_ROLL_FORWARD=Major dotnet test P1Fast.Cockpit.sln`
  → bateria nova 8/8 verde; suíte completa 176 aprovados / 1 falha.
  A 1 falha (LivePanelTests.PAN_04) é PRÉ-EXISTENTE e de localidade do Mac (espera "90.0"/"0.98"
  com ponto; a máquina formata com vírgula). Não tem relação com este trabalho.
- Detalhe de ambiente: a máquina só tem runtime .NET 10; projetos miram net8.0 → rodar testes
  com `DOTNET_ROLL_FORWARD=Major`.

## Pendência real (Fase 1, só no notebook + carro)
- Implementação REAL do `IT3000UsbChannel` (abrir/escrever/ler/fechar a porta USB física) e a
  prova de bancada (abrir a USB de verdade com o carro plugado). É o item nº1 dos "próximos
  passos" — só prova no notebook Windows. Não foi simulado como pronto.

---
# Última tarefa ANTERIOR — P1 Fast (21/06/2026, tarde)

## 1. Pedido original do Flávio
"os dados foram obtidos hoje no notebook. teste as funções da tela de cockpit com os dados colhidos."

## 2. Objetivo (1 frase)
Rodar as funções reais do cérebro do cockpit contra a sessão real colhida hoje (21/06) e relatar honestamente o que cada uma produziu.

## 3. Critérios objetivos de conclusão
- Cada função do cockpit (velocidade, painel/vivo, coach, preditivo) foi exercida OU foi declarado por que não pôde ser.
- Resultado de cada função reportado com número real, sem inventar.
- Qualidade dos dados de hoje caracterizada (o que veio bom, o que veio zerado/lixo).

## 4. Confirmação de leitura
- ~/.claude/CLAUDE.md: sim
- ~/.claude-decisoes/padroes.md: sim
- ~/.claude/FLAVIO_EXECUTION_PROTOCOL.md: sim
- ~/.claude/FLAVIO_DONE_CHECKLIST.md: sim
- ~/.claude/FLAVIO_ENVIRONMENT_RULES.md: sim
- ~/.claude/FLAVIO_COMMUNICATION_RULES.md: sim

## 5. Plano (<=5 passos)
1. Caracterizar a sessão de hoje (motor + GPS). [FEITO]
2. Escrever um teste fora do ar que importa os módulos REAIS do cérebro.
3. Alimentar os dados de hoje em cada função e capturar a saída.
4. Comparar velocidade calculada (GPS) vs velocidade do próprio GPS (verificação).
5. Relatar por função: funcionou / não pôde + motivo.

## 6. Arquivos/áreas a inspecionar
- .claude-exec/dados-pista/sessao-2026-06-21-1140-brasilia-COMPLETA.json (dados reais)
- web/command-box/cerebro/*.js (funções do cockpit)

## 7. Ambiente alvo: desenvolvimento
## 8. Produção protegida: sim
## 9. Autorização para produção: não
## 10. Evidência da autorização para produção: não recebida
## 11. Riscos: nenhum (só leitura dos dados + teste fora do ar; não toca canal ao vivo nem nuvem)
## 12. Status: concluído

## Resultado do teste (node .claude-exec/teste-cockpit-dados-hoje.mjs → EXIT 0)
- VELOCIDADE: OK. A 1 Hz erro mediano 0,1 km/h vs GPS (vMax 157 ≈ 159,8). A 24,5 Hz cru estoura pico falso de 317 km/h — precisa reamostrar pra ~1 Hz.
- PAINEL (stint/ritmo/meta): coerente, mas SEM saída — cronômetro de volta da injeção ficou ZERADO a sessão toda (0 voltas). Blocos ficam "aguardando" (honesto).
- PREDITIVO: temperatura de água existe (49-58°C), mas precisa de máx por volta (≥4 voltas) — não há voltas. Não rodou.
- COACH: carregou e respondeu; precisa de passagens segmentadas por curva — sessão crua não tem.
- DADO colhido: GPS 26.815 válidos / 495 lixo. Motor VIVO: rpm, lambda, bateria, água, tpsPct(acelerador). ZERO: acelerômetro, pedal de freio, pressão de freio, velocidade-injeção, cronômetro de volta.

---
---

# HISTÓRICO — tarefa anterior (preservado)

# Tarefa: Plano 3 dias — captura T4000+GPS+vídeo gravando ACESSÍVEL no notebook

## Pedido original (Flávio, via orquestrador)
Apurar a verdade (só evidência) sobre por que os testes de pista 20-21/06 se perderam e
montar PLANO DE 3 DIAS para o app do notebook Windows capturar T4000 (motor) + GPS + vídeo
do Osmo 6, gravando de forma GARANTIDA e ACESSÍVEL (Flávio precisa pegar o dado depois).

## Objetivo (1 frase)
Garantir que toda sessão de pista fique salva e recuperável pelo Flávio em até 3 dias,
priorizando o caminho mínimo do dado garantido antes de qualquer enfeite.

## Critério de conclusão
Plano realista de 3 dias com: diagnóstico provado, buraco principal, tarefas por dia com
critério de pronto, decisões que dependem do Flávio, riscos.

## Ambiente: desconhecido (trabalho = DEV; nuvem PROD consultada SÓ leitura)
## Produção protegida: sim | Autorização produção: não recebida
## Status: concluído (apuração + plano)

## Evidência coletada (somente leitura)
- Gravador local: MD5 idêntico 504b68f0... nas 2 telas; testes 43/0 e 11/0 OK.
- session-recorder.js sem nuvem (grep supabase/fetch/upload = EXIT 1, zero).
- main-t3000.js NÃO chama telemetry_samples/ingest/blob (EXIT 1). Só publishSample (volátil),
  gravarVoltaReal (só resumo), RecCockpit.motor (local 10Hz cru, novo 20/06).
- cloud-bridge.js: "sem persistência" + throttle nuvem 5 Hz.
- Central (teste-aparelhos): motor via onCarSample = broadcast nuvem 5Hz; GPS taxa cheia.
- .sln só tem Domain/Tests/LiveDemo (UI e T4000Capture fora do build).
- NUVEM PROD: sessão recente 20/06 ~3s carro nulo; nenhuma 21/06; telemetry_samples e voltas
  da 20/06 vazias; video_streams */0 (zero gravações de sempre).
- api/video/room.js (caminho Osmo) SEM enable_recording. stream-start (iPhone) tem, mas é
  o caminho descontinuado (ADR-024) e depende de plano pago Daily.
- resgate.html (21/06) lê os 2 bancos e baixa arquivo — corrige export-só-console, mas é novo.
- git: nada gravava IndexedDB antes de 20/06 (busca vazia). Causa-raiz provada.
