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

## Próximos incrementos
- Calibração fina opcional: debounce nos alertas de mistura (só se a condição durar X), pra não piscar
  no tip-in. Decisão/ajuste, não bug.
- Coach (FREOU CEDO etc.) e ghost dependem de comparação por trecho (precisa do GPS no pipeline) —
  Incrementos 3/4, com a volta de 2:39 como referência.

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
