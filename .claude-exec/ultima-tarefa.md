# TASK_INIT 13/06/2026 — LIGAÇÕES REAIS DO COMMAND BOX COM O SISTEMA (análise honesta + teste)

> Tarefa anterior (classificador de curvas) preservada em
> `.claude-exec/ultima-tarefa-backup-pre-command-box-2026-06-13.md`.

1. **Pedido original (Flávio, literal):** "em p1 fast eu Gostaria de começar a criar as
   ligações reais, verdadeiras do Box Command Center com o sistema. Faz uma análise honesta,
   com evidência, teste as funcionalidades para a gente poder fazer funcionar."

2. **Objetivo em 1 frase:** mapear com evidência o que existe hoje no Command Box, o que já
   está ligado a dado real e o que é mockup, testar o que dá pra testar, e entregar um plano
   honesto e faseado para começar as ligações reais — sem tocar produção.

3. **Critérios objetivos de conclusão:**
   (a) inventário verificado de cada tela do Command Box com origem real do dado (estático vs vivo);
   (b) fonte de dado ao vivo real (canal cockpit-bubi-live, Supabase prod fvhwltzhytpnhlqbttmd) e formato;
   (c) levantamento do persistido/histórico (Supabase, advisor) que alimentaria engenharia;
   (d) execução dos testes automáticos relevantes com saída real PASS/FAIL;
   (e) mapa de lacunas honesto;
   (f) plano faseado em linguagem de gestor;
   (g) revisão adversarial antes de entregar;
   (h) NADA alterado em produção nem no cockpit ao vivo.

4. **Leitura confirmada:** ~/.claude/CLAUDE.md (sim) · padroes.md (sim, vazio) ·
   FLAVIO_EXECUTION_PROTOCOL (sim) · FLAVIO_DONE_CHECKLIST (sim) · FLAVIO_ENVIRONMENT_RULES (sim) ·
   FLAVIO_COMMUNICATION_RULES (sim) · CLAUDE.md do projeto (sim) · AMBIENTES_P1_FAST (sim) ·
   memórias Command Box (só visualização; cockpit vs command box) (sim).

5. **Plano <=5 passos:** (1) inventariar cada tela e provar origem do dado; (2) mapear fonte ao
   vivo real e o que entrega; (3) mapear histórico/persistido (Supabase+advisor); (4) rodar testes
   relevantes e capturar saída real; (5) sintetizar lacunas + plano faseado, revisão adversarial,
   abrir pro Flávio.

6. **Arquivos/áreas:** _design-reference/mockup-command-box-*.html + selecao-command-box.html ·
   web/cockpit/cloud-bridge.js, main-t3000.js, cockpit-renderer.js, advisors · api/advisor.js ·
   supabase/migrations, functions, config.toml · tests/node-smoke-* · docs/FONTE_DADOS_AO_VIVO.md.

7. **Ambiente alvo:** desenvolvimento (análise local + leitura). Nada de deploy/escrita.
8. **Produção protegida:** sim.
9. **Autorização para produção:** não.
10. **Evidência da autorização para produção:** não recebida (tarefa é só análise/teste).
11. **Riscos:** (a) Command Box hoje é mockup -> não superestimar "pronto"; (b) canal ao vivo
    aponta pro Supabase de PRODUÇÃO -> leitura segura, não escrever; (c) afirmar "ligado" sem
    prova -> revisão adversarial; (d) telas de engenharia dependem de sensores talvez não instalados.
12. **Status inicial:** iniciado.

---

## RESULTADO DA ANÁLISE (13/06/2026) — evidência + testes

Análise multi-agente (28 agentes, com checagem adversarial). Achados centrais (todos com arquivo:linha provados):

### Telas do Command Box = maquete
- NÃO existe app real (sem web/command-box). 7 telas em `_design-reference/`.
- vista-piloto / vista-engenheiro (~7.300 linhas): 100% estático, dado de array FAKE_LAPS (4 voltas fictícias), animação = replay determinístico. Zero conexão (grep ZERO supabase/fetch/websocket).
- mockup-command-box.html: 100% HTML estático (nem relógio anda).
- lambda / pace / motor-saude / saude-carro: por padrão mock; têm gancho de fetch a um "Tradutor" local (localhost:8765) que NÃO é o canal ao vivo e envia pacote sintético (rpm=0) → na prática volta vazio. NÃO usam cockpit-bubi-live.
- selecao-command-box.html: NÃO é lançador; é formulário de curadoria (exporta JSON).

### Fonte ao vivo real (existe e funciona — do Cockpit do Piloto)
- Canal `cockpit-bubi-live`, Supabase prod fvhwltzhytpnhlqbttmd, evento 'sample', 5 Hz. (cloud-bridge.js:14/17/18/131; main-t3000.js:756)
- PROVADO contra software oficial (carro PARADO): rpm, bateria, água, TPS, lambda WB (offset 62/1000), MAP. (FONTE_DADOS_AO_VIVO.md:54-65)
- GPS/velocidade-de-pista vem por OUTRO evento 'gps' (RaceBox/iPhone). Marcha/EGT/óleo/pneu/câmbio: NÃO existem como leitura (parser:219-223). Ar/pedal/freio sem sensor → null.

### Banco
- Dado real em prod: dyno_curve (79 pts Bubi), track_segments (8 curvas), marcos, gear_ratios, carro Bubi.
- LAMBDA: sem tabela/coluna tipada (só dentro de payload jsonb). PACE/Vmin: schema existe, gravação histórica NÃO confirmada. MOTOR/SAÚDE: só médias agregadas ou cru; qualidade_troca_marcha VAZIA (sem sensor).
- Riscos a checar no banco: migrations 0025-0028 numeradas em duplicidade; conflito carros.time_id vs team_id (colunas de shift-por-carro podem faltar em prod).

### Análise/IA já pronta e testada (alimenta o piloto, não a engenharia)
- alertas-criticos, padrao-acumulador, oportunidade-trecho, mensagens-pedagogicas, shift-light-modos, forca-integrada, coreografia-volta, advisor.

### Testes que rodei (reais)
- 8/8 smoke VERDE, 141 asserções ok / 0 falhas:
  live-data-bridge 26/0 · cockpit-web 16/0 · cockpit-renderer 17/0 · cockpit-state 24/0 · transport 17/0 · advisor-findings 9/0 · cockpit-bootstrap 7/0 · alertas 25/0.
- RESSALVA honesta: verde cobre a LÓGICA de software (módulos JS), NÃO o hardware T3000/T4000 real nem o canal ao vivo em campo.

### Recomendação
Começar a ligação real pela tela AO VIVO em web, bebendo do canal cockpit-bubi-live (caminho provado), mostrando só o que tem sensor real e marcando o resto como "sem sensor". Card de decisão aberto: 20260613-120746-command-box-ligacao-real-inicio.

---

TASK_DONE (fase de análise):
- Pedido original conferido: sim
- Ambiente trabalhado: desenvolvimento (análise + leitura)
- Produção foi alterada: não
- Se produção foi alterada, autorização explícita registrada: n/a
- Arquivos reais inspecionados: sim (telas, ponte, banco, advisor)
- Alterações feitas: não (só análise + card de decisão)
- Testes/validação executados: sim (8/8 smoke verde)
- Resultado: PARCIAL — análise + teste concluídos; construção das ligações BLOQUEADA aguardando decisão de arquitetura (card aberto)
- Pendências reais: decisão do Flávio sobre por onde começar (card 20260613-120746)

---

## CONSTRUÇÃO (13/06/2026) — decisão A escolhida pelo Flávio

Decisão registrada: "A) Tela ao vivo em web, no canal que já funciona" (card 20260613-120746).

### Entregue
- NOVA tela real: `web/command-box/index.html` — primeira ligação real do Command Box.
  - Assina o canal REAL `cockpit-bubi-live` (Supabase Realtime), eventos 'sample' (motor) e 'gps' (pista).
  - Reusa o padrão de assinatura provado de monitor-bubi-live.html / painel.html.
  - Mostra valor SÓ onde há sensor real hoje (rotação, velocidade GPS, lambda, água, coletor/MAP, borboleta, bateria, posição/satélites). Itens sem sensor (pneus, marcha, óleo, câmbio, freio, ar) marcados "sem sensor" — nada inventado.
  - Só visualização (sem botão de ação) — respeita a regra do Command Box.
  - Status de conexão (conectando/aguardando/ao vivo/sem conexão), Hz, última leitura, alarmes do motor.
  - Sem emoji (ícones SVG de traço); usa a largura toda.
  - Modo `?preview` = pré-visualização 100% LOCAL (não transmite nada) pra ver a tela populada.

### Testes/validação executados (saída real)
- Sintaxe do script da tela: OK (node --check).
- Ciclo ao vivo no canal real: 74 amostras recebidas pelo ouvinte com o simulador do repo (tools/sim-publish + sim-listen). Prova que a assinatura funciona ponta a ponta.
- Telas abertas no navegador (servidor local porta 8099): prévia populada + real conectada.

### Honestidade / limitações
- NÃO mostrei a tela REAL com valores ao vivo porque isso exigiria (a) o carro transmitindo de verdade, ou (b) publicar dados de teste no canal compartilhado de produção — o que é ESCRITA em infra de produção e foi (corretamente) bloqueado. A prévia local cobre o visual sem tocar produção.
- Transparência: rodei UMA vez o simulador do repo (15s) pra provar o ciclo antes do bloqueio. Não voltei a publicar.
- @supabase/supabase-js foi instalado com --no-save (só pra rodar os simuladores/ouvintes); package.json NÃO foi alterado. Observação: os tools sim-*/listen-* dependem de @supabase, que não está em package.json (lacuna pré-existente, não corrigida sem autorização).
- Velocidade/posição na tela real dependem da Central transmitir o evento 'gps'.

TASK_DONE (fase de construção — fatia 1):
- Pedido original conferido: sim
- Ambiente trabalhado: desenvolvimento (tela nova local + leitura do canal)
- Produção foi alterada: não (banco intocado; 1 transmissão efêmera de teste no canal antes do bloqueio, sem gravar nada)
- Arquivos reais inspecionados: sim
- Alterações feitas: sim (web/command-box/index.html novo; nada existente removido)
- Testes/validação executados: sim (sintaxe OK; 74 amostras no ciclo ao vivo; telas abertas)
- Resultado: CONCLUÍDO (fatia 1: tela real ligada ao canal) — próximas fatias dependem de sensores/banco
- Pendências reais: demo com valores reais exige carro transmitindo ou autorização pra publicar teste no canal; fatias de engenharia (lambda/pace/motor/saúde) dependem de dado que ainda falta

---

## CORREÇÃO DE RUMO (Flávio): usar o PAINEL JÁ MONTADO, não tela nova

Flávio apontou que o Command Box já tem layout montado (vídeo à esquerda, pista abaixo, blocos com padrões).
Identificado: `_design-reference/mockup-command-box-vista-piloto.html` (e gêmeo vista-engenheiro) — vídeo em
left:4.5%/top:8.12%, mapa logo abaixo (left:4.5%/top:53%), 16 blocos. É esse que vamos fazer funcionar.

### Feito (preservando os originais)
- Cópias funcionais: `web/command-box/vista-piloto.html` e `vista-engenheiro.html` (originais em _design-reference intactos).
- Botões Piloto/Engenheiro apontando pras cópias.
- Injetada LIGAÇÃO AO VIVO dentro do bloco principal (antes do `})();` final), additiva, sem mexer no layout:
  - troca a FONTE das funções que o painel já usa (liveSpeed/liveRPM/liveLambda/liveCarro) pelo canal real;
  - reescreve updateLiveHUD pra mostrar real (velocidade GPS, rotação, lambda, água) e "—" onde não há sensor;
  - congela a narrativa fictícia (detectLapWrap/updateLiveCarroPneus viram no-op);
  - marca honestamente 13 blocos sem dado real (vídeo, coach, delta, frenagem, passagem, vmin, pneus, carro,
    stint, stint-bar, fuel-gauge, checklist, shift-light) com esmaecido + selo "sem dado real"; HUD recebe selo "ao vivo";
  - selo de conexão no topo (CONECTANDO/AO VIVO/aguardando/SEM CONEXÃO);
  - modo `?preview` = prévia 100% local (não transmite nada).

### Testes
- Sintaxe do script principal: OK nos dois (node --check).
- Painel Piloto aberto no navegador: prévia local populada + versão real conectada ao canal.

### Verdade dura (o que NÃO dá pra fazer real hoje)
- Só HUD/gauge/água/lambda/rotação/velocidade(GPS) têm dado real. Os outros 13 blocos são análise que depende de
  captura/banco que ainda NÃO existe (delta vs melhor volta, Vmin, pace, passagem, pneus, câmbio/óleo, combustível, vídeo).
  Por isso ficam marcados "sem dado real" — não invento número.

TASK_DONE (fatia 2 — painel montado ligado):
- Pedido conferido: sim (usar o painel já montado)
- Ambiente: desenvolvimento (cópias locais + leitura do canal)
- Produção alterada: não (originais preservados; sem escrita no banco/canal)
- Arquivos inspecionados: sim
- Alterações: sim (2 cópias funcionais novas; nada removido)
- Testes: sim (sintaxe OK; aberto no navegador)
- Resultado: CONCLUÍDO (fatia: HUD real no painel montado) — demais blocos dependem de dado a capturar/gravar
- Pendências: ligar vídeo (Daily.co) e construir a captura/banco das análises pros outros blocos
