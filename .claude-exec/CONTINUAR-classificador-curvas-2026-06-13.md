# CONTINUAR — CLASSIFICADOR DE CURVAS (P1 Fast) — checkpoint 13/06/2026

## >>> ATUALIZAÇÃO 13/06 (fim do dia): 1ª VERSÃO DO COMMAND BOX CONSTRUÍDA <<<
A 1ª versão do "Command Box dos trechos" (classificação viva) FOI CONSTRUÍDA e auto-revisada.
NÃO recomeçar: ela já existe no ambiente isolado `classificador-trail`.
- Motor: `web/cockpit/trecho-estado.js` (observar/avaliarProposta/aplicarDecisao/tendencia).
- Ciclo: `tools/observar-brasilia.mjs` -> `relatorios/command-box-trechos-estado.json`.
- Painel: `tools/gerar-command-box-trechos.mjs` -> `relatorios/command-box-trechos.html` (responsivo, celular).
- Testes: `tests/node-smoke-trecho-estado.mjs` (31) na bateria; `npm run smoke` verde (919).
RESULTADO: 0 propostas — a observação das 7 voltas CONFIRMA a 1ª fatia; as 3 ND seguem aguardando 25 Hz.
Revisão adversarial (20 agentes): 13 achados, 0 críticos, todos os de honestidade/UX corrigidos.
PENDENTE: (1) validação visual do Flávio no painel; (2) ligar o ciclo ao vivo (hoje one-shot offline,
aprovar/recusar exporta JSON, ainda não realimenta o motor nem grava em banco/celular = fatia seguinte).
Registro da tarefa: `.claude-exec/ultima-tarefa-command-box-trechos-2026-06-13.md` (no worktree).
Memória: `p1-fast-classificador-vivo-command-box-trechos-2026-06-13`.
Reabrir o painel: `cd /Users/imac/Projetos/p1fast-worktrees/classificador-trail && open relatorios/command-box-trechos.html`.
## <<< FIM DA ATUALIZAÇÃO <<<


## GATILHO DE RETOMADA (o que o Flávio cola depois do /clear)
`/voltei classificador-curvas` — e SE este arquivo não for aberto automaticamente, leia-o:
`/Users/imac/Projetos/P1 Fast/.claude-exec/CONTINUAR-classificador-curvas-2026-06-13.md`
Ao retomar: rode TASK_INIT (frente "Command Box dos trechos — 1ª versão, classificação viva"), leia os
6 protocolos do Padrão Flávio, e CONSTRUA a 1ª versão conforme o bloco "PLANO DA 1ª VERSÃO" abaixo
(ordem do Flávio: construir já, auto-aperfeiçoável, sem re-perguntar direção; defaults declarados).
A 1ª fatia (8 curvas) JÁ está validada = estado inicial. NÃO recomeçar do zero nem reabrir o motor
`classificador-trecho.js` já revisado.

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

## VALIDADO 13/06 + VIRADA DE CONCEITO (classificação VIVA)
1ª fatia VALIDADA pelo Flávio: 8/8 curvas confirmadas sem correção (T0=Curva 01; T1=Reta Oposta/
Curva 2/Junção; SF=Placar; ND=Bruxa/S/Vitória). Registrado em ~/.claude-decisoes
(`20260613-150345-p1fast-validacao-curvas-e-classificador-vivo`) e na memória
`p1-fast-classificador-vivo-command-box-trechos-2026-06-13`.
VIRADA ditada: a classificação do trecho é VIVA, não fixa. Um agente observa cada passagem; quando o
piloto evolui (ex: deixa de frear numa curva), o tipo do trecho MUDA (proposto). Todos os trechos sob
observação. Criar um COMMAND BOX DOS TRECHOS: painel propõe mudar o trecho de uma condição pra outra
("parece melhor") e o Flávio aprova/ajusta no celular. A 1ª fatia vira o estado inicial aprovado.

## ORDEM DO FLÁVIO 13/06 (pós-validação): CONSTRUIR JÁ A 1ª VERSÃO, auto-aperfeiçoável
Literal: "podemos ter uma versão agora, e à medida que vai rodando você vai se auto aperfeiçoando.
Se organiza pra dar um clear e dar um comando completo pra que você saiba exatamente de onde continuar."
=> Ao retomar: rodar TASK_INIT (frente "Command Box dos trechos — 1ª versão"), ler os 6 protocolos, e
CONSTRUIR DIRETO (sem re-perguntar direção). Defaults declarados abaixo, ajustáveis depois.

## PLANO DA 1ª VERSÃO — Command Box dos trechos + classificador vivo (CONSTRUIR ao retomar)
Ambiente: seguir no ambiente isolado `classificador-trail` (já tem o motor e os dados). O motor
`classificador-trecho.js` (1 passagem -> tipo) é o NÚCLEO do agente — NÃO reabrir os 15+2 achados já
corrigidos. O que construir por cima:
1. `web/cockpit/trecho-estado.js` (módulo PURO): estado por trecho = { tipoAprovado,
   historicoObservacoes[], propostaPendente }. Funções: `observar(estado, passagemClassificada)` ->
   empilha tipo observado + confiança (janela rolante); `avaliarProposta(estado)` -> gera proposta se
   a tendência recente divergir de forma CONSISTENTE do tipoAprovado; `aplicarDecisao(estado,
   'aprovar'|'recusar', tipoNovo?)`. Auto-aperfeiçoar: ao aprovar, tipoAprovado muda e o histórico
   passa a ser a base nova.
2. `tools/observar-brasilia.mjs`: roda o ciclo sobre as 7 voltas reais (volta a volta, por trecho,
   classificando cada passagem com classificador-trecho.js, alimentando trecho-estado, gerando
   propostas). Estado inicial = a 1ª fatia VALIDADA (Curva 01=T0; Reta Oposta/Curva 2/Junção=T1;
   Placar=SF; Bruxa/S/Vitória=ND). Salva em `relatorios/command-box-trechos-estado.json`.
3. `tools/gerar-command-box-trechos.mjs`: gera o painel RESPONSIVO (abre no CELULAR) — lista os 8
   trechos: tipo aprovado vs tendência observada + propostas pendentes (de X pra Y + evidência) +
   botões aprovar/ajustar/recusar por proposta. Sem emojis, tratamento "você", largura total, dados
   embutidos (abre com `open`). Aprovação exporta JSON (padrão de cards) — banco/celular real = fatia
   seguinte.
4. `tests/node-smoke-trecho-estado.mjs` (entra na bateria via package.json): observar empilha; proposta
   só com consistência; ruído (1 divergência isolada / confiança baixa) é ignorado; aplicarDecisao
   muda o aprovado.
5. Revisão adversarial (Workflow, padrão do projeto) + `npm run smoke` verde + abrir o painel POR MIM.

DEFAULTS declarados (Flávio ajusta depois):
- Propõe mudança após 3 passagens recentes com o MESMO tipo observado divergente do aprovado, todas
  com confiança média+ (baixa não conta). 1 divergência isolada = ruído, ignora.
- Janela de observação: últimas 5 passagens por trecho (rolante).
- Aprovação no celular: página responsiva; aprovar/recusar exporta JSON no MVP. Integração com banco e
  celular real = fatia seguinte.
- ND (sem freada visível no dado de maio ~1 Hz) continua ND, marcado "aguardando dado melhor (25 Hz)";
  o agente NÃO força tipo onde o dado não permite.
- Telemetria do ciclo: usar as 7 voltas reais (passagens-bubi-aplicadas.json). 25 Hz (RaceBox) entra
  quando houver captura nova.

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
