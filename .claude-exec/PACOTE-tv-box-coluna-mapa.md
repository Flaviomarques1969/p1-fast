# MIGRAR PARA PRODUÇÃO: P1 Fast TV do box coluna à direita do mapa no p1box

> Status: PRONTO em desenvolvimento, 28/10/2026. Não publicado.
> Pedido do Flávio (painel p1fast-mapa-tv-2045, resposta em `~/Downloads/resposta-perguntar-p1fast-mapa-tv-2045.txt`):
> nada escrito em cima da pista; dados numa coluna à direita do mapa; consistência no stint; trecho e "a última perdeu"
> sem as voltas de aquecimento e resfriamento; quadrado premium MELHOR | ÚLTIMA.

## O que é
A TV do box (`https://p1box.vercel.app/tv/?tv=1`) troca o mapa com texto por cima por:
- pista limpa (nenhum texto em cima do traçado — medido: 0 de 600 pontos da pista cobertos);
- coluna à direita do mapa com: tempo, delta, quadrado MELHOR VOLTA | ÚLTIMA VOLTA, setores, trecho atual e "perdeu",
  círculo G (rótulos ACEL/FREIO ao lado, legíveis), contagens (pancadas, repetidas, trocas, traseira) e legenda;
- consistência e "mais longe da média" no bloco do stint;
- linha do trecho e "a última perdeu" contam só as voltas que valem: saem a 1ª volta depois de uma parada (aquecimento),
  a volta com a parada dentro e a volta que fecha logo antes de o carro parar (resfriamento). Na gravação de 21/06 o
  "perdeu CURVA 01 +1,38" que a TV mostrava vinha da volta de aquecimento e some.

## O que muda para a operação
- Só a tela da TV em `/tv/`. O favorito da Fire TV continua o mesmo endereço.
- Menu, Vista Piloto e Frenagem & Aceleração (as 41 telas do ar) seguem byte a byte iguais.

## Origem em desenvolvimento
- Worktree `~/Projetos/p1fast-worktrees/tv-box-aovivo`, branch `claude/tv-box-aovivo-e2-20261027`, commit `4b866482f`.
- Montador `tools/montar-p1box-tv.mjs` (o mesmo de 27/10) → `dist/p1box-tv` (82 arquivos), base
  `.claude-exec/p1box-ar-20261027/arquivos` (as 41 telas do ar, sem mudança).

## ENTRA (site p1box.vercel.app — projeto Vercel `p1box`, `prj_EE2vFPmwyKxRtvdmVNykAgRPtudi`)
Medido em 28/10 com `node tools/conferir-p1box-no-ar.mjs dpl_F3jLYeJ2NmS9g7xQb3Y68mpp4we5 dist/p1box-tv`:
82 × 82 arquivos, 79 idênticos (sha1), só estes 3 diferentes:
1. `tv/index.html` — a TV (coluna, pista limpa, stint, rótulos do G).
2. `tv/web/command-box/cerebro/cerebro-gps-tv.js` — cérebro: voltas descartadas (`s.trechos.validas`) e ideal pelos
   trechos das voltas que valem (`validas.voltaIdealS`, a TV ainda não mostra; fica pronto para o quadro de curvas).
3. `tv/web/command-box/cerebro/cerebro-tv-blocos-gps.js` — o pacote do stint repassa a consistência.

## NÃO ENTRA (explícito)
- As 41 telas do ar e o resto de `tv/` (79 arquivos idênticos ao ar).
- O quadro de curvas e o "ideal pelos trechos" no rodapé dele: existem só no protótipo do estudo
  (`P1 Fast/.claude-exec/estudo-mapa-tv-20261027/prototipo/`), que não é parte do site.
- `web/teste-aparelhos/` (Central de Pista, religação do vídeo de 27/10 — commit c399a9fc3) — não vai no p1box.
- Sites `p1tv`, `fam-racing`, `p1-teste-aparelhos`, `p1t4000`, `command-box-tv`; configurações do projeto p1box;
  Cockpit do notebook; canal `cockpit-bubi-live`; nuvem Supabase (nenhuma tabela, função ou migration).

## Provas em desenvolvimento (28/10)
- `tests/node-smoke-gps-tv.mjs` 106 ok / 0 fail (descarte com box antes e depois da linha, controle 10 s devagar,
  controle parada a 95%, 21/06 real; ideal = soma dos trechos da volta 2 = 159,597 s; controle: com todas as voltas = 158,172).
- `npm run smoke:montar-p1box-tv` 17/0 · `npm run smoke:arquitetura` 39/0 · `tests/node-smoke-tv-blocos-gps.mjs` 25/0.
- Régua da coluna `.claude-exec/obra-mapa-coluna-20261028/provar-coluna.mjs` (TV real, gravação 21/06, fim e `--pior`):
  0 pontos da pista cobertos, 0 cortes, 0 fora da coluna, menor letra 9,76 px na tela, 0 erros de script.
  Controle `--controle-antigo` (rótulos do G como antes) acusa ACEL/FREIO 3,9 px.
- Ensaio do pacote montado `.claude-exec/ensaio-pacote-p1box/ensaio-pacote.mjs`: 17 ok / 0 falha
  (AO VIVO / SEM SINAL / ATRASADO, isolamento em /tv/, 3 telas do ar sem nada de /tv/).
- Já existia antes desta obra e continua: `header × shift-light` encavalados 538×86 px no HEAD de 27/10 (medir-encavalados.mjs).

## Passos (só depois da frase)
0. Conferir que o ar não mudou: produção do p1box ainda é `dpl_F3jLYeJ2NmS9g7xQb3Y68mpp4we5`
   (`npx vercel inspect p1box.vercel.app` dentro de `"/Users/imac/Projetos/P1 Fast/dist/p1box"`) e
   `node tools/conferir-p1box-no-ar.mjs dpl_F3jLYeJ2NmS9g7xQb3Y68mpp4we5 dist/p1box-tv` lista SÓ os 3 arquivos do ENTRA.
   Mudou → PARAR.
1. `node tools/montar-p1box-tv.mjs && node tests/node-smoke-montar-p1box-tv.mjs` (com o commit `4b866482f` ou posterior
   que só mexa fora dos 3 arquivos; conferir com `git diff 4b866482f -- _design-reference web/command-box`).
2. Vincular: `mkdir dist/p1box-tv/.vercel && cp "/Users/imac/Projetos/P1 Fast/dist/p1box/.vercel/project.json" dist/p1box-tv/.vercel/`.
3. `cd dist/p1box-tv && npx vercel deploy --prod --skip-domain --yes` → publicação nova sem o endereço oficial (dpl_NOVO).
4. `node tools/conferir-p1box-no-ar.mjs <dpl_NOVO> dist/p1box-tv` = APROVADO (82/82; senão PARAR, não promover).
5. `npx vercel promote <dpl_NOVO> --yes` (dentro de `dist/p1box-tv`).

## Validação no ar
- `npx vercel inspect p1box.vercel.app` = dpl_NOVO.
- `node tools/conferir-p1box-no-ar.mjs <dpl_NOVO> dist/p1box-tv` = APROVADO; contra `dpl_F3jLY…` = só os 3 arquivos.
- `ENSAIO_URL=https://p1box.vercel.app node .claude-exec/ensaio-pacote-p1box/ensaio-pacote.mjs` = 17/17.
- Remover o vínculo `dist/p1box-tv/.vercel` no fim (devolver para desenvolvimento).

## Volta atrás (rollback)
`npx vercel promote dpl_F3jLYeJ2NmS9g7xQb3Y68mpp4we5 --yes` (dentro de `dist/p1box-tv` vinculado) → a TV volta a ser a
de 27/10. Nada mais a desfazer (nenhum dado, configuração ou nuvem muda).
