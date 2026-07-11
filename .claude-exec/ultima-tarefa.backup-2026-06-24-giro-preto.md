# Última tarefa — Alerta de temperatura ligado (frente 2, item 3 / Onda 5) — 24/06/2026

## Pedido original de Flávio
"pode seguir" (continuar a frente 2). Item 2 (lições/atraso por trecho) é decisão dele,
então segui no item que faço sozinho: o alerta de temperatura.

## O que foi feito
- Liguei a Onda 5 (alerta preditivo de temperatura) no painel do cérebro
  (`web/command-box/cerebro/cerebro-painel.js`), que antes saía sempre nulo ("pendente").
- A conta já existia (`cerebro-preditivo.js`); só faltava plugar. Agora o painel acumula o
  pico de temperatura (`waterTempC`) por volta e projeta em quantas voltas estoura o limite.
- Limite crítico default = 80°C (Bubi, decisão Flávio 27/05; a nuvem passa o do carro real).
- Honesto: sem dado de temperatura, continua nulo (não inventa). 'preditivo' saiu de "pendentes".
- Teste estendido (`cerebro-painel.smoke.mjs`): cenário com água subindo 50→70°C dispara
  "crítico em ~2 voltas / +15°C"; e cenário sem temperatura = nulo.

## Critério de conclusão: ATENDIDO
- Onda 5 ligada e provada no teste do painel (verde).
- Bateria teste-por-teste: 74 verde / 1 vermelho (schema-parity = dívida antiga, pré-existente).
- Smokes do cérebro (painel/extras/coach): verde.

## Ambiente: desenvolvimento. Produção NÃO tocada. iPhone não tocado.
## Status: concluído. Frente 2 restante: lições/atraso por trecho (DECISÃO do Flávio),
## o iPhone, e por fim ligar o cérebro numa tela de verdade.

---

# Última tarefa — Velocidade numa casa só (frente 2, item 1) — 24/06/2026

## Pedido original de Flávio
Pós-retomada, escolha clicável: "velocidade numa casa só".

## Objetivo (1 frase)
Juntar a conta de velocidade num lugar único, igual ao que foi feito com o GPS (geo.js).

## O que foi feito
- Criada a casa neutra `src/domain/velocidade.js`: `FATOR_KMH` (3,6), `msParaKmh`, `kmhParaMs`
  e `velocidadesDaVolta` (velocidade do GPS, movida do cérebro). Aritmética pura — mesmos números.
- `web/cockpit/velocidade.js` reexporta da casa; `cerebro-velocidade.js` virou reexportação
  (preserva `velocidadesDaVolta`/`distanciaM`/default).
- 10 arquivos que faziam a conta solta (fator 3,6) passaram a usar a casa: delta-calculator,
  live-data-bridge, freio-trecho, shift-light-bridge, trail-cockpit-motor (4x), trecho-detector,
  mobile-telemetry, classificador-trecho, snapshot, cross-validation.
- Trava de arquitetura estendida (regra 7): reprova `* 3.6`/`/ 3.6` fora da casa. iPhone (espelhos
  em JS) entra no VEL_BASELINE (migra na sincronia do app, só encolhe).
- Contrato atualizado: `docs/CONTRATO_DADOS.md` (linha da Velocidade + item 7 da trava).

## Critério de conclusão: ATENDIDO
- Casa existe e exporta a conta: sim. Cockpit e cérebro reexportam: sim.
- Trava: 29 ok / 0 fail (nenhum arquivo pego com conta solta — todos ligados).
- Bateria teste-por-teste: 74 verde / 1 vermelho (schema-parity = dívida antiga do banco,
  pré-existente, idêntico a antes). Shift light: verde.

## Ambiente: desenvolvimento (versão oficial local). Produção NÃO tocada (sem envio ao
## repositório oficial, sem canal cockpit-bubi-live, sem colocar no ar). iPhone não tocado.

## Status: concluído. Frente 2 restante: lições/atraso por trecho (decisão do Flávio),
## alerta de temperatura, iPhone, ligar o cérebro numa tela de verdade.

---

> ↪ SESSÃO 23/06 (noite, central de cálculos): "continue em p1 fast" → escolha do Flávio no card
> = "Incorporar o cérebro-maestro na oficial". Registro desta tarefa logo abaixo. O resto preservado.

# Última tarefa — Incorporar o cérebro-maestro (8 arquivos) na versão oficial — 23/06/2026

## Pedido original de Flávio
"continue em p1 fast" + escolha clicável: "Incorporar o cérebro-maestro na oficial".

## Objetivo (1 frase)
Trazer pra versão oficial o trabalho já pronto/testado do ambiente isolado `cerebro-maestro`
(casa neutra `src/domain/geo.js` + cérebro e detectores consumindo ela), de forma cirúrgica.

## Critérios objetivos de conclusão
- Os 8 arquivos do cérebro/geo passam a existir/atualizados na oficial (HEAD).
- O trabalho do iPhone na oficial NÃO é tocado (não regredir).
- `src/domain/geo.js` existe na oficial; `web/cockpit/geo.js` reexporta dela; trava com GEO_HOME.
- Bateria de testes + trava de arquitetura rodadas e resultado reportado (esperado 80/81, schema-parity pré-existente).

## Leitura dos arquivos obrigatórios
- ~/.claude/CLAUDE.md: sim · ~/.claude-decisoes/padroes.md: sim
- FLAVIO_EXECUTION_PROTOCOL / DONE_CHECKLIST / ENVIRONMENT_RULES / COMMUNICATION_RULES: confirmados (existem)
- .claude-exec/CONTINUAR-central-calculos.md: sim · P1 Fast/CLAUDE.md: sim

## Plano (<=5 passos)
1. (feito) Confirmar autoria real do isolado = 8 arquivos geo/cérebro; iPhone é avanço da oficial.
2. Trazer cirúrgico só os 8: `git checkout cerebro-maestro -- <8 arquivos>`. iPhone intocado.
3. Rodar trava de arquitetura (`npm run smoke:arquitetura`) + bateria de testes.
4. Conferir geo.js neutro existe, web/cockpit/geo.js reexporta, trava verde.
5. Reportar TASK_DONE. Worktrees preservados como rollback. Sem push remoto (não pedido).

## Arquivos a inspecionar / trazer
src/domain/geo.js, src/domain/trajectory-monitor.js, src/telemetry/projector.js,
tests/node-smoke-arquitetura-dado.mjs, web/cockpit/chegada-detector.js, web/cockpit/geo.js,
web/command-box/cerebro/cerebro-velocidade.js, web/command-box/cerebro/chegada-gps.js

## Ambiente alvo: desenvolvimento (versão oficial do projeto, NÃO produção)
## Produção protegida: sim
## Autorização para produção: não (não é produção — main local; remoto não recebe push; canal cockpit-bubi-live não é tocado)
## Evidência da autorização: incorporar na OFICIAL autorizado pela escolha clicável do Flávio. Produção (deploy/push/canal) NÃO incluída.

## Riscos
- NÃO trazer os 8 arquivos do iPhone do isolado (são versão antiga lá) — seria regressão. Por isso cirúrgico.
- Auto-save vai registrar a mudança na linha wip/ (fluxo normal, mesmo da incorporação da distância).
- Worktrees `cerebro-maestro` e `central-distancia` ficam preservados como rollback.

## Status inicial: iniciado

## TASK_DONE (concluído 23/06 noite)
- Pedido original conferido: sim (incorporar o cérebro-maestro na oficial)
- Ambiente trabalhado: desenvolvimento (versão oficial local, NÃO produção)
- Produção foi alterada: não (sem push remoto; canal cockpit-bubi-live intocado)
- Arquivos reais inspecionados: sim (merge-base, diff, grep, leitura)
- Alterações feitas: sim (8 arquivos do cérebro/geo trazidos cirúrgico; iPhone intocado)
- Testes/validação executados: sim (trava 28/0; bateria 74 verde / 1 vermelho isolado)
- Resultado: concluído. 1 vermelho = schema-parity, dívida antiga do banco, PROVADO pré-existente e sem relação
- Pendências reais: nenhuma desta tarefa. Frente 2 segue (velocidade/lições/temperatura/iPhone) quando o Flávio quiser.

---

> ↪ SESSÃO MAIS RECENTE (23/06 noite): "RETOMAR DIA DE PISTA" → ver
> `.claude-exec/tarefa-retomar-dia-de-pista-2026-06-23-noite.md` (bateria 262/262 verde +
> GUIA-BANCADA-DIA-DE-PISTA.md criado). O registro abaixo ("tela que se transforma") é anterior,
> preservado.

# Última tarefa — Tela que se transforma: STATUS (parado) ⟷ COCKPIT do piloto (andando) — 23/06/2026

## Pedido original de Flávio
Resposta dele à pergunta "monto o checar antes de rodar?":
"Na tela de mostrar os status, se o carro não está andando, mostra a tela com todos os status,
como é que eles estão, o que está funcionando, pode colocar até o dado debaixo do ícone, o título
dele em cima, na tela toda a gente pode usar para... se o carro estiver andando, aí mostra a tela
que é a réplica, a cópia do que o piloto está vendo."

## Objetivo (1 frase)
UMA tela que, com o carro PARADO, mostra todos os status dos aparelhos em tela cheia (ícone, título em
cima, dado embaixo, cor por estado) e, quando o carro ANDA, vira a réplica do painel do piloto.

## Critérios objetivos de conclusão
- Parado: grade de status em tela cheia, com os MESMOS aparelhos do painel aprovado (Motor/Movimento/Chassi),
  título em cima, dado/estado embaixo, cor verde(comunicando)/vermelho(sem sinal)/amarelo(falha)/cinza(a instalar).
- Destaque do que decide a gravação: GPS e MOTOR chegando (sim/não).
- Andando: a tela vira o painel do piloto APROVADO (cockpit-volta-real.html), sem alterá-lo.
- A troca parado⟷andando acontece sozinha pela velocidade (histerese, sem botão).
- Provado no navegador com a volta real (replay): para→status, anda→cockpit.

## Leitura dos arquivos obrigatórios
- ~/.claude/CLAUDE.md: sim · ~/.claude-decisoes/padroes.md: sim
- ~/.claude/FLAVIO_EXECUTION_PROTOCOL.md / DONE_CHECKLIST / ENVIRONMENT_RULES / COMMUNICATION_RULES: existem (confirmados)
- docs/COCKPIT_FONTE_DA_VERDADE.md: sim · P1 Fast/CLAUDE.md: sim
- memórias: cockpit-metodo-web-primeiro, captura-automatica-movimento, app-tela-cockpit-piloto, cockpit-bubi-live-nao-publicar: sim

## Plano (<=5 passos)
1. (feito) Ler o painel aprovado e mapear os 14 sensores + de onde vem a velocidade.
2. Criar web/cockpit/checar-antes-de-rodar.html: embute o painel aprovado (iframe, intocado) + overlay de status.
3. Overlay lê o estado REAL dos sensores e a velocidade do painel (mesma origem) — sem duplicar lógica.
4. Troca por velocidade com histerese (anda>=15, para<=6 por 12s) — mesma régua da captura automática.
5. Servir na raiz do projeto + abrir no navegador pro Flávio ver a transição. Sim/não.

## Arquivos/áreas a inspecionar
- web/cockpit/cockpit-volta-real.html (painel APROVADO — só leitura, NÃO alterar)
- web/cockpit/cockpit-state.js / cockpit-renderer.js / live-data-bridge.js (peças do painel)

## Ambiente alvo: desenvolvimento
## Produção protegida: sim
## Autorização para produção: não
## Evidência da autorização: não recebida (é web/dev; nada publicado no canal cockpit-bubi-live)

## Riscos
- NÃO tocar no painel aprovado (cockpit-volta-real.html) — usar por embute (iframe). Regra dura.
- Não publicar nada no canal de produção cockpit-bubi-live. É tela local de demonstração.
- Limiares de velocidade (anda/para) são defaults — calibrar na pista.
- Sensores de chassi são "a instalar": marcar cinza/"A instalar", NUNCA vermelho de falha (sem alarme falso).

## Status inicial: iniciado

---

## EXECUÇÃO 23/06 (tarde) — DADO REAL na tela do cockpit do app (andando = cockpit ao vivo)
Foco redefinido pelo Flávio: a tela que abre ao girar o celular tem que ser tela de app DE VERDADE,
com CONEXÃO REAL e DADO REAL (não o replay = "imagem simulada"). Primeiro o caso ANDANDO=cockpit.

FEITO:
- Achada a raiz: a tela no app (`Resources/Cockpit/cockpit-app.html`) era REPLAY 100% local (volta 24/05) = a "imagem simulada".
- Preservado o replay como backup: `Resources/Cockpit/cockpit-app-replay.html` (não apaguei nada).
- Trocado o MOTOR DE DADOS no `cockpit-app.html`: saiu o replay, entrou a ESCUTA do canal real `cockpit-bubi-live`
  (via `cloud-bridge.js` onSample/onGpsPoint/startCloudBridge). SÓ ESCUTA — nunca publishSample/publishEvento
  (regra dura: não publicar no canal de produção). Reusa as funções reais que já existiam (aplicarGps/aplicarMotor/
  aplicarMotorStatus); mapeia lng→lon e os campos do stripSample. Sem carro = overlay "AGUARDANDO O CARRO" (nunca número
  inventado). Import dinâmico da ponte: se faltar internet, o painel ainda aparece.
- Empacotadas no bundle (pasta Cockpit = folder reference, entra tudo): cloud-bridge.js, supabase-config.js,
  t3000-usb-parser.js. supabase-js carrega do endereço oficial (esm.sh) em runtime (não veio bundle autossuficiente).
- PROVADA a conexão real (Node + supabase-js, só ouvir): assinou cockpit-bubi-live = SUBSCRIBED/online; 0 amostras em 6s
  (= sem carro transmitindo agora, esperado). A chave anon funciona, o canal é alcançável.
- BUILD do app: SUCEEDED. 1ª instalação no iPhone 16 (2D6E7A3B) OK; 2ª instalação FALHOU = aparelho ficou "unavailable"
  (tela apagou/bloqueou).

PENDENTE:
- App pronto em /tmp/p1fast-dd/Build/Products/Debug-iphoneos/p1fast-ios.app — instalar quando o iPhone 16 voltar ao alcance
  (Flávio desbloquear/manter aceso). Comando: xcrun devicectl device install app --device 2D6E7A3B-1449-5BE6-8D82-18F969ED0CCB <app>
- Flávio TESTAR no aparelho: girar → tela do cockpit como app (sem zoom), mostrando "CONECTADO — AGUARDANDO O CARRO" (sem carro).
- Prova com NÚMEROS reais correndo = só com carro na pista transmitindo.
- DEPOIS: caso PARADO = status (outra sessão) — fundir na mesma tela.

## CONSERTO DE APRESENTAÇÃO 23/06 (tarde) — PREENCHER A TELA + verificação por MIM no simulador
- Flávio (foto) viu a tela ENCOLHIDA, com muito preto sobrando e cortada. Causa achada no código:
  CockpitPilotoView.safeMargin devolvia ~59pt (recorte da ilha) em TODOS os lados → espremia o painel ~120pt/eixo.
  O painel tem a MESMA proporção da tela (≈2,17:1) → margem ZERO preenche inteiro. FIX: safeMargin = 0.
- Flávio (com razão) mandou eu parar de usá-lo como testador e verificar EU MESMO no simulador. FEITO:
  build pro simulador (iPhone 17 Pro Max), instalei, abri --p1-cockpit, capturei e girei a imagem (/tmp/cockpit-upright.png).
  RESULTADO VERIFICADO POR MIM: PREENCHE o quadro inteiro; leiaute aprovado completo; sensores vermelhos "sem sinal";
  selo "CONECTADO — AGUARDANDO O CARRO NA PISTA" = a conexão real fechou DENTRO do app (WebView assinou o canal).
- O iPhone 16 do Flávio JÁ TEM esta versão (build de device com margem 0, instalada pelo cabo).
- Obs: botão "‹ Voltar" só aparece no atalho de teste --p1-cockpit; no fluxo por GIRO não existe.
- Próximo após o ok dele: (a) número real = carro na pista; (b) decidir web-embutido (agora preenche/sem zoom/ao vivo) x reescrever nativo; (c) caso PARADO=status.

---

## TASK_DONE
- Pedido original conferido: sim
- Ambiente trabalhado: desenvolvimento (web, navegador)
- Produção foi alterada: não
- Se produção foi alterada, autorização explícita registrada: n/a
- Arquivos reais inspecionados: sim (painel aprovado + peças do cockpit)
- Alterações feitas: sim (1 arquivo NOVO; nada existente alterado)
- Testes/validação executados: sim (servidor local + 2 prints por navegador automático)
- Resultado: concluído (1ª versão) — aberto no navegador, aguardando seu sim/não
- Pendências reais: força-G aparece "sem sinal" no replay (a volta gravada era só GPS+motor; com o carro real ele chega); limiares de velocidade (anda 15 / para 8) são defaults pra calibrar na pista; valores numéricos por aparelho (RPM, °, V) entram com o feed real na bancada

### Arquivos alterados
- NENHUM existente alterado. Painel aprovado (cockpit-volta-real.html) intocado — usado por embute.

### O que foi acrescentado
- web/cockpit/checar-antes-de-rodar.html (tela nova: status em tela cheia quando parado; vira o painel do piloto quando anda; troca sozinha pela velocidade; ?modo=parado|andando trava pra inspecionar)

### Validação executada
- Servidor local raiz do projeto (python http.server 8091): checar-antes-de-rodar.html 200, cockpit-volta-real.html 200, curvas 200, volta-real 200, state/renderer/bridge/css 200.
- Print automático modo auto: replay a 98 km/h -> tela mostrou o PAINEL DO PILOTO (transição "andando" OK).
- Print automático ?modo=parado: grade de status completa, GPS+motor verdes "Comunicando", selo "PRONTO PRA GRAVAR", chassi "A instalar" cinza, força-G "Sem sinal".

### Checagem contra o pedido original
- "carro parado -> todos os status, como estão" -> grade dos 14 aparelhos, cor por estado: OK
- "dado embaixo do ícone, título em cima" -> cartões com título em cima, ícone, dado/estado embaixo: OK
- "tela toda" -> layout largura total: OK
- "carro andando -> réplica do que o piloto vê" -> embute o painel aprovado, aparece ao andar: OK

### Pendências ou riscos
- Aguardando o ok visual do Flávio. Limiares de velocidade a calibrar na pista. Força-G/valores numéricos dependem do feed real.

## Investigação profunda das cópias preservadas — 23/06/2026
- Removidas a mais (0 código exclusivo; trabalho nomeado já na oficial): cerebro-nuvem-tripa, determined-beaver-390de9 (esta tinha só Package.resolved sujo = lockfile regenerável; branch persiste = reversível).
- TRABALHO DE CÓDIGO SOLTO (arquivos que NÃO existem na oficial — preservadas firme):
  * infallible-bardeen-dedc29: ios/.../ProntidaoPendencia.swift
  * classificador-trail: supabase/migrations/0043_tipos_curva_vivos.sql + web/cockpit/tipos-curva-vivos-{loader,persister}.js (ATENÇÃO: memória diz 0043 aplicada em PROD 14/06, mas o arquivo não está na oficial — revisar)
  * cockpit-treino-trail: src/telemetry/racebox-*.js (5, integração RaceBox/GPS) + web/cockpit/revisao-treino.{html,js}
  * revisao-treino-freio: web/cockpit/revisao-treino.{html,js}
- Preservadas por trabalho NOMEADO não incorporado: friendly-hopper, hardcore-nightingale, infallible-liskov (editor de pista GPS), infallible-snyder (telas iOS de Stint S2-S8), rodada1-s1 (telas iOS de Stint), vista-engenheiro/command-box-mockup-recovery (Vista Engenheiro do Command Box).
- Preservada por mudança não salva: hardcore-napier (só Package.resolved? não — recusou no modo seguro; manter).
- RESULTADO: 18 cópias -> 7 removidas -> 11 restantes, todas com trabalho potencialmente não incorporado. Nenhuma branch (linha de trabalho) apagada.

---

# TASK_INIT — Análise profunda do Command Box (conselho de agentes) — 23/06/2026

## Pedido original
"Em P1 Fast faça análise profunda com um conselho de agentes para avaliar o Command Box. A situação atual. O que precisa ser feito para atingir o objetivo dele ser real em todos os seus componentes com dados ao vivo da pista. Nas visões piloto e engenharia com lambda, sensores, pneus, amortecedores, e visão geral dos sensores."

## Objetivo (1 frase)
Classificar componente a componente cada visão do Command Box (real ao vivo / real gravado / demo-fake / aguardando ligação / ausente) com evidência, expor bloqueios físicos de sensor e entregar o plano para virar real ao vivo.

## Critérios de conclusão
- Cada visão diagnosticada com evidência (arquivo:linha), verificação adversarial das afirmações "é ao vivo".
- Bloqueios físicos (sensor inexistente) explicitados — não prometer dado que o carro não capta hoje.
- Plano em ondas. Linguagem de gestor.

## Ambiente: desenvolvimento (SOMENTE LEITURA / ANÁLISE). Produção protegida: sim. Autorização produção: não (não aplicável; não altera nada).

## Riscos: só de imprecisão — mitigado por verificação adversarial. Não escreve código, não toca produção, não publica no canal cockpit-bubi-live.

## Status: conselho concluído (15 agentes). Plano em ondas entregue.

---

# TASK_DONE — Trava de arquitetura do dado (uma entrada, um cérebro) — 23/06/2026

## Pedido
Flávio cobrou garantia ESTRUTURAL (não promessa) de que o dado parte de um lugar só, processa num lugar só, todos consomem o mesmo recurso, e novo trabalho segue isso — sem eu espalhar conexão/conta por tela.

## Feito (ambiente isolado, branch `guard-arquitetura`, oficial `main` INTOCADA)
- `tests/node-smoke-arquitetura-dado.mjs` — trava automática (catraca): reprova tela com conexão própria (`createClient`), dado falso (`preview-local`/`FAKE_LAPS`) ou tela nova não registrada. Baseline = dívida legada (Vista Piloto, Vista Engenheiro), só encolhe. Ignora cópias/arquivos (APROVADO/BACKUP/data).
- `docs/CONTRATO_DADOS.md` — registro único: fonte (canal `cockpit-bubi-live` + ponte `cloud-bridge.js`), contrato de campos (stripSample, inclui lambda), casa de cada conta (cérebro), telas que só exibem.
- `package.json` — liga a trava em `npm run smoke` + `npm run smoke:arquitetura`.
- `CLAUDE.md` — regra dura em "Decisões já fechadas".
- Memória: `feedback-arquitetura-uma-fonte-um-processamento-todos-consomem.md` + índice.

## Validação executada (real)
- Estado atual: 28 ok / 0 fail (verde).
- Violação nova (tela com createClient): 28 ok / 1 fail (vermelho) — reprovou.
- Removida: verde de novo.
- `npm run smoke:arquitetura` roda pelo comando oficial; `package.json` é JSON válido.
- `main` (oficial) confirmada sem a trava (0) — só na linha isolada.

## Resultado: concluído (estrutura construída e provada). 

---

# TASK_DONE — Incorporação à oficial + migração da Vista Piloto (conexão) — 23/06/2026

## Feito
1. **Incorporado à versão oficial (main):** trava + registro + regra + ligação no `npm run smoke`. Cirúrgico (só os 4 arquivos, via `git checkout` da branch — não arrastei a divergência do auto-save). Trava roda verde na oficial.
2. **Ampliada a ponte única `web/cockpit/cloud-bridge.js` (+ espelho iOS):** vários ouvintes na MESMA conexão + eventos `evento` (volta) e `posicao` (posição da nuvem). Aditivo, compatível com os consumidores atuais (main-t3000, checar, app). Sintaxe ok.
3. **Migrada a Vista Piloto — conexão:** as DUAS conexões próprias (HUD + cérebro) viraram UMA, pela ponte única. `createClient` na tela = 0 (era 2). Mesma fonte de produção (supabase-config = fvhwltzhytpnhlqbttmd). Backup: `_design-reference/_backups/...BACKUP-migracao-fonte-unica-20260623-164139.html`.
4. **Catraca apertada:** baseline da Vista Piloto perdeu `conexao-propria` (dívida quitada); trava agora EXIGE a tela sem conexão própria e passa (27 ok / 0 fail).

## Validação
- Trava verde após quitar (27 ok / 0 fail). Se a tela tivesse conexão, reprovaria (catraca não mente).
- 8078 serve a ponte e dependências (200). Tela aberta pro Flávio ver carregando com o arranjo dele.
- Limite honesto: a prova de DADO ao vivo correndo só com carro na pista. Sem carro: selo "AO VIVO · aguardando o carro" (esperado). Reversível pelo backup.

## Pendências reais
- Ok visual do Flávio (layout intacto / sem erro).
- Vista Piloto: resta a dívida do feed de demonstração (preview-local/FAKE_LAPS) — próximo passo.
- Vista Engenheiro: ainda toda em demonstração — migrar depois.
- `?canal=` (canal de dev por URL) não passa mais pela ponte (ela usa o canal canônico cockpit-bubi-live); se precisar de canal de teste, adicionar na ponte (um lugar só).

---

# TASK_INIT — Central de Cálculos: mapa ANTES/DEPOIS (visual) — 23/06/2026

## Pedido original
"RETOMAR CENTRAL DE CÁLCULOS" + escolha no card: entregar como **comparação antes/depois** (visual, lado a lado, focada no ganho).

## Objetivo (1 frase)
Mostrar visualmente, em linguagem de gestor, como as contas funcionam hoje (cada tela/cérebro refaz a sua) versus como ficam com a central (uma conta, uma casa, todos consomem).

## Critérios de conclusão
- HTML de tela cheia, sem emoji, duas colunas: HOJE × COM A CENTRAL.
- Cada afirmação concreta apoiada por arquivo real verificado.
- Abre no navegador do Flávio.
- Nada do sistema é alterado (é desenho pra decidir).

## Leitura obrigatória
~/.claude/CLAUDE.md, padroes.md, FLAVIO_EXECUTION_PROTOCOL/DONE_CHECKLIST/ENVIRONMENT_RULES/COMMUNICATION_RULES, P1 Fast/CLAUDE.md, CONTINUAR-central-calculos.md: todos lidos nesta sessão.

## Evidência verificada por grep/ls (sessão 23/06)
- Continha de distância no GPS copiada em 8 arquivos: passagem-real.js, cerebro-velocidade.js, trail-cockpit-motor.js, trecho-detector.js, classificador-trecho.js, freio-trecho.js, ios/.../trecho-detector.js, trajectory-monitor.js.
- Marcha em 2 lugares: src/domain/gear-estimation.js (velho) × web/cockpit/gear-detector-online.js (produção).
- Ponto de troca da luz em 2: src/domain/shift-target.js × web/cockpit/shift-light-orquestrador.js.
- Freio com 1 motor só: web/cockpit/freio-trecho.js (exemplo do que já está bom).
- Casas reais que o cérebro ignora: delta-calculator.js, src/domain/p1-coach.js, src/domain/score.js (existem).
- Cérebro (web/command-box/cerebro/*) só é importado por mockup da Vista Piloto, testes e scripts de scratch — nenhuma tela de app de verdade.

## Ambiente: desenvolvimento. Produção protegida: sim. Autorização produção: não (não se aplica — desenho local).

## Riscos
Baixo. Cria 1 HTML novo de referência. Não altera código/banco/produção. Único risco = afirmar algo não verificado; mitigado pela verificação acima.

## Status: concluído (2 desenhos entregues e abertos)

## TASK_DONE (Central de Cálculos — mapas)
- Pedido conferido: sim (antes/depois + depois o raio-x completo que ele pediu)
- Ambiente: desenvolvimento. Produção alterada: não.
- Arquivos inspecionados: sim (~130 listados; 3 agentes Explore + greds meus; números cravados)
- Alterações: 2 arquivos NOVOS de referência; 1ª mapa corrigido (8→16). Nada existente removido.
- Validação: abertos no navegador; cada número conferido em código real (grep).
- Resultado: concluído. Pendência: decisão do Flávio sobre por onde começar a execução.
- Acrescentado: _design-reference/mapa-central-calculos-antes-depois.html, _design-reference/mapa-central-calculos-raiox.html

---

# EXECUTADO — Central de Cálculos FRENTE 1: distância GPS vira casa única — 23/06/2026
- Casa única `web/cockpit/geo.js`; 12 arquivos migrados; trava ganhou regra (GEO_BASELINE). 80/81 testes verdes (o fail é schema-parity, pré-existente). INCORPORADO na oficial (autorizado "Incorporar na oficial"). Worktree `central-distancia` preservado p/ rollback. Detalhe em `.claude-exec/CONTINUAR-central-calculos.md`.

---

# TASK_INIT — Central de Cálculos FRENTE 2: cérebro vira maestro — 23/06/2026

## Pedido original
Flávio escolheu (card) a frente "1 — o furo maior: ligar o cérebro como maestro (a maior alavanca de domínio)".

## Objetivo (1 frase)
Fazer o cérebro (web/command-box/cerebro/*) USAR as casas reais (atraso/delta, nota/score, lições/p1-coach, linha de referência) em vez de refazer, rumo a ligá-lo numa tela.

## Critérios de conclusão (desta etapa)
- Plano em passos, linguagem de gestor, com risco e fronteira clara (refatorar o cérebro × ligar numa tela), na frente do Flávio ANTES de tocar código.

## Leitura obrigatória: feita nesta sessão (CLAUDE.md global, padroes, protocolos, P1 Fast/CLAUDE.md, CONTINUAR-central-calculos).

## Ambiente: desenvolvimento. Produção protegida: sim. Autorização produção: não.

## Riscos (a confirmar no mapeamento)
- O cérebro hoje NÃO está ligado em tela real → refatorá-lo é baixo risco (nada vivo depende). Ligar numa tela = risco maior (muda o que a tela mostra; exige ok visual do Flávio).
- Casas reais órfãs (score, reference-line) podem ter interface diferente do que o cérebro produz — mapear antes.

## Status: Etapa 1 FEITA no ambiente isolado, NÃO incorporada (Flávio: "Deixa no ambiente isolado")

## TASK_DONE — Frente 2 Etapa 1 (distância + chegada na casa única)
- Pedido conferido: sim (etapa 1 das duas seguras, plano aprovado; SEM inventar função nova)
- Ambiente: desenvolvimento (worktree cerebro-maestro). Produção/oficial alterada: NÃO.
- Arquivos inspecionados: sim (cérebro + detectores, fórmula a fórmula)
- Alterações: 6 arquivos (casa neutra src/domain/geo.js nova; web/cockpit/geo.js reexporta; cerebro-velocidade, chegada-gps, chegada-detector usam a casa; trava ajustada). Cópia espelho eliminada.
- Testes: 80/81 verdes (o fail schema-parity já falhava na main); trava 28/0; 5 smokes do cérebro OK.
- Resultado: concluído no isolado; Flávio escolheu NÃO incorporar agora.
- Pendências: incorporar quando ele quiser; etapas 2-4 + ligar numa tela (etapa final, ok visual).

## TASK_DONE — "Terminar a distância numa casa só" (mesma linha isolada cerebro-maestro)
- Pedido conferido: sim (Flávio: "Terminar a distância numa casa só"). Verifiquei antes: velocidade já era 1 casa (não inventei trabalho).
- Ambiente: worktree cerebro-maestro. Oficial alterada: NÃO.
- Alterações: trajectory-monitor + projector usam src/domain/geo.js; mock-provider marcado fora-da-conta; trava atualizada.
- NÃO migrados (dívida marcada, motivo real): apice (curvatura aprovada/sensível), cross-validation ({lon}), iOS ×3 (bundle do app).
- Testes: 80/81 verde (schema-parity pré-existente); trava 28/0.
- Resultado: concluído no isolado até onde é seguro provar; Flávio escolheu NÃO incorporar agora.
- Honestidade: NÃO é "100% dos lugares" — 5 ficaram por motivo declarado, não por esquecimento.
