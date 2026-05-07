# Celta Cockpit · STATUS & CONTINUIDADE

**Data:** 2026-05-07 · **Branch:** `claude/clear-session-fRVm4`
**Estado:** Direction D resgatada — telemetria sobreposta ao carro vetorizado.

Doc para retomar trabalho após `/clear`. Leia este arquivo PRIMEIRO antes de mexer.

---

## O caminho certo (locked)

`_design-reference/celta-cockpit-D.html` é o demo interativo. Está baseado
em `assets/command-box/premium-styles/direction-D-live.svg` (mockup
existente que o Flávio aprovou em 2026-05-04, commit `aa1d37e`).

**Princípio:** a foto/vetor do carro é sagrada. Telemetria fica em **dots + leader
lines + callouts nas bordas**. Não é polígono em cima da foto, não é
recolor de pixel, não é redesenhar a peça. É **dado SOBRE o carro vetorizado**.

```
                                 T.MOTOR  T.ÓLEO  P.ÓLEO
                                  ━━━━●━━━━━━━━━━━
PNEU FL                         ┌─────┴─────┐                    PNEU FR
28.4 psi                        │           │                    28.5 psi
84°C  ●─────────────────────────│   CARRO   │────────────●──────  86°C
                                │   #16     │
                                │           │   ●──── T.CÂMBIO
                                │           │       78°C
PNEU RL                         │           │                    PNEU RR · ATENÇÃO
29.1 psi                        │           │                    29.0 psi
91°C  ●─────────────────────────│           │────────────●━━━━━━ 98°C +6
                                └───────────┘
─────────────────────────────────────────────────────────────────────────
TANQUE  ███████░░░░  45%   ~21L · ~12 voltas              Δ TEAM BEST  +0.42s
```

## Indicadores cobertos

**Powertrain (4):** T.MOTOR · T.ÓLEO · P.ÓLEO · T.CÂMBIO
**Pneus (8):** psi × 4 + temp × 4 (FL/FR/RL/RR)
**Combustível (2):** TANQUE % + autonomia estimada
**Performance (1):** Δ TEAM BEST

Total = 15. Restantes da T4000 (RPM, marcha, lambda, MAP, EGT, etc.) ficam
em outras tiles do command box (não nessa).

## Color rules (locked)

Cada canal tem threshold próprio (`scripts/build_cockpit_d_demo.py:classifyXxx`):

| Canal | OK (verde) | Atenção (amber) | Crítico (vermelho) |
|---|---|---|---|
| T.MOTOR | < 100 °C | 100–110 | > 110 |
| T.ÓLEO  | < 115 °C | 115–130 | > 130 |
| P.ÓLEO  | > 3.5 bar | 2.0–3.5 | < 2.0 |
| T.CÂMBIO | < 90 °C | 90–105 | > 105 |
| Pneu psi | dev < 1.5 da meta (29 psi) | 1.5–3.0 | > 3.0 |
| Pneu temp | < 95 °C | 95–110 | > 110 |

A meta de 29 psi é placeholder — calibrar com Flavio + AeroBox.

## Reproduzindo

```bash
python3 scripts/build_cockpit_d_demo.py
# saída: _design-reference/celta-cockpit-D.html (2.6 MB, self-contained)
# preview: assets/_previews/cockpit-D-default.png
```

## Histórico das fases anteriores (todas rejeitadas)

Phases B / C / D / E foram tentativas sucessivas de RECOLORIR a foto
exploded view do Celta. Todas rejeitadas pelo Flávio. Arquivado em
`_archive/phases-b-c-d-e-rejected/` com README explicando cada erro.

Resumo do que NÃO fazer:
- Não vetorizar a foto inteira (Phase A) — vira blocos sólidos
- Não usar polígonos SVG por cima (Phase B) — fronteira reta vs objeto torto
- Não usar máscaras (Phase C) — mesmo problema conceitual
- Não desenhar schematic do zero (Phase D) — sem qualidade artística
- Não usar GrabCut + camadas (Phase E) — abandonado em favor de Direction D

A solução certa (Direction D) já existia há semanas; eu só precisava ler.

## Próximo passo (próxima sessão)

1. Polir labels: confirmar com Flávio se quer ainda mais info por canto
   (ex: target temperature, delta vs alvo)
2. Animar transições: smooth `350ms ease` na cor dos dots (já tem CSS)
3. Adicionar pulso animado quando crit (RR já tem; aplicar a outros
   canais críticos)
4. Estender pra outras tiles do command box (PIP da Daily.co, mapa
   piloto, mapa engenharia, mensagens) — `direction-D-live.svg` tem tudo
5. Cockpit iOS app real — port nativo Swift do que está no HTML

## Preferências do Flávio (estilo de comunicação)

- **Conciso.** Detesta paredes de texto.
- **Decida e execute.** Não ofereça múltiplos caminhos.
- **Mostre resultado, não processo.** PNG renderizado > diagrama.
- **Erros frustram, mas tudo bem refazer.** Sem desculpas longas.
- **NÃO insista numa abordagem que ele rejeitou.** Pivota direto.

---

**FIM DO STATUS.** Leia `_archive/phases-b-c-d-e-rejected/README.md` antes
de iterar — economiza várias horas de erro.
