# TELEMETRY_REVIEW_CHECKLIST — Checklist de revisão pelo Engenheiro-Chefe de Telemetria

Toda entrega que toca dado (parser, sync, store, derivação, análise, alerta) passa por este checklist antes de ir ao usuário.

Resultado vai para `TELEMETRY_ENGINEERING_DECISION_LOG.md`.

Complementa o `DELIVERY_REVIEW_CHECKLIST.md` (Diretor Técnico) — os dois precisam ser preenchidos para entrega ser concluída.

## 1. Identificação

- Nome da entrega:
- Tipo: parser / reader / sync / snapshot / quality / cross-validation / análise derivada / alerta / replay / outro
- Fontes envolvidas: T4000 / RaceBox / iPhone / mock / múltiplas
- Arquivos tocados:

## 2. Origem dos dados

- Quais canais são lidos?
- De qual fonte cada um vem?
- Cada canal está catalogado em `T4000_CAN_SPEC.md` / `RACEBOX_INTEGRATION_SPEC.md` (ou spec equivalente)?
- Se canal novo, foi adicionado ao catálogo?

## 3. Timestamp

- Toda amostra tem `t` (Unix ms) E `tMono` (`performance.now()`)?
- Cálculos de duração usam `tMono` (ADR-015)?
- Se a fonte fornece seu próprio timestamp, ele é validado e correlacionado com `tMono` na entrada?

## 4. Unidade

- Cada valor tem unidade declarada na entrada (decodificação)?
- Conversão para canônica acontece na borda?
- Cálculos internos usam apenas unidades canônicas (`TELEMETRY_ENGINEERING_RULES.md` §unidades)?

## 5. Escala e parser

- Para cada canal, fator e offset estão documentados na spec?
- Endianess (big/little) está documentada quando byte-level (CAN)?
- Range esperado está documentado?
- Valor fora do range é marcado `OUT_OF_RANGE`?

## 6. Checksum

- Quando o protocolo tem checksum (CAN, BLE), ele é validado?
- Pacote com checksum inválido vira `INVALID_CHECKSUM`?

## 7. Qualidade

- Cada amostra carrega uma das 11 categorias de `DATA_QUALITY_RULES.md`?
- Categoria default é coerente?
- Categoria pode mudar ao longo do pipeline (ex: amostra `LATE` chega, vira `OUT_OF_ORDER` no detector, etc.)?

## 8. Sincronização

- Se a entrega cruza fontes, usa `TelemetryTimebase` (ou justifica não usar)?
- Latência por fonte é medida ou estimada?
- Estratégia de gap, atraso, fora de ordem está explícita?

## 9. Snapshot

- Se a entrega produz snapshot, segue `TELEMETRY_SNAPSHOT_SPEC.md`?
- `quality` do snapshot reflete a qualidade das fontes que entraram?
- Campos não-disponíveis são `null` (não 0, não '-')?

## 10. Inferência

- Se há inferência, está marcada explicitamente (`type: 'inferred'`)?
- Inferência alimenta análise rotulada como hipótese, não fato?
- A regra 4 das `TELEMETRY_ENGINEERING_RULES.md` (sem sensor real, sem afirmação) é respeitada?

## 11. Validação cruzada

- Quais validações cruzadas se aplicam?
- Estão implementadas em código ou registradas como pendência no `CROSS_VALIDATION_RULES.md`?
- Divergência detectada gera alerta SUSPECT, não conclusão automática?

## 12. Testes

- Existem fixtures de pacote válido?
- Existem fixtures de erro (perdido, duplicado, fora de ordem, checksum inválido, valor fora de range)?
- Existe teste de replay (rodar samples salvos no detector e comparar com análise original)?
- Sem testes, a entrega NÃO está pronta.

## 13. Replay

- Os samples persistidos em `telemetrySamples` (ADR-014) contêm tudo o que essa análise precisa?
- A análise pode ser rodada offline a partir desses samples?
- Estado externo (relógio, random, ID) está isolado para permitir replay determinístico?

## 14. Comportamento sob falha

- Se a fonte cai, qual é o comportamento?
- Crítico de segurança é mantido (regra 15 das `TELEMETRY_ENGINEERING_RULES.md`)?
- UI do Box mostra status?

## 15. Performance

- Roda dentro do orçamento de tempo (cockpit live: ms; box live: sub-segundo; análise pós-stint: segundos a minutos)?
- Não bloqueia o sample-store?
- Volume de IDB cabe na operação local-first?

## 16. Reprovação automática

Reprovar imediatamente se:

- Amostra sem timestamp.
- Amostra sem origem.
- Amostra sem unidade.
- Inferência apresentada como medição.
- Parser sem teste.
- Sync sem teste.
- Conclusão sem dado rastreável.
- Crítico baseado em dado `LOW_CONFIDENCE` sem aviso.
- Mistura de unidades.
- Sensor inexistente assumido.
- Spec de protocolo cravada no código sem confirmação documental.
- Replay impossível.

## 17. Decisão final

- Aprovado pelo Engenheiro-Chefe de Telemetria: SIM / NÃO / SIM COM AJUSTES
- Motivo:
- Ajustes obrigatórios:
- Data:
- Sessão / commit / PR:

## 18. Pós-aprovação

- `TELEMETRY_ENGINEERING_DECISION_LOG.md` atualizado: SIM / NÃO
- Spec atualizada se mudou (`T4000_CAN_SPEC.md`, `RACEBOX_INTEGRATION_SPEC.md`, etc.)?
- Catálogo de canais atualizado se canal novo entrou?
- Auditoria de telemetria atualizada se módulo já estava listado?
