# TASK — Redesenho do bloco VMIN do Command Box (estudo + implementação opção A)

> Registrado em arquivo próprio porque `ultima-tarefa.md` está em uso por OUTRA sessão
> em paralelo (notebook?) — não sobrescrevi o registro dela pra não destruir contexto.

## Pedido original de Flávio
"a função vmin, em command box, não faz sentido o gráfico usado. vmin é uma velocidade em um ponto... faça um estudo com um agente avançado senior em pilotagem e veja a melhor forma de mostrar vmin... seria interessante mostrar também qual foi a velocidade do vmin na melhor passagem naquele trecho."

## Objetivo
Trocar a forma de exibir o Vmin (era gráfico de curva, errado pra valor pontual) pela opção escolhida por Flávio no card: número herói + Vmin da melhor passagem + barrinha de desvio, sem curva.

## TASK_INIT
- Protocolo carregado: sim
- Padrões carregados: sim (vazio)
- Ambiente alvo: desenvolvimento (design reference do Command Box)
- Produção protegida: sim
- Autorização para produção: não (não necessária — nada de produção tocado)
- Critério de conclusão: bloco mostra número do Vmin + "melhor NN" + veredicto + barrinha, sem curva, com dado real, sem erro, testes verdes, validado no navegador.

## Decisão que guiou (registrada)
Card `20260627-110638-p1-fast` (tipo ux) → escolha: "A — Número herói + melhor do trecho + barrinha fina (sem curva)".
Registrada em `~/.claude-decisoes/respostas/p1-fast/` e no `index.jsonl`. Card em `.claude-perguntas/respondidas/`.

## Sub-decisões aplicadas (defaults recomendados pelo estudo — reversíveis)
1. Barrinha de 1 dimensão MANTIDA (faz parte da opção A).
2. "alto" (acima da melhor passagem) = ÂMBAR, não vermelho — passar do recorde não é erro.
3. Referência ganha "~" quando a melhor passagem do trecho NÃO foi leitura limpa a 1 Hz (entra cravada com 25 Hz).

## TASK_DONE
- Pedido original conferido: sim
- Ambiente trabalhado: desenvolvimento
- Produção foi alterada: não
- Arquivos reais inspecionados: sim
- Alterações feitas: sim
- Testes/validação executados: sim (3 testes de Vmin + trava de arquitetura + navegador real)
- Resultado: concluído
- Pendências reais: nenhuma técnica; 3 sub-decisões acima são reversíveis a pedido.

### Arquivos alterados
- `web/command-box/vmin-curvas-reais.js` — expõe `vminRefKmh` (Vmin da melhor passagem) e `vminRefConfiavel` (adição pura; curva live/ghost preservada).
- `_design-reference/mockup-command-box-vista-piloto.html` — novo `buildVminPanel` + `vminTone`/`vminBarSvg` + CSS `vmin-*`. `vminChartSvg`/`vminCurveTone`/`VMIN_GHOST` preservados (não chamados).

### Preservado
- Telas congeladas (cockpit-volta-real.html, cockpit-app.html) — não têm o bloco, intocadas.
- Funções da curva antiga preservadas (reversível).
- Backup: `.claude-exec/backup-vmin-redesign-2026-06-27/` (tela + motor originais).

## Ajuste 3 — Vista limpa (esconder a casca de edição) (Flávio, mesma sessão)
Pedido: ao abrir a tela, vinha modo de edição / adicionar bloco / resetar / copiar layout /
alças de redimensionamento / legenda embaixo. Tem que aparecer só as funções do Command Box.
- Achado: a casca de edição é separada do Command Box (`.stage`). Estava sempre visível: `.edit-toolbar` (topo), `.page-meta` (caption "Mockup polido v1"), `.legend` (rodapé), `.export-panel`, `#atelier-salvar-wrap` (botão salvar). O "modo edição" em si já começava desligado (`editMode=false`).
- Solução NÃO destrutiva: por padrão a tela entra em "vista limpa" (`html.cb-clean`) e esconde só essa casca. O editor inteiro VOLTA abrindo a tela com `?edit=1`. Nada removido.
- Preservados e visíveis: `.stage` (Command Box), `.cb-voltar` (VOLTAR ao menu — navegação real), `#cb-live-selo` (status AO VIVO).
- Backup: `.claude-exec/backup-vmin-redesign-2026-06-27/mockup-pre-vista-limpa.html`.
- Validação: vista limpa esconde as 5 peças e mantém Command Box/VOLTAR/AO VIVO; `?edit=1` traz o editor de volta; trava de arquitetura 32/0; console sem erro.

## Ajuste 2 (Flávio, mesma sessão)
Pedido: tirar a linha "Celta 1.4 · Radial"; simplificar (tela pequena); mostrar o TEMPO da
melhor passagem e qual foi. Card de layout → escolha "Velocidade + tempo".
- Removida a linha carro/pneu do rodapé.
- Referência agora: "melhor [~]118 · 6.00s" em LINHA PRÓPRIA (antes dividia linha com o número e estourava).
- Rodapé virou "volta N" (a volta da melhor passagem).
- Dado: `vmin-curvas-reais.js` passou a expor `tempoRefS` (tempo da melhor passagem). `voltaRef` já existia.
- Tamanhos reduzidos (número 26px, gaps menores) — confirmado SEM transbordo (ref 116px < bloco 146px; altura 146=146).

### Validação executada
- `node tests/node-smoke-vmin-curvas-reais.mjs` → 9/0.
- `node tests/node-smoke-vmin-aprendizado.mjs` → 13/0.
- `node tests/node-smoke-retag-vmin.mjs` → 13/0.
- `node tests/node-smoke-arquitetura-dado.mjs` → 32/0.
- Navegador (porta 8078): 3 estados reais sem erro de console — aguardando (curva 1: "—" + melhor ~118), baixo (curva 1: 109, −9, melhor ~118), sem leitura limpa (curva 8: "—" + nota + melhor ~86). "Sem leitura limpa" também provado por injeção em `__aplicarVminReal`.
