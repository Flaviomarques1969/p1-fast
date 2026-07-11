# JANELA 2 (Opus 4.8 · 1M) — Inteligência que escolhe a MAIOR oportunidade

> **Cole este prompt numa janela do Claude Code em Opus 4.8 (1M), aberta na raiz `/Users/imac/Projetos/P1 Fast`.** Você é uma trabalhadora sob o maestro **Fable 5**, que coordena sob demanda de outra janela.

## Contexto obrigatório (leia antes de produzir)
- `.claude-exec/PROMPT-FABLE5-COACH-IA-STINT.md` — briefing mestre (missão, restrições, fundação, fontes-da-verdade). **Absorva por inteiro**, com foco na Seção 4.1 (o motor de delta por sub-trecho que já existe e devolve `deltaTotalS`, `porSubTrecho`, `piorSubTrecho`, `piorDeltaS`), 4.5 (a melhor volta histórica) e 4.6 (geometria/tipos de curva).
- Abra os arquivos reais: `web/cockpit/delta-calculator.js`, `windows/cockpit/P1Fast.Cockpit.Domain/DeltaCoach.cs`, `web/cockpit/trecho-detector.js`, `web/command-box/fixtures/passagens-bubi-brasilia.v1.json`, `supabase/migrations/0026_melhores_passagens_trecho.sql`, `web/command-box/tipos-curva-brasilia.js`.
- `.claude-exec/coach-ia-sala/PLANO-MESTRE.md` — o contrato entre janelas.

Regra dura: **não invente** campo/tabela/função. Confirme no código. Se não existir, escreva "não encontrei X".

## Sua frente (o que é SÓ seu) — e você é o eixo do contrato
O **raciocínio que elege a única maior oportunidade de ganho de tempo**, a cada volta, olhando o stint.
1. **Do delta à oportunidade:** como agregar os deltas por sub-trecho (`entrada/freio/apice/pace/saida`) ao longo da **volta** e do **stint** para achar a **única** oportunidade que mais paga, **em segundos**. Não é "liste tudo que está ruim" — é "aponte o UM que rende mais agora".
2. **Classificação:** técnica-recorrente (mesmo erro em várias curvas → vira lição de técnica) vs curva-pontual (um ponto só) vs outro (linha, marcha, Vmin baixa).
3. **Sinal vs ruído:** separar erro real de variação de GPS ~1 Hz; dar **nível de confiança**; não gritar oportunidade em cima de barulho.
4. **Ganho estimado:** quanto dá pra ganhar (s/volta e no stint), com o método do cálculo.
5. **Explore mais de uma abordagem** (regra fixa vs pontuação/heurística vs raciocínio de IA sobre os padrões) — compare e **recomende**.

**Você define o "OBJETO OPORTUNIDADE"** — a estrutura de dado que a Janela 1 (mensagem), a Janela 3 (gráfico) e a Janela 5 (cenários) vão consumir. **Publique um rascunho dele cedo** em `entregas/janela-2.md` e avise o Flávio, porque as outras janelas dependem dele. Inclua ao menos: tipo (técnica/curva/outro), trecho/segmentId alvo, sub-trecho, ganho estimado (s), confiança, e o "porquê" em dado.

## Fronteira (NÃO faça)
- **Não** escreva o texto da mensagem (Janela 1). **Não** desenhe o gráfico (Janela 3). Você entrega o **dado** que os dois consomem.

## Entrega
Mantenha viva em **`.claude-exec/coach-ia-sala/entregas/janela-2.md`**: o objeto oportunidade (esquema), o algoritmo/heurística (com as abordagens comparadas e a recomendada), o método do ganho em segundos, e como pluga no motor de delta existente. Completa e autoexplicativa — o Fable audita numa passada só.

## Canal com o Fable (sob demanda — sem loop, pra não gastar à toa)
Você **não fica em vigia**. Trabalhe até concluir e então deixe tudo pronto.
1. **Enquanto trabalha:** registre marcos em `.claude-exec/coach-ia-sala/canal/janela-2/para-fable.md` se quiser (só você escreve, sempre acrescentando, hora `date -u +%FT%TZ`). **Poste o rascunho do objeto oportunidade assim que tiver** — é o que destrava as outras.
2. **Ao CONCLUIR (ou travar): deixe TUDO PRONTO.** Finalize `entregas/janela-2.md` e acrescente em `para-fable.md`:
   ```
   ### [hora ISO] — Janela 2 · PRONTO PARA AUDITORIA
   Entrega: entregas/janela-2.md (completa)
   Resumo (até 5 linhas): ...
   Consumi: <motor de delta / fixtures> · Produzi: objeto oportunidade { … }
   Autoconferência da régua: preto · sem-emoji · você · 956×440 · número-sem-sinal · só-dado-real · timing-seguro · ganho-em-s · painel-preservado
   Dúvidas/decisões ao maestro: <ou 'nenhuma'>
   ```
   Depois **avise o Flávio, em uma linha:** «Terminei a Janela 2 — tudo pronto em entregas/janela-2.md. Avise o Fable: audita janela 2.» E **pare**.
3. **Quando o Flávio disser que o Fable respondeu:** leia `canal/janela-2/do-fable.md` e aplique — `SEGUIR`/`CORRIGIR` (corrige e repete o item 2)/`APROVADO`.
4. **Outras janelas:** leia `entregas/janela-*.md`; peça o que precisar via Fable.

## Conduta
Proponha; **o Flávio decide** negócio/escopo. Produção protegida. Sem conversa fiada.
