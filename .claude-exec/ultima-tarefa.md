# ⏰ RETOMADA PÓS-CLEAR — "continua a orientação" (checkpoint 2026-06-10 ~15h)  ← LER PRIMEIRO

## ONDE PAROU (1 frase)
Vigia de curvas CONSERTADO (8,0 de 8 por volta no replay!), resumo da volta APARECE na reta
longa, e a tela de orientação ainda NÃO aparece — causa isolada: motor devolve null (sem
componente perdendo) mesmo com deltas registrados. Falta UMA investigação pontual.

## O QUE FOI PROVADO NESTA SESSÃO (não refazer)
1. trecho-detector.js consertado: RESSINCRONIZAÇÃO (vigia paralelo de entradas — perdeu curva,
   engata na próxima), SAÍDA DE EMERGÊNCIA (fecha sem ápice, sem inventar), memória contínua
   de entrada (sem tick cego pós-avanço), sanidade do ápice (>60 m não vale).
   Smokes: resync 6/0 + trecho 12/0 + detector 3/0. REPLAY: 24 fechamentos em 3 voltas =
   8,0/volta, 8/8 curvas distintas, 0 emergências, 9 resyncs.
2. Atropelo calibrado em main-t3000 (mensagemGraveAtiva): só gravidade super/crítico esconde a
   orientação (MOTOR_AQUECENDO/super da gravação escondia tudo 2x/s — gravação é motor esquentando).
3. Sim ajustado pra demo: sim-amostras.json água≤60°C sem alarmes; sim-gps.json (?v=5520b)
   posição E velocidade 10% mais lentas (antes só posição → deltas zero "honestos").
4. Coreografia comprovada por sonda: fases painel→trecho→reta/orientacao (100 ticks) + resumo.
   RESUMO DA VOLTA apareceu (captura: /tmp/p1-resumo-volta.png).

## A PRÓXIMA AÇÃO EXATA (começar por aqui)
Sonda: getOrientacao devolveu null 200/200 com bridge._stats.deltaCalculados=13. Capturar UM
evento delta-calculado INTEIRO (ev.porSubTrecho: chaves e SINAIS dos deltaS) monkey-patchando
oportunidade.registrarDelta via window.__t3, e LER delta-calculator.js (~linhas 95-165) pra
confirmar: (a) convenção de sinal (positivo = mais lento?); (b) nomes das sub-chaves
(entrada/freio/apice/saida?); (c) se porSubTrecho chega vazio (buffer de pontos por sub).
Suspeitas ordenadas: sinal invertido OU sub-chaves com nomes diferentes do que o motor
oportunidade-trecho.js espera OU deltas diluídos pela janela de 2.
Depois do conserto: replay final → telas de orientação aparecem → ABRIR pro Flávio ver ao
vivo (Central p1tv + painel ?semfio no Chrome dele) → propor novo MIGRAR (o vigia consertado
PRECISA ir pro ar — o do ar atual tem o defeito sequencial).

## COMO RODAR A PROVA (receita exata)
1. cd "/Users/imac/Projetos/P1 Fast" && python3 -m http.server 8767 &
2. Navegador automatizado: scripts node em /Users/imac/Documents/Sistemas/cdai/frontend
   (playwright instalado lá; import { chromium } from 'playwright').
3. Central: https://p1tv.vercel.app → click #btnSim (simulador: motor saudável + GPS volta real
   10% mais lenta, ~276 s/volta, 4 voltas por ciclo).
4. Painel DEV: http://localhost:8767/web/cockpit/index-t3000.html?semfio
   (modo sem fio: amostras vêm do canal cockpit-bubi-live).
5. Sonda: window.__t3 = { t3, cockpitState, bridge, oportunidade, getCoreografia(), telaOrientacao }.
   Tela: document.querySelector('.p1-orient').dataset.on/modo.

## AMBIENTE / PRODUÇÃO
- Tudo desta sessão em DEV (auto-save commita sozinho na linha wip/20260608-143705).
- PRODUÇÃO p1t4000.vercel.app = deploy 9mto8lxqj de hoje cedo (ANTERIOR ao conserto do vigia —
  ainda tem o defeito sequencial 2-3/8). Novo MIGRAR depois da orientação fechada.
- Rollback prod (se precisar): npx vercel alias set https://p1t4000-fitlngal6-flaviomarques-6007s-projects.vercel.app p1t4000.vercel.app
- iPhone: app com amarração v3 instalado. Memórias da sessão: p1-fast-central-pista-2026-06-09
  + p1-fast-conceitos-trecho-ditado-2026-06-09 + feedback_telas_de_acao_minimas (ler os 3).

---

# TASK_INIT (2026-06-10 ~16h) — RETOMADA "continua a orientação" (pós-/clear)

## Pedido original: "continua a orientação" — fechar o último elo: a tela de orientação
## não aparece porque getOrientacao devolve null mesmo com 13 deltas calculados.
## Objetivo (1 frase): fazer a tela de orientação acender de verdade no replay e mostrar pro Flávio.
## Critérios de conclusão: (a) causa do null PROVADA com evidência (evento delta-calculado
## capturado inteiro); (b) conserto aplicado em DEV com smoke; (c) replay final com telas de
## orientação aparecendo; (d) abrir pro Flávio ver ao vivo (Central p1tv + painel ?semfio).
## Leitura confirmada: ~/.claude/CLAUDE.md SIM · ~/.claude-decisoes/padroes.md SIM ·
## FLAVIO_EXECUTION_PROTOCOL.md SIM · FLAVIO_DONE_CHECKLIST.md SIM ·
## FLAVIO_ENVIRONMENT_RULES.md SIM · FLAVIO_COMMUNICATION_RULES.md SIM ·
## + 3 memórias da sessão (central-pista, conceitos-trecho, telas_de_acao_minimas) + CLAUDE.md do projeto.
## Plano (≤5): 1) inspecionar contrato delta-calculator × oportunidade-trecho × bridge (FEITO:
## suspeita forte = pontos de referência sem kmh → todos os pares pulados → delta 0);
## 2) provar com dados reais (banco de melhores passagens + sonda no replay);
## 3) consertar a causa em DEV + smoke; 4) replay final 8/8 com tela acendendo; 5) abrir pro Flávio.
## Arquivos/áreas: web/cockpit/{delta-calculator,oportunidade-trecho,live-data-bridge,main-t3000,
## trecho-detector,melhores-loader,coreografia-volta,tela-orientacao}.js + banco melhores passagens (leitura).
## Ambiente alvo: DESENVOLVIMENTO (linha wip/20260608-143705, auto-save).
## Produção protegida: sim. Autorização para produção: não (não recebida — novo MIGRAR só depois,
## com aprovação do Flávio). Riscos: mexer no comparador afeta widgets que usam delta (validar smokes);
## nuvem não pode ser poluída por passagem de simulador (blindagem __P1_ORIGEM_SIM__ já existe).
## Status: iniciado

---

# AFINAÇÃO DO VIGIA DE CURVAS ("continua a orientação") — 2026-06-10

## Pedido: fechar a pendência — vigia completa só 2-3 de 8 curvas por volta no replay.
## Critério de conclusão: replay com 8/8 curvas medidas por volta + tela de orientação
## acendendo de verdade + mostrar pro Flávio no navegador. Ambiente: DESENVOLVIMENTO
## (produção intocada; atualização do painel no ar só com novo MIGRAR).
## Plano: (1) sonda por curva descobrindo QUAL passo escapa; (2) consertar a causa
## (suspeitas: sequência rígida — perdeu 1, trava a fila; freada); (3) testes; (4) replay
## até 8/8; (5) abrir pro Flávio ver a tela acender. Status: iniciado

---

# MIGRAÇÃO PRA PRODUÇÃO: painel p1t4000 (2026-06-10)

## Autorização LITERAL do Flávio: "MIGRAR PARA PRODUÇÃO: painel p1t4000" (10/06)
## PROD_RELEASE_PLAN apresentado antes de executar (sem risco destrutivo; sem migration).
## Publicado: https://p1t4000-9mto8lxqj-flaviomarques-6007s-projects.vercel.app → p1t4000.vercel.app
## ROLLBACK (1 comando): npx vercel alias set https://p1t4000-fitlngal6-flaviomarques-6007s-projects.vercel.app p1t4000.vercel.app
## Pré-voo do pacote: 39 js sintaxe OK · grafo 31 módulos fechado · zero marcador de conflito.
## Pacote leva: consertos 08/06 + religações automáticas + eventos volta/trecho + GPS do canal
## + detectores consertados (interseção real) + ápices-semente + orientação por trecho +
## modo sem fio + blindagem anti-simulador + amarração v3.
## Validação pós-deploy: APROVADA NAS 3 FRENTES (workflow, 3 verificadores independentes):
## (1) conteúdo servido = byte-idêntico ao pacote, todos os marcadores presentes, zero conflito;
## (2) grafo público: 31/31 módulos no ar com sintaxe válida;
## (3) boot real em produção com simulador: canal online, 8/8 trechos armados, coreografia ativa,
##     volta fechada na linha de chegada, zero erros de página.
## Notas não-bloqueantes (artefato do dado do simulador, não do painel): HUD "Ar undefined°C"
## (campo nulo removido na gravação) e "λ 0.00" (gravação tinha lambda 0 em trechos; o real
## com motor foi validado 26/05 com λ 0,77).
## TASK_DONE migração: concluída. Produção alterada COM autorização literal registrada.

---

# IMPLEMENTAÇÃO ORIENTAÇÃO POR TRECHO NO PAINEL (2026-06-09 noite)

## Pedido: "pode implementar. vá até o fim sem parar. está autorizado."
## Escopo autorizado: coreografia da volta + tela Oportunidade do Trecho (contrato v3) +
## motor do radar por trecho, NO PAINEL DO PILOTO (web/cockpit) — EM DESENVOLVIMENTO.
## Inclui resgate do TrechoAdvisor (peça JS órfã de 24/05) se compatível.
## Produção protegida: sim. Sem MIGRAR PARA PRODUÇÃO nada vai ao ar. Autorização prod: NÃO recebida.
## Critérios de conclusão: (1) coreografia funcionando (saída→meia-reta painel; meia-reta→entrada
## orientação; críticas atropelam); (2) tela v3 renderizando curva real na visão do piloto com
## vermelho/verde; (3) motor decide verbo+correção por trecho dos deltas por componente;
## (4) testes automáticos verdes; (5) validação no navegador com o replay do simulador.
## Plano: congelar v3 → motor (oportunidade-trecho.js) → tela (tela-orientacao) → coreografia →
## plugar no main-t3000 → smokes → validação navegador → relatório.
## Status: PARCIALMENTE CONCLUÍDO (madrugada 10/06) — ver TASK_DONE abaixo

## TASK_DONE (implementação orientação por trecho)
- Pedido conferido: sim. Ambiente: desenvolvimento (+ p1tv teste). Produção: NÃO alterada
  (única escrita na nuvem foi tentativa de DELETE de poluição de teste que retornou 0 linhas —
  a tabela estava intacta, 56 passagens reais preservadas).
- CONSTRUÍDO E TESTADO (46 testes verdes novos/área):
  · oportunidade-trecho.js (motor, 13/0) · coreografia-volta.js (10/0) · tela-orientacao.js
  (tela contrato v3) · costura no main-t3000 (críticas atropelam, resumo de volta, ordem por
  trecho) · modo SEM FIO (?semfio) · blindagem anti-simulador (provada: "passagem NÃO salva")
  · TrechoAdvisor resgatado (6/0) · v3 congelada em versions/ · simulador com GPS interpolado
  em cadência real (~276 s/volta, 10% mais lento de propósito).
- 3 DEFEITOS GRAVES PRÉ-EXISTENTES achados e consertados:
  · detectores cruzavam com RETA INFINITA (chegada 5/0 + trecho 12/0 após conserto por
    interseção caminho×linha) — na pista real ia fechar voltas erradas;
  · segments-loader exigia ápice cadastrado (não existe — ápice é calculado) → detector
    NUNCA armava; consertado + ápices-semente do mapa oficial (validados ≤24 m);
  · amarração GPS→desenho com COLAPSO DE ESCALA (trajeto canônico = 4 voltas/22 km, não 1);
    v3 com escala travada em 5.476 m — mediana 5,7 px. App reconstruído e INSTALADO no iPhone.
- VALIDADO no replay de voltas reais: voltas fecham na linha certa; passagens completam e
  salvam (e a blindagem bloqueia quando é simulador); coreografia muda de estado nos lugares
  certos (painel→trecho→reta→fase orientação); motor devolve orientação válida (FREIA DEPOIS).
- PENDÊNCIA REAL ÚNICA do bloco: o detector completa só ~2-3 dos 8 trechos por volta no
  replay (fases perdem cruzamentos de entrada/saída em parte das curvas) → a tela de
  orientação ao vivo ainda não APARECE de ponta a ponta. Precisa de afinação dedicada do
  detector (robustez das fases + ápice-semente). Sondagem pronta (window.__t3 expõe tudo).
- Outras pendências: publicar painel exige "MIGRAR PARA PRODUÇÃO: painel p1t4000";
  teste antigo live-data-bridge segue 21/5 (pré-existente, área alerta ECU).

---

# AUDITORIA "tudo ligado esperando dados reais?" (2026-06-09 noite)

## Pedido: Flávio aprovou o visual no iPhone e pediu auditoria da cadeia de dados reais.
## Método: somente leitura — página no ar inspecionada + nuvem consultada + código conferido.

## VERDE (ligado, só esperando dado real)
- Vídeo: DJI→notebook→Central→sala→app (caminho provado em campo 09/06).
- GPS: RaceBox→Central→sala+canal→app/bolinha (RaceBox provado no escritório 25,1 Hz).
- Dados do motor: painel NO AR publica amostras no canal (grep publishSample=2 na versão
  publicada; provado com motor real 26/05) → Central repassa → app.
- Referências na nuvem (consulta direta): 20 trechos, 4 marcos (chegada/box/pit),
  56 melhores passagens reais, curva do motor 79 pts, 5 marchas. TUDO lá.
- App ASSISTIR decodifica exatamente o que a Central repassa (validado ao vivo).

## VERMELHO (1 elo faltando — depende de autorização)
- VOLTA e cor verde/vermelho com dados REAIS: o painel do piloto NO AR não publica eventos
  de volta/trecho (grep publishEvento=0) e não consome GPS do canal (grep onGpsPoint=0).
  As duas peças estão prontas EM DESENVOLVIMENTO (feitas hoje). Sem publicar, a linha da
  volta no app só funciona com simulador. Destrava com: "MIGRAR PARA PRODUÇÃO: painel
  p1t4000" (pacote leva junto: consertos 08/06 + religação automática + eventos + GPS canal).

## AMARELO (risco conhecido, não bloqueia ligação)
- Fix de GPS do RaceBox ao ar livre nunca testado (escritório bloqueia satélite).
- Religação automática da T4000 testada só em lógica (hardware está no carro).
- Bolinha: precisão ~1 largura de pista (amarração desenho estilizado × GPS).

---

# TELA ASSISTIR — REFORMA DITADA (2026-06-09 noite, 2ª rodada)

## Pedido do Flávio (voz)
Esquecer o TRECHO. Na mesma linha: melhor volta do dia + tempo da volta em curso, colorido
(verde se naquela parte está melhor que a melhor volta do dia, vermelho se pior). Layout:
CIMA vídeo · MEIO velocidade + dado da volta · BAIXO mapa de Brasília com o ponto do carro.
Mapa: fundo preto, pista cinza, usar a pista OFICIAL dos arquivos (a que ele posicionou).

## TASK_DONE (reforma)
- Ambiente: desenvolvimento + p1tv (teste). Produção NÃO alterada.
- Arquivos: AssistirView.swift (layout novo, sem TRECHO, em-curso colorido por deltaS),
  PistaBrasilia.swift (NOVO, gerado: 495 pts do desenho DEFINITIVO + amarração GPS calculada
  por aproximação iterativa, erro mediano 11,5 px), index.html da Central (simulador ganhou
  replay de GPS do trajeto canônico + volta fechada ao completar o circuito + guarda contra
  GPS congelado), sim-gps.json (NOVO, 307 pts).
- Validação: BUILD SUCCEEDED, app instalado no iPhone, sala recebeu gps(lat Brasília,
  spd real)/carro/painel sem erros via navegador automatizado.
- Resultado: concluído — aguardando validação visual do Flávio no iPhone.
- Pendência honesta: precisão da bolinha ~1 largura de pista (desenho oficial é estilizado;
  se incomodar, dá pra refinar a amarração trecho a trecho).

---

# TELA ASSISTIR NO APP (2026-06-09 noite)

## Pedido do Flávio (card respondido: "Tela de ASSISTIR primeiro, depois modo BOX")
Tela pra pessoas assistirem no app: vídeo em tempo real em cima + dados básicos de trecho e
volta do piloto embaixo. Decisões registradas: internet da Apple TV = celular do modo BOX.

## TASK_DONE (tela ASSISTIR)
- Pedido conferido: sim · Ambiente: desenvolvimento + p1tv (teste) · Produção alterada: não
- Arquivos: AssistirView.swift (NOVO), HomeView.swift (botão+rota), ContentView.swift (rota),
  web/teste-aparelhos/index.html (repasse carro/painel pra sala + simulador de voltas/trechos),
  web/cockpit/cloud-bridge.js (publishEvento), web/cockpit/main-t3000.js (eventos volta/trecho/delta — DEV)
- Validação: BUILD SUCCEEDED + app INSTALADO no iPhone; ouvinte na sala recebeu gps=60 carro=24
  painel=12 em 12 s (exemplos reais conferidos); sintaxe OK nos 3 js; smokes bootstrap 7/0, web 16/0.
- Resultado: concluído — FALTA validação visual do Flávio no iPhone (abrir ASSISTIR AO VIVO com
  a Central transmitindo + simulador ligado).
- Próximo bloco já decidido no card: MODO BOX (Vista Piloto na Apple TV, internet do celular).

---

# SOLUÇÃO DE PISTA SEM IR À PISTA (2026-06-09)

## Pedido original do Flávio
"vc já criou uma aplicação para testar a t4000. e testamos e deu certo. hoje testamos gps e câmera.
quero preparar a solução de pista sem ir lá. porque na próxima quero tudo funcionando."

## Objetivo em 1 frase
Juntar os dois caminhos já provados (T4000→painel→nuvem de 26/05 + câmera/GPS→app de 09/06) numa
solução de pista única, robusta (religação automática) e testável no escritório via replay das
amostras reais do motor.

## Critérios objetivos de conclusão
1. Transmissor p1tv com câmera + GPS + status do carro + religação automática nas 3 fontes.
2. Painel remoto (painel.html) mostrando vídeo + GPS + dados do carro com aviso de queda.
3. Modo simulador tocando as 2.901 amostras reais (26/05) sem o carro.
4. Painel do piloto (p1t4000) com religação automática — EM DESENVOLVIMENTO, sem publicar.
5. Cadeia inteira validada no escritório (navegador + ouvinte no Mac).
6. Checklist do dia de pista + ADR-024 atualizada (câmera iPhone → DJI).

## Confirmação de leitura: ~/.claude/CLAUDE.md sim · padroes.md sim · FLAVIO_EXECUTION_PROTOCOL sim ·
FLAVIO_DONE_CHECKLIST sim · FLAVIO_ENVIRONMENT_RULES sim · FLAVIO_COMMUNICATION_RULES sim

## Plano (5 passos)
1. Transmissor unificado em web/teste-aparelhos/ (religação + GPS na nuvem + status carro).
2. painel.html com dados do carro + religação.
3. Modo simulador (replay amostras reais).
4. Robustez do painel do piloto em dev (main-t3000.js) — SEM publicar.
5. Validação no escritório + checklist de pista + ADR-024.

## Arquitetura decidida (com base no que está provado)
- Notebook na pista roda 2 abas: p1t4000.vercel.app (painel do piloto + T4000 via USB — provado 26/05)
  e p1tv.vercel.app (câmera DJI + RaceBox — provado 09/06). Só UMA página pode segurar o USB da
  T4000 por vez, por isso 2 abas, cada uma dona de um aparelho.
- Dados do carro trafegam SÓ pelo canal canônico cockpit-bubi-live (regra: não criar fonte paralela).
- GPS do RaceBox passa a ser publicado TAMBÉM no cockpit-bubi-live (evento 'gps' que o canal já
  suporta) além do caminho atual pelo vídeo — assim o painel do piloto pode usar o GPS de 25 Hz.

## Ambiente alvo: desenvolvimento. p1tv.vercel.app = endereço de TESTE (criado 09/06 como tal).
## p1t4000.vercel.app NÃO será republicado (exige MIGRAR PARA PRODUÇÃO).
## Produção protegida: sim · Autorização para produção: não · Evidência: não recebida
## Riscos: nenhum em produção; canal de broadcast não persiste dados (simulador não polui banco).
## Status: CONCLUÍDO (aguardando validação visual do Flávio com RaceBox+DJI reais)

## TASK_DONE (2026-06-09 noite)
- Pedido original conferido: sim (solução de pista preparada sem ir à pista, testável no escritório)
- Ambiente trabalhado: desenvolvimento + endereço de TESTE p1tv.vercel.app (criado 09/06 como teste)
- Produção foi alterada: não (p1t4000.vercel.app intocado; nada enviado pro repositório oficial remoto)
- Arquivos reais inspecionados: sim (main-t3000.js, cloud-bridge.js, live-data-bridge.js, index/painel,
  FONTE_DADOS_AO_VIVO.md, HANDOFF_T4000, BLOCKERS, STATUS, vercel configs)
- Alterações feitas: sim — ver lista abaixo
- Testes executados: 5 smokes da área (state 24/0, renderer 17/0, bootstrap 7/0, web 16/0,
  live-data-bridge 21/5 — as 5 falhas são PRÉ-EXISTENTES, provado contra estado 546b2da0 16:51);
  sintaxe OK nos 4 arquivos mexidos; validação ponta-a-ponta com navegador automatizado:
  simulador→nuvem→painel remoto (RPM 843/água 38°/bat 12,8 V) + ouvinte externo (105 amostras).
- Resultado: concluído
- Pendências reais: (1) Flávio validar Central com RaceBox+DJI reais clicando;
  (2) religação T4000 sem teste com hardware real; (3) publicar painel do piloto reforçado
  exige "MIGRAR PARA PRODUÇÃO: painel p1t4000" (inclui consertos 08/06); (4) teste antigo
  live-data-bridge defasado (5 falhas pré-existentes, área alerta ECU).

## Arquivos alterados nesta tarefa
- web/teste-aparelhos/index.html (Central de Pista: 4 luzes + religações + GPS→nuvem + simulador)
- web/teste-aparelhos/painel.html (dados do carro + religação + GPS reserva pela nuvem)
- web/teste-aparelhos/sim-amostras.json (NOVO — 2.901 amostras reais do motor, 827 KB)
- web/cockpit/main-t3000.js (religação automática T4000 + GPS do canal no detector) — DEV
- web/cockpit/cloud-bridge.js (religação automática do canal) — DEV
- ARCHITECTURE_DECISIONS.md (ADR-024 registrada: câmera DJI no notebook)
- docs/CHECKLIST_DIA_DE_PISTA.md (NOVO)
Tudo preservado pelo auto-save no branch wip/20260608-143705. Publicado SÓ o p1tv (teste).

---

# ANÁLISE + PROPOSTA — "implementar o que está faltando" (2026-06-09) — superada pela tarefa acima (Flávio respondeu em texto: preparar solução de pista; card não precisa mais de resposta)

## Pedido original do Flávio
"agora vamos implementar em p1 fast o que está faltando. analise e me proponha."

## Objetivo em 1 frase
Mapear o que falta no P1 Fast com evidência e propor ordem de implementação pra decisão do Flávio.

## Critérios objetivos de conclusão
1. Pendências levantadas de fontes reais (memória, ultima-tarefa, STATUS.md, BLOCKERS.md, código).
2. Proposta com recomendação apresentada.
3. Card de decisão aberto no navegador.

## Confirmação de leitura dos arquivos obrigatórios
- ~/.claude/CLAUDE.md: sim
- ~/.claude-decisoes/padroes.md: sim (0 decisões sintetizadas)
- ~/.claude/FLAVIO_EXECUTION_PROTOCOL.md: sim (existe, 92 linhas)
- ~/.claude/FLAVIO_DONE_CHECKLIST.md: sim (existe, 64 linhas)
- ~/.claude/FLAVIO_ENVIRONMENT_RULES.md: sim (existe, 86 linhas)
- ~/.claude/FLAVIO_COMMUNICATION_RULES.md: sim (lido integral)

## Plano (≤5 passos)
1. Ler memória (global + P1 Fast) e registros do projeto. [feito]
2. Conferir STATUS.md, BLOCKERS.md, shift light, pasta windows/. [feito]
3. Consolidar o que falta em frentes.
4. Apresentar proposta com recomendação.
5. Abrir card de decisão e aguardar.

## Áreas inspecionadas
STATUS.md, BLOCKERS.md, docs/SHIFT_LIGHT_PROGRESS.md, windows/cockpit/, .claude-exec/ultima-tarefa.md, memória dos 2 caminhos.

## Ambiente alvo: desenvolvimento (análise somente leitura; nenhuma alteração de código nesta etapa)
## Produção protegida: sim
## Autorização para produção: não
## Evidência da autorização: não recebida
## Riscos: nenhum (somente leitura + card)
## Status: iniciado → proposta apresentada, aguardando decisão do Flávio

---

# TESTE DE APARELHOS (vídeo + GPS) — 2026-06-09

## Pedido do Flávio
Teste de ponta a ponta: o **notebook Windows** da pista transmite **vídeo (câmera DJI Osmo Action 6,
1080p, via Daily.co)** + **dados do GPS (RaceBox Mini S)**, e o Flávio **vê no celular** numa tela de
painel ao vivo. Iterar ao vivo com ele, ajustando conforme o feedback.

## PUBLICADO e no ar (endereço de teste novo e separado — NÃO toca produção)
- **Notebook (transmite):** https://p1tv.vercel.app
- **Celular (assiste):** https://p1tv.vercel.app/painel
- Projeto Vercel `p1-teste-aparelhos` (apelido `p1tv.vercel.app`). Proteção SSO desligada (público).

## Arquitetura (3 peças) — fonte em `web/teste-aparelhos/`
- `index.html` (notebook): Daily.co publisher (câmera, seletor pra escolher a DJI) + RaceBox por
  **WebBluetooth** (Nordic UART notify 6e400003; frame B5 62 / class 0xFF id 0x01 / payload 80B —
  fix p[20], numSV p[23], hacc u32@40/1000, spd i32@48/1000*3.6, lat i32@28/1e7, lon i32@24/1e7) →
  manda GPS pro celular via `sendAppMessage` (200ms).
- `painel.html` (celular): Daily.co viewer (vídeo) + recebe GPS por `app-message`.
- `api/room.js`: ponte same-origin → chama servidor-pra-servidor `fam-racing.vercel.app/api/video/room`
  (que bloqueia Origin de outro site). Sala determinística eventId `p1-teste-aparelhos` + data de hoje.

## Verificado por evidência (2026-06-09)
fam-racing/api/video/room → 200 (roomUrl+tokens). p1tv.vercel.app `/`→200, `/painel`→200,
`/api/room`→200 (cria sala `evento-p1-teste-aparelhos-20260609`).

## VALIDADO EM CAMPO (2026-06-09) ✅
Flávio rodou o teste: "a imagem apareceu e o gps também". Vídeo ao vivo + GPS do notebook
chegam DENTRO do app P1 Fast no iPhone (tela "TESTE AO VIVO" na Home). Primeira vez que o
vídeo rodou no app (MS-11 era stub). Detalhe completo em memória
`p1-fast-teste-video-gps-app-validado-2026-06-09`.

App iOS: tela nova `Sources/Views/TesteAoVivoView.swift` + botão "TESTE AO VIVO" na HomeView +
rota `--p1-teste-aovivo` + chaves de plist. Instalado no iPhone 16 Pro Max (id 00008140-000E2D611E6A801C).
Build SUCCEEDED, install OK.

## Próximo passo (aguardar decisão do Flávio)
Teste validado. Próximas frentes possíveis (ele decide): (a) integrar a T4000/dados do carro no mesmo
fluxo; (b) levar do "teste" pro painel real do piloto; (c) robustez (reconexão, Starlink na pista);
(d) atualizar ADR-024/CLAUDE.md (câmera iPhone → DJI). Iterar app: ver comando de reinstalação na memória.

## Pendências do modelo (separadas deste teste)
- ADR-024 / CLAUDE.md dizem câmera = iPhone frontal; Flávio mudou pra DJI no notebook. Atualizar doc.
- MS-11 real no app iOS: StreamCoordinator tem stub, conexão Daily.co CallClient não implementada.

---

# AUDITORIA PROFUNDA — TASK_DONE (2026-06-08)

Pedido Flávio: "faça uma auditoria profunda." Ambiente: desenvolvimento + leitura na nuvem.
Produção NÃO alterada. 5 frentes paralelas, cada achado provado.

VERDE (com evidência):
- Núcleo Swift: 545 ok / 0 fail (`swift run p1fast-smoke`).
- App iOS: BUILD SUCCEEDED (só warnings).
- Migrations.swift: colisão v19 RESOLVIDA (único v19_manutencao_consumiveis; antigo virou v28).
- Estoque na nuvem chegou ponta-a-ponta: pecas=2, pecas_locais=3, pecas_movimentacoes=5.
- Schema drift RESOLVIDO (data_fim nullable, template_id text, quantidade/nota presentes).
- App iOS: 7 funções principais existem e integradas; 0 TODO/FIXME/fatalError críticos.

VERMELHO / RISCO:
1. 3 arquivos do PAINEL WEB do cockpit NA VERSÃO OFICIAL com marcadores de conflito não
   resolvidos (JS inválido): web/cockpit/cockpit-renderer.js (9), cockpit-state.js (3),
   melhores-loader.js (9). Em origin/main E branch local. Introduzido em cd3af53b. Quebra
   `npm run smoke`. NÃO afeta o app iPhone (afeta só o painel web do cockpit).
2. STATUS.md 10 dias atrasado (topo 2026-05-24; realidade 2026-06-03). Contradição doc×doc:
   MS-4 e MS-16 = "não feito" no STATUS, "fechado" no PLANO_FASE_1.
3. Trabalho órfão em 4 ambientes isolados nunca incorporados: infallible-liskov (editor de
   pista + mapa Brasília), infallible-snyder (6 telas), rodada1-s1 (foto carro + telas S1-S8),
   vista-engenheiro (Vista Piloto canônica + Vista Engenheiro Command Box).
4. Manutenção: 0 linhas na nuvem (sync de manutenção nunca exercitado de verdade).
5. Sincronização só roda com app aberto/desbloqueado (sem envio em segundo plano).
6. Teste node-smoke-schema-parity desatualizado vs schema atual (5 asserts) — teste velho.
7. 22 dos últimos 50 registros da oficial são "auto-save" automáticos (poluição de processo).

Resultado: concluído. Próximo passo aguarda decisão do Flávio.

---

# FRENTE 1 CONCLUÍDA (2026-06-08) — Painel do cockpit consertado

Flávio aprovou consertar os 3 arquivos do painel web. Esclareceu o modelo (NÃO eram 2 opções):
um quadro por curva com ENTRADA (único ponto, velocidade ao cruzar a linha de entrada),
FREIO (ponto de frenagem em metros desde a entrada + velocidade) e ÁPICE (bolinha = ponto
mais interno da passagem mais rápida). Saída mantida.

Resolução (por evidência, não escolha cega):
- melhores-loader.js: adotado o modelo que casa com a nuvem (migrations 0026/0027: track_id,
  segment_id, tempo_trecho_s, pontos_json) e com os 2 pontos de entrada do painel (main.js,
  main-t3000.js chamam gravarPassagem + loadMelhoresPassagens({obj})). Lado antigo
  (salvarPassagemSeMelhor/distanciaMetros) descartado — ninguém usava (grep confirmou).
- cockpit-state.js: apex.apice = {distM, angleDeg} (bolinha); entrada/freio/saida preservados;
  freio ganhou valorKmh (modelo Flávio). 4 papéis mantidos (setApexPonto valida os 4).
- cockpit-renderer.js: removida a definição duplicada/antiga de _renderApexApice; mantida a
  versão bolinha; saída renderizada; bindings = bolinha (apexApiceBola/Num) + saída.

Validação: 0 marcadores de conflito restantes; cockpit-state e cockpit-renderer carregam em
Node; smokes VERDES: cockpit-state 24/0, cockpit-renderer 17/0, cockpit-bootstrap 7/0 (CKB-07
que falhava agora passa), cockpit-web 16/0.

Ambiente: DESENVOLVIMENTO. NÃO enviado pro repositório oficial / NÃO colocado no ar (o painel
p1t4000.vercel.app pode estar ligado à oficial; envio precisa de "MIGRAR PARA PRODUÇÃO").

Pendentes das 3 frentes aprovadas: (2) atualizar STATUS.md; (3) trazer trabalho órfão.

---

# FRENTES 2 e 3 (2026-06-08)

## Frente 2 — STATUS.md atualizado ✅
Topo reescrito pro checkpoint 2026-06-08 (estado real verificado) + correção das contradições:
MS-4 FECHADO 2026-05-11 (confirmado em PLANO_FASE_1.md:184), MS-16 entregue 2026-05-13. Histórico
2026-05-24 preservado logo abaixo (marcado como histórico). Nada apagado.

## Frente 3 — trabalho órfão: retrato honesto + 1 item trazido
Os diffs dos 4 ambientes vs oficial são GIGANTES (5000+ arquivos divergentes) — merge cego
REVERTERIA a oficial. Avaliei só os commits nomeados de cada entrega + checagem de presença na oficial:
- Vista Piloto canônica/v04 (fb9126ed): JÁ na oficial (mockup-command-box-vista-piloto + auditorias).
- Mapa Brasília definitivo (d453652c): JÁ na oficial (_design-reference/MAPA-BRASILIA-DEFINITIVO.json).
- rodada1-s1 (19c23841): majoritariamente cards de pergunta .html antigos = lixo histórico.
- c0b6026a/13ce80c6 (telas .swift): StintCockpitView/StintReadyView NEM EXISTEM na oficial atual
  → estrutura divergente, ALTO RISCO de reverter trabalho de 03/06. CockpitOrientationTestView +
  StintRodandoView são telas NOVAS (faltam na oficial) — avaliar 1 a 1 (decisão pendente).
- **TRAZIDO: _design-reference/mockup-command-box-vista-engenheiro.html** (de 15c911f6, Vista
  Engenheiro Command Box, aprovado 13/05). FALTAVA na oficial. 7371 linhas, HTML íntegro, arquivo
  novo (não toca nada). Só esse arquivo do commit foi extraído (não a edição do vista-piloto).

## Estado de publicação
TUDO em desenvolvimento (working tree do branch wip/20260608-143705). NADA enviado pro repositório
oficial / NADA no ar. Conserto do painel web pode disparar deploy se p1t4000.vercel.app estiver
ligado à oficial → envio precisa de "MIGRAR PARA PRODUÇÃO". STATUS.md e Vista Engenheiro são docs,
não afetam produção.

Pendências: (a) Flávio decidir sobre telas novas CockpitOrientationTest/StintRodando; (b) Flávio
autorizar (ou não) o envio pro repositório oficial / colocar painel no ar.

## Avaliação das 2 telas novas (Flávio pediu "testar antes") — VEREDITO: NÃO TRAZER
git grep em origin/main: OrientationLock=0, FlowToken=0, StintCockpitView=0, StintCaptureView=2.
- CockpitOrientationTestView: depende de OrientationLock + FlowToken (ausentes). É ferramenta de
  diagnóstico DEV-ONLY (--p1-cockpit-test) pra testar rotação, não produto.
- StintRodandoView: depende de StintCockpitView (ausente) + OrientationLock (ausente). Alterna
  cockpit-horizontal-no-iPhone vs captura-vertical.
- Ambas pertencem ao COCKPIT DO PILOTO NO IPHONE, caminho DESCONTINUADO por ADR-023 (09/05):
  cockpit-display migrou pro notebook Windows. Trazer = ressuscitar caminho abandonado + puxar
  cadeia ausente. Reprovadas. Preservadas nos worktrees (infallible-snyder), nada apagado.

## DECISÕES DO FLÁVIO (2026-06-08)
- Telas novas: avaliar antes (feito → reprovadas, ver acima).
- Publicação: ESPERAR — tudo fica em desenvolvimento. NADA enviado pro repositório oficial / no ar.

## ESTADO FINAL das 3 frentes (todas em desenvolvimento, nada publicado)
1. Painel cockpit consertado + validado (4 smokes verdes).
2. STATUS.md atualizado (checkpoint 2026-06-08 + correção MS-4/MS-16).
3. Órfão: Vista Engenheiro trazida (1 arquivo novo); telas .swift reprovadas; resto já-na-oficial/lixo.
Quando o Flávio mandar, envio pro repositório oficial (e, com "MIGRAR PARA PRODUÇÃO", coloco painel no ar).

---
---

# Auditoria — Sincronização Estoque + Manutenção (2026-06-08)

## Pedido
Auditar (somente leitura) a sincronização de Estoque+Manutenção pra nuvem Supabase p1-fast: migration 0039, Edge Function sync, estado real da nuvem, fila/backfill do app iOS.

## Ambiente: produção (Supabase p1-fast fvhwltzhytpnhlqbttmd) — SOMENTE LEITURA. Nada escrito.

## Achados (com evidência)
- Migration 0039 existe: cria pecas_locais, pecas, pecas_movimentacoes, manutencoes (+índices, triggers updated_at, RLS is_member).
- Edge Function sync (index.ts:29-47): ALLOWED_TABLES inclui pecas_locais, pecas, pecas_movimentacoes, manutencoes.
- Nuvem (via `supabase db query --linked`, SELECT): pecas=2, pecas_locais=3, pecas_movimentacoes=5, manutencoes=0.
- Schema drift RESOLVIDO: eventos.data_fim = date NULLABLE; evento_pendencias.template_id = text (NOT NULL); quantidade=real, nota=text presentes.
- App: PecaRepository.swift enfileira em cada mutação; ManutencaoConsumiveisView.swift:60 enfileira manutenção; SyncBackfill.run no boot (ContentView.swift:268, Task.detached background); drain por Timer no SyncCoordinator (30s) — depende de foreground; sem BGTaskScheduler.

## Status: concluído

---
---

# TASK (2026-06-09) — Testar RaceBox Mini S no escritório

## Pedido (Flávio)
Acessar e testar o GPS RaceBox Mini S no escritório, pra garantir que funciona antes da pista.

## Achados de contexto
- RaceBox JÁ previsto no projeto: BLOCKERS.md §E4 (upgrade condicional, arquivado 2026-05-01) +
  docs/hardware/RACEBOX_INTEGRATION_SPEC.md (spec completa, arquivada). Fonte 'racebox-gnss' já
  existe nos testes do TimeBase. Decisão: RaceBox volta SÓ se entrar lap timing fino / traçado
  sub-metro / redundância. Hardware (25Hz GNSS, IMU, BLE 5.2) cobre exatamente esse gap do iPhone (1Hz).

## Execução (teste real de hardware no Mac)
- Bluetooth do Mac: ligado. Ferramenta: venv /tmp/racebox-venv + bleak (BLE). Scripts em
  /tmp/racebox-scan.py e /tmp/racebox-read.py.
- Aparelho encontrado: "RaceBox Mini S 2254302917", UUID macOS CC55E494-7523-A468-D2D9-53A83AFE5B61,
  RSSI -51 dBm.
- Protocolo: público (UBX-like, Nordic UART Service notify 6e400003-...; msg class 0xFF id 0x01,
  payload 80 bytes). NÃO precisou de NDA/PDF pra ler.
- RESULTADO: 283 pacotes/12s = 25,1 Hz; checksum 283 OK / 0 ruins; forças G (vert +1.019g = gravidade,
  parado); rotação estável; bateria 65% carregando (Flávio confirmou USB-C plugado).
- GPS: SEM FIX / 0 satélites — esperado dentro do escritório (concreto bloqueia). Resolve ao ar livre.

## Status: CONCLUÍDO o teste de escritório (comunicação + leitura + decodificação provadas).
Pendências reais (não do teste): (a) confirmar fix de GPS ao ar livre/janela; (b) DECISÃO do Flávio:
integrar RaceBox ao P1 Fast e por onde ele entra (iPhone? notebook Windows? Mini PC do spec?);
(c) implementar driver/parser/provider racebox se aprovado (spec já existe). NADA implementado ainda.

## Configuração definitiva RaceBox p/ pista (2026-06-09, com evidência)
Perguntas do Flávio respondidas com pesquisa (manual oficial) + teste empírico:
1) Pode ficar abaixo do teto/laje? NÃO sob metal/concreto — bloqueia 100%. Simulação no pior caso
   (andar de baixo, sob laje, 5m da janela, 90s): 0 satélites o tempo todo. Manual: "Metal and some
   windshields completely block the GPS signal". Lugar certo: painel junto ao para-brisa OU teto externo.
2) USB ou Bluetooth? BLUETOOTH (dados). Cabo USB-C do RaceBox = só CARGA (manual "to charge"; doc =
   "BLE Protocol"; no Mac NÃO enumera como dispositivo de dados, sem porta serial). Simulação provou
   Bluetooth robusto: 25/s, 0 erro, a 5m + parede.
3) USB do computador ocupado com T4000? Sem conflito — RaceBox é Bluetooth, não usa cabo de dados.
   T4000 no cabo USB + RaceBox no Bluetooth simultâneos. USB-C do RaceBox vai num carregador (energia).

CONFIG FINAL: RaceBox com vista do céu (painel/para-brisa ou teto externo) + dados por Bluetooth +
alimentado por carregador + porta USB do computador livre pra T4000.
PENDENTE: validar fix de GPS com vista do céu (não testável sob laje). Decisão de integração ainda aberta.
