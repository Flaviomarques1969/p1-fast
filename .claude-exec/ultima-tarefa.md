# TASK — Cockpit: FONTE DA VERDADE (dados T4000/GPS → tela do piloto) — 22/06/2026 (em andamento)

## 1. Pedido original de Flávio
"estou com muita dificuldade de avançar... integrar os dados que vêm da T4000, do GPS, com a função
do cockpit, da gente realmente está vendo funcionar com os requerimentos que eu já especifiquei e você
fica perdendo esse requerimento, você perde a tela... como você pode me ajudar nisso?"
Escolha no card: "Só a fonte da verdade primeiro".

## 2. Objetivo (1 frase)
Criar UMA página de referência, curta e verificada, do cockpit do piloto — dos dados (injeção USB + GPS)
até a tela acendendo — pra parar de perder requisitos entre sessões.

## 3. Critérios objetivos de conclusão
- Documento único em docs/COCKPIT_FONTE_DA_VERDADE.md, curto.
- Cada afirmação verificada no código/docs reais (sem inventar), com fonte.
- Apontado no CLAUDE.md do projeto como leitura #0 (só APÓS Flávio confirmar o conteúdo).
- Flávio confirma que está certo.

## 4. Leitura dos arquivos obrigatórios — confirmação
- ~/.claude/CLAUDE.md: lido
- ~/.claude-decisoes/padroes.md: lido (vazio, 0 decisões)
- ~/.claude/FLAVIO_EXECUTION_PROTOCOL.md: lido
- ~/.claude/FLAVIO_DONE_CHECKLIST.md: lido
- ~/.claude/FLAVIO_ENVIRONMENT_RULES.md: lido
- ~/.claude/FLAVIO_COMMUNICATION_RULES.md: lido
- (extra) P1 Fast/CLAUDE.md + memória do projeto (MEMORY.md): lidos

## 5. Plano
1. Inspecionar estado real (arquitetura, cérebro+tela, captura) — FEITO via 3 inspeções paralelas.
2. Re-rodar os testes do cérebro no Mac pra prova fresca.
3. Escrever docs/COCKPIT_FONTE_DA_VERDADE.md (1 página, verificada).
4. Apresentar pro Flávio confirmar item a item.
5. Após confirmação: apontar no CLAUDE.md do projeto como leitura #0.

## 6. Arquivos/áreas inspecionados
- docs/ARQUITETURA_DEFINITIVA.md, FONTE_DADOS_AO_VIVO.md, PADRAO_CENTRAL_DADOS_AO_VIVO.md, STATUS.md
- windows/cockpit/P1Fast.Cockpit.Domain/ (cérebro) + .Tests/ + MainWindow.xaml.cs (tela)
- web/cockpit/ (protótipo: cockpit-state.js, cloud-bridge.js, main-t3000.js, index-t3000.html)
- src/telemetry/ (leitores) + SessionRecorder.cs (gravação)

## 7. Ambiente alvo
desenvolvimento (documento + leitura; nada em produção)

## 8. Produção protegida
sim

## 9. Autorização para produção
não

## 10. Evidência da autorização para produção
não recebida

## 11. Riscos
- Contradições entre docs (USB vs CAN; sim-publish sem guarda; Command Box mockup). Resolver na página
  pelas decisões já tomadas; marcar "a confirmar" o que for genuinamente incerto. NÃO escolher
  silenciosamente em arquitetura — sinalizar ao Flávio.
- Não criar a 151ª fonte espalhada: a página só vale se virar leitura #0 no CLAUDE.md.

## 12. Status
Em andamento. Fonte da verdade criada (docs/COCKPIT_FONTE_DA_VERDADE.md).
METODO acordado com Flavio (22/06): UM problema por vez — eu resolvo, mostro funcionando na
tela, ele responde sim/nao; eu decido o "como" tecnico e executo, sem encher de opcoes.
PROBLEMA Nº1 RESOLVIDO: web/cockpit/cockpit-vitrine.html — tela que roda SOZINHA (sem nuvem,
sem clique, offline), luz de marcha na regra real (troca 6.050 via rpmToShift), volta
roteirizada pelas 8 curvas reais de Brasilia (nomes do JSON aprovado). Provada por screenshot
(/tmp/cockpit-vitrine.png): delta -0,08, "FREOU CEDO", entrada 129 km/h, curva "Reta Oposta".
Reusa as pecas reais: cockpit-state.js + cockpit-renderer.js + live-data-bridge.js.
PROBLEMA Nº2 (volta real no navegador) — FEITO p/ GPS: web/cockpit/cockpit-volta-real.html reproduz a
volta real 24/05 e o painel reage de verdade — curva atual, velocidade (calculada pela posicao, pois o
spd do GPS veio 0), entrada/saida, e DELTA DE TEMPO entre passagens + frase do coach. Provado por
screenshot (Curva da Reta Oposta: 94 km/h, delta +0,06, "BUSCAR LIMITE").
ACHADO DE DADOS: sessao 21/06 = MOTOR real mas carro no BOX (GPS nao saiu, <=110m das curvas);
volta 24/05 = GPS andando (8 curvas) mas SEM motor. Ver motor+GPS juntos exige gravacao com os dois
andando (proxima pista). Luz de marcha provada na vitrine; fica fora desta tela ate ter motor junto.
Fixtures: web/cockpit/fixtures/volta-real-pista-24-05.json. Detalhe: [[p1-fast-dados-volta-real-motor-vs-gps]].
PROXIMO (nº3): bolinha do ápice ao vivo + (quando houver gravacao motor+GPS) luz/alertas na mesma tela.

---

# TASK — Home clicável (primeira tela) — 22/06/2026 (em andamento)

## Pedido de Flávio
"primeira tela do p1 fast tem componentes que não funcionam: eventos 7 → tela de eventos; 134 voltas → resumo estratégico (melhor volta, média de delta das 10 melhores); stints → lista; melhor → melhor volta (mapa + dados por trecho); carro Bolinha → tela do carro."

## Mapa real (verificado)
- Primeira tela = HomeView (ContentView.realHomeState, dados reais). Os 4 números canônicos (Eventos/Voltas/Celta/Melhor, ver SummaryStats preview) foram encolhidos pra 3 (Carros/Eventos/Stints) e nenhum é clicável (StatCell só visual).
- Já existem telas: Eventos (EventosListaView, rota .eventos) e Carro (CarroHubView, rota .carroHub).
- NÃO existem: resumo de voltas, lista de stints, detalhe de melhor volta (mapa + por trecho).
- Dado real: total de voltas + melhor tempo = consultáveis. MAS "delta das 10 melhores" e "dados por trecho" são esparsos/sintéticos hoje. Mapa SwiftUI da pista NÃO existe (só PathMapper puro).

## Decisão de Flávio
"Primeiro o que tem dado real" — não construir a melhor-volta com mapa/delta vazia agora.

## Feito (DEV, compila — BUILD SUCCEEDED)
- Carro Bolinha clicável → CarroHubView (CarroMock.carroId + carroCard + carroLink).
- Home com os 4 números canônicos REAIS e clicáveis: Eventos→lista; Voltas→VoltasResumoView; Stints→StintsListaView; Melhor→MelhorVoltaView. "Carros" saiu do strip (carros já têm a lista clicável abaixo).
- StatItem ganhou onTap; StatCell vira botão quando há ação (SummaryStats.swift).
- Dados reais: CarroRepository.reload agrega voltasTotal + melhorVoltaMs (tabela voltas). StintRepository.resumoVoltas (total/melhor/top10) + loadTodosStints (lista global).
- 3 telas novas em HomeView.swift (sem mexer no registro do projeto): VoltasResumoView (total + melhor + média de delta das 10 melhores, esta só com ≥10 voltas válidas), StintsListaView (lista real, toca → evento), MelhorVoltaView (tempo real + encaixe honesto do mapa/por-trecho pra acender com volta real).
- HomeData ganhou voltasTotal/melhorVoltaMs (default preserva mocks). Rotas novas: voltasResumo/stintsLista/melhorVolta.

## Pendente
- Validação no iPhone (toque real). Mapa + dados por trecho da melhor volta: encaixe pronto, enche quando houver volta real gravada na pista.

## Status
Implementado em DEV. BUILD SUCCEEDED (xcodebuild simulador). Parcial: aguarda validação no iPhone.

---

# TASK — Fase 4, Incremento 2: MENSAGENS/ALERTAS REAIS + conserto do "sensor ausente" (22/06/2026)
# (registro da sessão do COCKPIT WINDOWS; preservado acima do trabalho de iOS de outra sessão)

## Pedido
"ok. então usa a de domingo. 2:39 e testa." (após "ligar a tela aos dados reais e às funções de
mensagens, ghost e ia"). Usar a sessão REAL de domingo 21/06 (1 volta de 2:39) como prova.

## Feito (windows/cockpit) — tudo testado em DEV (DOTNET_ROLL_FORWARD=Major)
- NOVO Domain/AlertasCriticos.cs — port fiel de web/cockpit/alertas-criticos.js: catálogo de 19 alertas
  (4 gravidades), AmostraAlerta com campos NULL = sensor ausente, AvaliarT4000, orquestrador
  (IngestT4000 / GetAtivos por gravidade+estágio / GetMensagemPrincipal / Raise/ClearManual).
  CONSERTO do achado real: óleo é BIT de alarme (baixaPressaoOleo), NÃO valor de pressão; ausente
  nunca dispara. (O LiveDataBridge.CheckCriticalAlerts antigo — modelo T4000-CAN — foi PRESERVADO.)
- NOVO Domain.Tests/AlertasCriticosTests.cs (13) — inclui ALR_03 (óleo ausente NÃO dispara).
- ESTENDIDO P1Fast.Cockpit.SessaoReplay (Program.cs) — agora também roda o motor de alertas sobre a
  sessão real e leva a mensagem principal pro CockpitState.

## Validação
- Testes do motor de alertas: 13/13 verdes. Bateria completa: 226 aprovados / 1 falha (PAN_04
  pré-existente, vírgula no Mac). Zero regressão.
- REPLAY da volta real (1.942 amostras): luz subiu até nível 6, nunca "troca agora" (pico 5912<6050);
  óleo ausente NÃO virou alerta falso (conserto OK).
- ACHADO FORTE (split andando rpx>=3000 vs parado): MISTURA POBRE (46%) e BATERIA (89%) aparecem SÓ
  com o carro PARADO/marcha lenta (93% da sessão); ANDANDO = 0% das duas (bateria 13,0-13,4V sã,
  alternador carregando). Ou seja: a regra aprovada, sem um "gate de carro em uso", encheria a tela de
  alerta falso na garagem. ANDANDO o motor rodou RICO (lambda 0,55-0,97; MISTURA RICA em 59% da volta)
  — observação REAL do acerto, não ruído.

## TRAVA DE "CARRO ANDANDO" — IMPLEMENTADA (Flávio: "continue", seguindo a recomendação)
- AlertaLimites ganhou CargaRpmMin=3000 / CargaTpsPctMin=15; AmostraAlerta ganhou TpsPct. Em AvaliarT4000,
  MISTURA (pobre/rica) e BATERIA só disparam com o motor SOB CARGA (rpm>=3000 OU acelerador>=15%).
  Segurança (MOTOR QUENTE/AQUECENDO, ÓLEO) NÃO é travada — vale parado também.
- Teste novo ALR_10 (marcha lenta não dispara mistura/bateria; água quente sim; acelerador reativa).
  ALR_05/06/07 ajustados pra contexto "andando". Bateria completa: 227 aprovados / 1 falha (PAN_04). 
- REPLAY real DEPOIS da trava: BATERIA falsa 89% -> 0%; MISTURA POBRE 46% -> 14% (o que sobra é com
  ACELERADOR ABERTO, não parado — pico de tip-in; um debounce "só se durar" limparia o resto = calibração
  futura). Andando, o motor rodou RICO (lambda 0,55-0,97) — observação real do acerto.

## INCREMENTO 3 — GHOST (ápice + bolinha), FEITO E PROVADO ("sim")
- NOVO Domain/Ghost.cs — port fiel de apice-calculator.js (AcharApice: máxima curvatura por círculo de
  3 pontos) + trecho-detector.js (DistMeters/BearingDeg/ApexErrorAngleDeg) + a bolinha ao vivo de
  live-data-bridge.js (CalcularBolinha: distM + angleDeg + estado; dentro de 2m = OkMelhor). Usa
  PontoGps; escreve na bolinha do estado (DistM/AngleDeg) que o Incremento 1 criou.
- NOVO Domain.Tests/GhostTests.cs (7) — geometria de valor conhecido: arco de raio 25m recuperado;
  curva fechada vence a aberta; rumo norte/leste; ângulo frente/direita/atrás/esquerda; bolinha.
- ESTENDIDO SessaoReplay: junta GPS válido (fix3/hacc<50/Brasília), acha o ápice e roda a bolinha,
  escrevendo no CockpitState real.
- ACHADO REAL (mais um): jogar a sessão INTEIRA no cálculo de ápice acha RUÍDO (raio 2,1m = jitter de
  GPS com o carro parado). Conserto no replay: só pontos EM MOVIMENTO (>=3m de espaçamento) -> 3.499
  pontos -> ápice real de 9,5m; bolinha chega a 0m e a direção vira de 307° (antes) pra 180° (depois)
  = passou pelo ápice. PENDÊNCIA real: o cálculo de ápice precisa de gate "carro em movimento" (como
  os alertas) pra não pegar jitter — vale portar pro pipeline junto da segmentação por trecho.
- Validação: 7 testes do ghost verdes; bateria completa 234 aprovados / 1 falha (PAN_04). Zero regressão.

## INCREMENTO 4 — DELTA + COACH, FEITO E PROVADO ("sim")
- NOVO Domain/DeltaCoach.cs — port fiel de delta-calculator.js (DeltaCalculator.Calcular: perda de
  tempo por sub-trecho entrada/freio/apice/pace/saida + pior sub) + mensagens-pedagogicas.js
  (MensagensPedagogicas.Decidir: as 13 frases 01-13 — REGISTRANDO/BUSCAR LIMITE/MANTEVE/RECORDE/
  MELHOR STINT + foco no pior sub: PISOU POUCO/FREOU CEDO|TARDE/VIROU POUCO|MUITO|TARDE|CEDO/ACELEROU
  TARDE). Reusa Ghost.DistMeters.
- NOVO Domain.Tests/DeltaCoachTests.cs (15) — delta self=0; mais lento acha o pior sub; cada frase.
- ESTENDIDO SessaoReplay: encanamento completo na LINHA REAL da curva de 2:39 — referência 100 km/h +
  passagem mais lenta SIMULADA na freada (só há 1 volta) -> delta 0,251 s, pior=freio 0,233 s ->
  coach "FREOU CEDO" -> escrito em cockpit.acao. Prova a cadeia real até a frase na tela.
- Validação: 15 testes verdes; bateria completa 249 aprovados / 1 falha (PAN_04). Zero regressão.

## ESTADO DA FASE 4 (cérebro da tela nativa, ligado ao dado real e provado)
Pronto e testado na volta real de 2:39: (1) luz de marcha Bubi; (2) mensagens/alertas com conserto do
sensor ausente + trava "carro andando"; (3) bolinha do ápice (ghost); (4) delta por trecho + frases do
coach. Tudo no app nativo (C#), 249 testes.

## INCREMENTO 5 — SEGMENTAÇÃO POR CURVA ("em qual curva o carro está"), FEITO E PROVADO ("sim")
- NOVO Domain/TrechoDetector.cs — port fiel de trecho-detector.js: SideOfLine/CaminhoCruzaLinha +
  a classe TrechoDetector (entrada/freada/ápice/saída por cruzamento das barras; vigia paralelo de
  TODAS as entradas que RESSINCRONIZA na curva onde o carro está se perde uma). LinhaGps/TrechoSegmento/
  AmostraGps/TrechoFase/TrechoEvento.
- NOVO Domain.Tests/TrechoDetectorTests.cs (4) — curva sintética entrada->ápice->saída em ordem;
  engata na próxima curva; ressync engata na curva certa quando pula; sem curvas lança.
- ESTENDIDO SessaoReplay: carrega as 8 curvas reais (_design-reference/BARRAS-BRASILIA-FLAVIO-APROVADO-
  2026-05-27.json) e passa o GPS da volta de 2:39 (em movimento, velocidade real do GPS) pelo detector.
- PROVA REAL: reconheceu AS 8 CURVAS de Brasília, na ORDEM certa (CURVA 2 -> JUNÇÃO -> BRUXA -> RETA
  OPOSTA -> PLACAR -> "S" -> VITÓRIA -> CURVA 01, repetindo nas voltas). 18 entradas, 18 ápices, 17
  saídas, 17 freadas, 7 ressincronizações. Bateria completa 253 aprovados / 1 falha (PAN_04). Zero regressão.

## CÉREBRO DA TELA NATIVA — COMPLETO (Fase 4), tudo provado na volta real de 2:39
(1) luz de marcha Bubi · (2) mensagens/alertas (sensor ausente + trava "andando") · (3) bolinha do
ápice · (4) delta por trecho + frases do coach · (5) em qual curva o carro está (8/8). 253 testes.
Novos arquivos no app nativo: CockpitState/Model parity, AlertasCriticos, Ghost, DeltaCoach,
TrechoDetector + SessaoReplay (ferramenta de prova, fora da .sln).

## INCREMENTO 6 — MAESTRO + CÓDIGO DA TELA PRONTO ("sim")
- NOVO Domain/CockpitOrchestrator.cs — o "maestro": junta as 5 peças e muta o CockpitState a partir do
  dado real. IngestMotor(rpm, AmostraAlerta) -> luz Bubi + alertas; IngestGps(AmostraGps) -> curva atual
  (TrechoDetector) + bolinha (Ghost) + ao fechar a curva, delta vs a 1ª passagem -> frase do coach (acao).
  A 1ª passagem por cada curva vira REFERÊNCIA; da 2ª em diante é diferença REAL (a sessão tem 2+ voltas).
- NOVO Domain.Tests/CockpitOrchestratorTests.cs (2) — motor liga luz+alerta; 2 voltas numa curva =
  referência + diferença de tempo real + frase do coach.
- TELA (WinUI, só compila/valida no WINDOWS): App.xaml.cs ganhou a opção --demo (a demonstração vira
  opcional); MainWindow.xaml.cs — demonstração atrás de --demo + IniciarFeedReal(curvas) +
  AlimentarMotor/AlimentarGps (a captura USB/replay chama esses no notebook; despacha pra thread da UI).
  Mudança ADITIVA; sem --demo a tela espera o dado real. NÃO consegui compilar a UI no Mac (WinUI =
  Windows-only) — declarado, não fingido.
- CAPSTONE na sessão real (replay -> maestro): 8/8 curvas viraram referência; 5 frases REAIS do coach na
  2ª passagem (RECORDE | BUSCAR LIMITE | MANTEVE LINHA — a 2ª volta foi mais rápida), SEM simulação.
- Validação: bateria completa 255 aprovados / 1 falha (PAN_04). Domain build 0/0. Zero regressão.

## FALTA (precisa do NOTEBOOK WINDOWS — não dá no Mac)
- Ver a tela ACENDER: ligar a captura USB/replay aos métodos AlimentarMotor/AlimentarGps + chamar
  IniciarFeedReal(8 curvas). O código da tela está PRONTO; falta compilar a UI no Windows e rodar.
- Empacotar o .exe instalável (Fase 5): UI + Capture na .sln + resolver o empacotamento (falhou 3x).
- Elementos visuais novos no XAML (bolinha desenhada, barra de aprendizado, flash IA) — o estado já tem
  os campos (Inc.1); falta desenhar na tela (Windows).
## Calibração futura (decisão, não bug)
- Passagem mais lenta do delta é SIMULADA (só há 1 volta) → valor real com 2ª volta mais rápida.
- Gate "carro em movimento" no cálculo de ápice; debounce nos alertas de mistura (tip-in).

---

# Última tarefa — Configurador de Trecho (Garagem → Trechos) — 22/06/2026

## 1. Pedido original de Flávio
"em p1 fast quando selecionamos garagem, trechos, não consigo sair antes de concluir os trechos e o ápice deve ficar na parte mais interna da curva. não no meio da pista."
+ "ou salvar até onde foi alterado. não somente no final."
+ "e depois de salvo voltar a tela primeira daquela função."

## 2. Objetivo (1 frase)
Destravar a saída do configurador de trechos, permitir salvar o que já foi alterado em qualquer trecho (voltando à lista depois de salvar) e fazer o ápice grudar na parte interna da curva, não no eixo central.

## 3. Critérios objetivos de conclusão
- A) Dá pra sair do configurador a qualquer momento, sem percorrer todos os trechos.
- B) "Salvar e voltar" disponível em TODO trecho (hoje só no último); salva o que foi alterado.
- C) Depois de salvar, volta pra primeira tela da função (lista de trechos).
- D) O ápice fica desenhado/gravado na borda interna da curva, não no meio da pista.
- E) Compila sem erro. Ápice já configurado pelo usuário é preservado.

## 4. Leitura dos arquivos obrigatórios — confirmação
- ~/.claude/CLAUDE.md: lido
- ~/.claude-decisoes/padroes.md: lido (sem decisões registradas)
- ~/.claude/FLAVIO_EXECUTION_PROTOCOL.md: lido
- ~/.claude/FLAVIO_DONE_CHECKLIST.md: lido
- ~/.claude/FLAVIO_ENVIRONMENT_RULES.md: lido
- ~/.claude/FLAVIO_COMMUNICATION_RULES.md: lido
- (extra) P1 Fast/CLAUDE.md + memória do projeto: lidos

## 5. Plano
1. Destravar saída: fallback de fechamento (Environment dismiss) no ConfiguradorTrechoView → volta pra lista.
2. Reorganizar a barra: "Salvar e voltar" (salva + volta pra lista) em todo trecho; navegação Anterior/Próximo salva antes de mover (não perde ajuste); Cancelar sai sem salvar.
3. Ápice na borda interna: snap centrípeto no arraste, no "adicionar ápice" e na semente padrão.
4. Ajustar texto de ajuda do ápice.
5. Compilar (simulador) + reportar pra Flávio validar no iPhone.

## 6. Arquivos inspecionados
- ios/p1fast-ios/Sources/Views/ConfiguradorTrechoView.swift (editor — alvo)
- ios/p1fast-ios/Sources/Views/TrechoListaView.swift (abre o editor com onClose:nil via NavigationLink)
- ios/p1fast-ios/Sources/Views/GaragemView.swift (botão "Trechos da pista" → sheet com NavigationStack → lista)
- ios/p1fast-core/.../ErrorClassifier.swift (consome a referência de ápice — NÃO ligado em tela hoje)

## 7. Ambiente alvo
desenvolvimento (app iOS, nada em produção)

## 8. Produção protegida
sim

## 9. Autorização para produção
não

## 10. Evidência da autorização para produção
não recebida

## 11. Riscos
- O ápice é a referência que o classificador de pilotagem (ErrorClassifier: "apex interno demais"/"apex perdido por fora") usaria. Hoje NÃO está ligado em tela → mover o ponto não muda nada visível pro piloto agora; alinha a referência futura (mais correto).
- Texto de ajuda dizia "não é o ponto mais interno geométrico" — ajustado e sinalizado (contradição documentada).
- Ápices já configurados pelo usuário NÃO são movidos automaticamente (preservação). Só semente/arraste/novo usam o snap interno.
- Código morto substituído (save/saveAndAdvance → persistThen/saveAndClose/saveThen*).

## 12. Status
Implementado em DEV. Compila: `xcodebuild build -scheme p1fast-ios ... -destination 'generic/platform=iOS Simulator'` → **BUILD SUCCEEDED**.
Parcial: aguardando validação no iPhone (toque real: sair, salvar-e-voltar, ápice na borda interna).
