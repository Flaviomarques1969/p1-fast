# Notebook → iMac — mudança no shift-light-orquestrador.js (ordem do Flávio) + prova pra rodar

**De:** sessão do notebook (Fable 5, coordenação da auditoria do .exe)
**Data:** 2026-07-10
**Branch com a mudança:** `claude/barra-voltas-etapa4` (commit `72a10ff0`, mergeado em `4b4eeacd`)

## O que aconteceu

A auditoria profunda do .exe (2026-07-09/10) achou um defeito de convergência no aprendizado da
reação do piloto (Onda 7): medindo a reação a partir do **alvo fixo** (6.050) em vez de **onde a
luz acendeu** (alvo − compensação vigente), o EMA converge pra **metade** da reação real (ponto
fixo rt/2) e a luz antecipa só metade do necessário. O defeito existia **igual** no porte C# e no
JS canônico — o C# era porte fiel.

O Flávio decidiu (2026-07-10, textual): **"corrigir nos dois lados"**. Por isso esta sessão do
notebook tocou, sob ordem explícita dele, um arquivo do seu território:

- `web/cockpit/shift-light-orquestrador.js` — no bloco do evento de troca (~linha 219),
  `target_visual_rpm`/`delta_rpm` agora usam o ponto onde a luz acendeu
  (`alvoOtimo − computeCompensation(rateAtSwitch).compensation_rpm`, a mesma conta do
  `getRpmVisualLuz`). `pilot-reaction.js` NÃO mudou (as funções puras estavam certas).
- O gêmeo C# (`windows/cockpit/.../LuzMarchaAntecipacao.cs`, `MontarEvento`) recebeu a mesma
  correção. Paridade de porte preservada.

## O que pedimos de você (iMac)

1. **Rodar a prova** (o notebook não tem Node):
   `node web/cockpit/_prova-meia-convergencia-2026-07-10.mjs`
   Esperado: fiação ANTIGA converge ~150 ms; NOVA converge ~300 ms (piloto simulado de 300 ms) e
   o script imprime "PROVA OK". Se falhar, avise neste canal ANTES de qualquer outro passo.
2. **Dar ciência** da mudança nas suas memórias/handoffs do cockpit web, pra nenhuma sessão do
   iMac "corrigir de volta" achando que o notebook divergiu do canônico.
3. Se o cockpit web tiver perfis de reação **persistidos** de sessões antigas
   (pilot-reaction-persister), considere descartá-los: foram aprendidos com a régua antiga
   (metade da reação) e vão contaminar o EMA novo por um tempo. No .exe o mesmo vale pros
   `~/p1fast-sessoes/luz-marcha-*.json` — o notebook cuida do lado de cá.

Prova do lado C#: teste `LMA_10` (circuito fechado converge em ~300 ms) e contraprova executada
(o teste FALHA contra o código antigo). Suíte 498/498 verde na branch.

Regra de sempre: nada disso toca produção (`cockpit-bubi-live`); é tudo branch de trabalho.
