# RETOMAR — COMMAND BOX NA NUVEM (TV do box) — atualizado 25/06/2026

## ★ PRÓXIMO PASSO (ao retomar após o clear, começar EXATAMENTE por aqui)
**ETAPA 2 — TELA DO STINT AO VIVO (espectador): FEITA E DEMONSTRÁVEL EM DEV 25/06.** ACHADO importante: a tela já existia
e já fazia o arranjo da ETAPA 2 (vídeo em cima + velocidade/volta no meio + mapa de Brasília com a bolinha embaixo) — é a
`AssistirView` (decisão Flávio 09/06), aberta pela rota `.assistir` (que o card "Stint ao vivo" da ETAPA 1 já chama).
**DECISÃO DO FLÁVIO 25/06 (card 20260625-172034-cb-etapa2-tela-de-baixo):** o que vai EMBAIXO da tela de espectador fica
**SIMPLES** (mapa + bolinha + velocidade/volta/melhor), NÃO o painel denso do piloto. Motivo: é a "experiência do usuário
comum assistindo" e o painel do piloto (`cockpit-app.html`) é deitado e de formato CONGELADO — não cabe numa tela em pé.
**FEITO E PROVADO 25/06:** modo de DEMONSTRAÇÃO (`--p1-assistir-demo`) que toca a volta REAL gravada do Bubi (881 amostras,
`web/command-box/fixtures/volta-real-gps-23-05-rodando.json`, embutida em `Sources/Views/AssistirDemoVolta.swift`): bolinha
ANDA na pista + velocidade derivada do movimento real; tudo rotulado honestamente ("DEMONSTRAÇÃO — volta gravada do Bubi,
não é o carro ao vivo"; vídeo = "aqui entra a câmera do carro"; painel = "aguardando o painel do piloto"). BUILD SUCCEEDED
(simulador iPhone 17); provado por 2 fotos com a bolinha andando (118→171 km/h em 10s). Trava de arquitetura 31/1 (o 1 é o
`pista-oficial-brasilia.js` pré-existente; mudança é Swift, não cria furo). Salvo na linha LOCAL (auto-save), nada enviado.
Arquivos: `AssistirView.swift` (modo demo), `AssistirDemoVolta.swift` (novo, volta embutida), `ContentView.swift` (atalho).
**FONTE DO DADO AO VIVO (decidido por inspeção, NÃO mudar sem motivo):** a `AssistirView` recebe vídeo E dados (gps/carro/
painel) pela PRÓPRIA SALA DE VÍDEO (Daily.co), repassados pela Central de Pista (`p1tv.vercel.app`). NÃO abrir uma 2ª conexão
ao `cockpit-bubi-live` na tela do espectador (contraria "tela não abre conexão própria"). O ao vivo de verdade depende do
carro na pista (C1, físico).
**FALTA na ETAPA 2:** validar o clique do card + reatividade entre aparelhos quando houver stint real.

**ETAPA 3 (rever vídeo+dados juntos, "gameplay") — MOTOR DE SINCRONIZAÇÃO FEITO E PROVADO EM DEV 25/06.** ACHADO: a
fundação já existe — `volta_video` (mig 0016) indexa cada volta por OFFSET em ms dentro da gravação Daily (= a sincronização);
`VoltaVideoIndexer` indexa; `TriagemVideoView` lista as voltas, mas o "tocar" só abre a URL do vídeo no navegador, SEM os
dados acompanhando. O que faltava = o "tocar JUNTO". **FEITO:** demonstração `ReverVoltaDemoView` (`--p1-rever-volta-demo`) +
o motor `AssistirDemoVolta.estadoEm(t)` (tempo da gravação → posição interpolada + velocidade). Arrastar a linha do tempo
(ou Tocar) move JUNTOS: relógio do vídeo (placeholder honesto "VÍDEO DA VOLTA entra aqui · sincronizado em m:ss"), bolinha no
mapa oficial e velocidade. BUILD SUCCEEDED (sim iPhone 17); provado por fotos (0:15→2:04: bolinha andou, 17→123 km/h, barra e
relógio juntos). Trava 31/1. Reusa o mapa/amarração aprovados (PistaBrasilia) — andaime de demonstração, NÃO tela de produção.
**DESENHO DO PLAYER APROVADO 25/06 (card 20260625-175721-rever-volta-dados):** o lado dos DADOS fica **SIMPLES — opção A**
(mapa + bolinha + velocidade, igual ao espectador), NÃO a opção B (análise com trecho+delta). Mockup aprovado:
`_design-reference/mockup-rever-volta-player-2026-06-25.html`. A demonstração `ReverVoltaDemoView` JÁ é a opção A.
**FALTA na ETAPA 3 (pra virar produção):** (1) VÍDEO real gravado pareado com os dados = dia de pista (físico) + a gravação
Daily (`daily-recording-hook` já existe); (2) construir o player de produção = escopar por VOLTA (offsets do `volta_video`),
trocar o placeholder pelo vídeo real (player Daily/AVPlayer), e plugar onde hoje o `TriagemVideoView` só abre a URL. Só dá pra
testar de verdade com uma gravação real — por isso esperar o dia de pista; NÃO construir tela de produção sem dado pra provar.
⚠️ Limpar o estado de demonstração no simulador quando não precisar: o evento `evt-mock-2026-05-02` foi movido pro time
`c027a716-...` (do Flávio logado) só pra a Home ficar cheia e mostrar o card; reverter pro time `...AA` depois.

---
### (histórico — gravação na nuvem + TV, já feito)
Parte A (tela exibe o painel da nuvem) = FEITA E PROVADA. B1 = DECIDIDO 25/06 (notebook faz a conta AO VIVO e manda pronto;
a NUVEM passa a GUARDAR o dado pra análise posterior — replay/revisão/outras voltas).

**FEITO E PROVADO 25/06 (pós-aprovação "sim"): a GRAVAÇÃO NA NUVEM em ambiente de teste.** O ao vivo deixou de ser só
"rádio" sem retenção. Construído o GRAVADOR (`tools/nuvem-gravador.mjs`): escuta o canal ao vivo e GUARDA append-only sem
perda silenciosa (alarme + recupera se a prateleira falhar), com prateleira TROCÁVEL — Arquivo/Memória (teste) e Ingest
(produção: `telemetry_samples` via função `ingest`, a MESMA do iPhone), esta TRAVADA por padrão (recusa sem autorização
explícita). Provas: `node tests/node-smoke-nuvem-gravador.mjs` (8/8) + `node tools/prova-cadeia-gravacao-nuvem.mjs` VERDE
(60 ao vivo → 60 guardados sem perda → releitura recuperou a volta inteira, arco 0.004..0.997), pela rede real em canal de
teste `cb-prova-gravacao`. Entrou na catraca (`npm run smoke` + `smoke:nuvem-gravador`). Produção INTOCADA.

**D1 — FEITO 25/06: TV PUBLICADA SEM SENHA.** Endereço: **https://command-box-tv.vercel.app** (a demonstração viva é o
endereço SIMPLES — a bolinha percorre a pista pela animação de relógio; provado: 28 elementos do mapa se deslocam em 5s).
✅ **REPLAY FUNCIONA (corrigido 25/06, depois de 2 conclusões erradas minhas):** `?replay=23-05` percorre a volta inteira —
provado no Chrome real: com `&speed=60` a fração foi 0.094..0.998, 13 posições distintas. O que parecia "travado" era o carro
REALMENTE PARADO na largada nos primeiros ~52 s da gravação (as 1as ~52 amostras todas em frac~0.997); a 6× isso são ~9 s de
tela — eu testava 7-9 s e concluía "travado". LIÇÃO: esperar o carro sair OU usar speed alto. Cálculo (geoParaCommandBox +
construirFracDe) e suavizador estão CORRETOS. Pra DEMONSTRAR sem a espera da largada: `?replay=23-05&speed=30`.
Detalhe menor REAL: o selo mostra "AO VIVO · aguardando o carro" em vez de "VOLTA GRAVADA" (a ponte ao vivo sobrescreve o
rótulo do replay) — cosmético, não impede a bolinha. Projeto Vercel próprio `command-box-tv` (scope flaviomarques-6007s-projects),
SEPARADO do painel p1t4000 (intocado). Pacote enxuto gerado por `node tools/montar-tv-publi.mjs` (segue as dependências
recursivamente a partir do mockup; 34 arquivos, 728K; NÃO expõe o resto do projeto; remove a ferramenta de autor salvar-versao.js).
Confere sozinho (0 faltando) e foi servido 34/34 = 200 local + público 200 sem SSO/login. A TV só ESCUTA `cockpit-bubi-live`
(nunca publica). Republicar: `node tools/montar-tv-publi.mjs && cd dist/command-box-tv && npx vercel deploy --prod --yes --scope=flaviomarques-6007s-projects`.

**Próximo (ao retomar):** falta (1) ligar o destino de PRODUÇÃO do gravador (`PrateleiraIngest`→`telemetry_samples`) — precisa
"MIGRAR PARA PRODUÇÃO" + sessão/credencial reais + ajuste de exclusão em cascata; (2) **C1** — carro na pista publicando ao vivo (dia de pista).

**★ VISÃO DE PRODUTO DO FLÁVIO 25/06 — ESTA TELA = EXPERIÊNCIA DO USUÁRIO COMUM ASSISTINDO O STINT AO VIVO:**
Esta tela (VÍDEO em cima + MAPA/telemetria embaixo) NÃO é só a TV do box — é a tela que o USUÁRIO COMUM abre pra ver o evento/
stint rodando ao vivo. FLUXO pedido:
 1. Usuário abre o app → PRIMEIRA TELA mostra o STINT ATIVO ao vivo ("Stint ao vivo").
 2. Gatilho: quando o PILOTO INICIA o stint, ele JÁ APARECE na primeira tela como ao vivo.
 3. Usuário CLICA no stint ao vivo → abre ESTA tela (vídeo + mapa + telemetria sincronizados).
+ pedido junto: GRAVAR os VÍDEOS no app, SINCRONIZADO com esta tela (rever vídeo+dados juntos depois, "gameplay").
JÁ EXISTE FUNDAÇÃO (levantado, NÃO inventar): vídeo ao vivo+gravação = **Daily.co** (câmera do iPhone, ADR) + funções
`stream-start/heartbeat/end`, `daily-recording-hook` (webhook gravação pronta), `public-stream`/`event-stream-link`. Tabelas:
**`video_streams`** (0015/0044) e **`volta_video`** (0016: liga VÍDEO↔VOLTA por OFFSET em ms = sincronização já prevista). Stint
ao vivo = canal `cockpit-bubi-live` + o STINT do P1 Fast (ver memória do checklist do stint). Mapa do fluxo FEITO e APROVADO pelo Flávio
25/06 (`relatorios/mapa-fluxo-stint-ao-vivo-2026-06-25.html`). Ele escolheu começar pela ETAPA 1 (primeira tela).

**ETAPA 1 — FEITA EM DEV 25/06 (card "Stint ao vivo" na primeira tela):** card "STINT AO VIVO" no topo da Home (app iOS)
quando há stint rodando (status='ativa', sem data_fim); some ao finalizar; toca → rota `.assistir` (tela de espectador já
existente). 3 arquivos: `StintRepository.swift` (`stintAtivo` + `carregarStintAtivo()` + recarrega em create/finalize),
`HomeView.swift` (HomeData.stintAoVivo + StintAoVivoCard/AoVivoDot + render no FilledContent), `ContentView.swift`
(realHomeState mapeia + `.task` recarrega quando a Home aparece — conserta bootstrap rodar antes do time do usuário pronto).
BUILD SUCCEEDED 2x; provado no simulador (card "STINT AO VIVO · Treino" aparece; some sem stint). Salvo no ramo LOCAL
(auto-save), NÃO enviado, produção intocada. Detalhe completo em `.claude-exec/ultima-tarefa.md` (bloco TASK_DONE Etapa 1).
**FALTA**: validar o clique + reatividade entre aparelhos (via nuvem); ETAPA 2 (juntar vídeo+mapa numa tela) e ETAPA 3 (rever
vídeo+dados). Estado de demonstração no simulador (1 evento movido pro time logado p/ a Home ficar cheia) — reverter depois.
**RETENÇÃO DECIDIDA 25/06 (Flávio):** guardar TODOS os dados de TODA volta (bruto completo) PARA SEMPRE; só sai quando o
usuário apagar a VOLTA, o STINT ou o EVENTO no app (exclusão manual em 3 níveis). ⚠️ Pra ligar em produção falta ajustar a
cascata de exclusão (hoje só o STINT/sessão apaga tudo junto; EVENTO solta as sessões e VOLTA não recorta as amostras) —
detalhe na memória `p1-fast-command-box-na-nuvem-2026-06-24`. Não tocar produção. Ambiente = desenvolvimento.

## GATILHO
Flávio digita **"RETOMAR COMMAND BOX"** (ou "voltei command box") depois de um clear.
Ao ver isso: LER este arquivo inteiro ANTES de responder. Não despejar análise — continuar a execução.

## O QUE É (na língua do Flávio)
A **TV de 32" do box** (aberta por um aparelhinho da Amazon — Fire TV Stick — no navegador) mostrando o
carro AO VIVO: onde está na pista (bolinha), ritmo/voltas/meta, combustível, temperaturas que temos.
REGRA DURA da arquitetura (Flávio 16/06 e 23/06): **a NUVEM processa UMA vez, a TELA só EXIBE.** Telas não
recalculam nem abrem conexão própria. Canal de produção do ao vivo = `cockpit-bubi-live` (só ESCUTAR; publicar
lá precisa de ordem literal). Tela aprovada principal = `_design-reference/mockup-command-box-vista-piloto.html`
(servida pela 8078, abre em http://localhost:8078/). NÃO mexer no LAYOUT aprovado — só na FONTE do número.

## ESTADO: o que está FEITO E PROVADO (24/06, dev, nada em produção)
1. **Cérebro virou serviço hospedável** — `tools/nuvem-cerebro.mjs` (espelha o padrão seguro do `nuvem-posicao.mjs`):
   conta pura `criarProcessadorCerebro` + trava dura (recusa entrada=produção sem PERMITIR_PROD_CANAL; recusa
   saída=produção sempre). Escuta 'sample'/'gps'/'evento' → alimenta `criarOrquestradorVivo` → publica 'painel'
   (PainelPronto) num canal de SAÍDA separado. Teste: `node tools/nuvem-cerebro.smoke.mjs` → VERDE (stint/ritmo/meta + combustível).
2. **Combustível = conta ativa** (decisão Flávio 24/06: consumo vs quantidade no tanque). Casa única JÁ existia:
   `src/domain/fuel-calc.js`. Liguei na saída do cérebro (usa as voltas que o cérebro conta). Provado: 40L − 0.82×8 = 33.44L, 84%.
3. **Posição da bolinha já tinha casa e serviço**: `tools/nuvem-posicao.mjs` (`calcularPosicao` = geoParaCommandBox + fracDe).
   Volta de ensaio: `tools/nuvem-replay-gps.mjs`. NÃO criar conta de posição nova.
4. **★ CAMINHO DA NUVEM PROVADO PONTA A PONTA pela infra REAL de canais** (canal de teste, sem produção):
   `node tools/prova-cadeia-command-box.mjs` → VERDE. Carro(volta gravada)→'gps'→NUVEM(calcularPosicao)→'posicao'→Tela:
   60 pontos, 56 posições DISTINTAS, frac 0.004..0.997 (volta inteira), todas na pista. Rede da nuvem funciona daqui.
5. **A tela aprovada já está meio ligada**: assina a ponte `cloud-bridge.js` (`cb.onSample`, `cb.onPosicao`, `cb.startCloudBridge`)
   e tem `?replay=23-05` embutido (toca a volta gravada do Bubi → bolinha anda; rótulo honesto "volta gravada").
   Mas hoje roda o cérebro NO NAVEGADOR (alimentado por fixture) — falta passar a EXIBIR o 'painel' da nuvem.
6. **Peça nova segura**: `cloud-bridge.js` agora aceita `?canal=<nome>` (override SÓ dev/teste; padrão = produção, intocado).
   Permite provar o caminho da nuvem NA TELA num canal de teste.
7. **Precisão honesta** (medida em volta real do Bubi): bolinha cai na pista, ~7 px no típico, até ~22 px no pior caso
   (perto da chegada / área de box). Pista tem ~22 px de largura. Não é pixel-perfeito; segue bem o carro.
8. Trava de arquitetura: 31 ok / 1 fail. O 1 fail é `ios/.../pista-oficial-brasilia.js` (trabalho do iPhone 24/06, 12:14),
   PRÉ-EXISTENTE, NÃO é desta linha. Cérebro original e painel aprovado intocados.

## O QUE FALTA (executar na ordem) — buraco estreito
### A) NA MINHA MÃO — ✅ FEITO E PROVADO 24/06 (pós-clear):
A1. ✅ **Caminho da nuvem PROVADO NA TELA** (canal de teste 'cb-dev'): replay-gps + nuvem-posicao + nuvem-cerebro
    no mesmo canal; ouvinte confirmou 245 posições distintas (bolinha anda) + 64 pacotes 'painel'; aberto no navegador
    `http://localhost:8078/?canal=cb-dev`. Comandos vivos (em 3 terminais): ver "COMO REMONTAR A PROVA VIVA" abaixo.
A2. ✅ **A tela EXIBE o 'painel' da nuvem**: `cloud-bridge.js` ganhou `onPainel` + listener 'painel' (espelho do `onPosicao`).
    No mockup, novo bloco assina `onPainel` → `window.__aplicarPainelStint` (Voltas/Ritmo/Meta) + combustível; o cérebro do
    navegador virou FALLBACK (guarda `window.__painelNuvemTs` < 5s). Layout aprovado intocado. Prova de rede:
    `node tools/prova-cadeia-painel-command-box.mjs` → VERDE (volta 8, ritmo 1:31.89, combust 33.44L).
A3. ✅ **Combustível = CONTA viva** no gauge (decisão Flávio 24/06): `updateFuelGauge` usa `window.__fuelRealL` da nuvem
    (só a fonte do número; desenho intocado) e o bloco acende "ao vivo" quando a conta chega; sem nuvem, "aguardando".
    Blocos sem sensor seguem INATIVOS honestos (já estavam). Ativar mais aos poucos conforme instala sensor.

### COMO REMONTAR A PROVA VIVA (3 terminais, canal de teste 'cb-dev', nunca produção):
- `CANAL=cb-dev node tools/nuvem-posicao.mjs`                                    (gps→posicao)
- `CANAL=cb-dev CANAL_SAIDA=cb-dev P1FAST_CEREBRO_OPTS='{"marcoChegada":{"a_gps":{"lat":-15.7728816,"lng":-47.9000707},"b_gps":{"lat":-15.7725493,"lng":-47.9001926}}}' node tools/nuvem-cerebro.mjs`  (fluxo→painel)
- `CANAL=cb-dev node tools/nuvem-replay-gps.mjs 23-05 8`                          (carro: gps da volta gravada; use 8×, não 12× — dedupe de volta = 8s)
- abrir `http://localhost:8078/?canal=cb-dev`. Parar tudo: `pkill -f "nuvem-(posicao|cerebro|replay)"`.
- LIMITAÇÃO do replay: a 8× o RITMO (delta/volta) sai distorcido (relógio do replay corre 8× → volta comprimida). Voltas/posição/combustível corretos. Na pista (tempo real) o ritmo é correto.

### B) ✅ DECIDIDO PELO FLÁVIO 25/06 (card 20260625-095259-cb-calculo-sempre-ligado):
B1. **AO VIVO na corrida = o NOTEBOOK do carro FAZ A CONTA e manda o PAINEL PRONTO** ('posicao' + 'painel') junto com o
    'gps'. Exceção autorizada por ele à regra "a nuvem processa": justificativa do Flávio — "se o notebook travar, já não
    vai ter dado mesmo pra enviar". Então o cérebro AO VIVO mora no notebook (.exe Windows), não num serviço de nuvem.
    **NOVO REQUISITO do Flávio**: a **NUVEM precisa GUARDAR o dado** (persistir) pra ANÁLISE POSTERIOR — replay, revisão,
    ver outras voltas, análise de "gameplay". Ou seja: nuvem deixa de ser o processador ao vivo e vira ARQUIVO + análise.
    → Próximo da minha mão: (1) no caminho da tela, fazer a Vista Piloto consumir 'posicao'/'painel' do notebook (já pronto —
    A2/A3 feitos); (2) planejar a GRAVAÇÃO na nuvem (hoje o ao vivo é broadcast sem persistência; ver memória de gravação
    local blindada + envio à nuvem — NÃO inventar, conferir o que já existe antes). Implica trabalho do .exe (dia de pista).

### C) BLOQUEADO POR FÍSICA (não dá pra forçar):
C1. **Carro real publicando 'gps' ao vivo na pista** = trabalho do DIA DE PISTA (notebook no carro). Cada elo está
    provado; a junção com o carro de verdade só na pista. Quem publica 'gps' ao vivo = o notebook (não há publicador no web).

### D) FECHAMENTO (depois de B1 decidido):
D1. **Publicar a TV num endereço sem senha** (Flávio autorizou: TV sem senha, só abre o endereço). Cada pasta web é um
    projeto Vercel próprio. Receita: `cd <pasta da tela> ; npx vercel link --scope flaviomarques-6007s-projects ;
    npx vercel deploy --prod --yes --scope=flaviomarques-6007s-projects`. NÃO mexer no painel existente (p1t4000).
    Fazer SÓ depois de A2/A3 (senão publica tela mostrando demonstração).

## RESUMO PRO FLÁVIO (o que ele precisa)
- A (tela exibe o painel da nuvem) = FEITO E PROVADO. B1 = DECIDIDO 25/06 (notebook faz a conta ao vivo; nuvem GUARDA pra análise).
- 1 coisa FÍSICA: C1 (carro na pista publicando ao vivo).
- Próximo da minha mão: planejar a GRAVAÇÃO do dado na nuvem (persistência pra replay/análise) + D1 (publicar a TV sem senha).

## SEGURANÇA / REGRAS (não esquecer)
- NUNCA publicar dado de dev/replay no canal de produção `cockpit-bubi-live` (só ESCUTAR). Brain/posição publicam em canal de SAÍDA separado.
- NÃO mexer no layout do painel aprovado (`mockup-command-box-vista-piloto.html`); só a FONTE do número.
- NÃO `--include-all` em migração de produção (memória do projeto). Não tocar produção sem "MIGRAR PARA PRODUÇÃO: ...".
- Memória em DOIS caminhos (global + projeto). Ambiente padrão = desenvolvimento.

## COMO PROVAR DE NOVO (comandos)
- `node tools/nuvem-cerebro.smoke.mjs`            → cérebro + combustível (offline)
- `node tools/prova-cadeia-command-box.mjs`       → caminho da nuvem ponta a ponta (canal de teste, rede)
- `node tests/node-smoke-arquitetura-dado.mjs`    → trava (31/1; o 1 é o iPhone, pré-existente)
- Tela: `http://localhost:8078/` (servidor atelier já roda na 8078) · com volta real: `?replay=23-05&speed=8`

---
## ATUALIZAÇÃO 27/06/2026 — MENU DE ENTRADA PUBLICADO em p1box.vercel.app
- Criado o MENU launcher: `_design-reference/menu-command-box.html` (foto real do Bubi no fundo: `_design-reference/bubi.jpg`; sem número 80; navegação por controle do Fire Stick + mouse).
- Telas ativas no menu: Visão do Piloto e Frenagem & Aceleração (= `mockup-command-box-comparar-voltas.html`). Engenheiro = "em construção" (sem link, estava bagunçado).
- Botão "Voltar" pro menu adicionado em vista-piloto e vista-engenheiro (comparar-voltas já tinha). Volta por history.back() + tecla Voltar do controle.
- Pacote próprio: `tools/montar-p1box.mjs` -> `dist/p1box/` (menu=index.html + as 2 telas + bubi.jpg + deps /web). Publicado no projeto Vercel `p1box` => https://p1box.vercel.app (público, sem login). SEPARADO do `command-box-tv` (intocado).
- Republicar: `node tools/montar-p1box.mjs && npx vercel deploy "dist/p1box" --prod --yes --scope flaviomarques-6007s-projects`
