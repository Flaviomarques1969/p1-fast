# TASK_INIT 14/06/2026 — CAMPANHA 3 FRENTES (executar passo a passo até o fim)

> Registro da tarefa ANTERIOR (trail-braking + passagem, CONCLUÍDA fim a fim) preservado em
> `ultima-tarefa-backup-trailbraking-CONCLUIDA-2026-06-14.md`. Aquela tarefa não tem pendência.

## AO RETOMAR (pós-clear) — FAÇA ISTO
1. Ler `.claude-exec/PLANO-MESTRE-3-frentes-2026-06-14.md` (é o contrato).
2. Achar o primeiro pedaço com `[ ]`, executar, marcar `[x]` com evidência, repetir.
3. Ordem: ETAPA 1 (Frente A A1→A6 + C1 + B1/B3/B4) → ETAPA 2 (Frente C com o iPhone) →
   ETAPA 3 (seg/ter, sensor + RaceBox ao ar livre).
4. Decisões (D1..D5): FECHADAS — Flávio disse "segue todas as recomendações" (14/06).
   NÃO parar pra perguntar; usar a opção recomendada gravada no plano. Ele pode reabrir depois.

1. **Pedido original (Flávio, 14/06):** "planeje fazer os três [trail-braking pronto pro sensor /
   RaceBox / validar pendências]. aí dou clear e você executa todos passo a passo, um pedaço por vez
   até completar tudo."
2. **Objetivo em 1 frase:** executar, em pedaços pequenos e em ordem, as 3 frentes mapeadas no plano
   mestre, em desenvolvimento, sem tocar produção fora de leitura/uso normal autorizado.
3. **Critério de conclusão:** todos os pedaços `[x]` no plano mestre com evidência; o que depender de
   você (decisões, iPhone, sensor, ar livre) sinalizado e feito; bateria de testes verde.
4. **Leitura confirmada:** ~/.claude/CLAUDE.md (sim) · padroes.md (sim, vazio) · protocolo/checklist/
   environment/communication (sim) · CLAUDE.md do projeto + ADR-023 (sim) · memória P1 Fast dois
   caminhos (sim) · mapeamento dos 3 agentes (sim).
5. **Plano curto:** ETAPA 1 Frente A + adianta C1/B1/B3/B4 · ETAPA 2 Frente C (iPhone) · ETAPA 3
   sensor + RaceBox. Detalhe pedaço a pedaço no plano mestre.
6. **Áreas a inspecionar:** web/cockpit/ (freio-trecho, trail-cockpit-*, main-t3000, parser, cloud-bridge);
   p1fast-worktrees/{revisao-treino-freio,cockpit-treino-trail}; src/telemetry/ (provider/timebase/
   snapshot/cross-validation); supabase/{migrations/0039,functions/sync}; ios/ (SyncBackfill,
   SyncCoordinator, Sincronizacao/Hub/Peca/Manutencao Views); tools/ (sim-publish, leitor BLE).
7. **Ambiente alvo:** DESENVOLVIMENTO.
8. **Produção protegida:** sim.
9. **Autorização para produção:** não.
10. **Evidência da autorização para produção:** não recebida.
11. **Riscos:** (a) tocar o painel aprovado do Flávio — proibido; (b) confundir DEV/PROD nas leituras
    de conferência — só leitura na nuvem; (c) inventar % de freio sem sensor — sempre rotular ALVO;
    (d) sobrescrever arquivo oficial ao portar — backup antes; (e) divergência entre os dois ambientes
    isolados de freio — reconciliar antes do porte (A6).
12. **Status inicial:** plano aprovado para execução pós-clear (aguardando clear do Flávio).

## STATUS DOS PEDAÇOS — espelho do plano (atualizar aqui também ao executar)
FRENTE A: A1[x] A2[x] A3[x] A4[x] A5[ GATE-FLÁVIO ] A6[ ] A7[ ]
FRENTE B: B1[ ] B2[ ] B3[ ] B4[ ] B5[ ] B6[ ] B7[ ] B8[ ]
FRENTE C: C1[x] C2[ ] C3[ GATE-FLÁVIO ] C4[ ] C5[ GATE-FLÁVIO ]

### Log de execução (pós-clear 14/06)
- A1 [x] 14/06: D1 (2 de 2, ponto de freada = aviso, interruptor 3 de 3) no motor
  trail-cockpit-motor.js + D2 (gráfico híbrido) na tela trail-cockpit-tela.js. Decisões gravadas
  (memória p1-fast-trail-criterio-certo-d1-d2-2026-06-14 + seção do ditado). Bateria completa verde
  (exit 0). Ambiente isolado cockpit-treino-trail. NADA em produção.
- A2 [x] 14/06: motor.amostraFreio() + buffer rolante (60s) + amostrasFreioNaJanela() em
  trail-cockpit-motor.js; religação em main-t3000.js (bridge.ingestT4000 leva pressão/pedal ao motor
  por tMono, log na 1ª amostra). Fonte do veredito segue física GPS (proxy) até A3. Testes AF-01/02/03
  + RL-10. trail-cockpit 42 ok, religação 10 ok, 0 fail.
- A3 [x] 14/06: fusão real no computarVeredito (4º arg amostrasFreio → fundirFreioNosPontos ±250ms
  quando sensor presente; senão física GPS), campo fonteFreio no veredito + snapshot. Detecção viva
  (_reavaliarFonteFreio) emite efeito 'fonte-freio'; selo na tela troca FÍSICA GPS↔SENSOR
  (atualizarSeloFonteFreio no main). Testes FU-01/02/03. Bateria COMPLETA verde (exit 0). OBS:
  conversão pressão→% e reconciliação de escala definitiva = A7 (com sensor real); fonte rotulada deixa
  transparente.
