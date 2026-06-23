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

## 12. Status: CONCLUÍDO
- BUILD SUCCEEDED (simulador, EXIT=0, sem erros).
- Cockpit empacotado no app (bundle: app/Cockpit/*).
- Provado no simulador (iPhone 17): cockpit renderiza vivo (luz de marcha, ENTRADA 132/FREIO −4/ÁPICE, delta −0.08, "FREOU CEDO"). Screenshot /tmp/cockpit-final.png.
- Botão "COCKPIT DO PILOTO" adicionado na Home (estados cheio e vazio).
- Atalho dev de simulador: `--p1-cockpit`.
- Nada de produção alterado.
