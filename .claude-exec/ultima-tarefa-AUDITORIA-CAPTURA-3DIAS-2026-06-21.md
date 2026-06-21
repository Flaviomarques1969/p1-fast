# TASK_INIT — Auditoria de verdade + plano dos 3 dias (captura T4000+GPS+vídeo no notebook)

## Pedido original (Flávio) — 2026-06-21
"Desenvolvemos a semana toda; você disse que tinha feito a captura dos dados da T4000 e do GPS. Ontem
testamos, você disse que não salvou na nuvem; pedi pra consertar, você disse que tinha consertado; hoje
testamos de novo e não estava feito. Perdemos os testes de pista. Agora temos 3 dias pra finalizar o
aplicativo que roda no notebook Windows e captura T4000 + GPS + vídeo do Osmo 6 (videoconferência).
Faça análise profunda do que existe e do que foi feito. Use um AUDITOR pra checar as verdades do que
você me fala. Crie uma COMISSÃO pra checar evidências e montar um plano de trabalho."

## Objetivo (1 frase)
Estabelecer, só com evidência verificável, o que de fato existe/foi feito na captura (T4000+GPS+vídeo),
auditar minhas afirmações, e entregar um plano de trabalho para o app do notebook em 3 dias.

## Critério objetivo de conclusão
(1) Tabela de verdade das minhas alegações (verdadeiro/falso/parcial) com evidência arquivo:linha;
(2) inventário real do que captura, onde salva (local x nuvem), o que está testado;
(3) plano dos 3 dias priorizado, com critério de pronto e riscos. Tudo sem inferência.

## Leitura confirmada
- ~/.claude/CLAUDE.md: sim · memória global + memória P1 Fast: sim · CLAUDE.md do projeto +
  ARQUITETURA_DEFINITIVA + ADR-023: sim.

## Estado REAL já verificado (não inferido) antes de abrir a comissão
- Gravador local existe: `web/cockpit/session-recorder.js` + cópia em `web/teste-aparelhos/`. Captura
  MOTOR (10 Hz, cru) no painel do piloto (banco `p1fast-sessoes-cockpit`) e GPS (taxa cheia, cru) na
  Central (banco `p1fast-sessoes`). DOIS bancos LOCAIS (IndexedDB no navegador), separados.
- NÃO há upload da sessão CRUA completa pra nuvem. O que vai pra nuvem hoje:
  (a) canal ao vivo `cockpit-bubi-live` (transmissão efêmera, não é arquivo);
  (b) `web/cockpit/voltas-persister.js:44` grava em tabela `sessoes` (resumo de volta — a confirmar
      o que exatamente);
  (c) `src/pipeline/iphone-uploader.js` = caminho do iPhone, marcado "Etapa 3" (não ligado).
- Decisão registrada do PRÓPRIO Flávio em 21/06 (opção C): manter os 2 bancos separados, gravação 100%
  LOCAL, e NÃO fazer upload agora (`p1-fast-gravador-blindagem-2026-06-21`).
- App do notebook Windows EXISTE: `windows/cockpit/P1Fast.Cockpit.sln` com projetos Domain, UI,
  **T4000Capture**, **T4000LiveDemo** (o "LiveDemo" levanta suspeita de demonstração), Domain.Tests.
  Estado real (compila? captura de verdade ou demo?) = a comissão verifica.
- Vídeo Osmo 6 / Daily.co: aparece em `web/teste-aparelhos/index.html` e no iOS (VoltaVideoIndexer,
  AssistirView). Se existe gravação/transmissão do vídeo no NOTEBOOK = a comissão verifica.

## Ambiente alvo: desenvolvimento. Produção protegida: sim.
## Autorização para produção: não. Evidência: não recebida.
## Risco: alta carga emocional + prazo (3 dias) + tests de pista perdidos. Não inventar, não prometer.
## Status inicial: iniciado (comissão + auditor disparados).

## PUBLICAÇÃO AUTORIZADA E FEITA 21/06 (produção)
- Autorização literal do Flávio: "MIGRAR PARA PRODUÇÃO: página de resgate dos dados (resgate.html no p1t4000)".
- Construído: web/cockpit/resgate.html (NOVO, aditivo). Lê os bancos locais do navegador
  (p1fast-sessoes-cockpit = motor; p1fast-sessoes = GPS), lista sessões com contagem/duração e baixa
  cada uma em arquivo JSON. NÃO escreve em nuvem, NÃO cria tabela, NÃO toca no painel.
- Por que NÃO foi envio automático pra nuvem: não há bucket de storage; criar tabela nova exigiria
  `db push` que arrastaria a migração 0044 (vídeo) NÃO aplicada em prod = mudança não autorizada. Evitado.
- Publicado via Vercel (projeto p1t4000), deployment dpl_7Jp6ZN8DZXneWo7fvuzFc6f5hfSp, target production, READY.
- Validação pós-publicação: p1t4000.vercel.app/resgate.html = HTTP 200 (título + "Baixar TUDO" presentes);
  p1t4000.vercel.app/ = HTTP 200, main-t3000.js AINDA com RecCockpit(11)/__P1_BAIXAR_SESSAO__/blindagem
  = painel do piloto intacto. Rollback se preciso: remover resgate.html e republicar.
- PENDENTE de fato real: saber se há dado gravado naquele notebook (só verificável abrindo a página LÁ).
- Comissão + auditor (em segundo plano) seguem montando a tabela de verdade + plano dos 3 dias.

## ACHADOS VERIFICADOS 21/06 (resgate do dado) — leitura, sem alterar nada
- NUVEM (projeto fvhwltzhytpnhlqbttmd, leitura via REST com chave anon):
  - tabela `sessoes`: NENHUMA sessão real de 20/06 (dia) nem de 21/06. As de junho são blips de
    segundos (20/06 02:23 = 2,8 s; 18/06 = 5 s). Sessões reais mais recentes = MAIO (24/05, 23/05).
  - tabela `voltas`: última volta real gravada = 25/05 (created_at). NADA de 20-21/06.
  - tabela `passagens`: NÃO EXISTE (PGRST205). O JSON dados-nuvem-HOJE veio de outra origem.
  - CONCLUSÃO: o dado de pista NÃO subiu pra nuvem. Confirmado por consulta direta.
- PÁGINA PUBLICADA p1t4000.vercel.app (a que estava no notebook): TEM o gravador embutido —
  marcadores no JS publicado: session-recorder, criarGravador, RecCockpit (10x), __P1_BAIXAR_SESSAO__,
  p1fast-sessoes-cockpit, blindagem. Ou seja, se o painel estava aberto com o T3000/T4000 ligado, o
  MOTOR foi gravado no IndexedDB `p1fast-sessoes-cockpit` DAQUELE notebook (local, não na nuvem).
- ACESSO AO DADO LOCAL: a página expõe no navegador `window.__P1_REC__` (gravador),
  `window.__P1_REC__.listarSessoes()` (lista) e `window.__P1_BAIXAR_SESSAO__(id)` (baixa arquivo).
  Recarregar a página NÃO apaga o IndexedDB (mesma origem). LIMPAR cache/dados do site APAGA.
- GPS completo só existe se a página da Central (teste-aparelhos) também estivesse aberta; o painel
  grava GPS só do espelho (parcial). Motor é o que está garantido se o painel gravou.
