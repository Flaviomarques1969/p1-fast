# TASK_INIT 11/06 (sessão manual de pilotagem): TREINOS DE TÉCNICA COM IA — estudo + proposta

## Pedido: transformar o manual de pilotagem FWD (20 técnicas, PDF de 11/06) em treinos de IA
## dentro do P1 Fast: piloto escolhe a habilidade no Planejamento do Stint → o stint inteiro
## vira treino daquela técnica, trecho a trecho, com apoio visual de "bater o olho" no painel.
## Estudar o P1 Fast antes (pesquisa profunda), debater soluções com ≥4 agentes, escolher a melhor.
## Critério de conclusão: proposta fechada + mockup arrastável aberto no navegador + catálogo
## técnica→treinável hoje/depois (sensores). SEM implementação sem aval; produção intocada.
## Arquivos-base já lidos: CONCEITOS_TRECHO_PRODUTO.md, memórias conceitos-ditado-09/06,
## plano-stint-tela-105-10/06, decisões 10/06 noite, telas-de-ação-mínimas, CLAUDE.md do projeto.
## Plano: (1) pesquisa profunda no código real (6 agentes); (2) debate de solução (4 propositores
## + 3 juízes); (3) síntese da vencedora; (4) mockup arrastável; (5) proposta em linguagem de gestor.
## Riscos: contradizer decisão fechada (mitigado: regras embutidas nos prompts dos agentes);
## propor treino que os sensores de hoje não medem (mitigado: agente de viabilidade + catálogo honesto).
## Status: CONCLUÍDO 11/06 (proposta entregue; implementação aguarda OK do Flávio).
## RESULTADO:
## - Pesquisa: 6 agentes, 130+ fatos com arquivo:linha. Achados-chave: plano do stint
##   (p1fast-plano-stint-v1) gravado e SEM nenhum leitor; evento freada-iniciou com
##   distFromEntradaM medido ao vivo e órfão; coreografia + gatilho metade-da-reta JÁ
##   implementados (coreografia-volta.js); precedente de consumo = p1fast-modo-stint-v1
##   em main-t3000.js:60-70; trecho-advisor órfão compara melhor da sessão (PROIBIDO usar
##   sem trocar a régua); contrato v3 da orientação aceita verbo/destaque/quanto.
## - Debate: 4 propostas (Coreógrafo/Professor/Minimalista/Engenheiro) + 3 juízes
##   (dono/piloto/engenharia). UNÂNIME: "Stint Revestido" (106 × 66 × 66 × 60).
## - Solução: coreografia intocada; treino = leitor do plano + 2 filtros (orientação
##   prioriza foco; mensagens só do grupo do foco) + selo TREINO·<FOCO> na conn-bar +
##   brief obrigatório no Planejamento + motor pedagógico (3-de-4 consistência, guarda
##   do círculo de tração, anti-saturação, consolidação pré-box, currículo entre sessões)
##   + catálogo honesto pleno/proxy/aguarda-sensor (9 plenos + 2 proxy hoje; caps 14/15/
##   18/19/20 registrados como NÃO-treino-de-stint, com fundamento).
## - 2 decisões de negócio em aberto pro Flávio: válvula de erro grave fora do foco
##   (recomendo ligada) e degrau da prescrição ~30%/teto +4 m (recomendo degrau).
##   Verbos novos (vmin/entrada) só com crivo dele item a item.
## - Entregues abertos no Chrome: relatorios/proposta-treinos-ia-2026-06-11.html +
##   _design-reference/mockup-treino-stint-blocos-2026-06-11.html (blocos arrastáveis,
##   4 momentos). Resultado bruto do debate (160 KB): /private/tmp/claude-501/-Users-imac/
##   cba87795-0480-4de2-b6c7-547cf45554f2/tasks/wvfajtewe.output
## - NADA implementado no código do painel; produção intocada.

---

# SESSÃO 8 (11/06 ~2h, "autorizado") — APP PAROU DE GRAVAR VOLTAS PROVISÓRIAS ✅

## StintRepository.swift (app iPhone): finalize NÃO gera mais voltas fake (mock Sprint
## 1A.3 removido); fechamento da sessão e segment_executions preservados (eventos sem
## volta local são ignorados pelo contrato que já existia); incremento de ciclos do pneu
## desligado (ciclo verdadeiro deriva das voltas origem='painel-ao-vivo' na nuvem);
## cabeçalho do arquivo atualizado. Assinatura de finalize intacta (chamadores não mudam).
## BUILD SUCCEEDED + INSTALADO no iPhone 16 Pro Max (devicectl; 1ª tentativa
## IXRemoteErrorDomain 5 — aparelho ocupado; 2ª instalou).
## CONTAGEM REAL 100% DO LADO DO SISTEMA. Falta SÓ ação do Flávio:
## (1) abrir o app e validar; (2) registrar a troca de pneus em Manutenção (dispara a
## vida útil: tempo ligado + voltas reais + km desde a troca).
## PENDÊNCIAS declaradas: segment_executions do detector do iPhone sem persistir até
## vincular com voltas reais da nuvem (cockpit que vale é o do navegador — decisão
## antiga); Pós-Stint mostra 0 voltas locais (reais estão na nuvem) — honesto; tela de
## consulta às voltas reais no app entra na frente da vida útil.

---

# MIGRAÇÃO PRA PRODUÇÃO: acesso + zumbis + 6 arquivos — 11/06 ~1h30 ✅ CONTAGEM REAL LIGADA

## Autorização LITERAL: "MIGRAR PARA PRODUÇÃO: acesso do painel + fechamento dos 5 stints
## zumbis + envio dos 6 arquivos" (após "tudo autorizado." ser barrado pelo guarda
## automático como genérico — corretamente, pelo próprio contrato).
## EXECUTADO NA ORDEM:
## 1. ACESSO (mig 0041 aplicada): painel grava melhores/padrão/voltas reais e LÊ
##    sessões/voltas/pneus/manutenções. Decisão do card = OPÇÃO A (registrada em
##    ~/.claude-decisoes/respostas/p1-fast/ + index.jsonl; respondida via chat).
##    Validado: anon lê 57 sessões/134 voltas/2 pneus/0 manutenções.
## 2. ZUMBIS: 5 stints do Bubi (17-19/05) fechados com data_fim = última atividade.
##    Cópia ANTES: supabase/backup-stints-zumbis-fechados-2026-06-11.json. Pós: 0 abertos.
## 3. ENVIO: deploy p1t4000-a8efau7jy → p1t4000.vercel.app. 49/49 arquivos byte-idênticos
##    (os 6 novos conferidos um a um). ROLLBACK: npx vercel alias set
##    https://p1t4000-nf43ly9k4-flaviomarques-6007s-projects.vercel.app p1t4000.vercel.app
## VALIDAÇÃO FINAL EM PRODUÇÃO: painel boot 0 erros; gravador consulta o banco de verdade
## (sem stint aberto → resposta honesta); tela de stint no ar lendo o banco (manutenções
## vazia de verdade → mensagem honesta). CONTAGEM REAL: ponta a ponta LIGADA — falta só
## o app parar de gravar voltas provisórias (sessão própria, reconstruir app no iPhone).
## Produção alterada COM autorização literal registrada. TASK_DONE: concluída.

---

# SESSÃO 7 (11/06 ~0h-1h, "continue") — FILA DA AUDITORIA EXECUTADA

## Feito (tudo DEV, produção intocada):
## 1. REPESCAGEM de volta: falhou → fica na fila (teto 20) e tenta na próxima chegada;
##    recusa solta o cache da sessão. main-t3000 persistirVoltaReal reescrito.
## 2. DESTRAVAMENTO AUTOMÁTICO pós-teste: 50 amostras reais seguidas (~10 s) religam
##    as gravações sozinhas (flag de replay deixou de ser pegajosa); logs claros
##    ("teste de escritório detectado — gravações pausadas" / "religadas").
## 3. Testes que PRENDEM o gravador: _injetarClienteParaTeste no persister + VP-06
##    (payload completo com origem painel-ao-vivo), VP-07 (recusa→false), VP-08
##    (filtro de recência obrigatório). 8/8.
## 4. Vida útil conta SÓ volta real (origem=painel-ao-vivo) — sem inflar com as
##    provisórias do app; rótulo da tela virou "voltas reais".
## 5. 12 SUÍTES ÓRFÃS: 11 verdes direto + t3000-usb-parser tinha teste DESATUALIZADO
##    (escrevia lambda no offset 60/NB; conserto de 26/05 lê 62/WB — teste alinhado,
##    21/0). TODAS na bateria oficial: 54 suítes, exit 0.
## 6. Fotografia das regras vivas do banco: supabase/POLICIES-VIVAS-2026-06-11.md
##    (54 políticas + 3 tabelas sem trava — o drift fora dos arquivos está documentado).
## 7. Boot final: painel + tela de stint, 1920×1280, ZERO erros.
## FICA NA FILA (declarado): teste da ponta main→setReferencia (mexer no main agora,
## pré-envio, é risco desnecessário); índice único (sessão, número) nas voltas —
## entra na próxima proposta de banco; leitor km amarrado ao traçado da sessão
## quando houver 2º autódromo.
## DEPENDEM DO FLÁVIO: card de acesso (respondido? dizer "fiz"); limpeza dos 5 stints
## zumbis de maio (mexe em dados — pede aval); próximo envio pro ar (6 arquivos:
## voltas-persister novo + main-t3000 + live-data-bridge + delta-calculator +
## configuracao-stint.js/.html) — pede frase de migração.

---

# AUDITORIA DO DIA (pedido "audite" + "gere em html") — 2026-06-10 noite/11-06

## Workflow com 5 auditores adversariais; 3 completaram (produção/código/testes), 2 caíram
## no LIMITE DE USO da conta (banco/registros — essencial coberto pelos vizinhos, declarado).
## Resultado: 29 confirmações com prova · 11 furos · relatório HTML aberto pro Flávio:
## relatorios/auditoria-dia-2026-06-10.html
## FURO Nº1 (MEU ERRO, corrigido antes do Flávio responder o card): "9 tabelas sem RLS" era
## medição pelos ARQUIVOS; o banco vivo (pg_class/pg_policy) tem 3 sem RLS (envelopes,
## pontos_troca_aprendidos, qualidade_troca_marcha), gear_signatures NEM EXISTE, dyno/gear_ratios
## têm policies VIVAS fora do repo (drift não documentado), t4000_live_* têm anon_all DE PROPÓSITO.
## Card 20260610-191605 REESCRITO com o estado real. LIÇÃO: estado de segurança se mede no
## banco vivo, nunca nos arquivos.
## CONSERTOS APLICADOS NA HORA (8): card; origem='painel-ao-vivo' no insert da volta real
## (entrava como 'app'!); filtro de recência 12h na busca de sessão (5 sessões zumbis de maio
## abertas no banco — limpeza pede aval do Flávio); cache de sessão revalida a cada 2 min e
## solta na recusa; log do descarte por sanidade; suítes alertas+padrão NA bateria (42 agora,
## verde); _persistStats usa a fábrica (mata teste tautológico VP-05); emojis removidos do
## main-t3000 (botão mensagens ON/OFF).
## NA FILA (do relatório): fila de repescagem da volta que falhou; teste do caminho de sucesso
## do gravador (dublê de banco); teste da ponta main→setReferencia; ~12 suítes antigas fora da
## bateria; filtrar vida útil por origem + km amarrado ao traçado da sessão; documentar policies
## vivas fora do repo; destravamento automático da flag de replay.
## PRÓXIMO ENVIO PRO AR (pede MIGRAR do Flávio): exatamente 5 arquivos de web/cockpit —
## voltas-persister.js (novo) + main-t3000.js + live-data-bridge.js + delta-calculator.js +
## configuracao-stint.js. SEM o card respondido, contagem real continua cega (leitura travada).
## RISCO ABERTO: painel NO AR ainda mente "passagem salva" até esse envio.

---

# MIGRAÇÃO PRA PRODUÇÃO: contagem real (banco) — 2026-06-10 ~20h30

## Autorização LITERAL: "MIGRAR PARA PRODUÇÃO: contagem real — aplica a estrutura no banco de uma vez"
## Aplicada migração 0040_contagem_real.sql via supabase db query --linked (p1-fast):
##   track_layouts.comprimento_m (Brasília 0dc85cfb = 5476) · voltas.origem (default app)
##   · pneus.instalado_em · manutencoes.pneu_id/peca_id. TUDO ADITIVO; rollback no arquivo.
## VALIDADO por leitura: comprimento_m=5476 no traçado canônico; colunas novas respondem.
## A permissão de escrita/leitura do painel NÃO entrou (aguarda card, como combinado).
## DESCOBERTA na validação: a trava também BLOQUEIA A LEITURA de sessoes/voltas/pneus/
## manutencoes pro painel — sem o card, o painel não enxerga o stint aberto nem conta
## vida útil. PROPOSTA-escrita-painel-anon.sql ganhou ADENDO (leitura) e o card foi
## atualizado (opção A agora descreve o alcance completo). Mensagem da vida útil na tela
## corrigida pra não afirmar "sem troca" quando pode ser acesso bloqueado.
## NOTA menor: existiam 2 layouts "Principal" de Brasília. LIMPO em 10/06 ~20h45 com
## autorização do Flávio ("pode limpar o traçado duplicado"): a85c1234 (semente de 26/05,
## 12 trechos antigos) removido APÓS checagem autenticada de dependências (zero em
## segment_executions/melhores/retas/marcos) e backup completo em
## supabase/backup-layout-duplicado-removido-2026-06-10.json (layout + 12 trechos, 8 KB).
## Pós-remoção validado: só o canônico 0dc85cfb no banco, com 8 trechos + 4 marcos +
## 56 melhores passagens intactos e comprimento 5476. (Pegadinha evitada: sonda anônima
## acusava "4 referências" numa tabela que nem existe — eram as 4 chaves da mensagem de
## erro; a checagem que vale foi a autenticada.)
## TASK_DONE migração: concluída. Produção alterada COM autorização literal registrada.

---

# TASK_INIT (2026-06-10 ~20h, sessão 6) — VOLTAS REAIS + KM + VIDA ÚTIL POR PEÇA (autorizado)

## Pedido: Flávio confirmou "eu já te disse que quero" — construir a contagem real:
## voltas de verdade persistidas (hoje o app grava provisórias), quilômetros (não existe)
## e vínculo troca→peça. DECISÕES DELE 10/06 noite (memória feedback-p1fast-decisoes):
## NUNCA trava de velocidade no box; proteção de teste de escritório = detalhe interno.
## Plano: (1) estrutura aditiva PROPOSTA (comprimento do traçado no banco p/ km = voltas ×
## comprimento; data de instalação por pneu/peça); (2) painel grava volta REAL na sessão
## aberta ao cruzar a chegada (log honesto se o banco recusar — depende do card de acesso);
## (3) leitor de vida útil passa a contar voltas reais + km; (4) app parar de gravar
## voltas provisórias = sessão própria (precisa reconstruir e instalar no iPhone).
## GATE: o card aberto (20260610-191605-banco-escrita-painel) decide COMO o painel ganha
## permissão de gravar — a construção fica pronta esperando a escolha.
## Ambiente: DESENVOLVIMENTO (estrutura no banco só via MIGRAR autorizado).
## Status: CONSTRUÍDO (aguardando card + MIGRAR pra ligar)
##
## TASK_DONE (sessão 6):
## - CONSTRUÍDO: web/cockpit/voltas-persister.js (novo — acha sessão aberta do carro,
##   grava volta real, nunca inventa, devolve a verdade); main-t3000 grava a volta na
##   chegada (replay de escritório NUNCA grava; logs honestos: gravou / sem stint aberto /
##   banco recusou); configuracao-stint mostra km = voltas × comprimento quando a coluna
##   existir (tolerante até lá); supabase/PROPOSTA-voltas-reais-km-pecas.sql (ADITIVA:
##   comprimento_m=5476 no traçado, voltas.origem, pneus.instalado_em, vínculo
##   manutencoes→pneu/peça, policy de voltas condicionada ao card).
## - Testes: voltas-persister 5/5 (na bateria oficial) · bateria completa exit 0 ·
##   boot do painel limpo com guarda provada ao vivo (sem stint aberto → não grava).
## - PARA LIGAR: (1) resposta do card de acesso; (2) "MIGRAR PARA PRODUÇÃO: contagem
##   real" aplica a estrutura + policies; (3) sessão própria: app parar de gravar voltas
##   provisórias (StintRepository.finalize — reconstruir app e instalar no iPhone).
## - Produção INTOCADA.

---

# TASK_INIT (2026-06-10 ~19h30, sessão 5) — "siga": pendências objetivas pós-migração

## Pedido: fechar o que não depende de decisão do Flávio:
## (1) savePadrao nunca grava (atualizado_em parado em 30/05) — investigar causa SEM
##     escrever no banco produtivo (sonda com chave estrangeira falsa: revela trava de
##     acesso × erro de estrutura sem persistir nada);
## (2) schema-parity 5 vermelhos — gabarito espera 30 tabelas, banco tem 32 legítimas
##     (padroes_telemetria_por_volta + melhores_passagens_trecho, de maio) + manutencoes
##     espelhada (0039) — atualizar gabarito do teste;
## (3) live-data-bridge 21/5 — teste defasado do refactor alertasCriticos, atualizar;
## (4) risco (d) auditoria 17h: marca OURO não acompanha promoção de referência local
##     na sessão (setReferencia só no boot); (5) risco (e): delta-calculator não barra
##     NaN de velocidade ausente.
## Ambiente: DESENVOLVIMENTO. Produção protegida: sim. Autorização: não necessária
## (se a causa do savePadrao for trava de acesso no banco de produção → PROPOR, não mexer).
## Plano (≤5): sonda savePadrao → gabarito schema-parity → teste bridge → riscos (d)(e)
## com smokes → relatório com lista de decisões pendentes do Flávio.
## Status: CONCLUÍDO
##
## TASK_DONE (sessão 5):
## 1. savePadrao: causa PROVADA por sonda segura (FK falsa, nada gravado) — RLS recusa
##    anon em padroes_telemetria_por_volta E melhores_passagens_trecho (políticas
##    só-time das migs 0025/0026). "passagem salva" do painel ERA MENTIRA (gravarPassagem
##    devolve false e main não conferia) → log honesto em main-t3000. As 56 do banco são
##    sementes de script. PROPOSTA pronta (não aplicada): supabase/PROPOSTA-escrita-painel-anon.sql
##    — decisão de segurança do Flávio (card aberto).
## 2. ACHADO DE SEGURANÇA: 9 tabelas de maio SEM RLS nenhuma (dyno_curve, gear_ratios,
##    gear_signatures, pontos_troca_aprendidos, perfis_reacao_piloto, envelopes_seguranca_stint,
##    qualidade_troca_marcha, t4000_live_commands, t4000_live_events) — escrita aberta com a
##    chave pública. Inconsistente com as 2 sobre-travadas. No card também.
## 3. schema-parity REESCRITO com leitor corrigido (if not exists + dígitos — contava 32
##    de 45 e cortava t4000_* em "t"): 45 tabelas, 13 só-nuvem documentadas, espelho 32+2,
##    exceção RLS_ABERTAS_CONHECIDAS (tabela NOVA sem RLS segue reprovando). 15/15.
## 4. live-data-bridge: 5 testes da era ecuErrorBits (spec anterior a 25/05) reescritos
##    pro contrato real (sample.alarmes bitfield). 26/26.
## 5. Risco (e): delta-calculator barra NaN de kmh ausente (1 ponto sem velocidade
##    envenenava o trecho) + DC-11. Risco (d): evento passagem-salva leva ref junto e
##    main chama oportunidade.setReferencia — marca OURO acompanha a promoção na sessão
##    + DELTA-REF-06. BATERIA OFICIAL COMPLETA: 39 suítes verdes, exit 0 (1ª vez).
## 6. Produção INTOCADA (consertos d/e + log honesto são DEV, vão no próximo MIGRAR).
## DECISÕES DO FLÁVIO (card 1 aberto; demais aguardam): (a) postura de escrita do banco
## (A anon nas 2 / B login no painel / C A+fechar as 9 depois); (b) trava de velocidade
## na entrada do box; (c) destravamento da flag de simulador; (d) estrutura voltas
## reais/km/vínculo peça física.

---

# MIGRAÇÃO PRA PRODUÇÃO: painel p1t4000 — 2ª do dia (2026-06-10 ~19h)

## Autorização LITERAL do Flávio: "MIGRAR PARA PRODUÇÃO: painel p1t4000" (10/06, após
## validar orientação acesa + tela de stint reformada nas janelas 1920×1280).
## PROD_RELEASE_PLAN apresentado antes de executar (sem risco destrutivo; sem migration).
## Pacote: web/cockpit completo — vigia de curvas (15h) + delta×referência (17h) +
## box-detector (interseção + folga 5 m) + cadeia de alertas preditivos (sessão 3) +
## par verbo+número junto (v4) + escala tela 10,5 (MS-13.1) + Planejamento do Stint.
## Pré-voo: 39 js sintaxe OK · grafo 28 alvos fechado · zero conflito · 21 suítes verdes
## (5 vermelhos = schema-parity pré-existente, fora do pacote).
## Publicado: https://p1t4000-nf43ly9k4-flaviomarques-6007s-projects.vercel.app → p1t4000.vercel.app
## (deploy via npx vercel deploy --prod --yes em web/cockpit, projeto linkado --project p1t4000)
## ROLLBACK (1 comando): npx vercel alias set https://p1t4000-9mto8lxqj-flaviomarques-6007s-projects.vercel.app p1t4000.vercel.app
## Validação pós-deploy APROVADA NAS 3 FRENTES:
## (1) conteúdo: 48 arquivos servidos byte-idênticos ao local (tela-orientacao com par
##     centrado, configuracao-stint reformada, index com escala — confirmados no ar);
## (2) estrutura: 39 módulos no ar, todos 200 + sintaxe válida;
## (3) boot real em produção: canal online, 8/8 trechos armados, coreografia ativa,
##     escala aplicada, ZERO erros de página (captura /tmp/p1-prod-boot-1920.png).
## Nota não-bloqueante: no momento da checagem o simulador da Central não estava
## transmitindo amostras de motor (janela do Flávio pode ter parado o ciclo) — o canal
## em si estava online e os 8/8 trechos armados; nada do painel depende disso pra boot.
## TASK_DONE migração: concluída. Produção alterada COM autorização literal registrada.

---

# TASK_INIT (2026-06-10 ~18h, sessão 4) — RODADA DE CONSIDERAÇÕES DO FLÁVIO (3 itens)

## Pedido original (ditado em partes, comando final "siga"):
## (1) ESPAÇAMENTO: verbo (alto-direita) e número (baixo-direita) ficaram nos EXTREMOS
##     com buracão no meio — aproximar, distância equilibrada com a curva da esquerda.
##     Vale pra TODAS as telas com esse par (orientação e as padrão).
## (2) PLANEJAMENTO DO STINT perdeu especificações já ditadas: padrões naturais
##     (1 carro/1 piloto/1 autódromo pré-preenchidos); tipo de pneu/roda (teremos
##     mais de um); VIDA ÚTIL por item instalado (da data de troca/instalação,
##     derivar da telemetria: tempo ligado + voltas + km — os 3 pra toda peça);
##     PROPÓSITO do stint: livre × testar parte do carro (painel foca nela) ×
##     treinar habilidade (trail braking OU um dos 6 pontos do trecho — ápice,
##     frenagem, Vmin...); ligar/desligar GHOST; nº de voltas; nº de paradas e em
##     quais voltas. Abordagem gráfica bacana pra escolher.
## (3) TELA ALVO: validar/mostrar na proporção da tela 10,5/10,7" ligada como
##     monitor do notebook (NÃO iPhone). iPhone só p/ envio de dados (decisão
##     Starlink × iPhone × modem 5G fica aberta, só registrada).
## Objetivo (1 frase): aplicar as 3 considerações em DEV e reabrir pro Flávio na proporção certa.
## Critérios: (a) par verbo+número aproximado em todas as telas com o par; (b) tela de
## Planejamento do Stint com TODAS as especificações resgatadas dos docs (mockup/tela
## aberta pro Flávio validar); (c) janelas de validação na resolução da tela 10,5".
## Leitura: protocolo+padrões+4 FLAVIO_*.md SIM (sessão); docs a resgatar: CONCEITOS_TRECHO_PRODUTO,
## PLANO_FASE_1 (stint/paradas), ADR-023 (tela 10,5), decision-logs, manutenção/consumíveis.
## Plano (≤5): 1) explorar em paralelo (telas com o par; tela atual do stint; specs nos docs;
## vida útil/manutenção existente; resolução 10,5); 2) consolidar o que a tela perdeu;
## 3) aplicar espaçamento; 4) reformar Planejamento do Stint; 5) abrir pro Flávio na proporção certa.
## Ambiente: DESENVOLVIMENTO. Produção protegida: sim. Autorização: não recebida.
## Riscos: tela do stint pode morar no app iOS (reinstalação) ou no painel web; vida útil
## pode exigir estrutura nova no banco (aí: propor, não executar sem combinar).
## Status: CONCLUÍDO (aguardando validação do Flávio nas janelas)
##
## TASK_DONE (sessão 4):
## - Mapeamento: workflow 4 exploradores (telas com o par; stint atual; specs nos docs;
##   vida útil/manutenção; resolução 10,5"). Descobertas-chave: o par nos extremos veio
##   do desenho APROVADO 09/06 (a consideração de hoje vira v4); existem DOIS planejamentos
##   de stint (web=modo+envelope; iOS=objetivo/voltas/paradas/lição); specs ditadas 11/05
##   (37 respostas) e 09/06 localizadas; vida útil: manutencoes tem data de troca, sessões
##   dão tempo; voltas reais NÃO são gravadas (mock) e km não existe; tela = PDM-10.5T
##   1920×1280, escala 2× + faixas ~200px (MS-13.1 fechado, mas NÃO implementado no painel).
## - Alterações: tela-orientacao.js (.acao par centrado, gap 5vh — antes space-between +
##   margin-top:auto); _design-reference/mockup-oportunidade-trecho-ultra-v4.html (NOVO,
##   v3 aprovado preservado); index-t3000.html (escala uniforme do .stage p/ 1920×1280 —
##   implementa MS-13.1); configuracao-stint.html+js REFORMADOS → "Planejamento do Stint":
##   padrões naturais (carro/piloto/autódromo), pneu/roda, VIDA ÚTIL do item (3 contadores
##   derivados da nuvem desde a troca; km honesto "—"), PROPÓSITO (livre × testar parte do
##   carro × treinar habilidade: trail braking + 6 pontos), GHOST liga/desliga, voltas,
##   paradas (volta+motivo); plano completo gravado em localStorage p1fast-plano-stint-v1
##   no aprovar (envelope continua igual). docs/CONCEITOS_TRECHO_PRODUTO.md: ditado de
##   10/06 registrado (5 itens).
## - Validação: sintaxe OK; screenshots 1920×1280 (par centrado: gap 64px, centro Y=640;
##   stint completo; painel escalado com faixas); prova funcional 9/9 interações
##   (chips, clamps, paradas, ghost teclado); vida útil responde honesto (sem troca
##   registrada → orienta registrar no app). NADA gravado no banco (aprovar não clicado).
## - Aberto pro Flávio: navegador visível 1920×1280, 3 abas (Central+sim, painel, stint).
## - Produção: INTOCADA.
## - Pendências novas (propostas, dependem de decisão/estrutura): voltas REAIS persistidas
##   (substituir mock do app); km (comprimento do layout × voltas OU velocidade integrada);
##   vínculo troca→peça física (manutencoes sem FK pra pneus/pecas); tempo motor-ligado
##   real (hoje proxy = duração da sessão); comportamento do painel por propósito/foco
##   (treino focado, painel focado em parte do carro, ghost ao vivo) — consomem o plano
##   gravado; unificação web×app do planejamento.

---

# ✅ ORIENTAÇÃO ACESA — checkpoint 2026-06-10 noite (sessão 3)  ← LER PRIMEIRO

## ONDE ESTÁ (1 frase)
TELA DE ORIENTAÇÃO ACENDEU NO REPLAY (prova: RESULTADO TELA ACENDEU, 16 trechos/2 voltas,
mostrar=6, zero bloqueio indevido, captura /tmp/p1-orientacao-acesa.png "FREIA DEPOIS") e
foi ABERTA PRO FLÁVIO em navegador visível (Central p1tv + painel ?semfio) — aguardando
aprovação dele pra propor MIGRAR PARA PRODUÇÃO: painel p1t4000.

## O QUE FOI CONSERTADO NA SESSÃO 3 (tudo DEV, ver TASK_INIT sessão 3 abaixo p/ detalhe)
1. box-detector: interseção real + folga ABSOLUTA 5 m (fiscais derrubaram a folga de 50%
   com voltas reais; 9/9 + zero falso nas sessões reais 23-24/05).
2. Cadeia de alertas preditivos (causa da tela apagada): aplicarPreditivos sobe-E-limpa
   (raiseManual travava MOTOR_AQUECENDO eterno); regra n>=3 POR MÉTRICA (voltas do banco
   sem temperatura furavam o mínimo); persister recalcula padrão das voltas guardadas
   (não forja mais n=total — 2ª rodada de fiscais); blindagem: sim não alimenta padrão
   (semfio E cabo via gps.sim); pedagógica não escreve por cima de alerta super/crítico;
   desempate QUENTE>AQUECENDO no mostrador.
3. npm run smoke: box/chegada/delta/bridge-delta no INÍCIO da corrente (parava num
   vermelho pré-existente antes deles). Backup package.json: /tmp/package-json-backup-20260610.json.
## Testes: box 9/9 · alertas 25/25 · padrão 14/14 · bateria oficial sem vermelho NOVO
## (só os 5 pré-existentes do gabarito de tabelas, schema-parity).

## PRÓXIMO PASSO
Flávio valida nas janelas abertas (orientação acende na 2ª volta do replay, ~10 min).
Aprovou → propor "MIGRAR PARA PRODUÇÃO: painel p1t4000" (pacote leva consertos do vigia
de 15h + delta×referência de 17h + box + cadeia de alertas desta sessão).

## PENDÊNCIAS REAIS (pré-existentes / decisões de produto)
- schema-parity 5 falhas (gabarito espera 30 tabelas, banco tem 32 — drift de maio).
- live-data-bridge 21/5 (teste defasado, área alerta ECU).
- savePadrao aparentemente nunca grava (atualizado_em parado em 30/05) — investigar.
- __P1_ORIGEM_SIM__ pegajoso: 1 replay na sessão → dados reais param de aprender até
  recarregar a página (anotado pelos fiscais; decidir mecanismo de destravamento).
- Decisão de produto p/ Flávio: trava de velocidade na entrada do box (fiscais sugeriram).
- Debounce único pit-in/pit-out <5s (pit de Brasília leva >5s — só anotado).

## ─── HISTÓRICO: checkpoint das ~17h (SUPERADO pelo bloco acima) ───

## ONDE PAROU (1 frase)
DELTA×REFERÊNCIA CONSERTADO E PROVADO (deltas positivos, 7/8 curvas com orientação PRONTA
no motor: "FREIA DEPOIS", "FECHA A CURVA 1,9m"...), mas a TELA segue apagada por DOIS
bloqueadores novos, ambos identificados com evidência na sonda v2.

## O QUE FOI FEITO NESTA SESSÃO (não refazer)
1. CAUSA DO getOrientacao null ACHADA E CONSERTADA: live-data-bridge.js substituía a
   referência local pela passagem "nova melhor" ANTES de calcular o delta → passagem
   comparada com ELA MESMA → delta 0 em tudo (as 8 refs do banco são sintéticas/lentas —
   tempo 18s p/ trecho de 7,8s — então TODA passagem virava "nova melhor").
   Conserto: refAnterior capturada no início do saida-cruzou; delta vs refAnterior;
   + origemSimulador() (passagem de sim NUNCA vira referência local nem salva);
   + evento novo 'passagem-fechada' (TODA passagem alimenta marcas VOCÊ, não só novas-melhores).
   main-t3000.js: passa origemSimulador, trata passagem-fechada → oportunidade.registrarPassagem.
2. PROVA: tests/node-smoke-bridge-delta-referencia.mjs — 0/5 ANTES → 5/5 DEPOIS do conserto.
   Bateria vizinha verde (delta 10/0, oportunidade 13/0, detector 12/0, resync 6/0,
   coreografia 10/0, chegada 5/0). live-data-bridge antigo: 5 falhas ECU PRÉ-EXISTENTES
   (provado por fiscal em ambiente isolado com a versão pré-conserto — mesmas 5).
3. REPLAY (sonda v1): 24 fechamentos/3 voltas (8,0/volta), 1º delta inteiro capturado:
   c175d6f2 total +2,83s {entrada +1,83 (26 am.), apice +1,00 (20 am.)}, pior=entrada.
   7/8 orientações prontas no motor. Bank da nuvem intacto (56 linhas).
4. AUDITORIA (workflow 4 fiscais adversariais): NENHUM refutou o conserto. Riscos anotados:
   (a) flag __P1_ORIGEM_SIM__ só liga no modo ?semfio (modo cabo: gps sim:true entra sem
   filtro — furo herdado, main-t3000.js:230-242 + :756-760); (b) flag é pegajosa (1 amostra
   sim → bloqueia referência/persistência de dado REAL até recarregar — sessão mista sim→real);
   (c) teste novo NÃO está no npm run smoke (e a suíte para no 1º vermelho por &&);
   (d) marca OURO defasada na sessão (oportunidade.setReferencia só no boot, não acompanha
   promoção de referência local); (e) delta-calculator não barra NaN de kmh ausente (robustez).

## OS 2 BLOQUEADORES DA TELA (evidência da sonda v2 — próxima ação EXATA)
A coreografia ENTRA na fase orientacao, mas onOrientacao esconde a tela:
B1. mensagemGraveAtiva() true quase o tempo todo NO REPLAY DE PROVA: alertasCriticos com
    SEM_DADOS ('critico') — a aba da Central (publicadora) fica em 2º plano no navegador
    automatizado e o relógio dela é DESACELERADO → buracos >2s nas amostras do motor.
    ARTEFATO DE PROVA, não do produto. Mitigar na sonda: chromium.launch com args
    ['--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows'] (ou 2 janelas visíveis/headed).
B2. "NO BOX" PRESO (defeito REAL): box-detector acha que entrou no box e nunca sai — msg
    grave 'NO BOX' + setSilencioso(true) enquanto o carro fecha trechos na pista
    (t=164-182s: trechos 2→3 com NO BOX ativo). CAUSA PROVÁVEL (mesma família dos defeitos
    da madrugada): box-detector.js:55-64 usa lado-da-linha SEM limite do segmento (reta
    INFINITA da pit-in corta a pista) — chegada-detector e trecho-detector JÁ ganharam o
    conserto "interseção caminho×segmento com folga 50%"; box-detector NÃO.
    → CONSERTAR box-detector igual + smoke; conferir tb. se 'NO BOX' deve mesmo ser msg
    grave que atropela orientação (decisão de produto: no box não há orientação mesmo, ok,
    mas só quando o box é VERDADE).

## SEQUÊNCIA DA PRÓXIMA SESSÃO
1. Consertar box-detector (cruzamento limitado ao segmento, como trecho-detector) + smoke.
2. Relançar prova: servidor `cd "/Users/imac/Projetos/P1 Fast" && python3 -m http.server 8767`
   (pode já estar no ar) + `node /tmp/p1-replay-proof2.mjs` (sonda v2 PRONTA em /tmp; só
   adicionar os args anti-desaceleração no chromium.launch; critério tela acesa = dataset
   on='1' + modo='curva'; captura → /tmp/p1-orientacao-acesa.png).
3. Tela acesa → ABRIR PRO FLÁVIO (Central p1tv + painel ?semfio no navegador dele, headed).
4. Com aprovação dele, propor: MIGRAR PARA PRODUÇÃO (painel p1t4000 com vigia + delta).
5. Pendências menores: teste novo no npm run smoke; riscos (a)(b)(d)(e) da auditoria.

## DETALHES TÉCNICOS DA PROVA
- Sonda v2: /tmp/p1-replay-proof2.mjs (playwright via createRequire de
  /Users/imac/Documents/Sistemas/cdai/frontend; Central https://p1tv.vercel.app click #btnSim;
  painel http://localhost:8767/web/cockpit/index-t3000.html?semfio; window.__t3 exposto
  em main-t3000.js:801; tela = document.querySelector('.p1-orient').dataset).
- Banco de referências (leitura): melhores_passagens_trecho — 56 linhas, carro 641a81e7,
  pneu radial-185-14, pontos com kmh/fracao OK e sub:null em TODOS (gravadas 24/05 20:00,
  tempos redondos = sintéticas). Inspetor: /tmp/p1-inspeciona-banco.py.

## ─── HISTÓRICO do checkpoint das 15h (SUPERADO pelo bloco acima — a "PRÓXIMA AÇÃO
## EXATA" dali JÁ FOI EXECUTADA; ler só como contexto) ───

## O QUE FOI PROVADO NA SESSÃO DAS 15h (não refazer)
1. trecho-detector.js consertado: RESSINCRONIZAÇÃO (vigia paralelo de entradas — perdeu curva,
   engata na próxima), SAÍDA DE EMERGÊNCIA (fecha sem ápice, sem inventar), memória contínua
   de entrada (sem tick cego pós-avanço), sanidade do ápice (>60 m não vale).
   Smokes: resync 6/0 + trecho 12/0 + detector 3/0. REPLAY: 24 fechamentos em 3 voltas =
   8,0/volta, 8/8 curvas distintas, 0 emergências, 9 resyncs.
2. Atropelo calibrado em main-t3000 (mensagemGraveAtiva): só gravidade super/crítico esconde a
   orientação (MOTOR_AQUECENDO/super da gravação escondia tudo 2x/s — gravação é motor esquentando).
3. Sim ajustado pra demo: sim-amostras.json água≤60°C sem alarmes; sim-gps.json (?v=5520b)
   posição E velocidade 10% mais lentas (antes só posição → deltas zero "honestos").
4. Coreografia comprovada por sonda: fases painel→trecho→reta/orientacao (100 ticks) + resumo.
   RESUMO DA VOLTA apareceu (captura: /tmp/p1-resumo-volta.png).

## A PRÓXIMA AÇÃO EXATA (começar por aqui)
Sonda: getOrientacao devolveu null 200/200 com bridge._stats.deltaCalculados=13. Capturar UM
evento delta-calculado INTEIRO (ev.porSubTrecho: chaves e SINAIS dos deltaS) monkey-patchando
oportunidade.registrarDelta via window.__t3, e LER delta-calculator.js (~linhas 95-165) pra
confirmar: (a) convenção de sinal (positivo = mais lento?); (b) nomes das sub-chaves
(entrada/freio/apice/saida?); (c) se porSubTrecho chega vazio (buffer de pontos por sub).
Suspeitas ordenadas: sinal invertido OU sub-chaves com nomes diferentes do que o motor
oportunidade-trecho.js espera OU deltas diluídos pela janela de 2.
Depois do conserto: replay final → telas de orientação aparecem → ABRIR pro Flávio ver ao
vivo (Central p1tv + painel ?semfio no Chrome dele) → propor novo MIGRAR (o vigia consertado
PRECISA ir pro ar — o do ar atual tem o defeito sequencial).

## COMO RODAR A PROVA (receita exata)
1. cd "/Users/imac/Projetos/P1 Fast" && python3 -m http.server 8767 &
2. Navegador automatizado: scripts node em /Users/imac/Documents/Sistemas/cdai/frontend
   (playwright instalado lá; import { chromium } from 'playwright').
3. Central: https://p1tv.vercel.app → click #btnSim (simulador: motor saudável + GPS volta real
   10% mais lenta, ~276 s/volta, 4 voltas por ciclo).
4. Painel DEV: http://localhost:8767/web/cockpit/index-t3000.html?semfio
   (modo sem fio: amostras vêm do canal cockpit-bubi-live).
5. Sonda: window.__t3 = { t3, cockpitState, bridge, oportunidade, getCoreografia(), telaOrientacao }.
   Tela: document.querySelector('.p1-orient').dataset.on/modo.

## AMBIENTE / PRODUÇÃO
- Tudo desta sessão em DEV (auto-save commita sozinho na linha wip/20260608-143705).
- PRODUÇÃO p1t4000.vercel.app = deploy 9mto8lxqj de hoje cedo (ANTERIOR ao conserto do vigia —
  ainda tem o defeito sequencial 2-3/8). Novo MIGRAR depois da orientação fechada.
- Rollback prod (se precisar): npx vercel alias set https://p1t4000-fitlngal6-flaviomarques-6007s-projects.vercel.app p1t4000.vercel.app
- iPhone: app com amarração v3 instalado. Memórias da sessão: p1-fast-central-pista-2026-06-09
  + p1-fast-conceitos-trecho-ditado-2026-06-09 + feedback_telas_de_acao_minimas (ler os 3).

---

# TASK_INIT (2026-06-10 ~noite, sessão 3) — "continua a orientação" (pós-/clear)

## Pedido original: "continua a orientação" — executar a SEQUÊNCIA DA PRÓXIMA SESSÃO do
## checkpoint das ~17h (bloco RETOMADA no topo deste arquivo).
## Objetivo (1 frase): derrubar os 2 bloqueadores da tela (NO BOX preso + SEM_DADOS artefato
## de prova) e fazer a tela de orientação acender no replay, aí abrir pro Flávio.
## Critérios de conclusão: (a) box-detector consertado (interseção caminho×segmento, como
## chegada/trecho) com smoke verde; (b) sonda v2 com args anti-desaceleração; (c) replay com
## tela acesa (dataset on='1' modo='curva') + captura; (d) abrir pro Flávio ver ao vivo
## (Central p1tv + painel ?semfio, navegador headed).
## Leitura confirmada: ~/.claude/CLAUDE.md SIM · ~/.claude-decisoes/padroes.md SIM ·
## FLAVIO_EXECUTION_PROTOCOL.md SIM · FLAVIO_DONE_CHECKLIST.md SIM ·
## FLAVIO_ENVIRONMENT_RULES.md SIM · FLAVIO_COMMUNICATION_RULES.md SIM ·
## + memórias p1-fast-central-pista + conceitos-trecho-ditado + telas_de_acao_minimas + CLAUDE.md do projeto.
## Plano (≤5): 1) consertar box-detector.js (caminhoCruzaLinha igual chegada-detector) +
## smoke novo BX-05 (reta infinita NÃO dispara); 2) bateria de smokes vizinha; 3) sonda v2
## com flags anti-throttling + replay; 4) fiscais adversariais no conserto (workflow);
## 5) tela acesa → abrir pro Flávio headed.
## Arquivos/áreas: web/cockpit/box-detector.js, tests/node-smoke-box-detector.mjs,
## /tmp/p1-replay-proof2.mjs (sonda, fora do repo). Banco: só leitura.
## Ambiente alvo: DESENVOLVIMENTO (linha local, auto-save). Produção protegida: sim.
## Autorização para produção: não (não recebida — novo MIGRAR só depois da aprovação do Flávio).
## Riscos: mexer no box-detector afeta msg grave NO BOX (validar que box REAL ainda detecta);
## replay longo (~10-25 min); nuvem não pode ser poluída (blindagem sim já existe).
## Status: EM ANDAMENTO (progresso abaixo)
##
## PROGRESSO sessão 3 (registrado antes do replay final):
## 1. box-detector.js consertado em 2 RODADAS:
##    R1: caminhoCruzaLinha (igual chegada-detector, folga 50%) — 7/7 no smoke, e a versão
##        pré-conserto (git cd3af53b) falha exatamente nos 3 testes novos BX-05/06/07.
##    R2 (fiscais adversariais derrubaram a R1 com dados reais): folga de 50% nas pontas é
##        segura na chegada/trecho (linha atravessa a pista) mas LARGA DEMAIS no pit
##        (pit-in 25,9 m → 13 m de folga; o traçado real passa a 10-14 m das pontas,
##        u=1,45-1,60 a 100-153 km/h → NO BOX falso seguia, só intermitente).
##        Calibração: FOLGA_PONTA_M = 5 m ABSOLUTA (entradas reais medem u≈0,5).
## 2. PROVA com dados reais: 9/9 no smoke (BX-08 trajeto canônico 920 pts: só a entrada
##    VERDADEIRA do fim dispara, idx 726, v cai 79→20 km/h, para a 8 m do box;
##    BX-09 meio da pit-in real dispara) + sessões reais gps-23/24-05.tsv: 1 único evento
##    cada (ENTRA t=897s/t=745s, fim das gravações, últimos pontos a 10 m/8 m do box),
##    ZERO falsos (antes: NO BOX falso por 496 s e 181 s).
## 3. npm run smoke: 4 testes novos inseridos NO INÍCIO da corrente (box, chegada,
##    delta-calculator, bridge-delta-referencia) — a corrente parava no schema-parity
##    (5 falhas PRÉ-EXISTENTES: gabarito espera 30 tabelas, banco tem 32 — drift de maio)
##    e os testes do fim nunca rodavam. Backup: /tmp/package-json-backup-20260610.json.
## 4. Sonda v2 com flags anti-desaceleração (B1 do checkpoint) — 1ª rodada do replay provou:
##    sem SEM_DADOS, sem NO BOX, coreografia entra na fase orientacao; na volta 1 a tela
##    não acende porque o trecho à frente ainda não tem medição (desenho do produto).
## 5. REPLAY 2 revelou 3º bloqueador (sondas v3/v4 com pilha de chamada): a tela seguia
##    apagada nas voltas 2-3 mesmo com 7/8 orientações prontas e SEM grave NA TELA —
##    MOTOR_AQUECENDO/super ATIVO POR BAIXO (pedagógica escrevia por cima no mostrador).
##    CADEIA DA CAUSA (provada): (a) voltas antigas do banco SEM temperatura contavam
##    pro mínimo de 3 → média armava com 1 volta fria (47°C) → voltas a 60°C = +20% falso;
##    (b) alerta subia via raiseManual e NUNCA limpava (manual sem clearManual);
##    (c) simulador alimentava o padrão do carro real (blindagem não cobria);
##    (d) pedagógica sobrescrevia alerta super no mostrador (piloto não via).
## 6. 4 CONSERTOS (DEV): alertas-criticos.js (aplicarPreditivos sobe-e-limpa + conjunto
##    _preditivos protegido + n>=3 por métrica em avaliarPreditivoPorPadrao);
##    padrao-acumulador.js (fecharVolta SEMPRE emite, [] limpa); main-t3000.js
##    (aplicarPreditivos na costura + guarda __P1_ORIGEM_SIM__ no ingest do padrão +
##    pedagógica só sem grave ativo). Testes: AC-20..24 + PA-09/10 → 24/24 e 12/12;
##    bateria oficial até o vermelho pré-existente: tudo verde.
## 7. NUVEM CONFERIDA (leitura): padroes_telemetria_por_volta tem 1 linha (30/05,
##    médias de motor NULAS, 7 voltas só com tempos) — SEM contaminação de simulador
##    (savePadrao falha silencioso? atualizado_em parou em 30/05 — anotar).
## 8. Replay FINAL rodando com tudo (log /tmp/p1-replay-proof5-saida.log, sonda v3).
##    Fiscais adversariais dos consertos de alerta rodando em workflow.
## Pendências conhecidas (pré-existentes, não desta sessão): schema-parity 5 falhas
## (gabarito 30 tabelas × banco 32); live-data-bridge 21/5 (área alerta ECU);
## riscos (a)(b)(d) da auditoria das 17h; debounce único pit-in/pit-out <5s;
## savePadrao aparentemente nunca grava (atualizado_em=30/05);
## (decisão de produto p/ Flávio: trava de velocidade na entrada do box).
##
## TASK_DONE (sessão 3, 10/06 noite):
## - Pedido original conferido: sim ("continua a orientação" = sequência do checkpoint 17h)
## - Ambiente trabalhado: DESENVOLVIMENTO (produção intocada; banco só leitura)
## - Produção foi alterada: NÃO
## - Arquivos reais inspecionados: sim (box/chegada/trecho-detector, main-t3000,
##   alertas-criticos, padrao-acumulador, padrao-persister, oportunidade-trecho,
##   coreografia-volta, mensagens-pedagogicas, banco padrões/marcos via REST leitura)
## - Alterações: box-detector.js, alertas-criticos.js, padrao-acumulador.js,
##   padrao-persister.js, main-t3000.js, package.json (corrente smoke),
##   tests/{box-detector,alertas-criticos,padrao-acumulador}.mjs
## - Testes: box 9/9, alertas 25/25, padrão 14/14, vizinhos verdes, bateria sem
##   vermelho novo; 2 rodadas de fiscais adversariais (workflows) — refutações
##   incorporadas (folga 5 m; persister recalcula; pressN; desempate; flag no cabo)
## - Critérios: (a) causa provada SIM (sondas v3/v4 com pilha de chamada);
##   (b) consertos DEV+smoke SIM; (c) replay tela acesa SIM (RESULTADO: TELA ACENDEU,
##   16 trechos/2 voltas, mostrar=6, graveComO=0, captura); (d) aberto pro Flávio SIM
##   (navegador visível, Central + painel, simulador ligado)
## - Resultado: CONCLUÍDO (desta sessão) — aguardando validação do Flávio nas janelas
##   e, com aprovação, novo MIGRAR PARA PRODUÇÃO: painel p1t4000
## - Pendências reais: listadas no checkpoint do topo

---

# TASK_INIT (2026-06-10 ~16h) — RETOMADA "continua a orientação" (pós-/clear)

## Pedido original: "continua a orientação" — fechar o último elo: a tela de orientação
## não aparece porque getOrientacao devolve null mesmo com 13 deltas calculados.
## Objetivo (1 frase): fazer a tela de orientação acender de verdade no replay e mostrar pro Flávio.
## Critérios de conclusão: (a) causa do null PROVADA com evidência (evento delta-calculado
## capturado inteiro); (b) conserto aplicado em DEV com smoke; (c) replay final com telas de
## orientação aparecendo; (d) abrir pro Flávio ver ao vivo (Central p1tv + painel ?semfio).
## Leitura confirmada: ~/.claude/CLAUDE.md SIM · ~/.claude-decisoes/padroes.md SIM ·
## FLAVIO_EXECUTION_PROTOCOL.md SIM · FLAVIO_DONE_CHECKLIST.md SIM ·
## FLAVIO_ENVIRONMENT_RULES.md SIM · FLAVIO_COMMUNICATION_RULES.md SIM ·
## + 3 memórias da sessão (central-pista, conceitos-trecho, telas_de_acao_minimas) + CLAUDE.md do projeto.
## Plano (≤5): 1) inspecionar contrato delta-calculator × oportunidade-trecho × bridge (FEITO:
## suspeita forte = pontos de referência sem kmh → todos os pares pulados → delta 0);
## 2) provar com dados reais (banco de melhores passagens + sonda no replay);
## 3) consertar a causa em DEV + smoke; 4) replay final 8/8 com tela acendendo; 5) abrir pro Flávio.
## Arquivos/áreas: web/cockpit/{delta-calculator,oportunidade-trecho,live-data-bridge,main-t3000,
## trecho-detector,melhores-loader,coreografia-volta,tela-orientacao}.js + banco melhores passagens (leitura).
## Ambiente alvo: DESENVOLVIMENTO (linha local main, auto-save commitando; NADA enviado pra fora).
## Produção protegida: sim. Autorização para produção: não (não recebida — novo MIGRAR só depois,
## com aprovação do Flávio). Riscos: mexer no comparador afeta widgets que usam delta (validar smokes);
## nuvem não pode ser poluída por passagem de simulador (blindagem __P1_ORIGEM_SIM__ já existe).
## Status: PARCIAL (encerrado pra /clear a pedido do Flávio às ~17h)
##
## TASK_DONE (parcial, 10/06 ~17h):
## - Critério (a) causa provada: SIM (smoke 0/5→5/5 + delta real +2,83s no replay)
## - Critério (b) conserto em DEV com smoke: SIM (live-data-bridge.js + main-t3000.js +
##   tests/node-smoke-bridge-delta-referencia.mjs; bateria vizinha verde; 5 falhas ECU do
##   smoke antigo provadas pré-existentes)
## - Critério (c) tela acendendo no replay: NÃO — 2 bloqueadores identificados c/ evidência
##   (ver bloco RETOMADA no topo: SEM_DADOS artefato de prova + NO BOX preso no box-detector)
## - Critério (d) abrir pro Flávio: NÃO (depende do c)
## - Produção: INTOCADA. Banco de melhores passagens: só leitura (56 linhas intactas).
## - Arquivos alterados: web/cockpit/live-data-bridge.js, web/cockpit/main-t3000.js,
##   tests/node-smoke-bridge-delta-referencia.mjs (novo). Sondas: /tmp/p1-replay-proof2.mjs,
##   /tmp/p1-inspeciona-banco.py. Servidor local porta 8767 pode ter ficado no ar.

---

# AFINAÇÃO DO VIGIA DE CURVAS ("continua a orientação") — 2026-06-10

## Pedido: fechar a pendência — vigia completa só 2-3 de 8 curvas por volta no replay.
## Critério de conclusão: replay com 8/8 curvas medidas por volta + tela de orientação
## acendendo de verdade + mostrar pro Flávio no navegador. Ambiente: DESENVOLVIMENTO
## (produção intocada; atualização do painel no ar só com novo MIGRAR).
## Plano: (1) sonda por curva descobrindo QUAL passo escapa; (2) consertar a causa
## (suspeitas: sequência rígida — perdeu 1, trava a fila; freada); (3) testes; (4) replay
## até 8/8; (5) abrir pro Flávio ver a tela acender. Status: iniciado

---

# MIGRAÇÃO PRA PRODUÇÃO: painel p1t4000 (2026-06-10)

## Autorização LITERAL do Flávio: "MIGRAR PARA PRODUÇÃO: painel p1t4000" (10/06)
## PROD_RELEASE_PLAN apresentado antes de executar (sem risco destrutivo; sem migration).
## Publicado: https://p1t4000-9mto8lxqj-flaviomarques-6007s-projects.vercel.app → p1t4000.vercel.app
## ROLLBACK (1 comando): npx vercel alias set https://p1t4000-fitlngal6-flaviomarques-6007s-projects.vercel.app p1t4000.vercel.app
## Pré-voo do pacote: 39 js sintaxe OK · grafo 31 módulos fechado · zero marcador de conflito.
## Pacote leva: consertos 08/06 + religações automáticas + eventos volta/trecho + GPS do canal
## + detectores consertados (interseção real) + ápices-semente + orientação por trecho +
## modo sem fio + blindagem anti-simulador + amarração v3.
## Validação pós-deploy: APROVADA NAS 3 FRENTES (workflow, 3 verificadores independentes):
## (1) conteúdo servido = byte-idêntico ao pacote, todos os marcadores presentes, zero conflito;
## (2) grafo público: 31/31 módulos no ar com sintaxe válida;
## (3) boot real em produção com simulador: canal online, 8/8 trechos armados, coreografia ativa,
##     volta fechada na linha de chegada, zero erros de página.
## Notas não-bloqueantes (artefato do dado do simulador, não do painel): HUD "Ar undefined°C"
## (campo nulo removido na gravação) e "λ 0.00" (gravação tinha lambda 0 em trechos; o real
## com motor foi validado 26/05 com λ 0,77).
## TASK_DONE migração: concluída. Produção alterada COM autorização literal registrada.

---

# IMPLEMENTAÇÃO ORIENTAÇÃO POR TRECHO NO PAINEL (2026-06-09 noite)

## Pedido: "pode implementar. vá até o fim sem parar. está autorizado."
## Escopo autorizado: coreografia da volta + tela Oportunidade do Trecho (contrato v3) +
## motor do radar por trecho, NO PAINEL DO PILOTO (web/cockpit) — EM DESENVOLVIMENTO.
## Inclui resgate do TrechoAdvisor (peça JS órfã de 24/05) se compatível.
## Produção protegida: sim. Sem MIGRAR PARA PRODUÇÃO nada vai ao ar. Autorização prod: NÃO recebida.
## Critérios de conclusão: (1) coreografia funcionando (saída→meia-reta painel; meia-reta→entrada
## orientação; críticas atropelam); (2) tela v3 renderizando curva real na visão do piloto com
## vermelho/verde; (3) motor decide verbo+correção por trecho dos deltas por componente;
## (4) testes automáticos verdes; (5) validação no navegador com o replay do simulador.
## Plano: congelar v3 → motor (oportunidade-trecho.js) → tela (tela-orientacao) → coreografia →
## plugar no main-t3000 → smokes → validação navegador → relatório.
## Status: PARCIALMENTE CONCLUÍDO (madrugada 10/06) — ver TASK_DONE abaixo

## TASK_DONE (implementação orientação por trecho)
- Pedido conferido: sim. Ambiente: desenvolvimento (+ p1tv teste). Produção: NÃO alterada
  (única escrita na nuvem foi tentativa de DELETE de poluição de teste que retornou 0 linhas —
  a tabela estava intacta, 56 passagens reais preservadas).
- CONSTRUÍDO E TESTADO (46 testes verdes novos/área):
  · oportunidade-trecho.js (motor, 13/0) · coreografia-volta.js (10/0) · tela-orientacao.js
  (tela contrato v3) · costura no main-t3000 (críticas atropelam, resumo de volta, ordem por
  trecho) · modo SEM FIO (?semfio) · blindagem anti-simulador (provada: "passagem NÃO salva")
  · TrechoAdvisor resgatado (6/0) · v3 congelada em versions/ · simulador com GPS interpolado
  em cadência real (~276 s/volta, 10% mais lento de propósito).
- 3 DEFEITOS GRAVES PRÉ-EXISTENTES achados e consertados:
  · detectores cruzavam com RETA INFINITA (chegada 5/0 + trecho 12/0 após conserto por
    interseção caminho×linha) — na pista real ia fechar voltas erradas;
  · segments-loader exigia ápice cadastrado (não existe — ápice é calculado) → detector
    NUNCA armava; consertado + ápices-semente do mapa oficial (validados ≤24 m);
  · amarração GPS→desenho com COLAPSO DE ESCALA (trajeto canônico = 4 voltas/22 km, não 1);
    v3 com escala travada em 5.476 m — mediana 5,7 px. App reconstruído e INSTALADO no iPhone.
- VALIDADO no replay de voltas reais: voltas fecham na linha certa; passagens completam e
  salvam (e a blindagem bloqueia quando é simulador); coreografia muda de estado nos lugares
  certos (painel→trecho→reta→fase orientação); motor devolve orientação válida (FREIA DEPOIS).
- PENDÊNCIA REAL ÚNICA do bloco: o detector completa só ~2-3 dos 8 trechos por volta no
  replay (fases perdem cruzamentos de entrada/saída em parte das curvas) → a tela de
  orientação ao vivo ainda não APARECE de ponta a ponta. Precisa de afinação dedicada do
  detector (robustez das fases + ápice-semente). Sondagem pronta (window.__t3 expõe tudo).
- Outras pendências: publicar painel exige "MIGRAR PARA PRODUÇÃO: painel p1t4000";
  teste antigo live-data-bridge segue 21/5 (pré-existente, área alerta ECU).

---

# AUDITORIA "tudo ligado esperando dados reais?" (2026-06-09 noite)

## Pedido: Flávio aprovou o visual no iPhone e pediu auditoria da cadeia de dados reais.
## Método: somente leitura — página no ar inspecionada + nuvem consultada + código conferido.

## VERDE (ligado, só esperando dado real)
- Vídeo: DJI→notebook→Central→sala→app (caminho provado em campo 09/06).
- GPS: RaceBox→Central→sala+canal→app/bolinha (RaceBox provado no escritório 25,1 Hz).
- Dados do motor: painel NO AR publica amostras no canal (grep publishSample=2 na versão
  publicada; provado com motor real 26/05) → Central repassa → app.
- Referências na nuvem (consulta direta): 20 trechos, 4 marcos (chegada/box/pit),
  56 melhores passagens reais, curva do motor 79 pts, 5 marchas. TUDO lá.
- App ASSISTIR decodifica exatamente o que a Central repassa (validado ao vivo).

## VERMELHO (1 elo faltando — depende de autorização)
- VOLTA e cor verde/vermelho com dados REAIS: o painel do piloto NO AR não publica eventos
  de volta/trecho (grep publishEvento=0) e não consome GPS do canal (grep onGpsPoint=0).
  As duas peças estão prontas EM DESENVOLVIMENTO (feitas hoje). Sem publicar, a linha da
  volta no app só funciona com simulador. Destrava com: "MIGRAR PARA PRODUÇÃO: painel
  p1t4000" (pacote leva junto: consertos 08/06 + religação automática + eventos + GPS canal).

## AMARELO (risco conhecido, não bloqueia ligação)
- Fix de GPS do RaceBox ao ar livre nunca testado (escritório bloqueia satélite).
- Religação automática da T4000 testada só em lógica (hardware está no carro).
- Bolinha: precisão ~1 largura de pista (amarração desenho estilizado × GPS).

---

# TELA ASSISTIR — REFORMA DITADA (2026-06-09 noite, 2ª rodada)

## Pedido do Flávio (voz)
Esquecer o TRECHO. Na mesma linha: melhor volta do dia + tempo da volta em curso, colorido
(verde se naquela parte está melhor que a melhor volta do dia, vermelho se pior). Layout:
CIMA vídeo · MEIO velocidade + dado da volta · BAIXO mapa de Brasília com o ponto do carro.
Mapa: fundo preto, pista cinza, usar a pista OFICIAL dos arquivos (a que ele posicionou).

## TASK_DONE (reforma)
- Ambiente: desenvolvimento + p1tv (teste). Produção NÃO alterada.
- Arquivos: AssistirView.swift (layout novo, sem TRECHO, em-curso colorido por deltaS),
  PistaBrasilia.swift (NOVO, gerado: 495 pts do desenho DEFINITIVO + amarração GPS calculada
  por aproximação iterativa, erro mediano 11,5 px), index.html da Central (simulador ganhou
  replay de GPS do trajeto canônico + volta fechada ao completar o circuito + guarda contra
  GPS congelado), sim-gps.json (NOVO, 307 pts).
- Validação: BUILD SUCCEEDED, app instalado no iPhone, sala recebeu gps(lat Brasília,
  spd real)/carro/painel sem erros via navegador automatizado.
- Resultado: concluído — aguardando validação visual do Flávio no iPhone.
- Pendência honesta: precisão da bolinha ~1 largura de pista (desenho oficial é estilizado;
  se incomodar, dá pra refinar a amarração trecho a trecho).

---

# TELA ASSISTIR NO APP (2026-06-09 noite)

## Pedido do Flávio (card respondido: "Tela de ASSISTIR primeiro, depois modo BOX")
Tela pra pessoas assistirem no app: vídeo em tempo real em cima + dados básicos de trecho e
volta do piloto embaixo. Decisões registradas: internet da Apple TV = celular do modo BOX.

## TASK_DONE (tela ASSISTIR)
- Pedido conferido: sim · Ambiente: desenvolvimento + p1tv (teste) · Produção alterada: não
- Arquivos: AssistirView.swift (NOVO), HomeView.swift (botão+rota), ContentView.swift (rota),
  web/teste-aparelhos/index.html (repasse carro/painel pra sala + simulador de voltas/trechos),
  web/cockpit/cloud-bridge.js (publishEvento), web/cockpit/main-t3000.js (eventos volta/trecho/delta — DEV)
- Validação: BUILD SUCCEEDED + app INSTALADO no iPhone; ouvinte na sala recebeu gps=60 carro=24
  painel=12 em 12 s (exemplos reais conferidos); sintaxe OK nos 3 js; smokes bootstrap 7/0, web 16/0.
- Resultado: concluído — FALTA validação visual do Flávio no iPhone (abrir ASSISTIR AO VIVO com
  a Central transmitindo + simulador ligado).
- Próximo bloco já decidido no card: MODO BOX (Vista Piloto na Apple TV, internet do celular).

---

# SOLUÇÃO DE PISTA SEM IR À PISTA (2026-06-09)

## Pedido original do Flávio
"vc já criou uma aplicação para testar a t4000. e testamos e deu certo. hoje testamos gps e câmera.
quero preparar a solução de pista sem ir lá. porque na próxima quero tudo funcionando."

## Objetivo em 1 frase
Juntar os dois caminhos já provados (T4000→painel→nuvem de 26/05 + câmera/GPS→app de 09/06) numa
solução de pista única, robusta (religação automática) e testável no escritório via replay das
amostras reais do motor.

## Critérios objetivos de conclusão
1. Transmissor p1tv com câmera + GPS + status do carro + religação automática nas 3 fontes.
2. Painel remoto (painel.html) mostrando vídeo + GPS + dados do carro com aviso de queda.
3. Modo simulador tocando as 2.901 amostras reais (26/05) sem o carro.
4. Painel do piloto (p1t4000) com religação automática — EM DESENVOLVIMENTO, sem publicar.
5. Cadeia inteira validada no escritório (navegador + ouvinte no Mac).
6. Checklist do dia de pista + ADR-024 atualizada (câmera iPhone → DJI).

## Confirmação de leitura: ~/.claude/CLAUDE.md sim · padroes.md sim · FLAVIO_EXECUTION_PROTOCOL sim ·
FLAVIO_DONE_CHECKLIST sim · FLAVIO_ENVIRONMENT_RULES sim · FLAVIO_COMMUNICATION_RULES sim

## Plano (5 passos)
1. Transmissor unificado em web/teste-aparelhos/ (religação + GPS na nuvem + status carro).
2. painel.html com dados do carro + religação.
3. Modo simulador (replay amostras reais).
4. Robustez do painel do piloto em dev (main-t3000.js) — SEM publicar.
5. Validação no escritório + checklist de pista + ADR-024.

## Arquitetura decidida (com base no que está provado)
- Notebook na pista roda 2 abas: p1t4000.vercel.app (painel do piloto + T4000 via USB — provado 26/05)
  e p1tv.vercel.app (câmera DJI + RaceBox — provado 09/06). Só UMA página pode segurar o USB da
  T4000 por vez, por isso 2 abas, cada uma dona de um aparelho.
- Dados do carro trafegam SÓ pelo canal canônico cockpit-bubi-live (regra: não criar fonte paralela).
- GPS do RaceBox passa a ser publicado TAMBÉM no cockpit-bubi-live (evento 'gps' que o canal já
  suporta) além do caminho atual pelo vídeo — assim o painel do piloto pode usar o GPS de 25 Hz.

## Ambiente alvo: desenvolvimento. p1tv.vercel.app = endereço de TESTE (criado 09/06 como tal).
## p1t4000.vercel.app NÃO será republicado (exige MIGRAR PARA PRODUÇÃO).
## Produção protegida: sim · Autorização para produção: não · Evidência: não recebida
## Riscos: nenhum em produção; canal de broadcast não persiste dados (simulador não polui banco).
## Status: CONCLUÍDO (aguardando validação visual do Flávio com RaceBox+DJI reais)

## TASK_DONE (2026-06-09 noite)
- Pedido original conferido: sim (solução de pista preparada sem ir à pista, testável no escritório)
- Ambiente trabalhado: desenvolvimento + endereço de TESTE p1tv.vercel.app (criado 09/06 como teste)
- Produção foi alterada: não (p1t4000.vercel.app intocado; nada enviado pro repositório oficial remoto)
- Arquivos reais inspecionados: sim (main-t3000.js, cloud-bridge.js, live-data-bridge.js, index/painel,
  FONTE_DADOS_AO_VIVO.md, HANDOFF_T4000, BLOCKERS, STATUS, vercel configs)
- Alterações feitas: sim — ver lista abaixo
- Testes executados: 5 smokes da área (state 24/0, renderer 17/0, bootstrap 7/0, web 16/0,
  live-data-bridge 21/5 — as 5 falhas são PRÉ-EXISTENTES, provado contra estado 546b2da0 16:51);
  sintaxe OK nos 4 arquivos mexidos; validação ponta-a-ponta com navegador automatizado:
  simulador→nuvem→painel remoto (RPM 843/água 38°/bat 12,8 V) + ouvinte externo (105 amostras).
- Resultado: concluído
- Pendências reais: (1) Flávio validar Central com RaceBox+DJI reais clicando;
  (2) religação T4000 sem teste com hardware real; (3) publicar painel do piloto reforçado
  exige "MIGRAR PARA PRODUÇÃO: painel p1t4000" (inclui consertos 08/06); (4) teste antigo
  live-data-bridge defasado (5 falhas pré-existentes, área alerta ECU).

## Arquivos alterados nesta tarefa
- web/teste-aparelhos/index.html (Central de Pista: 4 luzes + religações + GPS→nuvem + simulador)
- web/teste-aparelhos/painel.html (dados do carro + religação + GPS reserva pela nuvem)
- web/teste-aparelhos/sim-amostras.json (NOVO — 2.901 amostras reais do motor, 827 KB)
- web/cockpit/main-t3000.js (religação automática T4000 + GPS do canal no detector) — DEV
- web/cockpit/cloud-bridge.js (religação automática do canal) — DEV
- ARCHITECTURE_DECISIONS.md (ADR-024 registrada: câmera DJI no notebook)
- docs/CHECKLIST_DIA_DE_PISTA.md (NOVO)
Tudo preservado pelo auto-save no branch wip/20260608-143705. Publicado SÓ o p1tv (teste).

---

# ANÁLISE + PROPOSTA — "implementar o que está faltando" (2026-06-09) — superada pela tarefa acima (Flávio respondeu em texto: preparar solução de pista; card não precisa mais de resposta)

## Pedido original do Flávio
"agora vamos implementar em p1 fast o que está faltando. analise e me proponha."

## Objetivo em 1 frase
Mapear o que falta no P1 Fast com evidência e propor ordem de implementação pra decisão do Flávio.

## Critérios objetivos de conclusão
1. Pendências levantadas de fontes reais (memória, ultima-tarefa, STATUS.md, BLOCKERS.md, código).
2. Proposta com recomendação apresentada.
3. Card de decisão aberto no navegador.

## Confirmação de leitura dos arquivos obrigatórios
- ~/.claude/CLAUDE.md: sim
- ~/.claude-decisoes/padroes.md: sim (0 decisões sintetizadas)
- ~/.claude/FLAVIO_EXECUTION_PROTOCOL.md: sim (existe, 92 linhas)
- ~/.claude/FLAVIO_DONE_CHECKLIST.md: sim (existe, 64 linhas)
- ~/.claude/FLAVIO_ENVIRONMENT_RULES.md: sim (existe, 86 linhas)
- ~/.claude/FLAVIO_COMMUNICATION_RULES.md: sim (lido integral)

## Plano (≤5 passos)
1. Ler memória (global + P1 Fast) e registros do projeto. [feito]
2. Conferir STATUS.md, BLOCKERS.md, shift light, pasta windows/. [feito]
3. Consolidar o que falta em frentes.
4. Apresentar proposta com recomendação.
5. Abrir card de decisão e aguardar.

## Áreas inspecionadas
STATUS.md, BLOCKERS.md, docs/SHIFT_LIGHT_PROGRESS.md, windows/cockpit/, .claude-exec/ultima-tarefa.md, memória dos 2 caminhos.

## Ambiente alvo: desenvolvimento (análise somente leitura; nenhuma alteração de código nesta etapa)
## Produção protegida: sim
## Autorização para produção: não
## Evidência da autorização: não recebida
## Riscos: nenhum (somente leitura + card)
## Status: iniciado → proposta apresentada, aguardando decisão do Flávio

---

# TESTE DE APARELHOS (vídeo + GPS) — 2026-06-09

## Pedido do Flávio
Teste de ponta a ponta: o **notebook Windows** da pista transmite **vídeo (câmera DJI Osmo Action 6,
1080p, via Daily.co)** + **dados do GPS (RaceBox Mini S)**, e o Flávio **vê no celular** numa tela de
painel ao vivo. Iterar ao vivo com ele, ajustando conforme o feedback.

## PUBLICADO e no ar (endereço de teste novo e separado — NÃO toca produção)
- **Notebook (transmite):** https://p1tv.vercel.app
- **Celular (assiste):** https://p1tv.vercel.app/painel
- Projeto Vercel `p1-teste-aparelhos` (apelido `p1tv.vercel.app`). Proteção SSO desligada (público).

## Arquitetura (3 peças) — fonte em `web/teste-aparelhos/`
- `index.html` (notebook): Daily.co publisher (câmera, seletor pra escolher a DJI) + RaceBox por
  **WebBluetooth** (Nordic UART notify 6e400003; frame B5 62 / class 0xFF id 0x01 / payload 80B —
  fix p[20], numSV p[23], hacc u32@40/1000, spd i32@48/1000*3.6, lat i32@28/1e7, lon i32@24/1e7) →
  manda GPS pro celular via `sendAppMessage` (200ms).
- `painel.html` (celular): Daily.co viewer (vídeo) + recebe GPS por `app-message`.
- `api/room.js`: ponte same-origin → chama servidor-pra-servidor `fam-racing.vercel.app/api/video/room`
  (que bloqueia Origin de outro site). Sala determinística eventId `p1-teste-aparelhos` + data de hoje.

## Verificado por evidência (2026-06-09)
fam-racing/api/video/room → 200 (roomUrl+tokens). p1tv.vercel.app `/`→200, `/painel`→200,
`/api/room`→200 (cria sala `evento-p1-teste-aparelhos-20260609`).

## VALIDADO EM CAMPO (2026-06-09) ✅
Flávio rodou o teste: "a imagem apareceu e o gps também". Vídeo ao vivo + GPS do notebook
chegam DENTRO do app P1 Fast no iPhone (tela "TESTE AO VIVO" na Home). Primeira vez que o
vídeo rodou no app (MS-11 era stub). Detalhe completo em memória
`p1-fast-teste-video-gps-app-validado-2026-06-09`.

App iOS: tela nova `Sources/Views/TesteAoVivoView.swift` + botão "TESTE AO VIVO" na HomeView +
rota `--p1-teste-aovivo` + chaves de plist. Instalado no iPhone 16 Pro Max (id 00008140-000E2D611E6A801C).
Build SUCCEEDED, install OK.

## Próximo passo (aguardar decisão do Flávio)
Teste validado. Próximas frentes possíveis (ele decide): (a) integrar a T4000/dados do carro no mesmo
fluxo; (b) levar do "teste" pro painel real do piloto; (c) robustez (reconexão, Starlink na pista);
(d) atualizar ADR-024/CLAUDE.md (câmera iPhone → DJI). Iterar app: ver comando de reinstalação na memória.

## Pendências do modelo (separadas deste teste)
- ADR-024 / CLAUDE.md dizem câmera = iPhone frontal; Flávio mudou pra DJI no notebook. Atualizar doc.
- MS-11 real no app iOS: StreamCoordinator tem stub, conexão Daily.co CallClient não implementada.

---

# AUDITORIA PROFUNDA — TASK_DONE (2026-06-08)

Pedido Flávio: "faça uma auditoria profunda." Ambiente: desenvolvimento + leitura na nuvem.
Produção NÃO alterada. 5 frentes paralelas, cada achado provado.

VERDE (com evidência):
- Núcleo Swift: 545 ok / 0 fail (`swift run p1fast-smoke`).
- App iOS: BUILD SUCCEEDED (só warnings).
- Migrations.swift: colisão v19 RESOLVIDA (único v19_manutencao_consumiveis; antigo virou v28).
- Estoque na nuvem chegou ponta-a-ponta: pecas=2, pecas_locais=3, pecas_movimentacoes=5.
- Schema drift RESOLVIDO (data_fim nullable, template_id text, quantidade/nota presentes).
- App iOS: 7 funções principais existem e integradas; 0 TODO/FIXME/fatalError críticos.

VERMELHO / RISCO:
1. 3 arquivos do PAINEL WEB do cockpit NA VERSÃO OFICIAL com marcadores de conflito não
   resolvidos (JS inválido): web/cockpit/cockpit-renderer.js (9), cockpit-state.js (3),
   melhores-loader.js (9). Em origin/main E branch local. Introduzido em cd3af53b. Quebra
   `npm run smoke`. NÃO afeta o app iPhone (afeta só o painel web do cockpit).
2. STATUS.md 10 dias atrasado (topo 2026-05-24; realidade 2026-06-03). Contradição doc×doc:
   MS-4 e MS-16 = "não feito" no STATUS, "fechado" no PLANO_FASE_1.
3. Trabalho órfão em 4 ambientes isolados nunca incorporados: infallible-liskov (editor de
   pista + mapa Brasília), infallible-snyder (6 telas), rodada1-s1 (foto carro + telas S1-S8),
   vista-engenheiro (Vista Piloto canônica + Vista Engenheiro Command Box).
4. Manutenção: 0 linhas na nuvem (sync de manutenção nunca exercitado de verdade).
5. Sincronização só roda com app aberto/desbloqueado (sem envio em segundo plano).
6. Teste node-smoke-schema-parity desatualizado vs schema atual (5 asserts) — teste velho.
7. 22 dos últimos 50 registros da oficial são "auto-save" automáticos (poluição de processo).

Resultado: concluído. Próximo passo aguarda decisão do Flávio.

---

# FRENTE 1 CONCLUÍDA (2026-06-08) — Painel do cockpit consertado

Flávio aprovou consertar os 3 arquivos do painel web. Esclareceu o modelo (NÃO eram 2 opções):
um quadro por curva com ENTRADA (único ponto, velocidade ao cruzar a linha de entrada),
FREIO (ponto de frenagem em metros desde a entrada + velocidade) e ÁPICE (bolinha = ponto
mais interno da passagem mais rápida). Saída mantida.

Resolução (por evidência, não escolha cega):
- melhores-loader.js: adotado o modelo que casa com a nuvem (migrations 0026/0027: track_id,
  segment_id, tempo_trecho_s, pontos_json) e com os 2 pontos de entrada do painel (main.js,
  main-t3000.js chamam gravarPassagem + loadMelhoresPassagens({obj})). Lado antigo
  (salvarPassagemSeMelhor/distanciaMetros) descartado — ninguém usava (grep confirmou).
- cockpit-state.js: apex.apice = {distM, angleDeg} (bolinha); entrada/freio/saida preservados;
  freio ganhou valorKmh (modelo Flávio). 4 papéis mantidos (setApexPonto valida os 4).
- cockpit-renderer.js: removida a definição duplicada/antiga de _renderApexApice; mantida a
  versão bolinha; saída renderizada; bindings = bolinha (apexApiceBola/Num) + saída.

Validação: 0 marcadores de conflito restantes; cockpit-state e cockpit-renderer carregam em
Node; smokes VERDES: cockpit-state 24/0, cockpit-renderer 17/0, cockpit-bootstrap 7/0 (CKB-07
que falhava agora passa), cockpit-web 16/0.

Ambiente: DESENVOLVIMENTO. NÃO enviado pro repositório oficial / NÃO colocado no ar (o painel
p1t4000.vercel.app pode estar ligado à oficial; envio precisa de "MIGRAR PARA PRODUÇÃO").

Pendentes das 3 frentes aprovadas: (2) atualizar STATUS.md; (3) trazer trabalho órfão.

---

# FRENTES 2 e 3 (2026-06-08)

## Frente 2 — STATUS.md atualizado ✅
Topo reescrito pro checkpoint 2026-06-08 (estado real verificado) + correção das contradições:
MS-4 FECHADO 2026-05-11 (confirmado em PLANO_FASE_1.md:184), MS-16 entregue 2026-05-13. Histórico
2026-05-24 preservado logo abaixo (marcado como histórico). Nada apagado.

## Frente 3 — trabalho órfão: retrato honesto + 1 item trazido
Os diffs dos 4 ambientes vs oficial são GIGANTES (5000+ arquivos divergentes) — merge cego
REVERTERIA a oficial. Avaliei só os commits nomeados de cada entrega + checagem de presença na oficial:
- Vista Piloto canônica/v04 (fb9126ed): JÁ na oficial (mockup-command-box-vista-piloto + auditorias).
- Mapa Brasília definitivo (d453652c): JÁ na oficial (_design-reference/MAPA-BRASILIA-DEFINITIVO.json).
- rodada1-s1 (19c23841): majoritariamente cards de pergunta .html antigos = lixo histórico.
- c0b6026a/13ce80c6 (telas .swift): StintCockpitView/StintReadyView NEM EXISTEM na oficial atual
  → estrutura divergente, ALTO RISCO de reverter trabalho de 03/06. CockpitOrientationTestView +
  StintRodandoView são telas NOVAS (faltam na oficial) — avaliar 1 a 1 (decisão pendente).
- **TRAZIDO: _design-reference/mockup-command-box-vista-engenheiro.html** (de 15c911f6, Vista
  Engenheiro Command Box, aprovado 13/05). FALTAVA na oficial. 7371 linhas, HTML íntegro, arquivo
  novo (não toca nada). Só esse arquivo do commit foi extraído (não a edição do vista-piloto).

## Estado de publicação
TUDO em desenvolvimento (working tree do branch wip/20260608-143705). NADA enviado pro repositório
oficial / NADA no ar. Conserto do painel web pode disparar deploy se p1t4000.vercel.app estiver
ligado à oficial → envio precisa de "MIGRAR PARA PRODUÇÃO". STATUS.md e Vista Engenheiro são docs,
não afetam produção.

Pendências: (a) Flávio decidir sobre telas novas CockpitOrientationTest/StintRodando; (b) Flávio
autorizar (ou não) o envio pro repositório oficial / colocar painel no ar.

## Avaliação das 2 telas novas (Flávio pediu "testar antes") — VEREDITO: NÃO TRAZER
git grep em origin/main: OrientationLock=0, FlowToken=0, StintCockpitView=0, StintCaptureView=2.
- CockpitOrientationTestView: depende de OrientationLock + FlowToken (ausentes). É ferramenta de
  diagnóstico DEV-ONLY (--p1-cockpit-test) pra testar rotação, não produto.
- StintRodandoView: depende de StintCockpitView (ausente) + OrientationLock (ausente). Alterna
  cockpit-horizontal-no-iPhone vs captura-vertical.
- Ambas pertencem ao COCKPIT DO PILOTO NO IPHONE, caminho DESCONTINUADO por ADR-023 (09/05):
  cockpit-display migrou pro notebook Windows. Trazer = ressuscitar caminho abandonado + puxar
  cadeia ausente. Reprovadas. Preservadas nos worktrees (infallible-snyder), nada apagado.

## DECISÕES DO FLÁVIO (2026-06-08)
- Telas novas: avaliar antes (feito → reprovadas, ver acima).
- Publicação: ESPERAR — tudo fica em desenvolvimento. NADA enviado pro repositório oficial / no ar.

## ESTADO FINAL das 3 frentes (todas em desenvolvimento, nada publicado)
1. Painel cockpit consertado + validado (4 smokes verdes).
2. STATUS.md atualizado (checkpoint 2026-06-08 + correção MS-4/MS-16).
3. Órfão: Vista Engenheiro trazida (1 arquivo novo); telas .swift reprovadas; resto já-na-oficial/lixo.
Quando o Flávio mandar, envio pro repositório oficial (e, com "MIGRAR PARA PRODUÇÃO", coloco painel no ar).

---
---

# Auditoria — Sincronização Estoque + Manutenção (2026-06-08)

## Pedido
Auditar (somente leitura) a sincronização de Estoque+Manutenção pra nuvem Supabase p1-fast: migration 0039, Edge Function sync, estado real da nuvem, fila/backfill do app iOS.

## Ambiente: produção (Supabase p1-fast fvhwltzhytpnhlqbttmd) — SOMENTE LEITURA. Nada escrito.

## Achados (com evidência)
- Migration 0039 existe: cria pecas_locais, pecas, pecas_movimentacoes, manutencoes (+índices, triggers updated_at, RLS is_member).
- Edge Function sync (index.ts:29-47): ALLOWED_TABLES inclui pecas_locais, pecas, pecas_movimentacoes, manutencoes.
- Nuvem (via `supabase db query --linked`, SELECT): pecas=2, pecas_locais=3, pecas_movimentacoes=5, manutencoes=0.
- Schema drift RESOLVIDO: eventos.data_fim = date NULLABLE; evento_pendencias.template_id = text (NOT NULL); quantidade=real, nota=text presentes.
- App: PecaRepository.swift enfileira em cada mutação; ManutencaoConsumiveisView.swift:60 enfileira manutenção; SyncBackfill.run no boot (ContentView.swift:268, Task.detached background); drain por Timer no SyncCoordinator (30s) — depende de foreground; sem BGTaskScheduler.

## Status: concluído

---
---

# TASK (2026-06-09) — Testar RaceBox Mini S no escritório

## Pedido (Flávio)
Acessar e testar o GPS RaceBox Mini S no escritório, pra garantir que funciona antes da pista.

## Achados de contexto
- RaceBox JÁ previsto no projeto: BLOCKERS.md §E4 (upgrade condicional, arquivado 2026-05-01) +
  docs/hardware/RACEBOX_INTEGRATION_SPEC.md (spec completa, arquivada). Fonte 'racebox-gnss' já
  existe nos testes do TimeBase. Decisão: RaceBox volta SÓ se entrar lap timing fino / traçado
  sub-metro / redundância. Hardware (25Hz GNSS, IMU, BLE 5.2) cobre exatamente esse gap do iPhone (1Hz).

## Execução (teste real de hardware no Mac)
- Bluetooth do Mac: ligado. Ferramenta: venv /tmp/racebox-venv + bleak (BLE). Scripts em
  /tmp/racebox-scan.py e /tmp/racebox-read.py.
- Aparelho encontrado: "RaceBox Mini S 2254302917", UUID macOS CC55E494-7523-A468-D2D9-53A83AFE5B61,
  RSSI -51 dBm.
- Protocolo: público (UBX-like, Nordic UART Service notify 6e400003-...; msg class 0xFF id 0x01,
  payload 80 bytes). NÃO precisou de NDA/PDF pra ler.
- RESULTADO: 283 pacotes/12s = 25,1 Hz; checksum 283 OK / 0 ruins; forças G (vert +1.019g = gravidade,
  parado); rotação estável; bateria 65% carregando (Flávio confirmou USB-C plugado).
- GPS: SEM FIX / 0 satélites — esperado dentro do escritório (concreto bloqueia). Resolve ao ar livre.

## Status: CONCLUÍDO o teste de escritório (comunicação + leitura + decodificação provadas).
Pendências reais (não do teste): (a) confirmar fix de GPS ao ar livre/janela; (b) DECISÃO do Flávio:
integrar RaceBox ao P1 Fast e por onde ele entra (iPhone? notebook Windows? Mini PC do spec?);
(c) implementar driver/parser/provider racebox se aprovado (spec já existe). NADA implementado ainda.

## Configuração definitiva RaceBox p/ pista (2026-06-09, com evidência)
Perguntas do Flávio respondidas com pesquisa (manual oficial) + teste empírico:
1) Pode ficar abaixo do teto/laje? NÃO sob metal/concreto — bloqueia 100%. Simulação no pior caso
   (andar de baixo, sob laje, 5m da janela, 90s): 0 satélites o tempo todo. Manual: "Metal and some
   windshields completely block the GPS signal". Lugar certo: painel junto ao para-brisa OU teto externo.
2) USB ou Bluetooth? BLUETOOTH (dados). Cabo USB-C do RaceBox = só CARGA (manual "to charge"; doc =
   "BLE Protocol"; no Mac NÃO enumera como dispositivo de dados, sem porta serial). Simulação provou
   Bluetooth robusto: 25/s, 0 erro, a 5m + parede.
3) USB do computador ocupado com T4000? Sem conflito — RaceBox é Bluetooth, não usa cabo de dados.
   T4000 no cabo USB + RaceBox no Bluetooth simultâneos. USB-C do RaceBox vai num carregador (energia).

CONFIG FINAL: RaceBox com vista do céu (painel/para-brisa ou teto externo) + dados por Bluetooth +
alimentado por carregador + porta USB do computador livre pra T4000.
PENDENTE: validar fix de GPS com vista do céu (não testável sob laje). Decisão de integração ainda aberta.
