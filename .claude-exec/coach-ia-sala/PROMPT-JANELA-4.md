# JANELA 4 (Opus 4.8 · 1M) — Integração, dados e arquitetura + Plano em fases

> **Cole este prompt numa janela do Claude Code em Opus 4.8 (1M), aberta na raiz `/Users/imac/Projetos/P1 Fast`.** Você é uma trabalhadora sob o maestro **Fable 5**, que coordena sob demanda de outra janela.

## Contexto obrigatório (leia antes de produzir)
- `.claude-exec/PROMPT-FABLE5-COACH-IA-STINT.md` — briefing mestre. Foco: Seção 4.3 (o **encaixe do coach vazio** `web/command-box/cerebro/cerebro-coach.js` que devolve `null`, e o `cerebro-painel.js` com `coach: null` esperando), 4.4 (contrato de dados), 4.8 (o `.exe` é C# WinUI 3; método = web-referência-primeiro → portar para C#).
- Abra os arquivos reais: `web/command-box/cerebro/cerebro-coach.js`, `web/command-box/cerebro/cerebro-painel.js`, `docs/CONTRATO_DADOS.md`, `web/cockpit/cloud-bridge.js`, `windows/cockpit/P1Fast.Cockpit.Domain/DeltaCoach.cs`, `windows/cockpit/P1Fast.Cockpit.Domain/CockpitState.cs`, `windows/cockpit/P1Fast.Cockpit.UI/MainWindow.xaml`.
- `.claude-exec/coach-ia-sala/PLANO-MESTRE.md` — o contrato entre janelas (o **pacote do coach** {oportunidade, mensagem, gráfico-spec, timing} é você quem formaliza).

Regra dura: **não invente** rota/campo/função/tabela. Confirme no código. Se não existir, "não encontrei X".

## Sua frente (o que é SÓ seu)
A **plataforma** que une as outras frentes e o **plano de construção**.
1. **Onde tudo pluga:** como o Coach de IA entra em `cerebro-coach.js` (web, o encaixe vazio) e depois em `DeltaCoach`/`CockpitState`/`MainWindow` (C#), sem quebrar o motor de delta nem o painel.
2. **O que muda no pacote de dados:** o campo `coach` (hoje `null`) vira um objeto — defina sua forma consolidando o "objeto oportunidade" (J2) + a mensagem (J1) + a spec do gráfico (J3) + o timing. Mostre o que muda no contrato de dados **sem contaminar** a arquitetura ("uma entrada, um cérebro, telas só exibem").
3. **Fluxo de dado:** do canal `cockpit-bubi-live` → cérebro → coach → tela; e o caminho **web-referência primeiro → portar para o `.exe` C#**.
4. **Teste:** como validar (o projeto usa replay da volta real 21/06 e testes automáticos no C#).
5. **Plano de construção em fases:** o que é **Fase 1** (o mínimo que já entrega valor na tela do piloto) e o que fica depois; ordem, dependências, riscos.

## Fronteira (NÃO faça)
- **Não** decida a pedagogia (J1), o gráfico (J3) nem o cérebro de seleção (J2) por dentro. Você define **a plataforma** que os encaixa e o **plano** que os monta.

## Entrega
Mantenha viva em **`.claude-exec/coach-ia-sala/entregas/janela-4.md`**: o ponto de encaixe, a forma do pacote do coach, o fluxo de dado, a estratégia de teste e o plano em fases (com a Fase 1 destacada e construível). Completa e autoexplicativa — o Fable audita numa passada só.

## Canal com o Fable (sob demanda — sem loop, pra não gastar à toa)
Você **não fica em vigia**. Trabalhe até concluir e então deixe tudo pronto.
1. **Enquanto trabalha:** registre marcos em `.claude-exec/coach-ia-sala/canal/janela-4/para-fable.md` se quiser (só você escreve, sempre acrescentando, hora `date -u +%FT%TZ`). Opcional.
2. **Ao CONCLUIR (ou travar): deixe TUDO PRONTO.** Finalize `entregas/janela-4.md` e acrescente em `para-fable.md`:
   ```
   ### [hora ISO] — Janela 4 · PRONTO PARA AUDITORIA
   Entrega: entregas/janela-4.md (completa)
   Resumo (até 5 linhas): ...
   Consumi: saídas de J1/J2/J3 · cérebro/DeltaCoach/CockpitState · Produzi: pacote do coach + plano de fases
   Autoconferência da régua: preto · sem-emoji · você · 956×440 · número-sem-sinal · só-dado-real · timing-seguro · ganho-em-s · painel-preservado
   Dúvidas/decisões ao maestro: <ou 'nenhuma'>
   ```
   Depois **avise o Flávio, em uma linha:** «Terminei a Janela 4 — tudo pronto em entregas/janela-4.md. Avise o Fable: audita janela 4.» E **pare**.
3. **Quando o Flávio disser que o Fable respondeu:** leia `canal/janela-4/do-fable.md` e aplique — `SEGUIR`/`CORRIGIR` (corrige e repete o item 2)/`APROVADO`.
4. **Outras janelas:** leia `entregas/janela-*.md` (você depende da forma de saída de todas); peça o que precisar via Fable.

## Conduta
Proponha; **o Flávio decide** negócio/escopo. Produção protegida — nada de publicar, canal ao vivo ou banco de produção; você só **projeta** a integração. Sem conversa fiada.
