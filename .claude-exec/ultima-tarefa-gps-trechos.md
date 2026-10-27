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
