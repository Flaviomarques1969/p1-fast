# Relatório noturno auditoria — 2026-05-26

> Gerado pelo agente noturno autônomo em 2026-05-27 às 02:30 (horário de Brasília).
> Fonte principal: `docs/AUDITORIA_REAL_2026-05-26.md` + estado atual do repositório.

---

## Resumo executivo

**O que foi feito autonomamente:**
- 0 submissões encerradas (nenhuma estava em estado anômalo — mergeada mas ainda aberta)
- 0 linhas de trabalho separadas remotas candidatas a descarte (o repositório remoto só tem `origin/main` — as 159 branches antigas foram purgadas em sessões anteriores)
- 3 arquivos sinalizados como obsoletos com marcador `TODO`
- 1 relatório criado (este documento)

**Descoberta importante:** As submissões #201 e #205 (citadas na auditoria como paradas há 13 dias) já foram encerradas por sessão anterior da madrugada de 27/05. Seu conteúdo útil foi preservado na submissão #218, que está aberta aguardando revisão.

**Alerta de fluxo de trabalho:** O repositório acumulou 13 commits "auto-save" diretamente na linha oficial (`main`) durante a sessão de 26/05. Isso desvia do fluxo mandatório (ADR-021: worktree + linha de trabalho separada + submissão). Ver Carta 9.

---

## Decisões pendentes pra Flávio decidir

### Carta 1 — Submissão #218 (auditoria Command Box — nova, aberta)

- **Contexto:** Criada na madrugada de 27/05 pela sessão anterior. Contém 3 commits: (1) promoção do Vista Piloto v04 ao caminho oficial `_design-reference/mockup-command-box-vista-piloto.html`; (2) bloco "PARADA NO BOX" recortado cirurgicamente do #205; (3) 4 arquivos novos do #205 preservados em `_design-reference/_propostas-pr205/`.
- **Pergunta:** Você quer incorporar essa submissão à versão oficial?
- **Opções com recomendação:**
  1. ✅ **RECOMENDADO — Incorporar agora:** diga "incorporar #218". Baixo risco — não sobrescreve nada existente, só adiciona. O Vista Piloto v04 aprovado por você em 15/05 passa a existir no caminho canônico onde toda sessão futura vai procurar.
  2. Revisar primeiro: abrir `_design-reference/mockup-command-box-vista-piloto.html` no navegador da submissão e confirmar que é exatamente o v04 antes de incorporar.
  3. Rejeitar e manter o status quo: o Vista Piloto v04 continua órfão em `docs/auditorias/base_unica_vista_piloto/`, fora do caminho canônico.
- **Por quê importa:** Sem incorporar, qualquer sessão futura que criar um arquivo `mockup-command-box-vista-piloto.html` pode criar uma versão pior sem saber que a v04 existe.
- **Impacto se adiar:** Risco de o trabalho de 2026-05-15 (polimento intenso em 14 rodadas) ser perdido ou substituído por versão inferior.

---

### Carta 2 — Submissão #193 (Rodada 1 de ajustes — 24 mudanças, 14+ dias parada)

- **Contexto:** PR grande com 24 mudanças visuais combinadas entre 2026-05-12 e 2026-05-13: tela inicial com saudação, card do carro com foto, autódromos agrupados por cidade, evento passado com Stint Bar, detalhe de volta com vídeo, evento futuro com inventário de pneus. Testes automáticos: 499 OK. Build iOS verde. Também inclui 6 migrações de banco aguardando autorização explícita pro ambiente de produção (0020..0025).
- **Pergunta:** Você quer incorporar essas 24 mudanças visuais à versão oficial? E autorizar a aplicação das migrações de banco no ambiente de produção?
- **Opções com recomendação:**
  1. ✅ **RECOMENDADO — Incorporar código + autorizar migrações:** diga "incorporar #193 e autorizar migrações 0020-0025". É a maior entrega visual do iOS que está parada — 24 melhorias que você já validou.
  2. Incorporar código, adiar migrações: código entra na versão oficial, banco fica como está. Funciona se as telas novas tolerarem ausência das colunas (podem mostrar valores vazios/nulos).
  3. Adiar tudo: risco de conflito crescente com o trabalho que continua sendo feito.
- **Por quê importa:** 14 dias de espera. Quanto mais tempo passa, maior a chance de conflito com código novo.
- **Impacto se adiar:** As 24 melhorias visuais do app iOS que você aprovou continuam fora da versão que vai pro iPhone.

---

### Carta 3 — Submissão #203 (regularização estrutural + ADR-025)

- **Contexto:** Criada em 2026-05-13. Contém regularização de estrutura de pastas pós-auditoria e a ADR-025 promovida de proposta a decisão fechada. Testes automáticos (`node-smoke`) esperados verdes.
- **Pergunta:** Você quer incorporar essa regularização estrutural?
- **Opções com recomendação:**
  1. ✅ **RECOMENDADO — Incorporar:** diga "incorporar #203". Trabalho de limpeza que mantém o repositório organizado conforme auditoria de 2026-05-12.
  2. Adiar: a ADR-025 fica como proposta em vez de decisão fechada no repositório oficial.
- **Por quê importa:** A ADR-025 foi aprovada por você em 2026-05-12 mas só existe na linha de trabalho separada, não na versão oficial.
- **Impacto se adiar:** Inconsistência entre o que foi decidido e o que está documentado na versão oficial.

---

### Carta 4 — Submissão #202 (F4 triagem de vídeo — 5 fases)

- **Contexto:** Criada em 2026-05-13. Entrega 5 das 6 fases da F4: checklist operacional da gravação, indexador de voltas, tela de triagem, bloqueio do próximo stint até triar, permissão por papel. A fase F4.2 (tabela `volta_video`) já está na versão oficial via #190.
- **Pergunta:** Você quer incorporar as 5 fases restantes da triagem de vídeo?
- **Opções com recomendação:**
  1. ✅ **RECOMENDADO — Incorporar:** diga "incorporar #202". Completa a F4 que ficou incompleta em #190. Dependência do player de vídeo (webhook Daily.co com URL da gravação) ainda está pendente, mas a estrutura entra agora.
  2. Adiar até o player de vídeo estar pronto: posterga mais ainda; a tela de triagem pode ser testada mesmo sem o player funcionando.
- **Por quê importa:** Sem a tela de triagem, o piloto não tem como revisar as voltas gravadas após o stint.
- **Impacto se adiar:** A funcionalidade de vídeo fica incompleta no app mesmo quando o webhook Daily.co estiver pronto.

---

### Carta 5 — Submissão #166 (rotação 180° — CI vermelha há 17 dias)

- **Contexto:** Criada em 2026-05-10. Implementa a rotação 180° como função do app (Ctrl+R, persistida por display). CI `ui-build` (windows-latest) vermelha — 3 tentativas falharam por erro de compilador XAML que não foi diagnosticado.
- **Pergunta:** O que fazer com a rotação 180°?
- **Opções com recomendação:**
  1. **Diagnosticar e corrigir:** numa sessão com Claude Code, abrir a submissão e pedir diagnóstico do erro de compilação XAML. Estimativa: 30-60 minutos.
  2. **Encerrar e implementar via Windows Display Settings (fallback):** a ADR-023 amendment 5 documentou essa alternativa. Funcionaria, mas perde a persistência automática por display que o app traria.
  3. ✅ **RECOMENDADO — Encerrar a linha de trabalho, implementar em sessão nova:** fecha a submissão antiga com CI quebrada e abre nova linha de trabalho partindo do main atual (que avançou muito desde maio/10). Evita acumular dívida técnica.
- **Por quê importa:** A submissão está emperrada há 17 dias. A tela do piloto está invertida sem essa funcionalidade.
- **Impacto se adiar:** Cockpit Windows fica sem rotação automática controlada pelo software.

---

### Carta 6 — Submissão #97 (docs STATUS 2026-05-05 — 22 dias parada)

- **Contexto:** Criada em 2026-05-05. Contém atualização do `STATUS.md` e o arquivo `docs/FIX_BACKLOG_MS_2_1_2_2.md` com auto-review de bugs. O STATUS.md na versão oficial foi atualizado várias vezes desde então (sessões de 2026-05-06, 2026-05-09, 2026-05-10, 2026-05-13, 2026-05-26). O conteúdo desta submissão está completamente supersedido.
- **Pergunta:** Encerrar essa submissão sem incorporar?
- **Opções com recomendação:**
  1. ✅ **RECOMENDADO — Encerrar sem incorporar:** o STATUS.md desta submissão está 22 dias desatualizado. Incorporar criaria conflito com a versão atual. O `FIX_BACKLOG_MS_2_1_2_2.md` tinha valor em maio/05 mas os fixes foram aplicados em PRs subsequentes (#95, #98).
  2. Manter aberta: sem utilidade prática, só acumula desordem.
- **Por quê importa:** Clareza na lista de submissões abertas.
- **Impacto se adiar:** Uma submissão que não tem mais valor continua poluindo o painel.

---

### Carta 7 — Submissão #94 (P1 Coach Vision — doc de visão arquivada)

- **Contexto:** Criada em 2026-05-05. Contém `docs/P1_COACH_VISION.md` — spec massivo da visão de produto do Coach (vocabulário, regras, hierarquia de decisão). Foi arquivado como "visão de produto" aguardando pré-requisitos. Os pré-requisitos (MS-2, campo real) agora estão parcialmente cumpridos.
- **Pergunta:** Incorporar o doc de visão ou encerrar a submissão?
- **Opções com recomendação:**
  1. ✅ **RECOMENDADO — Incorporar:** o doc tem valor histórico e de produto; não atrapalha o código. Diga "incorporar #94".
  2. Encerrar sem incorporar: o conteúdo vai se perder (fica só na linha de trabalho separada).
- **Por quê importa:** O Coach é um pilar futuro do produto. A visão documentada vai economizar tempo quando for implementar.
- **Impacto se adiar:** Visão de produto fica fora da versão oficial por tempo indeterminado.

---

### Carta 8 — Submissão #51 (ícone do app — 24 dias parada)

- **Contexto:** Criada em 2026-05-03. Contém 18 PNGs do ícone do app iOS gerados via Real-ESRGAN a partir do master 3120×3120. A submissão requer validação visual no Xcode (confirmar que o ícone aparece correto no Springboard + Spotlight).
- **Pergunta:** Incorporar o ícone melhorado ou encerrar?
- **Opções com recomendação:**
  1. ✅ **RECOMENDADO — Incorporar:** só muda os PNGs do ícone, zero risco de regressão no código. Diga "incorporar #51".
  2. Validar no Xcode primeiro: abre o `.xcodeproj` e confirma visualmente (5 minutos seus com Xcode aberto).
  3. Encerrar e fazer novo ícone quando o app for pra App Store.
- **Por quê importa:** O ícone atual cobre 74% do slot iOS; o novo cobre 100%.
- **Impacto se adiar:** Ícone menor continua no app do seu iPhone.

---

### Carta 9 — Commits "auto-save" diretos no main (alerta de fluxo de trabalho)

- **Contexto:** A sessão de 26/05 acumulou 13 commits com mensagem "auto-save: HH:MM:SS" diretamente na linha oficial (`main`), entre os commits de feature com PR. Isso é um desvio do fluxo mandatório definido no ADR-021 (worktree obrigatório + linha de trabalho separada + submissão formal).
- **Pergunta:** Como você quer lidar com os auto-saves diretos no main?
- **Opções com recomendação:**
  1. **Aceitar como está:** os auto-saves já estão no main; limpar o histórico exigiria `git rebase -i` com `reword`/`fixup`, o que reescreveria história pública — risco real de perda de trabalho.
  2. ✅ **RECOMENDADO — Aceitar + estabelecer regra:** não reverter o que já está, mas decidir explicitamente se o Claude Code na web pode ou não trabalhar diretamente no main. Se não pode, configurar proteção de branch no GitHub (branch protection rules) pra bloquear push direto no main.
  3. **Limpar histórico:** tecnicamente possível via `git rebase -i` mas arriscado e disruptivo pra qualquer clone existente.
- **Por quê importa:** O ADR-021 existe pra evitar exatamente isso — código experimental entrando direto na versão oficial sem revisão. Com auto-saves no main, qualquer trabalho em progresso fica imediatamente "publicado".
- **Impacto se adiar:** O padrão pode se repetir em sessões futuras, tornando o histórico do main difícil de ler e a auditoria mais trabalhosa.

---

### Carta 10 — Envio do iPhone pra nuvem (banco incompatível)

- **Contexto:** Citado na auditoria de 26/05 como bloqueio crítico. Schema do banco da nuvem estava atrás do app: `eventos.data_fim` NOT NULL, `evento_pendencias.template_id` UUID vs TEXT, faltavam colunas `quantidade` + `nota`. A migration 0024 foi aplicada em 26/05 (commit `b47b12c`), desbloqueando 74 dead-letters. Fix de idempotência (#217) desbloqueou mais 149. Total do canal ainda a verificar.
- **Pergunta:** O envio do iPhone pra nuvem está funcionando agora, ou ainda há dead-letters acumulados?
- **Opções:**
  1. ✅ **RECOMENDADO — Verificar no painel Supabase:** checar a tabela `dead_letter_queue` (ou equivalente) pra ver se ainda há filas paradas. Se houver, investigar o schema ainda incompatível.
  2. Testar com o iPhone ao vivo: registrar um stint curto e verificar se os dados aparecem no painel da nuvem.
- **Por quê importa:** Sem o iPhone enviando para a nuvem, os dados de força G, GPS e voltas não chegam ao Command Box nem à análise.
- **Impacto se adiar:** Sessões de pista continuam sem dados no painel central.

---

## Linhas de trabalho separadas candidatas a descarte

**Nenhuma.** O repositório remoto tem apenas `origin/main` como referência rastreável. As 159 linhas mencionadas na auditoria de 26/05 não aparecem mais no remoto (`git branch -r` retorna só `origin/main`). Podem ter sido purgadas por sessões anteriores ou nunca foram publicadas.

**Observação:** As linhas de trabalho das submissões abertas (#218, #203, #202, #193, #166, #97, #94, #51) têm seus commits preservados no GitHub via as próprias submissões, mesmo sem aparecer como branches rastreáveis aqui.

---

## Pendências fora do escopo do agente noturno

Os itens abaixo dependem de acesso ao iMac local, iPhone, ou memória de sessões anteriores e **não podem ser verificados neste ambiente remoto**:

1. **Memórias do Claude** (`~/.claude/projects/*/memory/`) — o agente noturno não tem acesso. As memórias `regra-dura-incorporar-versoes-finais`, `p1-fast-envio-nuvem-investigacao-2026-05-25`, `project_p1fast_cockpit_piloto_decisoes_2026-05-26` e outras estão inacessíveis daqui. Uma sessão local deve ler e comparar com este relatório.

2. **15 ambientes isolados locais** (`.claude/worktrees/`) — só visíveis no iMac local. Podem conter trabalho não publicado.

3. **Validação visual do painel T3000** — requer Chrome/Edge com a página `p1t4000.vercel.app` aberta e a T3000 plugada no notebook. Não verificável remotamente.

4. **Estado real do canal de envio iPhone→nuvem** — requer iPhone ligado + sessão de Supabase pra ver dead-letter queue ao vivo.

5. **Build iOS** (`swift run p1fast-smoke`) — requer macOS com Swift toolchain. Não disponível no ambiente remoto.

6. **PR #166 (rotação 180°)** — diagnóstico do erro de compilação XAML requer `/ultrareview 166` rodado da sessão local do Mac (citado em STATUS.md), não disponível aqui.

---

## Linha do tempo do dia 26/05 (síntese para contexto)

| Hora | O que aconteceu |
|---|---|
| Madrugada | Auditoria honesta gerada (PR #215 incorporado) |
| Manhã | Decodificador T3000 v2 via engenharia reversa (PR #214) |
| Tarde | Painel ao vivo WebUSB (#213) → ponte Supabase Realtime (#216) |
| 16:35 | Fix navegação menu inferior (#204 incorporado) |
| 16:20 | Migration 0024 para iPhone (schema iPhone-compatível) |
| 18:55 | Fix idempotência sync (#217 incorporado) — destrava 149 dead-letters |
| 19:00–22:17 | Sessão noturna: shift light, 8 alarmes críticos, widgets cockpit, CockpitGpsPublisher.swift — commits diretos no main |
| 01:18 (27/05) | Sessão autônoma fecha #201 e #205, abre #218 com curadoria |
