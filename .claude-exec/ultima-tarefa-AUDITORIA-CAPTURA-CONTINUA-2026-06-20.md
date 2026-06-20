# Auditoria — captura contínua T4000+GPS (liga→desliga) — 20/06/2026

## Pedido (Flávio)
Objetivo: ter o dado COMPLETO e DETALHADO da T4000 + GPS o tempo todo, do liga ao desliga do carro, TODA vez.
Pediu: auditoria com auditores que se contrapõem pra achar a causa de não ter isso, por que o sistema não garante, e o que fazer no app do notebook.

## Como foi feito
Workflow adversarial (13 auditores): 4 leitores de evidência (GPS, T4000, persistência, arquitetura) → 4 teses opostas, cada uma atacada por cético independente lendo o código → 1 juiz-síntese. Nenhum código alterado (diagnóstico). Resultado bruto em `.claude-exec/auditoria-resultado-2026-06-20.json`. Relatório: `.claude-exec/AUDITORIA-captura-continua-2026-06-20.html`.

## Causa-raiz (verificada no código)
NÃO existe gravador de sessão crua plugado no caminho ao vivo do notebook (web/teste-aparelhos/index.html + web/cockpit/main-t3000.js). O caminho web só faz broadcast efêmero (canal "sem persistência") e grava só DERIVADOS (melhor passagem, médias por volta, tempo). O requisito de gravar a sessão crua append-only EXISTE e é vigente (ADR-003/004/014) e já foi construído/validado no iOS (sample-store.js + session-recorder.js; STATUS.md: 56.314 amostras raw em hardware real), mas ficou órfão do pipeline iOS legado e nunca foi religado ao caminho web. A ARQUITETURA_DEFINITIVA de 16/06 ("streaming, nunca em lote") é silente sobre armazenamento.

## Veredito das 4 teses (cético)
- ARQUITETURA → MECANISMO (não é "decisão de nunca gravar"; é peça órfã não religada).
- CONEXÃO/OPERAÇÃO → FATOR QUE AGRAVA (T4000 não lida no dia: aba p1t4000 fechada / USB off / leitor caído; canais independentes GPS-BT vs T4000-USB).
- PERSISTÊNCIA/DESCARTE → FATOR QUE AGRAVA forte (throttle 5 Hz + só-melhor-passagem; real e por design do caminho ao vivo).
- GARANTIA/CONTRATO → MECANISMO (sem selo "gravando", retorno de publishSample ignorado em main-t3000.js:938, só _stats.dropped silencioso → perda invisível e não repetível).

## Mecanismos da perda
GPS travado em 5 Hz na saída (index.html:501,506 setInterval 200ms); T4000 cortada a 5 Hz na cloud-bridge.js (PUBLISH_HZ=5) e só broadcast; só derivados gravados (melhores_passagens_trecho só GPS, médias por volta, tempo); retorno de gravação ignorado, sem fila/repescagem.

## Plano no notebook (prioridade)
1. Gravador de sessão local (IndexedDB append-only) abrindo no liga e fechando no desliga, gravando TODA amostra crua T4000+GPS na taxa de chegada — esforço alto, risco baixo.
2. Gravar na taxa nativa, separado do envio de 5 Hz (mostrar ≠ guardar) — médio/baixo.
3. Incluir T4000 na gravação (gravar o broadcast na Central + religar gravador raw na origem em p1t4000) — alto/médio.
4. Selo "GRAVANDO" + contadores ao vivo na Central de Pista — baixo/baixo.
5. Conferência pós-sessão (gravadas vs recebidas, lacunas) + exportar/enfileirar upload — médio/baixo.
6. Resiliência (wakeLock, religar foco/internet, marcar lacunas honestamente) — médio/baixo.

## TASK_DONE
- Pedido conferido: sim. Ambiente: desenvolvimento (diagnóstico). Produção alterada: não.
- Arquivos inspecionados: sim (código real, arquivo:linha). Alterações no app: nenhuma (auditoria).
- Validação: 13 auditores, evidência no código; relatório HTML gerado e aberto.
- Resultado: concluído. Pendência: decisão do Flávio se implemento o passo 1 (gravador) em DEV.
