---
name: reference_p1fast_tv_box_onde_mexer
description: TV do box do P1 Fast — qual cópia vai para o ar, como tocar a gravação na própria TV e a armadilha do modo RaceBox com bloco novo
metadata:
  type: reference
---
- A TV publicada (p1box.vercel.app/tv) sai da worktree `/Users/imac/Projetos/p1fast-worktrees/tv-box-aovivo`, branch `claude/tv-box-aovivo-e2-20261027`, arquivo `_design-reference/mockup-command-box-vista-piloto.html`; a `gps-base-g` parou em 27/10 e NÃO vai para o ar (confirmado pelas janelas GPS e publicadora em 28/10). Antes de dar pronto: `npm run smoke:montar-p1box-tv` e `npm run smoke:arquitetura`.
- Tocar a gravação na própria TV (selo honesto, sem "ao vivo"): `?tv=1&replay-gps=21-06&speed=10` (servidor do Mac na porta 5201 serve a worktree).
- Armadilha: no modo RaceBox a TV cobre de "não vem do RaceBox" todo elemento com `data-block-id` que ela não conhece — peça nova dentro de um bloco existente NÃO leva data-block-id.
- Robô de teste: bloquear `/api/room` (ver [[reference_p1fast_robo_ocupa_vaga_sala_video]]).

## 28/10 (janela da coluna do mapa)
- Coluna `.b-mapa-dados` (atributo data-tv-mapa-dados, SEM data-block-id) à direita do mapa recebe tempos, quadrado MELHOR|ÚLTIMA, setores, trecho, contagens, G e legenda. Régua: `.claude-exec/obra-mapa-coluna-20261028/provar-coluna.mjs <pasta> '&speed=40&fim=parar' 60000 [--pior] [--controle-antigo]` (sem `&fim=parar` mede a tela já reiniciada, tudo em "—"; letra de SVG medida pela escala real do desenho — antes era cega e via 9 px onde havia 3,9).
- Cérebro `cerebro-gps-tv.js`: cada volta tem `descarte` (aquecimento/parada/resfriamento, marcado pela parada no box: <5 km/h por 20 s) e o pacote tem `s.trechos.validas` — linha do trecho e "a última perdeu" da TV usam SÓ ele (decisão do Flávio, painel p1fast-mapa-tv-2045). Campos antigos seguem com todas as voltas.
- O quadro de curvas ainda NÃO está na TV: só no protótipo `~/Projetos/P1 Fast/.claude-exec/estudo-mapa-tv-20261027/prototipo/` (quadro-curvas.js + comparativo.html).
- Cérebro: `s.trechos.validas.voltaIdealS` = ideal pelos trechos só das voltas que valem (21/06 = 159,597; com todas = 158,172). O rodapé do quadro de curvas do protótipo lê esse número da TV embutida.
- Modo RaceBox (27/10, d60fdb9aa) cobre 5 blocos sem fonte: carro, pneus, fuel-gauge, checklist, shift-light (`medir-cobertos.mjs` na pasta da obra lista). O que fazer com eles: painel p1fast-tv-blocos-sem-racebox-1151.
- Pacote pronto 28/10: `.claude-exec/PACOTE-tv-box-coluna-mapa.md` (no p1box só mudam tv/index.html + 2 cérebros; republica com o mesmo montador e a base de 01/07).
