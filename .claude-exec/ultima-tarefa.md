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

### FASE 0 — Trazer o classificador pro app principal — CONCLUÍDA (14/06 00:54)
- Copiados pro oficial: web/cockpit/{classificador-trecho,trecho-estado,classificador-vivo-bridge,tipos-curva-texto}.js
- Copiados pro oficial: tests/node-smoke-{classificador-trecho,trecho-estado,classificador-vivo-bridge}.mjs
- package.json: +3 testes no script `smoke` e +3 atalhos (smoke:classificador / :trecho-estado / :classificador-vivo).
- Evidência: `npm run smoke` = 310 ok / 0 fail (23 arquivos de teste). Diff vs HEAD vazio.
- Auto-save do repo commitou local (ceacf29b..46a2710e). NÃO enviado ao remoto (origin 216 atrás). Produção intocada.

### FASE 1 — Perfil de trail por tipo — CONCLUÍDA (14/06)
- Criado web/cockpit/perfil-trail-por-tipo.js (PERFIL_POR_TIPO + perfilDeTrail + resumoTrail).
  Reescreve em forma estruturada o `formato` canônico (TIPOS de classificador-trecho.js), importando
  rotulo/formato de lá (fonte única). Onde o formato é qualitativo (T0/T4/T5), carga numérica = null
  (não inventei %). Tudo medivel:false (sem sensor de pedal).
- Criado tests/node-smoke-perfil-trail-por-tipo.mjs (23 ok / 0 fail) + ligado na bateria + atalho smoke:perfil-trail.
- DIVERGÊNCIA do plano (declarada): plano sugeria tests/domain/*.spec.js, mas o runner vivo é node-smoke
  (tests/domain antigos, sem jest/vitest). Usei node-smoke pra entrar na bateria de verdade.
- Evidência: `npm run smoke` = 333 ok / 0 fail (24 arquivos).

### FASE 2 — tipo_curva no banco — PARCIAL (artefato pronto e validado; falta aplicar no DEV vivo)
- Criada migration supabase/migrations/0043_track_segments_tipo_curva.sql (ADD COLUNA tipo_curva +
  CHECK T0–T5/SF/ND + COMMENT + 8 UPDATEs por nome no layout de Brasília). Padrão conferido na FONTE
  DE VERDADE (relatorios/_decisao-flavio-padrao-curvas-2026-06-13.json do worktree), não só memória.
- Adicionado web/cockpit/tipo-trecho-loader.js :: carregarTipoCurvaPorTrecho() — TOLERANTE A FALHA
  (retorna {} se a coluna não existe, ex.: produção não migrada — não quebra a leitura ao vivo).
  NÃO mexi no segments-loader (não pode falhar por coluna nova).
- VALIDAÇÃO real: rodei a ALTER+CHECK+8 UPDATEs num Postgres 17 real, em tabela TEMPORÁRIA isolada
  (zero impacto): 8 curvas com tipo_curva certo, CHECK rejeitou valor inválido, 0 nulos / 0 fora do enum.
- Evidência: `npm run smoke` = 333 ok / 0 fail; schema-parity 15 ok / 0 fail (lê a 0043).
- BLOQUEIO HONESTO: o stack Supabase LOCAL do P1 Fast (DEV) NÃO está no ar — a porta 54322 está
  ocupada por OUTRO projeto (cgf_*, em uso há 4 dias). Não derrubo o que não é meu. E produção
  (cloud fvhwltzhytpnhlqbttmd) é protegida. Então a migration está pronta e validada, mas NÃO foi
  aplicada num banco DEV vivo do P1 Fast. Aplicar exige subir o stack do P1 Fast (decisão do Flávio).

### FASE 3 — Re-etiquetar frenagem/Vmin nas 56 passagens (offline, em cópia) — CONCLUÍDA (14/06)
- Dado real: ~/Documents/p1fast-backup-voltas-reais/passagens-bubi-aplicadas.json (56 passagens, 565
  pontos, sub:null). Trabalhei SÓ em cópia: snapshot em relatorios/_passagens-bubi-ORIGINAL-snapshot-
  2026-06-14.json; backup canônico INTACTO (MD5 d5797cd1... antes e depois).
- Criado tools/re-etiquetar-passagens-offline.js: calcula freada (desacel 0,5 g, igual ao detector),
  ápice (aprox. mínima ao apice_gss <=60 m) e Vmin (acharVminBuffer), e re-etiqueta com
  retagSubsPorEventos (MESMA função do ao vivo). Saída: relatorios/passagens-bubi-reetiquetadas-2026-06-14.json.
- RESULTADO: 0 pontos sub:null (era 565/565). Confiança do ápice declarada: alta=27 (ápice geométrico
  casa) / baixa=8 (âncora no Vmin) / borda=21 (recorte parcial, Vmin na 1ª/última amostra). Honesto:
  não forcei marca onde o dado a 1 Hz não dá — flag por passagem em _marcos.confiancaApice.
- Criado tests/node-smoke-re-etiquetar-offline.mjs (8 ok) + ligado na bateria.
- Evidência: `npm run smoke` = 341 ok / 0 fail (25 arquivos).

### FASE 4 — 5º marco PACE (ponto de aceleração pós-Vmin) — EM EXECUÇÃO
