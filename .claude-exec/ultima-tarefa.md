# Última tarefa

> Registro anterior (Botão APAGAR da Garagem, 14/06 noite) arquivado em
> `.claude-exec/ultima-tarefa-ANTERIOR-garagem-apagar-2026-06-14.md`.

## TASK_INIT — 2026-06-15 noite — LIGAR A LUZ DE MARCHA (shift light) DO COMMAND BOX NO DADO REAL, com a MESMA lógica do cockpit do piloto
1. **Pedido original do Flávio:** "ligar o dado real. usando a mesma lógica que já te expliquei no cockpit do piloto." (sobre o shift light / barra de marcha do Command Box).
2. **Objetivo (1 frase):** fazer a barra de marcha do Command Box mostrar marcha + acender no ponto de troca usando o MESMO cérebro do cockpit (`shift-light-orquestrador.js`), alimentado pela telemetria ao vivo (canal `cockpit-bubi-live`).
3. **Critérios de conclusão:** (a) erro pré-existente `ReferenceError: stopShiftLightAnimation` eliminado; (b) a ligação ao vivo (assinatura do canal) volta a funcionar; (c) a barra de 12 luzes (visual intocado) acende pelo RPM real; (d) a MARCHA deixa de ser "—" e passa a ser inferida pelo cérebro (razão rpm/velocidade); (e) o ponto de troca vem do orquestrador (potência máxima 6.050 + refino por aprendizado), não mais de número fixo no painel; (f) zero escrita no banco; (g) validado em navegador real (sem tela) com prova.
4. **Leitura confirmada:** ~/.claude/CLAUDE.md (sim); CLAUDE.md do P1 Fast (sim); memórias dos dois caminhos sobre shift light / Command Box (sim). FLAVIO_EXECUTION/DONE/ENVIRONMENT/COMMUNICATION e ~/.claude-decisoes/padroes.md: não localizados como arquivos neste host — segui as regras do CLAUDE.md global, que contém o mesmo contrato.
5. **Plano (≤5 passos):** (1) backup do mockup; (2) criar adaptador `web/command-box/marcha-real.js` que reusa o orquestrador SEM duplicar lógica e SEM identificar piloto/carro (persistência fica inerte); (3) expor as funções da luz pro escopo do bloco ao vivo (corrige o ReferenceError) + render aceita ponto de troca do cérebro; (4) no bloco ao vivo: alimentar o cérebro com {rpm,kmh,ts} e desenhar com marcha + ponto reais; (5) validar (teste headless do cérebro + captura de console no navegador) e abrir pro Flávio.
6. **Áreas a inspecionar:** `_design-reference/mockup-command-box-vista-piloto.html` (funções da luz 7033-7078, bloco `setupLigacaoAoVivo` 7600-7765); `web/cockpit/shift-light-orquestrador.js` + cadeia; `web/command-box/` (padrão da frenagem).
7. **Ambiente alvo:** desenvolvimento (mockup + novo arquivo em web/command-box). 8. **Produção protegida:** sim. 9. **Autorização para produção:** não. 10. **Evidência:** não recebida (não vou publicar). 11. **Riscos:** mexer no painel que o Flávio considera sensível — mitigado com backup + visual da barra intocado + validação antes; o cérebro só ASSINA telemetria (leitura), nunca grava (não informo carro_id). 12. **Status:** iniciado.

## TASK_DONE — 2026-06-15 noite — CORRIGIR O CONCEITO da frenagem (referência = melhor volta, não régua teórica) — EM DEV, NÃO PUBLICADO
- **Correção do Flávio (card):** a referência da frenagem NÃO é uma régua teórica por tipo que eu monto — é o **registro da melhor volta** (a curva + a volta mais rápida mostram se/quanto/onde freou). E eu afirmei "o Bubi freia ~100% na Junção" SEM base: não há sensor de freio, dado é GPS ~1 Hz do celular (a passagem que abri tem só 9 pontos pra curva inteira), não é o 25 Hz do RaceBox. Decisão dele: "Corrigir o conceito agora + segurar a publicação".
- **O que mudou** (só `_design-reference/mockup-command-box-vista-piloto.html`, função `buildFrenagemPanel`, 3 hunks): (1) referência do parecer trocada de `cen.ideal` (régua teórica) para `cen.ref` (melhor volta registrada, que o motor `frenagem-real.js` já calcula na mesma grade); (2) ramo sem volta real (Bruxa/Placar/"S") deixou de desenhar a forma teórica — mostra estado honesto "sem dado de freio · entra com o sensor / 25 Hz" (não fica em branco, mas não inventa); (3) tarja honesta no parecer: "PROVISÓRIO · REFERÊNCIA = SUA MELHOR VOLTA · GPS ~1 Hz · SEM SENSOR DE FREIO".
- **Vmin INTOCADO** (confirmado por diff + grep: `_shortRevealStateForLap`/`updateVminFromLap`/`_applyLiveCurveOffset` não tocados; classes frx-* próprias). Régua teórica (`forma-trail-tipo.js`/`cen.ideal`) NÃO foi apagada — só deixou de ser consumida no painel; segue valendo no cockpit de treino.
- **Backup ANTES:** `_design-reference/command-box-versoes/vista-piloto-PRE-corrigir-conceito-2026-06-15.html` (MD5 conferido).
- **Validação:** diff mínimo (3 hunks); motor classifica as 8 curvas certo (C1/Reta Oposta/C2/Junção = volta real; Bruxa/Placar/"S" = sem dado; Vitória = SF); navegador headless (Playwright/CDP) — Curva 01 renderiza referência=melhor volta + tarja provisório (foto /tmp/p1_frenagem_comdado.png), Vitória renderiza pé embaixo, **0 erro novo de console**; único erro = o pré-existente `stopShiftLightAnimation` (luz de marcha, NÃO é da frenagem). NÃO rodei painel adversarial completo: diff trivial e de baixo risco, já provado por motor+render+diff.
- **Resultado:** CONCLUÍDO em DEV. **NÃO publicado.** Pendência única pra ir ao ar: confirmação visual do Flávio + frase "MIGRAR PARA PRODUÇÃO". Mas a recomendação é SEGURAR até o sensor de freio (16-17/06) / GPS 25 Hz darem base pro parecer.
- **Ressalva honesta ao olhar:** no exemplo parado o painel mostra a SUA MELHOR volta (live = ref) → bate 100% com a referência (parece "certo / delta 0"); no ao vivo real, compara a volta do momento contra a melhor.
- Pendência registrada à parte: erro pré-existente da luz de marcha (`stopShiftLightAnimation` em `setupLigacaoAoVivo`) — aguardo Flávio dizer se trato depois, em separado.

## TASK_INIT — 2026-06-15 noite (pós-/clear) — FRENAGEM Etapa 2b: ligar a forma-ideal-por-tipo no PAINEL OFICIAL

1. **Pedido de Flávio:** "RETOMAR FRENAGEM DO P1 FAST" (texto, não comando). Continuar do ponto exato: a Etapa 2a-bis
   (linha-ideal = trail prescrito do tipo) já está pronta/aprovada na prova; falta levar pro painel oficial do Command Box.
2. **Objetivo:** trocar a frenagem SIMULADA (FRX_CENARIOS fake) do painel oficial pela `ideal` (trail do tipo) + `live` real
   por curva, vindos dos módulos já provados, sem tocar no Vmin nem em produção.
3. **Critério de conclusão:** painel oficial mostra, por curva, o trail do tipo como ideal + volta real sobreposta quando há
   dado (Bruxa/Placar/"S" não ficam em branco); 'frenagem' sai do DEP_LIGACAO; Vmin intacto; testes verdes; painel reaberto
   na 8078 pro Flávio confirmar visualmente.
4. **Leitura:** CLAUDE.md, padroes.md (vazio), FLAVIO_EXECUTION/DONE/ENVIRONMENT/COMMUNICATION (4), P1 Fast/CLAUDE.md,
   memórias (global + P1 Fast: frenagem-dado-real, frenagem-command-box-redesenho, trail-criterio-certo) + ★ RETOMAR AQUI — sim.
5. **Plano (≤5):** (a) mapear com precisão os pontos do painel (FRX_CENARIOS:4243 / getFrenagemVerdictForCurve:4351 /
   buildFrenagemPanel:4363 / updateFrenagemFromLap:4445 / DEP_LIGACAO:7609) e a API dos módulos + como a prova os consome;
   (b) embutir/charegar os módulos no painel; (c) trocar o cenário fake pelo {ideal,live} real por id; (d) tirar 'frenagem'
   do DEP_LIGACAO; (e) rodar smokes + reabrir na 8078. Backup do painel JÁ feito antes de tocar.
6. **Arquivos:** _design-reference/mockup-command-box-vista-piloto.html (alvo, 328KB/7740 linhas),
   web/command-box/{forma-trail-tipo.js, frenagem-curvas-reais.js, frenagem-real.js, tipos-curva-brasilia.js},
   relatorios/{frenagem-dado-real, plano-frenagem-dado-real}-2026-06-15.html (referência), tests/*.mjs.
7. **Ambiente alvo:** desenvolvimento. **8. Produção protegida:** sim. **9. Autorização produção:** não.
10. **Evidência autorização produção:** não recebida (mockup oficial é dev; Vercel/nuvem é produção e fica intocada).
11. **Riscos:** edição grande em arquivo de 328KB; (a) quebrar o Vmin que compartilha fr-*/_shortRevealStateForLap —
   mitigado usando só classes/estado frx-* e não tocando no Vmin; (b) quebrar sintaxe inline do painel — mitigado com
   validação de sintaxe + smokes + servir 200. Backup: _design-reference/command-box-versoes/vista-piloto-PRE-etapa2b-ligar-trail-tipo-2026-06-15.html (MD5 conferido).
12. **Status inicial:** iniciado.

### TASK_DONE — Etapa 2b (2026-06-15 noite)
- Pedido original conferido: sim
- Ambiente trabalhado: desenvolvimento (mockup oficial; Vercel/nuvem intocada)
- Produção foi alterada: não
- Se produção foi alterada, autorização explícita registrada: n/a
- Arquivos reais inspecionados: sim
- Alterações feitas: sim — `_design-reference/mockup-command-box-vista-piloto.html` (9 edições: frxAlvoEm/frxPontos/frxDelta/frxChartSvg ganharam `alvo` opcional; `__FRX_REAL` + override em getFrenagemVerdictForCurve; buildFrenagemPanel com ideal-por-curva + nome real + delta real + 2 ramos novos SF/só-ideal; `_lastLiveT` + hook `window.__aplicarFrenagemReal`; 'frenagem' fora de DEP_LIGACAO; carregador `<script type=module>` no fim do <body>). Backup: `_design-reference/command-box-versoes/vista-piloto-PRE-etapa2b-ligar-trail-tipo-2026-06-15.html` (MD5 conferido).
- Testes/validação executados: sim — sintaxe dos 4 blocos 0 falhas; smokes freio-trecho 29 / frenagem-real 16 / forma-trail 30 / frenagem-curvas-reais 18 (93/0); sanidade Node do dado por curva (8 curvas, 0..7; C1-C4 com volta real / Bruxa-Placar-S só-ideal / Vitória SF); navegador headless (CDP) confirmou dado real carregado, bloco aceso (sai cb-sem-real), nomes reais, ramos SF e com-volta ao vivo, ZERO erro/aviso de console, nenhum 404 na cadeia dos módulos; revisor adversarial reproduziu o ramo só-ideal (8 ok/0 fail) e confirmou Vmin intocado + sinal do delta correto.
- Resultado: concluído em DEV — aguarda só confirmação VISUAL do Flávio no navegador (8078).
- Pendências reais: (1) confirmar visual + frase "MIGRAR PARA PRODUÇÃO" antes de publicar; (2) DECISÃO do Flávio: veredito da JUNÇÃO (T2 residual ideal~65 vs volta real ~100 → marca "errado/freou demais") — julgar a volta real contra a forma prescrita do tipo é o desejado? não bloqueia; (3) Etapa 3 = selo física↔sensor + 2-de-2→3-de-3 quando a pressão real entrar + faxina do legado.
- ACHADO PRÉ-EXISTENTE (não é regressão da 2b; idêntico no backup): ReferenceError `stopShiftLightAnimation is not defined` em `setupLigacaoAoVivo` (fiação shift-light/live) aborta parte daquela função. Fora do escopo; reportado ao Flávio.

## TASK_INIT — 2026-06-15 noite — FRENAGEM no dado real (Etapa 2a-bis): linha-ideal = trail PRESCRITO do tipo

1. **Pedido de Flávio:** "RETOMAR FRENAGEM DO P1 FAST" → continuar a frenagem do Command Box. Feedback 15/06 (verbatim):
   "nenhum deles é o trail braking clássico, que você dá uma porrada no freio e vem descendo em escadinha";
   "está faltando o trail brake da curva da Bruxa e da curva dupla [a 'S']... eu acho que está errado".
2. **Objetivo:** A linha IDEAL (tracejada + faixa) de cada curva passa a ser o trail clássico PRESCRITO do TIPO
   (porrada + escadinha), não a melhor volta crua de GPS ~1 Hz; nenhuma curva de freada fica em branco.
3. **Critério de conclusão:** toda curva de freada mostra o trail do seu tipo como ideal; volta real sobreposta
   quando há dado; Bruxa/Placar/"S" deixam de ficar vazias; testes verdes; prova reaberta na 8078 pro Flávio confirmar.
4. **Leitura:** CLAUDE.md, padroes.md (vazio), FLAVIO_* (4), P1 Fast/CLAUDE.md + memórias (global + P1 Fast) + ★ RETOMAR AQUI — sim.
5. **Plano (≤5):** (a) módulo `web/command-box/forma-trail-tipo.js` portando ALVOS.classico/residual do mockup VIVO;
   (b) ligar como ideal por tipo em `frenagem-curvas-reais.js` (live real sobreposto; sem dado → só o ideal, não branco);
   (c) atualizar a prova `relatorios/frenagem-dado-real-2026-06-15.html`; (d) smokes (novo forma-trail + atualizar curvas-reais);
   (e) rodar testes + reabrir na 8078.
6. **Arquivos:** web/command-box/{forma-trail-tipo.js[novo],frenagem-curvas-reais.js,frenagem-real.js},
   web/cockpit/perfil-trail-por-tipo.js (fonte do tipo→forma), relatorios/frenagem-dado-real-2026-06-15.html,
   tests/node-smoke-{forma-trail-tipo[novo],frenagem-curvas-reais}.mjs, package.json.
7. **Ambiente alvo:** desenvolvimento. **8. Produção protegida:** sim. **9. Autorização produção:** não.
10. **Evidência autorização produção:** não recebida. **11. Riscos:** muda o significado da linha tracejada
   (era "melhor volta", vira "ideal do tipo") — mitigado com backup `.claude-exec/backup-frenagem-formatipo-2026-06-15/`
   e validação visual antes de qualquer migração. NÃO tocar Vmin (compartilha fr-*/_shortRevealStateForLap).
12. **Status inicial:** iniciado.

### TASK_DONE — 2026-06-15 noite — Etapa 2a-bis concluída (aguarda confirmação visual do Flávio)
- Pedido original conferido: sim — linha-ideal = trail prescrito do tipo + nenhuma curva em branco.
- Ambiente trabalhado: desenvolvimento. Produção foi alterada: não. Autorização: não se aplica (nada em produção).
- Arquivos reais inspecionados: sim. Alterações feitas: sim (abaixo).
- Testes/validação: smoke:forma-trail 30/0 · frenagem-real 16/0 · frenagem-curvas-reais 18/0 · perfil-trail 23/0 ·
  freio-trecho 29/0 · trail-cockpit 45/0 · cockpit-web 16/0; bateria `npm run smoke` = 0 falhas (0 "✗").
  Prova serve 200 na 8078; script embutido valida em `node --check`; aberta no navegador.
- Resultado: concluído no escopo de dev. Pendências reais: (a) sua confirmação visual; (b) Etapa 2b = ligar no painel
  oficial mockup-command-box-vista-piloto.html; (c) Etapa 3 = selo física↔sensor + 3-de-3 + faxina do legado.
- Arquivos alterados: frenagem-real.js (2 exports aditivos FRX_IDEAL_ONSET/END) · frenagem-curvas-reais.js (ideal por
  tipo; semDado→semDadoReal com ideal) · relatorios/frenagem-dado-real-2026-06-15.html (4 edições) ·
  tests/node-smoke-frenagem-curvas-reais.mjs (CR-10/13 ajustados + CR-15..18) · package.json (smoke:forma-trail + bateria).
- Acrescentados: web/command-box/forma-trail-tipo.js · tests/node-smoke-forma-trail-tipo.mjs.
- Preservado: backups `.claude-exec/backup-frenagem-formatipo-2026-06-15/` (4 arquivos); Vmin/fr-*/_shortRevealStateForLap
  intocados; campo `ref` (melhor volta) ainda calculado (só não é mais a linha tracejada); produção intocada.

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

### AJUSTE 2 Fase 0/1 (15/06) — desenho FINAL do botão Stint + lógica
Flávio (detalhou): "+ Stint do tamanho do Novo evento, mas LÁ EM CIMA, ao lado do 'Hoje em Brasília'. Dia de evento → já abre no evento. Se não, pergunta vincular a um evento ou Stint livre. O Novo evento fica só dentro de Eventos. Tocar num próximo evento da Home → vai pra dentro daquele evento, e lá também executo o Stint e planejo."
FEITO (BUILD SUCCEEDED; reinstalado no simulador; foto /tmp/p1fast-stint-topo.png):
- FAB.swift voltou ao original (descartei o FABSize/botão grande).
- HomeView.swift: tirei o botão flutuante de baixo; "+ Stint" (tamanho normal) agora no cabeçalho da Home, ao lado do "Hoje em <pista>"; "Novo evento" SAIU da Home (segue em EventosListaView:59). +prop onStintTap.
- ContentView.swift (ReadyRoot): stintTapDecision() — eventoAtivoHoje() != nil → .eventoDetalhe(ev.id); senão → .stintPlanejamento. onStintTap injetado nos 2 HomeView.
- StintPlanejamentoView.swift: virou a tela de ESCOLHA (não-dia-de-evento) — "Vincular a um evento" (→ .eventos, funciona) / "Stint livre" (placeholder, Fase 1).
FALTA (apontado ao Flávio): (a) cartões de evento da Home clicáveis → abrir o evento; (b) Home está em DADOS DE EXEMPLO (HomeData.mockFilled) → conectar aos eventos REAIS é pré-requisito de (a) e de o cabeçalho bater com o botão; (c) "Stint livre" de verdade = Fase 1 (create solto + StintModalView eventoId opcional). NADA no iPhone do Flávio ainda.

═══════════════════════════════════════════════════════════
## TASK_INIT — 2026-06-15 (tarde/noite) — Frenagem no DADO REAL nas DUAS telas (pós-decisões em card)
═══════════════════════════════════════════════════════════
1. **Pedido original:** "próximo passo no breaking [frenagem] do p1 fast" → série de decisões em card: destino = NOS DOIS (painel da equipe + cockpit do piloto); quando = LIGAR JÁ no GPS real (não esperar o sensor).
2. **Objetivo (1 frase):** ligar a frenagem (desenho aprovado 15/06) no dado real por GPS nas duas telas, sem esperar o sensor de pressão.
3. **Critérios de conclusão:** as duas telas mostram freada calculada do GPS real (sai do roteiro de teste), desenho aprovado intacto, bloco Vmin intocado, smokes/testes passando, validado no navegador.
4. **Leitura:** CLAUDE.md (sim), padroes.md (sim — vazio), FLAVIO_EXECUTION/DONE/ENVIRONMENT/COMMUNICATION (sim, relidos), P1 Fast/CLAUDE.md (sim), memória dois caminhos (sim — base: p1-fast-frenagem-command-box-redesenho-2026-06-15).
5. **Ambiente alvo:** desenvolvimento (mockup _design-reference + web/cockpit local). Produção (Vercel p1t4000 / nuvem) NÃO tocada.
6. **Produção protegida:** sim. **Autorização produção:** não. **Evidência:** não recebida.

### ACHADO VERIFICADO (15/06, mapeamento 4 frentes + leitura direta + smokes) — com prova
- **Base verde:** smoke:freio-trecho 29/0, smoke:trail-cockpit 45/0, smoke:trail-religacao 10/0, smoke:cockpit-web 16/0.
- **COCKPIT DO PILOTO = JÁ PRONTO e ao vivo com o desenho aprovado.** main-t3000.js:41-42 importa TrailCockpitMotor + criarTrailCockpitTela; :149-194 arma o trail, selo de fonte `atualizarSeloFonteFreio` (FÍSICA GPS → SENSOR pressão sozinho); :440 leva pressaoFreioBar/pedalFreioPct do T4000 ao motor. RL-09/RL-10 travam. → metade do "nos dois" já feita; NÃO refazer.
- **COMMAND BOX (equipe) = o trabalho real.** _design-reference/mockup-command-box-vista-piloto.html:7549 `setupLigacaoAoVivo` JÁ assina `cockpit-bubi-live` (mostradores ao vivo desde hoje — meu registro da manhã ficou DESATUALIZADO nesse ponto). MAS o bloco de frenagem roda 100% em FAKE_LAPS/FRX_CENARIOS (updateFrenagemFromLap(liveT):4445 usa liveT simulado + currentLap()=FAKE_LAPS[_currentLapIdx]:4890). NÃO há acúmulo de GPS por curva no box (quem tem é o cockpit via TrechoDetector em live-data-bridge.js).
- **HTML é inline-only mas dynamic-importa Supabase de esm.sh (:7701)** → pode dynamic-importar os módulos locais (freio-trecho.js etc). atelier-server (8078) serve da raiz do projeto (tools/atelier-server.mjs:117) → `/web/cockpit/freio-trecho.js` resolve.
- **web/command-box VAZIO** (confirmado) — o Command Box "vista-piloto" só existe como esse mockup servido na 8078.
- **RISCO OPERACIONAL:** 15-16/06 é DIA DE PISTA; o painel da equipe só existe nesse arquivo. Mexer direto nele durante o evento é risco (cuidado já registrado no plano).

### Plano (≤5 passos) — recomendado, aguardando confirmação em card
1. Construir a frenagem real do box em CÓPIA isolada (backup do mockup), sem tocar no arquivo servido.
2. Dynamic-import do motor de produção (freio-trecho.js) + acúmulo de GPS por curva; trocar FRX_CENARIOS pela leitura real, mantendo o renderizador frx-* aprovado e o Vmin intactos.
3. Selo de fonte física-GPS↔sensor + 2-de-2 → 3-de-3 automático quando a pressão variar.
4. Validar com volta real gravada (fixture stint-brasilia-3-laps) no navegador; rodar smokes.
5. Trocar no painel ao vivo só DEPOIS do dia de pista, com OK do Flávio.

### Riscos
- (a) quebrar o desenho aprovado ou o Vmin (compartilham fr-*/_shortRevealStateForLap) → backup + classes frx-* próprias, não tocar Vmin.
- (b) mexer no painel em dia de pista → trabalhar em cópia isolada; só trocar depois do evento.
- (c) validar "real" sem o carro → replay de volta gravada.

### Status inicial: iniciado — verificação concluída; aguardando confirmação do caminho em card (sem alteração de código ainda).

### PROGRESSO 2 (15/06 noite) — verificação aprofundada + correções de premissa
- **Flávio corrigiu:** 16-17/06 NÃO é dia de pista — é INSTALAÇÃO DE SENSORES na oficina. Some o risco "dia de pista"; posso construir em dev agora (com backup). Pendência: saber se o sensor de pressão/pedal de freio está nessa leva (muda só a validação, não o que construo).
- **Backup feito:** _design-reference/command-box-versoes/vista-piloto-PRE-frenagem-dadoreal-2026-06-15.html (328536 bytes).
- **Estado real do box (verificado linha a linha):** mostradores (HUD rpm/kmh/lambda/água) JÁ ao vivo (setupLigacaoAoVivo:7549). Bloco frenagem em DEP_LIGACAO (:7609) → hoje ESMAECIDO, selo "aguardando ligação". Motor de volta fake CONGELADO no ao vivo (detectLapWrap=noop :7633). Frenagem movida por liveT SIMULADO + FAKE_LAPS + getCornerPhase, NÃO por GPS.
- **Cockpit do piloto JÁ PRONTO e ao vivo** com o desenho aprovado (main-t3000.js:41-194). Metade do "nos dois" feita — NÃO refazer.
- **Fixture stint-brasilia-3-laps.v1.json NÃO tem GPS por curva** — é a narrativa do demo (brakingId/speeds), não pontos {lat,lng,kmh,t}. Pontos reais vivem em: (a) banco prod `melhores_passagens_trecho.pontos_json` (melhores-loader.js); (b) backup local de voltas reais do Bubi.
- **Recipe headless confirmado:** freio-trecho.js (comDistanciaAcumulada→simularFreioPelaFisica→metricasTrail) e/ou trail-cockpit-motor.js (construirAlvoTrecho/computarVeredito). Georref por segments-loader.js (track_segments, prod). HTML inline mas dynamic-importa ESM (:7701) → pode importar módulos locais; atelier-server serve da raiz.
- **Adaptador necessário:** saída do motor (curva[{distM,freioPct,kmh}]+metricas) → forma FRX (live[18] na grade FRX_XS + minimaFreando + soltou + freioMin). Renderizador frx-* e Vmin intactos.
- **Conclusão:** "ligar no GPS real no box" = fazer o box trabalhar como o cockpit (reusar 4 módulos de prod + ler georref/melhores do banco em SÓ-LEITURA + assinar o canal ao vivo). Serviço grande; 1º passo a confirmar em card.
- **Status:** PARCIAL — verificação concluída, plano fechado, base verde (freio-trecho 29/0, trail-cockpit 45/0, trail-religacao 10/0, cockpit-web 16/0), backup salvo. SEM alteração no mockup ainda. Aguardando escolha do tamanho do 1º passo.

═══════════════════════════════════════════════════════════
## TASK_DONE — 2026-06-15 — Planejamento do Stint: tela de propósito + treino (dev)
═══════════════════════════════════════════════════════════
Flávio escolheu "Construir o planejamento do Stint". Construído em desenvolvimento:
- CatalogoTreinos.swift (NOVO): port fiel do catálogo do computador (1 técnica Trail braking + 6 pontos do trecho, com "o que é / o que a IA mede / ressalva") + FocoTeste (Motor/Freios/Pneus e rodas/Câmbio/Suspensão/Elétrica).
- StintPlanoView.swift (NOVO): a tela do planejamento — Propósito (Rodar livre / Testar o carro / Treinar habilidade) + catálogo + explicação OBRIGATÓRIA (trava o Aprovar) + Ghost + Voltas. "Aprovar plano" monta o plano e mostra o resumo.
- HomeView.swift: +destino .stintPlano(eventoId:String?). StintPlanejamentoView "Stint livre" → abre o planejamento.
- Registrados no project.pbxproj. Empacotamento = BUILD SUCCEEDED, 0 erro (1 erro corrigido no caminho: nome `Layout` colide com tipo do projeto → troquei por rolagem horizontal nos chips). Reinstalado no simulador.
- Produção/nuvem/iPhone do Flávio: NÃO tocados. Validação visual: Flávio toca "+ Stint" → "Stint livre" no simulador.
- FALTA (próximo): "Aprovar" GRAVAR o plano (formato plano_stint que o painel lê) + INICIAR o Stint de verdade = parte que mexe na NUVEM → gate "MIGRAR PARA PRODUÇÃO". E conectar a Home aos eventos reais + cartões clicáveis.
- Resultado: a EXPERIÊNCIA do planejamento (propósito/treino/voltas) pronta pra validar; gravar+iniciar pendente.

═══════════════════════════════════════════════════════════
## FRENAGEM DADO REAL — DECISÕES + ETAPA 1 ENTREGUE (15/06 noite)
═══════════════════════════════════════════════════════════
Decisões em card (Flávio, 15/06): destino = NOS DOIS (cockpit já pronto) · quando = LIGAR JÁ no GPS real ·
16-17/06 = instalação de sensores na oficina (NÃO é dia de pista) · 1º passo = "COMPLETO, COMO O COCKPIT".

### ETAPA 1 — adaptador do motor de produção (CONCLUÍDA, testada, risco zero ao mockup)
- NOVO `web/command-box/frenagem-real.js`: importa o motor de produção `web/cockpit/freio-trecho.js`
  (comDistanciaAcumulada → simularFreioPelaFisica / fundirFreioNosPontos → metricasTrail) e devolve a
  frenagem de uma passagem real NO MESMO formato de FRX_CENARIOS: { live[18] na grade FRX_XS,
  minimaFreando, soltou, freioMin, fonteFreio, deltaM }. Ancora a janela 0..60 m pelo ponto de freada da
  melhor volta no mesmo x do ideal. NÃO copia lógica (importa); renderizador frx-* e Vmin NÃO tocados.
- NOVO teste `tests/node-smoke-frenagem-real.mjs` = 14/14 (passagem real vira FRX; física sem sensor;
  sensor de pressão vence quando varia; sensor chapado NÃO engana; sem freada → null; deltaM + quando freou
  depois; ancoragem do onset ±6 m).
- Registrado em package.json: `smoke:frenagem-real` + incluído no agregado `smoke`.
- Validação: smoke:frenagem-real 14/0; base intacta (freio-trecho 29/0, trail-cockpit 45/0, trail-religacao
  10/0, cockpit-web 16/0); package.json JSON válido. MOCKKUP servido NÃO alterado nesta etapa.

### FALTA (ETAPA 2 e 3) — próximo passo
- ETAPA 2 (mexe no mockup, com backup já salvo): dynamic-import do adaptador + segments-loader (georref) +
  melhores-loader (volta de referência do banco, SÓ LEITURA) no setupLigacaoAoVivo; acumular GPS por curva
  do canal; mapear segment_id ↔ CURVES (C1..C8); fazer getFrenagemVerdictForCurve/buildFrenagemPanel usarem
  o adaptador no lugar de FRX_CENARIOS; tirar 'frenagem' de DEP_LIGACAO.
- ETAPA 3: selo de fonte física-GPS↔sensor no bloco + 2-de-2 → 3-de-3 quando a pressão variar; validar no
  navegador (8078) com volta real; rodar todos os smokes; faxina do legado morto
  (frenagemCurveTone/VERDICTS_FRENAGEM/FRENAGEM_GHOST).
- Limite honesto: o caminho AO VIVO só valida 100% com volta fluindo (carro ou reprodutor). Saber se o
  sensor de pressão/pedal de freio está na leva de 16-17/06 (muda só a validação do caminho do sensor).
- Status: PARCIAL — Etapa 1 (núcleo de produção) concluída e protegida por teste; Etapas 2-3 pendentes.

### ETAPA 2a — frenagem REAL por curva + prova no navegador (CONCLUÍDA, testada)
- Achei georref LOCAL (sem banco): `_design-reference/PONTOS-TRECHOS-BRASILIA-2026-05-28.json` (linha entrada/ápice/saída por curva).
- Achei voltas REAIS do Bubi no backup `~/Documents/p1fast-backup-voltas-reais/passagens-bubi-aplicadas.json`
  (56 passagens, já fatiadas por curva, pontos {lat,lng,kmh,t}). Backup PRESERVADO (só leitura).
- NOVO fixture local `web/command-box/fixtures/passagens-bubi-brasilia.v1.json` (60 KB, 56 passagens, 8 curvas × 7 voltas)
  — cópia enxuta do backup. Mapeamento curva↔dado conferido: 8 curvas casam a ordem da pista, nenhuma órfã.
- NOVO `web/command-box/frenagem-curvas-reais.js`: monta a frenagem real por curva (melhor=referência) via o adaptador.
- NOVO teste `tests/node-smoke-frenagem-curvas-reais.mjs` = 10/10. Registrado (smoke:frenagem-curvas-reais + agregado).
- RESULTADO REAL: 4 de 8 curvas (C1-C4) têm freada real medida; C5-C8 têm GPS ralo (4-6 pontos a 1 Hz) →
  declaradas "sem freada medível" (NÃO inventadas). Resolve com volta ao vivo / 25 Hz.
- PROVA VISUAL no navegador: `relatorios/frenagem-dado-real-2026-06-15.html` (servida 8078, ABERTA pro Flávio) —
  desenha a freada real por curva no visual aprovado (banda ±8%, verde/vermelho, marcador, veredito, selo FÍSICA GPS),
  com seletor de volta. NÃO é o painel final — é prova de que o dado é real e bate. Mockup servido NÃO alterado.
- Validação: smoke:frenagem-real 14/0, smoke:frenagem-curvas-reais 10/0; HTTP 200 da página + módulos + fixture.

### FALTA — ETAPA 2b (no painel) + ETAPA 3
- 2b: ligar o módulo DENTRO do mockup (setupLigacaoAoVivo): override de getFrenagemVerdictForCurve com o dado real
  por curva + driver de volta (canal ao vivo, ou replay da volta gravada) pra a tela ciclar curva a curva;
  tirar 'frenagem' de DEP_LIGACAO. É a edição grande no arquivo de 328 KB (backup já salvo).
- 3: selo física↔sensor no bloco + 2-de-2→3-de-3 quando a pressão variar; faxina do legado morto.
- Status geral: PARCIAL — toda a base de cálculo + dado real + prova visual prontos e testados (risco zero ao painel);
  falta a edição do painel em si (2b) e o acabamento (3).

### ETAPA 2a — 2 CORREÇÕES após Flávio ver a prova (15/06 noite)
- DEFEITO 1 (apontado por mim ao revisar): a curva real era espremida numa janela fixa de 60 m, mas a freada
  real vai a ~170-200 m → a linha vinha CORTADA (só a subida, "ia pra frente sem descer"). CONSERTO em
  frenagem-real.js: `janelaFreada` + `amostrarNaGrade` — a curva agora ocupa a ZONA REAL da freada (início→soltura),
  sobe até o pico e DESCE. Comparação passou a ser contra a MELHOR volta da curva (campo `ref`), não um ideal
  genérico (FRX_ALVO). Marcador "+/−m" = deltaM real. Testes FR-15/FR-16 novos.
- DEFEITO 2 (apontado pelo Flávio, mais grave): eu usava UM trail só pra todas as curvas, ignorando que cada
  curva tem TIPO próprio com trail próprio. CONSERTO: NOVO `web/command-box/tipos-curva-brasilia.js` = tipo
  DEFINITIVO por curva (decisão literal Flávio 13/06, registro 20260613-172700; C1=T5 RETA-OPOSTA=T1 C2=T0
  JUNÇÃO=T2 BRUXA=T0 PLACAR=T2 S=T4 VITÓRIA=SF). frenagem-curvas-reais.js agora anexa tipo+rótulo+formato
  (TIPOS de classificador-trecho.js) + texto fácil (tipos-curva-texto.js). SF (Vitória) = "sem freada por TIPO"
  (pé embaixo), distinta de "dado ralo". Princípio respeitado (classificador-trecho.js:4-8): o ALVO é a melhor
  passagem real (régua); o tipo só NOMEIA/explica. Testes CR-11..CR-14 novos.
- Prova visual refeita: relatorios/frenagem-dado-real-2026-06-15.html — dashed = SUA melhor volta da curva,
  verde/vermelho da volta mostrada vs a melhor, badge do tipo + descrição do trail do tipo, seletor de volta.
  Reaberta no navegador (8078). Mockup servido ainda NÃO alterado.
- Validação: smoke:freio-trecho 29/0, smoke:frenagem-real 16/0, smoke:frenagem-curvas-reais 14/0,
  smoke:trail-cockpit 45/0, smoke:cockpit-web 16/0; HTTP 200 dos módulos + página.
- Honesto: 4/8 curvas têm freada real medida (C1-C4); VITÓRIA é SF (sem freada por tipo); BRUXA/PLACAR/"S"
  são tipo de freada mas o dado de maio é ~1 Hz (4-6 pontos) → entram com a volta ao vivo / 25 Hz.

═══════════════════════════════════════════════════════════
## HANDOFF (clear 15/06 noite) — PLANEJAMENTO DO STINT NO CELULAR — VALIDADO NO IPHONE
═══════════════════════════════════════════════════════════
RETOMAR pela memória `p1-fast-planejamento-stint-no-celular-2026-06-15.md` (bloco "▶ RETOMAR AQUI" no topo).
DONE e VALIDADO no iPhone real do Flávio ("funcionou bem", Bolinha/Celta 1.4 aparece): botão "+ Stint" no topo da Home; "Novo evento" só em Eventos; Conta na Garagem; toque no Stint decide (dia de evento→abre evento / senão→pergunta vincular/livre); tela de planejamento (propósito livre/testar/treinar + catálogo de treinos fiel + brief obrigatório + ghost + voltas; "Aprovar" mostra resumo); Home com DADOS REAIS + cartões de evento clicáveis. App ASSINADO+INSTALADO no iPhone (cert flaviomarques@me.com, vence ~22/06).
Arquivos: HomeView/GaragemView/ContentView/FAB.swift (alterados) + StintPlanejamentoView/StintPlanoView/CatalogoTreinos.swift (novos) + project.pbxproj. Backups em backup-fase0-stint-porta-2026-06-15/. Produção/nuvem NÃO tocadas.
PRÓXIMO: (1) "Aprovar" GRAVAR plano_stint + INICIAR Stint = gate "MIGRAR PARA PRODUÇÃO"; (2) investigar carros/eventos não subirem pra nuvem (Bolinha só no iPhone, nuvem vazia); (3) painel reagir ao foco.

════════════════════════════════════════════════════════════════════
## ★ RETOMAR AQUI — FRENAGEM NO DADO REAL (Command Box) — pós-/clear 15/06 noite
════════════════════════════════════════════════════════════════════
PEDIDO ORIGINAL: "próximo passo no breaking [frenagem] do p1 fast". Decisões em card:
destino = NOS DOIS (cockpit do piloto JÁ pronto/ao vivo — NÃO refazer; falta só o Command Box da equipe);
quando = LIGAR JÁ no GPS real; 1º passo = "COMPLETO, COMO O COCKPIT".
16-17/06 = instalação de SENSORES na oficina (NÃO é dia de pista).

ONDE ESTÁ (tudo em DESENVOLVIMENTO; mockup oficial NÃO tocado; produção intocada):
- ETAPA 1 ✓ motor/adaptador testado. ETAPA 2a ✓ frenagem real por curva + tipos definitivos + prova visual.
- ARQUIVOS NOVOS:
  - web/command-box/frenagem-real.js — adaptador: roda freio-trecho.js (produção) numa passagem e devolve
    {live[18], ref[18], minimaFreando, soltou, freioMin, fonteFreio, deltaM}. Janela = ZONA REAL da freada
    (início→soltura), curva sobe e DESCE. Compara contra a MELHOR volta (ref). Física agora / sensor sozinho.
  - web/command-box/frenagem-curvas-reais.js — por curva (8), anexa TIPO definitivo + trail do tipo; SF = sem
    freada por tipo; dado ralo = semDado honesto.
  - web/command-box/tipos-curva-brasilia.js — TIPO_POR_CURVA (decisão Flávio 13/06): C1=T5, RETA OPOSTA=T1,
    C2=T0, JUNÇÃO=T2, BRUXA=T0, PLACAR=T2, "S"=T4, VITÓRIA=SF.
  - web/command-box/fixtures/passagens-bubi-brasilia.v1.json — 56 passagens reais do Bubi (cópia do backup
    ~/Documents/p1fast-backup-voltas-reais/passagens-bubi-aplicadas.json; backup PRESERVADO).
  - tests/node-smoke-frenagem-real.mjs (16/0) + tests/node-smoke-frenagem-curvas-reais.mjs (14/0) — na bateria.
  - relatorios/frenagem-dado-real-2026-06-15.html — PROVA visual (não é o painel final).
  - BACKUP do mockup oficial: _design-reference/command-box-versoes/vista-piloto-PRE-frenagem-dadoreal-2026-06-15.html
- TESTES verdes: freio-trecho 29 · frenagem-real 16 · frenagem-curvas-reais 14 · trail-cockpit 45 · cockpit-web 16.

⚠️ FEEDBACK DO FLÁVIO (15/06 noite) — AINDA NÃO ATENDIDO, é o PRÓXIMO PASSO:
  (verbatim) "nenhum deles é o trail braking clássico, que você dá uma porrada no freio e vem descendo em
  escadinha"; "está faltando o trail brake da curva da Bruxa e da curva dupla [a 'S'] porque é feita sem
  frenagem... eu acho que está errado".
DIAGNÓSTICO: o ideal/forma que mostrei veio da MELHOR VOLTA REAL (GPS ~1 Hz, grosseira) → não parece trail
clássico; e BRUXA(T0)/"S"(T4) ficaram em BRANCO por dado ralo. O CERTO = usar o PERFIL PRESCRITO POR TIPO
como forma-ideal (a régua teórica), que JÁ É o trail clássico (porrada + escadinha), variando por tipo.

FONTE PRONTA pro conserto (NÃO recriar): web/cockpit/perfil-trail-por-tipo.js (PERFIL_POR_TIPO, perfilDeTrail,
resumoTrail). Cada tipo aponta curvaExemplo: 'classico' (T0/T1/T5) ou 'residual' (T2/T4); T3='toque'; SF=sem.
As FORMAS y(x) ALVOS.classico (100% pancada + soltura gradativa até o ápice = porrada+escadinha) e
ALVOS.residual (parcial ~65% + residual ~45% + soltura curta) estão em
_design-reference/mockup-cockpit-treino-trail-braking-VIVO-2026-06-11.html. Teste: smoke:perfil-trail.

PRÓXIMO PASSO (Etapa 2a-bis) — ✅ FEITO 15/06 noite, AGUARDA SÓ CONFIRMAÇÃO VISUAL DO FLÁVIO:
1. ✅ Módulo web/command-box/forma-trail-tipo.js criado: porta ALVOS.classico (Bézier idêntico) + ALVOS.residual do
   mockup VIVO p/ % de freio na grade FRX; tipo→forma via perfilDeTrail; SF/ND→null. Onset/fim vêm de
   FRX_IDEAL_ONSET/END (novos exports de frenagem-real.js) p/ ALINHAR com o live.
2. ✅ frenagem-curvas-reais.js: toda curva de freada traz `ideal` (trail do tipo, tracejada+faixa); live sobreposto
   quando há dado; sem dado real → `semDadoReal:true` + ideal (NÃO fica em branco). Bruxa/Placar/"S" reabilitadas.
3. ✅ Prova atualizada (chart usa ideal; render trata só-ideal; legenda/sub/foot) + smokes (forma-trail 30/0; curvas 18/0);
   bateria 0 falhas; reaberta na 8078.
4. ✅ Flávio APROVOU seguir (15/06 noite, verbatim: "depois você liga no painel oficial do Command Box"). Pediu /clear ANTES.

▶▶ AO RETOMAR ("RETOMAR FRENAGEM DO P1 FAST"), FAZER A ETAPA 2b — ligar a forma-ideal-por-tipo no PAINEL OFICIAL:
   Arquivo: _design-reference/mockup-command-box-vista-piloto.html (FAZER BACKUP em
   _design-reference/command-box-versoes/ ANTES de tocar; NÃO mexer no Vmin/fr-*/_shortRevealStateForLap).
   O motor já está pronto em web/command-box/{forma-trail-tipo.js, frenagem-curvas-reais.js, frenagem-real.js} e
   provado em relatorios/frenagem-dado-real-2026-06-15.html. No painel oficial hoje a frenagem é SIMULADA (FRX_CENARIOS
   fake). Plano: trocar o alvo/cenário fake pela `ideal` (trail do tipo) + `live` real por curva via
   construirFrenagemRealPorCurva; override de getFrenagemVerdictForCurve por id; tirar 'frenagem' de DEP_LIGACAO:7609.
   Conferir o plano escrito: relatorios/plano-frenagem-dado-real-2026-06-15.html.
   ⚠️ Ao mostrar a ele: apontar a JUNÇÃO (T2 residual ideal~65, mas a volta real do Bubi soca ~100 → marca
   "errado/freou demais") e perguntar se o veredito contra a forma do tipo é o desejado — NÃO bloqueia a 2b.
DEPOIS: ETAPA 3 = selo física↔sensor no bloco + 2-de-2→3-de-3 quando a pressão variar + faxina do legado morto.

COMO REABRIR A PROVA: (server local) `node tools/atelier-server.mjs` (porta 8078) →
`open http://localhost:8078/relatorios/frenagem-dado-real-2026-06-15.html`.
COMO TESTAR: `npm run smoke:frenagem-real` · `smoke:frenagem-curvas-reais` · `smoke:perfil-trail`.
REGRA DURA: NÃO mexer no Vmin (compartilha fr-*/_shortRevealStateForLap); classes próprias frx-*; backup antes
de tocar no mockup; produção (Vercel/nuvem) intocada.

════════════════════════════════════════════════════════════════════
## TASK_INIT — 2026-06-15 (retomada pós-clear nº2) — FECHAR O CICLO DO PLANEJAMENTO DO STINT
════════════════════════════════════════════════════════════════════
1. PEDIDO: "retomar o planejamento do Stint".
2. OBJETIVO: "Aprovar" passar a GRAVAR o plano completo (formato plano_stint) + INICIAR o Stint, em
   desenvolvimento, sem tocar na nuvem sem ordem.
3. RE-VERIFICAÇÃO (arquivo:linha, só leitura — não é suposição):
   - StintPlanoView.swift footBar :325-343 → "Aprovar" só faz `aprovado=true`+resumo. Coleta
     proposito/focoTeste/focoTreino/ghost/voltas. NÃO tem carro/piloto/pista/pneu/vida/paradas/modo.
   - Contrato plano_stint (mig 0042 + web configuracao-stint.js:180-205): { proposito, foco, ghost, voltas,
     paradas[], carroId, piloto, autodromo, tipoPneu, vidaPneuFaixa, modo, aprovadoEm } + colunas do envelope
     (carro_id, modo_stint, tipo_pneu, vida_pneu_faixa, config_cambio, rpm_max_absoluto, rpm_min_motor_celsius,
     forca_lateral_max_g, observacoes, plano_stint).
   - Envelope = ESCRITA DIRETA na nuvem (POST /rest/v1/envelopes_seguranca_stint, anon key, RLS desligada).
     NÃO passa pela sincronização (envelopes_seguranca_stint fora de ALLOWED_TABLES). iOS TEM o encanamento:
     Configuration.restURL/supabaseAnonKey + SessionManager.accessToken + URLSessionTransports (apikey+Bearer).
   - Sessão: StintRepository.create(eventoId:String,...) EXIGE eventoId (:132); Sessao.eventoId é String?
     (nullable) → precisa caminho solto. sessoes JÁ sincroniza.
   - NÓ (design = decisão do Flávio): carro/piloto/pista/pneu/paradas vivem no MODAL ANTIGO StintModalView
     (@EnvironmentObject pneuRepo/combustivelRepo + @State paradas[]/turnos + cria a sessão). A tela nova
     (StintPlanoView) e o modal antigo NUNCA foram unificados. Como compor = CARD aberto.
   - Valores de segurança (rpm_max_absoluto/forca_lateral_max_g) NÃO existem no iOS — vivem em web
     shift-light-modos.js (ENVELOPE_DEFAULT_BUBI/PERFIL_BUBI). PORTAR FIEL, não inventar.
4. AMBIENTE: desenvolvimento. PRODUÇÃO PROTEGIDA: sim. AUTORIZAÇÃO PRODUÇÃO: não. EVIDÊNCIA: não recebida.
5. STATUS: mapeamento concluído; CARD de composição das duas telas aberto pro Flávio ANTES de codar.
   Nenhum código alterado. Aviso paralelo (a confirmar em só-leitura): Bolinha/eventos podem estar só no iPhone.

### DECISÃO DO FLÁVIO (15/06, card) — composição
"UMA TELA SÓ": levar propósito/treino PRA DENTRO do StintModalView (que já tem pneu/paradas/combustível/
piloto/ghost/voltas e já cria a sessão). Um "Aprovar" único monta o plano completo, grava o envelope na
nuvem (papel que o computador fazia) e inicia o Stint. CONSEQUÊNCIA registrada: o "Aprovar" do celular passa
a GRAVAR o envelope de segurança — é a premissa "planejamento mora no celular", mas é mudança de fluxo de
segurança (avisado ao Flávio).

### PLANO DE EXECUÇÃO (uma tela só) — ordem
- [FEITO] BASE no núcleo P1FastCore (auto-incluído, sem mexer no project.pbxproj):
  ios/p1fast-core/Sources/P1FastCore/PlanoStint.swift — struct PlanoStint (Codable, chaves IDÊNTICAS ao JSON
  da web: proposito/foco/ghost/voltas/paradas/carroId/piloto/autodromo/tipoPneu/vidaPneuFaixa/modo/aprovadoEm),
  PlanoParada, EnvelopeDefaultBubi (6300/80/0.50/115/95/6050 — PORT FIEL de shift-light-modos.js, NÃO inventado),
  ModoStint.registro="agressivo", normalizarTipoPneu (port de tipo-pneu-normalizer.js).
  Smoke PLANO-01..04 em P1FastSmoke/main.swift = PASSARAM (swift run p1fast-smoke: 549 ok / 2 fail; os 2 fails
  são PRÉ-EXISTENTES — PERSIST-01 contagem 34≠38, PERSIST-03 evento_pendencias_extra synced_at, NÃO meus).
- [PRÓX 1] Caminho "Stint solto": StintRepository.create(eventoId: String?) (additivo; callers atuais passam
  String e seguem compilando). Sessao.eventoId já é String?; sessoes já sincroniza.
- [PRÓX 2] EnvelopeAprovacaoWriter (camada do app iOS): POST direto /rest/v1/envelopes_seguranca_stint
  (Configuration.restURL/supabaseAnonKey + SessionManager.accessToken), corpo = colunas snake_case {carro_id,
  modo_stint, tipo_pneu(normalizado), vida_pneu_faixa, config_cambio:'padrao', rpm_max_absoluto,
  rpm_min_motor_celsius, forca_lateral_max_g, observacoes, plano_stint(JSON do PlanoStint)} + o MESMO fallback
  da web (banco sem coluna plano_stint → regrava sem o plano e conta a verdade). Prefer=representation.
- [PRÓX 3] MERGE no StintModalView: adicionar seção Propósito (livre/testar/treinar) + catálogo + brief
  obrigatório (portar de StintPlanoView, UI já existe); eventoId vira opcional (solto); no salvar() — depois do
  create + setStintExtensions — montar PlanoStint dos campos do modal + chamar o writer. BACKUP do modal antes.
  StintPlanejamentoView "Stint livre" passa a abrir o StintModalView solto (em vez do StintPlanoView).
- [PRÓX 4] Build app (xcodebuild) verde + validar no simulador SEM escrever na nuvem real do Flávio.
- [GATE] Ativar no iPhone (o "Aprovar" gravando envelope/plano REAL na nuvem) = exige frase literal
  "MIGRAR PARA PRODUÇÃO". Até lá, nada vai pra nuvem dele.

### TASK_DONE (parcial) — 2026-06-15 — base do "fechar o ciclo"
- Pedido original conferido: sim (retomar o planejamento do Stint).
- Ambiente trabalhado: desenvolvimento (núcleo P1FastCore + smoke). Produção/nuvem/iPhone do Flávio: NÃO tocados.
- Produção foi alterada: não.
- Arquivos reais inspecionados: sim (StintPlanoView, StintModalView, StintRepository, Models, mig 0042/0034,
  sync/index.ts, configuracao-stint.js, shift-light-modos.js, tipo-pneu-normalizer.js, Configuration/SessionManager).
- Alterações feitas: sim — NOVO PlanoStint.swift (core) + 4 smokes (PLANO-01..04). Nada removido.
- Testes executados: sim — swift run p1fast-smoke = 549 ok / 2 fail (os 2 são pré-existentes, não meus).
- Resultado: PARCIAL — base do plano pronta e provada; faltam PRÓX 1-4 + GATE.
- Pendências reais: solto path, writer do envelope, merge no modal, build do app, ativação (gate). Aviso paralelo:
  Bolinha/eventos podem estar só no iPhone (a confirmar em só-leitura quando o Flávio pedir).

### MIGRAR PARA PRODUÇÃO (Flávio escreveu a frase literal 15/06) — CONSTRUÍDO em dev, app COMPILA
PROD_RELEASE_PLAN apresentado. O que a frase cobre: o "Aprovar" do celular passa a gravar plano+envelope na
nuvem e iniciar o Stint. NADA foi escrito na nuvem do Flávio ainda (só vira real quando ELE tocar Aprovar no
iPhone). Backups: .claude-exec/backup-fechar-ciclo-stint-2026-06-15/ (StintModalView/StintRepository/StintPlanejamentoView).
- FEITO (PRÓX 1-4): 
  - StintRepository.create(eventoId: String?) — solto (additivo).
  - EnvelopeAprovacao (StintRepository.swift, fim): POST direto /rest/v1/envelopes_seguranca_stint (apikey+Bearer
    anon, Prefer=representation), payload snake_case {carro_id, modo_stint='agressivo', tipo_pneu(normalizado),
    config_cambio='padrao', rpm_max/min/forca de EnvelopeDefaultBubi, observacoes, plano_stint} + plano-B PGRST204
    (regrava sem plano). vida_pneu_faixa OMITIDO → DB default '0-30'.
  - StintModalView: eventoId opcional; nova seção "Propósito do Stint" (livre/testar/treinar + catálogo + brief
    obrigatório que gateia o Aprovar); salvar() agora APROVA (grava envelope+plano via EnvelopeAprovacao) e DEPOIS
    inicia o Stint; tipoPneuBruto derivado do pneu montado (composto+medida → normalizarTipoPneu); botão "Aprovar e iniciar".
  - StintSoltoLauncher (fim de StintModalView.swift) + HomeView .stintPlano agora abre o modal solto (StintPlanoView
    PRESERVADA, sem rota).
- VALIDAÇÃO: `xcodebuild -scheme p1fast-ios ... build` = **BUILD SUCCEEDED**, 0 erro. swift run p1fast-smoke 549 ok/2
  fail (pré-existentes). NÃO escrevi na nuvem do Flávio (não poluí). Runtime do modal NÃO testado headless (precisa
  toque) — valida no iPhone do Flávio.
- PENDENTE (ativação): iPhone do Flávio NÃO está conectado agora (devicectl: indisponível). Pra instalar a versão
  nova (a ativação) preciso do iPhone plugado + desbloqueado (+ "Confiar" se pedir). Quando conectar: reempacotar
  assinado + instalar (cert flaviomarques@me.com, perfil vence ~22/06) → Flávio toca "+ Stint" → propósito → "Aprovar
  e iniciar" → confere se o painel arma o treino. SÓ a 1ª aprovação dele grava de verdade na nuvem.
- LIMITES honestos do v1: autodromo e vida_pneu_faixa não vão no plano ainda (painel casa pelo carro / DB usa '0-30');
  tipo_pneu é derivado do pneu montado (best-effort). Refinar depois se o painel precisar.

### ATIVAÇÃO FEITA (15/06 noite) — app NOVO instalado + abriu no iPhone do Flávio
- Empacotado assinado p/ device (generic/platform=iOS, perfil "iOS Team Provisioning Profile: com.flaviomarques.p1fast",
  vence ~22/06) em /tmp/p1fast-device-build/.../p1fast-ios.app — BUILD SUCCEEDED.
- Instalado: `xcrun devicectl device install app --device 00008140-000E2D611E6A801C ...` → "App installed:
  com.flaviomarques.p1fast" (aviso "No provider was found" é benigno; concluiu). Device = iPhone 16 Pro Max, modo dev ligado.
- Aberto: `devicectl device process launch` → "Launched application" = SOBE sem cair na abertura.
- DICA p/ reinstalar: device precisa estar DESBLOQUEADO/estável; build com destination 'id=<udid>' EXPIRA esperando o
  aparelho → empacotar com 'generic/platform=iOS' e instalar com devicectl.
- PENDENTE = validação AO VIVO do Flávio: "+ Stint" → Stint livre → propósito (ex. treinar) → "Aprovar e iniciar"
  (1ª aprovação grava o plano REAL na nuvem) → conferir no painel se arma o treino. Aguardando ele reportar.

### DIAGNÓSTICO + CONSERTO (15/06 noite) — Flávio: "clico em iniciar, não acontece nada, volta na tela anterior"
- VERIFICADO NA NUVEM (só-leitura, REST GET, projeto fvhwltzhytpnhlqbttmd): FUNCIONOU. 3 ENVELOPES gravados
  16/06 ~01:19 UTC (carro 641a81e7…, modo agressivo, plano {proposito:livre, voltas:10, ghost:false, paradas:[],
  tipoPneu:desconhecido}) + 3 SESSOES "ativa" evento_id=null (Stint solto). Ou seja a gravação + o início do Stint
  estavam OK — o defeito era SÓ de experiência: a tela voltava CALADA (onCreated → voltar()), parecia que nada
  acontecia, e o Flávio tocou 3x (3 duplicatas).
- ACHADO secundário: sessoes.carro_id = null (StintRepository.create sempre cria com carroId:nil — pré-existente,
  não é regressão; o envelope leva o carro certo, então o painel casa pelo carro). tipoPneu "desconhecido" = nenhum
  pneu escolhido (esperado).
- CONSERTO: StintSoltoLauncher agora tem @State `iniciado`; onCreated → mostra tela de CONFIRMAÇÃO ("Stint iniciado",
  ícone de traço checkmark.circle SEM emoji, botão "Voltar pra Home" que esvazia a pilha). Reempacotado + reinstalado +
  aberto no iPhone (BUILD SUCCEEDED; App installed; Launched). O fluxo de EVENTO (sheet → captureAtivo) não mudou.
- PENDENTE: (a) Flávio revalidar com a confirmação nova (de preferência propósito=treinar pra ver o painel armar);
  (b) OFERECIDO encerrar os 3 stints "ativa" de teste (espera ok do Flávio — mexe em dado).
