# CONTINUAR — Mensagens do cockpit (Fase 1 feita, Fase 2 NO AR na linha ativa)
# Gatilho de retomada: "RETOMAR FASE 2" ou "voltei". Atualizado 2026-07-05 (18h).

## ★★★ PONTO DE RETOMADA (05/07 18h — Flávio saiu, "dar um clique e voltar") ★★★
- **Fase 2 AUTORIZADA e INCORPORADA na produção do cockpit** (linha ativa `sync/notebook-dia-de-pista-2026-06-23`, topo `2a9788c8`), COMPLETA (mensagens + IA temperatura + memória + ajuste por carro, com a leitura da nuvem). Frase literal do Flávio dada. Backups: `backup/sync-pre-fase2-2026-07-05` (c28a532b) e `backup/sync-fase2-incompleta-2026-07-05` (04bc72aa).
- **SOFTWARE NO AR — CONFIRMADO pelo notebook 18h45** (canal 20260705T184500Z): linha ativa `2a9788c8`, `.exe` x64 montado e verde (domínio 411/411, WinUI 0/0), leitura da nuvem presente, ajuste por carro funciona. Item 5 do PLANO marcado 🟢 (código no ar).
- **FALTA SÓ (do Flávio, no próximo dia de pista):** validação DE CAMPO — motor ligado + `IR-AO-VIVO-PRODUCAO.cmd` na tela 10,5". O notebook NÃO rodou o launcher de produção (é a ação que vai ao vivo no carro; fica pro Flávio). Não trava.
- **Pendência futura (não trava):** calibrar números do Bubi (ref 62/+3/base 30/fator 0,5) com dado real de pista.
- Nada de banco/Vercel/`cockpit-bubi-live`/`main` foi tocado. Desfazer = reset da linha ativa pra um dos backups + recompilar.
## ★★★ fim do ponto de retomada ★★★


## >>> ATUALIZAÇÃO 2026-07-05 TARDE — Fase 2 INTEGRADA + tela Garagem (item 4) começada <<<
- **Fase 2 INTEGRADA no .exe pelo notebook** (commit `53e249dc`): pegou a linha `claude/fase2-ia-temperatura` (com meu item 3), rebaseou por cima a PERSISTÊNCIA em disco por carro (`~/p1fast-sessoes/aprendizado-<carroId>.json`, só no `--live`), novo `MainWindow.Aprendizado.cs`. Domínio 401/401 (no notebook, .NET 8 nativo), WinUI x64 0 erro. Prova determinística: água 68°C/30s (< 70 fixo) → "Temperatura Motor Subindo" disparou por passar o normal do carro +3, saiu ao normalizar. Persistência sobreviveu entre maestros.
- **Item 3 (água pré-ignição):** o notebook perguntou o gancho; RESPONDI (canal 20260705T153403Z): NÃO precisa gancho novo — meu `Avaliar(tempC, motorRodando, t)` já capta a água fria com rpm<500 e congela o offset na 1ª ignição. Único requisito: alimentar `IngestMotor` desde que o T4000 conecta, com o carro desligado, antes da ignição. Seguro (sem água fria → offset 0).
- **Item 4 (tela Garagem) — decisões do Flávio no painel `20260705-120925-garagem-limites-alerta`:** 1=dentro do "Setup do Carro" · 2=**TODOS os limites** (pneu, motor, bateria, mistura) · 3=agora. **ETAPA 1 FEITA** (branch `claude/fase2-ia-temperatura`): 10 campos em `CarroSetupOverrides.swift` (snake_case, mesmo `configuracoes.overrides` que sincroniza celular↔nuvem) + 6º grupo "Alertas" em `SetupAvancadoView.swift`. Prova: app iOS compila (xcodebuild BUILD SUCCEEDED do zero) + modelo 8/8 no smoke (round-trip, compat com carro antigo). Xcode 26.4 ESTÁ neste iMac.
- **Achado de calibração (notebook, não é bug):** confiança só cresce com rpm≥500; carro imaturo adapta rápido. Reforça o §5: calibrar ref 62/+3/base 30/fator 0,5 com dado real do Bubi.
- **ETAPA 3 — LADO DO CÉREBRO FEITO 05/07 tarde** (commit 47eff256, na linha `claude/fase2-ia-temperatura` já com a persistência 53e249dc do notebook por rebase): NOVO `LimitesDoCarro.De(overridesJson)` converte o `configuracoes.overrides` do carro (chaves `alerta_*`) em `(AlertaLimites, AprendizadoLimites)` — chave ausente/JSON inválido = default (best-effort). `CockpitOrchestrator` ganhou params opcionais `alertaLimites`/`aprendizadoLimites` (null = intacto) e repassa ao `AlertasCriticos`. Prova: **411/411** (LDC_01..10, inclui fiação ponta-a-ponta via MotorMaximaNormalC). Avisei o notebook (canal 20260705T155457Z).
- **ETAPA 3 FECHADA DOS DOIS LADOS 05/07 (commit notebook a683e1cb):** o `.exe` lê `configuracoes.overrides` do carro da nuvem (REST, best-effort 5s) e alimenta o maestro via `LimitesDoCarro.De`. Prova: override motor quente 72 → água 72°C dispara "Motor Quente" (limite do carro manda, não o 70 fixo). WinUI x64 0/0, 411/411. **Item 4 (ajuste pelo celular) agora TEM EFEITO real.**
- **AJUSTE que pedi ao notebook (canal 20260705T161354Z):** ele lia a config por `data_aplicacao desc`; o app grava/lê a "Setup base" = a MAIS ANTIGA (`created_at asc`). Pedi alinhar pra `created_at.asc&limit=1` (senão, com múltiplas configs, lê linha diferente da editada). Refino, não quebra.
- **FALTA:** (a) o app GRAVAR de fato pelo celular (uso normal — a alça fecha no campo); (b) mostrar a tela "Alertas" rodando no simulador iOS (adiado); (c) calibrar números do Bubi com dado real; (d) **decisão de PRODUÇÃO do Flávio** (ele pediu "mandar pro ar" 05/07 — aguardando a frase literal `MIGRAR PARA PRODUÇÃO: ...`). ETAPA 2 (sincronização) coberta pelo overrides.
## >>> fim da atualização tarde <<<


## >>> ATUALIZAÇÃO 2026-07-05 (sessão iMac) — FASE 2 FOI IMPLEMENTADA <<<
Flávio autorizou implementar direto ("vai até o fim e implementa tudo, no final audita e corrige"),
em vez de esperar o painel de decisões. Segui as RECOMENDAÇÕES do painel + o prompt. Estado atual:
- FASE 2 (IA de padrão de temperatura do MOTOR) = IMPLEMENTADA em DEV, testada, sem produção.
- Branch `claude/fase2-ia-temperatura`. Doc completo: `docs/FASE2_IA_TEMPERATURA.md`. Estado: `.claude-exec/ultima-tarefa.md`.
- Prova: dotnet test domínio 396/396 (com DOTNET_ROLL_FORWARD=Major) + JS alertas 25/25.
- DIVERGÊNCIA do painel a confirmar com Flávio: P1 recomendava "3 voltas"; o PROMPT manda "contínuo, sem número
  fixo de voltas" — segui o prompt (aprendizado contínuo, com semente de referência). Ver §5 do doc.
- O painel `.claude-perguntas/pendentes/20260705-103020-fase2-ia-temperatura.html` fica como registro; as
  decisões dele já entraram na implementação (defaults = as recomendações). Confirmar se estão do agrado.
## >>> fim da atualização <<<


## ONDE ESTAMOS
- FASE 1 (simplificação das 24 mensagens do cockpit do piloto) = **CONCLUÍDA** pelo notebook.
  - 6 commits na branch sync/notebook-dia-de-pista-2026-06-23: d5493671 textos · 6afcdbe0 números · d4d59d0b -3 alertas · 9e6c2d06 -coach · 3ea8ad99 histerese · 39f03cd4 caixa (+45ee926e água, c28a532b §2 RaceBox).
  - Placar: 16 alertas + 8 coach = 24. Suite 377/377 verde, WinUI compila. Zero produção.
  - Spec canônica: canal claude-comms -> specs/SPEC_MENSAGENS_COCKPIT_PILOTO_v2.md
  - Regra de caixa: Title Case (exceto ligação de/da/do), IDs/chaves seguem CAIXA ALTA, sigla GPS mantida.

- FASE 2 (a parte inteligente = IA de padrão) = **DECIDIDA pelo Flávio 2026-07-05** (resposta salva: `~/Downloads/resposta-perguntar-fase-2-*.txt (1)`; registrada em `~/.claude-decisoes/perguntar-historico.jsonl`).
  - DECISÕES TRAVADAS (5):
    1. Aprendizado = **C: contínuo, nunca trava** (NÃO "3 voltas"). → JÁ implementado assim (AprendizadoTemperatura.cs L7-8,52,88). CONFERE com o código.
    2. Gatilho "Temperatura Motor Subindo" = **+3°C acima da máxima normal** (DeltaSubindoC=3). JÁ implementado. (Flávio devolveu dúvida só sobre a mecânica do painel — respondida: escolher outra letra não é erro, é decidir diferente da recomendação.)
    3. Ambiente (sem sensor) = **A: usar a água ANTES de ligar** como referência do dia. STATUS **✅ FEITO 05/07** (commit e22ea53b): aprendiz mede a menor água com motor desligado e congela offset de ambiente na 1ª ignição (dia frio avisa mais cedo, quente mais tarde, sempre abaixo do Motor Quente; água morna de religada ignorada). Configurável. 401/401 (ATP_13..17).
    4. Pneu Quente = **A: 2 níveis por tipo** (radial185 95/105 · slick195 105/115). Config preparada (AprendizadoLimites); espera sensor. **PEDIDO NOVO do Flávio:** esses limites têm que ser EDITÁVEIS no APP (aba "Garagem", celular). → pendência de produto (app), abaixo.
    5. Óleo = **A: fora do aprendizado** (sem sensor de temperatura; só o aviso de pressão). JÁ está fora (saiu na Fase 1). CONFERE.
  - Próximo: (a) ligar item 3 em DEV; (b) ✅ FEITO 05/07 14:38 — decisões+código EMPACOTADOS pro notebook: linha `claude/fase2-ia-temperatura` enviada pro origin + recado no canal `claude-comms` (mensagens/20260705T143854Z-de-imac-para-notebook.md). Notebook deve baixar, compilar WinUI, validar visual e mandar screenshots; (c) tela "Garagem" p/ editar limites no app celular (pendência de produto).

## ACHADOS DA VERIFICAÇÃO (confirmados no código real AmostraAlerta)
- Carro NÃO mede temperatura de ÓLEO (só o BIT de baixa pressão). "Óleo Quente" foi tirado na Fase 1. -> P5 do painel.
- Carro NÃO tem sensor de temperatura do AMBIENTE. -> P3 do painel (definir a fonte).
- Sensores de PNEU (temp+pressão) e CÂMBIO (temp) ainda não instalados no carro.

## PENDÊNCIAS
- ✅ **[Fase 2 · item 3] FEITO 05/07** — água pré-ignição como referência de ambiente (commit e22ea53b, 401/401). Falta só o notebook validar visual no .exe.
- **[Fase 2 · item 4] Tela "Garagem" no app celular** p/ o Flávio editar os limites de pneu (e demais parâmetros da IA). A base já é toda configurável no código; falta a TELA. Pedido explícito do Flávio 2026-07-05.
- Marcha lenta REAL do Bubi (limiar de partida do óleo; 500 rpm hoje) — confirmar com Flávio.
- Screenshots do notebook das mensagens novas (pedidos, ainda não vieram) — mostrar ao Flávio quando chegarem.
- Banco de TESTE próprio pro P1 Fast (não existe; só produção fvhwltzhytpnhlqbttmd) — decisão do Flávio, em aberto.
- Branch de trabalho da Fase 2: claude/fase2-ia-temperatura (auto-save ativo).

## CANAL notebook<->imac
- Worktree: ~/Projetos/p1fast-worktrees/comms; ajudante p1-comms.sh; branch claude-comms.
- Religar vigia: cd nesse worktree e rodar ./vigia-canal.sh em background monitorado.
- REGRA: nas mensagens do canal usar "você", NUNCA "tu/te/teu" (§9.2 PLANO_FASE_1). Eu falhei nisso antes; corrigir daqui pra frente.
