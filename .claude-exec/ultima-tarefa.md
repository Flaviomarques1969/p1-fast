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
- Testes/validação executados: versões pós-publicação (sync v10 / pull v4) ✓; cruzamento FINAL app × nuvem ✓ — app: 2 itens, 0 não-sincronizados, fila vazia; nuvem: 2 itens (Sincronizador 3a marcha + Tensionador e Polia). typecheck Deno NÃO (Deno ausente).
- Resultado: CONCLUÍDO — estoque backupado na nuvem.
- Pendências reais: nenhuma p/ este item. Melhoria opcional proposta (não autorizada): app re-tentar dead-letter sozinho quando a condição muda.

### ERRO MEU registrado (pra não repetir)
Reportei "nuvem com 0 linhas" 2x quando os dados JÁ tinham subido. Causa: meu contador só lia o formato COPY do dump; o `supabase db dump` desta tabela saiu em INSERT (`INSERT INTO ... VALUES (...),(...);`). Contagem certa = contar as TUPLAS de VALUES, não blocos COPY nem nº de statements INSERT. Cruzar SEMPRE com o estado local do app (synced_at + sync_queue) evita o falso negativo.

### Sequência real que resolveu (pra memória)
1. Publiquei sync v10 + pull v4 (com estoque_item). 2. Os 2 itens estavam dead-letter (5 tentativas, erro "table-nao-permitida" de ontem) → reabrir o app NÃO sobe. 3. Flávio tocou "Tentar de novo" na tela Sincronização (zera contador + drena na hora) → subiram. 4. Confirmado por cópia limpa do iPhone (devicectl, app precisa estar fechado p/ não vir malformado) + dump da nuvem.

## TASK_INIT — 2026-06-15 — Command Box: desenvolver a função de frenagem

1. **Pedido original de Flávio:** "em p1 fast command box. vamos desenvolver a função de frenagem."
2. **Objetivo (1 frase):** desenvolver a função de frenagem do Command Box vista-piloto — escopo exato a confirmar com o Flávio (card).
3. **Critérios objetivos de conclusão:** dependem do escopo escolhido. Provisório: bloco FRENAGEM deixa de ser 100% simulado e passa a refletir a frenagem real da volta (e a pressão do sensor quando entrar), com fonte rotulada honestamente; validado no navegador pela porta 8078.
4. **Confirmação de leitura:** CLAUDE.md (sim), padroes.md (sim — vazio), FLAVIO_EXECUTION_PROTOCOL (sim), FLAVIO_DONE_CHECKLIST (sim), FLAVIO_ENVIRONMENT_RULES (sim), FLAVIO_COMMUNICATION_RULES (sim), P1 Fast/CLAUDE.md (sim), memórias P1 Fast dois caminhos (sim).
5. **Plano (≤5 passos, provisório até o card):** (a) confirmar escopo no card; (b) trabalhar em ambiente isolado com backup do mockup; (c) ligar bloco FRENAGEM ao motor `web/cockpit/freio-trecho.js` (física real agora; campo de pressão quando o sensor chegar), fonte rotulada; (d) validar no navegador pela 8078; (e) TASK_DONE.
6. **Arquivos/áreas a inspecionar:** `_design-reference/mockup-command-box-vista-piloto.html` (bloco buildFrenagemPanel ~4238, VERDICTS_FRENAGEM ~4140, FRENAGEM_GHOST ~4170, marco freio ~5767, CURVES.brakeM ~6068), `web/cockpit/freio-trecho.js`, `tests/node-smoke-freio-trecho.mjs`, `_design-reference/command-box-versoes/vista-piloto-ATUAL.json`, `tools/atelier-server.mjs` (porta 8078).
7. **Ambiente alvo:** desenvolvimento (mockup local + motor JS). Produção (nuvem/iPhone/Vercel) NÃO tocada.
8. **Produção protegida:** sim.
9. **Autorização para produção:** não.
10. **Evidência da autorização para produção:** não recebida.
11. **Riscos:** (a) mexer no arranjo dos blocos do Flávio (posições no ATUAL.json) — só mexer no CONTEÚDO, backup antes; (b) inventar leitura de freio sem dado real — motor já trata isso (rótulo simulado-fisica vs sensor); (c) escopo ambíguo → confirmar no card antes de codar pra não retrabalhar.
12. **Status inicial:** iniciado — aguardando escopo no card.

### PROGRESSO (15/06)
- **Escopo escolhido (card):** "acertar o que a tela mostra" primeiro, depois ligar o dado.
- **Diagnóstico provado:** o bloco FRENAGEM existe (`buildFrenagemPanel`/`frenagemChartSvg`/`VERDICTS_FRENAGEM`) mas é 100% simulado; o motor de produção `web/cockpit/freio-trecho.js` (física/sensor/trail) NÃO está ligado nessa tela. Achei também `rebuildFrenagem`/`rebuildVmin`/`rebuildPassagem` DUPLICADOS (5445-5480) — código morto, não mexido.
- **Revisão aberta:** `relatorios/revisao-frenagem-command-box-2026-06-15.html` (cópia fiel do bloco atual + leitura dos 4 elementos).
- **Diretrizes do Flávio pro redesenho:** (1) marcador numérico estilo cockpit do piloto — contagem regressiva (faltam X m) e, ao frear, metros do ponto: 0 / +depois / −antes; (2) linha pintada por trecho — verde onde dentro do alvo, vermelha onde fora, ponto a ponto; (3) a freada ALTERNA certo/errado em etapas (entrou certo, freou demais/passou, voltou) — "mas só duas vezes" (evitar tremedeira; pintar só troca real).
- **Espelho do motor real:** banda ±8% (`bandaPct`), ponto de freada tolerância 3 m = aviso FREOU CEDO/TARDE (`tolFreadaM`, `pontoFreadaReprova:false`, decisão 14/06), critério CERTO = 2 de 2 (seguiu o formato ≥80% + chegou na mínima freando). Marcador e traço verde/vermelho copiados do cockpit do piloto (`web/cockpit/trail-cockpit-tela.js`: `renderTraco`, `renderContagem`).
- **Redesenho aberto (preview, NÃO oficial):** `relatorios/redesenho-frenagem-command-box-2026-06-15.html` — 6 cenários, número/aviso/veredito todos CALCULADOS da curva. Inclui "acertou e depois errou" e "certo→errado→certo" (alternância).
- **Redesenho APROVADO pelo Flávio (card):** "levar pro painel real" + aplicar a folga (histerese) da linha.
- **PORTADO pro painel real** `_design-reference/mockup-command-box-vista-piloto.html` (15/06):
  - Backup antes: `_design-reference/command-box-versoes/vista-piloto-PRE-frenagem-redesign-2026-06-15.html`.
  - 5 edições: (1) máquina nova FRX_* (dados por curva + banda ±8% + histerese 2-pontos + contagem regressiva + gráfico segmentado, substituindo `frenagemChartSvg`); (2) `getFrenagemVerdictForCurve` → cenário por id; (3) `buildFrenagemPanel` novo (gráfico+marcador+trail+veredito calculados); (4) `updateFrenagemFromLap` (contagem por quadro + revelação; removida a animação de linha única `_applyLiveCurveOffset` SÓ do frenagem — VMIN intacto); (5) CSS `frx-*` próprio.
  - REGRA respeitada: classes novas `frx-*`; VMIN compartilha `fr-*` e NÃO foi tocado; arranjo (ATUAL.json) intocado. Legado `frenagemCurveTone`/`VERDICTS_FRENAGEM`/`FRENAGEM_GHOST` deixados (sem chamada, não apaguei).
  - Validação: sintaxe OK (3 blocos inline via new Function); lógica pura testada em node (delta/veredito/segmentos/histerese — todas asserções passam); `smoke:freio-trecho` 29/0; servido HTTP 200 pela 8078 com o código novo e aberto no navegador.
- **VALIDADO VISUALMENTE pelo Flávio (card):** redesenho APROVADO no painel real (8078). "Aprovado, seguir pro dado real".
- **PRÓXIMA ETAPA (combinada): ligar a frenagem no DADO REAL.** Decisão do Flávio (card): "Plano agora, ligar com o sensor" — execução fica pra quando o sensor estiver na T4000 e validado (não mexer no painel em dia de pista 15-16/06).
  - CORREÇÃO do Flávio: os sensores ligam na **T4000** (central Injepro). Caminho: sensor → T4000 → quadro telemetria (parser t3000-usb-parser: pressão offset 268 ÷100 bar, pedal 54 ÷10%, acel 52) → canal `cockpit-bubi-live` → Command Box.
  - ACHADO: o mockup `_design-reference/mockup-command-box-vista-piloto.html` é AUTOCONTIDO e 100% SIMULADO — NÃO tem `setupLigacaoAoVivo` nem assina `cockpit-bubi-live`. `web/command-box/` está VAZIO (a memória `p1-fast-command-box-deteccao-automatica-sensor` de 13/06 cita um arquivo que não existe mais no main — ESTÁ DESATUALIZADA). O dado real + `freio-trecho.js` rodam no cockpit do piloto (`web/cockpit/main-t3000.js` via `trail-cockpit-motor.js`, com selo de fonte `atualizarSeloFonteFreio`).
  - PLANO ESCRITO (mapa): `relatorios/plano-frenagem-dado-real-2026-06-15.html` (6 passos: importar motor → assinar canal → calcular por curva → trocar fake pelo real → rótulo de fonte + 3-de-3 → validar com T4000 + faxina do legado).
  - DECISÃO PENDENTE do Flávio (sinalizada, arquitetura = dele): destino final do display do piloto migra pra Windows (CLAUDE.md ADR-023) — confirmar se o dado real entra neste HTML (visão da equipe no box) e/ou no cockpit Windows.
  - LEGADO MORTO a limpar junto na execução: `frenagemCurveTone`, `VERDICTS_FRENAGEM`, `FRENAGEM_GHOST` (sem chamada após o redesenho).
- Status: DESENHO concluído e aprovado no painel; ligação ao vivo PLANEJADA, aguardando sensor na T4000 + aprovação do approach.

### TASK_DONE — 2026-06-15 — Frenagem do Command Box (fase desenho + plano)
- Pedido original conferido: sim ("vamos desenvolver a função de frenagem")
- Ambiente trabalhado: desenvolvimento (mockup local `_design-reference/` + memória). Produção (nuvem/iPhone/Vercel/T4000) NÃO tocada.
- Produção foi alterada: não
- Se produção foi alterada, autorização registrada: n/a
- Arquivos reais inspecionados: sim (mockup command box, freio-trecho.js, trail-cockpit-tela/motor.js, main-t3000.js, cloud-bridge, t3000-usb-parser, package.json/tests)
- Alterações feitas: sim — bloco FRENAGEM redesenhado e portado pro painel real (classes frx-*, VMIN/arranjo intocados); backup salvo; 2 previews + 1 plano em relatorios/; memória atualizada + correção de memória antiga
- Testes/validação executados: sim — sintaxe (new Function, 3 blocos OK); lógica pura em node (todas asserções OK); smoke:freio-trecho 29/0; servido HTTP 200 pela 8078; VALIDADO VISUALMENTE pelo Flávio (aprovado)
- Resultado: PARCIAL POR DECISÃO DO FLÁVIO — desenho CONCLUÍDO e aprovado; ligação no dado real PLANEJADA e adiada por escolha dele ("ligar com o sensor"), não abandonada.
- Pendências reais: (1) executar a ligação ao vivo quando o sensor estiver na T4000 e validado (plano pronto); (2) decisão de arquitetura do Flávio — destino do display (este HTML e/ou cockpit Windows); (3) faxina do legado morto (frenagemCurveTone/VERDICTS_FRENAGEM/FRENAGEM_GHOST) junto com a execução.

---
## TASK_DONE — 2026-06-15 — Retomada automática de envio + tela "Conta" na Home
- Pedido original conferido: sim (Flávio: "faça a retomada automática" + "tirar o nome de sincronização da primeira página, arcaico")
- Ambiente trabalhado: desenvolvimento (app iOS). Produção NÃO tocada.
- Produção foi alterada: não
- Arquivos reais inspecionados/alterados: SyncDrainer.swift (+rehabilitateDeadLetters), SyncCoordinator.swift (+rehab throttled + onBecameActive + disparos boot/reconexão), ContentView.swift (+scenePhase), HomeView.swift (badge sync → botão "Conta"), SincronizacaoView.swift (título→"Conta", Conta no topo), P1FastSmoke/main.swift (+PERSIST-14b)
- Testes/validação executados: smoke do núcleo PERSIST-14b ✓ (reabilita só dead-letter, preserva pendente); `xcodebuild ... build` = BUILD SUCCEEDED, 0 erro. 2 falhas PRÉ-EXISTENTES fora do escopo (PERSIST-01 contagem 34≠38; PERSIST-03 evento_pendencias_extra sem synced_at).
- Resultado: CONCLUÍDO em desenvolvimento.
- Pendências reais: só chega no iPhone do Flávio num próximo reinstalar (empacotar+assinar). SyncStatusBadge.swift preservado (não apagado). Sugestão pra depois: olhar PERSIST-03 (parente do bug do estoque).

═══════════════════════════════════════════════════════════
## PRÓXIMA TAREFA — PLANEJAMENTO DO STINT NO CELULAR (depois do /clear de 15/06)
═══════════════════════════════════════════════════════════
DECISÃO DURA Flávio 15/06: o PLANEJAMENTO DO STINT é no CELULAR (app iOS), NÃO na web.
O painel do computador (web/cockpit) é SÓ o resultado do carro rodando conforme o planejado.

CONSTRUIR (depois do clear): botão de Stint na Home (no canto onde pus "Conta") que abre o
PLANEJAMENTO DO STINT. Pode ser: livre · vinculado ao evento (se for dia de evento) · não-vinculado
(fora do dia de evento) · com IA / treinamento. Conta/Sair migra pra dentro da Garagem.

SPEC COMPLETA + VIABILIDADE JÁ VERIFICADA (arquivo:linha) na memória:
  ~/.claude/projects/-Users-imac-Projetos-P1-Fast/memory/p1-fast-planejamento-stint-no-celular-2026-06-15.md

Resumo da viabilidade: Stint sem evento JÁ é suportado no banco (Sessao.eventoId nullable); falta o app
expor (StintRepository.create exige eventoId — criar caminho com nil). "Livre" já é objetivo canônico.
iOS já tem StintModalView com objetivo/lição/IA (conferir, estender, não recriar). eventoAtivoHoje() existe.
A lógica rica de treino-IA hoje está na web (catalogo-treinos.js/treino-stint.js/configuracao-stint.js) —
PORTAR pro celular. Antes de codar: TASK_INIT + card de escopo (v1 em fases).

NÃO esquecer: o botão "Conta" que pus na Home hoje é TEMPORÁRIO — vira o botão de Stint.

═══════════════════════════════════════════════════════════
## TASK_INIT — 2026-06-15 (pós-clear) — PLANEJAMENTO DO STINT NO CELULAR (retomada)
═══════════════════════════════════════════════════════════
1. **Pedido original de Flávio:** "retomar o planejamento do Stint em P1 Fast" (Stint = período de pilotagem).
2. **Objetivo (1 frase):** montar o plano v1 em fases do Planejamento do Stint NO APP iOS (botão na Home → modal de planejamento), amarrado em arquivo:linha do que já existe, + card de escopo antes de codar.
3. **Critérios de conclusão:** (a) estado atual do app confirmado (HomeView, StintModalView, StintRepository, EventoRepository) com arquivo:linha; (b) lógica rica de treino-IA da web mapeada pra portar; (c) contrato do plano que o painel lê confirmado (plano_stint jsonb, mig 0042); (d) plano v1 em fases entregue; (e) card de escopo aberto. NÃO codar antes do OK no card.
4. **Confirmação de leitura:** CLAUDE.md (sim), padroes.md (sim — vazio), FLAVIO_EXECUTION/DONE/ENVIRONMENT/COMMUNICATION (sim), P1 Fast/CLAUDE.md (sim), memória dois caminhos (sim — base: p1-fast-planejamento-stint-no-celular-2026-06-15.md).
5. **Plano (≤5 passos):** (a) mapear estado atual iOS + web (workflow paralelo); (b) confirmar contrato plano_stint; (c) montar plano v1 em fases; (d) abrir card de escopo; (e) só codar depois do OK.
6. **Áreas a inspecionar:** ios/p1fast-ios (HomeView, StintModalView, StintRepository, EventoRepository, ContentView/Garagem), ios/p1fast-core/Models.swift, web/cockpit (configuracao-stint.js, catalogo-treinos.js, treino-stint.js), supabase migration 0042 (plano_stint).
7. **Ambiente alvo:** desenvolvimento (planejamento; nenhum código alterado ainda).
8. **Produção protegida:** sim.
9. **Autorização para produção:** não.
10. **Evidência da autorização para produção:** não recebida.
11. **Riscos:** (a) recriar do zero o que já existe no StintModalView (memória manda CONFERIR e estender); (b) copiar literal a lógica web em vez de portar; (c) quebrar o caminho de criação de Stint que hoje EXIGE eventoId; (d) o botão "Conta" da Home vira Stint e Conta migra pra Garagem (não perder acesso a Conta/Sair).
12. **Status inicial:** iniciado — mapeando estado atual; sem alteração de código.

### ACHADO DO MAPEAMENTO (15/06, workflow 5 frentes, só leitura) — com arquivo:linha
JÁ EXISTE no app iOS (estender, NÃO recriar):
- `StintModalView` (Sources/Views/StintModalView.swift) coleta 10 campos: piloto, objetivo, voltas, lição (catálogo), pneu, combustível, paradas(volta+motivo), IA on/off, mapa ghost on/off, revezamento. Layout 6 seções + FootBar (:187-220). salvar() em :809-865.
- `StintRepository.create()` (Sources/Persistence/StintRepository.swift:131-161) EXIGE `eventoId:String` obrigatório → falta caminho "solto". Objetivos canônicos :536-544 = Aquecimento/Ataque/Consistência/Teste/Livre. finalize() :176-242 já SEM voltas-mock (origem real = painel ao vivo).
- `Sessao` (p1fast-core/.../Models.swift:780-916): eventoId É String? (nullable) → banco já aceita Stint solto. Campos: objetivo, pneuId, voltasPlanejadas, paradasBoxJson, mapaGhostLigado, pilotosRevezamentoJson. ParadaBox :748-756, PilotoTurno :761-777.
- `eventoAtivoHoje()` (EventoRepository.swift:188-197) decide "hoje é dia de evento?".
- Home: botão "Conta" temporário canto sup. dir. (HomeView.swift:174-197); BottomNav 4 abas Home/Eventos/Pendências/Garagem (:122-127). Garagem tem sub-abas (GaragemView.swift:284-297). Conta/Sair hoje em SincronizacaoView (:145-177).

A PORTAR da web (lógica pura, sem DOM — portável; NÃO copiar literal):
- PROPÓSITO livre/testar/treinar + catálogo 7 treinos (1 técnica trail-braking + 6 pontos: entrada/frenagem/vmin/apice/pace/saida) com brief{oQueE,oQueMede,comoAparece,ressalva} em web/cockpit/catalogo-treinos.js:29-170; brief obrigatório trava o Aprovar (configuracao-stint.js:138-166).
- Motor pedagógico TreinoStint (treino-stint.js:133-339): calibração 2 passagens, consistência 3/4, banda 30ms, degrau 30% teto4m piso2m, silêncio pré-box, válvula erro grave.
- Objeto do plano: {proposito, foco, ghost, voltas, paradas} (configuracao-stint.js:24-30).

CONTRATO que o painel LÊ (fechar o ciclo):
- `plano_stint` JSONB na tabela `envelopes_seguranca_stint` (migration 0042:29-36). Campos: proposito(livre|testar|treinar), foco, ghost, voltas, paradas[{volta,motivo}], carroId, piloto, autodromo, tipoPneu, vidaPneuFaixa, modo, aprovadoEm(ISO8601).
- Hoje QUEM GRAVA = web configuracao-stint.js:183-205. QUEM LÊ = painel treino-stint.js:56-131 (fallback nuvem, válido só no dia, fuso Brasília). iOS NÃO grava/lê plano_stint ainda — é a peça de "fechar o ciclo" (única que mexe na nuvem).

Status atualizado: planejamento montado; AGUARDANDO escopo do v1 no card. Sem código alterado.

### DECISÃO DO FLÁVIO (15/06) — escopo do v1
Escolha no card: **"Completo, fecha o ciclo"** = construir as 4 fases, incluindo Fase 3 (celular grava plano_stint no envelope que o painel lê). Fase 3 mexe na NUVEM (produção) → exige frase literal "MIGRAR PARA PRODUÇÃO" na hora; não publicar antes.

### PLANO DE EXECUÇÃO FECHADO (ordem; tudo em desenvolvimento até empacotar)
- **Fase 0 — Porta (dev, navegação):** HomeView.swift botão "Conta" → "Stint"; Conta/Sair migra pra Garagem (nova sub-aba/destino). Mexe em navegação EM USO → OK próprio do Flávio antes. Backup dos 3 arquivos (HomeView/GaragemView/SincronizacaoView).
- **Fase 1 — Abrir planejamento (dev):** botão Stint abre StintModalView (já existe). Adicionar caminho "solto": overload create(eventoId:String?=nil) em StintRepository (não quebrar create vinculado); StintModalView(eventoId:String?) opcional; auto-vínculo via eventoAtivoHoje().
- **Fase 2 — Propósito + treino (dev):** introduzir propósito livre/testar/treinar; portar catálogo (catalogo-treinos.js) + brief obrigatório que trava o Aprovar quando propósito=treinar; reusar 6 seções do modal. NÃO copiar literal — portar.
- **Fase 3 — Fechar o ciclo (PRODUÇÃO, gate):** struct PlanoStint Swift = contrato mig 0042; celular grava plano_stint no envelope (mesmo formato da web); painel passa a ler do que o celular planejou. PARAR e pedir "MIGRAR PARA PRODUÇÃO" antes de publicar/sincronizar com a nuvem.
- (Posterior) painel reagir ao foco/propósito/ghost — frente separada (TreinoStint).

Próximo passo: começar Fase 0 mediante OK do Flávio (troca de botão/navegação em uso).

### TASK_DONE — 2026-06-15 — FASE 0 (a porta) ENTREGUE em desenvolvimento
- Pedido original conferido: sim (Flávio autorizou "começar pela Fase 0").
- Ambiente trabalhado: desenvolvimento (app iOS). Produção/nuvem/iPhone do Flávio NÃO tocados.
- Produção foi alterada: não.
- Arquivos reais inspecionados/alterados:
  - HomeView.swift: botão "Conta" (canto sup. dir.) → botão "Stint" (cor de destaque) que abre HomeNavTarget.stintPlanejamento; removidos @State showContaSheet + a folha de Conta da Home; destino .garagem/.garagemNovo agora recebem syncCoordinator; novo case .stintPlanejamento no destinationView.
  - GaragemView.swift: +param/prop syncCoordinator (opcional); botão "Conta" na barra do topo (só quando coordenador presente) abrindo SincronizacaoView como folha; GaragemSheet +case .conta.
  - StintPlanejamentoView.swift (NOVO): tela-porta do Planejamento do Stint (placeholder honesto; Fases 1-3 enchem). Registrada no projeto (4 entradas no project.pbxproj, IDs 5717A0117E57000000000B01/B02).
- O que foi PRESERVADO: SincronizacaoView intacta (só mudou a porta de entrada, da Home pra Garagem); backup dos 3 arquivos originais em `.claude-exec/backup-fase0-stint-porta-2026-06-15/`.
- Testes/validação executados: `xcodebuild -scheme p1fast-ios -destination 'generic/platform=iOS Simulator' build` = **BUILD SUCCEEDED**, 0 erro. App instalado e ABERTO no simulador iPhone 17 Pro (booted) sem crash (chega na tela de login). Validação VISUAL da Home/Garagem depende do Flávio tocar "Entrar como Flávio (dev)" no simulador (não há login automático por parâmetro).
- Resultado: CONCLUÍDO em desenvolvimento (a porta). NADA no iPhone do Flávio ainda (só num próximo empacotar+assinar).
- Pendências reais: (1) validação visual do Flávio no simulador aberto; (2) Fase 1 (abrir StintModalView solto/vinculado) é o próximo passo; (3) Fase 3 (gravar plano_stint na nuvem) continua com gate "MIGRAR PARA PRODUÇÃO".

### AJUSTE Fase 0 (15/06, após Flávio ver no simulador) — botão Stint GRANDE e azul
Flávio: "o Stint tem que ser um botão GRANDE, azul cheio, do tamanho do 'Novo evento'; o Novo evento pode ser um pouco menor; é o botão de INICIAR o Stint." (Frase cortou em "inclusive..." — pode ter mais.)
- FAB.swift: +enum FABSize (.small 46 / .regular 56 / .big 64); param `size:` opcional, default .regular preserva os FABs existentes.
- HomeView.swift: tirei o botãozinho do canto sup. dir.; o "+ Stint" virou FAB GRANDE azul (size .big) no canto inf. dir. (herói) e o "+ Novo evento" ficou menor (size .small) logo acima.
- Validação: BUILD SUCCEEDED; reinstalado no simulador (sessão persistiu → abriu direto na Home); foto /tmp/p1fast-fase0-stint-grande.png confirma o "+ Stint" grande e o "+ Novo evento" menor. NADA no iPhone do Flávio ainda.
- PENDENTE: Flávio cortou em "inclusive..." — aguardar o resto do ajuste antes de seguir pra Fase 1.
