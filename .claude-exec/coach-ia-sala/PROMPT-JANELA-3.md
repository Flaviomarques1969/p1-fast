# JANELA 3 (Opus 4.8 · 1M) — O Gráfico com ZOOM do trecho (Parte A)

> **Cole este prompt numa janela do Claude Code em Opus 4.8 (1M), aberta na raiz `/Users/imac/Projetos/P1 Fast`.** Você é uma trabalhadora sob o maestro **Fable 5**, que coordena sob demanda de outra janela.

## Contexto obrigatório (leia antes de produzir)
- `.claude-exec/PROMPT-FABLE5-COACH-IA-STINT.md` — briefing mestre. Foco: Seção 4.6 (geometria da pista de Brasília: `pista-oficial-brasilia.js`/`geoParaDesenho`, `pista-cb-polyline.js`/`fracDe`, `apices-semente-brasilia.js`, `tipos-curva-brasilia.js`), 4.7 (o painel aprovado e o fato de que **hoje não existe nenhum desenho de traçado** — o gráfico é elemento novo).
- Abra os arquivos reais do painel: `web/cockpit/cockpit-volta-real.html`, `web/cockpit/cockpit.css`, e o de referência `_design-reference/versions/cockpit-painel-APROVADO-2026-06-22.html`. Absorva o padrão visual (fundo preto `oklch(0% 0 0)`, paleta OKLCH, ícones de traço).
- `.claude-exec/coach-ia-sala/PLANO-MESTRE.md` — o **contrato de layout do miolo** (você divide o miolo com a Janela 1) e o **"objeto oportunidade"** da Janela 2 (o gráfico foca no trecho que ela apontar).

Regra dura: **não invente**. Se um conversor/dado não existir, escreva "não encontrei X".

## Sua frente (o que é SÓ seu)
O **gráfico com zoom do trecho onde o piloto está** (Parte A), no miolo da tela, tema escuro.
1. **O que o gráfico plota** — apresente opções e recomende: traçado da curva com a **linha do piloto vs a linha da referência**? perfil de **velocidade vs distância**? traço de **freio**? uma combinação? O que comunica a oportunidade em **relance**.
2. **Como faz o ZOOM** no trecho atual: recorte/ampliação da geometria da pista em torno do `segmentId` que a Janela 2 aponta, usando os conversores reais (`geoParaDesenho`, `fracDe`, ápices semente).
3. **Mockups** em tema escuro, dentro de **956×440**, que caibam no miolo **sem quebrar o painel aprovado** (sensores no topo, shift/ápice na base, delta à esquerda, freada à direita). Pode ser mockup em ASCII/descrição precisa + as medidas/posição.
4. **Onde senta** no miolo e **quando aparece/some** (alinhado ao timing que a Janela 1 define e ao contrato de layout do Fable).
5. Legibilidade a **alta velocidade** — nada que exija leitura demorada.

## Fronteira (NÃO faça)
- **Não** escreva a mensagem de ensino (Janela 1). **Não** projete o cérebro de seleção (Janela 2). Você **consome** o objeto oportunidade e desenha em cima dele.

## Entrega
Mantenha viva em **`.claude-exec/coach-ia-sala/entregas/janela-3.md`**: a escolha do que plotar (opções + recomendação), o método do zoom (com os conversores reais citados), os mockups escuros com medidas, a posição no miolo e as regras de aparecer/sumir. Completa e autoexplicativa — o Fable audita numa passada só.

## Canal com o Fable (sob demanda — sem loop, pra não gastar à toa)
Você **não fica em vigia**. Trabalhe até concluir e então deixe tudo pronto.
1. **Enquanto trabalha:** registre marcos em `.claude-exec/coach-ia-sala/canal/janela-3/para-fable.md` se quiser (só você escreve, sempre acrescentando, hora `date -u +%FT%TZ`). Opcional.
2. **Ao CONCLUIR (ou travar): deixe TUDO PRONTO.** Finalize `entregas/janela-3.md` e acrescente em `para-fable.md`:
   ```
   ### [hora ISO] — Janela 3 · PRONTO PARA AUDITORIA
   Entrega: entregas/janela-3.md (completa)
   Resumo (até 5 linhas): ...
   Consumi: objeto oportunidade (J2) · geometria da pista · Produzi: spec do gráfico
   Autoconferência da régua: preto · sem-emoji · você · 956×440 · número-sem-sinal · só-dado-real · timing-seguro · ganho-em-s · painel-preservado
   Dúvidas/decisões ao maestro: <ou 'nenhuma'>
   ```
   Depois **avise o Flávio, em uma linha:** «Terminei a Janela 3 — tudo pronto em entregas/janela-3.md. Avise o Fable: audita janela 3.» E **pare**.
3. **Quando o Flávio disser que o Fable respondeu:** leia `canal/janela-3/do-fable.md` e aplique — `SEGUIR`/`CORRIGIR` (corrige e repete o item 2)/`APROVADO`.
4. **Outras janelas:** leia `entregas/janela-*.md` (o objeto da J2, o layout/timing da J1); peça o que precisar via Fable.

## Conduta
Proponha; **o Flávio decide** negócio/preferência (o visual do painel é território sensível dele — proponha dentro do padrão, não substitua o padrão). Produção protegida. Sem conversa fiada.
