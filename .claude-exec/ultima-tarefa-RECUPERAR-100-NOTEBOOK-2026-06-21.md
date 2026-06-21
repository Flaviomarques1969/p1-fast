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
