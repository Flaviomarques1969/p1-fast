# JANELA 5 (Opus 4.8 · 1M) — Cenários reais ponta a ponta + Auditoria de coerência (QA)

> **Cole este prompt numa janela do Claude Code em Opus 4.8 (1M), aberta na raiz `/Users/imac/Projetos/P1 Fast`.** Você é uma trabalhadora sob o maestro **Fable 5**, que coordena sob demanda de outra janela.

## Contexto obrigatório (leia antes de produzir)
- `.claude-exec/PROMPT-FABLE5-COACH-IA-STINT.md` — briefing mestre (missão, restrições duras, fundação, fontes-da-verdade). **Absorva por inteiro** — você é quem prova o conjunto e caça furo.
- Dado real para os cenários: `web/command-box/fixtures/passagens-bubi-brasilia.v1.json`, `web/cockpit/apices-semente-brasilia.js`, `web/command-box/tipos-curva-brasilia.js`. As 8 curvas de Brasília estão no briefing (Seção 4.6).
- `.claude-exec/coach-ia-sala/PLANO-MESTRE.md` + as entregas das outras janelas em `entregas/janela-1..4.md` (você depende delas).

Regra dura: **não invente**. Cada cenário sai de dado real; se faltar, escreva "não encontrei X".

## Sua frente (o que é SÓ seu)
1. **3 a 5 cenários trabalhados ponta a ponta**, com curvas e dados reais de Brasília. Cada cenário mostra: a **oportunidade** eleita (no formato da Janela 2) → o **gráfico com zoom** que apareceria (mockup, no padrão da Janela 3) → a **mensagem de ensino** exata (no modelo da Janela 1) → o **timing** (quando surge). Ex.: "freada cedo recorrente na Curva da Bruxa custando 0,12 s/volta".
2. **Auditoria de coerência (QA adversarial):** confira se as saídas de J1–J4 **encaixam de verdade** e **cumprem a régua dura** — a mensagem de J1 cabe no espaço que J3 reservou? o gráfico usa o objeto de J2? o pacote de J4 carrega tudo? algum furo, contradição ou regra quebrada (fundo preto, sem emoji, "você", 956×440, número sem sinal, timing seguro, ganho em segundos, painel preservado)? Aponte gaps.
3. **Devolva os achados ao Fable** (é ele quem manda a correção pras janelas) e registre-os na sua entrega.

## Fronteira (NÃO faça)
- **Não** projete as primitivas (metodologia, seleção, gráfico, integração). Você **usa, prova e estressa** o que as outras produzem. Você é o teste de realidade do conjunto.

## Entrega
Mantenha viva em **`.claude-exec/coach-ia-sala/entregas/janela-5.md`**: os cenários ponta a ponta e o relatório de auditoria de coerência (o que encaixa, o que fura, os gaps, com a janela responsável de cada achado). Completa e autoexplicativa — o Fable audita numa passada só.

## Canal com o Fable (sob demanda — sem loop, pra não gastar à toa)
Você **não fica em vigia**. Como depende das outras, trabalhe no que já dá e conclua quando tiver material.
1. **Enquanto trabalha:** registre marcos/achados em `.claude-exec/coach-ia-sala/canal/janela-5/para-fable.md` se quiser (só você escreve, sempre acrescentando, hora `date -u +%FT%TZ`). Achado urgente de auditoria pode ir aqui já, sinalizando a janela responsável.
2. **Ao CONCLUIR (ou travar esperando outra janela): deixe TUDO PRONTO.** Finalize `entregas/janela-5.md` e acrescente em `para-fable.md`:
   ```
   ### [hora ISO] — Janela 5 · PRONTO PARA AUDITORIA
   Entrega: entregas/janela-5.md (completa)
   Resumo (até 5 linhas): ...
   Consumi: entregas de J1–J4 · dado real de Brasília · Produzi: cenários + relatório de coerência
   Autoconferência da régua: preto · sem-emoji · você · 956×440 · número-sem-sinal · só-dado-real · timing-seguro · ganho-em-s · painel-preservado
   Achados abertos (com janela responsável): <lista ou 'nenhum'>
   ```
   Depois **avise o Flávio, em uma linha:** «Terminei a Janela 5 — tudo pronto em entregas/janela-5.md. Avise o Fable: audita janela 5.» E **pare**.
3. **Quando o Flávio disser que o Fable respondeu:** leia `canal/janela-5/do-fable.md` e aplique — `SEGUIR`/`CORRIGIR` (corrige e repete o item 2)/`APROVADO`.
4. **Outras janelas:** leia `entregas/janela-1..4.md` o tempo todo (é sua matéria-prima). Achado sobre outra janela vai pro Fable, não direto pra ela.

## Conduta
Proponha; **o Flávio decide** negócio/escopo. Produção protegida. Sem conversa fiada: cada achado diz onde está o furo e de quem é.
