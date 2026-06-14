# TASK — Reconciliação do shift light (sem modos / alvo 6.050 + ligar módulos) — 2026-06-14 (madrugada)

> Registro dedicado (o `ultima-tarefa.md` está sob escrita concorrente de outra sessão — Estoque/Pendências).
> Pedido: Flávio "siga" → "Tudo num pacote só" (card de escopo). Ambiente: DESENVOLVIMENTO. Produção NÃO publicada.

## TASK_DONE
- Pedido original conferido: sim
- Ambiente trabalhado: desenvolvimento (web/cockpit local; painel publicado p1t4000 NÃO tocado)
- Produção foi alterada: não
- Se produção foi alterada, autorização explícita registrada: n/a (não foi)
- Arquivos reais inspecionados: sim
- Alterações feitas: sim
- Testes/validação executados: sim — `npm run smoke` EXIT 0 (bateria completa) + `npm run test:shift-light` EXIT 0 (12 specs) + verificação adversarial 3 lentes (aprovado)
- Resultado: concluído em DEV
- Pendências reais: (1) PUBLICAR = produção, aguarda "MIGRAR PARA PRODUÇÃO: shift light"; (2) fonte RPM real T3000 + GPS ao vivo só o dia de pista 15-16 fecha.

## O que mudou (decisão "Tudo num pacote")
1. **SEM MODOS:** os 3 modos (Durabilidade/Normal/Agressivo) não têm mais efeito no alvo. `setModoStint` virou no-op documentado.
2. **Alvo = POTÊNCIA MÁXIMA:** alvo-semente = pico de potência da curva do dyno (fallback PERFIL_BUBI.picoPotenciaRpm = 6.050), refinado pelo aprendizado de TEMPO DE PASSAGEM (assume só com confiança ≥ 0,5), teto = redline 6.300.
3. **Módulos novos LIGADOS:** `aprendizado-tempo-passagem` instanciado e alimentando o alvo; `registrarPassagemTempo` + `exportar/importarTempoPassagem` (persistência) expostos; o LED do painel de pista (`main-t3000.js`) passou a usar `getRpmVisualLuz()` (antecipação da reação) em vez de `getRpmOtimoTroca()` cru.
4. **Tela "Configuração de Stint":** seção de escolha de modo virou bloco único "Máximo desempenho"; HTML/CSS atualizados (subtítulo, h2, status, grid 3→1 coluna em largura total). Resto da tela (propósito/treino/voltas/paradas/vida útil do pneu) PRESERVADO.

### Arquivos alterados (todos em DEV)
- `web/cockpit/shift-light-orquestrador.js` — alvo 6.050 + tempo de passagem + persistência + setModoStint no-op + getEstado/getFonteRpmOtimo atualizados.
- `web/cockpit/main-t3000.js` — LED usa getRpmVisualLuz; log "máximo desempenho".
- `web/cockpit/configuracao-stint.js` — bloco "Máximo desempenho", envelope mostra alvo 6.050, modo_stint gravado = 'agressivo' (compat banco), guard morto removido.
- `web/cockpit/configuracao-stint.html` — subtítulo/h2/status sem menção a "modo"; .modos grid 1 coluna (largura total).
- `tests/node-smoke-shift-light-e2e.mjs` — E2E-07b (6.050), E2E-08 (no-op), E2E-08b (refino por tempo de passagem 6.250).

### O que foi PRESERVADO (nada apagado; backup em `.claude-exec/backup-reconciliacao-shift-light-2026-06-14/`)
- `shift-light-modos.js` (byte-idêntico) e `forca-integrada-calculator.js` (intocado) — deixaram de ser fonte do alvo, mas seguem no projeto e ainda exercitados pelos testes SLM/FIC.
- `main.js` e `simulacao-ia-100.html` — byte-idênticos (não precisaram mudar).
- Aprendizado de reação do piloto (Onda 7) e barra de aprendizado (%) — intactos.

### Validação executada (prova real)
- `npm run smoke` → EXIT 0 (bateria completa verde).
- `npm run test:shift-light` → EXIT 0 (12 specs).
- E2E 13/13 · tempo-passagem 15/15 · pilot-reaction 6/6 · inteligente (módulos preservados) 24/24 · persistência 9/9 · treino-stint 59/59.
- `node --check` nos 4 .js tocados: OK.
- Verificação adversarial (workflow 3 lentes): REGRESSÃO aprovado · FIDELIDADE aprovado · COERÊNCIA aprovado (4 ressalvas baixas, todas corrigidas).
- Telas abertas no navegador (porta 8091; a 8078 estava ocupada pela sessão concorrente): configuracao-stint.html + simulacao-ia-100.html.

### Pendências/riscos
- Publicar (colocar no ar p1t4000) = produção; só com "MIGRAR PARA PRODUÇÃO: shift light".
- Validação DEFINITIVA do alvo (6.050 × esticar) é na pista 15-16 com RPM real (T3000) + GPS combinados — o aprendizado de tempo de passagem é quem decide ali.
- Resíduo cosmético inofensivo: `modoStintInicial`/`_modoStintAtual` em main.js/main-t3000.js viraram dead-code (ignorados pelo no-op) — preservados de propósito pra não arriscar o painel de pista.
