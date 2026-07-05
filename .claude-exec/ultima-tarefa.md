# Última tarefa — FASE 2: IA de padrão de temperatura (cockpit do piloto)

> Backup da tarefa anterior: `.claude-exec/ultima-tarefa.backup-pre-fase2-2026-07-05.md`

## RETOMAR: diga "RETOMAR FASE 2" (ou /voltei)

## Pedido original de Flávio
Prompt `~/Downloads/PROMPT-P1FAST-FASE2-planejamento.txt`: planejar a Fase 2 (a parte inteligente das
mensagens — a IA que aprende o padrão normal do carro e avisa fora do normal; motor agora, pneu/óleo/câmbio
preparados; tudo configurável). DEPOIS Flávio autorizou: "vai até o fim e implementa tudo, no final audita
e corrige tudo que identificou". → virou IMPLEMENTAÇÃO em DEV + auto-auditoria.

## Objetivo (1 frase)
Implementar, sobre a Fase 1, a inteligência que aprende a temperatura normal do carro e avisa "Temperatura
Motor Subindo" fora do padrão (motor ativo; pneu/câmbio preparados/desligados), tudo configurável, testado,
sem tocar produção — e auto-auditar/corrigir.

## Ambiente: DESENVOLVIMENTO. Produção: protegida, NÃO tocada. Autorização produção: NÃO (não usada).
## Branch: `claude/fase2-ia-temperatura` (criado de `origin/sync/notebook-dia-de-pista-2026-06-23` = Fase 1).

## STATUS: CONCLUÍDO (em DEV) — 2026-07-05
Commitado no branch de trabalho. Nada em produção. Falta (não trava): validação visual no .exe
(notebook compila WinUI) + ligar a gravação em disco do aprendizado (lado notebook) + calibrar números do Bubi.

### Arquivos
- NOVO `windows/cockpit/P1Fast.Cockpit.Domain/AprendizadoTemperatura.cs` — aprendiz contínuo genérico.
- ALTERADO `.../AlertasCriticos.cs` — AprendizadoConfig/AprendizadoLimites + AplicarAprendizado no IngestT4000 + Exportar/ImportarAprendizado. Catálogo/travas da Fase 1 intactos.
- ALTERADO `.../CockpitOrchestrator.cs` — pontes Exportar/ImportarAprendizado + MotorMaximaNormalC/MotorConfianca.
- NOVO testes `AprendizadoTemperaturaTests.cs` (12) + 7 novos em `AlertasCriticosTests.cs`.
- NOVO doc `docs/FASE2_IA_TEMPERATURA.md` (mapa de casos, fluxos, onde mora, parâmetros, riscos/decisões).
- NOVO `.claude-exec/registro-correcoes.md`.

### Prova (rodada no iMac)
- dotnet build domínio: 0 erro / 0 aviso.
- `DOTNET_ROLL_FORWARD=Major dotnet test` domínio: **396/396** (377 Fase 1 preservados + 19 novos). Sem roll-forward o testhost aborta (só há runtime .NET 10) — dá "exit 0" enganoso (ver registro-correcoes).
- `node tests/node-smoke-alertas-criticos.mjs`: 25/25 (JS não tocado).

### Auto-auditoria (identifiquei e corrigi/anotei)
- CORRIGIDO: salto do padrão após pausa longa → teto DtMaxS=5s (registro-correcoes).
- CORRIGIDO: alarme falso de largada em dia quente → τ de subida cresce com a confiança (rápido imaturo → estável maduro).
- ANOTADO p/ Flávio (docs/FASE2_IA_TEMPERATURA.md §5): calibrar números do Bubi; aviso "subindo" exige rpm; pneu 2 níveis (nível atenção = 1 alerta a criar com sensor); óleo fora de escopo; JS de referência divergente desde a Fase 1 (não espelhei); persistência em disco = lado notebook; produção só com "MIGRAR PARA PRODUÇÃO".

## Decisões do Flávio já embutidas (do prompt + DECISOES-MENSAGENS-PILOTO-2026-07-04.md)
Motor: aprende padrão (ext+histórico), avisa +3°C acima da máxima normal, contínuo, nunca trava.
Motor Quente = trava dura 70°C (Fase 1). Ambiente entra na conta. Pneu quente 2 níveis por tipo
(radial 185: 95/105; semi-slick 195: 105/115) — preparado. Pneu/câmbio só com sensor.
