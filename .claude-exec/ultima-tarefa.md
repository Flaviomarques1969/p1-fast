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
