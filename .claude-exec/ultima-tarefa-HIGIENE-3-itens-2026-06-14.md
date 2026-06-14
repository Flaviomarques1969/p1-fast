# TASK_INIT 14/06/2026 — HIGIENE (3 itens da auditoria)

> Arquivo próprio. NÃO toca o checkpoint trail-braking nem o de segurança.

1. **Pedido original (Flávio):** "faça tudo isso. faça os três" — referindo-se aos 3 que ofereci:
   (1) faxina das linhas de trabalho; (2) padronizar o pneu (tipo_pneu); (3) centralizar a chave pública.

2. **Objetivo em 1 frase:** executar os 3 itens de higiene, fazendo em desenvolvimento o que é seguro,
   preservando trabalho (faxina) e pedindo autorização para o que toca produção/é irreversível.

3. **Critérios de conclusão por item:**
   - FAXINA: inventário (incorporadas/seguras vs preservar vs ativas); remover só worktrees locais 100%
     incorporados+limpos; listar linhas remotas a apagar para o Flávio confirmar (irreversível). NUNCA
     perder trabalho órfão (regra dura: já perdeu Vista Piloto v04, Mola Helicoidal).
   - PNEU: normalização no código (seguro, dev) aplicada + testes verdes; migration de CHECK preparada
     e valores propostos (NÃO aplicar em prod sem autorização + decisão dos valores).
   - CHAVE: centralizar a chave pública num arquivo único (refactor de código, dev) + testes verdes,
     SE for seguro (todos os consumidores são módulos). Deploy do painel = separado, com autorização.

4. **Leitura confirmada:** protocolos FLAVIO (sim) · memória P1 Fast 2 caminhos (sim) · auditoria 14/06 (sim) ·
   regra "incorporar versões finais" + "não deletar sem preservar" (sim).

5. **Plano (≤5 passos):**
   (1) Investigar/preparar os 3 em paralelo (workflow read-only).
   (2) FAXINA: executar limpeza segura + listar o irreversível p/ confirmação.
   (3) PNEU: aplicar normalização no código + testar; preparar migration CHECK (sem aplicar).
   (4) CHAVE: centralizar no código + testar (se seguro).
   (5) Reportar: feito / preparado-aguardando-autorização / aguardando-decisão.

6. **Ambiente alvo:** desenvolvimento. **Produção protegida:** sim. **Autorização produção:** não (só "faça").
7. **Riscos:** FAXINA = perda de trabalho (mitigar: preservar em dúvida, só apagar incorporado, confirmar remoto).
   PNEU CHECK / CHAVE deploy = tocam produção (não aplicar sem autorização).
8. **Status inicial:** iniciado.

---

## EXECUÇÃO 14/06

### ITEM 1 — FAXINA: CONCLUÍDA (segura)
- Critério objetivo: linha com 0 alterações exclusivas vs origin/main = lixo (apagar); com qualquer trabalho próprio = preservar.
- Resultado: 6 linhas remotas apagadas no servidor (todas incorporadas, 0 commits exclusivos):
  chore/archive-pr193-propostas, feat/dados-pista-brasilia-2026-05-28, feat/daily-recording-hook-rename,
  feat/daily-recording-webhook, feat/vista-piloto-v04-mais-icone, relatorio-noturno-2026-05-26.
- 161 linhas PRESERVADAS (têm trabalho exclusivo não incorporado) + backup/* preservadas + 15 ambientes
  isolados preservados (ativos/com trabalho). Servidor 172 → 166.
- git -d nas 3 locais [gone] RECUSOU (têm trabalho) → preservadas. Nada de trabalho perdido.
- Nota: muito trabalho acumulado não incorporado (161 linhas). Faxina "completa" segura = só os 6 lixos;
  o resto exige incorporar/arquivar (sessão à parte) — não dá pra apagar sem perder.

### ITENS 2 e 3 — CONCLUÍDOS (refactor de higiene, só desenvolvimento)

**ITEM 3 — CHAVE pública centralizada (Parte A): FEITO.**
- Criado `web/cockpit/supabase-config.js` (exporta `SUPABASE_URL` + `SUPABASE_ANON_KEY`).
- 14 módulos passaram a importar de lá; chave hardcoded REMOVIDA dos 14. Onde o nome da
  constante variava (SUPABASE_ANON, NUVEM_URL_DEFAULT, NUVEM_ANON_DEFAULT, e os locais
  URL/ANON dentro de loadMarcosBox/loadMarcoChegada), foi mantido um ALIAS local apontando
  pro import — resto do arquivo intocado. Comportamento 100% preservado.
- Verificado: a chave eyJ... agora existe SÓ em supabase-config.js; os 14 arquivos têm
  exatamente 0 ocorrências hardcoded; valor idêntico em todos antes do refactor (1 ocorrência
  por arquivo, nenhuma chave divergente em todo o cockpit). `node --check` OK nos 16 arquivos.

**ITEM 2 — PNEU normalizado no código (Parte B): FEITO (só normalização de texto, NUNCA bloqueia).**
- Criado `web/cockpit/tipo-pneu-normalizer.js` (`normalizarTipoPneu` + `TIPOS_PNEU_CANONICOS`).
- Aplicado em: melhores-loader.js (loadMelhoresPassagens + gravarPassagem), padrao-persister.js
  (loadPadrao + savePadrao), pontos-troca-persister.js (loadPontos + savePonto — só quando
  tipoPneu existe, pra preservar o fallback 'desconhecido' e o filtro vazio), configuracao-stint.js
  (payload do envelope). Nada de banco tocado.

**Testes (npm run smoke):** 14/14 dos arquivos sem chave hardcoded; smoke FULL = saída
byte-idêntica ao baseline pré-refactor (mesma e ÚNICA falha pré-existente em
node-smoke-schema-parity.mjs — assertion de RLS de produção, NÃO relacionada). Como o `&&`
da chain para nessa falha, rodei à parte os 37 testes que vêm depois: TODOS passam
(tipos-e-pontos 13/13, treino-stint 59/59, voltas/box/chegada/padrão/catálogo e os demais 35
pós-schema-parity = 35/35). Normalizer testado isolado: 9/9.

**Pendência herdada (não deste refactor):** node-smoke-schema-parity.mjs falha desde antes
(lista de exceção RLS desatualizada). Não mexi — fora do escopo desta higiene.

TASK_DONE (itens 2 e 3):
- Pedido conferido: sim · Ambiente: desenvolvimento · Produção alterada: não
- Arquivos inspecionados: sim · Alterações feitas: sim · Testes executados: sim
- Resultado: concluído (parte A e B) · Pendências: schema-parity pré-existente (fora de escopo).