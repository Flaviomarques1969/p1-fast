# GPS — trechos da metodologia na TV e na página da volta (27/10/2026)

## RETOMADA 1027-1243
Passe: ~/.claude/retomadas/20261027-1243-p1fast.md. Segue do Próximo 1 (cópia iPhone).

## RETOMADA 1027-1230b
Passe: ~/.claude/retomadas/20261027-1230b-p1fast.md. Itens 1–9 do GPS prontos (último commit 4d76abf8e).

## Pedido (resposta do painel p1fast-gps-setores-1228, ALTERAR)
"nós usamos uma metodologia totalmente própria [...] ponto de entrada, ponto de frenagem, velocidade mínima,
ápice, ponto de saída [...] você está considerando todos eles? na nossa metodologia a gente controla os trechos
por todo lugar da pista que normalmente você freia, se é uma curva longa [...] flat com o pé embaixo, não é um
trecho, aí é uma reta"

## Achado (conferido no código)
- Carro (TrechoDetector.cs, itens 3/4): entrada, freada (G), Vmin, ápice (G), saída — nos 8 trechos de
  _design-reference/BARRAS-BRASILIA-FLAVIO-APROVADO-2026-05-27.json. PAce = estratégia TPS×GPS (sensor do acelerador).
- TV (cerebro-gps-tv.js) = 3 setores de 1/3; página da volta = "onde ganhou/perdeu" em 20 fatias iguais. Fora da metodologia.
- Eventos de trecho do carro NÃO vão ao canal.

## O que faço (DEV, worktree gps-base-g)
1. Fonte: BARRAS aprovado (o mesmo do carro) → módulo gerado + smoke que compara com a fonte.
2. SF (pé embaixo, CURVA DA VITÓRIA) = reta, pela regra dele (tipos-curva-brasilia.js).
3. TV: tempo por trecho (curvas + retas), km/h de entrada, mínima (com lugar) e saída; melhor por trecho.
   3 setores macro (ADR-006) ficam.
4. Página da volta: "onde ganhou e onde perdeu" por trecho em vez de 20 fatias.
5. Catraca + mutação + prova de tela.

## Andamento (27/10, antes do ponto de parada)
- FEITO (sem commit): tools/gerar-trechos-brasilia.mjs → web/command-box/trechos-brasilia.js (gerado, 8 trechos);
  web/command-box/cerebro/trechos-volta.js (montarTrechosDaVolta); cerebro-gps-tv.js ligado (opts.trechos,
  v.trechos por volta, snapshot.trechos {lista, erro, melhoresS, voltaIdealS}, voltaAtual.trechoAtual).
- MEDIDO na gravação 21/06 (km/h ÷3,6): 15 pedaços (7 curvas + 8 retas; VITÓRIA dentro de "Reta → chegada");
  soma dos trechos = tempo da volta (V1 194,953 / V2 159,597); ideal por trechos 158,172.
- Achado: ordem do cadastro ≠ ordem da volta (real: C01, C2, JUNÇÃO, BRUXA, RETA OPOSTA, PLACAR, "S", VITÓRIA);
  o carro (CarregarSegmentos) lê na ordem do arquivo e depende da vigia paralela — conferir o efeito (resync) e contar.
- gps-tv 90/90; pagina-volta 37/38: o FAIL é só a cópia do iPhone (ios/p1fast-ios/Resources/Cockpit/web/...) dos
  arquivos novos/alterados: cerebro-gps-tv.js, trechos-volta.js, trechos-brasilia.js, tipos-curva-brasilia.js.

## Próximo
1. Copiar os 4 para ios/p1fast-ios/Resources/Cockpit/web/ (mesmo caminho) e somar ao project.pbxproj se a página exigir.
2. Página da volta: compararVoltas por trechos da lista (fallback 20 fatias sem cadastro); montarPaginaVolta repassa
   v.trechos e trechos.lista; pagina-volta.html mostra nome do trecho + tabela tempo/Vmin A×B.
3. TV (mockup-command-box-vista-piloto.html): painel de trechos (tempo última/melhor, Vmin) + marcas no mapa.
4. Catraca nova tests/node-smoke-trechos-volta.mjs (cópia = fonte, SF vira reta, ordem pela volta, soma = volta,
   controles: cadastro quebrado → erro e lista vazia), no package.json; mutação; prova de tela; commit + push.

## Andamento (27/10, retomada 1027-1243)
- iPhone: 6 arquivos copiados para ios/p1fast-ios/Resources/Cockpit/web (pasta entra inteira no app; pbxproj intocado).
- Página da volta: compararVoltas(va, vb, {trechos}) usa os tempos/km/h medidos pelo cérebro por trecho (fallback 20 fatias);
  tabela "Trechos" (sozinha: tempo/melhor/entrada/mín/saída; comparada: V×ref/dif/mín); aviso se cadastro quebrado.
  Medido 21/06 V2×V1: soma das difs = −35,356 = diferença da volta. Foto do robô sem janela em 430 px, sem rolagem lateral.
- TV: marcas de entrada (anel) e saída (ponto) das 7 curvas, a do trecho em curso acesa; linhas "trecho X n/15 · última ·
  melhor · mín", "a última perdeu: …" (perdasUltima, conta no cérebro) e "ideal pelos trechos". Foto: 3ª volta no trecho 6
  (a gravação acaba aos 59 s dela — conferido ponto a ponto).
- Catraca tests/node-smoke-trechos-volta.mjs 24/24, no npm run smoke; 9 mutações, 9 reprovadas. pagina-volta 46/46, gps-tv 90/90.
- Esteira npm run smoke: parou em node-smoke-schema-parity (11 ok / 4 fail: contagem de tabelas PG 48×46, GRDB 41×38,
  sessao_dumps fora do GRDB) — fora do escopo (nenhum arquivo de banco no diff); falta provar que já falhava no HEAD e
  rodar os testes da cadeia DEPOIS dele (log: scratchpad/smoke-completo.log da sessão b6811ae9).
- Medição da ordem no carro (item 5): projeto C# pronto em scratchpad b6811ae9 .../medir-ordem (Program.cs + csproj, refere o
  Domain). 1ª rodada leu 0 GPS: o fixture replay-hoje tem lat/lon soltos e o leitor C# (SessaoReplay.Carregar) quer
  {tipo:'gps', tWall, dados:{lat,lon,kmh,fix,hacc}} → converter o fixture para esse formato num arquivo temporário e rodar de novo.

## Próximo (retomada)
1. Converter o fixture e rodar medir-ordem (dotnet run -c Release -- <worktree> pela fila) → contar resync e curvas fechadas por volta, ordem ARQUIVO × VOLTA.
2. schema-parity: rodar no HEAD limpo (git worktree temporário ou git stash push -u -m tag) para provar que é anterior; rodar o resto da cadeia do smoke.
3. Commit + push na branch claude/gps-base-g-racebox-20261027 (só os arquivos da obra; git status listado acima).

## RETOMADA 1027-1311 (27/10, tarde)
- Item 5 medido (medir-ordem, fixture 21/06 convertido p/ {tipo:'gps',dados:{…}}; 3432 GPS em movimento, 3 cruzamentos):
  ordem do ARQUIVO → V1 7 curvas fechadas, resync 3; V2 8 curvas, resync 3. Ordem da VOLTA → V1 7 curvas, resync 1
  (o carro saiu do box depois da CURVA 01); V2 8 curvas, resync 0. Nenhuma curva perdida; ápice de emergência 0 nos dois.
  Conclusão: medida não se perde nesta gravação, mas na ordem do arquivo o carro depende da vigia paralela 3×/volta.
  Código do carro NÃO alterado (fora do pedido).
- schema-parity no HEAD limpo (worktree descartável em 0f95e55b0): 11 ok / 4 fail, igual → falha anterior à obra.
- Resto da esteira: 24/24 antes do schema-parity, 54/54 depois (inclui trechos-volta).

## Teste no notebook (27/10 14:36) — ponto de parada 1027-1435
- 64884a9b4 no GitHub. Notebook roda cockpit antigo; botão único "Atualizar e abrir o ensaio" na página da ponte (gps.cmd fecha o cockpit,
  compila base-g, abre o ensaio de TESTE). Aguardando o relato em ponte/recebidos. Passe: ~/.claude/retomadas/20261027-1435-p1fast.md

## 27/10 15:00 — TV do box não ouvia o canal de TESTE (sem commit)
- Causa: web/cockpit/cloud-bridge.js fixava cockpit-bubi-live; ?canal= da página só mudava o selo. A página liga a ponte em 3 blocos.
- Conserto: a ponte lê ?canal=cockpit-bubi-* do endereço (+ usarCanal(nome) antes de conectar); cópia iOS idêntica; TV chama usarCanal.
- Prova: Chrome sem janela → canal dev-teste, __tvGps.ativo, agora com lat/lng do RaceBox; controles: ?canal=outro-canal e sem ?canal → live.
  Smokes gps-tv 90/90, cockpit-web 16/16, live-data-bridge 26/26, pagina-volta 46/46, trechos-volta 24/24. Backup .claude-exec/backup-tv-canal-teste-20261027-1500.

## 27/10 15:15 — MODO RACEBOX na TV do box (sem commit; Flávio: "vai ter que vir tudo do RaceBox")
- Camada nova no fim do <body> de _design-reference/mockup-command-box-vista-piloto.html (liga no 1º ponto racebox fix 3; DEV não liga):
  velocímetro = kmh do RaceBox; odômetro = km rodados na sessão (haversine, kmh>=3, accM<=10); cabeçalho só GPS (satélites) e REC,
  resto "—"; blocos sem fonte no RaceBox cobertos "não vem do RaceBox" (todos menos mapa/hud/header); recado do cabeçalho escondido.
- Achado: o HUD honesto (setupLigacaoAoVivo) vive noutro escopo e NUNCA substituiu updateLiveHUD/liveSpeed (velocidade mostrava a volta
  de exemplo, 89 km/h parado). Conserto: updateLiveHUD chama window.__hudReal no modo RaceBox. Feeder da volta gravada para com __tvRacebox.
- Prova (Chrome sem janela, tocar-tv.mjs no scratchpad abdcf5f9 .../tv-headless, 1500 pontos gravados do canal de TESTE): vel 0–1 (RaceBox),
  odômetro 000.0, GPS 15–16sat, 13 blocos cobertos. Backup: .claude-exec/backup-tv-canal-teste-20261027-1500/*.antes-modo-racebox.html
- FALTA: (1) traçado cinza da pista sumiu do mapa no modo RaceBox (#track visível pelo CSS, bloco mapa com cb-sem-real aos 3 s) — investigar;
  (2) rodar smokes de novo; (3) commit+push na branch; (4) notebook PAROU de transmitir às 15:06:47 ao sair andando (5,8 km/h) — provável
  sem internet no carro; conferir a gravação quando ele voltar.

## RETOMADA 1027-1514 (27/10)
- Continua do item 1 do passe: traçado cinza sumido no modo RaceBox → smokes → commit/push só dos 3 arquivos → canal de teste/gravação.
- 15:20 Traçado sumido = defeito ANTERIOR ao modo RaceBox (controle: backup antes-modo-racebox também some). Causa medida: a camada
  TV-GPS pendura o rastro dentro de .track-transformed (transform-box: fill-box); carro no box → ponto do rastro em x=-3460 →
  caixa do grupo cresce → asfalto vai de 364,537 para -1504,-1021 na tela. Conserto: centro de giro fixo 596.55/580.11 view-box
  (igual a .markers-transformed). Depois: asfalto fixo em 365,537 aos 1/2/3/5/10 s. Prova permanente no smoke gps-tv (91/91;
  controle com a versão antiga 90/1 fail). cockpit-web 16, live-data-bridge 26, pagina-volta 46, trechos-volta 24.
  Commit d60fdb9aa na branch claude/gps-base-g-racebox-20261027 (push ok). Backup: backup-tv-canal-teste-20261027-1500/*.antes-centro-fixo-pista.html
- Canal de teste: última posição 15:06:47 (44087 linhas); escuta em 2º plano acorda a janela quando voltar ou a gravação chegar (até 18:23).
- 15:5x Flávio: "não funcionou com o celular, funcionou enquanto estava com o wifi". Canal: nada depois de 15:06:47; nuvem (prod, leitura):
  última sessão 14:27 (595 gps) — gravação da rua não subiu; notebook sem falar com a ponte desde 14:47.
  Causa provável no código: SupabaseRealtimeChannel sem prazo em enviar/conectar/fechar → rede morta prende o laço da nuvem.
  Prova: teste RedeCaiNoMeioDoEnvio_DesisteEReligaNaRedeNova TRAVOU no código antigo (fechar socket morto sem prazo);
  com o conserto (10 s conectar, 5 s enviar, 2 s fechar) Domain.Tests 606/606. Commit 9ee11ab2e (push ok).
  Backup: .claude-exec/backup-nuvem-troca-de-rede-20261027/SupabaseRealtimeChannel.cs
- PRÓXIMO: recado ao notebook no claude-comms (molde mensagens/20261027T172151Z-de-imac-para-notebook.md): build do 9ee11ab2e;
  quando a gravação do teste chegar, conferir no log se ficou "offline-enfileirando" depois de trocar de rede.
  Escuta b52gkdeyu (canal/gravação) segue até 18:23.
- 16:04 ponto de parada 1027-1604 (passe ~/.claude/retomadas/20261027-1604-p1fast.md).

## RETOMADA 1027-1604 (27/10)
- 16:06 recado ao notebook publicado no claude-comms (6508247cb, mensagens/20261027T190607Z-de-imac-para-notebook.md):
  build do 9ee11ab2e (606/606), ensaio no canal de TESTE, teste de troca Wi-Fi -> celular parado no box (~15 s para voltar),
  trazer a gravação da rua de 15:0x.
- Nuvem (prod, leitura, régua com controle: corte 14h acha 14:27, corte 15h acha 0): gravação da rua não subiu.
- Escuta nova vigia-rua.sh (scratchpad 24644c94…) até ~18:40: canal de TESTE, gravações da ponte, resposta no comms, sessão na nuvem.
- 16:1x Combinado com a janela «P1FAST - tela no Box ao vivo» (SendMessage to: imac-7c), que audita a TV do box numa branch/worktree
  nova (tv-box-aovivo): (1) antes de escrever em mockup-command-box-vista-piloto.html, cloud-bridge.js ou SupabaseRealtimeChannel.cs,
  avisar imac-7c; (2) quando a gravação da rua chegar ou o notebook responder, mandar a imac-7c o resultado em 3 linhas
  (ficou offline? quanto tempo? religou?).
- 16:3x Achado da janela imac-7c CONFIRMADO no código: LacoNuvemAsync marcava a tentativa ANTES do ConnectAsync, que volta antes
  do phx_reply → no celular (conectar > 2 s) derrubava a conexão nova em laço. Mesmo defeito no T4000Capture.
  Conserto 42535e946: Domain/ReligacaoNuvem.cs (regra única; espera do FIM da tentativa; socket aberto sem join até 10 s),
  SupabaseRealtimeChannel.AguardandoEntrada, os 2 laços usam a regra; ReligacaoNuvemTests 3 (controle antigo: 2 reprovam).
  Domain.Tests 609/609; T4000Capture compila; UI WinUI não compila no Mac (XamlCompiler.exe). Backup .claude-exec/backup-religacao-espera-entrada-20261027.
  Recado ao notebook atualizado (da840e51d: compilar 42535e946). imac-7c avisada para rebasear.
