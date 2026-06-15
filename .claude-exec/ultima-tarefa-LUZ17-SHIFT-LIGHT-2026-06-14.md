# TASK — Luz de marcha progressiva de 17 luzes no painel do piloto — 2026-06-14

> Continuação da reconciliação do shift light. Ambiente: DESENVOLVIMENTO. Produção NÃO publicada.
> Pedido aprovado por Flávio via desenho interativo (mockup-shift-light-progressivo.html).

## DECISÃO DE DESIGN APROVADA (Flávio, no navegador)
Luz de marcha = **17 luzes espelhadas**, acendimento **PROGRESSIVO par a par**, das duas pontas
em direção ao centro:
- **8 verdes** (4 de cada lado, tier 1-4) · **6 amarelas** (3 de cada lado, tier 5-7) · **3 vermelhas** no
  centro (tier 8 = 1 de cada lado; tier 9 = central).
- A **luz central (tier 9) acende só na TROCA** (FIRE), quando os dois lados se juntam = potência máxima 6.050.
- Troca = **na última luz** (central/flash), não na primeira vermelha (acima de 6.050 a potência cai).

## O que mudou (DEV)
- `web/cockpit/cockpit-state.js` — SHIFT_LEVEL_MAX 6→8 (níveis laterais); SHIFT_DOTS_TOTAL 12→17;
  função `shiftDotsForLevel` REMOVIDA (era a causa do salto em blocos de cor — convertia level→nº de dots
  e era usada como limiar de tier).
- `web/cockpit/cockpit-renderer.js` — acende `tier <= level` direto (par a par); central (tier 9) nunca no LIT.
- `web/cockpit/cockpit.css` — cores remapeadas: tier 1-4 verde, 5-7 amarelo, 8-9 vermelho (era 1-2/3-4/5-6);
  gap 18→13px (cabe 17). O FIRE (data-state="fire") acende TODOS os dots, inclusive a central.
- 5 telas (index-t3000, index-live, index, simulacao-ia-100, cockpit-demo) — 12 LEDs → 17 (data-tier 1..9..1).
- `_design-reference/mockup-cockpit-piloto.html` (CANÔNICO/contrato) — sincronizado: <style> = cockpit.css,
  DOM com 17 LEDs. Re-extraído pra manter byte-identidade. Fronteiras novas: <style>=10 </style>=862
  <script>=1044 </script>=1295.
- Testes atualizados: node-smoke-cockpit-state (CST-03/04/08), node-smoke-cockpit-renderer (CKR-03/04 + 17 dots),
  node-smoke-cockpit-web (CKW-01/02/11 com números novos + 17 LEDs).
- Desenho de apoio: `web/cockpit/mockup-shift-light-progressivo.html` (interativo, aprovado).
- Scripts utilitários: `.claude-exec/luz17-troca-spans.mjs`, `.claude-exec/luz17-sync-canonico.mjs`.

## Validação executada
- `npm run smoke` → EXIT 0 (bateria completa verde, INCLUI o carimbo canônico CKW 16/0).
- cockpit-state 23/0 · cockpit-renderer 17/0 · live-data-bridge 26/0.
- Contagem de cor conferida: 17 luzes = 8 verde + 6 amarelo + 3 vermelho (central tier 9 = 1).
- node --check nos JS tocados: OK.
- Conferência adversarial (workflow 2 lentes): em curso.
- Telas abertas no navegador (porta 8091): index-live (anima) + index-t3000 (oficial).

## Preservação
Backup completo em `.claude-exec/backup-luz-17-shift-light-2026-06-14/` (CSS, JS, 5 HTMLs, 3 testes — estado de 12 luzes).

## TASK_DONE
- Pedido original conferido: sim
- Ambiente trabalhado: desenvolvimento (painel no ar NÃO tocado)
- Produção foi alterada: não
- Arquivos reais inspecionados: sim
- Alterações feitas: sim
- Testes/validação executados: sim — smoke EXIT 0 + carimbo canônico + 3 testes de painel
- Resultado: concluído em DEV (aguardando validação visual do Flávio + veredito da conferência)
- Pendências reais: publicar = produção (só com "MIGRAR PARA PRODUÇÃO"); confirmação visual no navegador.
