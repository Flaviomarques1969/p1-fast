# Auditoria — Intenção da arquitetura: a sessão inteira (liga->desliga) é gravada crua?

## Pedido (orquestrador)
Ler docs/ARQUITETURA_DEFINITIVA.md, docs/FONTE_DADOS_AO_VIVO.md, docs/PADRAO_CENTRAL_DADOS_AO_VIVO.md e responder:
a arquitetura canônica EM ALGUM lugar exige gravar a sessão inteira crua? Ou só fala de streaming ao vivo + derivados?
Persistência de sessão é requisito esquecido ou decisão explícita de não ter? Fatos com arquivo:linha.

## Objetivo (1 frase)
Estabelecer, com evidência, se a intenção canônica contempla gravar a sessão crua liga->desliga.

## Ambiente alvo: desenvolvimento (somente leitura — auditoria). Produção protegida: sim. Autorização produção: não recebida.

## Achados (resumo)
- ARQUITETURA_DEFINITIVA.md: só streaming/ao vivo; NÃO menciona gravar sessão. Seção 1 "nunca em lote".
- FONTE_DADOS_AO_VIVO.md:52: canal "sem persistência".
- PADRAO_CENTRAL_DADOS_AO_VIVO.md: canal broadcast sem persistência; sample não é persistido.
- ARCHITECTURE_DECISIONS.md ADR-003/004/014: persistência append-only EXISTE como intenção — mas LOCAL no device, e remoto só por batch FUTURO. Pipeline atual (web/cockpit) NÃO usa essa stack; persiste só derivado.
- src/telemetry/sample-store.js + session-recorder.js existem mas pertencem ao hub iOS/cockpit-mobile legado; live path não importa.

## Status: concluído (auditoria de leitura).
