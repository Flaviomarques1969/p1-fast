# Última tarefa — COCKPIT (volta real) — redesenho do PAINEL — 22/06/2026

## Pedido (sessão inteira, iterativa)
Lapidar a tela `web/cockpit/cockpit-volta-real.html`: ápice, limpeza visual, cluster de sensores, luz de freio e resultado da freada — um item por vez, mostrando na 8078, com sim/não.

## Ambiente
desenvolvimento (web, servidor local 8078). Produção protegida: sim. Autorização produção: não. Nada em produção. Tudo override LOCAL nesta tela; `cockpit.css` e painel-piloto v1 das outras telas NÃO alterados (preservação).

## O que foi feito e APROVADO por Flávio (todas verificadas no navegador)
1. Ápice: veredito trava no ponto mais rente (distMin); ≤10 m verde e fica até a saída; fora = neutro (nunca vermelho a 1 Hz).
2. Sem brilho de fundo (halo) no painel.
3. Número sem sinal +/− (só valor; verde bom, vermelho ruim).
4. Número (Delta) fixo à esquerda; frase de pilotagem centralizada SOB o número.
5. Cluster de 14 sensores no topo, bandeja de vidro, lentes premium, 3 grupos titulados à esquerda (MOTOR 7 · MOVIMENTO 2 · CHASSI 5); vermelho=sem comunicação, verde=comunicando, amarelo=falha. Barra das voltas desceu.
6. Ícones redesenhados como símbolos de painel reconhecíveis.
7. LUZ DE FREIO vertical nas laterais (5 verde+1 amarela+3 vermelha/lado), enche por TEMPO (4 s antes do ponto, pela velocidade), pisca a tela pelas bordas no ponto; conjunto subido e por cima do encaixe.
8. RESULTADO DA FREADA à direita espelhando o Delta: ±1 m = verde "NO PONTO" (mostra 0/1); >1 m antes = amarelo "ANTES"; depois = vermelho "DEPOIS".

## Validação
Sintaxe do script conferida a cada alteração (`node --check`). Tela reaberta no navegador a cada passo (8078). Flávio aprovou item a item; último "sim" na margem ±1 m.

## PROXY / pendências reais (NÃO é dado real ainda)
- Gatilhos de freio são proxy de GPS: ponto = 50 m antes do ápice; onde freou = pico de velocidade. Valor REAL vem do sensor de freio (motor+GPS juntos na pista).
- Replay roda 8× → os 4 s reais aparecem comprimidos; sentir o tempo exige velocidade real.
- Luz de marcha (horizontal) não anima nesta volta (depende da rotação do motor, incoerente com o GPS desta gravação).
- Decisões registradas na memória do projeto: `p1-fast-cockpit-volta-real-painel-2026-06-22.md`.

## Status
Concluído o que foi pedido nesta sessão e aprovado. Aberto pra continuar (mais ícones, luz de marcha real, ou ligar no motor) quando Flávio decidir.

---

# Última tarefa — App iOS: tela "Cockpit do Piloto" na Home — 22/06/2026

## 1. Pedido original
"Em P1 fast, crie uma tela no app que seja idêntica no iphone ao cockpit que o piloto vai estar vendo na hora. Pode colocar este botão na tela principal."

## 2. Objetivo (1 frase)
Adicionar no app iOS uma tela que mostra o MESMO cockpit do piloto (visual + lógica reais), aberta por um botão na tela principal (Home).

## 3. Critérios de conclusão
- Botão na Home abre uma tela nova com o cockpit do piloto.
- A tela mostra o cockpit IDÊNTICO ao do piloto (mesma CSS/lógica canônica), rodando (luz de marcha, ápice, frase do coach), em paisagem ao virar o celular.
- Reusa o cockpit web canônico (sem reimplementar lógica). Funciona offline (sem depender de carro/deploy).
- App continua compilando (BUILD SUCCEEDED).
- Nada de produção alterado.

## 4. Leitura obrigatória — confirmação
- ~/.claude/CLAUDE.md: lido · ~/.claude-decisoes/padroes.md: lido · FLAVIO_EXECUTION_PROTOCOL / DONE_CHECKLIST / ENVIRONMENT_RULES / COMMUNICATION_RULES: lidos.
- Extra P1 Fast: CLAUDE.md, docs/COCKPIT_FONTE_DA_VERDADE.md, memórias (global + projeto): lidos.

## 5. Plano (<=5 passos)
1. Embutir no app os 7 arquivos canônicos do cockpit (vitrine que roda sozinha + cockpit.css + 5 módulos JS), em Resources/Cockpit.
2. Servir esses arquivos por um scheme próprio (cockpit://) num WKWebView (evita o bug de módulo ES por file://).
3. Criar CockpitPilotoView.swift: WebView em tela cheia, girado pra paisagem (vira o celular), com botão Voltar.
4. Ligar na Home: novo destino + botão "COCKPIT DO PILOTO".
5. Rodar build no simulador e reportar com prova.

## 6. Arquivos a inspecionar/alterar
- web/cockpit/{cockpit-vitrine.html,cockpit.css,cockpit-state.js,cockpit-renderer.js,live-data-bridge.js,apice-calculator.js,trecho-detector.js} (origem, só leitura/cópia)
- ios/p1fast-ios/Sources/Views/HomeView.swift (novo botão + destino)
- ios/p1fast-ios/Sources/Views/CockpitPilotoView.swift (novo)
- ios/p1fast-ios/project.yml (empacotar pasta Cockpit) + regenerar .xcodeproj
- ios/p1fast-ios/Resources/Cockpit/ (novo, cópia vendida do cockpit web)

## 7. Ambiente alvo: desenvolvimento
## 8. Produção protegida: sim
## 9. Autorização para produção: não
## 10. Evidência da autorização: não recebida (não se aplica — só app em dev, sem deploy)

## 11. Riscos
- Cockpit web é paisagem (956px) e o app é retrato-travado → resolver girando a tela (não destravar o app inteiro).
- index-t3000.html é a página do NOTEBOOK (lê USB via "Autorizar") — NÃO serve no iPhone. Por isso uso a vitrine (roda sozinha, offline).
- Cópia vendida do cockpit web no bundle pode envelhecer se o web mudar → documentar no README da pasta.
- Mostra volta de DEMONSTRAÇÃO; o espelho do carro AO VIVO é passo seguinte (depende do notebook transmitindo + viewer assinante).

## 13. Revisão (Flávio 22-23/06) — giro nativo + painel aprovado
- Pedido novo: SEM botão; virar o celular pra paisagem ABRE o cockpit, voltar fecha (qualquer tela).
- Pedido novo: usar o painel APROVADO (cockpit-volta-real.html: cluster sensores, luz de freio, msgs críticas) — não a vitrine.
- Pedido novo: centralizar no giro (estava torto).
- Solução (3 agentes em paralelo → síntese): ORIENTAÇÃO NATIVA do iOS (OrientationGate + AppDelegate destrava paisagem só pro cockpit; fullScreenCover no ContentView dirigido pelo giro físico) → centraliza sozinho. Painel aprovado embutido (+ 2 JSON vendidos, fetch relativos). App segue retrato em todas as outras telas.
- Arquivos: NOVO Sources/App/OrientationGate.swift; EDIT P1FastApp.swift (adaptor), ContentView.swift (cover), CockpitPilotoView.swift (sem giro na mão), Info.plist + project.yml (paisagem declarada). Resources/Cockpit/cockpit-app.html = painel aprovado; +2 JSON.
- BUILD SUCCEEDED (simulador + assinado p/ device). Instalado no iPhone 16 Pro Max (2D6E7A3B) via devicectl ("App installed").
- Provado no simulador: painel aprovado renderiza; giro nativo confirmado pelo Flávio (print em paisagem).

## 12. Status: AGUARDANDO validação do Flávio no iPhone 16 (giro + equilíbrio)
- BUILD SUCCEEDED (simulador, EXIT=0, sem erros).
- Cockpit empacotado no app (bundle: app/Cockpit/*).
- Provado no simulador (iPhone 17): cockpit renderiza vivo (luz de marcha, ENTRADA 132/FREIO −4/ÁPICE, delta −0.08, "FREOU CEDO"). Screenshot /tmp/cockpit-final.png.
- Botão "COCKPIT DO PILOTO" adicionado na Home (estados cheio e vazio).
- Atalho dev de simulador: `--p1-cockpit`.
- Nada de produção alterado.
