# JANELA 1 (Opus 4.8 · 1M) — Metodologia de coaching + a Mensagem (Parte B) + Timing

> **Cole este prompt numa janela do Claude Code em Opus 4.8 (1M), aberta na raiz `/Users/imac/Projetos/P1 Fast`.** Você é uma trabalhadora sob o maestro **Fable 5**, que roda em outra janela e coordena sob demanda.

## Contexto obrigatório (leia antes de produzir)
- `.claude-exec/PROMPT-FABLE5-COACH-IA-STINT.md` — o briefing mestre: missão, restrições duras, a fundação que já existe, e os arquivos-fonte-da-verdade. **Absorva por inteiro.**
- `.claude-exec/coach-ia-sala/PLANO-MESTRE.md` — o quadro do maestro: o **contrato entre janelas** (principalmente o **"objeto oportunidade"** que a Janela 2 te entrega e o **contrato de layout do miolo** que você divide com a Janela 3). Se ainda não estiver preenchido, comece pela metodologia e trabalhe contra um formato provisório, sinalizando.

Regra dura: **não invente** nada. Se um dado não existir, escreva "não encontrei X".

## Sua frente (o que é SÓ seu)
A **metodologia de coaching** e a **mensagem de ensino (Parte B)** que aparece no miolo da tela.
1. **Pedagogia de 1 foco por volta:** como um grande coach de automobilismo escolhe UM foco por volta e ensina em ciclo curto — orientar → ensinar → apontar a solução; como a lição evolui ao longo do stint (do erro grosso ao ajuste fino); quando calar. Fundamente em princípios reais de pilotagem e aprendizado motor.
2. **Modelo de conteúdo da mensagem:** o que a mensagem sempre carrega (o "quê", o "onde", o "como corrigir", o "quanto ganha"?), o tom ("você", sem emoji, ensino direto), e as **regras de tamanho/tempo seguras** para cada momento — resolvendo a tensão central do briefing (as frases do painel têm teto de 2 palavras; a sua mensagem de ensino é uma superfície diferente, mais rica, mas segura para quem guia a 200 km/h).
3. **Quando aparece (timing/segurança):** defina em que momento o coach surge (reta / fim de volta / janela de box / baixa carga) para **nunca** distrair no meio de uma curva, e como escalona (relance de 1 linha no calor da volta → explicação maior quando há folga).
4. **Exemplos escritos** da mensagem para cada tipo de oportunidade (técnica / curva específica / outro), usando curvas e nomes reais de Brasília.

## Fronteira (NÃO faça — é de outra janela)
- **Não** projete o algoritmo que ESCOLHE a oportunidade (é da Janela 2). Você **consome** o "objeto oportunidade" dela.
- **Não** desenhe o gráfico (é da Janela 3). Vocês dividem o miolo pelo contrato de layout do Fable.

## Entrega
Escreva e mantenha viva a sua entrega em **`.claude-exec/coach-ia-sala/entregas/janela-1.md`**, com as 4 partes acima. Onde houver bifurcação real, apresente opções + sua recomendação. Ela tem que ficar **completa e autoexplicativa** — o Fable audita numa passada só, sem cavar.

## Canal com o Fable (sob demanda — sem loop, pra não gastar à toa)
Você **não fica em vigia**. Trabalhe até concluir sua frente e então deixe tudo pronto.
1. **Enquanto trabalha:** se quiser, registre marcos em `.claude-exec/coach-ia-sala/canal/janela-1/para-fable.md` (você escreve **só aqui**, sempre acrescentando, hora com `date -u +%FT%TZ`). Opcional — o que importa é o pacote final.
2. **Ao CONCLUIR (ou travar precisando do maestro): deixe TUDO PRONTO.** Finalize `entregas/janela-1.md` e acrescente em `para-fable.md` o bloco:
   ```
   ### [hora ISO] — Janela 1 · PRONTO PARA AUDITORIA
   Entrega: entregas/janela-1.md (completa)
   Resumo (até 5 linhas): ...
   Consumi: <o que usei das outras> · Produzi: <a interface que entrego>
   Autoconferência da régua: preto · sem-emoji · você · 956×440 · número-sem-sinal · só-dado-real · timing-seguro · ganho-em-s · painel-preservado
   Dúvidas/decisões ao maestro: <ou 'nenhuma'>
   ```
   Depois **avise o Flávio nesta janela, em uma linha:** «Terminei a Janela 1 — tudo pronto em entregas/janela-1.md. Avise o Fable: audita janela 1.» E **pare** (não entre em loop).
3. **Quando o Flávio disser que o Fable respondeu:** leia `.claude-exec/coach-ia-sala/canal/janela-1/do-fable.md` (só o Fable escreve lá) e aplique — `SEGUIR`: siga; `CORRIGIR`: corrija e repita o item 2; `APROVADO`: encerre.
4. **Outras janelas:** LEIA `entregas/janela-*.md` a qualquer momento (ex.: o objeto da Janela 2). Se precisar de algo, **peça ao Fable** na sua `para-fable` — não escreva na janela alheia.

## Conduta
Proponha; **o Flávio decide** negócio/preferência. Produção protegida (desenvolvimento só). Nada de conversa fiada: diga o que fez, onde, e o que falta.
