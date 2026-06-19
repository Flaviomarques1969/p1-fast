# Ultima tarefa — P1 Fast — AUDITORIA DE BOTÕES DO APP DO CELULAR (iOS) — 19/06/2026

## TASK_INIT — Auditoria de botões do app iOS (19/06/2026)
- **Pedido original (Flávio):** "em p1 fast, no app no celular todos os botões estão funcionando?"
- **Objetivo (1 frase):** auditar todos os botões do app do celular (iOS Swift nativo, `ios/p1fast-ios/Sources`) e dizer, com prova, quais estão ligados a função real e quais são vazios/stub/desabilitados.
- **Critério de conclusão:** inventário de 100% dos botões; classificação por botão (funcional / stub-vazio / desabilitado / inconclusivo); verificação adversarial dos suspeitos (rastrear função chamada); relatório por tela:linha; tentativa de build; declarar limite (análise estática ≠ prova de execução no aparelho).
- **Leitura confirmada (19/06):** ~/.claude/CLAUDE.md; ~/.claude-decisoes/padroes.md (vazio); FLAVIO_EXECUTION_PROTOCOL.md; FLAVIO_DONE_CHECKLIST.md; FLAVIO_ENVIRONMENT_RULES.md; FLAVIO_COMMUNICATION_RULES.md; P1 Fast/CLAUDE.md.
- **Verificação já feita (código real):** app do celular = iOS Swift nativo (ADR-018, iPhone único, sem PWA); fonte em `ios/p1fast-ios/Sources`; 40 telas com controles; 244 ocorrências de `Button`; 95 sinais de TODO/print/placeholder a investigar.
- **Ambiente alvo:** DESENVOLVIMENTO (só leitura/auditoria, nenhuma alteração de código).
- **Produção protegida:** sim. **Produção alterada:** não. **Autorização produção:** não recebida (não necessária, tarefa só leitura).
- **Plano (≤5 passos):** (1) inventário telas/botões [feito]; (2) workflow 1 agente por tela classifica cada botão; (3) verificação adversarial dos suspeitos; (4) tentar `xcodebuild` pra confirmar que compila; (5) relatório por tela:linha + limitações.
- **Riscos:** 1143 arquivos Swift; build pode falhar por assinatura/simulador; análise estática prova "ligado no código", não execução real no iPhone.
- **Status inicial:** iniciado.

---

# Ultima tarefa — P1 Fast — LIGAR A PASSAGEM NO DADO REAL (espelho da Frenagem) — 18/06/2026 noite

## TASK_INIT — Passagem no dado real (18/06/2026)
- **Pedido original (Flavio):** diagnostico "como esta o componente passagem do trecho. que fica acima de frenagem" -> Flavio respondeu "sim." ao proximo passo proposto: ligar a Passagem no dado real, espelhando o que foi feito na Frenagem.
- **Objetivo (1 frase):** o bloco Passagem (entrada/apice/saida) do Command Box vista-piloto passa a exibir dado REAL do Bubi em Brasilia (velocidades + tempo do trecho), espelhando a Frenagem, sem tocar producao.
- **Criterio de conclusao:** velocidades de entrada/apice/saida e tempo total do trecho vindos das passagens reais (fixture passagens-bubi-brasilia.v1.json); mesma arquitetura da Frenagem (modulo adaptador + por curva + hook window.__aplicarPassagemReal + bloco "Etapa 2c"); cai pra demonstracao se a massa nao carregar; barra "apice-distancia" (+-1 m) NAO forjada (1 Hz nao resolve -> fica honesta/pendente); nada removido; backup antes; teste automatico novo passando + npm run smoke sem quebrar; validado no navegador e mostrado ao Flavio.
- **Leitura confirmada (18/06):** ~/.claude/CLAUDE.md; ~/.claude-decisoes/padroes.md; FLAVIO_EXECUTION_PROTOCOL.md; FLAVIO_DONE_CHECKLIST.md; FLAVIO_ENVIRONMENT_RULES.md; FLAVIO_COMMUNICATION_RULES.md; P1 Fast/CLAUDE.md.
- **Verificacao ja feita (codigo real):** bloco Passagem (buildPassagemPanel ~5893, getPassagemDataForCurve ~5878) ainda desenha demonstracao (currentLap().corners) e esta em DEP_LIGACAO ("cb-sem-real", mockup:7698); Frenagem JA real desde 15/06 (frenagem-real.js + frenagem-curvas-reais.js, hook __aplicarFrenagemReal mockup:4509, Etapa 2b mockup:7846); fixture real = lat/lng/kmh/t a ~1 Hz (~9 pontos/curva), 56 passagens, 8 curvas; formato dos numeros: delta das bolinhas em KM/H ('+1'/'−2', sinal unicode −), total embaixo em SEGUNDOS ('−0.04s').
- **Ambiente alvo:** DESENVOLVIMENTO (prototipo/referencia executavel). Produto final do cockpit = app Windows nativo (ADR-023), nao tocado aqui.
- **Producao protegida:** sim. **Producao alterada:** nao. **Autorizacao producao:** nao recebida.
- **Decisao de engenharia (honestidade, espelho da Frenagem):** referencia = melhor volta de cada curva; mostrada = volta tipica (mediana de tempo) vs melhor -> deltas REAIS e nao-zero; velocidades + tempo do trecho REAIS; barra do apice +-1 m fica PENDENTE (1 Hz nao resolve), igual a Frenagem e honesta sobre o GPS 1 Hz.
- **Plano (<=5 passos):** (1) backup + passagem-real.js (adaptador puro); (2) passagem-curvas-reais.js (por curva); (3) editar mockup (global __PASSAGEM_REAL + getPassagemDataForCurve prefere real + hook __aplicarPassagemReal + tirar 'passagem' do DEP_LIGACAO + barra apice honesta + Etapa 2c); (4) teste node-smoke-passagem-real.mjs + cadeia smoke; (5) servir + abrir navegador pro Flavio.
- **Riscos:** editar HTML grande (backup+ediçoes cirurgicas+smoke); 1 Hz nao da +-1 m no apice (tratado com honestidade, nao forjado).
- **Status inicial:** iniciado.

## EXECUÇÃO — PASSAGEM NO DADO REAL (18/06/2026)
Ambiente: DESENVOLVIMENTO. Produção NÃO tocada. Frenagem/Vmin NÃO tocados.
BACKUP: `_design-reference/_backups/mockup-command-box-vista-piloto.BACKUP-passagem-real-2026-06-18.html`.

ARQUIVOS:
- NOVO `web/command-box/passagem-real.js` — adaptador puro (passagem real → entrada/ápice/saída km/h + deltas km/h vs melhor + tempo do trecho s + veredito). Barra ±1 m do ápice = apexOffsetM:null (pendente, honesto; estimativa só em apexOffsetMbruto).
- NOVO `web/command-box/passagem-curvas-reais.js` — por curva: referência = melhor volta (menor tempo); mostrada = volta mediana. Espelha frenagem-curvas-reais.js.
- NOVO `tests/node-smoke-passagem-real.mjs` — 27 checagens (adaptador + por-curva na massa real). Incluído na cadeia `npm run smoke` + script `smoke:passagem-real`.
- EDITADO `_design-reference/mockup-command-box-vista-piloto.html` (5 edições cirúrgicas): global `__PASSAGEM_REAL` + hook `window.__aplicarPassagemReal`; `getPassagemDataForCurve` prefere real; barra do ápice honesta (mostra "—" quando offsetM null); 'passagem' removida do DEP_LIGACAO; bloco "Etapa 2c" no fim do body.
- EDITADO `package.json` (cadeia smoke + script).

VALIDAÇÃO (saída real):
- `node tests/node-smoke-passagem-real.mjs` → 27 ok / 0 fail.
- `npm run smoke` (suíte completa, 68 arquivos) → EXIT 0, nenhuma falha real (fail=0 em todos).
- Sintaxe de TODOS os scripts embutidos do mockup → 3 clássicos + 3 módulos OK / 0 falhas.
- HTTP pela 8078: `/`, passagem-real.js, passagem-curvas-reais.js, fixture → todos 200.
- Tela aberta no navegador (http://localhost:8078/) pro Flávio ver.

LIMITAÇÃO HONESTA: a ~1 Hz, em várias curvas o ponto mais lento medido coincide com a entrada (ápice ≈ entrada) e a barra ±1 m do ápice fica "—". Velocidades e tempo do trecho são reais; o ponto exato do ápice e o ±1 m entram com 25 Hz. Prova final de fluidez só na pista com carro.

TASK_DONE:
- Pedido original conferido: sim ("sim." ao próximo passo: ligar a Passagem no dado real espelhando a Frenagem)
- Ambiente trabalhado: desenvolvimento
- Produção foi alterada: não
- Se produção foi alterada, autorização explícita registrada: n/a
- Arquivos reais inspecionados: sim
- Alterações feitas: sim (2 módulos + 1 teste novos; mockup + package.json editados; backup feito)
- Testes/validação executados: sim (smoke novo 27/27 + suíte completa EXIT 0 + sintaxe + HTTP 200 + navegador)
- Resultado: concluído (em DEV)
- Pendências reais: (1) ±1 m do ápice e ponto exato do ápice = aguardam 25 Hz; (2) prova de fluidez na pista com carro ao vivo; (3) ao vivo, a "mostrada" vira a volta corrente (hoje, em DEV, é a mediana gravada).

---

# Ultima tarefa — P1 Fast — AVANCAR PLANEJAMENTO DO STINT NO CELULAR (18/06/2026 noite)

## TASK_INIT — Planejamento do Stint no celular (18/06/2026)
- **Pedido original (Flavio):** "em p1 fast avancar o Planejamento do Stint no celular (app do iPhone)".
- **Objetivo (1 frase):** dar o proximo passo do recurso "Planejamento do Stint" no app iOS, na direcao que o Flavio escolher (card aberto).
- **Criterio de conclusao:** a direcao escolhida pelo Flavio entregue e validada em DESENVOLVIMENTO (sem tocar producao sem autorizacao literal), com prova real (build/teste/navegador/aparelho conforme o caso).
- **Leitura confirmada (18/06):** ~/.claude/CLAUDE.md; ~/.claude-decisoes/padroes.md; FLAVIO_EXECUTION_PROTOCOL.md; FLAVIO_DONE_CHECKLIST.md; FLAVIO_ENVIRONMENT_RULES.md; FLAVIO_COMMUNICATION_RULES.md; P1 Fast/CLAUDE.md; memoria p1-fast-planejamento-stint-no-celular-2026-06-15 + p1-fast-plano-stint-e-tela-105-2026-06-10 + apps-iphone-expiram-7-dias.
- **Ambiente alvo:** DESENVOLVIMENTO. (Diagnostico do aparelho do Flavio = so leitura.)
- **Producao protegida:** sim. **Producao alterada:** nao. **Autorizacao producao:** nao recebida.
- **Verificacao ja feita (codigo real, 18/06):** (a) planejamento no celular CONSTRUIDO e completo v1 (StintModalView: proposito livre/testar/treinar + catalogo + brief que trava o Aprovar + paradas + ghost + voltas + licao; "Aprovar e iniciar" grava envelope+plano na nuvem e cria Stint solto; provado na nuvem 15/06). (b) Codigo de subida de carros/eventos pra nuvem EXISTE e esta completo (fila->funcao sync->Postgres). (c) Banco do iPhone do Flavio (copia so-leitura): 2 carros (Bolinha, subaru) + 5 eventos, TODOS com synced_at preenchido, sync_queue VAZIA, time c027a716 -> aparelho diz que JA SUBIU. Suspeita de 15/06 ("nuvem 0 carros") NAO confirmada e contradita pelo local. Nuvem nao confirmada de forma autoritativa (RLS bloqueia anon; caminho autenticado em prod barrado sem autorizacao nominal).
- **FALTA (fronts possiveis):** (1) reinstalar app (vence ~22/06) + validar ciclo ao vivo; (2) painel reagir ao plano (WEB, nao celular); (3) vida util do item no planejamento (falta fonte de km).
- **Plano (<=5 passos):** (1) [feito] verificar estado real; (2) [feito] diagnosticar garagem no aparelho; (3) card de direcao aberto -> AGUARDANDO Flavio; (4) executar a direcao escolhida em DEV; (5) validar com prova e reportar.
- **Riscos:** mexer em producao sem autorizacao; perda de dados da garagem (baixa, local diz sincronizado); app vencer e sumir do celular esta semana.
- **Status inicial:** iniciado — AGUARDANDO decisao do card (.claude-perguntas/pendentes/20260618-204009-avancar-planejamento-stint.html).

## DECISAO DO CARD (18/06): "Reinstalar e validar o ciclo ao vivo" (recomendada). Registrada em ~/.claude-decisoes/respostas/P1 Fast/ + index.jsonl.
EXECUCAO 1 — REINSTALAR: app empacotado (xcodebuild p1fast-ios, BUILD SUCCEEDED) + instalado + aberto no iPhone do Flavio (devicectl, UDID 00008140-000E2D611E6A801C). Renova +7 dias (~25/06). Aviso "No provider was found" inofensivo. Passos de validacao passados ao Flavio.

## AJUSTE PEDIDO PELO FLAVIO (18/06, durante a validacao): tirar o campo "Objetivo" (Aquecimento/Ataque/Consistencia/Teste/Livre) da tela de iniciar Stint — competia com "Proposito do Stint" (Rodar livre/Testar o carro/Treinar habilidade). Evoluimos so pro Proposito.
VERIFICACAO (codigo real): campo "objetivo" da Sessao so e usado pra EXIBIR titulo do stint em EventoDetalheView.swift:632 e PosStintView.swift:104 (objetivoDecomposto). O PAINEL (web/cockpit) e funcoes da nuvem NAO leem "objetivo" (grep 0) — leem o plano (proposito/foco). Caminhos de demo (ContentView PosStintLauncher, TelemetriaView) usam valor fixo, separados do modal.
ALTERACAO (so StintModalView.swift, DEV; backup em .claude-exec/backup-remover-objetivo-stint-2026-06-18/):
- removida a secao "Objetivo" da tela (sectionObjetivo) + o seletor antigo (struct ObjetivoPicker) + o estado objetivoTipo + o guard de canSave que o exigia.
- novo computed `objetivoDerivado` (livre->"Rodar livre", testar->"Testar o carro", treinar->"Treinar habilidade"); o salvar() agora grava esse valor como titulo do stint. Assim os titulos nas duas telas seguem fazendo sentido.
- NADA de dado apagado: stints antigos mantem o titulo que ja tinham; sem migracao; painel intacto.
- Consequencia (avisar Flavio): as categorias Aquecimento/Ataque/Consistencia somem como opcao (era o objetivo); o titulo passa a ser o proposito.
Status: empacotando a versao com o ajuste pra reinstalar e validar.

---

# Ultima tarefa — P1 Fast — ITEM 3: fundir o ao vivo no Command Box (18/06/2026)

## TASK_INIT — ITEM 3 (18/06/2026)
- **Pedido original (Flavio):** "faca" — seguir minha recomendacao: em DEV, plugar o que ja esta pronto (bolinha por GPS real, recalibrada+suavizada) direto no mockup do Command Box, pra ele VER a bolinha real andando na tela. Depois mover a conta pra nuvem.
- **Objetivo (1 frase):** fazer o mockup do Command Box mover a tela pela FRACAO DE ARCO derivada do GPS real (item 1+2 ja prontos), no lugar do relogio ficticio (liveT), com fallback pro relogio quando nao ha GPS, e um modo DEV de replay da volta real gravada (23/05) pra ver agora sem carro na pista.
- **Criterio de conclusao:** com `?replay=23-05`, a bolinha (e a tela, em sincronia) anda pela volta REAL gravada, projetada+suavizada, validado no navegador pela 8078, arranjo do Flavio intacto, demonstracao padrao intacta sem o parametro. Nada em producao.
- **Leitura confirmada (18/06):** ~/.claude/CLAUDE.md; ~/.claude-decisoes/padroes.md; FLAVIO_EXECUTION_PROTOCOL.md; FLAVIO_DONE_CHECKLIST.md; FLAVIO_ENVIRONMENT_RULES.md; FLAVIO_COMMUNICATION_RULES.md; P1 Fast/CLAUDE.md; memoria do Command Box (arquitetura definitiva 16/06, conceito producao 16/06, frenagem redesenho 15/06, servir-pela-8078).
- **Ambiente alvo:** DESENVOLVIMENTO (mockup/prototipo). Producao do Command Box (TV via Fire TV Stick) NAO e este arquivo.
- **Producao protegida:** sim. **Producao alterada:** nao. **Autorizacao producao:** nao recebida (nao necessaria — e dev).
- **Plano (<=5 passos):** (1) backup do mockup; (2) gerar fixture da volta real (dado real, aditivo); (3) modulo de posicao ao vivo (reusa geoParaCommandBox + suavizador, ponto->fracao de arco) expondo window.__cbPos; (4) ligar: onGps alimenta __cbPos, tick usa a fracao real como liveT quando fresca (senao relogio), selo "ao vivo/replay" + modo DEV replay; (5) validar na 8078 + navegador e mostrar.
- **Arquivos a tocar:** `_design-reference/mockup-command-box-vista-piloto.html` (tick ~6985; onGps 7757; checador 1s 7735; novo <script type=module> antes do </body>). Reuso (NAO duplicar): `web/cockpit/pista-brasilia-commandbox.js`, `web/cockpit/suavizador-bolinha.js`, `web/cockpit/pista-oficial-brasilia.js`. Novo fixture: `web/command-box/fixtures/volta-real-gps-23-05.json`.
- **REGRA DURA:** NAO tocar no Vmin (fr-*/_shortRevealStateForLap); BACKUP antes; arranjo do Flavio (ATUAL.json) intocado; servir SO pela 8078; comportamento padrao (sem ?replay) identico; dado da producao tem que ser real ao vivo (replay e DEV, rotulado).
- **Decisao de arquitetura assumida (recomendacao aceita por "faca"):** projetar GPS no proprio Command Box agora e DEV stand-in; a conta vai pra nuvem depois (mudanca interna, nao muda o que a tela mostra). Rotular honestamente.
- **Status inicial:** iniciado.

## EXECUÇÃO — ITEM 3 (18/06/2026)
Ambiente: DESENVOLVIMENTO. Produção NÃO tocada. Arranjo do Flávio (ATUAL.json) intocado. Vmin NÃO tocado.
BACKUP: `_design-reference/_backups/mockup-command-box-vista-piloto.BACKUP-item3-aovivo-2026-06-18.html`.

O QUE FOI FEITO:
- Novo fixture (dado REAL, aditivo): `web/command-box/fixtures/volta-real-gps-23-05.json` — 1013 pontos de GPS real da volta 23/05 (gerado do backup gps-23-05.tsv; rótulo "DEV, não é ao vivo").
- Novo `<script type="module">` no mockup (antes do </body>): reusa `geoParaCommandBox` (recalibração, item 1) + `criarSuavizador` (item 2); amostra o MESMO traço #track e converte ponto→fração de arco (mesma conta do recalibrador, sFracOf); expõe `window.__cbPos` (pushGps/fracAt). Modo DEV `?replay=23-05` (&speed, padrão 6×) toca a volta real, 1 amostra por vez como o ao vivo, em loop.
- `onGps` (canal cockpit-bubi-live) passou a alimentar `window.__cbPos.pushGps` com o GPS real.
- `tick()`: quando há posição real fresca, `liveT` (que move a TELA inteira, em sincronia) passa a vir da FRAÇÃO DE ARCO real, não do relógio; sem GPS, mantém o relógio (demonstração padrão idêntica). Selo vira "AO VIVO · GPS real" (ou "DEV · VOLTA GRAVADA 23/05" no replay).
- Checador de 1s não derruba o selo enquanto a posição real conduz.

VALIDAÇÃO EXECUTADA (saída real):
- `tests/node-smoke-suavizador-bolinha.mjs` → 10 passaram, 0 falharam.
- `npm run smoke:freio-trecho` → 29 ok / 0 fail.
- Pipeline reusado na volta REAL → projeção: 1013/1013 pontos dentro do quadro (x[133,692] y[128,725] no viewBox 130 110 580 660); suavização desliza (meio=0.150); perda de sinal marca perdido=true.
- Sintaxe de TODOS os scripts do mockup: 3 clássicos OK + 2 módulos OK + 0 falhas.
- Servido pela 8078: mockup + 3 módulos reusados + fixture todos HTTP 200.
- Aberto no navegador pela 8078 com `?replay=23-05` pro Flávio ver a bolinha/tela andando pela volta real.

TASK_DONE:
- Pedido original conferido: sim ("faça" = recomendação aceita: plugar em DEV o pronto, ver a bolinha real andando)
- Ambiente trabalhado: desenvolvimento
- Produção foi alterada: não
- Se produção foi alterada, autorização explícita registrada: n/a
- Arquivos reais inspecionados: sim
- Alterações feitas: sim (1 mockup editado + 1 fixture novo; backup feito)
- Testes/validação executados: sim (smokes + pipeline + sintaxe + HTTP 200 + navegador)
- Resultado: concluído (em DEV)
- Pendências reais: (1) prova final em pista com carro ao vivo (fluidez/latência só na pista); (2) mover a projeção pra nuvem (canônico) — mudança interna, não muda a tela; (3) replay padrão 6× cobre a gravação inteira (~17 min reais, várias voltas), não recortei uma volta única.

## EXECUÇÃO — ITEM 3b: PROJEÇÃO NA NUVEM (18/06/2026) — autorizado por Flávio ("2. sim" + card "a nuvem centraliza os cálculos pras telas")
Ambiente: DESENVOLVIMENTO. Decisão registrada em ~/.claude-decisoes/respostas/P1 Fast/ + index.jsonl. Card aposentado (preservado em .claude-perguntas/respondidas/).

ERRO DE PRODUÇÃO (reportado, não escondido): ao testar, apontei o emissor de replay E o processador pro canal `cockpit-bubi-live`, que é PRODUÇÃO. O processador foi BLOQUEADO pelo classificador (não publicou). O emissor publicou ~250 pontos de GPS gravado por alguns segundos antes de eu matar. Broadcast é EFÊMERO (nada persistido); sem carro na pista, sem dependente crítico. Correção aplicada (abaixo) + memória nova [[feedback-cockpit-bubi-live-e-producao-nao-publicar-dev]].

O QUE FOI FEITO (tudo em dev, à prova de produção):
- `web/command-box/pista-cb-polyline.js` (GERADO por `tools/gerar-polilinha-cb.mjs`) — geometria da pista do CB (2241 pontos) + `fracDe(x,y)` (ponto→fração de arco), pra a nuvem (node, sem navegador) calcular sem SVG. Reusa o mesmo leitor de traço do recalibrador.
- `tools/nuvem-posicao.mjs` — PROCESSADOR DA NUVEM: `calcularPosicao(gps)` PURO (lat/lng→{frac,x,y}); modo rede só com CANAL definido; RECUSA `cockpit-bubi-live` sem PERMITIR_PROD_CANAL=1; não conecta no import.
- `tools/nuvem-replay-gps.mjs` — DEV: toca a volta gravada como GPS cru num canal de DEV; mesma trava de produção; `carregarVolta()` puro.
- `tests/node-smoke-nuvem-posicao.mjs` — prova OFFLINE (sem rede): 7/7.
- Command Box (mockup): passou a ASSINAR o evento `posicao` (posição pronta da nuvem) e exibir; a projeção no navegador virou FALLBACK de dev (só se a nuvem não entregar); selo mostra a fonte (nuvem / volta gravada / local provisório).

VALIDAÇÃO (saída real):
- Prova offline da nuvem: 7/7 (1013 leituras viram posição; todas dentro do quadro; cobre frac 0..1; rejeita ruído fora de Brasília).
- Trava de produção: sem CANAL → sai seguro; CANAL=cockpit-bubi-live → RECUSADO (exit 2) ANTES de conectar (processador e emissor).
- Sintaxe: tela 5/5 scripts OK; peças da nuvem `node --check` OK.
- Polilinha+fracDe casam com a projeção da volta real (cobre 0.000→0.999).

TASK_DONE (item 3b):
- Pedido conferido: sim (nuvem centraliza o cálculo; telas só exibem)
- Ambiente: desenvolvimento | Produção alterada: SIM, sem querer (canal prod, ~250 broadcasts efêmeros, nada persistido) — corrigido e travado
- Autorização produção: não recebida (e o erro foi revertido/travado, não repetir)
- Arquivos inspecionados: sim | Alterações: sim (1 gerado + 2 tools + 1 teste + mockup) | Testes: sim
- Resultado: concluído em DEV (cálculo da nuvem pronto e provado offline; tela liga nele)
- Pendências reais: demo AO VIVO da cadeia (replay→nuvem→tela) precisa publicar num canal — fazer em canal de DEV isolado e/ou com autorização; NÃO no canal de produção. Onde a peça da nuvem roda em produção = decisão do Flávio, depois.

DEMO AO VIVO EXECUTADA (18/06, autorizado "sim" — canal de teste): rodada no canal DEV `cb-dev-flavio` (NÃO produção). Mockup ganhou `?canal=` (padrão = produção). Cadeia confirmada nos logs: emissor publicou GPS cru → processador da nuvem devolveu `posicao` (frac avançando e virando a volta 0,99→0,01→0,05) → Command Box aberto com `?canal=cb-dev-flavio` exibindo a posição da nuvem (selo "AO VIVO · posição da nuvem"). Processos rodando em segundo plano até o Flávio dizer "pode parar". Produção intocada nesta etapa.

---

## (HISTORICO ANTERIOR — CAMINHO 1: itens 1 e 2, 16/06/2026)

## TASK_INIT
- **Pedido original (Flavio):** "siga" — seguir o caminho 1 ja escolhido: ligar a frenada/dados ao vivo no Command Box, reusando o motor que ja existe, em desenvolvimento.
- **Objetivo (1 frase):** fazer o Command Box (mockup vista-piloto) consumir o fluxo ao vivo (canal cockpit-bubi-live) e mostrar dado REAL continuo, ponto a ponto — comecando pela bolinha do carro por GPS real e pelo bloco de frenada saindo de "aguardando ligacao".
- **Criterio de conclusao:** a bolinha anda por GPS real (nao mais por relogio) e/ou a frenada acende do fluxo ao vivo, validado no navegador pela 8078, com o arranjo do Flavio intacto. Nada em producao.
- **Leitura confirmada:** ~/.claude/CLAUDE.md; padroes.md; FLAVIO_EXECUTION_PROTOCOL.md; FLAVIO_DONE_CHECKLIST.md; FLAVIO_ENVIRONMENT_RULES.md; FLAVIO_COMMUNICATION_RULES.md; arquitetura definitiva (docs/ARQUITETURA_DEFINITIVA.md + memoria); auditoria da bolinha (este arquivo, versao anterior).
- **Ambiente alvo:** DESENVOLVIMENTO (mockup/prototipo). Producao do Command Box (TV via Fire TV Stick) NAO e este arquivo.
- **Producao protegida:** sim. **Producao alterada:** nao. **Autorizacao producao:** nao recebida (nao necessaria — e dev).
- **Plano (<=5 passos):** (1) mapear e desenhar a ligacao minima e segura (workflow); (2) backup do mockup antes; (3) implementar a ligacao ao vivo (GPS->bolinha continua; depois frenada ao vivo); (4) validar na 8078 + navegador; (5) mostrar ao Flavio.
- **Arquivos a inspecionar/tocar:** `_design-reference/mockup-command-box-vista-piloto.html` (live: setupLigacaoAoVivo ~7612, REAL.lat/lng ~7756, bolinha ~6979/6988, frenada DEP_LIGACAO ~7677); `web/cockpit/pista-oficial-brasilia.js` (projecao GPS->tela); `web/command-box/frenagem-real.js` + `web/cockpit/freio-trecho.js` (motor).
- **REGRA DURA:** NAO tocar no Vmin (compartilha fr-*/_shortRevealStateForLap); classes proprias; BACKUP antes de tocar no mockup; arranjo do Flavio (ATUAL.json) intocado; servir SO pela 8078; dado tem que ser CONTINUO ponto a ponto (nao em lote).
- **Achado base (auditoria anterior, prova):** a bolinha "live" anda por RELOGIO (mockup:6979/6988), GPS real CHEGA mas e IGNORADO (:7756-7757 so escrevem), frenada em DEP_LIGACAO (:7677), pista-oficial-brasilia.js NAO e carregado no mockup.
- **Status inicial:** iniciado — fase de mapeamento/desenho.

## RESULTADO DA AUDITORIA (workflow 6 agentes, 16/06) — meu plano FOI REFUTADO
Veredito dos 2 céticos (confiança alta): "bolinha fiel com esforço médio" é FALSO. Esforço real = ALTO. Provas:
1. **Projeção GPS→tela não existe nesta tela e a que existe não serve.** SVG do Command Box = viewBox "130 110 580 660" (espaço 580×660, traço hardcoded mockup:3502/3533). Única função GPS→pixel do projeto = `geoParaDesenho` em pista-oficial-brasilia.js, espaço 823×799 (linhas 9-10/22-26), calibrada pra OUTRO desenho e NEM carregada no mockup (grep zero). Reuso direto joga a bolinha pra longe → precisa re-calibrar do zero pro Command Box.
2. **GPS de hoje é ~1 Hz (grosseiro).** A ~100 km/h = ~28 m por amostra → bolinha aos saltos, não fiel. Sem suavização por GPS no mockup. O 25 Hz (RaceBox) que resolveria está SPEC ARQUIVADA/condicional (docs/hardware/RACEBOX_INTEGRATION_SPEC.md:3) — futuro, não realidade.
3. **liveT (relógio fictício) move ~12 funções**, não só a bolinha (mockup:6976-7011: reveal, trajetória colorida, lap-wrap, passagem, frenagem, vmin, delta-acum). Mover só a bolinha dessincroniza a tela. Honesto = trocar a FONTE do liveT (relógio→fração-de-arco do GPS) = redesenho.
4. **DECISÃO DE ARQUITETURA (do Flávio):** ARQUITETURA_DEFINITIVA.md:49/77 "Command Box não calcula nada, só apresenta o que o .exe gera". Projetar GPS = cálculo. Quem projeta — notebook (manda posição pronta, fiel à regra) ou Command Box (rápido de mostrar, viola a regra)? Canal hoje só manda lat/lng cru (cloud-bridge.js:81-87), sem progresso pronto.
Limitação honesta: 1 das 4 frentes (fonte-gps) não devolveu estruturado; coberta pelo cético de dados. Fluidez/sincronismo/latência só se provam com carro na pista.
Status: auditoria concluída — aguardando decisão do Flávio sobre quem projeta o GPS antes de construir.

## EXECUÇÃO — ITEM 1 (recalibração) + ITEM 2 (suavização), 16/06 (autorizado: "faça primeiro a recalibração e depois siga para o item 2")
Ambiente: DESENVOLVIMENTO. Produção NÃO tocada. Mockup do Command Box NÃO tocado (diff contra backup = idêntico).
BACKUP: `_design-reference/_backups/mockup-command-box-vista-piloto.BACKUP-recalibracao-2026-06-16.html`.

ITEM 1 — RECALIBRAÇÃO (feita e provada):
- `tools/recalibrar-mapa-command-box.mjs` — acha a transformação de semelhança (escala+rotação+posição+espelho) desenho-oficial(823×799) → traço do Command Box (viewBox 130 110 580 660), testando todas as rotações/direções/espelho. Reusa a amarração provada GPS→desenho-oficial (pista-oficial-brasilia.js).
- Saída: `web/cockpit/pista-brasilia-commandbox.js` (função `geoParaCommandBox(lat,lng)`).
- VALIDADO com volta REAL do Bubi (gps-23-05.tsv, 1013 leituras, independente do ajuste): mediana 7,3 px (0,33 largura de pista), p95 22,9 px (~1 largura), máx 53,8 px (~2,4 larguras, 1-2 curvas onde o desenho estilizado abre). Sobreposição de caixas 100%, centros a 15 px.

ITEM 2 — SUAVIZAÇÃO (feita, testada, demonstrada):
- Verificado: GPS real é ~1 leitura/seg (mediana 1000 ms; buraco máx 9,2 s) → ~28 m/leitura a 100 km/h. Suavização necessária confirmada.
- `web/cockpit/suavizador-bolinha.js` — desliza pela FRAÇÃO DE ARCO do traço (sempre na pista), trata virada de volta e NÃO inventa trajeto em perda de sinal (marca perdido).
- `tests/node-smoke-suavizador-bolinha.mjs` — 10/10 verdes.

PROVA VISUAL (aberta no navegador): `relatorios/prova-bolinha-command-box.html` — pista do CB + volta real por cima + 2 bolinhas (crua pulando 1/seg vs suavizada deslizando 60 q/s), trecho limpo de ~95 s tocado em 14 s.

PENDENTE (NÃO feito de propósito — é item 3 + decisão do Flávio): ligar de verdade no mockup (trocar o relógio fictício liveT pela fração derivada do GPS ao vivo) e DECISÃO A vs B (quem projeta: notebook ou Command Box).

TASK_DONE:
- Pedido conferido: sim (item 1 depois item 2)
- Ambiente: desenvolvimento | Produção alterada: não | Mockup alterado: não
- Arquivos inspecionados/criados: sim (6 novos; mockup preservado, backup feito)
- Validação executada: sim (volta real projetada + 10 testes do suavizador + prova visual no navegador)
- Resultado: concluído (itens 1 e 2). Item 3 (ligar ao vivo no mockup) aguarda decisão A vs B.
- Pendências reais: decisão A vs B (quem projeta o GPS) antes de fundir no mockup ao vivo.
