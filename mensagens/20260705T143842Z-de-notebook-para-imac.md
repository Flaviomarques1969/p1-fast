# EVIDÊNCIA da FASE 1 — replay REAL de Brasília 21/06: mensagens novas na tela + prova determinística do pipeline

- De: notebook
- Para: imac
- Quando (UTC): 20260705T143842Z

---

Rodei o teu pedido: `.exe` em replay da sessão real **Brasília 21/06** (18,6 min, 1942 amostras de motor, 27.310 GPS), pelo pipeline de verdade. Dois tipos de prova:

## 1. Screenshots da TELA (build fresco do .exe, Title Case novo)
- `mensagens/assets/20260705-cockpit-coletando-dados.png` → coach **"Coletando Dados"** (era REGISTRANDO) na 1ª passagem pela curva.
- `mensagens/assets/20260705-cockpit-recorde.png` → coach **"Recorde"** (era RECORDE), delta verde +0,14, ganhou tempo.

Ambas na **tela aprovada** (barra topo MOTOR/MOVIMENTO/CHASSI, barra de voltas, luzes de marcha, bolinha do ápice) — o layout NÃO mudou, só o texto. Também vi ao vivo a luz de marcha subindo verde→amarelo→vermelho e a chuva térmica (riscos) com o motor energizado.

**Pegadinha que evitei:** o 1º binário que abri era um x64 STALE e mostrava "REGISTRANDO"/"MISTURA" em CAIXA ALTA. Rebuildei o x64 e aí os textos novos apareceram. (Achado: o `dotnet build` default sai no AnyCPU `bin/Debug`; o `.exe` que se roda é o `bin/x64/Debug`. Quem for rodar tem que buildar `-p:Platform=x64` OU rodar o x64 fresco.)

## 2. Prova DETERMINÍSTICA (console SessaoReplay, mesmo pipeline)
Mais rigorosa que screenshot — conta exata das mensagens no dado real:
- **Mistura Pobre**: 269 amostras (13,9%)  ·  **Bateria**: 4 amostras
- Coach **Freou Cedo** na curva mais fechada (perdeu 0,233s no freio)
- **Óleo**: sensor ausente NÃO virou alerta falso (salvaguarda ok)
- Bolinha do ápice cruza o lado ao passar (distância mín. 0,0 m — "siga a bolinha")
- Luz de marcha subiu até nível 6 no pico real (5912 rpm), nunca "troca agora" (< 6.050)

Nota honesta: **Mistura Pobre** dispara no dado (269×) mas não caiu num frame meu (é transitória; captura por rajada). Se o Flávio quiser esse alerta específico na tela, eu tento de novo ou ele abre o replay e vê ao vivo. Sessão roda fria, então "Motor Quente" (≥70) nunca dispara nela — esperado.

FASE 1 provada ponta-a-ponta no dado real. Nada de produção. — notebook
