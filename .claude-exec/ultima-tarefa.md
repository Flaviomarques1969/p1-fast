# Última tarefa

> Registro anterior (Botão APAGAR da Garagem, 14/06 noite) arquivado em
> `.claude-exec/ultima-tarefa-ANTERIOR-garagem-apagar-2026-06-14.md`.

## TASK_INIT — 2026-06-15 — P1 Fast "não está disponível" no iPhone (assinatura de 7 dias expirou)

1. **Pedido de Flávio:** "o P1 Fast não está disponível mais no meu celular, que precisa resolver isso e já resolve os outros problemas."
2. **Objetivo:** Fazer o P1 Fast voltar a abrir no iPhone do Flávio e dar a ele a solução definitiva pro app não morrer toda semana.
3. **Critério:** app reassinado + reinstalado + abre sem queda no iPhone real; causa raiz documentada; recomendação de solução permanente apresentada.
4. **Leitura:** CLAUDE.md, padroes.md (vazio), FLAVIO_* (4), P1 Fast/CLAUDE.md + memórias — sim.
5. **Plano:** (a) diagnosticar [FEITO]; (b) reassinar+reinstalar; (c) validar abertura (precisa desbloqueio); (d) recomendar conta paga/TestFlight; (e) reportar.
6. **CAUSA RAIZ (prova):** perfil de provisionamento `iOS Team Provisioning Profile: com.flaviomarques.p1fast`
   criado 08/06, EXPIRA 15/06 (hoje) — validade de 7 dias por ser conta de desenvolvedor GRATUITA
   (ProvisionsAllDevices ausente). App não foi removido (devicectl confirma instalado), mas a assinatura caducou.
   Mesmo problema afeta P1 IMU Test e qualquer app nosso instalado direto no aparelho.
7. **Ambiente:** produção (iPhone real). Autorização: SIM — "precisa resolver isso" + "MIGRAR PARA PRODUÇÃO: apagar com resgate na Garagem" (14/06). Banco/nuvem: NÃO tocado.
8. **Riscos:** reassinatura grátis renova só +7 dias (volta a expirar ~22/06) — paliativo; definitivo = Apple Developer Program pago (perfil 1 ano + TestFlight). App bloqueado impede abrir remoto (precisa Flávio desbloquear + "Confiar" se pedir).
9. **Status:** reempacotamento assinado em curso (bg bbhodvm9x).

## TASK_DONE — 2026-06-15 — P1 Fast de volta no iPhone

```
TASK_DONE:
- Pedido original conferido: sim
- Ambiente trabalhado: produção (iPhone real 00008140-000E2D611E6A801C)
- Produção foi alterada: sim (reinstalação do app no iPhone, autorizada)
- Autorização explícita registrada: sim ("precisa resolver isso" + MIGRAR PARA PRODUÇÃO de 14/06)
- Banco/nuvem alterado: não
- Arquivos reais inspecionados: sim
- Alterações feitas: reassinatura + reinstalação no iPhone
- Testes/validação executados: sim — empacotamento SUCEDIDO; perfil novo válido 15/06→22/06; app instalado + ABERTO + processo vivo (PID 5970) = não caiu na abertura
- Resultado: CONCLUÍDO (app de volta; inclui a função apagar-com-resgate da Garagem)
- Pendências reais: solução PERMANENTE (conta paga Apple / TestFlight) = decisão de negócio do Flávio, apresentada em card. Sem ela, reassinar a cada 7 dias (próximo vencimento ~22/06).
```

CAUSA RAIZ confirmada: assinatura de 7 dias (conta dev gratuita) venceu 15/06. Reassinado (novo perfil
15/06→22/06). App precisou de "Confiar no desenvolvedor" no aparelho (Flávio fez: "feito"). Aberto via
devicectl, processo 5970 vivo. P1 IMU Test tem o MESMO problema (mesma conta) — some junto a cada 7 dias.

## DECISÃO DO FLÁVIO (15/06) — solução definitiva
Escolha (card): **"Entrar no programa pago da Apple"** (Apple Developer Program ≈US$99/ano).
- AÇÃO DO FLÁVIO (só ele faz — Apple ID + pagamento): inscrever-se em developer.apple.com/programs/enroll
  (ou app "Apple Developer" no iPhone). Apple aprova em ~1-2 dias.
- AÇÃO DO CLAUDE (quando a conta ativar): configurar App Store Connect + subir versão pro TestFlight →
  Flávio passa a atualizar sozinho pela loja, sem cabo, e cada versão dura 1 ano.
- COBERTURA no meio-tempo: app vale até 22/06 (cobre dia de pista 15-16/06). Se a conta paga não ativar
  até lá, reassinar de novo (paliativo +7 dias).
- Mesmo benefício vale pro P1 IMU Test e qualquer app futuro.

## TASK_INIT — 2026-06-15 — Luz de marcha (shift light) do cockpit do piloto: alinhar entendimento e provar no navegador

### 1. Pedido original de Flávio
"Sobre as luzes no P1 Fast do cockpit do piloto, do Shift Light, você está com um problema de contexto, não está conseguindo entender. Nós definimos uma barra de luzes para atualizar/modificar e a sua versão não é a versão atual. Você dizia que era porque a vermelha piscava e a vermelha não aparecia — nada disso. Na verdade ela estava com um padrão: era só verde e amarela, quando batia enchia as luzes todas, você tirava as verdes e as amarelas, aparecia vermelha e piscava em branca — e não é assim que combinamos."
Resposta dele no card (15/06): "enche progressivo, sem apagar nada. quando chega na luz vermelha do centro pisca branco com tudo ligado."

### 2. Objetivo (1 frase)
Confirmar com prova no código qual implementação da luz de marcha é a correta vs. a errada e mostrar a correta rodando no navegador pro Flávio, sem alterar produção.

### 3. Critérios objetivos de conclusão
- Identificado, com arquivo:linha, onde está a forma APROVADA (17 luzes, sobe progressivo, na troca pisca branco com tudo ligado) e onde está a forma ERRADA (apaga verde/amarelo).
- Painel real (mesmos arquivos da pista) aberto no navegador pro Flávio ver a subida + piscada.
- Reportado o que está certo, o que confunde e proposta de limpeza/proteção (sem executar deleção sem OK).

### 4. Confirmação de leitura
- ~/.claude/CLAUDE.md: lido
- ~/.claude-decisoes/padroes.md: lido (vazio — 0 decisões registradas)
- ~/.claude/FLAVIO_EXECUTION_PROTOCOL.md: lido
- ~/.claude/FLAVIO_DONE_CHECKLIST.md: lido
- ~/.claude/FLAVIO_ENVIRONMENT_RULES.md: lido
- ~/.claude/FLAVIO_COMMUNICATION_RULES.md: lido
- Memória P1 Fast (dois caminhos): lida. Contrato da luz: p1-fast-shift-light-luz-17-progressiva-2026-06-14.md.

### 5. Plano (≤5 passos)
1. Mapear todas as implementações da luz (FEITO — workflow 6 agentes + leitura direta).
2. Confirmar comportamento exato do painel de pista (FEITO — cockpit-renderer.js:131-141, cockpit.css:229-260, live-data-bridge.js:71).
3. Servir local e abrir cockpit-demo.html (mesmo motor da pista) pro Flávio ver subida + piscada.
4. Reportar certo/errado com prova; propor aposentar/alinhar demo e mockups errados + proteger 17 luzes no teste.
5. TASK_DONE.

### 6. Arquivos/áreas inspecionados
web/cockpit/{cockpit-renderer.js, cockpit-state.js, cockpit.css, live-data-bridge.js, cockpit.js, index.html, index-t3000.html, main-t3000.js, cockpit-demo.html, simulacao-ia-100.html}; tests/ui/shift-light-cockpit.spec.js; _design-reference/mockup-command-box-vista-piloto.html, mockup-cockpit-piloto.html, mockup-shift-light-progressivo.html.

### 7. Ambiente alvo: desenvolvimento (web/cockpit local; produção = p1t4000 Vercel, NÃO tocada)
### 8. Produção protegida: sim
### 9. Autorização para produção: não
### 10. Evidência da autorização: não recebida
### 11. Riscos
- Confundir de novo a tela demo (cockpit.js) com o painel de pista (main-t3000.js).
- Teste automático ainda trava modelo antigo de 12 luzes → a forma correta de 17 não está protegida (pode regredir).
- Onde a piscada DISPARA (RPM 5200 torque vs 6050 potência) é tema separado (shift light inteligente), não confundir com o padrão VISUAL.

### 12. Status inicial: iniciado

---
## Achado verificado (15/06) — CORRIGIDO após leitura direta do código
- FORMA CERTA (17 luzes) = TODO o web/cockpit: index-t3000.html → main-t3000.js → cockpit-renderer.js + cockpit.css
  (pista); cockpit-demo.html (banca); simulacao-ia-100.html; E TAMBÉM index.html + cockpit.js (demo de mensagens).
  cockpit.js:185 acende tier<=nível (progressivo); fire = 17 piscam branco; overrev = alarme separado.
- CORREÇÃO: eu cheguei a chamar o index.html de "versão errada" e cheguei a inserir um aviso nele. ERREI —
  index.html está CERTO e é travado byte-a-byte ao mockup canônico (teste CKW-05). DESFIZ o aviso
  (restaurado do backup); smoke cockpit-web voltou a 16/16.
- VERSÃO VELHA/DIFERENTE (12 luzes) = SÓ o Command Box _design-reference/mockup-command-box-vista-piloto.html
  (código próprio buildShiftLight ~6009 for i<12; sl-led; cores green/champagne/amber/red/blue). É a barra que
  o Flávio vê (abre via 8078). ERA a "sua versão não é a atual".

## DECISÃO DO FLÁVIO (15/06)
Mostrei as duas barras lado a lado (Command Box 8078 × cockpit-demo 8090) e perguntei se atualizo a do
Command Box pras 17 luzes. Escolha dele: **"Deixar como está por enquanto"**. NÃO atualizar o Command Box
sem nova ordem.

---
## TASK_DONE
- Pedido original conferido: sim
- Ambiente trabalhado: desenvolvimento (web/cockpit local). Command Box só LIDO/aberto.
- Produção foi alterada: não
- Se produção foi alterada, autorização explícita registrada: n/a
- Arquivos reais inspecionados: sim (cockpit.js, cockpit-renderer.js, cockpit-state.js, cockpit.css,
  live-data-bridge.js, index.html, index-t3000.html, main-t3000.js, cockpit-demo.html, mockup-command-box-vista-piloto.html)
- Alterações feitas: nenhuma permanente. Inseri e DESFIZ um aviso no index.html (restaurado do backup). Atualizei memória.
- Testes/validação executados: sim — `npm run smoke:cockpit-web` = 16 ok / 0 fail (após restaurar index.html);
  páginas servidas HTTP 200 (cockpit-demo 8090, Command Box 8078).
- Resultado: concluído (diagnóstico entregue e provado; mudança no Command Box NÃO autorizada por decisão do Flávio)
- Pendências reais: (1) FECHADA por decisão permanente do Flávio 15/06 — o Command Box NUNCA vai pras 17 luzes
  (é tela mais simples, não tem a necessidade do painel do piloto); não propor de novo.
  (2) proteger as 17 luzes no teste automático (tests/ui/shift-light-cockpit.spec.js ainda mira modelo de 12) — proposto, não autorizado.

---
## TASK_INIT — 2026-06-15 — Fechar o estoque na nuvem (Flávio escolheu este próximo passo)
1. **Pedido:** "fechar o estoque na nuvem" (opção escolhida no card de próximo passo).
2. **Objetivo:** confirmar o estado real do estoque na nuvem e deixar o backup funcionando.
3. **Critério:** estoque sobe pra nuvem e eu confirmo as linhas; item 1 do plano de migração fechado.
4. **Leitura:** CLAUDE.md, padroes.md (vazio), FLAVIO_* (4), memórias P1 Fast — sim.
5. **Ambiente:** produção (nuvem Supabase) — minha parte só LEITURA + edição de código local (dev).
6. **Autorização produção:** item 1 autorizado antes; publicar função NÃO autorizada ainda (espera frase literal).

### ACHADO (com prova, 15/06)
- A nuvem tem **0 linhas** em `estoque_item` (dump só-leitura `supabase db dump --linked --data-only`).
- Causa: função `sync` publicada = **versão 9 de 03/06**; sua lista fixa `ALLOWED_TABLES` (sync/index.ts:124) NÃO inclui `estoque_item` e nunca incluiu (git `-S` vazio). O app (build 14/06) JÁ envia `estoque_item` (EstoqueRepository + SyncBackfill + SyncCoordinator), mas é rejeitado. A `pull` tinha o mesmo furo.
- Logo: "falta só abrir o app" estava ERRADO — abrir o app não sobe nada.

### CONSERTO (desenvolvimento, 15/06)
- Adicionado `estoque_item` em `supabase/functions/sync/index.ts` (ALLOWED_TABLES) e `supabase/functions/pull/index.ts` (TEAM_TABLES). Aditivo, reversível. Sem teste automático travando a lista. Deno não instalado → typecheck local não rodou (limitação declarada).

### TASK_DONE
- Pedido original conferido: sim
- Ambiente trabalhado: desenvolvimento (código das funções) + leitura da nuvem
- Produção foi alterada: SIM — funções `sync` (v9→v10) e `pull` (v3→v4) publicadas na nuvem 15/06 17:55
- Se produção foi alterada, autorização registrada: SIM — Flávio escreveu `MIGRAR PARA PRODUÇÃO: funcoes sync e pull com estoque`
- Arquivos reais inspecionados: sim (sync/index.ts, pull/index.ts, ios EstoqueRepository/SyncBackfill/SyncCoordinator, migration 0046, dump da nuvem)
- Alterações feitas: 2 linhas (sync + pull) em dev + publicação na nuvem; plano de migração e este registro atualizados
- Testes/validação executados: dump só-leitura da nuvem (0 linhas estoque ANTES) ✓; versões pós-publicação confirmadas (sync v10 / pull v4) ✓; typecheck Deno NÃO (Deno ausente)
- Resultado: PARCIAL — porta aberta (funções publicadas). Falta Flávio abrir o app ~1 min e eu confirmar as linhas subindo.
- Pendências reais: (1) Flávio abrir o app desbloqueado ~1 min; (2) eu reconferir o estoque na nuvem (>0 linhas) e fechar o item 1.
- Desfazer (se preciso): republicar sync v9 / pull v3 (versões anteriores ainda existem no histórico da nuvem).
