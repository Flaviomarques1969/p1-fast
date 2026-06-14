# TASK_INIT 14/06/2026 — TRAIL-BRAKING + PASSAGEM COMPLETA (padrão da curva → frenagem/Vmin/PACE)

> Tarefa anterior (ligações reais do Command Box) preservada em
> `.claude-exec/ultima-tarefa-backup-pre-trailbraking-2026-06-14.md`.
> Plano-fonte: `.claude-exec/CONTINUAR-trailbraking-passagem-2026-06-13.md` (7 fases).

1. **Pedido original (Flávio, literal 13/06):** "Em função do padrão da curva, qual tipo de
   trailbraking que vai ser aplicado para aquela curva. Então qual é o ponto de frenagem, quanto
   de carga tem e como é que distribui ele até o Vmin. Além disso, nessa passagem da curva, nós
   precisamos também incluir ali o ponto de frenagem e o Vmin e o PACE. Montem o planejamento
   para todos esses itens e vamos avançar de um jeito profissional."

2. **Objetivo em 1 frase:** entregar, por fases, a cadeia tipo-da-curva → formato de trail-braking
   (carga/distribuição até o Vmin) + passagem completa da curva com ponto de frenagem, Vmin e PACE,
   tudo em desenvolvimento, sem tocar produção.

3. **Critérios objetivos de conclusão (por fase do plano):**
   - FASE 0: os 4 módulos do classificador presentes em `web/cockpit/` do oficial; testes verdes; smoke verde.
   - FASE 1: `perfil-trail-por-tipo.js` + teste; perfil-alvo por tipo (carga inicial, soltura, residual).
   - FASE 2: coluna `tipo_curva` no banco DEV com o padrão das 8 curvas; loader lê do banco.
   - FASE 3: re-etiquetar (cópia) as 56 passagens reais → freada/ápice/vmin gravados; 0 sub:null.
   - FASE 4: 5º marco PACE no enum/schema + detector proxy por velocidade.
   - FASE 5: agente vivo ligado em DEV/replay → classifica e propõe mudança de tipo.
   - FASE 6: bloco PASSAGEM na tela (entrada/freio/Vmin/ápice/PACE/saída) + tipo + formato de trail.

4. **Leitura confirmada:** ~/.claude/CLAUDE.md (sim) · ~/.claude-decisoes/padroes.md (sim, vazio) ·
   FLAVIO_EXECUTION_PROTOCOL (sim) · FLAVIO_DONE_CHECKLIST (sim) · FLAVIO_ENVIRONMENT_RULES (sim) ·
   FLAVIO_COMMUNICATION_RULES (sim) · memória P1 Fast dois caminhos (sim) · CONTINUAR-trailbraking (sim).

5. **Plano curto (≤5 passos macro):**
   (1) FASE 0 — trazer 4 módulos + 3 testes pro oficial, smoke verde.
   (2) FASE 1 — perfil de trail por tipo (módulo puro + teste).
   (3) FASE 2 — tipo_curva no banco DEV + loader.
   (4) FASES 3–4 — re-etiquetar passagens (freio/vmin) + marco PACE.
   (5) FASES 5–6 — agente vivo em DEV/replay + bloco passagem na tela. Validar no navegador.

6. **Arquivos/áreas a inspecionar:** web/cockpit/ (classificador-*, trecho-*, oportunidade-trecho.js,
   live-data-bridge.js, delta-calculator.js, segments-loader.js, main-t3000.js, mockups);
   tests/node-smoke-*; supabase/migrations; tools/ (observar-brasilia, re-etiquetar); relatorios/.

7. **Ambiente alvo:** DESENVOLVIMENTO.
8. **Produção protegida:** sim.
9. **Autorização para produção:** não.
10. **Evidência da autorização para produção:** não recebida.
11. **Riscos:** (a) quebrar smoke ao trazer módulos — mitigado: módulos puros, testados; (b) tocar
    posições dos blocos do painel do Flávio — proibido, não mexer; (c) re-etiquetar dado de
    referência — só em cópia com backup; (d) confundir banco DEV/PROD em FASE 2 — só DEV; (e) inventar
    carga de freio % — proibido (sem sensor de pedal); mostrar como ALVO prescrito.
12. **Status inicial:** iniciado.

---

## PROGRESSO

### FASE 0 — Trazer o classificador pro app principal — EM EXECUÇÃO
- Verificado: oficial e worktree diferem APENAS nos 4 módulos novos (diff -rq limpo).
- Os 3 testes novos não existem no oficial; passam no worktree (24+31+13 = 68 ok / 0 fail).
- A executar: copiar 4 módulos + 3 testes; registrar 3 testes no smoke do oficial; rodar smoke.
