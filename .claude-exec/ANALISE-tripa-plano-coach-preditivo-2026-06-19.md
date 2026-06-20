# TASK_INIT — Análise da tripa Plano · Stint · P1 Coach · Alerta Preditivo

> Arquivo dedicado a esta tarefa. O `ultima-tarefa.md` (69KB, log ativo) foi PRESERVADO, não sobrescrito.

1. **Pedido original de Flávio:** "essa tripa aí que eu peguei, que é Plano, Stint, P1 Coach — faça análise detalhada e monte um plano de trabalho." Quer saber, dessa coluna do Command Box (vista piloto), o que já está funcionando de verdade com base nos dados reais coletados na nuvem, quais análises estão sendo feitas, e um plano de trabalho.
2. **Objetivo em 1 frase:** Mapear, bloco a bloco dessa coluna, o que é dado REAL (vindo do `cockpit-bubi-live`/coletado) vs número de demonstração ("aguardando ligação"), explicar a análise por trás de cada um, e entregar um plano de trabalho priorizado.
3. **Critérios de conclusão:** (a) cada sub-bloco classificado REAL/PARCIAL/DEMONSTRAÇÃO com prova; (b) a análise de cada um descrita; (c) o que falta listado; (d) plano priorizado, linguagem de gestor.
4. **Leitura confirmada:** CLAUDE.md, padroes.md, EXECUTION_PROTOCOL, ENVIRONMENT_RULES (sim); memória P1 Fast (sim).
5. **Plano:** (1) inspecionar mockup+módulos; (2) classificar; (3) descrever análise; (4) listar o que falta; (5) plano de trabalho.
6. **Áreas:** mockup-command-box-vista-piloto.html, módulos JS, docs/ARQUITETURA_DEFINITIVA.md, worktree plano-stint-banco-v1.
7. **Ambiente:** desenvolvimento. 8. Produção protegida: sim. 9. Autorização produção: não. 10. Evidência: não recebida (análise leitura). 11. Riscos: baixo. 12. Status: iniciado.

---

## RESULTADO (verificado por código + verificação adversarial — 16 agentes)

**Veredito-mãe:** a tripa inteira (Plano·Stint, P1 Coach, Alerta Preditivo) estava em **DEMONSTRAÇÃO**. Código marcava `coach/stint/stint-bar` em `DEP_LIGACAO` (mockup linha 7790) = "aguardando ligação". Só o HUD (velocidade, temp água) era real ao vivo; frenagem/passagem/vmin reais mas de volta GRAVADA.

Por bloco: VOLTA/META/RITMO, P1 COACH (frase/lição/pontuação/análise), ALERTA PREDITIVO — todos hardcoded/`FAKE_LAPS`. Engine preditivo real existe (padrao-acumulador) mas não ligado e não calcula os números. Arquitetura definitiva 16/06: cálculo mora no app na nuvem; lacuna de construção reconhecida.

---

## TASK_DONE (fase análise)
- Pedido conferido: sim · Ambiente: desenvolvimento · Produção alterada: não · Arquivos inspecionados: sim · Resultado: concluído (análise + plano).

---

## EXECUÇÃO — Flávio "completo e do jeito certo e definitivo" (19/06)

Rumo: construir o **cérebro do painel na nuvem** (arquitetura 16/06), reusando miolos existentes, provado offline, sem tocar produção. Só existe nuvem de PRODUÇÃO → NÃO publicar no canal cockpit-bubi-live em teste (memória 18/06); validar OFFLINE.

**Ambiente isolado inicial:** worktree `cerebro-nuvem-tripa`. **Correção 19/06:** abri no 8079 e o Flávio viu desconfigurado — layout salvo mora no localStorage do 8078. Conteúdo idêntico, oficial intocada. Conserto: levei tudo pra OFICIAL (8078), validado por Flávio ("está certa agora"). A partir daí trabalho na OFICIAL, com backup, **sem mexer no formato** (ordem dura).

**Ondas (todas FEITAS e provadas, EXIT=0):**
- **1 — Voltas/Ritmo:** `cerebro-painel.js`. STINT 8/12 67%; RITMO "à frente -0.06/volta" PB 1:31.95 stint 1:31.89.
- **2 — Na tela:** bloco Plano·Stint sai do "aguardando ligação"; só preenche campos.
- **3 — Coach:** `cerebro-coach.js` reusa `src/domain/trecho-advisor.js` sobre passagens reais. "carregue mais no apex na 2"; análise "CURVA DA RETA OPOSTA: Vmin 9.4 km/h abaixo da melhor". Demo desligada por `window.__coachRealMode`.
- **4 — Meta do piloto:** sub 1:32 em 8 voltas (default ajustável). Real = 1/8.
- **5 — Alerta preditivo:** `cerebro-preditivo.js` (taxa °C/volta + desvio + ETA). Cérebro pronto e provado; na tela fica "aguardando" (não há temperatura gravada; acende ao vivo).
- **+ Velocímetro:** `cerebro-velocidade.js` (velocidade do GPS da volta gravada, máx 166 km/h; selo "volta gravada").
- **+ AO VIVO-PRIMEIRO (Flávio "quero que seja real"):** `cerebro-vivo.js` (orquestrador: feedSample/feedVolta→PainelPronto; tira o TEMPO da volta do cronômetro porque o carro transmite só o NÚMERO). Ouvinte ao vivo no mockup (SÓ OUVE cockpit-bubi-live); com carro mostra ao vivo e pausa o gravado; sem carro, gravado de referência. Provado simulando o canal (EXIT=0).

Backups oficiais: `_backup-pre-cerebro-stint-2026-06-19.html`, `_backup-pre-cerebro-coach-2026-06-19.html`.

**Pendências da tripa:** regra de pontuação da volta (decisão Flávio) p/ NOTA 0-100 e % lição; preditivo só acende ao vivo; quilometragem demo; DEFINITIVO = cérebro rodar na nuvem (hoje no navegador).

---
---

# TASK_INIT — Checklist de Pista: função nova no app + Command Box

## Pedido (Flávio 19/06, aprovado "sim")
Criar função NOVA no app: **Checklist de Pista** (≠ Pendências). Lista padrão de checagens de **SAÍDA** (antes de entrar na pista) e **CHEGADA** (depois que volta). Editável: adicionar / desativar item. Pessoas ticam: **Piloto, Chefe de equipe, Engenheiro, Mecânico**. Essa lista alimenta o componente do **Command Box** (só pendentes, obrigatório em cima).

## Decisões aprovadas (desenho `_design-reference/checklist-pista-DESIGN-2026-06-19.html`)
- 4 papéis: Piloto, Chefe de equipe, Engenheiro, Mecânico.
- Qualquer pessoa da equipe pode ticar (responsável = referência).
- Lista padrão proposta aprovada (11 itens saída + 8 chegada) — pode evoluir.

## Objetivo (1 frase)
Construir a função Checklist no app (lista padrão editável + ticar por papel), guardar na nuvem, e ligar o componente do Command Box pra mostrar ao vivo os pendentes.

## Plano (≤5 passos)
1. Mapear como o app constrói uma função (modelo/repositório/migração local/tela/sync) — padrão Estoque/Manutenção.
2. Modelo de dados + lista padrão (seed) do checklist.
3. Função no app (montar/editar lista + ticar).
4. Guardar na nuvem (tabela nova — só vai pra produção com ordem "MIGRAR PARA PRODUÇÃO").
5. Ligar o componente do Command Box no checklist real (espelho ao vivo).

## Ambiente: desenvolvimento. Produção protegida: sim. Autorização produção: não.
## Riscos: app iOS exige empacotar + instalar no iPhone; nuvem é única (produção) → tabela nova só aplica com ordem literal; checklist de corrida = não inventar (lista é proposta editável).
## Status: Etapa 1 (base no app) FEITA E PROVADA.

### Etapa 1 — base de dados no app (testável sem iPhone) — CONCLUÍDA
Mapeamento via Explore: app iOS em `ios/p1fast-ios/` (Views SwiftUI + Persistence repos), núcleo testável `ios/p1fast-core/` (Models/Migrations/SyncQueue, teste `swift run p1fast-smoke`). Papéis JÁ existem (`pessoa_papeis`: piloto/engenheiro/mecanico/chefe_equipe). Última migration era v34.
Construído (padrão Estoque):
- `Models.swift`: structs `ChecklistItem` (momento saida/chegada, nome, papel, obrigatorio, ativo, ordem, synced_at) + `ChecklistTique` (evento_id, item_id, checado, checado_por/papel).
- `Migrations.swift`: **v35_checklist_pista** cria `checklist_item` + `checklist_tique`.
- `ChecklistCatalogo.swift`: lista padrão aprovada (11 saída + 8 chegada) + `bootstrap` (semeia se vazio, idempotente) + `pendentes` (ativos, não checados, obrigatório em cima — pro Command Box).
- Testes `main.swift`: PERSIST-01 atualizado p/ 41 tabelas (consertou falha antiga 34→39); CHECKLIST-01/02 novos.
Resultado: `swift run p1fast-smoke` = **552 ok / 1 fail**. A 1 falha é PRÉ-EXISTENTE e sem relação (PERSIST-03 `evento_pendencias_extra` sem synced_at). Nada em produção; app não reinstalado (é só a base).

### Faltam (próximas etapas)
2. Telas no app (SwiftUI): editar a lista padrão (adicionar/desativar) + ticar por papel. EXIGE empacotar + instalar no iPhone (Team K3MU9U9952).
3. Guardar na nuvem: tabela espelho `checklist_item`/`checklist_tique` no Supabase (migration nova) + sync. SÓ aplica em produção com ordem "MIGRAR PARA PRODUÇÃO".
4. Ligar o componente do Command Box no checklist real (espelho ao vivo dos pendentes).
