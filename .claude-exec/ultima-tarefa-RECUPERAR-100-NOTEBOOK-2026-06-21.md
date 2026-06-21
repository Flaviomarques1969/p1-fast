# TASK_INIT — Recuperar 100% dos dados gravados no notebook (T4000 motor + GPS)

## Pedido original (Flávio) — 2026-06-21
"Preciso recuperar 100% dos dados gravados pela aplicação que você fez no notebook."

## Objetivo (1 frase)
Extrair, de forma íntegra e sem perder nada, TODAS as sessões gravadas localmente no
navegador do notebook (motor `p1fast-sessoes-cockpit` no painel/p1t4000 + GPS
`p1fast-sessoes` na Central/p1tv), não só a última.

## Critério objetivo de conclusão
(1) Página de resgate (lista TODAS as sessões + baixa cada uma + envia pra nuvem) no ar no
endereço EXATO em que cada app gravou; (2) Flávio abre no notebook e baixa/envia todas;
(3) confirmação por contagem (amostras/duração) de que cada sessão saiu íntegra.

## Leitura confirmada
- ~/.claude/CLAUDE.md: sim · memórias global + P1 Fast: sim · CLAUDE.md do projeto: sim ·
  ultima-tarefa-AUDITORIA-CAPTURA-3DIAS-2026-06-21 (recuperação parcial de hoje): sim.

## Estado REAL verificado (não inferido)
- Dado mora no IndexedDB do navegador DAQUELE notebook, preso ao ENDEREÇO (origin) exato em
  que o app estava aberto. Só é legível abrindo o mesmo navegador, no mesmo endereço.
- `web/teste-aparelhos/resgate.html` (Central): COMPLETO e funcional (lê os 2 bancos, lista
  TODAS as sessões, "Baixar tudo (reserva)" local garantido + "Enviar tudo pra nuvem").
  Está MODIFICADO no projeto, NÃO registrado e NÃO no ar (p1tv.vercel.app/resgate = 404).
- `web/cockpit/resgate.html` (painel): mesma versão (nuvem+reserva), JÁ no ar em
  p1t4000.vercel.app/resgate.html (HTTP 200).
- Tabela de recuperação na nuvem `sessao_dumps` (projeto fvhwltzhytpnhlqbttmd): EXISTE
  (REST anon respondeu [] em vez de erro).
- Recuperação parcial de hoje: painel p1t4000 = 0 MB (motor alta taxa NÃO foi gravado lá);
  Central = tinha sessão, Flávio baixou SÓ a última (16 MB GPS) pelo botão nativo.

## Risco / cuidado
- IndexedDB é destruído se "limpar dados do site"/cache naquele navegador. Recarregar NÃO apaga.
- Cross-origin: a página de resgate só enxerga o que foi gravado no MESMO endereço. Se o app
  rodou em endereço/programa diferente durante a corrida, o resgate tem que rodar LÁ.
- Carga emocional + prazo. NÃO inventar dado; NÃO prometer recuperar o que nunca foi salvo.

## Ambiente alvo: produção (p1tv é a Central que o piloto usa).
## Produção protegida: sim. Autorização para produção: NÃO recebida ainda.
## Evidência da autorização: não recebida.
## Status inicial: iniciado — investigação read-only feita; deploy aguarda autorização.

## PUBLICAÇÃO FEITA 21/06 (autorizada)
- Autorização literal: "MIGRAR PARA PRODUÇÃO: página de resgate no p1tv (Central)".
- Publicado na Central (projeto p1-teste-aparelhos), deploy dpl_Er819z4cLd3yGh9hKcaiNdWEzxbf,
  target production READY. Apelido p1tv reapontado pro deploy novo (gotcha do alias respeitado).
- ESCOPO RESPEITADO: tela do piloto (index.html) CONGELADA na versão do ar (2026-06-20-GRAVADOR);
  publicados só `resgate.html` (novo) + `session-recorder.js` novo (superset: só acrescenta
  estimarArmazenamento/classificarEspaco + campo `alarme`; nenhum export removido/alterado — a
  página de resgate precisa dele). Backup da tela do disco em /tmp/index-disco-BLINDAGEM.html;
  disco restaurado para 2026-06-21-BLINDAGEM depois do deploy.
- VERIFICAÇÃO (com cache-buster):
  - https://p1tv.vercel.app/resgate -> HTTP 200, título "Resgate dos dados gravados neste notebook",
    botões "Enviar tudo pra nuvem" + "Baixar tudo (reserva)", lê os 2 bancos (motor+gps).
  - session-recorder.js no ar exporta estimarArmazenamento (resgate não quebra).
  - p1tv (raiz) BUILD = 2026-06-20-GRAVADOR -> tela do piloto INALTERADA (sem regressão).
- PENDENTE (do Flávio, no notebook): abrir p1tv.vercel.app/resgate NO MESMO notebook da pista e
  baixar/enviar todas as sessões. Confere por contagem (amostras/duração) cada sessão.
- Verdade dura mantida: motor alta-resolução do painel (p1t4000) = 0 MB, nunca gravado, irrecuperável.
- Status: aguardando Flávio rodar no notebook pra fechar 100% do que está guardado.
