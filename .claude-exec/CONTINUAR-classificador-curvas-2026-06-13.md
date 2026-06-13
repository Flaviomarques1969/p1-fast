# CONTINUAR — CLASSIFICADOR DE CURVAS (P1 Fast) — checkpoint 13/06/2026

## GATILHO DE RETOMADA (o que o Flávio cola depois do /clear)
`/voltei classificador-curvas` — e SE este arquivo não for aberto automaticamente, leia-o:
`/Users/imac/Projetos/P1 Fast/.claude-exec/CONTINUAR-classificador-curvas-2026-06-13.md`
Ao retomar: rode TASK_INIT (frente "classificador de curvas — 1ª fatia"), leia os 6 protocolos do
Padrão Flávio, e continue do bloco "PRÓXIMO PASSO" abaixo. NÃO recomeçar do zero — está quase pronto.

## O QUE É ESTA TAREFA
Pedido literal do Flávio (13/06): "pode começar o classificador" (após decidir liberar a 1ª fatia).
Objetivo: classificar as 8 curvas de Brasília fora do carro, com os dados reais existentes, e
entregar uma PÁGINA pro Flávio validar curva a curva. Offline, NÃO toca produção nem cockpit ao vivo.

## AMBIENTE ISOLADO (onde tudo está)
- Worktree (ambiente isolado): `/Users/imac/Projetos/p1fast-worktrees/classificador-trail`
- Linha de trabalho separada: `claude/classificador-trail` (criada a partir da versão oficial `main`)
- `node_modules` é um atalho (symlink) pro repo principal — JÁ está fora do controle de versão
  (.gitignore ganhou a linha `node_modules`). NÃO re-incluir; se a bateria reclamar de
  "tracked artifact node_modules", rodar `git rm --cached node_modules`.

## O QUE JÁ ESTÁ PRONTO (com prova)
Tudo no worktree acima:
- `web/cockpit/classificador-trecho.js` — motor puro. Mede velocidade de ENTRADA como o PICO até a
  mínima (não o 1º ponto), razão = pico/Vmin, árvore de 6 tipos + SF + ND, g lateral só se plausível,
  raio = mediana do terço mais fechado. Honestidade do dado embutida (telemetria ~1 Hz).
- `tools/classificar-brasilia.mjs` — roda o motor nas 8 curvas reais (gate descarta volta de saída de
  box, Ve<50). Gera `relatorios/classificacao-brasilia-resultado.json`.
- `tools/gerar-pagina-validacao.mjs` — gera a página `relatorios/classificacao-brasilia-validacao.html`
  (dados embutidos; abre direto com `open`, sem servidor). Largura total, sem emojis, tratamento "você".
- `tests/node-smoke-classificador-trecho.mjs` — 24 verificações, todas verdes; já está na bateria
  (`package.json` script `smoke`, e atalho `smoke:classificador`).

## RESULTADO ATUAL DA CLASSIFICAÇÃO (honesto)
- CURVA 01 → T0 MÉDIA CLÁSSICA (confiança média)
- CURVA DA RETA OPOSTA → T1 LENTA PÓS-RETA (baixa)
- CURVA 2 → T1 LENTA PÓS-RETA (média)
- CURVA DA JUNÇÃO → T1 LENTA PÓS-RETA (baixa)
- CURVA DA BRUXA → ND (freada antes do trecho; acelera na saída)
- CURVA DO PLACAR → SF SEM FREADA (pé embaixo, Vmin 142)
- CURVA "S" → ND (freada antes do trecho)
- CURVA DA VITÓRIA → ND (freada antes do trecho)
Limite honesto: dado de maio é ~1 Hz → raio/perfil grossos; 3 curvas indeterminadas porque a freada
cai fora do recorte da passagem. Recomendação registrada na página: regravar a 25 Hz (RaceBox Mini S,
já chegou). Só 4 dos 7 tipos apareceram (T2/T3/T4/T5 ausentes) — declarado na página.

## REVISÕES ADVERSARIAIS
- 1ª revisão (5 lentes, 21 agentes): 15 achados confirmados — TODOS corrigidos (medição da velocidade
  de entrada; remoção do texto falso "janela de 30 m"; dangling-else do perfil; Vmin~0 = falha GPS;
  aceleraSaida = Vs-Vmin; raio com sanidade física; largura total da página; aviso dos tipos ausentes;
  cards sem dado entrando na exportação; gate de out-lap; kmh null na borda). Bateria verde após.
- 2ª revisão (re-revisão enxuta, 3 lentes) CONCLUÍDA: 23 pontos confirmados resolvidos + 2 regressões
  finas achadas e JÁ corrigidas: (a) motivo da CURVA DA BRUXA agora honesto (não afirma "1º ponto"
  quando semAproximacao=false; texto: "a velocidade quase não cai no recorte... pode ser trecho de
  saída/aceleração"); (b) raio de trecho quase reto (ângulo < 25°) é OMITIDO em vez de exibir número
  enganoso (novo limiar anguloMinCurvaDeg=25); (c) banner da página honesto e dinâmico (conta as ND);
  (d) T0/T1 agora citam a aceleração de saída no motivo. Bateria VERDE + 24 testes verdes após as
  correções. ESTADO: LIMPO.

## PRÓXIMO PASSO (em ordem, ao retomar) — ESTÁ LIMPO, FALTA SÓ ABRIR
1. Abrir a página pro Flávio (EU abro — regra dura). A página JÁ está gerada e verificada:
   `open "/Users/imac/Projetos/p1fast-worktrees/classificador-trail/relatorios/classificacao-brasilia-validacao.html"`
   (Opcional, garantir fresca antes: `cd` no worktree e
   `node tools/classificar-brasilia.mjs && node tools/gerar-pagina-validacao.mjs`.)
2. Flávio valida/corrige o tipo de cada curva (a página exporta um JSON, ou ele responde no chat).
   Registrar a decisão em `~/.claude-decisoes` (padrão de cards).
3. Fechar com TASK_DONE. Nada vai pra produção sem a frase "MIGRAR PARA PRODUÇÃO".

## DECISÕES DO FLÁVIO JÁ TOMADAS (13/06, registradas em ~/.claude-decisoes/respostas/p1-fast/)
1. "Trail certo" = as 3 condições juntas; a 3ª é "manteve a frenagem até a VELOCIDADE MÍNIMA (Vmin)",
   NÃO até o ápice (o painel já fazia assim).
2. Gráfico-alvo aparece em toda reta (sempre que o treino estiver ativado no Planejamento do Stint).
3. Classificador: 1ª fatia liberada (esta tarefa).

## OUTRAS FRENTES ABERTAS (não confundir)
- PAINEL COCKPIT-TREINO (trail braking): foi reaberto em tempo real pra validação do Flávio (replay).
  O processo morre no clear. Pra reabrir: `cd /Users/imac/Projetos/p1fast-worktrees/cockpit-treino-trail`
  e `node tools/replay-trail-local.mjs 10 manter 1`. AGUARDA validação visual do Flávio.
- COMMAND BOX: existe um TASK_INIT de OUTRA sessão no `.claude-exec/ultima-tarefa.md` (ligações reais
  do Command Box). NÃO é esta linha de trabalho — não misturar. O TASK_INIT do classificador foi
  preservado em `.claude-exec/ultima-tarefa-backup-pre-command-box-2026-06-13.md`.

## COMANDOS ÚTEIS
```
cd "/Users/imac/Projetos/p1fast-worktrees/classificador-trail"
npm run smoke                              # bateria completa (deve dar exit 0)
node tools/classificar-brasilia.mjs        # reclassifica as 8 curvas
node tools/gerar-pagina-validacao.mjs      # regenera a página de validação
```
