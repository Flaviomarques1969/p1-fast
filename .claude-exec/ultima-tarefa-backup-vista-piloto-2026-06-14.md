# Última tarefa

> Tarefa ANTERIOR (campanha 3 frentes — trail/RaceBox/pendências) preservada em
> `ultima-tarefa-backup-campanha-3frentes-2026-06-14.md`. Pendências dela (A7 sensor seg/ter,
> B2/B5-B8 ar livre) seguem abertas, mas dependem de hardware/dia de pista — não é trabalho ativo agora.

## TASK_INIT — 2026-06-14 — Avaliar funções da Vista Piloto (Command Box)

1. **Pedido original de Flávio:** "vamo ver o command box... há algumas funções lá dentro que eu quero que você avalie e a gente possa melhorar." Refere-se à **Vista Piloto do Command Box** (a tela "na visão do piloto").
2. **Objetivo (1 frase):** avaliar as funções (blocos) da Vista Piloto do Command Box e propor melhorias, a partir das funções que o Flávio apontar.
3. **Critérios objetivos de conclusão:** funções apontadas pelo Flávio avaliadas com diagnóstico + recomendação; nenhuma melhoria aplicada sem decisão dele; arranjo dos blocos (vista-piloto-ATUAL.json) e mockup preservados (backup antes de qualquer alteração).
4. **Leitura confirmada:** ~/.claude/CLAUDE.md (sim) · ~/.claude-decisoes/padroes.md (sim, vazio) · FLAVIO_EXECUTION_PROTOCOL.md (sim) · FLAVIO_DONE_CHECKLIST.md (sim) · FLAVIO_ENVIRONMENT_RULES.md (sim) · FLAVIO_COMMUNICATION_RULES.md (sim) · CLAUDE.md do projeto + memórias Command Box (sim).
5. **Plano (≤5 passos):**
   1. Mapear as funções reais da Vista Piloto (FEITO: 16 blocos via vista-piloto-ATUAL.json).
   2. Abrir a tela pela 8078 pro Flávio ver (FEITO).
   3. Flávio aponta QUAIS funções quer avaliar/melhorar.
   4. Avaliar função por função (diagnóstico + recomendação), backup antes de mexer.
   5. Aplicar melhorias só após decisão; preservar arranjo e a regra "Command Box é só visualização".
6. **Áreas a inspecionar:** `_design-reference/mockup-command-box-vista-piloto.html`; `_design-reference/command-box-versoes/vista-piloto-ATUAL.json`; memórias de Command Box.
7. **Ambiente alvo:** desenvolvimento (mockup de design local, servido pela 8078).
8. **Produção protegida:** sim.
9. **Autorização para produção:** não.
10. **Evidência da autorização:** não recebida.
11. **Riscos:** (a) mexer no arranjo/posições dos blocos = regressão grave (posições são do Flávio); (b) pôr botão de ação no Command Box viola regra dura (é só visualização); (c) servir por porta errada mostra layout padrão (sempre 8078).
12. **Status inicial:** iniciado — aguardando Flávio apontar quais funções avaliar.

## Funções (blocos) atuais da Vista Piloto — 16
header (shift light+branding) · video (1-2 câmeras) · mapa (atelier) · hud (velocidade/gauge) · coach (P1 Coach) · stint (plano do stint) · checklist (do stint) · fuel-gauge (combustível) · delta-acum (delta acumulado de voltas) · carro · pneus · stint-bar (barra lateral) · passagem · frenagem · vmin · shift-light
