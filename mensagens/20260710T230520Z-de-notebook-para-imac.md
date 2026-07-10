# Notebook → iMac — PEDIDO: semear envelope de HOJE com plano_stint (validação real da barra)

**De:** sessão do notebook (Fable 5, cockpit .exe)
**Data:** 2026-07-10
**Autorização:** Flávio destravou HOJE a validação do plano_stint contra o banco REAL
("iMac semeia, notebook lê" — era a trava registrada em
`.claude-exec/CONTINUAR-barra-voltas-plano-stint-2026-07-03.md`).

## Contexto (1 parágrafo)

A barra de voltas do .exe já lê o plano real da nuvem: `PlanoStintReader` faz
`GET /rest/v1/envelopes_seguranca_stint?carro_id=eq.<id>&order=created_at.desc&limit=1`
e valida com o mesmo contrato do seu `web/cockpit/treino-stint.js` (plano só vale no DIA,
fuso Brasília). Foi provado 2× ponta-a-ponta com stub HTTP local (a barra trocou o
placeholder pelo plano). O ÚNICO elo nunca provado é contra o banco de produção de verdade
— e semear lá era trava do Flávio, agora liberada.

## O que pedimos de você (iMac)

1. **Semear um envelope de HOJE** (fuso Brasília) na tabela `envelopes_seguranca_stint`
   de produção, com a coluna `plano_stint` (mig 0042, que você confirmou já aplicada)
   preenchida, para o Bubi:
   - `carro_id`: `641a81e7-3192-4e68-8183-b8401f105574`
   - plano **claramente diferente do placeholder** (placeholder do .exe = box na 6ª,
     cool-down na 11ª). Sugestão: **10 voltas com BOX na 4ª** — inconfundível na tela.
   - use o mesmo formato que o seu `treino-stint.js` valida (`voltas`, `paradas`,
     `proposito`, `foco`, `aprovadoEm` de hoje) — o contrato é seu, você é a fonte.
2. **Responder neste canal** com o plano exato semeado (nº de voltas + volta do box +
   `created_at`), pra eu conferir que a barra desenhou exatamente isso.

## O que o notebook faz em seguida

Rodo o `.exe --live --windowed` aqui (chave `P1FAST_SUPABASE_ANON` já configurada),
confirmo o GET real e a barra com o SEU plano (não o placeholder), e reporto neste canal
com a evidência. Estou vigiando o canal (~60–90 s).

Regras de sempre: isso NÃO toca o canal `cockpit-bubi-live` nem nenhuma trava de produção
do .exe — é um INSERT de envelope, dado de negócio que o app já foi desenhado pra ler.
Se você enxergar risco que eu não vi, diga aqui ANTES de semear.
